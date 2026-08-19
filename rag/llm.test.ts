// Unit tests for the first-token-gated streaming consumer. No network/secrets:
//   npx tsx --test rag/llm.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { consumeGated, generateWithFallback } from './llm.js'

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
  const res = await consumeGated(
    chunks([
      { content: 'a', afterMs: 30 },
      { content: 'b', afterMs: 30 },
      { content: 'c', afterMs: 30 },
      { content: 'd', afterMs: 30 },
      { content: 'e', afterMs: 30 },
    ]),
    opts,
  )
  assert.equal(res.text, 'abcde')
  assert.equal(res.stalled, false)
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
  const res = await consumeGated(
    chunks([
      { content: '', afterMs: 10 },
      { content: '', afterMs: 10 },
      { content: 'hi', afterMs: 10 },
      { content: ' there', afterMs: 10 },
    ]),
    opts,
  )
  assert.equal(res.text, 'hi there')
})

test('consumeGated: after the first token, a stall returns the partial answer (no throw)', async () => {
  // First token is fast (commit), then a gap longer than stallMs: we must NOT
  // throw — that would let the caller swap providers over visible text.
  const res = await consumeGated(
    chunks([
      { content: 'partial', afterMs: 10 },
      { content: ' more', afterMs: 200 },
    ]),
    opts,
  )
  assert.equal(res.text, 'partial')
  // And the caller is told, so the half sentence can announce itself.
  assert.equal(res.stalled, true)
})

test('consumeGated: ignores non-string chunk content', async () => {
  const res = await consumeGated(
    chunks([
      { content: 'a', afterMs: 10 },
      { content: [{ type: 'text', text: 'block' }], afterMs: 10 },
      { content: 'b', afterMs: 10 },
    ]),
    opts,
  )
  assert.equal(res.text, 'ab')
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

// A stall is not just a log line. Phase 2 hands back whatever arrived, and that
// partial answer goes on to be shown, persisted to chat_logs, and replayed as
// history on the next turn — where the model reads its own half-finished
// sentence with nothing to explain it. That is the shape of the 2026-08-19
// incident, where a ragged edge with no marker got explained as a failure that
// had not happened. So the caller has to be told, and the only way to tell it
// is to return the fact alongside the text.
test('consumeGated: reports that it stalled, so the caller can say so', async () => {
  const res = await consumeGated(
    chunks([
      { content: 'half a sen', afterMs: 20 },
      { content: 'tence', afterMs: 200 }, // past the 60ms stall window
    ]),
    opts,
  )
  assert.equal(res.text, 'half a sen')
  assert.equal(res.stalled, true)
})

test('consumeGated: a stream that finishes on its own is not marked stalled', async () => {
  const res = await consumeGated(
    chunks([
      { content: 'a', afterMs: 20 },
      { content: 'b', afterMs: 20 },
    ]),
    opts,
  )
  assert.equal(res.text, 'ab')
  assert.equal(res.stalled, false)
})

// The wiring between consumeGated and the caller needs its own test. The node
// layer injects a stub generator (resolveGenerator), so a node test never runs
// this function, and a dropped `stalled` here would be invisible from both
// sides — the same shape of gap that left the history ceilings in nodes.ts
// unpinned until a review caught them.
//
// The stream throws rather than idling, because Phase 2 treats an error and a
// stall as one case ("Stall/error ends with partial text") and a real idle would
// mean waiting out GEMINI_STALL_MS.
test('generateWithFallback: carries the stall signal from the stream out to the caller', async () => {
  async function* diesAfterFirstToken() {
    yield { content: 'half a sen' }
    throw new Error('connection reset')
  }
  const res = await generateWithFallback([{ role: 'user', content: 'q' }], {}, () => ({
    stream: async () => diesAfterFirstToken(),
  }))
  assert.equal(res.provider, 'gemini')
  assert.equal(res.text, 'half a sen')
  assert.equal(res.stalled, true)
})

test('generateWithFallback: a stream that completes reports no stall', async () => {
  async function* healthy() {
    yield { content: 'a whole ' }
    yield { content: 'answer.' }
  }
  const res = await generateWithFallback([{ role: 'user', content: 'q' }], {}, () => ({
    stream: async () => healthy(),
  }))
  assert.equal(res.text, 'a whole answer.')
  assert.equal(res.stalled, false)
})
