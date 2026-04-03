import { useEffect, useRef } from 'react'
import { blogPlatforms } from '../data/blog'

const CTA_FONT_FAMILY =
  "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

function CornerSquare({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positionStyles: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1 },
    tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 },
    br: { bottom: -1, right: -1 },
  }

  return (
    <div
      className="absolute h-[8px] w-[8px] border border-border-highlight bg-surface-light"
      style={positionStyles[position]}
    />
  )
}

export default function BlogEntries() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const cards = sectionRef.current.querySelectorAll('.blog-card')

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
    cards.forEach((card) => observer.observe(card))
    const safetyTimeout = setTimeout(() => {
      cards.forEach((card) => card.classList.add('animate-in'))
    }, 2000)
    return () => { observer.disconnect(); clearTimeout(safetyTimeout) }
  }, [])

  return (
    <section id="blog" ref={sectionRef} className="mx-auto max-w-[1200px] px-12 py-30">
      <h2 className="mb-12 text-xs uppercase tracking-[3px] text-text-tertiary">
        WRITING
      </h2>
      <div className="mx-auto flex max-w-[900px] flex-col gap-0 sm:flex-row" style={{ borderTop: '1px solid var(--color-border)' }}>
        {blogPlatforms.map((platform, i) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read articles on ${platform.name}`}
            className={`blog-card group relative flex flex-1 flex-col no-underline opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 ${i > 0 ? 'border-t border-border sm:border-t-0 sm:border-l' : ''}`}
            style={{ padding: '32px 32px 40px', transitionDelay: `${i * 150}ms` }}
          >
            {/* Hover gradient overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
              style={{
                background: 'linear-gradient(to bottom, rgba(125,129,135,0.1), transparent)',
              }}
            />

            {/* Hover border glow + corner squares */}
            <div className="pointer-events-none absolute inset-0 border border-border-subtle opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100">
              <CornerSquare position="tl" />
              <CornerSquare position="tr" />
              <CornerSquare position="bl" />
              <CornerSquare position="br" />
            </div>

            {/* Platform icon */}
            <div className="mb-6 text-text-muted transition-colors duration-300 group-hover:text-white">
              {platform.name === 'Medium' ? (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42S14.2 15.54 14.2 12s1.52-6.42 3.38-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
                </svg>
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.539 8.242H1.46V5.406L8.857 2.58l6.217 2.29 5.89-2.29v5.662zM1.46 9.856h21.079V21.42H1.46V9.856zM8.857 4.29 3.286 6.383v.271h11.142V6.383L8.857 4.29z"/>
                </svg>
              )}
            </div>

            {/* Platform name */}
            <h3 className="text-white" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              {platform.name}
            </h3>

            {/* Description */}
            <p className="text-text-secondary transition-colors duration-300 group-hover:text-white/85" style={{ fontSize: 16, lineHeight: 1.5, marginTop: 12 }}>
              {platform.subtitle}
            </p>

            {/* Spacer */}
            <div className="flex-grow" style={{ minHeight: 40 }} />

            {/* CTA button — centered like xAI */}
            <div className="flex justify-center">
              <div
                className="inline-flex items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 transition-colors duration-300 group-hover:bg-white/[0.08]"
                style={{
                  fontFamily: CTA_FONT_FAMILY,
                  fontSize: 13,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'white',
                }}
              >
                <span>READ MORE</span>
                <span className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ fontSize: 13, lineHeight: 1, transform: 'scale(1.4)' }}>↗</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
