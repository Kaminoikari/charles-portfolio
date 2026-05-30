// Lightweight entity-graph injection — the deliberate alternative to GraphRAG.
//
// The portfolio's entity relationships (Charles ↔ roles ↔ projects ↔ tools) are
// a few dozen edges, so instead of standing up Neo4j we hand-maintain an
// adjacency list (relations.json) and, at query time, render the subgraph
// around whatever entities the question mentions. That gives the generate node
// relationship-aware, multi-hop context ("which projects use Claude?",
// "what did he do across his fintech roles?") at zero infrastructure cost.

import relationsData from './relations.json' with { type: 'json' }

interface Entity {
  id: string
  type: string
  label: string
}
interface Relation {
  from: string
  rel: string
  to: string
  note?: string
}

const ENTITIES: Entity[] = relationsData.entities
const RELATIONS: Relation[] = relationsData.relations

const byId = new Map(ENTITIES.map((e) => [e.id, e]))

// Find entity ids mentioned in the text. A label like "Claude / Claude Code"
// or "USPACE for Business" should match the bare name the user actually types
// ("Claude", "USPACE"), so we test each alias derived from the label rather than
// requiring the full label string to appear verbatim.
function labelAliases(label: string): string[] {
  const aliases = new Set<string>()
  // Split on separators so "Claude / Claude Code" → ["Claude", "Claude Code"].
  for (const part of label.split('/')) {
    const p = part.trim()
    if (p.length >= 3) aliases.add(p.toLowerCase())
    // First token too ("USPACE" from "USPACE for Business").
    const first = p.split(/\s+/)[0]
    if (first.length >= 3) aliases.add(first.toLowerCase())
  }
  return [...aliases]
}

function mentionedEntityIds(text: string): Set<string> {
  const lower = text.toLowerCase()
  const hits = new Set<string>()
  for (const e of ENTITIES) {
    if (labelAliases(e.label).some((a) => lower.includes(a))) hits.add(e.id)
  }
  return hits
}

// Render one edge as a readable line: "Charles —built→ Path (note)".
function edgeLine(r: Relation): string {
  const from = byId.get(r.from)?.label ?? r.from
  const to = byId.get(r.to)?.label ?? r.to
  const rel = r.rel.replace(/_/g, ' ')
  return r.note ? `- ${from} ${rel} ${to} (${r.note})` : `- ${from} ${rel} ${to}`
}

// Build the entity-relationship context for a question. Returns the edges
// touching any mentioned entity (one hop), plus edges among those neighbors so
// two-hop relationships surface (e.g. question mentions "Claude" → returns every
// project powered_by Claude, and what those projects are). Empty string when no
// entity is recognized, so generic questions pay nothing.
export function entityContext(question: string, maxEdges = 14): string {
  const seeds = mentionedEntityIds(question)
  if (seeds.size === 0) return ''

  // One hop: every edge incident to a seed. Collect the neighbor ids too.
  const neighbors = new Set<string>(seeds)
  const oneHop: Relation[] = []
  for (const r of RELATIONS) {
    if (seeds.has(r.from) || seeds.has(r.to)) {
      oneHop.push(r)
      neighbors.add(r.from)
      neighbors.add(r.to)
    }
  }

  // Two hop: edges among the neighbor set that we haven't already included.
  const seen = new Set(oneHop)
  const twoHop: Relation[] = []
  for (const r of RELATIONS) {
    if (!seen.has(r) && neighbors.has(r.from) && neighbors.has(r.to)) twoHop.push(r)
  }

  const edges = [...oneHop, ...twoHop].slice(0, maxEdges)
  if (edges.length === 0) return ''
  return 'Entity relationships:\n' + edges.map(edgeLine).join('\n')
}
