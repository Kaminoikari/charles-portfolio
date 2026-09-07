#!/usr/bin/env python3
"""Mutation receipts for the second rig family in the registry.

    python3 scripts/avatar/evidence/family2-0907-mutate.py [ID ...]

Until 2026-09-07 rigProbe.test.ts ran its whole `bundled motions` block against
one body, so a second family could be declared and measured and nothing would
read it. The block is now `describe.each` over AVATAR_FAMILIES. These rows are
what says that second pass is real work rather than a second copy of the first
family's answers.

Two of them are about the probe space itself. rigProbe fixed her forward axis at
-Z, which is 0.x's; the 1.0 body faces +Z and the engine does not turn it round
(three-vrm gates rotateVRM0 on meta.metaVersion). F1 is that fact.

Same discipline as the other harnesses here: byte-copy backup, the pattern must
hit exactly once, sha256-verified restore, and a non-zero exit only counts as
RED when a named test ran and failed -- `vitest -t` with no match also exits
non-zero.
"""
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path('/Users/charles/portfolio')
CHAT = REPO / 'src' / 'components' / 'chat'
RP = CHAT / 'rigProbe.ts'
RPT = CHAT / 'rigProbe.test.ts'
TWIST = CHAT / 'clearance' / 'vrm1-twist-sample.ts'
AV = CHAT / 'avatarVariants.ts'
AVT = CHAT / 'avatarVariants.test.ts'
AVCT = CHAT / 'avatarVariantChoice.test.ts'
GEN = CHAT / 'clearance' / 'vrm1-twist-sample.measured.gen.ts'
CL = CHAT / 'clearance.ts'
CLT = CHAT / 'clearance.test.ts'


def t(path, title):
    return ['npx', 'vitest', 'run', str(path), '-t', title]


PALM = t(RPT, 'turns a palm to the viewer')
RIGSHA = t(RPT, 'has a clearance entry for every clip')
FACE = t(RPT, 'keeps her fingertips out of her own head')
ENDS = t(RPT, 'opens and closes on a standing pose')
PANS = t(RPT, 'pans by what the measurements leave room for')
EDGES = t(RPT, 'stays inside every frame it declares')
FAMILY = t(AVT, 'declares a family for every variant')
CHOICE = t(AVCT, 'refuses a body the registry declares but does not offer')
DEADKEY = t(CLT, 'refuses a decision naming a clip no producer measured')

MUTATIONS = [
    # ---- the probe space is the version's, not this module's ----------------
    ('F1', RP, "  return rig.version === '0' ? -1 : 1\n", "  return -1\n", PALM,
     "the direction 'toward the viewer' is read off the rig's own version; pinning it to 0.x's -Z dots the 1.0 body's palm against her back"),
    # ---- the second family is judged on its own body ------------------------
    ('F2', RPT, "    const doc = parseGlb(asset(fam.body)).json\n",
     "    const doc = parseGlb(asset('AvatarSample_B_webp.vrm')).json\n", RIGSHA,
     "each family's rigSha is checked against ITS OWN body, so a clearance measured on another rig cannot pass as this one's"),
    # ---- and on its own measurements ----------------------------------------
    ('F3', TWIST, "    dance: { handInHead: 0.21, hipsDrift: 0.15, endWrist: 1.24 },\n",
     "    dance: { handInHead: 0.30, hipsDrift: 0.15, endWrist: 1.24 },\n", FACE,
     "the handInHead budget is held to what THIS body measures: raise it past the 0.212 read here and the guard reddens"),
    ('F4', TWIST, "    idleLoop: { hipsDrift: 0.16 },\n", "", ENDS,
     'a clip whose ends stand 157mm off centre on this body needs this body to say so'),
    ('F5', TWIST, "    spin: { column: 0.05 },\n", "    spin: { column: 0.07 },\n", PANS,
     "this family's pans are held to what clearance.panFor derives from ITS crowns (0.07 was the first pass, before the pan moved the projection it was solved against)"),
    # ---- a family nothing reads is a family nobody measured ------------------
    ('F6', AV, "  'vrm1-twist-sample': VRM1_TWIST_SAMPLE,\n", "", FAMILY,
     'a variant whose family is not in the registry is caught; this is what stops the describe.each above from quietly losing a pass'),
    # ---- the visitor cannot ask for a body that is only declared ------------
    ('F9', AV, "  return OFFERED_VARIANTS.some((v) => v.id === id)\n",
     "  return AVATAR_VARIANTS.some((v) => v.id === id)\n", CHOICE,
     "the ?mika= and localStorage gate reads the OFFERED half, so a declared-but-unoffered body cannot be asked for by hand"),
    # ---- a generated half cannot drift from its own producer ----------------
    # Nothing reads clips[*].reach (only waiver.reach is read), so this file went
    # stale against measure-motions and no guard noticed: it was written before
    # screenX stopped assuming a 0.x body, so all ten reach pairs were recorded
    # mirrored. Values right, labels wrong. The guard re-measures and compares.
    ('F10', GEN, '        "left": 0.6428,\n        "right": 0.5074\n',
     '        "left": 0.5074,\n        "right": 0.6428\n', EDGES,
     "each family's generated reach is re-measured against its producer, so a .gen.ts that drifts from the code that writes it is caught"),
    # F7 was written as a GREEN control, on the claim that every caller reads
    # both edges against one budget so the mirror cancels. F10's guard made that
    # false in the same afternoon: comparing the measured edges against the
    # producer's recorded left/right is a caller that tells them apart. Kept as a
    # RED row rather than deleted, because "which edge is which" is now a fact
    # with a guard, and that is worth a receipt.
    ('F7', RP, "  return forwardZ(rig) === -1 ? -probeX : probeX\n",
     "  return forwardZ(rig) === -1 ? probeX : -probeX\n", EDGES,
     "screenX's mirror decides which edge is which, and the frame guard compares both against the sides the producer recorded"),
    # ---- every kind of decision is held to the clip pool ---------------------
    # combineClearance rejects a waiver or a crownSeen entry naming a clip no
    # producer measured, and `pans` was left out of that list when it moved off
    # AvatarMotionDef on 2026-09-07. It is the kind that hides best: a wrong pan
    # VALUE is recomputed against panFor by rigProbe.test.ts, but a pan whose
    # clip is not in the pool is read by name and so never read at all.
    ('F11', CL, ', ...Object.keys(decisions.crownSeen), ...Object.keys(decisions.pans)]',
     ', ...Object.keys(decisions.crownSeen)]', DEADKEY,
     'a pan naming a clip outside the pool is refused, the way a waiver and a crownSeen entry already were'),
    # ---- the negative control ------------------------------------------------
    ('F8', TWIST, "    spin: { column: 0.05 },\n", "    spin: { column: 0.05, },\n", PANS,
     'a formatting-only edit must NOT redden the pan guard'),
]

GREEN_EXPECTED = {'F8'}


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def ran_and_failed(out):
    return re.search(r'Tests\s+\d+ failed', out) is not None


def run(cmd):
    r = subprocess.run(cmd, cwd=REPO, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr)


def main():
    only = set(sys.argv[1:])
    rows = []
    for mid, path, old, new, cmd, guard in MUTATIONS:
        if only and mid not in only:
            continue
        want = 'GREEN' if mid in GREEN_EXPECTED else 'RED'
        src = path.read_text()
        hits = src.count(old)
        if hits != 1:
            rows.append((mid, guard, f'ABORT: pattern hit {hits} times, not 1'))
            print(f'{mid} ABORT hits={hits}')
            continue
        backup = Path(tempfile.mkdtemp()) / path.name
        shutil.copy2(path, backup)
        before = sha(path)
        path.write_text(src.replace(old, new))
        landed = sha(path) != before
        code, out = run(cmd)
        if code == 0:
            code, out = run(cmd)  # once more before believing a green vitest
        shutil.copy2(backup, path)
        restored = sha(path) == before
        if code == 0:
            got = 'GREEN'
        elif not ran_and_failed(out):
            got = 'ABORT: non-zero exit with no failing test that ran'
        else:
            got = 'RED'
        verdict = got if got == want else f'{got} (wanted {want})'
        if not landed:
            verdict = 'ABORT: mutation did not change the file'
        if not restored:
            verdict += '  !!! RESTORE FAILED'
        lines = '\n'.join(l for l in out.splitlines() if l.strip() and 'node_modules' not in l)
        tail = lines if len(lines) <= 1600 else lines[:500] + '\n[…]\n' + lines[-1100:]
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
    return 0 if all(r[2] in ('RED', 'GREEN') for r in rows) else 1


if __name__ == '__main__':
    sys.exit(main())
