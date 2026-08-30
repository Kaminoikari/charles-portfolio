// The row of motions above the composer.
//
// Always visible rather than behind a button: this is the one control in the
// widget whose whole point is that you can see what she can do. A picker would
// cost a tap before every play and hide the feature from anyone who never opens
// it, and the owner chose the strip over two picker variants on that basis.
//
// It renders nothing when no clip is offered, which is also how it disappears
// on a viewport with no avatar: motionsFor('hidden') is empty, so there is no
// separate mobile case to keep in step.
import type { AvatarMotionName } from './avatarMotions'
import { useT } from '../../i18n/useT'

export interface MotionStripProps {
  /** Clips offered in the current placement, in the order the idle rotation plays them. */
  motions: readonly AvatarMotionName[]
  /** Which of those have finished downloading and will move her if tapped. */
  ready: readonly AvatarMotionName[]
  onPlay: (name: AvatarMotionName) => void
}

export function MotionStrip({ motions, ready, onPlay }: MotionStripProps) {
  const t = useT()
  if (motions.length === 0) return null
  const canPlay = new Set(ready)

  return (
    <div
      role="group"
      aria-label={t('chat.motionsAriaLabel')}
      // overflow-x-auto with flex-none children: the strip scrolls sideways
      // inside itself so the composer keeps its width on any viewport. The
      // negative margin lets a chip's focus ring show without the scroller
      // clipping it.
      className="-mx-0.5 flex flex-none gap-1.5 overflow-x-auto px-0.5 pb-0.5"
    >
      {motions.map((name) => {
        const playable = canPlay.has(name)
        return (
          <button
            key={name}
            type="button"
            disabled={!playable}
            onClick={() => onPlay(name)}
            // Disabled rather than hidden while a clip is still downloading.
            // Dropping it would make the strip reshuffle under the visitor's
            // finger as each of the ten lands.
            title={playable ? undefined : t('chat.motionsLabel')}
            className={
              'flex-none cursor-pointer whitespace-nowrap rounded-full border border-border ' +
              'bg-bg-tertiary px-3 py-1.5 text-[12px] text-text-muted transition-colors ' +
              'hover:border-accent-cyan hover:text-accent-cyan ' +
              'disabled:cursor-default disabled:border-border disabled:text-text-tertiary disabled:opacity-40'
            }
          >
            {t(`chat.motions.${name}` as Parameters<typeof t>[0])}
          </button>
        )
      })}
    </div>
  )
}
