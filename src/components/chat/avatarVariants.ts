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
// WHY THE RIG MATTERS. Every variant declared here must carry the same humanoid
// rest pose, because that is what lets the ten motion clips be shared. The
// clips' clearance numbers (avatarMotions.ts) are absolute world-space
// distances measured against one body; a variant whose bones moved is a
// different body wearing the same numbers, and the first thing anyone sees is
// a hand through a face. The same goes for the blendshape names: expressions
// and lip sync are looked up by name on the loaded model, so a variant missing
// one simply stops making that face, silently. avatarVariants.test.ts holds
// both of those across everything declared here.
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

export type AvatarVariantId = 'pink' | 'milfy' | 'base'

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
// changed. `milfy` is the Blender rebuild from scripts/avatar/: the same 54
// bones carrying its own hair, crown and outfit, 11.9MB.
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
  { id: 'pink', label: '粉髮藍眼', url: '/avatar/mika-pink.vrm' },
  { id: 'milfy', label: 'Milfy 復刻', url: '/avatar/mika-milfy-7.vrm' },
  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm' },
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
