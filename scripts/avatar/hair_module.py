"""A procedural bob replacement for the approved VRoid base, with no hair physics.

The generator owns a cap, a side/back shell and separate fringe panels. Original
textures are reused for research provenance; no source hair triangles are reused.
The caller finalises orphan resources after composing all requested modules.
"""
import math

import numpy as np

import customise
import garment
import glb
import humanoid
import twintail

MODULE_ID = 'hair-bob-v1'
MESH_NAME = 'Hair_Bob_Prototype'
PART_NAMES = ('Hair_Bob_Cap', 'Hair_Bob_Shell', 'Hair_Bob_Bangs')
ATTACHED_ACCESSORIES = frozenset({
    'Acc_Crown', 'Acc_HairOrnament', 'Acc_HairClip_Base', 'Acc_Ribbon_Hair',
    'Acc_HairClip_Plaster', 'Acc_HairClip_Bear', 'Acc_HairClip_Bars',
})
LENGTH_RANGE = (0.9, 1.1)
CAP_SEGMENTS, CAP_RINGS = 64, 12
SHELL_SEGMENTS, SHELL_RINGS = 48, 12
FRINGE_PANELS, FRINGE_COLUMNS, FRINGE_ROWS = 7, 4, 8
FRONT_EDGE_ANGLE = math.radians(130)
WIDTH_FACTOR, DEPTH_FACTOR = 1.30, 1.10
CROWN_CLEARANCE_SHARE, ROOT_ABOVE_EYES_SHARE = 0.09, 0.09
HEM_BELOW_CHIN_SHARE = 0.015
SHELL_BULGE, SHELL_TAPER = 0.06, 0.04
FRINGE_WIDTH_SHARE, FRINGE_GAP_SHARE = 0.82, 0.012
FRINGE_ROOT_SHARE, FRINGE_TIP_SHARE = 0.27, 0.045
FRINGE_TIP_NOTCH_SHARE, FRINGE_STANDOFF_SHARE = 0.025, 0.018
AREA_EPSILON = 1e-12


def validate(parameters):
    if not isinstance(parameters, dict) or set(parameters) - {'length_scale'}:
        raise ValueError('bob parameters only accept length_scale')
    value = parameters.get('length_scale', 1.0)
    if type(value) not in (float, int) or not math.isfinite(value) or not LENGTH_RANGE[0] <= value <= LENGTH_RANGE[1]:
        raise ValueError('bob length_scale must be finite and within 0.9..1.1')
    return float(value)


def _part_primitives(doc, manifest, name):
    info = manifest['parts'][name]
    mesh = next(m for m in doc['meshes'] if m.get('name') == info['mesh'])
    return [mesh['primitives'][i] for i in info['primitives']]


def _used_positions(doc, views, primitives):
    return np.concatenate([
        glb.read_accessor(doc, views, p['attributes']['POSITION'])[
            np.unique(glb.read_accessor(doc, views, p['indices']))]
        for p in primitives]).astype(np.float64)


def measure(doc, views, manifest, length):
    face = _part_primitives(doc, manifest, 'Face')
    skin = [p for p in face if 'SKIN' in doc['materials'][p['material']].get('name', '')]
    eyes = [p for p in face if 'Eye' in doc['materials'][p['material']].get('name', '')]
    if not skin or not eyes:
        raise ValueError('bob needs the approved face skin and eye material regions')
    points, eye_points = _used_positions(doc, views, skin), _used_positions(doc, views, eyes)
    lo, hi = points.min(axis=0), points.max(axis=0)
    height = float(hi[1] - lo[1])
    if height <= 0:
        raise ValueError('face has no measurable height')
    head = humanoid.rest_world(doc)[humanoid.bones(doc)['head']][:3, 3]
    cx, cz = float((lo[0] + hi[0]) / 2), float(head[2])
    eye_top = float(eye_points[:, 1].max())
    root = eye_top + height * ROOT_ABOVE_EYES_SHARE
    crown = float(hi[1]) + height * CROWN_CLEARANCE_SHARE
    if crown <= root:
        raise ValueError('eye and scalp measurements cannot define a cap')
    hem = root - (root - float(lo[1]) + height * HEM_BELOW_CHIN_SHARE) * length
    return {'center_x': cx, 'center_z': cz, 'face_height': height,
            'radius_x': float((hi[0] - lo[0]) / 2) * WIDTH_FACTOR,
            'radius_z': float(np.abs(points[:, 2] - cz).max()) * DEPTH_FACTOR,
            'eye_top': eye_top, 'root_y': root, 'crown_y': crown, 'hem_y': hem}


def _finish(points, triangles, uv, measurements, head_slot, front=False):
    pos, tris = np.asarray(points, dtype=np.float64), np.asarray(triangles, dtype=np.int64)
    a, b, c = pos[tris].transpose(1, 0, 2)
    cross = np.cross(b - a, c - a)
    if (np.linalg.norm(cross, axis=1) <= AREA_EPSILON).any():
        raise ValueError('bob generated a degenerate triangle')
    center = np.array([measurements['center_x'], measurements['root_y'], measurements['center_z']])
    outward = (a + b + c) / 3 - center
    outward[:, 1] = np.maximum(outward[:, 1], 0)
    if front:
        outward[:] = [0, 0, -1]
    flip = np.einsum('ij,ij->i', cross, outward) < 0
    tris[flip] = tris[flip][:, [0, 2, 1]]
    return {'pos': pos, 'tris': tris, 'uv': np.asarray(uv, dtype=np.float64),
            'nrm': twintail.smooth_normals(pos, tris),
            'joints': np.tile([head_slot, 0, 0, 0], (len(pos), 1)).astype('<u2'),
            'weights': np.tile([1, 0, 0, 0], (len(pos), 1)).astype('<f4')}


def cap(m, slot):
    points = [[m['center_x'], m['crown_y'], m['center_z']]]
    uv, triangles = [[.5, 0]], []
    for ring in range(1, CAP_RINGS + 1):
        phi = math.pi / 2 * ring / CAP_RINGS
        for segment in range(CAP_SEGMENTS):
            theta = 2 * math.pi * segment / CAP_SEGMENTS
            points.append([m['center_x'] + m['radius_x'] * math.sin(phi) * math.sin(theta),
                           m['root_y'] + (m['crown_y'] - m['root_y']) * math.cos(phi),
                           m['center_z'] + m['radius_z'] * math.sin(phi) * math.cos(theta)])
            uv.append([segment / CAP_SEGMENTS, ring / CAP_RINGS])
    for segment in range(CAP_SEGMENTS):
        triangles.append([0, 1 + segment, 1 + (segment + 1) % CAP_SEGMENTS])
    for ring in range(CAP_RINGS - 1):
        for segment in range(CAP_SEGMENTS):
            a, b = 1 + ring * CAP_SEGMENTS + segment, 1 + ring * CAP_SEGMENTS + (segment + 1) % CAP_SEGMENTS
            triangles.extend([[a, b, a + CAP_SEGMENTS], [b, b + CAP_SEGMENTS, a + CAP_SEGMENTS]])
    return _finish(points, triangles, uv, m, slot)


def _grid_triangles(rows, columns, offset=0):
    triangles = []
    for row in range(rows):
        for column in range(columns):
            a = offset + row * (columns + 1) + column
            b, c = a + 1, a + columns + 1
            triangles.extend([[a, b, c], [b, c + 1, c]])
    return triangles


def shell(m, slot):
    points, uv = [], []
    for row in range(SHELL_RINGS + 1):
        t = row / SHELL_RINGS
        radius = 1 + SHELL_BULGE * math.sin(math.pi * t) - SHELL_TAPER * t ** 3
        for column in range(SHELL_SEGMENTS + 1):
            u = column / SHELL_SEGMENTS
            theta = (2 * u - 1) * FRONT_EDGE_ANGLE
            points.append([m['center_x'] + m['radius_x'] * radius * math.sin(theta),
                           m['root_y'] + (m['hem_y'] - m['root_y']) * t,
                           m['center_z'] + m['radius_z'] * radius * math.cos(theta)])
            uv.append([u, t])
    return _finish(points, _grid_triangles(SHELL_RINGS, SHELL_SEGMENTS), uv, m, slot)


def bangs(m, slot):
    points, uv, triangles = [], [], []
    width = m['radius_x'] * FRINGE_WIDTH_SHARE
    for panel in range(FRINGE_PANELS):
        offset = len(points)
        left, right = -width + 2 * width * panel / FRINGE_PANELS, -width + 2 * width * (panel + 1) / FRINGE_PANELS
        gap = m['radius_x'] * FRINGE_GAP_SHARE
        for row in range(FRINGE_ROWS + 1):
            v = row / FRINGE_ROWS
            for column in range(FRINGE_COLUMNS + 1):
                u = column / FRINGE_COLUMNS
                x = left + gap + (right - left - 2 * gap) * u
                root = m['eye_top'] + m['face_height'] * FRINGE_ROOT_SHARE
                tip = m['eye_top'] + m['face_height'] * (FRINGE_TIP_SHARE + FRINGE_TIP_NOTCH_SHARE * abs(2 * u - 1))
                y = root + (tip - root) * v
                cap_height = max(0, (y - m['root_y']) / (m['crown_y'] - m['root_y']))
                z = m['center_z'] - m['radius_z'] * math.sqrt(max(0, 1 - (x / m['radius_x']) ** 2 - cap_height ** 2))
                z -= m['face_height'] * FRINGE_STANDOFF_SHARE
                points.append([m['center_x'] + x, y, z])
                uv.append([u, v])
        triangles.extend(_grid_triangles(FRINGE_ROWS, FRINGE_COLUMNS, offset))
    return _finish(points, triangles, uv, m, slot, front=True)


def _validate_source_mesh(doc, source_mesh):
    if any(mesh.get('name') == MESH_NAME for mesh in doc['meshes']):
        raise ValueError('bob replacement already applied')
    source_index = next(i for i, mesh in enumerate(doc['meshes']) if mesh.get('name') == source_mesh)
    matches = [(i, node) for i, node in enumerate(doc['nodes']) if node.get('mesh') == source_index]
    if len(matches) != 1:
        raise ValueError('bob requires one source hair mesh instance')
    if any(p.get('targets') for p in doc['meshes'][source_index]['primitives']):
        raise ValueError('bob requires source hair without morph targets')


def _reuse_mesh(doc, manifest, source_mesh):
    mesh = next(mesh for mesh in doc['meshes'] if mesh.get('name') == source_mesh)
    mesh['name'] = MESH_NAME
    for info in manifest['parts'].values():
        if info['mesh'] == source_mesh:
            info['mesh'] = MESH_NAME


def _record(manifest, name, piece, index, material_name, slot):
    manifest['parts'][name] = {
        'mesh': MESH_NAME, 'primitives': [index], 'tris': len(piece['tris']),
        'vertex_count': len(piece['pos']), 'materials': [material_name],
        'deletable': True, 'slot': name, 'group': 'hair',
        'bbox': {'min': piece['pos'].min(axis=0).tolist(), 'max': piece['pos'].max(axis=0).tolist()},
        'binding': {'strategy': 'single', 'joint': 'head', 'joint_slot': slot,
                    'spring_mode': 'static_head', 'reason': 'procedural bob research module'},
    }


def apply(doc, views, manifest, parameters):
    length = validate(parameters)
    old_hair = sorted(name for name in manifest['parts'] if name.startswith('Hair_'))
    if not old_hair or any(name in manifest['parts'] for name in PART_NAMES):
        raise ValueError('bob requires a source hairstyle and cannot be stacked')
    source_part = 'Hair_Back' if 'Hair_Back' in old_hair else old_hair[0]
    source_mesh = manifest['parts'][source_part]['mesh']
    _validate_source_mesh(doc, source_mesh)
    skin_index = humanoid.skin_of_mesh(doc, source_mesh)
    slot = doc['skins'][skin_index]['joints'].index(humanoid.bones(doc)['head'])
    material = _part_primitives(doc, manifest, source_part)[0]['material']
    measurements = measure(doc, views, manifest, length)
    pieces = [generator(measurements, slot) for generator in (cap, shell, bangs)]
    removed = sorted(set(old_hair) | (ATTACHED_ACCESSORIES & set(manifest['parts'])))
    customise.drop_parts(doc, views, manifest, removed)
    customise.prune_shapes(doc, views, manifest)
    customise.remap(doc, manifest, removed)
    _reuse_mesh(doc, manifest, source_mesh)
    material_name = doc['materials'][material]['name']
    for name, piece in zip(PART_NAMES, pieces):
        index = garment.attach(doc, views, MESH_NAME, piece, material, name)
        _record(manifest, name, piece, index, material_name, slot)
    return {'module_id': MODULE_ID, 'removed_parts': removed, 'added_parts': list(PART_NAMES),
            'parameters': {'length_scale': length}, 'measurements': measurements,
            'binding': 'static_head', 'spring_validation': 'NOT_APPLICABLE',
            'provenance': {'geometry': 'procedurally authored cap, shell and fringe',
                           'texture_material': material_name, 'usage': 'research only'}}
