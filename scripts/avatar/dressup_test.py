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

import numpy as np  # noqa: E402

import dressup  # noqa: E402
import glb  # noqa: E402
import refit  # noqa: E402
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


def _hoodie_weight_gap(one, other):
    """The largest per-slot weight difference on the cardigan between two files."""
    def weights(path):
        doc, binary = glb.load(path)
        _, piece = refit.piece_of(doc, glb.views_of(doc, binary), 'Body.baked', 22)
        return np.asarray(piece['weights'])
    return float(np.abs(weights(one) - weights(other)).max())


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
        # is held here is that the step looks at what it wrote, and that the file
        # refit left behind does not survive the refusal.
        snapped = verify_test.snapped_weights('Outfit_Cardigan')
        path = out('unrepaired.vrm')
        with self.assertRaises(SystemExit) as caught:
            dressup.repair(snapped, path, MANIFEST, weight_passes=0)
        self.assertIn('still tears after re-homing', str(caught.exception))
        self.assertIn('Body.baked[22]', str(caught.exception))
        self.assertFalse(os.path.exists(path), 'a still-torn file was left at the output path')

    def test_it_refuses_a_tear_the_manifest_does_not_call_a_garment(self):
        # Snapping the body's own weights tears Body.baked[0], which is skin.
        # Re-homing hands a limb's share of free-hanging cloth to the joint the
        # limb hangs from; skin does not hang off the body, and refit would be
        # rewriting the very pool it measures distance against.
        snapped = verify_test.snapped_weights('Body_Skin')
        self.assertEqual(dressup.torn_cloth(snapped), (('Body.baked', 0),))
        path = out('skin.vrm')
        with self.assertRaises(SystemExit) as caught:
            dressup.repair(snapped, path, MANIFEST)
        self.assertIn('does not call a garment', str(caught.exception))
        self.assertIn('Body.baked[0]', str(caught.exception))
        self.assertFalse(os.path.exists(path))

    def test_it_measures_distance_against_the_manifest_it_was_given(self):
        # repair has its own copy of "which body", and the pixel counts of a
        # finished file do not carry it: the pool is the shed field's only input,
        # so a repair run against a smaller pool writes different weights. Two
        # runs of the same file, one pool a subset of the other.
        snapped = verify_test.snapped_weights('Outfit_Cardigan')
        parts = json.load(open(MANIFEST, encoding='utf-8'))['parts']
        thin = {name: info for name, info in parts.items()
                if name == 'Face' or name.startswith(('Outfit_', 'Acc_', 'Hair_'))}
        thin_path = out('thin.parts.json')
        with open(thin_path, 'w', encoding='utf-8') as handle:
            json.dump({'parts': thin}, handle)
        self.assertLess(len(dressup.body_primitives(thin_path)),
                        len(dressup.body_primitives(MANIFEST)))

        full, small = out('full.vrm'), out('small.vrm')
        dressup.repair(snapped, full, MANIFEST)
        dressup.repair(snapped, small, thin_path)
        self.assertGreater(_hoodie_weight_gap(full, small), 0.1)


class TheOrderOfThePipeline(unittest.TestCase):
    """What `prepare` decides, which neither step decides for itself.

    refit and cover are each tested on the geometry they rewrite. What is only
    true of the two together is the ORDER: refit measures how far each garment
    has shed from the body, and the pool it measures against is the manifest's
    skin, so cutting that skin first hands it a pool with new holes in it. The
    two steps are stubbed here because the real pair takes eight minutes on the
    export; the entry point being driven is the real `prepare`, and what is
    asserted is what it passes to whom.
    """

    def run_prepare(self, converged=True):
        import shutil
        calls = []

        def repair(src, dst, manifest, **kw):
            calls.append(('refit', src, dst))
            shutil.copyfile(src, dst)
            return {'stub': True}

        def trim(src, dst, manifest, **kw):
            calls.append(('cover', src, dst))
            shutil.copyfile(src, dst)
            # 9317 rather than a single digit: the message this has to turn
            # up in starts with a mkdtemp path, so one random character in
            # eight matching would pass the assertion with the number gone.
            return {'path': dst, 'bytes': 0, 'cut': [], 'rounds': [{'lost': 9317}],
                    'converged': converged, 'first_cut': {}}

        out = os.path.join(tempfile.mkdtemp(), 'prepared.vrm')
        old_repair, old_trim = dressup.repair, dressup.cover.trim
        dressup.repair, dressup.cover.trim = repair, trim
        try:
            report = dressup.prepare(SHIPPED, out, MANIFEST, clips=[], samples=1)
        finally:
            dressup.repair, dressup.cover.trim = old_repair, old_trim
        return calls, report, out

    def test_the_weights_are_repaired_before_the_geometry_is_cut(self):
        calls, _, _ = self.run_prepare()
        self.assertEqual([c[0] for c in calls], ['refit', 'cover'],
                         'the cull ran before the repair, so refit measured '
                         'shed against a body with the cut already in it')
        self.assertEqual(calls[1][1], calls[0][2],
                         'the cull read the original export rather than the '
                         'file refit repaired, so the repair is thrown away')

    def test_a_cut_that_never_settled_stops_the_run(self):
        with self.assertRaises(SystemExit) as caught:
            self.run_prepare(converged=False)
        self.assertIn('9317 left', str(caught.exception),
                      'the run stopped without saying how much it still loses')


class TheWaiverReachesTheGate(unittest.TestCase):
    """A declared waiver has to change what motion.check allows.

    pierce.waivers is tested on the manifest it reads and pierce.limit on the
    number it returns. What is only true of the two together is that check()
    hands one to the other: drop that and every waiver in every manifest goes
    quietly back to the undeclared limit.
    """

    def test_a_declared_waiver_raises_the_limit_check_scores_against(self):
        import motion
        import pierce
        body = os.path.join(HERE, '..', '..', 'public', 'avatar',
                            'vroid-studio-dressup.vrm')
        manifest = body.replace('.vrm', '.parts.json')
        clip = os.path.join(HERE, '..', '..', 'public', 'avatar', 'animations',
                            'dance.vrma')
        with open(manifest, encoding='utf-8') as handle:
            declared = json.load(handle)
        self.assertTrue(declared.get('pierce_waivers'),
                        'this manifest declares no waiver, so nothing below '
                        'is being exercised')
        seen = []
        old = pierce.limit
        pierce.limit = lambda area, waiver=0: (seen.append((area, waiver))
                                               or old(area, waiver))
        try:
            motion.check(body, manifest, [clip], samples=1)
        finally:
            pierce.limit = old
        waived = {part: w['pixels'] for part, w in declared['pierce_waivers'].items()}
        self.assertTrue(seen, 'check never asked for a limit')
        self.assertTrue(any(w in waived.values() for _, w in seen),
                        f'check scored every part against a waiver of 0; the '
                        f'manifest declares {waived}')


# At the end, where it has to be. This sat at line 194 until 2026-09-11, above
# the two classes below it, so running this file collected 8 tests and the 3 in
# `TheOrderOfThePipeline` and `TheWaiverReachesTheGate` never ran at all -- and
# nothing said so, because 8 of 8 passing prints exactly like a full run. All
# three pass. Found because a suite receipt quoted this file at 8 tests while
# the loader collected 11.
if __name__ == '__main__':
    unittest.main()
