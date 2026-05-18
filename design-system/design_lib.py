"""Shared design utilities for FC April Week 5 deck."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import os, math

FONT_DIR = "/sessions/adoring-dazzling-babbage/mnt/outputs/fonts"
GFONT_DIR = "/usr/share/fonts/truetype/google-fonts"
LATO_DIR = "/usr/share/fonts/truetype/lato"
INTER = os.path.join(FONT_DIR, "Inter.ttf")
POPPINS_BOLD = os.path.join(GFONT_DIR, "Poppins-Bold.ttf")
POPPINS_MED = os.path.join(GFONT_DIR, "Poppins-Medium.ttf")
POPPINS_REG = os.path.join(GFONT_DIR, "Poppins-Regular.ttf")
LATO_BLACK = os.path.join(LATO_DIR, "Lato-Black.ttf")
LATO_HEAVY = os.path.join(LATO_DIR, "Lato-Heavy.ttf")
LATO_BOLD = os.path.join(LATO_DIR, "Lato-Bold.ttf")
LATO_REG = os.path.join(LATO_DIR, "Lato-Regular.ttf")

# Palette
INK = (5, 8, 16)
FC = (0, 120, 171)
FC_HI = (0, 184, 255)
FC_GLOW = (40, 140, 220)
GREEN = (16, 185, 129)
GREEN_HI = (74, 222, 128)
RED = (239, 68, 68)
RED_HI = (252, 165, 165)
GOLD = (251, 191, 36)
GOLD_HI = (253, 224, 71)
WHITE = (255, 255, 255)
OFFWHITE = (230, 237, 243)
DIM = (140, 158, 184)
MUTED = (95, 115, 145)

def font(weight="bold", size=24, italic=False):
    """Pick an Inter variant by approximate weight."""
    try:
        f = ImageFont.truetype(INTER, size=size)
        # variable font weight axis
        if hasattr(f, "set_variation_by_axes"):
            wmap = {"thin":100,"light":300,"regular":400,"medium":500,
                    "semibold":600,"bold":700,"extrabold":800,"black":900}
            w = wmap.get(weight, weight if isinstance(weight,int) else 700)
            try:
                f.set_variation_by_axes([w, 0])
                return f
            except Exception:
                pass
        return f
    except Exception:
        # fallback
        return ImageFont.truetype(LATO_BLACK if weight in ("black","extrabold") else LATO_BOLD, size=size)

def lato(size=24, weight="black"):
    p = {"black": LATO_BLACK, "heavy": LATO_HEAVY, "bold": LATO_BOLD, "regular": LATO_REG}.get(weight, LATO_BLACK)
    return ImageFont.truetype(p, size=size)

def poppins(size=24, weight="bold"):
    p = {"bold": POPPINS_BOLD, "medium": POPPINS_MED, "regular": POPPINS_REG}.get(weight, POPPINS_BOLD)
    return ImageFont.truetype(p, size=size)

def text(draw, xy, s, fnt, color=(255,255,255), anchor="lt", tracking=0, opacity=255):
    """Render text. If tracking>0, render letter by letter."""
    if isinstance(color, tuple) and len(color)==3:
        color = color + (opacity,)
    elif isinstance(color, tuple) and len(color)==4:
        color = (color[0], color[1], color[2], min(opacity, color[3]))
    if tracking == 0:
        draw.text(xy, s, font=fnt, fill=color, anchor=anchor)
        return
    # render letter by letter with tracking
    x, y = xy
    if anchor.startswith("m") or anchor.startswith("r"):
        total_w = sum(fnt.getlength(c) for c in s) + tracking * (len(s)-1)
        if anchor.startswith("m"): x -= total_w/2
        elif anchor.startswith("r"): x -= total_w
    for c in s:
        draw.text((x, y), c, font=fnt, fill=color, anchor=anchor[0]+"t" if anchor[1]=="t" else anchor[0]+"a")
        x += fnt.getlength(c) + tracking

def shadow_text(im, xy, s, fnt, color=(255,255,255), shadow=(0,0,0,180), offset=(0,3), blur=6, anchor="lt", tracking=0):
    """Draw a soft shadow then crisp text on top."""
    w, h = im.size
    layer = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(layer)
    text(d, (xy[0]+offset[0], xy[1]+offset[1]), s, fnt, color=shadow, anchor=anchor, tracking=tracking)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    out = Image.alpha_composite(im.convert("RGBA"), layer)
    d2 = ImageDraw.Draw(out)
    text(d2, xy, s, fnt, color=color, anchor=anchor, tracking=tracking)
    return out

def glow_text(im, xy, s, fnt, color=(255,255,255), glow_color=None, blur=12, intensity=2, anchor="lt", tracking=0):
    """Crisp text with soft outer glow."""
    if glow_color is None:
        glow_color = color
    w, h = im.size
    glow = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(glow)
    text(d, xy, s, fnt, color=glow_color+(255,) if len(glow_color)==3 else glow_color, anchor=anchor, tracking=tracking)
    glow = glow.filter(ImageFilter.GaussianBlur(blur))
    # boost glow
    for _ in range(intensity-1):
        glow2 = glow.filter(ImageFilter.GaussianBlur(blur))
        glow = Image.alpha_composite(glow, glow2)
    out = Image.alpha_composite(im.convert("RGBA"), glow)
    d2 = ImageDraw.Draw(out)
    text(d2, xy, s, fnt, color=color, anchor=anchor, tracking=tracking)
    return out

def round_rect(draw, bbox, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

def glass_card(im, bbox, radius=24, fill=(255,255,255,12), border=(255,255,255,40), border_w=1,
               shadow=True, glow_color=None, glow_blur=40):
    """Draw a glass-style rounded card with optional drop shadow + colored glow."""
    w, h = im.size
    out = im.convert("RGBA")
    if glow_color is not None:
        glow_layer = Image.new("RGBA", (w, h), (0,0,0,0))
        d = ImageDraw.Draw(glow_layer)
        ex = 6
        d.rounded_rectangle([bbox[0]-ex, bbox[1]-ex, bbox[2]+ex, bbox[3]+ex],
                            radius=radius+ex, fill=glow_color+(120,) if len(glow_color)==3 else glow_color)
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(glow_blur))
        out = Image.alpha_composite(out, glow_layer)
    if shadow:
        shadow_layer = Image.new("RGBA", (w, h), (0,0,0,0))
        d = ImageDraw.Draw(shadow_layer)
        d.rounded_rectangle([bbox[0]+2, bbox[1]+8, bbox[2]+2, bbox[3]+10],
                            radius=radius, fill=(0,0,0,140))
        shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(18))
        out = Image.alpha_composite(out, shadow_layer)
    card = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle(bbox, radius=radius, fill=fill, outline=border, width=border_w)
    out = Image.alpha_composite(out, card)
    return out

def glow_line(im, xy1, xy2, color=(0,184,255), width=2, blur=8, intensity=2, opacity=255):
    """Draw a glowing horizontal/vertical line."""
    w, h = im.size
    glow = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(glow)
    d.line([xy1, xy2], fill=color+(opacity,), width=width*3)
    glow = glow.filter(ImageFilter.GaussianBlur(blur))
    out = Image.alpha_composite(im.convert("RGBA"), glow)
    d2 = ImageDraw.Draw(out)
    d2.line([xy1, xy2], fill=color+(opacity,), width=width)
    return out

def linear_gradient(size, color1, color2, horizontal=False):
    """Return an RGB image with a linear gradient."""
    w, h = size
    if horizontal:
        im = Image.new("RGB", (w, 1), color1)
        px = im.load()
        for x in range(w):
            t = x/max(1,w-1)
            px[x,0] = tuple(int(color1[i]+(color2[i]-color1[i])*t) for i in range(3))
        return im.resize((w,h), Image.BICUBIC)
    else:
        im = Image.new("RGB", (1, h), color1)
        px = im.load()
        for y in range(h):
            t = y/max(1,h-1)
            px[0,y] = tuple(int(color1[i]+(color2[i]-color1[i])*t) for i in range(3))
        return im.resize((w,h), Image.BICUBIC)

def horizontal_glow_bar(im, y, x1, x2, color=(0,184,255), height=3, blur=14, peak=220):
    """Glowing horizontal accent bar."""
    w, h = im.size
    bar = Image.new("RGBA", (w, h), (0,0,0,0))
    d = ImageDraw.Draw(bar)
    # halo first, with falloff
    for off, op in [(8, 30), (5, 60), (2, 120), (0, peak)]:
        d.rectangle([x1, y-off, x2, y+height+off], fill=color+(op,))
    bar = bar.filter(ImageFilter.GaussianBlur(blur*0.5))
    out = Image.alpha_composite(im.convert("RGBA"), bar)
    # crisp top edge
    d2 = ImageDraw.Draw(out)
    d2.rectangle([x1, y, x2, y+height], fill=color+(255,))
    return out

def stamp_logo(im, logo_path, x, y, size=80, glow_color=None):
    """Paste FC logo with optional glow halo."""
    logo = Image.open(logo_path).convert("RGBA")
    logo = logo.resize((size, size), Image.LANCZOS)
    out = im.convert("RGBA")
    if glow_color:
        w, h = im.size
        glow = Image.new("RGBA", (w, h), (0,0,0,0))
        ImageDraw.Draw(glow).ellipse([x-size*0.2, y-size*0.2, x+size*1.2, y+size*1.2],
                                    fill=glow_color+(70,))
        glow = glow.filter(ImageFilter.GaussianBlur(size*0.4))
        out = Image.alpha_composite(out, glow)
    out.paste(logo, (x, y), logo)
    return out
