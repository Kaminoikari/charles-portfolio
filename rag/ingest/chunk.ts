// Recursive long-form text splitter for blog bodies. Dependency-free (keeps the
// "lean dependencies" principle) and CJK-aware: the source articles are
// Traditional Chinese, so sentence splitting honours 。！？ as well as . ! ?.
//
// Strategy mirrors LangChain's RecursiveCharacterTextSplitter: try the coarsest
// separator first (paragraph), recurse into finer separators only for pieces
// that are still too big, then greedily pack pieces up to `maxChars` and carry a
// trailing `overlap` window into the next chunk so context isn't severed at the
// seam. Sizing is by characters (not tokens) — good enough for chunk-boundary
// purposes and avoids pulling in a tokenizer.

const SEPARATORS = ['\n\n', '\n', '。', '！', '？', '. ', '! ', '? ', ' ', '']

// Split `text` into pieces no larger than maxChars using the first separator
// that makes progress, recursing for any piece that is still too long.
function splitRecursive(text: string, maxChars: number, seps: string[]): string[] {
  if (text.length <= maxChars) return text.trim() ? [text] : []

  const [sep, ...rest] = seps
  if (sep === undefined) {
    // No separators left: hard-cut (a single very long token with no spaces).
    const out: string[] = []
    for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars))
    return out
  }

  // Keep the separator attached to the piece it ends (so sentences stay whole).
  const parts = sep === '' ? text.split('') : splitKeepingSep(text, sep)
  const out: string[] = []
  for (const part of parts) {
    if (part.length <= maxChars) {
      if (part.trim()) out.push(part)
    } else {
      out.push(...splitRecursive(part, maxChars, rest))
    }
  }
  return out
}

function splitKeepingSep(text: string, sep: string): string[] {
  const pieces = text.split(sep)
  return pieces.map((p, i) => (i < pieces.length - 1 ? p + sep : p)).filter((p) => p.length > 0)
}

export interface ChunkOptions {
  maxChars: number
  overlap: number
}

// Public entry: produce overlapping chunks from a long body of text.
export function chunkText(text: string, opts: ChunkOptions): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= opts.maxChars) return [clean]

  const pieces = splitRecursive(clean, opts.maxChars, SEPARATORS)

  // Greedily pack pieces into chunks ≤ maxChars, carrying an overlap tail.
  const chunks: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (current && current.length + piece.length > opts.maxChars) {
      chunks.push(current.trim())
      current = opts.overlap > 0 ? tail(current, opts.overlap) : ''
    }
    current += piece
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// Last `n` characters of `s`, snapped to a word/sentence boundary where possible
// so the overlap window starts cleanly rather than mid-word.
function tail(s: string, n: number): string {
  if (s.length <= n) return s
  const slice = s.slice(s.length - n)
  const boundary = slice.search(/[\s。！？.!?]/)
  return boundary > 0 && boundary < n / 2 ? slice.slice(boundary + 1) : slice
}
