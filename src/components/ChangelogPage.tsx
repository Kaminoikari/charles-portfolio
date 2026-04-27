import { useEffect, useRef, useState } from 'react'
import { type ChangelogTag, useChangelog } from '../data'
import { useDocumentMeta, useT } from '../i18n'
import ContactFooter from './ContactFooter'

const ALL_TAGS: ChangelogTag[] = ['feature', 'design', 'technical']

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ChangelogPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeTag, setActiveTag] = useState<ChangelogTag | null>(null)
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
  }, [activeTag])

  const filtered = activeTag
    ? changelog.filter((e) => e.tags.includes(activeTag))
    : changelog

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="mx-auto max-w-[800px] px-6 pt-32 pb-10 md:pt-40 md:pb-14">
        <div className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">
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
            onClick={() => setActiveTag(null)}
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
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
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
      <div ref={containerRef} className="mx-auto max-w-[800px] px-6 pb-32">
        {filtered.map((entry, i) => (
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

            {/* Body paragraphs */}
            <div className="mt-5 space-y-4">
              {entry.body.map((paragraph, j) => (
                <p
                  key={j}
                  className="text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}

        {filtered.length === 0 && (
          <div className="py-24 text-center text-text-muted">
            {t('changelog.emptyMessage')}
          </div>
        )}
      </div>

      <ContactFooter />
    </div>
  )
}
