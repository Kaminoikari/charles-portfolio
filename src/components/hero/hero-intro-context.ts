// Whether the hero's cinematic intro currently owns the screen. FaceHero writes it;
// the site chrome reads it and stays out of the way until the intro hands the screen
// back — the same moment the ambient track fades in. Readers today: the nav bar, and
// IntroHiddenChrome (the music toggle and the chat widget).
//
// Hook + context live here (non-component) so HeroIntroProvider.tsx exports only
// its component, keeping React Fast Refresh happy.

import { createContext, useContext } from 'react'

export interface HeroIntroValue {
  introRunning: boolean
  setIntroRunning: (running: boolean) => void
}

export const HeroIntroContext = createContext<HeroIntroValue | null>(null)

export function useHeroIntro(): HeroIntroValue {
  const ctx = useContext(HeroIntroContext)
  // Visible chrome is the safe default: a consumer rendered outside the provider
  // must never be able to hide the navigation.
  if (!ctx) return { introRunning: false, setIntroRunning: () => {} }
  return ctx
}
