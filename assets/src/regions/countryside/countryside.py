# Countryside region models (src/regions/countryside.js): Watch Tower Lodge, the Express Lane truck stop at I-88
# exit 10, Hennepin Canal Lock 26, a farm grain leg with bins, interstate guide signs / gantries and billboards.
# Uses the landmark kit (assets/src/landmarks.py: Kit, frame, local, windows, finish ...). References and sources:
# docs/regions/countryside.md. Headless only (another Blender UI may be open), one model per run:
#   Blender -b --factory-startup -P assets/src/regions/countryside/countryside.py -- lodge
# Conventions as landmarks.py: Blender X = game x, Blender -Y = game +z, origin = the model's anchor (game x/z) at
# its base height. Sign models: traffic drives toward game +z (Blender -Y); faces look at Blender +Y.
import sys, math
ROOT = '/Users/dainmoens/Documents/Tim Arnett Town/'
exec(open(ROOT + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/countryside/'
LOUT = OUT + 'regions/countryside/'

STONE = lin('#b5a688')     # LeClaire / native limestone, buff grey
STONE_D = lin('#94876d')
TIMBER = lin('#4e3624')
SHINGLE = lin('#5c4b3d')
CONC = lin('#bab5aa')
CONC_D = lin('#7f7b70')
GREEN = lin('#00704a')     # MUTCD guide green
WHITE = lin('#f2f2ee')
STEEL = lin('#8e9499')
GALV = lin('#b9bec2')
RED = lin('#c8102e')
YEL = lin('#ffd100')


def gable(K, x0, x1, y0, y1, z, rise, along_x, roof=SHINGLE, wall=STONE, o=0.6, fascia=TIMBER):
    """gable roof over a Blender-axis rectangle: eaves at z, ridge `rise` above, ridge along X (along_x) or Y"""
    xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
    c = Vector((xm, ym, z - 1))
    if along_x:
        K.oface([Vector(p) for p in ((x0 - o, y0 - o, z - 0.15), (x1 + o, y0 - o, z - 0.15), (x1 + o, ym, z + rise), (x0 - o, ym, z + rise))], c, roof)
        K.oface([Vector(p) for p in ((x1 + o, y1 + o, z - 0.15), (x0 - o, y1 + o, z - 0.15), (x0 - o, ym, z + rise), (x1 + o, ym, z + rise))], c, roof)
        K.oface([Vector(p) for p in ((x0, y1, z), (x0, ym, z + rise), (x0, y0, z))], c, wall)
        K.oface([Vector(p) for p in ((x1, y0, z), (x1, ym, z + rise), (x1, y1, z))], c, wall)
        K.box(x0 - o, x1 + o, y0 - o - 0.05, y0 - o + 0.15, z - 0.45, z - 0.1, fascia)
        K.box(x0 - o, x1 + o, y1 + o - 0.15, y1 + o + 0.05, z - 0.45, z - 0.1, fascia)
    else:
        K.oface([Vector(p) for p in ((x1 + o, y0 - o, z - 0.15), (x1 + o, y1 + o, z - 0.15), (xm, y1 + o, z + rise), (xm, y0 - o, z + rise))], c, roof)
        K.oface([Vector(p) for p in ((x0 - o, y1 + o, z - 0.15), (x0 - o, y0 - o, z - 0.15), (xm, y0 - o, z + rise), (xm, y1 + o, z + rise))], c, roof)
        K.oface([Vector(p) for p in ((x0, y0, z), (xm, y0, z + rise), (x1, y0, z))], c, wall)
        K.oface([Vector(p) for p in ((x1, y1, z), (xm, y1, z + rise), (x0, y1, z))], c, wall)
        K.box(x0 - o - 0.05, x0 - o + 0.15, y0 - o, y1 + o, z - 0.45, z - 0.1, fascia)
        K.box(x1 + o - 0.15, x1 + o + 0.05, y0 - o, y1 + o, z - 0.45, z - 0.1, fascia)


def of(K, pts, ctr, col, m=BODY):
    K.oface([Vector(p) for p in pts], Vector(ctr), col, m)


def walls(K, P, z0, z1, wall, bays_per=4.0, wh=0.45, glass=True, skip=()):
    """stone walls round a CCW Blender polygon with multi-pane windows (skip: edge indices left plain)"""
    n = len(P)
    for i in range(n):
        L, Ln = frame(P[i], P[(i + 1) % n])
        if i in skip or Ln < 4 or not glass:
            K.quad(L, 0, Ln, z0, z1, 0, wall)
            continue
        bays = max(1, int(Ln / bays_per))
        windows(K, L, 0.8, Ln - 0.8, z0, z1 - z0, 1, bays, wall, wf=0.45, hf=wh, rec=0.3, lit=0.5, head=TIMBER, edge=0.8, pair=True)


def rectP(x0, x1, y0, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


# ================================================================ WATCH TOWER LODGE (Black Hawk SHS)
def lodge(render=True):
    """CCC rustic lodge 1934-42 (Joseph Booton): three limestone-and-timber buildings in a row joined by a
    covered walkway, gabled shingle roofs, two big stone chimneys for the main room's fireplaces, a terrace on
    the bluff side (south, over the Rock River). Footprint: OSM way 628712511."""
    anchor = (400.0, 6560.0)
    G = lambda x, z: (x - anchor[0], -(z - anchor[1]))
    K = Kit(201, ao=4.0)
    # west building (museum): 23 x 31 m, ridge north-south
    (wx0, wy0), (wx1, wy1) = G(355.0, 6578.0), G(378.0, 6546.7)
    K.prism(rectP(wx0, wx1, wy0, wy1), -3, 0, STONE_D, top=False)
    walls(K, rectP(wx0, wx1, wy0, wy1), 0, 4.6, STONE, 3.8)
    gable(K, wx0, wx1, wy0, wy1, 4.6, 5.2, False)
    # central meeting hall: 34 x 18 m, tall, ridge east-west, vaulted
    (cx0, cy0), (cx1, cy1) = G(378.0, 6565.5), G(412.0, 6547.5)
    K.prism(rectP(cx0, cx1, cy0, cy1), -3, 0, STONE_D, top=False)
    walls(K, rectP(cx0, cx1, cy0, cy1), 0, 6.0, STONE, 3.4, wh=0.62, skip=(3,))
    gable(K, cx0, cx1, cy0, cy1, 6.0, 5.6, True)
    # the two floor-to-ceiling fireplaces: chimneys on the east gable and the north wall
    K.box(cx1 - 0.2, cx1 + 1.6, -2.2, 2.2, -1, 12.6, STONE_D)
    K.box(cx1 - 0.1, cx1 + 1.5, -1.7, 1.7, 12.6, 13.4, STONE)
    mx = (cx0 + cx1) / 2
    K.box(mx - 2.2, mx + 2.2, cy1 - 0.2, cy1 + 1.6, -1, 12.0, STONE_D)
    K.box(mx - 1.7, mx + 1.7, cy1 - 0.1, cy1 + 1.5, 12.0, 12.8, STONE)
    # timber purlin ends under the eaves
    for x in range(int(cx0) + 2, int(cx1), 3):
        for y in (cy0 - 0.5, cy1 + 0.5):
            K.box(x - 0.15, x + 0.15, y - 0.4, y + 0.4, 5.55, 5.85, TIMBER)
    # covered walkway (loggia): stone piers on the south side, lower gable roof, flagstone floor
    (lx0, ly0), (lx1, ly1) = G(412.0, 6566.0), G(430.0, 6555.8)
    K.box(lx0, lx1, ly0, ly1, -3, 0.15, STONE_D)
    K.box(lx0, lx1, ly1 - 0.5, ly1, 0, 3.4, STONE, skip=('h-', 'u-'))  # north wall (solid)
    for k in range(6):
        x = lx0 + 1.0 + k * (lx1 - lx0 - 2.0) / 5
        K.box(x - 0.55, x + 0.55, ly0 - 0.1, ly0 + 1.0, 0.15, 3.4, STONE)
    K.box(lx0, lx1, ly0 - 0.1, ly1, 3.0, 3.45, TIMBER, skip=())
    gable(K, lx0, lx1, ly0, ly1, 3.45, 2.6, True, o=0.5)
    K.face([(lx0 + 0.2, ly0 + 1.1, 0.16), (lx1 - 0.2, ly0 + 1.1, 0.16), (lx1 - 0.2, ly1 - 0.2, 0.16), (lx0 + 0.2, ly1 - 0.2, 0.16)], lin('#8a8070'))
    # east building (CCC museum): 11 x 12 m, ridge north-south
    (ex0, ey0), (ex1, ey1) = G(430.0, 6564.0), G(441.0, 6551.7)
    K.prism(rectP(ex0, ex1, ey0, ey1), -3, 0, STONE_D, top=False)
    walls(K, rectP(ex0, ex1, ey0, ey1), 0, 4.2, STONE, 3.6)
    gable(K, ex0, ex1, ey0, ey1, 4.2, 4.0, False)
    # bluff terrace south of the hall, low stone parapet
    ty0 = cy0 - 8.5
    K.box(cx0 + 2, cx1 - 2, ty0, cy0, -3, 0.2, STONE_D)
    K.face([(cx0 + 2, ty0, 0.21), (cx1 - 2, ty0, 0.21), (cx1 - 2, cy0, 0.21), (cx0 + 2, cy0, 0.21)], lin('#9a8f7c'))
    for seg in ((cx0 + 2, cx1 - 2, ty0, ty0 + 0.5), (cx0 + 2, cx0 + 2.5, ty0, cy0), (cx1 - 2.5, cx1 - 2, ty0, cy0)):
        K.box(seg[0], seg[1], seg[2], seg[3], 0.2, 1.1, STONE)
    # entrance doors (north side of the hall, timber) and the name board
    K.box(mx + 4, mx + 6.4, cy1 - 0.05, cy1 + 0.25, 0, 3.0, TIMBER)
    K.box(mx + 6.8, mx + 11.2, cy1 + 0.1, cy1 + 0.3, 3.2, 4.1, TIMBER)
    K.text('WATCH TOWER LODGE', SF(mx + 9, cy1 + 0.31), 0, 3.42, 0, 0.42, lin('#e8dcc0'), BODY, 0.03)
    # the doorway from the great hall into the Hauberg museum through the shared wall (landmarks/lodge_int.glb)
    a, b = G(378.0, 6578.0), G(378.0, 6546.7)
    cut_door(K, a, b, 6578.0 - 6557.2, 6578.0 - 6555.2, -0.5, 3.4)
    lod0 = K.obj('lodge_lod0')

    K1 = Kit(202, ao=4.0)
    for (a0, b0, a1, b1, h, r, ax) in ((wx0, wy0, wx1, wy1, 4.6, 5.2, False), (cx0, cy0, cx1, cy1, 6.0, 5.6, True),
                                       (lx0, ly0, lx1, ly1, 3.45, 2.6, True), (ex0, ey0, ex1, ey1, 4.2, 4.0, False)):
        K1.box(a0, a1, b0, b1, -3, h, STONE, skip=('h-', 'h+'))
        gable(K1, a0, a1, b0, b1, h, r, ax)
    K1.box(cx1 - 0.2, cx1 + 1.6, -2.2, 2.2, -1, 12.6, STONE_D)
    K1.box(mx - 2.2, mx + 2.2, cy1 - 0.2, cy1 + 1.6, -1, 12.0, STONE_D)
    lod1 = K1.obj('lodge_lod1')
    res = finish('lodge', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('lodge', (10, 0, 4), 70, lod1, views=((160, 18), (20, 25)))
    return res


B['lodge'] = lodge


# ================================================================ EXPRESS LANE TRUCK STOP (I-88 exit 10, Hillsdale)
def truckstop(render=True):
    """Hillsdale Express Lane (Shell fuel, diner, CAT scale #770, ~50 truck spaces), 32000 IL 2 at I-88 exit 10.
    Store and both canopies traced from OSM (ways 1558244314/5/6); the high-rise pylon faces the interstate."""
    anchor = (32590.0, -9860.0)
    loc = lambda pts: local(pts, anchor)
    K = Kit(301, ao=3.0)
    store = loc([(32600.6, -9892.0), (32587.6, -9864.7), (32572.2, -9848.3), (32585.3, -9836.1), (32588.1, -9839.1), (32590.5, -9836.8),
                 (32602.9, -9850.0), (32600.4, -9852.3), (32602.7, -9854.7), (32605.0, -9859.6), (32609.0, -9857.8), (32619.5, -9879.9),
                 (32617.2, -9881.0), (32618.5, -9883.7)])
    wall, band, roofc = lin('#d9cdb4'), lin('#8c2b23'), lin('#6d6d6a')
    H = 5.6
    K.prism(store, -1.5, 0, lin('#7a756c'), top=False)
    n = len(store)
    for i in range(n):
        L, Ln = frame(store[i], store[(i + 1) % n])
        nx = L(0, 0, 1)[0] - L(0, 0, 0)[0]
        if nx < -0.5 and Ln > 10:  # west front facing the pumps: glass storefront under a red band with the name
            storefront(K, L, 0.4, Ln - 0.4, 0, 3.4, lin('#3b3b3b'), max(2, int(Ln / 3.2)), lit=0.9, transom=False)
            K.quad(L, 0, Ln, 3.4, H, 0, wall)
            K.obox(L, -0.2, Ln + 0.2, 3.5, 4.5, 0, 0.35, band, BODY, ('d-',))
            K.text('EXPRESS LANE', L, Ln / 2, 3.65, 0.36, 0.7, WHITE, NEON, 0.06)
        else:
            K.quad(L, 0, Ln, 0, 1.0, 0, lin('#8f6b52'))
            K.quad(L, 0, Ln, 1.0, H, 0, wall)
        K.obox(L, 0, Ln, H, H + 0.8, -0.25, 0.05, band, BODY, ('h-',))
    K.prism(store, H - 0.1, H + 0.6, roofc, sides=False)
    rooftop_junk(K, 6, 0, H + 0.6, K.rnd, 4, 8)

    def canopy(pts, h, label):
        P = loc(pts)
        K.prism(P, h, h + 1.1, WHITE, top=True, topcol=lin('#cfcfcf'))
        for i in range(4):
            L, Ln = frame(P[i], P[(i + 1) % 4])
            K.obox(L, 0, Ln, h + 0.15, h + 0.45, 0, 0.03, RED, BODY, ('d-',))
            if Ln > 15:
                K.text(label, L, Ln / 2, h + 0.5, 0.04, 0.5, RED, NEON, 0.04)
        K.face([(p[0], p[1], h - 0.01) for p in P][::-1], lin('#fff3d6'), LIT)  # lit soffit
        # columns and pump islands along the canopy's long axis
        (a, b), (c, d) = P[0], P[1]
        e_, f_ = P[3]
        if math.hypot(c - a, d - b) < math.hypot(e_ - a, f_ - b):
            P = P[1:] + P[:1]
            (a, b), (c, d), (e_, f_) = P[0], P[1], P[3]
        ux, uy = c - a, d - b
        vx, vy = e_ - a, f_ - b
        Lu = math.hypot(ux, uy)
        isl = max(2, int(Lu / 8))
        for k in range(isl):
            t = (k + 0.5) / isl
            px, py = a + ux * t + vx * 0.5, b + uy * t + vy * 0.5
            K.cyl(px, py, 0.28, 0, h, lin('#d8d8d8'), BODY, 8, top=False)
            ang = math.atan2(vy, vx)
            ca, sa = math.cos(ang), math.sin(ang)
            Lr = lambda u, hh, dd: (px + ca * u - sa * dd, py + sa * u + ca * dd, hh)
            K.obox(Lr, -2.6, 2.6, 0, 0.25, -0.7, 0.7, lin('#b0aca4'), BODY)
            for s in (-1.4, 1.4):
                K.obox(Lr, s - 0.35, s + 0.35, 0.25, 1.9, -0.3, 0.3, RED if label == 'DIESEL' else lin('#e8e8e8'), BODY)
                K.obox(Lr, s - 0.3, s + 0.3, 1.2, 1.7, -0.31, 0.31, lin('#2b3a46'), GLASS)
    canopy([(32572.1, -9880.6), (32548.6, -9856.7), (32553.7, -9851.8), (32577.1, -9875.7)], 5.0, 'EXPRESS LANE')
    canopy([(32572.9, -9840.7), (32580.2, -9839.6), (32577.8, -9817.3), (32570.4, -9818.7)], 6.4, 'DIESEL')
    # high-rise pylon toward I-88 (west): red cabinet, white letters, price panel
    px, py = 32505.0 - anchor[0], -(-9775.0 - anchor[1])
    K.cyl(px, py, 0.7, -1, 26, lin('#7d8288'), BODY, 10)
    PL = lambda u, hh, dd: (px - dd, py - u, hh)  # faces west, toward I-88
    PR = lambda u, hh, dd: (px + dd, py + u, hh)
    for F in (PL, PR):
        K.obox(F, -4.2, 4.2, 26, 30.5, 0.4, 0.9, RED, BODY, ('d-',))
        K.text('EXPRESS', F, 0, 28.5, 0.92, 1.4, WHITE, NEON, 0.1)
        K.text('LANE', F, 0, 26.6, 0.92, 1.4, YEL, NEON, 0.1)
        K.obox(F, -3.6, 3.6, 22.4, 25.6, 0.4, 0.8, lin('#1d1d1f'), BODY, ('d-',))
        K.text('DIESEL 3.89', F, 0, 24.2, 0.82, 0.8, lin('#ff3b2f'), NEON, 0.06)
        K.text('DINER  CAT SCALE', F, 0, 22.9, 0.82, 0.55, WHITE, NEON, 0.05)
    K.box(px - 0.4, px + 0.4, py - 4.2, py + 4.2, 25.6, 26, lin('#5a5f64'))
    lod0 = K.obj('truckstop_lod0')

    K1 = Kit(302, ao=3.0)
    K1.prism(store, -1.5, H + 0.6, wall, top=True, topcol=roofc)
    for pts, h in (([(32572.1, -9880.6), (32548.6, -9856.7), (32553.7, -9851.8), (32577.1, -9875.7)], 5.0),
                   ([(32572.9, -9840.7), (32580.2, -9839.6), (32577.8, -9817.3), (32570.4, -9818.7)], 6.4)):
        K1.prism(loc(pts), h, h + 1.1, WHITE)
    K1.cyl(px, py, 0.7, -1, 26, lin('#7d8288'), BODY, 6)
    for F in (PL, PR):
        K1.obox(F, -4.2, 4.2, 26, 30.5, 0.4, 0.9, RED, BODY, ('d-',))
        K1.text('EXPRESS', F, 0, 28.5, 0.92, 1.4, WHITE, NEON, 0.1, res=1)
        K1.text('LANE', F, 0, 26.6, 0.92, 1.4, YEL, NEON, 0.1, res=1)
    lod1 = K1.obj('truckstop_lod1')
    res = finish('truckstop', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('truckstop', (-20, 20, 6), 110, lod1, views=((-120, 22), (200, 30)))
    return res


B['truckstop'] = truckstop


# ================================================================ HENNEPIN CANAL LOCK 26
def lock26(render=True):
    """Lock 26 (Hennepin Canal Parkway, east of Colona): 1890s-1907 unreinforced concrete lock, 170 x 35 ft chamber,
    Marshall gate (steel leaf hinged on a horizontal axis) at the lower end; the upper end is now a fixed concrete
    weir (OSM weir node 9669345862) since the canal stopped carrying boats. The canal falls westward to the Rock
    River. Chamber water from OSM way 1052166708 (x 26258..26324, z 5557..5569)."""
    anchor = (26291.0, 5563.0)
    K = Kit(401, ao=3.0)
    half, wt, top, L0 = 5.4, 2.4, 2.6, 33.0
    COP = lin('#cdc8bd')
    for s in (-1, 1):
        y0, y1 = (half, half + wt) if s > 0 else (-half - wt, -half)
        wc = (0, (half + wt / 2) * s, 0)  # inside the wall: faces drawn on it point away
        K.box(-L0, L0, y0, y1, -3.0, top, CONC, skip=('h-',))
        yi = (half - 0.02) * s
        of(K, [(-L0, yi, -3), (L0, yi, -3), (L0, yi, 0.35), (-L0, yi, 0.35)], wc, CONC_D)  # wet stain band
        for gx in (-27.6, 27.0):  # dark slots where the gates sat
            yg = (half - 0.03) * s
            of(K, [(gx, yg, -3), (gx + 1.2, yg, -3), (gx + 1.2, yg, top), (gx, yg, top)], wc, lin('#6c6960'))
        K.box(-L0, L0, y0 - 0.05, y1 + 0.05, top, top + 0.25, COP)  # coping
        ry = y1 - 0.2 if s > 0 else y0 + 0.2  # pipe railing on the land side, bollards on the chamber side
        for x in range(-32, 33, 4):
            K.box(x - 0.04, x + 0.04, ry - 0.04, ry + 0.04, top + 0.25, top + 1.3, STEEL)
            if x % 12 == 0:
                K.cyl(x, (half + 0.6) * s, 0.22, top + 0.25, top + 0.75, lin('#3d3d3d'), BODY, 6)
        K.rod((-32, ry, top + 1.25), (32, ry, top + 1.25), 0.05, STEEL)
        K.rod((-32, ry, top + 0.75), (32, ry, top + 0.75), 0.04, STEEL)
        for e in (-1, 1):  # flared wing walls at both ends
            L, Ln = frame((L0 * e, (half + wt / 2) * s), (L0 * e + 9 * e, (half + wt / 2 + 5) * s))
            K.obox(L, -0.6, Ln, -3.0, top - 0.8, -wt / 2, wt / 2, CONC)
    # upper end: fixed concrete weir across the chamber, water sheeting over its downstream face
    K.box(27.4, 30.0, -half, half, -3.0, 1.3, CONC, skip=('h-',))
    of(K, [(27.4, -half, 1.32), (27.4, half, 1.32), (25.6, half, -0.1), (25.6, -half, -0.1)], (28.7, 0, -2), lin('#d4e2e4'))
    of(K, [(30.0, -half, 1.0), (33, -half, 1.0), (33, half, 1.0), (30.0, half, 1.0)], (31.5, 0, -5), lin('#4b6a63'), GLASS)
    # lower end: the Marshall gate leaf (raised); the Parkway trail bridge just west of it is OSM (way 142285224)
    gx = -27.0
    K.box(gx - 0.3, gx + 0.3, -half, half, -1.2, 0.9, lin('#5b4636'))
    for y in (-4, -2, 0, 2, 4):
        K.box(gx - 0.4, gx + 0.4, y - 0.12, y + 0.12, -1.2, 1.0, lin('#4a4a4a'))
    for s in (-1, 1):  # gate operating stands on each wall
        K.box(gx - 0.5, gx + 0.5, (half + 0.8) * s - 0.5, (half + 0.8) * s + 0.5, top + 0.25, top + 1.2, lin('#3b4d3a'))
        K.cyl(gx, (half + 0.8) * s, 0.55, top + 1.2, top + 1.35, lin('#2f2f2f'), BODY, 10)
    # chamber water (the lower pool level)
    of(K, [(-L0, -half, -0.25), (27.4, -half, -0.25), (27.4, half, -0.25), (-L0, half, -0.25)], (0, 0, -5), lin('#3f5f58'), GLASS)
    of(K, [(-L0 - 9, -half - 4, -0.25), (-L0, -half, -0.25), (-L0, half, -0.25), (-L0 - 9, half + 4, -0.25)], (0, 0, -5), lin('#3f5f58'), GLASS)
    K.text('26', SF(-20, half + wt + 0.02), 0, 0.6, 0, 1.4, lin('#5f5b52'), BODY, 0.02)  # stencilled on the north wall
    lod0 = K.obj('lock26_lod0')
    K1 = Kit(402)
    for s in (-1, 1):
        y0, y1 = (half, half + wt) if s > 0 else (-half - wt, -half)
        K1.box(-L0, L0, y0, y1, -3.0, top, CONC, skip=('h-',))
    K1.box(27.4, 30.0, -half, half, -3.0, 1.3, CONC, skip=('h-',))
    of(K1, [(-L0, -half, -0.25), (27.4, -half, -0.25), (27.4, half, -0.25), (-L0, half, -0.25)], (0, 0, -5), lin('#3f5f58'), GLASS)
    lod1 = K1.obj('lock26_lod1')
    res = finish('lock26', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('lock26', (0, 0, 0), 60, lod1, views=((150, 28), (-60, 20)))
    return res


B['lock26'] = lock26


# ================================================================ FARM GRAIN LEG + BINS (Edford Twp farm, OSM silos)
def grainleg(render=True):
    """Corrugated galvanized bins (OSM silos 1530671790/1/2/5, 1556665162) round a 22.86 m lattice bucket-elevator
    leg (OSM 1556665163) with a distributor head and gravity spouts to every bin, plus a column grain dryer."""
    anchor = (25983.0, 7695.0)
    G = lambda x, z: (x - anchor[0], -(z - anchor[1]))
    bins = [(25975.2, 7663.1, 7.8), (26011.2, 7664.4, 7.8), (25993.3, 7662.5, 6.8), (25973.2, 7702.8, 7.8), (25991.1, 7703.5, 7.8)]
    K = Kit(501, ao=2.5)
    seg = 28
    tops = []
    for (bx, bz, r) in bins:
        cx, cy = G(bx, bz)
        eave = 1.6 * r + 0.5
        for i in range(seg):  # corrugation: alternate shades
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            p0 = (cx + math.cos(a0) * r, cy + math.sin(a0) * r)
            p1 = (cx + math.cos(a1) * r, cy + math.sin(a1) * r)
            c = GALV if i % 2 else scale(GALV, 0.86)
            K.face([(p0[0], p0[1], -0.6), (p1[0], p1[1], -0.6), (p1[0], p1[1], eave), (p0[0], p0[1], eave)], c)
        for z in (0.0, eave * 0.33, eave * 0.66):  # stiffener rings
            K.cyl(cx, cy, r + 0.05, z, z + 0.25, scale(GALV, 0.75), BODY, seg, top=False)
        K.cyl(cx, cy, r + 0.35, eave, eave + r * 0.42, lin('#c5c9cc'), BODY, seg, r1=0.9, top=False)
        K.cyl(cx, cy, 0.9, eave + r * 0.42, eave + r * 0.42 + 0.6, lin('#9da2a6'), BODY, 8)
        for k in range(3):  # roof vents
            a = 2 * math.pi * k / 3 + 0.4
            vx, vy = cx + math.cos(a) * r * 0.6, cy + math.sin(a) * r * 0.6
            K.cyl(vx, vy, 0.45, eave + r * 0.42 * 0.4, eave + r * 0.42 * 0.4 + 0.9, lin('#9da2a6'), BODY, 6)
        a = math.atan2(-cy, -cx)  # ladder on the side facing the leg
        lx, ly = cx + math.cos(a) * (r + 0.4), cy + math.sin(a) * (r + 0.4)
        K.box(lx - 0.3, lx + 0.3, ly - 0.3, ly + 0.3, 0, eave + 1.0, lin('#6f7478'), skip=('h-', 'h+'))
        tops.append((cx, cy, eave + r * 0.42 + 0.6))
    # lattice leg tower 22.86 m
    H, w = 22.86, 1.2
    for sx in (-1, 1):
        for sy in (-1, 1):
            K.box(sx * w - 0.08, sx * w + 0.08, sy * w - 0.08, sy * w + 0.08, -0.5, H, lin('#7b8084'))
    for k in range(int(H / 2.5)):
        z0, z1 = k * 2.5, (k + 1) * 2.5
        for (a, b) in (((-w, -w), (w, -w)), ((w, -w), (w, w)), ((w, w), (-w, w)), ((-w, w), (-w, -w))):
            K.rod((a[0], a[1], z0), (b[0], b[1], z1), 0.04, lin('#7b8084'))
            K.rod((a[0], a[1], z1), (b[0], b[1], z1), 0.04, lin('#7b8084'))
    K.box(-0.5, 0.5, -0.9, 0.1, -0.5, H + 1.0, lin('#a9aeb2'))  # the bucket leg casing
    K.box(-1.6, 1.6, -1.6, 1.6, H, H + 2.6, lin('#c3c7ca'))     # head house
    K.cyl(0, 0, 0.9, H - 2.0, H - 0.2, lin('#8e9397'), BODY, 8)   # distributor
    for (cx, cy, tz) in tops:
        K.rod((0, 0, H - 1.6), (cx, cy, tz), 0.16, lin('#9ea3a7'), seg=6)
    # column dryer east of the leg, with its burner housing
    dx, dy = 20.0, 5.0  # east of the farm shed (OSM 1530671794), clear of the bins
    K.box(dx - 1.6, dx + 1.6, dy - 2.4, dy + 2.4, -0.5, 13.0, lin('#d6d2c4'))
    for z in range(1, 13, 1):
        K.box(dx - 1.62, dx + 1.62, dy - 2.42, dy + 2.42, z, z + 0.15, lin('#a8a397'), skip=('h-', 'h+'))
    K.box(dx + 1.6, dx + 3.2, dy - 1.0, dy + 1.0, -0.5, 2.2, lin('#3a5a8a'))
    K.rod((0.6, -0.4, H - 3), (dx, dy, 13.0), 0.16, lin('#9ea3a7'), seg=6)
    lod0 = K.obj('grainleg_lod0')
    K1 = Kit(502)
    for (bx, bz, r) in bins:
        cx, cy = G(bx, bz)
        eave = 1.6 * r + 0.5
        K1.cyl(cx, cy, r, -0.6, eave, GALV, BODY, 12, top=False)
        K1.cyl(cx, cy, r + 0.35, eave, eave + r * 0.42, lin('#c5c9cc'), BODY, 12, r1=0.9)
    K1.box(-w, w, -w, w, -0.5, H, lin('#7b8084'))
    K1.box(-1.6, 1.6, -1.6, 1.6, H, H + 2.6, lin('#c3c7ca'))
    K1.box(dx - 1.6, dx + 1.6, dy - 2.4, dy + 2.4, -0.5, 13.0, lin('#d6d2c4'))
    lod1 = K1.obj('grainleg_lod1')
    res = finish('grainleg', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('grainleg', (5, 15, 8), 75, lod1, views=((200, 15),))
    return res


B['grainleg'] = grainleg


# ================================================================ GUIDE SIGNS, GANTRIES, BILLBOARDS
# Sign frame: viewer stands at +Y looking -Y, so u (left->right as read) runs along -X, d (out of the face) along +Y.
def SF(x0, y0):
    return lambda u, h, d: (x0 - u, y0 + d, h)


def arrow(K, L, u, h, s, col=WHITE):
    """a down-pointing lane arrow centred at (u, h), s tall, on the face plane d=0.06"""
    c = L(u, h, -1)
    of(K, [L(u - s * 0.09, h + s / 2, 0.06), L(u + s * 0.09, h + s / 2, 0.06), L(u + s * 0.09, h - s * 0.1, 0.06), L(u - s * 0.09, h - s * 0.1, 0.06)], c, col)
    of(K, [L(u - s * 0.28, h - s * 0.1, 0.06), L(u + s * 0.28, h - s * 0.1, 0.06), L(u, h - s / 2, 0.06)], c, col)


def panel(K, cx, y, h0, w, hh, lines, exit_tab=None, arrows=0, res=2):
    """green guide panel centred at Blender x=cx (face at y, looking +Y), bottom h0; lines = [(text, size), ...]"""
    L = SF(cx, y)
    K.obox(L, -w / 2, w / 2, h0, h0 + hh, -0.12, 0.0, GREEN, BODY)
    K.obox(L, -w / 2 + 0.08, w / 2 - 0.08, h0 + 0.08, h0 + hh - 0.08, 0.0, 0.02, WHITE, BODY, ('d-',))
    K.obox(L, -w / 2 + 0.16, w / 2 - 0.16, h0 + 0.16, h0 + hh - 0.16, 0.0, 0.035, GREEN, BODY, ('d-',))
    zz = h0 + hh - 0.35
    for (t, s) in lines:
        zz -= s * 1.25
        if t:
            K.text(t, L, 0, zz, 0.05, s, WHITE, BODY, 0.02, res=res)
    for k in range(arrows):
        arrow(K, L, (k - (arrows - 1) / 2) * 1.6, h0 + 0.55, 0.7)
    if exit_tab:
        tw = 0.36 * len(exit_tab) + 0.6
        K.obox(L, w / 2 - tw, w / 2, h0 + hh, h0 + hh + 0.75, -0.12, 0.0, GREEN, BODY)
        K.obox(L, w / 2 - tw + 0.07, w / 2 - 0.07, h0 + hh + 0.07, h0 + hh + 0.68, 0.0, 0.02, WHITE, BODY, ('d-',))
        K.obox(L, w / 2 - tw + 0.14, w / 2 - 0.14, h0 + hh + 0.14, h0 + hh + 0.61, 0.0, 0.035, GREEN, BODY, ('d-',))
        K.text(exit_tab, L, w / 2 - tw / 2, h0 + hh + 0.2, 0.05, 0.4, WHITE, BODY, 0.02, res=res)


def shield(K, cx, y, h0, num, s=0.9):
    """blue/red interstate shield (simplified) above a panel's text"""
    L = SF(cx, y)
    w = s * (0.9 if len(num) < 3 else 1.1)
    K.obox(L, -w / 2, w / 2, h0, h0 + s * 0.72, 0.04, 0.07, lin('#1f3f8f'), BODY, ('d-',))
    K.obox(L, -w / 2, w / 2, h0 + s * 0.72, h0 + s, 0.04, 0.07, lin('#c8102e'), BODY, ('d-',))
    K.text(num, L, 0, h0 + s * 0.12, 0.08, s * 0.5, WHITE, BODY, 0.02)


def gantry(name, cw, panels, render=True):
    """overhead box-truss gantry across a carriageway cw metres wide; panels: [(cx, w, hh, lines, tab, arrows, shield)]"""
    K = Kit(601, ao=0)
    span = cw / 2 + 4.6
    zt0, zt1 = 6.4, 8.0
    for sx in (-span, span):  # end frames: twin tubular posts with a footing
        for yy in (-0.7, 0.7):
            K.cyl(sx, yy, 0.22, -0.5, zt1 + 0.4, GALV, BODY, 8)
        K.box(sx - 0.6, sx + 0.6, -1.2, 1.2, -0.8, 0.3, CONC)
        for z in (1.5, 3.5, 5.5, zt0, zt1):
            K.rod((sx, -0.7, z), (sx, 0.7, z), 0.06, GALV)
    for yy in (-0.7, 0.7):  # four chords and the diagonals
        for z in (zt0, zt1):
            K.rod((-span, yy, z), (span, yy, z), 0.11, GALV, seg=6)
        n = int(2 * span / 1.6)
        for k in range(n):
            x0, x1 = -span + k * 2 * span / n, -span + (k + 1) * 2 * span / n
            K.rod((x0, yy, zt0), (x1, yy, zt1), 0.045, GALV)
            K.rod((x0, -0.7, zt1 if k % 2 else zt0), (x0, 0.7, zt1 if k % 2 else zt0), 0.04, GALV)
    for (cx, w, hh, lines, tab, arr, sh) in panels:
        h0 = 5.6
        panel(K, cx, 0.95, h0, w, hh, lines, tab, arr)
        if sh:
            shield(K, cx, 0.95, h0 + hh - 1.25, sh)
        for x in (cx - w / 3, cx + w / 3):
            K.box(x - 0.06, x + 0.06, 0.72, 0.84, h0 + 0.2, h0 + hh - 0.2, STEEL)
    lod0 = K.obj(name + '_lod0')
    K1 = Kit(602, ao=0)
    for sx in (-span, span):
        K1.box(sx - 0.25, sx + 0.25, -0.8, 0.8, -0.5, zt1 + 0.4, GALV)
    K1.box(-span, span, -0.7, 0.7, zt0, zt1, GALV)
    for (cx, w, hh, lines, tab, arr, sh) in panels:
        K1.obox(SF(cx, 0.95), -w / 2, w / 2, 5.6, 5.6 + hh, -0.12, 0.0, GREEN, BODY)
        K1.text(next(t for t, _ in lines if t), SF(cx, 0.95), 0, 5.6 + hh / 2 - 0.3, 0.03, 0.7, WHITE, BODY, 0.02, res=1)
    lod1 = K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], (0, 0))
    if render:
        res['png'] = shots(name, (0, 0, 7), 32, lod1, views=((180, 6),))
    return res


def ground_sign(name, cw, w, hh, lines, tab=None, sh=None, render=True):
    """ground-mounted guide sign on the right shoulder (Blender -X), two steel posts, bottom 2.2 m up"""
    K = Kit(611, ao=0)
    cx = -(cw / 2 + 5.0 + w / 2)
    h0 = 2.2
    for x in (cx - w / 3, cx + w / 3):
        K.box(x - 0.12, x + 0.12, -0.25, -0.05, -0.6, h0 + hh - 0.2, STEEL)
        K.box(x - 0.3, x + 0.3, -0.45, 0.15, -0.6, 0.15, CONC)
    panel(K, cx, 0.0, h0, w, hh, lines, tab)
    if sh:
        shield(K, cx, 0.0, h0 + hh - 1.25, sh)
    lod0 = K.obj(name + '_lod0')
    K1 = Kit(612, ao=0)
    for x in (cx - w / 3, cx + w / 3):
        K1.box(x - 0.12, x + 0.12, -0.25, -0.05, -0.6, h0, STEEL)
    K1.obox(SF(cx, 0.0), -w / 2, w / 2, h0, h0 + hh, -0.12, 0.0, GREEN, BODY)
    K1.text(lines[0][0], SF(cx, 0.0), 0, h0 + hh / 2 - 0.2, 0.03, 0.5, WHITE, BODY, 0.02, res=1)
    lod1 = K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], (0, 0))
    if render:
        res['png'] = shots(name, (cx, 0, 4), 18, lod1, views=((180, 5),))
    return res


def billboard(name, top, bottom, bg, fg, render=True):
    """interstate bulletin billboard: 14.6 x 4.3 m (48 x 14 ft) face on a 12 m steel monopole, catwalk, two lamps"""
    K = Kit(621, ao=0)
    K.cyl(0, -0.8, 0.55, -0.5, 12.0, lin('#6f7378'), BODY, 10)
    K.box(-7.5, 7.5, -1.0, -0.6, 11.6, 12.0, lin('#55595d'))
    L = SF(0, 0.0)
    K.obox(L, -7.3, 7.3, 12.0, 16.3, -0.6, 0.0, lin('#4a4d50'), BODY)
    K.obox(L, -7.15, 7.15, 12.15, 16.15, 0.0, 0.03, bg, NEON, ('d-',))
    K.text(top, L, 0, 14.4, 0.06, 1.15, fg, NEON, 0.03)
    K.text(bottom, L, 0, 12.75, 0.06, 0.8, fg, NEON, 0.03)
    K.box(-7.3, 7.3, 0.0, 1.0, 11.75, 11.9, lin('#55595d'))  # catwalk
    for x in (-4.5, 4.5):
        K.rod((x, 0.2, 11.9), (x, 1.4, 12.4), 0.05, lin('#3a3a3a'))
        K.box(x - 0.35, x + 0.35, 1.3, 1.6, 12.3, 12.55, lin('#d9d9d9'))
    lod0 = K.obj(name + '_lod0')
    K1 = Kit(622, ao=0)
    K1.cyl(0, -0.8, 0.55, -0.5, 12.0, lin('#6f7378'), BODY, 6)
    K1.obox(L, -7.3, 7.3, 12.0, 16.3, -0.6, 0.03, bg, NEON)
    K1.text(top, L, 0, 14.4, 0.06, 1.15, fg, NEON, 0.03, res=1)
    lod1 = K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], (0, 0))
    if render:
        res['png'] = shots(name, (0, 0, 13), 28, lod1, views=((180, 5),))
    return res


CW = 10.2  # game carriageway width for a 2-lane interstate (data.js edge.width)
# I-80 westbound at the I-74 / I-280 system interchange: I-280 W / I-74 E carry on through, I-80 W leaves right
B['gantry_i80w'] = lambda r=True: gantry('gantry_i80w', CW, [
    (2.3, 6.4, 3.6, [('', 0.9), ('Moline  Peoria', 0.5), ('280 W   74 E', 0.42)], None, 2, '280'),
    (-4.3, 5.2, 3.6, [('', 0.9), ('80 WEST', 0.5), ('Iowa', 0.45)], None, 1, '80')], r)
# I-74 northbound arriving at I-80: I-80 W (Iowa, Moline) through, I-80 E (Chicago) leaves right
B['gantry_i74n'] = lambda r=True: gantry('gantry_i74n', CW, [
    (2.3, 6.0, 3.6, [('', 0.9), ('80 W  74 W', 0.5), ('Iowa  Moline', 0.42)], None, 2, '80'),
    (-4.3, 5.2, 3.6, [('', 0.9), ('80 EAST', 0.5), ('Chicago', 0.45)], None, 1, '80')], r)
B['exit10w'] = lambda r=True: ground_sign('exit10w', CW, 6.6, 2.6, [('Hillsdale', 0.6), ('Port Byron  1/2 MILE', 0.4)], 'EXIT 10', None, r)
B['exit10e'] = lambda r=True: ground_sign('exit10e', CW, 6.6, 2.6, [('Hillsdale', 0.6), ('Port Byron  1/2 MILE', 0.4)], 'EXIT 10', None, r)
B['exit6w'] = lambda r=True: ground_sign('exit6w', CW, 6.0, 2.6, [('92 West', 0.6), ('Joslin  1/2 MILE', 0.4)], 'EXIT 6', None, r)
B['exit6e'] = lambda r=True: ground_sign('exit6e', CW, 6.0, 2.6, [('92 West', 0.6), ('Joslin  1/2 MILE', 0.4)], 'EXIT 6', None, r)
B['exit19e'] = lambda r=True: ground_sign('exit19e', CW, 6.6, 2.6, [('82  Geneseo', 0.6), ('Cambridge  1 MILE', 0.4)], 'EXIT 19', None, r)
B['billboard_a'] = lambda r=True: billboard('billboard_a', 'EXPRESS LANE  EXIT 10', 'DIESEL - DINER - 24 HRS', lin('#c8102e'), lin('#ffffff'), r)
B['billboard_b'] = lambda r=True: billboard('billboard_b', 'HISTORIC GENESEO', 'EXIT 19 - HENNEPIN CANAL', lin('#1d4d2b'), lin('#f4e9c8'), r)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    bpy.context.scene.name = LM_SCENE
    render = '--norender' not in argv
    for nm in [a for a in argv if not a.startswith('--')]:
        print('RESULT', nm, build(nm, render))
