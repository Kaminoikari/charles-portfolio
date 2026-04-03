import { useEffect, useRef } from 'react'
import { socialLinks } from '../data/social'

export default function ContactFooter() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const elements = sectionRef.current.querySelectorAll('.reveal')

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
    elements.forEach((el) => observer.observe(el))
    const safetyTimeout = setTimeout(() => {
      elements.forEach((el) => el.classList.add('animate-in'))
    }, 2000)
    return () => { observer.disconnect(); clearTimeout(safetyTimeout) }
  }, [])

  return (
    <div
      id="contact"
      ref={sectionRef}
      style={{
        background:
          'linear-gradient(180deg, var(--color-bg-primary) 0%, #1A0E08 30%, #2D1810 55%, #6B3021 80%, #C4501A 95%, var(--color-accent-mars) 100%)',
      }}
    >
      <section className="mx-auto max-w-[1200px] px-12 pt-40 pb-20 text-center">
        <h2 className="reveal mb-8 text-[40px] font-semibold opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700">
          Let's Connect
        </h2>
        <div className="mb-6 flex justify-center gap-8">
          {socialLinks.map((link, i) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${link.platform}`}
              className="reveal social-icon flex h-12 w-12 items-center justify-center border border-border-hover text-lg text-text-muted no-underline opacity-0 translate-y-4 transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-500 hover:scale-110 hover:border-accent-mars hover:text-accent-mars hover:shadow-[0_0_16px_rgba(232,101,43,0.3)]"
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="reveal text-base tracking-[1px] text-text-muted opacity-0 [&.animate-in]:opacity-100 [&.animate-in]:transition-opacity [&.animate-in]:duration-600" style={{ transitionDelay: '600ms' }}>
          hello@charles.dev
        </div>
      </section>
      <footer className="border-t border-border-hover py-12 text-center text-xs tracking-[1px] text-text-secondary">
        © 2026 CHARLES. BUILT WITH REACT + CANVAS
      </footer>
    </div>
  )
}
