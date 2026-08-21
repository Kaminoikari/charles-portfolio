# Stage 4: encode the finished clips into what the site actually serves.
#
# Matches the catalogue the ja clips already ship as — AAC, 24kHz, mono, around
# 34kbps — so the new locales weigh the same per second as the old ones and no
# player has to deal with two formats.
#
# 24kHz IS a downgrade for the Mandarin clips, and deliberately so. seed-vc's
# default model emits 22.05kHz, which this encode used to sit just above; the
# F0-conditioned model these were rebuilt on emits 44.1kHz, so everything over
# 12kHz is discarded here. Kept anyway: one format across the catalogue is worth
# more than the top octave of a 2-second interaction cue, and doubling the
# bitrate for that octave would show up on every visitor's first tap.
#
# The viseme tracks are timed against the WAV that goes in, rather than the m4a
# that comes out. That was originally to dodge AAC-in-MP4 encoder priming: the
# clip that shipped as mika-intro-1-zh2 measured ~96ms longer under ffprobe than
# it played under Chrome, where `audio.duration` matched the wav (8.406s vs
# 8.41s). Re-measured on the clips that replaced it on 2026-08-21, ffprobe and
# the source wav now agree to within 1ms, so this encode is not adding that
# offset any more.
#
# Timing off the wav stays correct either way, and it is the safer of the two
# because it does not depend on which of them is right today. gen_visemes.py
# reads afinfo for the same reason. If you ever DO re-time from a shipped m4a,
# measure the offset again rather than assuming either number.
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
    ap.add_argument('--only', help='one clip key. The catalogue grows a line at a '
                                   'time now, and the guard below refuses to rewrite '
                                   'names that already shipped, so a whole-directory '
                                   'run stops on the first old clip.')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    wavs = sorted(glob.glob(os.path.join(args.src, '*.wav')))
    if args.only:
        wavs = [w for w in wavs if os.path.basename(w)[:-len('.wav')] == args.only]
    if not wavs:
        sys.exit(f'no wavs in {args.src}' + (f' matching {args.only}' if args.only else ''))
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
