import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { type ChangelogBlock, type ChangelogTag, useChangelog } from '../data'
import { useDocumentMeta, useT } from '../i18n'
import ContactFooter from './ContactFooter'

const ALL_TAGS: ChangelogTag[] = ['feature', 'design', 'technical']
const ENTRIES_PER_PAGE = 10

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Splits a string on inline `code` (backticks) and **bold** spans, rendering
// each as the matching element and leaving the rest as plain text.
function renderInline(text: string): ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.length >= 2 && part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-accent-cyan/90"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.length >= 4 && part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function ChangelogBody({ blocks }: { blocks: ChangelogBlock[] }) {
  return (
    <div className="mt-5 space-y-5">
      {blocks.map((block, j) => {
        if (typeof block === 'string') {
          return (
            <p
              key={j}
              className="text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]"
            >
              {renderInline(block)}
            </p>
          )
        }
        if (block.kind === 'heading') {
          return (
            <h3
              key={j}
              className="flex items-center gap-2.5 pt-2 text-[15px] font-semibold text-white md:text-base"
            >
              <span aria-hidden="true" className="h-3.5 w-[3px] rounded-full bg-accent-mars" />
              {block.text}
            </h3>
          )
        }
        if (block.kind === 'list') {
          return (
            <ul key={j} className="space-y-2.5">
              {block.items.map((item, k) => (
                <li
                  key={k}
                  className="flex gap-3 text-[15px] leading-[1.75] text-text-muted md:text-base md:leading-[1.8]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-[0.7em] h-1 w-1 flex-shrink-0 rounded-full bg-accent-mars/60"
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          )
        }
        // stats grid
        return (
          <dl
            key={j}
            className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3"
          >
            {block.items.map((stat, k) => (
              <div key={k} className="bg-bg-secondary px-4 py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[1px] text-text-tertiary">
                  {stat.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold text-accent-mars">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )
      })}
    </div>
  )
}

export default function ChangelogPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const entriesTopRef = useRef<HTMLDivElement>(null)
  const [activeTag, setActiveTag] = useState<ChangelogTag | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const t = useT()
  const changelog = useChangelog()
  const TAG_LABELS: Record<ChangelogTag, string> = {
    feature: t('changelog.tagFeature'),
    design: t('changelog.tagDesign'),
    technical: t('changelog.tagTechnical'),
  }

  useDocumentMeta({ titleKey: 'changelog.metaTitle', path: '/changelog' })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const filtered = useMemo(
    () => (activeTag ? changelog.filter((e) => e.tags.includes(activeTag)) : changelog),
    [activeTag, changelog],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / ENTRIES_PER_PAGE))

  // Changing the filter resets pagination to page 1. Done in the event handler
  // (not an effect) per React guidance — the reset is a consequence of the
  // user's click, not an external sync.
  const selectTag = (tag: ChangelogTag | null) => {
    setActiveTag(tag)
    setCurrentPage(1)
  }

  const safePage = Math.min(Math.max(1, currentPage), totalPages)
  const startIndex = (safePage - 1) * ENTRIES_PER_PAGE
  const endIndex = Math.min(startIndex + ENTRIES_PER_PAGE, filtered.length)
  const paginated = filtered.slice(startIndex, endIndex)

  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll('.cl-entry')

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 },
    )
    items.forEach((item) => observer.observe(item))
    const safety = setTimeout(() => items.forEach((item) => item.classList.add('animate-in')), 2000)
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [activeTag, safePage])

  const goToPage = (page: number) => {
    const target = Math.min(Math.max(1, page), totalPages)
    if (target === safePage) return
    setCurrentPage(target)
    const top = entriesTopRef.current?.getBoundingClientRect().top ?? 0
    const next = top + window.scrollY - 120
    window.scrollTo({ top: Math.max(0, next), behavior: 'smooth' })
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
  const isFirst = safePage === 1
  const isLast = safePage === totalPages

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="mx-auto max-w-[800px] px-6 pt-32 pb-10 md:pt-40 md:pb-14">
        <div className="font-mono text-sm font-medium tracking-[2px] text-text-tertiary">
          {t('changelog.marker')}
        </div>
        <h1 className="mt-5 text-3xl font-semibold leading-tight text-white md:text-5xl">
          {t('changelog.heading')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-text-muted md:text-lg">
          {t('changelog.description')}
        </p>

        {/* Tag filters */}
        <nav className="mt-10 flex flex-wrap gap-2" aria-label={t('changelog.filterAriaLabel')}>
          <button
            onClick={() => selectTag(null)}
            className={`min-h-[36px] cursor-pointer rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[1px] transition-colors duration-200 ${
              activeTag === null
                ? 'border-accent-mars/40 bg-accent-mars/10 text-accent-mars'
                : 'border-border text-text-muted hover:text-white hover:border-border-hover'
            }`}
          >
            {t('changelog.filterAll')}
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => selectTag(activeTag === tag ? null : tag)}
              className={`min-h-[36px] cursor-pointer rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[1px] transition-colors duration-200 ${
                activeTag === tag
                  ? 'border-accent-mars/40 bg-accent-mars/10 text-accent-mars'
                  : 'border-border text-text-muted hover:text-white hover:border-border-hover'
              }`}
            >
              {TAG_LABELS[tag]}
            </button>
          ))}
        </nav>
      </header>

      {/* Entries */}
      <div ref={entriesTopRef} aria-hidden="true" />
      <div
        ref={containerRef}
        className={`mx-auto max-w-[800px] px-6 ${totalPages > 1 ? 'pb-16' : 'pb-32'}`}
      >
        {paginated.map((entry, i) => (
          <article
            key={entry.id}
            className={`cl-entry opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 ${
              i > 0 ? 'mt-20 border-t border-border pt-20' : ''
            }`}
            style={{ transitionDelay: `${Math.min(i * 80, 400)}ms` }}
          >
            {/* Date + Tags row */}
            <div className="flex flex-wrap items-center gap-3">
              <time className="text-[13px] tracking-[0.5px] text-text-tertiary">
                {formatDate(entry.date)}
              </time>
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent-mars/8 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-accent-mars/80"
                >
                  {TAG_LABELS[tag]}
                </span>
              ))}
            </div>

            {/* Title */}
            <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
              {entry.title}
            </h2>

            {/* Body blocks */}
            <ChangelogBody blocks={entry.body} />
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="py-24 text-center text-text-muted">
            {t('changelog.emptyMessage')}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mx-auto max-w-[800px] px-6 pb-32">
          <div className="border-t border-border pt-10">
            <nav
              aria-label={t('changelog.paginationAriaLabel')}
              className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
            >
              <button
                type="button"
                onClick={() => goToPage(safePage - 1)}
                disabled={isFirst}
                aria-label={t('changelog.previousPage')}
                className={`group inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[1px] transition-colors duration-200 ${
                  isFirst
                    ? 'cursor-not-allowed border-border/40 text-text-tertiary/50'
                    : 'cursor-pointer border-border text-text-muted hover:text-white hover:border-border-hover'
                }`}
              >
                <span aria-hidden="true">←</span>
                <span>{t('changelog.previousPage')}</span>
              </button>

              <ol className="flex items-center gap-1 sm:gap-1.5" role="list">
                {pageNumbers.map((p) => {
                  const isActive = p === safePage
                  return (
                    <li key={p}>
                      <button
                        type="button"
                        onClick={() => goToPage(p)}
                        aria-label={
                          isActive
                            ? t('changelog.currentPage', { page: pad2(p) })
                            : t('changelog.goToPage', { page: pad2(p) })
                        }
                        aria-current={isActive ? 'page' : undefined}
                        className={`inline-flex h-9 min-w-[36px] items-center justify-center rounded-full px-2 font-mono text-[12px] tracking-[1px] transition-colors duration-200 ${
                          isActive
                            ? 'cursor-default border border-accent-mars/40 bg-accent-mars/10 text-accent-mars'
                            : 'cursor-pointer border border-transparent text-text-tertiary hover:text-white hover:border-border-hover'
                        }`}
                      >
                        {pad2(p)}
                      </button>
                    </li>
                  )
                })}
              </ol>

              <button
                type="button"
                onClick={() => goToPage(safePage + 1)}
                disabled={isLast}
                aria-label={t('changelog.nextPage')}
                className={`group inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[1px] transition-colors duration-200 ${
                  isLast
                    ? 'cursor-not-allowed border-border/40 text-text-tertiary/50'
                    : 'cursor-pointer border-border text-text-muted hover:text-white hover:border-border-hover'
                }`}
              >
                <span>{t('changelog.nextPage')}</span>
                <span aria-hidden="true">→</span>
              </button>
            </nav>

            <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-[2px] text-text-tertiary">
              {t('changelog.showingRange', {
                start: pad2(startIndex + 1),
                end: pad2(endIndex),
                total: pad2(filtered.length),
              })}
            </p>
          </div>
        </div>
      )}

      <ContactFooter />
    </div>
  )
}
