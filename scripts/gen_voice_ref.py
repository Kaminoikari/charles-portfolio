# Builds the reference clip that carries Mika's timbre: the TARGET voice
# scripts/vc_to_tsumugi.py converts every zh-TW and en line into.
#
# Why not read public/avatar/voice/*.m4a: those ship at 24kHz AAC and 0.7-3.7s
# each. Voice conversion is bounded by its reference, so taking the timbre from
# a lossy 24kHz file would bake that ceiling into every line she ever speaks in
# those locales. VOICEVOX hands us the same voice at 48kHz for free.
#
# Prosody range matters more than length. A reference that is all bright
# exclamations produces a voice that can only exclaim, so the five lines below
# span her register: a long even self-introduction, a flat statement, a warm
# greeting, a soft apology, and a question.
#
# (It was first written for a fish.audio voice clone, which was tried and
# rejected on 2026-08-21; docs/plans/avatar-guide.md has the listening test.
# The reference it builds is what that attempt left behind worth keeping.)
#
# Usage:
#   docker run -d --name voicevox -p 50021:50021 \
#     voicevox/voicevox_engine:cpu-ubuntu20.04-latest
#   python3 scripts/gen_voice_ref.py [outdir]     (default: build/voice-ref)
#
# Writes ref.wav (48kHz mono) and ref.txt, its transcript, so a reader can tell
# what is in the reference without listening to it.
import json
import os
import subprocess
import sys
import urllib.request

ENGINE = os.environ.get('VOICEVOX_URL', 'http://127.0.0.1:50021')
SPK = 8  # 春日部つむぎ / ノーマル
RATE = 48000

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_lines import JA_LINES  # noqa: E402

# Keys chosen for prosody spread, not for content. See the note above.
REF_KEYS = ['mika-intro-1', 'mika-greet-5', 'mika-greet-7', 'mika-error-1', 'mika-done-1']


def synth(text: str, speed: float) -> bytes:
    q = urllib.request.urlopen(
        urllib.request.Request(
            f'{ENGINE}/audio_query?speaker={SPK}&text=' + urllib.parse.quote(text),
            method='POST',
        ),
        timeout=60,
    )
    query = json.load(q)
    query['speedScale'] = speed
    query['outputSamplingRate'] = RATE
    query['outputStereo'] = False
    wav = urllib.request.urlopen(
        urllib.request.Request(
            f'{ENGINE}/synthesis?speaker={SPK}',
            data=json.dumps(query).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST',
        ),
        timeout=120,
    )
    return wav.read()


def main() -> None:
    import urllib.parse  # noqa: F401  (used via urllib.request above)

    outdir = sys.argv[1] if len(sys.argv) > 1 else 'build/voice-ref'
    os.makedirs(outdir, exist_ok=True)

    by_key = {k: (t, s) for k, t, s in JA_LINES}
    parts, transcript = [], []
    for key in REF_KEYS:
        if key not in by_key:
            sys.exit(f'{key} is not in JA_LINES — the reference list is stale')
        text, speed = by_key[key]
        path = os.path.join(outdir, f'{key}.wav')
        with open(path, 'wb') as fh:
            fh.write(synth(text, speed))
        parts.append(path)
        transcript.append(text)
        print(f'  {key}  {os.path.getsize(path) / 1024:.0f}KB')

    # Concatenate with a short silence between lines, so the clone hears
    # sentence boundaries rather than one run-on utterance.
    listfile = os.path.join(outdir, 'concat.txt')
    silence = os.path.join(outdir, 'sil.wav')
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi',
         '-i', f'anullsrc=r={RATE}:cl=mono', '-t', '0.35', silence],
        check=True,
    )
    with open(listfile, 'w') as fh:
        for i, p in enumerate(parts):
            fh.write(f"file '{os.path.basename(p)}'\n")
            if i != len(parts) - 1:
                fh.write(f"file '{os.path.basename(silence)}'\n")

    ref = os.path.join(outdir, 'ref.wav')
    subprocess.run(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
         '-i', os.path.basename(listfile), '-ar', str(RATE), '-ac', '1',
         os.path.basename(ref)],
        cwd=outdir,
        check=True,
    )
    with open(os.path.join(outdir, 'ref.txt'), 'w') as fh:
        fh.write(''.join(transcript))

    dur = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', ref],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    print(f'\nref.wav  {float(dur):.2f}s  {os.path.getsize(ref) / 1024:.0f}KB  @{RATE}Hz mono')


if __name__ == '__main__':
    import urllib.parse
    main()
