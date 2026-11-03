#!/usr/bin/env python3
"""Bake alternate-color PNG sprites from the game's existing overhead art."""

import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "liveries"
TA_RECTS = {
    "ta_civic": (140, 38, 136, 256), "ta_megane_rs": (426, 37, 136, 257),
    "ta_kalina": (707, 40, 132, 253), "ta_granta": (989, 39, 134, 260),
    "ta_vesta": (138, 338, 139, 258), "ta_mx5": (423, 341, 145, 248),
    "ta_gt86": (701, 340, 146, 257), "ta_brz": (984, 339, 148, 270),
    "ta_bmw_m3": (141, 630, 140, 268), "ta_bmw_m4": (421, 629, 143, 274),
    "ta_s2000": (699, 644, 149, 246), "ta_silvia": (984, 633, 149, 270),
    "ta_porsche_911": (136, 936, 148, 277), "ta_lancer_evo": (418, 935, 149, 276),
    "ta_wrx_sti": (701, 934, 147, 278), "ta_gtr34": (982, 937, 149, 276),
}


def write_variant(car_id: str, source: Image.Image) -> None:
    source = source.convert("RGBA")
    rgba = np.array(source, dtype=np.uint8)
    hsv = np.array(source.convert("HSV"), dtype=np.uint8)
    height, width = rgba.shape[:2]
    hue, saturation, value = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]

    # The cars all face up. Keep red rear-lamp pixels in the tail section true
    # red while changing the body and its colored stripes to the alternate paint.
    y, _x = np.mgrid[0:height, 0:width]
    rear_lamps = (
        (y >= height * 0.82)
        & (rgba[:, :, 3] > 8)
        & (saturation > 35)
        & (value > 45)
        & ((hue < 28) | (hue > 244))
    )
    painted_pixels = (
        (rgba[:, :, 3] > 8)
        & (saturation > 45)
        & (value > 35)
        & ~rear_lamps
    )
    hsv[:, :, 0][painted_pixels] = (
        hue[painted_pixels].astype(np.uint16) + 106
    ).astype(np.uint8)

    result = Image.fromarray(hsv, "HSV").convert("RGBA")
    result.putalpha(source.getchannel("A"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    result.save(OUTPUT / f"{car_id}-alt.png", optimize=True)


def load_gt3_sources() -> dict[str, Image.Image]:
    line = next(
        line for line in (ROOT / "sprites.js").read_text().splitlines()
        if line.startswith("const SPRITE_DATA = ")
    )
    sprite_data = json.loads(line[len("const SPRITE_DATA = ") : -1])
    images = {}
    for car_id, data_uri in sprite_data.items():
        if car_id.startswith("f1_") or car_id == "safety_car":
            continue
        if car_id == "audi_gt3":
            path = ROOT / "assets" / "gt3" / "audi-r8-topdown.png"
            images[car_id] = Image.open(path).convert("RGBA")
        elif car_id == "aston_gt3":
            path = ROOT / "assets" / "gt3" / "aston-vantage-topdown.png"
            images[car_id] = Image.open(path).convert("RGBA")
        else:
            payload = data_uri.split(",", 1)[1]
            images[car_id] = Image.open(io.BytesIO(base64.b64decode(payload))).convert("RGBA")
    return images


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    sources = load_gt3_sources()

    atlas_data = base64.b64decode(
        (ROOT / "assets" / "time-attack-wec-cars.webp.b64").read_bytes().strip()
    )
    atlas = Image.open(io.BytesIO(atlas_data)).convert("RGBA")
    for car_id, (x, y, width, height) in TA_RECTS.items():
        sources[car_id] = atlas.crop((x, y, x + width, y + height))

    for car_id, source in sources.items():
        write_variant(car_id, source)

    generated = list(OUTPUT.glob("*-alt.png"))
    print(f"Generated {len(generated)} alternate sprites ({sum(p.stat().st_size for p in generated):,} bytes)")


if __name__ == "__main__":
    main()
