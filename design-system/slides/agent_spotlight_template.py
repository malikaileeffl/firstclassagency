"""Render Slide 3: Alex Ward First Sale — celebratory"""
import sys, os, math, random
sys.path.insert(0, "/sessions/adoring-dazzling-babbage/mnt/outputs")
from design_lib import *
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = "/sessions/adoring-dazzling-babbage/mnt/outputs/assets"
LOGO = "/sessions/adoring-dazzling-babbage/mnt/outputs/extracted/ppt/media/image-1-1.png"
ALEX = "/sessions/adoring-dazzling-babbage/mnt/outputs/extracted/ppt/media/image-3-2.png"

W, H = 1920, 1080
M = 60

def measure(s, fnt, tracking=0):
    return sum(fnt.getlength(c) for c in s) + tracking*max(0, len(s)-1)

def draw_text_simple(d, xy, s, fnt, color, anchor="lt", tracking=0):
    if tracking == 0:
        c = color + (255,) if len(color) == 3 else color
        d.text(xy, s, font=fnt, fill=c, anchor=anchor)
    else:
        x, y = xy
        c = color + (255,) if len(color) == 3 else color
        if anchor[0] == "r":
            x -= measure(s, fnt, tracking)
        elif anchor[0] == "m":
            x -= measure(s, fnt, tracking)/2
        for ch in s:
            d.text((x, y), ch, font=fnt, fill=c, anchor="l"+anchor[1])
            x += fnt.getlength(ch) + tracking

im = Image.open(os.path.join(ASSETS, "bg_slide3.png")).convert("RGBA")

# Decorative: subtle dotted ring on left side (very large)
deco = Image.new("RGBA", im.size, (0,0,0,0))
dd = ImageDraw.Draw(deco)
cx, cy = int(W*0.18), int(H*0.5)
for r in [180, 280, 380, 480, 580]:
    dd.ellipse([cx-r, cy-r, cx+r, cy+r], outline=(0,184,255,18), width=1)
# subtle radial dots circle
for r, n in [(220, 28), (340, 36), (460, 48)]:
    for i in range(n):
        ang = i / n * 2*math.pi
        x = cx + r*math.cos(ang)
        y = cy + r*math.sin(ang)
        dd.ellipse([x-1.5, y-1.5, x+1.5, y+1.5], fill=(0,184,255,40))
deco = deco.filter(ImageFilter.GaussianBlur(0.5))
im = Image.alpha_composite(im, deco)

# Top eyebrow
top_layer = Image.new("RGBA", im.size, (0,0,0,0))
td = ImageDraw.Draw(top_layer)
draw_text_simple(td, (M, 52), "FIRST CLASS AGENCY  ·  APRIL  ·  WEEK 5",
                 font("semibold", 18), FC_HI, anchor="lt", tracking=8)
im = Image.alpha_composite(im, top_layer)
im = stamp_logo(im, LOGO, x=W - M - 80, y=42, size=80, glow_color=FC_GLOW)

# === RIGHT SIDE: Alex Ward graphic ===
alex = Image.open(ALEX).convert("RGBA")
# Target height ~780px; preserve ratio
target_h = 820
ratio = target_h / alex.height
target_w = int(alex.width * ratio)
alex_resized = alex.resize((target_w, target_h), Image.LANCZOS)

# Slight rotation for energy
angle = -3
alex_rot = alex_resized.rotate(angle, expand=True, resample=Image.BICUBIC)
ax = W - M - alex_rot.width + 30
ay = (H - alex_rot.height) // 2 + 20

# Big drop shadow behind graphic
shadow_layer = Image.new("RGBA", im.size, (0,0,0,0))
sd = ImageDraw.Draw(shadow_layer)
# rounded shadow approximating the graphic shape
sd.rounded_rectangle([ax+24, ay+34, ax+alex_rot.width+24, ay+alex_rot.height+34],
                     radius=28, fill=(0,0,0,200))
shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(40))
im = Image.alpha_composite(im, shadow_layer)

# Big colored glow behind it
glow_layer = Image.new("RGBA", im.size, (0,0,0,0))
gd = ImageDraw.Draw(glow_layer)
gd.rounded_rectangle([ax-30, ay-30, ax+alex_rot.width+30, ay+alex_rot.height+30],
                     radius=40, fill=FC_HI + (140,))
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(70))
im = Image.alpha_composite(im, glow_layer)

# Paste alex graphic
im.paste(alex_rot, (ax, ay), alex_rot)

# Small spark/sparkle confetti around graphic
sparkle = Image.new("RGBA", im.size, (0,0,0,0))
sd2 = ImageDraw.Draw(sparkle)
rnd = random.Random(42)
for _ in range(28):
    sx = ax + rnd.randint(-40, alex_rot.width + 40)
    sy = ay + rnd.randint(-40, alex_rot.height + 40)
    # skip ones inside the graphic (avoid clutter on face)
    if ax+80 < sx < ax+alex_rot.width-80 and ay+80 < sy < ay+alex_rot.height-80:
        continue
    s = rnd.randint(2, 6)
    color = rnd.choice([FC_HI, GOLD, WHITE])
    sd2.ellipse([sx-s, sy-s, sx+s, sy+s], fill=color + (rnd.randint(140, 230),))
    # cross sparkle
    sd2.line([(sx-s*2, sy), (sx+s*2, sy)], fill=color + (rnd.randint(120, 200),), width=1)
    sd2.line([(sx, sy-s*2), (sx, sy+s*2)], fill=color + (rnd.randint(120, 200),), width=1)
sparkle_blur = sparkle.filter(ImageFilter.GaussianBlur(0.8))
im = Image.alpha_composite(im, sparkle_blur)

# === LEFT SIDE: editorial text ===
text_x = M + 30
text_layer = Image.new("RGBA", im.size, (0,0,0,0))
td2 = ImageDraw.Draw(text_layer)

# Eyebrow with glow accent line — push up above ALEX glow zone
eb_y = 178
# Accent line first
td2.rectangle([text_x, eb_y - 18, text_x + 60, eb_y - 14], fill=GOLD + (255,))
draw_text_simple(td2, (text_x + 80, eb_y - 16), "NEW AGENT  ·  FIRST CLOSE",
                 font("black", 22), GOLD, anchor="lt", tracking=10)
im = Image.alpha_composite(im, text_layer)
text_layer = Image.new("RGBA", im.size, (0,0,0,0))
td2 = ImageDraw.Draw(text_layer)

# Massive name
name_y = eb_y + 80
name_font = font("black", 140)
# Underglow
ng = Image.new("RGBA", im.size, (0,0,0,0))
ImageDraw.Draw(ng).text((text_x, name_y), "ALEX", font=name_font, fill=WHITE + (180,), anchor="lt")
ImageDraw.Draw(ng).text((text_x, name_y + 140), "WARD", font=name_font, fill=WHITE + (180,), anchor="lt")
ng = ng.filter(ImageFilter.GaussianBlur(28))
im = Image.alpha_composite(im, ng)
# Crisp
d3 = ImageDraw.Draw(im)
d3.text((text_x, name_y), "ALEX", font=name_font, fill=WHITE + (255,), anchor="lt")
d3.text((text_x, name_y + 140), "WARD", font=name_font, fill=WHITE + (255,), anchor="lt")
# Underline accent under WARD
ul_w = name_font.getlength("WARD")
d3.rectangle([text_x, name_y + 140 + 150, text_x + ul_w, name_y + 140 + 156], fill=GOLD + (255,))

# Subheadline
sub_y = name_y + 140 + 180
sub_layer = Image.new("RGBA", im.size, (0,0,0,0))
sd3 = ImageDraw.Draw(sub_layer)
draw_text_simple(sd3, (text_x, sub_y), "FIRST SALE  ·  CLOSED",
                 font("bold", 24), FC_HI, anchor="lt", tracking=8)
# Big amount
amt_y = sub_y + 42
amt_font = font("black", 96)
# amount glow
ag = Image.new("RGBA", im.size, (0,0,0,0))
ImageDraw.Draw(ag).text((text_x, amt_y), "$1,822", font=amt_font, fill=FC_HI + (200,), anchor="lt")
ag = ag.filter(ImageFilter.GaussianBlur(18))
im = Image.alpha_composite(im, ag)
d4 = ImageDraw.Draw(im)
d4.text((text_x, amt_y), "$1,822", font=amt_font, fill=WHITE + (255,), anchor="lt")
im = Image.alpha_composite(im, sub_layer)

# === FOOTER ===
im = horizontal_glow_bar(im, H - 6, 0, W, color=FC_HI, height=4, blur=14, peak=220)
foot_layer = Image.new("RGBA", im.size, (0,0,0,0))
fd = ImageDraw.Draw(foot_layer)
draw_text_simple(fd, (M, H - 56), "WELCOME TO THE FAMILY.",
                 font("black", 22), WHITE, anchor="lt", tracking=8)
draw_text_simple(fd, (W - M, H - 56), "BIG DREAMS.  BIG ACTION.  BIG RESULTS.",
                 font("bold", 18), FC_HI, anchor="rt", tracking=6)
im = Image.alpha_composite(im, foot_layer)

out_path = os.path.join(ASSETS, "slide3.png")
im.convert("RGB").save(out_path, quality=95)
print("Saved", out_path)
