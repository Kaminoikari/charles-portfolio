# Generates src/components/chat/voiceVisemes.gen.ts — the single generator for
# every clip's lip sync, in all three locales.
#
# It has to be single. The generated file is one Record, so a second writer
# would silently drop whatever the first one wrote. But the timings now come
# from two places, because the audio does:
#
#   ja + giggle   VOICEVOX audio_query mora timings. Ground truth: the engine
#                 that produced the audio is reporting when it starts each
#                 vowel.
#   zh + en2      the spans fish.audio reported while synthesizing, saved next
#                 to each wav by gen_voice_fish.py and turned into a track by
#                 gen_visemes_align.py. Also measured rather than guessed, and
#                 still valid after stage 2 because voice conversion rewrites
#                 frames without moving them.
#
# The katakana-English tracks are gone with the clips they belonged to; the en
# locale ships `-en2` now (the reason for the new name is in avatarVoice.ts).
#
# Regenerate: start the voicevox engine (speaker 8), then:
#   uv run --with pypinyin python3 scripts/gen_visemes.py
#
# build/ is gitignored, so the zh/en half needs stage 1 to have been run in this
# checkout. Without build/voice-fish this stops with a message rather than
# writing the ja tracks alone, which would silently drop 48 of the 75.
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_visemes_align import MIN_STEP, build_track, locale_of  # noqa: E402
from voice_lines import GIGGLE_LINES, JA_LINES  # noqa: E402

SPK = 8
VOWEL_TO_IDX = {'a': 0, 'i': 1, 'u': 2, 'e': 3, 'o': 4}  # aa ih ou ee oh
VOICEVOX_LINES = JA_LINES + GIGGLE_LINES


def audio_query(text: str) -> dict:
    q = urllib.parse.urlencode({'text': text, 'speaker': SPK})
    req = urllib.request.Request(f'http://localhost:50021/audio_query?{q}', method='POST')
    return json.load(urllib.request.urlopen(req))


def duration(path: str) -> float:
    return float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True, check=True,
    ).stdout.strip())


def speech_span(path: str) -> tuple[float, float] | None:
    """When the first sound starts and the last one stops, ignoring silence.

    fish.audio's alignment describes the TEXT, and it drifts from the audio at
    both ends. The final span is under-reported on 12 of the 48 clips, by up to
    415ms, which would shut her mouth mid-word. At the head, two clips open on a
    non-word sound — "Mm, that one!" and 「嗯，那個喔！」 — which the alignment
    DOES carry, but en_vowels/zh_vowels find no vowel in, so build_track drops
    the span and the first shape lands 480ms (en) and 320ms (zh) after she is
    audibly speaking. A few other clips start at 0.00 while the audio has a
    short run-in. Every span in between is contiguous with its neighbour, so
    only the two ends need correcting.

    Returns None when silencedetect reports nothing, which means it found no
    silence to measure and the alignment should be left alone.
    """
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=n=-45dB:d=0.05',
         '-f', 'null', '-'],
        capture_output=True, text=True,
    ).stderr
    starts = [float(m) for m in re.findall(r'silence_start: ([\d.]+)', out)]
    ends = [float(m) for m in re.findall(r'silence_end: ([\d.]+)', out)]
    if not starts and not ends:
        return None
    total = duration(path)
    # A silence that begins at the very top of the clip is a run-in; speech
    # starts where it ends.
    head = ends[0] if starts and starts[0] < 0.01 and ends else 0.0
    # A silence still running at the end of the clip is the tail; speech
    # stopped where it began.
    tail = starts[-1] if starts and (not ends or ends[-1] >= total - 0.02) else total
    return head, tail


def m4a_duration(path: str) -> float:
    """Playable length of a shipped clip.

    afinfo, not ffprobe: for AAC in MP4 ffprobe's format=duration counts the
    encoder's priming samples, which is ~96ms of silence the player skips. The
    ja tracks were baked against this number and look right in production, so
    reading it the other way would shift every one of their closing steps.
    """
    out = subprocess.run(['afinfo', path], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if 'estimated duration' in line:
            return float(line.split(':')[1].strip().split(' ')[0])
    raise RuntimeError(f'no duration for {path}')


def voicevox_track(text: str, speed: float, real: float) -> tuple[list, float]:
    q = audio_query(text)
    t = q['prePhonemeLength']
    segs: list[list] = []
    last = None
    for phrase in q['accent_phrases']:
        moras = list(phrase['moras'])
        if phrase.get('pause_mora'):
            moras.append(phrase['pause_mora'])
        for m in moras:
            v = VOWEL_TO_IDX.get((m['vowel'] or '').lower(), -1)
            if v != last:
                segs.append([round(t / speed, 3), v])
                last = v
            t += (m.get('consonant_length') or 0) + (m.get('vowel_length') or 0)
    t += q['postPhonemeLength']
    end = round(t / speed, 3)
    # Sentence-final ？/！ upspeak lengthens the last mora at synthesis time
    # beyond the query's stated lengths — trailing-only drift. Snap the closing
    # sentinel to the real clip length so the mouth holds through the tail.
    close = [max(end, round(real, 3)), -1]
    if segs and segs[-1][1] == -1:
        # A clip that trails off into a pause mora (えへへ…) already ends on a
        # closed mouth, so appending would leave a step that changes nothing.
        # Push the existing one out to the clip end instead.
        segs[-1] = close
    else:
        segs.append(close)
    return segs, end


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ap.add_argument('--align-dir', default='build/voice-fish',
                    help='the .align.json files gen_voice_fish.py wrote')
    ap.add_argument('--audio-dir', default='build/voice-vc',
                    help='converted zh/en wavs: what ships, so what the tracks are timed to')
    ap.add_argument('--allow-unconverted', action='store_true',
                    help='fall back to the stage-1 wavs when a converted one is missing. '
                         'For iterating on stage 1 only — the tracks it writes are timed '
                         'against audio that will not ship.')
    args = ap.parse_args()

    entries: list[tuple[str, list]] = []
    bad: list[str] = []
    unconverted: list[str] = []

    for key, text, speed in VOICEVOX_LINES:
        real = m4a_duration(f'{args.repo}/public/avatar/voice/{key}.m4a')
        segs, end = voicevox_track(text, speed, real)
        if abs(end - real) > 0.35:
            bad.append(f'{key}: timeline {end:.3f}s vs clip {real:.3f}s')
        entries.append((key, segs))
        print(f'{key:22s} timeline={end:5.2f}s clip={real:5.2f}s '
              f'drift={end - real:+.3f}s steps={len(segs)}')

    align_dir = os.path.join(args.repo, args.align_dir)
    if not os.path.isdir(align_dir):
        # Writing the file with only the ja half would look like success and
        # silently drop every zh and en track.
        sys.exit(f'{align_dir} does not exist — run scripts/gen_voice_fish.py first '
                 f'(build/ is gitignored, so a fresh checkout has no stage-1 output)')
    for name in sorted(os.listdir(align_dir)):
        if not name.endswith('.align.json'):
            continue
        key = name[: -len('.align.json')]
        align = json.load(open(os.path.join(align_dir, name), encoding='utf-8'))
        track = build_track(align, locale_of(key))
        # The CONVERTED audio is what ships, so it is what the track is timed
        # to. Silently reading the stage-1 wav instead would time the track
        # against a file nobody hears, and print nothing about it.
        wav = os.path.join(args.repo, args.audio_dir, f'{key}.wav')
        if not os.path.exists(wav):
            if not args.allow_unconverted:
                sys.exit(f'{wav} is missing — run scripts/vc_to_tsumugi.py, or pass '
                         f'--allow-unconverted to time this track against stage-1 audio')
            wav = os.path.join(align_dir, f'{key}.wav')
            unconverted.append(key)
        real = duration(wav)

        # Two corrections to the closing step, in this order.
        #
        # The CAP is unconditional. build_track takes that step from the
        # alignment, and on 5 of the 48 clips the alignment already runs past
        # the end of the audio, where a step can never fire and her mouth never
        # shuts.
        #
        # The PIN is what the measurement buys: open and close on the SOUND
        # rather than on the text, because the alignment is a few hundred ms out
        # at each end on some clips. It only applies when silencedetect found
        # silence to measure from.
        close = min(track[-1][0], real)
        span = speech_span(wav)
        if span:
            head, tail = span
            close = min(tail, real)
            if len(track) > 1:
                track[0][0] = round(max(0.0, min(head, track[1][0] - MIN_STEP)), 3)
        # The measured offset can land inside MIN_STEP of the last vowel (the
        # tightest in this batch is 8ms, on mika-greet-4-en2, and fish.audio
        # re-synthesis moves spans). Nudging the close out to the floor costs at
        # most MIN_STEP of hold; aborting a 75-track run over it does not.
        floor = track[-2][0] + MIN_STEP if len(track) > 1 else 0.0
        if floor > real:
            bad.append(f'{key}: last vowel at {track[-2][0]:.3f}s leaves no room to '
                       f'close inside a {real:.3f}s clip')
        else:
            track[-1][0] = round(max(close, floor), 3)
        end = track[-1][0]
        entries.append((key, track))
        print(f'{key:22s} timeline={end:5.2f}s clip={real:5.2f}s '
              f'drift={end - real:+.3f}s steps={len(track)}')

    if bad:
        print('\nFAILURES:')
        for line in bad:
            print(f'  {line}')
        sys.exit(1)
    if unconverted:
        print(f'\nWARNING: {len(unconverted)} tracks timed against STAGE-1 audio, which '
              f'does not ship: {", ".join(unconverted)}')

    lines_out = [
        '// GENERATED by scripts/gen_visemes.py — do not edit by hand.',
        '// Per-clip viseme timelines, measured rather than estimated: the ja and',
        '// giggle clips carry VOICEVOX (speaker 8) mora timings divided by their',
        '// speedScale, the zh and en2 clips carry the spans fish.audio reported',
        '// while synthesizing them (see the script for why that survives stage 2).',
        '// Format: [startSec, viseme] steps; viseme indexes VISEME_NAMES, -1 = closed.',
        '// Regenerate: start the voicevox engine, then run the script (see its header).',
        '',
        "export const VISEME_NAMES = ['aa', 'ih', 'ou', 'ee', 'oh'] as const",
        '',
        'export type VisemeTrack = ReadonlyArray<readonly [number, number]>',
        '',
        'export const VOICE_VISEMES: Record<string, VisemeTrack> = {',
    ]
    for key, segs in entries:
        body = ', '.join(f'[{s}, {v}]' for s, v in segs)
        lines_out.append(f"  '{key}': [{body}],")
    lines_out.append('}')
    lines_out.append('')
    with open(f'{args.repo}/src/components/chat/voiceVisemes.gen.ts', 'w') as f:
        f.write('\n'.join(lines_out))
    print(f'\nwrote voiceVisemes.gen.ts with {len(entries)} tracks')


if __name__ == '__main__':
    main()
