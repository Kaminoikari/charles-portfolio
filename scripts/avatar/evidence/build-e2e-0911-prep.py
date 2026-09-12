"""make.py steps 0b-4 into a scratch OUT, so build() can be run without
touching public/avatar. The shipped VRM is served cache-immutable under a
versioned name, and this pipeline has a known byte non-determinism, so
regenerating it in place is not a safe way to check a refactor."""
import os, sys
HERE = '/Users/charles/portfolio/scripts/avatar'
sys.path.insert(0, HERE)
os.chdir(HERE)
import customise, partition, proportion, skin, vrm1to0
from make import HEAD_FACTOR
from outfits import mellowheart

OUT = sys.argv[1]
p = lambda n: os.path.join(OUT, n)
base = vrm1to0.ensure_vrm0(os.path.join(HERE, 'baseline.vrm'), p('base-vrm0.vrm'))
m, _ = partition.partition(base, p('parted.vrm'), p('parts.json'))
print('partition', len(m['parts']), 'parts')
r = customise.apply(p('parted.vrm'), p('stripped.vrm'), p('parts.json'),
                    drop=customise.replaced(m, mellowheart.REPLACES),
                    manifest_out=p('parts.json'))
print('strip', r['primitives_removed'], 'primitives')
share, _ = skin.apply(p('stripped.vrm'), p('bare.vrm'))
print(f'skin {share*100:.1f}%')
n, _ = proportion.apply(p('bare.vrm'), p('proportioned.vrm'), HEAD_FACTOR)
print('proportion', n, 'accessors')
