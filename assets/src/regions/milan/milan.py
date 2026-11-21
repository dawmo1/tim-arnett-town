# Milan IL signature models -> assets/models/regions/milan/<name>.glb (src/regions/milan.js models[]).
# Uses the landmark kit (assets/src/landmarks.py: Kit, windows, finish...) with its output dirs pointed here.
# Background Blender only:  Blender -b --factory-startup -P milan.py -- muni camden shelter
# References and guesses: docs/regions/milan.md. Footprints are the OSM / Microsoft outlines from the tile data.
import sys
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/milan/'
LOUT = OUT + 'regions/milan/'


def poly_l(game_pts, anchor):
    return local(game_pts, anchor)


def inset(P, d):
    """offset a CCW polygon inward by d (mitred corners)"""
    n, out = len(P), []
    for i in range(n):
        a, b, c = Vector((*P[i - 1], 0)), Vector((*P[i], 0)), Vector((*P[(i + 1) % n], 0))
        e0, e1 = (b - a).normalized(), (c - b).normalized()
        n0, n1 = Vector((-e0.y, e0.x, 0)), Vector((-e1.y, e1.x, 0))  # left = inward for CCW
        m = (n0 + n1).normalized()
        k = d / max(0.3, m.dot(n0))
        out.append((b.x + m.x * k, b.y + m.y * k))
    return out


def flagpole(K, x, y, h=10.0, flag=True):
    K.cyl(x, y, 0.07, -0.5, h, lin('#d8d8d4'), BODY, 6)
    K.cyl(x, y, 0.14, h, h + 0.25, lin('#c9a227'), BODY, 6)
    if flag:  # US flag, stripes as two colours
        F = lambda u, hh, d: (x + 0.1 + u, y + d, hh)
        for s in range(7):
            K.quad(F, 0, 2.6, h - 1.6 + s * 0.22, h - 1.38 + s * 0.22, 0, lin('#b22234') if s % 2 == 0 else lin('#f2f2f2'))
            K.quad(F, 2.6, 0, h - 1.6 + s * 0.22, h - 1.38 + s * 0.22, 0, lin('#b22234') if s % 2 == 0 else lin('#f2f2f2'))
        K.quad(F, 0, 1.1, h - 0.85, h - 0.06, 0.01, lin('#3c3b6e'))
        K.quad(F, 1.1, 0, h - 0.85, h - 0.06, -0.01, lin('#3c3b6e'))


# ================================================================ MILAN MUNICIPAL BUILDING
# 405 E 1st St: two-storey ~35,000 sq ft village hall + police (OSM outline w975247345): a long south bar, a deep
# central block, a one-storey east wing (police garage [G]) and a round two-storey drum at the inside corner
# facing the lot (lobby [G]). Brick and cast-stone colours are guesses.
MUNI_A = (962.0, 8192.0)


def muni(render=True):
    A = MUNI_A
    brick, stone, roofc, dk = lin('#94563f'), lin('#d3c8b2'), lin('#5a5856'), lin('#3a3632')
    G = g2l(A)
    blocks = [  # game x0, x1, z0, z1, floors
        (928.6, 979.6, 8199.0, 8211.7, 2), (958.2, 979.6, 8165.0, 8199.0, 2), (979.2, 986.0, 8193.7, 8217.2, 2),
        (979.6, 996.3, 8170.0, 8180.1, 1)]
    K, K1 = Kit(901), Kit(902)
    FH = 4.4
    for (x0, x1, z0, z1, nf) in blocks:
        P = local([(x0, z0), (x1, z0), (x1, z1), (x0, z1)], A)
        top = 0.9 + nf * FH + (0.6 if nf == 2 else 0.4)
        K.prism(P, -3, 0, stone, top=False)
        for i, L, Ln, mid in sides(P):
            K.obox(L, -0.1, Ln + 0.1, 0, 0.9, -0.05, 0.12, stone, BODY, ('d-',))  # cast-stone water table
            if nf == 1:  # garage wing: overhead doors on the north side, plain brick elsewhere
                K.quad(L, 0, Ln, 0.9, top, 0, brick)
                if mid[1] > 2:
                    for k in range(3):
                        u = 1.2 + k * (Ln - 2.4) / 3
                        K.quad(L, u + 0.3, u + (Ln - 2.4) / 3 - 0.3, 0, 3.6, 0.03, lin('#c8c8c2'))
                continue
            nb = max(1, round((Ln - 1.2) / 3.0))
            windows(K, L, 0.6, Ln - 0.6, 0.9, FH, nf, nb, brick, wf=0.62, hf=0.55, rec=0.18, edge=0.6, sill=stone, lit=0.35)
            belt(K, L, 0, Ln, FH + 0.9 - 0.35, stone, 0.12, 0.35, 0)
            K.quad(L, 0, Ln, 0.9 + nf * FH, top, 0, brick)
        roof(K, P, top, roofc, par=stone, parh=0.5, part=0.3)
        lod1_bands(K1, P, 0.9, nf, FH, brick)
    # rooftop units on the central block
    rooftop_junk(K, *G(969, 8180), 0.9 + 2 * FH + 0.6, K.rnd, 4, 6)
    # the drum: two-storey glazed lobby with a brick frame and a flat cap
    cx, cy = G(953.6, 8195.0)
    R, H = 5.3, 2 * FH + 2.8
    K.cyl(cx, cy, R, -3, 0.9, stone, BODY, 20, top=False)
    seg = 20
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        p0 = (cx + math.cos(a0) * R, cy + math.sin(a0) * R)
        p1 = (cx + math.cos(a1) * R, cy + math.sin(a1) * R)
        L, Ln = frame(p0, p1)
        if k % 4 == 0:  # brick piers
            K.quad(L, 0, Ln, 0.9, H, 0, brick)
        else:
            K.quad(L, 0, Ln, 0.9, H - 1.0, -0.05, LIT_C if k % 3 else GLASS_C, LIT if k % 3 else GLASS)
            K.quad(L, 0, Ln, H - 1.0, H, 0, stone)
    K.cyl(cx, cy, R + 0.5, H, H + 0.5, stone, BODY, seg)
    K.cyl(cx, cy, R * 0.6, H + 0.5, H + 1.6, roofc, BODY, seg, r1=0.4)
    # entrance canopy on the lot side (west) of the drum
    K.box(cx - R - 2.6, cx - R + 0.4, cy - 2.2, cy + 2.2, 3.4, 3.8, stone)
    for yy in (cy - 2.0, cy + 2.0):
        K.cyl(cx - R - 2.3, yy, 0.15, 0, 3.4, stone, BODY, 6)
    K1.cyl(cx, cy, R, -3, H, GLASS_C, LIT, 10)
    K1.cyl(cx, cy, R + 0.5, H, H + 0.5, stone, BODY, 10)
    # name on the west face of the central block (faces the lot and 1st Street)
    x0, x1, z0, z1 = 958.2, 979.6, 8165.0, 8199.0
    Wf = lambda u, h, d: (G(x0, z0 + u)[0] - d, G(x0, z0 + u)[1], h)
    K.text('MILAN MUNICIPAL BUILDING', Wf, 17.0, 0.9 + 2 * FH + 0.08, 0.04, 0.45, lin('#e9e2cf'), BODY, 0.08, res=1)
    K.text('405', Wf, 17.0, 0.95 + FH - 1.2, 0.04, 0.7, lin('#e9e2cf'), BODY, 0.06, res=1)
    # flagpoles in the lawn by the entrance (US, Illinois, POW [G]: all drawn as US flags)
    for k, yy in enumerate((cy - 9, cy - 6, cy - 3)):
        flagpole(K, cx - R - 9, yy, 10.5 if k == 1 else 9.0)
    # monument sign at the lot entrance
    mx, my = G(931.0, 8170.0)
    K.box(mx - 0.4, mx + 0.4, my - 2.6, my + 2.6, -0.5, 0.6, stone)
    K.box(mx - 0.25, mx + 0.25, my - 2.3, my + 2.3, 0.6, 2.0, brick)
    Sf = lambda u, h, d: (mx - 0.25 - d, my + 2.3 - u, h)
    K.text('VILLAGE OF MILAN', Sf, 2.3, 1.2, 0.03, 0.42, lin('#f0ead8'), BODY, 0.05, res=1)
    lod0 = K.obj('muni_lod0')
    lod1 = K1.obj('muni_lod1')
    res = finish('muni', [lod0, lod1], A)
    if render:
        res['png'] = shots('muni', (0, 0, 5), 85, lod1, views=((-120, 22), (60, 30)))
    return res


B['muni'] = muni


# ================================================================ THE CAMDEN CENTRE
# 2701 1st St E, in Camden Park at US 67 and the Milan Beltway: the former Milan Community Center, a one-storey
# banquet hall seating 300-400 (OSM outline w503567123). Walls, mansard fascia and entrance are guesses.
CAMDEN_A = (918.0, 10892.0)
CAMDEN_PTS = [(892.2, 10893.2), (895.6, 10881.2), (899.7, 10882.3), (901.7, 10875.1), (949.9, 10888.4), (947.8, 10895.7),
              (935.8, 10892.3), (930.3, 10912.2), (892.7, 10901.7)]  # (a 2 m jog at the west end dropped)


def camden(render=True):
    A = CAMDEN_A
    G = g2l(A)
    wall, trim, shing, roofc = lin('#b49a78'), lin('#e4dccb'), lin('#5b4636'), lin('#6a6a66')
    P = local(CAMDEN_PTS, A)
    K, K1 = Kit(911), Kit(912)
    WH, MH = 4.0, 1.5
    K.prism(P, -3, 0, trim, top=False)
    for i, L, Ln, mid in sides(P):
        K.obox(L, -0.05, Ln + 0.05, 0, 0.6, -0.05, 0.1, trim, BODY, ('d-',))
        if Ln > 8:
            windows(K, L, 0.6, Ln - 0.6, 0.6, WH - 0.6, 1, max(1, round((Ln - 1.2) / 4.2)), wall, wf=0.5, hf=0.55, rec=0.15, edge=0.6, lit=0.5)
        else:
            K.quad(L, 0, Ln, 0.6, WH, 0, wall)
    # mansard fascia band all round, flat roof inside
    Pin = inset(P, 1.4)
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        ai, bi = Pin[i], Pin[(i + 1) % n]
        K.face([(a[0], a[1], WH), (b[0], b[1], WH), (bi[0], bi[1], WH + MH), (ai[0], ai[1], WH + MH)], shing)
        K.face([(b[0], b[1], WH), (a[0], a[1], WH), (a[0], a[1], WH - 0.25), (b[0], b[1], WH - 0.25)][::-1], trim)
    K.prism(Pin, WH + MH - 0.1, WH + MH, roofc, sides=False)
    rooftop_junk(K, *G(925, 10890), WH + MH, K.rnd, 3, 6)
    # entrance: gabled canopy on the west end, toward US 67 and the lot
    ex, ey = G(893.8, 10897.5)
    K.box(ex - 4.5, ex, ey - 3.0, ey + 3.0, 3.2, 3.5, trim)
    for yy in (ey - 2.7, ey + 2.7):
        K.box(ex - 4.4, ex - 3.9, yy - 0.25, yy + 0.25, 0, 3.2, lin('#8a6f55'))
    K.face([(ex - 4.6, ey - 3.2, 3.5), (ex - 4.6, ey + 3.2, 3.5), (ex - 4.6, ey, 5.3)], trim)
    K.face([(ex - 4.6, ey - 3.3, 3.45), (ex + 0.2, ey - 3.3, 3.45), (ex + 0.2, ey, 5.35), (ex - 4.6, ey, 5.35)], shing)
    K.face([(ex - 4.6, ey + 3.3, 3.45), (ex - 4.6, ey, 5.35), (ex + 0.2, ey, 5.35), (ex + 0.2, ey + 3.3, 3.45)], shing)
    # glass doors under it
    D = lambda u, h, d: (ex - 0.02 - d, ey - u, h)
    K.quad(D, -2.2, 2.2, 0, 2.6, 0.01, LIT_C, LIT)
    # name letters along the north (park drive) face of the long block
    p0, p1 = G(901.7, 10875.1), G(949.9, 10888.4)
    L, Ln = frame(p1, p0)  # u runs west along the north face, d points north
    N = lambda u, h, d: L(u, h, d)
    K.text('THE CAMDEN CENTRE', N, Ln / 2, WH + 0.2, 0.12, 0.9, lin('#f2ecdc'), BODY, 0.08, res=1)
    # monument sign by the drive
    mx, my = G(886.0, 10880.0)
    K.box(mx - 0.35, mx + 0.35, my - 2.4, my + 2.4, -0.5, 0.5, lin('#9a8f80'))
    K.box(mx - 0.2, mx + 0.2, my - 2.1, my + 2.1, 0.5, 1.9, wall)
    S = lambda u, h, d: (mx - 0.2 - d, my + 2.1 - u, h)  # faces game west (US 67)
    K.text('THE CAMDEN CENTRE', S, 2.1, 1.05, 0.02, 0.36, lin('#3a2a20'), BODY, 0.05, res=1)
    lod0 = K.obj('camden_lod0')
    lod1_bands(K1, P, 0, 1, WH, wall, lit=0.5)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        ai, bi = Pin[i], Pin[(i + 1) % n]
        K1.face([(a[0], a[1], WH), (b[0], b[1], WH), (bi[0], bi[1], WH + MH), (ai[0], ai[1], WH + MH)], shing)
    K1.prism(Pin, WH + MH - 0.1, WH + MH, roofc, sides=False)
    lod1 = K1.obj('camden_lod1')
    res = finish('camden', [lod0, lod1], A)
    if render:
        res['png'] = shots('camden', (0, 0, 3), 70, lod1, views=((-120, 22), (40, 25)))
    return res


B['camden'] = camden


# ================================================================ CAMDEN PARK SHELTER
# One of Camden Park's six rentable picnic shelters: concrete slab, steel posts, hipped green metal roof, picnic
# tables and a grill. Size and colours are guesses from typical Quad Cities park shelters.
def shelter(render=True):
    K, K1 = Kit(921), Kit(922)
    W, D, PH = 6.0, 4.0, 2.9
    conc, post, roofc, wood = lin('#bdb8ae'), lin('#6b4a32'), lin('#3d6b4a'), lin('#8a6a48')
    K.box(-W - 0.5, W + 0.5, -D - 0.5, D + 0.5, -0.6, 0.15, conc)
    for x in (-W, 0, W):
        for y in (-D, D):
            K.box(x - 0.15, x + 0.15, y - 0.15, y + 0.15, 0.15, PH, post)
    K.box(-W - 0.2, W + 0.2, -D - 0.2, D + 0.2, PH, PH + 0.35, post, BODY, ())
    hip_roof(K, -W - 1.0, W + 1.0, -D - 1.0, D + 1.0, PH + 0.35, 2.4, roofc)
    for i, x in enumerate((-3.6, 0, 3.6)):
        for y in (-1.6, 1.6):
            K.box(x - 1.0, x + 1.0, y - 0.4, y + 0.4, 0.85, 0.95, wood)
            K.box(x - 1.0, x + 1.0, y - 0.95, y - 0.65, 0.5, 0.58, wood)
            K.box(x - 1.0, x + 1.0, y + 0.65, y + 0.95, 0.5, 0.58, wood)
            for xx in (x - 0.8, x + 0.8):
                K.box(xx - 0.06, xx + 0.06, y - 0.9, y + 0.9, 0.15, 0.5, lin('#3a3a3a'))
    K.box(W + 1.6, W + 2.2, -0.3, 0.3, 0, 0.9, lin('#2e2e2e'))  # grill
    K.box(W + 1.3, W + 2.5, -0.5, 0.5, 0.9, 1.1, lin('#2e2e2e'))
    lod0 = K.obj('shelter_lod0')
    K1.box(-W - 0.5, W + 0.5, -D - 0.5, D + 0.5, -0.6, 0.15, conc)
    K1.box(-W, W, -D, D, 0.15, PH + 0.35, post, BODY, ('h-', 'd-', 'd+'))
    hip_roof(K1, -W - 1.0, W + 1.0, -D - 1.0, D + 1.0, PH + 0.35, 2.4, roofc)
    lod1 = K1.obj('shelter_lod1')
    res = finish('shelter', [lod0, lod1], (0, 0))
    if render:
        res['png'] = shots('shelter', (0, 0, 2), 26, lod1, views=((-120, 22),))
    return res


B['shelter'] = shelter

if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['muni', 'camden', 'shelter']
    bpy.context.scene.name = LM_SCENE
    for nm in names:
        print('MILAN', nm, build(nm, True))
