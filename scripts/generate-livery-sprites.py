#!/usr/bin/env python3
"""Bake alternate racing liveries while preserving the original car silhouettes."""

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

# Recognizable real-world competition schemes. The shapes are painted over the
# existing body mask, so no generated variant changes the car model itself.
# Coordinates are normalized across the sprite; y=0 is the nose, y=1 the tail.
LIVERIES = {
    "aston_gt3": {"name": "Heart of Racing", "primary": "#174b38", "secondary": "#b7d432", "stripes": [(0.43, 0.48, 0.06, 0.94, "#b7d432"), (0.52, 0.57, 0.06, 0.94, "#f0f0e8")]},
    "audi_gt3": {"name": "Gulf Racing", "primary": "#62bfd8", "secondary": "#f07828", "stripes": [(0.44, 0.56, 0.04, 0.95, "#f07828"), (0.39, 0.43, 0.04, 0.95, "#f1eee2"), (0.57, 0.61, 0.04, 0.95, "#f1eee2")]},
    "bmw_gt3": {"name": "BMW M Motorsport", "primary": "#eceff2", "secondary": "#0876bd", "stripes": [(0.38, 0.44, 0.05, 0.95, "#0876bd"), (0.45, 0.50, 0.05, 0.95, "#713d91"), (0.51, 0.57, 0.05, 0.95, "#e52636")]},
    "corvette_gt3": {"name": "Corvette Racing", "primary": "#f5cf00", "secondary": "#15191e", "stripes": [(0.42, 0.47, 0.06, 0.93, "#15191e"), (0.53, 0.58, 0.06, 0.93, "#15191e")]},
    "ferrari_gt3": {"name": "AF Corse #83", "primary": "#f0eee8", "secondary": "#17191d", "bands": [(0.10, 0.50, "#17191d"), (0.66, 0.96, "#17191d")], "stripes": [(0.45, 0.55, 0.05, 0.95, "#f0eee8")]},
    "mustang_gt3": {"name": "Ford Performance", "primary": "#f1f0ec", "secondary": "#07539a", "stripes": [(0.39, 0.45, 0.05, 0.96, "#07539a"), (0.47, 0.53, 0.05, 0.96, "#e12837"), (0.55, 0.61, 0.05, 0.96, "#07539a")]},
    "lambo_gt3": {"name": "Gulf Racing", "primary": "#62bfd8", "secondary": "#f07828", "stripes": [(0.43, 0.57, 0.04, 0.94, "#f07828"), (0.38, 0.42, 0.04, 0.94, "#f1eee2"), (0.58, 0.62, 0.04, 0.94, "#f1eee2")]},
    "lexus_gt3": {"name": "Vasser Sullivan", "primary": "#f4d21f", "secondary": "#15191e", "bands": [(0.08, 0.32, "#15191e")], "stripes": [(0.44, 0.56, 0.08, 0.94, "#15191e")]},
    "mclaren_gt3": {"name": "Gulf Racing", "primary": "#62bfd8", "secondary": "#f07828", "stripes": [(0.43, 0.57, 0.04, 0.95, "#f07828"), (0.38, 0.42, 0.04, 0.95, "#f1eee2"), (0.58, 0.62, 0.04, 0.95, "#f1eee2")]},
    "mercedes_gt3": {"name": "Iron Lynx #61", "primary": "#17191d", "secondary": "#1677bd", "neutral_body": True, "stripes": [(0.46, 0.54, 0.04, 0.96, "#1677bd")]},
    "porsche_gt3": {"name": "Manthey Grello", "primary": "#b5cf29", "secondary": "#f0d42f", "stripes": [(0.40, 0.46, 0.04, 0.95, "#f0d42f"), (0.54, 0.60, 0.04, 0.95, "#17191d")]},
    "bentley_gt3": {"name": "Bentley M-Sport", "primary": "#f0eee8", "secondary": "#16503d", "stripes": [(0.40, 0.47, 0.05, 0.95, "#16503d"), (0.53, 0.60, 0.05, 0.95, "#16503d")]},
    "ta_civic": {"name": "Spoon Sports", "primary": "#0876bd", "secondary": "#f2d52c", "bands": [(0.08, 0.38, "#0876bd"), (0.38, 0.94, "#f2d52c")], "stripes": [(0.45, 0.55, 0.05, 0.95, "#f0eee8")]},
    "ta_megane_rs": {"name": "Renault Sport", "primary": "#17191d", "secondary": "#f4d21f", "stripes": [(0.42, 0.49, 0.05, 0.95, "#f4d21f"), (0.51, 0.58, 0.05, 0.95, "#f0eee8")]},
    "ta_kalina": {"name": "RATATA Racing", "primary": "#0870ca", "secondary": "#f0eee8", "bands": [(0.03, 0.38, "#0870ca"), (0.38, 0.69, "#f0eee8"), (0.69, 0.95, "#d92332")], "stripes": [(0.46, 0.54, 0.38, 0.70, "#d92332")]},
    "ta_granta": {"name": "RATATA Racing", "primary": "#0870ca", "secondary": "#f0eee8", "bands": [(0.03, 0.38, "#0870ca"), (0.38, 0.69, "#f0eee8"), (0.69, 0.95, "#d92332")], "stripes": [(0.46, 0.54, 0.38, 0.70, "#d92332")]},
    "ta_vesta": {"name": "RATATA Racing", "primary": "#0870ca", "secondary": "#f0eee8", "bands": [(0.03, 0.38, "#0870ca"), (0.38, 0.69, "#f0eee8"), (0.69, 0.95, "#d92332")], "stripes": [(0.46, 0.54, 0.38, 0.70, "#d92332")]},
    "ta_mx5": {"name": "Mazda 787B", "primary": "#08753f", "secondary": "#f07828", "stripes": [(0.39, 0.47, 0.05, 0.94, "#f07828"), (0.53, 0.61, 0.05, 0.94, "#f07828"), (0.47, 0.53, 0.10, 0.88, "#f0eee8")]},
    "ta_gt86": {"name": "Toyota Gazoo Racing", "primary": "#f0eee8", "secondary": "#e52a35", "stripes": [(0.39, 0.47, 0.05, 0.95, "#e52a35"), (0.53, 0.61, 0.05, 0.95, "#17191d")]},
    "ta_brz": {"name": "Subaru STI", "primary": "#07539a", "secondary": "#f2d52b", "stripes": [(0.43, 0.49, 0.04, 0.95, "#f2d52b"), (0.51, 0.57, 0.04, 0.95, "#f0eee8")]},
    "ta_bmw_m3": {"name": "BMW M Motorsport", "primary": "#f0eee8", "secondary": "#0876bd", "stripes": [(0.35, 0.42, 0.04, 0.96, "#0876bd"), (0.44, 0.51, 0.04, 0.96, "#713d91"), (0.53, 0.60, 0.04, 0.96, "#e52636")]},
    "ta_bmw_m4": {"name": "BMW M Motorsport", "primary": "#17191d", "secondary": "#0876bd", "stripes": [(0.38, 0.45, 0.04, 0.96, "#0876bd"), (0.47, 0.53, 0.04, 0.96, "#713d91"), (0.55, 0.62, 0.04, 0.96, "#e52636")]},
    "ta_s2000": {"name": "Spoon Sports", "primary": "#f2d52b", "secondary": "#0876bd", "stripes": [(0.43, 0.57, 0.05, 0.95, "#0876bd")]},
    "ta_silvia": {"name": "NISMO", "primary": "#f0eee8", "secondary": "#d92332", "bands": [(0.08, 0.26, "#d92332"), (0.72, 0.94, "#d92332")], "stripes": [(0.44, 0.56, 0.05, 0.95, "#17191d")]},
    "ta_porsche_911": {"name": "Martini Racing", "primary": "#f0eee8", "secondary": "#0876bd", "stripes": [(0.38, 0.45, 0.04, 0.96, "#0876bd"), (0.47, 0.53, 0.04, 0.96, "#e52636"), (0.55, 0.62, 0.04, 0.96, "#0876bd")]},
    "ta_lancer_evo": {"name": "Mitsubishi Ralliart", "primary": "#f0eee8", "secondary": "#d92332", "stripes": [(0.40, 0.47, 0.04, 0.95, "#d92332"), (0.53, 0.60, 0.04, 0.95, "#17191d")]},
    "ta_wrx_sti": {"name": "Subaru 555 Rally", "primary": "#07539a", "secondary": "#f2d52b", "stripes": [(0.39, 0.47, 0.04, 0.96, "#f2d52b"), (0.53, 0.61, 0.04, 0.96, "#f0eee8")]},
    "ta_gtr34": {"name": "Calsonic Skyline", "primary": "#0753a1", "secondary": "#f0eee8", "stripes": [(0.39, 0.47, 0.04, 0.96, "#f0eee8"), (0.53, 0.61, 0.04, 0.96, "#f0eee8")]},
}


def _hex_rgb(color: str) -> np.ndarray:
    return np.array([int(color[index:index + 2], 16) for index in (1, 3, 5)], dtype=np.float32)


def _rear_lamp_mask(rgba: np.ndarray, hsv: np.ndarray) -> np.ndarray:
    """Retain only small, isolated red lamp details near the rear corners."""
    height, width = rgba.shape[:2]
    hue, saturation, value = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    candidates = (
        (rgba[:, :, 3] > 16)
        & ((hue < 18) | (hue > 246))
        & (saturation > 100)
        & (value > 75)
    )
    candidates[: int(height * 0.76)] = False
    lamps = np.zeros((height, width), dtype=bool)
    seen = np.zeros((height, width), dtype=bool)
    for y0, x0 in zip(*np.where(candidates)):
        if seen[y0, x0]:
            continue
        stack = [(int(y0), int(x0))]
        seen[y0, x0] = True
        component = []
        while stack:
            y, x = stack.pop()
            component.append((y, x))
            for ny in range(max(0, y - 1), min(height, y + 2)):
                for nx in range(max(0, x - 1), min(width, x + 2)):
                    if candidates[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        xs = [point[1] for point in component]
        ys = [point[0] for point in component]
        center_x = (min(xs) + max(xs)) / 2
        at_outer_corner = center_x < width * 0.30 or center_x > width * 0.70
        compact = (
            len(component) <= max(60, int(width * height * 0.0015))
            and max(xs) - min(xs) <= width * 0.14
            and max(ys) - min(ys) <= height * 0.07
        )
        if at_outer_corner and compact and min(ys) >= height * 0.80:
            for y, x in component:
                lamps[y, x] = True
    return lamps


def write_variant(car_id: str, source: Image.Image) -> None:
    source = source.convert("RGBA")
    rgba = np.array(source, dtype=np.uint8)
    hsv = np.array(source.convert("HSV"), dtype=np.uint8)
    height, width = rgba.shape[:2]
    scheme = LIVERIES[car_id]
    value = hsv[:, :, 2].astype(np.float32)
    y, x = np.mgrid[0:height, 0:width]
    nx, ny = (x + 0.5) / width, (y + 0.5) / height

    # Include painted white body panels as well as saturated paint; dark glass,
    # tires, outlines, and shadows stay untouched. Brightness preserves the
    # original sprite's shading and highlights.
    paint = (
        (rgba[:, :, 3] > 16)
        & (((hsv[:, :, 1] > 38) & (value > 35)) | (value > 172))
    )
    if scheme.get("neutral_body"):
        neutral_body = (
            (rgba[:, :, 3] > 16)
            & (hsv[:, :, 1] <= 38)
            & (value > 82)
            & ((nx < 0.33) | (nx > 0.67) | (ny < 0.20) | (ny > 0.78))
        )
        paint |= neutral_body
    lamp_mask = _rear_lamp_mask(rgba, hsv)
    paint &= ~lamp_mask

    output = rgba[:, :, :3].astype(np.float32)
    brightness = np.clip(0.58 + value / 255.0 * 0.42, 0.58, 1.0)

    def apply_color(mask: np.ndarray, color: str) -> None:
        target = _hex_rgb(color)
        output[mask] = np.clip(target[None, :] * brightness[mask, None], 0, 255)

    apply_color(paint, scheme["primary"])

    # Keep racing graphics off the windshield and rear glass. A few sprites have
    # bright reflections in these dark areas, which otherwise catch the bands.
    glass_reflections = (
        (nx >= 0.23) & (nx <= 0.77)
        & (((ny >= 0.27) & (ny <= 0.41)) | ((ny >= 0.61) & (ny <= 0.73)) )
    )
    graphics_mask = paint & ~glass_reflections
    for y0, y1, color in scheme.get("bands", []):
        apply_color(graphics_mask & (ny >= y0) & (ny < y1), color)
    for x0, x1, y0, y1, color in scheme.get("stripes", []):
        apply_color(graphics_mask & (nx >= x0) & (nx < x1) & (ny >= y0) & (ny < y1), color)

    output[ lamp_mask ] = np.array([220, 35, 48], dtype=np.float32)
    result = Image.fromarray(np.dstack([np.clip(output, 0, 255).astype(np.uint8), rgba[:, :, 3]]), "RGBA")
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

    missing = set(sources) - set(LIVERIES)
    if missing:
        raise ValueError(f"Missing alternate livery definitions: {sorted(missing)}")
    for car_id, source in sources.items():
        write_variant(car_id, source)

    generated = list(OUTPUT.glob("*-alt.png"))
    print(f"Generated {len(generated)} alternate sprites ({sum(p.stat().st_size for p in generated):,} bytes)")


if __name__ == "__main__":
    main()
