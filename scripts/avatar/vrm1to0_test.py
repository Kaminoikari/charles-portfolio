"""vrm1to0.py turns a VRM 1.0 base body into the VRM 0.x this pipeline writes.

Two kinds of fixture. `DOC1` is a hand-written VRM 1.0 document whose every
number was chosen so the expected 0.x value can be written down next to it
(a collider at z=0.3 must come out at z=-0.3, an outline width of 0.002 must
come out as 0.2). `twin()` is the other direction, VRM 0.x -> 1.0, ported from
three-vrm's own v0 importers (VRMMaterialsV0CompatPlugin, the expression and
spring-bone _v0Import, the humanoid thumb rename), so that converting the
twin of the shipped body back gives the shipped body: the converter is
checked against the loader it has to agree with, not against itself.
"""
import json
import math
import os
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import glb  # noqa: E402
import humanoid  # noqa: E402
import vrm1to0  # noqa: E402

REAL_VRM = os.path.join(HERE, '..', '..', 'public', 'avatar', 'mika-pink.vrm')


# ------------------------------------------------------------ VRM 1.0 fixture ---
def doc1():
    """A VRM 1.0 document small enough to check by hand.

    nodes: 0 Root (turned nothing), 1 hips at (0.1, 0.8, 0.2), 2 head under it,
    3 a spring root under head with 4 as its child, 5 Face mesh node (mesh 0,
    two morph targets), 6 leftThumbMetacarpal, 7 a node with a constraint.
    """
    return {
        'asset': {'version': '2.0'},
        'scene': 0,
        'scenes': [{'nodes': [0, 5]}],
        'nodes': [
            {'name': 'Root', 'children': [1]},
            {'name': 'J_Bip_C_Hips', 'translation': [0.1, 0.8, 0.2], 'children': [2, 6]},
            {'name': 'J_Bip_C_Head', 'translation': [0, 0.6, 0], 'children': [3, 7]},
            {'name': 'HairRoot', 'translation': [0, 0.1, 0], 'children': [4]},
            {'name': 'HairTip', 'translation': [0, -0.2, 0]},
            {'name': 'Face', 'mesh': 0},
            {'name': 'Thumb', 'translation': [0.1, 0, 0]},
            {'name': 'Constrained', 'translation': [0, 0.05, 0],
             'extensions': {'VRMC_node_constraint': {'specVersion': '1.0',
                                                     'constraint': {'roll': {'source': 2, 'rollAxis': 'X'}}}}},
        ],
        'meshes': [{'name': 'Face.baked',
                    'primitives': [{'attributes': {'POSITION': 0}, 'material': 0,
                                    'targets': [{'POSITION': 1}, {'POSITION': 2}]}]}],
        'materials': [
            {'name': 'FaceMToon',
             'pbrMetallicRoughness': {
                 'baseColorFactor': [0.5, 0.25, 1.0, 0.75],
                 'baseColorTexture': {'index': 0, 'extensions': {
                     'KHR_texture_transform': {'offset': [0.1, 0.2], 'scale': [1.0, 0.5]}}},
             },
             'normalTexture': {'index': 1, 'scale': 0.8, 'texCoord': 1},
             'emissiveFactor': [0.25, 0.25, 0.25],
             'alphaMode': 'BLEND',
             'doubleSided': True,
             'extensions': {'KHR_materials_emissive_strength': {'emissiveStrength': 2.0},
                            'VRMC_materials_mtoon': {
                 'specVersion': '1.0',
                 'transparentWithZWrite': True,
                 'renderQueueOffsetNumber': 2,
                 'shadeColorFactor': [1.0, 0.25, 0.5],
                 'shadeMultiplyTexture': {'index': 2, 'extensions': {
                     'KHR_texture_transform': {'offset': [0.5, 0.0], 'scale': [1.0, 1.0]}}},
                 'matcapFactor': [0.5, 0.5, 0.5],
                 # the image of v0 (_ShadeShift=0, _ShadeToony=0.9) under
                 # three-vrm's compat formula, worked by hand in the test
                 'shadingShiftFactor': -0.05,
                 'shadingToonyFactor': 0.95,
                 'giEqualizationFactor': 0.7,
                 'matcapTexture': {'index': 3},
                 'outlineWidthMode': 'screenCoordinates',
                 'outlineWidthFactor': 0.002,
                 'outlineColorFactor': [0.25, 0.0, 0.0],
                 'outlineLightingMixFactor': 0.4,
                 'parametricRimColorFactor': [0.0, 0.25, 0.0],
                 'uvAnimationScrollYSpeedFactor': 0.3,
             }}},
            {'name': 'PlainPBR',
             'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1]},
             'emissiveFactor': [1, 0, 0],
             'extensions': {'KHR_materials_emissive_strength': {'emissiveStrength': 3.0}},
             'alphaMode': 'MASK', 'alphaCutoff': 0.4},
        ],
        # textures and images deliberately NOT in the same order: the thumbnail
        # is an image in 1.0 and a texture in 0.x, and an index copied across
        # would land on image 0 here
        'textures': [{'source': 4}, {'source': 1}, {'source': 2}, {'source': 3}, {'source': 0}],
        'images': [{'name': f'img{i}'} for i in range(5)],
        'accessors': [], 'bufferViews': [], 'buffers': [],
        'extensionsUsed': ['KHR_texture_transform', 'KHR_materials_emissive_strength', 'VRMC_vrm',
                           'VRMC_springBone', 'VRMC_materials_mtoon', 'VRMC_node_constraint'],
        'extensions': {
            'VRMC_vrm': {
                'specVersion': '1.0',
                'meta': {'name': 'Fixture', 'version': '2', 'authors': ['A', 'B'],
                         'licenseUrl': 'https://vrm.dev/licenses/1.0/',
                         'thumbnailImage': 4, 'avatarPermission': 'onlySeparatelyLicensedPerson',
                         'allowExcessivelyViolentUsage': False, 'allowExcessivelySexualUsage': True,
                         'commercialUsage': 'personalNonProfit', 'references': ['r1', 'r2'],
                         'contactInformation': 'c',
                         'allowRedistribution': True, 'modification': 'prohibited'},
                'humanoid': {'humanBones': {
                    'hips': {'node': 1}, 'head': {'node': 2},
                    'leftThumbMetacarpal': {'node': 6}}},
                'firstPerson': {'meshAnnotations': [{'node': 5, 'type': 'thirdPersonOnly'}]},
                'lookAt': {'type': 'expression', 'offsetFromHeadBone': [0.01, 0.06, 0.02],
                           'rangeMapHorizontalInner': {'inputMaxValue': 60, 'outputScale': 3}},
                'expressions': {
                    'preset': {
                        'aa': {'morphTargetBinds': [{'node': 5, 'index': 1, 'weight': 0.5}]},
                        'surprised': {'morphTargetBinds': [{'node': 5, 'index': 0, 'weight': 1.0}],
                                      'isBinary': True, 'overrideMouth': 'block'},
                    },
                    'custom': {
                        'Extra': {'morphTargetBinds': [{'node': 5, 'index': 0, 'weight': 1.0}],
                                  'materialColorBinds': [{'material': 0, 'type': 'shadeColor',
                                                          'targetValue': [1, 0, 0, 1]}],
                                  'textureTransformBinds': [{'material': 0, 'scale': [2, 2],
                                                             'offset': [0.1, 0.2]}]},
                    },
                },
            },
            'VRMC_springBone': {
                'specVersion': '1.0',
                'colliders': [
                    {'node': 2, 'shape': {'sphere': {'offset': [0.1, 0.2, 0.3], 'radius': 0.05}}},
                    {'node': 1, 'shape': {'capsule': {'offset': [0, 0, 0], 'radius': 0.1,
                                                      'tail': [0, 0.3, 0]}}},
                    {'node': 2, 'shape': {'sphere': {'offset': [0, 0, 0], 'radius': 0.07}}},
                ],
                'colliderGroups': [{'name': 'mixed', 'colliders': [0, 1, 2]}],
                'springs': [{
                    'name': 'hair', 'center': 1, 'colliderGroups': [0],
                    'joints': [
                        {'node': 3, 'hitRadius': 0.02, 'stiffness': 0.8, 'gravityPower': 0.1,
                         'gravityDir': [0, -1, 0], 'dragForce': 0.3},
                        {'node': 4, 'hitRadius': 0.01, 'stiffness': 0.5},
                    ],
                }],
            },
        },
    }


# --------------------------------------------- VRM 0.x -> 1.0 twin (three-vrm) ---
V0_TO_V1_PRESET = {
    'a': 'aa', 'e': 'ee', 'i': 'ih', 'o': 'oh', 'u': 'ou', 'blink': 'blink', 'joy': 'happy',
    'angry': 'angry', 'sorrow': 'sad', 'fun': 'relaxed', 'lookup': 'lookUp',
    'lookdown': 'lookDown', 'lookleft': 'lookLeft', 'lookright': 'lookRight',
    'blink_l': 'blinkLeft', 'blink_r': 'blinkRight', 'neutral': 'neutral',
}
V0_TO_V1_THUMB = {
    'leftThumbProximal': 'leftThumbMetacarpal', 'leftThumbIntermediate': 'leftThumbProximal',
    'rightThumbProximal': 'rightThumbMetacarpal', 'rightThumbIntermediate': 'rightThumbProximal',
}
V0_COLOR_PROP = {'_Color': 'color', '_EmissionColor': 'emissionColor', '_ShadeColor': 'shadeColor',
                 '_RimColor': 'rimColor', '_OutlineColor': 'outlineColor'}


def _eotf(v):
    return v ** 2.2


def _lerp(a, b, t):
    return a + (b - a) * t


def _v0_render_queue_maps(props):
    """VRMMaterialsV0CompatPlugin._populateRenderQueueMap, ported."""
    transparent, zwrite = set(), set()
    for p in props:
        kw = p.get('keywordMap') or {}
        is_zw_shader = p.get('shader') == 'VRM/UnlitTransparentZWrite'
        is_t = '_ALPHABLEND_ON' in kw or p.get('shader') == 'VRM/UnlitTransparent' or is_zw_shader
        zw = (p.get('floatProperties') or {}).get('_ZWrite') == 1 or is_zw_shader
        if is_t and p.get('renderQueue') is not None:
            (zwrite if zw else transparent).add(p['renderQueue'])
    t_map = {q: min(max(i - len(transparent) + 1, -9), 0) for i, q in enumerate(sorted(transparent))}
    z_map = {q: min(max(i, 0), 9) for i, q in enumerate(sorted(zwrite))}
    return t_map, z_map


def _v0_mtoon_to_v1(p, material, t_map, z_map):
    """VRMMaterialsV0CompatPlugin._parseV0MToonProperties, ported line for line."""
    kw = p.get('keywordMap') or {}
    fl = p.get('floatProperties') or {}
    vec = p.get('vectorProperties') or {}
    tex = p.get('textureProperties') or {}
    is_t = bool(kw.get('_ALPHABLEND_ON', False))
    zw = fl.get('_ZWrite') == 1
    is_cut = bool(kw.get('_ALPHATEST_ON', False))
    offset = 0
    if is_t and p.get('renderQueue') is not None:
        offset = (z_map if zw else t_map)[p['renderQueue']]
    cull = fl.get('_CullMode', 2)
    tt = vec.get('_MainTex')
    tex_ext = {}
    if tt is not None:
        off = [tt[0], tt[1]]
        scale = [tt[2], tt[3]]
        off[1] = 1 - scale[1] - off[1]
        tex_ext = {'KHR_texture_transform': {'offset': off, 'scale': scale}}

    def texinfo(key, **extra):
        i = tex.get(key)
        return None if i is None else {'index': i, 'extensions': dict(tex_ext), **extra}

    base = vec.get('_Color', [1, 1, 1, 1])
    base = [v if i == 3 else _eotf(v) for i, v in enumerate(base)]
    shift0 = fl.get('_ShadeShift', 0)
    toony0 = fl.get('_ShadeToony', 0.9)
    toony1 = _lerp(toony0, 1, 0.5 + 0.5 * shift0)
    shift1 = -shift0 - (1 - toony1)
    gi = fl.get('_IndirectLightIntensity', 0.1)
    ocm = fl.get('_OutlineColorMode', 0)
    mtoon = {
        'specVersion': '1.0',
        'transparentWithZWrite': zw and is_t,
        'renderQueueOffsetNumber': offset,
        'shadeColorFactor': [_eotf(v) for v in vec.get('_ShadeColor', [0.97, 0.81, 0.86, 1])],
        'shadeMultiplyTexture': texinfo('_ShadeTexture'),
        'shadingShiftFactor': shift1,
        'shadingToonyFactor': toony1,
        'giEqualizationFactor': (1 - gi) if gi else None,
        'matcapFactor': [1, 1, 1] if tex.get('_SphereAdd') is not None else None,
        'matcapTexture': ({'index': tex['_SphereAdd']} if tex.get('_SphereAdd') is not None else None),
        'rimLightingMixFactor': fl.get('_RimLightingMix', 0),
        'rimMultiplyTexture': texinfo('_RimTexture'),
        'parametricRimColorFactor': [_eotf(v) for v in vec.get('_RimColor', [0, 0, 0, 1])],
        'parametricRimFresnelPowerFactor': fl.get('_RimFresnelPower', 1),
        'parametricRimLiftFactor': fl.get('_RimLift', 0),
        'outlineWidthMode': ['none', 'worldCoordinates', 'screenCoordinates'][int(fl.get('_OutlineWidthMode', 0))],
        'outlineWidthFactor': 0.01 * fl.get('_OutlineWidth', 0),
        'outlineWidthMultiplyTexture': texinfo('_OutlineWidthTexture'),
        'outlineColorFactor': [_eotf(v) for v in vec.get('_OutlineColor', [0, 0, 0])],
        'outlineLightingMixFactor': fl.get('_OutlineLightingMix', 1) if ocm == 1 else 0,
        'uvAnimationMaskTexture': texinfo('_UvAnimMaskTexture'),
        'uvAnimationScrollXSpeedFactor': fl.get('_UvAnimScrollX', 0),
        'uvAnimationScrollYSpeedFactor': -fl.get('_UvAnimScrollY', 0),
        'uvAnimationRotationSpeedFactor': fl.get('_UvAnimRotation', 0),
    }
    mtoon = {k: v for k, v in mtoon.items() if v is not None}
    out = dict(material)
    out['pbrMetallicRoughness'] = {'baseColorFactor': base}
    if texinfo('_MainTex'):
        out['pbrMetallicRoughness']['baseColorTexture'] = texinfo('_MainTex')
    for key, gltf_key, extra in (('_BumpMap', 'normalTexture', {'scale': fl.get('_BumpScale', 1)}),
                                 ('_EmissionMap', 'emissiveTexture', {})):
        out.pop(gltf_key, None)
        if texinfo(key):
            out[gltf_key] = texinfo(key, **extra)
    out['emissiveFactor'] = [_eotf(v) for v in vec.get('_EmissionColor', [0, 0, 0, 1])][:3]
    out['alphaMode'] = 'BLEND' if is_t else 'MASK' if is_cut else 'OPAQUE'
    out.pop('alphaCutoff', None)
    if is_cut:
        out['alphaCutoff'] = fl.get('_Cutoff', 0.5)
    out['doubleSided'] = cull == 0
    out['extensions'] = {'VRMC_materials_mtoon': mtoon}
    return out


def twin(doc):
    """The VRM 1.0 file a 0.x export would be, by three-vrm's reading of it.

    Every scene root is hung under one node turned pi about Y (the body faces
    +Z in 1.0), the humanoid map becomes a record with the thumb names 1.0
    uses, materials go through the compat plugin's formulas, blend shape groups
    become preset/custom expressions with weights in [0, 1], and spring
    colliders lose the z sign 0.x stored them with. meta, firstPerson and
    lookAt have no three-vrm 0->1 path; they are mapped by the same table
    vrm1to0 uses, inverted.
    """
    doc = json.loads(json.dumps(doc))
    v0 = doc['extensions'].pop('VRM')
    nodes = doc['nodes']
    bones = humanoid.bones({'extensions': {'VRM': v0}})
    scene = doc['scenes'][doc.get('scene', 0)]
    nodes.append({'name': 'vrm1-root', 'rotation': [0, 1, 0, 0], 'children': list(scene['nodes'])})
    scene['nodes'] = [len(nodes) - 1]

    # materials
    props = v0.get('materialProperties') or []
    t_map, z_map = _v0_render_queue_maps(props)
    for i, p in enumerate(props):
        if p.get('shader') == 'VRM/MToon':
            doc['materials'][i] = _v0_mtoon_to_v1(p, doc['materials'][i], t_map, z_map)

    # expressions
    preset, custom = {}, {}
    mesh_nodes = {}
    for i, n in enumerate(nodes):
        if 'mesh' in n:
            mesh_nodes.setdefault(n['mesh'], []).append(i)
    mat_index = {m.get('name'): i for i, m in enumerate(doc['materials'])}
    for g in (v0.get('blendShapeMaster') or {}).get('blendShapeGroups', []):
        e = {'isBinary': bool(g.get('isBinary', False))}
        binds = [{'node': ni, 'index': b['index'], 'weight': 0.01 * b.get('weight', 100)}
                 for b in g.get('binds', []) for ni in mesh_nodes.get(b['mesh'], [])]
        if binds:
            e['morphTargetBinds'] = binds
        for mv in g.get('materialValues', []):
            mi = mat_index[mv['materialName']]
            if mv['propertyName'] == '_MainTex_ST':
                s = mv['targetValue'][:2]
                o = [mv['targetValue'][2], 1 - mv['targetValue'][3] - mv['targetValue'][1]]
                e.setdefault('textureTransformBinds', []).append({'material': mi, 'scale': s, 'offset': o})
            elif mv['propertyName'] in V0_COLOR_PROP:
                e.setdefault('materialColorBinds', []).append(
                    {'material': mi, 'type': V0_COLOR_PROP[mv['propertyName']],
                     'targetValue': list(mv['targetValue'])})
        name1 = V0_TO_V1_PRESET.get(g.get('presetName'))
        if name1:
            preset[name1] = e
        else:
            custom[g['name']] = e

    # springs: one 1.0 spring per 0.x root bone, joints down the children[0] chain
    sec = v0.get('secondaryAnimation') or {}
    colliders, groups = [], []
    for cg in sec.get('colliderGroups', []):
        ids = []
        for c in cg.get('colliders', []):
            o = c.get('offset', {})
            colliders.append({'node': cg['node'], 'shape': {'sphere': {
                'offset': [o.get('x', 0), o.get('y', 0), -o.get('z', 0)], 'radius': c.get('radius', 0)}}})
            ids.append(len(colliders) - 1)
        groups.append({'name': nodes[cg['node']].get('name', ''), 'colliders': ids})
    springs = []
    for g in sec.get('boneGroups', []):
        gd = g.get('gravityDir', {'x': 0, 'y': -1, 'z': 0})
        params = {'hitRadius': g.get('hitRadius', 0), 'stiffness': g.get('stiffiness', 1),
                  'gravityPower': g.get('gravityPower', 0),
                  'gravityDir': [gd.get('x', 0), gd.get('y', -1), gd.get('z', 0)],
                  'dragForce': g.get('dragForce', 0.4)}
        for root in g.get('bones', []):
            chain, i = [], root
            while True:
                chain.append(i)
                kids = nodes[i].get('children') or []
                if not kids:
                    break
                i = kids[0]
            spring = {'name': g.get('comment', ''), 'joints': [{'node': n, **params} for n in chain],
                      'colliderGroups': list(g.get('colliderGroups', []))}
            if g.get('center', -1) is not None and g.get('center', -1) >= 0:
                spring['center'] = g['center']
            springs.append(spring)

    # meta, firstPerson, lookAt: vrm1to0's table, inverted
    m0 = v0.get('meta') or {}
    meta = {'name': m0.get('title', ''), 'version': m0.get('version', ''),
            'authors': [m0.get('author', '')], 'contactInformation': m0.get('contactInformation', ''),
            'references': [m0.get('reference', '')] if m0.get('reference') else [],
            'licenseUrl': 'https://vrm.dev/licenses/1.0/',
            'avatarPermission': {v: k for k, v in vrm1to0.AVATAR_PERMISSION.items()}.get(
                m0.get('allowedUserName'), 'onlyAuthor'),
            'allowExcessivelyViolentUsage': m0.get('violentUssageName') == 'Allow',
            'allowExcessivelySexualUsage': m0.get('sexualUssageName') == 'Allow',
            'commercialUsage': 'personalProfit' if m0.get('commercialUssageName') == 'Allow' else 'personalNonProfit',
            'otherLicenseUrl': m0.get('otherLicenseUrl', '')}
    if m0.get('texture') is not None and m0['texture'] >= 0:
        meta['thumbnailImage'] = doc['textures'][m0['texture']]['source']
    fp0 = v0.get('firstPerson') or {}
    fp1 = {'meshAnnotations': [
        {'node': ni, 'type': {v: k for k, v in vrm1to0.FIRST_PERSON_TYPE.items()}[a['firstPersonFlag']]}
        for a in fp0.get('meshAnnotations', []) for ni in mesh_nodes.get(a['mesh'], [])]}
    off = fp0.get('firstPersonBoneOffset', {'x': 0, 'y': 0.06, 'z': 0})
    look = {'type': 'expression' if fp0.get('lookAtTypeName') == 'BlendShape' else 'bone',
            'offsetFromHeadBone': [off.get('x', 0), off.get('y', 0.06), -off.get('z', 0)]}
    for k0, k1 in vrm1to0.LOOK_AT_MAPS.items():
        dm = fp0.get(k0)
        if dm:
            look[k1] = {'inputMaxValue': dm.get('xRange', 90), 'outputScale': dm.get('yRange', 10)}

    doc['extensions']['VRMC_vrm'] = {
        'specVersion': '1.0', 'meta': meta,
        'humanoid': {'humanBones': {V0_TO_V1_THUMB.get(b, b): {'node': n} for b, n in bones.items()}},
        'firstPerson': fp1, 'lookAt': look,
        'expressions': {'preset': preset, 'custom': custom},
    }
    doc['extensions']['VRMC_springBone'] = {'specVersion': '1.0', 'colliders': colliders,
                                            'colliderGroups': groups, 'springs': springs}
    doc['extensionsUsed'] = [e for e in doc.get('extensionsUsed', []) if e != 'VRM'] + [
        'VRMC_vrm', 'VRMC_springBone', 'VRMC_materials_mtoon', 'KHR_texture_transform']
    return doc


def write_twin(src, dst):
    """The VRM 1.0 twin of the .vrm at `src`, written to `dst` (binary chunk copied)."""
    doc, binary = glb.load(src)
    return glb.save(dst, twin(doc), binary)


# ------------------------------------------------------------------- tests ---
class Convert(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out, cls.report = vrm1to0.convert(doc1())
        cls.v0 = cls.out['extensions']['VRM']

    def test_humanoid_map_is_a_list_with_the_v0_thumb_names(self):
        self.assertEqual(humanoid.version(self.out), '0')
        self.assertEqual(humanoid.bones(self.out), {'hips': 1, 'head': 2, 'leftThumbProximal': 6})
        hum = self.v0['humanoid']
        self.assertIsInstance(hum['humanBones'], list)
        self.assertTrue(all(b['useDefaultValues'] for b in hum['humanBones']))
        self.assertEqual(hum['armStretch'], 0.05)

    def test_the_body_turns_half_a_turn_to_face_minus_z(self):
        roots = self.out['scenes'][0]['nodes']
        self.assertEqual(len(roots), 1)
        root = self.out['nodes'][roots[0]]
        self.assertEqual(root['name'], vrm1to0.ROOT_NAME)
        self.assertEqual(root['children'], [0, 5])
        self.assertEqual(root['rotation'], [0, 1, 0, 0])
        world = humanoid.node_world(self.out)
        x, y, z = world[1][0][3], world[1][1][3], world[1][2][3]
        self.assertAlmostEqual(x, -0.1, places=9)
        self.assertAlmostEqual(y, 0.8, places=9)
        self.assertAlmostEqual(z, -0.2, places=9)
        # the humanoid map still points at the same nodes
        self.assertEqual(humanoid.bones(self.out)['hips'], 1)

    def test_collider_offsets_flip_z_the_way_three_vrm_unflips_them(self):
        groups = self.v0['secondaryAnimation']['colliderGroups']
        sphere = next(c for g in groups if g['node'] == 2 for c in g['colliders'] if c['radius'] == 0.05)
        self.assertEqual(sphere['offset'], {'x': 0.1, 'y': 0.2, 'z': -0.3})

    def test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows(self):
        groups = self.v0['secondaryAnimation']['colliderGroups']
        self.assertEqual([g['node'] for g in groups], [2, 1])
        self.assertEqual(len(groups[0]['colliders']), 2)     # both spheres on the head
        spring = self.v0['secondaryAnimation']['boneGroups'][0]
        self.assertEqual(sorted(spring['colliderGroups']), [0, 1])

    def test_a_capsule_becomes_spheres_that_reach_its_tail(self):
        groups = self.v0['secondaryAnimation']['colliderGroups']
        caps = [c for g in groups if g['node'] == 1 for c in g['colliders']]
        self.assertGreaterEqual(len(caps), 2)
        ys = sorted(c['offset']['y'] for c in caps)
        self.assertAlmostEqual(ys[0], 0.0)
        self.assertAlmostEqual(ys[-1], 0.3)
        self.assertTrue(all(c['radius'] == 0.1 for c in caps))
        self.assertTrue(all(b - a <= 0.1 + 1e-9 for a, b in zip(ys, ys[1:])), ys)
        self.assertTrue(any('capsule' in note for note in self.report['approximated']), self.report)

    def test_a_spring_takes_its_root_joints_parameters_in_v0_spelling(self):
        spring = self.v0['secondaryAnimation']['boneGroups'][0]
        self.assertEqual(spring['bones'], [3])
        self.assertEqual(spring['comment'], 'hair')
        self.assertEqual(spring['center'], 1)
        self.assertEqual(spring['stiffiness'], 0.8)
        self.assertNotIn('stiffness', spring)
        self.assertEqual(spring['hitRadius'], 0.02)
        self.assertEqual(spring['gravityPower'], 0.1)
        self.assertEqual(spring['dragForce'], 0.3)
        self.assertEqual(spring['gravityDir'], {'x': 0, 'y': -1, 'z': 0})
        self.assertEqual(humanoid.springs(self.out)['groups'][0]['bones'], [3])

    def test_expression_weights_scale_to_100_and_presets_get_v0_names(self):
        groups = {g['name']: g for g in self.v0['blendShapeMaster']['blendShapeGroups']}
        self.assertEqual(groups['aa']['presetName'], 'a')
        self.assertEqual(groups['aa']['binds'], [{'mesh': 0, 'index': 1, 'weight': 50.0}])
        self.assertEqual(groups['surprised']['presetName'], 'unknown')
        self.assertTrue(groups['surprised']['isBinary'])
        self.assertEqual(groups['Extra']['presetName'], 'unknown')
        self.assertEqual(humanoid.expression_names(self.out), ['aa', 'surprised', 'Extra'])

    def test_a_bind_names_the_mesh_the_node_draws(self):
        groups = {g['name']: g for g in self.v0['blendShapeMaster']['blendShapeGroups']}
        self.assertEqual(groups['Extra']['binds'][0]['mesh'], 0)   # node 5 draws mesh 0

    def test_material_colour_binds_become_material_values(self):
        groups = {g['name']: g for g in self.v0['blendShapeMaster']['blendShapeGroups']}
        mv = groups['Extra']['materialValues']
        self.assertIn({'materialName': 'FaceMToon', 'propertyName': '_ShadeColor',
                       'targetValue': [1, 0, 0, 1]}, mv)
        st = next(v for v in mv if v['propertyName'] == '_MainTex_ST')
        # three-vrm reads [sx, sy, ox, oy] and sets oy = 1 - oy - sy
        self.assertEqual(st['targetValue'][:2], [2, 2])
        self.assertAlmostEqual(st['targetValue'][2], 0.1)
        self.assertAlmostEqual(1 - st['targetValue'][3] - 2, 0.2)
        self.assertTrue(any('overrideMouth' in n for n in self.report['dropped']), self.report)

    def test_colours_are_written_in_the_gamma_space_three_vrm_decodes(self):
        p = self.v0['materialProperties'][0]
        c = p['vectorProperties']['_Color']
        self.assertAlmostEqual(c[0] ** 2.2, 0.5, places=9)
        self.assertAlmostEqual(c[1] ** 2.2, 0.25, places=9)
        self.assertAlmostEqual(c[3], 0.75)                     # alpha is linear
        s = p['vectorProperties']['_ShadeColor']
        self.assertAlmostEqual(s[1] ** 2.2, 0.25, places=9)
        self.assertEqual(s[3], 1)
        o = p['vectorProperties']['_OutlineColor']
        self.assertAlmostEqual(o[0] ** 2.2, 0.25, places=9)
        r = p['vectorProperties']['_RimColor']
        self.assertAlmostEqual(r[1] ** 2.2, 0.25, places=9)
        # the pipeline treats baseColorFactor and _Color as one number
        self.assertEqual(self.out['materials'][0]['pbrMetallicRoughness']['baseColorFactor'], c)

    def test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials(self):
        # MToon: 0.25 x strength 2 = 0.5, then gamma; the extension is gone
        e = self.v0['materialProperties'][0]['vectorProperties']['_EmissionColor']
        self.assertAlmostEqual(e[0] ** 2.2, 0.5, places=9)
        self.assertNotIn('KHR_materials_emissive_strength', self.out['materials'][0].get('extensions', {}))
        # plain: three-vrm hands it to the glTF loader, which reads the extension
        plain = self.out['materials'][1]
        self.assertEqual(plain['extensions']['KHR_materials_emissive_strength'], {'emissiveStrength': 3.0})
        self.assertEqual(plain['emissiveFactor'], [1, 0, 0])
        self.assertIn('KHR_materials_emissive_strength', self.out['extensionsUsed'])
        # and once no material carries it, it is no longer declared
        d = doc1()
        del d['materials'][1]['extensions']
        out, _ = vrm1to0.convert(d)
        self.assertNotIn('KHR_materials_emissive_strength', out['extensionsUsed'])

    def test_what_0x_cannot_carry_is_reported_not_swallowed(self):
        dropped, approx = self.report['dropped'], self.report['approximated']
        self.assertTrue(any('meta.allowRedistribution=True' in n for n in dropped), dropped)
        self.assertTrue(any("meta.modification='prohibited'" in n for n in dropped), dropped)
        self.assertTrue(any('_BumpMap 用 texCoord 1' in n for n in dropped), dropped)
        self.assertTrue(any('_ShadeTexture 的 KHR_texture_transform 與 _MainTex 不同' in n for n in approx), approx)
        # _BumpMap declares NO transform (identity) while _MainTex is shifted:
        # three-vrm reads it as shifted too, so that is a difference as well
        self.assertTrue(any('_BumpMap 的 KHR_texture_transform 與 _MainTex 不同' in n for n in approx), approx)
        self.assertTrue(any('matcapFactor [0.5, 0.5, 0.5]' in n for n in approx), approx)
        # a slot sharing _MainTex's transform is not worth a line
        d = doc1()
        d['materials'][0]['extensions']['VRMC_materials_mtoon']['shadeMultiplyTexture']['extensions'] = {
            'KHR_texture_transform': {'offset': [0.1, 0.2], 'scale': [1.0, 0.5]}}
        _, r = vrm1to0.convert(d)
        self.assertFalse([n for n in r['approximated'] if '_ShadeTexture' in n], r)
        # nor is an undeclared transform against an undeclared _MainTex transform
        d = doc1()
        del d['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['extensions']
        del d['materials'][0]['extensions']['VRMC_materials_mtoon']['shadeMultiplyTexture']['extensions']
        _, r = vrm1to0.convert(d)
        self.assertFalse([n for n in r['approximated'] if 'KHR_texture_transform' in n], r)

    def test_a_rotated_main_texture_transform_is_reported(self):
        d = doc1()
        d['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['extensions']['KHR_texture_transform']['rotation'] = 0.3
        _, r = vrm1to0.convert(d)
        self.assertTrue(any('_MainTex 有 KHR_texture_transform.rotation' in n for n in r['dropped']), r)
        self.assertFalse([n for n in self.report['dropped'] if 'rotation' in n], self.report)

    def test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony(self):
        # shift0 = 1 makes toony1 = 1 whatever toony0 was: (shift1, toony1) = (-1, 1)
        out, _ = vrm1to0.convert(_with_mtoon(shadingShiftFactor=-1.0, shadingToonyFactor=1.0))
        fl = out['extensions']['VRM']['materialProperties'][0]['floatProperties']
        self.assertAlmostEqual(fl['_ShadeShift'], 1.0, places=9)
        self.assertAlmostEqual(fl['_ShadeToony'], 0.9, places=9)

    def test_only_the_active_scene_is_turned_and_that_is_reported(self):
        d = doc1()
        d['scenes'] = [{'nodes': [0, 5]}, {'nodes': [7]}]
        out, report = vrm1to0.convert(d)
        self.assertEqual(out['nodes'][out['scenes'][0]['nodes'][0]]['name'], vrm1to0.ROOT_NAME)
        self.assertEqual(out['scenes'][1], {'nodes': [7]})
        self.assertTrue(any('scene' in n for n in report['approximated']), report)
        self.assertEqual(self.report['approximated'], [n for n in self.report['approximated'] if 'scene' not in n])

    def test_shade_shift_and_toony_invert_the_compat_formula(self):
        fl = self.v0['materialProperties'][0]['floatProperties']
        self.assertAlmostEqual(fl['_ShadeShift'], 0.0, places=9)
        self.assertAlmostEqual(fl['_ShadeToony'], 0.9, places=9)
        # VRoid's own pair, through the formula and back
        out, _ = vrm1to0.convert(_with_mtoon(shadingShiftFactor=1.0, shadingToonyFactor=1.0))
        fl = out['extensions']['VRM']['materialProperties'][0]['floatProperties']
        self.assertAlmostEqual(fl['_ShadeShift'], -1.0, places=9)
        self.assertAlmostEqual(fl['_ShadeToony'], 1.0, places=9)

    def test_outline_width_is_in_hundredths(self):
        fl = self.v0['materialProperties'][0]['floatProperties']
        self.assertAlmostEqual(fl['_OutlineWidth'], 0.2, places=9)
        self.assertEqual(fl['_OutlineWidthMode'], 2)
        self.assertEqual(fl['_OutlineColorMode'], 1)
        self.assertAlmostEqual(fl['_OutlineLightingMix'], 0.4)
        self.assertAlmostEqual(fl['_IndirectLightIntensity'], 0.3, places=9)
        self.assertAlmostEqual(fl['_UvAnimScrollY'], -0.3, places=9)
        self.assertEqual(fl['_BumpScale'], 0.8)

    def test_blend_mode_keywords_and_queue_follow_alpha_mode(self):
        p = self.v0['materialProperties'][0]
        self.assertEqual(p['keywordMap'].get('_ALPHABLEND_ON'), True)
        self.assertNotIn('_ALPHATEST_ON', p['keywordMap'])
        self.assertEqual(p['floatProperties']['_BlendMode'], 3)
        self.assertEqual(p['floatProperties']['_ZWrite'], 1)
        self.assertEqual(p['floatProperties']['_CullMode'], 0)
        self.assertEqual(p['renderQueue'], 2501 + 2)
        self.assertEqual(p['tagMap'], {'RenderType': 'Transparent'})
        # an MToon cutout
        d = doc1()
        d['materials'][0].update({'alphaMode': 'MASK', 'alphaCutoff': 0.4, 'doubleSided': False})
        q = vrm1to0.convert(d)[0]['extensions']['VRM']['materialProperties'][0]
        self.assertEqual(q['keywordMap'].get('_ALPHATEST_ON'), True)
        self.assertNotIn('_ALPHABLEND_ON', q['keywordMap'])
        self.assertEqual(q['floatProperties']['_Cutoff'], 0.4)
        self.assertEqual(q['floatProperties']['_BlendMode'], 1)
        self.assertEqual(q['floatProperties']['_CullMode'], 2)
        self.assertEqual(q['renderQueue'], 2450)
        self.assertEqual(q['tagMap'], {'RenderType': 'TransparentCutout'})
        # a material without MToon is left to the glTF loader: nothing to carry
        plain = self.v0['materialProperties'][1]
        self.assertEqual(plain['keywordMap'], {})
        self.assertEqual(plain['floatProperties'], {})
        self.assertEqual(plain['renderQueue'], 2450)
        self.assertEqual(self.out['materials'][1]['alphaCutoff'], 0.4)

    def test_texture_slots_and_the_main_transform(self):
        p = self.v0['materialProperties'][0]
        self.assertEqual(p['textureProperties'],
                         {'_MainTex': 0, '_BumpMap': 1, '_ShadeTexture': 2, '_SphereAdd': 3})
        mt = p['vectorProperties']['_MainTex']
        self.assertEqual(mt[2:], [1.0, 0.5])
        self.assertAlmostEqual(mt[0], 0.1)
        self.assertAlmostEqual(mt[1], 1 - 0.5 - 0.2)
        self.assertEqual(p['keywordMap'].get('_NORMALMAP'), True)

    def test_every_material_gets_a_property_block_in_the_same_position(self):
        names = [m['name'] for m in self.out['materials']]
        self.assertEqual([p['name'] for p in self.v0['materialProperties']], names)
        self.assertEqual(self.v0['materialProperties'][0]['shader'], 'VRM/MToon')
        self.assertEqual(self.v0['materialProperties'][1]['shader'], 'VRM_USE_GLTFSHADER')
        for m in self.out['materials']:
            self.assertNotIn('VRMC_materials_mtoon', m.get('extensions', {}))

    def test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture(self):
        m = self.v0['meta']
        self.assertEqual(m['title'], 'Fixture')
        self.assertEqual(m['author'], 'A, B')
        self.assertEqual(m['reference'], 'r1, r2')
        self.assertEqual(m['allowedUserName'], 'ExplicitlyLicensedPerson')
        self.assertEqual(m['violentUssageName'], 'Disallow')
        self.assertEqual(m['sexualUssageName'], 'Allow')
        self.assertEqual(m['commercialUssageName'], 'Disallow')
        self.assertEqual(m['licenseName'], 'Other')
        self.assertEqual(m['otherLicenseUrl'], 'https://vrm.dev/licenses/1.0/')
        self.assertEqual(self.out['textures'][m['texture']]['source'], 4)

    def test_first_person_and_look_at(self):
        fp = self.v0['firstPerson']
        self.assertEqual(fp['firstPersonBone'], 2)
        self.assertEqual(fp['firstPersonBoneOffset'], {'x': 0.01, 'y': 0.06, 'z': -0.02})
        self.assertEqual(fp['lookAtTypeName'], 'BlendShape')
        self.assertEqual(fp['lookAtHorizontalInner'],
                         {'curve': [0, 0, 0, 1, 1, 1, 1, 0], 'xRange': 60, 'yRange': 3})
        self.assertEqual(fp['lookAtVerticalUp']['yRange'], 1)   # expression default
        self.assertEqual(fp['meshAnnotations'], [{'mesh': 0, 'firstPersonFlag': 'ThirdPersonOnly'}])

    def test_the_1_0_extensions_are_gone_and_VRM_is_declared(self):
        self.assertIn('VRM', self.out['extensionsUsed'])
        self.assertIn('KHR_materials_unlit', self.out['extensionsUsed'])
        self.assertFalse([e for e in self.out['extensionsUsed'] if e.startswith('VRMC_')])
        self.assertFalse([e for e in self.out['extensions'] if e.startswith('VRMC_')])
        self.assertNotIn('extensions', self.out['nodes'][7])
        self.assertTrue(any('VRMC_node_constraint' in n for n in self.report['dropped']), self.report)

    def test_a_0_x_document_is_refused(self):
        with self.assertRaises(humanoid.BadRig):
            vrm1to0.convert(vrm1to0_doc0())

    def test_the_input_is_not_mutated(self):
        d = doc1()
        before = json.dumps(d, sort_keys=True)
        vrm1to0.convert(d)
        self.assertEqual(json.dumps(d, sort_keys=True), before)


def _with_mtoon(**mtoon):
    d = doc1()
    d['materials'][0]['extensions']['VRMC_materials_mtoon'].update(mtoon)
    return d


def vrm1to0_doc0():
    d = doc1()
    d['extensions'] = {'VRM': {'humanoid': {'humanBones': [{'bone': 'hips', 'node': 1}]}}}
    d['extensionsUsed'] = ['VRM']
    return d


class Ensure(unittest.TestCase):
    """make.py's entry: a 0.x base passes through by path, a 1.0 base is
    written out as 0.x and that file is what every later step reads."""

    def test_a_0_x_base_is_returned_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, 'base-vrm0.vrm')
            self.assertEqual(vrm1to0.ensure_vrm0(REAL_VRM, out), REAL_VRM)
            self.assertFalse(os.path.exists(out))

    def test_a_1_0_base_is_converted_and_the_converted_path_returned(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'twin.vrm')
            write_twin(REAL_VRM, src)
            self.assertEqual(humanoid.version(humanoid.read(src)), '1')
            out = os.path.join(tmp, 'base-vrm0.vrm')
            self.assertEqual(vrm1to0.ensure_vrm0(src, out), out)
            self.assertEqual(humanoid.version(humanoid.read(out)), '0')


class RoundTrip(unittest.TestCase):
    """The shipped body, rewritten as three-vrm would read it as 1.0, then
    converted back: everything this pipeline reads off the 0.x block has to
    come back as it went in."""

    @classmethod
    def setUpClass(cls):
        cls.orig, _ = glb.load(REAL_VRM)
        cls.back, cls.report = vrm1to0.convert(twin(cls.orig))
        cls.v0 = cls.orig['extensions']['VRM']
        cls.v0b = cls.back['extensions']['VRM']

    def test_skeleton(self):
        self.assertEqual(humanoid.bones(self.back), humanoid.bones(self.orig))
        self.assertEqual(humanoid.compare(self.orig, self.back, tolerance=1e-9), [])
        self.assertEqual(len(self.back['nodes']), len(self.orig['nodes']) + 2)
        self.assertEqual(humanoid.mesh_skin(self.back), humanoid.mesh_skin(self.orig))

    def test_springs(self):
        a = humanoid.springs(self.orig)
        b = humanoid.springs(self.back)
        self.assertEqual(len(a['colliderGroups']), len(b['colliderGroups']))
        for ga, gb in zip(a['colliderGroups'], b['colliderGroups']):
            self.assertEqual(ga['node'], gb['node'])
            self.assertEqual(len(ga['colliders']), len(gb['colliders']))
            for ca, cb in zip(ga['colliders'], gb['colliders']):
                for k in 'xyz':
                    self.assertAlmostEqual(ca['offset'][k], cb['offset'][k], places=9)
                self.assertAlmostEqual(ca['radius'], cb['radius'], places=9)

        def by_root(groups):
            return {root: (g['hitRadius'], g['gravityPower'], g['stiffness'], g['dragForce'],
                           g['center'], sorted(g['colliderGroups']))
                    for g in groups for root in g['bones']}
        self.assertEqual(by_root(b['groups']), by_root(a['groups']))

    def test_materials(self):
        self.assertEqual([m['name'] for m in self.back['materials']],
                         [m['name'] for m in self.orig['materials']])
        self.assertEqual([p['name'] for p in self.v0b['materialProperties']],
                         [p['name'] for p in self.v0['materialProperties']])
        for pa, pb, ma, mb in zip(self.v0['materialProperties'], self.v0b['materialProperties'],
                                  self.orig['materials'], self.back['materials']):
            self.assertEqual(pb['shader'], pa['shader'])
            for key in ('_Color', '_ShadeColor', '_OutlineColor', '_MainTex'):
                for x, y in zip(pa['vectorProperties'][key], pb['vectorProperties'][key]):
                    self.assertAlmostEqual(x, y, places=9, msg=f'{pa["name"]} {key}')
            for x, y in zip(pa['vectorProperties']['_EmissionColor'][:3],
                            pb['vectorProperties']['_EmissionColor'][:3]):
                self.assertAlmostEqual(x, y, places=9)
            fa, fb = pa['floatProperties'], pb['floatProperties']
            for key in ('_ShadeShift', '_ShadeToony', '_OutlineWidth', '_OutlineWidthMode',
                        '_CullMode', '_BlendMode', '_ZWrite', '_Cutoff', '_IndirectLightIntensity',
                        '_BumpScale'):
                self.assertAlmostEqual(fa[key], fb[key], places=9, msg=f'{pa["name"]} {key}')
            # _OutlineColorMode 0 with any mix and mode 1 with mix 0 render the same
            eff = lambda f: f['_OutlineLightingMix'] if f['_OutlineColorMode'] == 1 else 0  # noqa: E731
            self.assertAlmostEqual(eff(fa), eff(fb), places=9, msg=pa['name'])
            self.assertEqual(pb['textureProperties'], pa['textureProperties'])
            for kw in ('_ALPHABLEND_ON', '_ALPHATEST_ON', '_NORMALMAP'):
                self.assertEqual(kw in pb['keywordMap'], kw in pa['keywordMap'], f'{pa["name"]} {kw}')
            self.assertEqual(mb['alphaMode'], ma['alphaMode'])
            self.assertEqual(mb['doubleSided'], ma['doubleSided'])
            for x, y in zip(ma['pbrMetallicRoughness']['baseColorFactor'],
                            mb['pbrMetallicRoughness']['baseColorFactor']):
                self.assertAlmostEqual(x, y, places=9)
            self.assertEqual(mb['pbrMetallicRoughness'].get('baseColorTexture', {}).get('index'),
                             ma['pbrMetallicRoughness'].get('baseColorTexture', {}).get('index'))
        # render order survives even where the queue numbers do not (three-vrm
        # ranks 0.x queues into offsets, so 4500 comes back as 3000)
        rank = lambda props: [p['renderQueue'] for p in props]  # noqa: E731
        a, b = rank(self.v0['materialProperties']), rank(self.v0b['materialProperties'])
        self.assertEqual([sorted(set(a)).index(q) for q in a], [sorted(set(b)).index(q) for q in b])

    def test_expressions(self):
        ga = self.v0['blendShapeMaster']['blendShapeGroups']
        gb = self.v0b['blendShapeMaster']['blendShapeGroups']
        self.assertEqual([g['presetName'] for g in gb], [g['presetName'] for g in ga])
        self.assertEqual([g['name'] for g in gb if g['presetName'] == 'unknown'],
                         [g['name'] for g in ga if g['presetName'] == 'unknown'])
        for a, b in zip(ga, gb):
            self.assertEqual(b['isBinary'], a['isBinary'])
            self.assertEqual([(x['mesh'], x['index']) for x in b['binds']],
                             [(x['mesh'], x['index']) for x in a['binds']])
            for x, y in zip(a['binds'], b['binds']):
                self.assertAlmostEqual(x['weight'], y['weight'], places=9)
            self.assertEqual(b['materialValues'], a['materialValues'])
        self.assertEqual(len(humanoid.expression_names(self.back)), len(humanoid.expression_names(self.orig)))

    def test_first_person_and_meta(self):
        fa, fb = self.v0['firstPerson'], self.v0b['firstPerson']
        self.assertEqual(fb['firstPersonBone'], fa['firstPersonBone'])
        self.assertEqual(fb['firstPersonBoneOffset'], fa['firstPersonBoneOffset'])
        self.assertEqual(fb['lookAtTypeName'], fa['lookAtTypeName'])
        for k in vrm1to0.LOOK_AT_MAPS:
            self.assertEqual(fb[k], fa[k])
        self.assertEqual(fb['meshAnnotations'], fa['meshAnnotations'])
        ma, mb = self.v0['meta'], self.v0b['meta']
        for k in ('title', 'author', 'allowedUserName', 'violentUssageName',
                  'sexualUssageName', 'commercialUssageName'):
            self.assertEqual(mb[k], ma[k])
        self.assertEqual(self.back['textures'][mb['texture']]['source'],
                         self.orig['textures'][ma['texture']]['source'])

    def test_nothing_the_pipeline_needs_was_dropped(self):
        self.assertEqual(self.report['dropped'], [])
        self.assertEqual(self.report['approximated'], [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
