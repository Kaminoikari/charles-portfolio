// Consistency guards binding the entity graph back to src/data. No network:
//   npx tsx --test rag/entities/relations.test.ts
//
// relations.json is injected into generation whenever a question names one of
// its entities, and the model reads it as fact. It is hand-written, and the
// first time it was compared with src/data it was already wrong: it called
// Charles a Product Manager at USPACE while the site said Head of Product, and
// quoted "3 product lines" that no record states. Nothing failed, because
// nothing looked. Each test below pins one way the file can drift.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import relationsData from './relations.json' with { type: 'json' }
import { edgeLine, roleFor } from './graph.js'
import { groundFacts } from '../grounding.js'
import { extractAll } from '../ingest/extract.js'
import { projects, projectDetails } from '../../src/data/projects.en.ts'
import { experience } from '../../src/data/experience.en.ts'

const { entities, relations } = relationsData
const label = (id: string) => entities.find((e) => e.id === id)?.label ?? id
const ofType = (type: string) => entities.filter((e) => e.type === type)

test('every employer in src/data is a company in the graph, and no other company is', () => {
  const companies = ofType('company').map((e) => e.label)
  const unmatched = experience.filter((r) => !companies.some((c) => r.organization.startsWith(c)))
  assert.deepEqual(
    unmatched.map((r) => r.organization),
    [],
  )
  const orphaned = companies.filter((c) => !experience.some((r) => r.organization.startsWith(c)))
  assert.deepEqual(orphaned, [])
})

test('every project in src/data is a project in the graph under its own id and title, and no other is', () => {
  const inGraph = ofType('project').map((e) => `${e.id}=${e.label}`).sort()
  const inData = projects.map((p) => `${p.id}=${p.title}`).sort()
  assert.deepEqual(inGraph, inData)
})

test('every edge joins two entities the graph defines, and every entity has an edge', () => {
  const ids = new Set(entities.map((e) => e.id))
  assert.deepEqual(
    relations.flatMap((r) => [r.from, r.to]).filter((id) => !ids.has(id)),
    [],
  )
  const used = new Set(relations.flatMap((r) => [r.from, r.to]))
  assert.deepEqual(
    entities.map((e) => e.id).filter((id) => !used.has(id)),
    [],
  )
})

test('every employer is reached through employed_by, the edge that reads its role from src/data', () => {
  // A hand-written works_at would carry its own title and tense again, which is
  // the exact copy that went stale. Only employed_by renders from the record.
  const employed = new Set(relations.filter((r) => r.rel === 'employed_by').map((r) => r.to))
  assert.deepEqual(
    ofType('company')
      .map((e) => e.id)
      .filter((id) => !employed.has(id)),
    [],
  )
  assert.deepEqual(
    relations.filter((r) => /^(works|worked|mentors)_at$/.test(r.rel)).map((r) => `${r.from} ${r.rel} ${r.to}`),
    [],
  )
})

test('an employed_by edge renders the title and dates src/data records, in the right tense', () => {
  for (const r of relations.filter((x) => x.rel === 'employed_by')) {
    const role = roleFor(label(r.to))
    const line = edgeLine(r)
    assert.ok(line.includes(role.title), `${line} omits the title "${role.title}"`)
    assert.ok(line.includes(role.dateRange), `${line} omits the dates "${role.dateRange}"`)
    const current = /present/i.test(role.dateRange)
    assert.ok(line.includes(current ? ' works at ' : ' worked at '), `${line} has the wrong tense`)
  }
})

test('an employed_by note names no job title of its own', () => {
  // The title is rendered from the record; a note that carries one again is the
  // hand copy this edge exists to remove, and it would sit beside the real title
  // in the same line, contradicting it once either changes.
  const titles = [...new Set(experience.map((r) => r.title)), 'PM']
  const carrying = relations
    .filter((r) => r.rel === 'employed_by')
    .filter((r) => {
      const note = (r as { note?: string }).note ?? ''
      return titles.some((t) => new RegExp(`\\b${t}\\b`).test(note))
    })
    .map((r) => `${r.to}: ${(r as { note?: string }).note}`)
  assert.deepEqual(carrying, [])
})

test('the role lookup refuses a company that matches no role, or more than one', () => {
  // The live data matches each company exactly once, so the live test above
  // cannot tell a lookup that checks from one that takes the first match.
  const two = [experience[0], { ...experience[0], title: 'Other' }]
  assert.throws(() => roleFor(label('uspace'), two), /matches 2 roles/)
  assert.throws(() => roleFor('Nobody Inc.'), /matches 0 roles/)
})

test('a project is built with, or powered by, only what its own page says it uses', () => {
  // Matched on the label's first word ("Google Gemini" → "Gemini" would miss, so
  // every alias of the label is tried, the way graph.ts finds entities).
  const aliases = (l: string) =>
    l
      .split('/')
      .map((p) => p.trim())
      .flatMap((p) => [p, p.split(/\s+/).at(-1)!, p.split(/\s+/)[0]])
      .filter((a) => a.length >= 3)
  const page = (id: string) => JSON.stringify(projectDetails.find((d) => d.id === id))
  const wrong = relations
    .filter((r) => r.rel === 'built_with' || r.rel === 'powered_by')
    .filter((r) => !aliases(label(r.to)).some((a) => page(r.from).includes(a)))
    .map((r) => `${r.from} ${r.rel} ${label(r.to)}`)
  assert.deepEqual(wrong, [])
})

test('every number and date a note quotes is one src/data still states', async () => {
  const chunks = await extractAll()
  const stale = relations
    .filter((r): r is typeof r & { note: string } => typeof (r as { note?: string }).note === 'string')
    .flatMap((r) => groundFacts(r.note, 'en', chunks).ungrounded.map((f) => `${r.from}→${r.to}: ${f}`))
  assert.deepEqual(stale, [])
})
