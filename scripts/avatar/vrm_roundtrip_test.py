"""The official exporter adapter must preserve scope and fail closed."""
import hashlib
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from blender import vrm_roundtrip as driver


class OfficialOperators(unittest.TestCase):
    def setUp(self):
        self.armature = SimpleNamespace(name='Mika', type='ARMATURE', data=SimpleNamespace(
            vrm_addon_extension=SimpleNamespace(spec_version='0.0')))
        self.bpy = SimpleNamespace(data=SimpleNamespace(objects=[self.armature]),
            ops=SimpleNamespace(import_scene=SimpleNamespace(vrm=Mock(return_value={'FINISHED'})),
                                export_scene=SimpleNamespace(vrm=Mock(return_value={'FINISHED'}))))

    def test_uses_official_operators_without_preferences_or_conversion(self):
        driver.convert(self.bpy, Path('/fixture/source.vrm'), Path('/fixture/output.vrm'))
        self.bpy.ops.import_scene.vrm.assert_called_once_with(
            filepath='/fixture/source.vrm', use_addon_preferences=False)
        self.bpy.ops.export_scene.vrm.assert_called_once_with(
            filepath='/fixture/output.vrm', armature_object_name='Mika', use_addon_preferences=False)

    def test_import_cancellation_prevents_export(self):
        self.bpy.ops.import_scene.vrm.return_value = {'CANCELLED'}
        with self.assertRaises(RuntimeError):
            driver.convert(self.bpy, Path('source'), Path('output'))
        self.bpy.ops.export_scene.vrm.assert_not_called()

    def test_vrm1_import_is_rejected_without_changing_spec(self):
        self.armature.data.vrm_addon_extension.spec_version = '1.0'
        with self.assertRaises(ValueError):
            driver.convert(self.bpy, Path('source'), Path('output'))
        self.assertEqual(self.armature.data.vrm_addon_extension.spec_version, '1.0')
        self.bpy.ops.export_scene.vrm.assert_not_called()

    def test_ambiguous_armatures_are_rejected(self):
        self.bpy.data.objects.append(self.armature)
        with self.assertRaises(ValueError):
            driver.convert(self.bpy, Path('source'), Path('output'))

    def test_export_cancellation_is_not_success(self):
        self.bpy.ops.export_scene.vrm.return_value = {'CANCELLED'}
        with self.assertRaises(RuntimeError):
            driver.convert(self.bpy, Path('source'), Path('output'))


class PathContract(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve()
        self.source = self.root / 'source.vrm'
        self.source.write_bytes(b'fixture')
        self.allowed = self.root / 'build'
        self.run = self.allowed / 'run'
        self.run.mkdir(parents=True)
        self.addon = self.run / 'vendor' / 'io_scene_vrm'
        self.addon.mkdir(parents=True)
        for name, value in [('SOURCE_MODEL', self.source), ('OUTPUT_ROOT', self.allowed),
                            ('SOURCE_SHA256', hashlib.sha256(b'fixture').hexdigest())]:
            item = patch.object(driver, name, value)
            item.start()
            self.addCleanup(item.stop)

    def validate(self, output=None):
        return driver.validate_paths(self.source, output or self.run / 'model.vrm', self.addon)

    def test_new_confined_output_is_allowed(self):
        self.validate()

    def test_existing_output_is_rejected(self):
        output = self.run / 'model.vrm'
        output.write_bytes(b'existing')
        with self.assertRaises(ValueError):
            self.validate(output)
        self.assertEqual(output.read_bytes(), b'existing')

    def test_source_hash_change_is_rejected(self):
        self.source.write_bytes(b'changed')
        with self.assertRaises(ValueError):
            self.validate()

    def test_outside_output_is_rejected(self):
        with self.assertRaises(ValueError):
            self.validate(self.root / 'outside.vrm')

    def test_output_symlink_parent_is_rejected(self):
        link = self.run / 'link'
        link.symlink_to(self.run, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.validate(link / 'model.vrm')


if __name__ == '__main__':
    unittest.main()
