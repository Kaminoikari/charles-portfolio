// One-shot codemod: add explicit .js extensions to extensionless relative
// imports across rag/ + api/, so the emitted ESM resolves under Node's
// node16/nodenext runtime on Vercel (TS2835 / ERR_MODULE_NOT_FOUND).
// Safe for tsx + vite + bundler resolution (all map ./x.js → ./x.ts).
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const files = execSync("grep -rlE \"from '\\.\\.?/|import '\\.\\.?/\" rag api --include='*.ts'", {
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean)

// Matches the module specifier of static import/export ... from '...'
// and bare side-effect import '...'. Only rewrites specifiers that:
//   start with ./ or ../  AND  whose final path segment has no .ext
const RE = /(\bfrom\s+|^\s*import\s+|\bimport\s+)(['"])(\.\.?\/[^'"]+)(['"])/gm

let changed = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const out = src.replace(RE, (m, pre, q1, spec, q2) => {
    const last = spec.split('/').pop()
    if (last && last.includes('.')) return m // already has an extension
    changed++
    return `${pre}${q1}${spec}.js${q2}`
  })
  if (out !== src) writeFileSync(f, out)
}
console.log(`Rewrote ${changed} import specifiers across ${files.length} files.`)
