#!/usr/bin/env python3
"""Composite the iOS status bar (9:41, Wi-Fi, full battery) from a real
simulator shot onto a web capture: glyphs as black alpha over whatever is
behind (works over the app bg and over a dimmed sheet backdrop)."""
import sys
from PIL import Image
SRC='/home/taigamura/dev/simple-bookkeeping/docs/appstore-screenshots/en-1-calendar.png'
H=180
src=Image.open(SRC).convert('RGB')
bg=src.getpixel((5,5))
for inp,out in zip(sys.argv[1::2],sys.argv[2::2]):
    im=Image.open(inp).convert('RGB'); p=im.load(); s=src.load()
    bl=sum(bg)/3
    for y in range(H):
        for x in range(im.width):
            r,g,b=s[x,y]
            if g>110 and g>r+20 and g>b+20:
                p[x,y]=(r,g,b); continue
            lum=(r+g+b)/3
            a=max(0.0,min(1.0,(bl-lum)/bl))
            if a<0.02: continue
            R,G,B=p[x,y]
            p[x,y]=(int(R*(1-a)),int(G*(1-a)),int(B*(1-a)))
    im.save(out); print('wrote',out,im.size,im.mode)
