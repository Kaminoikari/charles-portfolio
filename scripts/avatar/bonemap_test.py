"""bonemap.py maps a garment's bones onto the humanoid names. These tests
build small rigs in memory and ask for the mapping, so every rule is pinned
by a rig that would map wrongly without it."""
import glob
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bonemap  # noqa: E402
import glb  # noqa: E402

# A VRoid-shaped skeleton, world positions in metres, +X the character's left.
# (name, parent, position). The names here are the generic ones each spelling
# test decorates with its own side separator.
BODY = [
    ('Hips', None, (0.0, 0.76, 0.0)),
    ('Spine', 'Hips', (0.0, 0.85, 0.0)),
    ('Chest', 'Spine', (0.0, 0.95, 0.0)),
    ('Neck', 'Chest', (0.0, 1.20, 0.0)),
    ('Head', 'Neck', (0.0, 1.25, 0.0)),
    ('Shoulder|L', 'Chest', (0.02, 1.18, 0.0)),
    ('Upper_arm|L', 'Shoulder|L', (0.08, 1.18, 0.0)),
    ('Lower_arm|L', 'Upper_arm|L', (0.30, 1.18, 0.0)),
    ('Hand|L', 'Lower_arm|L', (0.52, 1.18, 0.0)),
    ('Shoulder|R', 'Chest', (-0.02, 1.18, 0.0)),
    ('Upper_arm|R', 'Shoulder|R', (-0.08, 1.18, 0.0)),
    ('Lower_arm|R', 'Upper_arm|R', (-0.30, 1.18, 0.0)),
    ('Hand|R', 'Lower_arm|R', (-0.52, 1.18, 0.0)),
    ('Upper_leg|L', 'Hips', (0.07, 0.72, 0.0)),
    ('Lower_leg|L', 'Upper_leg|L', (0.07, 0.40, 0.0)),
    ('Foot|L', 'Lower_leg|L', (0.07, 0.05, 0.0)),
    ('Toe|L', 'Foot|L', (0.07, 0.0, 0.08)),
    ('Upper_leg|R', 'Hips', (-0.07, 0.72, 0.0)),
    ('Lower_leg|R', 'Upper_leg|R', (-0.07, 0.40, 0.0)),
    ('Foot|R', 'Lower_leg|R', (-0.07, 0.05, 0.0)),
    ('Toe|R', 'Foot|R', (-0.07, 0.0, 0.08)),
]

EXPECTED = {
    'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest', 'Neck': 'neck', 'Head': 'head',
    'Shoulder|L': 'leftShoulder', 'Upper_arm|L': 'leftUpperArm',
    'Lower_arm|L': 'leftLowerArm', 'Hand|L': 'leftHand',
    'Shoulder|R': 'rightShoulder', 'Upper_arm|R': 'rightUpperArm',
    'Lower_arm|R': 'rightLowerArm', 'Hand|R': 'rightHand',
    'Upper_leg|L': 'leftUpperLeg', 'Lower_leg|L': 'leftLowerLeg',
    'Foot|L': 'leftFoot', 'Toe|L': 'leftToes',
    'Upper_leg|R': 'rightUpperLeg', 'Lower_leg|R': 'rightLowerLeg',
    'Foot|R': 'rightFoot', 'Toe|R': 'rightToes',
}

# Every VRM humanoid name a target body might declare, with a node index.
TARGET = {name: i for i, name in enumerate([
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
    'leftThumbProximal', 'rightThumbProximal', 'leftEye', 'rightEye', 'jaw',
])}


def spell(name, style):
    """Write a generic 'Stem|L' name the way one vendor would."""
    if '|' not in name:
        return name
    stem, side = name.split('|')
    if style == '.L':
        return f'{stem}.{side}'
    if style == '_L':
        return f'{stem}_{side}'
    if style == ' L':
        return f'{stem.replace("_", " ")} {side}'
    if style == 'Left':
        word = {'L': 'Left', 'R': 'Right'}[side]
        return word + ''.join(p.capitalize() for p in stem.split('_')).replace('Toe', 'Toes')
    raise ValueError(style)


def rig(spec, style='.L', rename=None):
    """A glTF doc with one armature and one skin over every bone in `spec`."""
    rename = rename or {}
    index = {}
    nodes = [{'name': 'Armature', 'children': []}]
    for name, parent, pos in spec:
        index[name] = len(nodes)
        nodes.append({'name': rename.get(name, spell(name, style)), 'translation': list(pos)})
    for name, parent, pos in spec:
        i = index[name]
        if parent is None:
            nodes[0]['children'].append(i)
        else:
            p = index[parent]
            px, py, pz = next(q for n, _, q in spec if n == parent)
            nodes[i]['translation'] = [pos[0] - px, pos[1] - py, pos[2] - pz]
            nodes[p].setdefault('children', []).append(i)
    joints = [index[name] for name, _, _ in spec]
    return {
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': nodes,
        'skins': [{'joints': joints}],
    }, index


def names_of(mapping, doc):
    return {doc['nodes'][i]['name']: v for i, v in mapping['names'].items()}


class Spellings(unittest.TestCase):
    def test_four_side_spellings_map_alike(self):
        """The 2026-09-02 cardigan failure: the bodice spells Shoulder.L and
        the cardigan Shoulder_L, and matching only one form paired four bones
        out of the cardigan's rig."""
        for style in ('.L', '_L', ' L', 'Left'):
            doc, index = rig(BODY, style)
            mapping = bonemap.resolve(doc, TARGET)
            got = {name: mapping['names'].get(index[name]) for name in EXPECTED}
            self.assertEqual(got, EXPECTED, f'spelling {style!r}')
            self.assertEqual(mapping['unmapped_nodes'], [], f'spelling {style!r}')
            # By name, not by shape: topology would place this rig too, and a
            # separator the reader cannot see must not hide behind it.
            self.assertEqual({mapping['how'][index[n]] for n in EXPECTED}, {'alias'}, f'spelling {style!r}')

    def test_numeric_suffix_before_the_side_is_still_a_side(self):
        stem, side = bonemap.canonical('Breast_L.001')
        self.assertEqual((stem, side), ('breast', 'L'))
        self.assertEqual(bonemap.canonical('Skirt1.006.R'), ('skirt1', 'R'))
        self.assertEqual(bonemap.canonical('Support_bone.001_L'), ('supportbone', 'L'))
        self.assertEqual(bonemap.canonical('Thumb Proximal_L'), ('thumbproximal', 'L'))
        self.assertEqual(bonemap.canonical('J_Bip_L_UpperArm'), ('upperarm', 'L'))
        self.assertEqual(bonemap.canonical('mixamorig:RightUpLeg'), ('upleg', 'R'))
        self.assertEqual(bonemap.canonical('Hips'), ('hips', None))


class Chains(unittest.TestCase):
    def test_garment_chain_bones_map_to_nothing(self):
        """Breast, skirt and support chains hang off humanoid bones but are
        not humanoid bones; an alias that pulled one onto chest or an arm
        would pin cloth to the wrong anchor."""
        spec = [
            ('Hips', None, (0.0, 0.76, 0.0)),
            ('Spine', 'Hips', (0.0, 0.85, 0.0)),
            ('Neck', 'Spine', (0.0, 1.20, 0.0)),
            ('Breast_L.001', 'Spine', (0.06, 1.0, 0.05)),
            ('Skirt1.006.R', 'Hips', (-0.1, 0.5, 0.0)),
            ('Support_bone.001_L', 'Spine', (0.2, 1.1, 0.0)),
        ]
        doc, index = rig(spec, rename={n: n for n, _, _ in spec})
        mapping = bonemap.resolve(doc, TARGET)
        got = names_of(mapping, doc)
        self.assertEqual(got, {'Hips': 'hips', 'Spine': 'spine', 'Neck': 'neck'})
        self.assertEqual(sorted(mapping['unmapped_nodes']),
                         ['Breast_L.001', 'Skirt1.006.R', 'Support_bone.001_L'])
        # The build log names what fell through, by stem, so a humanoid bone
        # the table missed is visible there rather than folded into a count.
        text = bonemap.table(mapping, doc)
        for stem in ('breast', 'skirt1', 'supportbone'):
            self.assertIn(stem, text)


    def test_two_bones_on_one_name_keep_the_first_and_report_the_rest(self):
        """A vendor alias for a `.00N` family (Support_bone.001.L, .002.L)
        canonicalises every member to the same humanoid name. Only the first
        may take it; the rest must land in unmapped_nodes, or the fit gets
        the same target landmark twice."""
        spec = BODY + [('Support_bone.001.L', 'Upper_arm|L', (0.20, 1.17, 0.02)),
                       ('Support_bone.002.L', 'Upper_arm|L', (0.24, 1.17, 0.02))]
        doc, index = rig(spec, rename={'Support_bone.001.L': 'Support_bone.001.L',
                                       'Support_bone.002.L': 'Support_bone.002.L'})
        mapping = bonemap.resolve(doc, TARGET, {'aliases': {'Support_bone': 'hand'}})
        self.assertEqual(mapping['names'][index['Hand|L']], 'leftHand')
        self.assertNotIn(index['Support_bone.001.L'], mapping['names'])
        self.assertNotIn(index['Support_bone.002.L'], mapping['names'])
        self.assertEqual(sorted(n for n in mapping['unmapped_nodes'] if n.startswith('Support')),
                         ['Support_bone.001.L', 'Support_bone.002.L'])
        values = list(mapping['names'].values())
        self.assertEqual(len(values), len(set(values)))
        self.assertEqual(sum(1 for _, t in mapping['pairs'] if t == TARGET['leftHand']), 1)


class Topology(unittest.TestCase):
    def test_anonymous_bones_are_placed_by_shape(self):
        """Bone.000 .. Bone.020 with VRoid geometry: nothing to alias, so the
        limbs have to be found from where the bones are."""
        anon = {name: f'Bone.{i:03d}' for i, (name, _, _) in enumerate(BODY)}
        doc, index = rig(BODY, rename=anon)
        mapping = bonemap.resolve(doc, TARGET)
        got = {name: mapping['names'].get(index[name]) for name in EXPECTED}
        self.assertEqual(got, EXPECTED)
        self.assertEqual({mapping['how'][index[n]] for n in EXPECTED}, {'topology'})

    def test_topology_only_fills_what_aliases_left_open(self):
        """A rig whose arm bones are anonymous but whose trunk is named: the
        named bones keep their alias mapping and the arms are found from the
        named chest, not re-derived."""
        anon = {n: f'Bone.{i:03d}' for i, (n, _, _) in enumerate(BODY) if 'arm' in n or 'Hand' in n or 'Shoulder' in n}
        doc, index = rig(BODY, rename=anon)
        mapping = bonemap.resolve(doc, TARGET)
        got = {name: mapping['names'].get(index[name]) for name in EXPECTED}
        self.assertEqual(got, EXPECTED)
        self.assertEqual(mapping['how'][index['Chest']], 'alias')
        self.assertEqual(mapping['how'][index['Lower_arm|L']], 'topology')

    def test_topology_neither_renames_nor_duplicates_what_the_alias_named(self):
        """A trunk whose third bone is anonymous and whose second is named
        UpperChest: by shape the second would be 'chest' and the third 'neck'.
        The alias result on the second must stand (node guard), and the
        third must not become a second 'neck' beside the real one (merge
        guard). Two guards, two different failures, one rig."""
        spec = [
            ('Hips', None, (0.0, 0.76, 0.0)),
            ('Spine', 'Hips', (0.0, 0.85, 0.0)),
            ('UpperChest', 'Spine', (0.0, 0.95, 0.0)),
            ('Bone.003', 'UpperChest', (0.0, 1.10, 0.0)),
            ('Neck', 'Bone.003', (0.0, 1.20, 0.0)),
            ('Head', 'Neck', (0.0, 1.25, 0.0)),
        ] + [(n, 'UpperChest' if p == 'Chest' else p, q) for n, p, q in BODY
             if 'Shoulder' in n or 'arm' in n or 'Hand' in n or 'leg' in n or n.startswith(('Foot', 'Toe'))]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        self.assertEqual(mapping['names'][index['UpperChest']], 'upperChest')
        self.assertEqual(mapping['how'][index['UpperChest']], 'alias')
        self.assertNotIn(index['Bone.003'], mapping['names'])
        values = list(mapping['names'].values())
        self.assertEqual(len(values), len(set(values)), 'two source bones on one humanoid name')

    def test_topology_does_not_rename_the_neck_when_the_rig_has_no_head(self):
        """The cardigan set has no Head bone. Put one anonymous bone between
        its Chest and Neck and by shape that bone is 'neck' and the real Neck
        is 'head'; 'head' is free, so only the per-node guard in the neck/head
        loop stops the alias-named Neck from being re-labelled."""
        spec = [
            ('Hips', None, (0.0, 0.76, 0.0)),
            ('Spine', 'Hips', (0.0, 0.85, 0.0)),
            ('Chest', 'Spine', (0.0, 0.95, 0.0)),
            ('Bone.003', 'Chest', (0.0, 1.10, 0.0)),
            ('Neck', 'Bone.003', (0.0, 1.20, 0.0)),
        ] + [row for row in BODY
             if 'Shoulder' in row[0] or 'arm' in row[0] or 'Hand' in row[0] or 'leg' in row[0] or row[0].startswith(('Foot', 'Toe'))]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        self.assertEqual(mapping['names'][index['Neck']], 'neck')
        self.assertEqual(mapping['how'][index['Neck']], 'alias')
        self.assertNotIn('head', mapping['names'].values())
        self.assertNotIn(index['Bone.003'], mapping['names'])

    def test_topology_never_takes_a_chain_bone_for_a_limb(self):
        """Breast chains leave the chest sideways like arms do. Without the
        NEVER_HUMANOID list they are the best-looking arm candidates."""
        spec = [row for row in BODY if 'arm' not in row[0] and 'Hand' not in row[0] and 'Shoulder' not in row[0]]
        spec += [
            ('Breast.L', 'Chest', (0.06, 1.0, 0.05)),
            ('Breast.L.001', 'Breast.L', (0.12, 1.0, 0.06)),
            ('Breast.L.002', 'Breast.L.001', (0.18, 1.0, 0.06)),
            ('Breast.R', 'Chest', (-0.06, 1.0, 0.05)),
            ('Breast.R.001', 'Breast.R', (-0.12, 1.0, 0.06)),
            ('Breast.R.002', 'Breast.R.001', (-0.18, 1.0, 0.06)),
        ]
        anon = {n: f'Bone.{i:03d}' for i, (n, _, _) in enumerate(spec) if not n.startswith('Breast')}
        doc, index = rig(spec, rename=anon)
        mapping = bonemap.resolve(doc, TARGET)
        for n in ('Breast.L', 'Breast.L.001', 'Breast.L.002', 'Breast.R', 'Breast.R.001', 'Breast.R.002'):
            self.assertNotIn(index[n], mapping['names'], n)
        self.assertNotIn('leftUpperArm', mapping['names'].values())


class Overrides(unittest.TestCase):
    def test_override_adds_a_vendor_finger(self):
        spec = BODY + [('Thumb Proximal|L', 'Hand|L', (0.55, 1.17, 0.02))]
        doc, index = rig(spec, '_L')
        plain = bonemap.resolve(doc, TARGET)
        self.assertNotIn(index['Thumb Proximal|L'], plain['names'],
                         'fingers are per-vendor, not in the generic aliases')
        override = {'aliases': {'Thumb Proximal': 'thumbProximal'}}
        mapping = bonemap.resolve(doc, TARGET, override)
        self.assertEqual(mapping['names'][index['Thumb Proximal|L']], 'leftThumbProximal')
        self.assertEqual(mapping['how'][index['Thumb Proximal|L']], 'override')

    def test_override_beats_the_generic_alias(self):
        """A vendor whose 'Toe' bone is really the foot: the override must
        win, or the vendor file could never correct the table."""
        spec = [row for row in BODY if not row[0].startswith('Foot')]
        spec = [(n, 'Lower_leg' + p[-2:] if p and p.startswith('Foot') else p, q) for n, p, q in spec]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET, {'aliases': {'Toe': 'foot'}})
        self.assertEqual(mapping['names'][index['Toe|L']], 'leftFoot')
        self.assertEqual(mapping['names'][index['Toe|R']], 'rightFoot')
        self.assertEqual(mapping['how'][index['Toe|L']], 'override')

    def test_ignore_patterns_drop_bones_before_anything_else(self):
        doc, index = rig(BODY)
        mapping = bonemap.resolve(doc, TARGET, {'ignore': ['Toe*']})
        self.assertNotIn(index['Toe|L'], mapping['names'])
        self.assertIn('Toe.L', mapping['unmapped_nodes'])

    def test_mirror_swaps_the_sides(self):
        doc, index = rig(BODY)
        mapping = bonemap.resolve(doc, TARGET, {'mirror': True})
        self.assertEqual(mapping['names'][index['Hand|L']], 'rightHand')

    def test_ignore_patterns_read_dot_and_underscore_as_one_separator(self):
        """One vendor's two files spell the same bone Toe.L and Toe_L; a
        pattern written for one must hit the other."""
        doc, index = rig(BODY, '.L')
        mapping = bonemap.resolve(doc, TARGET, {'ignore': ['Toe_*']})
        self.assertNotIn(index['Toe|L'], mapping['names'])
        self.assertNotIn(index['Toe|R'], mapping['names'])

    def test_an_unknown_override_key_is_refused_by_name(self):
        doc, _ = rig(BODY)
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.resolve(doc, TARGET, {'ignores': ['Toe*']})
        self.assertIn('ignores', str(cm.exception))

    def test_a_missing_override_file_is_named(self):
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.load_override(os.path.join(HERE, 'bonemap', 'no-such-vendor.json'))
        self.assertIn('no-such-vendor.json', str(cm.exception))

    def test_a_vrm1_target_gets_the_thumb_under_its_own_names(self):
        """0.x calls the thumb Proximal/Intermediate/Distal, 1.0 calls the same
        three joints Metacarpal/Proximal/Distal. On a 1.0 target the 0.x
        Proximal must land on the metacarpal, and Intermediate on the 1.0
        Proximal, not both on the joint that shares the 0.x name."""
        spec = BODY + [('Thumb Proximal|L', 'Hand|L', (0.55, 1.17, 0.02)),
                       ('Thumb Intermediate|L', 'Thumb Proximal|L', (0.58, 1.16, 0.03))]
        doc, index = rig(spec, '_L')
        override = {'aliases': {'Thumb Proximal': 'thumbProximal', 'Thumb Intermediate': 'thumbIntermediate'}}
        vrm1 = dict(TARGET)
        vrm1['leftThumbMetacarpal'] = 100
        vrm1['leftThumbDistal'] = 102
        pairs = dict(bonemap.resolve(doc, vrm1, override)['pairs'])
        self.assertEqual(pairs[index['Thumb Proximal|L']], 100)
        self.assertEqual(pairs[index['Thumb Intermediate|L']], TARGET['leftThumbProximal'])
        # and a 0.x target keeps the 0.x spelling
        pairs0 = dict(bonemap.resolve(doc, TARGET, override)['pairs'])
        self.assertEqual(pairs0[index['Thumb Proximal|L']], TARGET['leftThumbProximal'])
        self.assertNotIn(index['Thumb Intermediate|L'], pairs0, 'TARGET declares no intermediate')


class BlenderAxes(unittest.TestCase):
    def test_a_z_up_armature_maps_its_limbs_after_from_blender(self):
        """inspect_fbx.py --map builds the rig from Blender's Z-up world
        coordinates. Fed raw, topology finds no leg going down and no spine
        going up; through from_blender() the anonymous rig maps like the
        glTF one does."""
        anon = {name: f'Bone.{i:03d}' for i, (name, _, _) in enumerate(BODY)}
        zup = [(n, p, bonemap.from_blender((x, -z, y))[:3]) for n, p, (x, y, z) in BODY]
        # from_blender((x, -z, y)) == (x, y, z): the rig above is BODY expressed
        # in Blender axes and converted back, which is exactly what --map does.
        doc, index = rig(zup, rename=anon)
        mapping = bonemap.resolve(doc, TARGET)
        got = {name: mapping['names'].get(index[name]) for name in EXPECTED}
        self.assertEqual(got, EXPECTED)
        self.assertEqual(bonemap.from_blender((1.0, 2.0, 3.0)), [1.0, 3.0, -2.0])


class Require(unittest.TestCase):
    def test_a_missing_hips_is_named(self):
        # No hips bone at all: the spine and both legs are separate roots, so
        # topology has no three-chain root to promote either.
        spec = [(n, None if p == 'Hips' else p, q) for n, p, q in BODY if n != 'Hips']
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.require(mapping, doc, set())
        self.assertIn('hips', str(cm.exception))

    def test_a_rig_with_no_trunk_anchor_is_named(self):
        """Hips and legs only: enough anchors to count, nothing above the
        spine for the bodice to hang from."""
        spec = [row for row in BODY if row[0] == 'Hips' or 'leg' in row[0] or row[0].startswith(('Foot', 'Toe'))]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        self.assertGreaterEqual(len(mapping['pairs']), bonemap.MIN_ANCHORS)
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.require(mapping, doc, set())
        self.assertIn('chest', str(cm.exception))

    def test_too_few_anchors_is_named_with_the_count(self):
        spec = BODY[:5]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.require(mapping, doc, set())
        self.assertIn('5', str(cm.exception))

    def test_a_weighted_joint_with_no_mapped_ancestor_is_named(self):
        spec = BODY + [('Loose_root', None, (0.3, 0.3, 0.3)), ('Loose.001', 'Loose_root', (0.3, 0.2, 0.3))]
        doc, index = rig(spec)
        mapping = bonemap.resolve(doc, TARGET)
        bonemap.require(mapping, doc, set())
        with self.assertRaises(bonemap.BadMapping) as cm:
            bonemap.require(mapping, doc, {index['Loose.001']})
        self.assertIn('Loose.001', str(cm.exception))

    def test_a_complete_rig_passes(self):
        doc, index = rig(BODY)
        mapping = bonemap.resolve(doc, TARGET)
        bonemap.require(mapping, doc, set(index.values()))
        text = bonemap.table(mapping, doc)
        self.assertIn('leftUpperArm', text)
        self.assertIn('Upper_arm.L', text)


class VendorFiles(unittest.TestCase):
    """The two MellowHeart sets as Blender exported them. Skipped, with the
    reason printed, when the glbs are not built."""
    INNER = os.path.join(HERE, 'out', 'blender', 'mellow.glb')
    OUTER = os.path.join(HERE, 'out', 'blender', 'mellow_outer.glb')
    OVERRIDE = os.path.join(HERE, 'bonemap', 'mellowheart.json')
    TODAY = {  # outfit.MAP as it stood before the resolver, for the bodice set
        'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest', 'Neck': 'neck',
        'Shoulder.L': 'leftShoulder', 'Shoulder.R': 'rightShoulder',
        'Upper_arm.L': 'leftUpperArm', 'Upper_arm.R': 'rightUpperArm',
        'Upper_leg.L': 'leftUpperLeg', 'Upper_leg.R': 'rightUpperLeg',
        'Lower_leg.L': 'leftLowerLeg', 'Lower_leg.R': 'rightLowerLeg',
        'Foot.L': 'leftFoot', 'Foot.R': 'rightFoot',
        'Toe.L': 'leftToes', 'Toe.R': 'rightToes',
    }

    def setUp(self):
        if not (os.path.exists(self.INNER) and os.path.exists(self.OUTER)):
            self.skipTest('out/blender/mellow*.glb 不在：先跑 make.py 的 Blender 步驟')
        with open(self.OVERRIDE, encoding='utf-8') as fh:
            self.override = json.load(fh)

    def test_the_bodice_set_maps_exactly_what_the_hand_table_did(self):
        doc, _ = glb.load(self.INNER)
        mapping = bonemap.resolve(doc, TARGET, self.override)
        self.assertEqual(names_of(mapping, doc), self.TODAY)
        bonemap.require(mapping, doc, set(doc['skins'][0]['joints']))

    TODAY_OUTER = {  # the ten the hand table paired on the cardigan set
        'Hips': 'hips', 'Spine': 'spine', 'Chest': 'chest', 'Neck': 'neck',
        'Shoulder_L': 'leftShoulder', 'Shoulder_R': 'rightShoulder',
        'Upper_arm_L': 'leftUpperArm', 'Upper_arm_R': 'rightUpperArm',
        'Upper_leg_L': 'leftUpperLeg', 'Upper_leg_R': 'rightUpperLeg',
    }

    def test_the_resolver_can_name_the_cardigans_arm_and_thumb(self):
        """Without the vendor file's ignore list the cardigan's forearm, hand
        and thumb resolve; the hand table never could."""
        doc, _ = glb.load(self.OUTER)
        mapping = bonemap.resolve(doc, TARGET, {'aliases': self.override['aliases']})
        got = names_of(mapping, doc)
        for name in ('leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand',
                     'leftThumbProximal', 'rightThumbProximal'):
            self.assertIn(name, got.values(), name)
        for name in ('leftLowerLeg', 'leftFoot', 'leftToes'):
            self.assertNotIn(name, got.values(), 'the cardigan has no leg bones below the thigh')
        bonemap.require(mapping, doc, set(doc['skins'][0]['joints']))

    def test_the_vendor_file_keeps_the_cardigan_on_the_ten_anchors_it_was_tuned_on(self):
        """Fitting on all sixteen moves the cardigan's scale x1.153 -> x1.188
        and tears the grafted Breasts_Cow shape key (mellowheart.json). Until
        Phase 2 the file pins the ten; this test pins the file."""
        doc, _ = glb.load(self.OUTER)
        mapping = bonemap.resolve(doc, TARGET, self.override)
        self.assertEqual(names_of(mapping, doc), self.TODAY_OUTER)
        self.assertIn('Lower_arm_L', mapping['unmapped_nodes'])
        bonemap.require(mapping, doc, set(doc['skins'][0]['joints']))


if __name__ == '__main__':
    unittest.main(verbosity=2)
