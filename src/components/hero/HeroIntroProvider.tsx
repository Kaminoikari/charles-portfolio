import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { HeroIntroContext, type HeroIntroValue } from './hero-intro-context'

// Starts false so routes without a hero (about, changelog, project pages) show
// their chrome with no hero involvement at all. On the home route the hero flips
// it to true from its mount effect; the opaque loading gate is already painted
// over the nav in that same first commit, so there is no visible flash.
export function HeroIntroProvider({ children }: { children: ReactNode }) {
  const [introRunning, setRunning] = useState(false)
  const setIntroRunning = useCallback((running: boolean) => setRunning(running), [])
  const value = useMemo<HeroIntroValue>(() => ({ introRunning, setIntroRunning }), [introRunning, setIntroRunning])
  return <HeroIntroContext.Provider value={value}>{children}</HeroIntroContext.Provider>
}
