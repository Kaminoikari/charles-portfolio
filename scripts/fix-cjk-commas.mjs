// One-shot: fix half-width commas in the CJK answers of faq-cache.ts to the
// house style (zh-TW: ，  ja: 、). Per-line language detection (kana ⇒ Japanese,
// CJK-only ⇒ Chinese, else leave). Only replaces a half-width comma that is
// adjacent to a CJK/kana char, so English lists (React, TypeScript), numbers,
// URLs, emails, and markdown links are untouched.
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'rag/faq-cache.ts'
const KANA = /[぀-ヿ]/
const CJK = /[㐀-鿿]/
const CJKK = '\\u3040-\\u30ff\\u3400-\\u9fff'

let changed = 0
const out = readFileSync(path, 'utf8')
  .split('\n')
  .map((line) => {
    const isJa = KANA.test(line)
    const isZh = !isJa && CJK.test(line)
    if (!isJa && !isZh) return line
    const repl = isJa ? '、' : '，'
    // half-width comma where the char before OR after is CJK/kana
    return line.replace(
      new RegExp(`(?<=[${CJKK}]),|,(?=[${CJKK}])`, 'g'),
      () => {
        changed++
        return repl
      },
    )
  })
  .join('\n')

writeFileSync(path, out)
console.log(`Replaced ${changed} half-width commas.`)
