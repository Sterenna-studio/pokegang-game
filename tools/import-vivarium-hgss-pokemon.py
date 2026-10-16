"""Extract only supported, directional walking Pokémon from the credited pack.
Usage: python tools/import-vivarium-hgss-pokemon.py path/to/official-pack.zip
Requires Pillow. Never publish the source archive.
"""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageChops

ARCHIVE_SHA256 = 'e9d240918b62460c76d56ec9e5d4067a4ee853979d16a6657c05917d9bfd2b99'
ROOT = Path(__file__).resolve().parents[1] / 'assets/pokemon_hgss'
SELECTED = {
    427: 'Buneary', 390: 'Chimchar', 35: 'Clefairy', 453: 'Croagunk',
    425: 'Drifloon', 395: 'Empoleon', 388: 'Grotle', 130: 'Gyarados_Shiny',
    440: 'Happiny', 392: 'Infernape', 39: 'Jigglypuff', 131: 'Lapras',
    391: 'Monferno', 417: 'Pachirisu', 25: 'Pikachu', 393: 'Piplup',
    394: 'Prinplup', 54: 'Psyduck', 492: 'Shaymin_Land', 285: 'Shroomish',
    300: 'Skitty', 255: 'Torchic', 389: 'Torterra', 387: 'Turtwig',
}

def sha(data):
    return hashlib.sha256(data).hexdigest()

archive = Path(sys.argv[1]).read_bytes()
assert sha(archive) == ARCHIVE_SHA256, 'Unexpected pack revision'
metadata, resources = {}, []
ROOT.mkdir(parents=True, exist_ok=True)
with ZipFile(BytesIO(archive)) as pack:
    for dex, key in SELECTED.items():
        name = f'Ultimate Gen 4 Overworlds Pack/All Official Overworlds/Pokemon_{key}.png'
        original = pack.read(name)
        image = Image.open(BytesIO(original)).convert('RGBA')
        assert image.size == (256, 256), name
        native = image.resize((128, 128), Image.Resampling.NEAREST)
        diff = ImageChops.difference(image, native.resize(image.size, Image.Resampling.NEAREST))
        # Psyduck contains individual source pixels, not only enlarged pixels.
        # Keep its original resolution rather than discarding those details.
        reduced = not any(band.getbbox() for band in diff.split())
        if not reduced:
            native = image
        cell = native.width // 4
        sheet = Image.new('RGBA', native.size)
        for row, source_row in enumerate([0, 2, 3, 1]):
            sheet.paste(native.crop((0, source_row * cell, native.width, (source_row + 1) * cell)), (0, row * cell))
        assert len({sheet.crop((0, y * cell, native.width, (y + 1) * cell)).tobytes() for y in range(4)}) == 4, key
        assert len({sheet.crop((x * cell, 0, (x + 1) * cell, cell)).tobytes() for x in range(4)}) >= 2, key
        variant = 'shiny' if key.endswith('_Shiny') else 'normal'
        file = f'{dex}/' + ('s/' if variant == 'shiny' else '') + 'Walk.png'
        dest = ROOT / file
        dest.parent.mkdir(parents=True, exist_ok=True)
        sheet.save(dest, optimize=True)
        a = dict(file=file, w=cell, h=cell, n=4, r=4, d=[9, 9, 9, 9], ax=cell / 2, ay=cell * 30 / 32)
        box = sheet.crop((0, 0, cell, cell)).getchannel('A').getbbox()
        metadata.setdefault(dex, {})[variant] = dict(Idle={**a, 'static': True}, Walk=a)
        resources.append(dict(dex=dex, variant=variant, body_height=box[3] - box[1], exact_x2_reduction=reduced,
            source_file=name, source_sha256=sha(original), file=file, sha256=sha(dest.read_bytes())))
    (ROOT / 'SOURCE-CONDITIONS.txt').write_bytes(pack.read('Ultimate Gen 4 Overworlds Pack/CREDIT IS NEEDED (PurpleZaffre).txt'))
(ROOT / 'metadata.js').write_text('export const HGSS_METADATA = ' + json.dumps(metadata, separators=(',', ':'))
    + ';\nexport const HGSS_BODY_HEIGHT = ' + json.dumps({f'{r["dex"]}/{r["variant"]}': r['body_height'] for r in resources}, separators=(',', ':')) + ';\n', encoding='utf-8')
(ROOT / 'provenance.json').write_text(json.dumps(dict(source='https://eeveeexpo.com/resources/609/',
    archive_sha256=ARCHIVE_SHA256, credit='PurpleZaffre', resources=resources), indent=2) + '\n', encoding='utf-8')
print(f'{len(resources)} variants, {sum((ROOT / r["file"]).stat().st_size for r in resources)} PNG bytes')
