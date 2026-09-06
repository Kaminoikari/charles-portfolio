"""The three retargets agree: motion.py against three-vrm's VRMHumanoid.

Until Phase 6a (2026-09-06) rigProbe.ts, springsim.ts and motion.py each
carried their own copy of "turn a .vrma onto this body", and all three flipped
x/z as if every body were VRM 0.x. rigProbe.ts and springsim.ts now pose
through VRMHumanoid itself; motion.py stays in numpy because the build gates
run without Node, so it is held to the TypeScript rig here: the same clips, the
same frames, every humanoid bone's raw world rotation within half a degree.

Two things this pins that a green retarget_test.py cannot:

  * the flip is conditional on the body's version (a VRM 1.0 twin of the
    shipped body must pose as the shipped body turned round, not mirrored);
  * a thumb track lands on the thumb. The clip spells the joints the 1.0 way
    (Metacarpal/Proximal/Distal), a 0.x body the old way
    (Proximal/Intermediate/Distal), and the same word means a different joint
    in each.

The TypeScript side is read through scripts/avatar/retarget-dump.ts in one
subprocess; when tsx is missing the test fails, it does not skip.
"""
import copy
import json
import os
import subprocess
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import humanoid  # noqa: E402
import motion  # noqa: E402

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODEL = os.path.join(REPO, 'public', 'avatar', 'AvatarSample_B_webp.vrm')
CLIPS = ['dance', 'modelPose', 'squat']
FRAMES = 4
MAX_DEG = 0.5
DUMP = os.path.join(REPO, 'scripts', 'avatar', 'retarget-dump.ts')

YAW = np.array([0.0, 1.0, 0.0, 0.0])


def clip_path(name):
    return os.path.join(REPO, 'public', 'avatar', 'animations', f'{name}.vrma')


V0_TO_V1_THUMB = {v0: v1 for v1, v0 in humanoid.V1_TO_V0_THUMB.items()}


def vrm1_twin(doc):
    """The shipped body as a 1.0 export: map under VRMC_vrm with the 1.0 thumb
    names, scene turned π about Y."""
    twin = copy.deepcopy(doc)
    ext = twin['extensions']
    bones = humanoid.bones(twin)
    del ext['VRM']
    ext['VRMC_vrm'] = {'specVersion': '1.0',
                       'humanoid': {'humanBones': {V0_TO_V1_THUMB.get(b, b): {'node': n}
                                                   for b, n in bones.items()}}}
    twin['extensionsUsed'] = [e for e in twin.get('extensionsUsed', []) if e != 'VRM'] + ['VRMC_vrm']
    scene = twin['scenes'][twin.get('scene', 0)]
    twin['nodes'].append({'name': 'vrm1-root', 'rotation': [0, 1, 0, 0], 'children': list(scene['nodes'])})
    scene['nodes'] = [len(twin['nodes']) - 1]
    return twin


def world_rotations(doc, local_by_bone):
    """humanoid bone -> raw world rotation with motion.retarget's locals applied."""
    par = motion.node_parents(doc)
    order = motion.tree_order(doc, par)
    bones = humanoid.bones(doc)
    local = {bones[b]: q for b, q in local_by_bone.items() if b in bones}
    world = motion.globals_of(doc, par, order, local)
    return {b: world[n] for b, n in bones.items()}


def angle_deg(a, b):
    return float(np.degrees(2 * np.arccos(min(1.0, abs(float(np.dot(a, b)))))))


def sample_times(name):
    _, duration = motion.retarget(clip_path(name), 0.0, glb.load(MODEL)[0])
    return [duration * (k + 0.5) / FRAMES for k in range(FRAMES)]


class MotionPyAlone(unittest.TestCase):
    """What motion.py must do on its own, before the TypeScript rig is consulted."""

    def test_a_vrm1_twin_poses_as_the_shipped_body_turned_round(self):
        doc, _ = glb.load(MODEL)
        twin = vrm1_twin(doc)
        at = sample_times('dance')[1]
        v0 = world_rotations(doc, motion.retarget(clip_path('dance'), at, doc)[0])
        v1 = world_rotations(twin, motion.retarget(clip_path('dance'), at, twin)[0])
        # 1e-4°: float64 rounding through acos near 1. A flip error is 13° at
        # the hips and 180° at a hand.
        for bone in ['hips', 'head', 'leftHand', 'rightHand', 'leftFoot', 'spine']:
            expected = motion.qmul(YAW, v0[bone])
            self.assertLess(angle_deg(expected, v1[bone]), 1e-4, bone)

    def test_a_thumb_track_lands_on_the_thumb_it_names(self):
        doc, _ = glb.load(MODEL)
        out, _ = motion.retarget(clip_path('dance'), sample_times('dance')[1], doc)
        # The clip's leftThumbProximal is the middle joint; on a 0.x body that
        # joint is spelled leftThumbIntermediate. All three have to be posed.
        for bone in ['leftThumbProximal', 'leftThumbIntermediate', 'leftThumbDistal']:
            self.assertIn(bone, out)
            self.assertGreater(angle_deg(out[bone], motion.IDENT), 0.5, bone)


class AgainstThreeVrm(unittest.TestCase):
    """motion.py against VRMHumanoid, per bone, on the shipped body and its twin."""

    @classmethod
    def setUpClass(cls):
        times = {name: sample_times(name) for name in CLIPS}
        cmd = ['npx', 'tsx', DUMP, MODEL, '--twin',
               '--clips=' + ','.join(clip_path(n) for n in CLIPS),
               '--times=' + json.dumps(times)]
        run = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
        if run.returncode != 0:
            raise AssertionError(f'retarget-dump.ts failed ({run.returncode}):\n{run.stdout[-1500:]}\n{run.stderr[-1500:]}')
        cls.dump = json.loads(run.stdout)
        cls.times = times

    def compare(self, body):
        doc, _ = glb.load(MODEL)
        if body == 'twin':
            doc = vrm1_twin(doc)
        # VRMHumanoid keys every bone the 1.0 way whatever the file's version,
        # and the dump has to carry every humanoid bone the body declares: a
        # dump that dropped a family of bones would leave the loop below
        # quietly vacuous for them.
        bones = humanoid.bones(doc)
        # The 0.x thumb names are renamed only where three-vrm renames them
        # (humanoid.model_bone_name's rule): `leftThumbProximal` is a name in
        # both spellings and must not be folded on a body already spelled 1.0.
        legacy = humanoid.version(doc) == '0' or any(b.endswith('ThumbIntermediate') for b in bones)
        expected = {V0_TO_V1_THUMB.get(b, b) if legacy else b for b in bones}
        worst = (0.0, '')
        for name in CLIPS:
            for k, at in enumerate(self.times[name]):
                ours = world_rotations(doc, motion.retarget(clip_path(name), at, doc)[0])
                theirs = self.dump[body][name][k]['bones']
                self.assertEqual(set(theirs), expected, f'{name}@{at:.2f} dumped bone set')
                for vrm1_name, q in theirs.items():
                    bone = humanoid.model_bone_name(doc, vrm1_name)
                    self.assertIn(bone, ours, f'{name}@{at:.2f} {vrm1_name}')
                    deg = angle_deg(np.array(q), ours[bone])
                    if deg > worst[0]:
                        worst = (deg, f'{name}@{at:.2f}s {bone}')
        print(f'  parity {body}: worst bone {worst[1]} {worst[0]:.4f}° (limit {MAX_DEG}°)')
        self.assertLess(worst[0], MAX_DEG, f'worst bone {worst[1]}: {worst[0]:.3f}°')
        return worst

    def test_shipped_vrm0_body(self):
        self.compare('shipped')

    def test_vrm1_twin(self):
        self.compare('twin')


if __name__ == '__main__':
    unittest.main()
