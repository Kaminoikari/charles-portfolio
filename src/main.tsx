import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import Nav from './components/Nav'
import AmbientAudio from './components/AmbientAudio'
import App from './App'

const AboutPage = lazy(() => import('./components/AboutPage'))
const ChangelogPage = lazy(() => import('./components/ChangelogPage'))
const ProjectDetailPage = lazy(() => import('./components/ProjectDetailPage'))

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/about" element={
          <Suspense fallback={<Loading />}>
            <AboutPage />
          </Suspense>
        } />
        <Route path="/changelog" element={
          <Suspense fallback={<Loading />}>
            <ChangelogPage />
          </Suspense>
        } />
        <Route path="/projects/:id" element={
          <Suspense fallback={<Loading />}>
            <ProjectDetailPage />
          </Suspense>
        } />
      </Routes>
      <AmbientAudio />
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
