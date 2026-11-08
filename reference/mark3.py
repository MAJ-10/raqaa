# «قطعة تُبنى» mark: 3x3 map at the display angle, four neighbourhood corners, the tower in the centre,
# and a coral block coming down into the empty plot next to its neighbourhood.
import math, sys
sys.path.insert(0, '.')
from text import shape_path

INK = '#13213D'
T = {
    'blue':  ('#5C8DFF', '#3F6FE0', '#2F59C2'),
    'coral': ('#FF6B57', '#C2412F', '#9E3424'),
    'gold':  ('#FFB400', '#C98A00', '#9C6B00'),
    'green': ('#22B573', '#178553', '#106640'),
    'white': ('#FFFFFF', '#C9D9EE', '#B3C6E2'),
    'tower': ('#22355C', '#13213D', '#0D182E'),
    'plate': ('#A9C7EE', '#7FA6D9', '#6F95CA'),
    'slot':  ('#7FA6D9', '#7FA6D9', '#7FA6D9'),
}
T_NIGHT = dict(T)
T_NIGHT.update({'white': ('#2C4170', '#22355C', '#1A2A4A'), 'tower': ('#FFFFFF', '#C9D9EE', '#B3C6E2'),
                'plate': ('#22355C', '#1A2A4A', '#15223D'), 'slot': ('#3A5288', '#3A5288', '#3A5288')})
N = 3
GRID = {(0, 0): 'blue', (2, 0): 'coral', (0, 2): 'gold', (2, 2): 'green',
        (1, 0): 'slot', (0, 1): 'white', (2, 1): 'white', (1, 2): 'white', (1, 1): 'tower'}
GAP = 0.10          # between tiles (fraction of a cell)
TH = 0.20           # tile thickness
R_TILE = 0.13       # tile corner radius
R_CUBE = 0.10       # cube corner radius
R_PLATE = 0.22      # plate corner radius
CUBE = 0.61         # tower / block height (cells)
DROP = 1.05         # how high the coral block floats above its plot

def P(i, j, z, s=100):
    i -= N / 2; j -= N / 2
    c = math.cos(math.radians(45))
    return ((i - j) * c * s, (i + j) * c * math.cos(math.radians(55)) * s - z * math.sin(math.radians(55)) * s)

def poly(pts):
    return 'M' + ' L'.join(f'{a:.2f} {b:.2f}' for a, b in pts) + ' Z'

from shapely.geometry import Polygon as _Poly, box as _sbox
from shapely.ops import unary_union as _union

def _rounded_plan(x0, y0, x1, y1, r):
    if r <= 0:
        return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    g = _sbox(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=6)
    return list(g.exterior.coords)[:-1]

def _d(geom):
    polys = [geom] if geom.geom_type == 'Polygon' else [g for g in geom.geoms if g.geom_type == 'Polygon']
    out = ''
    for p in polys:
        if p.is_empty or p.area < 1e-6: continue
        out += 'M' + ' L'.join(f'{a:.2f} {b:.2f}' for a, b in list(p.exterior.coords)[:-1]) + ' Z '
    return out.strip()

def rbox(x0, y0, x1, y1, z0, z1, pal, s, r=0.0, cls=''):
    top, left, right = pal
    plan = _rounded_plan(x0, y0, x1, y1, r)
    T = _Poly([P(a, b, z1, s) for a, b in plan])
    body = ''
    if z1 > z0:
        B = _Poly([P(a, b, z0, s) for a, b in plan])
        hull = _union([T, B]).convex_hull
        side = hull.difference(T.buffer(0.01))
        fx = P(x1, y1, z0, s)[0]
        big = 1e5
        L = side.intersection(_Poly([(-big, -big), (fx, -big), (fx, big), (-big, big)]))
        R = side.intersection(_Poly([(fx, -big), (big, -big), (big, big), (fx, big)]))
        if not L.is_empty: body += f'<path d="{_d(L)}" fill="{left}"/>'
        if not R.is_empty: body += f'<path d="{_d(R)}" fill="{right}"/>'
    body += f'<path d="{_d(T)}" fill="{top}"/>'
    return f'<g class="{cls}">{body}</g>' if cls else body

def box(x0, y0, x1, y1, z0, z1, pal, s, cls=''):
    top, left, right = pal
    Tp = [P(x0, y0, z1, s), P(x1, y0, z1, s), P(x1, y1, z1, s), P(x0, y1, z1, s)]
    R = [P(x1, y0, z0, s), P(x1, y1, z0, s), P(x1, y1, z1, s), P(x1, y0, z1, s)]
    L = [P(x0, y1, z0, s), P(x1, y1, z0, s), P(x1, y1, z1, s), P(x0, y1, z1, s)]
    body = ''
    if z1 > z0:
        body += f'<path d="{poly(L)}" fill="{left}"/><path d="{poly(R)}" fill="{right}"/>'
    body += f'<path d="{poly(Tp)}" fill="{top}"/>'
    return f'<g class="{cls}">{body}</g>' if cls else body

def _drop(pal, s, anim, pts):
    g = GAP / 2
    x0, y0, x1, y1 = 1 + g, 0 + g, 2 - g, 1 - g
    pts.append(P(x0, y0, DROP + CUBE, s)); pts.append(P(x1, y0, DROP + CUBE, s))
    return rbox(x0, y0, x1, y1, DROP, DROP + CUBE, pal['coral'], s, R_CUBE, 'rq-drop' if anim else '')

def drop_distance(s=100):
    return DROP * math.sin(math.radians(55)) * s

def mark(s=100, night=False, plate=None, anim=False, rounded=False):
    """plate: None (no plate) or (margin, thickness) in cells"""
    pal = T_NIGHT if night else T
    out = []
    pts = []
    if plate:
        m, th = plate
        out.append(rbox(-m, -m, N + m, N + m, -th, 0, pal['plate'], s, R_PLATE, 'rq-plate' if anim else ''))
        for (i, j) in [(-m, -m), (N + m, -m), (N + m, N + m), (-m, N + m)]:
            for z in (-th, 0): pts.append(P(i, j, z, s))
    g = GAP / 2
    order = sorted(GRID.items(), key=lambda kv: (kv[0][0] + kv[0][1]))
    drop_done = False
    for (i, j), k in order:
        x0, y0, x1, y1 = i + g, j + g, i + 1 - g, j + 1 - g
        if k == 'tower' and not drop_done:
            out.append(_drop(pal, s, anim, pts)); drop_done = True
        if k == 'tower':
            out.append(rbox(x0, y0, x1, y1, 0, CUBE, pal['tower'], s, R_CUBE, 'rq-tower' if anim else ''))
            pts += [P(x0, y0, CUBE, s)]
        elif k == 'slot':
            out.append(rbox(x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, 0, 0.0, pal['slot'], s, R_TILE, 'rq-slot' if anim else ''))
        else:
            out.append(rbox(x0, y0, x1, y1, 0, TH, pal[k], s, R_TILE, f'rq-{k}' if anim else ''))
        for (a, b) in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]:
            pts.append(P(a, b, 0, s)); pts.append(P(a, b, TH, s))
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return ''.join(out), (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

NAME_FONT = 'font/Alexandria-Black.ttf'

def lockup(slogan=None, ink=INK, sub=None, night=False, plate=None, s=100, name_ratio=0.62, gap_ratio=0.30, slogan_gap=0.16, slogan_font='font/Alexandria-400.ttf', anim=False):
    """icon on the right, name on its left, slogan under the name spanning exactly the name's width"""
    mb, (mx, my, mw, mh) = mark(s=s, night=night, plate=plate, anim=anim)
    nd, nw = shape_path('رقعة', NAME_FONT)
    # name sizing: name body (x-height 0..-547 in font units) relative to the icon height
    k = mh * name_ratio / 1000.0          # font units -> px (1000 upm ~ cap+desc span)
    name_w = nw * k
    gap = mw * gap_ratio
    name_x = mx - gap - name_w
    # vertical: block (name + slogan) centred on the icon
    body_h = 547 * k
    if slogan:
        from text import shape_bounds
        sd, sw = shape_path(slogan, slogan_font)
        ks = name_w / sw
        sb0 = shape_bounds(slogan, slogan_font)
        sl_h = (sb0[3] - sb0[1]) * ks
        block = body_h + 300 * k + slogan_gap * body_h * 0.35 + sl_h
    else:
        block = body_h
    cy = my + mh / 2
    name_base = cy - block / 2 + body_h
    out = f'<g class="rq-name" transform="translate({name_x:.2f} {name_base:.2f}) scale({k:.5f})"><path d="{nd}" fill="{ink}"/></g>'
    miny = name_base - 900 * k; maxy = name_base + 300 * k
    if slogan:
        from text import shape_bounds
        sb = shape_bounds(slogan, slogan_font)
        sl_top = name_base + 300 * k + slogan_gap * body_h * 0.35
        sl_base = sl_top + sb[3] * ks
        out += f'<g class="rq-slogan" transform="translate({name_x:.2f} {sl_base:.2f}) scale({ks:.5f})"><path d="{sd}" fill="{sub or ink}"/></g>'
        maxy = max(maxy, sl_base - sb[1] * ks)
    out += mb
    minx = name_x; maxx = mx + mw
    miny = min(miny, my); maxy = max(maxy, my + mh)
    return out, (minx, miny, maxx - minx, maxy - miny)
