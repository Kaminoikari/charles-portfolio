#!/usr/bin/env python3
"""Phase 4 mutation receipts (binding.py: skinning strategy decided from the
piece). Same harness as Phase 3.5's vrm1to0-0906-mutate.py: byte-copy backup,
pattern hit count must be 1, single named test per mutation, __pycache__
removed after the write, byte-copy restore checked by sha256. Every mutation
is a real way the chooser, the applier or the wiring could be wrong, and its
test is the one line that would notice."""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
AV = REPO / 'scripts' / 'avatar'

PY = lambda *tests: ['python3', '-W', 'ignore', '-m', 'unittest', '-q', *tests]  # noqa: E731
CH = 'scripts.avatar.binding_test.Choose.'
NR = 'scripts.avatar.binding_test.Nearest.'
AP = 'scripts.avatar.binding_test.Apply.'
MF = 'scripts.avatar.binding_test.Manifest.'
WI = 'scripts.avatar.binding_test.Wiring.'
ST = 'scripts.avatar.selftest_test.ReadsExpectationsOffTheModel.'
B = AV / 'binding.py'

MUTATIONS = [
    ('B1', B,
     "    if band and band[1] >= 1.0 and band[2] >= DRAPE_ANNULUS_MIN:\n",
     "    if band and band[1] >= 1.0:\n",
     PY(CH + 'test_a_ring_round_each_leg_separately_does_not_drape'),
     'drape: the band has to be one annulus, not two blobs that between them reach every bearing'),
    ('B2', B,
     "    if band and band[1] >= 1.0 and band[2] >= DRAPE_ANNULUS_MIN:\n",
     "    if band and band[2] >= DRAPE_ANNULUS_MIN:\n",
     PY(CH + 'test_a_panel_round_the_back_only_does_not_drape'),
     'drape: the band has to reach every bearing round the hips axis'),
    ('B3', B,
     "    top = min(ctx['crotch'], float(pos[:, 1].max()))\n",
     "    top = float(pos[:, 1].max())\n",
     PY(CH + 'test_a_ring_round_both_legs_above_the_crotch_does_not_drape'),
     'drape: only bands below the crotch line count'),
    ('B4', B,
     "    one = int(lead_slot[0]) if whole.all() and (lead_slot == lead_slot[0]).all() else None\n",
     "    one = int(lead_slot[0]) if (lead_slot == lead_slot[0]).all() else None\n",
     PY(CH + 'test_a_small_sphere_beside_a_blended_thigh_copies_the_skin'),
     'single: every nearest row has to be WHOLLY on the joint, a shared dominant joint is not enough'),
    ('B5', B,
     "    one = int(lead_slot[0]) if whole.all() and (lead_slot == lead_slot[0]).all() else None\n",
     "    one = int(lead_slot[0]) if whole.all() else None\n",
     PY(CH + 'test_two_rigid_blobs_on_different_bones_copy_the_skin'),
     'single: every nearest row has to be on the SAME joint'),
    ('B6', B,
     "    if origin == 'shell':\n",
     "    if False:\n",
     PY(CH + 'test_a_shell_inherits_whatever_the_geometry_says'),
     'inherit: a shell keeps its rows regardless of what the geometry says'),
    ('B7', B,
     "        if len(cand) > 1:\n",
     "        if False:\n",
     PY(NR + 'test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions'),
     'nearest: exact ties are re-ranked, not left to the tree'),
    ('B8', B,
     "            out[i] = cand[int(exact.argmin())]\n",
     "            out[i] = cand[-1]\n",
     PY(NR + 'test_matches_the_dense_argmin_on_a_pool_with_duplicated_positions'),
     'nearest: a tie goes to the lowest index, as the dense argmin resolved it'),
    ('B9', B,
     "            slot = int(table[slot])\n",
     "            pass\n",
     PY(AP + 'test_single_tiles_the_joint_in_the_target_skin'),
     "single: the slot is translated into the target mesh's skin"),
    ('B10', B,
     "        piece['joints'] = _translate(ctx, mesh, pool['joints'][near], pool['weights'][near])\n",
     "        piece['joints'] = pool['joints'][near]\n",
     PY(AP + 'test_nearest_copies_the_rows_and_translates_slots_into_the_target_skin'),
     "nearest: copied rows are translated into the target mesh's skin"),
    ('B11', B,
     "DRAPE_LEG_SHARE = 0.75\n",
     "DRAPE_LEG_SHARE = 0.5\n",
     PY(AP + 'test_drape_hands_the_hem_to_the_legs_and_leaves_the_top_to_the_skin'),
     'drape: the hem hands 75% of itself to the legs (the fade build.py had)'),
    ('B12', B,
     "    pos = np.concatenate([np.asarray(p['pos'], dtype=np.float64) for p in pieces])\n",
     "    pos = np.concatenate([np.asarray(p['pos'], dtype=np.float64) for p in pieces[:1]])\n",
     PY(CH + 'test_the_decision_is_taken_on_the_union_of_a_part_s_primitives'),
     "signals: measured on ALL of a part's primitives, not the first"),
    ('B13', B,
     "    if smooth:\n        decision['smooth'] = int(smooth)\n",
     "    if False:\n        decision['smooth'] = int(smooth)\n",
     PY(CH + 'test_smoothing_is_recorded_on_a_nearest_decision_only'),
     'nearest: the smoothing passes are recorded in the decision'),
    ('B14', B,
     "                'chosen': chosen['strategy']}\n",
     "                'chosen': strategy}\n",
     PY(CH + 'test_an_override_keeps_what_the_chooser_would_have_said'),
     "override: keeps the chooser's own verdict beside the caller's"),
    ('B15', B,
     "            raise ValueError('inherit 需要部件自己帶著每個頂點的權重')\n        return piece\n",
     "            raise ValueError('inherit 需要部件自己帶著每個頂點的權重')\n",
     PY(AP + 'test_inherit_leaves_the_rows_the_piece_came_with'),
     'inherit: apply leaves the rows alone'),
    ('C1', AV / 'customise.py',
     "            info['primitives'] = found[name]['primitives']\n",
     "            info['primitives'] = found[name]['primitives']\n            info.pop('binding', None)\n",
     PY(MF + 'test_customise_remap_keeps_the_binding_field'),
     'customise.remap keeps the binding field through a deletion'),
    ('C2', AV / 'customise.py',
     "            info['primitives'] = found[name]['primitives']\n",
     "            info['primitives'] = found[name]['primitives']\n            info.pop('binding', None)\n",
     PY(ST + 'test_the_perturbed_model_passes_its_own_customisation_self_test'),
     'selftest: the written manifest is audited for the field (same mutation, end to end)'),
    ('P1', AV / 'partition.py',
     "                'deletable': not label.startswith('Body_'),\n                'binding': dict(binding.EXPORTED),\n",
     "                'deletable': not label.startswith('Body_'),\n",
     PY(MF + 'test_partition_labels_every_part_as_skinned_by_the_export'),
     "partition stamps every part it names as the export's own skinning"),
    ('W1', AV / 'build.py',
     "            bindings[name] = decision\n",
     "            pass\n",
     PY(WI + 'test_build_routes_every_piece_through_put_and_binding'),
     'build.put records the decision for the manifest'),
    ('W2', AV / 'build.py',
     "        e['binding'] = bindings.get(label) or carried.get(label, {}).get('binding')\n",
     "        e['binding'] = carried.get(label, {}).get('binding')\n",
     PY(WI + 'test_build_routes_every_piece_through_put_and_binding'),
     "build's manifest tail writes put()'s decisions"),
    ('W3', AV / 'build.py',
     "        bound = binding.apply(ctx, dict(piece), decision, mesh)\n",
     "        bound = garment.bind(pool, dict(piece))\n",
     PY(WI + 'test_build_routes_every_piece_through_put_and_binding'),
     'build.put skins through binding.apply, not garment.bind'),
    ('W4', AV / 'weld.py',
     "    binding.apply(ctx, piece, decision, mesh)\n",
     "    garment.bind(ctx['pool'], piece)\n",
     PY(WI + 'test_weld_attach_takes_the_same_path'),
     'weld.attach skins through binding.apply'),
    ('S1', AV / 'selftest.py',
     "                   all('binding' in e and e['binding'].get('strategy')\n",
     "                   all(True\n",
     PY(WI + 'test_selftest_audits_the_field_on_the_written_manifest'),
     'selftest audits the field on the manifest apply wrote'),
    ('T1', AV / 'twintail.py',
     "    for part in parts:\n        manifest[part]['binding'] = dict(CHAIN)\n",
     "",
     PY(WI + 'test_twintail_owns_the_field_for_the_parts_it_reweights'),
     'twintail.apply overwrites the export stamp on the parts it re-weights'),
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
