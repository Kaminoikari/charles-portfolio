# Repacks a VRM0 (.vrm GLB) with WebP textures via EXT_texture_webp.
# Written for the 2026-08-14 表演力升級 Batch 3-G experiment:
# AvatarSample_B.vrm 15.4MB -> 5.5MB with every VRM extension intact.
#
# Why not gltf-transform: it has no VRM extension implementation, so
# `optimize` silently DROPS the entire VRM extension (blendshapes, spring
# bones, MToon) — verified 2026-08-14. This script instead only swaps image
# payloads and re-offsets bufferViews; mesh/accessor/texture INDICES are
# untouched, which is what keeps the VRM extension's references valid.
#
# Usage: python3 scripts/compress_vrm_webp.py <in.vrm> <out.vrm>
# Gate before shipping the output (all must pass, see plan doc Batch 3-G):
#   load in three-vrm -> userData.vrm exists, expressions/springs/humanoid
#   counts match the source, all material maps resolve, a frame renders.
# Remember: /avatar/* is cached immutable — a new payload needs a NEW filename.
import io
import json
import struct
import sys

from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]

with open(SRC, 'rb') as f:
    magic, ver, total = struct.unpack('<III', f.read(12))
    assert magic == 0x46546C67, 'not a GLB container'
    clen, ctype = struct.unpack('<II', f.read(8))
    j = json.loads(f.read(clen))
    blen, btype = struct.unpack('<II', f.read(8))
    bin_data = f.read(blen)

bvs = j['bufferViews']
img_bv = {}  # bufferView idx -> webp bytes
saved = 0
for img in j.get('images', []):
    bv = bvs[img['bufferView']]
    off, ln = bv.get('byteOffset', 0), bv['byteLength']
    if ln < 20000:  # tiny placeholder/matcap textures: not worth touching
        continue
    im = Image.open(io.BytesIO(bin_data[off:off + ln]))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=90, method=6)  # q90 keeps toon edges clean
    webp = buf.getvalue()
    if len(webp) < ln * 0.85:  # only swap when it actually helps
        img_bv[img['bufferView']] = webp
        img['mimeType'] = 'image/webp'
        saved += ln - len(webp)

# Rebuild the BIN chunk: keep every bufferView, swap image payloads,
# re-offset everything (offsets change, indices don't).
order = sorted(range(len(bvs)), key=lambda i: bvs[i].get('byteOffset', 0))
out = bytearray()
for i in order:
    bv = bvs[i]
    off, ln = bv.get('byteOffset', 0), bv['byteLength']
    data = img_bv.get(i, bin_data[off:off + ln])
    out.extend(b'\x00' * ((4 - len(out) % 4) % 4))
    bv['byteOffset'] = len(out)
    bv['byteLength'] = len(data)
    out.extend(data)
j['buffers'][0]['byteLength'] = len(out)

webp_images = {n for n, img in enumerate(j.get('images', [])) if img.get('mimeType') == 'image/webp'}
for tex in j.get('textures', []):
    if tex.get('source') in webp_images:
        tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex['source']}
if webp_images and 'EXT_texture_webp' not in j.setdefault('extensionsUsed', []):
    j['extensionsUsed'].append('EXT_texture_webp')

jb = json.dumps(j, separators=(',', ':')).encode()
jb += b' ' * ((4 - len(jb) % 4) % 4)
bin_out = bytes(out) + b'\x00' * ((4 - len(out) % 4) % 4)
with open(DST, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bin_out)))
    f.write(struct.pack('<II', len(jb), 0x4E4F534A))
    f.write(jb)
    f.write(struct.pack('<II', len(bin_out), 0x004E4942))
    f.write(bin_out)

print(f'converted {len(img_bv)} of {len(j.get("images", []))} images, saved {saved / 1e6:.1f}MB')
