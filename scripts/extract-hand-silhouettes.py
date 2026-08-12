"""Split the original hand photo into left/right. Do not alter finger shape."""
from PIL import Image, ImageFilter
from pathlib import Path

SRC = Path(
    r"C:\Users\Windows 10\.cursor\projects\c-Users-Windows-10-Desktop-yaziyo-akademi"
    r"\assets\c__Users_Windows_10_AppData_Roaming_Cursor_User_workspaceStorage_"
    r"63b7f41b080faad9b0b754502a3329fd_images_hands-150378_1280-03dcccc9-d97c-4bcc-84e0-f97d4bee8bee.png"
)
OUT = Path(__file__).resolve().parents[1] / "images"

im = Image.open(SRC).convert("RGB")
w, h = im.size
gray = im.convert("L")
# Keep every non-black pixel of the original photo
alpha = gray.point(lambda p: 255 if p > 12 else 0)
rgba = im.convert("RGBA")
rgba.putalpha(alpha)

ap = alpha.load()
counts = [sum(1 for y in range(h) if ap[x, y] > 0) for x in range(w)]
split = min(range(w // 3, 2 * w // 3), key=lambda x: counts[x])

for name, box in (("sol", (0, 0, split, h)), ("sag", (split, 0, w, h))):
    crop = rgba.crop(box)
    bbox = crop.getbbox()
    pad = 8
    l, t, r, b = bbox
    l, t = max(0, l - pad), max(0, t - pad)
    r, b = min(crop.size[0], r + pad), min(crop.size[1], b + pad)
    crop = crop.crop((l, t, r, b))
    crop.save(OUT / f"ders-el-{name}.png", "PNG")
    print(name, crop.size)
