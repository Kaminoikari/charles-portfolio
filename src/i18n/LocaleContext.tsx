import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_HTML_LANG,
  LOCALE_STORAGE_KEY,
  LOCALE_URL_PREFIX,
  type Locale,
} from './config'

interface LocaleContextValue {
  locale: Locale
  setLocale: (next: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

interface ProviderProps {
  locale: Locale
  children: ReactNode
}

// Strips a known locale prefix off a pathname, returning the locale-agnostic
// remainder (always starts with '/'). e.g. '/zh-TW/about' -> '/about'.
function stripLocalePrefix(pathname: string): string {
  for (const prefix of Object.values(LOCALE_URL_PREFIX)) {
    if (!prefix) continue
    if (pathname === prefix) return '/'
    if (pathname.startsWith(prefix + '/')) return pathname.slice(prefix.length)
  }
  return pathname
}

function buildLocaleUrl(locale: Locale, pathname: string, search: string, hash: string): string {
  const stripped = stripLocalePrefix(pathname)
  const prefix = LOCALE_URL_PREFIX[locale]
  // Avoid '/zh-TW' + '/' producing '/zh-TW/' which is fine, but make sure
  // we don't double-slash when stripped is just '/'.
  const path = prefix ? prefix + (stripped === '/' ? '' : stripped) : stripped
  return (path || '/') + search + hash
}

export function LocaleProvider({ locale, children }: ProviderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  // Keep <html lang> in sync with the active locale for screen readers and
  // SEO crawlers. Runs on every locale change since each route branch mounts
  // its own provider with a different `locale` prop.
  useEffect(() => {
    document.documentElement.lang = LOCALE_HTML_LANG[locale]
  }, [locale])

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next)
      } catch {
        // localStorage may be unavailable (private mode, quota); ignore.
      }
      const url = buildLocaleUrl(next, location.pathname, location.search, location.hash)
      navigate(url)
    },
    [locale, location.pathname, location.search, location.hash, navigate],
  )

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
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
      if (!path.startsWith('/')) return path  // anchors like '#contact'
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
