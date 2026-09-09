"""Seven frozen research probes, with independently measured output effects."""
import argparse
import contextlib
import copy
import hashlib
import html
import io
import json
import sys
from pathlib import Path
from time import perf_counter

import numpy as np

import glb
import humanoid
import module_assembly as assembly
import module_contract as contract
import platform_validation as evidence
import render
import verify

DATASET = Path(__file__).parent / 'validation/modules/briefs.json'
CASE_IDS = ('CONTROL', 'F_NARROW', 'F_WIDE', 'H_SHORT', 'H_DEFAULT', 'H_LONG', 'COMBINED')
CASE_PARAMETERS = ({}, {'jaw_width': .88}, {'jaw_width': 1.12}, {'length_scale': .9},
                   {'length_scale': 1.}, {'length_scale': 1.1}, {'jaw_width': 1.12, 'length_scale': 1.})
HAIR_PARTS = frozenset({'Hair_Bob_Cap', 'Hair_Bob_Shell', 'Hair_Bob_Bangs'})
HAIR_ACCESSORIES = frozenset({'Acc_Crown', 'Acc_HairOrnament', 'Acc_HairClip_Base', 'Acc_Ribbon_Hair',
                             'Acc_HairClip_Plaster', 'Acc_HairClip_Bear', 'Acc_HairClip_Bars'})
ARRAY_TOLERANCE = 5e-7
NORMAL_TOLERANCE = 2e-6
FACE_TARGETS, FACE_EXPRESSIONS = 56, 15


def validate_cases(data):
    contract.require(isinstance(data, dict) and set(data) == {'schemaVersion', 'cases'} and type(data['schemaVersion']) is int and data['schemaVersion'] == 1, 'invalid case schema')
    contract.require(isinstance(data['cases'], list) and len(data['cases']) == len(CASE_IDS), 'expected seven frozen cases')
    ids = []
    for case in data['cases']:
        contract.require(isinstance(case, dict) and set(case) == {'id', 'recipe'}, 'unknown case fields')
        contract.require(case['id'] in CASE_IDS, 'unknown case ID')
        normalised = contract.validate_recipe(case['recipe'])
        parameters = {key: value for module in normalised['modules'] for key, value in module['parameters'].items()}
        contract.require(parameters == CASE_PARAMETERS[CASE_IDS.index(case['id'])], 'case recipe differs from the frozen experiment')
        ids.append(case['id'])
    contract.require(tuple(ids) == CASE_IDS, 'cases must be unique and in frozen order')
    return data['cases']


def array(doc, views, accessor):
    value = glb.read_accessor(doc, views, accessor).astype(np.float64)
    contract.require(np.isfinite(value).all(), 'non-finite model payload')
    return value


def face_primitive(doc):
    mesh = next(mesh for mesh in doc['meshes'] if mesh.get('name') == 'Face.baked')
    primitive = mesh['primitives'][0]
    contract.require(all(p['attributes'] == primitive['attributes'] and p.get('targets') == primitive.get('targets') for p in mesh['primitives']), 'face layout is no longer shared')
    return primitive


def expected_field(source, views, width):
    primitive = face_primitive(source)
    positions = array(source, views, primitive['attributes']['POSITION'])
    world, bones = humanoid.rest_world(source), humanoid.bones(source)
    eyes = np.array([world[bones[name]][:3, 3] for name in ('leftEye', 'rightEye')])
    low, high, centre = positions[:, 1].min(), eyes[:, 1].min(), eyes[:, 0].mean()
    contract.require(high > low, 'invalid face band')
    fraction = (positions[:, 1] - low) / (high - low)
    inside = (fraction > 0) & (fraction < 1)
    weight = np.where(inside, np.sin(np.pi * fraction) ** 2, 0)
    gradient = np.where(inside, np.pi * np.sin(2 * np.pi * fraction) / (high - low), 0)
    gain = 1 + (width - 1) * weight
    shear = (positions[:, 0] - centre) * (width - 1) * gradient
    expected = positions.copy()
    expected[:, 0] = centre + (positions[:, 0] - centre) * gain
    return expected, gain, shear


def expected_delta(values, gain, shear):
    output = values.copy()
    output[:, 0] = gain * values[:, 0] + shear * values[:, 1]
    return output


def expected_normal(values, gain, shear):
    output = values.copy()
    output[:, 0] = values[:, 0] / gain
    output[:, 1] = values[:, 1] - shear * values[:, 0] / gain
    return output / np.maximum(np.linalg.norm(output, axis=1, keepdims=True), 1e-12)


def check_face(source, source_views, doc, views, width):
    before, after = face_primitive(source), face_primitive(doc)
    targets, actual_targets = before.get('targets', []), after.get('targets', [])
    groups = source['extensions']['VRM']['blendShapeMaster']['blendShapeGroups']
    actual_groups = doc['extensions']['VRM']['blendShapeMaster']['blendShapeGroups']
    if len(targets) != FACE_TARGETS or len(actual_targets) != len(targets) or len(groups) != FACE_EXPRESSIONS or groups != actual_groups:
        return {'passed': False, 'reason': 'face target count or expression mapping changed'}
    neutral, gain, shear = expected_field(source, source_views, width)
    normal = array(source, source_views, before['attributes']['NORMAL'])
    target_normal = expected_normal(normal, gain, shear)
    actual_neutral = array(doc, views, after['attributes']['POSITION'])
    actual_normal = array(doc, views, after['attributes']['NORMAL'])
    errors = {'neutral': float(np.abs(actual_neutral - neutral).max()), 'normal': float(np.abs(actual_normal - target_normal).max()), 'position_morph': 0., 'normal_endpoint': 0., 'expression_blend': 0.}
    source_deltas, actual_deltas = [], []
    for previous, current in zip(targets, actual_targets):
        delta, actual_delta = array(source, source_views, previous['POSITION']), array(doc, views, current['POSITION'])
        endpoint = normal + array(source, source_views, previous['NORMAL'])
        actual_endpoint = actual_normal + array(doc, views, current['NORMAL'])
        errors['position_morph'] = max(errors['position_morph'], float(np.abs(actual_delta - expected_delta(delta, gain, shear)).max()))
        errors['normal_endpoint'] = max(errors['normal_endpoint'], float(np.abs(actual_endpoint - expected_normal(endpoint, gain, shear)).max()))
        source_deltas.append(delta)
        actual_deltas.append(actual_delta)
    face_index = next(i for i, mesh in enumerate(source['meshes']) if mesh.get('name') == 'Face.baked')
    expression_deltas = {}
    for group in groups:
        binds = [bind for bind in group.get('binds', []) if bind['mesh'] == face_index]
        base_delta, output_delta = np.zeros_like(neutral), np.zeros_like(neutral)
        for bind in binds:
            base_delta += source_deltas[bind['index']] * bind['weight'] / 100
            output_delta += actual_deltas[bind['index']] * bind['weight'] / 100
        errors['expression_blend'] = max(errors['expression_blend'], float(np.abs(actual_neutral + output_delta - neutral - expected_delta(base_delta, gain, shear)).max()))
        expression_deltas[group.get('presetName')] = (base_delta, output_delta)
    contract.require({'blink', 'a', 'i'} <= set(expression_deltas), 'missing blink or vowel expression')
    mixed_errors = []
    for vowel in ('a', 'i'):
        base_mix = .7 * expression_deltas['blink'][0] + .5 * expression_deltas[vowel][0]
        output_mix = .7 * expression_deltas['blink'][1] + .5 * expression_deltas[vowel][1]
        mixed_errors.append(float(np.abs(actual_neutral + output_mix - neutral - expected_delta(base_mix, gain, shear)).max()))
    errors['mixed_expressions'] = max(mixed_errors)
    original_positions = array(source, source_views, before['attributes']['POSITION'])
    return {'passed': max(errors.values()) <= ARRAY_TOLERANCE, 'errors': errors,
            'morph_targets_checked': len(targets), 'expression_groups_checked': len(groups), 'blink_vowel_mixes_checked': len(mixed_errors),
            'max_neutral_displacement_mm': float(np.linalg.norm(actual_neutral - original_positions, axis=1).max() * 1000),
            'policy': 'neutral_tangent_affine_v1', 'visual_acceptance': 'NOT_RUN'}


def preservation_signature(doc, binary, drops, allow_face):
    filtered = copy.deepcopy(doc)
    if allow_face:
        for mesh in filtered['meshes']:
            if mesh.get('name') == 'Face.baked':
                for primitive in mesh['primitives']:
                    primitive['attributes'] = {key: value for key, value in primitive['attributes'].items() if key not in ('POSITION', 'NORMAL')}
                    primitive['targets'] = [{key: value for key, value in target.items() if key not in ('POSITION', 'NORMAL')} for target in primitive.get('targets', [])]
    return evidence.retained_signature(filtered, binary, drops, set())


def rig_signature(doc, views):
    skins = []
    for skin in doc.get('skins', []):
        values = {key: value for key, value in skin.items() if key != 'inverseBindMatrices'}
        values['ibm'] = hashlib.sha256(array(doc, views, skin['inverseBindMatrices']).tobytes()).hexdigest()
        skins.append(values)
    return {'skins': skins, 'humanoid': doc['extensions']['VRM']['humanoid'],
            'springs': doc['extensions']['VRM'].get('secondaryAnimation')}


def nodes_preserved(source, doc):
    if len(doc['nodes']) < len(source['nodes']):
        return False
    for before, after in zip(source['nodes'], doc['nodes']):
        if {key: value for key, value in before.items() if key != 'children'} != {key: value for key, value in after.items() if key != 'children'}:
            return False
        children, actual = before.get('children', []), after.get('children', [])
        if actual[:len(children)] != children or any(child < len(source['nodes']) for child in actual[len(children):]):
            return False
    return True


def face_region_points(doc, views, manifest, marker):
    info = manifest['parts']['Face']
    mesh = next(mesh for mesh in doc['meshes'] if mesh.get('name') == info['mesh'])
    points = []
    for index in info['primitives']:
        primitive = mesh['primitives'][index]
        if marker in doc['materials'][primitive['material']]['name']:
            positions = array(doc, views, primitive['attributes']['POSITION'])
            points.append(positions[np.unique(array(doc, views, primitive['indices']).astype(np.int64))])
    contract.require(points, 'missing face material region')
    return np.concatenate(points)


def cap_coverage(doc, views, manifest, geometry):
    cap, indices = geometry['Hair_Bob_Cap']
    low, high = cap.min(axis=0), cap.max(axis=0)
    centre = (low + high) / 2
    centre[1] = low[1]
    radii = (high - low) / 2
    radii[1] = high[1] - low[1]
    contract.require((radii > 0).all(), 'degenerate cap bounds')
    skin = face_region_points(doc, views, manifest, 'SKIN')
    scalp = skin[skin[:, 1] >= low[1]]
    contract.require(len(scalp), 'no upper scalp vertices were checked')
    extent = float(np.square((scalp - centre) / radii).sum(axis=1).max())
    edges = np.sort(np.concatenate([indices[:, [0, 1]], indices[:, [1, 2]], indices[:, [2, 0]]]), axis=1)
    unique, counts = np.unique(edges, axis=0, return_counts=True)
    boundary = unique[counts == 1]
    closed_above_rim = bool(len(boundary) and (counts <= 2).all() and np.allclose(cap[np.unique(boundary), 1], low[1], atol=ARRAY_TOLERANCE))
    eye_top = float(face_region_points(doc, views, manifest, 'Eye')[:, 1].max())
    bang_bottom = float(geometry['Hair_Bob_Bangs'][0][:, 1].min())
    return {'passed': extent <= 1 + NORMAL_TOLERANCE and closed_above_rim and bang_bottom > eye_top,
            'scalp_vertices_checked': len(scalp), 'max_ellipsoid_value': extent,
            'cap_has_no_open_boundary_above_rim': closed_above_rim,
            'bang_min_y': bang_bottom, 'eye_max_y': eye_top}


def check_hair(doc, views, manifest):
    head = humanoid.bones(doc)['head']
    reports, geometry = [], {}
    for part in sorted(HAIR_PARTS):
        info = manifest['parts'][part]
        mesh = next(mesh for mesh in doc['meshes'] if mesh.get('name') == info['mesh'])
        skin = doc['skins'][humanoid.skin_of_mesh(doc, info['mesh'])]
        head_slot = skin['joints'].index(head)
        contract.require(len(info['primitives']) == 1, 'bob part must contain one primitive')
        primitive = mesh['primitives'][info['primitives'][0]]
        attributes = {name: array(doc, views, index) for name, index in primitive['attributes'].items()}
        positions, normals = attributes['POSITION'], attributes['NORMAL']
        indices = array(doc, views, primitive['indices']).astype(np.int64).reshape(-1, 3)
        a, b, c = positions[indices].transpose(1, 0, 2)
        cross = np.cross(b - a, c - a)
        area = np.linalg.norm(cross, axis=1)
        winding = np.einsum('ij,ij->i', cross, normals[indices].mean(axis=1))
        binding = np.all(attributes['JOINTS_0'] == [head_slot, 0, 0, 0]) and np.allclose(attributes['WEIGHTS_0'], [1, 0, 0, 0], rtol=0, atol=1e-7)
        normal_error = float(np.abs(np.linalg.norm(normals, axis=1) - 1).max())
        actual_binding = info.get('binding', {})
        metadata = type(info.get('vertex_count')) is int and info['vertex_count'] == len(positions) and type(info.get('tris')) is int and len(indices) == info['tris']
        metadata = metadata and all(actual_binding.get(key) == value for key, value in {'strategy': 'single', 'joint': 'head', 'joint_slot': head_slot, 'spring_mode': 'static_head'}.items())
        metadata = metadata and np.allclose(info['bbox']['min'], positions.min(axis=0), rtol=0, atol=ARRAY_TOLERANCE) and np.allclose(info['bbox']['max'], positions.max(axis=0), rtol=0, atol=ARRAY_TOLERANCE)
        passed = bool(binding and metadata and (area > 1e-12).all() and (winding > 0).all() and normal_error < NORMAL_TOLERANCE and primitive.get('extras', {}).get('part') == part)
        geometry[part] = (positions, indices)
        reports.append({'part': part, 'passed': passed, 'vertices': len(positions), 'triangles': len(indices), 'min_y': float(positions[:, 1].min()), 'normal_unit_error': normal_error, 'head_bound': bool(binding)})
    coverage = cap_coverage(doc, views, manifest, geometry)
    return {'passed': all(report['passed'] for report in reports) and coverage['passed'], 'parts': reports, 'cap_and_eye_checks': coverage, 'binding': 'static_head', 'new_spring_quality': 'NOT_RUN'}


def hair_materials_preserved(source, source_views, source_manifest, doc, views, manifest):
    def signature(model, buffers, info):
        mesh = next(mesh for mesh in model['meshes'] if mesh.get('name') == info['mesh'])
        values = []
        for index in info['primitives']:
            material = mesh['primitives'][index]['material']
            values.append(evidence.canonical({
                'gltf': model['materials'][material],
                'vrm': model['extensions']['VRM']['materialProperties'][material],
                'textures': evidence.material_texture_payloads(model, buffers, material)}))
        return values
    expected = signature(source, source_views, source_manifest['parts']['Hair_Back'])[0]
    return all(value == expected for part in HAIR_PARTS for value in signature(doc, views, manifest['parts'][part]))


def measure_case(recipe, directory):
    source, source_binary = glb.load(str(contract.SOURCE_MODEL))
    doc, binary = glb.load(str(directory / 'model.vrm'))
    source_views, views = glb.views_of(source, source_binary), glb.views_of(doc, binary)
    source_manifest, manifest = evidence.read_json(contract.SOURCE_MANIFEST), evidence.read_json(directory / 'model.parts.json')
    selections = {module['moduleId']: module for module in recipe['modules']}
    has_face, has_hair = 'face-jaw-v1' in selections, 'hair-bob-v1' in selections
    dropped = {part for part in source_manifest['parts'] if part.startswith('Hair_') or part in HAIR_ACCESSORIES} if has_hair else set()
    expected_parts = (set(source_manifest['parts']) - dropped) | (HAIR_PARTS if has_hair else set())
    retained = preservation_signature(source, source_binary, dropped, has_face) == preservation_signature(doc, binary, HAIR_PARTS if has_hair else set(), has_face)
    width = selections['face-jaw-v1']['parameters']['jaw_width'] if has_face else 1.
    checks = {'retained_payloads': retained, 'manifest_parts': set(manifest['parts']) == expected_parts,
              'hair_materials_inherited': not has_hair or hair_materials_preserved(source, source_views, source_manifest, doc, views, manifest),
              'rig_ibm_springs': rig_signature(source, source_views) == rig_signature(doc, views),
              'original_nodes': nodes_preserved(source, doc), 'humanoid_unmoved': humanoid.compare(source, doc) == []}
    face = check_face(source, source_views, doc, views, width)
    hair = check_hair(doc, views, manifest) if has_hair else {'passed': True, 'status': 'UNCHANGED'}
    return {'passed': all(checks.values()) and face['passed'] and hair['passed'], 'checks': checks, 'face': face, 'hair': hair}


def execute_case(case, root):
    directory = root / case['id']
    result = {'id': case['id'], 'status': 'FAILED', 'research_only': True, 'checks': evidence.pending_checks(), 'images': []}
    log, timings = io.StringIO(), {}
    with contextlib.redirect_stdout(log):
        try:
            started = perf_counter()
            built = assembly.apply(case['recipe'], directory)
            timings['build_seconds'] = perf_counter() - started
            started = perf_counter()
            health, _ = verify.report(str(directory / 'model.vrm'), str(contract.SOURCE_MODEL))
            effects = measure_case(contract.validate_recipe(case['recipe']), directory)
            timings['verify_seconds'] = perf_counter() - started
            started = perf_counter()
            images = render.render(str(directory / 'model.vrm'), str(directory / 'preview'), size=evidence.RENDER_SIZE, only=evidence.RENDER_VIEWS)
            rendered = evidence.inspect_renders(images)
            timings['render_seconds'] = perf_counter() - started
            result.update(status='TECHNICAL_PASS' if health and effects['passed'] else 'FAILED', health_check=health,
                          effects=effects, model_sha256=built['modelSha256'], manifest_sha256=built['manifestSha256'],
                          recipe_sha256=contract.sha256(directory / 'recipe.json'), images=[Path(path).name for path in images], image_evidence=rendered)
        except (Exception, SystemExit) as error:
            result['error'] = f'{type(error).__name__}: {error}'
    result['timings'] = timings
    if directory.exists():
        with (directory / 'verify.log').open('x', encoding='utf-8') as handle:
            handle.write(log.getvalue())
    return result


def length_order(cases):
    heights = {}
    for case in cases:
        if case['id'] in ('H_SHORT', 'H_DEFAULT', 'H_LONG') and case['status'] == 'TECHNICAL_PASS':
            heights[case['id']] = next(part['min_y'] for part in case['effects']['hair']['parts'] if part['part'] == 'Hair_Bob_Shell')
    return {'passed': len(heights) == 3 and heights['H_LONG'] < heights['H_DEFAULT'] < heights['H_SHORT'], 'shell_hem_y': heights}


def write_gallery(root, result):
    cards = []
    for case in result['cases']:
        prefix = case['id']
        images = ''.join(f'<a href="{prefix}/{name}"><img src="{prefix}/{name}" alt="{html.escape(name)}"></a>' for name in case['images'])
        detail = html.escape(json.dumps({key: case[key] for key in ('status', 'timings', 'effects', 'error') if key in case}, ensure_ascii=False, indent=2))
        cards.append(f'<article><h2>{prefix}：{case["status"]}</h2><p><a href="{prefix}/model.vrm">VRM</a> · <a href="{prefix}/recipe.json">recipe</a> · <a href="{prefix}/model.parts.json">manifest</a> · <a href="{prefix}/verify.log">log</a></p><div>{images}</div><details><summary>Measured evidence</summary><pre>{detail}</pre></details></article>')
    page = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mika research modules</title><style>body{font:16px system-ui;margin:32px;background:#f6f5f2;color:#222}article{padding:20px;margin:24px 0;background:white}img{width:220px;max-height:390px;object-fit:contain}pre{white-space:pre-wrap}a{color:#365783}</style><h1>Mika 顎寬與 bob 髮型研究模組</h1><p>所有產物均為 research_only。Technical pass 僅代表列出的機械檢查通過；視覺、客戶、原創設計還原、目標軟體與授權未驗收。Bob 固定綁定 head，未建立新 spring 動態。</p><p><a href="results.json">results.json</a> · <a href="briefs.json">Frozen cases</a></p>'
    with (root / 'index.html').open('x', encoding='utf-8') as handle:
        handle.write(page + ''.join(cards) + '</html>')


def main(run_id):
    data = evidence.read_json(DATASET)
    cases = validate_cases(data)
    before = contract.verify_sources()
    contract.require(isinstance(run_id, str) and run_id and all(char.isascii() and (char.isalnum() or char in '_-') for char in run_id), 'invalid run ID')
    root = assembly.reserve_directory(assembly.OUTPUT_ROOT / run_id)
    evidence.write_json(root / 'briefs.json', data)
    result = {'schemaVersion': 1, 'research_only': True, 'dataset_sha256': contract.sha256(DATASET),
              'source_sha256': before, 'implementation': evidence.identity(), 'cases': []}
    for case in cases:
        print(f'Running {case["id"]}', flush=True)
        result['cases'].append(execute_case(case, root))
    result['source_immutable'] = contract.verify_sources() == before
    result['length_parameter_effect'] = length_order(result['cases'])
    passed = sum(case['status'] == 'TECHNICAL_PASS' for case in result['cases'])
    result['summary'] = {'technical_passes': passed, 'total_cases': len(cases), 'product_readiness': 'RESEARCH_ONLY',
                         'execution': 'COMPLETE' if passed == len(cases) and result['source_immutable'] and result['length_parameter_effect']['passed'] else 'FAILED', 'checks': evidence.pending_checks()}
    evidence.write_json(root / 'results.json', result)
    write_gallery(root, result)
    print(json.dumps(result['summary'], ensure_ascii=False, indent=2))
    print(f'Report: {root / "index.html"}')
    return 0 if result['summary']['execution'] == 'COMPLETE' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-id', required=True)
    args = parser.parse_args()
    try:
        sys.exit(main(args.run_id))
    except (OSError, ValueError) as error:
        print(f'Validation could not execute: {error}', file=sys.stderr)
        sys.exit(2)
