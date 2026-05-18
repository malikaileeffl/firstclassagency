"""Render Slide 1: Leaderboard"""
import sys, os
sys.path.insert(0, "/sessions/adoring-dazzling-babbage/mnt/outputs")
from design_lib import *
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = "/sessions/adoring-dazzling-babbage/mnt/outputs/assets"
ASSETS = OUT
LOGO = "/sessions/adoring-dazzling-babbage/mnt/outputs/extracted/ppt/media/image-1-1.png"

W, H = 1920, 1080
M = 60
HEAD_H = 170

GREEN_LIST = [
    (1, "Colby Whittaker", "$80,505.55"),
    (2, "Garrett Sekelsky", "$57,222.68"),
    (3, "Hayden Keltner", "$30,765.89"),
]
BLUE_LIST = [
    (1, "Sawyer Wetzel", "$28,197.38"),
    (2, "Justin Bailey", "$21,930.96"),
    (3, "Charles Freeland", "$19,039.28"),
    (4, "Jensin Philpott", "$15,561.12"),
]
RED_LIST = [
    (1, "Dakota Mullis", "$13,543.19"),
    (2, "Andrew Smith", "$11,349.11"),
    (3, "Logan Laughlin", "$9,548.64"),
    (4, "Gabriel Lucas", "$7,206.72"),
    (5, "Zachary Schmidt", "$6,710.64"),
    (6, "Inti Acuna", "$4,584.60"),
    (7, "Malikai Lee", "$4,297.20"),
    (8, "Ethan Schreiber", "$4,032.84"),
    (9, "Dawson Rider", "$3,598.08"),
    (10, "Landon Schindler", "$3,113.88"),
    (11, "Thomas Mercer", "$2,000.04"),
]

im = Image.open(os.path.join(ASSETS, "bg_slide1.png")).convert("RGBA")

# === HEADER ===
title_y = 56
title = "FIRST CLASS AGENCY"
title_font = font("black", 76)
im = glow_text(im, (M, title_y), title, title_font, color=WHITE,
               glow_color=(180,210,255), blur=24, intensity=2)
sub_font = font("semibold", 20)
im = glow_text(im, (M, title_y + 88), "APRIL  ·  WEEK 5  ·  LEADERBOARD",
               sub_font, color=FC_HI, glow_color=FC_HI, blur=8, intensity=2, tracking=10)

# Logo
im = stamp_logo(im, LOGO, x=W - M - 96, y=42, size=96, glow_color=FC_GLOW)

# Glow line under header
im = glow_line(im, (M, HEAD_H+20), (W - M, HEAD_H+20), color=FC_HI, width=2, blur=10, opacity=160)

# === BODY ===
body_y0 = HEAD_H + 56
body_y1 = H - 110
body_h = body_y1 - body_y0
gutter = 36
col_w = (W - 2*M - 2*gutter) // 3
cols_x = [M, M + col_w + gutter, M + 2*(col_w + gutter)]

def measure(s, fnt, tracking=0):
    return sum(fnt.getlength(c) for c in s) + tracking*max(0, len(s)-1)

def draw_text_simple(d, xy, s, fnt, color, anchor="lm", tracking=0):
    if tracking == 0:
        c = color + (255,) if len(color) == 3 else color
        d.text(xy, s, font=fnt, fill=c, anchor=anchor)
    else:
        x, y = xy
        c = color + (255,) if len(color) == 3 else color
        if anchor[0] == "r":
            w_tot = measure(s, fnt, tracking)
            x -= w_tot
        elif anchor[0] == "m":
            w_tot = measure(s, fnt, tracking)
            x -= w_tot/2
        for ch in s:
            d.text((x, y), ch, font=fnt, fill=c, anchor="l"+anchor[1])
            x += fnt.getlength(ch) + tracking

def draw_column(im, x, w, y0, y1, tier_label, accent, rows,
                rank_size, name_size, amt_size,
                rank_zone_w=72, amt_zone_w=190, two_line=False,
                hairline=True):
    head_h_local = 76
    # Glow top edge
    im = horizontal_glow_bar(im, y0, x, x+w, color=accent, height=4, blur=14, peak=200)
    # Glass card
    im = glass_card(im, (x, y0, x+w, y1), radius=20, fill=(255,255,255,8),
                    border=(255,255,255,40), border_w=1, shadow=True,
                    glow_color=accent, glow_blur=60)
    # Tier label
    layer = Image.new("RGBA", im.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    label_font = font("bold", 22)
    draw_text_simple(d, (x + 28, y0 + 42), tier_label, label_font, accent, anchor="lm", tracking=4)
    # Count chip
    count_label = f"{len(rows)} AGENT{'S' if len(rows)!=1 else ''}"
    count_font = font("semibold", 12)
    cw = measure(count_label, count_font, tracking=2) + 22
    chip_y = y0 + 32
    d.rounded_rectangle([x + w - 24 - cw, chip_y, x + w - 24, chip_y + 22],
                        radius=11, fill=(255,255,255,25), outline=accent + (140,), width=1)
    draw_text_simple(d, (x + w - 24 - cw/2, chip_y + 11), count_label, count_font,
                     (220,230,250), anchor="mm", tracking=2)
    im = Image.alpha_composite(im, layer)
    # Divider under tier label
    d2 = ImageDraw.Draw(im)
    d2.line([(x + 28, y0 + head_h_local - 6), (x + w - 28, y0 + head_h_local - 6)],
            fill=(255,255,255,35), width=1)

    # Rows
    rows_y0 = y0 + head_h_local + 10
    rows_y1 = y1 - 20
    avail = rows_y1 - rows_y0
    n = len(rows)
    rh = avail / n

    rank_font = font("black", rank_size)
    name_font = font("bold", name_size)
    amt_font = font("black", amt_size)

    for i, (rk, name, amt) in enumerate(rows):
        ry = rows_y0 + i*rh
        ry_c = ry + rh/2
        # #1 row gets accent tint
        if i == 0:
            tint = Image.new("RGBA", im.size, (0,0,0,0))
            ImageDraw.Draw(tint).rounded_rectangle(
                [x+14, ry+3, x+w-14, ry+rh-3], radius=14,
                fill=accent + (30,))
            tint = tint.filter(ImageFilter.GaussianBlur(4))
            im = Image.alpha_composite(im, tint)
        d3 = ImageDraw.Draw(im)
        # Rank
        rank_x = x + 36
        rank_color = accent if i == 0 else (170, 188, 215)
        d3.text((rank_x, ry_c), str(rk), font=rank_font, fill=rank_color + (255,), anchor="lm")
        # Name and amount
        # Define explicit zones:
        name_x0 = rank_x + rank_zone_w
        amt_x1 = x + w - 24
        name_x1 = amt_x1 - amt_zone_w - 16
        if not two_line:
            d3.text((name_x0, ry_c), name, font=name_font, fill=WHITE + (255,), anchor="lm")
            d3.text((amt_x1, ry_c), amt, font=amt_font,
                    fill=(accent if i==0 else OFFWHITE) + (255,), anchor="rm")
        else:
            # name on top half, amount on bottom half
            d3.text((name_x0, ry_c - 14), name, font=name_font, fill=WHITE + (255,), anchor="lb")
            d3.text((amt_x1, ry_c + 14), amt, font=amt_font,
                    fill=(accent if i==0 else OFFWHITE) + (255,), anchor="rt")
        # Hairline
        if hairline and i < n-1:
            d3.line([(x + 36, ry + rh - 1), (x + w - 28, ry + rh - 1)],
                    fill=(255,255,255,22), width=1)
    return im

# GREEN column: 3 rows. Champion at top.
im = draw_column(im, cols_x[0], col_w, body_y0, body_y1,
                 "GREEN  ·  $30K+", GREEN, GREEN_LIST,
                 rank_size=72, name_size=32, amt_size=34,
                 rank_zone_w=86, amt_zone_w=220, two_line=False)

# BLUE column: 4 rows
im = draw_column(im, cols_x[1], col_w, body_y0, body_y1,
                 "BLUE  ·  $15K – $30K", FC_HI, BLUE_LIST,
                 rank_size=56, name_size=28, amt_size=30,
                 rank_zone_w=74, amt_zone_w=200, two_line=False)

# RED column: 11 rows, compact
im = draw_column(im, cols_x[2], col_w, body_y0, body_y1,
                 "RED  ·  UNDER $15K", RED, RED_LIST,
                 rank_size=22, name_size=20, amt_size=20,
                 rank_zone_w=34, amt_zone_w=130, two_line=False,
                 hairline=True)

# CHAMPION badge on Colby — place TOP-RIGHT corner of his row, not over the name
green_head_h = 76
green_rows_y0 = body_y0 + green_head_h + 10
green_rh = ((body_y1 - 20) - green_rows_y0) / 3
colby_y = green_rows_y0
badge_layer = Image.new("RGBA", im.size, (0,0,0,0))
bd = ImageDraw.Draw(badge_layer)
b_w, b_h = 140, 28
b_x_right = cols_x[0] + col_w - 24
b_y = colby_y + 14
bd.rounded_rectangle([b_x_right - b_w, b_y, b_x_right, b_y + b_h], radius=14,
                     fill=GOLD + (235,), outline=GOLD_HI + (255,), width=1)
draw_text_simple(bd, (b_x_right - b_w/2, b_y + b_h/2), "★  CHAMPION  ★", font("black", 12),
                 (24,18,4), anchor="mm", tracking=2)
im = Image.alpha_composite(im, badge_layer)

# === FOOTER ===
im = horizontal_glow_bar(im, H - 6, 0, W, color=FC_HI, height=4, blur=14, peak=220)
foot_layer = Image.new("RGBA", im.size, (0,0,0,0))
fd = ImageDraw.Draw(foot_layer)
draw_text_simple(fd, (M, H - 56), "BIG DREAMS.  BIG ACTION.  BIG RESULTS.",
                 font("bold", 18), FC_HI, anchor="lt", tracking=6)
draw_text_simple(fd, (W - M, H - 56), "WEEKLY  ·  COMMISSIONS PAID",
                 font("medium", 14), DIM, anchor="rt", tracking=4)
im = Image.alpha_composite(im, foot_layer)

out_path = os.path.join(ASSETS, "slide1.png")
im.convert("RGB").save(out_path, quality=95)
print("Saved", out_path)
