"""Prepare a local, ignored Lab runtime with the three-species PMD prototype.

No publishing, no changes to the production catalog. Requires Pillow.
Usage: python tools/prepare-pmd-preview.py
Sources are pinned SpriteCollab originals; no PokéSurvivor code/data is copied.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import shutil
import statistics
import time
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
REVISION = "e7868e9a7f6b931d1fb826756a490d4633879d03"
SOURCE = f"https://raw.githubusercontent.com/PMDCollab/SpriteCollab/{REVISION}/"
SPECIES = (41, 52, 92)
RUNTIME = ("index.html", "app.js", "css", "data", "modules", "state", "assets", "gang", "music")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def cached_source(cache, rel):
    file = cache / rel
    if not file.exists():
        request = urllib.request.Request(SOURCE + rel, headers={"User-Agent": "Pokegang-PMD-preview"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    data = response.read()
                break
            except OSError:
                if attempt == 2:
                    raise
                time.sleep(0.5 * (attempt + 1))
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)
    return file


def metadata_for(cache, rel, animation):
    xml = ET.parse(cache / rel / "AnimData.xml")
    nodes = {a.findtext("Name"): a for a in xml.findall("./Anims/Anim")}
    node = nodes[animation]
    # The requested prototype has concrete Idle/Walk animations, not CopyOf aliases.
    if node.find("CopyOf") is not None:
        raise ValueError(f"Unresolved animation alias: {rel}/{animation}")
    w, h = int(node.findtext("FrameWidth")), int(node.findtext("FrameHeight"))
    durations = [int(d.text) for d in node.findall("./Durations/Duration")]
    if not durations or min(durations) <= 0:
        raise ValueError(f"Invalid durations: {rel}/{animation}")
    with Image.open(cache / rel / f"{animation}-Anim.png") as sheet:
        width, height = sheet.size
    if width != w * len(durations) or height % h or height // h != 8:
        raise ValueError(f"Unexpected sheet geometry: {rel}/{animation} {width}x{height}")
    # Ground position comes from the Shadow sheet, never from the floating body
    # or the Offsets sheet's head/hand/body markers. Use all cells to detect drift.
    anchors = []
    with Image.open(cache / rel / f"{animation}-Shadow.png") as shadow:
        if shadow.size != (width, height):
            raise ValueError(f"Shadow dimensions differ: {rel}/{animation}")
        shadow = shadow.convert("RGBA")
        for row in range(8):
            for frame in range(len(durations)):
                bbox = shadow.crop((frame * w, row * h, (frame + 1) * w, (row + 1) * h)).getbbox()
                if bbox:
                    left, top, right, bottom = bbox
                    anchors.append(((left + right - 1) / 2, (top + bottom - 1) / 2))
    if not anchors:
        raise ValueError(f"Missing ground anchor: {rel}/{animation}")
    ax, ay = (statistics.median(a[i] for a in anchors) for i in (0, 1))
    # Small authored sways are part of these original animations (Zubat Walk:
    # up to two source pixels horizontally). Preserve that motion around one
    # stable ground anchor instead of cancelling it frame by frame.
    if any(abs(x - ax) > 2 or abs(y - ay) > 2 for x, y in anchors):
        raise ValueError(f"Per-frame ground drift requires review: {rel}/{animation}")
    return {"w": w, "h": h, "n": len(durations), "r": 8, "d": durations, "ax": ax, "ay": ay}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="coverage/pmd-preview-runtime")
    parser.add_argument("--source-cache", default="coverage/pmd-source-cache")
    args = parser.parse_args()
    output, cache = ((ROOT / value).resolve() for value in (args.output, args.source_cache))
    ignored = (ROOT / "coverage").resolve()
    for location in (output, cache):
        if not location.is_relative_to(ignored) or location == ignored:
            raise ValueError("Output/cache must be separate subdirectories inside ignored coverage/")
    if output == cache or output.is_relative_to(cache) or cache.is_relative_to(output):
        raise ValueError("Runtime and source cache must not overlap")
    relative_dirs = [(dex, variant, f"sprite/{dex:04d}" + ("/0000/0001" if variant == "shiny" else ""))
                     for dex in SPECIES for variant in ("normal", "shiny")]
    sources = ["LICENSE.md", "credit_names.txt"]
    for _, _, rel in relative_dirs:
        sources += [f"{rel}/AnimData.xml", f"{rel}/credits.txt"]
        sources += [f"{rel}/{anim}-{suffix}.png" for anim in ("Idle", "Walk") for suffix in ("Anim", "Shadow")]
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(lambda rel: cached_source(cache, rel), sources))
    catalog, provenance = {}, []
    for dex, variant, rel in relative_dirs:
        animations = {}
        for name in ("Idle", "Walk"):
            meta = metadata_for(cache, rel, name)
            meta["file"] = f"{dex}/" + ("s/" if variant == "shiny" else "") + name + ".png"
            animations[name] = meta
            provenance.append({"dex": dex, "variant": variant, "animation": name,
                "source": f"https://github.com/PMDCollab/SpriteCollab/blob/{REVISION}/{rel}/{name}-Anim.png",
                "file": meta["file"], "sha256": sha256((cache / rel / f"{name}-Anim.png").read_bytes()),
                "xml_sha256": sha256((cache / rel / "AnimData.xml").read_bytes()),
                "shadow_sha256": sha256((cache / rel / f"{name}-Shadow.png").read_bytes()),
                "anchor_method": "median of shadow bounding-box pixel centres across all frames/directions"})
        catalog.setdefault(dex, {})[variant] = animations
    # Refresh a complete runtime without deleting arbitrary/computed directories.
    output.mkdir(parents=True, exist_ok=True)
    for entry in RUNTIME:
        source, target = ROOT / entry, output / entry
        if not source.exists():
            continue
        if source.is_dir():
            shutil.copytree(source, target, dirs_exist_ok=True)
        else:
            shutil.copy2(source, target)
    assets = output / "assets/pokemon_pmd"
    for dex, variant, rel in relative_dirs:
        target = assets / str(dex) / ("s" if variant == "shiny" else "")
        target.mkdir(parents=True, exist_ok=True)
        for name in ("Idle", "Walk"):
            shutil.copy2(cache / rel / f"{name}-Anim.png", target / f"{name}.png")
        # Preserve exact upstream contribution notices and XML with the variant.
        shutil.copy2(cache / rel / "credits.txt", target / "credits.txt")
        shutil.copy2(cache / rel / "AnimData.xml", target / "AnimData.xml")
    shutil.copy2(cache / "LICENSE.md", assets / "SPRITECOLLAB-LICENSE.md")
    shutil.copy2(cache / "credit_names.txt", assets / "credit_names.txt")
    (assets / "metadata.js").write_text(
        "// Lab prototype only; generated from pinned SpriteCollab XML and Shadow PNGs.\n"
        + "export const PMD_METADATA = Object.freeze(" + json.dumps(catalog, separators=(",", ":")) + ");\n", encoding="utf-8")
    (assets / "provenance.json").write_text(json.dumps({"revision": REVISION, "resources": provenance}, indent=2) + "\n", encoding="utf-8")
    credits = (ROOT / "assets/pokemon_pmd/CREDITS.md").read_text(encoding="utf-8")
    (assets / "CREDITS.md").write_text(
        "# Prototype Lab : trois espèces, normal et shiny\n\n"
        "Cette copie de test contient douze PNG SpriteCollab, sans recompression.\n"
        "La décision de diffusion pour le test ne constitue pas une nouvelle autorisation des ayants droit.\n"
        "Crédits exacts et XML : auprès des PNG ; licence publiée : SPRITECOLLAB-LICENSE.md.\n"
        "Empreintes et sources : provenance.json. Le rapport historique ci-dessous décrit la livraison initiale sans assets.\n\n"
        + credits, encoding="utf-8")
    for name in ("pmd-preview.html", "pmd-preview.js"):
        shutil.copy2(ROOT / "tools/pmd-preview" / name, output / "gang" / name)
    count = len(provenance)
    size = sum((assets / resource["file"]).stat().st_size for resource in provenance)
    print(f"Prepared LOCAL preview: {output}\n{count} PNGs, {size:,} bytes, source revision {REVISION}")
    for dex, variants in catalog.items():
        print(dex, json.dumps(variants["normal"], separators=(",", ":")))
    print("Not published. Production catalog and itch build unchanged.")


if __name__ == "__main__":
    main()
