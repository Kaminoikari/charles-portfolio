import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { blogPlatforms } from '../data/blog'

export default function BlogEntries() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const cards = sectionRef.current.querySelectorAll('.blog-card')
    cards.forEach((card, i) => {
      gsap.from(card, {
        y: 40,
        opacity: 0,
        duration: 0.7,
        delay: i * 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      })
    })
  }, [])

  return (
    <section id="blog" ref={sectionRef} className="mx-auto max-w-[1200px] px-12 py-30">
      <h2 className="mb-12 text-xs uppercase tracking-[3px] text-text-tertiary">
        WRITING
      </h2>
      <div className="mx-auto grid max-w-[800px] grid-cols-1 gap-8 sm:grid-cols-2">
        {blogPlatforms.map((platform) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read articles on ${platform.name}`}
            className="blog-card block border border-border bg-bg-primary p-12 text-center no-underline transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.04] hover:border-border-hover hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
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
