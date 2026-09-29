// What the /avatar page offers: its tabs, the expressions, the scenes.
//
// Looks and motions are not declared here. They are the registries the chat
// widget already reads (avatarVariants' offered bodies, the column's clips),
// so a body or a clip added there appears on the page too, and one removed
// there cannot linger here.
import type { EmotionName } from '../chat/avatarMode'
import type { OfferedVariantId } from '../chat/avatarVariants'

export type StageTab = 'looks' | 'motions' | 'expressions' | 'scenes'
export const STAGE_TABS: readonly StageTab[] = ['looks', 'motions', 'expressions', 'scenes']

/**
 * Every face the expressions tab can ask for, in the order it lists them. They
 * are the engine's own emotions (avatarMode.EMOTION_RECIPES), so a tap plays
 * exactly what a chat cue plays.
 */
export const STAGE_EXPRESSIONS: readonly EmotionName[] = [
  'happy',
  'relaxed',
  'nagomi',
  'surprised',
  'excited',
  'sad',
  'angry',
  'pale',
]

/**
 * Expressions a body cannot make, because its file has no expression group for
 * a channel the recipe drives. `excited` is the model's own >< face, the
 * `Extra` group; Gishin's face (Sendagaya Shino's since 2026-09-29) and the
 * glasses look carry none. stageContent.test.ts reads every offered file and
 * holds this map to what the files say, both ways.
 */
export const UNSUPPORTED_EXPRESSIONS: Partial<Record<OfferedVariantId, readonly EmotionName[]>> = {
  gishin: ['excited'],
  studio: ['excited'],
}

export function expressionsFor(id: OfferedVariantId): readonly EmotionName[] {
  const missing = UNSUPPORTED_EXPRESSIONS[id] ?? []
  return STAGE_EXPRESSIONS.filter((e) => !missing.includes(e))
}

/** How long a tapped expression holds before she eases back, in seconds. */
export const EXPRESSION_HOLD_SEC = 4

export type StageSceneId =
  | 'bedroom'
  | 'clubroom'
  | 'hallway'
  | 'library'
  | 'courtyard'
  | 'station'
  | 'festival'
  | 'park'
  | 'onsen'
  | 'shrine'
  | 'beach'
  | 'none'

/**
 * The times of day a backdrop can be painted at. One scene may come in several
 * (the shrine in all four): the same composition relit, so switching between
 * them is a crossfade, not a cut.
 */
export type StageLightId = 'day' | 'sunset' | 'night' | 'night-lit'
export const STAGE_LIGHTS: readonly StageLightId[] = ['day', 'sunset', 'night', 'night-lit']

export interface StageLight {
  id: StageLightId
  /** The backdrop, 1600x900. */
  src: string
  /** Its tile in the picker, 320x180. */
  thumb: string
}

export interface StageScene {
  id: StageSceneId
  /** Empty for `none`, the page's own dark ground. */
  lights: readonly StageLight[]
  /**
   * Horizontal background-position, in percent, for a screen narrower than
   * the picture: a phone held upright shows about a quarter of its width, and
   * this picks the quarter she stands in (a floor, a path), not a wall.
   */
  focusX: number
}

const lit = (scene: StageSceneId, ...ids: StageLightId[]): StageLight[] =>
  ids.map((id) => ({ id, src: `/avatar/scenes/${scene}-${id}.webp`, thumb: `/avatar/scenes/thumbs/${scene}-${id}.webp` }))

/**
 * The backdrops: illustrated VTuber backgrounds the owner supplied on
 * 2026-09-29 (900x506 originals, upscaled to 1600x900 with Lanczos and a light
 * unsharp mask; public/avatar/scenes). Adding one is a file per time of day, a
 * line here and a label in stage.scenes.
 */
export const STAGE_SCENES: readonly StageScene[] = [
  { id: 'bedroom', lights: lit('bedroom', 'day'), focusX: 50 },
  { id: 'clubroom', lights: lit('clubroom', 'day'), focusX: 50 },
  { id: 'hallway', lights: lit('hallway', 'sunset'), focusX: 30 },
  { id: 'library', lights: lit('library', 'night-lit'), focusX: 45 },
  { id: 'courtyard', lights: lit('courtyard', 'day', 'night'), focusX: 50 },
  { id: 'station', lights: lit('station', 'day'), focusX: 45 },
  { id: 'festival', lights: lit('festival', 'day'), focusX: 50 },
  { id: 'park', lights: lit('park', 'day'), focusX: 55 },
  { id: 'onsen', lights: lit('onsen', 'day', 'night'), focusX: 62 },
  { id: 'shrine', lights: lit('shrine', 'day', 'sunset', 'night-lit', 'night'), focusX: 50 },
  { id: 'beach', lights: lit('beach', 'day'), focusX: 45 },
  { id: 'none', lights: [], focusX: 50 },
]

export const DEFAULT_SCENE: StageSceneId = 'bedroom'
export const DEFAULT_LIGHT: StageLightId = 'day'

export function sceneById(id: StageSceneId): StageScene {
  return STAGE_SCENES.find((s) => s.id === id) ?? STAGE_SCENES[0]
}

/**
 * The picture a scene shows for the time of day the visitor last chose: that
 * one where the scene has it, else the scene's first. The choice is kept
 * across scenes, so night stays night from the courtyard to the shrine, and a
 * scene painted only by day shows day without forgetting it.
 */
export function sceneLight(scene: StageScene, wanted: StageLightId): StageLight | null {
  return scene.lights.find((l) => l.id === wanted) ?? scene.lights[0] ?? null
}

/**
 * A CSS filter over her canvas for each time of day, so a figure lit for noon
 * does not glow against a night sky. Her renderer lights her the same way
 * everywhere; this only darkens and warms what it drew.
 */
export const FIGURE_LIGHT: Record<StageLightId, string> = {
  day: 'none',
  sunset: 'sepia(0.22) saturate(1.15) brightness(0.96)',
  night: 'brightness(0.68) saturate(0.8) contrast(1.05)',
  'night-lit': 'brightness(0.85) sepia(0.12) saturate(0.95)',
}

/** Portrait for a look's tile in the character select, rendered off the served body. */
export function lookThumb(id: OfferedVariantId): string {
  return `/avatar/thumbs/${id}.webp`
}
