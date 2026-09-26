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
import { CLEARANCE as VROID_STUDIO_DRESSUP } from './clearance/vroid-studio-dressup'
import { CLEARANCE as VROID_HAIR_FEMALE } from './clearance/vroid-hair-female'
import { CLEARANCE as VROID_HAIR_MALE } from './clearance/vroid-hair-male'
import { CLEARANCE as VROID_SENDAGAYA_SHIBU } from './clearance/vroid-sendagaya-shibu'
import { CLEARANCE as VROID_VICTORIA_RUBIN } from './clearance/vroid-victoria-rubin'
import { CLEARANCE as VROID_VIVI } from './clearance/vroid-vivi'
import { CLEARANCE as VROID_SAMPLE_A } from './clearance/vroid-sample-a'
import { CLEARANCE as VROID_SAMPLE_C } from './clearance/vroid-sample-c'
import { CLEARANCE as VROID_DARKNESS_SHIBU } from './clearance/vroid-darkness-shibu'
import { CLEARANCE as VROID_SAKURADA_FUMIRIYA } from './clearance/vroid-sakurada-fumiriya'
import { CLEARANCE as VROID_SENDAGAYA_SHINO } from './clearance/vroid-sendagaya-shino'
import { CLEARANCE as VROID_VITA } from './clearance/vroid-vita'
import { CLEARANCE as VROID_MIKA_GLASSES } from './clearance/vroid-mika-glasses'
import { CLEARANCE as VROID_ROSA } from './clearance/vroid-rosa'

/**
 * A body the look strip offers and a visitor may choose.
 *
 * Kept apart from the ids below so that chat.looks needs a label for exactly
 * these and no others: a body can be declared here, measured, and held to its
 * family's rig without being put in front of anyone.
 */
export type OfferedVariantId =
  | 'pink'
  | 'milfy'
  | 'base'
  | 'rosa'
  | 'studio'
  | 'hair-female'
  | 'sendagaya-shibu'
  | 'victoria-rubin'
  | 'vivi'
  | 'sample-a'
  | 'darkness-shibu'
  | 'sendagaya-shino'
  | 'vita'

/**
 * Every body this module declares, offered or not.
 *
 * The second kind arrived on 2026-09-07 with the second rig family. Mika is the
 * character this site has; what a second family buys is that "the clips fit"
 * stops being one global fact and becomes a fact per rig, with the guards to
 * prove it. The body that proves it does not have to be a look.
 */
export type AvatarVariantId = OfferedVariantId | 'hair-male' | 'sample-c' | 'sakurada-fumiriya' | 'studio-hoodie' | 'twist'

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
export type AvatarFamilyId =
  | 'vroid-sample-b'
  | 'vrm1-twist-sample'
  | 'vroid-studio-dressup'
  | 'vroid-hair-female'
  | 'vroid-hair-male'
  | 'vroid-sendagaya-shibu'
  | 'vroid-victoria-rubin'
  | 'vroid-vivi'
  | 'vroid-sample-a'
  | 'vroid-sample-c'
  | 'vroid-darkness-shibu'
  | 'vroid-sakurada-fumiriya'
  | 'vroid-sendagaya-shino'
  | 'vroid-vita'
  | 'vroid-mika-glasses'
  | 'vroid-rosa'

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
  'vroid-studio-dressup': VROID_STUDIO_DRESSUP,
  'vroid-hair-female': VROID_HAIR_FEMALE,
  'vroid-hair-male': VROID_HAIR_MALE,
  'vroid-sendagaya-shibu': VROID_SENDAGAYA_SHIBU,
  'vroid-victoria-rubin': VROID_VICTORIA_RUBIN,
  'vroid-vivi': VROID_VIVI,
  'vroid-sample-a': VROID_SAMPLE_A,
  'vroid-sample-c': VROID_SAMPLE_C,
  'vroid-darkness-shibu': VROID_DARKNESS_SHIBU,
  'vroid-sakurada-fumiriya': VROID_SAKURADA_FUMIRIYA,
  'vroid-sendagaya-shino': VROID_SENDAGAYA_SHINO,
  'vroid-vita': VROID_VITA,
  'vroid-mika-glasses': VROID_MIKA_GLASSES,
  'vroid-rosa': VROID_ROSA,
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
  /**
   * Whose texture draws the inside of the mouth: the file's own, or Mika's
   * (MIKA_MOUTH_URL says why seven bodies borrow hers).
   */
  mouth: 'own' | 'mika'
}

/**
 * Mika's mouth texture, lifted byte for byte out of mika-pink-2.vrm.
 *
 * VRoid lays one texture over the inside of the mouth: teeth top-left, tongue
 * top-right, throat below. Mika's, which Milfy and base carry too, paints the
 * tongue quarter small and pale, and an open mouth reads as a plain pale mouth.
 * Seven of the newer samples paint a full-size saturated tongue with a shaded
 * rim, and on the site it renders as brightly as the lips around it, so every
 * "aa" and "oh" showed a tongue filling the mouth, which reads as the tongue stuck
 * out (the owner's report, 2026-09-25). Darkening their own texture still
 * showed the tongue's outline, and the owner asked for Mika's and Milfy's mouth
 * instead, so those seven load this over their own. It fits them because their
 * mouth meshes are hers: 496 triangles each, spread over the three regions in
 * the same proportions (measured 2026-09-25).
 */
export const MIKA_MOUTH_URL = '/avatar/mouth-mika.png'

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
  { id: 'pink', label: '粉髮藍眼', url: '/avatar/mika-pink-2.vrm', family: 'vroid-sample-b', mouth: 'own', offered: true },
  { id: 'milfy', label: 'Milfy 復刻', url: '/avatar/mika-milfy-12.vrm', family: 'vroid-sample-b', mouth: 'own', offered: true },
  { id: 'base', label: '原紫髮', url: '/avatar/AvatarSample_B_webp.vrm', family: 'vroid-sample-b', mouth: 'own', offered: true },
  // The second family, and the first body here that is not an export of the
  // VRoid project the other three descend from: pixiv's VRM 1.0 constraint
  // sample, 54 humanoid bones of which 28 rest somewhere the VRoid family's do
  // not, so rigOf hashes differently and every clearance number had to be
  // measured again. Provenance and licence in
  // docs/plans/avatar-family-vrm1-twist-sample.md; its own metadata says credit
  // is unnecessary, so serving it carries no obligation.
  //
  // Offered since 2026-09-25, the owner's call; until then it was held back as a
  // different character on a site that had one. What it was declared
  // for is that motionPan, crownBound, panHolds and the 72 guards of
  // rigProbe.test.ts's `bundled motions` block now run against a rig that is
  // not the one they were written against, which is the only way to tell a
  // generalised layer from one that happens to work on the body it grew up on.
  //
  // One thing it does NOT exercise, said here rather than assumed: the other
  // 56 tests in that file sit outside the per-family block and still read
  // AvatarSample_B only.
  //
  // Retired from the strip on 2026-09-26, the owner's call: Rosa below took its
  // place. Kept declared and measured so the per-family guards keep running
  // against the VRM 1.0 constraint rig.
  { id: 'twist', label: 'VRM1 樣本', url: '/avatar/vrm1-twist-sample.vrm', family: 'vrm1-twist-sample', mouth: 'own', offered: false },
  // `rosa` since 2026-09-26, in the strip slot `twist` held: Mika's VRoid
  // project restyled in VRoid Studio 2.14.0 at the owner's direction as Rosa
  // (chest raised to 1.0) and exported as VRM 0.0. The export carried the same
  // `allowedUserName: OnlyAuthor` and `licenseName: Redistribution_Prohibited`
  // as `studio`'s, and at the owner's direction the same two were relaxed to
  // `Everyone` and `Other`; violent, sexual and commercial use stay Disallow.
  // Checked by putting the two values back and comparing the JSON and binary
  // chunk against the export, then packed as webp and scaled from crown 1.6199
  // to Mika's 1.582: scripts/avatar/evidence/rosa-0926.log. Its mouth texture
  // is pixel-identical to `studio`'s, so it keeps its own.
  { id: 'rosa', label: 'Rosa', url: '/avatar/rosa_webp.vrm', family: 'vroid-rosa', mouth: 'own', offered: true },
  // The third family, and the first body here that came back OUT of VRoid
  // Studio rather than out of this repo's own build: Mika's project taken
  // through Studio's dress-up path and re-exported as VRM 1.0 on 2026-09-09.
  // It has no upperChest, names its thumbs the 1.0 way and rests its hips 29.8mm
  // higher than the VRoid family, so rigOf hashes differently and every
  // clearance number was measured again. Provenance, the tear it arrived with
  // and the repair: docs/reports/mika-r3-studio-2026-09-09.md.
  //
  // The served file is the export with three permissions rewritten. Studio
  // stamps its most restrictive defaults on an export, and this one came out
  // saying allowRedistribution false, modification prohibited and
  // avatarPermission onlyAuthor, which a served file cannot say; the author
  // relaxed those three on 2026-09-09 and nothing else in the document or the
  // binary chunk differs from the run's own file (the parts.json beside it
  // records both hashes and the check).
  //
  // Offered since 2026-09-25 with the rest. It was held back on its own ground
  // rather than `twist`'s, because it descends from Mika's project: it does not
  // LOOK like her.
  // Studio's dress-up path starts from a clean base, and what came back is a
  // short brown cap of hair with a hard sawtooth hairline, plus glasses, where
  // the three offered looks are long-haired and bare-faced. Rendered side by
  // side against `milfy` at the same camera on 2026-09-11 and they read as two
  // people. The hairline is the export's own: the served file and the
  // `R3-B-clean-base-dressup.vrm` it came from carry the same single 746-vertex
  // `HairBack` primitive, so nothing in dressup.prepare or cover.trim cut it.
  //
  // Nothing technical stood in the way, which is why offering it cost no more
  // than the id, the chat.looks key and three labels. Its rest pose is right, it strands and
  // tears nothing, its clearance file excludes no clip, and it fails
  // verify.report only on the site's outline and rim style rules, which
  // `mika-pink` and `base` fail harder.
  //
  // What it is here for is the same as `twist`: a third rig for the per-family
  // guards to run against. What it buys that `twist` does not is a body whose
  // springs move nothing above the bust, so its crown is rigid geometry the
  // humanoid poses.
  //
  // It also bought the one thing a declared-but-unrendered body cannot: SERVING
  // it put a VRM 1.0 rig in front of the engine for the first time, and the
  // engine's rest pose was 0.x-only. Her arms went straight up. The pins are
  // version-aware since (avatarMode.armRestPins, rigProbe.test.ts's
  // "rests with her arms down"); the receipt with both screenshots is
  // scripts/avatar/evidence/armrest-0909.md.
  // Retired from the strip on 2026-09-26, the owner's call: `studio` now names
  // the office-wear restyle below. Kept declared and measured so the third
  // family's guards keep running against a VRM 1.0 rig.
  { id: 'studio-hoodie', label: 'Studio 換裝樣本（舊）', url: '/avatar/vroid-studio-dressup.vrm', family: 'vroid-studio-dressup', mouth: 'own', offered: false },
  // `studio` since 2026-09-26: Mika's VRoid project restyled in VRoid Studio
  // 2.14.0 at the owner's direction as a glasses-wearing office look (copper
  // high ponytail, black double-breasted jacket over a shirt and flared skirt,
  // chest 0.6) and exported as VRM 0.0. Studio stamps an export
  // `allowedUserName: OnlyAuthor` and `licenseName: Redistribution_Prohibited`,
  // which a served file cannot say; at the owner's direction those two were relaxed to
  // `Everyone` and `Other` (VRM 0.x has no separate modification key, the licence
  // carries it), the same three permissions the 2026-09-09 export had
  // relaxed. Violent, sexual and commercial use stay Disallow. Checked by putting
  // the two values back and comparing the JSON and binary chunk against the
  // export: scripts/avatar/evidence/mika-glasses-0926.log. Its mouth texture
  // paints the tongue quarter soft and pale like the old `studio` body's, and the
  // open mouth reads as a plain pale mouth on screen, so it keeps its own.
  // Served scaled to Mika's crown (1.6172 to 1.582, the same scalebody step as
  // Vivi), so the strip's looks stand at one height; the unscaled pack stays
  // at /avatar/mika-glasses_webp.vrm.
  { id: 'studio', label: '眼鏡上班族', url: '/avatar/mika-glasses_webp-2.vrm', family: 'vroid-mika-glasses', mouth: 'own', offered: true },
  // Eleven more rigs, measured on 2026-09-11 and none of them offered then. They are
  // VRoid's own official sample avatars, and what they are for is the same
  // thing `twist` and `studio` are for: the per-family paths in this repo
  // — motionPan, crownBound, panHolds, the per-family block of
  // rigProbe.test.ts, and the describe.each(FAMILIES) blocks of
  // avatarBow.test.ts and avatarPitch.test.ts (one block and two) — now run
  // against fourteen skeletons instead of three. Each of those blocks expands
  // AVATAR_FAMILIES directly, so adding a key here is what widens them.
  //
  // Five went in first and six followed the same day. The six landed on four
  // rules that no body of the original three's proportions could reach: a pan
  // held to equal its own re-derivation, which has no solution when the crown
  // is measured through the pan; a reach or handTop waiver required by every
  // placement of its clip, which a clip leaving one frame and not the other
  // cannot satisfy; a range boundary compared exactly against a number its
  // producer rounds to four places; and a clip in `excluded` still having to
  // fit the frames it is never played in. All four are fixed at the rule
  // rather than waived, and the eight registered before pass all four
  // unchanged; the measurements are in
  // docs/plans/avatar-families-vroid-samples.md.
  //
  // The women among them are offered since 2026-09-25 with `twist` and
  // `studio`; each is a different person, so the look strip is a cast list as
  // well as a wardrobe now. The men, `hair-male` here and `sample-c` and
  // `sakurada-fumiriya` below, stay declared and measured but not offered: the
  // owner's call on the same day, the strip is for female characters.
  { id: 'hair-female', label: 'VRoid 髮型樣本（女）', url: '/avatar/HairSample_Female_webp.vrm', family: 'vroid-hair-female', mouth: 'mika', offered: true },
  { id: 'hair-male', label: 'VRoid 髮型樣本（男）', url: '/avatar/HairSample_Male_webp.vrm', family: 'vroid-hair-male', mouth: 'own', offered: false },
  { id: 'sendagaya-shibu', label: 'Sendagaya Shibu', url: '/avatar/Sendagaya_Shibu_webp.vrm', family: 'vroid-sendagaya-shibu', mouth: 'mika', offered: true },
  { id: 'victoria-rubin', label: 'Victoria Rubin', url: '/avatar/Victoria_Rubin_webp.vrm', family: 'vroid-victoria-rubin', mouth: 'mika', offered: true },
  { id: 'vivi', label: 'Vivi', url: '/avatar/Vivi_webp-2.vrm', family: 'vroid-vivi', mouth: 'mika', offered: true },
  // And the six that were held back on the morning of 2026-09-11, registered
  // the same afternoon once the four rules above were fixed rather than worked
  // around: clearance.panHolds asks whether a declared pan is justified instead
  // of whether it equals its own re-derivation; rigProbe.test.ts judges the
  // reach and handTop waivers across a clip's placements the way it already
  // judged crownTop; clearance.RECORDED reads a range boundary to the four
  // places its producer writes; and the two fit guards honour `excluded`. None
  // weakens a guard, and all eight families above pass all four unchanged.
  // Same terms as the five.
  { id: 'sample-a', label: 'VRoid 官方樣本 A', url: '/avatar/AvatarSample_A_webp.vrm', family: 'vroid-sample-a', mouth: 'own', offered: true },
  { id: 'sample-c', label: 'VRoid 官方樣本 C', url: '/avatar/AvatarSample_C_webp.vrm', family: 'vroid-sample-c', mouth: 'own', offered: false },
  { id: 'darkness-shibu', label: 'Darkness Shibu', url: '/avatar/Darkness_Shibu_webp.vrm', family: 'vroid-darkness-shibu', mouth: 'mika', offered: true },
  { id: 'sakurada-fumiriya', label: 'Sakurada Fumiriya', url: '/avatar/Sakurada_Fumiriya_webp.vrm', family: 'vroid-sakurada-fumiriya', mouth: 'own', offered: false },
  { id: 'sendagaya-shino', label: 'Sendagaya Shino', url: '/avatar/Sendagaya_Shino_webp.vrm', family: 'vroid-sendagaya-shino', mouth: 'mika', offered: true },
  { id: 'vita', label: 'Vita', url: '/avatar/Vita_webp.vrm', family: 'vroid-vita', mouth: 'mika', offered: true },
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
 * OFFERED, not merely declared: a body declared with `offered: false` names a
 * real file with real measurements, and it still has to be refused, because
 * the answer to "which bodies does this site offer" is the look strip and
 * nothing else. Since 2026-09-25 that leaves out only the male bodies.
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

/**
 * The mouth texture to load over the body at this URL, or null to keep its own.
 *
 * Null for a body nothing declares: a freshly built body in live-preview
 * should be seen as its file draws it.
 */
export function borrowedMouthOfUrl(url: string): string | null {
  return AVATAR_VARIANTS.find((v) => v.url === url)?.mouth === 'mika' ? MIKA_MOUTH_URL : null
}
