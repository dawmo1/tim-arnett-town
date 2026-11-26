# Colona signature models -> assets/models/regions/colona/<name>.glb (sources: assets/src/regions/colona/<name>.blend).
# Background Blender only (never the shared UI window):
#   Blender -b --factory-startup -P assets/src/regions/colona/colona.py -- rockbridge greenbridge lock29 lock28
# Uses the landmark kit (assets/src/landmarks.py: Kit, finish, lin...). Conventions as there: Blender X = game x,
# Blender -Y = game z, Z up; the models are placed with y: 0 in src/regions/colona.js, so Blender Z = game height.
# References and sources: docs/regions/colona.md.
#
# The two IL 84 bridges follow the deck profile the game draws from data/roads (edge node heights + e.rise), so if the
# map build changes the bridge heights, re-run this script and the piers/girders follow.
import bpy, sys, json, glob, math
ROOT = __import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + ''
exec(open(ROOT + 'assets/src/landmarks.py').read(), globals())
from mathutils import Vector

SRC = ROOT + 'assets/src/regions/colona/'
LOUT = ROOT + 'assets/models/regions/colona/'
SHOT = '/private/tmp/claude-501/-Users-dainmoens-Documents-Tim-Arnett-Town/392d4b1d-feae-4f8b-b8db-07c7ac05def9/scratchpad/colona/'

CONC, CONC2, CAP = lin('#b8b3a7'), lin('#9f9a8f'), lin('#cbc6ba')
STEEL = lin('#6c7880')     # painted box girders (colour unverified: IDOT grey)
BEAM = lin('#5f6e63')      # older stringers, grey-green (unverified)
WATER_Y = -0.15


# ---------------------------------------------------------------- road data
def bridge_edges(ref, box):
    """the bridge edges of `ref` whose points fall in box [x0, z0, x1, z1], as dicts with a y(s) deck profile"""
    nodes, out = {}, []
    for f in glob.glob(ROOT + 'data/roads/*.json'):
        d = json.load(open(f))
        n = d['n']
        for i in range(0, len(n), 6):
            nodes[n[i]] = n[i + 3]
        for e in d['e']:
            if e[8] and e[12] == ref:
                p = e[10]
                if all(box[0] <= p[i] <= box[2] and box[1] <= p[i + 1] <= box[3] for i in range(0, len(p), 2)):
                    out.append(e)
    res = []
    for e in out:
        pts = [(e[10][i], e[10][i + 1]) for i in range(0, len(e[10]), 2)]
        cum = [0]
        for i in range(1, len(pts)):
            cum.append(cum[-1] + math.dist(pts[i], pts[i - 1]))
        ya, yb, rise = nodes[e[1]], nodes[e[2]], e[15] if len(e) > 15 else 0
        res.append({'pts': pts, 'cum': cum, 'len': cum[-1], 'ya': ya, 'yb': yb, 'rise': rise or 0, 'w': e[9]})
    return res


def pose(E, s):
    """game (x, z), unit tangent (ux, uz) and deck height at arc length s (src/city/data.js edgeY)"""
    s = max(0.0, min(E['len'], s))
    P, C = E['pts'], E['cum']
    i = 1
    while i < len(P) - 1 and C[i] < s:
        i += 1
    seg = C[i] - C[i - 1] or 1
    f = (s - C[i - 1]) / seg
    x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f
    z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f
    ux, uz = (P[i][0] - P[i - 1][0]) / seg, (P[i][1] - P[i - 1][1]) / seg
    k = s / E['len']
    y = E['ya'] + (E['yb'] - E['ya']) * k * k * (3 - 2 * k) + E['rise'] * 4 * k * (1 - k)
    return x, z, ux, uz, y


def qo(K, pts, out, col, m=BODY):
    """quad facing the `out` direction"""
    pts = [Vector(p) for p in pts]
    fc = sum(pts, Vector()) / len(pts)
    K.oface(pts, fc - Vector(out), col, m)


def sweep(K, E, G, o0, o1, top, bot, col, side=None, step=6.0, s0=0.0, s1=None, faces=('t', 'b', 'i', 'o'), botcol=None):
    """a strip along edge E between lateral offsets o0 < o1 (along the game normal (-uz, ux)), from deck-relative
    heights bot..top; faces: t top, b bottom, i the side at o0, o the side at o1"""
    s1 = E['len'] if s1 is None else s1
    n = max(1, int(math.ceil((s1 - s0) / step)))
    prev = None
    for k in range(n + 1):
        s = s0 + (s1 - s0) * k / n
        x, z, ux, uz, y = pose(E, s)
        nx, nz = -uz, ux
        ring = {}
        for tag, o in (('0', o0), ('1', o1)):
            bx, by = G(x + nx * o, z + nz * o)
            ring[tag + 't'] = (bx, by, y + top)
            ring[tag + 'b'] = (bx, by, y + bot)
        if prev:
            nb = Vector((*G(x + nx, z + nz), 0)) - Vector((*G(x, z), 0))  # +offset direction in Blender
            if 't' in faces:
                qo(K, [prev['0t'], prev['1t'], ring['1t'], ring['0t']], (0, 0, 1), col)
            if 'b' in faces:
                qo(K, [prev['0b'], prev['1b'], ring['1b'], ring['0b']], (0, 0, -1), botcol or scale(col, 0.8))
            if 'i' in faces:
                qo(K, [prev['0b'], prev['0t'], ring['0t'], ring['0b']], -nb, scale(col, 0.92))
            if 'o' in faces:
                qo(K, [prev['1b'], prev['1t'], ring['1t'], ring['1b']], nb, scale(col, 0.92))
        prev = ring
    return prev


def endcap(K, E, G, s, o0, o1, top, bot, col, out):
    x, z, ux, uz, y = pose(E, s)
    nx, nz = -uz, ux
    a, b = G(x + nx * o0, z + nz * o0), G(x + nx * o1, z + nz * o1)
    d = Vector((*G(x + ux * out, z + uz * out), 0)) - Vector((*G(x, z), 0))
    qo(K, [(*a, y + bot), (*b, y + bot), (*b, y + top), (*a, y + top)], d, col)


def pier(K, E, G, s, o_c, half_w, thick, ytop, col, cap_w, cap_d=1.4, round_ends=True):
    """hammerhead pier under edge E at arc s, centred at lateral offset o_c: a column with rounded ends from the river
    bed to a cap 2*cap_w wide whose top is ytop"""
    x, z, ux, uz, y = pose(E, s)
    nx, nz = -uz, ux
    cx, cz = x + nx * o_c, z + nz * o_c
    # column footprint: stadium shape, long axis across the bridge
    pts = []
    r = thick / 2
    for side in (1, -1):
        ox = side * (half_w - r)
        for k in range(5):
            t = -math.pi / 2 + math.pi * k / 4
            al, ac = r * math.sin(t) * side, ox + r * math.cos(t) * side
            pts.append(G(cx + ux * al + nx * ac, cz + uz * al + nz * ac))
    K.prism(ccw(pts), -3.5, ytop - cap_d, col, top=False)
    # cap: tapered hammerhead
    c = []
    for (al, ac) in ((-r - 0.3, -cap_w), (r + 0.3, -cap_w), (r + 0.3, cap_w), (-r - 0.3, cap_w)):
        c.append(G(cx + ux * al + nx * ac, cz + uz * al + nz * ac))
    K.prism(ccw(c), ytop - cap_d * 0.45, ytop, CAP, top=True)
    lo = []
    for (al, ac) in ((-r - 0.3, -half_w), (r + 0.3, -half_w), (r + 0.3, half_w), (-r - 0.3, half_w)):
        lo.append(G(cx + ux * al + nx * ac, cz + uz * al + nz * ac))
    # sloped underside from the column to the cap ends
    c, lo = ccw(c), ccw(lo)
    zc, zl = ytop - cap_d * 0.45, ytop - cap_d
    for i in range(4):
        j = (i + 1) % 4
        K.face([(*lo[i], zl), (*lo[j], zl), (*c[j], zc), (*c[i], zc)], scale(CAP, 0.85))
    return cx, cz


# ---------------------------------------------------------------- IL 84 over the Rock River (1981)
# NBI 037012800000000: steel continuous box beam, 6 main spans, max span 53.6 m, 299.9 m long, deck 28.4 m, 4 lanes.
# The game has it as two one-way carriageways (8.4 m each, centrelines ~13.6 m apart).
def rockbridge(render=True):
    Es = bridge_edges('IL 84', [16800, 4350, 17250, 4480])
    assert len(Es) == 2, len(Es)
    allp = [p for E in Es for p in E['pts']]
    anchor = (round(sum(p[0] for p in allp) / len(allp), 1), round(sum(p[1] for p in allp) / len(allp), 1))
    G = g2l(anchor)
    K, K1 = Kit(8401, ao=0), Kit(8402, ao=0)
    spans = [44, 52, 53.6, 53.6, 52, 46]
    tot = sum(spans)
    piers = []
    for E in Es:
        # which side is the other carriageway: offsets toward it are the median side
        x, z, ux, uz, y = pose(E, E['len'] / 2)
        o = Es[1] if E is Es[0] else Es[0]
        ox, oz, *_ = pose(o, o['len'] / 2)
        sgn = 1 if ((ox - x) * -uz + (oz - z) * ux) > 0 else -1  # +offset points to the median
        gap = abs((ox - x) * -uz + (oz - z) * ux)
        hw = E['w'] / 2
        med, outer = gap / 2, -(hw + 3.0)  # slab to the median centreline; 3 m shoulder/walk outside
        lo, hi = (outer, med) if sgn > 0 else (-med, -outer)
        # slab (top 5 cm under the road surface), fascia, parapet on the outside, half the median barrier
        sweep(K, E, G, lo, hi, -0.05, -0.85, CONC, faces=('t', 'b', 'i', 'o'), botcol=CONC2)
        po = (outer, outer + 0.45) if sgn > 0 else (-outer - 0.45, -outer)
        sweep(K, E, G, po[0], po[1], 0.9, -0.05, CAP, faces=('t', 'i', 'o'))
        mo = (med - 0.3, med) if sgn > 0 else (-med, -med + 0.3)
        sweep(K, E, G, mo[0], mo[1], 0.8, -0.05, CAP, faces=('t', 'i', 'o'))
        for s in (0.0, E['len']):
            endcap(K, E, G, s, lo, hi, -0.05, -0.85, CONC2, -1 if s == 0 else 1)
        # two steel box girders per carriageway, 2.6 m deep
        for gc in (-3.2, 3.2):
            g0, g1 = gc - 1.25, gc + 1.25
            sweep(K, E, G, g0, g1, -0.85, -3.45, STEEL, faces=('b', 'i', 'o'), botcol=scale(STEEL, 0.75))
            for s in (0.0, E['len']):
                endcap(K, E, G, s, g0, g1, -0.85, -3.45, scale(STEEL, 0.8), -1 if s == 0 else 1)
        # LOD1: slab + one girder block
        sweep(K1, E, G, lo, hi, -0.05, -3.4, CONC, step=25, faces=('t', 'b', 'i', 'o'))
        # piers (5) at the span joints, hammerheads under each carriageway
        acc = 0
        for sp in spans[:-1]:
            acc += sp
            s = acc / tot * E['len']
            x, z, ux, uz, y = pose(E, s)
            cx, cz = pier(K, E, G, s, 0.0, 3.6, 2.0, y - 3.45, CONC, 6.0, 1.6)
            pier(K1, E, G, s, 0.0, 3.6, 2.0, y - 3.45, CONC, 6.0, 1.6)
            piers.append((round(cx, 1), round(cz, 1), round(y - 3.45 - 1.6, 1), math.atan2(-uz, ux)))
    lod0, lod1 = K.obj('rockbridge_lod0'), K1.obj('rockbridge_lod1')
    res = finish('rockbridge', [lod0, lod1], anchor)
    res['piers'] = piers
    if render:
        res['png'] = snap('rockbridge', (0, 0, 8), 230, lod1, ((150, 8), (20, 25)))
    return res


B['rockbridge'] = rockbridge


# ---------------------------------------------------------------- IL 84 / 1st Street over the Green River (1936, rebuilt 1993)
# NBI 037008000000000: steel continuous stringer / multi-beam, 4 main spans (max 21.9 m), 76.8 m long, deck 13.2 m, 2 lanes.
def greenbridge(render=True):
    Es = bridge_edges('IL 84', [18290, 6500, 18360, 6660])
    assert len(Es) == 1, len(Es)
    E = Es[0]
    anchor = tuple(round(v, 1) for v in pose(E, E['len'] / 2)[:2])
    G = g2l(anchor)
    K, K1 = Kit(8403, ao=0), Kit(8404, ao=0)
    hw = 6.6  # half the 13.2 m deck
    sweep(K, E, G, -hw, hw, -0.05, -0.6, CONC, step=3, botcol=CONC2)
    for sgn in (-1, 1):  # open concrete rail: a base curb, posts, top rail (1930s style, unverified for 1993 rebuild)
        a, b = (hw - 0.4, hw) if sgn > 0 else (-hw, -hw + 0.4)
        sweep(K, E, G, a, b, 0.35, -0.05, CAP, step=3, faces=('t', 'i', 'o'))
        sweep(K, E, G, a + 0.05, b - 0.05, 1.05, 0.85, CAP, step=3, faces=('t', 'b', 'i', 'o'))
        n = int(E['len'] / 2.4)
        for k in range(n + 1):
            s = E['len'] * k / n
            x, z, ux, uz, y = pose(E, s)
            nx, nz = -uz, ux
            o = (a + b) / 2
            cx, cz = x + nx * o, z + nz * o
            pts = [G(cx + ux * da + nx * dc, cz + uz * da + nz * dc) for da, dc in ((-0.15, -0.15), (0.15, -0.15), (0.15, 0.15), (-0.15, 0.15))]
            K.prism(ccw(pts), y + 0.3, y + 0.86, CAP, top=False)
    for s in (0.0, E['len']):
        endcap(K, E, G, s, -hw, hw, -0.05, -0.6, CONC2, -1 if s == 0 else 1)
    for gc in (-5.2, -2.6, 0.0, 2.6, 5.2):  # five rolled stringers, 1.0 m deep
        sweep(K, E, G, gc - 0.22, gc + 0.22, -0.6, -1.6, BEAM, step=3, faces=('b', 'i', 'o'))
    sweep(K1, E, G, -hw, hw, -0.05, -1.6, CONC, step=10)
    piers = []
    for k in (1, 2, 3):
        s = E['len'] * k / 4
        x, z, ux, uz, y = pose(E, s)
        cx, cz = pier(K, E, G, s, 0.0, 5.6, 1.1, y - 1.6, CONC, 6.6, 0.9)
        pier(K1, E, G, s, 0.0, 5.6, 1.1, y - 1.6, CONC, 6.6, 0.9)
        piers.append((round(cx, 1), round(cz, 1), round(y - 1.6 - 0.9, 1), math.atan2(-uz, ux)))
    lod0, lod1 = K.obj('greenbridge_lod0'), K1.obj('greenbridge_lod1')
    res = finish('greenbridge', [lod0, lod1], anchor)
    res['piers'] = piers
    if render:
        res['png'] = snap('greenbridge', (0, 0, 6), 90, lod1, ((100, 6), (200, 25)))
    return res


B['greenbridge'] = greenbridge


# ---------------------------------------------------------------- Hennepin Canal locks 28 and 29 (concrete, 1890s-1907)
# 170 x 35 ft chambers (52 x 10.7 m), the first US canal built of concrete without cut-stone facing; most gates were
# later replaced by concrete walls, so water spills over them as a small falls. Lock 29 is the last lock, where the
# canal drops into the Rock River (city park + boat launch beside it).
def lock(name, up, down, seed, wall_top=2.4):
    anchor = (round((up[0] + down[0]) / 2, 1), round((up[1] + down[1]) / 2, 1))
    G = g2l(anchor)
    L = math.dist(up, down)
    ux, uz = (down[0] - up[0]) / L, (down[1] - up[1]) / L
    nx, nz = -uz, ux
    P = lambda a, c: G(anchor[0] + ux * a + nx * c, anchor[1] + uz * a + nz * c)  # a along (toward the river), c across
    K, K1 = Kit(seed, ao=0), Kit(seed + 1, ao=0)
    hw, t, h = 5.35, 2.0, L / 2
    for sgn in (-1, 1):
        c0, c1 = sgn * hw, sgn * (hw + t)
        K.prism(ccw([P(-h, c0), P(h, c0), P(h, c1), P(-h, c1)]), -3.5, wall_top - 0.25, CONC, top=False)
        K.prism(ccw([P(-h - 0.1, c0 - sgn * 0.12), P(h + 0.1, c0 - sgn * 0.12), P(h + 0.1, c1 + sgn * 0.1), P(-h - 0.1, c1 + sgn * 0.1)]), wall_top - 0.25, wall_top, CAP)
        # gate recesses near each end (dark slots in the chamber face) and stained water line
        for a in (-h + 6.5, h - 7.5):
            qo(K, [(*P(a, c0 - sgn * 0.02), -1.0), (*P(a + 1.2, c0 - sgn * 0.02), -1.0), (*P(a + 1.2, c0 - sgn * 0.02), wall_top - 0.3), (*P(a, c0 - sgn * 0.02), wall_top - 0.3)],
               (*[v * -sgn for v in (Vector((*P(0, 1), 0)) - Vector((*P(0, 0), 0)))[:2]], 0), lin('#6f6b62'))
        qo(K, [(*P(-h, c0 - sgn * 0.015), WATER_Y), (*P(h, c0 - sgn * 0.015), WATER_Y), (*P(h, c0 - sgn * 0.015), WATER_Y + 0.9), (*P(-h, c0 - sgn * 0.015), WATER_Y + 0.9)],
           (*[v * -sgn for v in (Vector((*P(0, 1), 0)) - Vector((*P(0, 0), 0)))[:2]], 0), lin('#77736a'))
        # wing walls flaring out at both ends
        for end in (-1, 1):
            a0 = end * h
            a1 = a0 + end * 6.0
            K.prism(ccw([P(a0, c0 + sgn * 0.0), P(a1, c0 + sgn * 4.0), P(a1, c0 + sgn * 5.6), P(a0, c1)]), -3.5, wall_top - 0.6, CONC2, topcol=CAP)
        # pipe railing on the outer edge of each wall
        cr = sgn * (hw + t - 0.25)
        n = int(L / 3)
        for k in range(n + 1):
            a = -h + L * k / n
            K.rod((*P(a, cr), wall_top), (*P(a, cr), wall_top + 1.05), 0.04, lin('#3b4440'))
        K.rod((*P(-h, cr), wall_top + 1.05), (*P(h, cr), wall_top + 1.05), 0.035, lin('#3b4440'), seg=4)
        K.rod((*P(-h, cr), wall_top + 0.55), (*P(h, cr), wall_top + 0.55), 0.03, lin('#3b4440'), seg=4)
        # mooring bollards on the coping
        for a in (-h + 3, 0, h - 3):
            K.cyl(*P(a, sgn * (hw + 0.5)), 0.22, wall_top, wall_top + 0.55, lin('#2f3431'), BODY, 8)
        # LOD1
        K1.prism(ccw([P(-h, c0), P(h, c0), P(h, c1), P(-h, c1)]), -3.5, wall_top, CONC, topcol=CAP)
    # the upstream gate replaced by a concrete wall: water spills over it into the chamber
    a0 = -h + 6.0
    K.prism(ccw([P(a0 - 1.2, -hw), P(a0, -hw), P(a0, hw), P(a0 - 1.2, hw)]), -3.5, WATER_Y + 0.55, CONC2, topcol=CAP)
    foam, fall = lin('#e8f1f2'), lin('#b9d3da')
    for i, (da, z0, z1, col) in enumerate(((0.0, WATER_Y + 0.55, WATER_Y + 0.05, fall), (0.6, WATER_Y + 0.05, WATER_Y + 0.02, foam))):
        qo(K, [(*P(a0 + da, -hw), z0), (*P(a0 + da, hw), z0), (*P(a0 + da + 0.6, hw), z1), (*P(a0 + da + 0.6, -hw), z1)], (0, 0, 1), col)
    qo(K, [(*P(a0 + 1.2, -hw), WATER_Y + 0.025), (*P(a0 + 1.2, hw), WATER_Y + 0.025), (*P(a0 + 4.5, hw), WATER_Y + 0.02), (*P(a0 + 4.5, -hw), WATER_Y + 0.02)], (0, 0, 1), lin('#9fbfc8'))
    K1.prism(ccw([P(a0 - 1.2, -hw), P(a0, -hw), P(a0, hw), P(a0 - 1.2, hw)]), -3.5, WATER_Y + 0.55, CONC2)
    # the lock number cast in the downstream end of the north wall coping (raised letters)
    num = name.replace('lock', '')
    for sgn in (-1, 1):
        cface = sgn * (hw + t)
        Lf = lambda u, hh, d, s=sgn: (*P(h - 8 + u * s, cface + d * s), hh)
        K.text('LOCK ' + num, Lf, 0, wall_top - 1.15, 0.03, 0.7, lin('#8e897e'), BODY, 0.05, res=1)
    lod0, lod1 = K.obj(name + '_lod0'), K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], anchor)
    a = math.atan2(-uz, ux)
    res['solid'] = [[round(anchor[0] + nx * sgn * (hw + t / 2), 1), round(anchor[1] + nz * sgn * (hw + t / 2), 1), round(h, 1), round(t / 2, 1), wall_top, 0, round(a, 4)] for sgn in (-1, 1)]
    return res


def lock29(render=True):  # OSM way 1052166659 (Lock Number 29), east (upstream) end first
    r = lock('lock29', (15666.4, 5818.6), (15601.9, 5811.9), 2901)
    if render:
        r['png'] = snap('lock29', (0, 0, 0), 60, None, ((210, 30), (30, 20)))
    return r


def lock28(render=True):  # OSM way 1052166663 (Lock Number 28): the canal falls toward the south-west here
    r = lock('lock28', (19133.5, 4652.6), (19090.2, 4706.6), 2801, wall_top=2.7)
    if render:
        r['png'] = snap('lock28', (0, 0, 0), 60, None, ((210, 30), (30, 20)))
    return r


B['lock29'] = lock29
B['lock28'] = lock28


# ---------------------------------------------------------------- BI-STATE SPORTSMAN'S (571 Cleveland Rd)
# Shotgun club on the bluff north of Cleveland Road: 4 skeet fields in a row (3 of them combination fields with a trap
# house at station 8), a 5-stand, the green-roofed clubhouse flanked by two covered pavilions, a gravel lot and the
# gravel drive up the hill from Cleveland Road. Everything shoots east into the OSM shooting_range hazard (w941111529).
# Positions traced from Esri World Imagery (z17/z18); field geometry from the ATA / NSSA standards. Heights: the game's
# own terrain grid, sampled by the node helper into bistate_terrain.json (8 m grid, bilinear like data.js).
TER = None


def T(x, z):
    """game terrain height (src/city/data.js terrainHeight) from the sampled 8 m grid"""
    global TER
    if TER is None:
        TER = json.load(open(SRC + 'bistate_terrain.json'))
    g = TER
    fx, fz = (x - g['x0']) / g['step'], (z - g['z0']) / g['step']
    i, j = max(0, min(g['w'] - 2, int(math.floor(fx)))), max(0, min(g['h'] - 2, int(math.floor(fz))))
    ax, az = fx - i, fz - j
    H, w = g['H'], g['w']
    return (H[j * w + i] * (1 - ax) + H[j * w + i + 1] * ax) * (1 - az) + (H[(j + 1) * w + i] * (1 - ax) + H[(j + 1) * w + i + 1] * ax) * az


def drape_rect(K, G, x0, z0, x1, z1, col, off=0.14, step=4.0):
    nx, nz = max(1, int(round((x1 - x0) / step))), max(1, int(round((z1 - z0) / step)))
    for i in range(nx):
        for j in range(nz):
            xa, xb = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            za, zb = z0 + (z1 - z0) * j / nz, z0 + (z1 - z0) * (j + 1) / nz
            qo(K, [(*G(x, z), T(x, z) + off) for x, z in ((xa, za), (xb, za), (xb, zb), (xa, zb))], (0, 0, 1), col)


def drape_path(K, G, pts, w, col, off=0.14, step=3.0):
    """a ribbon w metres wide along the game polyline pts, lying on the terrain"""
    dense = []
    for i in range(1, len(pts)):
        (ax, az), (bx, bz) = pts[i - 1], pts[i]
        n = max(1, int(math.dist(pts[i - 1], pts[i]) / step))
        for k in range(n):
            dense.append((ax + (bx - ax) * k / n, az + (bz - az) * k / n))
    dense.append(pts[-1])
    prev = None
    for k, (x, z) in enumerate(dense):
        a, b = dense[max(0, k - 1)], dense[min(len(dense) - 1, k + 1)]
        L = math.dist(a, b) or 1
        nx, nz = -(b[1] - a[1]) / L * w / 2, (b[0] - a[0]) / L * w / 2
        row = [(*G(x + nx, z + nz), T(x + nx, z + nz) + off), (*G(x - nx, z - nz), T(x - nx, z - nz) + off)]
        if prev:
            qo(K, [prev[0], prev[1], row[1], row[0]], (0, 0, 1), col)
        prev = row


def pad(K, G, x, z, ux, uz, hu, hv, h0, h1, col, m=BODY, top=True):
    """a box on the ground: centre (x, z), half sizes hu along (ux, uz) and hv across, from h0 to h1 (absolute)"""
    vx, vz = -uz, ux
    pts = [G(x + ux * a + vx * b, z + uz * a + vz * b) for a, b in ((-hu, -hv), (hu, -hv), (hu, hv), (-hu, hv))]
    K.prism(ccw(pts), h0, h1, col, m, top=top)


def bistate(render=True):
    anchor = (19438.2, 3760.5)  # the clubhouse (Microsoft footprint 16 x 28 m under the green roof)
    G = g2l(anchor)
    K, K1 = Kit(5711, ao=0), Kit(5712, ao=0)
    gravel, conc, white, green = lin('#b9ab92'), lin('#c9c5bb'), lin('#eeeeea'), lin('#3f6e4c')
    solids = []

    def sol(x, z, hu, hv, h, a=0.0, base=None):
        b = (T(x, z) if base is None else base) - 1.0
        solids.append([round(x, 1), round(z, 1), round(hu, 2), round(hv, 2), round(h + 1.0, 2), round(b, 2), round(a, 4)])

    # ---- the gravel drive: Cleveland Road, up the hill past the farm lots, round the woods to the lot
    drive = [(19263, 4383), (19272, 4366), (19284, 4344), (19291, 4305), (19293, 4270), (19270, 4240), (19244, 4212),
             (19222, 4196), (19212, 4189), (19240, 4172), (19271, 4163), (19300, 4150), (19318, 4135), (19339, 4099),
             (19334, 4070), (19324, 4050), (19314, 4000), (19309, 3960), (19310, 3932), (19351, 3900), (19386, 3869),
             (19418, 3842), (19424, 3815)]
    for KK, st in ((K, 3.0), (K1, 9.0)):
        drape_path(KK, G, drive, 4.6, gravel, step=st)
        drape_rect(KK, G, 19406, 3688, 19429.5, 3822, gravel, step=4.0 if KK is K else 12.0)  # main lot west of the clubhouse
        drape_rect(KK, G, 19418, 3678, 19449, 3700, gravel, step=4.0 if KK is K else 12.0)    # north lot

    # ---- clubhouse: 17 x 29 m, long axis north-south, green metal gable roof
    cx0, cx1, cz0, cz1 = 19429.8, 19446.6, 3746.2, 3774.8
    gy = min(T(cx0, cz0), T(cx1, cz0), T(cx1, cz1), T(cx0, cz1))
    top = max(T(cx0, cz0), T(cx1, cz0), T(cx1, cz1), T(cx0, cz1)) + 0.4
    eave, ridge = top + 3.2, top + 5.6
    wall, trim = lin('#d8cdb2'), lin('#f0ece2')
    P = ccw([G(cx0, cz0), G(cx1, cz0), G(cx1, cz1), G(cx0, cz1)])
    for KK, det in ((K, True), (K1, False)):
        KK.prism(P, gy - 1.0, top, lin('#9d978c'), top=False)  # foundation
        KK.prism(P, top, eave, wall, top=False)
        xm = (cx0 + cx1) / 2
        for side in (-1, 1):  # roof planes, 0.6 m overhang
            xo = cx0 - 0.6 if side < 0 else cx1 + 0.6
            qo(KK, [(*G(xo, cz0 - 0.6), eave - 0.25), (*G(xo, cz1 + 0.6), eave - 0.25), (*G(xm, cz1 + 0.6), ridge), (*G(xm, cz0 - 0.6), ridge)], (side, 0, 1), green)
            qo(KK, [(*G(xo, cz0 - 0.6), eave - 0.25), (*G(xo, cz1 + 0.6), eave - 0.25), (*G(xm, cz1 + 0.6), ridge), (*G(xm, cz0 - 0.6), ridge)], (-side, 0, -1), scale(green, 0.6))
        for zz, s in ((cz0, 1), (cz1, -1)):  # gable ends
            qo(KK, [(*G(cx0, zz), eave), (*G(cx1, zz), eave), (*G(xm, zz), ridge)], (0, s, 0), wall)
    # windows: a long glass band facing the fields (east), smaller ones on the west, doors both sides
    for (xf, nrm) in ((cx1, 1), (cx0, -1)):
        L = lambda u, h, d, xf=xf, nrm=nrm: (*G(xf + d * nrm, cz1 - u if nrm > 0 else cz0 + u), h)
        if nrm > 0:
            for k in range(6):
                u0 = 2.0 + k * 4.4
                K.quad(L, u0, u0 + 3.4, top + 0.9, top + 2.5, 0.03, LIT_C if k % 2 else GLASS_C, LIT if k % 2 else GLASS)
            K.quad(L, 13.0, 15.0, top, top + 2.3, 0.04, lin('#6b5a44'))
        else:
            for u0 in (3.0, 7.5, 20.0, 24.5):
                K.quad(L, u0, u0 + 1.6, top + 1.1, top + 2.3, 0.03, GLASS_C, GLASS)
            K.quad(L, 13.3, 15.5, top, top + 2.3, 0.04, lin('#6b5a44'))
            K.text("BI-STATE SPORTSMAN'S", L, 14.4, top + 2.55, 0.05, 0.42, lin('#1f3d2a'), BODY, 0.05, res=1)
        K.quad(L, 0, cz1 - cz0, eave - 0.35, eave - 0.05, 0.05, trim)
    pad(K, G, 19448.9, 3760.5, 0, 1, 14.3, 2.3, gy - 0.6, top - 0.05, conc)  # concrete deck along the field side
    sol((cx0 + cx1) / 2, (cz0 + cz1) / 2, (cx1 - cx0) / 2, (cz1 - cz0) / 2, ridge - gy + 1, 0.0, gy)

    # ---- the two pavilions flanking the clubhouse (north one = Microsoft footprint 19452,3684)
    for (px, pz, hw, hl) in ((19452.0, 3684.5, 2.6, 3.8), (19444.5, 3806.0, 2.8, 3.8)):
        g0 = T(px, pz)
        for KK, det in ((K, True), (K1, False)):
            if det:
                pad(K, G, px, pz, 0, 1, hl + 0.4, hw + 0.4, g0 - 0.5, g0 + 0.12, conc)
                for sx in (-1, 1):
                    for sz in (-1, 0, 1):
                        x, z = px + sx * (hw - 0.15), pz + sz * (hl - 0.15)
                        K.prism(ccw([G(x - 0.1, z - 0.1), G(x + 0.1, z - 0.1), G(x + 0.1, z + 0.1), G(x - 0.1, z + 0.1)]), g0, g0 + 2.6, lin('#7a5a3a'), top=False)
                for sz in (-1.6, 1.6):  # picnic tables
                    pad(K, G, px, pz + sz, 0, 1, 0.9, 0.4, g0 + 0.7, g0 + 0.78, lin('#8a6a46'))
            for side in (-1, 1):
                xo = px + side * (hw + 0.4)
                qo(KK, [(*G(xo, pz - hl - 0.4), g0 + 2.6), (*G(xo, pz + hl + 0.4), g0 + 2.6), (*G(px, pz + hl + 0.4), g0 + 3.5), (*G(px, pz - hl - 0.4), g0 + 3.5)], (side, 0, 1), green)
                qo(KK, [(*G(xo, pz - hl - 0.4), g0 + 2.6), (*G(xo, pz + hl + 0.4), g0 + 2.6), (*G(px, pz + hl + 0.4), g0 + 3.5), (*G(px, pz - hl - 0.4), g0 + 3.5)], (-side, 0, -1), scale(green, 0.6))

    # ---- the skeet line: 5 house positions on a chord running a little west of north-south (traced), 4 fields
    H0, H4 = (19477.0, 3685.5), (19468.0, 3848.0)
    Lc = math.dist(H0, H4)
    dx, dz = (H4[0] - H0[0]) / Lc, (H4[1] - H0[1]) / Lc  # along the line, north -> south
    ex, ez = dz, -dx                                       # toward the shotfall (east)
    sp = Lc / 4
    at = lambda base, a, e: (base[0] + dx * a + ex * e, base[1] + dz * a + ez * e)
    head = math.atan2(-dz, dx)
    for f in range(4):
        C = at(H0, sp * (f + 0.5), 0)        # station 8, centre of the base chord
        O = at(C, 0, 5.49)                    # target crossing point, 6 yd out: the 21 yd station arc is centred here
        # station arc: stations 1-7 at 8.13 m chords, concrete walk along it, pads at each station and at 8
        arc = []
        for k in range(25):
            ph = math.radians(-73.4 + 146.8 * k / 24)
            arc.append(at(O, -19.2 * math.sin(ph), -19.2 * math.cos(ph)))
        drape_path(K, G, arc, 1.3, conc, off=0.16, step=2.0)
        for k in range(7):
            ph = math.radians(-73.4 + 24.47 * k)
            x, z = at(O, -19.2 * math.sin(ph), -19.2 * math.cos(ph))
            pad(K, G, x, z, dx, dz, 0.75, 0.75, T(x, z) - 0.3, T(x, z) + 0.2, lin('#d6d2c8'))
        x, z = C
        pad(K, G, x, z, dx, dz, 0.75, 0.75, T(x, z) - 0.3, T(x, z) + 0.2, lin('#d6d2c8'))
        # combination fields (the three south ones): trap house just in front of station 8, posts at 16 yd on a
        # 3-yard-spaced arc, handicap walks from 16 to 27 yd
        if f >= 1:
            tc = at(C, 0, 1.3)
            g0 = T(*tc)
            for KK in (K, K1):
                pad(KK, G, tc[0], tc[1], dx, dz, 1.25, 1.25, g0 - 1.0, g0 + 0.75, lin('#a7a397'), top=False)
                pad(KK, G, tc[0], tc[1], dx, dz, 1.4, 1.4, g0 + 0.75, g0 + 0.95, lin('#4b6b4f'))
            sol(tc[0], tc[1], 1.3, 1.3, 1.0, head, g0)
            for k in range(5):
                ph = math.radians((k - 2) * 10.74)
                r0, r1 = 14.63, 24.69
                a = at(tc, -r0 * math.sin(ph), -r0 * math.cos(ph))
                b = at(tc, -(r1 + 0.6) * math.sin(ph), -(r1 + 0.6) * math.cos(ph))
                drape_path(K, G, [a, b], 1.0, lin('#cfcbc1'), off=0.18, step=2.5)
                pad(K, G, a[0], a[1], dx, dz, 0.5, 0.5, T(*a) - 0.2, T(*a) + 0.24, lin('#e4e0d6'))
    # skeet houses: high house (window at 10 ft) at each field's north end, low house (3.5 ft) at its south end;
    # the inner three positions carry both (one field's low house against the next one's high house)
    for k in range(5):
        hx, hz = at(H0, sp * k, 0)
        g0 = T(hx, hz)
        hi, lo = k < 4, k > 0
        parts = []
        if hi:
            parts.append((at((hx, hz), -1.3 if lo else 0, 1.2), 4.4, 1.2, +1))
        if lo:
            parts.append((at((hx, hz), 1.3 if hi else 0, 1.2), 2.3, 1.2, -1))
        for (px, pz), h, hh, face in parts:
            for KK in (K, K1):
                pad(KK, G, px, pz, dx, dz, hh, 1.3, g0 - 0.8, g0 + h, white)
                pad(KK, G, px, pz, dx, dz, hh + 0.2, 1.5, g0 + h, g0 + h + 0.25, lin('#d9dcdf'))
            wy = 3.05 if h > 3 else 1.07
            wx, wz = at((px, pz), face * hh, 0)  # opening on the side facing the field it throws over
            pad(K, G, wx, wz, dx, dz, 0.03, 0.55, g0 + wy - 0.3, g0 + wy + 0.3, lin('#1c1c1c'))
            sol(px, pz, hh, 1.3, h + 0.3, head, g0)
    # walkway behind the fields, from the north lot to the south pavilion, joining the clubhouse deck
    drape_path(K, G, [at(H0, -6, -24.0), at(H0, Lc + 4, -24.0)], 2.4, conc, off=0.16, step=3.0)
    drape_path(K1, G, [at(H0, -6, -24.0), at(H0, Lc + 4, -24.0)], 2.4, conc, off=0.16, step=12.0)

    # ---- 5-stand north of the skeet line: five shooting cages in a row, three trap boxes out front (placement approximate)
    for k in range(5):
        x, z = at(H0, -40.0 + k * 4.5, -12.0)
        g0 = T(x, z)
        pad(K, G, x, z, dx, dz, 0.9, 0.9, g0 - 0.3, g0 + 0.15, conc)
        for a, e in ((-0.85, -0.85), (0.85, -0.85), (-0.85, 0.85), (0.85, 0.85)):
            px, pz = at((x, z), a, e)
            K.rod((*G(px, pz), g0 + 0.15), (*G(px, pz), g0 + 1.2), 0.04, lin('#3a3f3c'))
        K.rod((*G(*at((x, z), -0.85, 0.85)), g0 + 1.15), (*G(*at((x, z), 0.85, 0.85)), g0 + 1.15), 0.04, lin('#3a3f3c'))
    for a, e in ((-46, 8), (-31, 14), (-18, 6)):
        x, z = at(H0, a, e)
        g0 = T(x, z)
        pad(K, G, x, z, dx, dz, 0.9, 0.7, g0 - 0.4, g0 + 0.8, lin('#4b6b4f'))

    lod0, lod1 = K.obj('bistate_lod0'), K1.obj('bistate_lod1')
    res = finish('bistate', [lod0, lod1], anchor)
    res['solid'] = solids
    if render:
        res['png'] = snap('bistate', (*G(19455, 3760), 22), 150, lod1, ((250, 35), (110, 25)))
    return res


B['bistate'] = bistate


def snap(name, target, dist, lod1, views):
    import os
    os.makedirs(SHOT, exist_ok=True)
    out = []
    if lod1:
        lod1.hide_render = True
    for i, (yaw, pitch) in enumerate(views):
        p = SHOT + '%s_%d.png' % (name, i)
        lm_preview(p, target, dist, yaw, pitch, (800, 520), 35)
        bpy.ops.render.render(write_still=True)
        out.append(p)
    if lod1:
        lod1.hide_render = False
    return out


if __name__ == '__main__' or True:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:
        bpy.context.scene.name = LM_SCENE
        render = '--norender' not in argv
        for nm in [a for a in argv if not a.startswith('--')]:
            print('COLONA', nm, json.dumps(build(nm, render)))
