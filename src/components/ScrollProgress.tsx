import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export default function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)

  useEffect(() => {
    if (!barRef.current) return

    const tween = gsap.to(barRef.current, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: document.body,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.3,
      },
    })

    triggerRef.current = tween.scrollTrigger ?? null

    return () => {
      triggerRef.current?.kill()
    }
  }, [])

  return (
    <div className="fixed right-0 top-0 z-40 h-screen w-[2px] bg-transparent">
      <div
        ref={barRef}
        className="h-full w-full origin-top bg-accent-cyan will-change-transform"
        style={{ transform: 'scaleY(0)' }}
      />
    </div>
  )
}
