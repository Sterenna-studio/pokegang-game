"""Import the selected runtime sheets only; never republish the source pack.

Usage: python tools/import-vivarium-characters.py path/to/official-pack.zip
Requires Pillow. Source archive stays outside public assets.
"""
import hashlib
import json
import sys
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
from PIL import Image, ImageChops

ARCHIVE_SHA256 = 'e9d240918b62460c76d56ec9e5d4067a4ee853979d16a6657c05917d9bfd2b99'
SOURCE = 'https://eeveeexpo.com/resources/609/'
ROOT = Path(__file__).resolve().parents[1] / 'assets/vivarium_characters'
# Stable trainer keys used by PokéGang. No beta assets, Pokémon or unrelated art.
SELECTED = {
    'nurse': '115_Nurse_1', 'scientist': '054_Scientist_M',
    'rocketgrunt': '184_Rocket_Grunt_M', 'rocketgruntf': '185_Rocket_Grunt_F',
    'archer': '189_Rocket_Executive_Archer', 'ariana': '188_Rocket_Executive_Ariana',
    'proton': '187_Rocket_Executive_Proton', 'giovanni': '190_Rocket_Boss_Giovanni',
    'acetrainer': '001_Ace_Trainer_M', 'acetrainerf': '002_Ace_Trainer_F',
    'pokefan': '040_Poke_Fan_M', 'pokefanf': '041_Poke_Fan_F',
    'camper': '015_Camper', 'picnicker': '016_Picnicker',
    'youngster': '024_Youngster', 'lass': '026_Lass', 'bugcatcher': '014_Bug_Catcher',
    'hiker': '046_Hiker', 'fisherman': '068_Fisherman', 'beauty': '045_Beauty',
    'blackbelt': '007_Black_Belt', 'swimmer': '028_Swimmer_M', 'swimmerf': '030_Swimmer_F',
    'gentleman': '037_Gentleman', 'juggler': '086_Juggler', 'burglar': '085_Burglar',
    'boarder': '010_Boarder', 'kimonogirl': '071_Kimono_Girl',
    'firebreather': '048_Firebreather', 'guitarist': '069_Guitarist',
    'sage': '072_Sage', 'skier': '011_Skier_M', 'psychic': '082_Psychic',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    archive = Path(sys.argv[1]).read_bytes()
    if sha(archive) != ARCHIVE_SHA256:
        raise ValueError('Unexpected source archive revision')
    metadata, resources = {}, []
    with ZipFile(BytesIO(archive)) as pack:
        prefix = 'Ultimate Gen 4 Overworlds Pack/'
        for key, source in SELECTED.items():
            name = prefix + 'All Official Overworlds/NPC_' + source + '.png'
            original = pack.read(name)
            image = Image.open(BytesIO(original)).convert('RGBA')
            if image.size != (256, 256):
                raise ValueError(f'Unexpected geometry: {name}')
            native = image.resize((128, 128), Image.Resampling.NEAREST)
            diff = ImageChops.difference(image, native.resize(image.size, Image.Resampling.NEAREST))
            if any(band.getbbox() for band in diff.split()):
                raise ValueError(f'Not an exact x2 enlargement: {name}')
            # HGSS source: down/left/right/up; shared renderer: down/right/up/left.
            sheet = Image.new('RGBA', (128, 128))
            for row, source_row in enumerate([0, 2, 3, 1]):
                sheet.paste(native.crop((0, source_row * 32, 128, (source_row + 1) * 32)), (0, row * 32))
            dest = ROOT / key / 'Walk.png'
            dest.parent.mkdir(parents=True, exist_ok=True)
            sheet.save(dest, optimize=True)
            animation = dict(file=f'{key}/Walk.png', w=32, h=32, n=4, r=4,
                             d=[9, 9, 9, 9], ax=16, ay=30)
            metadata[key] = dict(Idle={**animation, 'static': True}, Walk=animation)
            resources.append(dict(key=key, source_file=name, source_sha256=sha(original),
                                  file=f'{key}/Walk.png', sha256=sha(dest.read_bytes())))
        credits = pack.read(prefix + 'CREDIT IS NEEDED (PurpleZaffre).txt')
        (ROOT / 'SOURCE-CONDITIONS.txt').write_bytes(credits)
    (ROOT / 'metadata.js').write_text('export const CHARACTER_METADATA = '
        + json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    (ROOT / 'provenance.json').write_text(json.dumps(dict(source=SOURCE,
        archive_sha256=ARCHIVE_SHA256, credit='PurpleZaffre', resources=resources), indent=2) + '\n', encoding='utf-8')
    print(f'{len(resources)} sheets, {sum((ROOT / r["file"]).stat().st_size for r in resources)} PNG bytes')


if __name__ == '__main__':
    main()
