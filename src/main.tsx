import { StrictMode, useMemo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import AmbientAudio from './components/AmbientAudio'
import AppRoutes from './AppRoutes'
import {
  DEFAULT_LOCALE,
  LOCALE_URL_PREFIX,
  LocaleProvider,
  type Locale,
} from './i18n'

function detectLocaleFromPath(pathname: string): Locale {
  for (const [loc, prefix] of Object.entries(LOCALE_URL_PREFIX) as [Locale, string][]) {
    if (!prefix) continue
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return loc
  }
  return DEFAULT_LOCALE
}

// Single LocaleProvider whose `locale` prop tracks the URL prefix. Switching
// language changes the prop, not the route boundary — so React reuses the
// entire mounted tree (Nav, Routes, page components) and the only thing that
// re-renders is the i18n consumers themselves. Scroll position, canvas
// animation state, and IntersectionObserver-driven reveals all survive the
// switch.
function LocaleRouter({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const locale = useMemo(() => detectLocaleFromPath(pathname), [pathname])
  return <LocaleProvider locale={locale}>{children}</LocaleProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LocaleRouter>
        <AppRoutes />
      </LocaleRouter>
      <AmbientAudio />
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
