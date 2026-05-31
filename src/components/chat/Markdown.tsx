// Minimal markdown renderer for streamed answers — no dependency, by design
// (the design system values lean dependencies). It covers exactly the subset
// the answer model emits: paragraphs, `*`/`-` bullet lists, `**bold**`, inline
// `code`, and [n] citation markers (rendered in the accent colour). Anything
// else falls through as plain text. Safe: we never use dangerouslySetInnerHTML —
// every node is a real React element built from parsed tokens.

import { Fragment, type ReactNode } from 'react'

// Inline pass: **bold**, `code`, and [n] / [1, 2] citation markers.
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  // Split on the three inline constructs, keeping the delimiters.
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+(?:,\s*\d+)*\])/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>)
    const tok = m[0]
    if (tok.startsWith('**')) {
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
    } else {
      // Citation marker like [1] or [1, 2].
      out.push(
        <sup key={key++} className="ml-0.5 font-mono text-[10px] text-accent-cyan">
          {tok}
        </sup>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>)
  return out
}

export function Markdown({ text }: { text: string }) {
  // Block pass: group consecutive bullet lines into <ul>, everything else into
  // <p>. A "bullet" is a line starting with * or - followed by a space.
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let key = 0

  const flushList = () => {
    if (list.length === 0) return
    blocks.push(
      <ul key={key++} className="my-1.5 flex list-none flex-col gap-1.5 pl-1">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent-mars" />
            <span className="flex-1">{renderInline(item)}</span>
          </li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const bullet = /^\s*[*-]\s+(.*)$/.exec(line)
    if (bullet) {
      list.push(bullet[1])
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
