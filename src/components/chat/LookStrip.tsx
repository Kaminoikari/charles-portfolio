// The row of looks above the motion strip.
//
// Same shape as MotionStrip and for the same reason: always visible, so what
// she can turn into is on the table rather than behind a settings gear. One
// chip per declared body (avatarVariants); the one on screen is pressed, and
// every chip is disabled while a body is on its way — a second tap
// mid-download would only queue a download the first one made pointless.
//
// Hovering or focusing a chip warms the HTTP cache for that body, so by the
// time the tap lands the swap is a parse rather than a download. Not while
// busy: the first body has to land before a second one is asked for, and a
// swap in flight already owns the connection.
//
// It renders nothing with fewer than two bodies: one body is not a choice.
import type { AvatarVariant, AvatarVariantId } from './avatarVariants'
import { prefetchBody } from './avatarPrefetch'
import { useT } from '../../i18n/useT'

export interface LookStripProps {
  /** The bodies on offer, in strip order. */
  variants: readonly AvatarVariant[]
  /** The body on screen. */
  shown: AvatarVariantId
  /** A body is loading, or the first one has not landed yet: nothing is tappable. */
  busy: boolean
  onPick: (id: AvatarVariantId) => void
}

export function LookStrip({ variants, shown, busy, onPick }: LookStripProps) {
  const t = useT()
  if (variants.length < 2) return null

  return (
    <div
      role="group"
      aria-label={t('chat.looksAriaLabel')}
      // Same scroller as MotionStrip: sideways inside itself, so the composer
      // keeps its width; the negative margin lets a focus ring show.
      className="-mx-0.5 flex flex-none items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5"
    >
      <span className="flex-none pr-1 font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
        {t('chat.looksLabel')}
      </span>
      {variants.map((v) => {
        const current = v.id === shown
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={current}
            disabled={busy}
            onClick={() => {
              if (!current) onPick(v.id)
            }}
            onPointerEnter={() => {
              if (!current && !busy) prefetchBody(v.url)
            }}
            onFocus={() => {
              if (!current && !busy) prefetchBody(v.url)
            }}
            className={
              'flex-none cursor-pointer whitespace-nowrap rounded-full border border-border ' +
              'bg-bg-tertiary px-3 py-1.5 text-[12px] text-text-muted transition-colors ' +
              'hover:border-accent-cyan hover:text-accent-cyan ' +
              'aria-pressed:border-accent-cyan aria-pressed:text-accent-cyan ' +
              'disabled:cursor-default disabled:opacity-40'
            }
          >
            {t(`chat.looks.${v.id}`)}
          </button>
        )
      })}
    </div>
  )
}
