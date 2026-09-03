// Which body a visitor gets, in priority order: the URL (`?mika=<id>`), what
// they picked last time (localStorage), the default.
//
// Unknown ids from either source are ignored rather than thrown on: a link to
// a look that has since been removed, or a remembered id from before a rename,
// must load the default body and not break the page. (variantUrl's throw is
// for the programmer's typo; this is for the visitor's stale state.)
//
// The URL never writes storage: a shared link shows a look, it does not change
// what the visitor sees on their next visit. Only a pick that actually loaded
// is remembered — ChatWidget calls rememberVariant once the engine reports the
// swap done — so a failed swap leaves the remembered choice as it was.
import { ACTIVE_VARIANT, isVariantId, type AvatarVariantId } from './avatarVariants'

export const VARIANT_QUERY_PARAM = 'mika'
export const VARIANT_STORAGE_KEY = 'mika-look'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

// localStorage can be absent (SSR-shaped test environments) or throw on
// access (Safari private mode, blocked site data); either means "no memory".
function safeStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function initialVariantId(
  search: string = typeof location === 'undefined' ? '' : location.search,
  storage: StorageLike | null = safeStorage(),
): AvatarVariantId {
  const fromUrl = new URLSearchParams(search).get(VARIANT_QUERY_PARAM)
  if (isVariantId(fromUrl)) return fromUrl
  let stored: string | null = null
  try {
    stored = storage?.getItem(VARIANT_STORAGE_KEY) ?? null
  } catch {
    // Reading can throw as well as the lookup above; the default is the answer.
  }
  if (isVariantId(stored)) return stored
  return ACTIVE_VARIANT
}

export function rememberVariant(id: AvatarVariantId, storage: StorageLike | null = safeStorage()): void {
  try {
    storage?.setItem(VARIANT_STORAGE_KEY, id)
  } catch {
    // Storage blocked or full: the pick lives for this page only.
  }
}
