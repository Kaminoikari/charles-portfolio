import { useEffect, useMemo, useRef } from 'react'
import { useBlogArticles, platformLinks, type BlogArticle } from '../data'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
}

const MediumLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="#FFFFFF" className="opacity-40">
    <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zm7.42 0c0 3.54-1.51 6.42-3.38 6.42S14.2 15.54 14.2 12s1.52-6.42 3.38-6.42 3.38 2.88 3.38 6.42zM24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/>
  </svg>
)

const SubstackLogo = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="#FF6719" className="opacity-40">
    <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
  </svg>
)

function BlogEntry({ article, index }: { article: BlogArticle; index: number }) {
  return (
    <div className="group relative">
      <div
        className="blog-item flex flex-col gap-10 border-b border-border py-16 first-of-type:border-t last-of-type:border-b-0 opacity-0 translate-y-6 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 md:flex-row md:gap-12"
        style={{ transitionDelay: `${index * 100}ms` }}
      >
        {/* Left: date + title + subtitle + tag + READ */}
        <div className="order-2 flex flex-1 flex-col gap-4 md:order-1 md:gap-12 xl:flex-row">
          <div>
            <p className="font-mono text-xs leading-6 tracking-[1.5px] text-text-tertiary">
              {formatDate(article.date)}
            </p>
          </div>

          <div className="flex flex-1 flex-col space-y-6">
            <div className="block grow space-y-4">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline"
              >
                <div className="absolute inset-0" />
                {article.featured && (
                  <span className="mb-3 inline-block rounded bg-accent-mars/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] text-accent-mars">
                    Featured
                  </span>
                )}
                <h3 className="text-xl leading-6 text-white">
                  {article.title}
                </h3>
              </a>
              <p className="grow text-[15px] leading-[1.6] text-text-secondary">
                {article.subtitle}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs uppercase tracking-[1.5px] text-text-tertiary">
                  {article.platform}
                </span>
              </div>
              <div>
                <button
                  type="button"
                  className="pointer-events-none inline-flex shrink-0 items-center justify-center rounded-full border border-btn-border bg-transparent px-3.5 py-1.5 font-mono text-xs uppercase tracking-[1.5px] text-white transition-colors duration-200 group-hover:bg-white/[0.06]"
                >
                  Read
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: cover image as background (xAI style) */}
        <div className="order-1 flex-1 md:order-2 xl:max-w-[500px]">
          <div
            className="break-words flex w-full items-center whitespace-pre-wrap bg-bg-secondary duration-150 aspect-[16/10]"
            style={article.cover ? {
              backgroundImage: `url("${article.cover}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center center',
              backgroundRepeat: 'no-repeat',
            } : undefined}
          >
            <div className="flex h-full w-full items-center justify-center">
              {!article.cover && (
                article.platform === 'Medium' ? <MediumLogo /> : <SubstackLogo />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BlogEntries() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const blogArticles = useBlogArticles()
  const sortedArticles = useMemo(
    () => [
      ...blogArticles.filter((a) => a.featured),
      ...blogArticles.filter((a) => !a.featured).sort((a, b) => b.date.localeCompare(a.date)),
    ],
    [blogArticles],
  )

  useEffect(() => {
    if (!sectionRef.current) return
    const items = sectionRef.current.querySelectorAll('.blog-item')
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
    items.forEach((item) => observer.observe(item))
    const safety = setTimeout(() => items.forEach((item) => item.classList.add('animate-in')), 2000)
    return () => { observer.disconnect(); clearTimeout(safety) }
  }, [])

  return (
    <section id="blog" ref={sectionRef} className="py-16 sm:py-32">
      <div className="mx-auto w-full max-w-[1400px] space-y-16 px-6 md:px-12 sm:space-y-32">
        {/* Header */}
        <div className="space-y-12">
          <div>
            <div className="font-mono text-sm font-medium tracking-[2px] text-text-tertiary">
              [ BLOG ]
            </div>
          </div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl text-white">
                Latest writing
              </h2>
            </div>
            <div className="flex gap-4">
              <a
                href={platformLinks.substack}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-btn-border bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-widest text-white no-underline transition-colors duration-200 hover:bg-white/[0.06]"
              >
                Substack
              </a>
              <a
                href={platformLinks.medium}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-btn-border bg-transparent px-4 py-2 font-mono text-sm uppercase tracking-widest text-white no-underline transition-colors duration-200 hover:bg-white/[0.06]"
              >
                Medium
              </a>
            </div>
          </div>
        </div>

        {/* Articles */}
        <div>
          {sortedArticles.map((article, i) => (
            <BlogEntry key={article.url} article={article} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
