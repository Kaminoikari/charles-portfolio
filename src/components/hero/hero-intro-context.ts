// Whether the hero's cinematic intro currently owns the screen: the site chrome
// reads it and stays out of the way until the intro hands the screen back.
// Readers today: the nav bar, IntroHiddenChrome (the chat widget), and
// ChatWidget's avatar-guide latch (defers the 5.5MB VRM until the intro is done).
//
// NOTHING WRITES IT any more. FaceHero was the only writer and it was deleted on
// 2026-08-14 with the rest of the face hero, so `introRunning` is permanently
// false and every reader takes its "intro already finished" path. The context is
// still wired up because a future hero may want the same handoff; if none does,
// this and introTiming.ts can go, along with the reader branches.
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
