import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

const ADPLIST_BOOKING_URL =
  'https://adplist.org/widgets/booking?src=charlestyc0527gmailcom-mqpe4u0m'

// The embedded widget can preview live availability, but its in-frame
// "Book Session" is a dead end for anyone not already logged into ADPList:
// the login/OAuth step cannot fire inside a cross-origin iframe. The real
// booking flow lives on the full profile page, so the actual booking action
// opens that in a new tab where ADPList handles sign-in then confirmation.
const ADPLIST_PROFILE_URL =
  'https://adplist.org/mentors/charlestyc0527gmailcom-mqpe4u0m'

// Rendered only after the user taps "View available hours", which happens
// long after MentoringSection's mount-time IntersectionObserver has already
// scanned for .reveal elements. So this widget cannot rely on .animate-in to
// fade in (the observer never sees it) — it drives its own entrance instead,
// otherwise it would stay stuck at opacity-0 and the iframe would be invisible.
const BookingWidget = ({ title, bookLabel }: { title: string; bookLabel: string }) => {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      className="flex w-full max-w-[650px] flex-col items-center gap-6 transition-all duration-700"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      <div
        style={{
          height: 496,
          boxShadow: 'rgba(142, 151, 158, 0.15) 0px 4px 19px 0px',
          borderRadius: 16,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <iframe
          src={ADPLIST_BOOKING_URL}
          title={title}
          width="100%"
          height="100%"
          loading="lazy"
          style={{ border: 0 }}
        />
      </div>
      <a
        href={ADPLIST_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full max-w-md rounded-full bg-accent-mars py-3 text-center text-sm font-semibold text-white no-underline transition-all duration-200 hover:shadow-[0_0_24px_rgba(232,101,43,0.45)]"
      >
        {bookLabel}
      </a>
    </div>
  )
}

export default function MentoringSection() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [showWidget, setShowWidget] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!sectionRef.current) return
    const elements = sectionRef.current.querySelectorAll('.reveal')
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
    elements.forEach((el) => observer.observe(el))
    const safetyTimeout = setTimeout(() => {
      elements.forEach((el) => el.classList.add('animate-in'))
    }, 2000)
    return () => {
      observer.disconnect()
      clearTimeout(safetyTimeout)
    }
  }, [])

  return (
    <div ref={sectionRef} id="mentoring">
      <section className="mx-auto flex max-w-[1400px] flex-col items-center px-6 py-32 text-center md:px-12">
        <p className="reveal mb-3 font-mono text-xs uppercase tracking-[3px] text-accent-mars opacity-0 [&.animate-in]:opacity-100 [&.animate-in]:transition-opacity [&.animate-in]:duration-700">
          {t('mentoring.eyebrow')}
        </p>
        <h2 className="reveal mb-5 text-[40px] font-semibold leading-tight opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700">
          {t('mentoring.heading')}
        </h2>
        <p className="reveal mb-10 max-w-xl text-base leading-7 text-text-secondary opacity-0 translate-y-4 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700 [&.animate-in]:[transition-delay:120ms]">
          {t('mentoring.body')}
        </p>
        {showWidget ? (
          <BookingWidget title={t('mentoring.heading')} bookLabel={t('mentoring.bookOnAdplist')} />
        ) : (
          <div className="reveal flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-border-subtle bg-bg-secondary p-10 opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700">
            <div className="text-center">
              <p className="text-lg font-medium text-white">{t('mentoring.sessionTitle')}</p>
              <p className="mt-1 text-sm text-text-muted">{t('mentoring.sessionMeta')}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowWidget(true)}
              className="w-full rounded-full bg-accent-mars py-3 text-sm font-semibold text-white transition-all duration-200 hover:shadow-[0_0_24px_rgba(232,101,43,0.45)]"
            >
              {t('mentoring.viewHours')}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
