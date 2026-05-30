import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import AmbientAudio from './components/AmbientAudio'
import AppRoutes from './AppRoutes'
import { LocaleRouter } from './LocaleRouter'

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
