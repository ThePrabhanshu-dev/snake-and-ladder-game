

import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "og-image.png")

BG_A = (27, 34, 51)
BG_B = (16, 19, 26)
LADDER = (76, 201, 240)
SNAKE = (255, 122, 122)
SNAKE_HEAD = (255, 154, 154)
EYE = (58, 16, 32)
TEXT = (232, 236, 245)
MUTED = (159, 176, 212)
WHITE = (238, 242, 255)

def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def diagonal_gradient():

    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = (x / (W - 1) * 0.5) + (y / (H - 1) * 0.5)
            px[x, y] = lerp(BG_A, BG_B, min(1.0, t))
    return img

def font(size, bold=True):
    names = []
    if bold:
        names += ["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"]
    else:
        names += ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()

def centered(draw, text, y, fnt, fill):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    draw.text(((W - (bbox[2] - bbox[0])) / 2 - bbox[0], y), text, font=fnt, fill=fill)

def draw_ladder(draw, ox, oy, scale=1.0):

    rail_w = max(1, int(9 * scale))
    x1, x2 = ox + 30 * scale, ox + 60 * scale
    y_top, y_bot = oy + 40 * scale, oy + 300 * scale
    draw.line([(x1, y_bot), (x2, y_top)], fill=LADDER, width=rail_w)
    x3, x4 = ox + 110 * scale, ox + 140 * scale
    draw.line([(x3, y_bot), (x4, y_top)], fill=LADDER, width=rail_w)
    rung_w = max(1, int(7 * scale))
    for ry, rx1, rx2 in ((266, 36, 116), (218, 46, 126), (170, 57, 137),
                         (122, 67, 147), (74, 78, 158)):
        draw.line([(ox + rx1 * scale, oy + ry * scale),
                   (ox + rx2 * scale, oy + ry * scale)],
                  fill=LADDER, width=rung_w)

def draw_snake(draw, ox, oy, scale=1.0):

    pts = [(1080, 130), (990, 130), (1000, 220), (1075, 235),
           (1150, 250), (1145, 330), (1065, 345), (1000, 358), (1010, 430), (1080, 440)]
    pts = [(ox + (x - 990) * scale, oy + (y - 130) * scale) for x, y in pts]
    width = max(1, int(20 * scale))
    for i in range(len(pts) - 1):
        draw.line([pts[i], pts[i + 1]], fill=SNAKE, width=width)
    for x, y in pts:
        r = width / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=SNAKE)
    hx, hy = pts[-1]
    r = max(1, int(18 * scale))
    draw.ellipse([hx - r, hy - r, hx + r, hy + r], fill=SNAKE_HEAD)
    er = max(1, int(5 * scale))
    for ex in (hx - 6 * scale, hx + 6 * scale):
        draw.ellipse([ex - er, hy - 4 * scale - er, ex + er, hy - 4 * scale + er], fill=EYE)

def draw_dice(draw, ox, oy, size=74, pips=5):

    grid = {1: (4,), 2: (0, 8), 3: (0, 4, 8), 4: (0, 2, 6, 8),
            5: (0, 2, 4, 6, 8), 6: (0, 2, 3, 5, 6, 8)}
    cells = 3
    pad = size * 0.13
    inner = size - pad * 2
    step = inner / cells
    radius = size * 0.22
    draw.rounded_rectangle([ox, oy, ox + size, oy + size], radius=radius,
                           fill=(42, 51, 72), outline=(70, 82, 122), width=2)
    pr = size * 0.095
    for idx in grid[pips]:
        cx = ox + pad + (idx % cells) * step + step / 2
        cy = oy + pad + (idx // cells) * step + step / 2
        draw.ellipse([cx - pr, cy - pr, cx + pr, cy + pr], fill=WHITE)

def main():
    img = diagonal_gradient()
    draw = ImageDraw.Draw(img)

    draw_ladder(draw, 90, 150)
    draw_snake(draw, 990, 130)

    title = "Snake & Ladder"
    f_title = font(86, bold=True)
    x = 0
    bbox = draw.textbbox((0, 0), title, font=f_title)
    x = (W - (bbox[2] - bbox[0])) / 2
    y = 235
    ramp = [(255, 122, 122), (255, 209, 102), (76, 201, 240)]
    for i, ch in enumerate(title):
        cb = draw.textbbox((0, 0), ch, font=f_title)
        cw = cb[2] - cb[0]
        t = i / max(1, len(title) - 1)
        if t < 0.5:
            color = lerp(ramp[0], ramp[1], t * 2)
        else:
            color = lerp(ramp[1], ramp[2], (t - 0.5) * 2)
        draw.text((x - cb[0], y - cb[1]), ch, font=f_title, fill=color)
        x += cw

    centered(draw, "Climb the ladders. Dodge the snakes. Race to 100.",
             312, font(30, bold=False), MUTED)
    centered(draw, "Free online board game \u00b7 2\u20134 players \u00b7 No signup",
             366, font(26, bold=True), TEXT)

    draw_dice(draw, 500, 440, 74, 5)
    draw_dice(draw, 600, 440, 74, 6)

    img.save(OUT, "PNG", optimize=True)
    print("wrote", OUT, img.size)

if __name__ == "__main__":
    main()
