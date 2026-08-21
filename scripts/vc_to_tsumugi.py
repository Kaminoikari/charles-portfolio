# Stage 2: move the accent-source recordings into Mika's own voice.
#
# Stage 1 (gen_voice_fish.py) buys the right ACCENT from a native speaker model
# and the wrong timbre with it. This buys the timbre back. Voice conversion is
# the only operation that separates those two things: it rewrites what the voice
# sounds like frame by frame while leaving what was articulated alone, which is
# exactly the split the brief asks for — her Japanese voice, speaking Mandarin
# and English properly.
#
# It runs locally because it has to: fish.audio has no voice-conversion
# endpoint. That is not an inference from the docs, it is from their OpenAPI
# schema, which lists 29 paths and no speech-to-speech among them.
#
# Frame-synchronous matters twice over. It is why the per-syllable timings
# captured in stage 1 are still valid after this runs, so the lip sync survives
# (scripts/gen_visemes_align.py --verify checks that claim rather than trusting
# it).
#
# seed-vc reloads every model on each call to its main(), which for a 48-clip
# batch would be most of the wall clock. The cache below makes that once.
#
# Usage:
#   python3 scripts/vc_to_tsumugi.py \
#     --seed-vc <dir> --source-dir build/voice-fish \
#     --target build/voice-ref/ref.wav --out build/voice-vc
import argparse
import glob
import os
import shutil
import subprocess
import sys
import types


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--seed-vc', required=True, help='checkout of Plachtaa/seed-vc')
    ap.add_argument('--source-dir', required=True, help='wavs from gen_voice_fish.py')
    ap.add_argument('--target', required=True, help='her voice: build/voice-ref/ref.wav')
    ap.add_argument('--out', required=True)
    ap.add_argument('--diffusion-steps', type=int, default=30)
    ap.add_argument('--inference-cfg-rate', type=float, default=0.7)
    ap.add_argument('--only', help='one clip key')
    args = ap.parse_args()

    seed_vc = os.path.abspath(args.seed_vc)
    source_dir = os.path.abspath(args.source_dir)
    target = os.path.abspath(args.target)
    out = os.path.abspath(args.out)
    os.makedirs(out, exist_ok=True)

    # seed-vc resolves configs/ and checkpoints/ relative to its own directory.
    os.chdir(seed_vc)
    sys.path.insert(0, seed_vc)

    # seed-vc opens `torch.autocast(device_type='mps')`, which torch 2.4 refuses
    # outright ("unsupported autocast device_type"). Autocast is only there to
    # pick fp16, we run fp32 on purpose (MPS half precision is unreliable for
    # these ops), so on MPS the block has nothing to do and a nullcontext is
    # exactly equivalent. Patched here rather than in the checkout so the
    # checkout stays a clean clone.
    import contextlib  # noqa: E402
    import torch  # noqa: E402

    _autocast = torch.autocast

    def autocast_or_nothing(device_type=None, **kwargs):
        if device_type == 'mps':
            return contextlib.nullcontext()
        return _autocast(device_type=device_type, **kwargs)

    torch.autocast = autocast_or_nothing

    import inference  # noqa: E402

    loaded = {}
    original = inference.load_models

    def load_once(a):
        key = (a.f0_condition, a.checkpoint, a.fp16)
        if key not in loaded:
            print('loading models (once)...', flush=True)
            loaded[key] = original(a)
        return loaded[key]

    inference.load_models = load_once

    sources = sorted(glob.glob(os.path.join(source_dir, '*.wav')))
    if args.only:
        sources = [s for s in sources
                   if os.path.basename(s)[:-len('.wav')] == args.only]
    if not sources:
        sys.exit(f'no wavs to convert in {source_dir}')

    scratch = os.path.join(out, '_raw')
    os.makedirs(scratch, exist_ok=True)
    target_stem = os.path.basename(target).split('.')[0]

    for src in sources:
        clip_key = os.path.basename(src)[:-len('.wav')]
        call = types.SimpleNamespace(
            source=src, target=target, output=scratch,
            diffusion_steps=args.diffusion_steps,
            length_adjust=1.0,  # 1.0 keeps the stage-1 timings valid
            inference_cfg_rate=args.inference_cfg_rate,
            f0_condition=False, auto_f0_adjust=False, semi_tone_shift=0,
            checkpoint=None, config=None, fp16=False,  # MPS is unreliable in fp16
        )
        inference.main(call)

        # seed-vc names its output from the two inputs and the settings; give it
        # back the clip key, which is what every other stage is keyed on.
        produced = os.path.join(
            scratch,
            f'vc_{clip_key}_{target_stem}_{call.length_adjust}_'
            f'{call.diffusion_steps}_{call.inference_cfg_rate}.wav',
        )
        if not os.path.exists(produced):
            sys.exit(f'seed-vc produced no file for {clip_key}; expected {produced}')
        final = os.path.join(out, f'{clip_key}.wav')
        shutil.move(produced, final)

        before = probe(src)
        after = probe(final)
        drift = abs(after - before)
        flag = '' if drift <= 0.05 else f'  DRIFT {drift * 1000:.0f}ms'
        print(f'  {clip_key:<22} {before:5.2f}s -> {after:5.2f}s{flag}', flush=True)

    shutil.rmtree(scratch, ignore_errors=True)


def probe(path: str) -> float:
    return float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True, check=True,
    ).stdout.strip())


if __name__ == '__main__':
    main()
