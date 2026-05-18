"""Render Slide 2: $10K+ WEEK"""
import sys, os
sys.path.insert(0, "/sessions/adoring-dazzling-babbage/mnt/outputs")
from design_lib import *
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ASSETS = "/sessions/adoring-dazzling-babbage/mnt/outputs/assets"
LOGO = "/sessions/adoring-dazzling-babbage/mnt/outputs/extracted/ppt/media/image-1-1.png"

W, H = 1920, 1080
M = 60

# Data: rank, name, amount, badge (None / "RECORD HIGH" / "FIRST $10K")
ROWS = [
    (1, "Jensin Philpott", "$17,694", "RECORD HIGH"),
    (2, "Matt Stewart",    "$15,744", "FIRST $10K"),
    (3, "Marco Ayala",     "$13,800", "FIRST $10K"),
    (4, "Garrett Sekelsky","$11,459", None),
    (5, "Hayden Keltner",  "$10,483", None),
]

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

im = Image.open(os.path.join(ASSETS, "bg_slide2.png")).convert("RGBA")

# === HEADER (compact top strip) ===
title_y = 56
draw_layer = Image.new("RGBA", im.size, (0,0,0,0))
d = ImageDraw.Draw(draw_layer)
# Eyebrow
draw_text_simple(d, (M, title_y), "FIRST CLASS AGENCY  ·  APRIL  ·  WEEK 5",
                 font("semibold", 18), FC_HI, anchor="lt", tracking=8)
im = Image.alpha_composite(im, draw_layer)

# Logo top right
im = stamp_logo(im, LOGO, x=W - M - 80, y=46, size=80, glow_color=FC_GLOW)

# === HERO TITLE ===
# Massive "$10K+ WEEK" headline
hero_y = 130
hero_font = font("black", 220)
hero_str = "$10K+ WEEK"
# Big underglow first
glow_layer = Image.new("RGBA", im.size, (0,0,0,0))
gd = ImageDraw.Draw(glow_layer)
gd.text((M, hero_y), hero_str, font=hero_font, fill=FC_HI + (180,), anchor="lt")
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(36))
im = Image.alpha_composite(im, glow_layer)
# Crisp top fill - subtle gradient via two passes
# 1) shadow pass for depth
sh = Image.new("RGBA", im.size, (0,0,0,0))
sd = ImageDraw.Draw(sh)
sd.text((M+4, hero_y+8), hero_str, font=hero_font, fill=(0,0,0,200), anchor="lt")
sh = sh.filter(ImageFilter.GaussianBlur(10))
im = Image.alpha_composite(im, sh)
# 2) crisp main text
d2 = ImageDraw.Draw(im)
d2.text((M, hero_y), hero_str, font=hero_font, fill=WHITE + (255,), anchor="lt")
# 3) gradient overlay over the text region to add tonal depth
# Mask: white text on transparent, then composite a gradient using that mask
mask_im = Image.new("L", im.size, 0)
md = ImageDraw.Draw(mask_im)
md.text((M, hero_y), hero_str, font=hero_font, fill=255, anchor="lt")
grad = linear_gradient(im.size, (200, 230, 255), (90, 120, 180), horizontal=False)
grad = grad.convert("RGBA")
grad.putalpha(mask_im.point(lambda v: int(v*0.30)))   # subtle overlay
im = Image.alpha_composite(im, grad)

# Subheadline under hero
sub_y = hero_y + 230
sub_layer = Image.new("RGBA", im.size, (0,0,0,0))
sd2 = ImageDraw.Draw(sub_layer)
draw_text_simple(sd2, (M, sub_y), "AGENTS WHO CROSSED THE BAR",
                 font("bold", 24), (180, 200, 230), anchor="lt", tracking=10)
# right side: count chip
chip_label = f"{len(ROWS)} CLOSED $10K+ WEEKS"
chip_font = font("bold", 16)
cw = measure(chip_label, chip_font, tracking=4) + 36
sd2.rounded_rectangle([W - M - cw, sub_y - 6, W - M, sub_y + 26],
                      radius=16, fill=FC + (180,), outline=FC_HI + (220,), width=1)
draw_text_simple(sd2, (W - M - cw/2, sub_y + 10), chip_label,
                 chip_font, WHITE, anchor="mm", tracking=4)
im = Image.alpha_composite(im, sub_layer)

# Glow divider
im = glow_line(im, (M, sub_y + 60), (W - M, sub_y + 60), color=FC_HI, width=2, blur=10, opacity=180)

# === ROWS (5 entries) ===
rows_y0 = sub_y + 86
rows_y1 = H - 110
rh = (rows_y1 - rows_y0) / len(ROWS)

# Zones
rank_zone_w = 130
amt_zone_w = 380
badge_zone_w = 240
name_x = M + rank_zone_w + 12
amt_x_right = W - M - 20

for i, (rk, name, amt, badge) in enumerate(ROWS):
    ry = rows_y0 + i*rh
    ry_c = ry + rh/2
    # Card per row with subtle glass
    row_bbox = (M, ry+6, W - M, ry + rh - 6)
    is_top = (i == 0)
    accent = GOLD if is_top else FC_HI
    # Outer glow for top row
    if is_top:
        og = Image.new("RGBA", im.size, (0,0,0,0))
        ImageDraw.Draw(og).rounded_rectangle(row_bbox, radius=18, fill=GOLD + (45,))
        og = og.filter(ImageFilter.GaussianBlur(28))
        im = Image.alpha_composite(im, og)
    # Glass card
    im = glass_card(im, row_bbox, radius=18, fill=(255,255,255,12),
                    border=(255,255,255,40), border_w=1, shadow=False,
                    glow_color=None)
    # Left accent bar (vertical) with glow
    bar_x = M + 4
    bar_layer = Image.new("RGBA", im.size, (0,0,0,0))
    bd = ImageDraw.Draw(bar_layer)
    bd.rounded_rectangle([bar_x, ry+18, bar_x+8, ry + rh - 18], radius=4,
                         fill=accent + (255,))
    bar_layer = bar_layer.filter(ImageFilter.GaussianBlur(4))
    im = Image.alpha_composite(im, bar_layer)
    d3 = ImageDraw.Draw(im)
    d3.rounded_rectangle([bar_x, ry+18, bar_x+8, ry + rh - 18], radius=4,
                         fill=accent + (255,))
    # Rank big
    rank_font = font("black", 96 if is_top else 84)
    d3.text((M + 50, ry_c), f"{rk:02d}", font=rank_font,
            fill=accent + (255,) if is_top else (210, 220, 240, 255), anchor="lm")
    # Name
    name_font = font("bold", 40 if is_top else 36)
    d3.text((name_x + 30, ry_c), name, font=name_font, fill=WHITE + (255,), anchor="lm")
    # Amount on right with glow
    amt_font = font("black", 78 if is_top else 64)
    # subtle glow for amount on champ row
    if is_top:
        glow_amt = Image.new("RGBA", im.size, (0,0,0,0))
        ImageDraw.Draw(glow_amt).text((amt_x_right, ry_c), amt, font=amt_font,
                                      fill=GOLD + (200,), anchor="rm")
        glow_amt = glow_amt.filter(ImageFilter.GaussianBlur(14))
        im = Image.alpha_composite(im, glow_amt)
        d3 = ImageDraw.Draw(im)
    d3.text((amt_x_right, ry_c), amt, font=amt_font,
            fill=(GOLD if is_top else WHITE) + (255,), anchor="rm")
    # Badge (between name and amount)
    if badge:
        bd2_layer = Image.new("RGBA", im.size, (0,0,0,0))
        bd2 = ImageDraw.Draw(bd2_layer)
        b_font = font("black", 14)
        b_w = measure(badge, b_font, tracking=4) + 32
        b_h = 32
        b_x_left = amt_x_right - amt_zone_w - b_w - 28
        b_y = ry_c - b_h/2
        if badge == "RECORD HIGH":
            fc1, fc2 = GOLD + (240,), GOLD_HI + (255,)
            text_c = (28, 18, 5, 255)
        else:
            fc1, fc2 = FC + (200,), FC_HI + (255,)
            text_c = WHITE + (255,)
        bd2.rounded_rectangle([b_x_left, b_y, b_x_left + b_w, b_y + b_h],
                              radius=16, fill=fc1, outline=fc2, width=1)
        draw_text_simple(bd2, (b_x_left + b_w/2, b_y + b_h/2), badge, b_font,
                         text_c[:3], anchor="mm", tracking=4)
        im = Image.alpha_composite(im, bd2_layer)

# === FOOTER ===
im = horizontal_glow_bar(im, H - 6, 0, W, color=FC_HI, height=4, blur=14, peak=220)
foot_layer = Image.new("RGBA", im.size, (0,0,0,0))
fd = ImageDraw.Draw(foot_layer)
draw_text_simple(fd, (W//2, H - 56), "BIG DREAMS.   BIG ACTION.   BIG RESULTS.",
                 font("black", 22), FC_HI, anchor="mt", tracking=10)
im = Image.alpha_composite(im, foot_layer)

out_path = os.path.join(ASSETS, "slide2.png")
im.convert("RGB").save(out_path, quality=95)
print("Saved", out_path)
