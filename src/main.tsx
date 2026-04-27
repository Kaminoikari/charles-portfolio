import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import AmbientAudio from './components/AmbientAudio'
import AppRoutes from './AppRoutes'
import { LocaleProvider } from './i18n'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Locale-prefixed branches first so '/zh-TW' / '/ja' don't fall
            through to the English catch-all. */}
        <Route
          path="/zh-TW/*"
          element={
            <LocaleProvider locale="zh-TW">
              <AppRoutes />
            </LocaleProvider>
          }
        />
        <Route
          path="/ja/*"
          element={
            <LocaleProvider locale="ja">
              <AppRoutes />
            </LocaleProvider>
          }
        />
        {/* English default — unprefixed catch-all. */}
        <Route
          path="/*"
          element={
            <LocaleProvider locale="en">
              <AppRoutes />
            </LocaleProvider>
          }
        />
      </Routes>
      <AmbientAudio />
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
