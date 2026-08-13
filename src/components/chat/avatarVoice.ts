// Mika's voice lines — short pre-recorded VOICEVOX clips for interaction
// moments, NOT a TTS of the answers (that trade-off is recorded in
// docs/plans/avatar-guide.md). Japanese in every locale on purpose: the voice
// is the character's identity, the localised bubble/text carries the meaning.
//
// Voice library: VOICEVOX:春日部つむぎ — commercial use permitted with credit;
// the credit line lives in the site footer and the plan doc records the terms.
//
// Playback rules (see the project's hard-won iOS notes in CLAUDE.md):
//   - every play starts inside a tap-completed gesture (launcher tap, send
//     tap/Enter), so no unlock dance is needed;
//   - clips NEVER autoplay from timers or effects;
//   - sound is opt-in per session — the ambient-audio mute state gates all
//     voice, so a visitor who never enabled sound hears nothing.

export type VoiceCue = 'greet' | 'ack'

export const VOICE_LINES: Record<VoiceCue, string[]> = {
  // Tap on Mika (or her speech bubble): she says hello and invites a question.
  greet: ['/avatar/voice/mika-greet-1.m4a', '/avatar/voice/mika-greet-2.m4a'],
  // Question submitted: a short acknowledgement while the pipeline spins up.
  ack: ['/avatar/voice/mika-ack-1.m4a'],
}

export function pickVoiceLine(cue: VoiceCue, rng: () => number = Math.random): string {
  const clips = VOICE_LINES[cue]
  return clips[Math.min(clips.length - 1, Math.floor(rng() * clips.length))]
}

// Fire-and-forget: audio is chrome, never blocks the chat. Returns the element
// so the caller can drive the viseme loop off ended/error, or null when muted.
// `play()` is optional-chained: jsdom's stub returns undefined instead of a
// promise, and a rejected real promise (rare autoplay refusal) is swallowed.
export function playVoiceCue(
  cue: VoiceCue,
  muted: boolean,
  rng: () => number = Math.random,
): HTMLAudioElement | null {
  if (muted) return null
  const el = new Audio(pickVoiceLine(cue, rng))
  el.play()?.catch(() => {})
  return el
}
