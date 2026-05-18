"""Pre-render PNG backgrounds and design assets for FC April Week 5 deck."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import os, math, random

OUT = "/sessions/adoring-dazzling-babbage/mnt/outputs/assets"
os.makedirs(OUT, exist_ok=True)

W, H = 1920, 1080

# Palette
FC = (0, 120, 171)
FC_HI = (0, 184, 255)
FC_GLOW = (40, 140, 220)
GOLD = (251, 191, 36)
EMBER = (210, 120, 40)

def vgrad(size, top, bot):
    w, h = size
    im = Image.new("RGB", (1, h), top)
    px = im.load()
    for y in range(h):
        t = y/max(1,h-1)
        px[0,y] = tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3))
    return im.resize(size, Image.BICUBIC)

def radial_glow(size, cx, cy, r, color, peak=180):
    """Smooth radial glow using a small grayscale falloff map blurred up."""
    w, h = size
    # Build small luminance falloff map and resize for speed
    small = (320, int(320*h/w))
    sm = Image.new("L", small, 0)
    d = ImageDraw.Draw(sm)
    cx_s, cy_s = int(cx*small[0]/w), int(cy*small[1]/h)
    r_s = max(2, int(r*small[0]/w))
    # Multiple soft concentric circles with brighter center
    for i in range(40, 0, -1):
        t = i/40
        rad = int(r_s * t)
        a = int(peak * (1-t)**1.8)
        if a <= 0: continue
        d.ellipse([cx_s-rad, cy_s-rad, cx_s+rad, cy_s+rad], fill=a)
    sm = sm.filter(ImageFilter.GaussianBlur(20))
    big = sm.resize(size, Image.BICUBIC)
    out = Image.new("RGBA", size, (0,0,0,0))
    col = Image.new("RGBA", size, color+(0,))
    col.putalpha(big)
    return col

def add_grain(im, strength=8, seed=7):
    w, h = im.size
    rnd = random.Random(seed)
    n = Image.new("L", (w//2, h//2))
    px = n.load()
    for y in range(h//2):
        for x in range(w//2):
            px[x,y] = rnd.randint(0,255)
    n = n.resize((w,h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(0.5))
    overlay = Image.merge("RGBA", (n, n, n, Image.new("L",(w,h),strength)))
    return Image.alpha_composite(im.convert("RGBA"), overlay)

def grid_lines(im, color=(255,255,255,7), step=80):
    w, h = im.size
    grid = Image.new("RGBA", (w,h), (0,0,0,0))
    d = ImageDraw.Draw(grid)
    for x in range(0,w,step): d.line([(x,0),(x,h)], fill=color, width=1)
    for y in range(0,h,step): d.line([(0,y),(w,y)], fill=color, width=1)
    return Image.alpha_composite(im.convert("RGBA"), grid)

def edge_vignette(im, strength=90):
    """Darken corners using a soft elliptical mask."""
    w, h = im.size
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    # bright center, dark corners (we'll invert and apply darkness)
    # Use multiple concentric whites
    for i in range(30, 0, -1):
        t = i/30
        rx = int(w*0.62*t + w*0.08)
        ry = int(h*0.70*t + h*0.10)
        a = int(255 * (1-t))
        d.ellipse([w//2-rx, h//2-ry, w//2+rx, h//2+ry], fill=255-a)
    m = m.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", (w,h), (0,0,0,strength))
    dark.putalpha(m)
    return Image.alpha_composite(im.convert("RGBA"), dark)

# ---------- Slide 1 BG ----------
b1 = vgrad((W,H), (8, 14, 28), (16, 28, 50)).convert("RGBA")
b1 = Image.alpha_composite(b1, radial_glow((W,H), int(W*0.22), int(H*0.18), int(W*0.6), FC_GLOW, peak=160))
b1 = Image.alpha_composite(b1, radial_glow((W,H), int(W*0.88), int(H*0.82), int(W*0.55), (60, 90, 150), peak=90))
b1 = grid_lines(b1, color=(255,255,255,6), step=80)
b1 = add_grain(b1, strength=12)
b1 = edge_vignette(b1, strength=120)
b1.convert("RGB").save(os.path.join(OUT, "bg_slide1.png"), quality=95)

# ---------- Slide 2 BG ----------
b2 = vgrad((W,H), (8, 14, 28), (18, 30, 52)).convert("RGBA")
b2 = Image.alpha_composite(b2, radial_glow((W,H), int(W*0.82), int(H*0.20), int(W*0.55), FC_GLOW, peak=160))
b2 = Image.alpha_composite(b2, radial_glow((W,H), int(W*0.20), int(H*0.85), int(W*0.45), (180,120,30), peak=70))
b2 = grid_lines(b2, color=(255,255,255,6), step=80)
b2 = add_grain(b2, strength=12)
b2 = edge_vignette(b2, strength=120)
b2.convert("RGB").save(os.path.join(OUT, "bg_slide2.png"), quality=95)

# ---------- Slide 3 BG ----------
b3 = vgrad((W,H), (6, 12, 24), (14, 24, 46)).convert("RGBA")
b3 = Image.alpha_composite(b3, radial_glow((W,H), int(W*0.50), int(H*0.45), int(W*0.65), FC_GLOW, peak=200))
b3 = Image.alpha_composite(b3, radial_glow((W,H), int(W*0.10), int(H*0.10), int(W*0.35), FC, peak=90))
b3 = Image.alpha_composite(b3, radial_glow((W,H), int(W*0.92), int(H*0.92), int(W*0.35), FC, peak=90))
b3 = grid_lines(b3, color=(255,255,255,5), step=80)
b3 = add_grain(b3, strength=11)
b3 = edge_vignette(b3, strength=110)
b3.convert("RGB").save(os.path.join(OUT, "bg_slide3.png"), quality=95)

print("Backgrounds done")
