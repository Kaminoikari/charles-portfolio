import { useEffect, useRef } from 'react'
import { blogArticles, platformLinks } from '../data/blog'

const CTA_FONT_FAMILY = 'var(--font-mono)'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }).toUpperCase()
}

const MediumLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="#FFFFFF" className="opacity-40">
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42S14.2 15.54 14.2 12s1.52-6.42 3.38-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
)

const SubstackLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="#FF6719" className="opacity-40">
    <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
  </svg>
)

function BlogEntry({ article, index }: { article: typeof blogArticles[0]; index: number }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={article.title}
      className={`blog-item group flex flex-col gap-6 border-t border-border py-10 no-underline opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 sm:flex-row sm:gap-10`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Left content */}
      <div className="flex flex-1 flex-col">
        {/* Date */}
        <time className="mb-4 font-mono text-[11px] tracking-[1.5px] text-text-tertiary">
          {formatDate(article.date)}
        </time>

        {/* Title */}
        <h3 className="text-xl font-semibold leading-tight text-white transition-colors duration-200 group-hover:text-white">
          {article.featured && (
            <span className="mr-2 inline-block rounded bg-accent-mars/15 px-2 py-0.5 align-middle font-mono text-[10px] uppercase tracking-[1px] text-accent-mars">
              Featured
            </span>
          )}
          {article.title}
        </h3>

        {/* Subtitle */}
        <p className="mt-2 text-[15px] leading-relaxed text-text-secondary transition-colors duration-200 group-hover:text-text-muted">
          {article.subtitle}
        </p>

        {/* Bottom: tag + CTA */}
        <div className="mt-6 flex items-center gap-4">
          <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-text-tertiary">
            {article.platform}
          </span>
          <div
            className="inline-flex min-h-[36px] items-center gap-2 rounded-full border border-btn-border px-4 py-1.5 text-white transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:bg-white/[0.06]"
            style={{
              fontFamily: CTA_FONT_FAMILY,
              fontSize: 11,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
            }}
          >
            <span>READ</span>
            <span className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ fontSize: 11, transform: 'scale(1.3)' }}>↗</span>
          </div>
        </div>
      </div>

      {/* Right: cover image or platform logo fallback */}
      <div className="flex h-[140px] w-full shrink-0 items-center justify-center overflow-hidden bg-bg-secondary sm:h-[180px] sm:w-[280px]">
        {article.cover ? (
          <img
            src={article.cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          article.platform === 'Medium' ? <MediumLogo /> : <SubstackLogo />
        )}
      </div>
    </a>
  )
}

export default function BlogEntries() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.blog-item')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1 },
    )
    items.forEach((item) => observer.observe(item))
    const safety = setTimeout(() => items.forEach((item) => item.classList.add('animate-in')), 2000)
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [])

  return (
    <section id="blog" ref={sectionRef} className="mx-auto max-w-[1400px] px-6 md:px-12 py-16 sm:py-32">
      {/* Header */}
      <div className="mb-10">
        <h2 className="mb-2 font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ BLOG ]</h2>
        <p className="text-[32px] font-semibold text-white">Latest writing</p>
      </div>

      {/* Articles: featured first, then chronological */}
      <div>
        {[
          ...blogArticles.filter((a) => a.featured),
          ...blogArticles.filter((a) => !a.featured).sort((a, b) => b.date.localeCompare(a.date)),
        ].map((article, i) => (
          <BlogEntry key={article.url} article={article} index={i} />
        ))}
      </div>

      {/* Platform links */}
      <div className="mt-12 flex flex-wrap gap-4 border-t border-border pt-10">
        <a
          href={platformLinks.substack}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 text-white no-underline transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-white/[0.06] hover:scale-105"
          style={{ fontFamily: CTA_FONT_FAMILY, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}
        >
          <span>More on Substack</span>
          <span style={{ fontSize: 12, transform: 'scale(1.3)' }}>↗</span>
        </a>
        <a
          href={platformLinks.medium}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 text-white no-underline transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:bg-white/[0.06] hover:scale-105"
          style={{ fontFamily: CTA_FONT_FAMILY, fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase' }}
        >
          <span>More on Medium</span>
          <span style={{ fontSize: 12, transform: 'scale(1.3)' }}>↗</span>
        </a>
      </div>
    </section>
  )
}
