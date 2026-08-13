import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import AppRoutes from './AppRoutes'
import { LocaleRouter } from './LocaleRouter'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <LocaleRouter>
          <AppRoutes />
        </LocaleRouter>
      </ErrorBoundary>
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)
