// Normalize CJK punctuation in rag/faq-cache.ts ONLY (never triage.ts — that
// file's parens/pipes are regex syntax, not prose). Two passes, both gated to
// avoid touching code-ish content:
//   1. CJK-adjacent colon ':' -> '：', but NOT inside markdown links ](..),
//      'Email:' / 'メール:', times like 09:00, or urls (http:).
//   2. parens wrapping CJK-only content -> （）, skipping any with ASCII letters.
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'rag/faq-cache.ts'
const CJK = '\\u3040-\\u30ff\\u3400-\\u9fff'
const HAS_LATIN = /[A-Za-z]/

let colons = 0
let parens = 0
const out = readFileSync(path, 'utf8')
  .split('\n')
  .map((line) => {
    if (!new RegExp(`[${CJK}]`).test(line)) return line
    // 1. colon immediately AFTER a CJK char -> full-width. (A CJK char before
    //    the colon means it's prose, not Email:/http:/09:00 which are ASCII-led.)
    line = line.replace(new RegExp(`([${CJK}]):`, 'g'), (_m, c) => {
      colons++
      return `${c}：`
    })
    // 2. half-width parens with CJK-only inner content
    line = line.replace(/\(([^)]+)\)/g, (m, inner) => {
      if (HAS_LATIN.test(inner)) return m
      if (!new RegExp(`[${CJK}]`).test(inner)) return m
      parens++
      return `（${inner}）`
    })
    return line
  })
  .join('\n')

writeFileSync(path, out)
console.log(`faq-cache.ts: ${colons} colons, ${parens} parens → full-width`)
