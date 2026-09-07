"""Is the shipped body's vertex sha still what this code produces, and if not, since when?

    python3 scripts/avatar/evidence/scale-0907-sha.py

The waist search became span-relative on 2026-09-07 and the vertex masks it
decides came out identical, but a rebuild had not been run. It has now, and the
result did NOT match the shipped mika-milfy-12.vrm -- so this asks the only
question that separates the two explanations: rebuild once with the OLD absolute
band and everything else at HEAD. Same sha as the new band means the waist
change is not the cause and the shipped artefact was already behind the code.
"""
import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AV = Path('/Users/charles/portfolio/scripts/avatar')
BUILD = AV / 'build.py'
RUN = [sys.executable, str(AV / 'evidence' / 'scale-0907-build.py'), '1.0']

NEW = ("             for y in np.arange(hips_y + span * w['from'], hips_y + span * w['to'],\n"
       "                                span * w['step'])\n"
       "             if (m := np.abs(p[:, 1] - y) < span * w['slab']).sum() > 12]\n")
OLD = ("             for y in np.arange(0.88, 1.16, 0.01)\n"
       "             if (m := np.abs(p[:, 1] - y) < 0.012).sum() > 12]\n")


def sha_of_run():
    r = subprocess.run(RUN, cwd=AV, capture_output=True, text=True)
    out = r.stdout + r.stderr
    for line in out.splitlines():
        if 'vertex sha' in line:
            return line.split()[-1]
    return f'(no sha; exit {r.returncode})'


def main():
    sys.path.insert(0, str(AV))
    import verify
    shipped = verify.stats(str(AV.parent.parent / 'public' / 'avatar' / 'mika-milfy-12.vrm'))
    print(f'shipped mika-milfy-12.vrm      {shipped["vertex_sha"]}')

    print(f'rebuild, span-relative band    {sha_of_run()}')

    hits = BUILD.read_text().count(NEW)
    if hits != 1:
        print(f'ABORT: band pattern hit {hits} times, not 1')
        return 1
    backup = Path(tempfile.mkdtemp()) / BUILD.name
    shutil.copy2(BUILD, backup)
    before = hashlib.sha256(BUILD.read_bytes()).hexdigest()
    BUILD.write_text(BUILD.read_text().replace(NEW, OLD))
    try:
        print(f'rebuild, OLD absolute band     {sha_of_run()}')
    finally:
        shutil.copy2(backup, BUILD)
    print(f'build.py restored: {hashlib.sha256(BUILD.read_bytes()).hexdigest() == before}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
