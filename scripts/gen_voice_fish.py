# Stage 1 of Mika's zh-TW / en voice pipeline: synthesize the lines with the
# right ACCENT, and capture the timings while we are there.
#
# The accent has to come from here because it cannot come from anywhere later. A
# cross-lingual clone of her Japanese voice was tried first and rejected on
# 2026-08-21: fish.audio has no evidence of how THIS speaker forms Mandarin or
# English, so it transfers Japanese phoneme realisation into both. The Mandarin
# came out Japanese-accented and the English came out hard to understand. So
# stage 1 synthesizes with a native-accent voice (wrong timbre, right mouth) and
# stage 2 converts the timbre to hers (scripts/vc_to_tsumugi.py). Voice
# conversion is frame-synchronous, so the timings captured here survive it.
#
# Endpoint: /v1/tts/stream/with-timestamp, which is in the OpenAPI schema but
# not in the docs index. It answers on the free tier, and it returns per-syllable
# timings for Chinese and per-word for English — the same class of data VOICEVOX
# hands us for the Japanese clips, which is what the lip sync is baked from.
# /v1/asr would only give segment spans, and bills separately (402 here).
#
# Usage:
#   . <somewhere>/fish.env
#   python3 scripts/gen_voice_fish.py --zh-voice <id> --en-voice <id>
#   python3 scripts/gen_voice_fish.py --zh-voice <id> --only mika-intro-1-zh3
import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_lines import EN_LINES, ZH_LINES  # noqa: E402

API = 'https://api.fish.audio/v1/tts/stream/with-timestamp'
OUT = 'build/voice-fish'


def repair(segments: list[dict]) -> list[dict]:
    """Give zero-length segments a duration.

    The stream sends cumulative snapshots and refines them; in the final one a
    word that was already settled can come back as start == end. An empty span
    would put a viseme step and its closing step at the same instant, which the
    track format cannot express, so borrow the room up to the next segment.
    """
    out = [dict(s) for s in segments]
    for i, s in enumerate(out):
        if s['end'] > s['start']:
            continue
        nxt = out[i + 1]['start'] if i + 1 < len(out) else s['start'] + 0.16
        s['end'] = max(s['start'] + 0.04, min(nxt, s['start'] + 0.4))
    return out


def synth(text: str, reference_id: str, key: str, model: str) -> tuple[bytes, list[dict], float]:
    body = {
        'text': text,
        'reference_id': reference_id,
        'format': 'wav',
        'sample_rate': 44100,
        'temperature': 0.7,
        'top_p': 0.7,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(body).encode(),
        headers={
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'model': model,
        },
        method='POST',
    )
    chunks: list[bytes] = []
    latest: dict[int, tuple[dict, float]] = {}
    try:
        with urllib.request.urlopen(req, timeout=240) as resp:
            for raw in resp:
                line = raw.decode('utf-8', 'replace')
                if not line.startswith('data: '):
                    continue
                try:
                    d = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue
                if d.get('audio_base64'):
                    chunks.append(base64.b64decode(d['audio_base64']))
                if d.get('alignment'):
                    # Cumulative: the newest snapshot for a chunk REPLACES the
                    # older one rather than extending it.
                    latest[d.get('chunk_seq', 0)] = (d['alignment'], d.get('chunk_audio_offset_sec', 0.0))
    except urllib.error.HTTPError as e:
        # Shape only: an API error can echo the request, which carries our text
        # and the reference id.
        detail = e.read()
        sys.exit(f'fish.audio HTTP {e.code}; body {len(detail)} bytes, starts {detail[:80]!r}')

    segments, duration = [], 0.0
    for seq in sorted(latest):
        alignment, offset = latest[seq]
        for s in repair(alignment['segments']):
            segments.append({'text': s['text'], 'start': s['start'] + offset, 'end': s['end'] + offset})
        duration = max(duration, alignment['audio_duration'] + offset)
    return b''.join(chunks), segments, duration


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--zh-voice', help='fish.audio model id for the Mandarin accent source')
    ap.add_argument('--en-voice', help='fish.audio model id for the English accent source')
    ap.add_argument('--only', help='one clip key')
    ap.add_argument('--model', default='s2.1-pro-free',
                    help='s1 and s2.1-pro both answer 402 on this account')
    args = ap.parse_args()

    key = os.environ.get('FISH_AUDIO_API_KEY')
    if not key:
        sys.exit('FISH_AUDIO_API_KEY is not set')

    jobs = []
    if args.zh_voice:
        jobs += [(k, t, args.zh_voice) for k, t in ZH_LINES]
    if args.en_voice:
        jobs += [(k, t, args.en_voice) for k, t in EN_LINES]
    if args.only:
        jobs = [j for j in jobs if j[0] == args.only]
    if not jobs:
        sys.exit('nothing to do — pass --zh-voice and/or --en-voice')

    os.makedirs(OUT, exist_ok=True)
    for clip_key, text, voice in jobs:
        audio, segments, duration = synth(text, voice, key, args.model)
        wav = os.path.join(OUT, f'{clip_key}.wav')
        with open(wav, 'wb') as fh:
            fh.write(audio)
        with open(os.path.join(OUT, f'{clip_key}.align.json'), 'w') as fh:
            json.dump({'text': text, 'duration': duration, 'segments': segments}, fh,
                      ensure_ascii=False, indent=1)
        real = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', wav],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        print(f'  {clip_key:<22} {float(real):5.2f}s  {len(segments):>3} segments', flush=True)


if __name__ == '__main__':
    main()
