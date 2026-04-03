import type { Project } from '../data/projects'
import { projects } from '../data/projects'

const CTA_FONT_FAMILY =
  "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

function CornerSquare({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positionStyles: Record<string, React.CSSProperties> = {
    tl: { top: -1, left: -1 },
    tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 },
    br: { bottom: -1, right: -1 },
  }

  return (
    <div
      className="absolute h-[8px] w-[8px] border border-border-highlight bg-surface-light"
      style={positionStyles[position]}
    />
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <a
      href={project.ctaUrl}
      aria-label={project.title}
      className="group relative flex min-h-0 flex-col no-underline md:min-h-[420px]"
      style={{
        padding: '32px 32px 40px',
        flex: '1 1 0%',
      }}
    >
      {/* Hover gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        style={{
          background:
            'linear-gradient(to bottom, rgba(125,129,135,0.1), transparent)',
        }}
      />

      {/* Hover border glow + corner squares */}
      <div
        className="pointer-events-none absolute inset-0 border border-border-subtle opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
      >
        <CornerSquare position="tl" />
        <CornerSquare position="tr" />
        <CornerSquare position="bl" />
        <CornerSquare position="br" />
      </div>

      {/* Title */}
      <h3
        className="text-white"
        style={{ fontSize: 20, fontWeight: 600, margin: 0 }}
      >
        {project.title}
      </h3>

      {/* Description */}
      <p
        className="text-text-secondary transition-colors duration-300 ease-in-out group-hover:text-white/85"
        style={{
          fontSize: 16,
          lineHeight: 1.5,
          marginTop: 12,
        }}
      >
        {project.description}
      </p>

      {/* Visual area placeholder */}
      <div className="flex-grow" />

      {/* CTA button — centered like xAI */}
      <div className="flex justify-center">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-btn-border px-5 py-2.5 transition-colors duration-300 ease-in-out group-hover:bg-white/[0.08]"
          style={{
            fontFamily: CTA_FONT_FAMILY,
            fontSize: 13,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            color: 'white',
          }}
        >
          <span>{project.ctaText}</span>
          <span className="inline-block transition-transform duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ fontSize: 13, lineHeight: 1, transform: 'scale(1.4)' }}>↗</span>
        </div>
      </div>
    </a>
  )
}

export default function ProjectCards() {
  return (
    <section id="projects" className="mx-auto w-full max-w-[1400px] px-12 py-20">
      {/* Section heading */}
      <h2
        className="text-center text-white"
        style={{ fontSize: 48, fontWeight: 600, marginBottom: 0 }}
      >
        Side Projects
      </h2>

      {/* Card grid */}
      <div
        className="flex flex-col md:flex-row"
        style={{ borderTop: '1px solid #1f2228', marginTop: 48 }}
      >
        {projects.map((project, index) => (
          <div
            key={project.id}
            className={`flex flex-1 ${index > 0 ? 'border-t border-border md:border-t-0 md:border-l' : ''}`}
          >
            <ProjectCard project={project} />
          </div>
        ))}
      </div>
    </section>
  )
}
