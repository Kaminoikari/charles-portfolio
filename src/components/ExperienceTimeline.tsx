import { useEffect, useRef } from 'react'
import { experience } from '../data/experience'

export default function ExperienceTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll('.tl-item')

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

    // Touch devices have no hover — light up nodes based on scroll position instead.
    // Mid-viewport band (top/bottom 40% trimmed) acts as the "current" zone.
    const isTouch = window.matchMedia('(hover: none)').matches
    let activeObserver: IntersectionObserver | null = null
    if (isTouch) {
      activeObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            entry.target.classList.toggle('is-active', entry.isIntersecting)
          })
        },
        { rootMargin: '-40% 0px -40% 0px', threshold: 0 },
      )
      items.forEach((item) => activeObserver!.observe(item))
    }

    return () => {
      observer.disconnect()
      activeObserver?.disconnect()
      clearTimeout(safety)
    }
  }, [])

  return (
    <section id="experience" className="mx-auto max-w-[1400px] px-6 md:px-12 py-16 sm:py-32">
      <h2 className="mb-2 font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ EXPERIENCE ]</h2>
      <div ref={containerRef} className="border-l border-border pl-6 md:pl-10">
        {experience.map((item, i) => (
          <div
            key={i}
            className="tl-item group relative mb-12 opacity-0 -translate-x-8 [&.animate-in]:opacity-100 [&.animate-in]:translate-x-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 last:mb-0"
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {/* Square node marker */}
            <div className="absolute -left-[25px] md:-left-[45px] top-1.5 h-2 w-2 border-[1.5px] border-text-tertiary bg-bg-primary transition-all group-hover:border-accent-mars group-hover:shadow-[0_0_8px_rgba(232,101,43,0.35)] group-[.is-active]:border-accent-mars group-[.is-active]:shadow-[0_0_8px_rgba(232,101,43,0.35)]" />
            <div className="mb-1 text-[13px] uppercase tracking-[1.5px] text-text-tertiary">
              {item.dateRange}
            </div>
            <div className="text-2xl font-semibold text-white">
              {item.title}
            </div>
            <div className="mt-0.5 text-sm text-text-muted">
              {item.organization}
            </div>
            {item.bullets.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.bullets.map((bullet, j) => (
                  <li key={j} className="text-[15px] leading-relaxed text-text-muted before:mr-2 before:inline-block before:text-text-tertiary before:content-['—']">
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
