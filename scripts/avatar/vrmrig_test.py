# The rig reader is what every gate's "skeleton unmoved" assertion stands on,
# and these tests hold it to the ways it could be useless:
#
#   1. Saying "same" when a bone actually moved. A tolerance that swallows a
#      centimetre would pass a body whose arms are a different length, and the
#      first thing anyone would notice is a hand going through a face.
#   2. Ignoring rotation. Composing only translations gives the right answer for
#      a T-pose with identity rotations and the wrong one for anything else, and
#      it would be wrong silently.
#   3. Reading only one VRM version. A 1.0 export spells the humanoid map
#      differently; a reader that only knows 0.x reports "no humanoid" for a
#      perfectly good body.
#
# Moved from ~/vtuber-kit/bin/test_vrmrig.py on 2026-09-05 with vrmrig.py.
import json
import math
import os
import struct
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import vrmrig  # noqa: E402

REAL_VRM = os.path.join(HERE, '..', '..', 'public', 'avatar', 'AvatarSample_B_webp.vrm')
KIT_BIN = os.path.expanduser('~/vtuber-kit/bin')


def gltf(nodes, bones, scene_roots=(0,), version='0'):
    """The smallest document vrmrig needs: a node tree and a humanoid map.

    `version='1'` writes the map the way VRM 1.0 does: a dict keyed by bone
    name under VRMC_vrm, instead of 0.x's list of {bone, node} under VRM.
    """
    if version == '0':
        ext = {'VRM': {'humanoid': {
            'humanBones': [{'bone': b, 'node': n} for b, n in bones.items()]}}}
    else:
        ext = {'VRMC_vrm': {'humanoid': {
            'humanBones': {b: {'node': n} for b, n in bones.items()}}}}
    return {
        'scene': 0,
        'scenes': [{'nodes': list(scene_roots)}],
        'nodes': nodes,
        'extensions': ext,
    }


def glb_bytes(doc):
    blob = json.dumps(doc).encode()
    pad = (4 - len(blob) % 4) % 4
    blob += b' ' * pad
    return (struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(blob))
            + struct.pack('<II', len(blob), 0x4E4F534A) + blob)


class Skeleton(unittest.TestCase):
    def test_a_child_bone_inherits_its_parents_offset(self):
        doc = gltf(
            nodes=[{'translation': [0, 1, 0], 'children': [1]},
                   {'translation': [0, 0.5, 0]}],
            bones={'hips': 0, 'spine': 1})
        pos = vrmrig.rest_positions(doc)
        self.assertEqual(pos['hips'], (0.0, 1.0, 0.0))
        self.assertEqual(pos['spine'], (0.0, 1.5, 0.0))

    def test_a_parents_rotation_moves_the_child(self):
        """Translation-only accumulation gets this wrong and never says so."""
        s = math.sin(math.pi / 4)
        doc = gltf(
            nodes=[{'rotation': [0, 0, s, s], 'children': [1]},  # +90° about Z
                   {'translation': [1, 0, 0]}],
            bones={'hips': 0, 'spine': 1})
        x, y, z = vrmrig.rest_positions(doc)['spine']
        self.assertAlmostEqual(x, 0.0, places=5)
        self.assertAlmostEqual(y, 1.0, places=5)
        self.assertAlmostEqual(z, 0.0, places=5)

    def test_a_parents_scale_reaches_the_child(self):
        doc = gltf(
            nodes=[{'scale': [2, 2, 2], 'children': [1]},
                   {'translation': [0, 0.5, 0]}],
            bones={'hips': 0, 'spine': 1})
        self.assertEqual(vrmrig.rest_positions(doc)['spine'], (0.0, 1.0, 0.0))

    def test_a_bone_outside_the_scene_tree_is_reported_not_skipped(self):
        """A humanoid entry pointing at an orphan node is a broken export. Left
        silent it would read as 'this bone matches' on every comparison."""
        doc = gltf(nodes=[{'translation': [0, 1, 0]}, {'translation': [9, 9, 9]}],
                   bones={'hips': 0, 'spine': 1}, scene_roots=(0,))
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.rest_positions(doc)
        self.assertIn('spine', str(cm.exception))

    def test_a_scene_index_pointing_nowhere_says_so(self):
        """A broken export can name a scene that is not in the file. Indexing
        blind raises IndexError, which tells the person nothing about which of
        their four VRMs is the bad one."""
        doc = gltf(nodes=[{'translation': [0, 1, 0]}], bones={'hips': 0})
        doc['scene'] = 3
        doc['_name'] = 'outfit-a.vrm'
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.rest_positions(doc)
        self.assertIn('outfit-a.vrm', str(cm.exception))

    def test_a_short_matrix_is_refused_rather_than_indexed(self):
        doc = gltf(nodes=[{'matrix': [1, 0, 0]}], bones={'hips': 0})
        doc['_name'] = 'outfit-b.vrm'
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.rest_positions(doc)
        self.assertIn('outfit-b.vrm', str(cm.exception))


class Versions(unittest.TestCase):
    """VRM 0.x and 1.0 spell the humanoid map differently and face opposite
    ways. The reader has to give the same bones for both and say which it saw."""

    NODES = [{'translation': [0, 1, 0], 'children': [1]}, {'translation': [0, 0.5, 0]}]
    BONES = {'hips': 0, 'spine': 1}

    def test_a_vrm1_map_reads_the_same_bones_as_its_vrm0_twin(self):
        v0 = gltf(self.NODES, self.BONES, version='0')
        v1 = gltf(self.NODES, self.BONES, version='1')
        self.assertEqual(vrmrig.human_bones(v1), vrmrig.human_bones(v0))
        self.assertEqual(vrmrig.rest_positions(v1), vrmrig.rest_positions(v0))
        self.assertEqual(vrmrig.compare(v0, v1), [])

    def test_the_version_is_reported(self):
        self.assertEqual(vrmrig.vrm_version(gltf(self.NODES, self.BONES, version='0')), '0')
        self.assertEqual(vrmrig.vrm_version(gltf(self.NODES, self.BONES, version='1')), '1')

    def test_vrm1_faces_plus_z_and_vrm0_faces_minus_z(self):
        self.assertEqual(vrmrig.forward_z(gltf(self.NODES, self.BONES, version='0')), -1)
        self.assertEqual(vrmrig.forward_z(gltf(self.NODES, self.BONES, version='1')), 1)

    def test_a_file_with_neither_extension_names_both(self):
        doc = gltf(self.NODES, self.BONES)
        doc['extensions'] = {}
        doc['_name'] = 'plain.glb'
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.human_bones(doc)
        msg = str(cm.exception)
        self.assertIn('plain.glb', msg)
        self.assertIn('VRM', msg)
        self.assertIn('VRMC_vrm', msg)

    def test_required_bones_are_named_when_missing(self):
        doc = gltf(self.NODES, self.BONES)
        missing = vrmrig.required_missing(doc)
        self.assertIn('head', missing)
        self.assertIn('leftHand', missing)
        self.assertNotIn('hips', missing)
        self.assertNotIn('chest', missing, 'chest is optional in the spec')

    def test_expressions_read_from_either_version(self):
        v0 = gltf(self.NODES, self.BONES, version='0')
        v0['extensions']['VRM']['blendShapeMaster'] = {
            'blendShapeGroups': [{'name': 'Blink'}, {'name': 'A'}]}
        v1 = gltf(self.NODES, self.BONES, version='1')
        v1['extensions']['VRMC_vrm']['expressions'] = {
            'preset': {'blink': {}, 'aa': {}}, 'custom': {'wink': {}}}
        self.assertEqual(vrmrig.expression_names(v0), ['Blink', 'A'])
        self.assertEqual(vrmrig.expression_names(v1), ['blink', 'aa', 'wink'])

    def test_springs_read_from_either_version_in_one_shape(self):
        v0 = gltf(self.NODES, self.BONES, version='0')
        v0['extensions']['VRM']['secondaryAnimation'] = {
            'boneGroups': [{'comment': 'tail', 'bones': [1], 'colliderGroups': [0],
                            'hitRadius': 0.03, 'gravityPower': 0.0,
                            'stiffiness': 1.0, 'dragForce': 0.4}],
            'colliderGroups': [{'node': 0, 'colliders': [
                {'offset': {'x': 0, 'y': 0.1, 'z': 0.02}, 'radius': 0.05}]}]}
        v1 = gltf(self.NODES, self.BONES, version='1')
        v1['extensions']['VRMC_springBone'] = {
            'colliders': [{'node': 0, 'shape': {'sphere': {'offset': [0, 0.1, 0.02], 'radius': 0.05}}}],
            'colliderGroups': [{'name': 'body', 'colliders': [0]}],
            'springs': [{'name': 'tail', 'colliderGroups': [0], 'joints': [
                {'node': 1, 'hitRadius': 0.03, 'gravityPower': 0.0,
                 'stiffness': 1.0, 'dragForce': 0.4}]}]}
        s0, s1 = vrmrig.spring_bones(v0), vrmrig.spring_bones(v1)
        for s in (s0, s1):
            self.assertEqual(len(s['groups']), 1)
            g = s['groups'][0]
            self.assertEqual(g['bones'], [1])
            self.assertEqual(g['colliderGroups'], [0])
            self.assertEqual(g['hitRadius'], 0.03)
            self.assertEqual(g['gravityPower'], 0.0)
            self.assertEqual(g['stiffness'], 1.0)
            self.assertEqual(g['dragForce'], 0.4)
            self.assertEqual(len(s['colliderGroups']), 1)
            cg = s['colliderGroups'][0]
            self.assertEqual(cg['node'], 0)
            self.assertEqual(cg['colliders'][0]['radius'], 0.05)
            self.assertEqual(cg['colliders'][0]['offset'], {'x': 0, 'y': 0.1, 'z': 0.02})

    def test_a_vrm1_glb_parses_end_to_end(self):
        """The old reader refused 1.0 with 'please re-export as VRM0'. It is
        now a body like any other; the RealFile tests below cover 0.x."""
        import tempfile
        doc = gltf(self.NODES, self.BONES, version='1')
        with tempfile.NamedTemporaryFile(suffix='.vrm', delete=False) as fh:
            fh.write(glb_bytes(doc))
            path = fh.name
        self.addCleanup(os.unlink, path)
        loaded = vrmrig.read(path)
        self.assertEqual(vrmrig.vrm_version(loaded), '1')
        self.assertEqual(vrmrig.rest_positions(loaded)['spine'], (0.0, 1.5, 0.0))


class Comparison(unittest.TestCase):
    def base(self):
        return gltf(nodes=[{'translation': [0, 1, 0], 'children': [1]},
                           {'translation': [0, 0.5, 0]}],
                    bones={'hips': 0, 'spine': 1})

    def moved(self, dy):
        return gltf(nodes=[{'translation': [0, 1, 0], 'children': [1]},
                           {'translation': [0, 0.5 + dy, 0]}],
                    bones={'hips': 0, 'spine': 1})

    def test_an_identical_skeleton_reports_no_differences(self):
        self.assertEqual(vrmrig.compare(self.base(), self.base()), [])

    def test_a_millimetre_is_already_a_difference(self):
        """VRoid writes the same numbers for an untouched body slider, so any
        movement at all means the slider was touched. The tolerance is for
        float noise, not for 'close enough'."""
        diffs = vrmrig.compare(self.base(), self.moved(0.001))
        self.assertEqual([d['bone'] for d in diffs], ['spine'])
        self.assertAlmostEqual(diffs[0]['distance'], 0.001, places=6)

    def test_float_noise_is_not_a_difference(self):
        self.assertEqual(vrmrig.compare(self.base(), self.moved(1e-9)), [])

    def test_a_missing_bone_is_a_difference_of_its_own(self):
        other = gltf(nodes=[{'translation': [0, 1, 0]}], bones={'hips': 0})
        diffs = vrmrig.compare(self.base(), other)
        self.assertEqual([d['bone'] for d in diffs], ['spine'])
        self.assertIsNone(diffs[0]['distance'],
                          '缺少的骨頭沒有距離可言，不能報 0')

    def test_differences_come_back_worst_first(self):
        """The bone that moved most is the one to look at first.

        The fixture is built so worst-first and alphabetical disagree: an
        earlier version had leftHand as both the largest difference and the
        alphabetically first, and removing the sort altogether left it passing.
        """
        a = gltf(nodes=[{'translation': [0, 1, 0], 'children': [1, 2]},
                        {'translation': [0, 0.5, 0]}, {'translation': [0.2, 0, 0]}],
                 bones={'hips': 0, 'spine': 1, 'leftHand': 2})
        b = gltf(nodes=[{'translation': [0, 1, 0], 'children': [1, 2]},
                        {'translation': [0, 0.9, 0]}, {'translation': [0.21, 0, 0]}],
                 bones={'hips': 0, 'spine': 1, 'leftHand': 2})
        order = [d['bone'] for d in vrmrig.compare(a, b)]
        self.assertEqual(order, ['spine', 'leftHand'])
        self.assertNotEqual(order, sorted(order),
                            'fixture 要讓「差距最大優先」跟字母順序不一致，'
                            '否則拿掉排序也會通過')


@unittest.skipUnless(os.path.exists(REAL_VRM), '找不到現有的 VRM')
class RealFile(unittest.TestCase):
    """The synthetic documents above prove the maths. This proves the reader
    survives a file an actual exporter wrote."""

    def test_the_shipped_avatar_parses(self):
        doc = vrmrig.read(REAL_VRM)
        pos = vrmrig.rest_positions(doc)
        self.assertGreater(len(pos), 40, 'VRM0 的 humanoid 應該有數十根骨頭')
        for bone in ('hips', 'head', 'leftHand', 'rightHand'):
            self.assertIn(bone, pos)
        self.assertEqual(vrmrig.required_missing(doc), [])

    def test_the_measurements_match_what_was_recorded_earlier(self):
        """hips 0.8782 and head 1.3200 were measured through three-vrm in the
        browser. Getting the same numbers straight out of the file is what makes
        this checker trustworthy without a renderer.

        It does NOT cover rotation: this avatar's hips-to-head chain is all
        identity rotations, so the numbers come out the same even with rotation
        dropped entirely. That is held by the synthetic test above instead.
        """
        pos = vrmrig.rest_positions(vrmrig.read(REAL_VRM))
        self.assertAlmostEqual(pos['hips'][1], 0.8782, places=3)
        self.assertAlmostEqual(pos['head'][1], 1.3200, places=3)

    def test_a_file_compared_with_itself_is_identical(self):
        doc = vrmrig.read(REAL_VRM)
        self.assertEqual(vrmrig.compare(doc, doc), [])

    def test_a_file_that_is_not_a_glb_says_so(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.vrm', delete=False) as fh:
            fh.write(b'this is not a glb')
            path = fh.name
        self.addCleanup(os.unlink, path)
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.read(path)
        self.assertIn('glTF', str(cm.exception))

    def test_a_truncated_glb_is_named_rather_than_thrown(self):
        """A copy that stopped halfway is the input this tool most has to expect,
        and check_variants only catches BadRig — a raw struct.error there kills
        the whole comparison loop and takes the other variants' results with it."""
        import tempfile
        with open(REAL_VRM, 'rb') as fh:
            head = fh.read(14)          # magic + version + length, then nothing
        with tempfile.NamedTemporaryFile(suffix='.vrm', delete=False) as fh:
            fh.write(head)
            path = fh.name
        self.addCleanup(os.unlink, path)
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.read(path)
        self.assertIn('不完整', str(cm.exception))

    def test_a_glb_whose_json_chunk_is_cut_short_is_named(self):
        with open(REAL_VRM, 'rb') as fh:
            partial = fh.read(2000)     # valid header, JSON chunk truncated
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.vrm', delete=False) as fh:
            fh.write(partial)
            path = fh.name
        self.addCleanup(os.unlink, path)
        with self.assertRaises(vrmrig.BadRig) as cm:
            vrmrig.read(path)
        self.assertIn('不完整', str(cm.exception))


@unittest.skipUnless(os.path.exists(REAL_VRM) and os.path.exists(os.path.join(KIT_BIN, 'check_variants.py')),
                     '找不到現有的 VRM 或 ~/vtuber-kit/bin/check_variants.py')
class VariantLoop(unittest.TestCase):
    """The comparison loop's job is to report on every variant. One unreadable
    entry must cost that entry's row, not the whole run: the person exporting
    from VRoid finds out about a bad file at the same time as everything else,
    rather than losing the results they were waiting for.

    check_variants.py stays in ~/vtuber-kit/bin (it is that kit's CLI) and
    imports vrmrig from here; this test drives it to prove the import survives
    the move."""

    def models(self, *entries):
        import shutil
        import tempfile
        d = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, d, True)
        shutil.copy(REAL_VRM, os.path.join(d, 'base.vrm'))
        for kind, name in entries:
            path = os.path.join(d, name)
            if kind == 'dir':
                os.mkdir(path)          # glob lists it; open() raises
            elif kind == 'dangling':
                os.symlink(os.path.join(d, 'nothing-here.vrm'), path)
            elif kind == 'good':
                shutil.copy(REAL_VRM, path)
        return d

    def run_check(self, d):
        import io
        import contextlib
        if KIT_BIN not in sys.path:
            sys.path.insert(0, KIT_BIN)
        sys.argv = ['check_variants.py', '--models', d]
        import check_variants
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            code = check_variants.main()
        return code, buf.getvalue()

    def test_an_unreadable_entry_does_not_end_the_comparison(self):
        """A directory named outfit-a.vrm raises IsADirectoryError, which is not
        BadRig. Uncaught, it takes the good variant's result down with it."""
        d = self.models(('dir', 'outfit-a.vrm'), ('good', 'outfit-b.vrm'))
        code, out = self.run_check(d)
        self.assertIn('outfit-a.vrm', out, '壞掉的那個要被指名')
        self.assertIn('outfit-b.vrm', out, '好的那個仍然要有結果')
        self.assertIn('骨架跟基準完全相同', out)
        self.assertEqual(code, 1, '有讀不了的檔就不是全過')

    def test_a_dangling_symlink_is_reported_like_any_other_bad_file(self):
        d = self.models(('dangling', 'outfit-a.vrm'), ('good', 'outfit-b.vrm'))
        code, out = self.run_check(d)
        self.assertIn('outfit-a.vrm', out)
        self.assertIn('骨架跟基準完全相同', out)
        self.assertEqual(code, 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
