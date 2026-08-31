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
  * the number of CITATION SITES in the table must equal the number of rows
    matched here, so adding a row -- or dropping one from this file -- fails
    loudly. Comparing sets of receipt NUMBERS instead was not enough: numbers
    repeat across rows, so a new row citing an already-cited number vanished
    into the set difference, and nine of the nineteen rows could be deleted
    from this file with the check still green;
  * every cited receipt must exist, since coverage needs only ONE cited
    receipt to carry the evidence and the others were otherwise never read.

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
    'loud_outlines':                  'loud_outlines',
    'undeclared_rims':                'undeclared_rims',
    'unused_materials':               'unused_materials',
    'misaligned_material_properties': 'misaligned_material_properties',
    'loose_sparse_bounds':            'loose_sparse_bounds',
    'ragged_targets':                 'ragged_targets',
    'torn_shapes':                    'torn_shapes',
    'SHAPE_KEY_MIN_MEAN':             'SHAPE_KEY_MIN_MEAN',
    'prune_shapes':                   'prune_shapes',
    'sweep_materials':                'sweep_materials',
    'selftest:shape-key-parts':       'shape key 名字指到活的部件',
    'selftest:manifest-displace':     'manifest 指名的 key 仍會位移',
    'selftest:file-in-manifest':      '檔案宣告的 key 都在 manifest 裡',
    'selftest:target-count':          '每個 mesh 只有一個 target 數',
    'selftest:no-idle-material':      '沒有材質塗不到東西',
    'selftest:palette-parts':         '指得到還在的**部件**',
    'selftest:palette-material':      '指得到還在的**材質**',
    'selftest:matprops':              'materialProperties 與 materials 逐位置對得上',
    'frontend:avatarRim':             'avatarRim.test.ts',
}

CITATION = re.compile(r'\[(?:收據 )?([0-9]+(?:、[0-9]+)*)\]')


def spans(rows):
    """{guard: the slice of the table that is its own row}.

    Each guard's citation must be looked for inside its OWN row. Searching
    `<guard>.*?[收據 N]` across the whole table instead lets a row with no
    citation quietly adopt the next row's: deleting loud_outlines' citation
    made it report `cited ['11']`, a number the table no longer contained.
    Bounding each guard at the next guard's anchor removes that reach.
    """
    at = {}
    for guard, anchor in GUARDS.items():
        hits = [m.start() for m in re.finditer(re.escape(anchor), rows)]
        if len(hits) != 1:
            raise SystemExit(
                f'anchor for {guard} appears {len(hits)} times in the table, '
                f'expected exactly 1 -- the anchor is no longer unique')
        at[guard] = hits[0]
    order = sorted(at, key=at.get)
    out = {}
    for i, guard in enumerate(order):
        end = at[order[i + 1]] if i + 1 < len(order) else len(rows)
        out[guard] = rows[at[guard]:end]
    return out


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
    mutations = open(mutations_path, encoding='utf-8').read()
    ev = evidence(mutations)
    receipts_seen = set(re.findall(r'^## (\d+)\.', mutations, re.M))

    naked, cited_total, matched_rows = [], set(), 0
    row_of = spans(rows)
    for guard in GUARDS:
        m = CITATION.search(row_of[guard])
        if not m:
            print(f'  {guard:34s} {"":14s} ITS ROW CITES NO RECEIPT')
            naked.append(guard)
            continue
        matched_rows += 1
        cites = m.group(1).split('、')
        cited_total.update(cites)
        good = [c for c in cites if guard in ev.get(c, ())]
        mark = 'ok' if good else 'NO RECEIPT CARRIES ITS EVIDENCE'
        print(f'  {guard:34s} cited {str(cites):14s} evidence in {good or "-"}  {mark}')
        if not good:
            naked.append(guard)

    # Count CITATION SITES, not receipt numbers. The unit being protected is
    # the row: a row added to the table without being added here is only
    # noticed if its citation is unaccounted for, and receipt numbers repeat
    # across rows, so a new row citing an already-cited number was absorbed
    # into a set difference and skipped in silence. Counting sites cannot be
    # fooled that way -- one row is one site whatever number it cites.
    sites = (len(re.findall(r'\[收據 [0-9、]+\]', rows))
             + len(re.findall(r'(?<!收據 )\[[0-9]+(?:、[0-9]+)*\]', rows)))
    unmatched_rows = sites - matched_rows

    # Every cited receipt must exist, or a row can be padded with invented
    # numbers: coverage only needs ONE cited receipt to carry the evidence,
    # so the rest were never looked at.
    ghosts = sorted({c for c in cited_total if c not in receipts_seen}, key=int)

    print(f'\n  {sites} citation sites in the table, {len(GUARDS)} guards known,'
          f' {len(GUARDS) - len(naked)} with evidence')
    if naked:
        print('  guards with no receipt carrying their evidence:')
        for g in naked:
            print(f'    {g}')
    if unmatched_rows:
        print(f'  {unmatched_rows} citation site(s) in the table match no guard '
              f'listed here -- a row was added without being added to GUARDS')
    if ghosts:
        print(f'  cited receipts that do not exist in the receipts file: {ghosts}')
    return 1 if (naked or unmatched_rows or ghosts) else 0


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('用法：python3 receipts.py <RESULT.txt> <mutations.md>')
    sys.exit(main(sys.argv[1], sys.argv[2]))
