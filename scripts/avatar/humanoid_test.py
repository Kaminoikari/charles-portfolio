"""humanoid.py is the only door to the humanoid map. These tests hold the
façade itself, and hold the rest of the package to using it."""
import glob
import json
import os
import re
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import humanoid  # noqa: E402
import vrmrig_test  # noqa: E402

REAL_VRM = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-10.vrm')
REAL_MANIFEST = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-10.parts.json')

NODES = [{'translation': [0, 1, 0], 'children': [1]}, {'translation': [0, 0.5, 0]}]
BONES = {'hips': 0, 'spine': 1}


def with_skins(doc, body_skin=1):
    """Three skins over one joint list, the body mesh on `body_skin`, as VRoid
    exports it (face 0, body 1, hair 2)."""
    doc['meshes'] = [{'name': 'Face.baked'}, {'name': 'Body.baked'}, {'name': 'Hair.baked'}]
    doc['skins'] = [{'joints': [0, 1]}, {'joints': [0, 1]}, {'joints': [0, 1]}]
    order = [0, 1, 2]
    order.remove(body_skin)
    doc['nodes'] = list(doc['nodes']) + [
        {'name': 'Face', 'mesh': 0, 'skin': order[0]},
        {'name': 'Body', 'mesh': 1, 'skin': body_skin},
        {'name': 'Hair', 'mesh': 2, 'skin': order[1]},
    ]
    return doc


MANIFEST = {'parts': {'Body_Skin': {'mesh': 'Body.baked'}}}


class Facade(unittest.TestCase):
    def test_bones_and_node_bone_are_inverses_for_both_versions(self):
        for v in ('0', '1'):
            doc = vrmrig_test.gltf(NODES, BONES, version=v)
            self.assertEqual(humanoid.bones(doc), BONES)
            self.assertEqual(humanoid.node_bone(doc), {0: 'hips', 1: 'spine'})
            self.assertEqual(humanoid.version(doc), v)

    def test_forward_z_follows_the_version(self):
        self.assertEqual(humanoid.forward_z(vrmrig_test.gltf(NODES, BONES, version='0')), -1)
        self.assertEqual(humanoid.forward_z(vrmrig_test.gltf(NODES, BONES, version='1')), 1)

    def test_animation_bones_read_the_vrma_map(self):
        doc = {'extensions': {'VRMC_vrm_animation': {'humanoid': {'humanBones': {
            'hips': {'node': 3}, 'spine': {'node': 4}}}}}}
        self.assertEqual(humanoid.animation_bones(doc), {'hips': 3, 'spine': 4})
        with self.assertRaises(humanoid.BadRig):
            humanoid.animation_bones({'extensions': {}})

    def test_body_skin_comes_from_the_manifest_not_skins_0(self):
        """VRoid puts the body on skin 1. skins[0] is the face's, which lists the
        same joints, which is how the wrong index passed every gate."""
        doc = with_skins(vrmrig_test.gltf(NODES, BONES), body_skin=1)
        self.assertEqual(humanoid.body_skin(doc, MANIFEST), 1)
        doc = with_skins(vrmrig_test.gltf(NODES, BONES), body_skin=2)
        self.assertEqual(humanoid.body_skin(doc, MANIFEST), 2)

    def test_body_skin_names_what_is_missing(self):
        doc = with_skins(vrmrig_test.gltf(NODES, BONES))
        with self.assertRaises(humanoid.BadRig) as cm:
            humanoid.body_skin(doc, {'parts': {}})
        self.assertIn('Body_Skin', str(cm.exception))
        with self.assertRaises(humanoid.BadRig) as cm:
            humanoid.body_skin(doc, {'parts': {'Body_Skin': {'mesh': 'Nope'}}})
        self.assertIn('Nope', str(cm.exception))

    def test_skins_sharing_lists_every_skin_over_the_same_joints(self):
        doc = with_skins(vrmrig_test.gltf(NODES, BONES))
        self.assertEqual(humanoid.skins_sharing(doc, 1), [0, 1, 2])
        doc['skins'][2]['joints'] = [0]
        self.assertEqual(humanoid.skins_sharing(doc, 1), [0, 1])

    def test_rest_world_matches_rest_positions(self):
        doc = vrmrig_test.gltf(NODES, BONES)
        world = humanoid.rest_world(doc)
        self.assertAlmostEqual(float(world[1][1, 3]), 1.5, places=9)
        self.assertEqual(humanoid.compare(doc, doc), [], 'compare 的 re-export 要能用')


@unittest.skipUnless(os.path.exists(REAL_VRM) and os.path.exists(REAL_MANIFEST), '找不到出貨的 milfy')
class RealFile(unittest.TestCase):
    def test_the_shipped_body_is_on_skin_1(self):
        import glb
        doc, _ = glb.load(REAL_VRM)
        manifest = json.load(open(REAL_MANIFEST))
        self.assertEqual(humanoid.body_skin(doc, manifest), 1)
        self.assertEqual(humanoid.skins_sharing(doc, 1), [0, 1, 2])
        self.assertEqual(humanoid.version(doc), '0')
        self.assertEqual(humanoid.required_missing(doc), [])


class Wiring(unittest.TestCase):
    """Injection-style tests skip the wiring layer (memory:
    feedback_injection_bypasses_wiring). This one reads the source: no module
    but humanoid.py may reach into the humanoid map or import vrmrig directly,
    or a VRM 1.0 base body raises KeyError in whichever module runs first."""

    INLINE = re.compile(r"\[['\"]humanoid['\"]\]\s*\[['\"]humanBones['\"]\]")
    ANIM_INLINE = re.compile(r"VRMC_vrm_animation['\"]\]\s*\[['\"]humanoid")
    IMPORT = re.compile(r'^\s*(import vrmrig|from vrmrig import)', re.M)
    # Any spelling of the kit path: the absolute one that was removed, the
    # `~/vtuber-kit/bin` an expanduser() would take, or a bare join().
    KIT_PATH = 'vtuber-kit'
    ALLOWED = {'humanoid.py', 'vrmrig.py', 'vrmrig_test.py', 'humanoid_test.py'}
    SCRIPTS = os.path.normpath(os.path.join(HERE, '..'))

    def sources(self):
        # Every Python file under scripts/, not just this package: the two
        # other VRM tools (repaint_vrm.py, compress_vrm_webp.py) live one level up.
        for path in sorted(glob.glob(os.path.join(self.SCRIPTS, '**', '*.py'), recursive=True)):
            if os.path.basename(path) in self.ALLOWED:
                continue
            with open(path, encoding='utf-8') as fh:
                yield os.path.relpath(path, self.SCRIPTS), fh.read()

    def test_no_module_reads_the_humanoid_map_inline(self):
        offenders = [name for name, src in self.sources()
                     if self.INLINE.search(src) or self.ANIM_INLINE.search(src)]
        self.assertEqual(offenders, [], f'這些檔案自己讀 humanBones，沒走 humanoid.py：{offenders}')

    def test_no_module_imports_vrmrig_directly(self):
        offenders = [name for name, src in self.sources() if self.IMPORT.search(src)]
        self.assertEqual(offenders, [], f'這些檔案直接 import vrmrig，沒走 humanoid.py：{offenders}')

    def test_no_module_hardcodes_the_kit_path(self):
        offenders = [name for name, src in self.sources() if self.KIT_PATH in src]
        self.assertEqual(offenders, [], f'這些檔案寫死 ~/vtuber-kit 路徑：{offenders}')


if __name__ == '__main__':
    unittest.main(verbosity=2)
