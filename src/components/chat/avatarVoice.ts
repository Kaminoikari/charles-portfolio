// Mika's voice lines — short pre-recorded VOICEVOX clips for interaction
// moments, NOT a TTS of the answers (that trade-off is recorded in
// docs/plans/avatar-guide.md). One voice in every locale on purpose — the
// voice is the character's identity: ja/zh-TW hear her Japanese lines, en
// hears the same voice reading katakana English (see VOICE_LINES_EN below).
//
// Voice library: VOICEVOX:春日部つむぎ — commercial use permitted with credit;
// the credit line lives in the site footer and the plan doc records the terms.
//
// Playback rules (see the project's hard-won iOS notes in CLAUDE.md):
//   - every play starts inside a tap-completed gesture (launcher tap, send
//     tap/Enter), so no unlock dance is needed;
//   - clips NEVER autoplay from timers or effects — a line only ever sounds
//     as the direct result of the visitor's own tap. (The site used to gate
//     voice behind the ambient-music mute; that button was removed 2026-08-13
//     and voice became unconditional.)

import type { Locale } from '../../i18n'

export type VoiceCue = 'intro' | 'greet' | 'ack' | 'fullscreen' | 'suggest' | 'bye' | 'done' | 'error'

export const VOICE_LINES: Record<VoiceCue, string[]> = {
  // First panel open of the tab-session: a full self-introduction. Later
  // opens fall back to the short greet pool (ChatWidget owns that latch).
  intro: ['/avatar/voice/mika-intro-1.m4a'],
  // Tap on Mika (or her speech bubble): she says hello and invites a question.
  greet: [
    '/avatar/voice/mika-greet-1.m4a',
    '/avatar/voice/mika-greet-2.m4a',
    '/avatar/voice/mika-greet-3.m4a',
    '/avatar/voice/mika-greet-4.m4a',
    '/avatar/voice/mika-greet-5.m4a',
    '/avatar/voice/mika-greet-6.m4a',
    '/avatar/voice/mika-greet-7.m4a',
    '/avatar/voice/mika-greet-8.m4a',
    '/avatar/voice/mika-greet-9.m4a',
  ],
  // Question submitted by typing: a short acknowledgement while the pipeline spins up.
  ack: [
    '/avatar/voice/mika-ack-1.m4a',
    '/avatar/voice/mika-ack-2.m4a',
    '/avatar/voice/mika-ack-3.m4a',
    '/avatar/voice/mika-ack-4.m4a',
    '/avatar/voice/mika-ack-5.m4a',
  ],
  // Expand button tap, entering fullscreen only (collapsing stays silent).
  fullscreen: ['/avatar/voice/mika-full-1.m4a', '/avatar/voice/mika-full-2.m4a'],
  // A suggested-question chip tap (replaces ack for that submit).
  suggest: ['/avatar/voice/mika-suggest-1.m4a', '/avatar/voice/mika-suggest-2.m4a'],
  // The explicit minimise button (Escape closes silently by design).
  bye: ['/avatar/voice/mika-bye-1.m4a', '/avatar/voice/mika-bye-2.m4a'],
  // Answer stream finished / failed. These two cues fire OUTSIDE a tap gesture,
  // so iOS refuses the fresh play() and they stay silent there (the rejection
  // is swallowed); desktop browsers allow them after the visitor's first
  // interaction. Accepted trade-off, recorded in docs/plans/avatar-guide.md.
  done: ['/avatar/voice/mika-done-1.m4a', '/avatar/voice/mika-done-2.m4a'],
  error: ['/avatar/voice/mika-error-1.m4a'],
}

// The en locale gets the same つむぎ voice reading katakana-transliterated
// English (カタカナ英語 — the accent is part of the gyaru charm, and it is the
// only legal way to keep ONE voice across languages: VOICEVOX has no non-JA
// phonemes, and cloning the voice into another engine is barred by the
// character licence). zh-TW keeps the Japanese lines: Mandarin cannot be
// approximated with kana at all. Same filenames with an -en suffix, one per
// Japanese clip, so the two catalogues stay in lockstep.
export const VOICE_LINES_EN: Record<VoiceCue, string[]> = Object.fromEntries(
  Object.entries(VOICE_LINES).map(([cue, clips]) => [
    cue,
    clips.map((clip) => clip.replace(/\.m4a$/, '-en.m4a')),
  ]),
) as Record<VoiceCue, string[]>

export function voiceLinesFor(locale: Locale): Record<VoiceCue, string[]> {
  return locale === 'en' ? VOICE_LINES_EN : VOICE_LINES
}

export function pickVoiceLine(cue: VoiceCue, locale: Locale, rng: () => number = Math.random): string {
  const clips = voiceLinesFor(locale)[cue]
  return clips[Math.min(clips.length - 1, Math.floor(rng() * clips.length))]
}

// Fire-and-forget: audio is chrome, never blocks the chat. Returns the element
// so the caller can drive the viseme loop off ended/error.
// `play()` is optional-chained: jsdom's stub returns undefined instead of a
// promise. A rejected promise (autoplay refusal — routine on iOS for the
// off-gesture done/error cues) reports through onBlocked, because the browser
// fires NO DOM event in that case and callers must reset their own state.
export function playVoiceCue(
  cue: VoiceCue,
  locale: Locale,
  rng: () => number = Math.random,
  onBlocked?: () => void,
): HTMLAudioElement {
  const el = new Audio(pickVoiceLine(cue, locale, rng))
  el.play()?.catch(() => onBlocked?.())
  return el
}
