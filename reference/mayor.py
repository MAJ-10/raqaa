# «عمدة الرقعة»: three ideas for the final announcement, each with the four towers as a podium.
import os, base64, math, random
from kit import *
import backgrounds as BG
from sign import SIGN_CSS
from shapely.geometry import Polygon, box as sbox
from shapely.ops import unary_union

W, H = 1280, 720
CO = math.cos(math.radians(45)); CE = math.cos(math.radians(55)); SE = math.sin(math.radians(55))
RANKED = ['blue', 'coral', 'gold', 'green']
POP = {'blue': 3100, 'coral': 3000, 'gold': 2900, 'green': 900}
NAME = data.NAMES
TP = map9.TEAM
GOLD = '#FFD166'
LIT_L, LIT_R = '#FFF1C4', '#FFE29A'

def mix(c, k, to='#FFFFFF'):
    a = [int(c.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    b = [int(to.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02X%02X%02X' % tuple(round(x + (y - x) * k) for x, y in zip(a, b))

# ------------------------------------------------------------------ iso helpers (identity projection, free origin)
def Pp(i, j, z, s, O):
    return (O[0] + (i - j) * CO * s, O[1] + (i + j) * CO * CE * s - z * SE * s)

def plan(x0, y0, x1, y1, r):
    if r <= 0:
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    g = sbox(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=6)
    return list(g.exterior.coords)[:-1]

def dpath(geom):
    ps = [geom] if geom.geom_type == 'Polygon' else [g for g in geom.geoms if g.geom_type == 'Polygon']
    return ' '.join('M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in list(p.exterior.coords)[:-1]) + ' Z'
                    for p in ps if not p.is_empty and p.area > 1e-6)

def rb(x0, y0, x1, y1, z0, z1, pal, s, r, O, top_face=True):
    top, left, right = pal[:3]
    pl = plan(x0, y0, x1, y1, r)
    T = Polygon([Pp(a, b, z1, s, O) for a, b in pl])
    out = ''
    if z1 > z0:
        B = Polygon([Pp(a, b, z0, s, O) for a, b in pl])
        side = unary_union([T, B]).convex_hull.difference(T.buffer(0.02))
        fx = Pp(x1, y1, z0, s, O)[0]
        big = 1e5
        L = side.intersection(Polygon([(-big, -big), (fx, -big), (fx, big), (-big, big)]))
        R = side.intersection(Polygon([(fx, -big), (big, -big), (big, big), (fx, big)]))
        if not L.is_empty: out += f'<path d="{dpath(L)}" fill="{left}"/>'
        if not R.is_empty: out += f'<path d="{dpath(R)}" fill="{right}"/>'
    if top_face:
        out += f'<path d="{dpath(T)}" fill="{top}"/>'
    return out

def quad(pts, fill, extra=''):
    return f'<path d="M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in pts) + f' Z" fill="{fill}"{extra}/>'

def win_L(i0, i1, j, z0, z1, s, O, fill):
    return quad([Pp(i0, j, z0, s, O), Pp(i1, j, z0, s, O), Pp(i1, j, z1, s, O), Pp(i0, j, z1, s, O)], fill)

def win_R(i, j0, j1, z0, z1, s, O, fill):
    return quad([Pp(i, j0, z0, s, O), Pp(i, j1, z0, s, O), Pp(i, j1, z1, s, O), Pp(i, j0, z1, s, O)], fill)

def roof_decal(path_d, ci, cj, z, size, s, O, fill):
    k = size / 24.0
    rx, ry = (1 / math.sqrt(2), -1 / math.sqrt(2)), (1 / math.sqrt(2), 1 / math.sqrt(2))
    def scr(u, v):
        return Pp(ci + (u - 12) * k * rx[0] + (v - 12) * k * ry[0], cj + (u - 12) * k * rx[1] + (v - 12) * k * ry[1], z, s, O)
    o = scr(0, 0); a = scr(1, 0); b = scr(0, 1)
    return (f'<path transform="matrix({a[0] - o[0]:.4f} {a[1] - o[1]:.4f} {b[0] - o[0]:.4f} {b[1] - o[1]:.4f} {o[0]:.2f} {o[1]:.2f})" '
            f'd="{path_d}" fill="{fill}"/>')

def face_text(txt, face, i, j, z, s, O, size, fill, weight=900, anchor='middle'):
    """text painted flat on a wall: face 'L' runs along i, face 'R' runs along j"""
    x, y = Pp(i, j, z, s, O)
    sk = CE if face == 'L' else -CE
    return (f'<text transform="matrix(1 {sk:.4f} 0 1 {x:.1f} {y:.1f})" font-size="{size}" font-weight="{weight}" fill="{fill}" '
            f'text-anchor="{anchor}" font-family="Alexandria" direction="rtl">{txt}</text>')

IC_HOUSE = 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z'

def face_icon(d, face, i, j, z, s, O, size, fill):
    """a 24-grid glyph painted on a wall; (i, j, z) is its bottom-left corner on the wall"""
    x, y = Pp(i, j, z, s, O)
    k = size / 24
    sk = CE if face == 'L' else -CE
    return f'<path transform="matrix({k:.4f} {k * sk:.4f} 0 {k:.4f} {x:.1f} {y - size:.1f})" d="{d}" fill="{fill}"/>'

NIGHT_TILE = ('#2C4170', '#22355C', '#1A2A4A')

def stars(n=80, ymax=420, seed=8):
    rnd = random.Random(seed)
    return ''.join(f'<circle cx="{rnd.randint(0, W)}" cy="{rnd.randint(0, ymax)}" r="{rnd.choice([1.1, 1.5, 1.9])}" fill="#fff" opacity="{rnd.choice([.3, .5, .75])}"/>' for _ in range(n))

def firework(cx, cy, r, color, n=14, seed=1):
    rnd = random.Random(seed)
    out = ''
    for k in range(n):
        a = 2 * math.pi * k / n + rnd.uniform(-.08, .08)
        r0, r1 = r * .34, r * rnd.uniform(.82, 1.0)
        x0, y0 = cx + r0 * math.cos(a), cy + r0 * math.sin(a)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        out += f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x1:.1f}" y2="{y1:.1f}" stroke="{color}" stroke-width="3" stroke-linecap="round"/>'
        out += f'<circle cx="{cx + (r1 + 9) * math.cos(a):.1f}" cy="{cy + (r1 + 9) * math.sin(a):.1f}" r="2.6" fill="{color}"/>'
    return f'<g opacity=".9">{out}</g>'

GLOW = f'<radialGradient id="gl"><stop offset="0" stop-color="{GOLD}" stop-opacity=".22"/><stop offset="1" stop-color="{GOLD}" stop-opacity="0"/></radialGradient>'

def fit(name, size, room):
    """shrink a name until it fits its room (Alexandria runs about .55em a letter)"""
    return min(size, int(room / (.55 * max(1, len(name)))))

def svg(body, defs=''):
    return f'<svg class="bg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" aria-hidden="true"><defs>{defs}</defs>{body}</svg>'

def title():
    return f'<div class="mt-t">{mark_icon(48)}<span>عمدة الرقعة</span></div>'

def pop_html(t, size=26):
    return f'{house(size - 2, INK)}<b>{ar(POP[t])}</b>'

# ------------------------------------------------------------------ A: towers built from the game's own blocks
def model_a():
    s, F, fz, r, seam = 56, 1.9, 0.78, 0.16, 0.08
    floors = (8, 6, 4, 2)
    D = 290 / (2 * CO * s)
    O = (W / 2, 548)
    body, over = '', ''
    # draw left to right so nothing overlaps wrongly (they stand apart anyway)
    order = list(enumerate(RANKED))[::-1]
    glow = ''
    for k, (ri, t) in enumerate(order):
        ci, cj = (k - 1.5) * D, -(k - 1.5) * D
        pal = TP[t]
        x0, x1, y0, y1 = ci - F / 2, ci + F / 2, cj - F / 2, cj + F / 2
        m = .34
        body += rb(x0 - m, y0 - m, x1 + m, y1 + m, -0.24, 0, NIGHT_TILE, s, r + .12, O)
        core = (mix(pal[2], .35, INK), mix(pal[2], .45, INK), mix(pal[2], .55, INK))
        z = 0
        n = floors[ri]
        for f in range(n):
            zt = z + fz
            body += rb(x0, y0, x1, y1, z, zt - seam, pal, s, r, O)
            for c in (-.42, .42):
                body += win_L(ci + c - .2, ci + c + .2, y1, z + .2 * fz, z + .66 * fz, s, O, LIT_L)
                body += win_R(x1, cj + c - .2, cj + c + .2, z + .2 * fz, z + .66 * fz, s, O, LIT_R)
            if f < n - 1:
                body += rb(x0 + .07, y0 + .07, x1 - .07, y1 - .07, zt - seam, zt, core, s, r, O, top_face=False)
            z = zt
        ztop = z - seam
        top = Pp(ci - F / 2, cj - F / 2, ztop, s, O)      # back corner of the roof
        cx, cy = Pp(ci, cj, ztop, s, O)
        base_y = Pp(ci + F / 2 + m, cj + F / 2 + m, -0.24, s, O)[1]
        bubble = top[1] - 14
        if ri == 0:
            glow = f'<circle cx="{cx:.0f}" cy="{top[1] + 170:.0f}" r="330" fill="url(#gl)"/>'
            over += f'<div class="ma-crown" style="left:{cx:.0f}px;top:{cy - 62:.0f}px">{icon("crown", 70, GOLD)}</div>'
            bubble = cy - 62 - 4
        else:
            body += roof_decal(map9.SYM[t], ci, cj, ztop, 1.0, s, O, INK)
        over += f'<div class="ma-pop" style="left:{cx:.0f}px;top:{bubble:.0f}px">{pop_html(t)}</div>'
        over += (f'<div class="ma-plate" style="left:{cx:.0f}px;top:{base_y + 16:.0f}px;background:{COLOR[t]}">'
                 f'<span class="ma-ord">{ar(ri + 1)}</span>{sym(t, 24, INK)}<b style="font-size:{fit(NAME[t], 26, 160)}px">{NAME[t]}</b></div>')
    defs = GLOW
    bg = (f'<rect width="{W}" height="{H}" fill="#13213D"/>{stars()}{glow}'
          f'{BG.far_city(y0=566, fill="#1C2C4E", win="#FFD166", seed=4, lit=.22)}'
          f'<rect y="566" width="{W}" height="{H - 566}" fill="#16264A"/>')
    return f'<div class="d dn mm">{svg(bg + body, defs)}{title()}{over}</div>'

# ------------------------------------------------------------------ B: one podium building, its four wings stepping down
def model_b():
    s, Fi, Fj, r = 54, 2.8, 3.0, 0.1
    hs = [250, 190, 130, 70]                       # screen heights, first to fourth
    O = (812, 344)
    body, over = '', ''
    m = .4
    body += rb(-m, -m, Fi + m, 4 * Fj + m, -0.28, 0, NIGHT_TILE, s, .3, O)
    zs = [h / (SE * s) for h in hs]
    for k, t in enumerate(RANKED):
        pal = TP[t]
        j0, j1, z1 = k * Fj, (k + 1) * Fj, zs[k]
        body += rb(0, j0, Fi, j1, 0, z1, pal, s, r, O)
        # windows on the long wall (i = Fi), above the painted number
        zrow0 = 1.25
        rows = int((z1 - zrow0 - .25) // .62) + 1 if z1 > zrow0 + .35 else 0
        for rr in range(rows):
            zw = zrow0 + rr * .62
            for c in range(3):
                jc = j0 + (c + .5) * Fj / 3
                body += win_R(Fi, jc - .3, jc + .3, zw, zw + .34, s, O, LIT_R)
        zn = zs[k + 1] if k < 3 else 0
        # the population, painted on the long wall at one height for all four
        body += face_text(ar(POP[t]), 'R', Fi, (j0 + j1) / 2, .44, s, O, 30, '#FFFFFF')
        roof_c = (Fi / 2, (j0 + j1) / 2)
        if k == 0:
            cx, cy = Pp(*roof_c, z1, s, O)
            over += f'<div class="mb-crown" style="left:{cx:.0f}px;top:{cy - 52:.0f}px">{icon("crown", 66, GOLD)}</div>'
        else:
            body += roof_decal(map9.SYM[t], *roof_c, z1, 1.1, s, O, INK)
        # name painted on the end wall where it shows
        nz = (zn + z1) / 2
        body += face_text(NAME[t], 'L', Fi / 2, j1, nz - .2, s, O, fit(NAME[t], 22, 96), '#FFFFFF')
    gx, gy = Pp(Fi / 2, Fj / 2, zs[0], s, O)
    bg = (f'<rect width="{W}" height="{H}" fill="#13213D"/>{stars()}<circle cx="{gx:.0f}" cy="{gy + 120:.0f}" r="330" fill="url(#gl)"/>'
          f'{BG.far_city(y0=520, fill="#1C2C4E", win="#FFD166", seed=4, lit=.22)}'
          f'<rect y="520" width="{W}" height="{H - 520}" fill="#16264A"/>')
    return f'<div class="d dn mm">{svg(bg + body, GLOW)}{title()}{over}</div>'

# ------------------------------------------------------------------ C: a night of lights, the towers face the hall
def bulbs(x, y, w, h, step=13, r=2.6, fill=GOLD):
    out = ''
    n = int(w // step)
    for k in range(n + 1):
        xx = x + k * w / n
        out += f'<circle cx="{xx:.1f}" cy="{y:.1f}" r="{r}" fill="{fill}"/><circle cx="{xx:.1f}" cy="{y + h:.1f}" r="{r}" fill="{fill}"/>'
    m = int(h // step)
    for k in range(1, m):
        yy = y + k * h / m
        out += f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="{r}" fill="{fill}"/><circle cx="{x + w:.1f}" cy="{yy:.1f}" r="{r}" fill="{fill}"/>'
    return out

def front_tower(t, x, w, h, base, rank):
    """a tower seen from the hall: cornice, an upper tier for the leaders, lit windows, a marquee at street level"""
    col, sh = COLOR[t], SHADE[t]
    dk = TP[t][2]
    top = base - h
    out = ''
    tiers = {1: (60, 46), 2: (84, 30)}.get(rank)
    if tiers:
        tw, th = w - tiers[0], tiers[1]
        tx = x + (w - tw) / 2
        out += f'<rect x="{tx:.1f}" y="{top - th}" width="{tw}" height="{th + 4}" rx="6" fill="{col}"/>'
        out += f'<rect x="{tx + tw - 12:.1f}" y="{top - th}" width="12" height="{th + 4}" fill="{sh}"/>'
        for c in range(int((tw - 30) // 30)):
            out += f'<rect x="{tx + 14 + c * 30:.1f}" y="{top - th + 12}" width="18" height="{th - 22}" rx="3" fill="{LIT_L}"/>'
    out += f'<rect x="{x}" y="{top}" width="{w}" height="{h + 2}" fill="{col}"/>'
    out += f'<rect x="{x + w - 16}" y="{top}" width="16" height="{h + 2}" fill="{sh}"/>'
    out += f'<rect x="{x - 6}" y="{top - 4}" width="{w + 12}" height="14" rx="4" fill="{dk}"/>'
    rnd = random.Random(rank * 11)
    cols, ww, wh, gx, gy = 4, 24, 16, 12, 14
    gx0 = x + (w - 16 - (cols * ww + (cols - 1) * gx)) / 2
    y0, yl = top + 26, base - 112
    r_ = 0
    while y0 + r_ * (wh + gy) + wh <= yl:
        for c in range(cols):
            dark = rnd.random() < .16
            out += f'<rect x="{gx0 + c * (ww + gx):.1f}" y="{y0 + r_ * (wh + gy)}" width="{ww}" height="{wh}" rx="3" fill="{sh if dark else LIT_L}"/>'
        r_ += 1
    out += f'<rect x="{x + (w - 16) / 2 - 22:.1f}" y="{base - 26}" width="44" height="26" rx="4" fill="{INK}"/>'
    mx, mw, my, mh = x - 10, w + 4, base - 100, 72
    out += f'<rect x="{mx}" y="{my}" width="{mw}" height="{mh}" rx="10" fill="{INK}"/>'
    out += bulbs(mx + 7, my + 7, mw - 14, mh - 14)
    return out, (mx + mw / 2, my + mh / 2), top - (tiers[1] if tiers else 0)

def model_c():
    base = 540
    w, gap = 176, 52
    hs = [330, 272, 216, 172]
    x_right = W / 2 + (4 * w + 3 * gap) / 2
    towers, over, refl = '', '', ''
    for k, t in enumerate(RANKED):
        x = x_right - (k + 1) * w - k * gap
        tw, (mcx, mcy), roof = front_tower(t, x, w, hs[k], base, k + 1)
        towers += tw
        over += (f'<div class="mc-mq" style="left:{mcx:.0f}px;top:{mcy:.0f}px"><span>{sym(t, 18, COLOR[t])}{NAME[t]}</span>'
                 f'<b>{house(22, GOLD)}{ar(POP[t])}</b></div>')
        if k == 0:
            over += f'<div class="mc-crown" style="left:{x + (w - 16) / 2:.0f}px;top:{roof - 62:.0f}px">{icon("crown", 64, GOLD)}</div>'
    beams = ''
    for bx, ang, op in ((990, -18, .2), (990, 15, .17), (300, 20, .12)):
        beams += (f'<g transform="rotate({ang} {bx} {base})"><path d="M{bx - 6} {base} L{bx + 6} {base} L{bx + 90} -60 L{bx - 90} -60 Z" fill="url(#beam)" opacity="{op / .16:.2f}"/></g>')
    defs = (f'<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E1830"/><stop offset="1" stop-color="#22355C"/></linearGradient>'
            f'<linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>'
            f'<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13213D" stop-opacity=".45"/><stop offset="1" stop-color="#0B1426" stop-opacity="1"/></linearGradient>'
            f'<clipPath id="wclip"><rect y="{base}" width="{W}" height="{H - base}"/></clipPath>')
    ripples = ''.join(f'<rect y="{y}" width="{W}" height="2" fill="#0B1426" opacity=".55"/>' for y in range(base + 4, H, 6))
    city_b = BG.far_city(y0=base, fill='#1A2A4A', win='#FFD166', seed=11, hmin=90, hmax=200, lit=.12)
    city_f = BG.far_city(y0=base, fill='#22355C', win='#FFD166', seed=4, hmin=40, hmax=130, lit=.2)
    scene = city_b + city_f + towers
    bg = (f'<rect width="{W}" height="{H}" fill="url(#sky)"/>{stars(90, 380, 3)}{beams}'
          f'{firework(1170, 150, 70, COLOR["blue"], 16, 2)}{firework(790, 150, 44, GOLD, 12, 5)}{firework(250, 210, 52, GOLD, 12, 7)}'
          f'{scene}<rect y="{base}" width="{W}" height="{H - base}" fill="#101B33"/>'
          f'<g clip-path="url(#wclip)"><g transform="translate(0 {2 * base}) scale(1 -1)" opacity=".34">{scene}</g>{ripples}'
          f'<rect y="{base}" width="{W}" height="{H - base}" fill="url(#water)"/></g>')
    return f'<div class="d dn mm">{svg(bg, defs)}{title()}{over}</div>'

CSS = '''
.mm .bg{position:absolute;inset:0}
.mt-t{position:absolute;top:26px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:16px;color:#fff;font-size:40px;font-weight:900;z-index:3;direction:rtl}
.ma-pop{position:absolute;transform:translate(-50%,-100%);display:flex;align-items:center;gap:8px;height:48px;padding:0 20px;border-radius:999px;background:#fff;z-index:3}
.ma-pop b{font-size:26px;font-weight:900;color:var(--ink)}
.ma-crown{position:absolute;transform:translateX(-50%);z-index:3}
.mb-crown{position:absolute;transform:translateX(-50%);z-index:3}
.mc-mq{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;z-index:3;white-space:nowrap}
.mc-mq span{display:flex;align-items:center;gap:6px;font-size:17px;font-weight:600;color:#C9D9EE}
.mc-mq b{display:flex;align-items:center;gap:6px;font-size:26px;font-weight:900;color:#fff;line-height:1.1}
.mc-crown{position:absolute;transform:translateX(-50%);z-index:3}
.ma-plate{position:absolute;transform:translateX(-50%);width:236px;height:58px;display:flex;align-items:center;gap:10px;padding:0 18px;border-radius:12px;z-index:3}
.ma-plate::after{content:"";position:absolute;inset:5px;border:2px solid var(--ink);border-radius:8px;opacity:.28}
.ma-plate b{font-size:26px;font-weight:900;color:var(--ink)}
.ma-ord{position:absolute;top:-13px;left:-13px;width:32px;height:32px;border-radius:16px;background:#fff;color:var(--ink);font-size:17px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px #13213D}
'''

MODELS = [('أبراج من قطع الرقعة', model_a), ('منصة واحدة تنزل درجاتها', model_b), ('ليلة الأضواء', model_c)]

if __name__ == '__main__':
    FONTS = ''.join('@font-face{font-family:"Alexandria";font-weight:%d;src:url(data:font/ttf;base64,%s) format("truetype")}' %
                    (w, base64.b64encode(open(os.path.join(BRAND, 'font', f), 'rb').read()).decode())
                    for w, f in [(400, 'Alexandria-400.ttf'), (600, 'Alexandria-600.ttf'), (900, 'Alexandria-Black.ttf')])
    css = open('screens.css').read() + SIGN_CSS + open('all.css').read() + CSS
    body = ''.join(f'<section class="pg pg-d"><div class="lbl"><span class="code">نموذج {"أبجد"[i]}</span>{name}</div>{fn()}</section>\n'
                   for i, (name, fn) in enumerate(MODELS))
    doc = ('<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n'
           '<title>نماذج عمدة الرقعة</title>\n<style>' + css + '</style>\n<style>' + FONTS + '</style>\n</head>\n<body>\n' + body +
           '<script>(function(){function f(){var w=document.documentElement.clientWidth;document.querySelectorAll(".pg").forEach(function(p){var z=Math.min(1,(w-32)/1280);p.style.zoom=z<1?z:""})}addEventListener("resize",f);f()})()</script>\n</body>\n</html>\n')
    open('raqaa-mayor-models.html', 'w').write(doc)
    print(len(MODELS), 'models', len(doc))
