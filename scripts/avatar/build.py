"""Build the Milfy-referenced outfit onto the partitioned base.

Every measurement here is a fraction of this body's own landmarks, read out of
the file rather than typed as a world coordinate: the waist is where the torso
is narrowest, the hem sits between hip and knee. Hard-coding heights would make
the script correct for exactly one body, and the point of a template is that the
next body gets the same garment without a rewrite.

Colour lives in the character contract and nowhere else. Each entry of its
PALETTE becomes one flat MToon material, which is what makes "change one
material, change the whole colourway" true rather than aspirational. Since
2026-09-11 that contract is a module in characters/ and arrives as build()'s
`character` argument, so the values that are one character's no longer sit in
this file next to the values that are the pipeline's.
"""
import functools
import io
import json
import math
import os
import sys

import numpy as np
from PIL import Image
from scipy.spatial import cKDTree

import customise
import envelope
import binding
import bonemap
import garment
import glb
import humanoid
import outfit
import render
import twintail
import weld
from characters import mika
from bodies import mika_base
from outfits import mellowheart


# 雙馬尾對外套的守衛（量法見 twintail.coat_intrusion）。乾淨的建置量到
# -59mm／0%（最靠裡的髮頂點也在輪廓外 59mm），舊出貨檔 -2 是 50.7mm／25.8%。
# 5mm 與 springsim.test.ts 的 REST_COAT_MAX_MM 是同一個數字，量法不同（這裡量
# bind mesh、世界座標、x 對折、不切前方；springsim 量彈簧安定後的蒙皮網格、脊椎
# 座標系、-10° 前切）；1% 是髮絲取 90 百分位粗細之後允許零星幾根探進輪廓。
TAIL_COAT_INTRUSION_MAX = 5.0
TAIL_COAT_INSIDE_SHARE_MAX = 0.01

# And a key is only shipped if the vertices it moves go somewhere a person could
# see: the mean displacement over its moved vertices, on at least one garment,
# has to clear this.
#
# `Side adjustment` fails it because it is empty in the FBX itself, every delta
# exactly zero -- a named key the vendor shipped without ever authoring. Keeping
# it would advertise a slider that does nothing, which is the silent no-op this
# pipeline keeps guarding against.
SHAPE_KEY_MIN_MEAN = 0.001

# 蝴蝶結在腰封高度那一段，離腰封的最近距離上限。
BOW_GAP_MAX = 8.0


# How many column blocks `customise.hue` splits a hair atlas into before it
# removes each one's vertical trend. A gate rather than anyone's value, and the
# reason it survives a swap is measured rather than argued: the answer barely
# depends on the count, so there is nothing here to re-measure per body. On this
# atlas the resulting lightness p10-p90 is 0.100 at 8 blocks, 0.102 at 16 and
# 0.102 at 32 (the derivation, and why a whole-row correction cannot be right
# for two atlases at once, is in `customise._flatten_v`). Sixteen only has to be
# fine enough that no block straddles two strips.
HAIR_FLATTEN_BLOCKS = 16


# The neck band, in metres of overshoot past the neck and head bones. The
# overshoot exists so the feather ramps down on skin that is still neck rather
# than stopping dead on the collarbone. It is geometry, not colour, so it
# survives a change of palette. The feather width itself lives in customise,
# where it is a fraction of each atlas's own width.
NECK_MARGIN = 0.03


# How colourful an outline may be, whoever wears it. The colour itself is the
# character's: OUTLINE_VALUE and SKIN_TARGET live in characters/ and the comment
# there records why the line is taken off the skin at all. A cap on chroma is a
# rule about outlines rather than about one character's skin, so it stays here,
# and `outline_colour` below is where the two meet.
OUTLINE_CHROMA_MAX = 0.038


def outline_colour(character):
    """One character's outline: her skin's hue, dropped to her own line value.

    Derived rather than written down, so moving the skin moves the line with it.
    The floor is this file's cap. A line more colourful than OUTLINE_CHROMA_MAX
    renders rust on a near-white skin and traces the whole figure, and an unlit
    renderer draws no outline pass at all, so every gate and all four contract
    cameras are blind to it; the guard that is not blind to it is in verify.py.
    """
    raw = tuple(c / max(character.SKIN_TARGET) * character.OUTLINE_VALUE
                for c in character.SKIN_TARGET)
    floor = max(raw) - OUTLINE_CHROMA_MAX
    return tuple(round(max(c, floor), 4) for c in raw)





def add_material(doc, name, base, shade, texture=None, *, outline, rim):
    """One MToon material, in both the glTF and the VRM tables.

    `texture` is a glTF texture index, used by the imported outfit: its maps are
    greyscale pattern and the colour arrives as the factor multiplying them, so
    the same named-material colour policy covers textured pieces too.

    `outline` and `rim` are keyword-only and have no default on purpose. Both
    are one character's, and this function is handed to outfit.load as a
    callback, so a default here would be a second character silently wearing
    Mika's edge light on every imported garment.
    """
    doc['materials'].append({
        'name': name,
        'pbrMetallicRoughness': {
            'baseColorFactor': [*base, 1.0],
            'metallicFactor': 0, 'roughnessFactor': 0.9,
            **({'baseColorTexture': {'index': texture}} if texture is not None else {}),
        },
        'emissiveFactor': [0, 0, 0],
        'doubleSided': True,
        'alphaMode': 'OPAQUE',
        'extensions': {'KHR_materials_unlit': {}},
    })
    doc['extensions']['VRM']['materialProperties'].append({
        'name': name,
        'renderQueue': 2000,
        'shader': 'VRM/MToon',
        'floatProperties': {
            '_Cutoff': 0.5, '_BumpScale': 1, '_ReceiveShadowRate': 1,
            '_ShadingGradeRate': 1, '_ShadeShift': -1, '_ShadeToony': 1,
            '_LightColorAttenuation': 0, '_IndirectLightIntensity': 0.1,
            '_OutlineWidth': 0.08, '_OutlineScaledMaxDistance': 1,
            '_OutlineLightingMix': 1, '_DebugMode': 0, '_BlendMode': 0,
            '_OutlineWidthMode': 1, '_OutlineColorMode': 1, '_CullMode': 0,
            '_OutlineCullMode': 1, '_SrcBlend': 1, '_DstBlend': 0, '_ZWrite': 1,
        },
        'textureProperties': ({'_MainTex': texture, '_ShadeTexture': texture}
                              if texture is not None else {}),
        'vectorProperties': {
            '_Color': [*base, 1.0], '_ShadeColor': [*shade, 1.0],
            '_MainTex': [0, 0, 1, 1], '_ShadeTexture': [0, 0, 1, 1],
            '_OutlineColor': [*outline, 1],
            '_RimColor': [*rim, 1],
        },
        'keywordMap': {'MTOON_OUTLINE_COLOR_MIXED': True},
        'tagMap': {'RenderType': 'Opaque'},
    })
    return len(doc['materials']) - 1


def graft_shapes(doc, views, mesh_name, shapes):
    """Write per-primitive shape keys onto a mesh, padding the primitives without.

    Returns the key names in the order they were written.

    glTF's rule is that every primitive of a mesh declares the SAME targets in
    the SAME order, and the outfit shares Body.baked with the body itself and
    with every accessory grafted onto it. So a key that moves only the skirt
    still has to exist on the boots, on the torso and on the waist bow. Those
    get a sparse accessor holding one zero, which is the smallest thing the spec
    allows -- an empty sparse block is invalid.

    The names go in `mesh.extras.targetNames`, which is where glTF puts them and
    where three.js reads `morphTargetDictionary` from. They are deliberately NOT
    added to VRM's blendShapeMaster: that list is the expression system, driven
    by name from the chat widget, and a body-shape slider appearing there would
    read as a face this model can pull.
    """
    mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
    if any(pr.get('targets') for pr in mesh['primitives']):
        raise SystemExit(f'{mesh_name} 已經有 morph target，再加會弄亂既有的順序')
    # A key that moves nothing anywhere is dropped rather than shipped. The
    # vendor's `Side adjustment` is one: it is a named key with every delta at
    # zero, in the FBX itself, so keeping it would advertise a slider that does
    # nothing -- the exact silent no-op this pipeline keeps guarding against.
    effect = {}
    for keys in shapes.values():
        for name, (hit, delta) in keys.items():
            mean = (float(np.linalg.norm(delta, axis=1).mean())
                    if len(hit) else 0.0)
            effect[name] = max(effect.get(name, 0.0), mean)
    weak = sorted((n, e) for n, e in effect.items() if e < SHAPE_KEY_MIN_MEAN)
    if weak:
        print('   丟掉動不了東西的 shape key：' + '，'.join(
            f'{n} 平均 {e * 1000:.2f}mm' for n, e in weak))
    names = sorted(n for n, e in effect.items() if e >= SHAPE_KEY_MIN_MEAN)
    for pi, pr in enumerate(mesh['primitives']):
        count = doc['accessors'][pr['attributes']['POSITION']]['count']
        keys = shapes.get(pi, {})
        pr['targets'] = []
        for name in names:
            hit, delta = keys.get(name, (np.zeros(0, np.int64), np.zeros((0, 3))))
            pr['targets'].append({
                'POSITION': glb.add_sparse_accessor(doc, views, count, hit, delta),
            })
    mesh.setdefault('extras', {})['targetNames'] = names
    return names


def bowl_texture(doc, views, name, size=128, *, mean):
    """The inner ear's own shading, baked: a rim shadow and a soft edge.

    The first version cropped the hair map for its strands. It gave the bowl
    pixels that move, but moving in the wrong way -- vertical strands printed
    flat across a 25mm dish, when what makes a dish read as a dish is the
    crescent of shadow the rim casts across its upper half. That crescent is
    what the reference has and what a flat renderer will never derive on its
    own, so it is painted here.

    Returns (texture index, mean brightness as a fraction of white) so the
    caller can divide its target colour by the mean and have the piece render
    at the colour it asked for.
    """
    y, x = np.mgrid[0:size, 0:size] / (size - 1.0)
    dx, dy = (x - 0.5) * 2.0, (y - 0.5) * 2.0
    r = np.hypot(dx, dy)
    # uv_bowl puts the bowl's top at row 0, so the rim shadow lives there.
    rim = np.clip((0.42 - y) / 0.42, 0.0, 1.0) ** 1.4
    edge = np.clip((r - 0.55) / 0.45, 0.0, 1.0) ** 1.6
    strand = 0.030 * np.sin(x * np.pi * 7.0) * np.clip(1.0 - r, 0.0, 1.0)
    a = np.clip(1.0 - 0.46 * rim - 0.24 * edge + strand, 0.0, 1.0)
    # 深度先畫足，再整張縮放到 BOWL_MEAN，不是反過來。第一版把深度直接寫死在
    # 係數裡：加深一分，均值就掉一分，呼叫端拿 EAR_INNER 去除均值就會超過 1、
    # 被 glTF 夾掉，於是能畫多深由「不許超過 1」決定，而不是由參考圖的調變量
    # 決定。縮放之後這兩件事分開了——均值固定在這裡，深淺由上面的係數自己說了
    # 算，代價只是最亮的一小塊會頂到白。
    # 用二分找縮放倍率，不是直接除以均值再夾。夾在 1.0 這一步本身會把均值拉
    # 回來，所以「除以均值」得到的成品均值一定小於目標，呼叫端除下去就超過 1
    # ——第一次改深就是這樣讓建置在守衛那裡停掉的。夾完之後的均值對倍率是單
    # 調的，二分四十次即可。
    # 圓盤半徑 0.9 不是 1.0：uv_bowl 把碗鋪成 0.5 ± 0.45 * d/radius，模型讀到的
    # 最外一圈就落在 r = 0.9。用 r <= 1.0 取平均會把外面那一圈從來沒被讀到的暗
    # 邊算進來，均值偏低、呼叫端除出來的係數偏高，成品比 EAR_INNER 指定的顏色
    # 亮 4.3%——docstring 說「取樣區才算」，但當時算的不是取樣區。
    seen = r <= 0.9
    lo_k, hi_k = 0.0, 10.0
    for _ in range(40):
        k = (lo_k + hi_k) / 2.0
        if np.clip(a * k, 0.0, 1.0)[seen].mean() < mean:
            lo_k = k
        else:
            hi_k = k
    a = np.clip(a * k, 0.0, 1.0) * 255.0
    quantised = a.astype(np.uint8).astype(np.float64)
    # The mean is taken over the disc the bowl actually samples, not the whole
    # square, and that disc is r <= 0.9 because that is what uv_bowl reaches.
    # The corners are painted but never read, and letting them into the mean
    # makes the caller divide by a darkness nothing on the model receives.
    # `seen` is set above, where the same disc decides the scale.
    im = Image.fromarray(a.astype(np.uint8), 'L').convert('RGBA')
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=95, method=4)
    doc['images'].append({'name': name, 'mimeType': 'image/webp',
                          'bufferView': glb.add_view(doc, views, buf.getvalue())})
    doc.setdefault('samplers', []).append({'wrapS': 33071, 'wrapT': 33071})
    doc['textures'].append({'sampler': len(doc['samplers']) - 1,
                            'source': len(doc['images']) - 1})
    # 回傳量化後的均值，不是二分求出來的那個目標值。著色器讀到的是 uint8 的
    # 那份，兩者差 0.002；差在安全的方向（回傳偏小 → 係數偏大），但呼叫端拿
    # 它去算「除下去會不會超過 1」，那個判斷該用著色器真正會讀到的數。
    return len(doc['textures']) - 1, float(quantised[seen].mean() / 255.0)


def ramp_texture(doc, views, name, lo, hi, height=64, gamma=1.0):
    """A one-dimensional dark-to-light ramp, as its own texture.

    Same reason as bowl_texture: the colour stays in the factor so the manifest
    keeps telling the truth about what a swap tool can set, and the texture
    carries nothing but shading.

    `gamma` below 1 bends the ramp towards its bright end. That is not a
    cosmetic knob: the factor is the palette colour divided by this image's
    mean, and glTF clamps a factor above 1, so widening the ramp by lowering
    `lo` alone drags the mean under the palette's brightest channel and the
    colour silently goes dark. Bending the curve buys the same tonal range back
    at an unchanged mean -- 0.60..1.0 at gamma 0.45 has the same mean as
    0.78..1.0 straight, and nearly twice the swing between a lit facet and a
    turned-away one.
    """
    v = (lo + (hi - lo) * np.linspace(0.0, 1.0, height) ** gamma)[:, None]
    a = np.repeat(np.clip(v * 255.0, 0, 255), 8, axis=1)
    im = Image.fromarray(a.astype(np.uint8), 'L').convert('RGBA')
    buf = io.BytesIO()
    im.save(buf, format='WEBP', quality=95, method=4)
    doc['images'].append({'name': name, 'mimeType': 'image/webp',
                          'bufferView': glb.add_view(doc, views, buf.getvalue())})
    doc.setdefault('samplers', []).append({'wrapS': 33071, 'wrapT': 33071})
    doc['textures'].append({'sampler': len(doc['samplers']) - 1,
                            'source': len(doc['images']) - 1})
    return len(doc['textures']) - 1, float(a.mean() / 255.0)


def sink(pieces, surface, embed=0.006, radius=0.020, limit=0.032):
    """Drop an accessory onto the hair it rests on, as one rigid move.

    Placed at a fixed height a crown floats. The skull is not flat, so its rim
    stands clear at some azimuths, and what shows in the gap is the open
    underside of the band, which is the one thing that says "not attached" at a
    glance. The gap that first motivated this ran 2.7mm to 27.9mm with a median
    of 12.9mm; the build prints the drop it actually measures on each run, so
    read that line rather than this sentence for the current number.

    The whole piece translates; the first version moved the low vertices only
    and that stretched the band 29mm taller, turning a crown into a bucket. The
    fall is the median gap over the lowest ring, so one rim point sitting over a
    parting cannot drive it, and `limit` caps it so a bad surface read cannot
    bury the spikes. Every piece in `pieces` gets the same translation, which is
    what keeps the two shells of the band aligned.
    """
    pos = np.concatenate([p['pos'] for p in pieces])
    rim = pos[pos[:, 1] < pos[:, 1].min() + 0.008]
    gaps = []
    for v in rim:
        near = surface[(np.abs(surface[:, 0] - v[0]) < radius)
                       & (np.abs(surface[:, 2] - v[2]) < radius)]
        if len(near) >= 4:
            gaps.append(v[1] - (float(np.percentile(near[:, 1], 90)) - embed))
    if not gaps:
        return pieces, 0.0
    fall = float(np.clip(np.median(gaps), 0.0, limit))
    return ([dict(p, pos=p['pos'] - np.array([0.0, fall, 0.0])) for p in pieces],
            fall)


# Where the waist is looked for, and how finely, as fractions of the body's own
# hips→shoulder span. They were absolute heights (search 0.88 to 1.16 in 1cm
# steps, averaging over a 12mm slab) until 2026-09-07, read once off this VRoid
# body. On a body 20% shorter the real waist sits at 0.768, below the bottom of
# that band, and the search returned 1.020 — a height on the chest — without
# failing: the narrowest slice that happened to fall inside a band the body had
# outgrown. Both a 0.8x and a 1.25x body returned the same 1.020
# (evidence/scale-0907.log), which is the signature of an answer that came from
# the constant rather than from the body.
#
# The fractions are the old band expressed against this body's span, so its
# sample grid is unchanged to 0.2µm and every other body gets the same grid
# relative to its own hips and shoulder.
WAIST_SEARCH = {
    'from': 0.005219,   # just above the hips joint
    'to': 0.836402,     # short of the shoulder, above every waist
    'step': 0.029685,   # one sample per 1cm on this body
    'slab': 0.035622,   # the half-thickness each sample averages over
}


def landmarks(pool, doc):
    """Body heights this outfit is measured against: the waist and the foot are
    found from the mesh, the joint heights from the skeleton's rest pose.

    The joint heights were typed in as world numbers (`hip, knee, ankle =
    0.843, 0.501, 0.118`, `arm_r = 0.54`) until 2026-09-05, read once off this
    one VRoid body and never off the file; a second body would have had its
    socks cut at another body's ankle. They are the left side's; the right
    side is its mirror on every body this pipeline accepts.
    """
    p = pool['pos']
    world, bones = humanoid.rest_world(doc), humanoid.bones(doc)
    hips_y = float(world[bones['hips']][1, 3])
    span = float(world[bones['leftUpperArm']][1, 3]) - hips_y
    w = WAIST_SEARCH
    torso = [(y, np.percentile(np.hypot(p[m][:, 0], p[m][:, 2]), 85))
             for y in np.arange(hips_y + span * w['from'], hips_y + span * w['to'],
                                span * w['step'])
             if (m := np.abs(p[:, 1] - y) < span * w['slab']).sum() > 12]
    if not torso:
        raise SystemExit(
            '在 hips 與 shoulder 之間找不到任何有足夠頂點的水平切片，量不出腰線')
    waist_y = min(torso, key=lambda t: t[1])[0]

    def at(bone):
        return world[bones[bone]][:3, 3]
    return {
        'waist': waist_y,
        'waist_r': dict(torso)[waist_y],
        'foot': p[:, 1].min(),
        'hip': float(at('leftUpperLeg')[1]),
        'knee': float(at('leftLowerLeg')[1]),
        'ankle': float(at('leftFoot')[1]),
        'shoulder': float(at('leftUpperArm')[1]),
        'neck': float(at('neck')[1]),
        'hand_x': float(abs(at('leftHand')[0])),
    }


# Where the three torso edges of the hand-modelled outfit sit, as fractions of
# the waist→shoulder span. They were absolute heights (1.181, 1.168, 1.155)
# until 2026-09-07, read once off this VRoid body: on a longer torso the
# bandeau would have kept its height while the ribs it is supposed to cover
# moved, and the sleeve would have started somewhere else on the arm. The
# fractions are where those edges sit on the body the outfit was drawn against,
# and on that body they reproduce the old heights to within 0.1mm — the three
# vertex masks come out identical.
# The five below joined them on 2026-09-11 and are the last absolute heights
# build() had. They were invisible to the constant inventory in
# docs/plans/avatar-build-module-contracts.md because a number typed inside a
# function is not a constant; the thigh bandage's height sat two lines above two
# siblings that already derived from the ankle and the knee.
# Same bar as the first three: on this body they reproduce the old heights to
# within 0.0035mm, the worst of them the topmost button's.
TORSO_EDGES = {
    'bandeau_top': 0.866,   # the bandeau's upper edge, at the frill's own height
    'strap_bottom': 0.815,  # where the shoulder straps come off the trapezius
    'sleeve_bottom': 0.764, # the cardigan sleeve's lower edge on the upper arm
    'bust_frill': 0.8467,   # the camisole's own frill, above the cardigan line
    'chest_probe': 0.2352,  # the height the buttons' depth is read at
    'button_low': -0.0588,  # the three front buttons, 60mm apart on this body
    'button_mid': 0.1764,
    'button_high': 0.4116,
}

# The one height on the legs rather than the torso. Its two siblings already read
# `ankle + (knee - ankle) * 0.38` and `ankle + 0.030`, so this is the shape the
# rest of that block was already written in.
LEG_EDGES = {
    'thigh_band': 0.4411,   # the bandage, on bare thigh below the skirt's hem
}


def torso_edges(lm):
    """The heights in TORSO_EDGES for one body, from its own waist and shoulder."""
    span = lm['shoulder'] - lm['waist']
    return {name: lm['waist'] + span * f for name, f in TORSO_EDGES.items()}


def leg_edges(lm):
    """The heights in LEG_EDGES for one body, from its own knee and hip."""
    span = lm['hip'] - lm['knee']
    return {name: lm['knee'] + span * f for name, f in LEG_EDGES.items()}


def body_hair_materials(doc, known):
    """The body's own hair materials, the one covering most triangles first.

    VRoid spells them one way on this export and another on the next one, so
    the names cannot be written down; what is stable is
    where they are used, which is the primitives the partition labelled `Hair_*`.
    Ordering by triangles rather than by name is what makes the first entry mean
    something: on this body the back hair's material covers 10020 triangles and
    the next covers 1122, so "the hair material" is not a close call.

    `known` is the set of material names the body already had. The head
    accessories this build adds are hair parts too and the inner ear brings its
    own material, so without it a material this build authored would come back
    as one of the body's.

    Two uses, and both would be a typed-in name otherwise. The head accessories
    reuse the first so the hair's hue rotation reaches them and they get strand
    shading. All of them are skipped when the outline is recoloured, because the
    hair's line is black and stays black: black is not a paler version of a hue,
    and rotating it toward the skin would just make it brown.
    """
    tris = {}
    for mesh in doc['meshes']:
        for pr in mesh['primitives']:
            label = (pr.get('extras') or {}).get('part') or ''
            if not label.startswith('Hair_'):
                continue
            name = doc['materials'][pr['material']]['name']
            if name not in known:
                continue
            tris[name] = tris.get(name, 0) + doc['accessors'][pr['indices']]['count'] // 3
    return sorted(tris, key=lambda n: (-tris[n], n))


def outfit_files(dst, outfit_pack):
    """Which of the package's converted files are actually beside `dst`.

    A package declares what it ships; the build converts what Blender produced.
    Missing ones are skipped rather than raised on, because the hand-built
    garments stand in for the import and a machine without Blender still has to
    produce a body. Its own function so that swapping the package can be checked
    without running a build.
    """
    paths = [os.path.join(os.path.dirname(dst), f) for f in outfit_pack.FILES]
    return [f for f in paths if os.path.exists(f)]


def build(src, dst, manifest_path, out_manifest, character=mika,
          outfit_pack=mellowheart, base_body=mika_base):
    """Dress one body in one character's look, wearing one outfit package.

    `character` is a module in characters/ holding every value that is hers
    rather than this file's: the palette, the colours solved off her reference
    sheets, the head accessories and the hand-built garment list.

    `outfit_pack` is a module in outfits/ holding the imported package: its
    files, its bonemap, the vendor's mesh and material names, and under FIT the
    clearances that are that package on this body. It is not called `outfit`
    because this file already imports a module of that name, and shadowing it
    inside build() would be a rename nobody asked for.

    `base_body` is a module in bodies/ holding what the export's own art already
    contains, which the build has to read rather than choose: where the scalp
    cap VRoid painted into the face atlas sits on the hue circle, and how far
    its anti-aliased edge walks before it is skin.

    Both default so every existing caller keeps working; passing another one is
    the whole point, and it is what the module-contract tests exercise.
    """
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    manifest = json.load(open(manifest_path))

    # 背面的長髮要分成兩束，但要等外套穿好之後（見下方 twintail.apply 的呼叫）：
    # 馬尾掛在外套外面，軸線與彈簧的 collider 都是從外套貼合後的外殼推導的。
    # 之後任何從頭髮頂點讀座標的程式碼都要看到分好的版本；目前只有頭飾那段
    # （crown_y 讀 Hair_Back），它在更後面。
    # Which materials the BODY brought, before this build adds any. hair_materials
    # needs it to tell the body's hair from a material this build put on a hair
    # part, and there is no later moment where the two are still separable.
    body_materials = {m['name'] for m in doc['materials']}
    hair_mats = body_hair_materials(doc, body_materials)
    if not hair_mats:
        raise SystemExit('找不到任何 Hair_* 部件的材質：這具身體沒有經過 partition，'
                         '或它的頭髮不叫 Hair_*')

    # Derived once, here, from the character this build is dressing: `outline`
    # needs this file's chroma cap as well as her skin, so neither it nor the
    # rim can sit in characters/ as a written-down number.
    outline = outline_colour(character)
    rim = character.RIM_COLOR
    mats = {n: add_material(doc, n, b, s, outline=outline, rim=rim)
            for n, (b, s) in character.PALETTE.items()}
    paint = character.MATERIALS
    pool = garment.body_pool(doc, views, manifest, 'Body_Skin')
    lm = landmarks(pool, doc)
    p, added = pool['pos'], {}

    # The body's skin, by the node that draws the body mesh. VRoid puts it on
    # skin 1 of three that list the same joints; the first is the face's.
    skin = doc['skins'][humanoid.body_skin(doc, manifest)]
    bones = humanoid.bones(doc)

    hip, knee, ankle = lm['hip'], lm['knee'], lm['ankle']
    arm_r = lm['hand_x']                           # hand x at rest, both sides
    # The skirt's fade band, read here because every draped part fades over
    # it -- the vendor's skirt included, exactly as the hand-built one did.
    waist_y, hem_y = lm['waist'] - 0.02, hip - (hip - knee) * 0.34
    ctx = binding.context(doc, pool, manifest, lm, drape=(waist_y, hem_y))
    bindings = {}

    mellow_files = outfit_files(dst, outfit_pack)
    mellow = bool(mellow_files)

    def put(piece, material, name, mesh='Body.baked', tag=None,
            bind='auto', origin='param', smooth=0):
        """Skin a piece and write it into the file as part `name`.

        The one place a piece gets its weights. `bind` is 'auto' -- the
        chooser reads the piece (binding.decide) -- or a Decision the caller
        made, for a part whose primitives were decided together (the vendor
        loop) or an override with its reason. `origin` says where the piece
        came from: 'shell' keeps the rows it was shelled with, everything
        else is measured. The decision lands in the manifest under the part.
        Returns None when a hand-built garment yields to the imported one.
        """
        if mellow and name in character.HAND_GARMENTS and origin != 'vendor':
            return None
        sig = binding.signals(ctx, [piece])
        decision = binding.choose(ctx, sig, origin, smooth) if bind == 'auto' else bind
        bound = binding.apply(ctx, dict(piece), decision, mesh)
        at = garment.attach(doc, views, mesh, bound,
                            material if isinstance(material, int) else mats[material],
                            name)
        added[tag or name] = (len(bound['tris']), mesh)
        prior = bindings.get(name)
        if prior is None:
            bindings[name] = decision
        elif (prior['strategy'], prior.get('smooth')) != (decision['strategy'], decision.get('smooth')):
            raise SystemExit(f'{name} 的兩個 primitive 綁定策略不同：'
                             f'{prior["strategy"]} 與 {decision["strategy"]}')
        return {'index': at, 'piece': bound, 'signals': sig, 'decision': decision}

    # --- top: a bandeau, not a vest. Its upper edge stops at the frill's own
    #     height, which is what makes the frill read as the top of a garment
    #     rather than a white plank laid across the chest. Running the cloth up
    #     to the collarbone instead left the frill trapped between two white
    #     surfaces with nothing to be the edge of. ---
    edge = torso_edges(lm)
    leg = leg_edges(lm)
    torso = (p[:, 1] < edge['bandeau_top']) & (p[:, 1] > lm['waist'] - 0.055) & (np.abs(p[:, 0]) < 0.105)
    # Two straps over the shoulders, part of the top rather than a separate
    # accessory: the reference shows them crossing the bare shoulder ABOVE the
    # cardigan, which is the detail that makes the cardigan read as worn off the
    # shoulder instead of merely starting low. They are shelled off the body in
    # the same pass as the bodice so they wrap the trapezius instead of floating
    # over it, and they are 36mm wide, which is the width the sheet shows
    # against a 210mm shoulder span.
    # Their top is the neck joint: the strap ends where the trapezius does, and
    # on this body that is 2.2mm below the 1.252 it used to say, a gap holding
    # no vertex at all.
    strap = ((p[:, 1] > edge['strap_bottom']) & (p[:, 1] < lm['neck'])
             & (np.abs(p[:, 0]) > 0.052) & (np.abs(p[:, 0]) < 0.088))
    put(garment.shell(pool, torso | strap, 0.012), paint['cloth'], 'Outfit_Top',
        origin='shell')

    # --- cardigan: off the shoulder. Three things make that read, and all three
    #     are subtractions: it starts below the shoulder line, it leaves the
    #     front centre open, and the sleeve begins out on the upper arm rather
    #     than at the joint. The offset is the thickness of the knit: too thin
    #     and a turning shoulder comes up through the sleeve's top edge, too
    #     thick and the sleeve is a black rod round a 30mm arm. ---
    shoulder_top = lm['shoulder']                  # the upper-arm joint's height
    wrist = arm_r * 0.84                           # stop before the hand
    sleeve = ((np.abs(p[:, 0]) > 0.105) & (np.abs(p[:, 0]) < wrist)
              & (p[:, 1] > edge['sleeve_bottom']) & (p[:, 1] < shoulder_top + 0.02))
    torso_back = ((p[:, 1] < shoulder_top - 0.045) & (p[:, 1] > lm['waist'] - 0.105)
                  & (np.abs(p[:, 0]) < 0.155)
                  & ~((p[:, 2] < -0.015) & (np.abs(p[:, 0]) < 0.052)))
    cardigan = garment.shell(pool, sleeve | torso_back, 0.021)
    put(cardigan, paint['cardigan'], 'Outfit_Cardigan', origin='shell')

    # 前襟上的三顆鈕扣，位置從外套自己的頂點讀出來，不是猜的。第一次用固定
    # 座標 z=-0.108，結果整排被抹胸擋住：抹胸的前表面在 z=-0.123，比外套還
    # 前面，鈕扣就埋在兩層布中間了。
    cp = cardigan['pos']
    buttons = []
    near_chest = int(np.argmin(np.abs(p[:, 1] - edge['chest_probe'])))
    for y in (edge['button_low'], edge['button_mid'], edge['button_high']):
        band = cp[(np.abs(cp[:, 1] - y) < 0.022) & (cp[:, 0] < -0.020)
                  & (cp[:, 0] > -0.080) & (cp[:, 2] < 0)]
        if not len(band):
            continue
        # Not `edge`: that name already holds torso_edges(lm) for the whole of
        # build(), and rebinding it here to a vertex made every later reader of
        # a torso edge a time bomb. The bust frill three hundred lines down was
        # the one that went off.
        front = band[int(np.argmin(band[:, 2]))]
        buttons.append(garment.sphere(
            [float(front[0]), y, float(front[2]) - 0.005], 0.0070,
            pool['joints'][near_chest], pool['weights'][near_chest],
            lat=5, lon=8, squash=(1.0, 1.0, 0.55)))
    if buttons:
        put(garment.merge(buttons), paint['bear'], 'Acc_Buttons')

    # --- neck frill and its ribbon, and the sash bow at the waist. These two
    #     carry most of the character's read at a glance. ---
    # The collar sits 7mm below the neck joint: on the reference the lace
    # rides the base of the neck, and the joint is at the top of the trapezius.
    neck_y = lm['neck'] - 0.007
    near_neck = int(np.argmin(np.abs(p[:, 1] - neck_y)))
    put(garment.collar(pool, neck_y - 0.014, 0.026, 0.62), paint['cloth'], 'Acc_Collar')
    # 頸部黑緞帶改由 Blender 生成，見 blender/neckribbon.py。參數化版本把蝴蝶結
    # 放在 y=1.19 的胸口，參考圖是繫在領口白色蕾絲上，兩者讀起來是不同的東西。

    # 腰間的薄荷緞帶在 blender/bow.py：兩片錐形的環、一個結、兩條放樣的帶尾。
    # 這裡走過兩次錯路，成因相同——這個算圖器不打光，讀得到的只有輪廓。參數化
    # 版本是兩顆壓扁的球；改成沿封閉路徑放樣的緞帶環之後，帶子寬過環圍出來的
    # 洞，洞閉起來又變回兩顆球。錐形是有腰身的，掐緊的那一端在輪廓上就看得見。
    bl_dir = os.path.join(os.path.dirname(dst), 'blender')
    bow_pos = []
    for stem, material, part_name, split in character.BLENDER_PARTS:
        path = os.path.join(bl_dir, f'{stem}.glb')
        piece = weld.part(path, skip=tuple(split))
        if piece is None:
            continue
        put(piece, material, part_name, origin='blender')
        if part_name == 'Acc_Ribbon_Waist':
            bow_pos.append(piece['pos'])
        for sub_name, (sub_material, tag) in split.items():
            sub = weld.part(path, only=(sub_name,))
            put(sub, sub_material, part_name, tag=tag, origin='blender')
            if part_name == 'Acc_Ribbon_Waist':
                bow_pos.append(sub['pos'])

    # --- bottom: flared skirt off the waist, hem between hip and knee, and the
    #     ruffle that hangs off it. The reference's hem is gathered cloth, and a
    #     plain cone reads as a costume prop next to it. ---
    env = envelope.load(os.path.join(os.path.dirname(dst), 'leg-envelope.json'))
    hem = garment.skirt(pool, waist_y, hem_y, flare=1.25, clear=(0.018, 0.006),
                        envelope=lambda y: envelope.radii_at(env, y))
    # Both drape (binding._drape): a ring round both legs below the crotch,
    # which the chooser reads off the geometry. The rigid and the two-leg
    # bindings that this fade replaced are told in that docstring.
    put(hem, paint['cloth'], 'Outfit_Bottom')
    put(garment.frill(hem['hem'], depth=0.034, waves=15), paint['cloth'], 'Acc_Frill_Hem')

    # --- the camisole's own frill, across the bust above the cardigan line ---
    put(garment.frill(garment.ring_at(pool, edge['bust_frill'],
                                      max_radius=0.135, clear=0.017),
                      depth=0.024, waves=11, amplitude=0.006, flare=0.10),
        paint['cloth'], 'Acc_Frill_Bust')

    # --- socks. The goal names an Outfit_Socks slot with the cuff above the
    #     knee, and the reference sheet disagrees with it: a vertical scan down
    #     the front figure's leg from the shorts hem at y=590 to the slipper at
    #     y=900 is one continuous skin tone with no cuff edge anywhere. Both are
    #     served by building the slot and letting it be deleted -- that is what a
    #     part template is for -- so the sock is here, sized off the leg, and
    #     listed as deletable like every other garment.
    #
    #     Sized from the leg's own rings rather than a cylinder: a VRoid calf is
    #     nowhere near round, and an offset shell follows the ankle taper that a
    #     tube cannot. The cuff sits 40mm above the knee joint, which is what
    #     "over the knee" means on a leg this length.
    cuff_y = knee + 0.040
    socks = ((p[:, 1] < cuff_y) & (p[:, 1] > ankle - 0.010))
    put(garment.shell(pool, socks, 0.006), paint['sock'], 'Outfit_Socks', origin='shell')

    # --- slippers: a rounded shell over each foot, plus two ears ---
    feet = p[:, 1] < ankle + 0.035
    shoes = [garment.shell(pool, feet, 0.014)]
    # Each ear is placed on its OWN slipper and weighted to that foot. Fixed
    # coordinates put all four at one height beside the ankles, 19mm clear of the
    # shoe, and bound every one of them to a single vertex: they rendered as four
    # loose balls floating next to the left leg and followed it around.
    for sx in (-1, 1):
        idx = np.where(feet & (np.sign(p[:, 0]) == sx))[0]
        top = float(p[idx][:, 1].max())
        near = idx[int(np.argmin(np.abs(p[idx][:, 1] - top)))]
        cx = float(np.median(p[idx][:, 0]))
        cz = float(np.median(p[idx][:, 2]))
        for ex in (-0.016, 0.016):
            shoes.append(garment.sphere(
                [cx + ex, top + 0.009, cz - 0.012], 0.013,
                pool['joints'][near], pool['weights'][near], lat=6, lon=8))
    # A shell with two spheres riding on it: the spheres carry the rows of the
    # foot vertex they sit over, so the whole piece keeps what it was built
    # with, like the shell it mostly is.
    put(garment.merge(shoes), paint['bear'], 'Outfit_Shoes', origin='shell')

    # 拖鞋的熊臉。兩顆眼睛與一個鼻子，貼在鞋頭外表面上。
    face_bits = []
    for sx in (-1, 1):
        cx = sx * 0.045
        for ex in (-0.017, 0.017):
            face_bits.append(garment.sphere(
                [cx + ex, 0.066, -0.128], 0.0055,
                pool['joints'][np.argmin(np.abs(p[:, 1] - ankle))],
                pool['weights'][np.argmin(np.abs(p[:, 1] - ankle))], lat=5, lon=8))
        face_bits.append(garment.sphere(
            [cx, 0.052, -0.132], 0.0065,
            pool['joints'][np.argmin(np.abs(p[:, 1] - ankle))],
            pool['weights'][np.argmin(np.abs(p[:, 1] - ankle))],
            lat=5, lon=8, squash=(1.4, 0.9, 0.8)))
    put(garment.merge(face_bits), paint['ribbon'], 'Acc_Bear_Face')

    # --- bandages. Three of them, asymmetric, as the reference wears them: one
    #     high on the left thigh, one up the right shin, one at the left ankle.
    #     Mirroring any of them would be wrong. ---
    def wrap(name, y, side, half_height, thickness=0.012):
        """A band round one limb, sized by everything it has to cover.

        Both earlier versions sized it from a single ring of the mesh, and both
        failed the same way. A VRoid shin carries its rings 40mm apart and some
        of them are five vertices of a UV island: the calf wrap came out 37mm
        too small and vanished inside the leg from every angle but the front.
        Measuring across the tube's whole height cannot miss the leg, and taking
        the widest radius in each half keeps the taper without letting either end
        end up inside.

        The offset is 12mm, not the 5mm that looks right on a bare leg: the sock
        is a 6mm shell over the same limb, and at 5mm the calf and ankle wraps
        ended up inside it -- present in the file, invisible in every view.

        The centre is one median for the whole span, not one per end. Measuring
        each end separately sounds better and is not: the nearest rings to the
        two ends can sit 40mm apart with different centres, and the wrap came out
        as a wedge leaning off the shin.
        """
        on = np.sign(p[:, 0]) == side
        span = on & (np.abs(p[:, 1] - y) < half_height + 0.012)
        leg = p[span]
        cx, cz = float(np.median(leg[:, 0])), float(np.median(leg[:, 2]))
        radius = np.hypot(leg[:, 0] - cx, leg[:, 2] - cz)
        lower = leg[:, 1] <= y
        r0 = float(radius[lower].max()) if lower.any() else float(radius.max())
        r1 = float(radius[~lower].max()) if (~lower).any() else float(radius.max())

        near = int(np.argmin(np.abs(p[:, 1] - y) + np.abs(p[:, 0] - cx) * 3))
        put(garment.tube([cx, y - half_height, cz], [cx, y + half_height, cz],
                         r0 + thickness, r1 + thickness,
                         pool['joints'][near], pool['weights'][near],
                         segments=24, rings=3),
            paint['bandage'], name)

    wrap('Acc_Bandage_Thigh', leg['thigh_band'], -1, 0.032)
    wrap('Acc_Bandage_Calf', ankle + (knee - ankle) * 0.38, 1, 0.046)
    wrap('Acc_Bandage_Ankle', ankle + 0.030, -1, 0.018)

    # --- the imported outfit. Everything it needs was measured off the two
    #     files; see outfit.py for why it is a global fit plus a per-bone
    #     correction rather than a single transform. ---
    coat_pos = []
    if mellow:
        pushed = {}
        belt_pos = []
        # part name -> {key: (vertex indices, deltas)}, filled as each garment
        # settles. Written into the mesh after the loop, because glTF wants
        # every primitive of a mesh to declare the same targets and that is only
        # knowable once every garment has been through.
        shapes = {}

        def settle(piece, clear, shift, loosen_amount, standoff_amount):
            """Run the whole placement chain on a copy, return the positions.

            The chain is shift, then hug, then loosen, then standoff; everything
            after it -- bind, drape -- assigns weights and moves nothing. It is
            a function rather than four inline statements so that the one thing
            which must NOT go through it, the shape key deltas below, is visibly
            not going through it.
            """
            work = dict(piece)
            work['pos'] = np.array(piece['pos'])
            if shift:
                work['pos'][:, 1] += shift
            moved = outfit.hug(work, pool['pos'], pool['nrm'], clear)
            if loosen_amount is not None:
                outfit.loosen(work, loosen_amount)
            if standoff_amount is not None:
                outfit.standoff(work, standoff_amount)
            return work['pos'], moved

        for path in mellow_files:
            # outfit.load calls this back for every imported material, and
            # add_material's outline and rim are keyword-only with no default
            # precisely so that binding them is a decision somebody made rather
            # than a global it happened to read.
            wear = functools.partial(add_material, outline=outline, rim=rim)
            bundle = outfit.load(path, doc, views, wear, outfit_pack.TINT,
                                 outfit_pack.GAIN, override=outfit_pack.BONEMAP)
            turned = sorted(bundle['snames'][i] for i, (rot, _, _) in bundle['correction'].items()
                            if i in bundle['mapped'] and rot is not None)
            print(f'   服裝擬合 {os.path.basename(path)}：縮放 x{bundle["scale"]:.3f}，'
                  f'yaw {bundle["yaw_deg"]:.2f}°，'
                  f'對位骨最大殘差 {bundle["residual_mm"]:.2f}mm，'
                  f'錨點 {len(bundle["mapping"]["pairs"])} 根，'
                  f'轉向 {len(turned)} 根' + (f'（{"、".join(turned)}）' if turned else ''))
            print(bonemap.table(bundle['mapping'], bundle['src']))
            items = outfit.pieces(bundle, doc, views)
            accepted = []
            for item in items:
                spec = outfit_pack.PARTS.get(item['name'])
                if spec is None:
                    continue
                name, clear = spec
                shift = outfit_pack.SHIFT.get(name, 0.0)
                loosen_amount = outfit_pack.LOOSEN.get(name)
                standoff_amount = outfit_pack.STANDOFF.get(name)
                settled, moved = settle(item['piece'], clear, shift,
                                        loosen_amount, standoff_amount)
                item['piece']['pos'] = settled
                pushed[name] = max(pushed.get(name, 0.0), moved)
                accepted.append((item, name))

            accepted_items = [item for item, _ in accepted]
            band_part = outfit_pack.THIGH_BAND_PART
            if any(item['name'] == band_part for item in accepted_items):
                band_name, band_clear = outfit_pack.PARTS[band_part]
                band_scale, _, _, thigh_diameter = outfit.fit_ring_to_limb(
                    accepted_items,
                    pool['pos'],
                    bundle['src']['materials'],
                    band_part,
                    outfit_pack.THIGH_BAND_SOURCE_MATERIAL,
                    0.0,
                    band_clear,
                )
                print('   大腿腿帶截面縮放 '
                      f'x={band_scale[0]:.3f} z={band_scale[1]:.3f}，'
                      f'大腿直徑 {thigh_diameter[0] * 1000:.0f}x'
                      f'{thigh_diameter[1] * 1000:.0f}mm')
                for band_item in accepted_items:
                    if band_item['name'] != band_part:
                        continue
                    final_move = outfit.hug(
                        band_item['piece'], pool['pos'], pool['nrm'],
                        outfit_pack.THIGH_BAND_FINAL_CLEARANCE)
                    pushed[band_name] = max(pushed.get(band_name, 0.0), final_move)

            # Re-bound to this body's own weights, and the skirt draped on top
            # of that, exactly as the hand-built one was. The vendor's rig is
            # discarded here on purpose: it is correct for Milfy and wrong for
            # this body, and the failure it causes is invisible at rest. One
            # decision per part, measured on all of its primitives together
            # (the skirt's upper half on its own stops at the hip joint), and
            # the bodice garments diffused because the nearest-vertex copy
            # tears at the armpit and the elbow (outfit_pack.BIND_SMOOTH).
            by_part = {}
            for item, name in accepted:
                by_part.setdefault(name, []).append(item['piece'])
            decisions = {name: binding.decide(ctx, pieces, 'vendor',
                                              outfit_pack.BIND_SMOOTH.get(name, 0))
                         for name, pieces in by_part.items()}

            for item, name in accepted:

                # The vendor's shape keys ride ON TOP of the settled garment,
                # as the displacement fields they are. Re-settling the keyed
                # shape and subtracting was tried first and tears the mesh: hug
                # is discontinuous -- `max(margin - gap, 0)` behind a normal-
                # agreement gate -- so a vertex that flips from "clear" to
                # "pushed" jumps by the whole margin while its neighbours do
                # not, and the difference of two hugs is a field full of spikes.
                # It showed as long thin triangles fanning off the neck ribbon
                # under Breast_small, and numerically as a 7.41mm maximum on a
                # key whose mean was 0.23mm.
                keyed_deltas = {}
                for key, delta in item.get('targets', {}).items():
                    hit = np.flatnonzero(
                        np.abs(delta).max(axis=1) > glb.MORPH_EPSILON)
                    keyed_deltas[key] = (hit, delta[hit])
                r = put(item['piece'], bundle['materials'][item['material']], name,
                        tag=f'{name}#{item["prim"]}', bind=decisions[name],
                        origin='vendor')
                bound = r['piece']
                if name == 'Acc_Belt_Waist':
                    belt_pos.append(bound['pos'])
                if name == 'Outfit_Cardigan':
                    # 只留軀幹片：權重主要落在手臂／肩／手的是袖子。T-pose 的
                    # 袖口在馬尾經過肩膀的方位角上伸到半徑 0.22-0.27，瀏覽器裡
                    # 那截袖子卻是垂在身側的，算進輪廓會把馬尾第一節頂到 40cm 外。
                    # 讀的是平滑前的最近頂點主導骨（binding.signals 的 lead_slot）：
                    # 平滑會把肩袖交界一圈頂點的主導骨換邊，輪廓跟著變，雙馬尾
                    # 軸線因此移了 15mm，貼頭層有一個頂點落進 20mm 帶內
                    # （appearance_test 抓到）。馬尾掛在外套上的位置不該隨綁定
                    # 的平滑程度變。
                    lead = r['signals']['lead_slot']
                    lead_name = np.array([doc['nodes'][skin['joints'][j]].get('name', '')
                                          for j in lead])
                    torso = np.array([not any(k in n for k in ('Arm', 'Hand', 'Shoulder'))
                                      for n in lead_name])
                    coat_pos.append(bound['pos'][torso])
                if keyed_deltas:
                    shapes[r['index']] = keyed_deltas
        print('   貼身外推最大位移：' + '，'.join(
            f'{k} {v * 1000:.0f}mm' for k, v in sorted(pushed.items())))
        # 蝴蝶結是唯一一個「戴在別的衣服上」的部件，它的 z 寫在 blender/bow.py
        # 的 OUTLINE 裡，而 OUTLINE 是量出來的常數。衣服一改，那個常數就過期，
        # 而四個約定機位都看不出來——實際發生過：整組蝴蝶結離腰封 27mm，正面
        # 看毫無異狀，側面才看得到。所以這裡拿完成後的衣面重量一次。
        if bow_pos and belt_pos:
            bow = np.concatenate(bow_pos)
            belt = np.concatenate(belt_pos)
            # 只量腰封高度那一段，不是整組。整組取最小值會被垂到裙擺的帶尾
            # 掩蓋：帶尾總有一點貼著裙子，於是「環與結浮在腰封前方」這個真正
            # 的缺陷永遠測不到。第 8 項要的是「繫在腰封上」，量的就該是繫的
            # 那一段。
            lo, hi = belt[:, 1].min(), belt[:, 1].max()
            tied = bow[(bow[:, 1] >= lo) & (bow[:, 1] <= hi)]
            # 沒有任何一點落在腰封高度帶時，下面的 min() 會對空陣列丟
            # numpy 的 ValueError，正好在這道守衛最該說話的時候把它變成一個
            # 看不出原因的崩潰。距離量不出來本身就是它要報的事：緞帶離腰封
            # 遠到兩者高度不重疊。（2026-09-07 在 1.25 倍身體上撞到，
            # evidence/scale-0907-build.log。）
            if not len(tied):
                raise SystemExit(
                    f'蝴蝶結沒有任何頂點落在腰封的高度帶 {lo:.3f}–{hi:.3f}，'
                    f'它自己在 {bow[:, 1].min():.3f}–{bow[:, 1].max():.3f}：'
                    'blender/bow.py 的 OUTLINE 與現在的衣服對不上了')
            near = cKDTree(belt).query(tied, k=1)[0].min() * 1000.0
            print(f'   蝴蝶結對腰封最近距離 {near:.0f}mm')
            if near > BOW_GAP_MAX:
                raise SystemExit(
                    f'蝴蝶結離腰封 {near:.0f}mm，超過 {BOW_GAP_MAX:.0f}mm：'
                    'blender/bow.py 的 OUTLINE 與現在的衣服對不上了')

        if shapes:
            names = graft_shapes(doc, views, 'Body.baked', shapes)
            moved = {k: [0, 0.0] for k in names}
            for keys in shapes.values():
                for k, (hit, delta) in keys.items():
                    if k not in moved:
                        continue
                    moved[k][0] += len(hit)
                    if len(delta):
                        moved[k][1] += float(np.linalg.norm(delta, axis=1).sum()) * 1000.0
            # Mean over the vertices it moves, not the maximum. A maximum is
            # one vertex and flatters a key that barely moves: Waist_slim's
            # 14,393 moved vertices average 0.56mm and peak at 2.01mm, and it is
            # the 0.56 that says a waist slider does almost nothing on this
            # body while the 2.01 suggests it does something. A key usually
            # lands on several garments, so the norms and the counts are summed
            # separately and divided once here -- a max over the per-garment
            # means would be neither statistic, printed under the word 平均.
            print('   服裝 shape key：' + '，'.join(
                f'{k} {moved[k][0]} 點/平均 '
                f'{(moved[k][1] / moved[k][0]) if moved[k][0] else 0.0:.1f}mm'
                for k in names))

    # --- the twintails, now that the coat they hang over has settled. ---
    coat = np.concatenate(coat_pos) if coat_pos else None
    tails = twintail.apply(doc, views, manifest['parts'], pool['pos'], coat_pos=coat)
    for name, r in tails.items():
        w = r['points']
        print(f'   {name} 位移最大 {r["moved_mm"]:.1f}mm，新骨鏈 {len(r["chain"])} 節，'
              f'軸線離身軸 {np.hypot(w[0, 0], w[0, 2]) * 1000:.0f}→'
              f'{np.hypot(w[-1, 0], w[-1, 2]) * 1000:.0f}mm')
    if coat is not None:
        # 髮束表面對外套外殼的間隙是設計出來的（TAIL_COAT_GAP），這裡量的是
        # 「還有多少髮頂點在外套輪廓裡面」。髮束的粗細取 90 百分位，所以一成的
        # 髮絲本來就會伸出設計半徑之外，允許幾毫米；但 2026-09-04 修之前是
        # 176mm／45%，門檻擋的是那個量級。
        deepest, share = twintail.coat_intrusion(doc, views, manifest['parts'], coat)
        print(f'   雙馬尾在外套輪廓內最深 {deepest:.0f}mm，≥5mm 的頂點佔 {share * 100:.1f}%')
        if deepest > TAIL_COAT_INTRUSION_MAX or share > TAIL_COAT_INSIDE_SHARE_MAX:
            raise SystemExit(
                f'雙馬尾陷進外套：最深 {deepest:.0f}mm（上限 {TAIL_COAT_INTRUSION_MAX:.0f}）、'
                f'≥5mm 佔 {share * 100:.1f}%（上限 {TAIL_COAT_INSIDE_SHARE_MAX * 100:.0f}%）；'
                'twintail.waypoints 與現在的外套對不上了')

    # --- head: bear ears, buns, crown, ahoge, clips. Bound rigidly to the
    #     head joint, which is what an accessory sitting on the skull does:
    #     put() reads that every skin vertex under them is wholly the head's
    #     and binds them `single`, translating the slot into the skin of the
    #     mesh they are attached to (the hair mesh). ---
    # The parametric constructors still take a row (a sphere cannot be built
    # without one), so this is the head joint's slot in that skin, and the same
    # row put() will write.
    head_mesh = manifest['parts']['Hair_Back']['mesh']
    head_skin = doc['skins'][humanoid.skin_of_mesh(doc, head_mesh)]
    hj = np.array([head_skin['joints'].index(bones['head']), 0, 0, 0], dtype=np.uint16)
    hw = np.array([1.0, 0.0, 0.0, 0.0], dtype=np.float32)

    hair = garment.body_pool(doc, views, manifest, 'Hair_Back')
    crown_y = float(np.percentile(hair['pos'][:, 1], 99))
    skull_r = 0.085

    def with_uv(piece, uv):
        """A Blender head piece with its generated UV. Its weights come from
        put(): every one of these sits on skin that is wholly the head's, so
        the chooser binds it rigidly to the head, as `rigid()` used to by
        hand."""
        piece = dict(piece)
        piece['uv'] = uv
        return piece

    # UV for the pieces whose shading comes from a texture rather than a flat
    # factor. The VRoid hair map is a vertical ramp: v around 0.05 is the warm
    # sand of a root, v around 0.74 is its palest. So an ear ring runs sand at
    # the crease against the inner ear and pale at its outer rim, a bun darkens
    # towards its top, and a strand runs root to tip. u is given some lateral
    # travel so the painted strands show as streaks instead of one flat column
    # of colour. The inner ear and the crown have their own generated textures,
    # so uv_bowl and uv_round map into those instead.
    def uv_disc(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.hypot(d[:, 0], d[:, 1]).max()), 1e-6)
        r = np.hypot(d[:, 0], d[:, 1]) / radius
        ang = np.arctan2(d[:, 1], d[:, 0])
        return np.stack([0.12 + 0.44 * (0.5 + 0.5 * np.cos(ang)),
                         0.14 + 0.58 * r ** 2], axis=1)

    def uv_facet(piece):
        """每個面自己的法線決定它在金色斜坡上的位置。

        先前這裡是依方位角的斜坡（uv_round）：位置連續，所以一頂外層 60 面、
        內層 40 面的冠算出來是一片平滑漸層，齒和環帶之間沒有交界，正面看就是一塊桃色
        板子。皇冠之所以讀得出來是冠，靠的是相鄰兩個面亮度突然差一階——參考
        圖裡每一支齒的兩個側面亮暗分明，那是折角不是曲面。

        法線能這樣用是因為皇冠在 Blender 裡是平面著色的：每個面自己一組頂
        點，匯出時就分開了（實測 head.glb 的 Crown 是 240 頂點 120 三角形，
        每個頂點只被兩個三角形用，同一個三角形內的法線離散為 0），所以一個
        頂點的法線就是它所屬那個面的法線，指定到頂點的 UV 等於指定到面。耳圈
        與髮髻是 shade_smooth（同一份實測，一個頂點最多被 26 個三角形共用），
        同樣的算法在那裡會被插值抹平，所以它們留在各自的鋪法。
        """
        n = piece['nrm']
        lit = n @ (np.array(character.CROWN_LIGHT)
                   / np.linalg.norm(character.CROWN_LIGHT))
        # 攤到這一層自己的最暗與最亮之間，不是直接用 0.5+0.5*lit。斜坡的均值
        # 決定了係數（見 ramp_texture），所以斜坡只能有那麼寬；把只用到中間
        # 六成的 v 攤開，等於在同樣的均值下把可用的對比翻倍。內外兩層各自攤
        # 各自的範圍，兩層的最暗面顏色不同，本來就該分開對映。
        span = max(float(lit.max() - lit.min()), 1e-6)
        return np.stack([np.full(len(n), 0.5),
                         np.clip((lit - lit.min()) / span, 0.02, 0.98)], axis=1)

    def uv_bowl(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.hypot(d[:, 0], d[:, 1]).max()), 1e-6)
        # 平面投影，不是半徑投影。照半徑鋪會讓髮絲繞成同心圓弧，一塊 25mm 的
        # 碗上讀起來是指紋；平面鋪讓髮絲跟頭髮同一個方向。
        return np.stack([np.clip(0.5 + 0.45 * d[:, 0] / radius, 0.02, 0.98),
                         np.clip(0.5 - 0.45 * d[:, 1] / radius, 0.02, 0.98)], axis=1)

    def uv_ball(pos):
        c = pos.mean(axis=0)
        d = pos - c
        radius = max(float(np.abs(d[:, 1]).max()), 1e-6)
        ang = np.arctan2(d[:, 2], d[:, 0])
        return np.stack([0.12 + 0.44 * (0.5 + 0.5 * np.cos(2 * ang)),
                         0.20 + 0.55 * (0.5 - 0.5 * d[:, 1] / radius)], axis=1)

    def uv_strand(pos):
        t = pos[:, 0]
        t = (t - t.min()) / max(float(t.max() - t.min()), 1e-6)
        return np.stack([np.full(len(pos), 0.30), 0.12 + 0.73 * t], axis=1)

    head_path = os.path.join(os.path.dirname(dst), character.HEAD)
    head_pieces = weld.pieces(head_path) if os.path.exists(head_path) else {}
    hair_mat = next(i for i, m in enumerate(doc['materials'])
                    if m['name'] == hair_mats[0])
    bowl, bowl_mean = bowl_texture(doc, views, paint['ear_inner'] + '_shade',
                                   mean=character.BOWL_MEAN)
    mats[paint['ear_inner']] = add_material(
        doc, paint['ear_inner'], tuple(c / bowl_mean for c in character.EAR_INNER),
        tuple(c / bowl_mean for c in character.EAR_INNER_SHADE), texture=bowl,
        outline=outline, rim=rim)
    if max(doc['materials'][mats[paint['ear_inner']]]
           ['pbrMetallicRoughness']['baseColorFactor'][:3]) > 1.0:
        raise SystemExit('內耳除以貼圖均值後超過 1.0，係數會被 glTF 截掉')

    # One part per side, not one merged Hair_Bun_Ears. The template's whole
    # claim is that a tool can address a piece by name, and a single part
    # covering both sides cannot answer "remove the left bun".
    if head_pieces:
        for label in ('L', 'R'):
            ear = head_pieces[f'Ear_{label}']
            put(with_uv(ear, uv_disc(ear['pos'])), hair_mat, f'Hair_Ear_{label}',
                mesh=head_mesh, origin='blender')
            inner = head_pieces[f'EarInner_{label}']
            put(with_uv(inner, uv_bowl(inner['pos'])), paint['ear_inner'],
                f'Hair_Ear_{label}',
                mesh=head_mesh, tag=f'Hair_Ear_{label}#inner', origin='blender')
            bun = head_pieces[f'Bun_{label}']
            put(with_uv(bun, uv_ball(bun['pos'])), hair_mat, f'Hair_Bun_{label}',
                mesh=head_mesh, origin='blender')
        # The Blender head piece still has an Ahoge loop -- head_pieces['Ahoge']
        # -- dropped on request 2026-09-04 (a single strand rooted at the
        # crown, arcing up and back down; not part of the base VRoid hair, no
        # morph targets, no material of its own to strand). Left un-put()
        # rather than built-then-DROP'd: the pipeline's DROP mechanism runs at
        # customise.apply(), step 2, before this part exists at all.
        # 補在既有材質上，不是用同名再建一份。建第二份會讓出貨檔裡出現兩個
        # 同名的金色材質，manifest 的 palette 以名字為鍵、後者蓋前者，宣告出去的
        # 底色就變成沒有人挑過也沒被算圖用到的那一組；customise.tint 又會走訪
        # 所有同名材質，一次改色寫進兩份，其中一份是死的。
        gold, gold_mean = ramp_texture(doc, views, paint['gold'] + '_ramp',
                                      character.GOLD_RAMP[0], character.GOLD_RAMP[1],
                                      gamma=character.GOLD_RAMP[2])
        for name in (paint['gold'], paint['gold_inner']):
            mat = doc['materials'][mats[name]]
            pbr = mat['pbrMetallicRoughness']
            pbr['baseColorTexture'] = {'index': gold}
            pbr['baseColorFactor'] = [c / gold_mean for c
                                      in pbr['baseColorFactor'][:3]] + [1.0]
            props = doc['extensions']['VRM']['materialProperties'][mats[name]]
            props['textureProperties'] = {'_MainTex': gold, '_ShadeTexture': gold}
            props['vectorProperties']['_Color'] = list(pbr['baseColorFactor'])
        for name in (paint['gold'], paint['gold_inner']):
            # 兩個都要查。上面那個迴圈改的是兩個材質，守衛先前只看外層，把
            # GoldInner 調亮到 0.87 以上照樣建置成功，glTF 靜默夾成 1.0。
            if max(doc['materials'][mats[name]]
                   ['pbrMetallicRoughness']['baseColorFactor'][:3]) > 1.0:
                raise SystemExit(f'{name} 除以斜坡均值後超過 1.0，'
                                 f'係數會被 glTF 截掉')
        # 兩層用同一個髮面池沉下去。沉完才算 UV 只是順手，不是必要：uv_facet
        # 只讀法線，而 sink 是剛體平移不動法線，先算後算等價。
        skull = np.concatenate([
            garment.body_pool(doc, views, manifest, n)['pos']
            for n in ('Hair_Bangs', 'Hair_Side_L', 'Hair_Side_R', 'Hair_Back')])
        # 2026-09-02 使用者指出皇冠壓住右熊耳太多：出貨檔量到皇冠 x 質心 +0.067
        # 幾乎正對耳盤 +0.075，前視圖 x 重疊佔耳寬 84%。往中線收又往瀏海前移，
        # sink 會讓它順著瀏海坡面落定。位置常數會靜默過期（appearance_test 的
        # test_crown_rides_the_bangs_not_the_ear 釘住移完的相對關係）。
        for shell_piece in (head_pieces['Crown'], head_pieces['CrownInner']):
            shell_piece['pos'] = shell_piece['pos'] + np.array(character.CROWN_SHIFT)
        shells, fell = sink([head_pieces['Crown'], head_pieces['CrownInner']],
                            skull)
        print(f'   皇冠整體下沉 {fell * 1000:.0f}mm 貼上髮面')
        for piece, colour, tag in zip(shells, (paint['gold'], paint['gold_inner']),
                                      (None, 'Acc_Crown#inner')):
            put(with_uv(piece, uv_facet(piece)), colour, 'Acc_Crown',
                mesh=head_mesh, tag=tag, origin='blender')
    else:
        # No Blender on this machine. These are the parametric shapes the
        # measured ones replaced: a sphere with two smaller spheres stuck on
        # top for each side, and a five-spike ring with no thickness. They read
        # as coloured blocks next to the reference. They cover Hair_Bun_L/R and
        # Acc_Crown only -- Hair_Ear_L/R has no parametric version and is
        # simply absent on a machine without Blender, which is a degraded
        # build and not an equivalent one.
        for side, label in ((-1, 'L'), (1, 'R')):
            c = [side * skull_r * 0.92, crown_y - 0.012, 0.012]
            bun = [garment.sphere(c, 0.046, hj, hw, lat=10, lon=14,
                                  squash=(1.0, 0.94, 0.98))]
            for ear_x, ear_z in ((-0.026, -0.004), (0.026, -0.004)):
                bun.append(garment.sphere(
                    [c[0] + ear_x, c[1] + 0.036, c[2] + ear_z], 0.019, hj, hw,
                    lat=6, lon=10, squash=(1.0, 1.0, 0.62)))
            put(garment.merge(bun), paint['hair'], f'Hair_Bun_{label}',
                mesh=head_mesh)
        put(garment.crown([0.028, crown_y + 0.026, 0.004], 0.030, 0.036, 5, hj, hw),
            paint['gold'], 'Acc_Crown', mesh=head_mesh)

    # 瀏海用基底 VRoid 的原生髮束，不再從臉部曲面切一片外推。外推那版是一片
    # 178 面的光滑殼，在臉部特寫裡看起來是泳帽而不是頭髮；原生瀏海本來就有
    # 分束與髮絲明暗，只是把烘在上面的髮夾貼片切成 Acc_HairClip_Base 丟掉
    # （見 partition.hair_name 與 outfits.mellowheart.REPLACES）。

    # Plaster clip: two crossed bars. Bear clip: a head and two round ears.
    # z 由 -0.062 移到 -0.136：髮夾別在瀏海「上面」，不是夾在瀏海和額頭中間。
    # 原本的深度會把三個髮飾整組藏到瀏海後面；-0.136 在殼狀瀏海與後來換回的
    # 原生瀏海底下都成立，臉部特寫裡三個都露在外面。
    #
    # 左右：本模型 leftUpperArm 在 x=-0.081，臉朝 -z，所以正面視角裡 +x 是畫
    # 面左側。參考的兩張插畫和 ingame/07 的實機正面都是「橫槓在畫面左、OK 繃
    # 和小熊在畫面右」，換算成 +x 橫槓、-x 小熊。原本橫槓和小熊各自擺在相反
    # 邊，三個髮飾裡只有 OK 繃是對的。
    clip_z = -0.136
    px, py = -0.016, crown_y - 0.086
    arm, wide, deep = 0.015, 0.0056, 0.0026
    # OK 繃是斜交叉的 X，兩條膠布直身圓頭，中間壓一塊較亮的紗布墊。角度取
    # official/front-back-with-cardigan.jpg，也就是本模型這個配色的那張；照
    # ingame/01 取樣過一次是錯的，那張是冰白配色的另一個版本，跟著它改成的
    # 軸對齊「＋」在臉部近拍裡和參考差得比改之前還遠。
    # 圓頭用球而不是把整條做成橢球：橢球的兩端是尖的，做出來是四角星。
    TILT = 0.55

    def bandage(rot):
        """一條膠布：直的身體，兩端各一個圓頭，整條繞 z 轉 rot。"""
        out = [garment.box([px, py, clip_z], (arm, wide, deep), hj, hw,
                           rot_z=rot)]
        for end in (-arm, arm):
            # 圓頭要跟著身體一起轉，所以端點自己算過旋轉；garment.sphere 沒有
            # rot_z，但球是旋轉對稱的，只有位置需要轉。
            out.append(garment.sphere(
                [px + end * math.cos(rot), py + end * math.sin(rot), clip_z],
                wide, hj, hw, lat=4, lon=6, squash=(1.0, 1.0, deep / wide)))
        return out

    put(garment.merge(bandage(TILT) + bandage(TILT - math.pi / 2)),
        paint['plaster'], 'Acc_HairClip_Plaster', mesh=head_mesh)
    put(garment.box([px, py, clip_z - deep], (0.0090, 0.0066, 0.0016), hj, hw,
                    rot_z=TILT),
        paint['cloth'], 'Acc_HairClip_Plaster', mesh=head_mesh,
        tag='Acc_HairClip_Plaster#pad')

    bear = [garment.sphere([-0.064, crown_y - 0.078, clip_z + 0.010], 0.015,
                           hj, hw, lat=6, lon=10)]
    for ex in (-0.013, 0.013):
        bear.append(garment.sphere([-0.064 + ex, crown_y - 0.067, clip_z + 0.010],
                                   0.007, hj, hw, lat=4, lon=6))
    put(garment.merge(bear), paint['bear'], 'Acc_HairClip_Bear', mesh=head_mesh)
    # 兩眼一鼻。少了這三點，小熊在近拍裡是一顆長了兩隻耳朵的白球，而參考圖上
    # 它是有臉的——這是整個頭部特寫裡最便宜的一項辨識度。
    face = [garment.sphere([-0.064 + ex, crown_y - 0.079 + ey, clip_z - 0.004],
                           r, hj, hw, lat=3, lon=5)
            for ex, ey, r in ((-0.005, 0.003, 0.0022), (0.005, 0.003, 0.0022),
                              (0.000, -0.002, 0.0026))]
    put(garment.merge(face), paint['ink'], 'Acc_HairClip_Bear',
        mesh=head_mesh, tag='Acc_HairClip_Bear#face')

    # 兩條不是三條，改細改深。官方圖上這一組是兩條炭黑細槓；先前是三塊 7mm
    # 厚的純白方塊，在近拍裡像三張貼紙。
    bars = [garment.box([0.047, crown_y - 0.112 + i * 0.012, clip_z + 0.018],
                        (0.019, 0.0022, 0.004), hj, hw, rot_z=0.12)
            for i in range(2)]
    put(garment.merge(bars), paint['ink'], 'Acc_HairClip_Bars', mesh=head_mesh)

    # --- hair colour. It lives in six textures, not in a material factor, so
    #     the only way to move it is to rotate the textures themselves. The base
    #     model is pink at hue 350 / sat 0.49 / lightness 0.71; the reference is
    #     a pale sand around hue 33 / sat 0.24 / lightness 0.79. ---
    for image in base_body.HAIR_TEXTURES:
        customise.hue(doc, views, image,
                      character.HAIR_SHIFT, character.HAIR_SAT,
                      lift=character.HAIR_LIFT, unify=character.HAIR_UNIFY,
                      flatten=HAIR_FLATTEN_BLOCKS)

    # --- brows. The base model's are periwinkle, hue 250, to go with pink hair;
    #     the reference's are a warm grey-brown. They are their own texture, so
    #     this is one rotation and not a repaint. ---
    customise.hue(doc, views, base_body.BROW_TEXTURE,
                  character.BROW_SHIFT, character.BROW_SAT)

    # --- the scalp cap. It is HAIR, and it lives in the face's skin texture.
    #     VRoid paints it there so a parting shows hair rather than scalp, which
    #     means every step that treats that atlas as skin also drags the cap
    #     along: the first Milfy build rotated it by the SKIN solve and shipped a
    #     violet cap under blonde hair, visible through every parting. It is
    #     recoloured here, onto the hair's OWN post-transform median rather than
    #     onto a colour written down beside it, and the mask is taken now so the
    #     skin solve below can exclude the same pixels. ---
    #     The cap has an edge. Its anti-aliased boundary blends the paint into
    #     the skin, and those texels belong to neither solve: rotated with the
    #     core they turn green (a blend rotated by the core's angle), rotated
    #     with the skin they turn mauve (the 09-03 build, seen as purple lines
    #     at the nape on 09-04). They are kept out of both and painted LAST, as
    #     the same mix of solved hair and solved skin they were in the source
    #     (customise.blend_fringe); their mix is read now, before anything
    #     moves. ---
    face_rgba = customise.image_rgba(doc, views, base_body.FACE_ATLAS)
    cap, cap_fringe = customise.hair_paint_pixels(
        face_rgba[..., :3], face_rgba[..., 3],
        base_body.SCALP_HUE, base_body.SCALP_WINDOW,
        fringe_to=base_body.SCALP_FRINGE_TO,
        fringe_min_sat=base_body.SCALP_FRINGE_SAT)
    cap_weight = customise.paint_weights(face_rgba[..., :3], face_rgba[..., 3],
                                         cap, cap_fringe)
    scalp = cap | cap_fringe
    hair_med = customise.median_hue(
        doc, views, list(base_body.HAIR_TEXTURES))
    deg, sat, light, lift, shift = customise.retone(
        doc, views, base_body.FACE_ATLAS, tuple(hair_med),
        stat=cap, where=cap)
    print(f'   頭皮色塊 {int(cap.sum())} px → 髮色 '
          f'{tuple(int(v) for v in hair_med)} 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}；'
          f'邊緣 {int(cap_fringe.sum())} px 留到最後混色')

    # --- the nape. The same paint in the BODY atlas: VRoid draws the base
    #     hairstyle's nape strands as two hair-coloured strips down the back of
    #     the neck. The 09-03 fix never looked in this atlas, the skin solve
    #     barely moves a hue that far from skin, and the two strips shipped
    #     violet, running from under the hair down both sides of the neck. They
    #     are not a parting -- this hairstyle covers the nape with its own hair
    #     -- so they are filled from the skin around them here, before the skin
    #     solve, and go through it as skin. ---
    body_rgba = customise.image_rgba(doc, views, base_body.BODY_ATLAS)
    nape_core, nape_fringe = customise.hair_paint_pixels(
        body_rgba[..., :3], body_rgba[..., 3],
        base_body.SCALP_HUE, base_body.SCALP_WINDOW,
        fringe_to=base_body.SCALP_FRINGE_TO,
        fringe_min_sat=base_body.SCALP_FRINGE_SAT)
    filled = customise.fill_from_surroundings(
        doc, views, base_body.BODY_ATLAS, nape_core | nape_fringe)
    print(f'   後頸髮根條 {filled} px（核心 {int(nape_core.sum())}）填回周圍膚色')

    # --- skin. Two textures, one skin, so ONE solve across both. Solving each
    #     atlas against the target separately is what desaturated the face: the
    #     face atlas's median carries the lips, the brows and the blush and sits
    #     well below its own visible cheek, so its offset came out larger, and an
    #     offset that lands the visible face at lightness 0.99 leaves chroma a
    #     ceiling of 2(1-l) whatever saturation asks for. Measured on the shipped
    #     2026-09-03 build: visible face (232, 231, 229) against a neck at
    #     (231, 209, 202), built from a source whose face reads (231, 210, 204).
    #     The scalp cap is out of both the sample and the transform: it has just
    #     been solved onto the hair and must not be moved again. ---
    skin_names = base_body.SKIN_ATLASES
    stats = {n: customise.image_rgba(doc, views, n)[..., 3] > 200 for n in skin_names}
    stats[base_body.FACE_ATLAS] &= ~scalp
    deg, sat, light, lift, shift = customise.retone_together(
        doc, views, skin_names, character.SKIN_TARGET, stats=stats,
        wheres={base_body.FACE_ATLAS: ~scalp})
    print(f'   膚色 {sum(int(m.sum()) for m in stats.values())} px（臉與身共用一組解）'
          f' 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}')
    # --- the neck. VRoid paints a band of permanent shadow round the throat,
    #     from the collarbone up under the jaw, because the base model wears a
    #     collar and it is never seen. This one wears a scoop neck, so it is on
    #     screen from the first frame, and this renderer draws no shading of its
    #     own there: a white-albedo render puts the face and the neck at the same
    #     (226, 229, 229), so the painted band is the whole of what the eye gets.
    #     Shipped 2026-09-03 it read (243, 187, 174) against a face at
    #     (252, 232, 226), delta-E 20 in the texture and 14.4 on screen, which is
    #     the "脖子的膚色跟臉的膚色不一致" this fixes.
    #
    #     The band crosses BOTH atlases -- the face mesh keeps a stub of neck
    #     below the jaw -- so both are lifted by one solve against one target.
    #     Lifting only the body's half moves the mismatch onto the seam instead
    #     of removing it, which is what the first attempt did (seam delta-E 1.0
    #     to 8.9, and a visible step 5 mm under the jaw).
    #
    #     Rig landmarks, not written-down heights: the band runs from the neck
    #     bone to the head bone, with NECK_MARGIN of overshoot at each end so the
    #     feather has somewhere to land. ---
    world = render.world_matrices(doc)
    bones = humanoid.bones(doc)
    neck_y = float(world[bones['neck']][1, 3])
    head_y = float(world[bones['head']][1, 3])
    lo, hi = neck_y - NECK_MARGIN, head_y + NECK_MARGIN
    weights, band_px = {}, {}
    for mesh_name, mat_name, image in (
            ('Face.baked', base_body.FACE_SKIN_MATERIAL, base_body.FACE_ATLAS),
            ('Body.baked', base_body.BODY_SKIN_MATERIAL, base_body.BODY_ATLAS)):
        mesh = next(m for m in doc['meshes'] if m.get('name') == mesh_name)
        shape = customise.image_rgba(doc, views, image).shape[:2]
        uvs, tris, base = [], [], 0
        for p in mesh['primitives']:
            if doc['materials'][p['material']].get('name') != mat_name:
                continue
            pos = glb.read_accessor(doc, views, p['attributes']['POSITION'])
            uv = glb.read_accessor(doc, views, p['attributes']['TEXCOORD_0'])
            idx = glb.read_accessor(doc, views, p['indices']).reshape(-1, 3).astype(int)
            band = (pos[:, 1] >= lo) & (pos[:, 1] <= hi)
            keep = band[idx].all(axis=1)
            uvs.append(uv)
            tris.extend(idx[keep] + base)
            base += len(uv)
        if not tris:
            raise SystemExit(f'{mesh_name} 在頸部帶裡取不到三角形')
        weights[image] = customise.uv_mask(shape, np.concatenate(uvs), tris)
        band_px[image] = int((weights[image] > 0.5).sum())

    # The target is the skin OUTSIDE the band, over both atlases together: the
    # chest, the arms and the face, which is the tone the neck has to disappear
    # into. Taking it from one atlas would put the other one's half of the band
    # somewhere else.
    outside = []
    for image in weights:
        a = customise.image_rgba(doc, views, image)
        pick = (a[..., 3] > 200) & (weights[image] < 0.01)
        if image == base_body.FACE_ATLAS:
            pick &= ~scalp
        outside.append(a[..., :3][pick])
    neck_target = np.median(np.concatenate(outside), axis=0)
    for image, weight in weights.items():
        off, n = customise.lift_region(doc, views, image, weight, neck_target)
        print(f'   頸部帶 {image} {band_px[image]} px 最暗十分位抬升 {off:+.3f}')

    print(f'   頸部目標 ({neck_target[0]:.0f}, {neck_target[1]:.0f}, {neck_target[2]:.0f})'
          f' 取自帶外的皮膚')
    # The cap's edge, last: both sides of it are now their final colours.
    blended = customise.blend_fringe(doc, views, base_body.FACE_ATLAS,
                                     cap, cap_fringe, cap_weight)
    print(f'   頭皮蓋邊緣 {blended} px 依來源的髮／膚比例混色')

    deg, sat, light, lift, shift = customise.retone(
        doc, views, base_body.IRIS_TEXTURE, character.EYE_TARGET, mid=(60, 215))
    print(f'   {base_body.IRIS_TEXTURE} 轉色相 {deg:+.1f}° 飽和 x{sat:.2f} '
          f'明度 x{light:.2f} 提亮 {lift:.2f} 位移 {shift:+.3f}')

    skin_materials = customise.tone_textured_materials(
        doc,
        set(base_body.SKIN_ATLASES),
        character.SKIN_MATERIAL_TONE,
    )
    hair_materials = customise.tone_textured_materials(
        doc,
        set(base_body.HAIR_TEXTURES),
        character.HAIR_MATERIAL_TONE,
        shade=character.HAIR_SHADE_TONE,
    )
    print(f'   膚色 MToon 乘色 {character.SKIN_MATERIAL_TONE}，'
          f'改了 {len(skin_materials)} 個材質')
    print(f'   髮色 MToon 乘色 {character.HAIR_MATERIAL_TONE} '
          f'陰影 {character.HAIR_SHADE_TONE}，'
          f'改了 {len(hair_materials)} 個材質')

    # --- outlines. Everything above moved colour that a texture or a factor
    #     carries; this moves the one that the second draw pass carries. ---
    moved = customise.outline(doc, outline, skip=hair_mats)
    was = sorted({tuple(w) for _, w in moved if w is not None})
    print(f'   描邊統一為 {outline}，改了 {len(moved)} 個材質，'
          f'原本有 {len(was)} 種：{was}')
    rimmed = customise.rim(doc, rim)
    print(f'   邊光宣告為 {rim}，寫進 {len(rimmed)} 個材質')

    # Last, after every branch has had its chance to use one.
    gone = customise.sweep_materials(doc)
    if gone:
        print(f'   掃掉沒有網格用的材質 {len(gone)} 個：{gone}')

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)

    # Rebuild the manifest from the file we just wrote, not from the one we
    # read. Indices recorded before the strip step are stale by exactly the
    # number of primitives that step removed, and a stale index is how a
    # downstream delete takes its neighbour with it.
    locked = {'Face', 'Body_Skin'}
    parts = {}
    for mesh in doc['meshes']:
        mname = mesh.get('name')
        if mname == 'Face.baked':
            parts['Face'] = {
                'mesh': mname,
                'primitives': list(range(len(mesh['primitives']))),
                'tris': sum(doc['accessors'][pr['indices']]['count'] // 3
                            for pr in mesh['primitives']),
                'materials': sorted({doc['materials'][pr['material']]['name']
                                     for pr in mesh['primitives']}),
                'deletable': False,
                'note': 'carries the 56 morph targets; splitting it breaks blendShapeMaster',
            }
            continue
        for i, pr in enumerate(mesh['primitives']):
            label = pr.get('extras', {}).get('part')
            if label is None:
                continue
            e = parts.setdefault(label, {
                'mesh': mname, 'primitives': [], 'tris': 0,
                'materials': [], 'deletable': label not in locked,
            })
            e['primitives'].append(i)
            e['tris'] += doc['accessors'][pr['indices']]['count'] // 3
            mat = doc['materials'][pr['material']]['name']
            if mat not in e['materials']:
                e['materials'].append(mat)
    for e in parts.values():
        e['materials'].sort()

    # The slot a swap tool addresses. Every part name here is already one slot,
    # which is the point of the naming rule; `group` says which of them are
    # alternatives to each other, so a tool can offer "another Outfit_Bottom"
    # without a hardcoded list, and `locked` parts are the ones with nothing to
    # swap in -- the body and the face, whose morph tables the rest depends on.
    group_of = {'Outfit': 'outfit', 'Acc': 'accessory', 'Hair': 'hair',
                'Body': 'body', 'Face': 'face'}
    for name, e in parts.items():
        e['slot'] = name
        e['group'] = group_of.get(name.split('_')[0], 'other')
    # Every part says how it is skinned: decided by put() for the parts this
    # build made, carried over for the ones the source file skinned
    # (partition stamps those) and for the twintails (twintail.apply reweights
    # them onto its own chain), and refused for anything else.
    carried = manifest['parts']
    for label, e in parts.items():
        e['binding'] = bindings.get(label) or carried.get(label, {}).get('binding')
        if not e['binding']:
            raise SystemExit(f'{label} 沒有綁定策略：不是 put() 建的，manifest 也沒帶')
    manifest['parts'] = parts

    # Read back off the finished model, not off the constants above. The
    # manifest's whole claim is that a swap tool can drive the model from it,
    # and listing the constants let it drift: after the imported outfit took
    # over, the palette still advertised the cardigan, the ribbon, the bandage
    # and the sock, four names no part used any more, and said nothing about
    # the eight the package brought in and which actually carried the colour.
    # The self-test retinted names that painted nothing and passed.
    by_name = {m['name']: m for m in doc['materials']}
    shade_of = {m['name']: m.get('vectorProperties', {}).get('_ShadeColor')
                for m in doc['extensions']['VRM']['materialProperties']}
    manifest['palette'] = {}
    for name in sorted({m for e in parts.values() for m in e['materials']}):
        if not name.startswith((character.MATERIAL_PREFIX,
                                outfit_pack.MATERIAL_PREFIX)):
            continue     # the VRoid body, face and hair are coloured in texture
        base = by_name[name]['pbrMetallicRoughness']['baseColorFactor'][:3]
        shade = (shade_of.get(name) or list(base) + [1.0])[:3]
        manifest['palette'][name] = {
            'base': [round(float(v), 4) for v in base],
            'shade': [round(float(v), 4) for v in shade],
            'parts': sorted(n for n, e in parts.items() if name in e['materials']),
        }
    # Shape keys, read back the same way and for the same reason. A key is only
    # reachable if a tool knows its name, which mesh carries it and which parts
    # it moves; without that the customiser's only option is to drive all of
    # them and watch. `mm` is the mean displacement over the vertices the key
    # actually moves, which is the number that says whether a slider does
    # anything -- a maximum is one vertex and flatters a key that barely moves.
    # One part can span several primitives, so the sum of displacements and the
    # count of moved vertices are accumulated separately and divided once at the
    # end. Taking a max over the per-primitive means instead would report a
    # number that is neither a mean nor a maximum, and nothing downstream could
    # say which.
    manifest['shapes'] = {}
    part_of = {}
    for pname, e in parts.items():
        for pi in e['primitives']:
            part_of[(e['mesh'], pi)] = pname
    for mesh in doc['meshes']:
        names = mesh.get('extras', {}).get('targetNames') or []
        if not names or mesh.get('name') == 'Face.baked':
            continue     # Face.baked's 56 are expressions, in blendShapeMaster
        for ti, key in enumerate(names):
            moves = {}
            for pi, pr in enumerate(mesh['primitives']):
                targets = pr.get('targets') or []
                if ti >= len(targets) or 'POSITION' not in targets[ti]:
                    continue
                d = glb.read_accessor(doc, views, targets[ti]['POSITION'])
                mag = np.linalg.norm(d.astype(np.float64), axis=1)
                hit = mag > glb.MORPH_EPSILON
                if not hit.any():
                    continue
                where = part_of.get((mesh.get('name'), pi), f'primitive {pi}')
                prev = moves.get(where, (0, 0.0))
                moves[where] = (prev[0] + int(hit.sum()),
                                prev[1] + float(mag[hit].sum()) * 1000.0)
            manifest['shapes'][key] = {
                'mesh': mesh.get('name'),
                'index': ti,
                'parts': {k: {'vertices': n, 'mm': round(total / n, 2)}
                          for k, (n, total) in sorted(moves.items())},
            }

    manifest['landmarks'] = lm
    # Written in a fixed key order. Python dicts keep insertion order, and every
    # section here is ASSIGNED rather than created fresh -- so a key that some
    # earlier stage already put in the manifest keeps its old slot while a new
    # one lands at the end. Building from a clean out/ therefore produced the
    # same manifest with `shapes` and `palette` swapped: identical content, but
    # the `shapes` block moving wholesale, 78 lines deleted and 78 re-added.
    # Nothing reads the order, but a shipped file that reorders itself depending
    # on what was on disk is a diff no one can dismiss at a glance.
    #
    # Sorted rather than picked from a white-list. A white-list pins the order
    # just as well and silently DROPS any section a future stage adds, which is
    # a worse failure than the one being fixed here: the reorder was loud and
    # cost a diff, a dropped section is invisible and nothing downstream would
    # catch it (verify.py never opens this file, and selftest only reads parts,
    # palette and shapes). Unknown keys sort to the tail, in name order, so they
    # survive and are still deterministic.
    ORDER = ('source', 'parts', 'palette', 'shapes', 'landmarks')
    manifest = dict(sorted(manifest.items(),
                           key=lambda kv: (ORDER.index(kv[0]) if kv[0] in ORDER
                                           else len(ORDER), kv[0])))
    json.dump(manifest, open(out_manifest, 'w'), indent=2, ensure_ascii=False)
    return added, size, lm


if __name__ == '__main__':
    added, size, lm = build(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
    print(f'wrote {sys.argv[2]} ({size} bytes)')
    print(f'landmarks: waist y={lm["waist"]:.3f} r={lm["waist_r"]:.4f}')
    for k, (v, mesh) in added.items():
        print(f'  + {k:<22} {v:>6} tris  -> {mesh}')
