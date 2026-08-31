"""Cross-check RESULT.txt's guard table against the mutation receipts.

Rounds 5, 6 and 7 were each spent on one defect: the guard table credits a
guard to a receipt that reddens a DIFFERENT check, so the guard has no proof
and the table conceals that instead of showing it. Fixing it a row at a time
is why it came back three times.

The first version of this script had the same bug it was written to catch. It
searched every receipt for a mention of the guard, so a receipt that merely
NAMED a guard counted as exercising it -- and receipt 15's prose names the
palette-parts check while explicitly saying its mutation pins neither palette
check. Deleting the receipt that really pins that guard left the check green.
It also carried its own hardcoded list of guards, which silently omitted three
rows of the table, so deleting their receipts changed nothing either.

So the unit of checking is the CITATION, not the guard:

  * the cited receipt numbers come from RESULT.txt, not from this file, so a
    row whose citation changes is followed automatically;
  * a receipt counts only if it carries an `EVIDENCE guard=<token>` line whose
    control and mutated values DIFFER -- prose mentioning the guard is not
    enough, which is exactly the hole the first version had;
  * every citation in the table must belong to a guard listed here, so adding
    a row without adding it here fails loudly instead of being skipped.

What this does NOT prove: that the mutations were really run. It checks that
the table and the receipts agree with each other. The receipts are the record
of the runs; this stops the table from citing one that says something else.

    python3 receipts.py <RESULT.txt> <mutations.md>

Exit 1 on any uncovered guard or unknown citation. Strip this when the guard
table is generated from the receipts rather than written by hand.
"""
import re
import sys

# guard token -> regex locating that row's citation in the guard table.
# The token is what the receipt's EVIDENCE line must name.
GUARDS = {
    'loud_outlines':                  r'loud_outlines.*?\[收據 ([0-9、]+)\]',
    'undeclared_rims':                r'undeclared_rims.*?\[收據 ([0-9、]+)\]',
    'unused_materials':               r'unused_materials.*?\[收據 ([0-9、]+)\]',
    'misaligned_material_properties': r'misaligned_material_properties.*?\[收據 ([0-9、]+)\]',
    'loose_sparse_bounds':            r'loose_sparse_bounds.*?\[收據 ([0-9、]+)\]',
    'ragged_targets':                 r'ragged_targets.*?\[收據 ([0-9、]+)\]',
    'torn_shapes':                    r'torn_shapes.*?\[收據 ([0-9、]+)\]',
    'SHAPE_KEY_MIN_MEAN':             r'SHAPE_KEY_MIN_MEAN.*?\[收據 ([0-9、]+)\]',
    'prune_shapes':                   r'prune_shapes.*?\[收據 ([0-9、]+)\]',
    'sweep_materials':                r'sweep_materials.*?\[收據 ([0-9、]+)\]',
    'selftest:shape-key-parts':       r'shape key 名字指到活的部件 \[([0-9、]+)\]',
    'selftest:manifest-displace':     r'manifest 指名的 key 仍會位移 \[([0-9、]+)\]',
    'selftest:file-in-manifest':      r'檔案宣告的 key 都在 manifest 裡 \[([0-9、]+)\]',
    'selftest:target-count':          r'每個 mesh 只有一個 target 數\s*\[([0-9、]+)\]',
    'selftest:no-idle-material':      r'沒有材質塗不到東西 \[([0-9、]+)\]',
    'selftest:palette-parts':         r'指得到還在的\*\*部件\*\*\s*\[([0-9、]+)\]',
    'selftest:palette-material':      r'指得到還在的\*\*材質\*\* \[([0-9、]+)\]',
    'selftest:matprops':              r'materialProperties 與 materials 逐位置對得上 \[([0-9、]+)\]',
    'frontend:avatarRim':             r'avatarRim\.test\.ts.*?\[收據 ([0-9、]+)\]',
}


def table(report):
    """Section six of RESULT.txt, newlines and runs of spaces flattened.

    The table wraps mid-row, so a citation and the name it belongs to are
    routinely on different lines; matching has to see the row as one string.
    """
    # Start at the first ROW, not at the section heading: the heading's own
    # prose names several guards while explaining an earlier round's mistake,
    # and a `.*?` from there happily walks past the real row and picks up the
    # NEXT row's citation. That mis-credited SHAPE_KEY_MIN_MEAN to receipt 11.
    # The anchor is the first row's exact leading text, because that prose
    # says 'verify.py' too -- anchoring on the bare name lands inside it.
    i = report.index('六、新增的守衛')
    i = report.index('  verify.py  loud_outlines', i)
    j = report.index('\n===', i)
    return re.sub(r'\s+', ' ', report[i:j])


def evidence(mutations):
    """{receipt number: {guard tokens it carries real evidence for}}."""
    out, cur = {}, None
    for line in mutations.splitlines():
        m = re.match(r'^## (\d+)\.', line)
        if m:
            cur = m.group(1)
        e = re.match(r'\s*EVIDENCE guard=(\S+) control=(\S+) mutated=(\S+)', line)
        if e and cur:
            token, control, mutated = e.groups()
            if control != mutated:          # identical values prove nothing
                out.setdefault(cur, set()).add(token)
    return out


def main(report_path, mutations_path):
    report = open(report_path, encoding='utf-8').read()
    rows = table(report)
    ev = evidence(open(mutations_path, encoding='utf-8').read())

    naked, cited_total = [], set()
    for guard, pattern in GUARDS.items():
        m = re.search(pattern, rows)
        if not m:
            print(f'  {guard:34s} {"":14s} NO ROW IN THE TABLE')
            naked.append(guard)
            continue
        cites = m.group(1).split('、')
        cited_total.update(cites)
        good = [c for c in cites if guard in ev.get(c, ())]
        mark = 'ok' if good else 'NO RECEIPT CARRIES ITS EVIDENCE'
        print(f'  {guard:34s} cited {str(cites):14s} evidence in {good or "-"}  {mark}')
        if not good:
            naked.append(guard)

    # A row added to the table without being added here would be skipped
    # silently -- which is how the first version missed three rows.
    all_cites = set(re.findall(r'\[收據 ([0-9、]+)\]', rows))
    all_cites |= set(re.findall(r'\[([0-9、]+)\]', rows))
    flat = {c for group in all_cites for c in group.split('、')}
    orphan = sorted(flat - cited_total, key=int)

    print(f'\n  {len(GUARDS)} guards, {len(GUARDS) - len(naked)} with evidence')
    if naked:
        print('  guards with no receipt carrying their evidence:')
        for g in naked:
            print(f'    {g}')
    if orphan:
        print(f'  citations in the table that belong to no guard listed here: {orphan}')
    return 1 if (naked or orphan) else 0


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('用法：python3 receipts.py <RESULT.txt> <mutations.md>')
    sys.exit(main(sys.argv[1], sys.argv[2]))
