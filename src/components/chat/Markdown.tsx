// Minimal markdown renderer for streamed answers — no dependency, by design
// (the design system values lean dependencies). It covers exactly the subset
// the answer model emits: paragraphs, `#`..`######` headings (shown as a compact
// bold line, not oversized <h2>), `*`/`-`/`1.` lists, `**bold**`, inline
// `code`, and [n] citation markers (rendered in the accent colour). Anything
// else falls through as plain text. Safe: we never use dangerouslySetInnerHTML —
// every node is a real React element built from parsed tokens.

import { Fragment, type ReactNode } from 'react'

// "Pangu spacing": insert a thin gap between CJK and adjacent half-width
// alphanumerics so mixed zh/ja + Latin/number text reads cleanly
// (e.g. "USPACE為Business" → "USPACE 為 Business"). Applied only to plain-text
// fragments, never inside bold/code/citation tokens. Idempotent: skips where a
// space (or the boundary itself) already exists.
const CJK = '\\u2e80-\\u2eff\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef'
const ALNUM = 'A-Za-z0-9'
const PANGU_AFTER = new RegExp(`([${CJK}])([${ALNUM}@#$%^&*\\-+\\\\=|/])`, 'g')
const PANGU_BEFORE = new RegExp(`([${ALNUM}!~)\\]}>;:,.?%])([${CJK}])`, 'g')

function pangu(text: string): string {
  return text.replace(PANGU_AFTER, '$1 $2').replace(PANGU_BEFORE, '$1 $2')
}

// Inline pass: [text](url) links, **bold**, `code`, [n] citation markers, and
// bare urls/emails. Plain-text runs between tokens get pangu spacing; token
// contents are left untouched.
const LINK_CLASS =
  'text-accent-cyan underline decoration-accent-cyan/40 underline-offset-2 transition-colors hover:decoration-accent-cyan'

// The answer text is model-generated and therefore attacker-influenceable via
// prompt injection. React does NOT sanitize an <a href>, so a `[x](javascript:…)`
// or `data:` link would execute / smuggle a payload inside a trusted bubble.
// Allow only http(s)/mailto and relative (/, #, ?) targets; drop everything else
// back to plain text.
function safeHref(href: string): string | null {
  const h = href.trim()
  if (/^(https?:|mailto:)/i.test(h)) return h
  if (/^[/#?]/.test(h)) return h
  return null
}

function anchor(href: string, label: ReactNode, key: number): ReactNode {
  const safe = safeHref(href)
  if (!safe) return <Fragment key={key}>{label}</Fragment>
  return (
    <a key={key} href={safe} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {label}
    </a>
  )
}

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  // Order matters: markdown links before bare-url so [t](u) isn't half-eaten.
  const re =
    /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`|\[\d+(?:,\s*\d+)*\]|https?:\/\/[^\s)]+|mailto:[^\s)]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  const plain = (s: string) => {
    if (s) out.push(<Fragment key={key++}>{pangu(s)}</Fragment>)
  }
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) plain(text.slice(last, m.index))
    const tok = m[0]
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)
    if (link) {
      out.push(anchor(link[2], link[1], key++))
    } else if (tok.startsWith('**')) {
      out.push(
        <strong key={key++} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else if (tok.startsWith('`')) {
      out.push(
        <code
          key={key++}
          className="rounded bg-bg-tertiary px-1 py-0.5 font-mono text-[12px] text-accent-cyan"
        >
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (/^\[\d/.test(tok)) {
      // Citation marker like [1] or [1, 2].
      out.push(
        <sup key={key++} className="ml-0.5 font-mono text-[10px] text-accent-cyan">
          {tok}
        </sup>,
      )
    } else if (tok.startsWith('http') || tok.startsWith('mailto:')) {
      out.push(anchor(tok, tok.replace(/^mailto:/, ''), key++))
    } else {
      // Bare email address.
      out.push(anchor(`mailto:${tok}`, tok, key++))
    }
    last = m.index + tok.length
  }
  if (last < text.length) plain(text.slice(last))
  return out
}

interface ListItem {
  marker: ReactNode // bullet dot or "1." style ordinal
  content: string
}

export function Markdown({ text }: { text: string }) {
  // Block pass: group consecutive list lines (bullets OR "1." ordinals) into a
  // single list; everything else becomes a <p>. List items keep a hanging
  // indent (marker column + flex-1 text), so wrapped lines align under the text,
  // not under the marker.
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: ListItem[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    const items = list
    blocks.push(
      <ul key={key++} className="my-1.5 flex list-none flex-col gap-1.5 pl-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            {item.marker}
            <span className="flex-1">{renderInline(item.content)}</span>
          </li>
        ))}
      </ul>,
    )
    list = []
  }

  const bulletDot = (
    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-mars" />
  )
  const ordinal = (n: string) => (
    <span className="min-w-[1.1em] shrink-0 text-right font-mono text-[12px] text-accent-mars">
      {n}.
    </span>
  )

  for (const raw of lines) {
    const line = raw.trimEnd()
    // ATX heading (`#`..`######`): strip the markers and render a compact bold
    // line. A chat bubble is too small for real <h2> typography, and showing the
    // raw `##` reads as clutter.
    const heading = /^\s*#{1,6}\s+(.*\S)\s*#*$/.exec(line)
    if (heading) {
      flushList()
      blocks.push(
        <p key={key++} className="mb-1 mt-3 font-semibold text-white first:mt-0">
          {renderInline(heading[1])}
        </p>,
      )
      continue
    }
    const bullet = /^\s*[*-]\s+(.*)$/.exec(line)
    const numbered = /^\s*(\d+)\.\s+(.*)$/.exec(line)
    if (bullet) {
      list.push({ marker: bulletDot, content: bullet[1] })
      continue
    }
    if (numbered) {
      list.push({ marker: ordinal(numbered[1]), content: numbered[2] })
      continue
    }
    flushList()
    if (line.trim() === '') continue
    blocks.push(
      <p key={key++} className="my-1.5 first:mt-0 last:mb-0">
        {renderInline(line)}
      </p>,
    )
  }
  flushList()

  return <>{blocks}</>
}
