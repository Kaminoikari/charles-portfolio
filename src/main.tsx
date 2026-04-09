import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Nav from './components/Nav'
import App from './App'

const ChangelogPage = lazy(() => import('./components/ChangelogPage'))

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/changelog" element={
          <Suspense fallback={<Loading />}>
            <ChangelogPage />
          </Suspense>
        } />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
