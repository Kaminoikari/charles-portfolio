"""selftest.run() reads its expectations off the model it is handed.

Phase 3 of the skeleton plan. The invariants used to be VRoid's numbers typed
in -- 54 bones, 56 face targets, 15 blendShapeGroups -- so a base body with
any other shape failed the customisation self-test for not being this one.
The fixture is the shipped build with its JSON perturbed three ways at once
(one optional bone dropped, one blendShapeGroup dropped, one face target
duplicated), and the real selftest.run() must still come back all-green on
it, because every invariant it checks is one the customisation itself must
preserve, not one the source must have started with. Skips when the build is
not on disk.
"""
import contextlib
import io
import json
import os
import shutil
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import selftest  # noqa: E402

MODEL = os.path.join(HERE, 'out', 'mika-milfy.vrm')
MANIFEST = os.path.join(HERE, 'out', 'mika-milfy.parts.json')


class ReadsExpectationsOffTheModel(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (os.path.exists(MODEL) and os.path.exists(MANIFEST)):
            raise unittest.SkipTest('out/mika-milfy.vrm 不在：先跑 make.py')
        cls.tmp = tempfile.mkdtemp()
        doc, binary = glb.load(MODEL)
        vrm = doc['extensions']['VRM']
        vrm['humanoid']['humanBones'] = [b for b in vrm['humanoid']['humanBones']
                                         if b['bone'] != 'upperChest']
        groups = vrm['blendShapeMaster']['blendShapeGroups']
        # Drop the last group, which binds no target index another group needs.
        groups.pop()
        face = next(m for m in doc['meshes'] if m.get('name') == 'Face.baked')
        names = face.setdefault('extras', {}).setdefault('targetNames', [])
        for pr in face['primitives']:
            pr['targets'].append(dict(pr['targets'][-1]))
        names.append('duplicate_of_last')
        cls.model = os.path.join(cls.tmp, 'perturbed.vrm')
        glb.save(cls.model, doc, binary)
        cls.manifest = os.path.join(cls.tmp, 'perturbed.parts.json')
        shutil.copy(MANIFEST, cls.manifest)
        cls.counts = (len(vrm['humanoid']['humanBones']), len(groups),
                      len(face['primitives'][0]['targets']))

    def test_the_perturbed_model_passes_its_own_customisation_self_test(self):
        self.assertEqual(self.counts, (53, 14, 57))
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            ok = selftest.run(self.model, self.manifest, seed=7,
                              out=os.path.join(self.tmp, 'selftest.vrm'))
        self.assertTrue(ok, out.getvalue())
        text = out.getvalue()
        self.assertIn('53 humanoid bones', text)
        self.assertIn('57 face morph targets', text)
        self.assertIn('14 blendShapeGroups', text)


if __name__ == '__main__':
    unittest.main()
