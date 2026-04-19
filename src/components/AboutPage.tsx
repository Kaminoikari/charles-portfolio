import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import ContactFooter from './ContactFooter'

export default function AboutPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = 'About Charles Chen — AI Product Manager in Taiwan'
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) metaDesc.setAttribute('content', 'About Charles Chen (陳德潁) — AI Product Manager and AI Product Builder from Taiwan. Product philosophy, AI tooling approach, full career history, and skill set.')
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) canonical.setAttribute('href', 'https://charles-chen.com/about')
    return () => {
      document.title = 'AI Product Manager in Taiwan | Charles Chen Portfolio'
      if (canonical) canonical.setAttribute('href', 'https://charles-chen.com/')
    }
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
          to="/#about"
          className="inline-block font-mono text-xs tracking-[2px] text-text-tertiary no-underline transition-colors duration-200 hover:text-white"
        >
          ← BACK TO PORTFOLIO
        </Link>

        <h1 className="reveal mt-6 text-3xl font-semibold leading-tight text-white opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 md:text-5xl">
          About Charles Chen
        </h1>

        <p className="reveal mt-4 text-base leading-relaxed text-text-muted opacity-0 translate-y-4 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-600 md:text-lg" style={{ transitionDelay: '100ms' }}>
          AI Product Manager and AI Product Builder from Taiwan.
        </p>
      </header>

      <div className="mx-auto max-w-[800px] px-6 pb-20">
        {/* Photo */}
        <div className="reveal mb-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700">
          <div className="relative mx-auto max-w-[400px]">
            <img
              src="/assets/charles-about.jpg"
              alt="Charles Chen — AI Product Manager"
              className="w-full object-cover object-center"
              style={{
                maskImage: 'radial-gradient(ellipse 75% 85% at 50% 60%, black 40%, transparent 90%)',
                WebkitMaskImage: 'radial-gradient(ellipse 75% 85% at 50% 60%, black 40%, transparent 90%)',
              }}
            />
          </div>
        </div>

        {/* Who I Am */}
        <Section title="Who I Am" index={0}>
          <p>I'm Charles Chen (陳德潁), an AI Product Manager based in Taiwan. I specialize in building software products from 0 to 1, combining product strategy with AI development tools to deliver end-to-end from concept to launch.</p>
          <p>Over the past 5 years, my product experience has spanned creator tools, fintech, SaaS, and MaaS, impacting over 6 million users in total. I currently lead product strategy at USPACE across three product lines (parking payments, business travel, and financial insurance) covering both Taiwan and Japan, driving more than 85% of company revenue.</p>
          <p>I believe the best product managers of the future will be Product Builders. Not just planning products, but personally using AI tools to rapidly build prototypes and validate them in production. This approach lets me iterate 5x faster than traditional PM workflows.</p>
        </Section>

        {/* Product Philosophy */}
        <Section title="Product Philosophy" index={1}>
          <p>I believe the best product managers are builders. The gap between "what should we build" and "here's a working prototype" is where most product ideas die. By closing that gap with AI-powered development, I can test assumptions in hours instead of weeks.</p>
          <ul className="mt-4 space-y-3">
            <li className="flex items-start gap-3"><span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" /><span><strong className="text-white">Outcomes over outputs.</strong> Shipping features isn't the goal — changing user behavior and moving business metrics is. I measure success by what users do differently, not by how many tickets get closed.</span></li>
            <li className="flex items-start gap-3"><span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" /><span><strong className="text-white">Strong opinions, loosely held.</strong> Product sense means having a clear point of view on what to build and why. But conviction without flexibility is stubbornness — I form strong hypotheses, then let data and user feedback prove me wrong.</span></li>
            <li className="flex items-start gap-3"><span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" /><span><strong className="text-white">Strong product sense.</strong> The best decisions happen before the data exists. Knowing which problems are worth solving, which solutions will resonate, and when to cut scope — that intuition comes from shipping products and watching how real users respond.</span></li>
            <li className="flex items-start gap-3"><span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" /><span><strong className="text-white">Build to learn.</strong> Prototypes beat slide decks. I use Claude Code and Codex to build working products that generate real user feedback — not hypothetical stakeholder opinions.</span></li>
          </ul>
        </Section>

        {/* How I Use AI */}
        <Section title="How I Use AI in Product Development" index={2}>
          <p>AI isn't a feature I add to products — it's how I build them. My AI-powered workflow spans the entire product lifecycle:</p>
          <table className="mt-6 w-full text-[15px] leading-[1.8]">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Discovery</td>
                <td className="py-3 text-text-muted">LLM-powered market research, competitive analysis, and user interview synthesis</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Spec Writing</td>
                <td className="py-3 text-text-muted">Product Playbook — my own AI agent that generates specs from 22 product frameworks</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Prototyping</td>
                <td className="py-3 text-text-muted">Claude Code and Codex for rapid full-stack prototyping and development (React, Flutter, Node.js, Python with FastAPI, PHP with Laravel)</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">AI Features</td>
                <td className="py-3 text-text-muted">Gemini AI integration in Plutus Trade for stock diagnostics and prediction tracking</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Agentic Workflows</td>
                <td className="py-3 text-text-muted">Building AI agents that orchestrate multi-step tasks — from spec generation to dev handoff</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Career */}
        <Section title="Career" index={3}>
          <div className="space-y-8">
            <CareerItem
              title="Product Manager"
              org="USPACE Tech Co., Ltd."
              period="July 2024 — Present"
              bullets={[
                '85%+ revenue impact — own product strategy across parking payments, business travel, and financial insurance lines (Taiwan + Japan)',
                '0→1 launched USPACE for Business, a B2B SaaS for corporate travel management',
                '5x faster iteration — pioneered AI-driven prototyping with Claude Code, Codex, and Antigravity',
              ]}
            />
            <CareerItem
              title="Product Mentor"
              org="XChange School"
              period="January 2025 — Present"
              bullets={[
                'Mentoring aspiring product managers at Taiwan\'s largest internet professional community',
              ]}
            />
            <CareerItem
              title="Senior Product Manager"
              org="NUEIP Technology Co., Ltd."
              period="February 2024 — May 2024"
              bullets={[
                '+40% data-driven decisions — built end-to-end BI product with AI-powered analytics',
                '+35% forecast accuracy — implemented predictive analytics models for strategic planning',
                '50% faster reporting — integrated BI dashboards cutting data retrieval time',
              ]}
            />
            <CareerItem
              title="Product Manager"
              org="PXPay Plus Co., Ltd."
              period="August 2022 — February 2024"
              bullets={[
                '+25% transaction conversions — redesigned sign-up and checkout flow in 3 months',
                '+50% operational efficiency — pioneered reward points system, -40% customer complaints',
                'Led third-party billing integration for parking, cable TV, pension, and government payments',
              ]}
            />
            <CareerItem
              title="Operations Manager"
              org="FLUX Technology Inc."
              period="September 2019 — March 2022"
              bullets={[
                '+20% market share — developed product strategy through competitive analysis',
                '+30% user retention — redesigned website and SEO for 3-product ecosystem',
                'Directed team of 10 — +22% process efficiency, +35% order fulfillment speed',
              ]}
            />
          </div>
        </Section>

        {/* Skills */}
        <Section title="Skill Set" index={4}>
          <table className="mt-6 w-full text-[15px] leading-[1.8]">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Product Strategy</td>
                <td className="py-3 text-text-muted">JTBD, Persona, RICE Prioritization, PRD, Roadmapping, Market Research, Competitive Analysis</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">AI / LLM</td>
                <td className="py-3 text-text-muted">Claude Code, Codex, Gemini AI, LLM Orchestration, Prompt Engineering, AI Agent Development, Agentic Workflows</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Engineering</td>
                <td className="py-3 text-text-muted">React, TypeScript, Flutter, Canvas 2D, Node.js, Python (FastAPI), PHP (Laravel), PostgreSQL, SQLite, Redis, Supabase, Vercel, Fly.io</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Data & Analytics</td>
                <td className="py-3 text-text-muted">BI Dashboards, Predictive Analytics, A/B Testing, SQL, Data-Driven Decision Making</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-3 pr-6 font-medium text-white whitespace-nowrap">Leadership</td>
                <td className="py-3 text-text-muted">Cross-Functional Team Leadership, Stakeholder Management, Agile / Scrum, Mentoring</td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Chinese */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '400ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ 中文簡介 ]</h2>
          <div className="mt-5 space-y-4 text-[15px] leading-[1.8] text-text-muted md:text-base md:leading-[1.85]" lang="zh-TW">
            <p>我是陳德潁（Charles Chen），台灣 AI 產品經理。擅長從 0 到 1 打造軟體產品，結合產品策略與 AI 開發工具，實現從概念到上線的端到端交付。</p>
            <p>過去 5 年的產品經歷橫跨創作者工具、金融科技、SaaS 與 MaaS 領域，累計影響超過 600 萬用戶。目前在 USPACE 負責停車支付、企業差旅、金融保險三大產品線的策略，涵蓋台灣與日本市場，驅動 85% 以上的公司營收。</p>
            <p>我相信未來最好的產品經理會是 Product Builder 的型態。不只規劃產品，更能親手用 AI 工具快速打造原型並上線驗證。這種方式讓我的迭代速度比傳統工作流程快 5 倍。</p>
          </div>
        </div>

        {/* Projects link */}
        <div className="reveal mt-16 border-t border-border pt-16 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700" style={{ transitionDelay: '480ms' }}>
          <h2 className="font-mono text-xs font-normal tracking-[2px] text-text-tertiary">[ PROJECTS ]</h2>
          <p className="mt-5 text-[15px] leading-[1.8] text-text-muted md:text-base">See what I've built:</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/projects/path" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
              Path <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/projects/plutus-trade" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
              Plutus Trade <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/projects/product-playbook" className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 font-mono text-[12px] uppercase tracking-[1.5px] text-white no-underline transition-all duration-200 hover:bg-btn-hover-bg hover:scale-105">
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
