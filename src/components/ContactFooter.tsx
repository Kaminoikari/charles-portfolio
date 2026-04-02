import { socialLinks } from '../data/social'

export default function ContactFooter() {
  return (
    <div
      id="contact"
      style={{
        background:
          'linear-gradient(180deg, #0A0A0A 0%, #1A0E08 30%, #2D1810 55%, #6B3021 80%, #C4501A 95%, #E8652B 100%)',
      }}
    >
      <style>{`
        .social-icon {
          border-color: rgba(255,255,255,0.15);
          color: #999;
          transition: all 0.3s;
        }
        .social-icon:hover {
          border-color: #E8652B;
          color: #E8652B;
          box-shadow: 0 0 16px rgba(232,101,43,0.3);
        }
      `}</style>
      <section className="mx-auto max-w-[1200px] px-12 pt-40 pb-20 text-center">
        <h2 className="mb-8 text-[40px] font-semibold">Let's Connect</h2>
        <div className="mb-6 flex justify-center gap-8">
          {socialLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="social-icon flex h-12 w-12 items-center justify-center border text-lg no-underline"
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className="text-base tracking-[1px] text-[#999]">hello@charles.dev</div>
      </section>
      <footer
        className="py-12 text-center text-xs tracking-[1px]"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        © 2026 CHARLES. BUILT WITH REACT + THREE.JS
      </footer>
    </div>
  )
}
