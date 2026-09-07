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
import { CLEARANCE as VRM1_TWIST_SAMPLE } from './clearance/vrm1-twist-sample'

/**
 * A body the look strip offers and a visitor may choose.
 *
 * Kept apart from the ids below so that chat.looks needs a label for exactly
 * these and no others: a body can be declared here, measured, and held to its
 * family's rig without being put in front of anyone.
 */
export type OfferedVariantId = 'pink' | 'milfy' | 'base'

/**
 * Every body this module declares, offered or not.
 *
 * The second kind arrived on 2026-09-07 with the second rig family. Mika is the
 * character this site has; what a second family buys is that "the clips fit"
 * stops being one global fact and becomes a fact per rig, with the guards to
 * prove it. The body that proves it does not have to be a look.
 */
export type AvatarVariantId = OfferedVariantId | 'twist'

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
export type AvatarFamilyId = 'vroid-sample-b' | 'vrm1-twist-sample'

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
  'vrm1-twist-sample': VRM1_TWIST_SAMPLE,
}

/**
 * A family's measurements by id, or null for an id nothing declares.
 *
 * For tooling that is handed a family NAME rather than one of the ids above:
 * scripts/avatar/springsim.ts --family=<new> runs before that family has a
 * clearance file at all, and its first pass has to mean "no pans yet" rather
 * than fail to compile. Null rather than a throw, and never a default, for the
 * same reason familyOfUrl is: guessing a family hands a body another
 * skeleton's numbers.
 */
export function familyClearance(id: string): ClearanceFile | null {
  return (AVATAR_FAMILIES as Record<string, ClearanceFile>)[id] ?? null
}

interface DeclaredBody {
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

/**
 * A declared body, and whether a visitor is offered it.
 *
 * A union rather than a boolean field so the two halves cannot drift: an
 * offered body's id is an OfferedVariantId, which is the key chat.looks is
 * typed by, so declaring one without a label in all three locales fails to
 * compile. An unoffered body has no label to miss.
 */
export type AvatarVariant =
  | (DeclaredBody & {
      /**
       * Stable id. Doubles as the i18n key under chat.looks (the label a
       * visitor sees) and as the `?mika=` value.
       */
      id: OfferedVariantId
      offered: true
    })
  | (DeclaredBody & { id: Exclude<AvatarVariantId, OfferedVariantId>; offered: false })

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
  { id: 'pink', label: '粉髮藍眼', url: '/avatar/mika-pink.vrm', family: 'vroid-sample-b', offered: true },
  { id: 'milfy', label: 'Milfy 復刻', url: '/avatar/mika-milfy-12.vrm', family: 'vroid-sample-b', offered: true },
  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm', family: 'vroid-sample-b', offered: true },
  // The second family, and the first body here that is not an export of the
  // VRoid project the other three descend from: pixiv's VRM 1.0 constraint
  // sample, 54 humanoid bones of which 28 rest somewhere the VRoid family's do
  // not, so rigOf hashes differently and every clearance number had to be
  // measured again. Provenance and licence in
  // docs/plans/avatar-family-vrm1-twist-sample.md; its own metadata says credit
  // is unnecessary, so serving it carries no obligation.
  //
  // NOT offered. It is a different character, and this site has one. What it is
  // for is that motionPan, crownBound, panFor and the 70 guards of
  // rigProbe.test.ts's `bundled motions` block now run against a rig that is
  // not the one they were written against, which is the only way to tell a
  // generalised layer from one that happens to work on the body it grew up on.
  //
  // Two things it does NOT exercise, said here rather than assumed: `motionsFor`
  // is never called with this family (nothing offers the body, so no runtime
  // path reaches it, and the picker tests run on the first family's id), and
  // the other 54 tests in that file sit outside the per-family block and still
  // read AvatarSample_B only.
  { id: 'twist', label: 'VRM1 樣本（不對外）', url: '/avatar/vrm1-twist-sample.vrm', family: 'vrm1-twist-sample', offered: false },
]

/**
 * The bodies the look strip shows, in the order it shows them.
 *
 * Everything visitor-facing reads this; AVATAR_VARIANTS is for the tests, the
 * registry's own consistency, and anything that has to answer "whose numbers
 * apply to this URL" for a body nobody is offered.
 */
export const OFFERED_VARIANTS: readonly (AvatarVariant & { offered: true })[] =
  AVATAR_VARIANTS.filter((v): v is AvatarVariant & { offered: true } => v.offered)

/**
 * The body a visitor gets when they have not picked one.
 *
 * A constant rather than "the first entry", so reordering the strip cannot
 * change the default by accident. The visitor's own pick, and a `?mika=` link,
 * override it — see avatarVariantChoice.
 */
// Typed as an OFFERED id: the body a first-time visitor gets has to be one the
// look strip would let them choose again.
export const ACTIVE_VARIANT: OfferedVariantId = 'pink'

/**
 * Whether a string from a URL or storage names a body a visitor may choose.
 *
 * OFFERED, not merely declared: `?mika=twist` names a real file with real
 * measurements, and it still has to be refused, because the answer to "which
 * bodies does this site offer" is the look strip and nothing else.
 */
export function isVariantId(id: string | null | undefined): id is OfferedVariantId {
  return OFFERED_VARIANTS.some((v) => v.id === id)
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
