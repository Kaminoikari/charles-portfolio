// Which bodies she ships in, and which one a first-time visitor gets.
//
// A VRM bakes the body, face, hair and clothes into one file: swapping a skirt
// for trousers is different geometry, not a different texture, so there is no
// runtime dressing room. What there is instead is several exports of the SAME
// rig — one per outfit or face — and the choice of which file to load. This
// module declares those files. The visitor's pick lives in avatarVariantChoice
// (URL, remembered choice, default), the strip that offers them is LookStrip,
// and the engine swaps bodies through AvatarGuideHandle.loadVariant.
//
// WHY THE RIG MATTERS. Same family ⇒ the clearance is shared; new family ⇒ it
// has to be measured again. A family is a set of bodies whose humanoid rest
// pose hashes the same (rigOf), and the clips' clearance numbers
// (src/components/chat/clearance/) are absolute world-space distances measured
// on ONE body of one family. A body whose bones moved is a different body
// wearing those numbers, and the first thing anyone sees is a hand through a
// face. So every variant here names its family, and the test holds its rig
// against THAT family's sha — not against whatever the first sibling happens
// to be. The blendshape names are the same kind of promise: expressions and
// lip sync are looked up by name on the loaded model, so a variant missing one
// simply stops making that face, silently. avatarVariants.test.ts holds both
// across everything declared here.
//
// The rig is the humanoid bones' rest transforms and hierarchy, NOT the mesh:
// an outfit IS different geometry on the same bones, which is the whole reason
// a registry exists. Mesh-dependent clearances — a fingertip against the face,
// hair against the top of the frame — are measured per body, not per rig, so a
// candidate file answers two questions before it is declared here:
//
//   scripts/measure-motions.ts <file.vrm>     do the ten clips still fit it
//   ~/vtuber-kit/bin/check_variants.py        do these files share a skeleton
//
// scripts/repaint_vrm.py made the pink one, recipe included.
//
// /avatar/* is served cache-immutable, so any content change MUST arrive under
// a new filename. Renaming is the invalidation.

import type { ClearanceFile } from './clearance'
import { CLEARANCE as VROID_SAMPLE_B } from './clearance/vroid-sample-b'

export type AvatarVariantId = 'pink' | 'milfy' | 'base'

/**
 * A group of bodies that share a humanoid rig, and therefore share one set of
 * measurements.
 *
 * The registry has always assumed exactly one of these — every body was an
 * export of the same VRoid project, so "the clips fit" was a single fact. A
 * second rig makes it a fact per group: the same clip retargeted onto another
 * skeleton reaches somewhere else, and the numbers that say whether it stays
 * in frame have to be re-measured. The family is the unit that owns them.
 */
export type AvatarFamilyId = 'vroid-sample-b'

/**
 * Each family's measurements, as produced and decided in
 * src/components/chat/clearance/.
 *
 * The clearance file already names its own family and the sha of the rig it
 * was measured on, so this map holds the file itself rather than a record that
 * restates them. A second copy of the sha here could disagree with the one the
 * producers wrote, and nothing would say which was right.
 */
export const AVATAR_FAMILIES: Record<AvatarFamilyId, ClearanceFile> = {
  'vroid-sample-b': VROID_SAMPLE_B,
}

export interface AvatarVariant {
  /**
   * Stable id. Doubles as the i18n key under chat.looks (the label a visitor
   * sees) and as the `?mika=` value; the strings type fails to compile for a
   * body declared without a label.
   */
  id: AvatarVariantId
  /** What the owner calls this look. Tooling and evidence only. */
  label: string
  /** Served path. Must be under /avatar/ and end in .vrm. */
  url: string
  /**
   * Whose measurements apply to this body. avatarVariants.test.ts holds the
   * body's own rig sha to the family's, so a file exported from a project with
   * a nudged skeleton cannot inherit numbers that were never measured on it.
   */
  family: AvatarFamilyId
}

// In the order the look strip offers them.
//
// _webp = the same model repacked with EXT_texture_webp textures
// (15.4MB→5.5MB, scripts/compress_vrm_webp.py). WebP support is a safe
// assumption here: the avatar gate already requires WebGL2, which every
// WebP-capable browser generation ships with.
//
// `base` is the untouched VRoid export she shipped with; `pink` is that same
// export with four textures repainted (scripts/repaint_vrm.py) and nothing else
// changed. `milfy` is the Blender rebuild from scripts/avatar/, carrying its
// own hair, crown and outfit on that same skeleton, 11.9MB.
//
// All three are therefore one family. What makes them one is not the bone
// COUNT — two skeletons can both have 54 bones and rest in different places —
// but that rigOf() hashes the same for all three, which is the humanoid map
// plus every bone's rest transform and parent. The pipeline stopped requiring
// a particular count in Phase 3; the gate is now "the same bones, where this
// family's measurements say they are".
//
// `milfy` was kept off the public site until 2026-09-03 as a reverse-engineered
// replica (the .gitignore block records both that decision and its reversal).
// What settled it is what the pipeline reads: `scripts/avatar/make.py` takes the
// pixiv VRoid sample plus 18 reference IMAGES, and no model file of the original
// is an input anywhere, so nothing in the shipped file can be turned back into
// the original's mesh, weights or textures.
//
// Licence is unchanged by it: every body here descends from the pixiv VRoid
// sample, whose terms allow any use including commercial, need no attribution,
// and forbid only redistributing the model file FOR A FEE. All three are served
// free.
export const AVATAR_VARIANTS: readonly AvatarVariant[] = [
  { id: 'pink', label: '粉髮藍眼', url: '/avatar/mika-pink.vrm', family: 'vroid-sample-b' },
  { id: 'milfy', label: 'Milfy 復刻', url: '/avatar/mika-milfy-12.vrm', family: 'vroid-sample-b' },
  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm', family: 'vroid-sample-b' },
]

/**
 * The body a visitor gets when they have not picked one.
 *
 * A constant rather than "the first entry", so reordering the strip cannot
 * change the default by accident. The visitor's own pick, and a `?mika=` link,
 * override it — see avatarVariantChoice.
 */
export const ACTIVE_VARIANT: AvatarVariantId = 'pink'

/** Whether a string from a URL or storage names a declared body. */
export function isVariantId(id: string | null | undefined): id is AvatarVariantId {
  return AVATAR_VARIANTS.some((v) => v.id === id)
}

/**
 * The URL for a variant id, or the default one.
 *
 * Throws on an unknown id rather than falling back to the default. A silent
 * fallback would render the wrong body and look like the swap simply had no
 * effect, which is the single most confusing outcome for someone testing
 * whether their new outfit loads. (Stale ids from a visitor's URL or storage
 * are a different case and are filtered by isVariantId before they get here.)
 */
export function variantUrl(id: string = ACTIVE_VARIANT): string {
  const found = AVATAR_VARIANTS.find((v) => v.id === id)
  if (!found) {
    const known = AVATAR_VARIANTS.map((v) => v.id).join(', ')
    throw new Error(`unknown avatar variant "${id}" (declared: ${known})`)
  }
  return found.url
}

/**
 * Whose measurements apply to a declared body.
 *
 * Throws on an unknown id for the same reason variantUrl does: guessing a
 * family would hand a body another skeleton's clearances, which is the one
 * mistake this whole layer exists to prevent.
 */
export function familyOf(id: string = ACTIVE_VARIANT): AvatarFamilyId {
  const found = AVATAR_VARIANTS.find((v) => v.id === id)
  if (!found) {
    const known = AVATAR_VARIANTS.map((v) => v.id).join(', ')
    throw new Error(`unknown avatar variant "${id}" (declared: ${known})`)
  }
  return found.family
}

/**
 * The same, for code that holds the served URL rather than the id.
 *
 * The engine is that code: it is handed a URL to load and never sees the
 * visitor's pick, so this is how a loaded body finds its own numbers.
 *
 * Null rather than a throw, unlike familyOf. An id comes from this module's own
 * union and can only be wrong by a typo; a URL is a string from anywhere, and
 * scripts/avatar/live-preview.ts exists precisely to load a freshly built body
 * that nothing has declared yet. Guessing a family for it would hand that body
 * another skeleton's clearances, so the answer is "no measurements apply" and
 * the caller decides what that means. What it must never mean is a default.
 */
export function familyOfUrl(url: string): AvatarFamilyId | null {
  return AVATAR_VARIANTS.find((v) => v.url === url)?.family ?? null
}
