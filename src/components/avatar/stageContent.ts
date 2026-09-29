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

export type StageSceneId = 'none' | 'night-room' | 'idol-stage' | 'sunset-rooftop'

export interface StageScene {
  id: StageSceneId
  /** Served image, or null for the page's own dark ground. */
  src: string | null
}

/**
 * The backdrops. The three pictures are original placeholders drawn for the
 * first version (public/avatar/scenes/*.svg), standing in until VTuber
 * backgrounds the owner picks and holds a licence for replace them: a scene is
 * an id, a label (stage.scenes.*) and one image, so replacing one is a file
 * and a line.
 */
export const STAGE_SCENES: readonly StageScene[] = [
  { id: 'night-room', src: '/avatar/scenes/night-room.svg' },
  { id: 'idol-stage', src: '/avatar/scenes/idol-stage.svg' },
  { id: 'sunset-rooftop', src: '/avatar/scenes/sunset-rooftop.svg' },
  { id: 'none', src: null },
]

export const DEFAULT_SCENE: StageSceneId = 'night-room'

/** Portrait for a look's tile in the character select, rendered off the served body. */
export function lookThumb(id: OfferedVariantId): string {
  return `/avatar/thumbs/${id}.webp`
}
