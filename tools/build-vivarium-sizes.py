"""Offline only: pinned PokeAPI CSV + shipped PMD alpha bounds. Requires Pillow.
Usage: python tools/build-vivarium-sizes.py coverage/pokemon-heights-source.csv
"""
import csv
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REVISION = '81d20919845b6a445969b9265aab5cec6b04cece'
source = Path(sys.argv[1])
heights = {int(r['id']): int(r['height']) for r in csv.DictReader(source.open(encoding='utf-8'))
           if 1 <= int(r['id']) <= 493 and r['is_default'] == '1'}
assert len(heights) == 493
metadata = json.loads((ROOT / 'assets/pokemon_pmd/metadata.js').read_text(encoding='utf-8').split('Object.freeze(', 1)[1].strip().removesuffix(');'))
bodies = {}
for dex, variants in metadata.items():
    for key, animations in variants.items():
        a = animations['Idle']
        with Image.open(ROOT / 'assets/pokemon_pmd' / a['file']) as image:
            frame = image.convert('RGBA').crop((0, 0, a['w'], a['h']))
            box = frame.getchannel('A').getbbox()
            if box:
                bodies[f'{dex}/{key}'] = box[3] - box[1]
target = ROOT / 'assets/vivarium'
(target / 'sizes.js').write_text('// Generated offline by tools/build-vivarium-sizes.py; heights in decimetres.\n'
    + 'export const HEIGHT_DM = ' + json.dumps(heights, separators=(',', ':')) + ';\n'
    + 'export const PMD_BODY_HEIGHT = ' + json.dumps(bodies, separators=(',', ':')) + ';\n', encoding='utf-8')
(target / 'sizes-provenance.json').write_text(json.dumps(dict(
    source=f'https://github.com/PokeAPI/pokeapi/blob/{REVISION}/data/v2/csv/pokemon.csv',
    revision=REVISION, source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
    units='decimetres', species=len(heights), license='PokeAPI-LICENSE.md',
    body_metrics='First Down Idle frame alpha bounds of shipped PMD sheets; regenerate when updating assets.'), indent=2) + '\n', encoding='utf-8')
print(f'{len(heights)} heights and {len(bodies)} PMD body measurements, {(target / "sizes.js").stat().st_size} bytes')
