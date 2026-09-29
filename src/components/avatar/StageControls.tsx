// The pickers the /avatar page shows, shared by both layouts: the phone's
// dock lays each one out as a single row that scrolls sideways under a thumb,
// the desktop's character select lays them out as grids with everything in
// view. Same buttons, same state, two arrangements (`variant`).
import type { AvatarMotionName } from '../chat/avatarMotions'
import type { EmotionName } from '../chat/avatarMode'
import type { OfferedVariantId } from '../chat/avatarVariants'
import { prefetchBody } from '../chat/avatarPrefetch'
import { useT } from '../../i18n/useT'
import { lookThumb, sceneLight, type StageLightId, type StageScene, type StageSceneId } from './stageContent'

type Variant = 'row' | 'grid'

const CHIP =
  'cursor-pointer whitespace-nowrap rounded-full border border-white/15 bg-black/35 px-3.5 py-2 text-[13px] ' +
  'text-white/80 transition-colors hover:border-accent-cyan hover:text-accent-cyan ' +
  'aria-pressed:border-accent-cyan aria-pressed:text-accent-cyan ' +
  'disabled:cursor-default disabled:opacity-35 disabled:hover:border-white/15 disabled:hover:text-white/80'

export function LookPicker({
  looks,
  shown,
  pending,
  busy,
  onPick,
  variant,
}: {
  looks: readonly { id: OfferedVariantId; url: string }[]
  /** The body on screen. */
  shown: OfferedVariantId
  /** The body asked for and still loading, if any. */
  pending: OfferedVariantId | null
  busy: boolean
  onPick: (id: OfferedVariantId) => void
  variant: Variant
}) {
  const t = useT()
  return (
    <div
      role="group"
      aria-label={t('chat.looksAriaLabel')}
      className={
        variant === 'row'
          ? 'flex gap-2 overflow-x-auto px-3 pb-1'
          : 'grid grid-cols-3 gap-2'
      }
    >
      {looks.map(({ id, url }) => {
        const current = id === shown
        const loading = id === pending
        return (
          <button
            key={id}
            type="button"
            aria-pressed={current}
            aria-busy={loading || undefined}
            disabled={busy && !current}
            onClick={() => {
              if (!current) onPick(id)
            }}
            onPointerEnter={() => {
              if (!current && !busy) prefetchBody(url)
            }}
            onFocus={() => {
              if (!current && !busy) prefetchBody(url)
            }}
            className={
              'group relative flex-none cursor-pointer overflow-hidden rounded-lg border bg-gradient-to-b ' +
              'from-white/10 to-black/40 transition-all disabled:cursor-default disabled:opacity-40 ' +
              (current
                ? 'border-accent-cyan shadow-[0_0_0_1px_var(--color-accent-cyan),0_0_18px_rgba(0,217,255,0.35)] '
                : 'border-white/15 hover:border-white/40 ') +
              (variant === 'row' ? 'h-[92px] w-[74px]' : 'aspect-[4/5] w-full')
            }
          >
            <img
              src={lookThumb(id)}
              alt=""
              loading="lazy"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1 pt-3 pb-1 text-center text-[11px] text-white">
              {t(`chat.looks.${id}`)}
            </span>
            {loading ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-accent-cyan" />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function MotionPicker({
  motions,
  ready,
  onPlay,
  variant,
}: {
  motions: readonly AvatarMotionName[]
  ready: readonly AvatarMotionName[]
  onPlay: (name: AvatarMotionName) => void
  variant: Variant
}) {
  const t = useT()
  const canPlay = new Set(ready)
  return (
    <div
      role="group"
      aria-label={t('chat.motionsAriaLabel')}
      className={variant === 'row' ? 'flex gap-2 overflow-x-auto px-3 pb-1' : 'grid grid-cols-2 gap-1.5'}
    >
      {motions.map((name) => (
        <button
          key={name}
          type="button"
          disabled={!canPlay.has(name)}
          onClick={() => onPlay(name)}
          className={CHIP + (variant === 'row' ? ' flex-none' : ' w-full !py-1.5')}
        >
          {t(`chat.motions.${name}`)}
        </button>
      ))}
    </div>
  )
}

export function ExpressionPicker({
  expressions,
  active,
  disabled,
  onPick,
  variant,
}: {
  expressions: readonly EmotionName[]
  /** The expression last asked for while it holds, for the pressed state. */
  active: EmotionName | null
  disabled: boolean
  onPick: (name: EmotionName) => void
  variant: Variant
}) {
  const t = useT()
  return (
    <div
      role="group"
      aria-label={t('stage.tabs.expressions')}
      className={variant === 'row' ? 'flex gap-2 overflow-x-auto px-3 pb-1' : 'grid grid-cols-2 gap-1.5'}
    >
      {expressions.map((name) => (
        <button
          key={name}
          type="button"
          aria-pressed={name === active}
          disabled={disabled}
          onClick={() => onPick(name)}
          className={CHIP + (variant === 'row' ? ' flex-none' : ' w-full !py-1.5')}
        >
          {t(`stage.expressions.${name}`)}
        </button>
      ))}
    </div>
  )
}

export function ScenePicker({
  scenes,
  shown,
  light,
  onPick,
  onLight,
  variant,
}: {
  scenes: readonly StageScene[]
  shown: StageSceneId
  /** The time of day the visitor chose; each tile previews its scene at it. */
  light: StageLightId
  onPick: (id: StageSceneId) => void
  onLight: (id: StageLightId) => void
  variant: Variant
}) {
  const t = useT()
  const current = scenes.find((s) => s.id === shown)
  const shownLight = current ? sceneLight(current, light) : null
  return (
    <div className={variant === 'row' ? 'space-y-1.5' : 'space-y-3'}>
      <div
        role="group"
        aria-label={t('stage.tabs.scenes')}
        className={variant === 'row' ? 'flex gap-2 overflow-x-auto px-3 pb-1' : 'grid grid-cols-3 gap-1.5'}
      >
        {scenes.map((s) => {
          const preview = sceneLight(s, light)
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === shown}
              onClick={() => onPick(s.id)}
              className={
                'relative flex-none cursor-pointer overflow-hidden rounded-lg border bg-bg-primary transition-colors ' +
                (s.id === shown ? 'border-accent-cyan ' : 'border-white/15 hover:border-white/40 ') +
                (variant === 'row' ? 'h-[56px] w-[100px]' : 'aspect-video w-full')
              }
            >
              {preview ? (
                <img src={preview.thumb} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
              ) : null}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 to-transparent px-1 pt-3 pb-0.5 text-center text-[11px] text-white">
                {t(`stage.scenes.${s.id}`)}
              </span>
            </button>
          )
        })}
      </div>
      {current && current.lights.length > 1 ? (
        <div
          role="group"
          aria-label={t('stage.lightsAriaLabel')}
          className={variant === 'row' ? 'flex gap-2 overflow-x-auto px-3 pb-1' : 'flex flex-wrap gap-2'}
        >
          {current.lights.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={l.id === shownLight?.id}
              onClick={() => onLight(l.id)}
              className={CHIP + ' flex-none !px-3 !py-1.5 !text-[12px]'}
            >
              {t(`stage.lights.${l.id}`)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
