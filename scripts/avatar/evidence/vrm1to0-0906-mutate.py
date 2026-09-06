#!/usr/bin/env python3
"""Phase 3.5 mutation receipts (VRM 1.0 -> 0.x entry conversion). Same harness
as Phase 3's gates-0905-mutate.py: byte-copy backup, pattern hit count must be
1, single named test per mutation, __pycache__ removed after the write,
byte-copy restore checked by sha256. Every mutation is a real way the
converter could be wrong, and its test is the one line that would notice."""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'

PY = lambda *tests: ['python3', '-W', 'ignore', '-m', 'unittest', '-q', *tests]  # noqa: E731
CONV = 'scripts.avatar.vrm1to0_test.Convert.'
ENS = 'scripts.avatar.vrm1to0_test.Ensure.'
RT = 'scripts.avatar.vrm1to0_test.RoundTrip.'
WIRE = 'scripts.avatar.gate_test.Wiring.'
V = AV / 'vrm1to0.py'

MUTATIONS = [
    ('V1', V,
     "    out = [{'bone': V1_TO_V0_THUMB.get(b, b) if rename else b, 'node': n, 'useDefaultValues': True}\n",
     "    out = [{'bone': b, 'node': n, 'useDefaultValues': True}\n",
     PY(CONV + 'test_humanoid_map_is_a_list_with_the_v0_thumb_names'),
     'humanoid: 1.0 thumb names go back to the 0.x names three-vrm renames from'),
    ('V2', V,
     "'rotation': [0, 1, 0, 0]",
     "'rotation': [0, 0, 0, 1]",
     PY(CONV + 'test_the_body_turns_half_a_turn_to_face_minus_z'),
     'facing: the new scene root turns the body half a turn about Y'),
    ('V3', V,
     "    return {'offset': {'x': x, 'y': y, 'z': -z}, 'radius': radius}\n",
     "    return {'offset': {'x': x, 'y': y, 'z': z}, 'radius': radius}\n",
     PY(CONV + 'test_collider_offsets_flip_z_the_way_three_vrm_unflips_them'),
     'springs: collider offset z is negated (three-vrm _v0Import negates it back)'),
    ('V4', V,
     "            by_node.setdefault(c.get('node'), []).extend(\n",
     "            by_node.setdefault(colliders[g['colliders'][0]].get('node'), []).extend(\n",
     PY(CONV + 'test_a_collider_group_on_two_nodes_splits_per_node_and_the_spring_follows'),
     'springs: a 1.0 collider group spanning nodes splits into one 0.x group per node'),
    ('V5', V,
     "        return [([a[k] + (b[k] - a[k]) * i / (n - 1) for k in range(3)], r) for i in range(n)]\n",
     "        return [(a, r)]\n",
     PY(CONV + 'test_a_capsule_becomes_spheres_that_reach_its_tail'),
     'springs: a capsule becomes a row of spheres reaching its tail'),
    ('V6', V,
     "            'comment': s.get('name', ''), 'stiffiness': root.get('stiffness', 1.0),\n",
     "            'comment': s.get('name', ''), 'stiffness': root.get('stiffness', 1.0),\n",
     PY(CONV + 'test_a_spring_takes_its_root_joints_parameters_in_v0_spelling'),
     "springs: stiffness is written under 0.x's misspelling `stiffiness`, the key three-vrm reads"),
    ('V7', V,
     "'weight': b.get('weight', 1.0) * 100})\n",
     "'weight': b.get('weight', 1.0)})\n",
     PY(CONV + 'test_expression_weights_scale_to_100_and_presets_get_v0_names'),
     'expressions: bind weights are scaled from [0, 1] to [0, 100]'),
    ('V8', V,
     "            binds.append({'mesh': mesh_of[b['node']], 'index'",
     "            binds.append({'mesh': b['node'], 'index'",
     PY(CONV + 'test_a_bind_names_the_mesh_the_node_draws'),
     'expressions: a bind names the MESH the 1.0 node draws, not the node'),
    ('V9', V,
     "            values.append({'materialName': materials[b['material']].get('name', ''), 'propertyName': prop,\n"
     "                           'targetValue': list(b['targetValue'])})\n",
     "            pass\n",
     PY(CONV + 'test_material_colour_binds_become_material_values'),
     'expressions: materialColorBinds become materialValues'),
    ('V10', V,
     "    return max(v, 0.0) ** (1 / 2.2)\n",
     "    return max(v, 0.0)\n",
     PY(CONV + 'test_colours_are_written_in_the_gamma_space_three_vrm_decodes'),
     'materials: colours go back to the gamma space the compat plugin decodes with pow 2.2'),
    ('V11', V,
     "    shift0 = -shift1 - (1 - toony1)\n",
     "    shift0 = shift1\n",
     PY(CONV + 'test_shade_shift_and_toony_invert_the_compat_formula'),
     'materials: shadingShift/Toony invert the compat lerp, not pass through'),
    ('V12', V,
     "'_OutlineWidth': mtoon.get('outlineWidthFactor', 0.0) / 0.01,",
     "'_OutlineWidth': mtoon.get('outlineWidthFactor', 0.0),",
     PY(CONV + 'test_outline_width_is_in_hundredths'),
     'materials: outline width is written in hundredths'),
    ('V13', V,
     "    transparent = alpha_mode == 'BLEND'\n",
     "    transparent = False\n",
     PY(CONV + 'test_blend_mode_keywords_and_queue_follow_alpha_mode'),
     'materials: BLEND sets _ALPHABLEND_ON, the blend mode and the transparent queue'),
    ('V14', V,
     "            props.append(_plain_props(name, material))\n",
     "            continue\n",
     PY(CONV + 'test_every_material_gets_a_property_block_in_the_same_position'),
     'materials: a non-MToon material still gets a block, so materialProperties[i] is materials[i]'),
    ('V15', V,
     "    pbr['baseColorFactor'] = list(colour)\n",
     "    pass\n",
     PY(CONV + 'test_colours_are_written_in_the_gamma_space_three_vrm_decodes'),
     "materials: baseColorFactor is rewritten to _Color's numbers (what customise.tint assumes)"),
    ('V16', V,
     "    for name in V1_EXTENSIONS:\n        doc['extensions'].pop(name, None)\n",
     "    pass\n",
     PY(CONV + 'test_the_1_0_extensions_are_gone_and_VRM_is_declared'),
     'the VRMC_* extension blocks are removed'),
    ('V17', V,
     "        texture = next((i for i, t in enumerate(textures) if t.get('source') == image), None)\n",
     "        texture = image\n",
     PY(CONV + 'test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture'),
     'meta: the thumbnail IMAGE index becomes the index of a TEXTURE sourcing it'),
    ('V18', V,
     "'firstPersonBoneOffset': {'x': off[0], 'y': off[1], 'z': -off[2]},",
     "'firstPersonBoneOffset': {'x': off[0], 'y': off[1], 'z': off[2]},",
     PY(CONV + 'test_first_person_and_look_at'),
     'lookAt: the head offset z is negated (three-vrm _v0Import negates it back)'),
    ('V19', V,
     "    if humanoid.version(doc) == '0':\n        print(f'   {os.path.basename(path)} 已是 VRM 0.x')\n        return path\n",
     "",
     PY(ENS + 'test_a_0_x_base_is_returned_untouched'),
     'ensure_vrm0: a 0.x base passes through by path, untouched'),
    ('V20', AV / 'make.py',
     "        base = vrm1to0.ensure_vrm0(base, p('base-vrm0.vrm'))\n",
     "        vrm1to0.ensure_vrm0(base, p('base-vrm0.vrm'))\n",
     PY(WIRE + 'test_main_threads_base_through_every_step'),
     'make.main: the converted path REPLACES base before partition'),
    ('V21', V,
     "        if ext.pop('VRMC_node_constraint', None) is not None:\n            constrained += 1\n",
     "        if False:\n            constrained += 1\n",
     PY(CONV + 'test_the_1_0_extensions_are_gone_and_VRM_is_declared'),
     'node constraints are stripped and reported'),
    ('V22', V,
     "    return [off[0], 1 - scale[1] - off[1], scale[0], scale[1]]\n",
     "    return [off[0], off[1], scale[0], scale[1]]\n",
     PY(CONV + 'test_texture_slots_and_the_main_transform'),
     'materials: the _MainTex offset y is measured from the other edge'),
    ('V23', V,
     "    'aa': 'a', 'ee': 'e',",
     "    'aa': 'unknown', 'ee': 'e',",
     PY(RT + 'test_expressions'),
     'round trip: preset names come back through the inverted v0v1PresetNameMap'),
    ('V24', V,
     "'commercialUssageName': allow(meta1.get('commercialUsage', 'personalNonProfit') != 'personalNonProfit'),",
     "'commercialUssageName': allow(True),",
     PY(CONV + 'test_meta_maps_onto_the_v0_enums_and_the_thumbnail_becomes_a_texture'),
     'meta: personalNonProfit is the only 1.0 value that maps to Disallow'),
    ('V25', V,
     "    _face_minus_z(doc, report)\n",
     "    pass\n",
     PY(RT + 'test_skeleton'),
     'round trip: without the half turn the twin comes back facing +Z and every bone is elsewhere'),
    ('V26', V,
     "            ext.pop('KHR_materials_emissive_strength', None)\n            ext['KHR_materials_unlit'] = {}\n        else:\n",
     "            ext['KHR_materials_unlit'] = {}\n        else:\n            ext.pop('KHR_materials_emissive_strength', None)\n",
     PY(CONV + 'test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials'),
     'materials: a plain material keeps KHR_materials_emissive_strength for the glTF loader'),
    ('V28', V,
     "            props.append(_mtoon_props(name, material, mtoon, report))\n            ext.pop('KHR_materials_emissive_strength', None)\n",
     "            ext.pop('KHR_materials_emissive_strength', None)\n            props.append(_mtoon_props(name, material, mtoon, report))\n",
     PY(CONV + 'test_emissive_strength_is_folded_into_mtoon_and_left_on_plain_materials'),
     'materials: the emissive strength is read BEFORE the extension is popped (the first draft popped first)'),
    ('V27', V,
     "    if len(doc.get('scenes') or []) > 1:\n",
     "    if False:\n",
     PY(CONV + 'test_only_the_active_scene_is_turned_and_that_is_reported'),
     'facing: a file with more than one scene says so, since only the active scene is turned'),
    ('V29', V,
     "    for key in V1_ONLY_META:\n        if key in meta1:\n",
     "    for key in V1_ONLY_META:\n        if False:\n",
     PY(CONV + 'test_what_0x_cannot_carry_is_reported_not_swallowed'),
     'meta: the 1.0-only licence fields are reported when dropped'),
    ('V30', V,
     "    if mtoon.get('matcapFactor') not in (None, [1, 1, 1]):\n",
     "    if False:\n",
     PY(CONV + 'test_what_0x_cannot_carry_is_reported_not_swallowed'),
     'materials: a tinted matcapFactor is reported as approximated'),
    ('V31', V,
     "    if abs(1 - t) < 1e-9:\n        return shift0, 0.9\n",
     "    if abs(1 - t) < 1e-9:\n        return shift0, 0.0\n",
     PY(CONV + 'test_shade_shift_at_the_degenerate_point_falls_back_to_the_default_toony'),
     "materials: the degenerate shade pair falls back to MToon's default toony 0.9"),
    ('V32', V,
     "        if info.get('texCoord', 0):\n",
     "        if False:\n",
     PY(CONV + 'test_what_0x_cannot_carry_is_reported_not_swallowed'),
     'materials: a texture on UV set 1 is reported as dropped'),
    ('V33', V,
     "        if key != '_MainTex' and own != base_transform:\n",
     "        if False:\n",
     PY(CONV + 'test_what_0x_cannot_carry_is_reported_not_swallowed'),
     "materials: a slot whose effective texture transform differs from _MainTex's is reported"),
    ('V34', V,
     "        own = _transform_of(info)\n",
     "        own = _transform_of(info) if 'extensions' in info else base_transform\n",
     PY(CONV + 'test_what_0x_cannot_carry_is_reported_not_swallowed'),
     'materials: a slot with NO transform against a shifted _MainTex is a difference too (round-2 residual)'),
    ('V35', V,
     "    if base_transform['rotation']:\n",
     "    if False:\n",
     PY(CONV + 'test_a_rotated_main_texture_transform_is_reported'),
     'materials: a rotated _MainTex transform is reported as dropped'),
    # twintail._frame_of: T1 IS the code before 2026-09-06 (sum translations up
    # the parent chain, refuse any rotation), so its RED is also the red-before-
    # fix receipt for MeshFrameTest.
    ('T1', AV / 'twintail.py',
     "    world = humanoid.rest_world(doc)\n"
     "    mesh_index = next(i for i, m in enumerate(doc['meshes']) if m.get('name') == mesh_name)\n"
     "    mesh_node = next(i for i, n in enumerate(doc['nodes']) if n.get('mesh') == mesh_index)\n"
     "    to_mesh = np.linalg.inv(world[mesh_node])\n"
     "\n"
     "    def position(i):\n"
     "        if i not in world:                      # a joint appended since\n"
     "            world.update(humanoid.rest_world(doc))\n"
     "        m = to_mesh @ world[i]\n"
     "        if not np.allclose(m[:3, :3], np.eye(3), atol=1e-9):\n"
     "            raise SystemExit(f'節點 {i} 相對 {mesh_name} 有旋轉，馬尾鏈的平移建法不成立')\n"
     "        return m[:3, 3].copy()\n"
     "    return position\n",
     "    nodes = doc['nodes']\n"
     "    parent = {c: i for i, n in enumerate(nodes) for c in n.get('children', ())}\n"
     "\n"
     "    def position(i):\n"
     "        p = np.zeros(3)\n"
     "        while True:\n"
     "            n = nodes[i]\n"
     "            if n.get('rotation') and list(n['rotation']) != [0, 0, 0, 1]:\n"
     "                raise SystemExit(f'節點 {i} 有旋轉，這裡的平移假設不成立')\n"
     "            p = p + np.array(n.get('translation', [0, 0, 0]), dtype=np.float64)\n"
     "            if i not in parent:\n"
     "                return p\n"
     "            i = parent[i]\n"
     "    return position\n",
     PY('scripts.avatar.twintail_test.MeshFrameTest.test_a_root_shared_by_mesh_and_skeleton_may_turn'),
     'twintail._frame_of: a root shared by mesh and skeleton may turn (the pre-fix translation sum refused it)'),
    ('T2', AV / 'twintail.py',
     "        if not np.allclose(m[:3, :3], np.eye(3), atol=1e-9):\n"
     "            raise SystemExit(f'節點 {i} 相對 {mesh_name} 有旋轉，馬尾鏈的平移建法不成立')\n",
     "",
     PY('scripts.avatar.twintail_test.MeshFrameTest.test_a_rotation_between_the_mesh_and_a_bone_is_refused'),
     'twintail._frame_of: a rotation between the mesh and a bone is still refused'),
]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def run(cmd):
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr)


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, path, old, new, cmd, guard in MUTATIONS:
        if only and mid not in only:
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        src = path.read_text()
        hits = src.count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        path.write_text(src.replace(old, new))
        # Equal-size mutations landing within one second share mtime+size and
        # CPython reuses the previous .pyc (memory: vite_dev_serves_stale_modules).
        shutil.rmtree(path.parent / '__pycache__', ignore_errors=True)
        landed = sha(path) != before
        code, out = run(cmd)
        # Head AND tail: an assertRegex on make.main's source prints the whole
        # function body, and a tail alone shows a docstring fragment with no
        # FAIL header (the V20 entry of the first run of this harness).
        lines = '\n'.join(l for l in out.splitlines() if l.strip())
        tail = lines if len(lines) <= 1800 else lines[:600] + '\n[…]\n' + lines[-1200:]
        shutil.copy2(backup, path)
        shutil.rmtree(path.parent / '__pycache__', ignore_errors=True)
        restored = sha(path) == before
        verdict = 'RED' if code != 0 else 'GREEN (mutation NOT caught)'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        rows.append((mid, guard, verdict, ' '.join(map(str, cmd)), tail))
        print(f'{mid} {verdict}  restored={restored}')
    print()
    print('| # | guard | result |')
    print('|---|---|---|')
    for r in rows:
        print(f'| {r[0]} | {r[1]} | {r[2]} |')
    print()
    for r in rows:
        if len(r) > 3:
            print(f'### {r[0]}\n```\n$ {r[3]}\n{r[4]}\n```\n')
    return 0 if all(r[2] == 'RED' for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
