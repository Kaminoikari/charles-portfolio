import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!navRef.current) return

    gsap.set(navRef.current, { opacity: 0, pointerEvents: 'none' })

    ScrollTrigger.create({
      trigger: document.body,
      start: '100vh top',
      onEnter: () => {
        gsap.to(navRef.current, { opacity: 1, pointerEvents: 'auto', duration: 0.3 })
      },
      onLeaveBack: () => {
        gsap.to(navRef.current, { opacity: 0, pointerEvents: 'none', duration: 0.3 })
      },
    })
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl"
      style={{ background: 'rgba(10,10,10,0.9)' }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-12 md:py-4">
        <div className="text-lg font-bold tracking-widest md:text-xl">CHARLES</div>
        <div className="hidden gap-8 md:flex">
          {['about', 'skills', 'experience', 'projects', 'blog'].map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className="cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-[#999] transition-colors hover:text-white"
            >
              {id}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollTo('contact')}
          className="cursor-pointer rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] uppercase tracking-[1.5px] text-white transition-colors hover:bg-btn-hover-bg"
        >
          CONTACT ↗
        </button>
      </div>
    </nav>
  )
}
