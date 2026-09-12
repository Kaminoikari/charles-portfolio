#!/usr/bin/env python3
"""Break one defence of the part-name clash resolution at a time.

Baseline is the committed blob of partition.py, handed in as argv[1] and
extracted with `git cat-file blob <sha>:scripts/avatar/partition.py`. The run
refuses to start unless the working file already equals it; nothing is restored
with git, each mutation writes back the exact bytes read at the start and the
restore is asserted byte-for-byte. __pycache__ is cleared before every run.

Each row declares WHICH tests must go red. Extra failures are reported without
being held against the row; a named test that stays green is the result this
table exists to catch.

    $ git cat-file blob <sha>:scripts/avatar/partition.py > /tmp/partition.committed.py
    $ python3 scripts/avatar/evidence/mutations-clashes-0912.py /tmp/partition.committed.py
"""
import pathlib
import shutil
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent.parent
TARGET = HERE / 'partition.py'
REPO = HERE.parents[1]
TESTS = ('gate_test',)

RESOLVER = """    rows = {}
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
    return names"""

MUTATIONS = [
    ('C1', ['BodyDrawingItsSkinInThreeLayers',
            'a_name_two_meshes_claim_goes_to_the_one_reaching_furthest'],
     'there is no resolution: every claim keeps the name the grammar gave it, '
     'which is where this step stood before',
     RESOLVER, "    return [c['label'] for c in claims]"),

    ('C2', ['BodyDrawingItsSkinInThreeLayers',
            'a_name_two_meshes_claim_goes_to_the_one_reaching_furthest'],
     'the plain name goes to the claim reaching least',
     "        keeper = max(group, key=lambda i: claims[i]['extent'])",
     "        keeper = min(group, key=lambda i: claims[i]['extent'])"),

    ('C3', ['reach_rather_than_size_says_which_layer_is_the_body'],
     'claims are ranked on size, the way springsim ranks its own derivation',
     "            ys = np.concatenate([drawn[i][:, 1] for i in members])\n"
     "            by_mesh.setdefault(id(mesh), []).append(len(claims))\n"
     "            claims.append({'label': label, 'members': members,\n"
     "                           'extent': float(ys.max() - ys.min())})",
     "            by_mesh.setdefault(id(mesh), []).append(len(claims))\n"
     "            claims.append({'label': label, 'members': members,\n"
     "                           'extent': float(sum(\n"
     "                               doc['accessors'][mesh['primitives'][i]"
     "['indices']]['count']\n"
     "                               for i in members))})"),

    ('C4', ['the_numbers_follow_document_order'],
     'the claims that lose a name are numbered back to front',
     '        for i in group:\n            if i == keeper:',
     '        for i in reversed(group):\n            if i == keeper:'),

    ('C5', ['the_number_skips_a_name_the_grammar_already_wrote'],
     'the number is taken without asking whether the grammar wrote it already',
     "            # `label_2` can be a name the grammar already produced on its own,\n"
     "            # and taking it would trade one collision for another.\n"
     "            while f'{label}_{n}' in taken:\n"
     "                n += 1\n",
     ''),

    ('C6', ['a_claims_reach_is_measured_on_the_vertices_it_draws'],
     "a claim reaches as far as its mesh's whole POSITION buffer",
     '            drawn.append(p)', '            drawn.append(rest[(name, index)])'),

    ('C7', ['a_resolver_that_repeats_a_name_is_refused_rather_than_believed'],
     'a name arriving twice is written twice, and the second wins in silence',
     "            if label in manifest['parts']:\n"
     "                # resolve_clashes owes every claim a name of its own. If two\n"
     "                # arrive here alike the manifest keeps the second in silence,\n"
     "                # and half the geometry the name covers is gone from every step\n"
     "                # that reads it.\n"
     "                raise SystemExit(\n"
     "                    f'{src}：{name} 與 {manifest[\"parts\"][label][\"mesh\"]} '\n"
     "                    f'都拿到部件名稱 {label}，resolve_clashes 沒有把它們分開。')\n",
     ''),
    ('C8', ['the_label_written_into_the_geometry_is_the_manifests'],
     'the geometry is stamped with the name the grammar gave, while the '
     'manifest lists the name the resolver gave',
     "                rebuilt[i].setdefault('extras', {})['part'] = resolved[c]",
     "                rebuilt[i].setdefault('extras', {})['part'] = "
     "claims[c]['label']"),

    ('C9', ['the_number_skips_a_name_the_grammar_already_wrote'],
     'the names already taken start out empty, so only the ones this run '
     'invents are avoided',
     "    names, taken = [None] * len(claims), {c['label'] for c in claims}",
     '    names, taken = [None] * len(claims), set()'),

    ('C10', ['a_name_two_meshes_claim_goes_to_the_one_reaching_furthest'],
     'the numbering starts at one, so the first trailing claim is `_1`',
     '        names[keeper] = label\n        n = 2',
     '        names[keeper] = label\n        n = 1'),

]


def restore(originals, tag):
    """Put the mutated files back, and say how to recover if that fails.

    The restore is the one step that must not fail quietly. On 2026-09-12 it
    failed loudly and still left a mutation behind: the disk filled up between
    the mutation and the restore, `write_bytes` raised ENOSPC, and the file was
    left holding a defence a table had just removed. A traceback in a log
    nobody re-reads is not a recovery instruction, so this prints one.
    """
    for path, raw in originals.items():
        try:
            path.write_bytes(raw)
        except OSError as e:
            raise SystemExit(
                f'{tag}: COULD NOT RESTORE {path} ({e}).\n'
                f'  The working copy still holds this row\'s mutation. Recover with\n'
                f'    git cat-file blob HEAD:{path.relative_to(REPO)} > {path}\n'
                f'  and check `git diff --stat HEAD -- {path.relative_to(REPO)}` is empty.'
            ) from None
        if path.read_bytes() != raw:
            raise SystemExit(f'{tag}: restore of {path.name} wrote different bytes')


def run():
    shutil.rmtree(HERE / '__pycache__', ignore_errors=True)
    p = subprocess.run([sys.executable, '-m', 'unittest', *TESTS],
                       cwd=HERE, capture_output=True, text=True)
    tail = p.stderr.strip().splitlines()
    ran = next((l for l in tail if l.startswith('Ran ')), '?')
    failed = [l for l in tail if l.startswith('FAIL:') or l.startswith('ERROR:')]
    return p.returncode, ran, failed


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    dirty = subprocess.run(['git', '-C', str(REPO), 'status', '--porcelain', '--',
                            str(TARGET.relative_to(REPO))],
                           capture_output=True, text=True, check=True).stdout.strip()
    if dirty:
        raise SystemExit(f'{TARGET.name} is not clean in git ({dirty}): refusing to '
                         'start, because a mutation here can only be restored to '
                         'what is committed')
    committed = pathlib.Path(sys.argv[1]).read_bytes()
    if TARGET.read_bytes() != committed:
        raise SystemExit('partition.py differs from the committed blob: refusing to '
                         'start, because this run would restore to a mutated file')

    code, ran, failed = run()
    if code != 0:
        raise SystemExit(f'baseline is not green ({ran}); nothing below would mean anything')
    sha = subprocess.run(['git', 'hash-object', str(TARGET)],
                         capture_output=True, text=True, check=True).stdout.strip()
    print(f'partition.py  blob {sha}\nbaseline  {ran}  green\n')

    for tag, expect, what, old, new in MUTATIONS:
        base = TARGET.read_bytes()
        text = base.decode()
        hits = text.count(old)
        assert hits == 1, f'{tag}: PATTERN HIT {hits} TIMES'
        TARGET.write_bytes(text.replace(old, new).encode())
        try:
            code, ran, failed = run()
        finally:
            restore({TARGET: base}, tag)
        missing = [frag for frag in expect
                   if not any(frag in line for line in failed)]
        # A class whose setUpClass errors reports one line naming the class,
        # not one per test, so an expectation has to be able to name either.
        extra = sorted({line.split(':', 1)[1].strip() for line in failed
                        if not any(frag in line for frag in expect)})
        verdict = 'as expected' if not missing else f'*** STILL GREEN: {missing} ***'
        print(f'{tag}  {what}\n    {ran}  {"RED" if code else "GREEN"}  {verdict}')
        if extra:
            print(f'    also red: {extra}')
        print()


if __name__ == '__main__':
    main()
