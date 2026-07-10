import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import App from './App'
import Nav from './components/Nav'
import ChatWidget from './components/chat/ChatWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MusicToggle } from './components/audio/MusicToggle'
import { LOCALE_URL_PREFIX, useInitialLocaleRestore } from './i18n'

const AboutPage = lazy(() => import('./components/AboutPage'))
const ChangelogPage = lazy(() => import('./components/ChangelogPage'))
const ProjectDetailPage = lazy(() => import('./components/ProjectDetailPage'))

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

// Page-element pairs are defined ONCE so the JSX object is shared across the
// per-locale Route variants below. React reconciliation matches by element
// type at each tree position; when locale switches from /about to /zh-TW/about
// the matched route's element is the same <AboutPage/> JSX, so React reuses
// the existing instance instead of unmount + mount. That's what keeps scroll,
// canvas state, and animation triggers from resetting on every locale switch.
const PAGES: { path: string; element: React.ReactNode }[] = [
  { path: '/', element: <App /> },
  {
    path: '/about',
    element: (
      <Suspense fallback={<Loading />}>
        <AboutPage />
      </Suspense>
    ),
  },
  {
    path: '/changelog',
    element: (
      <Suspense fallback={<Loading />}>
        <ChangelogPage />
      </Suspense>
    ),
  },
  {
    path: '/projects/:id',
    element: (
      <Suspense fallback={<Loading />}>
        <ProjectDetailPage />
      </Suspense>
    ),
  },
]

const PREFIXES = Object.values(LOCALE_URL_PREFIX) // ['', '/zh-TW', '/ja']

function buildPath(prefix: string, pagePath: string): string {
  if (!prefix) return pagePath
  if (pagePath === '/') return prefix
  return `${prefix}${pagePath}`
}

export default function AppRoutes() {
  // Restore user's previously-chosen locale on first visit to the English
  // (unprefixed) entry. No-op for locale-prefixed branches.
  useInitialLocaleRestore()

  return (
    <>
      <Nav />
      <Routes>
        {PAGES.flatMap((page) =>
          PREFIXES.map((prefix) => (
            <Route
              key={`${prefix || 'en'}::${page.path}`}
              path={buildPath(prefix, page.path)}
              element={page.element}
            />
          )),
        )}
      </Routes>
      <MusicToggle />
      <ErrorBoundary fallback={null}>
        <ChatWidget />
      </ErrorBoundary>
    </>
  )
}
