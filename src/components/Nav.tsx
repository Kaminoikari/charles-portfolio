import { useEffect, useRef, useState } from 'react'

export default function Nav() {
  const navRef = useRef<HTMLElement>(null)
  const [scrolledPastHero, setScrolledPastHero] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      ref={navRef}
      aria-label="Main navigation"
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl transition-all duration-500"
      style={{
        borderColor: scrolledPastHero ? '#1f2228' : 'transparent',
        background: scrolledPastHero
          ? 'rgba(10,10,10,0.92)'
          : 'transparent',
      }}
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3 md:px-12 md:py-4">
        <div className="text-lg font-bold tracking-widest md:text-xl">CHARLES</div>
        <div className="hidden gap-8 md:flex">
          {['about', 'skills', 'experience', 'projects', 'blog'].map((id) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              aria-label={`Scroll to ${id} section`}
              className="cursor-pointer border-none bg-transparent text-[13px] uppercase tracking-[1.5px] text-text-muted transition-colors hover:text-white"
            >
              {id}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollTo('contact')}
          aria-label="Scroll to contact section"
          className="cursor-pointer rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-[13px] uppercase tracking-[1.5px] text-white transition-colors hover:bg-btn-hover-bg"
        >
          CONTACT ↗
        </button>
      </div>
    </nav>
  )
}
