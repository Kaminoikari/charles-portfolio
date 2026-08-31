"""Count clipping the way a viewer sees it: skin drawn inside a garment.

The parity test in inside.py answers a different question. It says whether a
garment vertex has ended up within the body's volume, and a great deal of that is
invisible: the lining of a collar, the inside of a slipper, a wrap whose back
face sits in the calf it is wrapped around. At the five worst frames it flagged,
nothing could be seen on screen at all.

What a viewer calls 穿模 is skin appearing where cloth should be, so the frame is
drawn twice, once with only skin and once with only garments, and the two depth
buffers are compared. Where the skin is nearer to the camera than the cloth, the
body has come through it.

One more condition, and it is what makes the measure usable: the two surfaces
must be within 30mm of each other. Cloth buried in the limb it is wrapped around
sits a few millimetres inside the skin. A wrap on the FAR leg also has skin in
front of it, by 120mm, and is simply hidden the way a solid body hides things;
without the distance limit every garment on the far side of the model counts as
clipping, which is how a clean render first measured at 3000 pixels.

Two earlier attempts are worth recording. Looking for skin trapped inside a
garment's filled silhouette finds a heel through a slipper and misses a wrap
narrower than the shin, where the body swallows the cloth and encloses nothing.
Culling back faces first, to keep a tube's far wall out of it, assumes the
garments and the body wind their triangles the same way, and they do not.

Views matter. A defect on the back is invisible from the front, so every frame is
counted from three angles and the worst is kept.

BARE arms are not counted, and the reason is worth keeping because the measure
said FAIL for three rounds on a model that renders clean. "Skin in front of
cloth" describes a hand resting on a hip exactly as well as it describes a hip
coming through a skirt. It did not matter while the hand-built outfit was on,
because that one had sleeves and an arm was cloth. The imported bodice has
none, and from the side every pose that brought an arm near the body put nine
hundred pixels of bare forearm in front of the skirt behind it, at a median
depth of 18mm, which is inside the 30mm window. Zooming into those frames
showed the garment covering the bust and the hip completely.

So the skin map drops the arms -- but only where nothing is wearing them. The
cardigan has sleeves, and an arm coming through a sleeve is exactly what this
gate exists to catch, so "drop the arms" as a blanket rule would blind it the
moment the outfit changed. An arm vertex is kept when there is cloth WEIGHTED
TO AN ARM BONE within 40mm of it, which is what a sleeve is and what a skirt
the hand happens to rest on is not.

The same flaw survives the arms, one layer up, and the fix for it is the second
condition. With the arms gone the worst frame was 487 pixels on Outfit_Top, at
the bare shoulder above a strapless bodice: the cloth sitting 12mm behind that
shoulder is the FAR side of the bodice, seen from the inside through a neckline
the garment is supposed to have. A body that has burst out of a garment leaves
the opposite arrangement behind it -- the garment's OUTER face, right where the
skin came through.

That separates the two cleanly. On the frame above, 776 of 781 flagged pixels
had the bodice's inner face behind the skin; pulling the same bodice 25mm into
the body, which is unmistakable clipping, flips it to 10,432 outer of 11,230.
So a pixel counts only when the cloth behind the skin faces the camera. The side
is read off the authored NORMAL attribute and never off the winding, which the
garments and the body do not share -- the same reason the rasteriser does no
backface culling.

The third condition is the same idea again, one limb over: skin and cloth have
to belong to the same side of the body. From directly beside the model the legs
overlap, and the near calf sits about 23mm in front of the FAR leg's sock -- a
gap inside the window, with that sock's outer face towards the camera, so the
first two conditions both pass on a frame that renders clean. Anything centred
or mixed counts as matching either side, which keeps a hip through a skirt.

All three conditions were checked the same way, by breaking the model on
purpose: sinking a garment 25mm into itself scores 8 to 38 times its limit for
the bodice, skirt, cardigan and socks, and shrinking the boot a tenth scores
2.8, while the model as shipped is under 0.1 everywhere.
"""
import json
import os
import sys

import numpy as np
from scipy.spatial import cKDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import glb  # noqa: E402
import partmap  # noqa: E402
import render  # noqa: E402

VIEWS = {'front': (180.0, 0.0, 'full'),
         'back': (0.0, 0.0, 'full'),
         'side': (270.0, 0.0, 'full')}
SKIN = ('Body_Skin', 'Face')
LIMIT = 0.030    # metres; past this the body is simply in the way, not pierced

# A part counts as clipping when its pierced pixels pass EITHER an absolute
# count or a share of the pixels that part covers on screen. One criterion
# alone is not enough. The absolute one is blind to small parts: at full-body
# framing a boot is 3,600 pixels against the cardigan's 33,000, and shrinking
# the boot by a tenth -- plainly wrong in a close-up, and a defect of exactly
# that kind was visible while measuring 66 -- comes to 97. The relative one
# alone would trip the largest parts over a scratch, since 2% of the cardigan
# is 667 pixels of nothing much. Whichever fires first.
ABSOLUTE = 150
SHARE = 0.02
FLOOR = 30       # under this a part is too few pixels for a share to mean anything


def limit(area):
    """The pixel count at which a part of this on-screen size counts as clipping."""
    return min(ABSOLUTE, max(FLOOR, SHARE * area))
ARM = ('Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'Thumb', 'Index',
       'Middle', 'Ring', 'Little')
SLEEVE = 0.040   # metres; arm skin this close to arm-driven cloth is dressed
def _arm_triangles(doc, views, parts, posed=None):
    """A triangle mask, in draw order, marking BARE arm skin.

    Selected by dominant joint, so a shoulder vertex that is mostly chest stays,
    and a triangle counts only when all three of its corners do. Arm skin with
    arm-driven cloth within SLEEVE of it is left in: it is wearing a sleeve, and
    a sleeve is something an arm can pierce.
    """
    skin = doc['skins'][0]
    names = [doc['nodes'][j].get('name', '') for j in skin['joints']]
    bone = {b['node']: b['bone'] for b
            in doc['extensions']['VRM']['humanoid']['humanBones']}
    arm = np.array([any(a.lower() in bone.get(j, names[k]).lower() for a in ARM)
                    for k, j in enumerate(skin['joints'])])
    flesh = {(parts[n]['mesh'], i) for n in SKIN if n in parts
             for i in parts[n]['primitives']}
    cloth = {(parts[n]['mesh'], i) for n in parts
             if n.startswith(('Outfit_', 'Acc_'))
             for i in parts[n]['primitives']}

    def read(mesh, pi, pr):
        key = (mesh.get('name'), pi)
        pos = (posed[key] if posed and key in posed
               else glb.read_accessor(doc, views, pr['attributes']['POSITION']))
        j = glb.read_accessor(doc, views, pr['attributes']['JOINTS_0'])
        w = glb.read_accessor(doc, views, pr['attributes']['WEIGHTS_0']).astype(np.float64)
        return (np.asarray(pos, dtype=np.float64),
                arm[j[np.arange(len(j)), np.argmax(w, axis=1)]])

    sleeves = []
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            if (mesh.get('name'), pi) in cloth:
                pos, on_arm = read(mesh, pi, pr)
                sleeves.append(pos[on_arm])
    sleeves = np.concatenate(sleeves) if sleeves else np.zeros((0, 3))
    tree = cKDTree(sleeves) if len(sleeves) else None

    mask = []
    for mesh in doc['meshes']:
        for pi, pr in enumerate(mesh['primitives']):
            idx = glb.read_accessor(doc, views, pr['indices']).astype(np.int64).reshape(-1, 3)
            if (mesh.get('name'), pi) not in flesh:
                mask.append(np.zeros(len(idx), bool))
                continue
            pos, on_arm = read(mesh, pi, pr)
            bare = on_arm.copy()
            if tree is not None and on_arm.any():
                d, _ = tree.query(pos[on_arm])
                bare[on_arm] = d > SLEEVE
            mask.append(bare[idx].all(axis=1))
    return np.concatenate(mask)


def count(doc, views, parts, posed=None, size=(420, 720), detail=False):
    """part -> pixels of skin showing inside that part's own silhouette.

    With `detail`, also returns how many pixels each part covers at all. A
    single pixel count cannot be judged without it: at full-body framing a boot
    is 3,600 pixels and the cardigan is 33,000, so the same absolute number is
    a scratch on one and a hole in the other. Shrinking the boot by a tenth --
    unmistakable on screen, and a defect of exactly this kind was visible in a
    close-up while measuring 66 -- moves it to 97, which any threshold loose
    enough for the cardigan sails past.
    """
    everything = set(parts)
    keep = render.VIEWS
    render.VIEWS = VIEWS
    try:
        _, _, cloth = partmap.draw(doc, views, parts, None, size,
                                   tuple(VIEWS), posed, exclude=SKIN, facing=True)
        _, _, flesh = partmap.draw(doc, views, parts, None, size,
                                   tuple(VIEWS), posed,
                                   exclude=tuple(everything - set(SKIN)),
                                   drop=_arm_triangles(doc, views, parts, posed),
                                   facing=True)
    finally:
        render.VIEWS = keep

    worst, area = {}, {}
    for view, (who, names, cloth_z, outward, cloth_limb) in cloth.items():
        index = {n: i for i, n in enumerate(names)}
        skin_z, skin_limb = flesh[view][2], flesh[view][4]
        gap = skin_z - cloth_z
        same = (cloth_limb == skin_limb) | (cloth_limb == 0) | (skin_limb == 0)
        pierced = ((who >= 0) & (flesh[view][0] >= 0) & (gap > 0) & (gap < LIMIT)
                   & outward & same)
        for name in names:
            if not name.startswith(('Outfit_', 'Acc_')):
                continue
            mine = who == index[name]
            worst[name] = max(worst.get(name, 0), int((pierced & mine).sum()))
            area[name] = max(area.get(name, 0), int(mine.sum()))
    return (worst, area) if detail else worst


if __name__ == '__main__':
    base = os.path.dirname(os.path.abspath(__file__))
    doc, binary = glb.load(os.path.join(base, 'out', 'mika-milfy.vrm'))
    views = glb.views_of(doc, binary)
    parts = json.load(open(os.path.join(base, 'out', 'mika-milfy.parts.json')))['parts']
    r, a = count(doc, views, parts, detail=True)
    print('at rest, skin pixels showing through each garment:')
    ok = True
    for name, n in sorted(r.items(), key=lambda kv: -kv[1]):
        if not n:
            continue
        lim = limit(a.get(name, 0))
        ok &= n <= lim
        print(f'  {name:<24} {n:>5} px  of {lim:>5.0f} allowed '
              f'({a.get(name, 0)} px on screen)')
    print(f'  total {sum(r.values())}   {"PASS" if ok else "FAIL"}')
    sys.exit(0 if ok else 1)
