# Coal Valley region models (Niabi Zoo and the village): GLBs in assets/models/regions/coal-valley/<name>.glb,
# sources in assets/src/regions/coal-valley/<name>.blend. Same kit and conventions as assets/src/landmarks.py
# (Blender X = game x, -Y = game z, origin = the anchor at base height, <name>_lod0 / <name>_lod1, baked 'Col').
# Headless only:  Blender -b --factory-startup -P coal_valley.py -- niabi_entrance cv_municipal   (no names = all)
# References: docs/regions/coal-valley.md.
import sys, math
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/coal-valley/'
LOUT = OUT + 'regions/coal-valley/'

STONE, STONE2 = lin('#9a8f7e'), lin('#7d7366')
CEDAR, CEDAR2 = lin('#8a6440'), lin('#6e4e32')
CREAM = lin('#e6dcc4')
GREEN_ROOF = lin('#3d5a3a')
TIMBER = lin('#5a4128')
BRICK, BRICK2 = lin('#8e4a38'), lin('#74392b')
SHINGLE = lin('#4a4846')
WHITE = lin('#f2f0ea')


def rgable(K, R, u0, u1, v0, v1, z, hr, col, wall, along_u=True, ov=0.6):
    """gabled roof in frame R: ridge along u (or v), eaves at z, rise hr, overhang ov, wall-coloured gable ends"""
    P = lambda u, v, h: (*R(u, v), h)
    low = Vector(P((u0 + u1) / 2, (v0 + v1) / 2, z - 5))
    f = lambda pts, c: K.oface([Vector(p) for p in pts], low, c)   # slopes face up/out whatever R's handedness
    if along_u:
        vm = (v0 + v1) / 2
        a, b = u0 - ov, u1 + ov
        f([P(a, v0 - ov, z), P(b, v0 - ov, z), P(b, vm, z + hr), P(a, vm, z + hr)], col)
        f([P(b, v1 + ov, z), P(a, v1 + ov, z), P(a, vm, z + hr), P(b, vm, z + hr)], col)
        for u in (u0, u1):
            K.oface([Vector(P(u, v0, z)), Vector(P(u, v1, z)), Vector(P(u, vm, z + hr))], Vector(P((u0 + u1) / 2, vm, z)), wall)
    else:
        um = (u0 + u1) / 2
        a, b = v0 - ov, v1 + ov
        f([P(u1 + ov, a, z), P(u1 + ov, b, z), P(um, b, z + hr), P(um, a, z + hr)], col)
        f([P(u0 - ov, b, z), P(u0 - ov, a, z), P(um, a, z + hr), P(um, b, z + hr)], col)
        for v in (v0, v1):
            K.oface([Vector(P(u0, v, z)), Vector(P(u1, v, z)), Vector(P(um, v, z + hr))], Vector(P(um, (v0 + v1) / 2, z)), wall)


def rhip(K, R, u0, u1, v0, v1, z, hr, col, ov=0.6):
    u0, u1, v0, v1 = u0 - ov, u1 + ov, v0 - ov, v1 + ov
    P = lambda u, v, h: (*R(u, v), h)
    W, D = u1 - u0, v1 - v0
    c = Vector(P((u0 + u1) / 2, (v0 + v1) / 2, z - 1))
    if W >= D:
        vm = (v0 + v1) / 2
        r0, r1 = P(u0 + D / 2, vm, z + hr), P(u1 - D / 2, vm, z + hr)
        quads = [[P(u0, v0, z), P(u1, v0, z), r1, r0], [P(u1, v1, z), P(u0, v1, z), r0, r1], [P(u1, v0, z), P(u1, v1, z), r1], [P(u0, v1, z), P(u0, v0, z), r0]]
    else:
        um = (u0 + u1) / 2
        r0, r1 = P(um, v0 + W / 2, z + hr), P(um, v1 - W / 2, z + hr)
        quads = [[P(u1, v0, z), P(u1, v1, z), r1, r0], [P(u0, v1, z), P(u0, v0, z), r0, r1], [P(u0, v0, z), P(u1, v0, z), r0], [P(u1, v1, z), P(u0, v1, z), r1]]
    for q in quads:
        K.oface([Vector(p) for p in q], c, col)


def walls(K, P, h1, wall, base=None, baseh=1.0, glass_on=None, gh=(1.2, 3.6), bay=2.6, lit=0.5, z0=-3):
    """polygon walls from z0 to h1: stone/brick base course, then wall; glass bays on sides where glass_on(mid) is true"""
    for i, L, Ln, mid in sides(P):
        if base:
            K.obox(L, 0, Ln, z0, baseh, -0.02, 0.12, base, BODY, ('d-', 'u-', 'u+', 'h-'))
        K.quad(L, 0, Ln, baseh if base else z0, h1, 0, wall)
        if glass_on and Ln > 3 and glass_on(i, mid, Ln):
            nb = max(1, round((Ln - 1) / bay))
            bw = (Ln - 1) / nb
            for k in range(nb):
                c = 0.5 + bw * (k + 0.5)
                on = K.rnd.random() < lit
                K.quad(L, c - bw * 0.42, c + bw * 0.42, gh[0], gh[1], 0.05, LIT_C if on else GLASS_C, LIT if on else GLASS)
                K.obox(L, c - bw * 0.5 - 0.09, c - bw * 0.5 + 0.09, gh[0], gh[1], 0, 0.14, TIMBER, BODY, ('d-', 'h-'))


# ================================================================ NIABI ZOO DISCOVERY CENTER + ENTRY
# The 2011 Discovery Center (education, administration, admissions; tamarins and rotating galleries inside) on the
# OSM footprint r12581094, the covered entry walk (r12581095) toward the parking lot, and a stone NIABI ZOO
# monument at the end of the walk. Style: nature-centre lodge, stone base, cedar siding, timber posts, green metal
# roofs (the look of the forest preserve's buildings; the exact cladding is unverified, see the docs).
def niabi_entrance(render=True):
    anchor = (11861.0, 8806.0)
    R = room_frame(anchor, 11861.0, 8806.0, 0.751)   # u: north-east, v: south-east (the footprint's own axes)
    uv = [(-14.0, -8.9), (0.4, -8.9), (0.3, -11.3), (2.8, -11.3), (2.8, -14.7), (10.1, -14.8), (10.1, -11.8), (15.3, -11.7),
          (15.4, 0.4), (13.1, 0.5), (13.1, 9.8), (4.5, 9.8), (4.6, 17.8), (-8.6, 17.8), (-8.7, 9.6), (-13.8, 9.7)]
    P = ccw([R(u, v) for u, v in uv])
    K = Kit(1101)
    EAVE = 4.6
    # glass toward the entry plaza and pond (north-east and south-east faces)
    glass_on = lambda i, mid, Ln: mid[0] > 2 or mid[1] > 4   # east half and the north (canopy) side
    walls(K, P, EAVE, CEDAR, STONE, 1.1, glass_on, (1.1, 3.9), 2.4)
    for i, L, Ln, mid in sides(P):   # eave fascia
        K.obox(L, -0.4, Ln + 0.4, EAVE - 0.35, EAVE, -0.1, 0.5, CREAM, BODY, ('d-',))
    K.prism(P, EAVE - 0.05, EAVE, GREEN_ROOF, sides=False)
    # the big lodge roof over the gallery core, a clerestory band under it, and gables over the wings
    rbox(K, R, -8.0, 12.5, -8.3, 9.2, EAVE, EAVE + 1.6, CEDAR2, BODY, ('h-', 'h+'))
    for u0, u1, v0, v1 in ((-8.0, 12.5, -8.35, -8.25), (-8.0, 12.5, 9.15, 9.25)):
        for k in range(7):
            a = u0 + 0.5 + k * (u1 - u0 - 1) / 7
            rbox(K, R, a + 0.25, a + (u1 - u0 - 1) / 7 - 0.25, v0 - 0.06, v1 + 0.06, EAVE + 0.3, EAVE + 1.3, LIT_C, LIT, ())
    rgable(K, R, -8.0, 12.5, -8.3, 9.2, EAVE + 1.6, 4.4, GREEN_ROOF, CEDAR, along_u=False, ov=1.0)
    rgable(K, R, 0.4, 15.3, -14.7, -8.9, EAVE, 2.4, GREEN_ROOF, CEDAR, along_u=True, ov=0.5)     # admissions wing
    rgable(K, R, -8.6, 4.5, 9.8, 17.8, EAVE, 2.6, GREEN_ROOF, CEDAR, along_u=False, ov=0.5)     # south classroom wing
    rgable(K, R, -13.8, -8.7, -8.9, 9.7, EAVE, 1.8, GREEN_ROOF, CEDAR, along_u=False, ov=0.4)   # west office wing
    # stone chimney pier at the gallery's south-west end
    rbox(K, R, -9.4, -7.4, 1.0, 3.0, -3, EAVE + 6.6, STONE, BODY)
    rbox(K, R, -9.6, -7.2, 0.8, 3.2, EAVE + 6.6, EAVE + 6.9, STONE2, BODY, ())
    # entry walk canopy (OSM r12581095): timber posts, green standing-seam roof, sign fascia both sides
    cu0, cu1, cv0, cv1, CH = 15.4, 33.4, -10.9, -4.8, 3.7
    for u in [cu0 + 1 + k * (cu1 - cu0 - 1) / 5 for k in range(6)]:
        for v in (cv0 + 0.3, cv1 - 0.3):
            rbox(K, R, u - 0.18, u + 0.18, v - 0.18, v + 0.18, -1, CH - 0.3, TIMBER, BODY)
            rbox(K, R, u - 0.35, u + 0.35, v - 0.35, v + 0.35, -1, 0.5, STONE, BODY)
    rbox(K, R, cu0, cu1 + 0.4, cv0 - 0.2, cv1 + 0.2, CH - 0.3, CH, TIMBER, BODY)
    rgable(K, R, cu0, cu1, cv0, cv1, CH, 1.3, GREEN_ROOF, CEDAR2, along_u=True, ov=0.6)
    for vv, dd in ((cv0 - 0.21, -1), (cv1 + 0.21, 1)):
        Lf = lambda u, h, d, vv=vv, dd=dd: (*R(u if dd > 0 else cu0 + cu1 - u, vv + dd * d), h)   # reads left to right from outside
        K.text('NIABI ZOO', Lf, (cu0 + cu1) / 2, CH - 0.27, 0.02, 0.5, CREAM, NEON, 0.04, res=1)
    # front doors on the canopy end: glass wall with lit doors
    Ld = lambda u, h, d: (*R(15.4 + 0.08 + d, -u), h)
    K.quad(Ld, 5.2, 10.4, 0.0, 3.2, 0.0, lin('#ffe1a0'), LIT)
    K.text('DISCOVERY CENTER', Ld, 7.8, 3.35, 0.0, 0.42, CREAM, NEON, 0.04, res=1)
    # monument sign at the parking end of the walk: low fieldstone wall with letters and the fawn emblem
    mu, mv = 31.0, -17.5
    rbox(K, R, mu - 4.0, mu + 4.0, mv - 0.5, mv + 0.5, -1, 1.6, STONE, BODY)
    rbox(K, R, mu - 4.2, mu + 4.2, mv - 0.6, mv + 0.6, 1.6, 1.8, STONE2, BODY, ())
    rbox(K, R, mu + 4.0, mu + 5.2, mv - 0.6, mv + 0.6, -1, 2.6, STONE2, BODY)
    for dd, vv in ((-1, mv - 0.51), (1, mv + 0.51)):
        Lm = lambda u, h, d, vv=vv, dd=dd: (*R(u if dd > 0 else 2 * mu - u, vv + dd * d), h)
        K.text('NIABI ZOO', Lm, mu, 0.55, 0.0, 0.85, CREAM, NEON, 0.05, res=1, bold=0.01)
    lod0 = K.obj('niabi_entrance_lod0')
    K1 = Kit(1102)
    K1.prism(P, -3, EAVE, CEDAR, topcol=GREEN_ROOF)
    rgable(K1, R, -8.0, 12.5, -8.3, 9.2, EAVE, 6.0, GREEN_ROOF, CEDAR, along_u=False, ov=1.0)
    rgable(K1, R, cu0, cu1, cv0, cv1, CH, 1.3, GREEN_ROOF, CEDAR2, along_u=True, ov=0.6)
    lod1 = K1.obj('niabi_entrance_lod1')
    res = finish('niabi_entrance', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('niabi_entrance', (8, 0, 3), 70, lod1, views=((40, 22), (220, 30)))
    return res


# ================================================================ PASSPORT TO AFRICA: GIRAFFE HOUSE + FEEDING DECK
# 2007: the giraffe house (OSM 628930321, 22 x 24 m) with tall doors to the yard, the raised public feeding
# platform under a thatch-look roof (OSM 628930319 'Giraffe Feeding'), and two reticulated giraffes in the yard.
def giraffe(K, R, u, v, a, s=1.0):
    ca, sa = math.cos(a), math.sin(a)
    T = lambda x, h, y: (*R(u + (x * ca - y * sa) * s, v + (x * sa + y * ca) * s), h * s)
    tan, spot, dark = lin('#d9a25a'), lin('#7a4422'), lin('#3b2a1e')
    for x in (-0.75, 0.75):
        for y in (-0.28, 0.28):
            K.rod(T(x, 0, y), T(x * 0.95, 2.0, y), 0.09 * s, tan, BODY, 4)
            K.rod(T(x, 0, y), T(x, 0.25, y), 0.11 * s, dark, BODY, 4)
    K.obox(T, -1.05, 1.05, 1.9, 2.75, -0.42, 0.42, tan, BODY, ())
    for k in range(9):   # reticulated patches
        px, ph = -0.8 + (k % 3) * 0.8, 2.0 + (k // 3) * 0.25
        for sd in (-1, 1):
            K.obox(T, px - 0.22, px + 0.22, ph, ph + 0.2, sd * 0.42 - 0.01, sd * 0.42 + 0.01, spot, BODY, ())
    K.rod(T(0.9, 2.5, 0), T(1.9, 4.9, 0), 0.17 * s, tan, BODY, 5)                     # neck
    K.obox(T, 1.75, 2.45, 4.75, 5.1, -0.14, 0.14, tan, BODY, ())                       # head
    K.rod(T(1.9, 5.05, -0.06), T(1.85, 5.35, -0.06), 0.03 * s, dark, BODY, 3)           # ossicones
    K.rod(T(1.9, 5.05, 0.06), T(1.85, 5.35, 0.06), 0.03 * s, dark, BODY, 3)
    K.rod(T(-1.05, 2.6, 0), T(-1.2, 1.6, 0), 0.03 * s, dark, BODY, 3)                   # tail


def niabi_giraffe(render=True):
    anchor = (11945.0, 9105.0)
    G = g2l(anchor)
    # giraffe house: the OSM footprint is a rectangle turned ~6 deg; use its own frame
    Rh = room_frame(anchor, 11931.0, 9127.7, -0.116)
    K = Kit(1201)
    SAND, SAND2, RUST = lin('#c9ad82'), lin('#a88d64'), lin('#6b4a30')
    HP = ccw([Rh(u, v) for u, v in ((-10.3, -11.0), (10.3, -11.0), (10.3, 11.0), (-10.3, 11.0))])
    EAVE = 7.5
    walls(K, HP, EAVE, SAND, STONE2, 0.9, None)
    for i, L, Ln, mid in sides(HP):
        K.obox(L, -0.3, Ln + 0.3, EAVE - 0.4, EAVE, -0.1, 0.35, RUST, BODY, ('d-',))
        # high clerestory windows and two 6 m giraffe doors on the yard (north-east) side
        for k in range(int(Ln // 3.2)):
            c = 1.6 + k * 3.2
            K.quad(L, c - 0.9, c + 0.9, 5.6, 6.8, 0.04, GLASS_C, GLASS)
        if mid[0] > 0 and mid[1] > -6:
            for c in (Ln * 0.3, Ln * 0.7):
                K.quad(L, c - 1.6, c + 1.6, 0, 6.0, 0.04, lin('#5c4330'))
                for kk in range(5):
                    K.quad(L, c - 1.6, c + 1.6, 0.6 + kk * 1.1, 0.7 + kk * 1.1, 0.06, lin('#4a3424'))
    rgable(K, Rh, -10.3, 10.3, -11.0, 11.0, EAVE, 3.2, RUST, SAND, along_u=False, ov=0.8)
    K.text('PASSPORT TO AFRICA', lambda u, h, d: (*Rh(-u, -11.0 - 0.06 - d), h), 0, 3.9, 0.0, 0.9, CREAM, NEON, 0.05, res=1)
    # feeding deck (OSM 11965-11975, 9084-9091): deck at 3.6 m so guests meet the giraffes face to face
    Rd = room_frame(anchor, 11969.9, 9087.7, 0.29)
    DH = 3.6
    rbox(K, Rd, -4.3, 4.3, -2.2, 2.2, DH - 0.25, DH, TIMBER, BODY, ('h-',))
    for u in (-4.0, 0, 4.0):
        for v in (-1.9, 1.9):
            rbox(K, Rd, u - 0.15, u + 0.15, v - 0.15, v + 0.15, -1, DH + 2.8, TIMBER, BODY)
    for v in (-2.2, 2.2):
        rbox(K, Rd, -4.3, 4.3, v - 0.05, v + 0.05, DH, DH + 1.1, lin('#7a5a3a'), BODY, ())
    rbox(K, Rd, -4.35, -4.25, -2.2, 2.2, DH, DH + 1.1, lin('#7a5a3a'), BODY, ())
    # ramp/stairs down the back (+v side), thatch-look roof
    for k in range(10):
        rbox(K, Rd, 4.3 + k * 0.5, 4.8 + k * 0.5, -1.0, 1.0, -1, DH - (k + 1) * 0.36, TIMBER, BODY)
    THATCH = lin('#b08a4e')
    rhip(K, Rd, -4.3, 4.3, -2.2, 2.2, DH + 2.8, 1.7, THATCH, ov=0.9)
    # yard: two giraffes near the deck, one by the house doors
    giraffe(K, Rd, -1.0, -6.0, 1.75, 1.05)
    giraffe(K, Rd, -13.0, -5.0, 0.3, 0.95)
    lod0 = K.obj('niabi_giraffe_lod0')
    K1 = Kit(1202)
    K1.prism(HP, -3, EAVE, SAND, topcol=RUST)
    rgable(K1, Rh, -10.3, 10.3, -11.0, 11.0, EAVE, 3.2, RUST, SAND, along_u=False, ov=0.8)
    rbox(K1, Rd, -4.3, 4.3, -2.2, 2.2, -1, DH, TIMBER, BODY)
    rhip(K1, Rd, -4.3, 4.3, -2.2, 2.2, DH + 2.8, 1.7, THATCH, ov=0.9)
    lod1 = K1.obj('niabi_giraffe_lod1')
    res = finish('niabi_giraffe', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('niabi_giraffe', (5, 0, 4), 60, lod1, views=((60, 20), (230, 25)))
    return res


# ================================================================ ENDANGERED SPECIES CAROUSEL
# The round carousel house at 11914, 8973 (OSM 'attraction=carousel', 11 x 11 m): open 12-sided pavilion, posts,
# red-and-cream striped cone roof with a cupola, and the platform of hand-carved endangered animals inside.
def niabi_carousel(render=True):
    anchor = (11914.2, 8972.9)
    K = Kit(1301)
    RED, YEL = lin('#b5302a'), lin('#e8c35a')
    r, seg, EAVE = 6.4, 12, 3.4
    K.cyl(0, 0, r + 0.3, -1.5, 0.25, lin('#b8b0a2'), BODY, seg)                  # plinth
    for k in range(seg):
        a = 2 * math.pi * (k + 0.5) / seg
        x, y = math.cos(a) * r, math.sin(a) * r
        K.cyl(x, y, 0.13, 0.25, EAVE, WHITE, BODY, 6)
    K.cyl(0, 0, r + 0.25, EAVE, EAVE + 0.6, YEL, BODY, seg, top=False)               # fascia band
    for k in range(seg):   # striped cone
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        c = RED if k % 2 else CREAM
        K.face([(math.cos(a0) * (r + 0.6), math.sin(a0) * (r + 0.6), EAVE + 0.6), (math.cos(a1) * (r + 0.6), math.sin(a1) * (r + 0.6), EAVE + 0.6),
                (math.cos(a1) * 1.1, math.sin(a1) * 1.1, EAVE + 3.6), (math.cos(a0) * 1.1, math.sin(a0) * 1.1, EAVE + 3.6)], c)
    K.cyl(0, 0, 1.1, EAVE + 3.6, EAVE + 4.6, WHITE, BODY, 8)
    K.cyl(0, 0, 1.3, EAVE + 4.6, EAVE + 5.6, RED, BODY, 8, r1=0.05)
    K.cyl(0, 0, 0.05, EAVE + 5.6, EAVE + 6.6, lin('#c9a227'), BODY, 4)
    # carousel: platform, centre drum with mirror band, animals on brass poles in two rings
    K.cyl(0, 0, 4.8, 0.25, 0.6, lin('#7a5a3a'), BODY, 16)
    K.cyl(0, 0, 1.2, 0.6, EAVE - 0.2, lin('#2f5d8a'), BODY, 10)
    K.cyl(0, 0, 1.22, 1.6, 2.4, lin('#ffe6a8'), LIT, 10, top=False)
    K.cyl(0, 0, 4.8, EAVE - 0.6, EAVE - 0.2, YEL, BODY, 16, top=False)
    cols = [lin('#e0e0dc'), lin('#d9a25a'), lin('#5d6b74'), lin('#3b5b3a'), lin('#b5302a'), lin('#2a2a2a')]
    for ring, rr, n in ((0, 3.9, 10), (1, 2.6, 7)):
        for k in range(n):
            a = 2 * math.pi * (k + ring * 0.5) / n
            x, y = math.cos(a) * rr, math.sin(a) * rr
            K.cyl(x, y, 0.04, 0.6, EAVE - 0.6, lin('#c9a227'), BODY, 4)
            ta = a + math.pi / 2
            T = lambda u, h, d, x=x, y=y, ta=ta: (x + math.cos(ta) * u - math.sin(ta) * d, y + math.sin(ta) * u + math.cos(ta) * d, h)
            c = cols[(k + ring) % len(cols)]
            K.obox(T, -0.55, 0.55, 1.2, 1.65, -0.2, 0.2, c, BODY, ())               # body
            K.obox(T, 0.45, 0.8, 1.55, 2.05, -0.13, 0.13, c, BODY, ())              # head
            for lx in (-0.4, 0.4):
                K.obox(T, lx - 0.06, lx + 0.06, 0.75, 1.2, -0.12, 0.12, c, BODY, ())
    lod0 = K.obj('niabi_carousel_lod0')
    K1 = Kit(1302)
    K1.cyl(0, 0, r, -1.5, EAVE + 0.6, lin('#7a5a3a'), BODY, 8)
    K1.cyl(0, 0, r + 0.6, EAVE + 0.6, EAVE + 4.6, RED, BODY, 8, r1=0.2)
    lod1 = K1.obj('niabi_carousel_lod1')
    res = finish('niabi_carousel', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('niabi_carousel', (0, 0, 3), 26, lod1, views=((30, 18),))
    return res


# ================================================================ COAL VALLEY MUNICIPAL CENTER
# 900 1st Street (2002): village hall, police, township, assessor and the Robert R. Jones Library under one roof.
# OSM gives two footprints (544439149 hall, 544439148 library behind it). Modelled as one-storey brick with a
# stone base, hipped shingle roofs, a gabled entrance portico facing 1st Street (east), flagpoles out front.
def cv_municipal(render=True):
    anchor = (9662.0, 8900.0)
    G = g2l(anchor)
    K = Kit(1401)
    hall = ccw([G(x, z) for x, z in ((9651.6, 8876.3), (9678.0, 8876.5), (9677.9, 8892.6), (9651.5, 8892.4))])
    lib = ccw([G(x, z) for x, z in ((9656.1, 8892.5), (9670.8, 8892.7), (9670.8, 8910.2), (9677.5, 8910.2), (9677.5, 8927.1),
                                    (9638.5, 8926.9), (9638.6, 8910.2), (9656.0, 8910.3))])
    ID = lambda u, v: G(u, v)   # game-axis frame for rhip / rgable (u = game x, v = game z)
    glass_any = lambda i, mid, Ln: Ln > 6
    walls(K, hall, 4.6, BRICK, STONE, 0.9, glass_any, (1.0, 3.2), 2.8)
    walls(K, lib, 4.2, BRICK, STONE, 0.9, glass_any, (1.0, 3.0), 3.0)
    for P, e in ((hall, 4.6), (lib, 4.2)):
        for i, L, Ln, mid in sides(P):
            K.obox(L, -0.2, Ln + 0.2, e - 0.35, e, -0.05, 0.3, CREAM, BODY, ('d-',))
        K.prism(P, e - 0.05, e, SHINGLE, sides=False)
    rhip(K, ID, 9651.6, 9678.0, 8876.3, 8892.6, 4.6, 3.6, SHINGLE, ov=0.7)
    rhip(K, ID, 9656.1, 9670.8, 8892.6, 8910.2, 4.2, 2.6, SHINGLE, ov=0.5)
    rhip(K, ID, 9638.6, 9677.5, 8910.2, 8927.0, 4.2, 3.4, SHINGLE, ov=0.7)
    # entrance portico on the east face (toward 1st Street): white columns, cream gable, lit doors
    px0, px1, pz0, pz1 = 9678.0, 9682.5, 8879.8, 8889.2
    for z in (pz0 + 0.4, pz1 - 0.4):
        K.cyl(*G(px1 - 0.4, z), 0.25, 0, 4.4, WHITE, BODY, 8)
    rbox(K, ID, px0, px1, pz0, pz1, 4.4, 4.9, CREAM, BODY)
    rgable(K, ID, px0 - 1.0, px1, pz0, pz1, 4.9, 2.4, SHINGLE, CREAM, along_u=True, ov=0.3)
    Le = lambda u, h, d: (*G(9678.0 + 0.06 + d, 8884.5 - u), h)
    K.quad(Le, -1.6, 1.6, 0.0, 2.8, 0.0, lin('#ffe1a0'), LIT)
    Lt = lambda u, h, d: (*G(px1 + 0.02 + d, 8884.5 - u), h)
    K.text('COAL VALLEY', Lt, 0, 5.4, 0.0, 0.55, lin('#1e2a38'), BODY, 0.04, res=1)
    Lw = lambda u, h, d: (*G(9678.0 + 0.04 + d, 8884.5 - u), h)
    K.text('MUNICIPAL CENTER', Lw, 0, 3.55, 0.0, 0.42, lin('#c9a227'), NEON, 0.04, res=1)
    Ll = lambda u, h, d: (*G(9677.5 + 0.04 + d, 8918.6 - u), h)
    K.text('ROBERT R. JONES PUBLIC LIBRARY', Ll, 0, 3.0, 0.0, 0.42, lin('#c9a227'), NEON, 0.04, res=1)
    # three flagpoles on a brick planter in front (US, Illinois, POW/MIA)
    for k, (fx, fc) in enumerate(((-2.2, lin('#b22234')), (0, lin('#2d4f9e')), (2.2, lin('#1a1a1a')))):
        x, y = G(9690.0, 8884.5 + fx)
        K.cyl(x, y, 0.07, 0, 10.5 - abs(fx) * 0.5, lin('#d0d0cc'), BODY, 5)
        K.box(x - 0.02, x + 0.02, y, y + 1.8, 9.2 - abs(fx) * 0.5, 10.3 - abs(fx) * 0.5, fc, BODY, ())
    x0, y0 = G(9688.8, 8881.5)
    x1, y1 = G(9691.2, 8887.5)
    K.box(min(x0, x1), max(x0, x1), min(y0, y1), max(y0, y1), -0.5, 0.5, BRICK2)
    lod0 = K.obj('cv_municipal_lod0')
    K1 = Kit(1402)
    K1.prism(hall, -3, 4.6, BRICK, topcol=SHINGLE)
    K1.prism(lib, -3, 4.2, BRICK, topcol=SHINGLE)
    rhip(K1, ID, 9651.6, 9678.0, 8876.3, 8892.6, 4.6, 3.6, SHINGLE, ov=0.7)
    rhip(K1, ID, 9638.6, 9677.5, 8910.2, 8927.0, 4.2, 3.4, SHINGLE, ov=0.7)
    lod1 = K1.obj('cv_municipal_lod1')
    res = finish('cv_municipal', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('cv_municipal', (5, 0, 3), 75, lod1, views=((70, 22), (250, 30)))
    return res


CV = {'niabi_entrance': niabi_entrance, 'niabi_giraffe': niabi_giraffe, 'niabi_carousel': niabi_carousel, 'cv_municipal': cv_municipal}

if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(CV)
    bpy.context.scene.name = LM_SCENE
    for n in names:
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        print('CVRESULT', n, CV[n](True))
