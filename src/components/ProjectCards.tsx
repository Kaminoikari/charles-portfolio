import type { Project } from '../data/projects'
import { projects } from '../data/projects'

const CTA_FONT_FAMILY =
  "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

function CornerSquare({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const positionStyles: Record<string, React.CSSProperties> = {
    tl: { top: -4, left: -4 },
    tr: { top: -4, right: -4 },
    bl: { bottom: -4, left: -4 },
    br: { bottom: -4, right: -4 },
  }

  return (
    <div
      className="absolute h-[7px] w-[7px]"
      style={{
        ...positionStyles[position],
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    />
  )
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <a
      href={project.ctaUrl}
      className="group relative flex flex-col"
      style={{
        minHeight: 565,
        padding: 32,
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
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
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
        className="transition-colors duration-300 ease-in-out group-hover:text-white/85"
        style={{
          fontSize: 16,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.45)',
          marginTop: 12,
        }}
      >
        {project.description}
      </p>

      {/* Visual area placeholder */}
      <div className="flex-grow" />

      {/* CTA button */}
      <div
        className="inline-flex items-center gap-2 self-start rounded-full px-5 py-2.5 transition-colors duration-300 ease-in-out group-hover:bg-white/[0.08]"
        style={{
          border: '1px solid rgba(255,255,255,0.25)',
          fontFamily: CTA_FONT_FAMILY,
          fontSize: 13,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          color: 'white',
        }}
      >
        <span>{project.ctaText}</span>
        <span style={{ fontSize: 14 }}>&#x2197;</span>
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
