import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { useExperience } from '../data'
import { careerPhotosFor, type CareerPhoto } from '../data/career-photos'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type BoxState = { photos: CareerPhoto[]; index: number } | null

// Pointer travel (px) that separates a click-to-open from a drag-to-scroll on
// the photo rail. Below this we never capture the pointer, so the click reaches
// the photo button and opens the lightbox; above it we treat it as a drag.
const DRAG_THRESHOLD = 6

export default function CareerGallery() {
  const root = useRef<HTMLDivElement>(null)
  const experience = useExperience()
  const [box, setBox] = useState<BoxState>(null)

  const openBox = useCallback((photos: CareerPhoto[], index: number) => {
    setBox({ photos, index })
  }, [])

  useGSAP(
    () => {
      const chapters = gsap.utils.toArray<HTMLElement>('.career-chapter')
      const mm = gsap.matchMedia()

      // Full motion: cinematic reveal + parallax + grade-on-active.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Draw the timeline spine as the section scrolls through the viewport.
        gsap.fromTo(
          '.career-spine-fill',
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.career-timeline', start: 'top 65%', end: 'bottom 55%', scrub: true },
          },
        )

        chapters.forEach((chapter) => {
          const frames = chapter.querySelectorAll<HTMLElement>('.career-frame')
          const imgs = chapter.querySelectorAll<HTMLElement>('.career-img')
          const meta = chapter.querySelectorAll<HTMLElement>('.career-meta > *')

          gsap.set(frames, { clipPath: 'inset(0 0 100% 0)' })
          gsap.set(meta, { y: 24, opacity: 0 })

          const tl = gsap.timeline({
            scrollTrigger: { trigger: chapter, start: 'top 78%', once: true },
          })
          tl.to(meta, { y: 0, opacity: 1, stagger: 0.07, duration: 0.6, ease: 'power2.out' })
            .to(frames, { clipPath: 'inset(0 0 0% 0)', duration: 1.0, stagger: 0.08, ease: 'power3.out' }, 0.15)
            .fromTo(imgs, { scale: 1.16 }, { scale: 1, duration: 1.2, stagger: 0.08, ease: 'power3.out' }, 0.15)

          // Grade to full colour while the chapter sits in the mid-viewport band.
          ScrollTrigger.create({
            trigger: chapter,
            start: 'top 62%',
            end: 'bottom 38%',
            onToggle: (self) => chapter.classList.toggle('is-active', self.isActive),
          })
        })

        // Recompute trigger positions once fonts/layout settle — without this,
        // mobile (slow fonts + a resizing address bar) can measure too early,
        // leave the first screen's content hidden, and never reveal it.
        ScrollTrigger.refresh()
        if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh())

        // Safety net (mirrors the site's IntersectionObserver fallback): if a
        // trigger somehow never fires, force everything visible after 2.5s so
        // content is never permanently stuck hidden.
        gsap.delayedCall(2.5, () => {
          gsap.to('.career-meta > *', { opacity: 1, y: 0, duration: 0.4, overwrite: 'auto' })
          gsap.to('.career-frame', { clipPath: 'inset(0 0 0% 0)', duration: 0.4, overwrite: 'auto' })
        })
      })

      // Reduced motion: show everything, no scrub/parallax.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('.career-frame', { clipPath: 'inset(0)' })
        gsap.set('.career-meta > *', { y: 0, opacity: 1 })
        gsap.set('.career-spine-fill', { scaleY: 1 })
        chapters.forEach((c) => c.classList.add('is-active'))
      })
    },
    { scope: root, dependencies: [experience.length] },
  )

  return (
    <div ref={root} className="mt-2">
      {/* Vertical timeline: newest (top) -> oldest (bottom). The spine fill is
          drawn by GSAP as you scroll; each chapter sits on a diamond node. */}
      <div className="career-timeline relative pl-8 md:pl-12">
        <div className="career-spine" aria-hidden="true">
          <div className="career-spine-fill" />
        </div>
        <div className="space-y-20 md:space-y-28">
          {experience.map((item, i) => (
            <CareerChapter
              key={i}
              title={item.title}
              org={item.organization}
              period={item.dateRange}
              bullets={item.bullets}
              onOpen={openBox}
            />
          ))}
        </div>
      </div>

      {box && (
        <Lightbox
          photos={box.photos}
          index={box.index}
          onClose={() => setBox(null)}
        />
      )}
    </div>
  )
}

function CareerChapter({
  title,
  org,
  period,
  bullets,
  onOpen,
}: {
  title: string
  org: string
  period: string
  bullets: string[]
  onOpen: (photos: CareerPhoto[], index: number) => void
}) {
  const photos = careerPhotosFor(org)
  // Big year anchor (start year) derived from the period, e.g. 'JULY 2024 — PRESENT'.
  const year = period.match(/\d{4}/)?.[0] ?? ''

  return (
    <div className="career-chapter relative">
      <span className="career-node" aria-hidden="true" />
      {/* Text header */}
      <div className="career-meta">
        <div className="career-year font-mono text-3xl font-semibold leading-none tracking-tight text-white/15 transition-colors duration-700 md:text-4xl">
          {year}
        </div>
        <h3 className="mt-3 text-xl font-semibold text-white md:text-2xl">{title}</h3>
        <div className="mt-1.5">
          <span className="inline-block h-px w-10 bg-accent-mars align-middle" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-text-muted">{org}</span>
          <span className="text-text-tertiary">·</span>
          <span className="font-mono tracking-[0.5px] text-text-tertiary">{period}</span>
        </div>
        <ul className="mt-4 space-y-2">
          {bullets.map((b, j) => (
            <li key={j} className="flex items-start gap-3 text-[15px] leading-[1.8] text-text-muted">
              <span className="mt-[10px] block h-1.5 w-1.5 shrink-0 rounded-full bg-accent-mars/60" />
              {b}
            </li>
          ))}
        </ul>
      </div>

      {/* Photos */}
      <div className="career-meta mt-6">
        {photos.length > 1 ? (
          <PhotoRail org={org} photos={photos} onOpen={onOpen} />
        ) : (
          <div className="md:max-w-[70%]">
            <PhotoFrame
              org={org}
              photo={photos[0]}
              onClick={photos.length ? () => onOpen(photos, 0) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function PhotoRail({
  org,
  photos,
  onOpen,
}: {
  org: string
  photos: CareerPhoto[]
  onOpen: (photos: CareerPhoto[], index: number) => void
}) {
  const railRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  // Drag-to-scroll (mouse). Touch / trackpad scroll natively.
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: 0 })

  const onScroll = () => {
    const el = railRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setProgress(max > 0 ? el.scrollLeft / max : 0)
  }

  return (
    <div>
      <div
        ref={railRef}
        onScroll={onScroll}
        onPointerDown={(e) => {
          // Touch / pen scroll the rail natively; only mouse needs JS drag.
          if (e.pointerType !== 'mouse') return
          const el = railRef.current
          if (!el) return
          drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0 }
        }}
        onPointerMove={(e) => {
          const el = railRef.current
          if (!el || !drag.current.down) return
          const dx = e.clientX - drag.current.startX
          drag.current.moved = Math.max(drag.current.moved, Math.abs(dx))
          // Capture only once it's unmistakably a drag. Capturing on pointerdown
          // retargets the trailing click to the rail, so the photo button never
          // receives it and the lightbox can't open.
          if (drag.current.moved > DRAG_THRESHOLD) {
            if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId)
            el.scrollLeft = drag.current.startLeft - dx
          }
        }}
        onPointerUp={() => { drag.current.down = false }}
        className="no-scrollbar flex h-64 snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [cursor:grab] active:[cursor:grabbing] sm:h-72 md:h-80"
      >
        {photos.map((photo, i) => (
          <div key={i} className="h-full shrink-0 snap-start">
            <PhotoFrame
              org={org}
              photo={photo}
              fill
              onClick={() => {
                // Ignore the click that ends a drag.
                if (drag.current.moved > DRAG_THRESHOLD) return
                onOpen(photos, i)
              }}
            />
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-px w-full bg-border">
        <div
          className="h-full bg-accent-mars transition-[width] duration-150"
          style={{ width: `${Math.max(0.12, progress) * 100}%` }}
        />
      </div>
    </div>
  )
}

function PhotoFrame({
  org,
  photo,
  onClick,
  fill = false,
}: {
  org: string
  photo?: CareerPhoto
  onClick?: () => void
  /** Film-strip mode: the frame takes the rail's height and its width follows
   *  the photo's natural aspect ratio, so nothing is cropped. */
  fill?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImg = photo && !failed
  const interactive = Boolean(onClick && showImg)

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={`career-frame group/frame relative overflow-hidden rounded-md border border-border bg-bg-secondary will-change-[clip-path] ${
        fill ? 'h-full' : 'aspect-[4/3] w-full'
      } ${interactive ? 'cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-cyan' : ''}`}
      // Film strip: the frame's width follows the photo's aspect ratio (from
      // data, so it's correct before the lazy image decodes — no layout shift).
      style={fill ? { aspectRatio: `${photo?.w ?? 3} / ${photo?.h ?? 4}` } : undefined}
    >
      {showImg ? (
        <img
          src={photo!.src}
          alt={photo!.alt}
          width={photo!.w}
          height={photo!.h}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          onLoad={() => ScrollTrigger.refresh()}
          className={`career-img select-none object-cover ${
            fill ? 'h-full w-full' : 'absolute left-0 w-full'
          }`}
          style={
            fill
              ? { objectPosition: photo!.pos ?? 'center 50%' }
              : { top: '-6%', height: '112%', objectPosition: photo!.pos ?? 'center 30%' }
          }
        />
      ) : (
        <Placeholder org={org} />
      )}

      <div className="career-grain pointer-events-none absolute inset-0" />
      <div className="career-vignette pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-primary/55 via-transparent to-transparent shadow-[inset_0_0_70px_18px_rgba(0,0,0,0.45)]" />
      <div className="pointer-events-none absolute inset-0 rounded-md ring-0 ring-accent-cyan/0 transition-all duration-300 group-hover/frame:ring-1 group-hover/frame:ring-accent-cyan/40" />

      {/* Hover hint that the photo is clickable */}
      {interactive && (
        <div className="pointer-events-none absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-white/30 bg-bg-primary/40 text-white opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover/frame:opacity-100">
          <ExpandIcon />
        </div>
      )}
    </div>
  )
}

function Placeholder({ org }: { org: string }) {
  const initial = org.replace(/^(the\s+)/i, '').charAt(0).toUpperCase()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_rgba(232,101,43,0.08),_transparent_70%)]">
      <span className="font-mono text-5xl font-semibold text-white/15">{initial}</span>
      <span className="mt-3 font-mono text-[10px] uppercase tracking-[2px] text-text-tertiary/70">
        photo coming soon
      </span>
    </div>
  )
}

// Pointer travel (px) before a press is treated as a swipe rather than a tap.
const SWIPE_AXIS_LOCK = 8

function Lightbox({
  photos,
  index: initialIndex,
  onClose,
}: {
  photos: CareerPhoto[]
  index: number
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const count = photos.length
  const [index, setIndex] = useState(initialIndex)
  const [vw, setVw] = useState(() => window.innerWidth)
  const [dragDx, setDragDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ active: boolean; startX: number; startY: number; axis: 'h' | 'v' | null }>(
    { active: false, startX: 0, startY: 0, axis: null },
  )
  // A swipe ends with a click event; this stops that click from also closing.
  const swallowClick = useRef(false)

  const goTo = useCallback((i: number) => setIndex(Math.min(count - 1, Math.max(0, i))), [count])
  const prev = useCallback(() => goTo(index - 1), [goTo, index])
  const next = useCallback(() => goTo(index + 1), [goTo, index])

  // Keyboard nav + body scroll lock.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, prev, next])

  // Keep the slide width in sync with the viewport (resize / orientation / the
  // mobile address bar) so the translate offset always lands a slide dead-centre.
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  // Fade the backdrop in once, on open.
  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' })
    },
    { dependencies: [] },
  )

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, axis: null }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.axis) {
      if (Math.abs(dx) < SWIPE_AXIS_LOCK && Math.abs(dy) < SWIPE_AXIS_LOCK) return
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'
      if (d.axis === 'h') {
        trackRef.current?.setPointerCapture?.(e.pointerId)
        setDragging(true)
      }
    }
    if (d.axis === 'h') {
      // Rubber-band resistance past the first / last slide.
      const past = (index === 0 && dx > 0) || (index === count - 1 && dx < 0)
      setDragDx(past ? dx * 0.3 : dx)
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = { active: false, startX: 0, startY: 0, axis: null }
    if (d.axis !== 'h') return
    const dx = e.clientX - d.startX
    const threshold = Math.min(vw * 0.18, 110)
    let target = index
    if (dx <= -threshold) target = Math.min(count - 1, index + 1)
    else if (dx >= threshold) target = Math.max(0, index - 1)
    swallowClick.current = true
    setTimeout(() => { swallowClick.current = false }, 0)
    setDragging(false)
    setDragDx(0)
    setIndex(target)
  }

  const translate = -index * vw + dragDx
  const photo = photos[index]

  // Portal to <body>: the gallery lives inside `.reveal` wrappers whose Tailwind
  // `translate-y` utilities set the CSS `translate` property, which establishes a
  // containing block for `position: fixed`. Without the portal the overlay would
  // anchor to the reveal box (offset down the page) instead of the viewport.
  return createPortal(
    <div
      ref={overlayRef}
      onClick={() => {
        if (swallowClick.current) return
        onClose()
      }}
      className="fixed inset-0 z-[100] overflow-hidden bg-bg-primary/92 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* Swipeable slide track. Each photo gets its own full-width slide and the
          track translates between them — no opacity blending, so mismatched
          portrait/landscape photos never leave a ghost of each other. Works with
          mouse drag and touch swipe; transition is off mid-drag to track 1:1. */}
      <div
        className="absolute inset-0 touch-pan-y"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            transform: `translate3d(${translate}px, 0, 0)`,
            transition: dragging ? 'none' : 'transform 360ms cubic-bezier(0.22, 0.61, 0.36, 1)',
          }}
        >
          {photos.map((p, i) => (
            <div
              key={i}
              className="flex h-full shrink-0 select-none items-center justify-center px-6"
              style={{ width: `${vw}px` }}
            >
              <img
                src={p.full ?? p.src}
                alt={p.alt}
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[82vh] max-w-[92vw] rounded-md object-contain shadow-2xl"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-accent-cyan hover:text-accent-cyan"
      >
        <CloseIcon />
      </button>

      {/* Caption */}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-6 flex items-center justify-center gap-3 px-6 text-center font-mono text-[12px] tracking-[1px] text-text-muted">
        {count > 1 && (
          <span className="text-text-tertiary">
            {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
          </span>
        )}
        {photo.alt && <span>{photo.alt}</span>}
      </figcaption>

      {/* Prev / Next — clamped, so each hides at its end of the strip. */}
      {count > 1 && index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev() }}
          aria-label="Previous"
          className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-accent-cyan hover:text-accent-cyan md:left-6"
        >
          <ArrowIcon dir="left" />
        </button>
      )}
      {count > 1 && index < count - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next() }}
          aria-label="Next"
          className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:border-accent-cyan hover:text-accent-cyan md:right-6"
        >
          <ArrowIcon dir="right" />
        </button>
      )}
    </div>,
    document.body,
  )
}

/* ---- tiny inline icons (stroke = currentColor) ---- */
function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function ArrowIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === 'right' ? 'rotate(180deg)' : undefined }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
