// Unit tests for the PAID tier of generate: Claude, streamed under the same
// first-token gate as Gemini. No network/secrets:
//   npx tsx --test rag/llm-claude-tier.test.ts
//
// The deadlines are read once at module load, so they are set here BEFORE the
// import and llm.js is pulled in dynamically. Both windows are shrunk to 60ms
// to keep the tests fast; the assertions quote that number back, so a test that
// silently ran against the 15s default fails instead of passing slowly.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.RAG_CLAUDE_FIRST_TOKEN_MS = '60'
process.env.RAG_CLAUDE_STALL_MS = '60'

const { generateWithFallback } = await import('./llm.js')

type Chunk = { content: unknown }

async function* chunks(parts: Array<{ content: unknown; afterMs: number }>): AsyncGenerator<Chunk> {
  for (const p of parts) {
    await new Promise((r) => setTimeout(r, p.afterMs))
    yield { content: p.content }
  }
}

// Tier 1 always fails in these tests: what is under test is what happens after.
const geminiDown = () => ({
  stream: async () => {
    throw new Error('429 quota exceeded')
  },
})

// The regression this file exists for. Claude used to be a plain invoke under a
// cap on the whole answer, so a long answer could breach the deadline purely by
// being long — which is how one visitor's question failed on 2026-09-17 and
// succeeded a minute later. Streamed, each 30ms gap is inside the 60ms window
// while the 270ms total is far past it, and the answer must still complete.
test('Claude fallback: a long answer completes, because the gate is per chunk', async () => {
  const res = await generateWithFallback(
    [{ role: 'user', content: 'q' }],
    {},
    geminiDown,
    () =>
      ({
        stream: async () =>
          chunks(
            Array.from({ length: 9 }, (_, i) => ({ content: `part${i} `, afterMs: 30 })),
          ),
      }),
  )
  assert.equal(res.provider, 'claude')
  assert.equal(res.text, 'part0 part1 part2 part3 part4 part5 part6 part7 part8 ')
  assert.equal(res.stalled, false)
})

// Claude is the last tier, so its gate has nothing to fall back to: a breach
// fails the request, the same way the old cap did. The message carries the
// window, which is also how this file proves it is running against its own
// 60ms setting rather than the default.
test('Claude fallback: no first token inside the gate fails the request', async () => {
  await assert.rejects(
    generateWithFallback([{ role: 'user', content: 'q' }], {}, geminiDown, () => ({
      stream: async () => chunks([{ content: 'too late', afterMs: 300 }]),
    })),
    /Claude produced no first token in 60ms/,
  )
})

// Streaming gives the paid tier a state the invoke never had: committed, then
// gone quiet. The partial answer travels with `stalled` so the generate node can
// append its notice instead of handing the visitor a bare half sentence.
test('Claude fallback: a stall after the first token keeps what arrived', async () => {
  async function* diesAfterFirstToken() {
    yield { content: 'half a sen' }
    throw new Error('connection reset')
  }
  const res = await generateWithFallback([{ role: 'user', content: 'q' }], {}, geminiDown, () => ({
    stream: async () => diesAfterFirstToken(),
  }))
  assert.equal(res.provider, 'claude')
  assert.equal(res.text, 'half a sen')
  assert.equal(res.stalled, true)
})

// `strong` picks Sonnet over Haiku for broad questions. It reaches the factory
// as an argument now rather than being read off a closure, so a wiring slip
// would silently downgrade every broad answer to Haiku with nothing failing.
test('Claude fallback: passes `strong` through to the model factory', async () => {
  const seen: Array<boolean> = []
  await generateWithFallback([{ role: 'user', content: 'q' }], { strong: true }, geminiDown, (strong) => {
    seen.push(strong)
    return { stream: async () => chunks([{ content: 'ok', afterMs: 1 }]) }
  })
  assert.deepEqual(seen, [true])
})
