// Preloaded by `npm run rag:test`. A test that forgets to stub a dependency
// would otherwise send a real request to Voyage, Qdrant or a model provider,
// and the fail-soft paths swallow the error, so the suite stays green while it
// spends quota. Every fetch that reaches the global is refused, and one aimed
// at a real host fails the test file. Loopback is refused without failing:
// qdrant.test.ts connects to the unconfigured default on purpose.

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]'])
const strays: string[] = []

globalThis.fetch = async (input: string | URL | Request): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : input)
  if (!LOOPBACK.has(url.hostname)) strays.push(url.host)
  throw new TypeError(`fetch failed: network is off in tests (${url.host})`)
}

process.on('exit', () => {
  if (strays.length === 0) return
  process.stderr.write(`unstubbed network request(s) to: ${[...new Set(strays)].join(', ')}\n`)
  process.exitCode = 1
})
