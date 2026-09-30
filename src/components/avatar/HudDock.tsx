// Layout A's dock: a tab row over one picker row, glass over the stage, under
// a thumb. At the reference framing it covers her from the thighs down, so it
// can be put away: a chevron at the end of the tab row slides it off the
// bottom edge, and a small button left in the corner brings it back. Hidden,
// it stays mounted (the slide is the animation) but inert, so its buttons
// leave the tab order and the accessibility tree.
import { useT } from '../../i18n/useT'
import { STAGE_TABS, type StageTab } from './stageContent'

function Chevron({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={up ? 'M5 12.5 10 7.5l5 5' : 'M5 7.5 10 12.5l5-5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function HudDock({
  tab,
  onTab,
  pickers,
  hidden,
  onHidden,
}: {
  tab: StageTab
  onTab: (tab: StageTab) => void
  pickers: Record<StageTab, React.ReactNode>
  hidden: boolean
  onHidden: (hidden: boolean) => void
}) {
  const t = useT()
  return (
    <>
      <div
        data-testid="stage-dock"
        inert={hidden}
        className={
          'absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/55 pt-2 backdrop-blur-md ' +
          'transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none ' +
          (hidden ? 'translate-y-full' : 'translate-y-0')
        }
        style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-3 mb-2 flex items-center gap-2">
          <div role="tablist" aria-label={t('stage.tabsAriaLabel')} className="grid flex-1 grid-cols-4 gap-1 rounded-full bg-white/5 p-1">
            {STAGE_TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`stage-tab-${id}`}
                aria-selected={tab === id}
                aria-controls="stage-tabpanel"
                onClick={() => onTab(id)}
                className={
                  'min-h-[36px] cursor-pointer rounded-full text-[13px] transition-colors ' +
                  (tab === id ? 'bg-white/15 text-white' : 'text-white/55 hover:text-white')
                }
              >
                {t(`stage.tabs.${id}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={t('stage.hideControls')}
            onClick={() => onHidden(true)}
            className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-full bg-white/5 text-white/70 transition-colors hover:text-white"
          >
            <Chevron up={false} />
          </button>
        </div>
        <div id="stage-tabpanel" role="tabpanel" aria-labelledby={`stage-tab-${tab}`} className="flex min-h-[96px] items-center">
          <div className="w-full">{pickers[tab]}</div>
        </div>
      </div>

      {hidden ? (
        <button
          type="button"
          aria-label={t('stage.showControls')}
          onClick={() => onHidden(false)}
          className="absolute right-3 flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-4 text-[13px] text-white/85 backdrop-blur-md transition-colors hover:text-white"
          style={{ bottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <Chevron up />
          {t('stage.controlsLabel')}
        </button>
      ) : null}
    </>
  )
}
