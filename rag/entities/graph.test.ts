// Unit tests for the lightweight entity-graph injection. No secrets:
//   npx tsx --test rag/entities/graph.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { entityContext } from './graph.js'

test('no recognized entity → empty (generic questions pay nothing)', () => {
  assert.equal(entityContext('What is the weather today?'), '')
})

test('one-hop: a project surfaces its edges', () => {
  const ctx = entityContext('Tell me about Plutus Trade')
  assert.match(ctx, /Entity relationships:/)
  assert.match(ctx, /Plutus Trade/)
  // Plutus Trade is powered_by Gemini — that edge must appear.
  assert.match(ctx, /Gemini/)
})

test('two-hop: a shared tool connects sibling projects', () => {
  // "Claude" seeds multiple projects (Product Playbook, House Ops, Path proto).
  const ctx = entityContext('Which projects use Claude?')
  assert.match(ctx, /Claude/)
  assert.match(ctx, /Product Playbook/)
})

test('company question surfaces the role + what was launched there', () => {
  const ctx = entityContext('What did Charles do at USPACE?')
  assert.match(ctx, /USPACE/)
  // USPACE launched B2B SaaS — a neighbor edge.
  assert.match(ctx, /B2B SaaS|Product Manager/)
})

test('respects the maxEdges cap', () => {
  const ctx = entityContext('Charles', 3)
  const lines = ctx.split('\n').filter((l) => l.startsWith('- '))
  assert.ok(lines.length <= 3, `expected ≤3 edge lines, got ${lines.length}`)
})
