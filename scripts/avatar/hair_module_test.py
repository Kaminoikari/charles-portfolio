"""A replacement hairstyle must be geometry, with explicit static binding."""
import copy
import unittest

import numpy as np

import glb
import hair_module


def source():
    doc = {'asset': {'version': '2.0'}, 'accessors': [], 'bufferViews': [],
           'materials': [{'name': name} for name in ('Face_SKIN', 'Hair', 'EyeWhite', 'Coat')],
           'meshes': [], 'skins': [{'joints': [0]}, {'joints': [1, 0]}],
           'nodes': [{'name': 'head', 'translation': [0, 1.32, 0]},
                     {'name': 'neck', 'translation': [0, 1.24, 0]},
                     {'mesh': 0, 'skin': 0}, {'mesh': 1, 'skin': 1}, {'mesh': 2, 'skin': 0}],
           'scenes': [{'nodes': [0, 1, 2, 3, 4]}], 'scene': 0,
           'extensions': {'VRM': {'humanoid': {'humanBones': [
               {'bone': 'head', 'node': 0}, {'bone': 'neck', 'node': 1}]},
               'secondaryAnimation': {'boneGroups': [{'bones': [0]}]},
               'blendShapeMaster': {'blendShapeGroups': []}}}}
    views = []

    def primitive(points, material, part=None):
        points = np.asarray(points, dtype=np.float32)
        attributes = {'POSITION': glb.add_accessor(doc, views, points, minmax=True),
                      'NORMAL': glb.add_accessor(doc, views, np.tile([0, 0, -1.0], (len(points), 1)).astype('<f4')),
                      'TEXCOORD_0': glb.add_accessor(doc, views, np.zeros((len(points), 2), dtype='<f4')),
                      'JOINTS_0': glb.add_accessor(doc, views, np.zeros((len(points), 4), dtype='<u2')),
                      'WEIGHTS_0': glb.add_accessor(doc, views, np.tile([1, 0, 0, 0], (len(points), 1)).astype('<f4'))}
        pr = {'attributes': attributes, 'indices': glb.add_accessor(doc, views, np.array([0, 1, 2], dtype='<u2')), 'material': material}
        if part:
            pr['extras'] = {'part': part}
        return pr

    face = primitive([[-.09, 1.28, -.11], [.09, 1.28, -.11], [0, 1.52, .035]], 0)
    eyes = primitive([[-.07, 1.36, -.09], [.07, 1.36, -.09], [0, 1.41, -.09]], 2)
    triangle = [[-.1, 1.45, 0], [.1, 1.45, 0], [0, 1.53, .03]]
    doc['meshes'] = [{'name': 'Face.baked', 'primitives': [face, eyes]},
                     {'name': 'HairSource', 'primitives': [primitive(triangle, 1, name) for name in ('Hair_Back', 'Acc_Crown', 'Acc_Earring')]},
                     {'name': 'Body', 'primitives': [primitive(triangle, 3, 'Outfit_Top')]}]
    parts = {'Face': {'mesh': 'Face.baked', 'primitives': [0, 1], 'deletable': False},
             'Outfit_Top': {'mesh': 'Body', 'primitives': [0], 'deletable': True}}
    parts.update({name: {'mesh': 'HairSource', 'primitives': [i], 'deletable': True}
                  for i, name in enumerate(('Hair_Back', 'Acc_Crown', 'Acc_Earring'))})
    return doc, views, {'parts': parts, 'palette': {}}


class BobModule(unittest.TestCase):
    def setUp(self):
        self.doc, self.views, self.manifest = source()

    def build(self, parameters=None):
        return hair_module.apply(self.doc, self.views, self.manifest, parameters or {})

    def pieces(self):
        mesh = next(mesh for mesh in self.doc['meshes'] if mesh['name'] == 'Hair_Bob_Prototype')
        for pr in mesh['primitives']:
            if pr.get('extras', {}).get('part') not in hair_module.PART_NAMES:
                continue
            yield pr, glb.read_accessor(self.doc, self.views, pr['attributes']['POSITION'])

    def test_replacement_reuses_original_mesh_node_and_skin(self):
        nodes = copy.deepcopy(self.doc['nodes'])
        mesh_count = len(self.doc['meshes'])
        self.build()
        self.assertEqual(len(self.doc['meshes']), mesh_count)
        self.assertEqual(self.doc['nodes'], nodes)

    def test_replacement_does_not_leave_empty_meshes(self):
        self.doc['meshes'][1]['primitives'].pop()
        del self.manifest['parts']['Acc_Earring']
        self.build()
        self.assertTrue(all(mesh['primitives'] for mesh in self.doc['meshes']))

    def test_retained_accessory_manifest_tracks_renamed_mesh(self):
        self.build()
        info = self.manifest['parts']['Acc_Earring']
        mesh = next(mesh for mesh in self.doc['meshes'] if mesh['name'] == info['mesh'])
        self.assertEqual(mesh['primitives'][info['primitives'][0]]['extras']['part'], 'Acc_Earring')

    def test_module_adds_cap_shell_and_independent_bangs(self):
        result = self.build()
        self.assertEqual(set(result['added_parts']), {'Hair_Bob_Cap', 'Hair_Bob_Shell', 'Hair_Bob_Bangs'})

    def test_generated_triangles_have_nonzero_area(self):
        self.build()
        for pr, pos in self.pieces():
            a, b, c = pos[glb.read_accessor(self.doc, self.views, pr['indices']).reshape(-1, 3)].transpose(1, 0, 2)
            self.assertTrue((np.linalg.norm(np.cross(b - a, c - a), axis=1) > 1e-9).all())

    def test_normals_are_unit_and_agree_with_winding(self):
        self.build()
        for pr, pos in self.pieces():
            n = glb.read_accessor(self.doc, self.views, pr['attributes']['NORMAL'])
            tri = glb.read_accessor(self.doc, self.views, pr['indices']).reshape(-1, 3)
            np.testing.assert_allclose(np.linalg.norm(n, axis=1), 1, atol=1e-6)
            a, b, c = pos[tri].transpose(1, 0, 2)
            self.assertTrue((np.einsum('ij,ij->i', np.cross(b - a, c - a), n[tri].mean(axis=1)) > 0).all())

    def test_binding_resolves_head_slot_from_the_hair_mesh_skin(self):
        self.build()
        for pr, _ in self.pieces():
            joint = glb.read_accessor(self.doc, self.views, pr['attributes']['JOINTS_0'])
            weights = glb.read_accessor(self.doc, self.views, pr['attributes']['WEIGHTS_0'])
            self.assertTrue((joint[:, 0] == 1).all())
            np.testing.assert_array_equal(weights, np.tile([1, 0, 0, 0], (len(weights), 1)))

    def test_replacement_keeps_unrelated_accessories(self):
        self.build()
        self.assertEqual(set(self.manifest['parts']), {'Face', 'Outfit_Top', 'Acc_Earring', 'Hair_Bob_Cap', 'Hair_Bob_Shell', 'Hair_Bob_Bangs'})

    def test_original_face_clothes_skin_and_spring_data_are_preserved(self):
        before = copy.deepcopy(self.doc)
        self.build()
        for key in ('skins', 'extensions'):
            self.assertEqual(self.doc[key], before[key])
        for index in (0, 2):
            self.assertEqual(self.doc['meshes'][index], before['meshes'][index])

    def test_length_parameter_changes_the_new_geometry(self):
        self.build({'length_scale': .9})
        short = min(pos[:, 1].min() for _, pos in self.pieces())
        self.doc, self.views, self.manifest = source()
        self.build({'length_scale': 1.1})
        self.assertLess(min(pos[:, 1].min() for _, pos in self.pieces()), short - .02)

    def test_invalid_parameter_is_rejected_before_mutation(self):
        for value in (True, float('nan'), .89, 1.11, '1'):
            with self.subTest(value=value):
                before = copy.deepcopy(self.doc)
                with self.assertRaises(ValueError):
                    self.build({'length_scale': value})
                self.assertEqual(self.doc, before)

    def test_front_fringe_stays_above_the_eye_window(self):
        result = self.build()
        for pr, pos in self.pieces():
            if pr['extras']['part'] == 'Hair_Bob_Bangs':
                self.assertGreater(pos[:, 1].min(), result['measurements']['eye_top'])

    def test_manifest_records_static_binding_and_actual_bounds(self):
        self.build()
        for pr, pos in self.pieces():
            info = self.manifest['parts'][pr['extras']['part']]
            self.assertEqual(info['binding']['spring_mode'], 'static_head')
            np.testing.assert_allclose(info['bbox']['min'], pos.min(axis=0), atol=1e-7)
            self.assertEqual(info['vertex_count'], len(pos))


if __name__ == '__main__':
    unittest.main()
