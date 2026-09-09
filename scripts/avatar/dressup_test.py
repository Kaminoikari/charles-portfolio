"""What the dress-up repair step decides for itself.

refit.py is already tested on the geometry it rewrites (refit_test.py) and
receipted on the body it was measured on (evidence/refit-0909.md). What is held
here is the wiring: that a fresh export's torn primitives are read off the file
rather than named by hand, that the body pool is the manifest's skin, and that a
file which still tears is refused rather than written and reported.

The shipped Milfy body is the fixture. It passes torn_bindings, so it is the
clean case; verify_test.snapped_weights turns one garment's weights into the
hard handovers a nearest-vertex bind leaves, which is the defect in the form
Studio's auto-fit produces it.
"""
import copy
import json
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import dressup  # noqa: E402
import glb  # noqa: E402
import verify  # noqa: E402
import verify_test  # noqa: E402

SHIPPED = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-milfy-12.vrm')
MANIFEST = SHIPPED.replace('.vrm', '.parts.json')
# The VRoid body the Milfy build starts from. Its Face.baked and Body.baked
# primitives are the ones MANIFEST names as skin, and unlike the build's output
# it is not a glb.save product.
PINK = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')


def out(name):
    return os.path.join(tempfile.mkdtemp(), name)


class Selection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not os.path.exists(SHIPPED):
            raise unittest.SkipTest('public/avatar/mika-milfy-12.vrm 不在')
        cls.snapped = verify_test.snapped_weights('Outfit_Cardigan')

    def test_a_primitive_several_bends_tear_is_named_once(self):
        # torn_bindings reports one row per bend. Handing refit the duplicate
        # would rewrite the same accessors twice, the second pass reading the
        # weights the first one wrote.
        rows = verify.torn_bindings(self.snapped)
        self.assertGreater(len(rows), 1)
        self.assertEqual(len({(r[0], r[1]) for r in rows}), 1)
        self.assertEqual(dressup.torn_cloth(self.snapped), (('Body.baked', 22),))

    def test_a_file_that_tears_nowhere_names_nothing(self):
        self.assertEqual(dressup.torn_cloth(SHIPPED), ())

    def test_the_body_pool_is_the_manifest_s_skin(self):
        # Same rule the clipping gate uses, so a skin split over meshes is all
        # body. A pool with holes reads the cloth as further from the body than
        # it is, and that distance is the whole of refit's shed field.
        parts = json.load(open(MANIFEST, encoding='utf-8'))['parts']
        split = copy.deepcopy(parts)
        primitives = split['Body_Skin']['primitives']
        split['Body_Skin_Rest'] = dict(split['Body_Skin'], primitives=primitives[1:])
        split['Body_Skin'] = dict(split['Body_Skin'], primitives=primitives[:1])
        path = out('split.parts.json')
        json.dump({'parts': split}, open(path, 'w', encoding='utf-8'))

        pool = dressup.body_primitives(path)
        self.assertEqual(set(pool), set(dressup.body_primitives(MANIFEST)))
        self.assertIn((parts['Body_Skin']['mesh'], primitives[-1]), pool)
        for name, info in parts.items():
            if name.startswith(('Outfit_', 'Acc_', 'Hair_')):
                for index in info['primitives']:
                    self.assertNotIn((info['mesh'], index), pool)


class Repair(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for path in (SHIPPED, PINK):
            if not os.path.exists(path):
                raise unittest.SkipTest(f'{os.path.basename(path)} 不在')

    def test_a_file_nothing_tears_is_copied_through(self):
        # Byte for byte, so an export that needs no repair is handed on as the
        # artist wrote it. /avatar/* is served cache-immutable, and a repack
        # changes the bytes without changing the model.
        #
        # The fixture is mika-pink rather than the Milfy build because glb.save
        # reproduces its own output exactly: repacking the shipped body is
        # byte-identical to not repacking it, so that file cannot tell the two
        # apart. A VRoid export is not a glb.save product and does not survive
        # the round trip, which the assertion below holds.
        #
        # mika-pink does tear at the default limit, by 27.93mm on Body.baked[4]
        # when the right lower arm turns 90 degrees -- a VRoid garment the Milfy
        # build strips and rebinds, and out of this file's scope. The limit is
        # raised so this reads as the clean case rather than as a claim that the
        # shipped body is clean.
        repacked = out('repacked.vrm')
        doc, binary = glb.load(PINK)
        views = glb.views_of(doc, binary)
        glb.save(repacked, doc, glb.rebuild(doc, views))
        self.assertNotEqual(open(repacked, 'rb').read(), open(PINK, 'rb').read(),
                            'the fixture has to be a file a repack would change')

        path = out('clean.vrm')
        report = dressup.repair(PINK, path, MANIFEST, limit=1000.0)
        self.assertEqual(report['torn'], ())
        self.assertEqual(report['rehomed'], [])
        self.assertEqual(open(path, 'rb').read(), open(PINK, 'rb').read())

    def test_it_repairs_what_it_found_without_being_told_the_mesh(self):
        # 112.93mm snapped, 18.74mm after. Which half of refit carries it
        # depends on the garment, and Milfy's cardigan is the opposite case to
        # the one the step was written for: it hugs the body, so almost nothing
        # sheds and the weight diffusion does the work (23.37mm with the ramp
        # put out of reach, 88.69mm with the diffusion off). The R3 hoodie
        # flares off the ribs and needs the other half -- diffusion alone stalls
        # at 31.93mm there, the shed brings it to 22.99mm (evidence/refit-0909).
        snapped = verify_test.snapped_weights('Outfit_Cardigan')
        self.assertTrue(verify.torn_bindings(snapped))
        path = out('repaired.vrm')
        report = dressup.repair(snapped, path, MANIFEST)
        self.assertEqual(report['torn'], (('Body.baked', 22),))
        self.assertEqual({r['cloth'] for r in report['rehomed']}, {'Body.baked[22]'})
        self.assertEqual(verify.torn_bindings(path), [])

    def test_it_refuses_a_file_the_re_homing_did_not_repair(self):
        # Half the repair turned off, which on this garment leaves 88.69mm of
        # growth. refit still returns a report and still writes the file; what
        # is held here is that the step looks at what it wrote.
        snapped = verify_test.snapped_weights('Outfit_Cardigan')
        path = out('unrepaired.vrm')
        with self.assertRaises(SystemExit) as caught:
            dressup.repair(snapped, path, MANIFEST, weight_passes=0)
        self.assertIn('still tears after re-homing', str(caught.exception))
        self.assertIn('Body.baked[22]', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
