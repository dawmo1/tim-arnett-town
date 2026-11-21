# Port Byron region models (src/regions/port-byron.js): one GLB per place in assets/models/regions/port-byron/.
# Uses the landmark kit (assets/src/landmarks.py: Kit, finish, colour check, repack). Headless only:
#   Blender -b --factory-startup -P assets/src/regions/port-byron/port_byron.py -- willrolling blacksstore gazebo [render]
# Each file: <name>_lod0 + <name>_lod1, origin = the anchor in the JS module at ground level (ground: true).
# Sources and what is guessed: docs/regions/port-byron.md.
import sys, math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/landmarks.py').read(), globals())
LOUT = ROOT + 'assets/models/regions/port-byron/'
SRC = ROOT + 'assets/src/regions/port-byron/'
R = {}


def ring(K, c, r, axis_u, axis_v, w, col, seg=20, rr=0.09):
    """a wheel rim: rods round a circle in the plane of unit vectors axis_u/axis_v, w apart sideways (x)"""
    pts = [Vector(c) + (axis_u * math.cos(2 * math.pi * k / seg) + axis_v * math.sin(2 * math.pi * k / seg)) * r for k in range(seg)]
    for k in range(seg):
        K.rod(pts[k], pts[(k + 1) % seg], rr, col, BODY, 4)
    return pts


# ---------------------------------------------------------------- Will B. Rolling (2013)
# 120 S Main St riverfront, beside the Great River Trail: a 30 ft FAST Corp. fibreglass rider on an 1890s
# penny-farthing (cast from Sparta WI's "Ben Bikin'" mould), recoloured for Port Byron: blue jacket, white trousers,
# John Deere green tie and hat band, handlebar moustache. On a concrete slab. Faces north, up the river.
def willrolling(render=False):
    K = Kit(501, ao=1.5)
    conc, blk, rim, blue, white, skin, green, cap, brown = (lin('#b9b4aa'), lin('#1c1c1c'), lin('#2a2a2a'), lin('#1f4f9a'),
        lin('#efefea'), lin('#e2b08c'), lin('#367c2b'), lin('#1d3a6e'), lin('#5a3a22'))
    B = 0.45  # slab top
    K.box(-2.2, 2.2, -4.2, 4.6, -0.6, B, conc)
    K.box(-2.2, 2.2, 4.6, 4.9, -0.6, B - 0.1, scale(conc, 0.85))
    X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    fc = Vector((0, 1.3, B + 2.55))   # front hub
    rc = Vector((0, -2.6, B + 0.8))   # rear hub
    for s in (-0.12, 0.12):
        pts = ring(K, fc + X * s, 2.5, Y, Z, 0, rim, 24, 0.08)
        for k in range(0, 24, 2):
            K.rod(fc + X * s * 2.2, pts[k], 0.025, lin('#9a9a9a'), BODY, 3)
    K.rod(fc - X * 0.35, fc + X * 0.35, 0.16, blk, BODY, 6)  # hub
    ring(K, rc, 0.8, Y, Z, 0, rim, 14, 0.07)
    K.rod(rc - X * 0.18, rc + X * 0.18, 0.1, blk, BODY, 6)
    top = fc + Vector((0, -0.25, 2.65))  # head of the fork
    for s in (-0.22, 0.22):
        K.rod(fc + X * s, top + X * s * 0.4, 0.07, blk, BODY, 4)
    # backbone: a curve hugging the big wheel down to the little one
    bb = [top + Vector((0, -0.2, -0.1))] + [fc + Vector((0, -math.sin(a) * 2.75, math.cos(a) * 2.75)) for a in (0.55, 0.95, 1.35, 1.75)] + [rc + Vector((0, 0.2, 0.25))]
    for a, b in zip(bb, bb[1:]):
        K.rod(a, b, 0.09, blk, BODY, 5)
    K.rod(rc + Vector((0, 0.15, 0.25)), rc + X * 0.15, 0.04, blk, BODY, 3)
    hb = top + Vector((0, 0.25, 0.55))
    K.rod(top, hb, 0.06, blk, BODY, 4)
    K.rod(hb - X * 0.75 + Vector((0, -0.25, -0.12)), hb + X * 0.75 + Vector((0, -0.25, -0.12)), 0.05, blk, BODY, 4)
    K.rod(hb - X * 0.75 + Vector((0, -0.25, -0.12)), hb - X * 0.2, 0.05, blk, BODY, 4)
    K.rod(hb + X * 0.75 + Vector((0, -0.25, -0.12)), hb + X * 0.2, 0.05, blk, BODY, 4)
    seat = top + Vector((0, -0.75, 0.15))
    K.box(seat.x - 0.28, seat.x + 0.28, seat.y - 0.4, seat.y + 0.3, seat.z - 0.08, seat.z + 0.1, brown)
    # rider: legs down to the pedals on the front hub (one forward, one back), torso leaning a little forward
    hip = seat + Vector((0, 0, 0.35))
    for s, ph in ((-1, 0.6), (1, 0.6 + math.pi)):
        ped = fc + X * s * 0.42 + Vector((0, math.sin(ph) * 0.45, -math.cos(ph) * 0.45))
        knee = (hip + ped) / 2 + Vector((0, 0.55, 0.25)) + X * s * 0.08
        h_ = hip + X * s * 0.24
        K.rod(h_, knee, 0.22, white, BODY, 6)
        K.rod(knee, ped + Vector((0, 0, 0.12)), 0.17, white, BODY, 6)
        K.rod(ped + Vector((0, -0.1, 0.05)), ped + Vector((0, 0.35, 0.05)), 0.12, blk, BODY, 4)  # shoe
    sh = hip + Vector((0, 0.3, 1.75))  # shoulders
    tc = Vector((0, hip.y + 0.15, (hip.z + sh.z) / 2))
    of = lambda pts, col, c=tc: K.oface([Vector(q) for q in pts], c, col)
    for z0, z1, w0, w1 in ((hip.z - 0.1, hip.z + 0.35, 0.38, 0.4), (hip.z + 0.35, sh.z, 0.4, 0.46)):
        f0, f1 = (z0 - hip.z) / 1.75 * 0.3, (z1 - hip.z) / 1.75 * 0.3
        of([(-w0, hip.y - 0.24 + f0, z0), (w0, hip.y - 0.24 + f0, z0), (w1, hip.y - 0.24 + f1, z1), (-w1, hip.y - 0.24 + f1, z1)], blue)
        of([(w0, hip.y + 0.24 + f0, z0), (-w0, hip.y + 0.24 + f0, z0), (-w1, hip.y + 0.24 + f1, z1), (w1, hip.y + 0.24 + f1, z1)], blue)
        of([(w0, hip.y - 0.24 + f0, z0), (w0, hip.y + 0.24 + f0, z0), (w1, hip.y + 0.24 + f1, z1), (w1, hip.y - 0.24 + f1, z1)], blue)
        of([(-w0, hip.y + 0.24 + f0, z0), (-w0, hip.y - 0.24 + f0, z0), (-w1, hip.y - 0.24 + f1, z1), (-w1, hip.y + 0.24 + f1, z1)], blue)
    of([(-0.46, sh.y - 0.24, sh.z), (0.46, sh.y - 0.24, sh.z), (0.46, sh.y + 0.24, sh.z), (-0.46, sh.y + 0.24, sh.z)], blue)
    of([(-0.12, sh.y + 0.25, sh.z - 0.15), (0.12, sh.y + 0.25, sh.z - 0.15), (0.05, sh.y + 0.27, sh.z - 0.75), (-0.05, sh.y + 0.27, sh.z - 0.75)], green, sh - Vector((0, 1, 0.4)))  # tie
    of([(-0.18, sh.y + 0.245, sh.z - 0.02), (0.18, sh.y + 0.245, sh.z - 0.02), (0.12, sh.y + 0.25, sh.z - 0.4), (-0.12, sh.y + 0.25, sh.z - 0.4)], white, sh - Vector((0, 1, 0.2)))  # shirt front
    for s in (-1, 1):  # arms to the grips
        a0 = sh + X * s * 0.5
        g = hb + X * s * 0.7 + Vector((0, -0.25, -0.12))
        el = (a0 + g) / 2 + Vector((0, -0.1, -0.15)) + X * s * 0.12
        K.rod(a0, el, 0.15, blue, BODY, 6)
        K.rod(el, g, 0.13, blue, BODY, 6)
        K.rod(g - X * s * 0.08, g + X * s * 0.1, 0.11, skin, BODY, 5)
    K.cyl(0, sh.y + 0.05, 0.13, sh.z, sh.z + 0.18, skin, BODY, 8)  # neck
    hc = Vector((0, sh.y + 0.08, sh.z + 0.48))
    K.cyl(hc.x, hc.y, 0.27, hc.z - 0.3, hc.z + 0.05, skin, BODY, 10, r1=0.3)
    K.cyl(hc.x, hc.y, 0.3, hc.z + 0.05, hc.z + 0.28, skin, BODY, 10, r1=0.24)
    K.box(-0.24, 0.24, hc.y + 0.24, hc.y + 0.33, hc.z - 0.1, hc.z - 0.03, brown)  # handlebar moustache
    K.box(-0.32, -0.22, hc.y + 0.24, hc.y + 0.3, hc.z - 0.05, hc.z + 0.02, brown)
    K.box(0.22, 0.32, hc.y + 0.24, hc.y + 0.3, hc.z - 0.05, hc.z + 0.02, brown)
    for s in (-0.11, 0.11):
        K.box(s - 0.04, s + 0.04, hc.y + 0.27, hc.y + 0.3, hc.z + 0.08, hc.z + 0.13, blk)  # eyes
    K.cyl(hc.x, hc.y - 0.02, 0.32, hc.z + 0.18, hc.z + 0.42, cap, BODY, 12, r1=0.3)
    K.cyl(hc.x, hc.y - 0.02, 0.325, hc.z + 0.2, hc.z + 0.28, green, BODY, 12, top=False)
    K.box(-0.26, 0.26, hc.y + 0.2, hc.y + 0.55, hc.z + 0.17, hc.z + 0.22, cap)  # peak
    # plaque on the slab's north end
    F = lambda u, h, d: (u, 4.6 + d, h)
    K.box(-1.0, 1.0, 4.0, 4.5, B, B + 0.9, lin('#6e6a62'))
    K.text('WILL B. ROLLING', F, 0, B + 0.45, -0.08, 0.22, lin('#e8d9a0'), BODY, 0.03, res=1)
    lod0 = K.obj('willrolling_lod0')
    K1 = Kit(502, ao=0)
    K1.box(-2.2, 2.2, -4.2, 4.6, -0.6, B, conc)
    pts = [fc + (Y * math.cos(2 * math.pi * k / 10) + Z * math.sin(2 * math.pi * k / 10)) * 2.5 for k in range(10)]
    for k in range(10):
        K1.rod(pts[k], pts[(k + 1) % 10], 0.12, rim, BODY, 3)
    K1.rod(rc + Z * 0.8, rc - Z * 0.8, 0.12, rim, BODY, 3)
    K1.box(-0.4, 0.4, hip.y - 0.25, hip.y + 0.55, hip.z - 0.1, sh.z, blue)
    K1.box(-0.25, 0.25, hip.y - 0.1, hip.y + 0.7, hip.z - 2.6, hip.z, white)
    K1.box(-0.3, 0.3, hc.y - 0.3, hc.y + 0.3, hc.z - 0.3, hc.z + 0.42, skin)
    lod1 = K1.obj('willrolling_lod1')
    res = finish('willrolling', [lod0, lod1], (20058.0, -9032.0))
    if render:
        res['png'] = shots('pb_willrolling', (0, 0, 4.5), 16, lod1, views=((60, 12), (160, 20)))
    return res


R['willrolling'] = willrolling


# ---------------------------------------------------------------- Black's Store (Brettun & Black, 1849)
# 1st Ave at 6th St, Hampton (NRHP 76000727): three-storey brick mercantile store, once the largest store in
# northwest Illinois, riverboat and Galena stagecoach stop; now the Hampton Historical Society museum.
# Footprint = OSM way 758040568 (9.3 x 16.2 m). Assumed: red brick, side-gable roof with the ridge along 1st Ave,
# shopfront with doors and big sash windows on the 1st Ave (east) side, stone lintels, end chimneys.
BS = [(13603.8, -3692.0), (13608.1, -3707.6), (13617.1, -3705.1), (13612.8, -3689.6)]


def blacksstore(render=False):
    anchor = (13610.45, -3698.6)
    G = g2l(anchor)
    P = ccw([G(*p) for p in BS])
    brick, brick2, stone, trim, roofc, door, sash = (lin('#9b4a33'), lin('#874030'), lin('#d9cfba'), lin('#f1ece0'),
        lin('#4b4a48'), lin('#3e2a1e'), lin('#efeee8'))
    K = Kit(511, ao=4)
    FH, NF = 3.5, 3
    H = FH * NF + 0.3
    sd = list(sides(P))
    # the long sides are the ones ~16 m long; front = the one facing east (1st Ave)
    longs = [s for s in sd if s[2] > 12]
    front = max(longs, key=lambda s: s[3][0])[0]
    for i, L, Ln, mid in sd:
        K.quad(L, 0, Ln, -3, 0.0, 0, scale(stone, 0.8))   # stone foundation showing on the slope
        if Ln < 12:  # gable ends: windows and a gable
            windows(K, L, 1.2, Ln - 1.2, 0.5, FH, NF, 2, brick, wf=0.42, hf=0.62, head=stone, sill=stone, edge=1.2, lit=0.3)
            K.quad(L, 0, Ln, 0, 0.5, 0, brick2)
            K.face([L(0, H, 0), L(Ln, H, 0), L(Ln / 2, H + 3.2, 0)], brick)
            K.quad(L, Ln / 2 - 0.35, Ln / 2 + 0.35, H + 0.9, H + 1.9, -0.05, GLASS_C, GLASS)
            K.obox(L, Ln / 2 - 0.6, Ln / 2 + 0.6, H + 1.6, H + 5.0, -0.6, 0.0, brick2, BODY, ('d+', 'h-'))  # end chimney
            continue
        if i == front:
            windows(K, L, 0.8, Ln - 0.8, FH + 0.5, FH, 2, 5, brick, wf=0.48, hf=0.62, head=stone, sill=stone, edge=0.8, lit=0.4)
            K.quad(L, 0, Ln, 0, 0.5, 0, brick2)
            # shopfront: pilasters, two doors and four big display windows under a painted sign band
            storefront(K, L, 0.6, Ln - 0.6, 0.5, FH + 0.3, trim, 5, rec=0.3, lit=0.6)
            K.quad(L, 0, 0.6, 0.5, FH + 0.5, 0, brick)
            K.quad(L, Ln - 0.6, Ln, 0.5, FH + 0.5, 0, brick)
            K.quad(L, 0.6, Ln - 0.6, FH + 0.3, FH + 0.5, 0, brick)
            K.obox(L, 1.0, Ln - 1.0, FH + 0.55, FH + 1.25, 0, 0.1, lin('#efe6cc'), BODY, ('d-',))
            K.text('BRETTUN & BLACK  1849', L, Ln / 2, FH + 0.68, 0.11, 0.42, lin('#3b2a1a'), BODY, 0.03, res=1)
            for u in (Ln * 0.3, Ln * 0.7):  # wooden steps up to the doors
                K.obox(L, u - 0.9, u + 0.9, -0.6, 0.5, 0, 1.2, lin('#8a8478'), BODY, ('d-',))
        else:
            windows(K, L, 0.8, Ln - 0.8, 0.5, FH, NF, 5, brick, wf=0.45, hf=0.62, head=stone, sill=stone, edge=0.8, lit=0.3)
            K.quad(L, 0, Ln, 0, 0.5, 0, brick2)
        K.obox(L, -0.2, Ln + 0.2, H - 0.35, H, -0.05, 0.25, trim, BODY, ('d-',))  # eave board
    # side-gable roof, ridge along the long axis
    a, b = [s for s in sd if s[2] < 12]
    pa, pb = a[1](a[2] / 2, 0, 0), b[1](b[2] / 2, 0, 0)
    ra, rb = (pa[0], pa[1], H + 3.2), (pb[0], pb[1], H + 3.2)
    for i, L, Ln, mid in sd:
        if Ln < 12:
            continue
        p0, p1 = L(-0.3, H, 0.45), L(Ln + 0.3, H, 0.45)
        r0, r1 = (ra, rb) if math.dist(p0[:2], ra[:2]) < math.dist(p0[:2], rb[:2]) else (rb, ra)
        oc = (sum(p[0] for p in P) / 4, sum(p[1] for p in P) / 4, 0)
        K.oface([Vector(p0), Vector(p1), Vector(r1), Vector(r0)], Vector((oc[0], oc[1], H)), roofc)
    lod0 = K.obj('blacksstore_lod0')
    K1 = Kit(512, ao=0)
    K1.prism(P, -3, H, brick, top=False)
    for i, L, Ln, mid in sd:
        if Ln < 12:
            K1.face([L(0, H, 0), L(Ln, H, 0), L(Ln / 2, H + 3.2, 0)], brick)
        else:
            for f in range(NF):
                K1.quad(L, 1, Ln - 1, 0.5 + f * FH + 1.0, 0.5 + f * FH + 2.8, 0.03, GLASS_C, GLASS)
            p0, p1 = L(0, H, 0), L(Ln, H, 0)
            r0, r1 = (ra, rb) if math.dist(p0[:2], ra[:2]) < math.dist(p0[:2], rb[:2]) else (rb, ra)
            K1.oface([Vector(p0), Vector(p1), Vector(r1), Vector(r0)], Vector((0, 0, H)), roofc)
    lod1 = K1.obj('blacksstore_lod1')
    res = finish('blacksstore', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('pb_blacksstore', (0, 0, 6), 38, lod1, views=((70, 12), (230, 25)))
    return res


R['blacksstore'] = blacksstore


# ---------------------------------------------------------------- Shuler's Shady Grove Park gazebo, Rapids City
# 1st Ave & 11th St: the village's riverside park with the public boat ramp, a gazebo with a scenic overlook and a
# stretch of the Great River Trail (rapidscity.us). Assumed: white octagonal timber gazebo, green shingle roof,
# on a low concrete pad.
def cone(K, n, r, z0, z1, col):
    p = [(math.cos(2 * math.pi * (k + 0.5) / n) * r, math.sin(2 * math.pi * (k + 0.5) / n) * r, z0) for k in range(n)]
    for k in range(n):
        K.face([p[k], p[(k + 1) % n], (0, 0, z1)], col)
    K.face(p[::-1], scale(col, 0.7))


def gazebo(render=False):
    K = Kit(521, ao=2)
    white, roofc, conc, deck = lin('#f2f1ec'), lin('#3f5e3a'), lin('#bdb8ae'), lin('#9a7b5a')
    n, r = 8, 3.0
    pt = lambda rr, k: (math.cos(2 * math.pi * (k + 0.5) / n) * rr, math.sin(2 * math.pi * (k + 0.5) / n) * rr)
    K.prism([pt(r + 0.4, k) for k in range(n)], -0.8, 0.45, conc, topcol=deck)
    for k in range(n):
        x, y = pt(r, k)
        K.box(x - 0.09, x + 0.09, y - 0.09, y + 0.09, 0.45, 3.0, white)
        x2, y2 = pt(r, k + 1)
        if k != 0:  # railing everywhere but the entrance (south-west side)
            K.rod((x, y, 1.35), (x2, y2, 1.35), 0.05, white, BODY, 4)
            K.rod((x, y, 0.6), (x2, y2, 0.6), 0.04, white, BODY, 4)
            for t in (0.25, 0.5, 0.75):
                K.rod((x + (x2 - x) * t, y + (y2 - y) * t, 0.6), (x + (x2 - x) * t, y + (y2 - y) * t, 1.35), 0.025, white, BODY, 3)
        K.rod((x, y, 2.85), (x2, y2, 2.85), 0.07, white, BODY, 4)
    K.cyl(0, 0, r + 0.5, 3.0, 3.0, roofc, BODY, n, a0=math.pi / n)
    cone(K, n, r + 0.5, 3.0, 4.7, roofc)
    K.cyl(0, 0, r + 0.5, 2.9, 3.0, white, BODY, n, a0=math.pi / n, top=False)
    K.cyl(0, 0, 0.12, 4.6, 5.2, white, BODY, 6, r1=0.04)
    lod0 = K.obj('gazebo_lod0')
    K1 = Kit(522, ao=0)
    K1.prism([pt(r + 0.4, k) for k in range(n)], -0.8, 0.45, conc, topcol=deck)
    for k in range(0, n, 2):
        x, y = pt(r, k)
        K1.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0.45, 3.0, white)
    cone(K1, n, r + 0.5, 3.0, 4.7, roofc)
    lod1 = K1.obj('gazebo_lod1')
    res = finish('gazebo', [lod0, lod1], (19646.0, -6582.0))
    if render:
        res['png'] = shots('pb_gazebo', (0, 0, 2), 14, lod1, views=((40, 15),))
    return res


R['gazebo'] = gazebo

if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(R)
    render = 'render' in names
    names = [n for n in names if n != 'render'] or list(R)
    bpy.context.scene.name = LM_SCENE
    for n in names:
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        print('PB', n, R[n](render))
