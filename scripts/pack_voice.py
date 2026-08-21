# Stage 4: encode the finished clips into what the site actually serves.
#
# Matches the catalogue the ja clips already ship as — AAC, 24kHz, mono, around
# 34kbps — so the new locales weigh the same per second as the old ones and no
# player has to deal with two formats. 24kHz is not a downgrade here: seed-vc
# emits 22.05kHz, so this is the first encode that is not throwing anything away.
#
# The viseme tracks are timed against the WAV that goes in, not the m4a that
# comes out, and that is correct: AAC-in-MP4 carries ~96ms of encoder priming
# that ffprobe counts and players skip. Measured in Chrome, `audio.duration` for
# these files matches the wav (8.406s vs 8.41s for mika-intro-1-zh), so
# currentTime and the track share one timeline. Anyone re-timing tracks from the
# shipped m4a with ffprobe would shift every step by that 96ms; gen_visemes.py
# reads afinfo for exactly this reason.
#
# /avatar/* is served with an immutable cache, so a clip's NAME is its cache
# key: re-encoding a clip under a name that has shipped leaves visitors on the
# old bytes forever. That is why the new English set is `-en2` rather than a
# second pass over `-en` (avatarVoice.ts carries the same warning).
#
# Usage:
#   python3 scripts/pack_voice.py --from build/voice-vc --to public/avatar/voice
import argparse
import glob
import os
import subprocess
import sys


def probe(path: str, entries: str) -> str:
    return subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', entries,
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True, check=True,
    ).stdout.strip()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--from', dest='src', required=True)
    ap.add_argument('--to', dest='dst', required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    wavs = sorted(glob.glob(os.path.join(args.src, '*.wav')))
    if not wavs:
        sys.exit(f'no wavs in {args.src}')
    os.makedirs(args.dst, exist_ok=True)

    total = 0
    for wav in wavs:
        clip_key = os.path.basename(wav)[:-len('.wav')]
        out = os.path.join(args.dst, f'{clip_key}.m4a')
        if os.path.exists(out):
            # Never silently rewrite a name that has already been served.
            sys.exit(f'{out} already exists — pick a new clip key, do not rewrite '
                     f'a cached one (see the immutable-cache note above)')
        if args.dry_run:
            print(f'  would write {out}')
            continue
        subprocess.run(
            ['ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
             '-c:a', 'aac', '-b:a', '34k', '-ar', '24000', '-ac', '1', out],
            check=True,
        )
        size = os.path.getsize(out)
        total += size
        print(f'  {clip_key:<22} {float(probe(out, "format=duration")):5.2f}s  {size / 1024:5.1f}KB')

    if not args.dry_run:
        print(f'\n{len(wavs)} clips, {total / 1024:.0f}KB added to {args.dst}')


if __name__ == '__main__':
    main()
