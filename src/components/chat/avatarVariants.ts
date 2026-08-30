// Which body is on screen, and which appearances that body ships in.
//
// A VRM bakes the body, face, hair and clothes into one file: swapping a skirt
// for trousers is different geometry, not a different texture, so there is no
// runtime dressing room. What there is instead is several exports of the SAME
// VRoid project with the body sliders untouched — one per outfit or face — and
// the choice of which file to load.
//
// That choice used to be a constant in AvatarGuide, which made "one body, many
// appearances" a thing the pipeline could support and the product could not do.
// This module is the choice, and nothing more: no picker, no menu, no settings.
// A kit owner declares their exports here and sets ACTIVE_VARIANT.
//
// WHY THE SKELETON MATTERS. Every variant declared here must be the same
// skeleton, because that is what lets the ten motion clips be shared. The clips'
// clearance numbers (avatarMotions.ts) are absolute world-space distances
// measured against one body; a variant whose bones moved is a different body
// wearing the same numbers, and the first thing anyone sees is a hand through a
// face. The same goes for the blendshape names: expressions and lip sync are
// looked up by name on the loaded model, so a variant missing one simply stops
// making that face, silently. avatarVariants.test.ts holds both of those across
// everything declared here.
//
// For a candidate file that is not declared yet, two tools answer it without a
// browser:
//
//   ~/vtuber-kit/bin/check_variants.py        do these files share a skeleton
//   scripts/measure-motions.ts <file.vrm>     do the ten clips still fit it
//
// scripts/repaint_vrm.py is what made the pink one, recipe included.
//
// /avatar/* is served cache-immutable, so any content change MUST arrive under
// a new filename. Renaming is the invalidation.

export interface AvatarVariant {
  /** Stable id. Used in evidence and tooling output, never shown to a visitor. */
  id: string
  /** What a person would call this look. */
  label: string
  /** Served path. Must be under /avatar/ and end in .vrm. */
  url: string
}

// _webp = the same model repacked with EXT_texture_webp textures
// (15.4MB→5.5MB, scripts/compress_vrm_webp.py). WebP support is a safe
// assumption here: the avatar gate already requires WebGL2, which every
// WebP-capable browser generation ships with.
//
// Two bases, both kept on purpose. `base` is the untouched VRoid export she
// shipped with; `pink` is that same export with four textures repainted
// (scripts/repaint_vrm.py) and nothing else changed — same file, same skeleton,
// same blendshape names, so every motion clip and every expression that works
// on one works on the other. Either is a starting point for the next look.
export const AVATAR_VARIANTS: readonly AvatarVariant[] = [
  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm' },
  { id: 'pink', label: '粉髮藍眼', url: '/avatar/mika-pink.vrm' },
]

/**
 * The variant the site renders.
 *
 * Changing this line changes the body on screen. It is deliberately a constant
 * rather than a runtime setting: a picker is product shell, and the thing the
 * kit needs is that swapping the file is one edit rather than a code change in
 * the component that draws her.
 */
export const ACTIVE_VARIANT = 'pink'

/**
 * The URL for a variant id, or the active one.
 *
 * Throws on an unknown id rather than falling back to the default. A silent
 * fallback would render the wrong body and look like the swap simply had no
 * effect, which is the single most confusing outcome for someone testing
 * whether their new outfit loads.
 */
export function variantUrl(id: string = ACTIVE_VARIANT): string {
  const found = AVATAR_VARIANTS.find((v) => v.id === id)
  if (!found) {
    const known = AVATAR_VARIANTS.map((v) => v.id).join(', ')
    throw new Error(`unknown avatar variant "${id}" (declared: ${known})`)
  }
  return found.url
}
