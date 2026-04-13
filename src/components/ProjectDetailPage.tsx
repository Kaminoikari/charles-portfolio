import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { projectDetails, projects } from '../data/projects'
import ContactFooter from './ContactFooter'

const ADJACENT_LABELS = { prev: '← Previous', next: 'Next →' }

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)

  const detail = projectDetails.find((p) => p.id === id)
  const card = projects.find((p) => p.id === id)
  const currentIndex = projects.findIndex((p) => p.id === id)
  const prev = currentIndex > 0 ? projects[currentIndex - 1] : null
  const next = currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!detail) return
    document.title = detail.metaTitle
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', detail.metaDescription)
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.setAttribute('href', `https://charles-chen.com/projects/${detail.id}`)
    return () => {
      document.title = 'AI Product Manager in Taiwan | Charles Chen Portfolio'
      if (canonical) canonical.setAttribute('href', 'https://charles-chen.com/')
    }
  }, [detail])

  useEffect(() => {
    if (!containerRef.current) return
    const items = containerRef.current.querySelectorAll('.reveal')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.08 },
    )
    items.forEach((item) => observer.observe(item))
    const safety = setTimeout(() => items.forEach((item) => item.classList.add('animate-in')), 2000)
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [id])

  if (!detail || !card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-muted">
        <div className="text-center">
          <p className="text-lg">Project not found.</p>
          <Link to="/#projects" className="mt-4 inline-block text-accent-mars no-underline hover:underline">
            ← Back to portfolio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary" ref={containerRef}>
      {/* Header */}
      <header className="mx-auto max-w-[800px] px-6 pt-32 pb-10 md:pt-40 md:pb-14">
        <Link
          to="/#projects"
          className="inline-block font-mono text-xs tracking-[2px] text-text-tertiary no-underline transition-colors duration-200 hover:text-white"
        >
          ← BACK TO PORTFOLIO
        </Link>

        <h1 className="reveal mt-6 text-3xl font-semibold leading-tight text-white opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 md:text-5xl">
          {detail.title}
        </h1>

        <p className="reveal mt-4 text-base leading-relaxed text-text-muted opacity-0 translate-y-4 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-600 md:text-lg" style={{ transitionDelay: '100ms' }}>
          {detail.subtitle}
        </p>

        {/* Tags */}
        <div className="reveal mt-6 flex flex-wrap gap-2 opacity-0 [&.animate-in]:opacity-100 [&.animate-in]:transition-opacity [&.animate-in]:duration-500" style={{ transitionDelay: '200ms' }}>
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-accent-mars/8 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-accent-mars/80"
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-[800px] px-6 pb-20">
        {/* Problem */}
        <Section title="Problem" paragraphs={detail.problem} index={0} />

        {/* Solution */}
        <Section title="Solution" paragraphs={detail.solution} index={1} />

        {/* Tech Stack */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '160ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ TECH STACK ]</h2>
          <table className="mt-6 w-full text-[15px] leading-[1.8]">
            <tbody>
              {detail.techStack.map((row) => (
                <tr key={row.category} className="border-b border-border/50">
                  <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">{row.category}</td>
                  <td className="py-3 text-text-muted">{row.items}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Impact */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '240ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ IMPACT ]</h2>
          <ul className="mt-6 space-y-3">
            {detail.impact.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] leading-[1.8] text-text-muted md:text-base">
                <span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Learnings */}
        <Section title="Learnings" paragraphs={detail.learnings} index={3} />

        {/* Links */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '320ms' }}>
          <div className="flex flex-wrap gap-3">
            {detail.links.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105"
              >
                {link.label} <span aria-hidden="true">↗</span>
              </a>
            ))}
          </div>
        </div>

        {/* Prev / Next navigation */}
        <nav className="mt-20 flex items-center justify-between border-t border-border pt-8">
          {prev ? (
            <Link to={`/projects/${prev.id}`} className="group text-text-muted no-underline transition-colors duration-200 hover:text-white">
              <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-text-tertiary">{ADJACENT_LABELS.prev}</span>
              <span className="mt-1 block text-sm">{prev.title}</span>
            </Link>
          ) : <div />}
          {next ? (
            <Link to={`/projects/${next.id}`} className="group text-right text-text-muted no-underline transition-colors duration-200 hover:text-white">
              <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-text-tertiary">{ADJACENT_LABELS.next}</span>
              <span className="mt-1 block text-sm">{next.title}</span>
            </Link>
          ) : <div />}
        </nav>
      </div>

      <ContactFooter />
    </div>
  )
}

function Section({ title, paragraphs, index }: { title: string; paragraphs: string[]; index: number }) {
  return (
    <div
      className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {title.toUpperCase()} ]</h2>
      <div className="mt-5 space-y-4">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]">
            {p}
          </p>
        ))}
      </div>
    </div>
  )
}
