#!/usr/bin/env python3
"""Composite a dark iOS status bar onto a de-framed dark web capture.
Lifts the status-bar strip from the matching light App Store shot and recolors:
  background -> dark app bg, black glyphs -> white, keep dynamic island black,
  keep green battery. Then pastes it into the top gap of the dark capture.
"""
import sys
from PIL import Image

LIGHT = sys.argv[1]          # e.g. en-1-calendar.png (has iOS status bar)
DARK  = sys.argv[2]          # de-framed dark capture (top gap opened)
OUT   = sys.argv[3]

DARKBG = (14, 15, 19)
WHITE  = (238, 238, 241)
SB_H   = 150                 # status-bar strip height (px)
ISLAND = (465, 855)          # x-range of the dynamic island pill

light = Image.open(LIGHT).convert('RGB')
dark  = Image.open(DARK).convert('RGB')
W, H  = dark.size
lp = light.load()

strip = Image.new('RGB', (W, SB_H), DARKBG)
sp = strip.load()
for y in range(SB_H):
    for x in range(W):
        r, g, b = lp[x, y]
        lum = (r + g + b) / 3
        greenish = g > 110 and g > r + 20 and g > b + 20
        if greenish:
            sp[x, y] = (r, g, b)                       # keep battery green
        elif ISLAND[0] <= x <= ISLAND[1]:
            sp[x, y] = (0, 0, 0) if lum < 150 else DARKBG   # island stays black
        else:
            sp[x, y] = WHITE if lum < 150 else DARKBG       # glyphs -> white

dark.paste(strip, (0, 0))
dark.save(OUT)
print('wrote', OUT)
