"""Research-only jaw width on one pinned face topology.

The neutral field supplies one frozen affine map per vertex. Position morphs
use its linear part, so arbitrary weighted blends commute with that map.
This is a neutral-tangent approximation, not re-evaluation of a nonlinear
field on every animated frame. Normal endpoints use inverse-transpose maps.
"""
import math

import numpy as np

import glb
import humanoid

MESH_NAME = 'Face.baked'
PARAMETER_MIN = .88
PARAMETER_MAX = 1.12
NORMAL_EPSILON = 1e-12
ARRAY_BUFFER = 34962


def validate_parameters(parameters):
    if not isinstance(parameters, dict) or set(parameters) != {'jaw_width'}:
        raise ValueError('face module requires only jaw_width')
    value = parameters['jaw_width']
    if type(value) not in (float, int) or not math.isfinite(value):
        raise ValueError('jaw_width must be a finite number')
    if not PARAMETER_MIN <= value <= PARAMETER_MAX:
        raise ValueError('jaw_width is outside the research contract')
    return float(value)


def field(positions, width, lower_y, upper_y, centre_x=0.):
    if upper_y <= lower_y:
        raise ValueError('jaw region has no height')
    positions = np.asarray(positions, dtype=np.float64)
    height = upper_y - lower_y
    u = (positions[:, 1] - lower_y) / height
    inside = (u > 0) & (u < 1)
    weight = np.zeros(len(positions))
    slope = np.zeros(len(positions))
    weight[inside] = np.sin(np.pi * u[inside]) ** 2
    slope[inside] = np.pi * np.sin(2 * np.pi * u[inside]) / height
    scales = 1 + (width - 1) * weight
    out = positions.copy()
    out[:, 0] = centre_x + (positions[:, 0] - centre_x) * scales
    matrices = np.tile(np.eye(3), (len(positions), 1, 1))
    matrices[:, 0, 0] = scales
    matrices[:, 0, 1] = (positions[:, 0] - centre_x) * (width - 1) * slope
    return out, matrices


def transform_delta(delta, matrices):
    return np.einsum('nij,nj->ni', matrices, delta)


def transform_normals(normals, matrices):
    out = np.linalg.solve(matrices.transpose(0, 2, 1), np.asarray(normals)[..., None])[..., 0]
    length = np.linalg.norm(out, axis=1, keepdims=True)
    return out / np.maximum(length, NORMAL_EPSILON)


def face_layout(doc, manifest):
    if manifest.get('parts', {}).get('Face', {}).get('mesh') != MESH_NAME:
        raise ValueError('unknown face manifest')
    mesh = next((mesh for mesh in doc['meshes'] if mesh.get('name') == MESH_NAME), None)
    if mesh is None or not mesh['primitives']:
        raise ValueError('face mesh is missing')
    first = mesh['primitives'][0]
    for primitive in mesh['primitives']:
        if primitive['attributes'] != first['attributes'] or primitive.get('targets') != first.get('targets'):
            raise ValueError('face requires shared ordered attributes and morph targets')
    attributes = first['attributes']
    if not {'POSITION', 'NORMAL'} <= set(attributes):
        raise ValueError('face requires positions and normals')
    targets = first.get('targets', [])
    if any(set(target) != {'POSITION', 'NORMAL'} for target in targets):
        raise ValueError('face requires paired position and normal targets')
    return mesh, attributes, targets


def read_array(doc, views, index):
    values = glb.read_accessor(doc, views, index).astype(np.float64)
    if values.ndim != 2 or values.shape[1] != 3 or not np.isfinite(values).all():
        raise ValueError('face requires finite VEC3 arrays')
    return values


def transformed_targets(doc, views, targets, normals, new_normals, matrices):
    transformed = []
    for target in targets:
        delta = read_array(doc, views, target['POSITION'])
        normal_delta = read_array(doc, views, target['NORMAL'])
        if delta.shape != normals.shape or normal_delta.shape != normals.shape:
            raise ValueError('face morph vertex count differs')
        transformed.append((transform_delta(delta, matrices),
                            transform_normals(normals + normal_delta, matrices) - new_normals))
    return transformed


def add_array(doc, views, values, positions=False):
    return glb.add_accessor(doc, views, values.astype('<f4'), target=ARRAY_BUFFER, minmax=positions)


def apply(doc, views, manifest, parameters):
    width = validate_parameters(parameters)
    mesh, attributes, targets = face_layout(doc, manifest)
    positions = read_array(doc, views, attributes['POSITION'])
    normals = read_array(doc, views, attributes['NORMAL'])
    world, bones = humanoid.rest_world(doc), humanoid.bones(doc)
    eyes = np.array([world[bones[name]][:3, 3] for name in ('leftEye', 'rightEye')])
    lower_y, upper_y = float(positions[:, 1].min()), float(eyes[:, 1].min())
    changed, matrices = field(positions, width, lower_y, upper_y, float(eyes[:, 0].mean()))
    metrics = {'policy': 'neutral_tangent_affine_v1', 'jaw_width': width,
               'lower_y': lower_y, 'upper_y': upper_y,
               'max_delta_m': float(np.linalg.norm(changed - positions, axis=1).max()),
               'changed_vertices': int(np.count_nonzero(np.linalg.norm(changed - positions, axis=1) > 1e-8)),
               'morph_targets': len(targets), 'research_only': True}
    if width == 1.:
        return metrics
    new_normals = transform_normals(normals, matrices)
    deltas = transformed_targets(doc, views, targets, normals, new_normals, matrices)
    new_attributes = {**attributes, 'POSITION': add_array(doc, views, changed, True),
                      'NORMAL': add_array(doc, views, new_normals)}
    new_targets = [{'POSITION': add_array(doc, views, position), 'NORMAL': add_array(doc, views, normal)}
                   for position, normal in deltas]
    for primitive in mesh['primitives']:
        primitive['attributes'] = dict(new_attributes)
        primitive['targets'] = [dict(target) for target in new_targets]
    return metrics
