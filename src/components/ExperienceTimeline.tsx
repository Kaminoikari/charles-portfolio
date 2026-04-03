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
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [])

  return (
    <section id="experience" className="mx-auto max-w-[1200px] px-12 py-30">
      <h2 className="mb-12 text-xs uppercase tracking-[3px] text-text-tertiary">
        EXPERIENCE
      </h2>
      <div ref={containerRef} className="border-l border-border pl-10">
        {experience.map((item, i) => (
          <div
            key={i}
            className="tl-item group relative mb-12 opacity-0 -translate-x-8 [&.animate-in]:opacity-100 [&.animate-in]:translate-x-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 last:mb-0"
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            {/* Square node marker */}
            <div className="absolute -left-[45px] top-1.5 h-2 w-2 border-[1.5px] border-text-tertiary bg-bg-primary transition-all group-hover:border-accent-cyan group-hover:shadow-[0_0_8px_rgba(0,217,255,0.3)]" />
            <div className="mb-1 text-[13px] uppercase tracking-[1.5px] text-text-tertiary">
              {item.dateRange}
            </div>
            <div className="text-xl font-semibold">
              {item.title}
              <span className="text-text-tertiary"> @ {item.organization}</span>
            </div>
            {item.description && (
              <div className="mt-1 text-[15px] text-text-muted">{item.description}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
