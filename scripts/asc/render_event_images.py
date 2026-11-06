"""Render In-App Event media (event card 1920x1080, details page 1080x1920) per event and locale.

    python3 scripts/asc/render_event_images.py [FONT_DIR]

FONT_DIR must hold NotoSansCJKjp-Bold.otf and NotoSansCJKjp-Regular.otf (Japanese glyphs; no tofu).
Output: docs/appstore-marketing/events/<event>/<locale>-{card,details}.png

Apple overlays the event name, badge and short description on the lower part of both images,
so all artwork stays in the upper ~62% and the bottom is a quiet canvas.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONT_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser('~/.local/share/fonts/noto')
OUT = os.path.join(ROOT, 'docs', 'appstore-marketing', 'events')

CANVAS = (0xF2, 0xF2, 0xF0)
INDIGO = (0x2B, 0x33, 0xE8)
INK = (0x16, 0x18, 0x1D)
SUB = (0x56, 0x59, 0x61)
S = 2  # supersample

def font(weight, px):
    return ImageFont.truetype(os.path.join(FONT_DIR, f'NotoSansCJKjp-{weight}.otf'), px * S)

ICON = Image.open(os.path.join(ROOT, 'assets', 'icon.png')).convert('RGBA')

COPY = {
    'suito-ai': {
        'en-US': dict(kicker='Suito AI', head=['Say it or snap it.'], sub='The AI runs on your iPhone',
                      chips=['Voice entry', 'Plain words', 'Receipt scan', 'Ask', 'Monthly recap'],
                      foot=['No account', 'No ads', 'Nothing sent']),
        'ja': dict(kicker='Suito AI', head=['話すだけ、', '撮るだけ。'], sub='AIはiPhoneの中で動きます',
                   chips=['声で入力', 'ことばで入力', 'レシート読み取り', '聞く', '先月のふりかえり'],
                   foot=['登録不要', '広告なし', 'データは外に出ません']),
    },
    'new-year': {
        'en-US': dict(kicker='2027', head=['A fresh start', 'for your money'], sub='Set a budget, log a little each day',
                      chips=[], foot=['No account', 'No ads']),
        'ja': dict(kicker='2027', head=['新しい年は、', '新しい家計簿で'], sub='予算を決めて、毎日少しずつ記録',
                   chips=[], foot=['登録不要', '広告なし']),
    },
}

def glow(size, center, radius, alpha=90):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=INDIGO + (alpha,))
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))

def paste_icon(img, box_xy, size):
    x, y = box_xy
    icon = ICON.resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.2237), fill=255)
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x, y + size * 0.05, x + size, y + size * 1.05],
                                             radius=int(size * 0.2237), fill=(22, 22, 55, 60))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(size * 0.07)))
    img.paste(icon, (x, y), mask)

def text_w(d, s, f):
    return d.textlength(s, font=f)

def chip_row(d, x, y, items, f, max_w, fill_bg, fg, pad_x, h, gap, center=False):
    """Lay chips left-to-right, wrapping; returns bottom y."""
    rows, row, w = [], [], 0
    for it in items:
        cw = text_w(d, it, f) + pad_x * 2
        if row and w + gap + cw > max_w:
            rows.append((row, w)); row, w = [], 0
        row.append((it, cw)); w += (gap if len(row) > 1 else 0) + cw
    if row: rows.append((row, w))
    for r, rw in rows:
        cx = x + (max_w - rw) / 2 if center else x
        for it, cw in r:
            d.rounded_rectangle([cx, y, cx + cw, y + h], radius=h / 2, fill=fill_bg)
            d.text((cx + cw / 2, y + h / 2), it, font=f, fill=fg, anchor='mm')
            cx += cw + gap
        y += h + gap
    return y

def calendar(img, x, y, w, lang):
    """Mini January 2027 month (Jan 1 2027 is a Friday) with the 1st highlighted."""
    d = ImageDraw.Draw(img)
    cell = w / 7
    card_h = cell * 7.75
    sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + 12 * S, x + w, y + card_h + 12 * S], radius=36 * S, fill=(22, 22, 55, 40))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(24 * S)))
    d.rounded_rectangle([x, y, x + w, y + card_h], radius=36 * S, fill=(255, 255, 255))
    title = 'January 2027' if lang == 'en-US' else '2027年 1月'
    d.text((x + cell * 0.5, y + cell * 0.75), title, font=font('Bold', int(cell / S * 0.42)), fill=INK, anchor='lm')
    days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] if lang == 'en-US' else ['日', '月', '火', '水', '木', '金', '土']
    fs = font('Regular', int(cell / S * 0.30))
    for i, dd in enumerate(days):
        d.text((x + cell * (i + 0.5), y + cell * 1.55), dd, font=fs, fill=SUB, anchor='mm')
    fb = font('Bold', int(cell / S * 0.34))
    col, row = 5, 0
    for n in range(1, 32):
        cx, cy = x + cell * (col + 0.5), y + cell * (2.4 + row * 0.92)
        if n == 1:
            r = cell * 0.38
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=INDIGO)
            d.text((cx, cy), str(n), font=fb, fill=(255, 255, 255), anchor='mm')
        else:
            d.text((cx, cy), str(n), font=fb, fill=INK, anchor='mm')
        col += 1
        if col == 7: col, row = 0, row + 1

def render_card(event, lang, c):
    W, H = 1920 * S, 1080 * S
    img = Image.new('RGBA', (W, H), CANVAS + (255,))
    d = ImageDraw.Draw(img)
    lx, top = 150 * S, 150 * S
    if event == 'suito-ai':
        img.alpha_composite(glow((W, H), (int(W * 0.74), int(H * 0.36)), 330 * S, 80))
        paste_icon(img, (int(W * 0.74) - 170 * S, int(H * 0.36) - 170 * S), 340 * S)
    else:
        img.alpha_composite(glow((W, H), (int(W * 0.74), int(H * 0.34)), 300 * S, 70))
        calendar(img, int(W * 0.60), 90 * S, 540 * S, lang)
    d = ImageDraw.Draw(img)
    d.text((lx, top), c['kicker'], font=font('Bold', 44), fill=INDIGO, anchor='ls')
    y = top + 30 * S
    hf = font('Bold', 96 if lang == 'en-US' else 92)
    for line in c['head']:
        y += 112 * S
        d.text((lx, y), line, font=hf, fill=INK, anchor='ls')
    y += 82 * S
    d.text((lx, y), c['sub'], font=font('Regular', 42), fill=SUB, anchor='ls')
    return img.convert('RGB').resize((1920, 1080), Image.LANCZOS)

def render_details(event, lang, c):
    W, H = 1080 * S, 1920 * S
    img = Image.new('RGBA', (W, H), CANVAS + (255,))
    if event == 'suito-ai':
        img.alpha_composite(glow((W, H), (W // 2, 330 * S), 300 * S, 80))
        paste_icon(img, (W // 2 - 150 * S, 180 * S), 300 * S)
        y = 600 * S
    else:
        img.alpha_composite(glow((W, H), (W // 2, 420 * S), 300 * S, 60))
        calendar(img, 230 * S, 120 * S, 620 * S, lang)
        y = 120 * S + int(620 / 7 * 7.75) * S + 90 * S
    d = ImageDraw.Draw(img)
    d.text((W / 2, y), c['kicker'], font=font('Bold', 40), fill=INDIGO, anchor='ms')
    hf = font('Bold', 84 if lang == 'en-US' else 80)
    head = c['head'] if event == 'new-year' or lang == 'ja' else ['Say it', 'or snap it.']
    for line in head:
        y += 104 * S
        d.text((W / 2, y), line, font=hf, fill=INK, anchor='ms')
    y += 80 * S
    d.text((W / 2, y), c['sub'], font=font('Regular', 38), fill=SUB, anchor='ms')
    y += 56 * S
    if c['chips']:
        y = chip_row(d, 90 * S, y, c['chips'], font('Bold', 32), W - 180 * S, (255, 255, 255), INDIGO,
                     30 * S, 72 * S, 16 * S, center=True)
    y += 8 * S
    chip_row(d, 90 * S, y, c['foot'], font('Regular', 28), W - 180 * S, (0xE4, 0xE5, 0xF6), INK,
             24 * S, 56 * S, 14 * S, center=True)
    return img.convert('RGB').resize((1080, 1920), Image.LANCZOS)

if __name__ == '__main__':
    for event, langs in COPY.items():
        os.makedirs(os.path.join(OUT, event), exist_ok=True)
        for lang, c in langs.items():
            for kind, fn in (('card', render_card), ('details', render_details)):
                p = os.path.join(OUT, event, f'{lang}-{kind}.png')
                fn(event, lang, c).save(p, optimize=True)
                print(p)
