// Unit tests for the pure merge helper used by multi-question fan-out. The
// retrieval itself needs Qdrant/Voyage and is covered live; this locks in the
// interleave + dedup + cap semantics that keep the merged context lean.
//   npx tsx --test rag/retrieval.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { Document } from '@langchain/core/documents'
import { mergeInterleaved } from './retrieval.js'

const doc = (id: string) => new Document({ pageContent: id, metadata: { id } })
const ids = (docs: Document[]) => docs.map((d) => d.metadata.id)

test('mergeInterleaved: round-robins across lists and dedups by id', () => {
  const a = [doc('a1'), doc('a2'), doc('shared')]
  const b = [doc('b1'), doc('shared'), doc('b3')]
  // rank0: a1,b1 · rank1: a2, shared · rank2: a's shared (dup→skip), b3
  assert.deepEqual(ids(mergeInterleaved([a, b], 8)), ['a1', 'b1', 'a2', 'shared', 'b3'])
})

test('mergeInterleaved: respects the cap (bounds generation context)', () => {
  const lists = [
    [doc('a1'), doc('a2')],
    [doc('b1'), doc('b2')],
    [doc('c1'), doc('c2')],
  ]
  const merged = mergeInterleaved(lists, 4)
  assert.equal(merged.length, 4)
  assert.deepEqual(ids(merged), ['a1', 'b1', 'c1', 'a2']) // one per list, then next rank
})

test('mergeInterleaved: handles empty and ragged lists', () => {
  assert.deepEqual(mergeInterleaved([], 8), [])
  assert.deepEqual(mergeInterleaved([[], []], 8), [])
  // A sub-question that returned nothing must not stall the others.
  assert.deepEqual(ids(mergeInterleaved([[], [doc('b1'), doc('b2')]], 8)), ['b1', 'b2'])
})
