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
# What frame-synchronous does NOT mean is pitch-preserving, and the first zh-TW
# batch was shipped on that assumption. It ran with f0_condition=False, which
# selects the model that has no F0 input at all: pitch is regenerated from
# content plus the target speaker embedding. For English that is unremarkable.
# For Mandarin it is fatal, because the pitch contour inside a syllable IS the
# tone, and the target embedding is a Japanese speaker's — so the tones came out
# shaped by a non-tonal language and the owner heard the whole set as
# foreign-accented on 2026-08-21.
#
# The measurement that would have caught it is per-syllable, not per-clip:
# sentence-level F0 correlation between source and output was 0.89 for Mandarin
# and 0.86 for English, which looks fine and is, because the damage sits under
# the sentence envelope.
#
# f0_condition=True selects the F0-conditioned 44kHz model and feeds it the
# SOURCE's contour; auto_f0_adjust=True transposes that contour to the target's
# median pitch so it lands in her register with its shape intact. Those two
# together are the fix, and they are what makes the accent source's Mandarin
# tones survive into her voice.
#
# seed-vc reloads every model on each call to its main(), which for a 48-clip
# batch would be most of the wall clock. The cache below makes that once.
#
# Usage:
#   python3 scripts/vc_to_tsumugi.py \
#     --seed-vc <dir> --source-dir build/voice-fish \
#     --target build/voice-ref/ref.wav --out build/voice-vc
#
# Pitch correction comes from voice_lines.PITCH_SHIFT, keyed by clip and locale,
# so a whole-batch re-run reproduces what shipped without anyone remembering a
# flag, and keeps doing so after a clip takes a new generation suffix.
# --semi-tone-shift overrides it, which is what auditioning a new correction
# looks like.
import argparse
import glob
import os
import re
import shutil
import subprocess
import sys
import types

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from voice_lines import PITCH_SHIFT  # noqa: E402


def pitch_for(clip_key: str, override: float | None) -> float:
    """Semitones to transpose this clip by, after auto_f0_adjust.

    The table is the default so that re-running the batch reproduces the
    shipped audio; the flag exists to try a DIFFERENT correction, which is a
    deliberate act and reads like one on the command line.

    Looked up with the generation number stripped and the locale kept, so a
    correction survives the clip being re-cut without leaking across locales.
    Keying on the full clip key would put the silence back — `mika-intro-1-zh5`
    would miss a row written for -zh4 and get 0.0, which is the one clip that
    must not — and dropping the locale as well would hand the English and
    Japanese recordings of the same line a correction measured off the Mandarin
    one. Audition keys (the -a-/-q- names used for candidates) reduce to
    something of their own and match nothing, so trying a new correction means
    passing the flag.
    """
    if override is not None:
        return override
    return PITCH_SHIFT.get(re.sub(r'(-(?:zh|en))\d*$', r'\1', clip_key), 0.0)


def float32_f0(f0_fn):
    """Hand seed-vc's F0 back as float32.

    RMVPE returns a float64 numpy array, inference.py wraps it in
    torch.from_numpy and moves it to the device, and MPS has no float64 at all,
    so the F0-conditioned path dies on its first clip. Only the F0 path hits
    this, which is why the earlier f0_condition=False batch never saw it.
    Patched here rather than in the checkout, for the same reason as the
    autocast shim: the clone stays a clean clone.
    """
    if f0_fn is None:
        return None

    def as_float32(*a, **kw):
        import numpy as np
        return np.asarray(f0_fn(*a, **kw), dtype=np.float32)

    return as_float32


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--seed-vc', required=True, help='checkout of Plachtaa/seed-vc')
    ap.add_argument('--source-dir', required=True, help='wavs from gen_voice_fish.py')
    ap.add_argument('--target', required=True, help='her voice: build/voice-ref/ref.wav')
    ap.add_argument('--out', required=True)
    ap.add_argument('--diffusion-steps', type=int, default=30)
    ap.add_argument('--inference-cfg-rate', type=float, default=0.7)
    ap.add_argument('--only', help='one clip key')
    ap.add_argument('--semi-tone-shift', type=float, default=None,
                    help='transpose the output this many semitones, applied AFTER '
                         'auto_f0_adjust; negative lowers her. Overrides '
                         'voice_lines.PITCH_SHIFT, which is where the corrections '
                         'that SHIPPED live. Needed at all because auto_f0_adjust '
                         'aligns every clip to the REFERENCE median (351Hz here), '
                         'which lands some clips higher than the owner wants: intro-1 '
                         'came out at 359Hz against the 327Hz of a clip he had already '
                         'accepted.')
    ap.add_argument('--device', default='cpu', choices=['cpu', 'auto'],
                    help="'cpu' because the F0-conditioned vocoder cannot run on "
                         "MPS; 'auto' is only useful on a CUDA box")
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

    # The F0-conditioned model cannot run on MPS at all. Its vocoder is
    # BigVGAN's alias-free upsampler, whose grouped conv_transpose1d asks for
    # more than 65536 output channels, and Metal refuses that outright — as a
    # raised NotImplementedError, so PYTORCH_ENABLE_MPS_FALLBACK does not catch
    # it either (that only covers ops missing from the dispatch table). Hiding
    # MPS before the import is what makes inference.py pick CPU for everything
    # in one consistent decision; overriding inference.device afterwards would
    # leave every other module's own device global still pointing at Metal.
    #
    # The cost is wall clock and nothing else, and it is only paid by this
    # stage: measured at 2.6 minutes a clip, 63 minutes for the 25.
    if args.device == 'cpu':
        torch.backends.mps.is_available = lambda: False

    # torchaudio 2.13 forwards save() to TorchCodec, whose dylib will not bind
    # to a Homebrew FFmpeg here. seed-vc writes one plain wav per clip, which
    # soundfile does directly, so the dependency buys nothing worth debugging.
    import soundfile  # noqa: E402
    import torchaudio  # noqa: E402

    def save_with_soundfile(path, tensor, sample_rate, **_):
        soundfile.write(path, tensor.detach().cpu().numpy().T, int(sample_rate))

    torchaudio.save = save_with_soundfile

    import inference  # noqa: E402

    loaded = {}
    original = inference.load_models

    def load_once(a):
        key = (a.f0_condition, a.checkpoint, a.fp16)
        if key not in loaded:
            print('loading models (once)...', flush=True)
            bundle = original(a)
            loaded[key] = bundle[:2] + (float32_f0(bundle[2]),) + bundle[3:]
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
            # Both True on purpose; the header explains what False cost us.
            f0_condition=True, auto_f0_adjust=True,
            semi_tone_shift=pitch_for(clip_key, args.semi_tone_shift),
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
        applied = pitch_for(clip_key, args.semi_tone_shift)
        shift = f'  {applied:+.2f}st' if applied else ''
        print(f'  {clip_key:<22} {before:5.2f}s -> {after:5.2f}s{shift}{flag}', flush=True)

    shutil.rmtree(scratch, ignore_errors=True)


def probe(path: str) -> float:
    return float(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', path],
        capture_output=True, text=True, check=True,
    ).stdout.strip())


if __name__ == '__main__':
    main()
