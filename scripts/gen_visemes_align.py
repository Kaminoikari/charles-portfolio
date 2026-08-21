# Stage 3: viseme timelines for the zh-TW and en clips.
#
# The ja clips get theirs from VOICEVOX's mora timings, which are ground truth —
# the engine reports when each vowel starts because it is the thing that decided.
# fish.audio turns out to offer the same class of data: the undocumented (but
# schema'd) /v1/tts/stream/with-timestamp returns per-syllable spans for Chinese
# and per-word spans for English, and gen_voice_fish.py saves them next to each
# wav. So this reads timings rather than estimating them.
#
# It survives stage 2 because voice conversion is frame-synchronous: seed-vc
# rewrites the timbre of each frame and does not move it, so a timestamp taken
# before conversion still points at the same syllable after it. The check for
# that is in --verify, which compares each clip's converted duration against the
# alignment it carries.
#
# What still has to be inferred is which VOWEL each span holds, because the
# timings name text, not phonemes:
#   zh  one span is one character, so one syllable, so one vowel: pypinyin's
#       final, mapped to the five channels the rig has.
#   en  one span is a word, which can hold several. Its vowel clusters are
#       spread evenly inside the word's own span. Bounded by the word rather
#       than by the sentence, but not negligible: across the batch a word span
#       is 320ms at the median and 1200ms at the longest, and the 42 words
#       holding more than one vowel give slices of up to 400ms each.
#
# build_track() is imported by scripts/gen_visemes.py, which is the only thing
# that writes voiceVisemes.gen.ts. What it produces here is not quite what
# ships: the timings describe the TEXT and drift from the audio at both ends, so
# gen_visemes.py re-pins the first and last step to the clip's measured speech
# onset and offset (its speech_span, and the plan doc's 「嘴型的兩端要對聲音」).
# --emit and --verify below therefore show the track BEFORE that correction,
# which is what you want when reading one clip's vowels and not when checking
# where her mouth opens.
#
# Usage:
#   uv run --with pypinyin python3 scripts/gen_visemes_align.py \
#     --verify build/voice-fish --audio-dir build/voice-vc
#   uv run --with pypinyin python3 scripts/gen_visemes_align.py --emit build/voice-fish
import argparse
import glob
import json
import os
import re
import subprocess
import sys

# Index into VISEME_NAMES in voiceVisemes.gen.ts. -1 is a closed mouth.
AA, IH, OU, EE, OH = 0, 1, 2, 3, 4
CLOSED = -1

GAP_CLOSES = 0.12  # a silence at least this long is a pause, so shut her mouth
MIN_STEP = 0.02    # the mouth cannot change twice inside one frame

PINYIN_FINAL_VOWEL = [
    # Longest first: 'iao' must beat both 'ia' and 'ao'. The vowel chosen is the
    # one the mouth SETTLES on, which for a diphthong is its second element.
    ('iang', AA), ('uang', AA), ('iong', OH), ('ueng', OH),
    ('iao', AA), ('uai', IH), ('uan', AA), ('ian', EE),
    ('ang', AA), ('eng', EE), ('ing', IH), ('ong', OH),
    ('ai', IH), ('ei', IH), ('ao', OH), ('ou', OU), ('an', AA), ('en', EE),
    ('er', AA), ('ia', AA), ('ie', EE), ('ua', AA), ('uo', OH), ('ue', EE),
    ('ui', IH), ('un', OU), ('iu', OU), ('in', IH),
    ('a', AA), ('o', OH), ('e', EE), ('i', IH), ('u', OU), ('v', OU),
]

EN_VOWEL = {'a': AA, 'e': EE, 'i': IH, 'o': OH, 'u': OU, 'y': IH}


def zh_vowels(text: str) -> list[int]:
    from pypinyin import Style, lazy_pinyin
    out = []
    for syllable in lazy_pinyin(text, style=Style.FINALS, errors='ignore'):
        for final, vowel in PINYIN_FINAL_VOWEL:
            if syllable.endswith(final):
                out.append(vowel)
                break
    return out


def en_vowels(text: str) -> list[int]:
    """'okay' -> [OH, AA], one shape per vowel cluster, keyed on its first
    letter. Silent final e dropped, so 'choice' is one shape."""
    out = []
    for word in re.findall(r"[A-Za-z']+", text.lower()):
        clusters = re.findall(r'[aeiouy]+', word)
        if len(clusters) > 1 and word.endswith('e') and len(clusters[-1]) == 1:
            clusters = clusters[:-1]
        out.extend(EN_VOWEL[c[0]] for c in clusters)
    return out


def build_track(align: dict, locale: str) -> list[list]:
    segments = align['segments']
    vowels_of = zh_vowels if locale == 'zh' else en_vowels

    steps: list[list] = []

    def push(t: float, viseme: int) -> None:
        # Floored at zero and nowhere else. The ja tracks all open at 0.1s
        # because VOICEVOX puts a prePhonemeLength of about that in front of
        # every clip; borrowing that constant here was a bug. fish.audio has no
        # run-in, 40 of the 48 clips begin at 0.0, and clamping them forward
        # both delayed the mouth and swallowed any syllable inside the lead
        # (掰掰 lost its first 掰, 我的聲音 lost its 我).
        t = round(max(t, 0.0), 3)
        if steps and steps[-1][1] == viseme:
            return
        if steps and t - steps[-1][0] < MIN_STEP:
            # The later shape wins a frame the two would have to share. Doing
            # that can uncover a step with the SAME viseme underneath — vowel,
            # brief close, same vowel again — so the overwrite has to re-check
            # the neighbour it just exposed or the track carries a step that
            # changes nothing.
            steps[-1] = [t, viseme]
            if len(steps) > 1 and steps[-2][1] == viseme:
                steps.pop()
            return
        steps.append([t, viseme])

    prev_end = None
    for seg in segments:
        if prev_end is not None and seg['start'] - prev_end >= GAP_CLOSES:
            push(prev_end, CLOSED)
        vowels = vowels_of(seg['text'])
        if not vowels:
            prev_end = max(prev_end or 0.0, seg['end'])
            continue
        span = (seg['end'] - seg['start']) / len(vowels)
        for i, v in enumerate(vowels):
            push(seg['start'] + i * span, v)
        prev_end = seg['end']

    if prev_end is not None:
        push(prev_end, CLOSED)
    if not steps:
        return [[0.0, CLOSED]]

    # visemeTrack.test.ts holds every track to these two, and a generator that
    # can emit a track the suite rejects is a generator that wastes a batch.
    # Checked here so the failure names the clip instead of the whole file.
    for i in range(1, len(steps)):
        if steps[i][0] <= steps[i - 1][0]:
            raise ValueError(f'step {i} at {steps[i][0]} does not advance past {steps[i - 1][0]}')
    if steps[-1][1] != CLOSED:
        raise ValueError('track does not end with a closed mouth')
    return steps


def locale_of(clip_key: str) -> str:
    return 'zh' if clip_key.endswith('-zh') else 'en'


def duration(path: str) -> float:
    return float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True, check=True,
    ).stdout.strip())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--emit', help='directory holding <clip>.wav and <clip>.align.json')
    ap.add_argument('--verify', help='same directory: check timings still fit the audio')
    ap.add_argument('--audio-dir', help='where the wavs are, if not next to the alignments '
                                        '(point this at the CONVERTED clips)')
    args = ap.parse_args()
    where = args.emit or args.verify
    if not where:
        ap.error('pass --emit or --verify')
    audio_dir = args.audio_dir or where

    for align_path in sorted(glob.glob(os.path.join(where, '*.align.json'))):
        clip_key = os.path.basename(align_path)[: -len('.align.json')]
        align = json.load(open(align_path, encoding='utf-8'))
        track = build_track(align, locale_of(clip_key))

        if args.verify:
            wav = os.path.join(audio_dir, f'{clip_key}.wav')
            if not os.path.exists(wav):
                print(f'  {clip_key:<22} NO AUDIO')
                continue
            audio = duration(wav)
            last = track[-1][0]
            over = last - audio
            flag = 'OK ' if over <= 0.05 else 'PAST END'
            print(f'  {clip_key:<22} audio {audio:5.2f}s  track ends {last:5.2f}s  '
                  f'{len(track):>3} steps  {flag}')
        else:
            print(f"  '{clip_key}': {json.dumps(track, separators=(', ', ', '))},")


if __name__ == '__main__':
    main()
