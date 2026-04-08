import { useEffect, useRef } from 'react'
import { blogPlatforms } from '../data/blog'

const CTA_FONT_FAMILY = 'var(--font-mono)'

const MediumLogo = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" className="text-text-muted opacity-40 transition-all duration-300 group-hover:opacity-70 group-hover:scale-105">
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42S14.2 15.54 14.2 12s1.52-6.42 3.38-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
)

const SubstackLogo = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" className="text-text-muted opacity-40 transition-all duration-300 group-hover:opacity-70 group-hover:scale-105">
    <path d="M22.539 8.242H1.46V5.406L8.857 2.58l6.217 2.29 5.89-2.29v5.662zM1.46 9.856h21.079V21.42H1.46V9.856zM8.857 4.29 3.286 6.383v.271h11.142V6.383L8.857 4.29z"/>
  </svg>
)

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
      {/* Header row — xAI style */}
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <h2 className="mb-2 font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ BLOG ]</h2>
          <p className="text-[32px] font-semibold text-white">Latest writing</p>
        </div>
      </div>

      {/* Article list */}
      <div className="border-t border-border">
        {blogPlatforms.map((platform, i) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read articles on ${platform.name}`}
            className={`blog-item group flex flex-col gap-6 border-b border-border py-10 no-underline transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.01] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)] opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 sm:flex-row sm:items-center sm:gap-12`}
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            {/* Left: text content */}
            <div className="flex-1">
              <div className="mb-3 font-mono text-[11px] uppercase tracking-[2px] text-accent-mars">
                {platform.name}
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white transition-colors duration-200 group-hover:text-white">
                {platform.name === 'Medium'
                  ? 'Technical articles & product insights'
                  : 'Deep dives & long-form thinking'}
              </h3>
              <p className="text-text-secondary transition-colors duration-200 group-hover:text-text-muted" style={{ fontSize: 15, lineHeight: 1.6 }}>
                {platform.subtitle}
              </p>

              {/* CTA */}
              <div
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 text-white transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:bg-white/[0.06]"
                style={{
                  fontFamily: CTA_FONT_FAMILY,
                  fontSize: 12,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                }}
              >
                <span>READ</span>
                <span className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ fontSize: 12, transform: 'scale(1.3)' }}>↗</span>
              </div>
            </div>

            {/* Right: platform logo on dark bg */}
            <div className="flex h-[160px] w-full shrink-0 items-center justify-center overflow-hidden rounded-sm bg-bg-secondary sm:h-[200px] sm:w-[320px]">
              {platform.name === 'Medium' ? <MediumLogo /> : <SubstackLogo />}
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
