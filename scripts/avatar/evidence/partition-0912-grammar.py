"""Which bodies partition can name, and whether it names them correctly.

Run against the working tree; prints the same two tables the plan quotes.
The second one is the point: four bodies used to pass recognise() and get two
primitives labelled wrong, because BODY_NAMES read the primitive INDEX and
those four export their outfit in a different order.

    python3 scripts/avatar/evidence/partition-0912-grammar.py
"""
import glob
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

import glb          # noqa: E402
import partition    # noqa: E402

# BODY_NAMES as it stood at c5af808, the blob this replaced.
WAS = {0: 'Body_Skin', 1: 'Body_Skin', 2: 'Body_Skin', 3: 'Body_Skin',
       4: 'Outfit_Top', 5: 'Outfit_Bottom', 6: 'Outfit_Shoes'}

bodies = sorted(glob.glob(os.path.join(HERE, '..', '..', '..',
                                       'public', 'avatar', '*.vrm')))
scratch = tempfile.mkdtemp()
passed, mislabelled, widened = [], [], []

print('recognise(), body by body')
for path in bodies:
    name = os.path.basename(path)
    doc = glb.load(path)[0]
    reasons = partition.recognise(doc)
    if reasons:
        print(f'  refused  {name:<30} {reasons[0][:60]}')
        continue
    passed.append(name)
    mats = [m.get('name', f'#{i}') for i, m in enumerate(doc['materials'])]
    mesh = next(m for m in doc['meshes'] if m.get('name') == partition.BODY_MESH)
    labels = [partition.body_name(mats[p['material']]) for p in mesh['primitives']]
    # The old recognise() refused anything whose body mesh did not have
    # exactly len(WAS) primitives, so only these could be mislabelled.
    was_recognised = len(labels) == len(WAS)
    wrong = [(i, WAS[i], labels[i]) for i in range(len(labels))
             if i in WAS and WAS[i] != labels[i]]
    if wrong and was_recognised:
        mislabelled.append((name, wrong))
    elif not was_recognised:
        widened.append((name, len(labels)))
    print(f'  ok       {name:<30} {len(labels)} prim'
          + ('   舊 recognise 拒絕它' if not was_recognised else
             f'   {len(wrong)} 個舊標籤是錯的' if wrong else ''))

print(f'\n{len(passed)} of {len(bodies)} recognised\n')
print('bodies the old check PASSED and the index table then mislabelled')
for name, wrong in mislabelled:
    for i, was, now in wrong:
        print(f'  {name:<30} #{i}  {was:<14} -> {now}')
print(f'  {len(mislabelled)} bodies, '
      f'{sum(len(w) for _, w in mislabelled)} primitives\n')
print('bodies the old check REFUSED on primitive count, now named')
for name, n in widened:
    print(f'  {name:<30} {n} prim')
print(f'  {len(widened)} bodies\n')

print('partition() end to end')
for name in passed:
    path = os.path.join(HERE, '..', '..', '..', 'public', 'avatar', name)
    m, size = partition.partition(path, os.path.join(scratch, name),
                                  os.path.join(scratch, name + '.json'))
    body = sorted(k for k, v in m['parts'].items()
                  if v['mesh'] == partition.BODY_MESH)
    print(f'  {name:<30} {len(m["parts"]):>2} parts   ' + ', '.join(body))
