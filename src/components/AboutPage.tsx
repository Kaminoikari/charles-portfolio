import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentMeta, useLocale, useLocalePath, useT } from '../i18n'
import { useAboutContent, useExperience } from '../data'
import ContactFooter from './ContactFooter'

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const localePath = useLocalePath()
  const { locale } = useLocale()
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
          className="inline-block font-mono text-xs tracking-[2px] text-text-tertiary no-underline transition-colors duration-200 hover:text-white"
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

        {/* Chinese bio — only shown on the en route, where it serves as a
            convenience for Chinese-speaking visitors who haven't switched
            locales. On /zh-TW/* it would just duplicate the page above
            in Chinese; on /ja/* it's not in the reader's language. */}
        {locale === 'en' && (
          <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '400ms' }}>
            <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {t('about.sectionChineseBio')} ]</h2>
            <div className="mt-5 space-y-4 text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]" lang="zh-TW">
              <p>我是陳德潁（Charles Chen），一位來自台灣並深信「實作即驗證」的 Software Product Manager。我擅長從 0 到 1 打造軟體產品，結合產品策略與 AI 開發工具，完成從概念到上線的端到端交付。</p>
              <p>過去 5 年，我專注於打造能改變使用者行為的產品，經歷橫跨創作者工具、Fintech、B2B SaaS 與 MaaS（移動服務）。我曾參與影響超過 700 萬人的產品規劃。目前在 USPACE 主導停車支付、企業差旅平台與金融保險三大核心產品線，業務涵蓋台灣與日本市場，並直接貢獻了公司 85% 以上的營收。</p>
              <p>我深信未來最強大的產品人會是 Product Builder。在我的工作流中，AI 不只是輔助工具，更是開發的核心引擎。這讓我能超越傳統 PM 僅止於收斂需求與撰寫 PRD 的框架，並親手利用 AI 工具快速產出原型、完成上線驗證。這種「Builder 模式」讓我能以比傳統流程快 5 倍的速度進行迭代，確保產品在投入大規模資源前，就已經獲得真實市場的認可。</p>
            </div>
          </div>
        )}

        {/* Projects link */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '480ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {t('about.sectionProjects')} ]</h2>
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
      <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ {title.toUpperCase()} ]</h2>
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
