// Unit tests for the first-token-gated streaming consumer. No network/secrets:
//   npx tsx --test rag/llm.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { consumeGated } from './llm.js'

type Chunk = { content: unknown }

// A chat-model-style stream that emits {content} chunks on a schedule.
async function* chunks(parts: Array<{ content: unknown; afterMs: number }>): AsyncGenerator<Chunk> {
  for (const p of parts) {
    await new Promise((r) => setTimeout(r, p.afterMs))
    yield { content: p.content }
  }
}

const opts = { firstTokenMs: 60, stallMs: 60, label: 'T' }

// consumeGated enforces a FIRST-TOKEN gate: it may only throw (→ caller falls
// back) before any visible token is emitted; once committed it returns whatever
// it has rather than swapping providers mid-stream.
test('consumeGated: accumulates a healthy long stream to completion', async () => {
  // 5 tokens 30ms apart = 150ms total, far past one 60ms window, but each gap is
  // within it — must finish on this provider, no throw.
  const text = await consumeGated(
    chunks([
      { content: 'a', afterMs: 30 },
      { content: 'b', afterMs: 30 },
      { content: 'c', afterMs: 30 },
      { content: 'd', afterMs: 30 },
      { content: 'e', afterMs: 30 },
    ]),
    opts,
  )
  assert.equal(text, 'abcde')
})

test('consumeGated: throws when no first token arrives within the gate (→ fallback)', async () => {
  await assert.rejects(
    consumeGated(chunks([{ content: 'a', afterMs: 200 }]), opts),
    /produced no first token in 60ms/,
  )
})

test('consumeGated: throws on an empty stream (→ fallback)', async () => {
  await assert.rejects(consumeGated(chunks([]), opts), /produced no output/)
})

test('consumeGated: skips leading empty chunks until the first visible token', async () => {
  // Models can emit empty/metadata chunks first; those must not trip the gate.
  const text = await consumeGated(
    chunks([
      { content: '', afterMs: 10 },
      { content: '', afterMs: 10 },
      { content: 'hi', afterMs: 10 },
      { content: ' there', afterMs: 10 },
    ]),
    opts,
  )
  assert.equal(text, 'hi there')
})

test('consumeGated: after the first token, a stall returns the partial answer (no throw)', async () => {
  // First token is fast (commit), then a gap longer than stallMs: we must NOT
  // throw — that would let the caller swap providers over visible text.
  const text = await consumeGated(
    chunks([
      { content: 'partial', afterMs: 10 },
      { content: ' more', afterMs: 200 },
    ]),
    opts,
  )
  assert.equal(text, 'partial')
})

test('consumeGated: ignores non-string chunk content', async () => {
  const text = await consumeGated(
    chunks([
      { content: 'a', afterMs: 10 },
      { content: [{ type: 'text', text: 'block' }], afterMs: 10 },
      { content: 'b', afterMs: 10 },
    ]),
    opts,
  )
  assert.equal(text, 'ab')
})

test('consumeGated: cancels the upstream stream via return() on gate failure', async () => {
  let cancelled = false
  const stream: AsyncIterable<Chunk> = {
    [Symbol.asyncIterator]() {
      return {
        // Never resolves before the gate fires.
        next: () => new Promise<IteratorResult<Chunk>>(() => {}),
        return: () => {
          cancelled = true
          return Promise.resolve({ value: undefined as unknown as Chunk, done: true })
        },
      }
    },
  }
  await assert.rejects(consumeGated(stream, opts), /no first token/)
  assert.equal(cancelled, true)
})
