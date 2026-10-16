"""Import Idle/Walk for species actually supported by PokéGang from SpriteCollab.

Requires Python/Pillow and Node. Originals are cached under ignored coverage/;
runtime PNGs are copied without recompression. No PokéSurvivor code or data.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib
import json
from pathlib import Path
import shutil
import statistics
import subprocess
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REVISION = "e7868e9a7f6b931d1fb826756a490d4633879d03"
RAW = f"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{REVISION}/"
SOURCE_LINK = f"https://github.com/PMDCollab/SpriteCollab/blob/{REVISION}/"


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def fetch(cache, relative):
    file = cache / relative
    if file.exists():
        return file
    missing = file.with_name(file.name + ".missing")
    if missing.exists():
        return None
    request = urllib.request.Request(RAW + relative, headers={"User-Agent": "Pokegang-PMD-catalog-import"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = response.read()
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_bytes(data)
            return file
        except urllib.error.HTTPError as error:
            if error.code == 404:
                file.parent.mkdir(parents=True, exist_ok=True)
                missing.write_text(relative, encoding="utf-8")
                return None
            if attempt == 3:
                raise
            time.sleep(min(20, int(error.headers.get("Retry-After", "0")) or 2 ** attempt))
        except OSError:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def supported_species():
    script = """
const fs = require('fs'), vm = require('vm');
const context = {}; vm.createContext(context);
vm.runInContext(fs.readFileSync('data/species-data.js', 'utf8') +
  ';globalThis.species = Object.values(SPECIES_BY_EN).map(s => ({dex:s.dex,en:s.en,fr:s.fr}));', context);
process.stdout.write(JSON.stringify(context.species));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True)
    return sorted(json.loads(result.stdout), key=lambda item: item["dex"])


def resolve_animation(nodes, name):
    seen = set()
    while name not in seen:
        seen.add(name)
        node = nodes.get(name)
        if node is None:
            raise ValueError(f"Missing animation {name}")
        copied = node.findtext("CopyOf")
        if not copied:
            return name, node
        name = copied
    raise ValueError("Animation alias cycle")


def import_variant(cache, species, variant):
    dex = species["dex"]
    relative = f"sprite/{dex:04d}" + ("/0000/0001" if variant == "shiny" else "")
    xml_file = fetch(cache, relative + "/AnimData.xml")
    if xml_file is None:
        return {"dex": dex, "variant": variant, "missing": "No AnimData.xml"}
    credit_file = fetch(cache, relative + "/credits.txt")
    if credit_file is None or not credit_file.read_text(encoding="utf-8").strip():
        return {"dex": dex, "variant": variant, "missing": "No credits"}
    nodes = {node.findtext("Name"): node for node in ET.parse(xml_file).findall("./Anims/Anim")}
    animations, resources = {}, []
    try:
        for requested in ("Idle", "Walk"):
            source_name, node = resolve_animation(nodes, requested)
            w, h = int(node.findtext("FrameWidth")), int(node.findtext("FrameHeight"))
            durations = [int(d.text) for d in node.findall("./Durations/Duration")]
            if min(w, h) <= 0 or not durations or min(durations) <= 0:
                raise ValueError(f"Invalid XML geometry/durations: {requested}")
            png_relative, shadow_relative = (relative + f"/{source_name}-{suffix}.png" for suffix in ("Anim", "Shadow"))
            png_file, shadow_file = fetch(cache, png_relative), fetch(cache, shadow_relative)
            if png_file is None or shadow_file is None:
                raise ValueError(f"Missing source PNG/shadow: {requested}")
            with Image.open(png_file) as image:
                width, height = image.size
            if width % w or height % h or width // w != len(durations) or not 1 <= height // h <= 8:
                raise ValueError(f"Unsupported sheet dimensions: {requested} {width}x{height}, frame {w}x{h}")
            rows = height // h
            anchors = []
            with Image.open(shadow_file) as shadow:
                if shadow.size != (width, height):
                    raise ValueError(f"Shadow geometry mismatch: {requested}")
                shadow = shadow.convert("RGBA")
                for row in range(rows):
                    for frame in range(len(durations)):
                        bbox = shadow.crop((frame * w, row * h, (frame + 1) * w, (row + 1) * h)).getbbox()
                        if bbox:
                            left, top, right, bottom = bbox
                            anchors.append(((left + right - 1) / 2, (top + bottom - 1) / 2))
            if not anchors:
                raise ValueError(f"No shadow anchor: {requested}")
            ax, ay = (statistics.median(point[i] for point in anchors) for i in (0, 1))
            file = f"{dex}/" + ("s/" if variant == "shiny" else "") + requested + ".png"
            meta = {"w": w, "h": h, "n": len(durations), "r": rows, "d": durations, "ax": ax, "ay": ay, "file": file}
            animations[requested] = meta
            resources.append({"dex": dex, "variant": variant, "animation": requested,
                "source": SOURCE_LINK + png_relative, "file": file, "sha256": digest(png_file),
                "xml_source": SOURCE_LINK + relative + "/AnimData.xml", "xml_sha256": digest(xml_file),
                "shadow_source": SOURCE_LINK + shadow_relative, "shadow_sha256": digest(shadow_file),
                "credits_source": SOURCE_LINK + relative + "/credits.txt", "credits_sha256": digest(credit_file),
                "anchor_method": "median shadow pixel centres across all frames/directions",
                "source_animation": source_name, "cache_file": str(png_file)})
    except (ValueError, TypeError) as error:
        return {"dex": dex, "variant": variant, "missing": str(error)}
    return {"dex": dex, "variant": variant, "animations": animations, "resources": resources,
        "credits": credit_file.read_text(encoding="utf-8")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--dex", type=int, nargs="+")
    parser.add_argument("--output", default="assets/pokemon_pmd")
    args = parser.parse_args()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT) or output == ROOT:
        raise ValueError("Output must be a subdirectory of the repository")
    cache = ROOT / "coverage/pmd-source-cache"
    species = supported_species()
    if args.dex is not None:
        species = [item for item in species if item["dex"] in args.dex]
    print(f"Auditing {len(species)} supported species at SpriteCollab {REVISION}", flush=True)
    results = []
    with ThreadPoolExecutor(max_workers=max(1, min(12, args.workers))) as pool:
        futures = [pool.submit(import_variant, cache, item, variant) for item in species for variant in ("normal", "shiny")]
        for future in as_completed(futures):
            results.append(future.result())
            if len(results) % 50 == 0:
                print(f"Sources checked: {len(results)}/{len(futures)} variants", flush=True)
    catalog, resources, credits, missing = {}, [], {}, []
    output.mkdir(parents=True, exist_ok=True)
    for result in sorted(results, key=lambda item: (item["dex"], item["variant"])):
        if "missing" in result:
            missing.append(result)
            continue
        dex, variant = result["dex"], result["variant"]
        catalog.setdefault(dex, {})[variant] = result["animations"]
        credits[f"{dex}/{variant}"] = result["credits"]
        for resource in result["resources"]:
            target = output / resource["file"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(resource.pop("cache_file"), target)
            resources.append(resource)
    for file, target in (("LICENSE.md", "SPRITECOLLAB-LICENSE.md"), ("credit_names.txt", "credit_names.txt")):
        source = fetch(cache, file)
        if source is None:
            raise ValueError(f"Required license/credits missing: {file}")
        shutil.copy2(source, output / target)
    (output / "metadata.js").write_text("// Generated by tools/import-pmd-catalog.py from pinned SpriteCollab XML and shadows.\n"
        + "export const PMD_METADATA = Object.freeze(" + json.dumps(catalog, separators=(",", ":")) + ");\n", encoding="utf-8")
    (output / "provenance.json").write_text(json.dumps({"revision": REVISION, "resources": resources}, separators=(",", ":")) + "\n", encoding="utf-8")
    (output / "credits.json").write_text(json.dumps({"revision": REVISION, "variants": credits}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    counts = {"supported_species": len(species), "normal_variants": sum("normal" in item for item in catalog.values()),
        "shiny_variants": sum("shiny" in item for item in catalog.values()), "png_files": len(resources),
        "png_bytes": sum((output / item["file"]).stat().st_size for item in resources)}
    (output / "coverage.json").write_text(json.dumps({"revision": REVISION, **counts, "species": species,
        "missing_variants": missing}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts), flush=True)
    print(f"Missing variants ({len(missing)}): {json.dumps(missing)}", flush=True)


if __name__ == "__main__":
    main()
