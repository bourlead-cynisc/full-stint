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
    "aston_gt3": {"name": "D'Station Racing", "primary": "#c6d52d", "secondary": "#14694a", "stripes": [(0.43, 0.48, 0.06, 0.94, "#b7d432"), (0.52, 0.57, 0.06, 0.94, "#f0f0e8")]},
    "audi_gt3": {"name": "Gulf Racing", "primary": "#62bfd8", "secondary": "#f07828", "stripes": [(0.44, 0.56, 0.04, 0.95, "#f07828"), (0.39, 0.43, 0.04, 0.95, "#f1eee2"), (0.57, 0.61, 0.04, 0.95, "#f1eee2")]},
    "bmw_gt3": {"name": "BMW M Motorsport", "primary": "#eceff2", "secondary": "#0876bd", "stripes": [(0.38, 0.44, 0.05, 0.95, "#0876bd"), (0.45, 0.50, 0.05, 0.95, "#713d91"), (0.51, 0.57, 0.05, 0.95, "#e52636")]},
    "corvette_gt3": {"name": "Corvette Racing", "primary": "#f5cf00", "secondary": "#15191e", "stripes": [(0.42, 0.47, 0.06, 0.93, "#15191e"), (0.53, 0.58, 0.06, 0.93, "#15191e")]},
    "ferrari_gt3": {"name": "AF Corse #83", "primary": "#f4d218", "secondary": "#17191d", "bands": [(0.10, 0.50, "#17191d"), (0.66, 0.96, "#17191d")], "stripes": [(0.45, 0.55, 0.05, 0.95, "#f0eee8")]},
    "mustang_gt3": {"name": "Ford Performance", "primary": "#f1f0ec", "secondary": "#07539a", "stripes": [(0.39, 0.45, 0.05, 0.96, "#07539a"), (0.47, 0.53, 0.05, 0.96, "#e12837"), (0.55, 0.61, 0.05, 0.96, "#07539a")]},
    "lambo_gt3": {"name": "Iron Lynx Lamborghini", "primary": "#a8d51e", "secondary": "#17191d", "stripes": [(0.43, 0.57, 0.04, 0.94, "#f07828"), (0.38, 0.42, 0.04, 0.94, "#f1eee2"), (0.58, 0.62, 0.04, 0.94, "#f1eee2")]},
    "lexus_gt3": {"name": "Vasser Sullivan", "primary": "#f4d21f", "secondary": "#15191e", "bands": [(0.08, 0.32, "#15191e")], "stripes": [(0.44, 0.56, 0.08, 0.94, "#15191e")]},
    "mclaren_gt3": {"name": "Garage 59", "primary": "#ff6a1a", "secondary": "#17191d", "stripes": [(0.43, 0.57, 0.04, 0.95, "#f07828"), (0.38, 0.42, 0.04, 0.95, "#f1eee2"), (0.58, 0.62, 0.04, 0.95, "#f1eee2")]},
    "mercedes_gt3": {"name": "Iron Lynx #61", "primary": "#17191d", "secondary": "#1677bd", "neutral_body": True, "stripes": [(0.46, 0.54, 0.04, 0.96, "#1677bd")]},
    "porsche_gt3": {"name": "Manthey Grello", "primary": "#b5cf29", "secondary": "#f0d42f", "stripes": [(0.40, 0.46, 0.04, 0.95, "#f0d42f"), (0.54, 0.60, 0.04, 0.95, "#17191d")]},
    "bentley_gt3": {"name": "K-PAX Racing", "primary": "#07539a", "secondary": "#f1cb22", "stripes": [(0.40, 0.47, 0.05, 0.95, "#16503d"), (0.53, 0.60, 0.05, 0.95, "#16503d")]},
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

# Wide, recognizable body-panel layouts. Colors are clipped to the original
# sprite's painted body, so wheels, glass, silhouette, and lighting stay intact.
PATTERN_BY_ID = {
    "aston_gt3": "dstation", "audi_gt3": "gulf", "bmw_gt3": "m",
    "corvette_gt3": "corvette", "ferrari_gt3": "af-corse", "mustang_gt3": "ford",
    "lambo_gt3": "iron-lynx-green", "lexus_gt3": "vasser", "mclaren_gt3": "papaya",
    "mercedes_gt3": "iron-lynx", "porsche_gt3": "grello", "bentley_gt3": "k-pax",
    "ta_civic": "spoon", "ta_megane_rs": "renault", "ta_kalina": "ratata",
    "ta_granta": "ratata", "ta_vesta": "ratata", "ta_mx5": "mazda",
    "ta_gt86": "gazoo", "ta_brz": "sti", "ta_bmw_m3": "m", "ta_bmw_m4": "m",
    "ta_s2000": "spoon", "ta_silvia": "nismo", "ta_porsche_911": "martini",
    "ta_lancer_evo": "ralliart", "ta_wrx_sti": "sti", "ta_gtr34": "calsonic",
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

    # Include painted white body panels as well as saturated paint. Keep glass,
    # tires, the inked outline, headlamps, and original tail lamps untouched.
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
    front_lamps = (
        (rgba[:, :, 3] > 16) & (ny < 0.18) & ((nx < 0.34) | (nx > 0.66))
        & (hsv[:, :, 1] < 78) & (value > 178)
    )
    paint &= ~lamp_mask
    paint &= ~front_lamps
    glass_y = (
        ((ny >= 0.25) & (ny <= 0.42)) | ((ny >= 0.74) & (ny <= 0.88))
        if car_id.startswith("ta_")
        else ((ny >= 0.37) & (ny <= 0.56)) | ((ny >= 0.68) & (ny <= 0.86))
    )
    # A broad rectangular exclusion also protected bright body paint between
    # the windows (notably the Ferrari rear deck). Keep only the genuinely dark
    # glass pixels in that area out of the livery mask.
    glass_reflections = (nx >= 0.20) & (nx <= 0.80) & glass_y & (value < 145)
    body = paint & ~glass_reflections

    output = rgba[:, :, :3].astype(np.float32)
    brightness = np.clip(0.72 + value / 255.0 * 0.28, 0.72, 1.0)

    def apply_color(mask: np.ndarray, color: str) -> None:
        target = _hex_rgb(color)
        output[mask] = np.clip(target[None, :] * brightness[mask, None], 0, 255)

    apply_color(body, scheme["primary"])

    # Keep graphics off both glass panels. The body mask then clips each scheme
    # to the true silhouette instead of painting a rectangle over the car.
    secondary = _hex_rgb(scheme["secondary"])
    pattern = PATTERN_BY_ID[car_id]
    along = (ny >= 0.06) & (ny <= 0.94)
    center = np.abs(nx - 0.5)

    if pattern == "gulf":
        apply_color(body & along & (center < 0.15), scheme["secondary"])
        apply_color(body & along & (center >= 0.19) & (center < 0.245), "#f2eee2")
    elif pattern == "m":
        diagonal = nx - (0.20 + ny * 0.60)
        for band, color in zip(((-0.13, -0.045), (-0.04, 0.045), (0.05, 0.135)),
                               ("#0876bd", "#713d91", "#e52636")):
            apply_color(body & along & (diagonal >= band[0]) & (diagonal < band[1]), color)
    elif pattern == "dstation":
        # D'Station's yellow and green split is broad and follows the nose and
        # rear quarters instead of looking like thin stripes on a dark car.
        end_panels = (ny < 0.29) | (ny > 0.73)
        apply_color(body & end_panels & (center > 0.17), scheme["secondary"])
        apply_color(body & (ny >= 0.44) & (ny <= 0.59) & (center < 0.19), "#f3f0de")
    elif pattern == "corvette":
        apply_color(body & along & (center < 0.075), scheme["secondary"])
        apply_color(body & along & (center >= 0.12) & (center < 0.17), "#d92633")
    elif pattern == "af-corse":
        apply_color(body & (ny < 0.27), "#f4d218")
        apply_color(body & (ny > 0.76), "#17191d")
        apply_color(body & along & (center < 0.09), "#f4d218")
    elif pattern == "ford":
        apply_color(body & along & (center < 0.115), scheme["secondary"])
        apply_color(body & along & (center >= 0.14) & (center < 0.20), "#e12837")
        apply_color(body & (ny > 0.77) & (center > 0.24), "#07539a")
    elif pattern == "vasser":
        # The Vasser Sullivan black graphic sits on the side sills and rear deck;
        # the bonnet stays yellow instead of turning into one black rectangle.
        side_sills = (center > 0.30) & (ny > 0.26) & (ny < 0.84)
        rear_panel = (ny > 0.78) & (center < 0.25)
        apply_color(body & (side_sills | rear_panel), scheme["secondary"])
        apply_color(body & (ny < 0.16) & (center < 0.11), "#f6f1e5")
    elif pattern == "iron-lynx":
        apply_color(body & (ny < 0.26), "#157ab4")
        apply_color(body & (ny > 0.72) & (center < 0.15), "#157ab4")
        apply_color(body & along & (center > 0.29), "#252a2e")
    elif pattern == "iron-lynx-green":
        apply_color(body & (ny < 0.23), "#17191d")
        apply_color(body & (ny > 0.76), "#17191d")
        apply_color(body & along & (center > 0.28), "#17191d")
        apply_color(body & along & (center < 0.075), "#f0eee8")
    elif pattern == "papaya":
        apply_color(body & (ny > 0.72) & (center > 0.25), "#17191d")
        apply_color(body & (ny < 0.20) & (center > 0.28), "#17191d")
        apply_color(body & along & (center > 0.34), "#25292d")
        apply_color(body & (ny > 0.34) & (ny < 0.58) & (center < 0.065), "#f0eee8")
    elif pattern == "grello":
        apply_color(body & (ny < 0.19), "#f3d334")
        apply_color(body & along & (center > 0.30) & (center < 0.39), "#f3d334")
        apply_color(body & (ny > 0.80) & (center < 0.10), "#17191d")
    elif pattern == "k-pax":
        apply_color(body & (ny < 0.27), "#f1cb22")
        apply_color(body & (ny > 0.73), "#f1cb22")
        apply_color(body & along & (center > 0.29), "#152942")
    elif pattern == "spoon":
        apply_color(body & (center > 0.27) & (ny > 0.18) & (ny < 0.84), "#f1f0e8")
        apply_color(body & along & (center < 0.13), scheme["secondary"])
        apply_color(body & (ny < 0.20) & (center > 0.22), "#f2d52c")
    elif pattern == "renault":
        apply_color(body & (ny < 0.24), "#f4d21f")
        apply_color(body & (ny > 0.74) & (center < 0.20), "#f4d21f")
        apply_color(body & along & (center > 0.25), "#24272d")
    elif pattern == "ratata":
        # RATATA's blue front, white doors, and red rear follow the side-view
        # reference. Angled boundaries keep the roof panel from reading as bars.
        front_boundary = 0.35 + (nx - 0.5) * 0.28
        rear_boundary = 0.69 + (nx - 0.5) * 0.24
        apply_color(body & (ny < front_boundary), "#0870ca")
        apply_color(body & (ny >= front_boundary) & (ny < rear_boundary), "#f0eee8")
        apply_color(body & (ny >= rear_boundary), "#d92332")
        apply_color(body & (center < 0.045) & (ny > 0.30) & (ny < 0.72), "#d92332")
    elif pattern == "mazda":
        apply_color(body & along & (center < 0.16), "#f07828")
        apply_color(body & along & (center >= 0.20) & (center < 0.25), "#f0eee8")
        apply_color(body & (ny < 0.17) & (center < 0.28), "#f0eee8")
    elif pattern == "gazoo":
        diagonal = nx - (0.18 + ny * 0.64)
        apply_color(body & (diagonal > -0.23) & (diagonal < -0.08), "#e52a35")
        apply_color(body & (diagonal > -0.07) & (diagonal < 0.08), "#17191d")
        apply_color(body & (diagonal > 0.09) & (diagonal < 0.24), "#e52a35")
    elif pattern == "sti":
        apply_color(body & along & (center < 0.10), "#f2d52b")
        apply_color(body & along & (center >= 0.14) & (center < 0.20), "#f0eee8")
        apply_color(body & (ny > 0.78) & (center > 0.24), "#f2d52b")
    elif pattern == "nismo":
        apply_color(body & (ny < 0.22), "#d92332")
        apply_color(body & (ny > 0.76), "#d92332")
        apply_color(body & along & (center < 0.07), "#17191d")
    elif pattern == "martini":
        apply_color(body & along & (center < 0.13), "#0876bd")
        apply_color(body & along & (center >= 0.16) & (center < 0.21), "#e52636")
        apply_color(body & (ny < 0.18) & (center > 0.23), "#0876bd")
    elif pattern == "ralliart":
        apply_color(body & (ny < 0.24), "#d92332")
        apply_color(body & (ny > 0.77), "#17191d")
        apply_color(body & along & (center < 0.12), "#d92332")
        apply_color(body & along & (center >= 0.16) & (center < 0.21), "#17191d")
    elif pattern == "calsonic":
        apply_color(body & along & (center < 0.16), "#f0eee8")
        apply_color(body & along & (center >= 0.20) & (center < 0.25), "#f0eee8")
        apply_color(body & (ny < 0.17) & (center < 0.28), "#f0eee8")

    # Restore source lamp pixels byte-for-byte; paint masks never tint the lamps.
    output[lamp_mask] = rgba[:, :, :3][lamp_mask]
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
