"""The experiment must reject invalid recipes and keep business gates honest."""
import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

import platform_validation as validation


def dataset():
    return {'schemaVersion': 1, 'synthetic': True, 'briefs': [{
        'id': 'B01', 'recipeVersion': 1, 'baseId': validation.BASE_ID,
        'title': 'Remove crown', 'requirements': ['Keep face and hair'],
        'operations': [{'kind': 'drop', 'part': 'Acc_Crown'}],
    }]}


MANIFEST = {'parts': {'Acc_Crown': {'deletable': True},
                      'Face': {'deletable': False}},
            'palette': {'Mint': {'parts': ['Acc_Crown']}}}


class RecipeValidation(unittest.TestCase):
    def test_valid_drop_is_supported(self):
        self.assertTrue(validation.validate_dataset(dataset(), MANIFEST)[0]['supported'])

    def test_unknown_operation_is_invalid(self):
        data = dataset()
        data['briefs'][0]['operations'][0]['kind'] = 'invent'
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)

    def test_known_missing_capability_is_blocked(self):
        data = dataset()
        data['briefs'][0]['operations'] = [{'kind': 'new_face', 'description': 'Round face'}]
        self.assertFalse(validation.validate_dataset(data, MANIFEST)[0]['supported'])

    def test_locked_part_is_invalid(self):
        data = dataset()
        data['briefs'][0]['operations'][0]['part'] = 'Face'
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)

    def test_missing_part_is_invalid(self):
        data = dataset()
        data['briefs'][0]['operations'][0]['part'] = 'Unknown'
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)

    def test_non_numeric_or_out_of_range_rgb_is_invalid(self):
        for rgb in ([True, 0, 0], [float('nan'), 0, 0], [2, 0, 0]):
            with self.subTest(rgb=rgb):
                data = dataset()
                data['briefs'][0]['operations'] = [{'kind': 'tint', 'material': 'Mint', 'rgb': rgb}]
                with self.assertRaises(ValueError):
                    validation.validate_dataset(data, MANIFEST)

    def test_duplicate_id_is_invalid(self):
        data = dataset()
        data['briefs'].append(copy.deepcopy(data['briefs'][0]))
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)

    def test_path_id_is_invalid(self):
        data = dataset()
        data['briefs'][0]['id'] = '../B01'
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)

    def test_tint_after_deleting_its_only_part_is_invalid(self):
        data = dataset()
        data['briefs'][0]['operations'].append({'kind': 'tint', 'material': 'Mint', 'rgb': [0, 0, 0]})
        with self.assertRaises(ValueError):
            validation.validate_dataset(data, MANIFEST)


class Reporting(unittest.TestCase):
    def test_blocked_requests_remain_in_denominator(self):
        cases = [{'status': 'TECHNICAL_PASS'}] * 6 + [{'status': 'BLOCKED'}] * 4
        self.assertEqual(validation.summarise(cases)['coverage'], 0.6)

    def test_executed_workflow_can_miss_goal_gate(self):
        summary = validation.summarise([{'status': 'TECHNICAL_PASS'}] * 6 + [{'status': 'BLOCKED'}] * 4)
        self.assertEqual(summary['full_brief_support'], 'NOT_MET')

    def test_technical_pass_does_not_claim_visual_acceptance(self):
        self.assertEqual(validation.pending_checks()['visual_acceptance'], 'NOT_RUN')

    def test_unknown_result_status_fails_closed(self):
        self.assertEqual(validation.summarise([{'status': 'SKIPPED'}])['validation_execution'], 'FAILED')

    def test_output_collision_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(validation, 'OUTPUT_ROOT', Path(tmp).resolve()):
            validation.reserve_run('test-run')
            with self.assertRaises(FileExistsError):
                validation.reserve_run('test-run')

    def test_output_traversal_is_rejected(self):
        with self.assertRaises(ValueError):
            validation.reserve_run('../outside')

    def test_builder_receives_independent_source_and_recipe(self):
        brief = validation.validate_dataset(dataset(), MANIFEST)[0]
        with tempfile.TemporaryDirectory() as tmp, patch.object(validation.customise, 'apply', return_value={}) as apply:
            source = Path(tmp) / 'source.vrm'
            manifest = Path(tmp) / 'source.parts.json'
            output = Path(tmp) / 'output'
            output.mkdir()
            validation.build_candidate(brief, output, source, manifest)
            self.assertEqual(apply.call_args.args[0], str(source))
            self.assertEqual(apply.call_args.kwargs['drop'], ['Acc_Crown'])

    def test_blocked_request_never_calls_builder(self):
        data = dataset()
        data['briefs'][0]['operations'] = [{'kind': 'new_face', 'description': 'Round face'}]
        brief = validation.validate_dataset(data, MANIFEST)[0]
        with tempfile.TemporaryDirectory() as tmp, patch.object(validation, 'build_candidate') as builder:
            result = validation.run_case(brief, Path(tmp))
            self.assertEqual(result['status'], 'BLOCKED')
            builder.assert_not_called()

    def test_failed_builder_is_recorded_as_failed(self):
        brief = validation.validate_dataset(dataset(), MANIFEST)[0]
        with tempfile.TemporaryDirectory() as tmp, patch.object(validation, 'build_candidate', side_effect=ValueError('fixture failure')):
            result = validation.run_case(brief, Path(tmp))
            self.assertEqual(result['status'], 'FAILED')

    def test_renderer_called_with_all_real_views(self):
        brief = validation.validate_dataset(dataset(), MANIFEST)[0]
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            paths = []
            for view in validation.RENDER_VIEWS:
                path = directory / f'preview-{view}.png'
                path.touch()
                paths.append(str(path))
            with patch.object(validation, 'build_candidate', return_value={}), \
                 patch.object(validation.verify, 'report', return_value=(True, {'tris': 1})), \
                 patch.object(validation, 'measure_effects', return_value={'passed': True}), \
                 patch.object(validation.render, 'render', return_value=paths) as renderer:
                with self.assertRaisesRegex(ValueError, 'every requested view'):
                    validation.execute_candidate(brief, directory, directory / 'source.vrm', directory / 'manifest.json')
                self.assertEqual(renderer.call_args.kwargs['only'], validation.RENDER_VIEWS)


class RetainedGeometry(unittest.TestCase):
    def setUp(self):
        face = {'attributes': {'POSITION': 0}, 'indices': 1}
        crown = {'attributes': {'POSITION': 2}, 'indices': 3, 'extras': {'part': 'Acc_Crown'}}
        self.source = {'meshes': [{'name': 'Face.baked', 'primitives': [face]},
                                  {'name': 'Hair', 'primitives': [crown]}]}
        self.operations = [{'kind': 'drop', 'part': 'Acc_Crown'}]
        self.views = patch.object(validation.glb, 'views_of', return_value=[])
        self.accessors = patch.object(validation.glb, 'read_accessor', side_effect=lambda doc, views, index: np.array([index], dtype=np.float32))
        self.views.start()
        self.accessors.start()
        self.addCleanup(self.views.stop)
        self.addCleanup(self.accessors.stop)

    def test_exact_removal_preserves_unnamed_face_primitive(self):
        output = copy.deepcopy(self.source)
        output['meshes'][1]['primitives'] = []
        self.assertTrue(validation.retained_primitives_match(self.source, b'', output, b'', self.operations))

    def test_no_op_removal_is_rejected(self):
        self.assertFalse(validation.retained_primitives_match(self.source, b'', self.source, b'', self.operations))

    def test_collateral_face_removal_is_rejected(self):
        output = {'meshes': []}
        self.assertFalse(validation.retained_primitives_match(self.source, b'', output, b'', self.operations))

    def test_collateral_vertex_change_is_rejected(self):
        output = copy.deepcopy(self.source)
        output['meshes'][1]['primitives'] = []
        output['meshes'][0]['primitives'][0]['attributes']['POSITION'] = 7
        self.assertFalse(validation.retained_primitives_match(self.source, b'', output, b'', self.operations))


class ReferencedPayloads(unittest.TestCase):
    def setUp(self):
        self.doc = {
            'buffers': [{'byteLength': 0}], 'bufferViews': [], 'accessors': [],
            'materials': [{'name': 'Cloth', 'pbrMetallicRoughness': {
                'baseColorTexture': {'index': 0}}}],
            'textures': [{'source': 0}], 'images': [{'bufferView': 0, 'mimeType': 'image/png'}],
            'extensions': {'VRM': {'materialProperties': [{'name': 'Cloth',
                'textureProperties': {'_MainTex': 0}}]}},
            'meshes': [{'name': 'Body', 'primitives': []}],
            'nodes': [{'mesh': 0, 'skin': 0}, {'name': 'Joint'}],
            'skins': [{'joints': [1]}],
        }
        views = []
        validation.glb.add_view(self.doc, views, b'original texture')
        positions = validation.glb.add_accessor(self.doc, views, np.zeros((3, 3), dtype=np.float32))
        indices = validation.glb.add_accessor(self.doc, views, np.array([0, 1, 2], dtype=np.uint16))
        inverse = validation.glb.add_accessor(self.doc, views, np.eye(4, dtype=np.float32).reshape(1, 16))
        self.skin_index = next(node['skin'] for node in self.doc['nodes'] if node.get('mesh') == 0)
        self.doc['skins'][self.skin_index]['inverseBindMatrices'] = inverse
        self.doc['meshes'][0]['primitives'].append({
            'attributes': {'POSITION': positions}, 'indices': indices, 'material': 0})
        self.binary = validation.glb.rebuild(self.doc, views)

    def test_tint_cannot_change_referenced_texture_bytes(self):
        changed = copy.deepcopy(self.doc)
        views = validation.glb.views_of(changed, self.binary)
        views[0] = bytearray(b'changed texture!')
        binary = validation.glb.rebuild(changed, views)
        operations = [{'kind': 'tint', 'material': 'Cloth', 'rgb': [0.1, 0.2, 0.3]}]

        self.assertFalse(validation.retained_primitives_match(
            self.doc, self.binary, changed, binary, operations))

    def test_retained_skin_cannot_change_inverse_bind_matrices(self):
        changed = copy.deepcopy(self.doc)
        views = validation.glb.views_of(changed, self.binary)
        index = changed['skins'][self.skin_index]['inverseBindMatrices']
        matrices = validation.glb.read_accessor(changed, views, index).copy()
        matrices[:, 12] += 0.1
        views[changed['accessors'][index]['bufferView']] = bytearray(matrices.tobytes())
        binary = validation.glb.rebuild(changed, views)

        self.assertFalse(validation.retained_primitives_match(
            self.doc, self.binary, changed, binary, []))

    def test_retained_skin_cannot_change_joint_mapping(self):
        changed = copy.deepcopy(self.doc)
        changed['skins'][self.skin_index]['joints'] = [0]

        self.assertFalse(validation.retained_primitives_match(
            self.doc, self.binary, changed, self.binary, []))

    def test_unchanged_referenced_payloads_pass(self):
        self.assertTrue(validation.retained_primitives_match(
            self.doc, self.binary, copy.deepcopy(self.doc), self.binary, []))


if __name__ == '__main__':
    unittest.main()
