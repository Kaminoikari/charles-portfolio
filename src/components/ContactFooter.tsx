import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { socialLinks } from '../data/social'

export default function ContactFooter() {
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return
    const heading = sectionRef.current.querySelector('h2')
    const icons = sectionRef.current.querySelectorAll('.social-icon')
    const email = sectionRef.current.querySelector('.email-text')

    if (heading) {
      gsap.from(heading, {
        y: 30, opacity: 0, duration: 0.7, ease: 'power3.out',
        scrollTrigger: { trigger: heading, start: 'top 85%', toggleActions: 'play none none none' },
      })
    }
    icons.forEach((icon, i) => {
      gsap.from(icon, {
        y: 20, opacity: 0, duration: 0.5, delay: 0.2 + i * 0.1, ease: 'power3.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', toggleActions: 'play none none none' },
      })
    })
    if (email) {
      gsap.from(email, {
        opacity: 0, duration: 0.6, delay: 0.6, ease: 'power2.out',
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%', toggleActions: 'play none none none' },
      })
    }
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
        <h2 className="mb-8 text-[40px] font-semibold">Let's Connect</h2>
        <div className="mb-6 flex justify-center gap-8">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${link.platform}`}
              className="social-icon flex h-12 w-12 items-center justify-center border border-border-hover text-lg text-text-muted no-underline transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-110 hover:border-accent-mars hover:text-accent-mars hover:shadow-[0_0_16px_rgba(232,101,43,0.3)]"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="email-text text-base tracking-[1px] text-text-muted">hello@charles.dev</div>
      </section>
      <footer className="border-t border-border-hover py-12 text-center text-xs tracking-[1px] text-text-secondary">
        © 2026 CHARLES. BUILT WITH REACT + CANVAS
      </footer>
    </div>
  )
}
