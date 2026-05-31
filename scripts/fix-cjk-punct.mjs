// One-shot: normalize CJK punctuation in the FAQ + triage answer strings.
//   1. Parentheses wrapping CJK-only content → full-width （） (but leave
//      half-width when the content contains ASCII letters, e.g. (dense + BM25)).
//   2. Half-width comma adjacent to CJK → full-width (zh: ，  ja: 、) — catches
//      files the earlier pass missed (triage.ts).
import { readFileSync, writeFileSync } from 'node:fs'

const CJKK = '\\u3040-\\u30ff\\u3400-\\u9fff\\uff00-\\uffef'
const KANA = /[぀-ヿ]/
const HAS_LATIN = /[A-Za-z]/

for (const path of ['rag/faq-cache.ts', 'rag/triage.ts']) {
  let parens = 0
  let commas = 0
  const out = readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => {
      const isJa = KANA.test(line)
      const isZh = !isJa && new RegExp(`[\\u3400-\\u9fff]`).test(line)
      if (!isJa && !isZh) return line
      // 1. parens: only when inner content is CJK/space/full-width-punct, no ASCII letters
      line = line.replace(/\(([^)]+)\)/g, (m, inner) => {
        if (HAS_LATIN.test(inner)) return m // keep (dense + BM25), (JTBD…)
        if (!new RegExp(`[${CJKK}]`).test(inner)) return m // pure ascii/num — keep
        parens++
        return `（${inner}）`
      })
      // 2. commas adjacent to CJK
      line = line.replace(new RegExp(`(?<=[${CJKK}]),|,(?=[${CJKK}])`, 'g'), () => {
        commas++
        return isJa ? '、' : '，'
      })
      return line
    })
    .join('\n')
  writeFileSync(path, out)
  console.log(`${path}: ${parens} parens, ${commas} commas fixed`)
}
