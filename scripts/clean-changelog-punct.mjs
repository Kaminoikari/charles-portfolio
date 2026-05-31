// One-shot: clean punctuation in the rag-chatbot changelog entry only.
import { readFileSync, writeFileSync } from 'node:fs'

const files = [
  ['src/data/changelog.en.ts', 'en'],
  ['src/data/changelog.zh-TW.ts', 'zh'],
  ['src/data/changelog.ja.ts', 'ja'],
]

for (const [path, lang] of files) {
  const src = readFileSync(path, 'utf8')
  const start = src.indexOf("id: 'rag-chatbot'")
  const end = src.indexOf("id: 'product-playbook-closed-loop'")
  if (start < 0 || end < 0) {
    console.log(`${path}: markers not found, skipped`)
    continue
  }
  const before = src.slice(0, start)
  let mid = src.slice(start, end)
  const after = src.slice(end)

  const colon = lang === 'en' ? ': ' : '：'
  mid = mid.replace(/(\*\*)\s+—\s+/g, `$1${colon}`)
  mid = mid.replace(/——/g, lang === 'en' ? ': ' : '：')
  mid = mid.replace(/\s+—\s+/g, lang === 'en' ? ': ' : '：')
  if (lang !== 'en') {
    const repl = lang === 'ja' ? '、' : '，'
    mid = mid.replace(/(?<=[぀-ヿ㐀-鿿]),|,(?=[぀-ヿ㐀-鿿])/g, repl)
  }

  writeFileSync(path, before + mid + after)
  console.log(`${path}: cleaned`)
}
