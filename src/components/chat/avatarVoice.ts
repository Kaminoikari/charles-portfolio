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
//     the docked placement is gated on how big she reads beside the panel
//     (besidePanelFits), not on the pointer, so a coarse-pointer device that
//     clears it, an iPad in landscape or a phone held sideways, pats by
//     tapping.

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
// Both sets carry a generation number — `-en2` and `-zh2`, never `-en` or
// `-zh`. /avatar/* is served immutable, so a clip's NAME is its cache key and
// re-recording under a shipped name leaves visitors on the old audio forever.
// The `-en` and `-zh` files are gone; nothing points at them. That rule is also
// why the Mandarin set spans several generation numbers at once: the generation
// is per clip, not per locale (see ZH_REGEN below).
//
// zh-TW is on its second generation because the first shipped with broken
// tones. Stage 2 ran seed-vc with `f0_condition=False`, so pitch was
// regenerated from content plus a Japanese speaker embedding instead of
// following the accent source. English was unharmed; Mandarin was not, because
// the pitch contour inside a syllable is the tone, and the owner heard the
// result as foreign-accented on 2026-08-21. Six lines were also wrong as text:
// 「唷」 came back as 「噎」 in all three lines that used it, 「鏘」 wanted to be
// the two-syllable 「將將」, greet-3 now opens on 「Hello」 rather than 「哈囉」,
// and ack-1 ends on a full stop so its 「喔」 reads as the light particle it is.
// scripts/vc_to_tsumugi.py holds the diagnosis; scripts/voice_lines.py holds
// the wording.
//
// Several of those lines went further on the owner's ear the same day. suggest-1's
// two 喔 needed opposite tones and are now 「哦？…喔！」, where the question mark
// buys the opening rise and the exclamation mark the closing stress; suggest-2
// is the same words on a different take; bye-1 became 「Bye bye～」 because the
// model gave the first 掰 of 「掰掰」 0.08s however many times it was rolled, and
// the owner heard that fragment as 「阿掰」; and intro-1 needed 醬 pronounced
// jiang3, spelled as the homophone 獎 in the synthesis input while the character
// a visitor reads stays 醬.
//
// intro-1 then needed two more things that no wording could give it, which is
// what -zh4 is: the conversion had lifted it to 359Hz because auto_f0_adjust
// transposes onto the reference median, and its Charles was down to 0.24s
// against the 0.48s of a clip the owner had accepted. A re-roll of the very
// same sentence gave the name 0.40s, so the crowding was the draw and not the
// sentence. The pitch correction that ships for it lives in
// scripts/voice_lines.py's PITCH_SHIFT, keyed so it survives the clip being
// re-cut; the --semi-tone-shift flag only overrides it.
//
// Laughter is the exception: えへへ is the same sound in every language, so the
// giggle pool is SHARED verbatim rather than duplicated into three byte-
// identical copies. Any cue added here must be wordless for the same reason.
const LOCALE_NEUTRAL_CUES: readonly VoiceCue[] = ['giggle']

// zh-TW clips were re-cut after their set shipped, one of them twice, so the
// set spans more than one generation. Re-cutting the untouched clips to keep a
// single suffix would mean re-rolling takes the owner had already approved,
// and stage 1 is stochastic: a re-roll can only lose them. The map below is
// the current spread; it is the thing to read, not a count in prose.
//
// intro-1 is the one at -zh4. Its wording never changed; what changed was the
// take and the pitch, and /avatar/* being immutable-cached means new bytes
// need a new name just as much as new words do.
//
// Keyed on the base clip name, which is the part that survives both the
// directory and the generation suffix.
const ZH_REGEN: Readonly<Record<string, string>> = {
  'mika-suggest-1': '-zh3',
  'mika-suggest-2': '-zh3',
  'mika-bye-1': '-zh3',
  'mika-intro-1': '-zh4',
}

function localised(
  suffix: string,
  regen: Readonly<Record<string, string>> = {},
): Record<VoiceCue, string[]> {
  return Object.fromEntries(
    Object.entries(VOICE_LINES).map(([cue, clips]) => [
      cue,
      LOCALE_NEUTRAL_CUES.includes(cue as VoiceCue)
        ? clips
        : clips.map((clip) => {
            const base = clip.slice(clip.lastIndexOf('/') + 1, -'.m4a'.length)
            return clip.replace(/\.m4a$/, `${regen[base] ?? suffix}.m4a`)
          }),
    ]),
  ) as Record<VoiceCue, string[]>
}

export const VOICE_LINES_EN = localised('-en2')
export const VOICE_LINES_ZH = localised('-zh2', ZH_REGEN)

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
