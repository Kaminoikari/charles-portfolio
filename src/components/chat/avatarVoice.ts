// Mika's voice lines — short pre-recorded clips for interaction moments, NOT a
// TTS of the answers (that trade-off is recorded in docs/plans/avatar-guide.md).
// One voice in every locale on purpose, because the voice is the character's
// identity; since 2026-08-21 each locale hears that voice speaking its OWN
// language rather than Japanese (see the note above VOICE_LINES_EN).
//
// Voice library: VOICEVOX:春日部つむぎ, commercial use permitted with credit.
// There is no credit LINE anywhere — ContactFooter has none. The name does
// appear on the site, inside the body of the 2026-08-13 changelog entry, which
// visitors can read on /changelog in all three locales; whether a mention in a
// changelog discharges the obligation is the owner's call. The zh-TW and en
// clips add two more names: public fish.audio voices supply the accent before
// conversion to つむぎ's timbre, and neither is named anywhere. Raised with the
// owner on 2026-08-21; docs/plans/avatar-guide.md holds the terms.
//
// Playback rules (see the project's hard-won iOS notes in CLAUDE.md):
//   - every play starts inside a tap-completed gesture (launcher tap, send
//     tap/Enter), so no unlock dance is needed;
//   - clips NEVER autoplay from timers or effects — a line only ever sounds
//     as the direct result of the visitor's own tap. (The site used to gate
//     voice behind the ambient-music mute; that button was removed 2026-08-13
//     and voice became unconditional.)
//   - the head-pat cues (giggle, huff) reach her two ways. A TAP is a
//     pointerup, which IS a tap-completed gesture, so nothing is owed there.
//     A STROKE is pointermove, which is not — but the stroke path is behind
//     `pointer: fine`, and desktop browsers allow audio once the visitor has
//     interacted with the page at all. A visitor who strokes before ever
//     clicking gets the refusal handled the way done/error already handle it
//     (onBlocked, silent, face reset).
//
//     Taps are NOT desktop-only, which the previous version of this note said.
//     Only the launcher placement is excluded (AvatarGuide gates on it), and
//     the docked placement is gated on width alone — a coarse-pointer device
//     at ≥880 CSS px, an iPad or a landscape phone, pats by tapping.

import type { Locale } from '../../i18n'

export type VoiceCue =
  | 'intro'
  | 'greet'
  | 'ack'
  | 'fullscreen'
  | 'suggest'
  | 'giggle'
  | 'huff'
  | 'bye'
  | 'done'
  | 'error'

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
  // First two head pats (see AvatarGuide for how one is detected). She used to answer a pat in
  // silence; the owner asked for the laugh on 2026-08-20, so a pat now earns a
  // bashful えへへ on top of the same happy face and head wiggle. Still not a
  // LINE: she laughs, she does not talk, which is what keeps the pool usable
  // in every locale untranslated.
  giggle: [
    '/avatar/voice/mika-giggle-1.m4a',
    '/avatar/voice/mika-giggle-2.m4a',
    '/avatar/voice/mika-giggle-3.m4a',
  ],
  // Third head pat in a row. Unlike the giggle this one is a LINE, so it is
  // localised like every other line: the annoyed beat used to be silent, and
  // the owner asked on 2026-08-21 for it to be audible. A wordless grunt would
  // have been the cheaper answer and the wrong one — she would have been the
  // only character on the site who complains in nobody's language.
  huff: ['/avatar/voice/mika-huff-1.m4a'],
  // The explicit minimise button (Escape closes silently by design).
  bye: ['/avatar/voice/mika-bye-1.m4a', '/avatar/voice/mika-bye-2.m4a'],
  // Answer stream finished / failed. These two cues fire OUTSIDE a tap gesture,
  // so iOS refuses the fresh play() and they stay silent there (the rejection
  // is swallowed); desktop browsers allow them after the visitor's first
  // interaction. Accepted trade-off, recorded in docs/plans/avatar-guide.md.
  done: ['/avatar/voice/mika-done-1.m4a', '/avatar/voice/mika-done-2.m4a'],
  error: ['/avatar/voice/mika-error-1.m4a'],
}

// zh-TW and en get their OWN recordings in the same voice (2026-08-21).
//
// What they used to get: en heard カタカナ英語, English words spelled in kana so
// VOICEVOX could pronounce them at all, and zh-TW heard the Japanese clips
// untranslated, because Mandarin cannot be approximated with kana even badly.
// Both were consequences of one engine limit — VOICEVOX has no non-Japanese
// phonemes — and the owner ruled on 2026-08-21 that the katakana English had
// stopped reading as charm and started reading as unintelligible.
//
// How the voice crosses languages now: fish.audio synthesizes each line with a
// NATIVE-accent voice, and seed-vc converts that recording's timbre to hers.
// Cloning her voice and asking it to speak Mandarin was tried first and is what
// does not work — a clone of a Japanese-only reference has no evidence of how
// this speaker forms Mandarin or English, so it transfers Japanese phonemes and
// you get the same unintelligibility from a different direction. Splitting the
// job in two is the point: the accent comes from a speaker who has one, the
// timbre comes from her. docs/plans/avatar-guide.md carries the pipeline and
// the licence position.
//
// The English set is `-en2`, not `-en`. /avatar/* is served immutable, so a
// clip's NAME is its cache key and re-recording under a shipped name leaves
// visitors on the old audio forever. The `-en` files are gone; nothing points
// at them.
//
// Laughter is the exception: えへへ is the same sound in every language, so the
// giggle pool is SHARED verbatim rather than duplicated into three byte-
// identical copies. Any cue added here must be wordless for the same reason.
const LOCALE_NEUTRAL_CUES: readonly VoiceCue[] = ['giggle']

function localised(suffix: string): Record<VoiceCue, string[]> {
  return Object.fromEntries(
    Object.entries(VOICE_LINES).map(([cue, clips]) => [
      cue,
      LOCALE_NEUTRAL_CUES.includes(cue as VoiceCue)
        ? clips
        : clips.map((clip) => clip.replace(/\.m4a$/, `${suffix}.m4a`)),
    ]),
  ) as Record<VoiceCue, string[]>
}

export const VOICE_LINES_EN = localised('-en2')
export const VOICE_LINES_ZH = localised('-zh')

export function voiceLinesFor(locale: Locale): Record<VoiceCue, string[]> {
  if (locale === 'en') return VOICE_LINES_EN
  if (locale === 'zh-TW') return VOICE_LINES_ZH
  return VOICE_LINES
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
