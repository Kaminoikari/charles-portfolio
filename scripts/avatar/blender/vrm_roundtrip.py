"""Thin isolated adapter for the official VRM add-on import/export operators."""
import argparse
import hashlib
import importlib
import json
from pathlib import Path
import sys
from time import perf_counter

ROOT = Path(__file__).resolve().parents[3]
SOURCE_MODEL = ROOT / 'public/avatar/mika-milfy-12.vrm'
OUTPUT_ROOT = ROOT / 'build/mika-reuse'
SOURCE_SHA256 = 'f9f868903d373e06750e8ea4318f0539f282dd1a210bd39467f891d5790593d6'
ADDON_VERSION = (4, 7, 1)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_paths(source, output, addon):
    source, output, addon = (Path(value).absolute() for value in (source, output, addon))
    require(source.resolve() == SOURCE_MODEL.resolve(), 'only the pinned source is allowed')
    require(sha256(source) == SOURCE_SHA256, 'source hash mismatch')
    require(output.is_relative_to(OUTPUT_ROOT) and output.parent != OUTPUT_ROOT, 'output must be in an isolated run')
    require(output.suffix == '.vrm' and not output.exists(), 'output must be a fresh VRM file')
    require(output.parent.is_dir(), 'run directory must already exist')
    require(addon.is_dir() and addon.is_relative_to(output.parent), 'add-on must be isolated with this output')
    for target in (output, addon):
        require('..' not in target.parts, 'path traversal is not allowed')
        require(all(not path.is_symlink() for path in (target, *target.parents)), 'symlink path is not allowed')


def convert(bpy, source, output):
    result = bpy.ops.import_scene.vrm(filepath=str(source), use_addon_preferences=False)
    if result != {'FINISHED'}:
        raise RuntimeError(f'official VRM import failed: {result}')
    armatures = [obj for obj in bpy.data.objects if obj.type == 'ARMATURE']
    require(len(armatures) == 1, 'expected one imported armature')
    armature = armatures[0]
    require(armature.data.vrm_addon_extension.spec_version == '0.0', 'import did not preserve VRM0')
    result = bpy.ops.export_scene.vrm(filepath=str(output), armature_object_name=armature.name,
                                      use_addon_preferences=False)
    if result != {'FINISHED'}:
        raise RuntimeError(f'official VRM export failed: {result}')
    return {'armature': armature.name, 'import_result': ['FINISHED'], 'export_result': ['FINISHED']}


def load_addon(addon):
    import addon_utils
    sys.path.insert(0, str(addon.parent))
    module = importlib.import_module(addon.name)
    require(Path(module.__file__).resolve().parent == addon.resolve(), 'unexpected add-on module source')
    require(tuple(module.bl_info['version']) == ADDON_VERSION, 'unexpected add-on version')
    # Official get_preferences() requires an in-memory addon entry. No prefs save.
    for name in ('io_scene_gltf2', addon.name):
        require(addon_utils.enable(name, default_set=True, persistent=False) is not None,
                f'could not enable {name} in this process')
    return module.bl_info


def read_vrm0(path):
    sys.path.insert(0, str(ROOT / 'scripts/avatar'))
    import glb
    doc, _ = glb.load(str(path))
    extensions = doc.get('extensions', {})
    require('VRM' in extensions and 'VRMC_vrm' not in extensions, 'expected a VRM0 output')
    require(extensions['VRM'].get('specVersion') == '0.0', 'unexpected VRM spec version')
    return doc


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--addon-source', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args(argv)
    source, output, addon = (path.absolute() for path in (args.source, args.output, args.addon_source))
    validate_paths(source, output, addon)
    report_path = output.with_suffix('.roundtrip.json')
    require(not report_path.exists(), 'report already exists')
    read_vrm0(source)
    import bpy
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_info = load_addon(addon)
    started = perf_counter()
    result = convert(bpy, source, output)
    read_vrm0(output)
    require(sha256(source) == SOURCE_SHA256, 'source changed during round-trip')
    result.update(source=str(source), output=str(output), source_sha256=SOURCE_SHA256,
                  output_sha256=sha256(output), source_unchanged=True, vrm_version='0.0',
                  blender_version=bpy.app.version_string, addon_version=addon_info['version'],
                  addon_source=str(addon), seconds=perf_counter() - started,
                  quality_validation='NOT_RUN', sidecar_generated=False)
    with report_path.open('x', encoding='utf-8') as handle:
        json.dump(result, handle, indent=2)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
