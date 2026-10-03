// /avatar: Mika on a stage of her own, every look, her moves, her expressions
// and a backdrop.
//
// Two layouts, agreed with the owner on 2026-09-29 (stageLayout.ts):
//   phone   A, the stage HUD: she fills the screen and a dock at the bottom
//           switches looks, motions, expressions and scenes in tabs.
//   desktop B, a character select: the roster on the left, motions,
//           expressions and scenes on the right, all in view at once, and her
//           standing between them on the stage.
//
// The figure is the chat widget's own engine (AvatarGuide over
// avatarGuideEngine) in the `stage` placement: the canvas fills the page, the
// controls float over it. On a phone hudFraming() sizes her head to the
// owner's reference; in the character select stageFraming() puts her
// head-to-toe in the band the panels leave free. Nothing about her is re-implemented here; this page decides
// only what is offered and where it sits.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AvatarGuide from '../chat/AvatarGuide'
import { SceneClip } from './SceneClip'
import type { AvatarGuideHandle } from '../chat/avatarGuideEngine'
import { AVATAR_FOV, avatarGuideEnabledInBrowser, type EmotionName } from '../chat/avatarMode'
import { motionsFor, type AvatarMotionName } from '../chat/avatarMotions'
import {
  ACTIVE_VARIANT,
  OFFERED_VARIANTS,
  familyOf,
  isVariantId,
  variantUrl,
  type OfferedVariantId,
} from '../chat/avatarVariants'
import { initialVariantId, rememberVariant } from '../chat/avatarVariantChoice'
import { useDocumentMeta } from '../../i18n/useDocumentMeta'
import { useT } from '../../i18n/useT'
import { HudDock } from './HudDock'
import { ExpressionPicker, LookPicker, MotionPicker, ScenePicker } from './StageControls'
import {
  DEFAULT_LIGHT,
  DEFAULT_SCENE,
  EXPRESSION_HOLD_SEC,
  FIGURE_LIGHT,
  STAGE_SCENES,
  expressionsFor,
  sceneById,
  sceneLight,
  type StageLightId,
  type StageSceneId,
  type StageTab,
} from './stageContent'
import {
  HUD_DOCK_H,
  STAGE_PATH,
  backdropBox,
  horizonRow,
  hudFraming,
  stageFraming,
  stageLayout,
  type BackdropBox,
} from './stageLayout'

/** Widths of the character select's two panels, px. */
const ROSTER_W = 380
const OPTIONS_W = 300
/** Gaps between her and whatever floats over the canvas, px. */
const AIR = 12

type Gate = 'on' | 'reduced' | 'nogl'

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [view, setView] = useState(read)
  useEffect(() => {
    const on = () => setView(read())
    window.addEventListener('resize', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.visualViewport?.removeEventListener('resize', on)
    }
  }, [])
  return view
}

/** Height of the site's fixed nav, which floats over the top of the stage. */
function useNavHeight(viewportWidth: number) {
  const [h, setH] = useState(72)
  useEffect(() => {
    const nav = document.querySelector('nav')
    if (!nav) return
    const measure = () => setH(nav.getBoundingClientRect().height)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [viewportWidth])
  return h
}

export default function AvatarStagePage() {
  const t = useT()
  useDocumentMeta({ titleKey: 'stage.metaTitle', descriptionKey: 'stage.metaDescription', path: STAGE_PATH })

  // Same capability gate as the widget, with one difference: this page exists
  // to show her, so a visitor who asked their device to reduce motion is told
  // why she is not playing and may start her anyway. No WebGL 2 is final.
  const [gate, setGate] = useState<Gate>(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'reduced'
    return avatarGuideEnabledInBrowser() ? 'on' : 'nogl'
  })

  const view = useViewport()
  const navH = useNavHeight(view.w)
  const layout = stageLayout(view.w)

  const initial = useMemo<OfferedVariantId>(() => {
    const id = initialVariantId()
    return isVariantId(id) ? id : ACTIVE_VARIANT
  }, [])
  // `wanted` is what the canvas is asked to show; `shown` is what it shows.
  // They differ while a look loads, and a failed load puts `wanted` back.
  const [wanted, setWanted] = useState<OfferedVariantId>(initial)
  const [shown, setShown] = useState<OfferedVariantId>(initial)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const pending = wanted !== shown ? wanted : null
  const busy = !loaded || pending !== null
  const family = familyOf(shown)

  const handleRef = useRef<AvatarGuideHandle | null>(null)
  const onHandle = useCallback((h: AvatarGuideHandle | null) => {
    handleRef.current = h
  }, [])

  // Clips download in the background after the body; a clip still in flight
  // is listed but not tappable, as in the widget's strip.
  const motions = motionsFor('column', family)
  const [ready, setReady] = useState<readonly AvatarMotionName[]>([])
  useEffect(() => {
    const tick = () => {
      const next = handleRef.current?.readyMotions('column') ?? []
      setReady((prev) => (prev.length === next.length ? prev : next))
    }
    tick()
    const id = window.setInterval(tick, 600)
    return () => window.clearInterval(id)
  }, [shown])

  const expressions = expressionsFor(shown)
  const [activeExpr, setActiveExpr] = useState<EmotionName | null>(null)
  const exprTimer = useRef<number | undefined>(undefined)
  const playExpression = (name: EmotionName) => {
    handleRef.current?.setEmotion(name, 1, EXPRESSION_HOLD_SEC)
    setActiveExpr(name)
    window.clearTimeout(exprTimer.current)
    exprTimer.current = window.setTimeout(() => setActiveExpr(null), EXPRESSION_HOLD_SEC * 1000)
  }
  useEffect(() => () => window.clearTimeout(exprTimer.current), [])

  const playMotion = (name: AvatarMotionName) => {
    handleRef.current?.playMotion(name)
  }

  const pickLook = (id: OfferedVariantId) => {
    setFailed(false)
    setActiveExpr(null)
    setWanted(id)
  }
  const onVariantSettled = useCallback(
    (url: string, ok: boolean) => {
      if (url !== variantUrl(wanted)) return
      if (ok) {
        setShown(wanted)
        rememberVariant(wanted)
      } else {
        setWanted(shown)
        setFailed(true)
      }
    },
    [wanted, shown],
  )

  const [scene, setScene] = useState<StageSceneId>(DEFAULT_SCENE)
  const [lightPref, setLightPref] = useState<StageLightId>(DEFAULT_LIGHT)
  // Every scene shown so far keeps its pictures mounted under the current one,
  // so going back to it, or relighting it, is a crossfade rather than a load.
  const [visited, setVisited] = useState<readonly StageSceneId[]>([DEFAULT_SCENE])
  const light = sceneLight(sceneById(scene), lightPref)
  const pickScene = (id: StageSceneId) => {
    setScene(id)
    setVisited((v) => (v.includes(id) ? v : [...v, id]))
  }
  const [tab, setTab] = useState<StageTab>('looks')
  // The dock covers her legs at the reference framing; a visitor can put it away.
  const [dockHidden, setDockHidden] = useState(false)

  // Phones frame her at the reference's size, legs running on under the dock;
  // the character select fits her whole between the panels.
  const framing =
    layout === 'hud'
      ? hudFraming(view.h, family)
      : stageFraming(
          {
            w: view.w,
            h: view.h,
            top: navH + AIR,
            bottom: view.h - 2 * AIR,
            width: view.w - ROSTER_W - OPTIONS_W - 4 * AIR,
          },
          family,
        )
  // Where her soles meet the floor, in canvas pixels, for the contact shadow
  // that sets her on the painted ground rather than in front of it.
  const pxPerMetre = view.h / (2 * framing.distance * Math.tan((AVATAR_FOV / 2) * (Math.PI / 180)))
  const floorRow = view.h / 2 - (0 - framing.lookAtY) * pxPerMetre
  // Each backdrop's eye level goes on the camera's horizon (backdropBox), and
  // reaches down to the dock on a phone.
  const eyeRow = horizonRow(framing, view.h)
  const backdropFloor = layout === 'hud' ? view.h - HUD_DOCK_H : view.h

  const looks = OFFERED_VARIANTS.map((v) => ({ id: v.id, url: v.url }))

  const pickers = (variant: 'row' | 'grid') => ({
    looks: <LookPicker looks={looks} shown={shown} pending={pending} busy={busy} onPick={pickLook} variant={variant} />,
    motions: <MotionPicker motions={motions} ready={ready} onPlay={playMotion} variant={variant} />,
    expressions: (
      <ExpressionPicker
        expressions={expressions}
        active={activeExpr}
        disabled={busy}
        onPick={playExpression}
        variant={variant}
      />
    ),
    scenes: (
      <ScenePicker
        scenes={STAGE_SCENES}
        shown={scene}
        light={lightPref}
        onPick={pickScene}
        onLight={setLightPref}
        variant={variant}
      />
    ),
  })

  return (
    <main className="fixed inset-0 overflow-hidden bg-bg-primary text-white">
      <h1 className="sr-only">{t('stage.metaTitle')}</h1>

      {/* The backdrop, then her, then the controls over both. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 85%, #1c1f2b 0%, var(--color-bg-primary) 70%)' }}
      />
      {visited.flatMap((id) => {
        const { lights, focusX, horizon } = sceneById(id)
        const box = backdropBox(view, eyeRow, horizon, backdropFloor)
        return lights.map((l) => (
          <SceneLayer key={l.src} poster={l.src} focusX={focusX} on={l.src === light?.src} box={box} viewH={view.h}>
            {l.video ? (
              <SceneClip poster={l.src} video={l.video} focusX={focusX} on={l.src === light?.src} />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-cover"
                style={{ backgroundImage: `url(${l.src})`, backgroundPosition: `${focusX}% 70%` }}
              />
            )}
          </SceneLayer>
        ))
      })}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/25" />

      {gate === 'on' && loaded && light ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
          style={{
            left: view.w / 2,
            top: floorRow,
            width: 0.62 * pxPerMetre,
            height: 0.1 * pxPerMetre,
            background: 'radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0.22) 55%, transparent)',
          }}
        />
      ) : null}
      {gate === 'on' ? (
        <div
          className="absolute inset-0 transition-[filter] duration-700"
          style={{ filter: FIGURE_LIGHT[light?.id ?? 'day'] }}
        >
          <AvatarGuide
            mode="idle"
            vrmUrl={variantUrl(wanted)}
            placement="stage"
            framing={framing}
            sizeClass=""
            sizeStyle={{ width: view.w, height: view.h }}
            fade={false}
            onHandle={onHandle}
            onLoaded={() => setLoaded(true)}
            onLoadFailed={() => setFailed(true)}
            onVariantSettled={onVariantSettled}
          />
        </div>
      ) : null}

      {gate === 'on' && !loaded && !failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-3 rounded-full bg-black/50 px-4 py-2 font-mono text-[12px] tracking-wider text-white/80">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-accent-cyan" />
            {t('stage.loading')}
          </span>
        </div>
      ) : null}

      {gate === 'reduced' || gate === 'nogl' ? (
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-sm rounded-xl border border-white/10 bg-black/60 p-5 text-center text-[14px] text-white/85 backdrop-blur-md">
            <p>{gate === 'nogl' ? t('stage.noWebgl') : t('stage.reducedMotion')}</p>
            {gate === 'reduced' ? (
              <button
                type="button"
                onClick={() => setGate(hasWebgl2() ? 'on' : 'nogl')}
                className="mt-4 cursor-pointer rounded-full border border-accent-cyan px-4 py-2 text-[13px] text-accent-cyan hover:bg-accent-cyan/10"
              >
                {t('stage.showAnyway')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {failed ? (
        <div role="status" className="absolute inset-x-0 flex justify-center px-4" style={{ top: navH + AIR }}>
          <span className="rounded-full bg-black/70 px-4 py-2 text-[13px] text-white/90">{t('stage.loadFailed')}</span>
        </div>
      ) : null}

      {layout === 'hud' ? (
        <HudDock tab={tab} onTab={setTab} pickers={pickers('row')} hidden={dockHidden} onHidden={setDockHidden} />
      ) : (
        <SelectPanels
          navH={navH}
          shownName={t(`chat.looks.${shown}`)}
          pickers={pickers('grid')}
        />
      )}
    </main>
  )
}

/**
 * One backdrop, drawn in its box (stageLayout.backdropBox) so its eye level
 * sits on the camera's horizon. Where the box stops short of the screen's
 * bottom, the same picture blurred and dimmed fills in under it and the
 * picture's lower edge fades into that.
 */
function SceneLayer({
  poster,
  focusX,
  on,
  box,
  viewH,
  children,
}: {
  poster: string
  focusX: number
  on: boolean
  box: BackdropBox
  viewH: number
  children: React.ReactNode
}) {
  const short = box.top + box.height < viewH - 0.5
  const fade = short ? 'linear-gradient(to top, transparent, #000 12%)' : undefined
  return (
    <div aria-hidden="true" className="absolute inset-0 transition-opacity duration-700" style={{ opacity: on ? 1 : 0 }}>
      {short ? (
        <div
          className="absolute inset-0 scale-110 bg-cover"
          style={{ backgroundImage: `url(${poster})`, backgroundPosition: `${focusX}% 100%`, filter: 'blur(24px) brightness(0.7)' }}
        />
      ) : null}
      <div className="absolute inset-x-0" style={{ top: box.top, height: box.height, maskImage: fade, WebkitMaskImage: fade }}>
        {children}
      </div>
    </div>
  )
}

// Layout B. The roster on the left, every other option on the right, her name
// under her feet. Either panel slides off its own edge on its tab, so a
// visitor can clear the stage around her; the tab stays on screen to bring it
// back.
function SelectPanels({
  navH,
  shownName,
  pickers,
}: {
  navH: number
  shownName: string
  pickers: Record<StageTab, React.ReactNode>
}) {
  const t = useT()
  const [rosterHidden, setRosterHidden] = useState(false)
  const [optionsHidden, setOptionsHidden] = useState(false)
  const panel =
    'absolute bottom-6 overflow-y-auto rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-md transition-transform duration-300 ease-out'
  const heading = 'mb-2 font-mono text-[11px] uppercase tracking-[2px] text-white/55'
  // Out past its own margin (24px) and far enough that its shadow is gone too.
  const away = (w: number) => w + 32
  const tabBtn =
    'absolute flex h-14 w-7 cursor-pointer items-center justify-center rounded-lg border border-white/15 bg-black/55 text-white/70 backdrop-blur-md transition-[transform,color] duration-300 ease-out hover:text-white'
  return (
    <>
      <section
        id="stage-roster"
        className={panel + ' left-6'}
        style={{ top: navH + 16, width: ROSTER_W, transform: `translateX(${rosterHidden ? -away(ROSTER_W) : 0}px)` }}
        aria-label={t('chat.looksAriaLabel')}
        aria-hidden={rosterHidden}
        inert={rosterHidden}
      >
        <h2 className="mb-4 font-mono text-[13px] tracking-[3px] text-white">
          <span className="text-accent-mars">▍</span>
          {t('stage.selectTitle')}
        </h2>
        {pickers.looks}
      </section>
      <button
        type="button"
        aria-controls="stage-roster"
        aria-expanded={!rosterHidden}
        aria-label={t(rosterHidden ? 'stage.showRoster' : 'stage.hideRoster')}
        onClick={() => setRosterHidden((h) => !h)}
        className={tabBtn}
        style={{ top: navH + 32, left: 24 + ROSTER_W + 8, transform: `translateX(${rosterHidden ? -away(ROSTER_W) + 8 : 0}px)` }}
      >
        <Arrow left={!rosterHidden} />
      </button>

      <section
        id="stage-options"
        className={panel + ' right-6 space-y-4'}
        style={{ top: navH + 16, width: OPTIONS_W, transform: `translateX(${optionsHidden ? away(OPTIONS_W) : 0}px)` }}
        aria-label={t('stage.tabsAriaLabel')}
        aria-hidden={optionsHidden}
        inert={optionsHidden}
      >
        <div>
          <h2 className={heading}>{t('stage.tabs.motions')}</h2>
          {pickers.motions}
        </div>
        <div>
          <h2 className={heading}>{t('stage.tabs.expressions')}</h2>
          {pickers.expressions}
        </div>
        <div>
          <h2 className={heading}>{t('stage.tabs.scenes')}</h2>
          {pickers.scenes}
        </div>
      </section>
      <button
        type="button"
        aria-controls="stage-options"
        aria-expanded={!optionsHidden}
        aria-label={t(optionsHidden ? 'stage.showOptions' : 'stage.hideOptions')}
        onClick={() => setOptionsHidden((h) => !h)}
        className={tabBtn}
        style={{ top: navH + 32, right: 24 + OPTIONS_W + 8, transform: `translateX(${optionsHidden ? away(OPTIONS_W) - 8 : 0}px)` }}
      >
        <Arrow left={optionsHidden} />
      </button>

      {/* Her name at the stage's bottom-left corner, clear of her feet. */}
      <div
        className="pointer-events-none absolute bottom-6 transition-[left] duration-300 ease-out"
        style={{ left: rosterHidden ? 24 : ROSTER_W + 48 }}
      >
        <div className="flex flex-col items-start">
          <span className="font-mono text-[10px] uppercase tracking-[3px] text-accent-cyan">{t('stage.selectedLabel')}</span>
          <span className="mt-1 border-b-2 border-accent-mars pr-4 pb-1 text-[28px] font-bold tracking-[4px] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)]">
            {shownName.toUpperCase()}
          </span>
        </div>
      </div>
    </>
  )
}

function Arrow({ left }: { left: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d={left ? 'M12.5 5 7.5 10l5 5' : 'M7.5 5l5 5-5 5'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function hasWebgl2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}
