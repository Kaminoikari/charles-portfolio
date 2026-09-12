"""Turn the exported meshes into named, independently deletable parts.

VRoid exports a mesh whose primitives all share one vertex buffer: dropping a
primitive drops only its indices, and its vertices stay in the file as orphans
that still count toward the bounding box. So this does not merely label the
primitives, it gives each one its own copy of the vertices it uses. After this,
deleting a part is deleting a primitive, and nothing is left behind.

Face is deliberately NOT split. Its ten primitives carry 56 morph targets each,
and VRM's blendShapeMaster binds those by (mesh index, morph index); re-indexing
them is a way to silently break every expression while the file still loads. It
is found by the FACE materials it carries, and the morph targets that make it
worth locking are then required rather than assumed.

The hair strands are named from geometry, measured against this body's own
skeleton rather than against numbers taken off one export: the long ones that
fall below its hips are the twintails, the ones in front of its eyes are the
bangs, and HAIR_06 is the ornament pair the reference does not have. See
hair_frame() for the four places and what they replaced.

The body's own parts do not come from geometry at all: VRoid spells the
category into every material name, so `body_name()` reads it off rather than
guessing. That is exact on any VRoid export, and it replaced a table from
primitive index to part name that was right here and silently wrong elsewhere.
Which mesh a primitive sits in is not asked either: the face is the mesh
carrying FACE materials, and the two kinds of hair are told apart by the part
name VRoid writes, HairBack against Hair.

One rule here is still Mika's own and cannot be read off the body in hand:
CLIP_DECALS, which costs two other bodies some hair. So this remains the one
step in the pipeline that admits to needing a particular export. `recognise()`
says so out loud and `partition()` refuses rather than naming a stranger's
primitives by these rules -- see the comment above face_meshes() for what that
produced before the check existed.
"""
import json
import re
import sys

import numpy as np

import binding
import glb
import humanoid
import pose

VERTEX_ATTRS = ('POSITION', 'NORMAL', 'TANGENT', 'TEXCOORD_0', 'TEXCOORD_1',
                'COLOR_0', 'JOINTS_0', 'WEIGHTS_0')

# VRoid writes every material name as
#
#     <prefix>_<PartName>_<nn>_<CATEGORY>[_<nn>]
#
# and CATEGORY is one of exactly these six tokens. That is the exporter's own
# grammar rather than a guess about one body, which is what makes it an answer
# on any VRoid export instead of a heuristic.
CATEGORIES = ('SKIN', 'CLOTH', 'HAIR', 'FACE', 'EYE', 'MATCAP')

# Dress-up exports decorate a re-used material's name; the grammar is intact
# underneath. Seen on vroid-studio-dressup.vrm as
# `N00_004_01_Shoes_01_CLOTH (Instance) (Instance)`.
DECORATION = re.compile(r'\s*\((?:Instance|Clone)\)')

# VRoid pluralises two part names this pipeline does not; every other CLOTH
# part keeps the exporter's own word, so a garment nobody here has seen still
# gets a name that says what it is.
OUTFIT_NAMES = {'Tops': 'Outfit_Top', 'Bottoms': 'Outfit_Bottom'}

# The two part names VRoid gives hair. HairBack is the single baked object that
# some exports put in the body mesh group; Hair is the strands. Measured on all
# sixteen local bodies in evidence/partition-0912-meshes.log.
HAIR_OBJECT = 'HairBack'

# The category that marks the mesh VRM binds expressions into.
FACE_CATEGORY = 'FACE'


def vroid_category(material):
    """(part name, category token) from a VRoid material name.

    (None, None) for a name outside the grammar, which is how a body this step
    cannot name announces itself to recognise().
    """
    segments = DECORATION.sub('', material).strip().split('_')
    # The hair materials are the one VRoid name whose category is not the last
    # segment: F00_000_Hair_00_HAIR_01 through _06 carry a variant number after
    # it, which is the same suffix CLIP_DECALS reads.
    for i in (-1, -2):
        # len + i >= 2 is exactly "segments[i - 2] exists"; a plain len >= 3
        # reads the same on the first pass and walks off the front on the
        # second, so a three-segment name like Hair_HAIR_01 raised IndexError
        # instead of saying it has no category.
        if len(segments) + i >= 2 and segments[i] in CATEGORIES:
            return segments[i - 2], segments[i]
    return None, None


def body_name(material):
    """Which part a Body mesh primitive belongs to, read off its material.

    This replaced a table from primitive INDEX to name, which was right about
    the body it was written on and wrong in silence elsewhere: four of the
    sixteen local bodies (Vivi, Vita, Victoria_Rubin, Darkness_Shibu) export
    SKIN x4, Tops, Shoes, HairBack, so index 5 named the shoes Outfit_Bottom
    and index 6 named the back hair Outfit_Shoes. All four have exactly seven
    primitives, so the count check recognise() used to run passed them through.
    """
    part, category = vroid_category(material)
    if category == 'SKIN':
        return 'Body_Skin'
    if category == 'CLOTH':
        return OUTFIT_NAMES.get(part, f'Outfit_{part}')
    if category == 'HAIR':
        # The grammar separates the two kinds of hair by part name, so which
        # mesh a primitive sits in never had to be the question. HairBack is
        # one whole baked object, on eight of the sixteen local bodies inside
        # the body mesh group and on vrm1-twist-sample inside a mesh called
        # Body; Hair is the individual strands, which need geometry. The label
        # is deliberately not 'Hair_Back': hair_name() gives that one to
        # strands, parts are keyed by label, and one would replace the other.
        return 'Hair_BodyBack' if part == HAIR_OBJECT else None
    if category == 'MATCAP':
        # Glasses on the dress-up export, as Accessory_GlassesHiFrame_01_MATCAP
        # and _GlassesHiLens_. An accessory is what mellowheart.REPLACES takes
        # off, which is the right default for something the wearer chose.
        return f'Acc_{part}'
    return None


def is_strand(material):
    """Is this a hair strand, which the grammar names but does not place?

    body_name() answers None for a strand and None for a material outside the
    grammar, and recognise() has to tell those apart: the first is ordinary and
    the second is a body this step cannot name.
    """
    part, category = vroid_category(material)
    return category == 'HAIR' and part != HAIR_OBJECT


# The base model's fringe carries its hair clips as painted decals on separate
# primitives -- crossed bars over the left brow, two outlined stars over the
# right -- rather than as accessory geometry. Naming them apart is what lets the
# fringe itself be kept: the reference wears a different set of clips, and
# dropping the whole fringe to be rid of these left a smooth offset shell over
# the forehead that read as a swim cap.
#
# This is the one rule in this file still measured on Mika rather than on the
# body in hand, and it is wrong on two other bodies: AvatarSample_A and
# Victoria_Rubin use HAIR_03 for ordinary strands that happen to sit in front of
# the eyes, so 9 and 3 of their strands respectively are binned as clips and
# then deleted by mellowheart.REPLACES. Triangle count does not separate the two
# cases -- Mika's 18 clips run 6 to 128 triangles and those 12 strands 24 to 194
# -- so there is no cheap general signal, and a decal detector belongs with the
# masking work in stage 2c rather than here. Counted in
# evidence/hair-0912-clips.log.
CLIP_DECALS = ('HAIR_03', 'HAIR_05')

# What is left that this step reads off THIS body: where a hair strand sits in
# absolute world coordinates. Face and Body used to be a second such fact, found
# by the mesh names `Face.baked` and `Body.baked`, and two of the sixteen local
# bodies do not use them: vrm1-twist-sample exports `Face`, `Body` and `Hair`,
# and the dress-up export splits the body over seven meshes with names like
# `Body (merged).baked(copy).baked`. Both are now found by content, so no
# PARTICULAR mesh name is expected anywhere in this file. Names still have to
# exist and be unique, because the manifest records a part's mesh by name and
# pose.skinned keys the rest world the same way; recognise() checks that.
#
# This step is still the one place in the pipeline allowed to require a
# particular export, and recognise() is where it says so. Everything upstream of
# here (the humanoid map, the VRM1 entry conversion, the skeleton gates, the
# per-mesh skins) was generalised precisely so that a strange body reaches this
# step; what it must not do is get labelled anyway. Before this check, a body
# with neither mesh fell through to hair_name for every primitive it had, and
# the 2026-09-07 Seed-san fixture run came out with a robot's arm and its
# clothes labelled Hair_Twintail_R, Hair_Bangs and Hair_Side_L -- a manifest
# that loads, reads plausibly, and is entirely fiction. A refusal that names
# what it wanted is the cheap outcome; a plausible wrong manifest is the
# expensive one, because every later step believes it.


def face_meshes(doc):
    """The meshes carrying FACE materials, which is where the head lives.

    Exactly one mesh on each of the sixteen local bodies carries one, and on
    fifteen of them it is also the only mesh with morph targets; the sixteenth
    is mika-milfy-12, one of this pipeline's own outputs, whose imported
    garment carries six of its own. So the morph targets corroborate the answer
    and the FACE category gives it -- see evidence/partition-0912-meshes.log.
    """
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
    return [mesh for mesh in doc['meshes']
            if any(vroid_category(mats[p['material']])[1] == FACE_CATEGORY
                   for p in mesh['primitives'])]


def recognise(doc):
    """Reasons this file is not the VRoid export the naming below assumes.

    Empty list = recognised. Each reason names what was wanted and what is
    there, because the useful thing to a person holding a strange body is which
    assumption broke, not that one did.
    """
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
    faces = face_meshes(doc)
    reasons = []
    if len(faces) != 1:
        found = ', '.join(str(m.get('name')) for m in faces) or '沒有'
        reasons.append(
            f'帶 {FACE_CATEGORY} 材質的 mesh 應該剛好一個，這裡有 {len(faces)} 個'
            f'（{found}）。mesh 有：'
            f'{", ".join(sorted(str(m.get("name")) for m in doc["meshes"]))}')
    named = [m.get('name') for m in doc['meshes']]
    if len(set(named)) != len(named) or any(n is None for n in named):
        # Not a leftover of finding meshes by name: the manifest records which
        # mesh a part lives in BY NAME, and pose.skinned keys its rest world
        # the same way, so two meshes sharing one is a part pointing at the
        # wrong geometry and a frame measured off the wrong vertices. Renaming
        # mika-pink's three meshes to one name collapses pose.skinned from 94
        # keys to 77 and takes the face's half-width from 0.0918 to 0.2309,
        # because the hair's x range answers instead.
        reasons.append(f'mesh 名稱必須存在且互不重複，這裡有 {len(named)} 個 mesh、'
                       f'{len(set(named))} 個相異名稱：'
                       f'{", ".join(str(n) for n in named)}')
    if 'leftEye' not in humanoid.bones(doc):
        reasons.append('沒有 leftEye 骨，髮絲的左右與臉前判準無從量起'
                       '（VRM 規格裡眼睛骨是選配的，所以上游的骨架關卡放行）')
    if len(faces) == 1 and not any(p.get('targets') for p in faces[0]['primitives']):
        # The reason Face is locked is that blendShapeMaster binds expressions
        # into it by morph index. A face mesh with no morphs is not the thing
        # that rule protects, so the naming below is answering about something
        # else.
        reasons.append(f'{faces[0].get("name")} 帶 {FACE_CATEGORY} 材質但沒有 '
                       'morph target，那不是 blendShapeMaster 綁定的那個 mesh')

    # The primitive COUNT used to be the check here, and it asked the wrong
    # question: HairSample_Female exports six body primitives and
    # Sendagaya_Shibu nine, and both are ordinary VRoid bodies. What this step
    # actually needs is that every primitive outside the face either carries a
    # category token it has a name for, or is a strand for hair_name to place.
    ids = {id(m) for m in faces}
    unnamed = sorted({mats[p['material']]
                      for mesh in doc['meshes'] if id(mesh) not in ids
                      for p in mesh['primitives']
                      if body_name(mats[p['material']]) is None
                      and not is_strand(mats[p['material']])})
    # Two different complaints, because a refusal naming the wrong broken
    # assumption is little better than no reason at all. A material with no
    # token is somebody's hand-authored name; a material carrying EYE or FACE
    # outside the face mesh has a perfectly good token and no part name to go
    # with it, and saying it lacked the token it plainly has sent the reader
    # looking in the wrong place.
    tokenless = [m for m in unnamed if vroid_category(m)[1] is None]
    placeless = [m for m in unnamed if vroid_category(m)[1] is not None]
    if tokenless:
        reasons.append(
            f'有 {len(tokenless)} 個材質不帶 VRoid 的類別後綴'
            f'（{"、".join(CATEGORIES)}），推不出部件名稱：'
            f'{"、".join(tokenless)}')
    if placeless:
        reasons.append(
            f'有 {len(placeless)} 個材質帶著這一步沒有部件名稱可給的類別'
            f'（{"、".join(sorted({str(vroid_category(m)[1]) for m in placeless}))}）'
            f'，而且不在臉的 mesh 裡：{"、".join(placeless)}')
    return reasons


def hair_frame(doc, views):
    """The four places on THIS body that hair_name measures a strand against.

    They used to be four numbers taken off Mika: below the waist at y 0.90, in
    front of the face at z -0.03, above y 1.44 for the back of the head, and
    further from the midline than 0.12. Each is now read from this body. Three
    of the four land near the number they replaced and one does not: on Mika the
    crown is 1.4402 against 1.44, the front -0.0246 against -0.03, the waist
    0.8782 against 0.90, and the midline 0.0918 against 0.12, which is 23%
    narrower. Not one of her 77 strands changes label anyway, because no strand
    sits in any of those gaps.

    Twelve of the other bodies do move strands, between 1 and 56 of them, which
    is the point: their old labels were Mika's numbers applied to a different
    skull. vroid-studio-dressup moves none because it has no strands at all.
    See evidence/hair-0912-relative.log.

    `left` is read off the eye bone rather than from the VRM version: the
    character's left is -X on a 0.x export and +X on a 1.0 one, and the bone
    says which without this having to know.

    Everything here is in the REST WORLD, which is why partition measures its
    strands with pose.skinned rather than reading POSITION straight. The two
    are the same file for file until vrm1to0 runs: it turns a 1.0 export around
    by parenting the scene to a node rotated 180 degrees, which moves every
    bone and leaves the vertex buffers alone. Comparing a bone against a raw
    POSITION after that put vrm1-twist-sample's entire head of hair in front of
    its eyes and labelled it a fringe.
    """
    bones, world = humanoid.bones(doc), humanoid.rest_world(doc)
    # No fallback to the head bone. It sits on the midline, so its x is
    # numerical noise -- 4.2e-05 on Mika, and positive on fifteen of the
    # sixteen -- and `left` would come out +1 on a 0.x body whose left is -X.
    # Its z is 29.7mm behind the eyes as well. Together they move 34 of Mika's
    # 77 strands, 32 from the side alone with the twintails and the side hair
    # mirrored and 2 more from the front. recognise() requires the bone
    # instead, which is a refusal that names what it wanted. Measured in
    # evidence/hair-0912-headbone.log.
    eye = np.asarray(world[bones['leftEye']])[:3, 3]
    rest, head = pose.skinned(doc, views), face_meshes(doc)[0]
    face = np.concatenate([
        rest[(head.get('name'), i)][
            np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())]
        for i, prim in enumerate(head['primitives'])])
    return {
        'waist': float(np.asarray(world[bones['hips']])[:3, 3][1]),
        'front': float(eye[2]),
        'crown': float((eye[1] + face[:, 1].max()) / 2),
        'midline': float(np.abs(face[:, 0]).max()),
        'forward': humanoid.forward_z(doc),
        'left': -1.0 if eye[0] < 0 else 1.0,
    }


def hair_name(material, centroid, ymin, frame):
    """Which part a hair strand belongs to, from where it sits on this body.

    CLIP_DECALS is the one thing here still measured on Mika rather than on the
    body in hand, and it costs two other bodies some hair: see the comment above
    it.
    """
    if material.endswith('HAIR_06'):
        return 'Acc_HairOrnament'
    side = 'L' if centroid[0] * frame['left'] > 0 else 'R'
    if ymin < frame['waist']:             # falls below the waist
        return f'Hair_Twintail_{side}'
    if (centroid[2] - frame['front']) * frame['forward'] > 0:   # in front of the eyes
        # Only in front of the face: HAIR_03 and HAIR_05 also carry ordinary
        # strands in the back and side hair, which must stay hair.
        return ('Acc_HairClip_Base' if material.endswith(CLIP_DECALS)
                else 'Hair_Bangs')
    if material.endswith(CLIP_DECALS) and abs(centroid[0]) > frame['midline']:
        # A lone star decal painted on the back hair. This rule runs before
        # proportion, so it sees x=+0.144; the shipped model scales the head
        # by 1.06 and it lands at +0.153. Either way it is further from the
        # midline than the skull itself, which is what `midline` measures.
        # twintail.apply moves the strands under it and not this primitive,
        # because it moves parts and this one is labelled Hair_Back, so after
        # the split it hangs in mid-air beside the head -- plainly visible in a
        # three-vrm close-up and in nothing the flat renders frame. The
        # reference has no such star, so it goes to the ornament bin that
        # mellowheart.REPLACES already empties.
        return 'Acc_HairOrnament'
    if centroid[1] > frame['crown']:
        return 'Hair_Back'
    return f'Hair_Side_{side}'


def split_primitive(doc, views, prim):
    """Give one primitive its own vertices. Returns a new primitive dict."""
    idx = glb.read_accessor(doc, views, prim['indices']).ravel().astype(np.int64)
    used, remap = np.unique(idx, return_inverse=True)
    new = {'mode': prim.get('mode', 4), 'attributes': {}}
    if 'material' in prim:
        new['material'] = prim['material']
    for attr, acc_index in prim['attributes'].items():
        arr = glb.read_accessor(doc, views, acc_index)[used]
        target = 34962
        new['attributes'][attr] = glb.add_accessor(
            doc, views, arr, target=target, minmax=(attr == 'POSITION'))
    tri = remap.astype(np.uint32 if len(used) > 65535 else np.uint16)
    new['indices'] = glb.add_accessor(doc, views, tri, target=34963)
    return new


def resolve_clashes(claims):
    """Give every claim on a part name a name of its own, in claim order.

    `claims` is one row per group of primitives that a mesh reads the same
    name out of the material grammar for, carrying that `label` and the
    group's `extent`, its vertical reach in metres. A manifest keys parts by
    name and a part belongs to one mesh, so when two meshes claim one name a
    second name has to come from somewhere. The plain name goes to the claim
    reaching furthest; the rest trail it with a number, in document order.

    Ranked on reach. VRoid Studio's dress-up export draws its skin
    in three layers: the body, and one unmasked copy of the torso under each
    garment. On that file before cover.trim cut the covered triangles away
    (git 6ae5189) each inner layer was 5,970 triangles against the body's
    4,139, so ranking on size hands `Body_Skin` to a patch with no head and no
    feet, which humanoid.body_skin, envelope.leg_vertices, garment.body_pool
    and measure.py would all then read as the body. Reach picks the body on
    either file, because masking hollows a body without shortening it: 1.578
    metres against the layers' 1.261.

    The number carries no meaning, because nothing measurable here does. The
    layer the hoodie sits on and the layer the jeans sit on hold the same 298
    vertices at the same coordinates and their materials carry the same name;
    only their meshes differ. Naming them after their meshes is what
    springsim's deriveManifest does and what the hand-written manifest for
    this body does (`Body_Skin_Inner_Top`), but this step stopped reading mesh
    names at stage 2b-i, and one of the names it would have to write is
    `Outfit_Shoes_Body (merged).baked(copy).baked`. Consumers read these by
    the prefix rather than the suffix: pierce.skin_parts takes every
    `Body_Skin_*` and `Face_*` as skin, cover.cloth_parts takes the rest.
    """
    rows = {}
    for i, claim in enumerate(claims):
        rows.setdefault(claim['label'], []).append(i)
    names, taken = [None] * len(claims), {c['label'] for c in claims}
    for label, group in rows.items():
        # Ties fall to document order, at both ends: rows are built in it, and
        # max returns the first maximal claim it meets.
        keeper = max(group, key=lambda i: claims[i]['extent'])
        names[keeper] = label
        n = 2
        for i in group:
            if i == keeper:
                continue
            # `label_2` can be a name the grammar already produced on its own,
            # and taking it would trade one collision for another.
            while f'{label}_{n}' in taken:
                n += 1
            names[i] = f'{label}_{n}'
            taken.add(names[i])
            n += 1
    return names


def partition(src, dst, parts_path):
    doc, binary = glb.load(src)
    views = glb.views_of(doc, binary)
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]

    reasons = recognise(doc)
    if reasons:
        raise SystemExit(
            f'{src} 不是這一步認得的 VRoid 匯出，拒絕命名：\n'
            + '\n'.join(f'  - {r}' for r in reasons)
            + '\n  這一步的部件名稱來自 VRoid 的材質文法與髮絲的絕對座標，'
              '換一具身體推不出來。硬跑會產生一份讀起來合理但是虛構的 parts.json，'
              '後面每一步都會相信它。')

    manifest = {'source': src, 'parts': {}}
    faces = {id(m) for m in face_meshes(doc)}
    frame = hair_frame(doc, views)
    # Before anything is rebuilt: split_primitive appends accessors, and these
    # are keyed by the primitive indices the loop below is about to replace.
    rest = pose.skinned(doc, views)

    # Read every name before writing any of them down. Which of two meshes
    # claiming one name keeps it cannot be decided from either mesh alone.
    claims, by_mesh = [], {}
    for mesh in doc['meshes']:
        if id(mesh) in faces:
            continue
        name = mesh.get('name')
        labels, drawn = [], []
        for index, prim in enumerate(mesh['primitives']):
            used = np.unique(glb.read_accessor(doc, views, prim['indices']).ravel())
            # The vertices this primitive draws, read through its indices.
            # A VRoid mesh shares one accessor across all of its primitives
            # (mika-pink's body mesh: seven primitives, one POSITION), so a raw
            # read gives the 20 triangles of shoe baked into the body mesh the
            # reach of the entire body, and they take `Outfit_Shoes` from the
            # shoes.
            p = rest[(name, index)][used]
            drawn.append(p)
            material = mats[prim['material']]
            label = body_name(material)
            if label is None:
                # recognise() has already refused every material the grammar
                # cannot place, so what reaches here unnamed is a strand, and
                # a strand is the one thing left that needs geometry.
                label = hair_name(material, p.mean(axis=0), p[:, 1].min(), frame)
            labels.append(label)
        for label in dict.fromkeys(labels):
            members = [i for i, l in enumerate(labels) if l == label]
            ys = np.concatenate([drawn[i][:, 1] for i in members])
            by_mesh.setdefault(id(mesh), []).append(len(claims))
            claims.append({'label': label, 'members': members,
                           'extent': float(ys.max() - ys.min())})

    resolved = resolve_clashes(claims)

    for mesh in doc['meshes']:
        name = mesh.get('name')
        if id(mesh) in faces:
            manifest['parts']['Face'] = {
                'mesh': name,
                'primitives': list(range(len(mesh['primitives']))),
                'tris': sum(doc['accessors'][p['indices']]['count'] // 3
                            for p in mesh['primitives']),
                'materials': sorted({mats[p['material']] for p in mesh['primitives']}),
                'deletable': False,
                'note': 'carries the 56 morph targets; splitting it breaks blendShapeMaster',
                'binding': dict(binding.EXPORTED),
            }
            continue

        rebuilt = [split_primitive(doc, views, prim) for prim in mesh['primitives']]
        for c in by_mesh.get(id(mesh), []):
            for i in claims[c]['members']:
                rebuilt[i].setdefault('extras', {})['part'] = resolved[c]
        mesh['primitives'] = rebuilt

        for c in by_mesh.get(id(mesh), []):
            label, members = resolved[c], claims[c]['members']
            if label in manifest['parts']:
                # resolve_clashes owes every claim a name of its own. If two
                # arrive here alike the manifest keeps the second in silence,
                # and half the geometry the name covers is gone from every step
                # that reads it.
                raise SystemExit(
                    f'{src}：{name} 與 {manifest["parts"][label]["mesh"]} '
                    f'都拿到部件名稱 {label}，resolve_clashes 沒有把它們分開。')
            manifest['parts'][label] = {
                'mesh': name,
                'primitives': members,
                'tris': sum(doc['accessors'][rebuilt[i]['indices']]['count'] // 3
                            for i in members),
                'materials': sorted({mats[rebuilt[i]['material']] for i in members}),
                'deletable': not label.startswith('Body_'),
                'binding': dict(binding.EXPORTED),
            }

    blob = glb.rebuild(doc, views)
    size = glb.save(dst, doc, blob)
    json.dump(manifest, open(parts_path, 'w'), indent=2, ensure_ascii=False)
    return manifest, size


if __name__ == '__main__':
    m, size = partition(sys.argv[1], sys.argv[2], sys.argv[3])
    print(f'wrote {sys.argv[2]} ({size} bytes) and {sys.argv[3]}')
    for name, p in sorted(m['parts'].items(), key=lambda kv: -kv[1]['tris']):
        flag = '' if p['deletable'] else '  [locked]'
        print(f'  {name:<20} {len(p["primitives"]):>3} prim  {p["tris"]:>6} tris{flag}')
