"""Offline, synthetic coverage probe for the existing Mika module catalog.

Derives each candidate independently. It neither publishes assets nor calls an
AI service. Technical checks do not establish likeness, licensing or app support.
"""
import argparse
import contextlib
import hashlib
import html
import io
import json
import math
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter

import numpy as np
from PIL import Image

import customise
import glb
import humanoid
import render
import verify

ROOT = Path(__file__).resolve().parents[2]
BASE_ID = 'mika-milfy-12'
SOURCE = ROOT / 'public/avatar/mika-milfy-12.vrm'
MANIFEST = SOURCE.with_suffix('.parts.json')
DATASET = Path(__file__).parent / 'validation/briefs.json'
OUTPUT_ROOT = ROOT / 'build/mika-validation'
UNSUPPORTED = frozenset({'new_hair', 'new_face', 'new_outfit', 'new_scene', 'new_gesture'})
RENDER_SIZE = (420, 720)
RENDER_VIEWS = ('front', 'back', 'three_quarter', 'face')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    with Path(path).open(encoding='utf-8') as handle:
        return json.load(handle)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, value):
    with Path(path).open('x', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write('\n')


def check_operation(operation, manifest):
    require(isinstance(operation, dict), 'operation must be an object')
    kind = operation.get('kind')
    require(isinstance(kind, str), 'operation kind must be a string')
    if kind in UNSUPPORTED:
        require(set(operation) == {'kind', 'description'}, 'unsupported request fields')
        require(isinstance(operation['description'], str) and operation['description'].strip(), 'missing request description')
        return False
    if kind == 'drop':
        require(set(operation) == {'kind', 'part'}, 'drop fields')
        part = operation['part']
        require(isinstance(part, str) and part in manifest['parts'], 'unknown part')
        require(manifest['parts'][part].get('deletable') is True, 'part is locked')
        return True
    require(kind == 'tint', f'unknown operation: {kind}')
    require(set(operation) == {'kind', 'material', 'rgb'}, 'tint fields')
    material, rgb = operation['material'], operation['rgb']
    require(isinstance(material, str) and material in manifest['palette'], 'unknown palette material')
    require(isinstance(rgb, list) and len(rgb) == 3, 'rgb must have three channels')
    require(all(type(v) in (int, float) and math.isfinite(v) and 0 <= v <= 1 for v in rgb), 'rgb channels must be finite numbers in [0,1]')
    return True


def check_brief(brief, manifest):
    require(isinstance(brief, dict), 'brief must be an object')
    require(set(brief) == {'id', 'recipeVersion', 'baseId', 'title', 'requirements', 'operations'}, 'brief fields')
    require(isinstance(brief['id'], str) and re.fullmatch(r'B\d{2}', brief['id']), 'invalid brief id')
    require(type(brief['recipeVersion']) is int and brief['recipeVersion'] == 1, 'unknown recipe version')
    require(brief['baseId'] == BASE_ID, 'unknown base')
    require(isinstance(brief['title'], str) and brief['title'].strip(), 'missing title')
    requirements = brief['requirements']
    require(isinstance(requirements, list) and requirements and all(isinstance(v, str) and v.strip() for v in requirements), 'missing requirements')
    operations = brief['operations']
    require(isinstance(operations, list) and operations, 'missing operations')
    supported = [check_operation(op, manifest) for op in operations]
    keys = [(op['kind'], op.get('part', op.get('material', ''))) for op in operations]
    require(len(keys) == len(set(keys)), 'duplicate operation target')
    dropped = {op['part'] for op in operations if op['kind'] == 'drop'}
    for op in operations:
        if op['kind'] == 'tint':
            require(set(manifest['palette'][op['material']]['parts']) - dropped, 'tinted material has no surviving part')
    return {**brief, 'supported': all(supported)}


def validate_dataset(data, manifest):
    require(isinstance(data, dict) and set(data) == {'schemaVersion', 'synthetic', 'briefs'}, 'dataset fields')
    require(type(data['schemaVersion']) is int and data['schemaVersion'] == 1, 'unknown schema version')
    require(data['synthetic'] is True, 'this runner accepts synthetic diagnostics only')
    require(isinstance(data['briefs'], list) and data['briefs'], 'empty briefs')
    briefs = [check_brief(brief, manifest) for brief in data['briefs']]
    require(len({brief['id'] for brief in briefs}) == len(briefs), 'duplicate brief id')
    return briefs


def reserve_run(run_id):
    require(isinstance(run_id, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', run_id), 'invalid run id')
    # Refuse symlinks through any ancestor before creating this fixed subtree.
    for path in (OUTPUT_ROOT, *OUTPUT_ROOT.parents):
        require(not path.is_symlink(), f'symlink output ancestor: {path}')
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_ROOT / run_id
    path.mkdir(exist_ok=False)
    return path


def pending_checks():
    return {name: 'NOT_RUN' for name in ('visual_acceptance', 'customer_acceptance',
            'original_design_likeness', 'target_app', 'ocm_comparison', 'motion_clipping',
            'licence_for_customer_distribution')}


def summarise(cases):
    passed = sum(case['status'] == 'TECHNICAL_PASS' for case in cases)
    failed = sum(case['status'] not in ('TECHNICAL_PASS', 'BLOCKED') for case in cases)
    return {'total_briefs': len(cases), 'technically_verified': passed,
            'blocked': sum(case['status'] == 'BLOCKED' for case in cases),
            'failed': failed, 'coverage': passed / len(cases) if cases else 0,
            'validation_execution': 'FAILED' if failed else 'COMPLETE',
            'full_brief_support': 'MET' if passed == len(cases) else 'NOT_MET',
            'product_readiness': 'PENDING', 'checks': pending_checks(),
            'interpretation': 'Synthetic catalog coverage only; no market, likeness, or ten-new-character claim.'}


def build_candidate(brief, directory, source, manifest):
    drops = [op['part'] for op in brief['operations'] if op['kind'] == 'drop']
    tints = [(op['material'], op['rgb']) for op in brief['operations'] if op['kind'] == 'tint']
    return customise.apply(str(source), str(directory / 'model.vrm'), str(manifest),
                           drop=drops, tints=tints,
                           manifest_out=str(directory / 'model.parts.json'))


def geometry_hash(doc, binary):
    views = glb.views_of(doc, binary)
    digest = hashlib.sha256()
    for mesh in doc['meshes']:
        for primitive in mesh['primitives']:
            for semantic, accessor in sorted(primitive['attributes'].items()):
                digest.update(semantic.encode())
                digest.update(glb.read_accessor(doc, views, accessor).tobytes())
            digest.update(glb.read_accessor(doc, views, primitive['indices']).tobytes())
            for target in primitive.get('targets', []):
                for semantic, accessor in sorted(target.items()):
                    digest.update(semantic.encode())
                    digest.update(glb.read_accessor(doc, views, accessor).tobytes())
    return digest.hexdigest()


def measure_tint(doc, manifest, operation):
    name, expected = operation['material'], operation['rgb']
    index = next(i for i, material in enumerate(doc['materials']) if material['name'] == name)
    pbr = doc['materials'][index]['pbrMetallicRoughness']['baseColorFactor'][:3]
    vrm = doc['extensions']['VRM']['materialProperties'][index]['vectorProperties']['_Color'][:3]
    palette = manifest['palette'][name]['base']
    live = any(pr['material'] == index for mesh in doc['meshes'] for pr in mesh['primitives'])
    return {'operation': operation, 'gltf_rgb': pbr, 'vrm_rgb': vrm,
            'manifest_rgb': palette, 'material_used': live,
            'passed': bool(live and all(np.allclose(value, expected, atol=1e-6, rtol=0) for value in (pbr, vrm, palette)))}


def material_texture_payloads(doc, views, material_index):
    """Fingerprint referenced textures even when their material is being tinted."""
    material = doc['materials'][material_index]
    properties = doc['extensions']['VRM']['materialProperties'][material_index]
    indices = set(properties.get('textureProperties', {}).values()) - {-1}
    pending = [material]
    while pending:
        item = pending.pop()
        for key, value in item.items():
            if isinstance(value, dict):
                if key.endswith('Texture') and 'index' in value:
                    indices.add(value['index'])
                pending.append(value)
    payloads = []
    for index in sorted(indices):
        texture = doc['textures'][index]
        image = doc['images'][texture['source']]
        require('bufferView' in image, 'diagnostic requires embedded textures')
        payloads.append({
            'texture': {key: value for key, value in texture.items() if key not in ('source', 'sampler')},
            'sampler': doc.get('samplers', [])[texture['sampler']] if 'sampler' in texture else None,
            'image': {key: value for key, value in image.items() if key != 'bufferView'},
            'bytes': hashlib.sha256(views[image['bufferView']]).hexdigest(),
        })
    return payloads


def mesh_skin_payloads(doc, views, mesh_index):
    """Keep each retained mesh's joint mapping and decoded bind matrices intact."""
    payloads = []
    for node in doc.get('nodes', []):
        if node.get('mesh') != mesh_index or 'skin' not in node:
            continue
        skin = doc['skins'][node['skin']]
        payload = {key: value for key, value in skin.items() if key != 'inverseBindMatrices'}
        if 'inverseBindMatrices' in skin:
            matrices = glb.read_accessor(doc, views, skin['inverseBindMatrices'])
            payload['matrices_sha256'] = hashlib.sha256(matrices.tobytes()).hexdigest()
        payloads.append(payload)
    return payloads


def primitive_signature(doc, views, mesh, primitive, tinted):
    """Decoded retained geometry and shader values, independent of accessor indices."""
    digest = hashlib.sha256()
    for semantic, accessor in sorted(primitive['attributes'].items()):
        digest.update(semantic.encode())
        digest.update(glb.read_accessor(doc, views, accessor).tobytes())
    digest.update(glb.read_accessor(doc, views, primitive['indices']).tobytes())
    names = mesh.get('extras', {}).get('targetNames', [])
    for index, target in enumerate(primitive.get('targets', [])):
        for semantic, accessor in sorted(target.items()):
            values = glb.read_accessor(doc, views, accessor)
            # Deleting a garment can remove globally orphaned zero morph slots.
            if np.any(values):
                digest.update(str(names[index] if index < len(names) else index).encode())
                digest.update(semantic.encode())
                digest.update(values.tobytes())
    material_index = primitive.get('material')
    if material_index is not None:
        material = doc['materials'][material_index]
        digest.update(material['name'].encode())
        digest.update(canonical(material_texture_payloads(doc, views, material_index)))
        if material['name'] not in tinted:
            digest.update(canonical(material))
            digest.update(canonical(doc['extensions']['VRM']['materialProperties'][material_index]))
    return digest.hexdigest()


def retained_signature(doc, binary, drops, tinted):
    views = glb.views_of(doc, binary)
    signatures = Counter()
    for mesh_index, mesh in enumerate(doc['meshes']):
        skin = hashlib.sha256(canonical(mesh_skin_payloads(doc, views, mesh_index))).hexdigest()
        for primitive in mesh['primitives']:
            part = primitive.get('extras', {}).get('part')
            if part in drops:
                continue
            key = (mesh.get('name'), part, skin, primitive_signature(doc, views, mesh, primitive, tinted))
            signatures[key] += 1
    return signatures


def retained_primitives_match(original, original_binary, doc, binary, operations):
    drops = {op['part'] for op in operations if op['kind'] == 'drop'}
    tinted = {op['material'] for op in operations if op['kind'] == 'tint'}
    return retained_signature(original, original_binary, drops, tinted) == retained_signature(doc, binary, set(), tinted)


def measure_effects(brief, model, manifest, source):
    doc, binary = glb.load(str(model))
    original, original_binary = glb.load(str(source))
    after_manifest = read_json(manifest)
    part_names = {pr.get('extras', {}).get('part') for mesh in doc['meshes'] for pr in mesh['primitives']}
    source_parts = {pr.get('extras', {}).get('part') for mesh in original['meshes'] for pr in mesh['primitives']}
    requested_drops = {op['part'] for op in brief['operations'] if op['kind'] == 'drop'}
    exact_parts = part_names == source_parts - requested_drops
    retained_match = retained_primitives_match(original, original_binary, doc, binary, brief['operations'])
    effects = []
    for operation in brief['operations']:
        if operation['kind'] == 'drop':
            absent = operation['part'] not in part_names and operation['part'] not in after_manifest['parts']
            effects.append({'operation': operation, 'passed': absent, 'absent_in_model_and_manifest': absent})
        elif operation['kind'] == 'tint':
            effects.append(measure_tint(doc, after_manifest, operation))
    source_geometry, output_geometry = geometry_hash(original, original_binary), geometry_hash(doc, binary)
    has_drop = any(op['kind'] == 'drop' for op in brief['operations'])
    geometry_matches = source_geometry == output_geometry
    rig_diffs = humanoid.compare(original, doc)
    return {'operations': effects, 'source_geometry_sha256': source_geometry,
            'output_geometry_sha256': output_geometry, 'geometry_unchanged': geometry_matches,
            'rig_differences': rig_diffs, 'exact_requested_parts_preserved': exact_parts,
            'retained_geometry_morphs_and_materials_unchanged': retained_match,
            'passed': all(effect['passed'] for effect in effects) and exact_parts and retained_match and not rig_diffs and (has_drop or geometry_matches)}


def inspect_renders(images):
    require(len(images) == len(RENDER_VIEWS) and all(Path(image).is_file() and Path(image).stat().st_size > 0 for image in images), 'renderer did not produce every requested view')
    evidence = []
    for image in images:
        path = Path(image)
        mask_path = path.with_name(path.stem + '-mask.png')
        with Image.open(path) as picture, Image.open(mask_path) as mask:
            pixels = np.asarray(mask.convert('L'))
            opaque = int(np.count_nonzero(pixels))
            require(picture.size == mask.size and opaque > 0, 'render is blank or mask dimensions disagree')
            evidence.append({'image': path.name, 'sha256': sha256(path),
                             'mask_sha256': sha256(mask_path),
                             'dimensions': list(picture.size), 'nontransparent_pixels': opaque})
    return evidence


def execute_candidate(brief, directory, source, manifest):
    timings = {}
    started = perf_counter()
    build_result = build_candidate(brief, directory, source, manifest)
    timings['build_seconds'] = perf_counter() - started
    started = perf_counter()
    ok, stats = verify.report(str(directory / 'model.vrm'), str(source))
    effects = measure_effects(brief, directory / 'model.vrm', directory / 'model.parts.json', source)
    timings['verify_seconds'] = perf_counter() - started
    started = perf_counter()
    images = render.render(str(directory / 'model.vrm'), str(directory / 'preview'),
                           size=RENDER_SIZE, only=RENDER_VIEWS)
    image_evidence = inspect_renders(images)
    timings['render_seconds'] = perf_counter() - started
    return {'status': 'TECHNICAL_PASS' if ok and effects['passed'] else 'FAILED',
            'timings': timings, 'build': build_result, 'effects': effects,
            'health_check_passed': ok, 'triangles': stats['tris'],
            'images': [Path(image).name for image in images],
            'image_evidence': image_evidence,
            'model': 'model.vrm', 'model_sha256': sha256(directory / 'model.vrm'),
            'manifest_sha256': sha256(directory / 'model.parts.json')}


def run_case(brief, root, source=SOURCE, manifest=MANIFEST):
    directory = root / brief['id']
    directory.mkdir(exist_ok=False)
    recipe = {key: value for key, value in brief.items() if key != 'supported'}
    write_json(directory / 'recipe.json', recipe)
    result = {'id': brief['id'], 'title': brief['title'], 'requirements': brief['requirements'],
              'recipe_sha256': hashlib.sha256(canonical(recipe)).hexdigest(),
              'checks': pending_checks(), 'images': []}
    if not brief['supported']:
        result.update(status='BLOCKED', missing_capabilities=[op for op in brief['operations'] if op['kind'] in UNSUPPORTED])
        return result
    log = io.StringIO()
    with contextlib.redirect_stdout(log):
        try:
            result.update(execute_candidate(brief, directory, source, manifest))
        except (Exception, SystemExit) as error:
            result.update(status='FAILED', error=f'{type(error).__name__}: {error}')
    with (directory / 'verify.log').open('x', encoding='utf-8') as handle:
        handle.write(log.getvalue())
    return result


def identity():
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    # Hash the actual local dependency sources, including uncommitted fixes.
    paths = sorted(Path(__file__).parent.glob('*.py'))
    return {'git_commit': commit, 'python_version': sys.version,
            'numpy_version': np.__version__,
            'python_source_sha256': {path.name: sha256(path) for path in paths}}


def gallery_card(case):
    escape = html.escape
    prefix = case['id']
    pictures = ''.join(f'<a href="{prefix}/{name}"><img src="{prefix}/{name}" alt="{escape(name)}"></a>' for name in case['images'])
    links = f'<a href="{prefix}/recipe.json">recipe</a>'
    if case.get('model'):
        links += f' · <a href="{prefix}/model.vrm">VRM</a> · <a href="{prefix}/model.parts.json">manifest</a> · <a href="{prefix}/verify.log">verification log</a>'
    details = case.get('missing_capabilities', case.get('timings', case.get('error', '')))
    return f'<article><h2>{prefix}：{escape(case["title"])}</h2><p>{case["status"]}。Visual acceptance：NOT_RUN</p><p>{escape("；".join(case["requirements"]))}</p><p>{links}</p><div class="pictures">{pictures}</div><pre>{escape(json.dumps(details, ensure_ascii=False, indent=2))}</pre></article>'


def write_gallery(root, results):
    summary = html.escape(json.dumps(results['summary'], ensure_ascii=False, indent=2))
    cards = ''.join(gallery_card(case) for case in [results['control'], *results['cases']])
    page = f'''<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mika synthetic validation</title>
<style>body{{font:16px system-ui;margin:32px;max-width:1440px;color:#202124;background:#f6f5f2}}article{{margin:28px 0;padding:20px;background:white}}.pictures{{display:flex;flex-wrap:wrap;gap:12px}}img{{width:220px;max-height:390px;object-fit:contain}}pre{{white-space:pre-wrap}}a{{color:#365783}}</style>
<h1>Mika 既有模組合成需求驗證</h1><p>六份既有造型調整與四份能力缺口測試。CONTROL 不列入十份需求分母。沒有生成新臉型、髮型、長褲或場景。圖片由 CPU rasterizer 產生；市場需求、設計還原度、客戶接受度、授權、目標軟體及 OCM 比較均未驗證。</p><p><a href="results.json">Machine-readable results</a> · <a href="briefs.json">Frozen briefs</a></p><pre>{summary}</pre>{cards}</html>'''
    with (root / 'index.html').open('x', encoding='utf-8') as handle:
        handle.write(page)


def run(run_id):
    data = read_json(DATASET)
    briefs = validate_dataset(data, read_json(MANIFEST))
    require(len(briefs) == 10, 'frozen experiment requires ten briefs')
    before = {'model': sha256(SOURCE), 'manifest': sha256(MANIFEST)}
    root = reserve_run(run_id)
    write_json(root / 'briefs.json', data)
    control = {'id': 'CONTROL', 'title': '原始模型 no-op control', 'requirements': ['保留完整原始模型'],
               'operations': [], 'supported': True, 'baseId': BASE_ID, 'recipeVersion': 1}
    results = {'schemaVersion': 1, 'synthetic': True, 'started_at': datetime.now(timezone.utc).isoformat(),
               'source_sha256': before, 'dataset_sha256': hashlib.sha256(canonical(data)).hexdigest(),
               'dataset_file_sha256': sha256(DATASET),
               'implementation': identity(), 'control': run_case(control, root), 'cases': []}
    for brief in briefs:
        print(f'Running {brief["id"]} ({"derive" if brief["supported"] else "blocked"})', flush=True)
        results['cases'].append(run_case(brief, root))
    after = {'model': sha256(SOURCE), 'manifest': sha256(MANIFEST)}
    results['source_immutable'] = before == after
    results['source_sha256_after'] = after
    results['summary'] = summarise(results['cases'])
    if not results['source_immutable'] or results['control']['status'] != 'TECHNICAL_PASS':
        results['summary']['validation_execution'] = 'FAILED'
    write_json(root / 'results.json', results)
    write_gallery(root, results)
    print(json.dumps(results['summary'], ensure_ascii=False, indent=2))
    print(f'Report: {root / "index.html"}')
    return 0 if results['summary']['validation_execution'] == 'COMPLETE' else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True, help='Fresh name beneath build/mika-validation')
    args = parser.parse_args()
    try:
        return run(args.run_id)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Validation could not execute: {error}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
