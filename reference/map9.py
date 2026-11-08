# The Raqaa display map: 9x9, logo style (rounded iso tiles), buildings rise with plot value.
import math
from shapely.geometry import Polygon, box as sbox
from shapely.ops import unary_union
import icons as IC

N = 9
CO = math.cos(math.radians(45)); CE = math.cos(math.radians(55)); SE = math.sin(math.radians(55))
TEAM = {
    'coral': ('#FF6B57', '#C2412F', '#9E3424', '#13213D'),
    'blue':  ('#5C8DFF', '#3F6FE0', '#2F59C2', '#13213D'),
    'green': ('#22B573', '#178553', '#106640', '#13213D'),
    'gold':  ('#FFB400', '#C98A00', '#9C6B00', '#13213D'),
}
DAY = {
    'plate': ('#A9C7EE', '#7FA6D9', '#6F95CA'),
    'v2': ('#FFFFFF', '#C9D9EE', '#B3C6E2'),
    'v3': ('#EAF1FD', '#C3D5EE', '#ADC2E0'),
    'v4': ('#D4E3FA', '#B7CCEB', '#A2B9DD'),
    'tower': ('#22355C', '#13213D', '#0D182E'),
    'card_ink': '#13213D',
}
NIGHT = {
    'plate': ('#22355C', '#1A2A4A', '#15223D'),
    'v2': ('#2C4170', '#22355C', '#1A2A4A'),
    'v3': ('#30477A', '#22355C', '#1A2A4A'),
    'v4': ('#355083', '#22355C', '#1A2A4A'),
    'tower': ('#FFFFFF', '#C9D9EE', '#B3C6E2'),
    'card_ink': '#C9D9EE',
}
SYM = {  # 24-grid team symbols
    'coral': 'M12 3.5L21.5 20H2.5Z',
    'blue': 'M12 3a9 9 0 1 0 0.001 0Z',
    'green': 'M5.5 3.5H18.5A2 2 0 0 1 20.5 5.5V18.5A2 2 0 0 1 18.5 20.5H5.5A2 2 0 0 1 3.5 18.5V5.5A2 2 0 0 1 5.5 3.5Z',
    'gold': 'M12 2L22 12L12 22L2 12Z',
}
CARDS = {  # flat map (row from top, column from right) -> card kind
    (2, 3): 'fence', (2, 7): 'fence', (8, 3): 'fence', (8, 7): 'fence',
    (3, 2): 'crane', (3, 8): 'crane', (7, 2): 'crane', (7, 8): 'crane',
    (3, 5): 'bridge', (7, 5): 'bridge',
    (4, 5): 'plan', (6, 5): 'plan',
    (5, 4): 'inspector', (5, 6): 'inspector',
}
BASES = {(1, 1): 'coral', (1, 9): 'blue', (9, 1): 'green', (9, 9): 'gold'}

def rc_to_xy(r, c):
    return (9 - c, r - 1)

def value(x, y):
    ring = max(abs(x - 4), abs(y - 4))
    return {0: 5, 1: 4, 2: 3, 3: 2, 4: 2}[ring]

GAP, R_TILE, TH, STEP, MARGIN, PLATE_TH = 0.12, 0.13, 0.16, 0.17, 0.32, 0.22

def P(i, j, z, s):
    i -= N / 2; j -= N / 2
    return ((i - j) * CO * s, (i + j) * CO * CE * s - z * SE * s)

def _plan(x0, y0, x1, y1, r):
    g = sbox(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=5)
    return list(g.exterior.coords)[:-1]

def _d(geom):
    ps = [geom] if geom.geom_type == 'Polygon' else [g for g in geom.geoms if g.geom_type == 'Polygon']
    out = ''
    for p in ps:
        if p.is_empty or p.area < 1e-6: continue
        out += 'M' + ' L'.join(f'{a:.1f} {b:.1f}' for a, b in list(p.exterior.coords)[:-1]) + ' Z '
    return out.strip()

def rbox(x0, y0, x1, y1, z0, z1, pal, s, r):
    top, left, right = pal[:3]
    plan = _plan(x0, y0, x1, y1, r)
    T = Polygon([P(a, b, z1, s) for a, b in plan])
    body = ''
    if z1 > z0:
        Bt = Polygon([P(a, b, z0, s) for a, b in plan])
        side = unary_union([T, Bt]).convex_hull.difference(T.buffer(0.02))
        fx = P(x1, y1, z0, s)[0]
        big = 1e5
        L = side.intersection(Polygon([(-big, -big), (fx, -big), (fx, big), (-big, big)]))
        R = side.intersection(Polygon([(fx, -big), (big, -big), (big, big), (fx, big)]))
        if not L.is_empty: body += f'<path d="{_d(L)}" fill="{left}"/>'
        if not R.is_empty: body += f'<path d="{_d(R)}" fill="{right}"/>'
    body += f'<path d="{_d(T)}" fill="{top}"/>'
    return body

def decal(path_d, cx, cy, z, size, s, fill):
    """draw a 24-grid path flat on the roof at plan centre (cx, cy), upright toward the viewer"""
    k = size / 24.0
    # icon x -> plan direction (1,-1)/sqrt2 (screen right), icon y -> (1,1)/sqrt2 (screen down)
    rx, ry = (1 / math.sqrt(2), -1 / math.sqrt(2)), (1 / math.sqrt(2), 1 / math.sqrt(2))
    def scr(u, v):
        pi = cx + (u - 12) * k * rx[0] + (v - 12) * k * ry[0]
        pj = cy + (u - 12) * k * rx[1] + (v - 12) * k * ry[1]
        return P(pi, pj, z, s)
    o = scr(0, 0); a = scr(1, 0); b = scr(0, 1)
    m = (a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1])
    return f'<path transform="matrix({m[0]:.4f} {m[1]:.4f} {m[2]:.4f} {m[3]:.4f} {m[4]:.2f} {m[5]:.2f})" d="{path_d}" fill="{fill}"/>'

def card_decal(kind, cx, cy, z, size, s, fill):
    svg = IC.ICONS[kind]()
    k = size / 24.0
    rx, ry = (1 / math.sqrt(2), -1 / math.sqrt(2)), (1 / math.sqrt(2), 1 / math.sqrt(2))
    def scr(u, v):
        pi = cx + (u - 12) * k * rx[0] + (v - 12) * k * ry[0]
        pj = cy + (u - 12) * k * rx[1] + (v - 12) * k * ry[1]
        return P(pi, pj, z, s)
    o = scr(0, 0); a = scr(1, 0); b = scr(0, 1)
    m = (a[0] - o[0], a[1] - o[1], b[0] - o[0], b[1] - o[1], o[0], o[1])
    return f'<g transform="matrix({m[0]:.4f} {m[1]:.4f} {m[2]:.4f} {m[3]:.4f} {m[4]:.2f} {m[5]:.2f})" style="color:{fill}">{svg}</g>'

def render(owners=None, cards_taken=(), s=48, night=False, tower_owner=None, drop=None, highlight=None, dim=None, show_cards=True):
    """owners: {(r, c): team}; drop: (r, c, team, lift) a block about to land; highlight: {(r, c): style}"""
    pal = NIGHT if night else DAY
    owners = dict(owners or {})
    for rc, t in BASES.items():
        owners.setdefault(rc, t)
    out = []
    m = MARGIN
    out.append(rbox(-m, -m, N + m, N + m, -PLATE_TH, 0, pal['plate'], s, 0.35))
    cells = sorted(((x, y) for x in range(N) for y in range(N)), key=lambda t: t[0] + t[1])
    g = GAP / 2
    drop_xy = rc_to_xy(*drop[:2]) if drop else None
    for (x, y) in cells:
        r, c = y + 1, 9 - x
        x0, y0, x1, y1 = x + g, y + g, x + 1 - g, y + 1 - g
        v = value(x, y)
        team = owners.get((r, c))
        cx, cy = x + 0.5, y + 0.5
        if (r, c) == (5, 5):
            # the centre is a flat plot in its own colour until a neighbourhood takes it
            t = tower_owner
            if t:
                h = TH + 5 * STEP
                out.append(rbox(x0, y0, x1, y1, 0, h, TEAM[t], s, R_TILE))
                out.append(decal(SYM[t], cx, cy, h, 0.42, s, TEAM[t][3]))
            else:
                out.append(rbox(x0, y0, x1, y1, 0, TH, pal['tower'], s, R_TILE))
        elif team:
            base = (r, c) in BASES
            h = TH + (1 if base else v) * STEP
            out.append(rbox(x0, y0, x1, y1, 0, h, TEAM[team], s, R_TILE))
            out.append(decal(SYM[team], cx, cy, h, 0.40, s, TEAM[team][3]))
        else:
            key = 'v4' if v == 4 else 'v3' if v == 3 else 'v2'
            out.append(rbox(x0, y0, x1, y1, 0, TH, pal[key], s, R_TILE))
            if show_cards and (r, c) in CARDS and (r, c) not in cards_taken:
                out.append(card_decal(CARDS[(r, c)], cx, cy, TH, 0.56, s, pal['card_ink']))
        if highlight and (r, c) in highlight:
            col = highlight[(r, c)]
            # a ring painted on the ground around the plot, clear of the building
            outer = Polygon([P(a, b, 0.001, s) for a, b in _plan(x - 0.16, y - 0.16, x + 1.16, y + 1.16, R_TILE + 0.16)])
            inner = Polygon([P(a, b, 0.001, s) for a, b in _plan(x - 0.04, y - 0.04, x + 1.04, y + 1.04, R_TILE + 0.04)])
            out.insert(-1 if out else 0, f'<path class="hl" d="{_d(outer.difference(inner))}" fill="{col}"/>')
        if drop_xy and (x, y) == drop_xy:
            team_d, lift = drop[2], drop[3]
            v2 = value(x, y)
            h = (1 if (r, c) in BASES else v2) * STEP + TH
            out.append(f'<g class="drop">{rbox(x0, y0, x1, y1, lift, lift + h, TEAM[team_d], s, R_TILE)}{decal(SYM[team_d], cx, cy, lift + h, 0.40, s, TEAM[team_d][3])}</g>')
    # bounds
    pts = [P(a, b, z, s) for a in (-m, N + m) for b in (-m, N + m) for z in (-PLATE_TH, TH + 5 * STEP)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return ''.join(out), (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))

def plot_top_center(r, c, s, team=None):
    x, y = rc_to_xy(r, c)
    v = value(x, y)
    h = TH + (v * STEP if team else 0)
    return P(x + 0.5, y + 0.5, h, s)
