import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentMeta, useLocalePath, useT } from '../i18n'
import { useAboutContent, useExperience } from '../data'
import ContactFooter from './ContactFooter'

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const localePath = useLocalePath()
  const aboutContent = useAboutContent()
  const experience = useExperience()

  useDocumentMeta({
    titleKey: 'about.metaTitle',
    descriptionKey: 'about.metaDescription',
    path: '/about',
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

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
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary" ref={containerRef}>
      <header className="mx-auto max-w-[800px] px-6 pt-32 pb-10 md:pt-40 md:pb-14">
        <Link
          to={localePath('/#about')}
          className="inline-block font-mono text-sm font-medium tracking-[2px] text-text-tertiary no-underline transition-colors duration-200 hover:text-white"
        >
          {t('about.back')}
        </Link>

        <h1 className="reveal mt-6 text-3xl font-semibold leading-tight text-white opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 md:text-5xl">
          {t('about.heading')}
        </h1>

        <p className="reveal mt-4 text-base leading-relaxed text-text-muted opacity-0 translate-y-4 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-600 md:text-lg" style={{ transitionDelay: '100ms' }}>
          {t('about.subheading')}
        </p>
      </header>

      <div className="mx-auto max-w-[800px] px-6 pb-20">
        {/* Photo */}
        <div className="reveal mb-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700">
          <div className="relative mx-auto max-w-[400px]">
            <img
              src="/assets/charles-about.jpg"
              alt={t('about.photoAlt')}
              className="w-full object-cover object-center"
              style={{
                maskImage: 'radial-gradient(ellipse 75% 85% at 50% 60%, black 40%, transparent 90%)',
                WebkitMaskImage: 'radial-gradient(ellipse 75% 85% at 50% 60%, black 40%, transparent 90%)',
              }}
            />
          </div>
        </div>

        {/* Who I Am */}
        <Section title={t('about.sectionWhoIAm')} index={0}>
          {aboutContent.whoIAm.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </Section>

        {/* Product Philosophy */}
        <Section title={t('about.sectionPhilosophy')} index={1}>
          <p>{t('about.philosophyIntro')}</p>
          <ul className="mt-4 space-y-5">
            {aboutContent.philosophyBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" />
                <div>
                  <strong className="block text-white">{bullet.title}</strong>
                  <span className="mt-1 block">{bullet.body}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* How I Use AI */}
        <Section title={t('about.sectionAi')} index={2}>
          <p>{t('about.aiIntro')}</p>
          <table className="mt-6 w-full text-[15px] leading-[1.8]">
            <tbody>
              {aboutContent.aiTable.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">{row.label}</td>
                  <td className="py-3 text-text-muted">{row.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Career — locale-aware data from useExperience() */}
        <Section title={t('about.sectionCareer')} index={3}>
          <div className="space-y-8">
            {experience.map((item, i) => (
              <CareerItem
                key={i}
                title={item.title}
                org={item.organization}
                period={item.dateRange}
                bullets={item.bullets}
              />
            ))}
          </div>
        </Section>

        {/* Skills */}
        <Section title={t('about.sectionSkills')} index={4}>
          <table className="mt-6 w-full text-[15px] leading-[1.8]">
            <tbody>
              {aboutContent.skillsTable.map((row, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">{row.label}</td>
                  <td className="py-3 text-text-muted">{row.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Projects link */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '480ms' }}>
          <h2 className="font-mono text-sm font-medium tracking-[2px] text-text-tertiary">[ {t('about.sectionProjects')} ]</h2>
          <p className="mt-5 text-[15px] leading-[1.8] text-text-muted md:text-base">{t('about.projectsCtaText')}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={localePath('/projects/path')} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
              Path <span aria-hidden="true">↗</span>
            </Link>
            <Link to={localePath('/projects/plutus-trade')} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
              Plutus Trade <span aria-hidden="true">↗</span>
            </Link>
            <Link to={localePath('/projects/product-playbook')} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
              Product Playbook <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>

      <ContactFooter />
    </div>
  )
}

function Section({ title, index, children }: { title: string; index: number; children: React.ReactNode }) {
  return (
    <div
      className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <h2 className="font-mono text-sm font-medium tracking-[2px] text-text-tertiary">[ {title.toUpperCase()} ]</h2>
      <div className="mt-5 space-y-4 text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]">
        {children}
      </div>
    </div>
  )
}

function CareerItem({ title, org, period, bullets }: { title: string; org: string; period: string; bullets: string[] }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-text-muted">{org}</span>
        <span className="text-text-tertiary">·</span>
        <span className="font-mono tracking-[0.5px] text-text-tertiary">{period}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-3 text-[15px] leading-[1.8] text-text-muted">
            <span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  )
}
