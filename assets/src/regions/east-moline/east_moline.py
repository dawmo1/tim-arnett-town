# East Moline region models (src/regions/east-moline.js): one GLB per place in assets/models/regions/east-moline/.
# Uses the landmark kit (assets/src/landmarks.py: Kit, windows, finish, colour check, repack). Headless only:
#   Blender -b --factory-startup -P assets/src/regions/east-moline/east_moline.py -- rustbelt campbell emarch [render]
# Footprints are the OSM outlines (game x/z). Sources and guesses: docs/regions/east-moline.md.
# Each file: <name>_lod0 + <name>_lod1, origin = the anchor in the JS module at ground level.
import sys, math
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/landmarks.py').read(), globals())
LOUT = ROOT + 'assets/models/regions/east-moline/'
SRC = ROOT + 'assets/src/regions/east-moline/'

R = {}


def flat_windows(K, L, u0, u1, h0, h1, bays, wall, wf=0.6, lit=0.35, mull=None):
    """cheap windows for the long back walls: wall quad + glass quads just proud of it (no reveals)"""
    K.quad(L, u0, u1, h0, h1, 0, wall)
    bw = (u1 - u0) / bays
    for b in range(bays):
        c = u0 + bw * (b + 0.5)
        a, z = c - bw * wf / 2, c + bw * wf / 2
        on = K.rnd.random() < lit
        K.quad(L, a, z, h0 + (h1 - h0) * 0.18, h1 - (h1 - h0) * 0.12, 0.04, LIT_C if on else GLASS_C, LIT if on else GLASS)
        if mull:
            K.quad(L, c - 0.06, c + 0.06, h0 + (h1 - h0) * 0.18, h1 - (h1 - h0) * 0.12, 0.06, mull)


# ---------------------------------------------------------------- THE RUST BELT (533 / 537 12th Ave)
# The old Moline-Knight / Moline Automobile Co. works (cars 1904-1919), later QC Metal Pickling; reopened Feb 2019
# (Streamline Architects) as a 4,000-capacity venue plus Midwest Ale Works, Iron + Grain coffee, Jennie's Boxcar,
# a salon, gym and studios. OSM relation 14963815: A = the two-storey works along 12th Ave, B = the long, narrow
# one-storey shop wing running north (the "skinny and long" hall). Brick and steel-sash windows are period guesses.
A_PTS = [(10671.0, 634.4), (10748.6, 626.7), (10750.3, 642.0), (10753.9, 641.6), (10754.9, 651.2), (10751.4, 651.4), (10755.3, 687.7),
         (10711.7, 692.0), (10712.0, 702.7), (10764.8, 697.7), (10764.7, 691.8), (10768.0, 692.0), (10768.0, 697.3), (10827.6, 691.2),
         (10823.9, 654.6), (10867.0, 650.1), (10872.6, 709.4), (10860.6, 710.7), (10861.6, 722.0), (10880.2, 720.2), (10882.6, 741.3),
         (10864.1, 743.6), (10864.0, 742.3), (10833.1, 745.5), (10830.1, 716.3), (10791.6, 721.2), (10792.9, 732.7), (10795.7, 732.3),
         (10796.2, 736.1), (10793.2, 736.5), (10794.2, 745.1), (10706.6, 755.3), (10672.1, 759.0), (10672.4, 761.7), (10662.3, 762.8),
         (10662.2, 763.7), (10649.7, 764.8), (10648.1, 752.5), (10641.0, 753.2), (10628.0, 655.9), (10626.9, 643.9), (10638.9, 648.6),
         (10643.0, 648.1), (10643.3, 650.3), (10647.5, 649.9), (10647.1, 647.7), (10662.9, 645.7), (10672.3, 645.4)]
B_PTS = [(10815.1, 632.6), (10807.5, 563.1), (10796.8, 564.6), (10795.8, 554.1), (10806.4, 553.0), (10805.6, 547.8), (10788.7, 549.4),
         (10787.3, 536.4), (10780.0, 537.2), (10779.3, 530.9), (10786.7, 530.0), (10777.5, 447.7), (10811.4, 443.8), (10814.2, 466.0),
         (10846.8, 462.7), (10860.0, 576.3), (10868.4, 575.5), (10880.9, 574.2), (10884.8, 573.7), (10899.6, 572.3), (10901.2, 587.4),
         (10907.5, 586.6), (10908.5, 597.1), (10902.4, 597.5), (10905.5, 627.4), (10874.3, 630.9), (10874.1, 628.2), (10869.8, 628.6),
         (10869.2, 623.9), (10873.5, 623.5), (10871.4, 601.8), (10862.5, 602.4), (10865.0, 626.1)]
RB_ANCHOR = (10765.0, 690.0)


def rustbelt(render=False):
    anchor = RB_ANCHOR
    G = g2l(anchor)
    A = ccw([G(*p) for p in A_PTS])
    Bw = ccw([G(*p) for p in B_PTS])
    brick, brick2, trim = lin('#8a4632'), lin('#6e3527'), lin('#b9ab94')
    roofc, sash, rust = lin('#5f5c58'), lin('#2a2c2c'), lin('#a4501f')
    K = Kit(4401)
    HA, HB = 11.3, 8.7
    front_z = 738.0  # game z: walls facing 12th Ave (south) at or past this get the shopfronts and signs
    for P, H, nfl in ((A, HA, 2), (Bw, HB, 1)):
        fh = H / nfl
        K.prism(P, -3, 0, brick2, top=False)
        for i, L, Ln, mid in sides(P):
            nrm = (Vector(L(0, 0, 1)) - Vector(L(0, 0, 0)))
            gz = anchor[1] - mid[1]
            front = P is A and nrm.y < -0.7 and gz > front_z
            if Ln < 5:
                K.quad(L, 0, Ln, 0, H, 0, brick)
                continue
            if front:
                windows(K, L, 0.8, Ln - 0.8, 0, fh, nfl, max(1, round((Ln - 1.6) / 4.2)), brick, wf=0.62, hf=0.66, rec=0.3,
                        lit=0.55, pair=True, sill=trim, edge=0.8)
                for k in range(int(Ln // 8.4) + 1):  # brick pilasters between the bays
                    K.obox(L, k * 8.4 - 0.35, k * 8.4 + 0.35, 0, H, 0, 0.35, brick2, BODY, ('d-', 'h-'))
            else:
                for f in range(nfl):
                    flat_windows(K, L, 0, Ln, f * fh, (f + 1) * fh, max(1, round(Ln / 5.5)), brick, 0.55, 0.3, sash)
            K.obox(L, -0.1, Ln + 0.1, H, H + 0.9, -0.3, 0.05, brick, BODY, ('d-', 'h-'))  # parapet
            K.quad(L, -0.1, Ln + 0.1, H + 0.9, H + 0.9, 0, trim)
            K.obox(L, -0.1, Ln + 0.1, H + 0.75, H + 1.0, -0.05, 0.2, trim, BODY, ('d-',))  # stone coping
            K.obox(L, -0.1, Ln + 0.1, 0, 0.6, -0.05, 0.12, lin('#7d7770'), BODY, ('d-', 'h-'))  # concrete water table
        K.prism(P, H - 0.05, H, roofc, sides=False)
    # B: a long sawless monitor (raised clerestory) down the middle of the hall, glazed both sides
    by0, by1 = G(0, 455)[1], G(0, 625)[1]
    bx = (G(10795, 0)[0] + G(10830, 0)[0]) / 2
    for yy0, yy1 in ((min(by0, by1), max(by0, by1)),):
        mx0, mx1 = bx - 3.5, bx + 3.5
        K.box(mx0, mx1, yy0 + 8, yy1 - 8, HB, HB + 0.4, brick2)
        for sx, d in ((mx0, -1), (mx1, 1)):
            Lm = ((lambda u, h, dd, sx=sx: (sx + dd, yy0 + 8 + u, h)) if d > 0 else (lambda u, h, dd, sx=sx: (sx - dd, yy1 - 8 - u, h)))
            flat_windows(K, Lm, 0, yy1 - yy0 - 16, HB + 0.4, HB + 2.2, int((yy1 - yy0 - 16) / 3.2), brick2, 0.8, 0.5)
        K.box(mx0 - 0.4, mx1 + 0.4, yy0 + 7.6, yy1 - 7.6, HB + 2.2, HB + 2.5, roofc)
        for yy, d in ((yy0 + 8, 1), (yy1 - 8, -1)):
            K.face([(mx0, yy, HB + 0.4), (mx1, yy, HB + 0.4), (mx1, yy, HB + 2.2), (mx0, yy, HB + 2.2)][::d], brick2)
    # rooftop units on A
    for gx, gz in ((10700, 680), (10790, 705), (10850, 690), (10660, 700)):
        x, y = G(gx, gz)
        K.box(x - 1.5, x + 1.5, y - 1.1, y + 1.1, HA, HA + 1.5, lin('#9a9a96'))
    # 12th Ave front: venue entrance (533) with a steel canopy, the big rusted-steel name on the parapet, tenant signs
    fz = 755.3  # the long front wall (10706.6, 755.3) -> (10794.2, 745.1)
    p0, p1 = G(10794.2, 745.1), G(10706.6, 755.3)
    Lf, Lnf = frame(*ccw_edge(p0, p1, A))

    o_, e_ = Vector(Lf(0, 0, 0)), Vector(Lf(1, 0, 0)) - Vector(Lf(0, 0, 0))

    def at(gx):  # u along the front wall for a game x
        return (Vector((*G(gx, 750.0), 0)) - o_).dot(e_)

    u_ent = at(10712)
    K.obox(Lf, u_ent - 4, u_ent + 4, 4.0, 4.35, 0, 3.0, sash, BODY, ('d-',))
    iface(K, [Lf(u_ent - 3.9, 3.99, 0.1), Lf(u_ent + 3.9, 3.99, 0.1), Lf(u_ent + 3.9, 3.99, 2.9), Lf(u_ent - 3.9, 3.99, 2.9)],
          Lf(u_ent, 0, 1.5), lin('#ffe3a6'), LIT)
    for du in (-3.6, 3.6):
        K.rod(Lf(u_ent + du, 4.1, 0.1), Lf(u_ent + du, 7.0, 0.1), 0.05, sash)
    K.quad(Lf, u_ent - 2.2, u_ent + 2.2, 0, 3.4, 0.02, lin('#3a2a20'))
    K.quad(Lf, u_ent - 2.0, u_ent + 2.0, 0.1, 3.2, 0.04, lin('#ffd890'), LIT)
    # THE RUST BELT: cut-steel letters standing on the parapet over the venue doors
    K.obox(Lf, u_ent - 13, u_ent + 13, HA + 0.95, HA + 1.2, -0.4, 0.05, sash, BODY, ('h-',))
    K.text('THE RUST BELT', Lf, u_ent, HA + 1.25, 0.0, 2.6, rust, NEON, 0.25, res=1, bold=0.02)
    for label, gx, col in (("MIDWEST ALE WORKS", 10735, lin('#d9b23a')), ("IRON + GRAIN", 10760, lin('#e8e2d0')),
                           ("JENNIE'S BOXCAR", 10783, lin('#c23b2a'))):
        u = at(gx)
        K.quad(Lf, u - 5.2, u + 5.2, 5.8, 6.9, 0.05, lin('#1d1d1d'))
        K.text(label, Lf, u, 6.05, 0.09, 0.7, col, NEON, 0.06, res=1)
        K.obox(Lf, u - 1.6, u + 1.6, 3.6, 3.9, 0, 1.4, sash, BODY, ('d-',))   # small door canopies
    # an old stamping press kept out front (the venue kept machinery from the works)
    x, y, _ = Lf(at(10724), 0, 3.5)
    K.box(x - 0.9, x + 0.9, y - 0.7, y + 0.7, 0, 0.5, lin('#5a5550'))
    K.box(x - 0.7, x + 0.7, y - 0.5, y + 0.5, 0.5, 2.8, rust)
    K.box(x - 0.9, x + 0.9, y - 0.6, y + 0.6, 2.8, 3.4, rust)
    lod0 = K.obj('rustbelt_lod0')

    K1 = Kit(4402)
    lod1_bands(K1, A, 0, 2, HA / 2, brick, lit=0.4)
    lod1_bands(K1, Bw, 0, 1, HB, brick, lit=0.4)
    K1.text('THE RUST BELT', Lf, u_ent, HA + 1.25, 0.0, 2.6, rust, NEON, 0.1, res=0)
    lod1 = K1.obj('rustbelt_lod1')
    res = finish('rustbelt', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('em_rustbelt', (0, -30, 5), 170, lod1, views=((10, 22), (150, 30)))
    return res


def ccw_edge(p0, p1, P):
    """the edge p0-p1 in the winding of CCW polygon P (so frame() points d outward)"""
    n = len(P)
    for i in range(n):
        a, b = P[i], P[(i + 1) % n]
        if (abs(a[0] - p0[0]) + abs(a[1] - p0[1]) < 0.01 and abs(b[0] - p1[0]) + abs(b[1] - p1[1]) < 0.01):
            return p0, p1
    return p1, p0


R['rustbelt'] = rustbelt


# ---------------------------------------------------------------- CAMPBELL'S ISLAND STATE MEMORIAL (124 Island Ave)
# 1908 granite obelisk, 35 ft, by A. L. Van der Berghen, marking the battle of 19 July 1814. An 8 ft bronze relief of
# the battle on one face of the base, Wisconsin red granite tablets on the other three; a low concrete wall with an
# inner walk round it; the 1998 peace garden: four concrete benches in a Sacred Circle with Sauk / Meskwaki mosaic
# tiles. Restored 2018 (DAR), rededicated 2020. Which way the relief faces is a guess (east, to Island Ave).
def campbell(render=False):
    anchor = (11757.0, -1637.0)
    K = Kit(4501, ao=3.0)
    gran, gran2, red = lin('#b9b7b1'), lin('#9d9b95'), lin('#8e4a3f')
    bronze, conc, walk = lin('#5d5534'), lin('#b8b3a8'), lin('#cfcabe')
    # walk and the low wall round it, open to the east
    K.cyl(0, 0, 9.0, -1.2, 0.06, walk, BODY, 28)
    for k in range(28):
        a0, a1 = 2 * math.pi * k / 28, 2 * math.pi * (k + 1) / 28
        if abs(math.atan2(math.sin((a0 + a1) / 2), math.cos((a0 + a1) / 2))) < 0.35:
            continue  # the gap faces +x (east)
        K.cyl(0, 0, 9.3, 0, 0.65, conc, BODY, 1, a0=a0, a1=a1, closed=False, top=False)
        K.cyl(0, 0, 9.0, 0, 0.65, conc, BODY, 1, a0=a1, a1=a0, closed=False, top=False)
        p = [(math.cos(a) * r, math.sin(a) * r, 0.65) for a, r in ((a0, 9.0), (a1, 9.0), (a1, 9.3), (a0, 9.3))]
        K.face(p, scale(conc, 1.05))
    K.box(9.0, 12.0, -1.2, 1.2, -0.6, 0.05, walk)  # path out to the drive
    # stepped base, the die with the relief and tablets, cap, shaft, pyramidion (total ~10.7 m = 35 ft)
    K.box(-2.0, 2.0, -2.0, 2.0, -0.6, 0.45, gran2)
    K.box(-1.6, 1.6, -1.6, 1.6, 0.45, 0.9, gran)
    K.box(-1.25, 1.25, -1.25, 1.25, 0.9, 3.2, gran)
    K.box(-1.4, 1.4, -1.4, 1.4, 3.2, 3.55, gran2)
    s0, s1, zt = 0.82, 0.5, 9.9
    ring0 = [(-s0, -s0), (s0, -s0), (s0, s0), (-s0, s0)]
    ring1 = [(-s1, -s1), (s1, -s1), (s1, s1), (-s1, s1)]
    for i in range(4):
        a, b, c, d = ring0[i], ring0[(i + 1) % 4], ring1[(i + 1) % 4], ring1[i]
        K.face([(a[0], a[1], 3.55), (b[0], b[1], 3.55), (c[0], c[1], zt), (d[0], d[1], zt)], gran)
    pyramid(K, 0, 0, s1, zt, 0.8, gran)
    # bronze relief on the east face: a dark panel with the battle in low relief (figures, the boat, the treeline)
    E = lambda u, h, d: (1.25 + d, u, h)
    K.quad(E, -1.0, 1.0, 1.15, 3.0, 0.02, bronze)
    for (u, w, h0, h1) in ((-0.7, 0.16, 1.3, 2.25), (-0.4, 0.16, 1.3, 2.3), (-0.05, 0.3, 1.3, 1.75), (0.35, 0.16, 1.3, 2.2), (0.65, 0.16, 1.3, 2.25)):
        K.obox(E, u - w / 2, u + w / 2, h0, h1, 0.02, 0.09, scale(bronze, 1.25), BODY, ('d-',))
    K.obox(E, -0.95, -0.2, 2.4, 2.6, 0.02, 0.07, scale(bronze, 1.15), BODY, ('d-',))   # the boat
    K.obox(E, 0.1, 0.95, 2.55, 2.95, 0.02, 0.06, scale(bronze, 0.85), BODY, ('d-',))   # treeline
    # red granite tablets on the other three faces
    for L in ((lambda u, h, d: (-1.25 - d, -u, h)), (lambda u, h, d: (-u, 1.25 + d, h)), (lambda u, h, d: (u, -1.25 - d, h))):
        K.quad(L, -0.85, 0.85, 1.4, 2.8, 0.02, red)
        K.text('1814', L, 0, 2.95, 0.03, 0.22, lin('#3b3b38'), BODY, 0.02, res=1)
    # peace garden: four curved benches in a circle, tiled faces, just south (its real spot is a guess)
    gx, gy, r = -4.0, -16.0, 3.2
    K.cyl(gx, gy, r + 1.6, -1.2, 0.05, walk, BODY, 20)
    tiles = [lin('#b8332b'), lin('#e0b32e'), lin('#2f5d8a'), lin('#2f7a4a')]
    for q in range(4):
        a0 = q * math.pi / 2 + 0.25
        a1 = a0 + math.pi / 2 - 0.5
        K.cyl(gx, gy, r + 0.45, 0.05, 0.45, tiles[q], BODY, 4, a0=a0, a1=a1, closed=False, top=False)
        K.cyl(gx, gy, r - 0.1, 0.05, 0.45, conc, BODY, 4, a0=a1, a1=a0, closed=False, top=False)
        for k in range(4):
            b0, b1 = a0 + (a1 - a0) * k / 4, a0 + (a1 - a0) * (k + 1) / 4
            K.face([(gx + math.cos(b) * rr, gy + math.sin(b) * rr, 0.45) for b, rr in ((b0, r - 0.1), (b1, r - 0.1), (b1, r + 0.45), (b0, r + 0.45))], conc)
    lod0 = K.obj('campbell_lod0')
    K1 = Kit(4502)
    K1.box(-2.0, 2.0, -2.0, 2.0, -0.6, 0.9, gran2)
    K1.box(-1.4, 1.4, -1.4, 1.4, 0.9, 3.55, gran)
    for i in range(4):
        a, b, c, d = ring0[i], ring0[(i + 1) % 4], ring1[(i + 1) % 4], ring1[i]
        K1.face([(a[0], a[1], 3.55), (b[0], b[1], 3.55), (c[0], c[1], zt), (d[0], d[1], zt)], gran)
    pyramid(K1, 0, 0, s1, zt, 0.8, gran)
    lod1 = K1.obj('campbell_lod1')
    res = finish('campbell', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('em_campbell', (0, 0, 4), 26, lod1, views=((60, 15), (220, 25)))
    return res


R['campbell'] = campbell


# ---------------------------------------------------------------- 15TH AVENUE ARCH (downtown gateway)
# The 2025-26 RAISE streetscape put decorative arches over 15th Avenue and a gateway at 7th Street (Hutchison
# Engineering project page). The exact design isn't published: brick piers with lanterns, a black steel truss arch and
# a lit DOWNTOWN EAST MOLINE panel are a guess. Built across Blender Y (the road runs along X); h aligns it in the JS.
def emarch(render=False):
    anchor = (0.0, 0.0)
    K = Kit(4601, ao=2.0)
    brick, cap, steel, panel = lin('#7e3b2b'), lin('#c7bfae'), lin('#1d1f21'), lin('#20352a')
    half = 7.6
    for sy in (-half, half):
        K.box(-0.55, 0.55, sy - 0.55, sy + 0.55, -0.5, 5.6, brick)
        K.box(-0.65, 0.65, sy - 0.65, sy + 0.65, -0.5, 0.5, cap)
        K.box(-0.65, 0.65, sy - 0.65, sy + 0.65, 5.6, 5.9, cap)
        K.cyl(0, sy, 0.22, 5.9, 6.6, steel, BODY, 6)
        K.cyl(0, sy, 0.3, 6.6, 7.2, lin('#ffe9b0'), LIT, 6)
        K.cyl(0, sy, 0.34, 7.2, 7.45, steel, BODY, 6, r1=0.05)
    # two curved chords joined by verticals (a shallow steel truss arch from pier top to pier top)
    n = 16
    rise = 2.3
    pts = [(-half + 2 * half * i / n) for i in range(n + 1)]
    lo = [(y, 5.9 + rise * (1 - (y / half) ** 2)) for y in pts]
    hi = [(y, z + 0.75) for y, z in lo]
    for xo in (-0.25, 0.25):
        for ch in (lo, hi):
            for i in range(n):
                K.rod((xo, ch[i][0], ch[i][1]), (xo, ch[i + 1][0], ch[i + 1][1]), 0.07, steel)
        for i in range(1, n):
            K.rod((xo, lo[i][0], lo[i][1]), (xo, hi[i][0], hi[i][1]), 0.04, steel)
    # the name panel hanging from the crown, lit lettering both faces
    K.box(-0.12, 0.12, -4.6, 4.6, 6.05, 7.15, panel)
    for d, L in ((1, lambda u, h, dd: (0.12 + dd, u, h)), (-1, lambda u, h, dd: (-0.12 - dd, -u, h))):
        K.text('DOWNTOWN', L, 0, 6.7, 0.0, 0.38, lin('#f3d27a'), NEON, 0.05, res=1)
        K.text('EAST MOLINE', L, 0, 6.18, 0.0, 0.45, lin('#ffffff'), NEON, 0.05, res=1)
    for y in (-3.6, 3.6):
        K.rod((0, y, 7.15), (0, y, 5.9 + rise * (1 - (y / half) ** 2)), 0.03, steel)
    lod0 = K.obj('emarch_lod0')
    K1 = Kit(4602)
    for sy in (-half, half):
        K1.box(-0.55, 0.55, sy - 0.55, sy + 0.55, -0.5, 5.9, brick)
    for i in range(n):
        K1.rod((0, lo[i][0], lo[i][1] + 0.35), (0, lo[i + 1][0], lo[i + 1][1] + 0.35), 0.3, steel)
    K1.box(-0.12, 0.12, -4.6, 4.6, 6.05, 7.15, panel)
    lod1 = K1.obj('emarch_lod1')
    res = finish('emarch', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('em_arch', (0, 0, 5), 24, lod1, views=((70, 8), (20, 20)))
    return res


R['emarch'] = emarch

if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(R)
    render = 'render' in names
    names = [n for n in names if n != 'render']
    bpy.context.scene.name = LM_SCENE
    for n in names:
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        print('EM', n, R[n](render))
