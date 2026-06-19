// Unit tests for the streaming stall-timeout guard. No network/secrets:
//   npx tsx --test rag/llm.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { withStallTimeout } from './llm.js'

async function* steady(chunks: string[], gapMs: number): AsyncGenerator<string> {
  for (const c of chunks) {
    await new Promise((r) => setTimeout(r, gapMs))
    yield c
  }
}

async function* stallAfter(first: string, stallMs: number): AsyncGenerator<string> {
  yield first
  await new Promise((r) => setTimeout(r, stallMs))
  yield 'never reached in time'
}

// withStallTimeout enforces a per-CHUNK deadline, not a total-completion one:
// the whole point of the Gemini fix is that a long but healthy stream is allowed
// to finish while a stalled/silent provider still fails over fast.
test('withStallTimeout: lets a long stream finish when every gap is within the window', async () => {
  // 6 tokens 30ms apart = 180ms total, far past a single 50ms window, but no
  // single gap exceeds it — must NOT time out.
  const out: string[] = []
  for await (const c of withStallTimeout(steady(['a', 'b', 'c', 'd', 'e', 'f'], 30), 50, 'T')) {
    out.push(c)
  }
  assert.equal(out.join(''), 'abcdef')
})

test('withStallTimeout: rejects when a chunk stalls past the deadline', async () => {
  await assert.rejects(
    (async () => {
      for await (const _ of withStallTimeout(stallAfter('a', 80), 40, 'T')) void _
    })(),
    /stalled \(no token in 40ms\)/,
  )
})

test('withStallTimeout: rejects when the first token never arrives in time', async () => {
  await assert.rejects(
    (async () => {
      for await (const _ of withStallTimeout(steady(['a'], 80), 40, 'T')) void _
    })(),
    /T stalled/,
  )
})

test('withStallTimeout: cancels the upstream stream via return() on early exit', async () => {
  let cancelled = false
  const cancellable: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        next: () =>
          Promise.resolve(i++ === 0 ? { value: 'a', done: false } : { value: undefined as unknown as string, done: true }),
        return: () => {
          cancelled = true
          return Promise.resolve({ value: undefined as unknown as string, done: true })
        },
      }
    },
  }
  const gen = withStallTimeout(cancellable, 50, 'T')
  await gen.next()
  await gen.return(undefined)
  assert.equal(cancelled, true)
})
