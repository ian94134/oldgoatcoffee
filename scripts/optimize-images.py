#!/usr/bin/env python3
"""Generate referenced WebP assets without modifying original photographs.

Usage: python scripts/optimize-images.py [--source src/template.html]
Requires Pillow (pip install Pillow). Run before the site's static build.
"""

import argparse
import io
import json
import re
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "optimized"


def encode(image, width, lossless, icc):
    resized = image.copy()
    if width < image.width:
        resized = image.resize(
            (width, round(image.height * width / image.width)), Image.Resampling.LANCZOS
        )
    buffer = io.BytesIO()
    options = {"format": "WEBP", "method": 6, "lossless": lossless}
    if not lossless:
        options["quality"] = 86
    if icc:
        options["icc_profile"] = icc
    resized.save(buffer, **options)
    return buffer.getvalue(), resized.size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    args = parser.parse_args()
    source = args.source or (
        Path("src/template.html") if (ROOT / "src/template.html").exists() else Path("index.html")
    )
    if not source.is_absolute():
        source = ROOT / source
    references = sorted(set(re.findall(
        r"assets/[A-Za-z0-9_./-]+\.(?:jpg|jpeg|png)",
        source.read_text(encoding="utf-8"), flags=re.IGNORECASE,
    )))
    if not references:
        raise SystemExit(f"No image references found in {source}")
    manifest = {}
    for reference in references:
        original = ROOT / reference
        if not original.is_file():
            raise SystemExit(f"Referenced image does not exist: {reference}")
        with Image.open(original) as opened:
            image = ImageOps.exif_transpose(opened)
            icc = opened.info.get("icc_profile")
            # Logos and brand graphics retain exact channel values. Photographic
            # banners use high-quality RGB encoding while WebP retains alpha.
            lossless = "logo" in original.name or reference.startswith("assets/brands/")
            image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
            maximum = 960 if reference.startswith("assets/menu/") else 1600
            largest = min(image.width, maximum)
            widths = sorted({min(480, largest), min(960, largest), largest})
            variants = []
            relative = Path(reference).relative_to("assets").with_suffix(".webp")
            for width in widths:
                destination = OUTPUT / relative
                if width != largest:
                    destination = destination.with_name(f"{destination.stem}-{width}w.webp")
                destination.parent.mkdir(parents=True, exist_ok=True)
                data, (actual_width, actual_height) = encode(image, width, lossless, icc)
                destination.write_bytes(data)
                variants.append({
                    "src": destination.relative_to(ROOT).as_posix(),
                    "width": actual_width,
                    "height": actual_height,
                    "bytes": len(data),
                })
            manifest[reference] = {
                **variants[-1],
                "originalBytes": original.stat().st_size,
                "variants": variants,
            }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    original_bytes = sum(item["originalBytes"] for item in manifest.values())
    optimized_bytes = sum(item["bytes"] for item in manifest.values())
    print(json.dumps({
        "images": len(manifest),
        "originalBytes": original_bytes,
        "optimizedDefaultBytes": optimized_bytes,
        "defaultSavingsPercent": round(100 * (1 - optimized_bytes / original_bytes), 1),
        "generatedVariantBytes": sum(v["bytes"] for item in manifest.values() for v in item["variants"]),
    }, indent=2))


if __name__ == "__main__":
    main()
