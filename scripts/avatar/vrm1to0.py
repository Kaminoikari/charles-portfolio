"""VRM 1.0 in, VRM 0.x out, so the rest of this pipeline can stay 0.x.

humanoid.py reads both versions, but every writer here (build.py, customise.py,
twintail.py) writes `extensions.VRM`: materialProperties, blendShapeMaster,
secondaryAnimation. Teaching each of them the 1.0 spelling would be three
more copies of every rule; converting once at the door is one. make.py calls
ensure_vrm0() before partition, and from there on the base is a 0.x file like
any other. three-vrm loads the 0.x result through the same importers it uses
for VRoid's files, so the target of every rule below is what those importers
do, read off @pixiv/three-vrm 3.x (node_modules/@pixiv/three-vrm/lib):

  humanoid     record -> list of {bone, node, useDefaultValues}; the thumb
               names go back to 0.x's (VRMHumanoidLoaderPlugin.thumbBoneNameMap
               inverted: leftThumbMetacarpal -> leftThumbProximal, and
               leftThumbProximal -> leftThumbIntermediate).
  facing       1.0 faces +Z, 0.x faces -Z (VRMUtils.rotateVRM0 turns a 0.x
               scene pi about Y). Every scene root is hung under one new node
               turned pi about Y. A node rather than a rewrite of the roots'
               rotations, because a root can itself be a humanoid bone whose
               local rotation a retarget overwrites.
  materials    VRMC_materials_mtoon -> VRM/MToon materialProperties, each
               formula the inverse of VRMMaterialsV0CompatPlugin's: colours
               go back to the gamma space the plugin decodes with pow(2.2),
               outline width back to hundredths, shadingShift/Toony through
               the inverse of its lerp. pbrMetallicRoughness.baseColorFactor
               is rewritten to the same numbers as _Color, which is how
               VRoid's 0.x exports come and what customise.tint relies on.
  expressions  preset/custom -> blendShapeGroups, weights x100, preset names
               through VRMExpressionLoaderPlugin.v0v1PresetNameMap inverted;
               a preset 0.x has no name for (surprised) is written as
               presetName 'unknown' under its 1.0 name. morphTargetBinds
               name a node; 0.x binds name the node's mesh.
  springs      VRMC_springBone -> secondaryAnimation. Collider offsets get
               their z negated (the 0.x importer negates it back). A 1.0
               collider group may span nodes; 0.x groups have one node, so a
               group splits per node and every spring that named it names
               all its parts. Capsules become a row of spheres. Each 1.0
               spring becomes one 0.x boneGroup with the ROOT joint's
               parameters, since 0.x has one set per group.
  meta, lookAt, firstPerson
               the 1.0 enums onto the 0.x ones; z of the head offset negated
               (VRMLookAtLoaderPlugin._v0Import negates it).

What 0.x cannot carry is dropped and REPORTED, never silently: node
constraints, expression overrides, extended colliders, per-joint spring
parameters that differ from the root's, matcap colour binds and factor, a
texture slot's own texture transform or UV set, the 1.0-only meta fields,
scenes other than the active one.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import humanoid  # noqa: E402

ROOT_NAME = 'vrm0-root'

V1_TO_V0_THUMB = humanoid.V1_TO_V0_THUMB
V1_TO_V0_PRESET = {
    'aa': 'a', 'ee': 'e', 'ih': 'i', 'oh': 'o', 'ou': 'u', 'blink': 'blink', 'happy': 'joy',
    'angry': 'angry', 'sad': 'sorrow', 'relaxed': 'fun', 'lookUp': 'lookup',
    'lookDown': 'lookdown', 'lookLeft': 'lookleft', 'lookRight': 'lookright',
    'blinkLeft': 'blink_l', 'blinkRight': 'blink_r', 'neutral': 'neutral',
}
COLOR_BIND_PROP = {'color': '_Color', 'emissionColor': '_EmissionColor', 'shadeColor': '_ShadeColor',
                   'rimColor': '_RimColor', 'outlineColor': '_OutlineColor'}
AVATAR_PERMISSION = {'onlyAuthor': 'OnlyAuthor', 'onlySeparatelyLicensedPerson': 'ExplicitlyLicensedPerson',
                     'everyone': 'Everyone'}
FIRST_PERSON_TYPE = {'auto': 'Auto', 'both': 'Both', 'thirdPersonOnly': 'ThirdPersonOnly',
                     'firstPersonOnly': 'FirstPersonOnly'}
LOOK_AT_MAPS = {'lookAtHorizontalInner': 'rangeMapHorizontalInner',
                'lookAtHorizontalOuter': 'rangeMapHorizontalOuter',
                'lookAtVerticalDown': 'rangeMapVerticalDown',
                'lookAtVerticalUp': 'rangeMapVerticalUp'}
OUTLINE_MODE = {'none': 0, 'worldCoordinates': 1, 'screenCoordinates': 2}
V1_EXTENSIONS = ('VRMC_vrm', 'VRMC_springBone', 'VRMC_materials_mtoon', 'VRMC_node_constraint',
                 'VRMC_springBone_extended_collider', 'VRMC_materials_hdr_emissiveMultiplier')
# The 0.x curve VRoid writes; three-vrm warns on any other and ignores it anyway.
LOOK_AT_CURVE = [0, 0, 0, 1, 1, 1, 1, 0]
# The texture slots VRoid's exporter always writes a [0, 0, 1, 1] transform for.
VECTOR_SLOTS = ('_ShadeTexture', '_BumpMap', '_ReceiveShadowTexture', '_ShadingGradeTexture',
                '_SphereAdd', '_EmissionMap', '_OutlineWidthTexture')


def _oetf(v):
    """Linear -> the gamma space three-vrm's v0 compat decodes with pow(e, 2.2)."""
    return max(v, 0.0) ** (1 / 2.2)


def _rgb(values, default):
    values = list(values if values is not None else default)[:3]
    return [_oetf(v) for v in values]


# ------------------------------------------------------------------ humanoid ---
def _humanoid(doc):
    bones = humanoid.bones(doc)
    # A 1.0 file already spelling thumbs the 0.x way (three-vrm's
    # existsPreviousThumbName case) is left alone; renaming it would collide.
    rename = not any(b.endswith('ThumbIntermediate') for b in bones)
    out = [{'bone': V1_TO_V0_THUMB.get(b, b) if rename else b, 'node': n, 'useDefaultValues': True}
           for b, n in bones.items()]
    return {'humanBones': out, 'armStretch': 0.05, 'legStretch': 0.05, 'upperArmTwist': 0.5,
            'lowerArmTwist': 0.5, 'upperLegTwist': 0.5, 'lowerLegTwist': 0.5,
            'feetSpacing': 0, 'hasTranslationDoF': False}


# -------------------------------------------------------------------- facing ---
def _face_minus_z(doc, report):
    index = doc.get('scene', 0)
    scene = doc['scenes'][index]
    doc['nodes'].append({'name': ROOT_NAME, 'rotation': [0, 1, 0, 0], 'children': list(scene['nodes'])})
    scene['nodes'] = [len(doc['nodes']) - 1]
    if len(doc.get('scenes') or []) > 1:
        report['approximated'].append(f'檔案有 {len(doc["scenes"])} 個 scene，只轉了作用中的第 {index} 個')


# ----------------------------------------------------------------- materials ---
def _shade_v0(shift1, toony1):
    """Invert VRMMaterialsV0CompatPlugin: toony1 = lerp(toony0, 1, 0.5 + 0.5*shift0),
    shift1 = -shift0 - (1 - toony1). shift0 = 1 makes toony1 = 1 whatever toony0
    was; MToon's default 0.9 is returned there."""
    shift0 = -shift1 - (1 - toony1)
    t = 0.5 + 0.5 * shift0
    if abs(1 - t) < 1e-9:
        return shift0, 0.9
    return shift0, (toony1 - t) / (1 - t)


def _mtoon_props(name, material, mtoon, report):
    pbr = material.get('pbrMetallicRoughness') or {}
    alpha_mode = material.get('alphaMode', 'OPAQUE')
    transparent = alpha_mode == 'BLEND'
    cutout = alpha_mode == 'MASK'
    zwrite = bool(mtoon.get('transparentWithZWrite', False)) and transparent
    offset = int(mtoon.get('renderQueueOffsetNumber', 0) or 0)
    if transparent and zwrite:
        queue, blend, zw, tag = 2501 + offset, 3, 1, 'Transparent'
    elif transparent:
        queue, blend, zw, tag = 3000 + offset, 2, 0, 'Transparent'
    elif cutout:
        queue, blend, zw, tag = 2450, 1, 1, 'TransparentCutout'
    else:
        queue, blend, zw, tag = 2000, 0, 1, 'Opaque'

    shift0, toony0 = _shade_v0(mtoon.get('shadingShiftFactor', 0.0), mtoon.get('shadingToonyFactor', 0.9))
    if not 0.0 <= toony0 <= 1.0:
        report['approximated'].append(f'材質 {name} 的 shadingToony 反解出 {toony0:.3f}，夾到 [0, 1]')
        toony0 = min(max(toony0, 0.0), 1.0)
    mode = OUTLINE_MODE.get(mtoon.get('outlineWidthMode', 'none'), 0)
    mix = mtoon.get('outlineLightingMixFactor', 0.0)
    strength = (material.get('extensions') or {}).get('KHR_materials_emissive_strength', {}).get(
        'emissiveStrength', 1.0)
    emissive = [v * strength for v in material.get('emissiveFactor', [0, 0, 0])]

    floats = {
        '_Cutoff': material.get('alphaCutoff', 0.5), '_BumpScale': (material.get('normalTexture') or {}).get('scale', 1),
        '_ReceiveShadowRate': 1, '_ShadingGradeRate': 1, '_ShadeShift': shift0, '_ShadeToony': toony0,
        '_LightColorAttenuation': 0,
        '_IndirectLightIntensity': 1 - mtoon.get('giEqualizationFactor', 0.9),
        '_RimLightingMix': mtoon.get('rimLightingMixFactor', 0.0),
        '_RimFresnelPower': mtoon.get('parametricRimFresnelPowerFactor', 1.0),
        '_RimLift': mtoon.get('parametricRimLiftFactor', 0.0),
        '_OutlineWidth': mtoon.get('outlineWidthFactor', 0.0) / 0.01, '_OutlineScaledMaxDistance': 1,
        '_OutlineLightingMix': mix if mix > 0 else 1, '_DebugMode': 0, '_BlendMode': blend,
        '_OutlineWidthMode': mode, '_OutlineColorMode': 1 if mix > 0 else 0,
        '_CullMode': 0 if material.get('doubleSided') else 2, '_OutlineCullMode': 1,
        '_SrcBlend': 5 if transparent else 1, '_DstBlend': 10 if transparent else 0, '_ZWrite': zw,
        '_UvAnimScrollX': mtoon.get('uvAnimationScrollXSpeedFactor', 0.0),
        '_UvAnimScrollY': -mtoon.get('uvAnimationScrollYSpeedFactor', 0.0),
        '_UvAnimRotation': mtoon.get('uvAnimationRotationSpeedFactor', 0.0),
    }
    base = pbr.get('baseColorFactor', [1, 1, 1, 1])
    colour = _rgb(base, base) + [base[3] if len(base) > 3 else 1.0]
    vectors = {
        '_Color': colour,
        '_ShadeColor': _rgb(mtoon.get('shadeColorFactor'), [1, 1, 1]) + [1.0],
        '_MainTex': _main_tex_transform(pbr.get('baseColorTexture') or {}),
        **{slot: [0, 0, 1, 1] for slot in VECTOR_SLOTS},
        '_EmissionColor': _rgb(emissive, [0, 0, 0]) + [1.0],
        '_RimColor': _rgb(mtoon.get('parametricRimColorFactor'), [0, 0, 0]) + [1.0],
        '_OutlineColor': _rgb(mtoon.get('outlineColorFactor'), [0, 0, 0]) + [1.0],
    }
    textures = {}
    base_transform = _transform_of(pbr.get('baseColorTexture') or {})
    if base_transform['rotation']:
        report['dropped'].append(f'材質 {name} 的 _MainTex 有 KHR_texture_transform.rotation，0.x 的貼圖向量只有位移與縮放')
    for key, info in (('_MainTex', pbr.get('baseColorTexture')), ('_BumpMap', material.get('normalTexture')),
                      ('_EmissionMap', material.get('emissiveTexture')),
                      ('_ShadeTexture', mtoon.get('shadeMultiplyTexture')),
                      ('_SphereAdd', mtoon.get('matcapTexture')), ('_RimTexture', mtoon.get('rimMultiplyTexture')),
                      ('_OutlineWidthTexture', mtoon.get('outlineWidthMultiplyTexture')),
                      ('_UvAnimMaskTexture', mtoon.get('uvAnimationMaskTexture'))):
        if info is None or 'index' not in info:
            continue
        textures[key] = info['index']
        # The compat plugin rebuilds every texture reference on UV set 0 with
        # _MainTex's transform; a slot whose EFFECTIVE transform differs (its
        # own, or none at all against a shifted _MainTex) is read as _MainTex's.
        if info.get('texCoord', 0):
            report['dropped'].append(f'材質 {name} 的 {key} 用 texCoord {info["texCoord"]}，0.x 只有 UV0')
        own = _transform_of(info)
        if key != '_MainTex' and own != base_transform:
            report['approximated'].append(f'材質 {name} 的 {key} 的 KHR_texture_transform 與 _MainTex 不同，0.x 每個貼圖槽都用 _MainTex 的')
    if mtoon.get('matcapFactor') not in (None, [1, 1, 1]):
        report['approximated'].append(f'材質 {name} 的 matcapFactor {mtoon["matcapFactor"]}，0.x 的 _SphereAdd 沒有顏色，當作白')
    keywords = {}
    if transparent:
        keywords['_ALPHABLEND_ON'] = True
    if cutout:
        keywords['_ALPHATEST_ON'] = True
    if '_BumpMap' in textures:
        keywords['_NORMALMAP'] = True
    if mode:
        keywords['MTOON_OUTLINE_WIDTH_WORLD' if mode == 1 else 'MTOON_OUTLINE_WIDTH_SCREEN'] = True
        keywords['MTOON_OUTLINE_COLOR_MIXED' if mix > 0 else 'MTOON_OUTLINE_COLOR_FIXED'] = True

    # The glTF-level material carries the same numbers as the MToon block, the
    # way VRoid's 0.x exports do; render.py reads baseColorFactor and
    # customise.tint writes both in one breath.
    pbr['baseColorFactor'] = list(colour)
    material['pbrMetallicRoughness'] = pbr
    material['emissiveFactor'] = [min(v, 1.0) for v in vectors['_EmissionColor'][:3]]
    return {'name': name, 'renderQueue': queue, 'shader': 'VRM/MToon', 'floatProperties': floats,
            'vectorProperties': vectors, 'textureProperties': textures, 'keywordMap': keywords,
            'tagMap': {'RenderType': tag}}


def _transform_of(texinfo):
    """A texture reference's effective KHR_texture_transform, absent = identity."""
    tt = (texinfo.get('extensions') or {}).get('KHR_texture_transform') or {}
    # The file's own numbers, not float() of them: a coerced 0.0 serialises as
    # two more bytes per value and the twin round trip is compared by bytes.
    return {'offset': list(tt.get('offset', [0, 0])), 'scale': list(tt.get('scale', [1, 1])),
            'rotation': tt.get('rotation', 0)}


def _main_tex_transform(texinfo):
    """0.x stores [offsetX, offsetY, scaleX, scaleY] with y measured from the
    other edge: the compat plugin reads offset.y = 1 - scale.y - offset.y."""
    tt = _transform_of(texinfo)
    off, scale = tt['offset'], tt['scale']
    return [off[0], 1 - scale[1] - off[1], scale[0], scale[1]]


def _plain_props(name, material):
    """A material without MToon: three-vrm leaves VRM_USE_GLTFSHADER to the glTF loader."""
    alpha_mode = material.get('alphaMode', 'OPAQUE')
    queue = {'BLEND': 3000, 'MASK': 2450}.get(alpha_mode, 2000)
    return {'name': name, 'renderQueue': queue, 'shader': 'VRM_USE_GLTFSHADER', 'floatProperties': {},
            'vectorProperties': {}, 'textureProperties': {}, 'keywordMap': {}, 'tagMap': {}}


def _materials(doc, report):
    props = []
    for i, material in enumerate(doc.get('materials') or []):
        name = material.get('name', f'material {i}')
        ext = material.get('extensions') or {}
        mtoon = ext.pop('VRMC_materials_mtoon', None)
        if mtoon is not None:
            # _mtoon_props folds the emissive strength into _EmissionColor, so
            # the extension is popped only after it has been read.
            props.append(_mtoon_props(name, material, mtoon, report))
            ext.pop('KHR_materials_emissive_strength', None)
            ext['KHR_materials_unlit'] = {}
        else:
            # Left to the glTF loader, extension and all.
            props.append(_plain_props(name, material))
        if ext:
            material['extensions'] = ext
        else:
            material.pop('extensions', None)
    return props


# --------------------------------------------------------------- expressions ---
def _expressions(doc, ext1, report):
    expr = ext1.get('expressions') or {}
    mesh_of = {i: n['mesh'] for i, n in enumerate(doc['nodes']) if 'mesh' in n}
    materials = doc.get('materials') or []
    groups = []
    items = [(k, v, V1_TO_V0_PRESET.get(k, 'unknown')) for k, v in (expr.get('preset') or {}).items()]
    items += [(k, v, 'unknown') for k, v in (expr.get('custom') or {}).items()]
    for name, e, preset in items:
        e = e or {}
        binds = []
        for b in e.get('morphTargetBinds', []):
            if b.get('node') not in mesh_of:
                report['dropped'].append(f'表情 {name} 綁到節點 {b.get("node")}，該節點沒有 mesh')
                continue
            binds.append({'mesh': mesh_of[b['node']], 'index': b['index'], 'weight': b.get('weight', 1.0) * 100})
        values = []
        for b in e.get('materialColorBinds', []):
            prop = COLOR_BIND_PROP.get(b.get('type'))
            if prop is None or not 0 <= b.get('material', -1) < len(materials):
                report['dropped'].append(f'表情 {name} 的 materialColorBind {b.get("type")} 在 0.x 沒有對應')
                continue
            values.append({'materialName': materials[b['material']].get('name', ''), 'propertyName': prop,
                           'targetValue': list(b['targetValue'])})
        for b in e.get('textureTransformBinds', []):
            if not 0 <= b.get('material', -1) < len(materials):
                continue
            scale = list(b.get('scale', [1, 1]))
            off = list(b.get('offset', [0, 0]))
            # three-vrm reads [sx, sy, ox, oy] and sets offset.y = 1 - oy - sy
            values.append({'materialName': materials[b['material']].get('name', ''), 'propertyName': '_MainTex_ST',
                           'targetValue': [scale[0], scale[1], off[0], 1 - off[1] - scale[1]]})
        for key in ('overrideBlink', 'overrideLookAt', 'overrideMouth'):
            if e.get(key, 'none') != 'none':
                report['dropped'].append(f'表情 {name} 的 {key}={e[key]}，0.x 沒有 override')
        groups.append({'name': name, 'presetName': preset, 'isBinary': bool(e.get('isBinary', False)),
                       'binds': binds, 'materialValues': values})
    return {'blendShapeGroups': groups}


# ------------------------------------------------------------------- springs ---
def _sphere(node_offset, radius):
    x, y, z = (list(node_offset) + [0, 0, 0])[:3]
    return {'offset': {'x': x, 'y': y, 'z': -z}, 'radius': radius}


def _spheres_of(collider, report):
    """A 1.0 collider as 0.x spheres, in 1.0's own frame (z not yet flipped)."""
    shape = collider.get('shape') or {}
    if (collider.get('extensions') or {}).get('VRMC_springBone_extended_collider'):
        report['dropped'].append(f'節點 {collider.get("node")} 的 VRMC_springBone_extended_collider，改用基本形狀')
    if 'sphere' in shape:
        s = shape['sphere']
        return [(s.get('offset', [0, 0, 0]), s.get('radius', 0))]
    if 'capsule' in shape:
        c = shape['capsule']
        a, b, r = c.get('offset', [0, 0, 0]), c.get('tail', [0, 0, 0]), c.get('radius', 0)
        length = math.dist(a, b)
        n = max(2, int(math.ceil(length / r)) + 1) if r > 0 else 2
        report['approximated'].append(f'節點 {collider.get("node")} 的 capsule 改成 {n} 顆球')
        return [([a[k] + (b[k] - a[k]) * i / (n - 1) for k in range(3)], r) for i in range(n)]
    report['dropped'].append(f'節點 {collider.get("node")} 的 collider 沒有形狀')
    return []


def _springs(doc, report):
    sb = doc['extensions'].get('VRMC_springBone') or {}
    colliders = sb.get('colliders') or []
    groups0, parts_of = [], {}
    for gi, g in enumerate(sb.get('colliderGroups') or []):
        by_node = {}
        for ci in g.get('colliders', []):
            if not 0 <= ci < len(colliders):
                continue
            c = colliders[ci]
            by_node.setdefault(c.get('node'), []).extend(
                _sphere(off, r) for off, r in _spheres_of(c, report))
        parts_of[gi] = []
        for node, spheres in by_node.items():
            groups0.append({'node': node, 'colliders': spheres})
            parts_of[gi].append(len(groups0) - 1)
    bone_groups = []
    for s in sb.get('springs') or []:
        joints = s.get('joints') or []
        if not joints:
            continue
        root = joints[0]
        for key in ('hitRadius', 'stiffness', 'gravityPower', 'dragForce', 'gravityDir'):
            if any(j.get(key, root.get(key)) != root.get(key) for j in joints[1:]):
                report['approximated'].append(f'spring {s.get("name", "")} 的 {key} 逐關節不同，取根關節的')
                break
        gd = root.get('gravityDir', [0, -1, 0])
        bone_groups.append({
            'comment': s.get('name', ''), 'stiffiness': root.get('stiffness', 1.0),
            'gravityPower': root.get('gravityPower', 0.0),
            'gravityDir': {'x': gd[0], 'y': gd[1], 'z': gd[2]}, 'dragForce': root.get('dragForce', 0.5),
            'center': s.get('center', -1) if s.get('center') is not None else -1,
            'hitRadius': root.get('hitRadius', 0.0), 'bones': [root['node']],
            'colliderGroups': [p for gi in s.get('colliderGroups', []) for p in parts_of.get(gi, [])],
        })
    return {'boneGroups': bone_groups, 'colliderGroups': groups0}


# ------------------------------------------------------ meta, look-at, first ---
V1_ONLY_META = ('copyrightInformation', 'thirdPartyLicenses', 'allowPoliticalOrReligiousUsage',
                'allowAntisocialOrHateUsage', 'creditNotation', 'allowRedistribution', 'modification')


def _meta(doc, meta1, report):
    for key in V1_ONLY_META:
        if key in meta1:
            report['dropped'].append(f'meta.{key}={meta1[key]!r}，0.x 的 meta 沒有這個欄位')
    texture = -1
    image = meta1.get('thumbnailImage')
    if image is not None:
        textures = doc.setdefault('textures', [])
        texture = next((i for i, t in enumerate(textures) if t.get('source') == image), None)
        if texture is None:
            textures.append({'source': image})
            texture = len(textures) - 1
    allow = lambda flag: 'Allow' if flag else 'Disallow'  # noqa: E731
    return {
        'version': meta1.get('version', ''), 'author': ', '.join(meta1.get('authors') or []),
        'contactInformation': meta1.get('contactInformation', ''),
        'reference': ', '.join(meta1.get('references') or []), 'title': meta1.get('name', ''),
        'texture': texture,
        'allowedUserName': AVATAR_PERMISSION.get(meta1.get('avatarPermission'), 'OnlyAuthor'),
        'violentUssageName': allow(meta1.get('allowExcessivelyViolentUsage', False)),
        'sexualUssageName': allow(meta1.get('allowExcessivelySexualUsage', False)),
        'commercialUssageName': allow(meta1.get('commercialUsage', 'personalNonProfit') != 'personalNonProfit'),
        'otherPermissionUrl': '', 'licenseName': 'Other',
        'otherLicenseUrl': meta1.get('otherLicenseUrl') or meta1.get('licenseUrl', ''),
    }


def _first_person(doc, ext1):
    bones = humanoid.bones(doc)
    look = ext1.get('lookAt') or {}
    off = list(look.get('offsetFromHeadBone', [0, 0.06, 0]))
    by_expression = look.get('type') == 'expression'
    mesh_of = {i: n['mesh'] for i, n in enumerate(doc['nodes']) if 'mesh' in n}
    out = {
        'firstPersonBone': bones.get('head', -1),
        'firstPersonBoneOffset': {'x': off[0], 'y': off[1], 'z': -off[2]},
        'meshAnnotations': [{'mesh': mesh_of[a['node']], 'firstPersonFlag': FIRST_PERSON_TYPE.get(a.get('type'), 'Auto')}
                            for a in (ext1.get('firstPerson') or {}).get('meshAnnotations', [])
                            if a.get('node') in mesh_of],
        'lookAtTypeName': 'BlendShape' if by_expression else 'Bone',
    }
    for key0, key1 in LOOK_AT_MAPS.items():
        rm = look.get(key1) or {}
        out[key0] = {'curve': list(LOOK_AT_CURVE), 'xRange': rm.get('inputMaxValue', 90),
                     'yRange': rm.get('outputScale', 1 if by_expression else 10)}
    return out


# ------------------------------------------------------------------ entry ---
def convert(doc):
    """(0.x doc, report) for a 1.0 doc. The input is not touched; report is
    {'dropped': [...], 'approximated': [...]}, both empty for a clean file."""
    import json
    if humanoid.version(doc) != '1':
        raise humanoid.BadRig(f'{doc.get("_name", "這個檔")} 已是 VRM 0.x，不需要轉換')
    doc = json.loads(json.dumps({k: v for k, v in doc.items() if k != '_name'}))
    report = {'dropped': [], 'approximated': []}
    ext1 = doc['extensions']['VRMC_vrm']

    humanoid0 = _humanoid(doc)
    first_person = _first_person(doc, ext1)
    springs = _springs(doc, report)
    expressions = _expressions(doc, ext1, report)
    materials = _materials(doc, report)
    meta = _meta(doc, ext1.get('meta') or {}, report)
    _face_minus_z(doc, report)

    constrained = 0
    for node in doc['nodes']:
        ext = node.get('extensions') or {}
        if ext.pop('VRMC_node_constraint', None) is not None:
            constrained += 1
        if ext:
            node['extensions'] = ext
        else:
            node.pop('extensions', None)
    if constrained:
        report['dropped'].append(f'{constrained} 個節點的 VRMC_node_constraint，0.x 沒有 constraint')

    for name in V1_EXTENSIONS:
        doc['extensions'].pop(name, None)
    doc['extensions']['VRM'] = {
        'exporterVersion': 'vrm1to0.py', 'specVersion': '0.0', 'meta': meta, 'humanoid': humanoid0,
        'firstPerson': first_person, 'blendShapeMaster': expressions, 'secondaryAnimation': springs,
        'materialProperties': materials,
    }
    # KHR_materials_emissive_strength stays declared while a plain material
    # still carries it; the MToon ones have folded it into _EmissionColor.
    still = {e for m in doc.get('materials') or [] for e in (m.get('extensions') or {})}
    gone = set(V1_EXTENSIONS) | ({'KHR_materials_emissive_strength'} - still)
    used = [e for e in doc.get('extensionsUsed', []) if e not in gone]
    for name in ('VRM', 'KHR_materials_unlit'):
        if name not in used:
            used.append(name)
    doc['extensionsUsed'] = used
    if 'extensionsRequired' in doc:
        doc['extensionsRequired'] = [e for e in doc['extensionsRequired'] if e not in gone]
    return doc, report


def ensure_vrm0(path, out):
    """The path make.py's steps read: `path` itself for a 0.x file, else the
    0.x conversion written to `out`. Prints what the conversion had to drop."""
    doc, binary = glb.load(path)
    if humanoid.version(doc) == '0':
        print(f'   {os.path.basename(path)} 已是 VRM 0.x')
        return path
    doc, report = convert(doc)
    size = glb.save(out, doc, binary)
    print(f'   {os.path.basename(path)} 是 VRM 1.0，轉成 0.x 寫到 {os.path.basename(out)}（{size} bytes）')
    for line in report['dropped']:
        print(f'   捨棄：{line}')
    for line in report['approximated']:
        print(f'   近似：{line}')
    return out


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Write a VRM 1.0 file out as VRM 0.x.')
    ap.add_argument('src')
    ap.add_argument('dst')
    args = ap.parse_args()
    ensure_vrm0(args.src, args.dst)
