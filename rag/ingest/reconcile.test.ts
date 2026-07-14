// Unit tests for the incremental-ingest core. No secrets / network:
//   npx tsx --test rag/ingest/reconcile.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { chunkHash, reconcile, isPruneSafe, type HashInput, type DesiredChunk } from './reconcile.js'

const base: HashInput = {
  content: 'the impact was a 30% lift in activation',
  contextSource: '',
  models: ['voyage-3-large', '1024', 'qdrant/bm25'],
  payload: { title: 'Project — impact', source_type: 'project', locale: 'en' },
}

// ── chunkHash ────────────────────────────────────────────────────────────
test('chunkHash: identical input → identical hash', () => {
  assert.equal(chunkHash(base), chunkHash({ ...base }))
})

test('chunkHash: content change flips the hash', () => {
  assert.notEqual(chunkHash(base), chunkHash({ ...base, content: base.content + '!' }))
})

test('chunkHash: model / dimension swap flips the hash (re-embed on model change)', () => {
  assert.notEqual(chunkHash(base), chunkHash({ ...base, models: ['voyage-3.5', '1024', 'qdrant/bm25'] }))
  assert.notEqual(chunkHash(base), chunkHash({ ...base, models: ['voyage-3-large', '2048', 'qdrant/bm25'] }))
})

test('chunkHash: turning on contextualisation (contextSource set + context model) flips the hash', () => {
  const contextual: HashInput = {
    ...base,
    contextSource: 'Full project case study text …',
    models: [...base.models, 'claude-haiku-4-5-20251001'],
  }
  assert.notEqual(chunkHash(base), chunkHash(contextual))
})

test('chunkHash: parent-doc edit re-contextualises the fragment', () => {
  const a: HashInput = { ...base, contextSource: 'doc v1', models: [...base.models, 'ctx'] }
  const b: HashInput = { ...base, contextSource: 'doc v2', models: [...base.models, 'ctx'] }
  assert.notEqual(chunkHash(a), chunkHash(b))
})

test('chunkHash: payload metadata change (e.g. title) flips the hash', () => {
  assert.notEqual(chunkHash(base), chunkHash({ ...base, payload: { ...base.payload, title: 'renamed' } }))
})

test('chunkHash: payload key ORDER does not matter (canonicalised)', () => {
  const reordered: HashInput = {
    ...base,
    payload: { locale: 'en', source_type: 'project', title: 'Project — impact' },
  }
  assert.equal(chunkHash(base), chunkHash(reordered))
})

// ── reconcile ────────────────────────────────────────────────────────────
const desired: DesiredChunk[] = [
  { chunkId: 'a', hash: 'h-a' },
  { chunkId: 'b', hash: 'h-b-NEW' },
  { chunkId: 'c', hash: 'h-c' }, // brand new, not in Qdrant
]

test('reconcile: cold start (empty Qdrant) builds everything, deletes nothing', () => {
  const plan = reconcile(new Map(), desired)
  assert.deepEqual(plan.toBuild.sort(), ['a', 'b', 'c'])
  assert.deepEqual(plan.unchanged, [])
  assert.deepEqual(plan.toDelete, [])
})

test('reconcile: classifies unchanged / changed / new / stale', () => {
  const existing = new Map([
    ['a', 'h-a'], // unchanged
    ['b', 'h-b-OLD'], // changed
    ['stale', 'h-x'], // no longer in the corpus → delete
  ])
  const plan = reconcile(existing, desired)
  assert.deepEqual(plan.unchanged, ['a'])
  assert.deepEqual(plan.toBuild.sort(), ['b', 'c'])
  assert.deepEqual(plan.toDelete, ['stale'])
})

test('reconcile: no changes → nothing to build, embed count would be zero', () => {
  const existing = new Map([
    ['a', 'h-a'],
    ['b', 'h-b-NEW'],
    ['c', 'h-c'],
  ])
  const plan = reconcile(existing, desired)
  assert.deepEqual(plan.toBuild, [])
  assert.equal(plan.unchanged.length, 3)
  assert.deepEqual(plan.toDelete, [])
})

// ── isPruneSafe (mass-delete guard) ────────────────────────────────────────
test('isPruneSafe: a handful of deletions proceeds automatically', () => {
  assert.equal(isPruneSafe(15, 100), true)
  assert.equal(isPruneSafe(100, 100), true) // boundary is inclusive
})

test('isPruneSafe: an oversized delete (e.g. blog bodies disabled) is refused', () => {
  assert.equal(isPruneSafe(600, 100), false)
})
