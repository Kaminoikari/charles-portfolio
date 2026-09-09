"""Versioned research modules reject incompatible or ambiguous requests."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import module_contract as contract
import module_assembly as assembly


def recipe(modules=None):
    return {'schemaVersion': 1, 'baseId': 'mika-milfy-12', 'modules': modules or []}


def selection(module_id='face-jaw-v1', parameters=None):
    return {'moduleId': module_id, 'moduleVersion': 1, 'parameters': parameters or {}}


class RecipeContract(unittest.TestCase):
    def test_hair_contract_matches_builder_attachment_and_removal_set(self):
        import hair_module
        catalog = contract.load_catalog()
        hair = next(module for module in catalog['modules'] if module['moduleId'] == 'hair-bob-v1')
        self.assertEqual(hair['attachment']['targetMesh'], hair_module.MESH_NAME)
        self.assertEqual(set(hair['replaceAccessories']), hair_module.ATTACHED_ACCESSORIES)
        self.assertEqual(tuple(hair['addedParts']), hair_module.PART_NAMES)

    def test_face_contract_names_the_frozen_jacobian_policy(self):
        face = contract.load_catalog()['modules'][0]
        self.assertEqual(face['morphPolicy'], 'neutral_tangent_affine_v1')
        self.assertEqual(face['attachment']['mesh'], 'Face.baked')

    def test_control_is_allowed(self):
        self.assertEqual(contract.validate_recipe(recipe())['modules'], [])

    def test_parameter_default_is_explicit(self):
        value = contract.validate_recipe(recipe([selection()]))
        self.assertEqual(value['modules'][0]['parameters'], {'jaw_width': 1.0})

    def test_unknown_top_level_field_is_rejected(self):
        value = recipe()
        value['path'] = '../other.vrm'
        with self.assertRaises(ValueError):
            contract.validate_recipe(value)

    def test_unknown_module_is_rejected(self):
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([selection('../custom.py')]))

    def test_unknown_version_is_rejected(self):
        value = selection()
        value['moduleVersion'] = 2
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([value]))

    def test_boolean_version_is_rejected(self):
        value = selection()
        value['moduleVersion'] = True
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([value]))

    def test_duplicate_kind_is_rejected(self):
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([selection(), selection()]))

    def test_invalid_parameter_values_are_rejected(self):
        for value in (True, float('nan'), float('inf'), 1.13, 0.87):
            with self.subTest(value=value), self.assertRaises(ValueError):
                contract.validate_recipe(recipe([selection(parameters={'jaw_width': value})]))

    def test_unknown_parameter_is_rejected(self):
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([selection(parameters={'eye_tilt': 0.1})]))

    def test_module_cannot_supply_an_arbitrary_path(self):
        value = selection()
        value['path'] = '/tmp/other.py'
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([value]))

    def test_hair_parameter_has_its_own_range(self):
        with self.assertRaises(ValueError):
            contract.validate_recipe(recipe([selection('hair-bob-v1', {'length_scale': 1.11})]))

    def test_face_is_ordered_before_hair(self):
        value = contract.validate_recipe(recipe([selection('hair-bob-v1'), selection()]))
        self.assertEqual([entry['moduleId'] for entry in value['modules']], ['face-jaw-v1', 'hair-bob-v1'])

    def test_source_hash_mismatch_is_rejected(self):
        with patch.object(contract, 'sha256', return_value='changed'):
            with self.assertRaisesRegex(ValueError, 'hash'):
                contract.verify_sources()


class AssemblyContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name).resolve()
        self.source = self.root / 'source.vrm'
        self.manifest = self.root / 'source.parts.json'
        doc = {'asset': {'version': '2.0'}, 'meshes': [], 'materials': [],
               'accessors': [], 'bufferViews': [],
               'extensions': {'VRM': {'materialProperties': []}}}
        assembly.glb.save(str(self.source), doc, assembly.glb.rebuild(doc, []))
        with self.manifest.open('w') as handle:
            json.dump({'parts': {}, 'palette': {}}, handle)
        patches = [patch.object(assembly, 'OUTPUT_ROOT', self.root / 'output'),
                   patch.object(contract, 'SOURCE_MODEL', self.source),
                   patch.object(contract, 'SOURCE_MANIFEST', self.manifest),
                   patch.object(contract, 'verify_sources', return_value={'modelSha256': 'fixture', 'manifestSha256': 'fixture'})]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def test_hash_failure_precedes_any_output(self):
        output = self.root / 'output' / 'failed'
        with patch.object(contract, 'verify_sources', side_effect=ValueError('hash mismatch')):
            with self.assertRaises(ValueError):
                assembly.apply(recipe(), output)
        self.assertFalse(output.exists())

    def test_existing_output_directory_is_rejected(self):
        output = self.root / 'output' / 'existing'
        output.mkdir(parents=True)
        with self.assertRaises(FileExistsError):
            assembly.apply(recipe(), output)

    def test_output_outside_authorised_subtree_is_rejected(self):
        with self.assertRaises(ValueError):
            assembly.apply(recipe(), self.root / 'outside')

    def test_relative_traversal_is_rejected(self):
        with self.assertRaises(ValueError):
            assembly.apply(recipe(), self.root / 'output' / 'case' / '..')

    def test_source_change_during_build_is_rejected(self):
        with patch.object(contract, 'verify_sources', side_effect=[{'modelSha256': 'before'}, {'modelSha256': 'after'}]):
            with self.assertRaisesRegex(ValueError, 'changed during assembly'):
                assembly.apply(recipe(), self.root / 'output' / 'changed')

    def test_builders_run_in_fixed_order_with_normalised_parameters(self):
        calls = []
        def face(doc, views, manifest, parameters):
            calls.append(('face', parameters))
            return {'effect': 'face fixture'}
        def hair(doc, views, manifest, parameters):
            calls.append(('hair', parameters))
            return {'effect': 'hair fixture'}
        with patch.dict(assembly.BUILDERS, {'face-jaw-v1': face, 'hair-bob-v1': hair}):
            assembly.apply(recipe([selection('hair-bob-v1'), selection()]), self.root / 'output' / 'ordered')
        self.assertEqual(calls, [('face', {'jaw_width': 1.0}), ('hair', {'length_scale': 1.0})])

    def test_output_manifest_remains_research_only(self):
        output = self.root / 'output' / 'control'
        assembly.apply(recipe(), output)
        with (output / 'model.parts.json').open() as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest['moduleAssembly']['status'], 'research_only')

    def test_manifest_preserves_the_exact_selected_contract_snapshot(self):
        output = self.root / 'output' / 'contract-snapshot'
        with patch.dict(assembly.BUILDERS, {'face-jaw-v1': lambda *args: {'fixture': True}}):
            assembly.apply(recipe([selection()]), output)
        with (output / 'model.parts.json').open() as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest['moduleAssembly']['modules'][0]['contract'], contract.load_catalog()['modules'][0])


if __name__ == '__main__':
    unittest.main()
