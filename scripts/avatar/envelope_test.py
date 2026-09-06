"""The leg envelope: heights read off the body, a swept volume rather than a snapshot.

The heights were typed in as 0.60..1.00 until 2026-09-06, one body's numbers.
What holds them now is the rest pose (knee to just above the hip joint), and
the committed envelope has to have been swept over exactly those, or a rebuilt
body would fit its skirt to another body's grid without anything saying so.
"""
import glob
import json
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import envelope  # noqa: E402
import glb  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(BASE))
MODEL = os.path.join(REPO, 'public', 'avatar', 'mika-milfy-12.vrm')
MANIFEST = MODEL.replace('.vrm', '.parts.json')
ENVELOPE = os.path.join(BASE, 'out', 'leg-envelope.json')


def scaled(doc, factor):
    """The same document with every scene root scaled: a taller body."""
    doc = json.loads(json.dumps(doc))
    for i in doc['scenes'][doc.get('scene', 0)]['nodes']:
        s = doc['nodes'][i].get('scale', [1, 1, 1])
        doc['nodes'][i]['scale'] = [v * factor for v in s]
    return doc


class Heights(unittest.TestCase):
    def test_run_from_the_knee_to_just_above_the_hip_joint(self):
        doc, _ = glb.load(MODEL)
        h = envelope.heights(doc)
        # knee 0.501, hips 0.878 on the shipped body
        self.assertAlmostEqual(h[0], 0.50, places=3)
        self.assertAlmostEqual(h[-1], 0.92, places=3)
        self.assertAlmostEqual(h[1] - h[0], envelope.STEP, places=6)

    def test_follow_the_body(self):
        doc, _ = glb.load(MODEL)
        tall = envelope.heights(scaled(doc, 1.35))
        self.assertAlmostEqual(tall[0], 0.68, places=3)
        self.assertGreater(tall[-1], 1.2)

    def test_the_committed_envelope_was_swept_over_these_heights(self):
        doc, _ = glb.load(MODEL)
        env = json.load(open(ENVELOPE))
        np.testing.assert_allclose(env['heights'], envelope.heights(doc), atol=1e-6)
        self.assertEqual(env['segments'], envelope.SEGMENTS)


class Sweep(unittest.TestCase):
    def test_sweeps_where_the_legs_go_not_where_they_rest(self):
        # One clip, four frames: the dance lifts a knee to the side, and at
        # 0.85m the thigh sweeps well outside its resting radius. A sweep that
        # posed nothing would read the rest radius at every height.
        doc, binary = glb.load(MODEL)
        views = glb.views_of(doc, binary)
        parts = json.load(open(MANIFEST))['parts']
        mask = envelope.leg_vertices(doc, views, parts)
        mesh = next(m for m in doc['meshes'] if m.get('name') == parts['Body_Skin']['mesh'])
        rest = np.concatenate([glb.read_accessor(doc, views, mesh['primitives'][i]['attributes']['POSITION'])
                               for i in parts['Body_Skin']['primitives']])[mask]
        near = np.abs(rest[:, 1] - 0.85) < envelope.BAND
        rest_r = float(np.hypot(rest[near, 0], rest[near, 2]).max())

        clip = glob.glob(os.path.join(REPO, 'public', 'avatar', 'animations', 'dance.vrma'))
        heights, grid = envelope.sweep(MODEL, MANIFEST, clip, samples=4)
        swept_r = float(grid[int(np.argmin(np.abs(heights - 0.85)))].max())
        self.assertGreater(swept_r, rest_r + 0.01,
                           f'swept {swept_r:.4f} vs rest {rest_r:.4f} at 0.85m')


if __name__ == '__main__':
    unittest.main()
