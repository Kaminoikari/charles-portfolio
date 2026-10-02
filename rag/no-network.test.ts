// Pins rag/no-network.ts, the preload that keeps `npm run rag:test` offline.
// Each case runs a child process under it; the child's fetch is refused by the
// preload, so no request leaves the machine.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const PRELOAD = fileURLToPath(new URL('./no-network.ts', import.meta.url))

function runFetch(url: string) {
  const code = `fetch(${JSON.stringify(url)}).then(() => console.log('SENT'), (e) => console.log('REFUSED', e.message))`
  return spawnSync(process.execPath, ['--import', 'tsx', '--import', PRELOAD, '--input-type=module', '-e', code], { encoding: 'utf8' })
}

test('no-network: a request to a real host is refused and fails the process', () => {
  const r = runFetch('https://api.voyageai.com/v1/embeddings')
  assert.match(r.stdout, /REFUSED/, r.stdout + r.stderr)
  assert.equal(r.status, 1, r.stderr)
  assert.match(r.stderr, /unstubbed network request\(s\) to: api\.voyageai\.com/, r.stderr)
})

test('no-network: a loopback request is refused without failing the process', () => {
  const r = runFetch('http://127.0.0.1:6333/collections')
  assert.match(r.stdout, /REFUSED/, r.stdout + r.stderr)
  assert.equal(r.status, 0, r.stderr)
})
