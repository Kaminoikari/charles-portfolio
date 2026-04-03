import { blogPlatforms } from '../data/blog'

export default function BlogEntries() {
  return (
    <section id="blog" className="mx-auto max-w-[1200px] px-12 py-30">
      <div className="mb-12 text-xs uppercase tracking-[3px] text-text-tertiary">
        WRITING
      </div>
      <div className="mx-auto grid max-w-[800px] grid-cols-1 gap-8 sm:grid-cols-2">
        {blogPlatforms.map((platform) => (
          <a
            key={platform.name}
            href={platform.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read articles on ${platform.name}`}
            className="block border border-border bg-bg-primary p-12 text-center no-underline transition-all duration-300 hover:scale-[1.04] hover:border-border-hover hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="mb-4 font-mono text-3xl text-[#999]">
              {platform.name === 'Medium' ? 'M' : 'S'}
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-white">
              {platform.name}
            </h3>
            <p className="text-sm text-text-tertiary">{platform.subtitle}</p>
          </a>
        ))}
      </div>
    </section>
  )
}
