import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useProjects, useProjectDetails } from '../data'
import { useDocumentMeta, useLocalePath, useT } from '../i18n'
import ContactFooter from './ContactFooter'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const localePath = useLocalePath()
  const projects = useProjects()
  const projectDetails = useProjectDetails()
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const lightboxOpenerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      lightboxOpenerRef.current?.focus()
      lightboxOpenerRef.current = null
    }
  }, [lightbox])

  const detail = projectDetails.find((p) => p.id === id)
  const card = projects.find((p) => p.id === id)
  const currentIndex = projects.findIndex((p) => p.id === id)
  const prev = currentIndex > 0 ? projects[currentIndex - 1] : null
  const next = currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null

  // Drive document title/description directly off the project detail data so
  // each project's metaTitle/metaDescription is honored. Hreflang/canonical
  // for this exact path are still managed by useDocumentMeta.
  useDocumentMeta({ path: id ? `/projects/${id}` : '/' })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  useEffect(() => {
    if (!detail) return
    document.title = detail.metaTitle
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', detail.metaDescription)
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
          <p className="text-lg">{t('projectDetail.notFound')}</p>
          <Link to={localePath('/#projects')} className="mt-4 inline-block text-accent-mars no-underline hover:underline">
            {t('projectDetail.backHome')}
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
          to={localePath('/#projects')}
          className="inline-block font-mono text-xs tracking-[2px] text-text-tertiary no-underline transition-colors duration-200 hover:text-white"
        >
          {t('projectDetail.back')}
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
        <Section title={t('projectDetail.sectionProblem')} paragraphs={detail.problem} index={0} />

        {/* Solution */}
        <Section title={t('projectDetail.sectionSolution')} paragraphs={detail.solution} index={1} />

        {/* Screenshots */}
        {detail.screenshots && detail.screenshots.length > 0 && (
          <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '120ms' }}>
            <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {t('projectDetail.sectionScreens').toUpperCase()} ]</h2>
            <div className="mt-6 space-y-6">
              {detail.screenshots.map((shot) => (
                <figure key={shot.src} className="overflow-hidden rounded-lg border border-border bg-bg-secondary">
                  <button
                    type="button"
                    onClick={(e) => {
                      lightboxOpenerRef.current = e.currentTarget
                      setLightbox({ src: shot.src, alt: shot.alt })
                    }}
                    aria-label={shot.alt}
                    className="block w-full cursor-zoom-in border-none bg-transparent p-0 transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-cyan)]"
                  >
                    <img
                      src={shot.src}
                      alt={shot.alt}
                      loading="lazy"
                      className="block h-auto w-full"
                    />
                  </button>
                </figure>
              ))}
            </div>
          </div>
        )}

        {/* Tech Stack */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '160ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {t('projectDetail.sectionTechStack')} ]</h2>
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
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {t('projectDetail.sectionImpact')} ]</h2>
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
        <Section title={t('projectDetail.sectionLearnings')} paragraphs={detail.learnings} index={3} />

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
            <Link to={localePath(`/projects/${prev.id}`)} className="group text-text-muted no-underline transition-colors duration-200 hover:text-white">
              <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-text-tertiary">{t('projectDetail.prevLabel')}</span>
              <span className="mt-1 block text-sm">{prev.title}</span>
            </Link>
          ) : <div />}
          {next ? (
            <Link to={localePath(`/projects/${next.id}`)} className="group text-right text-text-muted no-underline transition-colors duration-200 hover:text-white">
              <span className="block font-mono text-[10px] uppercase tracking-[1.5px] text-text-tertiary">{t('projectDetail.nextLabel')}</span>
              <span className="mt-1 block text-sm">{next.title}</span>
            </Link>
          ) : <div />}
        </nav>
      </div>

      <ContactFooter />

      {lightbox && (
        <Lightbox
          src={lightbox.src}
          alt={lightbox.alt}
          closeLabel={t('projectDetail.closeLightbox')}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

function Lightbox({ src, alt, closeLabel, onClose }: { src: string; alt: string; closeLabel: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 px-4 py-12 backdrop-blur-sm"
    >
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[95vw] cursor-default rounded-lg border border-white/10 object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="fixed right-5 top-5 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/90 backdrop-blur-md transition-all duration-200 hover:border-[var(--color-accent-cyan)] hover:text-[var(--color-accent-cyan)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent-cyan)]"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M6 18L18 6" />
        </svg>
      </button>
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
