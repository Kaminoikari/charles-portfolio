import { socialLinks } from '../data/social'

export default function ContactFooter() {
  return (
    <div
      id="contact"
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
              className="flex h-12 w-12 items-center justify-center border border-border-hover text-lg text-text-muted no-underline transition-all duration-300 hover:border-accent-mars hover:text-accent-mars hover:shadow-[0_0_16px_rgba(232,101,43,0.3)]"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="text-base tracking-[1px] text-text-muted">hello@charles.dev</div>
      </section>
      <footer className="border-t border-border-hover py-12 text-center text-xs tracking-[1px] text-text-secondary">
        © 2026 CHARLES. BUILT WITH REACT + CANVAS
      </footer>
    </div>
  )
}
