import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { experience } from '../data/experience'

export default function ExperienceTimeline() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const items = containerRef.current.querySelectorAll('.tl-item')
    items.forEach((item) => {
      gsap.from(item, {
        x: -60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: item,
          start: 'top 80%',
          toggleActions: 'play none none none',
        },
      })
    })
  }, [])

  return (
    <section id="experience" className="mx-auto max-w-[1200px] px-12 py-30">
      <div className="mb-12 text-xs uppercase tracking-[3px] text-text-tertiary">
        EXPERIENCE
      </div>
      <div ref={containerRef} className="border-l border-border pl-10">
        {experience.map((item, i) => (
          <div key={i} className="tl-item group relative mb-12 last:mb-0">
            {/* Square node marker */}
            <div className="absolute -left-[45px] top-1.5 h-2 w-2 border-[1.5px] border-text-tertiary bg-bg-primary transition-all group-hover:border-accent-cyan group-hover:shadow-[0_0_8px_rgba(0,217,255,0.3)]" />
            <div className="mb-1 text-[13px] uppercase tracking-[1.5px] text-text-tertiary">
              {item.dateRange}
            </div>
            <div className="text-xl font-semibold">
              {item.title}
              <span className="text-text-tertiary"> @ {item.organization}</span>
            </div>
            <div className="mt-1 text-[15px] text-[#999]">{item.description}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
