import type { VisemeTrack } from './voiceVisemes.gen'

// Samples a viseme track at time t (seconds into the clip). Tracks are
// ascending [startSec, viseme] steps ending with a closed (-1) sentinel;
// before the first step and at/after the sentinel the mouth is closed.
// Linear scan from the back keeps it allocation-free and O(n) worst case on
// tracks of ~40 steps — cheap enough to call every frame.
export function sampleViseme(track: VisemeTrack, t: number): number {
  if (track.length === 0 || t < track[0][0] || t >= track[track.length - 1][0]) return -1
  for (let i = track.length - 1; i >= 0; i--) {
    if (t >= track[i][0]) return track[i][1]
  }
  return -1
}
