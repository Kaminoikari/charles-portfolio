# Synthesizes the JAPANESE clips from VOICEVOX — the half of the catalogue the
# other scripts assume already exists.
#
# It did exist, as files, with nothing that could make them again: the original
# 27 ja clips were produced by hand in 2026-08-13 and only the TEXT survived,
# in voice_lines.py. gen_visemes.py reads their durations out of the shipped
# m4a, so a ja line added without this script would have no way to become
# audio. Written 2026-08-21 when the annoyed head-pat line needed exactly that.
#
# Same engine and speaker the catalogue was built with (春日部つむぎ / ノーマル,
# speaker 8), and each line's own speedScale from voice_lines.py, so a clip made
# now sits in the same voice and the same tempo as the ones from August.
#
# Usage:
#   docker run -d --name voicevox -p 50021:50021 \
#     voicevox/voicevox_engine:cpu-ubuntu20.04-latest
#   python3 scripts/gen_voice_ja.py --only mika-huff-1
#   python3 scripts/pack_voice.py --from build/voice-ja --to public/avatar/voice
import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_lines import GIGGLE_LINES, JA_LINES  # noqa: E402

ENGINE = os.environ.get('VOICEVOX_URL', 'http://127.0.0.1:50021')
SPK = 8  # 春日部つむぎ / ノーマル
# 24kHz because pack_voice.py encodes to 24kHz anyway; asking the engine for
# more would only be thrown away. The voice-conversion REFERENCE is the one
# place that needs 48kHz, and gen_voice_ref.py asks for it there.
RATE = 24000


def synth(text: str, speed: float) -> bytes:
    query = json.load(urllib.request.urlopen(
        urllib.request.Request(
            f'{ENGINE}/audio_query?speaker={SPK}&text=' + urllib.parse.quote(text),
            method='POST',
        ),
        timeout=60,
    ))
    query['speedScale'] = speed
    query['outputSamplingRate'] = RATE
    query['outputStereo'] = False
    return urllib.request.urlopen(
        urllib.request.Request(
            f'{ENGINE}/synthesis?speaker={SPK}',
            data=json.dumps(query).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST',
        ),
        timeout=120,
    ).read()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='build/voice-ja')
    ap.add_argument('--only', help='one clip key; omit to synthesize the whole ja set')
    args = ap.parse_args()

    jobs = [(k, t, s) for k, t, s in JA_LINES + GIGGLE_LINES
            if not args.only or k == args.only]
    if not jobs:
        sys.exit(f'{args.only} is not in JA_LINES or GIGGLE_LINES')

    os.makedirs(args.out, exist_ok=True)
    for key, text, speed in jobs:
        # Synthesize BEFORE opening the file. `open(path, 'wb')` truncates, so
        # doing it in one expression turns any engine failure (container not
        # running, 5xx) into a 0-byte wav sitting where good bytes were — and
        # pack_voice.py globs *.wav, so it would encode the empty one.
        wav = synth(text, speed)
        if wav[:4] != b'RIFF':
            sys.exit(f'{key}: engine returned {len(wav)} bytes that are not a wav '
                     f'(starts {wav[:16]!r})')
        path = os.path.join(args.out, f'{key}.wav')
        with open(path, 'wb') as fh:
            fh.write(wav)
        secs = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', path],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        print(f'  {key:<22} {float(secs):5.2f}s  {os.path.getsize(path) / 1024:5.1f}KB')


if __name__ == '__main__':
    main()
