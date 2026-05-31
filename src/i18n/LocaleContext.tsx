// The <LocaleProvider> component only — its context, hooks, and helpers live in
// locale-context.ts so this file exports a single component (required for React
// Fast Refresh: react-refresh/only-export-components).

import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LOCALE_HTML_LANG, LOCALE_STORAGE_KEY, type Locale } from './config'
import { LocaleContext, type LocaleContextValue, buildLocaleUrl } from './locale-context'

interface ProviderProps {
  locale: Locale
  children: ReactNode
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
