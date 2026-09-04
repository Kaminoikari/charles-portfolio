import sys, os, json, struct, io, colorsys
sys.path.insert(0, '/Users/charles/portfolio/scripts/avatar')
import numpy as np
from PIL import Image
from scipy import ndimage
import glb
S = os.path.dirname(os.path.abspath(__file__))
doc, binary = glb.load('/Users/charles/portfolio/public/avatar/mika-milfy-5.vrm')
views = glb.views_of(doc, binary)
def img(name):
    im = next(i for i in doc['images'] if i.get('name') == name)
    return np.asarray(Image.open(io.BytesIO(bytes(views[im['bufferView']]))).convert('RGBA')).astype(float) / 255
def purple_mask(a):
    rgb = a[..., :3]; h, l, s = np.vectorize(colorsys.rgb_to_hls)(rgb[..., 0], rgb[..., 1], rgb[..., 2])
    return (a[..., 3] > 0.5) & (h * 360 > 240) & (h * 360 < 330) & (s > 0.15) & (l > 0.1) & (l < 0.95)
# crops of the unlit nape renders with purple highlighted
for v, box in (('nape_back', (300, 680, 600, 820)), ('nape_r', (200, 380, 460, 760)), ('nape_l', (440, 400, 700, 730))):
    a = np.asarray(Image.open(os.path.join(S, f'nape-{v}.png')).convert('RGB')).astype(float) / 255
    m = purple_mask(np.dstack([a, np.ones(a.shape[:2])]))
    out = (a * 255).astype(np.uint8).copy(); out[m] = [0, 255, 0]
    x0, y0, x1, y1 = box
    Image.fromarray(out[y0:y1, x0:x1]).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.NEAREST).save(os.path.join(S, f'crop-{v}.png'))
    Image.fromarray((a[y0:y1, x0:x1] * 255).astype(np.uint8)).resize(((x1 - x0) * 3, (y1 - y0) * 3), Image.NEAREST).save(os.path.join(S, f'crop-{v}-raw.png'))
# texel clusters and the vertices that sample them
world = None
import render
world = render.world_matrices(doc)
for tex in ('F00_000_00_Body_00', 'F00_000_00_Face_00'):
    a = img(tex); m = purple_mask(a)
    lab, n = ndimage.label(m)
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1]
    print(f'== {tex}: {int(m.sum())} purple texels in {n} clusters; top clusters (size, bbox x0,y0,x1,y1, median rgb):')
    for k in order[:8]:
        ys, xs = np.nonzero(lab == k + 1)
        med = (np.median(a[lab == k + 1][:, :3], axis=0) * 255).round()
        print(f'   {int(sizes[k]):6d}  ({xs.min()},{ys.min()})-({xs.max()},{ys.max()})  {med}')
    # which mesh vertices sample purple texels
    H, W = m.shape
    tex_index = next(i for i, im in enumerate(doc['images']) if im.get('name') == tex)
    tidx = {i for i, t in enumerate(doc['textures']) if t.get('source') == tex_index}
    mat_idx = {i for i, mt in enumerate(doc['materials']) if mt.get('pbrMetallicRoughness', {}).get('baseColorTexture', {}).get('index') in tidx}
    hits = []
    for node_i, node in enumerate(doc['nodes']):
        if 'mesh' not in node: continue
        mesh = doc['meshes'][node['mesh']]
        for pi, pr in enumerate(mesh['primitives']):
            if pr.get('material') not in mat_idx: continue
            pos = glb.read_accessor(doc, views, pr['attributes']['POSITION'])
            uv = glb.read_accessor(doc, views, pr['attributes']['TEXCOORD_0'])
            px = np.clip((uv[:, 0] % 1.0 * W).astype(int), 0, W - 1); py = np.clip((uv[:, 1] % 1.0 * H).astype(int), 0, H - 1)
            hit = m[py, px]
            if hit.any():
                p = pos[hit]
                hits.append((mesh['name'], pi, int(hit.sum()), p[:, 1].min(), p[:, 1].max(), p[:, 2].min(), p[:, 2].max(), np.abs(p[:, 0]).max()))
    for h in hits:
        print(f'   verts sampling purple: {h[0]} prim {h[1]}: {h[2]} verts, y {h[3]:.3f}-{h[4]:.3f}, z {h[5]:.3f}-{h[6]:.3f}, |x|max {h[7]:.3f}')
