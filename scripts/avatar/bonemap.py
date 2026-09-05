"""Map a garment's bones onto the VRM humanoid names, whatever the vendor
called them.

A garment arrives rigged to somebody else's armature. To fit it we need to
know which of its bones is the left upper arm, which the hips, and so on, and
the only thing the file offers is names: `Upper_arm.L` in one export,
`Upper_arm_L` in the next from the same vendor, `J_Bip_L_UpperArm` from VRoid,
`mixamorig:LeftArm` from Mixamo, `Bone.007` from someone who never named
anything. Until 2026-09-05 outfit.py carried a sixteen-entry table keyed on
the exact spelling of one vendor and a two-line separator fix for that
vendor's second file; the 2026-09-02 cardigan failure (four bones paired out
of a hundred and twenty-eight, fit refused) is what a new spelling does to a
table like that.

Three stages, each only filling what the one before left open:

  override   the vendor file under bonemap/<vendor>.json: explicit aliases
             (fingers live here, their naming is too varied for a generic
             table), glob patterns to ignore, and a mirror flag for rigs whose
             +X is the character's right.
  alias      canonical(name) strips separators, numeric suffixes, side tokens
             and known prefixes down to a stem, and ALIASES maps stems to
             humanoid names. Sides come from the name (`.L`, `_L`, ` L`,
             `Left…`, `L_…`) and are re-attached to the humanoid name.
  topology   for whatever is still open: hips is the skinned root with three
             or more chains, legs are the two children that go down, the
             spine goes up, arms leave the trunk sideways where two lateral
             chains branch, and sides are the sign of x in the vendor's own
             frame. Trunk (hips to head) and limbs only, no fingers, eyes or
             jaw; a limb already partly named is extended from its deepest
             named bone rather than re-derived, and a trunk bone the alias
             stage named keeps that name.

Garment chains (skirt panels, breasts, ribbons, support bones) are never
humanoid bones. They fall through alias because no alias names them, and
NEVER_HUMANOID keeps topology from mistaking a breast chain that leaves the
chest sideways for an arm. What stays unmapped is reported, not hidden: the
fit prints the table, and require() refuses a mapping that would leave
weighted vertices with nothing to hang from.
"""
import fnmatch
import json
import os
import re

import numpy as np

import humanoid

# ---------------------------------------------------------------- naming ---

# Stripped from the front before looking for a side token. Lower-case; the
# comparison is case-insensitive.
PREFIXES = ('mixamorig:', 'mixamorig', 'j_bip_', 'j_sec_', 'def-', 'org-', 'mch-')

# stem -> humanoid name without side. Names in SIDED get 'left'/'right' from
# the bone's side token; the others are centre bones and ignore a side.
ALIASES = {
    'hips': 'hips', 'pelvis': 'hips',
    'spine': 'spine', 'spine1': 'chest', 'spine2': 'upperChest',
    'chest': 'chest', 'upperchest': 'upperChest',
    'neck': 'neck', 'head': 'head', 'jaw': 'jaw',
    'shoulder': 'Shoulder', 'clavicle': 'Shoulder',
    'upperarm': 'UpperArm', 'arm': 'UpperArm', 'uparm': 'UpperArm',
    'lowerarm': 'LowerArm', 'forearm': 'LowerArm',
    'hand': 'Hand', 'wrist': 'Hand',
    'upperleg': 'UpperLeg', 'thigh': 'UpperLeg', 'upleg': 'UpperLeg',
    'lowerleg': 'LowerLeg', 'shin': 'LowerLeg', 'calf': 'LowerLeg', 'leg': 'LowerLeg',
    'foot': 'Foot', 'ankle': 'Foot',
    'toe': 'Toes', 'toes': 'Toes', 'toebase': 'Toes',
    'eye': 'Eye',
}
SIDED = {'Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg',
         'Foot', 'Toes', 'Eye', 'ThumbProximal', 'ThumbIntermediate', 'ThumbDistal',
         'IndexProximal', 'IndexIntermediate', 'IndexDistal',
         'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal',
         'RingProximal', 'RingIntermediate', 'RingDistal',
         'LittleProximal', 'LittleIntermediate', 'LittleDistal'}

# Every humanoid name VRM 0.x can declare, for callers that want to map a rig
# against "any body" rather than one file.
VRM_NAMES = (
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'jaw', 'leftEye', 'rightEye',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
) + tuple(
    f'{side}{finger}{joint}'
    for side in ('left', 'right')
    for finger in ('Thumb', 'Index', 'Middle', 'Ring', 'Little')
    for joint in ('Proximal', 'Intermediate', 'Distal')
)

# Stems (prefix match) that topology must never take for a limb.
NEVER_HUMANOID = ('skirt', 'breast', 'bust', 'supportbone', 'outer', 'ribbon',
                  'pouch', 'butt', 'mainr', 'shoes', 'hair', 'tail', 'sleeve',
                  'cloth', 'armature', 'root', 'tag', 'acc')

# VRM 1.0 renamed the thumb joints. The table and the vendor files speak 0.x;
# a 1.0 target (it declares a Metacarpal, which 0.x never does) is looked up
# through this rename, so 0.x `Proximal` lands on the 1.0 metacarpal rather
# than on the 1.0 joint that merely shares its name.
THUMB_VRM1 = {'ThumbProximal': 'ThumbMetacarpal', 'ThumbIntermediate': 'ThumbProximal',
              'ThumbDistal': 'ThumbDistal'}

# The keys a vendor file may carry; anything else is a typo that would
# otherwise fail silently (an `ignores` list nobody reads).
OVERRIDE_KEYS = {'_comment', 'aliases', 'ignore', 'mirror'}

_SUFFIX = re.compile(r'\.\d{3}(?=[._ ]|$)')
_TRAILING_SIDE = re.compile(r'[._ ]([LR])$')
_LEADING_LETTER = re.compile(r'^([LRC])[._ ]')
_LEADING_WORD = re.compile(r'^(left|right)[._ ]?', re.I)


def canonical(name):
    """(stem, side) for a bone name: lower-case alphanumerics, and 'L'/'R'
    or None. Blender's `.001` suffixes are dropped wherever they sit, so
    `Breast_L.001` still reads as a left-side bone."""
    if not name:
        return '', None
    s = _SUFFIX.sub('', name)
    side = None
    m = _TRAILING_SIDE.search(s)
    if m:
        side = m.group(1)
        s = s[:m.start()]
    low = s.lower()
    for p in PREFIXES:
        if low.startswith(p):
            s = s[len(p):]
            break
    m = _LEADING_LETTER.match(s)
    if m:
        if side is None and m.group(1) in 'LR':
            side = m.group(1)
        s = s[m.end():]
    else:
        m = _LEADING_WORD.match(s)
        if m:
            if side is None:
                side = 'L' if m.group(1).lower() == 'left' else 'R'
            s = s[m.end():]
    return re.sub(r'[^a-z0-9]', '', s.lower()), side


def _with_side(base, side):
    """The humanoid name for a base and a side, or None when a sided base has
    no side to attach."""
    # Vendor files write the sided base the VRM way (`thumbProximal`); the
    # table writes it capitalised. Both mean the same slot.
    cap = base[:1].upper() + base[1:]
    if cap in SIDED:
        if side is None:
            return None
        return ('left' if side == 'L' else 'right') + cap
    return base


def _never(name):
    stem, _ = canonical(name)
    return any(stem.startswith(p) for p in NEVER_HUMANOID)


# --------------------------------------------------------------- resolve ---

class BadMapping(Exception):
    """The garment cannot be fitted with this mapping; the message says why."""


def load_override(path):
    """The vendor file as a dict; a missing or malformed file names itself."""
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError) as e:
        raise BadMapping(f'讀不到 bonemap override {path}：{e}') from e


def from_blender(v):
    """A Blender world vector (Z up, -Y forward) the way the glTF exporter
    writes it (Y up, +Z forward): (x, y, z) -> (x, z, -y). topology() reads
    height off index 1, so an armature inspected inside Blender has to come
    through here first."""
    x, y, z = v
    return [x, z, -y]


def resolve(src, target_bones, override=None):
    """Map the source skin's joints onto humanoid names.

    Returns a dict:
      names          source node -> humanoid name (0.x spelling)
      how            source node -> 'override' | 'alias' | 'topology'
      pairs          [(source node, target node)] for names the target declares
      unmapped_nodes source joint names that map to nothing, in joint order
      unmapped_bones target humanoid names no source bone landed on
      not_in_target  humanoid names mapped on the source that the target lacks
    """
    override = override or {}
    unknown = sorted(set(override) - OVERRIDE_KEYS)
    if unknown:
        raise BadMapping(f'bonemap override 有不認得的鍵 {unknown}；認得的是 {sorted(OVERRIDE_KEYS - {"_comment"})}')
    aliases = {canonical(k)[0]: v for k, v in (override.get('aliases') or {}).items()}
    ignore = list(override.get('ignore') or [])
    mirror = bool(override.get('mirror', False))
    nodes = src['nodes']
    joints = list(src['skins'][0]['joints']) if src.get('skins') else list(range(len(nodes)))

    def ignored(i):
        # `.` and `_` are the same separator to a pattern: one vendor's two
        # files spell the same bone Lower_arm.L and Lower_arm_L.
        raw = nodes[i].get('name', '')
        flat = raw.replace('.', '_')
        return any(fnmatch.fnmatchcase(raw, pat) or fnmatch.fnmatchcase(flat, pat.replace('.', '_'))
                   for pat in ignore)

    names, how, taken = {}, {}, set()
    for i in joints:
        if ignored(i):
            continue
        stem, side = canonical(nodes[i].get('name', ''))
        if mirror and side:
            side = 'R' if side == 'L' else 'L'
        if stem in aliases:
            base, source = aliases[stem], 'override'
        elif stem in ALIASES:
            base, source = ALIASES[stem], 'alias'
        else:
            continue
        vrm = _with_side(base, side)
        if vrm is None or vrm in taken:
            continue
        names[i], how[i] = vrm, source
        taken.add(vrm)

    live = [i for i in joints if not ignored(i)]
    for i, vrm in topology(src, live, names, mirror).items():
        if vrm not in taken:
            names[i], how[i] = vrm, 'topology'
            taken.add(vrm)

    pairs, not_in_target = [], []
    for i, vrm in names.items():
        t = _target_node(vrm, target_bones)
        if t is None:
            not_in_target.append(vrm)
        else:
            pairs.append((i, t))
    return {
        'names': names, 'how': how, 'pairs': pairs,
        'unmapped_nodes': [nodes[i].get('name', '') for i in joints if i not in names],
        'unmapped_bones': sorted(set(target_bones) - set(_target_name(v, target_bones) for v in names.values())),
        'not_in_target': not_in_target,
    }


def _target_name(vrm, target_bones):
    """The target's spelling of a 0.x humanoid name (see THUMB_VRM1)."""
    if 'leftThumbMetacarpal' in target_bones or 'rightThumbMetacarpal' in target_bones:
        for old, new in THUMB_VRM1.items():
            if vrm.endswith(old):
                return vrm[:-len(old)] + new
    return vrm


def _target_node(vrm, target_bones):
    return target_bones.get(_target_name(vrm, target_bones))


# -------------------------------------------------------------- topology ---

TRUNK = ('spine', 'chest', 'upperChest')
ARM = ('Shoulder', 'UpperArm', 'LowerArm', 'Hand')
LEG = ('UpperLeg', 'LowerLeg', 'Foot', 'Toes')


def topology(src, joints, known, mirror=False):
    """Humanoid names for still-open trunk and limb slots, from where the
    bones are.

    `known` is the alias stage's node -> name map; no node in it is renamed
    (the trunk loops check that per node; limb assignment starts below the
    deepest named bone so it never reaches one), and a name it already uses
    is dropped again by resolve()'s merge. Returns only the new node -> name
    entries.
    """
    nodes = src['nodes']
    jset = set(joints)
    world = humanoid.node_world(src)
    pos = {i: np.array(world[i])[:3, 3] for i in joints}
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}
    kids = {i: [c for c in nodes[i].get('children', ()) if c in jset and not _never(nodes[c].get('name', ''))]
            for i in joints}
    inv = {v: k for k, v in known.items()}
    out = {}

    def descendants(i):
        n, stack = 0, list(kids[i])
        while stack:
            c = stack.pop()
            n += 1
            stack.extend(kids[c])
        return n

    def delta(c, p):
        return pos[c] - pos[p]

    def main_child(i, central=False):
        """The child a chain continues through: the one with most descendants,
        or, on the trunk, the most nearly vertical one."""
        cs = kids[i]
        if not cs:
            return None
        if central:
            up = [c for c in cs if delta(c, i)[1] > 0]
            if not up:
                return None
            return min(up, key=lambda c: abs(delta(c, i)[0]) / (abs(delta(c, i)).sum() + 1e-9))
        return max(cs, key=lambda c: (descendants(c), abs(delta(c, i)).sum()))

    def chain_down(start):
        chain, i = [], start
        while True:
            i = main_child(i)
            if i is None or i in chain:
                return chain
            chain.append(i)

    def side_of(c, p):
        s = 'L' if delta(c, p)[0] > 0 else 'R'
        if mirror:
            s = 'R' if s == 'L' else 'L'
        return s

    def assign(slots, chain, side):
        """Fill open slots down a chain. If some slot is already known, start
        after the deepest known one, from that bone."""
        full = [_with_side(s, side) for s in slots]
        deepest = max((k for k, name in enumerate(full) if name in inv), default=-1)
        if deepest >= 0:
            chain = [inv[full[deepest]]] + chain_down(inv[full[deepest]])
            chain = chain[1:]
            todo = full[deepest + 1:]
        else:
            todo = full
        for name, node in zip(todo, chain):
            # Only nodes this pass has not touched. Name collisions with the
            # alias stage are settled once, in resolve()'s merge.
            if node in out:
                break
            out[node] = name

    # hips
    if 'hips' in inv:
        hips = inv['hips']
    else:
        roots = [j for j in joints if parent.get(j) not in jset]
        roots = [r for r in roots if len(kids[r]) >= 3]
        if not roots:
            return out
        hips = max(roots, key=descendants)
        out[hips] = 'hips'

    # legs: the two children that go down furthest, one per side
    down = sorted((c for c in kids[hips] if delta(c, hips)[1] < 0), key=lambda c: delta(c, hips)[1])[:2]
    for c in down:
        assign(LEG, [c] + chain_down(c), side_of(c, hips))
    for side in ('L', 'R'):
        if _with_side('UpperLeg', side) in inv:
            assign(LEG, [], side)

    # trunk: up from hips to where two lateral chains branch
    up = [c for c in kids[hips] if delta(c, hips)[1] > 0]
    spine = inv.get('spine') or (max(up, key=lambda c: delta(c, hips)[1]) if up else None)
    if spine is None:
        return out
    trunk, i = [spine], spine

    def lateral(i):
        """Children whose chain ENDS out to the side. Judged on the chain's
        end rather than its first segment because a shoulder bone leaves the
        chest almost vertically before the arm turns outward."""
        out_ = []
        for c in kids[i]:
            end = ([c] + chain_down(c))[-1]
            d = delta(end, i)
            if abs(d[0]) > abs(d[1]) and abs(d[0]) > 0.01:
                out_.append(c)
        return out_

    branch = None
    while True:
        if len(lateral(i)) >= 2:
            branch = i
        nxt = main_child(i, central=True)
        if nxt is None or nxt in trunk:
            break
        trunk.append(nxt)
        i = nxt
    if branch is None:
        before, after = trunk[:-2] if len(trunk) > 2 else trunk[:1], trunk[len(trunk[:-2] if len(trunk) > 2 else trunk[:1]):]
    else:
        b = trunk.index(branch)
        before, after = trunk[:b + 1], trunk[b + 1:]
    trunk_names = list(TRUNK[:len(before)])
    if len(before) > 3:
        trunk_names = ['spine', 'chest'] + [None] * (len(before) - 3) + ['upperChest']
    for node, name in zip(before, trunk_names):
        if name and node not in known:
            out[node] = name
    for node, name in zip(after, ('neck', 'head')):
        if node not in known:
            out[node] = name

    # arms: from the branch (or the known chest/upperChest) sideways
    if branch is None:
        branch = inv.get('upperChest') or inv.get('chest')
    if branch is not None:
        for c in lateral(branch):
            chain = [c] + chain_down(c)
            # Four bones is shoulder, upper, lower, hand. Three could be either
            # an arm without a shoulder or one without a hand; a first segment
            # much shorter sideways than the second is a shoulder.
            slots = ARM
            if len(chain) < 4:
                seg0 = abs(delta(chain[0], branch)[0])
                seg1 = abs(delta(chain[1], chain[0])[0]) if len(chain) >= 2 else 0.0
                if seg0 >= 0.5 * seg1:
                    slots = ARM[1:]
            assign(slots, chain, side_of(c, branch))
    for side in ('L', 'R'):
        for slot in ARM:
            if _with_side(slot, side) in inv:
                assign(ARM, [], side)
                break
    return out


# --------------------------------------------------------------- require ---

MIN_ANCHORS = 8
TRUNK_ANCHORS = ('chest', 'upperChest', 'neck', 'head')


def require(mapping, src, weighted_joints):
    """Refuse a mapping the fit cannot use, naming what is missing.

    `weighted_joints` are the source joints some vertex is weighted to; each
    needs a mapped bone at or above it, or that cloth would have nothing to
    follow. The fit itself needs hips, one trunk anchor above the spine and
    MIN_ANCHORS pairs the target actually declares.
    """
    nodes = src['nodes']
    names = mapping['names']
    values = set(names.values())
    if 'hips' not in values:
        raise BadMapping('骨骼對應缺 hips：沒有它服裝鏈骨沒有錨點。' + _hint(mapping))
    if not any(t in values for t in TRUNK_ANCHORS):
        raise BadMapping('骨骼對應缺 chest／upperChest／neck／head 之一：擬合沒有上身錨點。' + _hint(mapping))
    if len(mapping['pairs']) < MIN_ANCHORS:
        raise BadMapping(f'只對上 {len(mapping["pairs"])} 根骨（至少 {MIN_ANCHORS}），不足以擬合。' + _hint(mapping))
    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}
    for j in sorted(weighted_joints):
        i = j
        while i is not None and i not in names:
            i = parent.get(i)
        if i is None:
            raise BadMapping(f'骨 {nodes[j].get("name", j)!r} 帶有服裝權重，但它與所有祖先都沒對到 humanoid 骨。' + _hint(mapping))


def _hint(mapping):
    un = mapping['unmapped_nodes']
    return f' 未對應的來源骨 {len(un)} 根：{un[:12]}{"…" if len(un) > 12 else ""}'


# ----------------------------------------------------------------- table ---

def table(mapping, src):
    """One line per mapped source bone, then the leftovers, for the build log."""
    nodes = src['nodes']
    lines = []
    for i in sorted(mapping['names']):
        lines.append(f'   {nodes[i].get("name", i):<28} → {mapping["names"][i]:<20} ({mapping["how"][i]})')
    if mapping['not_in_target']:
        lines.append(f'   目標身體沒有的骨（對到了但不當錨點）：{mapping["not_in_target"]}')
    un = mapping['unmapped_nodes']
    # The chains by stem, so a humanoid bone that fell through (a misspelt
    # `Lowerarm`, say) is visible among them instead of hidden in a count.
    stems = {}
    for name in un:
        stem = canonical(name)[0] or name
        stems[stem] = stems.get(stem, 0) + 1
    listed = ', '.join(f'{s}×{n}' if n > 1 else s for s, n in sorted(stems.items()))
    lines.append(f'   未對應的來源骨 {len(un)} 根（服裝鏈骨，跟著錨點走）：{listed}')
    return '\n'.join(lines)


if __name__ == '__main__':
    import sys
    import glb
    import humanoid
    if len(sys.argv) < 3:
        raise SystemExit('用法: bonemap.py <garment.glb> <target.vrm> [override.json]')
    src, _ = glb.load(sys.argv[1])
    tgt = humanoid.read(sys.argv[2])
    ov = load_override(sys.argv[3]) if len(sys.argv) > 3 else None
    m = resolve(src, humanoid.bones(tgt), ov)
    print(table(m, src))
    if os.environ.get('BONEMAP_REQUIRE', '1') == '1':
        require(m, src, set(src['skins'][0]['joints']))
