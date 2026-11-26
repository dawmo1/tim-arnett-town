# Davenport (outside downtown) region models -> assets/models/regions/davenport/<name>.glb
# Uses the landmark kit (assets/src/landmarks.py: Kit, frames, finish/colour check). Headless only:
#   Blender -b --factory-startup -P assets/src/regions/davenport/davenport.py -- hosestation4 lagomarcinos dvnterminal
# References: docs/regions/davenport.md. Origin = the anchor in src/regions/davenport.js (ground: true), no heading:
# Blender X = game x, Blender Y = -game z.
import sys, math
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/landmarks.py').read(), globals())
LOUT = OUT + 'regions/davenport/'
SRC = ROOT + 'assets/src/regions/davenport/'
D = {}


def outward(p0, p1, ctr=(0, 0)):
    """wall frame on edge p0-p1 whose +d points away from ctr"""
    L, Ln = frame(p0, p1)
    m, o = L(Ln / 2, 0, 0), L(Ln / 2, 0, 1)
    if (o[0] - m[0]) * (m[0] - ctr[0]) + (o[1] - m[1]) * (m[1] - ctr[1]) < 0:
        L, Ln = frame(p1, p0)
    return L, Ln


def G(anchor):
    ax, az = anchor
    return lambda x, z: (x - ax, -(z - az))


# ---------------------------------------------------------------- HOSE STATION No. 4 (International Fire Museum)
# 2301 E 11th St, 1931: red-brick Italianate, brick quoins, hipped tile roof with one dormer over the front, a pair of
# engine doors on 11th St (north) with two big windows above, side door, short hose-drying tower at the back.
# OSM footprint 8.2 x 16.2 m (x 2797..2805.2, z -814.8..-798.6).
def hosestation4(render=True):
    anchor = (2801.1, -806.7)
    brick, quoin, stone = lin('#9a3f2c'), lin('#c46a4e'), lin('#d9cdb4')
    tile, trim, door = lin('#9c4a33'), lin('#efe8d8'), lin('#7a1f1a')
    K = Kit(41)
    W, Dp = 4.1, 8.1  # half width (x), half depth (y); front is y = +Dp (north, 11th St)
    P = rect(-W, W, -Dp, Dp)
    top = 8.2
    K.prism(P, -2.5, top, brick, top=False)
    # quoins: alternating long/short blocks at the four corners
    for cx in (-W, W):
        for cy in (-Dp, Dp):
            for i in range(int(top / 0.6)):
                lx = 0.55 if i % 2 else 0.32
                sx, sy = (1 if cx > 0 else -1), (1 if cy > 0 else -1)
                K.box(cx - sx * lx if sx > 0 else cx, cx if sx > 0 else cx + lx, cy - 0.32 if sy > 0 else cy, cy if sy > 0 else cy + 0.32,
                      i * 0.6, i * 0.6 + 0.3, quoin, BODY, ())
    # front (north): engine doors, belt, two windows, plaque
    L, Ln = frame((W, Dp), (-W, Dp))  # u from east to west along the front, d = +y
    K.obox(L, Ln / 2 - 1.9, Ln / 2 + 1.9, 0, 4.0, -0.05, 0.12, trim, BODY, ('d-', 'h-'))
    for k in (-1, 1):
        a, b = Ln / 2 + (0.05 if k > 0 else -1.6), Ln / 2 + (1.6 if k > 0 else -0.05)
        K.quad(L, a, b, 0, 3.75, 0.13, door)
        K.quad(L, a + 0.15, b - 0.15, 2.4, 3.5, 0.14, GLASS_C, GLASS)
        for r in range(3):
            K.quad(L, a + 0.2, b - 0.2, 0.3 + r * 0.7, 0.8 + r * 0.7, 0.14, scale(door, 0.8))
    belt(K, L, 0.3, Ln - 0.3, 4.35, stone, 0.15, 0.35, 0)
    windows(K, L, 1.2, Ln - 1.2, 4.7, 3.0, 1, 2, brick, wf=0.72, hf=0.75, rec=-0.04, sill=stone, head=stone, edge=0, lit=0.5)
    K.quad(L, Ln / 2 - 1.3, Ln / 2 + 1.3, 7.45, 7.95, 0.06, stone)
    K.text('HOSE No 4', L, Ln / 2, 7.53, 0.1, 0.36, lin('#3a2a20'), BODY, 0.04, res=1)
    # sides: three bays per floor, pedestrian door on the east side
    for p0, p1, dr in (((-W, Dp), (-W, -Dp), False), ((W, -Dp), (W, Dp), True)):
        L, Ln = frame(p0, p1)
        windows(K, L, 1.6, Ln - 1.6, 0.0, 3.9, 2, 3, brick, wf=0.5, hf=0.62, rec=-0.04, sill=stone, head=stone, edge=0, lit=0.4)
        if dr:
            K.quad(L, Ln - 4.4, Ln - 3.4, 0, 2.4, 0.06, door)
            K.obox(L, Ln - 4.6, Ln - 3.2, 2.4, 2.65, -0.02, 0.2, stone, BODY, ('d-',))
    L, Ln = frame((-W, -Dp), (W, -Dp))
    windows(K, L, 1.4, Ln - 1.4, 0.0, 3.9, 2, 2, brick, wf=0.45, hf=0.6, rec=-0.04, sill=stone, edge=0, lit=0.3)
    # eaves + hipped tile roof, front dormer
    K.box(-W - 0.45, W + 0.45, -Dp - 0.45, Dp + 0.45, top - 0.25, top, trim, BODY, ())
    hip_roof(K, -W - 0.45, W + 0.45, -Dp - 0.45, Dp + 0.45, top, 2.6, tile)
    dz0 = top + 0.4
    K.box(-1.1, 1.1, Dp - 1.6, Dp - 0.2, dz0 - 0.4, dz0 + 1.3, trim, BODY, ('h-',))
    K.quad(lambda u, h, d: (-u, d, h), -0.75, 0.75, dz0, dz0 + 1.0, Dp - 0.18, GLASS_C, GLASS)
    K.face([(0, Dp - 0.1, dz0 + 2.0), (1.3, Dp - 0.1, dz0 + 1.3), (-1.3, Dp - 0.1, dz0 + 1.3)], trim)
    K.face([(-1.3, Dp - 2.2, dz0 + 1.3), (0, Dp - 2.2, dz0 + 2.0), (0, Dp - 0.1, dz0 + 2.0), (-1.3, Dp - 0.1, dz0 + 1.3)], tile)
    K.face([(0, Dp - 0.1, dz0 + 2.0), (0, Dp - 2.2, dz0 + 2.0), (1.3, Dp - 2.2, dz0 + 1.3), (1.3, Dp - 0.1, dz0 + 1.3)], tile)
    # hose tower at the back (south-west corner), 13.5 m with a pyramid cap
    tx0, tx1, ty0, ty1 = -W, -W + 3.0, -Dp, -Dp + 3.0
    K.box(tx0, tx1, ty0, ty1, top, 13.0, brick, BODY, ('h-',))
    for (a, b) in (((tx0, ty0), (tx1, ty0)), ((tx1, ty0), (tx1, ty1)), ((tx1, ty1), (tx0, ty1)), ((tx0, ty1), (tx0, ty0))):
        Lt, Lnt = frame(a, b)
        K.quad(Lt, 0.9, Lnt - 0.9, 11.2, 12.4, 0.02, GLASS_C, GLASS)
    K.box(tx0 - 0.3, tx1 + 0.3, ty0 - 0.3, ty1 + 0.3, 13.0, 13.3, trim, BODY, ())
    pyramid(K, (tx0 + tx1) / 2, (ty0 + ty1) / 2, 1.8, 13.3, 1.6, tile)
    lod0 = K.obj('hosestation4_lod0')
    K1 = Kit(42)
    K1.prism(P, -2.5, top, brick, top=False)
    K1.quad(lambda u, h, d: (-u, d, h), -1.6, 1.6, 0, 3.75, Dp + 0.02, door)
    K1.quad(lambda u, h, d: (-u, d, h), -2.6, 2.6, 4.8, 7.0, Dp + 0.02, GLASS_C, GLASS)
    hip_roof(K1, -W - 0.4, W + 0.4, -Dp - 0.4, Dp + 0.4, top, 2.6, tile)
    K1.box(tx0, tx1, ty0, ty1, top, 13.0, brick, BODY, ('h-',))
    pyramid(K1, (tx0 + tx1) / 2, (ty0 + ty1) / 2, 1.6, 13.0, 1.6, tile)
    lod1 = K1.obj('hosestation4_lod1')
    res = finish('hosestation4', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('hosestation4', (0, 0, 5), 30, lod1, views=((20, 12), (160, 20)))
    return res


D['hosestation4'] = hosestation4


# ---------------------------------------------------------------- LAGOMARCINO'S (Village of East Davenport)
# 2132 E 11th St (here since 1997; the family's Moline shop dates from 1908): a two-storey 19th-century brick
# commercial block with a pastel-painted front, shop windows and an awning, at 11th & Christie. OSM footprint
# 13.2 x 26.1 m (x 2688.3..2701.5, z -882.3..-856.2): shopfronts on the 11th St (south) and Christie St (east) faces.
def lagomarcinos(render=True):
    anchor = (2694.9, -869.25)
    paint, trim, brick = lin('#e9cdc6'), lin('#f4eee0'), lin('#94503c')
    awn, sign, signtx = lin('#5b1f2a'), lin('#3d1a22'), lin('#f0d9a0')
    K = Kit(51)
    W, Dp = 6.6, 13.05  # south face y = -Dp (11th St), east face x = +W (Christie St)
    P = rect(-W, W, -Dp, Dp)
    top = 9.4
    K.prism(P, -2.5, top, brick, top=False)
    for p0, p1, front in (((-W, -Dp), (W, -Dp), True), ((W, -Dp), (W, Dp), True), ((W, Dp), (-W, Dp), False), ((-W, Dp), (-W, -Dp), False)):
        L, Ln = frame(p0, p1)
        if not front:
            windows(K, L, 1.0, Ln - 1.0, 4.3, 3.6, 1, max(1, round(Ln / 4.5)), brick, wf=0.4, hf=0.6, rec=-0.04, edge=0, lit=0.3)
            continue
        K.quad(L, 0, Ln, 0, top, 0.01, paint)
        nb = 3 if Ln < 15 else 5
        storefront(K, L, 0.7, Ln - 0.7, 0, 3.7, trim, nb, rec=-0.06, lit=0.85)
        # fabric awning over the shop windows
        a0, a1 = 0.9, Ln - 0.9
        for f, c_ in (([L(a0, 3.9, 0.05), L(a1, 3.9, 0.05), L(a1, 3.2, 1.5), L(a0, 3.2, 1.5)], awn),
                      ([L(a0, 3.2, 1.5), L(a1, 3.2, 1.5), L(a1, 2.9, 1.5), L(a0, 2.9, 1.5)], scale(awn, 0.8))):
            K.face(f, c_)
            K.face([Vector(v) - Vector((0, 0, 0.03)) for v in f[::-1]], scale(c_, 0.7))  # single-sided materials: give the awning an underside
        # sign band and name
        K.obox(L, 1.0, Ln - 1.0, 4.0, 4.8, 0.0, 0.12, sign, BODY, ('d-',))
        K.text("LAGOMARCINO'S", L, Ln / 2, 4.15, 0.14, 0.62 if Ln < 15 else 0.7, signtx, NEON, 0.05, res=1)
        windows(K, L, 1.0, Ln - 1.0, 5.0, 3.4, 1, nb, paint, wf=0.45, hf=0.68, rec=-0.04, head=trim, sill=trim, edge=0, lit=0.5, pair=True)
        cornice(K, L, 0, Ln, top + 0.6, trim, proj=0.7, depth=1.0, brackets=1.1, ext=0.1)
    roof(K, P, top, lin('#55524e'), par=brick, parh=0.6)
    lod0 = K.obj('lagomarcinos_lod0')
    K1 = Kit(52)
    K1.prism(P, -2.5, top + 0.6, paint, top=True, topcol=lin('#55524e'))
    for p0, p1 in (((-W, -Dp), (W, -Dp)), ((W, -Dp), (W, Dp))):
        L, Ln = frame(p0, p1)
        K1.quad(L, 0.8, Ln - 0.8, 0.4, 3.4, 0.03, LIT_C, LIT)
        K1.quad(L, 0.8, Ln - 0.8, 3.6, 4.6, 0.04, awn)
        K1.quad(L, 0.8, Ln - 0.8, 5.6, 7.6, 0.03, GLASS_C, GLASS)
    lod1 = K1.obj('lagomarcinos_lod1')
    res = finish('lagomarcinos', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('lagomarcinos', (0, 0, 5), 40, lod1, views=((-35, 10), (200, 25)))
    return res


D['lagomarcinos'] = lagomarcinos


# ---------------------------------------------------------------- DAVENPORT MUNICIPAL AIRPORT terminal + hangar
# 9230 Harrison St (KDVN): the 2011 FBO complex built by Carver Aero (later Revv Aviation, Jet Air since 2026):
# a 20,000 sq ft hangar with a 7,460 sq ft two-storey terminal, at the end of the entrance road. Hangar = the OSM
# footprint's 38.3 x 48.8 m main block (door on the apron, west-south-west); terminal = the wing at its north end.
def dvnterminal(render=True):
    anchor = (-638.75, -9627.55)
    g = G(anchor)
    metal, metal2, door = lin('#c9ccc9'), lin('#9da3a6'), lin('#b5babd')
    stone, glassb, blue = lin('#b8a68a'), lin('#33475a'), lin('#1f4f8f')
    K = Kit(61)
    A, B, C, Dd = (-610.0, -9617.1), (-642.5, -9596.3), (-667.4, -9638.3), (-635.1, -9658.9)
    H = ccw([g(*A), g(*B), g(*C), g(*Dd)])
    hh = 10.5
    K.prism(H, -3, hh, metal, top=False)
    # low-pitch gable roof along the long axis (A->D)
    a, b, c, d = g(*A), g(*B), g(*C), g(*Dd)
    mab, mcd = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), ((c[0] + d[0]) / 2, (c[1] + d[1]) / 2)
    rz = hh + 2.2
    K.face([(a[0], a[1], hh), (d[0], d[1], hh), (mcd[0], mcd[1], rz), (mab[0], mab[1], rz)], metal2)
    K.face([(b[0], b[1], hh), (mab[0], mab[1], rz), (mcd[0], mcd[1], rz), (c[0], c[1], hh)], metal2)
    K.face([(a[0], a[1], hh), (mab[0], mab[1], rz), (b[0], b[1], hh)], metal)
    K.face([(c[0], c[1], hh), (mcd[0], mcd[1], rz), (d[0], d[1], hh)], metal)
    # big sliding door on the apron side (B -> C faces WSW)
    L, Ln = outward(b, c)
    for k in range(4):
        u0 = 2.5 + k * (Ln - 5) / 4
        K.quad(L, u0 + 0.1, u0 + (Ln - 5) / 4 - 0.1, 0, 8.8, 0.06, door)
        for r in range(1, 8):
            K.quad(L, u0 + 0.1, u0 + (Ln - 5) / 4 - 0.1, r * 1.1, r * 1.1 + 0.08, 0.07, metal2)
    K.obox(L, 2.0, Ln - 2.0, 8.8, 9.3, 0, 0.5, metal2, BODY, ('d-',))
    K.text('DAVENPORT', L, Ln / 2, 9.4, 0.08, 1.0, blue, BODY, 0.06, res=1)
    # terminal wing: the OSM footprint's north part, two storeys, stone base, glass curtain wall, flat roof
    T = ccw([g(x, z) for x, z in [(-635.1, -9658.9), (-642.4, -9654.9), (-648.6, -9665.9), (-651.3, -9665.3), (-653.2, -9672.2),
                                    (-674.9, -9666.9), (-673.1, -9659.2), (-679.4, -9657.3), (-669.1, -9637.3), (-667.4, -9638.3)]])
    th = 8.0
    K.prism(T, -3, 1.0, stone, top=False)
    for i, L2, Ln2, mid2 in sides(T):
        if Ln2 < 2:
            K.quad(L2, 0, Ln2, 1.0, th, 0, stone)
            continue
        K.quad(L2, 0, Ln2, 1.0, th, 0, glassb, GLASS)
        n = max(1, round(Ln2 / 2.4))
        for j in range(n + 1):
            u = j * Ln2 / n
            K.obox(L2, u - 0.08, u + 0.08, 1.0, th, 0, 0.12, stone, BODY, ('d-',))
        K.obox(L2, 0, Ln2, 4.0, 4.3, 0, 0.15, stone, BODY, ('d-',))
        for f in range(2):
            K.quad(L2, 0.3, Ln2 - 0.3, 1.3 + f * 3.3, 3.8 + f * 3.3, 0.02, LIT_C if K.rnd.random() < 0.6 else glassb, LIT)
    roof(K, T, th + 0.6, lin('#6c6a66'), par=stone, parh=0.6)
    K.prism(T, th, th + 0.4, stone, top=False)
    # entrance canopy + name on the landside (north-east) face of the terminal
    e0, e1 = g(-648.6, -9665.9), g(-642.4, -9654.9)
    tc = (sum(p[0] for p in T) / len(T), sum(p[1] for p in T) / len(T))
    Le, Lne = outward(e0, e1, tc)
    K.obox(Le, -1.0, Lne + 1.0, 3.4, 3.7, 0, 4.0, lin('#e8e8e4'), BODY, ())
    for u in (-0.6, Lne + 0.6):
        K.obox(Le, u - 0.15, u + 0.15, 0, 3.4, 3.6, 3.9, lin('#e8e8e4'), BODY, ('h-',))
    s0, s1 = g(-653.2, -9672.2), g(-674.9, -9666.9)
    Ls, Lns = outward(s0, s1, tc)
    K.obox(Ls, 1.0, Lns - 1.0, th + 0.6, th + 1.9, 0, 0.2, lin('#f2f2ee'), BODY, ('d-',))
    K.text('DAVENPORT MUNICIPAL AIRPORT', Ls, Lns / 2, th + 0.95, 0.22, 0.75, blue, NEON, 0.05, res=1)
    # small south lean-to (shop/office) from the footprint
    Sx = ccw([g(x, z) for x, z in [(-610.0, -9617.1), (-614.6, -9613.6), (-617.5, -9611.4), (-613.2, -9605.0), (-629.6, -9595.9), (-633.7, -9601.6), (-642.5, -9596.3)]])
    K.prism(Sx, -3, 5.0, metal2, top=True, topcol=lin('#6c6a66'))
    # windsock on the hangar's apron corner
    wx, wy = c[0] + 6, c[1] - 3
    K.cyl(wx, wy, 0.08, 0, 7, lin('#d0d0d0'), BODY, 4)
    K.cyl(wx + 0.9, wy, 0.35, 6.4, 6.9, lin('#ff7a00'), BODY, 6, r1=0.2)
    lod0 = K.obj('dvnterminal_lod0')
    K1 = Kit(62)
    K1.prism(H, -3, hh, metal, top=False)
    K1.face([(a[0], a[1], hh), (d[0], d[1], hh), (mcd[0], mcd[1], rz), (mab[0], mab[1], rz)], metal2)
    K1.face([(b[0], b[1], hh), (mab[0], mab[1], rz), (mcd[0], mcd[1], rz), (c[0], c[1], hh)], metal2)
    K1.face([(a[0], a[1], hh), (mab[0], mab[1], rz), (b[0], b[1], hh)], metal)
    K1.face([(c[0], c[1], hh), (mcd[0], mcd[1], rz), (d[0], d[1], hh)], metal)
    K1.quad(L, 2.5, Ln - 2.5, 0, 8.8, 0.06, door)
    K1.prism(T, -3, th + 0.6, glassb, top=True, topcol=lin('#6c6a66'))
    K1.prism(Sx, -3, 5.0, metal2, top=True, topcol=lin('#6c6a66'))
    lod1 = K1.obj('dvnterminal_lod1')
    res = finish('dvnterminal', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('dvnterminal', (0, 0, 5), 90, lod1, views=((-120, 18), (60, 25)))
    return res


D['dvnterminal'] = dvnterminal

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(D)
    bpy.context.scene.name = LM_SCENE
    for n in args:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        print('RESULT', n, D[n](render='--norender' not in sys.argv))
