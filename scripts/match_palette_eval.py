"""Score the palette recovery against a body whose recipe is already known.

WHY THIS EXISTS. match_palette.py claims it can read a character's colours off a
picture and hand back the numbers that reproduce them. That claim is only worth
something if it can be checked, and it can be checked here exactly once, because
this repo happens to hold both halves of an answer: /avatar/mika-pink.vrm was
made from /avatar/AvatarSample_B_webp.vrm by a recipe written down in
repaint_vrm.py. So the pipeline is given the renders and never the recipe, and
what it returns is compared against the recipe it was not shown.

The calibration bodies are generated here rather than shipped, from recipes in
this file, so nothing in the scoring depends on a file that might have drifted.
Running this takes a couple of minutes, most of it repainting textures.

    python3 scripts/match_palette_eval.py <renderstats-dir>

The render statistics themselves come from render-variant.html, which has to be
driven by a browser; this script reads what that page produced.
"""
import json
import pathlib
import statistics
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))

from match_palette import (HAIR_LAYERS, IRIS, calibrate, calibrate_line, calibrate_plane,
                           estimate_target, estimate_target_line, estimate_target_plane,
                           load_textures, merge_shots, solve_params, texture_stats)
from repaint_vrm import repaint

BASE = 'public/avatar/AvatarSample_B_webp.vrm'
TARGET = 'public/avatar/mika-pink.vrm'
REGIONS = HAIR_LAYERS + [IRIS]

# The recipe that made the target. Never given to the pipeline; only used to
# score what the pipeline returns.
TRUTH = {**{h: (350, 1.9, 0.26) for h in HAIR_LAYERS}, IRIS: (205, 1.5, 0.75)}

# Two bodies with known recipes, used only to measure what the renderer does to
# a colour. Green sits between the base's dark hair and the target's bright
# hair; bright sits above the target, so the target falls INSIDE the range the
# correction was fitted on rather than beyond the end of it.
CALIBRATION = {
    'calib-green': {**{h: (120, 1.4, 0.5) for h in HAIR_LAYERS}, IRIS: (60, 1.2, 0.6)},
    'calib-bright': {**{h: (30, 3.0, 0.15) for h in HAIR_LAYERS}, IRIS: (280, 2.5, 0.35)},
}


def stats_of(path):
    imgs = load_textures(path)
    return {n: texture_stats(imgs[n]) for n in REGIONS if n in imgs}


def main(statsdir):
    d = pathlib.Path(statsdir)
    shots = lambda name: merge_shots(*(json.loads((d / f'{name}-{s}.json').read_text())
                                       for s in ('wide', 'face')))

    for name, recipe in CALIBRATION.items():
        out = f'public/avatar/{name}.vrm'
        if not pathlib.Path(out).exists():
            repaint(BASE, out, recipe, absolute=True)
            print(f'built {out} (render it with render-variant.html, then re-run)')

    samples = [(shots('base'), stats_of(BASE))] + [
        (shots(n.replace('calib-', '')), stats_of(f'public/avatar/{n}.vrm'))
        for n in CALIBRATION
    ]
    models = [
        ('1 點比例', calibrate(samples[0][0], samples[0][1]), estimate_target),
        ('2 點直線', calibrate_line(samples[:2]), estimate_target_line),
        ('3 點平面', calibrate_plane(samples), estimate_target_plane),
    ]

    target_render = shots('pink')
    base_img = load_textures(BASE)
    print(f"{'校正模型':10}{'色相中位誤差':>14}{'飽和':>10}{'lift':>10}   （真值 sat 1.90 / lift 0.26）")
    print('-' * 72)
    best = None
    for label, fit, estimate in models:
        errs, recipe = [], {}
        for n in REGIONS:
            if n not in fit or n not in target_render:
                continue
            guess = estimate(target_render[n], fit[n])
            if guess is None:
                continue
            h, s, l, _ = guess
            got = solve_params(base_img[n], h, s, l)
            recipe[n] = got
            t = TRUTH[n]
            errs.append((abs((got[0] - t[0] + 180) % 360 - 180),
                         abs(got[1] - t[1]), abs(got[2] - t[2])))
        if not errs:
            continue
        print(f'{label:10}{statistics.median(e[0] for e in errs):12.1f}°'
              f'{statistics.median(e[1] for e in errs):10.2f}'
              f'{statistics.median(e[2] for e in errs):10.2f}')
        best = (label, recipe)

    label, recipe = best
    out = 'public/avatar/reconstructed.vrm'
    repaint(BASE, out, recipe, absolute=True)
    recon, truth = stats_of(out), stats_of(TARGET)
    diffs = [(abs((recon[n][0] - truth[n][0] + 180) % 360 - 180),
              abs(recon[n][1] - truth[n][1]), abs(recon[n][2] - truth[n][2]))
             for n in REGIONS if n in recon and n in truth]
    print(f'\n用「{label}」重建後，貼圖與真正的目標相比：')
    print(f'  色相中位差 {statistics.median(x[0] for x in diffs):.1f}°　'
          f'飽和 {statistics.median(x[1] for x in diffs):.3f}　'
          f'亮度 {statistics.median(x[2] for x in diffs):.3f}')
    missed = [n for n in REGIONS if n not in target_render]
    if missed:
        print(f'  沒有還原到的區域（算圖裡看不見）：{", ".join(missed)}')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'renderstats')
