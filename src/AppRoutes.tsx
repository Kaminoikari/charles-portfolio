import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import App from './App'
import Nav from './components/Nav'
import { useInitialLocaleRestore } from './i18n'

const AboutPage = lazy(() => import('./components/AboutPage'))
const ChangelogPage = lazy(() => import('./components/ChangelogPage'))
const ProjectDetailPage = lazy(() => import('./components/ProjectDetailPage'))

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

// Inner route table — shared across every locale branch. Paths are relative
// to the locale prefix in main.tsx, so '/about' here maps to '/about',
// '/zh-TW/about', and '/ja/about' depending on which branch wraps it.
export default function AppRoutes() {
  // Restore user's previously-chosen locale on first visit to the English
  // (unprefixed) entry. No-op for locale-prefixed branches.
  useInitialLocaleRestore()

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/about"
          element={
            <Suspense fallback={<Loading />}>
              <AboutPage />
            </Suspense>
          }
        />
        <Route
          path="/changelog"
          element={
            <Suspense fallback={<Loading />}>
              <ChangelogPage />
            </Suspense>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <Suspense fallback={<Loading />}>
              <ProjectDetailPage />
            </Suspense>
          }
        />
      </Routes>
    </>
  )
}
