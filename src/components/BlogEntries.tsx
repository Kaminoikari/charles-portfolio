import { useEffect, useRef } from 'react'
import { blogPlatforms } from '../data/blog'

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
    // Safety: if animations haven't triggered after 2s, force show
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
      <div className="mx-auto grid max-w-[800px] grid-cols-1 gap-8 sm:grid-cols-2">
        {blogPlatforms.map((platform, i) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read articles on ${platform.name}`}
            className="blog-card block border border-border bg-bg-primary p-12 text-center no-underline opacity-0 translate-y-6 transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.04] hover:border-border-hover hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            <div className="mb-4 font-mono text-3xl text-text-muted">
              {platform.name === 'Medium' ? 'M' : 'S'}
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-white">
              {platform.name}
            </h3>
            <p className="text-sm text-text-tertiary">{platform.subtitle}</p>
          </a>
        ))}
      </div>
    </section>
  )
}
