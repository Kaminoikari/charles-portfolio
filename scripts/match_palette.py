"""Recover repaint parameters from a picture of a character.

THE PROBLEM. repaint_vrm.py can move a VRM's textures to any colour, but
somebody has to supply the numbers. Supplying them by hand is a grid search
against your own eyes: the pink base in this repo took several rounds, and the
first attempt went the wrong way entirely because saturation there is a
MULTIPLIER and her hair started at 0.21, so scaling it by 0.55 made it greyer
rather than pinker. This module is that search done as arithmetic.

WHAT IS EXACT AND WHAT IS ESTIMATED. Two different jobs live here and they
deserve different amounts of trust:

  solve_params()  is exact. Given a texture and a target colour it returns the
                  (hue, sat, lift) that recolour() needs, by bisection on a
                  monotone function. It is checkable against a known answer and
                  the tests do check it.

  region_stats()  is an estimate. It reads colours off a RENDER, where MToon
                  shading, rim light and shadow have already been applied, so
                  what it measures is not the texture's colour. calibrate()
                  removes most of that difference by measuring the same regions
                  on a render of a body whose textures are known. The residual
                  is real and reported rather than hidden.
"""
import colorsys
import io
import json
import math
import struct
import sys

import numpy as np
from PIL import Image

HAIR_LAYERS = [f'F00_000_Hair_00_0{i}' for i in range(1, 7)]
IRIS = 'F00_000_00_EyeIris_00'
FACE = 'F00_000_00_Face_00'
BODY = 'F00_000_00_Body_00'


def rgb_to_hls_array(rgb):
    """Vectorised colorsys.rgb_to_hls. Returns (h, l, s) each in [0, 1]."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hi, lo = np.max(rgb, axis=-1), np.min(rgb, axis=-1)
    l = (hi + lo) / 2
    span = hi - lo
    s = np.zeros_like(l)
    nz = span > 0
    denom = np.where(l[nz] < 0.5, hi[nz] + lo[nz], 2.0 - hi[nz] - lo[nz])
    s[nz] = span[nz] / np.where(denom == 0, 1, denom)
    h = np.zeros_like(l)
    rc = np.zeros_like(l); gc = np.zeros_like(l); bc = np.zeros_like(l)
    rc[nz] = (hi[nz] - r[nz]) / span[nz]
    gc[nz] = (hi[nz] - g[nz]) / span[nz]
    bc[nz] = (hi[nz] - b[nz]) / span[nz]
    h = np.where(r == hi, bc - gc, np.where(g == hi, 2.0 + rc - bc, 4.0 + gc - rc))
    h = np.where(nz, (h / 6.0) % 1.0, 0.0)
    return h, l, s


def circular_mean_degrees(hues, weights):
    """Mean of an angle. A plain average of 350 and 10 is 180, the opposite colour."""
    a = hues * 2 * math.pi
    x = float(np.sum(np.cos(a) * weights))
    y = float(np.sum(np.sin(a) * weights))
    return math.degrees(math.atan2(y, x)) % 360


def pixels_of(png_bytes, drop_dark=0.06, drop_alpha=0.5):
    """A texture's visible pixels as (h, l, s) arrays plus their weights.

    Near-transparent pixels are UV padding and belong to nothing. Near-black
    pixels are the drawn outlines: they survive any repaint by design (the lift
    is a gamma, so black stays black), so counting them drags every measured
    lightness toward zero and makes the solver ask for a body that glows.
    """
    img = Image.open(io.BytesIO(png_bytes)).convert('RGBA')
    arr = np.asarray(img, dtype=np.float32) / 255.0
    alpha = arr[..., 3]
    h, l, s = rgb_to_hls_array(arr[..., :3])
    keep = (alpha >= drop_alpha) & (l >= drop_dark)
    return h[keep], l[keep], s[keep], alpha[keep]


def texture_stats(png_bytes):
    """(hue degrees, mean saturation, mean lightness) of one texture."""
    h, l, s, w = pixels_of(png_bytes)
    if h.size == 0:
        raise ValueError('這張貼圖沒有可用的像素（全透明或全黑）')
    return circular_mean_degrees(h, w), float(np.average(s, weights=w)), float(np.average(l, weights=w))


def solve_params(png_bytes, target_hue, target_sat, target_light):
    """The (hue, sat, lift) that moves this texture's mean colour onto the target.

    Hue is direct: recolour() assigns it outright. The other two are bisected
    rather than divided, because both transforms are per-pixel and the mean does
    not pass through them. mean(l_i ** lift) is not mean(l_i) ** lift, and
    saturation clips at 1, so a texture with bright pixels cannot be scaled as
    far as a naive ratio claims. Both functions are monotone in their parameter,
    which is what makes bisection right rather than merely convenient.
    """
    _, l, s, w = pixels_of(png_bytes)

    def mean_sat(k):
        return float(np.average(np.minimum(1.0, s * k), weights=w))

    def mean_light(k):
        return float(np.average(np.power(l, k), weights=w))

    sat = _bisect(mean_sat, target_sat, 0.0, 40.0, rising=True)
    lift = _bisect(mean_light, target_light, 0.01, 12.0, rising=False)
    return target_hue % 360, sat, lift


def _bisect(fn, target, lo, hi, rising, steps=60):
    """Invert a monotone scalar function. Returns the endpoint if unreachable."""
    if rising and fn(hi) < target:
        return hi
    if rising and fn(lo) > target:
        return lo
    if not rising and fn(lo) < target:
        return lo
    if not rising and fn(hi) > target:
        return hi
    for _ in range(steps):
        mid = (lo + hi) / 2
        below = fn(mid) < target
        if below == rising:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def load_textures(vrm_path):
    """Every image in a .vrm, by name."""
    raw = open(vrm_path, 'rb').read()
    magic, version, _ = struct.unpack('<III', raw[:12])
    assert magic == 0x46546C67 and version == 2, 'not a glb 2.0'
    jlen = struct.unpack('<I', raw[12:16])[0]
    doc = json.loads(raw[20:20 + jlen])
    blen = struct.unpack('<I', raw[20 + jlen:24 + jlen])[0]
    binary = raw[28 + jlen:28 + jlen + blen]
    out = {}
    for im in doc['images']:
        bv = doc['bufferViews'][im['bufferView']]
        off = bv.get('byteOffset', 0)
        out[im.get('name', '')] = binary[off:off + bv['byteLength']]
    return out


# ---------------------------------------------------------------------------
# From a render back to the texture.
#
# solve_params() above wants a target expressed in TEXTURE colour. A picture of
# a character is not that: it has been through MToon shading, a key light, a
# cyan fill and ACES tone mapping, all of which move hue, saturation and
# lightness before anyone gets to look at it. Undoing that in closed form would
# mean inverting the whole shading model. Measuring it is cheaper and better
# founded: render a body whose textures you already know, compare the two, and
# carry the difference across.
#
# The correction is per region, and it has to be, because the distortion is not
# uniform: a surface facing the fill light picks up cyan that a surface facing
# away does not.

def merge_shots(*shots):
    """One statistic per region, from whichever framing saw more of it.

    A wide shot holds the hair and the jacket but renders the iris at a handful
    of pixels; a close shot has the iris and loses the hem. Neither framing
    answers for the whole body, and averaging them would weight a region by how
    often it was photographed rather than by how well.
    """
    out = {}
    for shot in shots:
        for name, (hue, sat, light, px) in shot.items():
            if name not in out or px > out[name][3]:
                out[name] = (hue, sat, light, px)
    return out


def calibrate(render_stats, texture_stats_by_name):
    """How far this render moves each region away from its texture's colour.

    Hue as an angle to add, saturation and lightness as factors to multiply.
    Multiplicative for the two magnitudes because the distortion is a gain — a
    surface in shadow loses a PROPORTION of its lightness — and an additive
    correction fitted on a bright region would push a dark one below zero.
    """
    out = {}
    for name, (hue, sat, light, px) in render_stats.items():
        if name not in texture_stats_by_name:
            continue
        t_hue, t_sat, t_light = texture_stats_by_name[name]
        out[name] = {
            'hue': (t_hue - hue + 180) % 360 - 180,
            'sat': t_sat / sat if sat > 1e-6 else None,
            'light': t_light / light if light > 1e-6 else None,
            'px': px,
            'at_light': light,
        }
    return out


def estimate_target(render_entry, correction):
    """A region's texture colour, guessed from how it looked in a render.

    Returns the same four values as the fitted versions below — colour plus a
    flag for whether this was an extrapolation — so the three corrections are
    interchangeable at the call site. A single point is always an extrapolation
    in the strict sense; the flag says True whenever the render is brighter than
    the one point the ratio was measured at, which is when it starts to lie.
    """
    hue, sat, light, _ = render_entry
    if correction['sat'] is None or correction['light'] is None:
        return None
    return (
        (hue + correction['hue']) % 360,
        min(1.0, sat * correction['sat']),
        min(1.0, light * correction['light']),
        light > correction.get('at_light', light),
    )


def calibrate_line(samples):
    """Fit render colour -> texture colour on SEVERAL known bodies, per region.

    One known body only gives a ratio, and a ratio is a line through the origin
    fitted at a single point. Asked to predict a bright body from a dark one it
    extrapolates straight through the part of ACES tone mapping that bends, and
    the saturation it recovers comes out roughly half of the truth. Two or more
    known bodies give a slope as well as an offset over the range they span.

    `samples` is a list of (render_stats, texture_stats_by_name). Every body in
    it must be one whose textures are known, and must not be the body being
    recovered — calibrating on the answer would only measure itself.
    """
    per_region = {}
    for render_stats, tex in samples:
        for name, (hue, sat, light, px) in render_stats.items():
            if name not in tex:
                continue
            t_hue, t_sat, t_light = tex[name]
            per_region.setdefault(name, []).append(
                ((hue, sat, light), (t_hue, t_sat, t_light), px)
            )

    out = {}
    for name, points in per_region.items():
        if len(points) < 2:
            continue
        hue_off = [((t[0] - r[0] + 180) % 360 - 180) for r, t, _ in points]
        xs_s = np.array([r[1] for r, _, _ in points])
        ys_s = np.array([t[1] for _, t, _ in points])
        xs_l = np.array([r[2] for r, _, _ in points])
        ys_l = np.array([t[2] for _, t, _ in points])
        # A line needs its points to be APART. The first calibration body here
        # differed from the base in hue and lightness but barely in saturation,
        # which left the saturation fit spanning about a hundredth: the slope
        # went to infinity and the recovered multiplier came back as 40, 3.75
        # and 0.00 on three neighbouring hair layers. A span this small is not a
        # measurement of a slope, so the ratio through one point is used instead
        # — worse in principle, finite in practice.
        MIN_SPAN = 0.05
        fits = {}
        for chan, xs, ys in (('sat', xs_s, ys_s), ('light', xs_l, ys_l)):
            if np.ptp(xs) >= MIN_SPAN:
                fits[chan] = ('line', np.polyfit(xs, ys, 1))
            else:
                best = max(zip(xs, ys), key=lambda p: p[0])
                fits[chan] = ('ratio', best[1] / best[0] if best[0] > 1e-6 else None)
        if fits['sat'][1] is None or fits['light'][1] is None:
            continue
        out[name] = {
            'hue': circular_mean_degrees(np.array(hue_off) % 360 / 360.0,
                                         np.ones(len(hue_off))),
            'sat': fits['sat'],
            'light': fits['light'],
            'px': max(p[2] for p in points),
            'span': (float(xs_l.min()), float(xs_l.max())),
            'degenerate': [c for c, f in fits.items() if f[0] == 'ratio'],
        }
    return out


def estimate_target_line(render_entry, fit):
    """A region's texture colour from a render, using a fitted line."""
    hue, sat, light, _ = render_entry
    lo, hi = fit['span']

    def apply(kind_and_coef, x):
        kind, coef = kind_and_coef
        return float(np.clip(np.polyval(coef, x) if kind == 'line' else coef * x, 0.0, 1.0))

    return (
        (hue + (fit['hue'] + 180) % 360 - 180) % 360,
        apply(fit['sat'], sat),
        apply(fit['light'], light),
        not (lo <= light <= hi),          # True when this is an extrapolation
    )


def calibrate_plane(samples):
    """Fit texture colour on BOTH rendered channels at once, per region.

    Saturation and lightness cannot be corrected independently. ACES tone
    mapping compresses bright values toward white, so raising a texture's
    lightness LOWERS the saturation measured off the render: the brightest
    calibration body here was painted three times more saturated than the base
    and came back less saturated on screen. A per-channel fit reads that as the
    saturation going the wrong way, and there is no slope that repairs it.

    So both targets are fitted on (rendered sat, rendered light) together. Three
    known bodies determine the plane exactly; more would be a least-squares fit
    and would be better, which is the honest next step for this module.
    """
    per_region = {}
    for render_stats, tex in samples:
        for name, (hue, sat, light, px) in render_stats.items():
            if name in tex:
                per_region.setdefault(name, []).append(((hue, sat, light), tex[name], px))

    out = {}
    for name, points in per_region.items():
        if len(points) < 3:
            continue
        A = np.array([[r[1], r[2], 1.0] for r, _, _ in points])
        if np.linalg.matrix_rank(A) < 3:
            continue                     # the known bodies do not span a plane
        hue_off = np.array([((t[0] - r[0] + 180) % 360 - 180) for r, t, _ in points])
        out[name] = {
            'hue': circular_mean_degrees((hue_off % 360) / 360.0, np.ones(len(hue_off))),
            'sat': np.linalg.lstsq(A, np.array([t[1] for _, t, _ in points]), rcond=None)[0],
            'light': np.linalg.lstsq(A, np.array([t[2] for _, t, _ in points]), rcond=None)[0],
            'px': max(p[2] for p in points),
            'hull': (float(A[:, 1].min()), float(A[:, 1].max())),
        }
    return out


def estimate_target_plane(render_entry, fit):
    hue, sat, light, _ = render_entry
    v = np.array([sat, light, 1.0])
    lo, hi = fit['hull']
    return (
        (hue + (fit['hue'] + 180) % 360 - 180) % 360,
        float(np.clip(fit['sat'] @ v, 0.0, 1.0)),
        float(np.clip(fit['light'] @ v, 0.0, 1.0)),
        not (lo <= light <= hi),
    )
