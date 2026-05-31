// Locale context object + hooks (the non-component half of the i18n provider).
// Split out from LocaleContext.tsx so that file can export only the
// <LocaleProvider> component — required for React Fast Refresh
// (react-refresh/only-export-components).

import { createContext, useCallback, useContext, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  LOCALE_URL_PREFIX,
  type Locale,
} from './config'

export interface LocaleContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
}

export const LocaleContext = createContext<LocaleContextValue | null>(null)

// Strips a known locale prefix off a pathname, returning the locale-agnostic
// remainder (always starts with '/'). e.g. '/zh-TW/about' -> '/about'.
export function stripLocalePrefix(pathname: string): string {
  for (const prefix of Object.values(LOCALE_URL_PREFIX)) {
    if (!prefix) continue
    if (pathname === prefix) return '/'
    if (pathname.startsWith(prefix + '/')) return pathname.slice(prefix.length)
  }
  return pathname
}

export function buildLocaleUrl(locale: Locale, pathname: string, search: string, hash: string): string {
  const stripped = stripLocalePrefix(pathname)
  const prefix = LOCALE_URL_PREFIX[locale]
  // Avoid '/zh-TW' + '/' producing '/zh-TW/' which is fine, but make sure
  // we don't double-slash when stripped is just '/'.
  const path = prefix ? prefix + (stripped === '/' ? '' : stripped) : stripped
  return (path || '/') + search + hash
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    // Safe fallback for any descendants that mount outside a provider —
    // shouldn't happen in normal flow, but avoids crashing the UI.
    return { locale: DEFAULT_LOCALE, setLocale: () => {} }
  }
  return ctx
}

// Returns a function that prefixes locale-agnostic paths with the active
// locale. Use for every internal link/href so users stay within their chosen
// locale when navigating. e.g. localePath('/about') -> '/zh-TW/about' on
// the zh-TW branch.
export function useLocalePath() {
  const { locale } = useLocale()
  return useCallback(
    (path: string) => {
      if (!path.startsWith('/')) return path // anchors like '#contact'
      const stripped = stripLocalePrefix(path)
      const prefix = LOCALE_URL_PREFIX[locale]
      return prefix ? prefix + (stripped === '/' ? '' : stripped) : stripped
    },
    [locale],
  )
}

// Restores the user's last explicit locale choice on first visit to the
// English (unprefixed) entry. If they previously chose zh-TW or ja, navigate
// them to that locale's equivalent URL once. Skipped when the URL already
// carries a locale prefix (URL is the source of truth in that case).
export function useInitialLocaleRestore() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Only act when on the English root branch (no locale prefix in URL).
    const pathHasPrefix = Object.values(LOCALE_URL_PREFIX).some(
      (p) => p && (location.pathname === p || location.pathname.startsWith(p + '/')),
    )
    if (pathHasPrefix) return

    let stored: string | null = null
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    } catch {
      return
    }
    if (!stored || !isLocale(stored) || stored === DEFAULT_LOCALE) return

    const url = buildLocaleUrl(stored, location.pathname, location.search, location.hash)
    navigate(url, { replace: true })
    // Only run once on initial mount. Subsequent locale switches go through
    // setLocale which manages localStorage and URL together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
