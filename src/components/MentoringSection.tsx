import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'

const ADPLIST_BOOKING_URL =
  'https://adplist.org/widgets/booking?src=charlestyc0527gmailcom-mqpe4u0m'

const BookingWidget = ({ title }: { title: string }) => (
  <div
    className="reveal opacity-0 translate-y-5 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 [&.animate-in]:transition-all [&.animate-in]:duration-700"
    style={{
      height: 496,
      boxShadow: 'rgba(142, 151, 158, 0.15) 0px 4px 19px 0px',
      borderRadius: 16,
      overflow: 'hidden',
      width: '100%',
      maxWidth: 650,
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
)

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
          <BookingWidget title={t('mentoring.heading')} />
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
