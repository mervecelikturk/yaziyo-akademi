"""Crop new lesson hand line-art and find fingertip coordinates."""
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageFilter, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "images"
ASSETS = Path(
    r"C:\Users\Windows 10\AppData\Roaming\Cursor\User\workspaceStorage"
    r"\63b7f41b080faad9b0b754502a3329fd\images"
)

SOURCES = {
    "sol": ASSETS / "Gemini_Generated_Image_b1lyt1b1lyt1b1ly-9a762d32-ba6d-4f35-8569-cbcc00ba3f6b.jpg",
    "sag": ASSETS / "Gemini_Generated_Image_erj1wperj1wperj1-29c57ae7-5d1d-4e6f-a933-a6f88a75e0f8.jpg",
}


def to_rgba_transparent(im: Image.Image) -> Image.Image:
    rgb = im.convert("RGB")
    try:
        import numpy as np
        arr = np.asarray(rgb, dtype=np.int16)
        lum = (arr[:, :, 0] + arr[:, :, 1] + arr[:, :, 2]) / 3
        alpha = np.zeros(lum.shape, dtype=np.uint8)
        alpha[lum < 96] = 255
        mid = (lum >= 96) & (lum < 140)
        alpha[mid] = ((140 - lum[mid]) * (255 / 44)).astype(np.uint8)
        rgba = np.dstack((
            np.full(lum.shape, 20, dtype=np.uint8),
            np.full(lum.shape, 20, dtype=np.uint8),
            np.full(lum.shape, 20, dtype=np.uint8),
            alpha,
        ))
        return Image.fromarray(rgba, "RGBA")
    except ImportError:
        w, h = rgb.size
        px = rgb.load()
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        opx = out.load()
        for y in range(h):
            for x in range(w):
                r, g, b = px[x, y]
                lum = (r + g + b) / 3
                if lum < 96:
                    opx[x, y] = (20, 20, 20, 255)
                elif lum < 140:
                    a = int(255 * (140 - lum) / 44)
                    opx[x, y] = (20, 20, 20, a)
        return out


def ink_mask(rgba: Image.Image) -> Image.Image:
    a = rgba.split()[3]
    return a.point(lambda p: 255 if p > 40 else 0)


def bbox_with_pad(mask: Image.Image, pad: int = 18) -> tuple[int, int, int, int]:
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError("hand outline not found")
    w, h = mask.size
    l, t, r, b = bbox
    return (
        max(0, l - pad),
        max(0, t - pad),
        min(w, r + pad),
        min(h, b + pad),
    )


def fill_hand(mask: Image.Image) -> Image.Image:
    """Close outline gaps and fill interior."""
    closed = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    # Flood from corners on inverted, then invert → interior+outline
    inv = Image.eval(closed, lambda p: 255 - p)
    ImageDraw.floodfill(inv, (0, 0), 0)
    ImageDraw.floodfill(inv, (inv.size[0] - 1, 0), 0)
    ImageDraw.floodfill(inv, (0, inv.size[1] - 1), 0)
    ImageDraw.floodfill(inv, (inv.size[0] - 1, inv.size[1] - 1), 0)
    # Remaining white is holes that were enclosed (hand interior)
    filled = Image.eval(inv, lambda p: 255 if p > 0 else 0)
    # Combine with original outline
    return ImageChops_lighter(filled, closed)


def ImageChops_lighter(a: Image.Image, b: Image.Image) -> Image.Image:
    from PIL import ImageChops
    return ImageChops.lighter(a, b)


def top_profile(filled: Image.Image) -> list[int]:
    w, h = filled.size
    px = filled.load()
    ys = []
    for x in range(w):
        y0 = h
        for y in range(h):
            if px[x, y] > 0:
                y0 = y
                break
        ys.append(y0)
    return ys


def smooth(vals: list[int], k: int = 7) -> list[float]:
    n = len(vals)
    out = []
    for i in range(n):
        sl = vals[max(0, i - k) : min(n, i + k + 1)]
        out.append(sum(sl) / len(sl))
    return out


def find_peaks(ys: list[float], min_dist: int) -> list[int]:
    n = len(ys)
    cand = []
    for i in range(2, n - 2):
        if ys[i] <= ys[i - 1] and ys[i] <= ys[i + 1] and ys[i] < ys[i - 2] and ys[i] < ys[i + 2]:
            cand.append(i)
    # keep best (lowest y) in neighborhoods
    cand.sort(key=lambda i: ys[i])
    picked = []
    for i in cand:
        if all(abs(i - p) >= min_dist for p in picked):
            picked.append(i)
        if len(picked) >= 8:
            break
    picked.sort()
    return picked


def pick_five_fingers(xs: list[int], ys: list[float], w: int, h: int) -> list[tuple[int, int]]:
    # Prefer 5 highest fingertips (smallest y)
    ranked = sorted(xs, key=lambda x: ys[x])
    top5 = sorted(ranked[:5])
    if len(top5) < 5:
        # fallback: split width into 5 bands
        bands = [(int(w * i / 5), int(w * (i + 1) / 5)) for i in range(5)]
        pts = []
        for a, b in bands:
            if a >= b:
                continue
            x = min(range(a, b), key=lambda i: ys[i])
            pts.append((x, int(ys[x])))
        return pts
    return [(x, int(ys[x])) for x in top5]


def process_one(name: str, src: Path, flip_if_thumb_left: bool) -> dict:
    raw = Image.open(src)
    rgba = to_rgba_transparent(raw)
    mask = ink_mask(rgba)
    box = bbox_with_pad(mask, 22)
    rgba = rgba.crop(box)
    mask = mask.crop(box)
    filled = fill_hand(mask)

    # Detect thumb side before optional flip
    ys = smooth(top_profile(filled), 9)
    w, h = rgba.size
    peaks = find_peaks(ys, min_dist=max(18, w // 18))
    tips = pick_five_fingers(peaks, ys, w, h)
    tips.sort(key=lambda p: p[0])

    thumb_is_left = False
    if len(tips) >= 5:
        # Thumb is shortest (largest y) among the outer two
        left, right = tips[0], tips[-1]
        thumb_is_left = left[1] > right[1]
    elif tips:
        thumb_is_left = tips[0][0] < w / 2

    did_flip = False
    if flip_if_thumb_left and thumb_is_left:
        rgba = rgba.transpose(Image.FLIP_LEFT_RIGHT)
        mask = mask.transpose(Image.FLIP_LEFT_RIGHT)
        filled = filled.transpose(Image.FLIP_LEFT_RIGHT)
        did_flip = True
        ys = smooth(top_profile(filled), 9)
        w, h = rgba.size
        peaks = find_peaks(ys, min_dist=max(18, w // 18))
        tips = pick_five_fingers(peaks, ys, w, h)
        tips.sort(key=lambda p: p[0])

    # Place dots slightly below the outline tip (finger pad)
    pad_down = max(10, h // 28)
    dots = []
    for x, y in tips:
        cy = min(h - 8, y + pad_down)
        dots.append({"x": int(x), "y": int(cy)})

    out_path = OUT / f"ders-el-{name}.png"
    rgba.save(out_path, "PNG")
    return {
        "name": name,
        "file": str(out_path.name),
        "w": w,
        "h": h,
        "flipped": did_flip,
        "thumb_is_left_before_flip": thumb_is_left,
        "dots": dots,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    results = {
        "sol": process_one("sol", SOURCES["sol"], flip_if_thumb_left=True),
        "sag": process_one("sag", SOURCES["sag"], flip_if_thumb_left=False),
    }
    meta = {"sol": {"w": results["sol"]["w"], "h": results["sol"]["h"]}, "sag": {"w": results["sag"]["w"], "h": results["sag"]["h"]}}
    (OUT / "ders-el-meta.json").write_text(json.dumps(meta), encoding="utf-8")
    print(json.dumps(results, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
