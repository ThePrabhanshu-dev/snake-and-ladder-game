#!/usr/bin/env python3
"""Generate the cover art and square thumbnail used by game portals.

Portals ask for two images:
  cover.png  630 x 315  (feature / hero image)
  thumb.png  512 x 512  (square thumbnail / icon)

Both are derived from og-image.png so they always match the site's branding.
Run:  python tools/make-thumbnails.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "og-image.png")
DIST = os.path.join(ROOT, "dist")


def cover(img):
    """630 x 315 landscape crop of the 1200 x 630 social image."""
    target_ratio = 630 / 315
    w, h = img.size
    ratio = w / h
    if ratio > target_ratio:  # too wide - crop the sides
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:  # too tall - crop top/bottom
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    return img.resize((630, 315), Image.LANCZOS)


def thumb(img):
    """512 x 512 square thumbnail (centre crop of the source image)."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side)).resize((512, 512), Image.LANCZOS)


def main():
    if not os.path.exists(SRC):
        raise SystemExit("og-image.png is missing - run: python tools/make-og-image.py")
    os.makedirs(DIST, exist_ok=True)
    src = Image.open(SRC).convert("RGB")
    cover(src).save(os.path.join(DIST, "cover.png"))
    thumb(src).save(os.path.join(DIST, "thumb.png"))
    print("Wrote dist/cover.png (630x315) and dist/thumb.png (512x512)")


if __name__ == "__main__":
    main()
