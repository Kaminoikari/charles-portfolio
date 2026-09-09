"""Research validation must catch missing and collateral effects."""
import copy
import unittest
from unittest.mock import patch

import numpy as np

import glb
import face_module
import module_validation as validation


class FrozenCases(unittest.TestCase):
    def test_unknown_case_id_is_rejected(self):
        with self.assertRaises(ValueError):
            validation.validate_cases({'schemaVersion': 1, 'cases': [{'id': '../wrong', 'recipe': {}}]})

    def test_missing_case_is_rejected(self):
        with self.assertRaises(ValueError):
            validation.validate_cases({'schemaVersion': 1, 'cases': []})

    def test_case_name_cannot_misrepresent_its_parameter(self):
        data = validation.evidence.read_json(validation.DATASET)
        data['cases'][1]['recipe']['modules'][0]['parameters']['jaw_width'] = 1.12
        with self.assertRaises(ValueError):
            validation.validate_cases(data)


class FaceEvidence(unittest.TestCase):
    def setUp(self):
        self.doc = {'asset': {'version': '2.0'}, 'accessors': [], 'bufferViews': [], 'meshes': []}
        self.views = []
        add = lambda values: glb.add_accessor(self.doc, self.views, np.array(values, dtype='<f4'))
        attributes = {'POSITION': add([[.08, 0, 0], [.08, .5, 0], [.08, 1.2, 0]]),
                      'NORMAL': add([[1, 0, 0]] * 3)}
        targets = [{'POSITION': add([[.01, .02, 0]] * 3), 'NORMAL': add([[-.1, .2, 0]] * 3)} for _ in range(56)]
        self.doc['meshes'] = [{'name': 'Face.baked', 'primitives': [{'attributes': attributes, 'targets': targets}]}]
        self.doc['extensions'] = {'VRM': {'blendShapeMaster': {'blendShapeGroups': [
            {'name': str(index), 'presetName': ('blink', 'a', 'i')[index] if index < 3 else str(index), 'binds': [{'mesh': 0, 'index': index, 'weight': 80}]} for index in range(15)]}}}
        self.source = copy.deepcopy(self.doc)
        self.source_views = copy.deepcopy(self.views)
        self.manifest = {'parts': {'Face': {'mesh': 'Face.baked'}}}
        eye = np.eye(4)
        eye[1, 3] = 1.
        self.world = patch.object(validation.humanoid, 'rest_world', return_value={4: eye, 5: eye})
        self.bones = patch.object(validation.humanoid, 'bones', return_value={'leftEye': 4, 'rightEye': 5})
        self.world.start()
        self.bones.start()
        self.addCleanup(self.world.stop)
        self.addCleanup(self.bones.stop)

    def test_actual_face_builder_satisfies_independent_endpoint_formula(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        self.assertTrue(validation.check_face(self.source, self.source_views, self.doc, self.views, 1.12)['passed'])

    def test_no_op_face_builder_is_rejected(self):
        self.assertFalse(validation.check_face(self.source, self.source_views, self.doc, self.views, 1.12)['passed'])

    def test_untransformed_normal_target_is_rejected(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': .88})
        self.doc['meshes'][0]['primitives'][0]['targets'][0]['NORMAL'] = self.source['meshes'][0]['primitives'][0]['targets'][0]['NORMAL']
        self.assertFalse(validation.check_face(self.source, self.source_views, self.doc, self.views, .88)['passed'])

    def test_changed_expression_mapping_is_rejected(self):
        face_module.apply(self.doc, self.views, self.manifest, {'jaw_width': 1.12})
        self.doc['extensions']['VRM']['blendShapeMaster']['blendShapeGroups'][0]['binds'][0]['index'] = 40
        self.assertFalse(validation.check_face(self.source, self.source_views, self.doc, self.views, 1.12)['passed'])


class PreservedPayloads(unittest.TestCase):
    def setUp(self):
        self.doc = {'buffers': [{'byteLength': 0}], 'bufferViews': [], 'accessors': [],
            'materials': [{'name': 'Skin', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}}}],
            'textures': [{'source': 0}], 'images': [{'bufferView': 0, 'mimeType': 'image/png'}],
            'extensions': {'VRM': {'materialProperties': [{'name': 'Skin', 'textureProperties': {'_MainTex': 0}}]}},
            'meshes': [{'name': 'Body', 'primitives': []}],
            'nodes': [{'mesh': 0, 'skin': 0}, {'name': 'Joint'}], 'skins': [{'joints': [1]}]}
        views = []
        glb.add_view(self.doc, views, b'original texture')
        position = glb.add_accessor(self.doc, views, np.zeros((3, 3), dtype=np.float32))
        indices = glb.add_accessor(self.doc, views, np.array([0, 1, 2], dtype=np.uint16))
        self.inverse = glb.add_accessor(self.doc, views, np.eye(4, dtype=np.float32).reshape(1, 16))
        self.skin_index = next(node['skin'] for node in self.doc['nodes'] if node.get('mesh') == 0)
        self.doc['skins'][self.skin_index]['inverseBindMatrices'] = self.inverse
        self.doc['meshes'][0]['primitives'] = [{'attributes': {'POSITION': position}, 'indices': indices, 'material': 0, 'extras': {'part': 'Body_Skin'}}]
        self.binary = glb.rebuild(self.doc, views)

    def signature(self, doc, binary, drops=()):
        return validation.preservation_signature(doc, binary, set(drops), True)

    def test_unchanged_payloads_pass(self):
        self.assertEqual(self.signature(self.doc, self.binary), self.signature(copy.deepcopy(self.doc), self.binary))

    def test_changed_texture_is_rejected_even_when_face_changes_are_allowed(self):
        changed = copy.deepcopy(self.doc)
        views = glb.views_of(changed, self.binary)
        views[0] = bytearray(b'changed texture')
        binary = glb.rebuild(changed, views)
        self.assertNotEqual(self.signature(self.doc, self.binary), self.signature(changed, binary))

    def test_changed_ibm_is_rejected(self):
        changed = copy.deepcopy(self.doc)
        views = glb.views_of(changed, self.binary)
        matrices = glb.read_accessor(changed, views, self.inverse).copy()
        matrices[:, 12] += .1
        views[changed['accessors'][self.inverse]['bufferView']] = bytearray(matrices.tobytes())
        binary = glb.rebuild(changed, views)
        self.assertNotEqual(self.signature(self.doc, self.binary), self.signature(changed, binary))

    def test_no_op_hair_builder_cannot_leave_replaced_geometry(self):
        self.doc['meshes'][0]['primitives'][0]['extras']['part'] = 'Hair_Back'
        expected = self.signature(self.doc, self.binary, drops=('Hair_Back',))
        self.assertNotEqual(expected, self.signature(self.doc, self.binary))


class HairEvidence(unittest.TestCase):
    def setUp(self):
        import hair_module
        from hair_module_test import source
        self.doc, self.views, self.manifest = source()
        hair_module.apply(self.doc, self.views, self.manifest, {'length_scale': 1.})

    def test_actual_hair_builder_passes_geometry_and_sidecar_checks(self):
        self.assertTrue(validation.check_hair(self.doc, self.views, self.manifest)['passed'])

    def test_wrong_vertex_count_is_rejected(self):
        self.manifest['parts']['Hair_Bob_Cap']['vertex_count'] = -1
        self.assertFalse(validation.check_hair(self.doc, self.views, self.manifest)['passed'])

    def test_wrong_bounds_are_rejected(self):
        self.manifest['parts']['Hair_Bob_Cap']['bbox']['min'] = [99, 99, 99]
        self.assertFalse(validation.check_hair(self.doc, self.views, self.manifest)['passed'])

    def test_dynamic_binding_claim_is_rejected(self):
        self.manifest['parts']['Hair_Bob_Cap']['binding']['spring_mode'] = 'dynamic'
        self.assertFalse(validation.check_hair(self.doc, self.views, self.manifest)['passed'])

    def test_wrong_actual_head_slot_is_rejected(self):
        info = self.manifest['parts']['Hair_Bob_Cap']
        mesh = next(mesh for mesh in self.doc['meshes'] if mesh['name'] == info['mesh'])
        index = mesh['primitives'][info['primitives'][0]]['attributes']['JOINTS_0']
        joints = glb.read_accessor(self.doc, self.views, index).copy()
        joints[:, 0] = 0
        self.views[self.doc['accessors'][index]['bufferView']] = bytearray(joints.tobytes())
        self.assertFalse(validation.check_hair(self.doc, self.views, self.manifest)['passed'])


class HairMaterialEvidence(unittest.TestCase):
    def setUp(self):
        import hair_module
        from hair_module_test import source
        self.doc, self.views, self.manifest = source()
        source_info = self.manifest['parts']['Hair_Back']
        source_mesh = next(mesh for mesh in self.doc['meshes'] if mesh['name'] == source_info['mesh'])
        material = source_mesh['primitives'][source_info['primitives'][0]]['material']
        texture_view = glb.add_view(self.doc, self.views, b'original fixture pixels')
        self.doc['images'] = [{'bufferView': texture_view, 'mimeType': 'image/png'}]
        self.doc['textures'] = [{'source': 0}]
        self.doc['materials'][material]['pbrMetallicRoughness'] = {'baseColorTexture': {'index': 0}}
        self.doc['extensions']['VRM']['materialProperties'] = [{'name': entry['name']} for entry in self.doc['materials']]
        self.source, self.source_views, self.source_manifest = copy.deepcopy((self.doc, self.views, self.manifest))
        self.material, self.texture_view = material, texture_view
        hair_module.apply(self.doc, self.views, self.manifest, {'length_scale': 1.})

    def check(self):
        return validation.hair_materials_preserved(self.source, self.source_views, self.source_manifest, self.doc, self.views, self.manifest)

    def test_inherited_bob_material_passes(self):
        self.assertTrue(self.check())

    def test_replacing_bob_only_texture_is_rejected(self):
        self.views[self.texture_view] = bytearray(b'changed fixture pixels')
        self.assertFalse(self.check())

    def test_recolouring_bob_only_material_is_rejected(self):
        self.doc['materials'][self.material]['pbrMetallicRoughness']['baseColorFactor'] = [1, 0, 0, 1]
        self.assertFalse(self.check())


if __name__ == '__main__':
    unittest.main()
