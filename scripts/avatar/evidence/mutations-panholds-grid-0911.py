import subprocess, pathlib, re, sys
SRC = pathlib.Path('src/components/chat/clearance.ts')
base = SRC.read_bytes()
old = "  if (Math.abs(declared * 100 - Math.round(declared * 100)) > 1e-6) {"
new = "  if (false) {"
t = base.decode()
assert t.count(old) == 1, f'PATTERN HIT {t.count(old)} TIMES'
SRC.write_bytes(t.replace(old, new).encode())
try:
    p = subprocess.run(['npx','vitest','run','src/components/chat/clearance.test.ts'],
                       capture_output=True, text=True)
finally:
    SRC.write_bytes(base)
assert SRC.read_bytes() == base
out = p.stdout + p.stderr
m = re.search(r'Tests\s+(?:(\d+) failed \| )?(\d+) passed', out)
print('P6 panHolds stops requiring the pan to sit on the centimetre ->',
      'RED' if p.returncode else 'GREEN', f'({m.group(1) or 0} failed, {m.group(2)} passed)')
for n in sorted(set(re.findall(r'× [^\n]*? > ([^\n]+?)(?:\s+\d+ms)?$', out, re.M))):
    print('      ', n)
