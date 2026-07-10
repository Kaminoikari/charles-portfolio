import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { AudioProvider } from './components/audio/AudioProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import AppRoutes from './AppRoutes'
import { LocaleRouter } from './LocaleRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <LocaleRouter>
          <AudioProvider>
            <AppRoutes />
          </AudioProvider>
        </LocaleRouter>
      </ErrorBoundary>
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
