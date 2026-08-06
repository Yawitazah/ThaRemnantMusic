#!/usr/bin/env python3
"""Build the PWA / home-screen icons from the gold TR mark.

Why this exists: the icons that shipped were ~46% TRANSPARENT, with only a thin
#111110 frame around the edge. Android fills transparency in a home-screen icon
with WHITE, so the installed app showed a white box with the gold mark in it
inside a dark ring. iOS does not support alpha in touch icons either. So every
icon here is written FULLY OPAQUE on the brand background.

Two padding rules, and they are different on purpose:

  purpose "any"      the launcher shows the image as-is, so the mark can sit
                     large in the frame.

  purpose "maskable" the launcher crops to its own shape (circle, squircle,
                     rounded square). Only the inner 80% DIAMETER circle is
                     guaranteed to survive. A square mark of side S centred in a
                     512 canvas fits that circle when S * sqrt(2) <= 0.8 * 512,
                     so S <= ~289px, i.e. ~56% of the canvas. Going bigger is
                     what gets corners shaved off on Samsung's squircle.

Run: python scripts/build-icons.py
"""

from pathlib import Path
from PIL import Image

IMG = Path(__file__).resolve().parent.parent / "public" / "img"
BG = (17, 17, 16, 255)          # #111110, the manifest background_color
SRC = IMG / "logo-mark.png"      # 512x512, gold on transparent

# (filename, canvas px, mark width as a fraction of the canvas)
TARGETS = [
    ("icon-192.png",           192, 0.76),
    ("icon-512.png",           512, 0.76),
    ("icon-512-maskable.png",  512, 0.56),   # see the safe-zone note above
    ("apple-touch-icon-180.png", 180, 0.76), # iOS ignores alpha, so ship it opaque
]


def trimmed_mark() -> Image.Image:
    """The mark cropped to its own ink, so padding math is exact."""
    mark = Image.open(SRC).convert("RGBA")
    box = mark.getchannel("A").getbbox()
    if not box:
        raise SystemExit(f"{SRC} has no opaque pixels")
    return mark.crop(box)


def build(mark: Image.Image, name: str, size: int, frac: float) -> None:
    canvas = Image.new("RGBA", (size, size), BG)
    target = int(size * frac)
    w, h = mark.size
    scale = target / max(w, h)              # fit the long edge, keep aspect
    new = (max(1, round(w * scale)), max(1, round(h * scale)))
    resized = mark.resize(new, Image.LANCZOS)
    canvas.paste(resized, ((size - new[0]) // 2, (size - new[1]) // 2), resized)

    out = canvas.convert("RGB")             # drop alpha entirely: no transparency to fill
    out.save(IMG / name, "PNG", optimize=True)

    # Prove it: any stray transparency would defeat the whole point.
    check = Image.open(IMG / name)
    assert check.mode == "RGB", f"{name} still has an alpha channel"
    print(f"  {name:26} {size}x{size}  mark {new[0]}x{new[1]}  opaque")


if __name__ == "__main__":
    mark = trimmed_mark()
    print(f"source {SRC.name} trimmed to {mark.size[0]}x{mark.size[1]}")
    for name, size, frac in TARGETS:
        build(mark, name, size, frac)
    print("done")
