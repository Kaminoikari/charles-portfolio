import subprocess, pathlib, re, sys
SRC = pathlib.Path('src/components/chat/avatarMotions.ts')
base = SRC.read_bytes()
old = "    (name) => AVATAR_MOTIONS[name].placements.includes(frame) && !(name in excluded),"
new = "    (name) => AVATAR_MOTIONS[name].placements.includes(frame),"
t = base.decode()
assert t.count(old) == 1, f'PATTERN HIT {t.count(old)} TIMES'

def run(fam):
    p = subprocess.run(['npx','vitest','run','src/components/chat/rigProbe.test.ts',
                        '-t', f"bundled motions on '{fam}'"], capture_output=True, text=True)
    out = p.stdout + p.stderr
    m = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed', out)
    return (int(m.group(1) or 0), int(m.group(2)), out) if m else (-1, -1, out)

fam = sys.argv[1]
f0, p0, _ = run(fam)
print(f'R5 baseline {fam}: {p0} passed, {f0} failed')
assert p0 > 0 and f0 == 0, 'baseline not green, or the filter selected nothing'
SRC.write_bytes(t.replace(old, new).encode())
try:
    f1, p1, out = run(fam)
finally:
    SRC.write_bytes(base)
assert SRC.read_bytes() == base
print(f'R5 mutated  {fam}: {p1} passed, {f1} failed ->', 'RED' if f1 else 'GREEN')
for n in sorted(set(re.findall(r"× bundled motions on '" + re.escape(fam) + r"' > ([^\n]+?)(?:\s+\d+ms)?$", out, re.M))):
    print('      ', n)
