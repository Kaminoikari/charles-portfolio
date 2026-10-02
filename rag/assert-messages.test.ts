// A failing assert.ok(x) with no message makes Node rebuild the message from
// the source: it re-parses the file with acorn from every token before the call
// site. Under tsx the call site arrives in transpiled coordinates, so Node reads
// the TypeScript file at the wrong place, every parse attempt fails, and each
// failure rescans the text. The cost grows with the square of the file, so
// nodes.test.ts spun at full CPU for over 60 seconds without exiting, and a red
// test looked like a hung CI job. Passing a message skips that path entirely,
// so every assert.ok and bare assert call in the rag suite must carry one.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

const RAG_DIR = fileURLToPath(new URL('.', import.meta.url))

// The same files `npm run rag:test` runs: every *.test.ts under rag/.
function testFiles(): string[] {
  return readdirSync(RAG_DIR, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.test.ts') && !f.split('/').includes('node_modules'))
}

function bareAsserts(fileName: string, source: string): number[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const lines: number[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length < 2) {
      const callee = node.expression.getText(sf)
      if (callee === 'assert' || callee === 'assert.ok') {
        lines.push(sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return lines
}

test('bareAsserts: finds assert.ok and assert with one argument, and only those', () => {
  const src = [
    "assert.ok(a)",
    "assert(b)",
    "assert.ok(c, 'c holds')",
    "assert(d, 'd holds')",
    "assert.equal(e, 1)",
  ].join('\n')
  assert.deepEqual(bareAsserts('x.test.ts', src), [1, 2])
})

test('every assert.ok and bare assert in the rag suite carries a message', () => {
  const files = testFiles()
  assert.ok(files.includes('ingest/chunk.test.ts'), 'the scan must reach test files in subdirectories')
  const offenders = files.flatMap((f) =>
    bareAsserts(f, readFileSync(RAG_DIR + f, 'utf8')).map((line) => `rag/${f}:${line}`),
  )
  assert.deepEqual(offenders, [], 'add a message to each of these asserts')
})
