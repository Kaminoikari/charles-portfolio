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
  | 'old-house'
  | 'classroom'
  | 'sakura-station'
  | 'crossing'
  | 'bus-stop'
  | 'overpass'
  | 'rain-rails'
  | 'city-street'
  | 'backstreet'
  | 'lantern-street'
  | 'riverside'
  | 'lofi-house'
  | 'veranda'
  | 'sakura-palace'
  | 'seaside-cafe'
  | 'forest-torii'
  | 'lake-torii'
  | 'fuji-torii'
  | 'moon-torii'
  | 'milky-way'
  | 'tatami-room'
  | 'dormitory'
  | 'hot-spring'
  | 'moon-beach'
  | 'beach-shop'
  | 'blue-cafe'
  | 'library'
  | 'none'

/**
 * The times of day a backdrop can be painted at. A scene may come in several,
 * the same composition relit, so switching between them is a crossfade, not a
 * cut. None does since the clips replaced the stills (2026-09-30); a clip's
 * time of day sets the filter over her.
 */
export type StageLightId = 'day' | 'sunset' | 'night' | 'night-lit'
export const STAGE_LIGHTS: readonly StageLightId[] = ['day', 'sunset', 'night', 'night-lit']

export interface StageLight {
  id: StageLightId
  /** The backdrop, 1600x900; for a moving scene, its first frame, shown until the clip plays. */
  src: string
  /** Its tile in the picker, 320x180. */
  thumb: string
  /** A moving scene's clip: 1920x1080, 30fps, H.264, no sound, looping. */
  video?: string
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

/** A moving scene: one clip, lit at one time of day. */
const clip = (scene: StageSceneId, light: StageLightId): StageLight[] => [
  {
    id: light,
    src: `/avatar/scenes/${scene}-${light}.webp`,
    thumb: `/avatar/scenes/thumbs/${scene}-${light}.webp`,
    video: `/avatar/scenes/video/${scene}.mp4`,
  },
]

/**
 * The backdrops. The moving ones are looping anime wallpapers the owner
 * picked on 2026-09-30 (MoeWalls downloads, 4K and 1080p at 60fps,
 * re-encoded to 1080p at 30fps; public/avatar/scenes/video). The still ones
 * are the illustrated VTuber backgrounds the owner supplied on 2026-09-29
 * (900x506 originals, upscaled to 1600x900 with Lanczos and a light unsharp
 * mask), kept for the library, which no clip covers yet. Adding one is a clip or
 * a picture per time of day, a line here and a label in stage.scenes.
 */
export const STAGE_SCENES: readonly StageScene[] = [
  { id: 'old-house', lights: clip('old-house', 'day'), focusX: 55 },
  { id: 'classroom', lights: clip('classroom', 'sunset'), focusX: 50 },
  { id: 'sakura-station', lights: clip('sakura-station', 'sunset'), focusX: 40 },
  { id: 'crossing', lights: clip('crossing', 'sunset'), focusX: 50 },
  { id: 'bus-stop', lights: clip('bus-stop', 'sunset'), focusX: 45 },
  { id: 'overpass', lights: clip('overpass', 'day'), focusX: 45 },
  { id: 'rain-rails', lights: clip('rain-rails', 'day'), focusX: 50 },
  { id: 'city-street', lights: clip('city-street', 'night'), focusX: 40 },
  { id: 'backstreet', lights: clip('backstreet', 'night'), focusX: 50 },
  { id: 'lantern-street', lights: clip('lantern-street', 'night-lit'), focusX: 50 },
  { id: 'riverside', lights: clip('riverside', 'night-lit'), focusX: 45 },
  { id: 'lofi-house', lights: clip('lofi-house', 'night-lit'), focusX: 50 },
  { id: 'veranda', lights: clip('veranda', 'day'), focusX: 50 },
  { id: 'sakura-palace', lights: clip('sakura-palace', 'day'), focusX: 50 },
  { id: 'seaside-cafe', lights: clip('seaside-cafe', 'day'), focusX: 50 },
  { id: 'forest-torii', lights: clip('forest-torii', 'day'), focusX: 45 },
  { id: 'lake-torii', lights: clip('lake-torii', 'day'), focusX: 65 },
  { id: 'fuji-torii', lights: clip('fuji-torii', 'sunset'), focusX: 60 },
  { id: 'moon-torii', lights: clip('moon-torii', 'night'), focusX: 50 },
  { id: 'milky-way', lights: clip('milky-way', 'night'), focusX: 50 },
  { id: 'tatami-room', lights: clip('tatami-room', 'night-lit'), focusX: 45 },
  { id: 'dormitory', lights: clip('dormitory', 'day'), focusX: 50 },
  { id: 'hot-spring', lights: clip('hot-spring', 'night-lit'), focusX: 55 },
  { id: 'moon-beach', lights: clip('moon-beach', 'night'), focusX: 50 },
  { id: 'beach-shop', lights: clip('beach-shop', 'day'), focusX: 45 },
  { id: 'blue-cafe', lights: clip('blue-cafe', 'day'), focusX: 50 },
  { id: 'library', lights: lit('library', 'night-lit'), focusX: 45 },
  { id: 'none', lights: [], focusX: 50 },
]

export const DEFAULT_SCENE: StageSceneId = 'old-house'
export const DEFAULT_LIGHT: StageLightId = 'day'

export function sceneById(id: StageSceneId): StageScene {
  return STAGE_SCENES.find((s) => s.id === id) ?? STAGE_SCENES[0]
}

/**
 * The picture a scene shows for the time of day the visitor last chose: that
 * one where the scene has it, else the scene's first. The choice is kept
 * across scenes, and a
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
