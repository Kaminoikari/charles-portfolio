"""How far the legs actually travel, so a skirt can be cut to clear them.

A skirt built to clear the body at rest is not built to clear the body. These
ten clips lift a knee to the side, and the thigh comes out through the cloth
between the hip and mid-thigh, which is the one place a resting measurement says
there is room. Measured: at 0.85m the legs sweep out to a radius of 145mm while
the skirt sits at 122mm.

Sampling has to be dense. Fitting the skirt to five frames a clip and then
testing it at four different times changed nothing at all: the gate simply landed
on poses the envelope had never seen. Twenty-four frames a clip is a swept volume
rather than a handful of snapshots.

The envelope is written to a file rather than computed during the build, because
posing 1,256 vertices through 240 frames takes a couple of minutes and the shape
only changes when the clips do. Regenerate it by running this module.
"""
import glob
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import motion  # noqa: E402
import pose as pose_mod  # noqa: E402

HEIGHTS = np.round(np.arange(0.60, 1.01, 0.01), 3)
SEGMENTS = 48
BAND = 0.020


def leg_vertices(doc, views, parts, part='Body_Skin'):
    """Mask of body vertices a leg joint actually drives."""
    bones = pose_mod.bones(doc)
    joints = doc['skins'][0]['joints']
    wanted = {joints.index(bones[b]) for b in bones
              if 'Leg' in b or 'Foot' in b or 'Toes' in b}
    src = next(m for m in doc['meshes'] if m.get('name') == parts[part]['mesh'])
    J = np.concatenate([glb.read_accessor(doc, views, src['primitives'][i]['attributes']['JOINTS_0'])
                        for i in parts[part]['primitives']])
    W = np.concatenate([glb.read_accessor(doc, views, src['primitives'][i]['attributes']['WEIGHTS_0'])
                        for i in parts[part]['primitives']])
    mask = np.zeros(len(J), dtype=bool)
    for c in range(J.shape[1]):
        mask |= np.isin(J[:, c], list(wanted)) & (W[:, c] > 0.5)
    return mask


def sweep(model, manifest, clips, samples=24):
    doc, binary = glb.load(model)
    views = glb.views_of(doc, binary)
    parts = json.load(open(manifest))['parts']
    bones = pose_mod.bones(doc)
    mask = leg_vertices(doc, views, parts)
    mesh, prims = parts['Body_Skin']['mesh'], parts['Body_Skin']['primitives']

    grid = np.zeros((len(HEIGHTS), SEGMENTS))
    for clip in clips:
        _, dur = motion.retarget(clip, 0.0, doc)
        for k in range(samples):
            rot, _ = motion.retarget(clip, dur * (k + 0.5) / samples, doc)
            posed = pose_mod.skinned(
                doc, views, {bones[b]: q for b, q in rot.items() if b in bones}, True)
            B = np.concatenate([posed[(mesh, i)] for i in prims])[mask]
            r = np.hypot(B[:, 0], B[:, 2])
            bin_of = ((np.arctan2(B[:, 2], B[:, 0]) % (2 * np.pi))
                      / (2 * np.pi) * SEGMENTS).astype(int) % SEGMENTS
            for hi, h in enumerate(HEIGHTS):
                near = np.abs(B[:, 1] - h) < BAND
                if not near.any():
                    continue
                np.maximum.at(grid[hi], bin_of[near], r[near])
    return grid


def load(path):
    """(heights, segments, grid) or None if the file is not there."""
    if not os.path.exists(path):
        return None
    d = json.load(open(path))
    return np.array(d['heights']), int(d['segments']), np.array(d['radii'])


def radii_at(env, y):
    """Per-bearing swept radius at a height, or None outside the sampled range."""
    if env is None:
        return None
    heights, _segments, grid = env
    i = int(np.argmin(np.abs(heights - y)))
    if abs(heights[i] - y) > 0.02 or not grid[i].any():
        return None
    return grid[i]


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    clips = sorted(glob.glob(os.path.join(base, '..', '..', 'public', 'avatar',
                                          'animations', '*.vrma')))
    grid = sweep(os.path.join(base, 'out', 'mika-milfy.vrm'),
                 os.path.join(base, 'out', 'mika-milfy.parts.json'), clips)
    out = os.path.join(base, 'out', 'leg-envelope.json')
    json.dump({'heights': HEIGHTS.tolist(), 'segments': SEGMENTS,
               'radii': grid.tolist(), 'clips': [os.path.basename(c) for c in clips]},
              open(out, 'w'))
    live = grid.any(axis=1)
    print(f'wrote {out}: {int(live.sum())} heights carry a leg, '
          f'radius {grid[live].max():.4f} at most')
