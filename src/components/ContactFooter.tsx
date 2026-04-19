import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { socialLinks } from '../data/social'

const SocialIcon = ({ platform }: { platform: string }) => {
  switch (platform) {
    case 'linkedin':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )
    case 'github':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      )
    case 'threads':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01c.028-3.577.877-6.43 2.523-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.751-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.186.408-2.228 1.33-2.932.88-.672 2.076-1.04 3.468-1.067 1.013-.02 1.96.088 2.84.323-.078-.89-.396-1.567-.955-2.015-.636-.51-1.545-.771-2.7-.776h-.06c-.94 0-2.07.284-2.82.868l-1.084-1.583C8.57 5.878 10.09 5.39 11.67 5.39h.082c1.66.012 2.965.465 3.88 1.346.828.798 1.347 1.91 1.553 3.317.752.258 1.44.612 2.055 1.065 1.063.782 1.834 1.86 2.229 3.115.606 1.928.336 4.55-1.672 6.518-1.906 1.87-4.24 2.706-7.545 2.73zM11.89 12.666c-.964.02-1.744.202-2.32.543-.56.33-.833.77-.808 1.306.025.534.303.98.783 1.255.534.306 1.249.47 2.065.428 1.078-.058 1.9-.45 2.444-1.167.39-.514.664-1.187.797-2.014-.96-.253-1.974-.374-2.96-.351z"/>
        </svg>
      )
    case 'portaly':
      return (
        <img src="/portaly-icon.png" alt="" width={20} height={20} style={{ width: 20, height: 20, objectFit: 'contain' }} />
      )
    default:
      return <span>{platform[0].toUpperCase()}</span>
  }
}

export default function ContactFooter() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const perfRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (perfRef.current) {
        const loadTime = Math.round(performance.now())
        perfRef.current.textContent = String(loadTime)
      }
    })
  }, [])

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
      <section className="mx-auto max-w-[1400px] px-6 md:px-12 pt-40 pb-20 text-center">
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
              className="reveal flex h-12 w-12 items-center justify-center border border-border-hover text-text-muted no-underline opacity-0 translate-y-4 transition-all duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-500 hover:scale-110 hover:border-accent-mars hover:text-accent-mars hover:shadow-[0_0_16px_rgba(232,101,43,0.3)]"
              style={{ transitionDelay: `${200 + i * 100}ms` }}
            >
              <SocialIcon platform={link.platform} />
            </a>
          ))}
        </div>
        <a href="mailto:charlestyc0527@gmail.com" className="reveal text-base tracking-[1px] text-text-muted no-underline transition-colors duration-200 hover:text-white opacity-0 [&.animate-in]:opacity-100 [&.animate-in]:transition-opacity [&.animate-in]:duration-600" style={{ transitionDelay: '700ms' }}>
          charlestyc0527@gmail.com
        </a>
      </section>
      <footer className="border-t border-border-hover py-12 text-center">
        <div className="text-xs tracking-[1px] text-text-secondary">
          © 2026 Charles Chen. All rights reserved.
        </div>
        <div className="mt-3 font-mono text-[10px] tracking-[1px] text-text-muted">
          <Link to="/changelog" className="text-text-muted no-underline transition-colors duration-200 hover:text-white">Changelog</Link>
          {' · '}Rendered in <span ref={perfRef}>,</span>ms · React · Canvas 2D · Tailwind
        </div>
      </footer>
    </div>
  )
}
