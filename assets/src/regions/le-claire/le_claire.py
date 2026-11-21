# Le Claire signature models (town agent): GLBs in assets/models/regions/le-claire/, sources next to this file.
# Built on the landmark kit (assets/src/landmarks.py: same conventions, vertex colours, lod0/lod1, repack).
# Headless only:  Blender -b --factory-startup -P le_claire.py -- distillery bard twilight freedomrock
# References: docs/regions/le-claire.md. [G] = guess (no photo source could be read).
import sys, math
ROOT = '/Users/dainmoens/Documents/Tim Arnett Town/'
exec(open(ROOT + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/le-claire/'
LOUT = ROOT + 'assets/models/regions/le-claire/'
REG = {}


def gable(K, x0, x1, y0, y1, z, rh, roofc, wall, ov=0.4):
    """gable roof with the ridge along x (gable ends face -x / +x), eaves overhang ov"""
    ym = (y0 + y1) / 2
    a, b = x0 - ov, x1 + ov
    K.face([(a, y0 - ov, z - 0.15), (b, y0 - ov, z - 0.15), (b, ym, z + rh), (a, ym, z + rh)], roofc)
    K.face([(b, y1 + ov, z - 0.15), (a, y1 + ov, z - 0.15), (a, ym, z + rh), (b, ym, z + rh)], roofc)
    K.face([(x0, y1, z), (x0, y0, z), (x0, ym, z + rh)], wall)
    K.face([(x1, y0, z), (x1, y1, z), (x1, ym, z + rh)], wall)
    # undersides of the overhang so it isn't see-through from below
    K.face([(a, ym, z + rh - 0.05), (b, ym, z + rh - 0.05), (b, y0 - ov, z - 0.2), (a, y0 - ov, z - 0.2)], scale(roofc, 0.6))
    K.face([(a, y1 + ov, z - 0.2), (b, y1 + ov, z - 0.2), (b, ym, z + rh - 0.05), (a, ym, z + rh - 0.05)], scale(roofc, 0.6))


# ================================================================ MISSISSIPPI RIVER DISTILLING CO.
# 303 N Cody Rd (opened 2010; the still "Rose" with two copper columns is seen from the street and the tasting room).
# OSM way 791117506. Tan brick [G: "tan brick building", Thunder Roads 2014], two storeys on Cody Rd under a gable
# roof [G], a lower level exposed on the river side (the land drops ~3 m east), river-view deck [G], copper cupola [G].
def distillery(render=True):
    anchor = (19512.7, -8418.8)  # middle of the Cody Rd (west) front, at street level
    G = g2l(anchor)
    brick, trim, roofc, copper = lin('#b8996e'), lin('#efe6d2'), lin('#3c4a40'), lin('#b8733a')
    x0, y0 = G(19512.7, -8409.8)
    x1, y1 = G(19528.8, -8427.5)
    y0, y1 = min(y0, y1), max(y0, y1)
    P = rect(x0, x1, y0, y1)
    K = Kit(501)
    H = 8.0
    for i, L, Ln, mid in sides(P):
        front = mid[0] < x0 + 0.5
        river = mid[0] > x1 - 0.5
        K.quad(L, 0, Ln, -4.5, 0, 0, scale(brick, 0.82))  # footing / exposed lower level
        if front:
            storefront(K, L, 0.8, Ln - 0.8, 0, 3.8, trim, 4, lit=0.9)
            K.quad(L, 0, 0.8, 0, 3.8, 0, brick)
            K.quad(L, Ln - 0.8, Ln, 0, 3.8, 0, brick)
            K.quad(L, 0, Ln, 3.8, 4.9, 0, brick)
            K.obox(L, 0.3, Ln - 0.3, 3.8, 4.9, 0, 0.18, trim, BODY, ('d-',))
            K.text('MISSISSIPPI RIVER DISTILLING CO', L, Ln / 2, 4.1, 0.19, 0.5, lin('#2a2420'), BODY, 0.03, res=1)
            windows(K, L, 0.8, Ln - 0.8, 4.9, 3.1, 1, 4, brick, wf=0.5, hf=0.72, sill=trim, head=trim, edge=0.8)
            K.obox(L, 2.0, Ln - 2.0, 3.8, 3.95, 0, 1.4, lin('#2a2420'), BODY, ('d-',))  # awning ledge
        elif river:
            for k in range(3):  # garage / barrel doors in the exposed lower level
                u = 1.6 + k * 5.2
                K.quad(L, u, u + 3.4, -4.4, -1.2, 0.03, lin('#5a4a3a'))
            windows(K, L, 0.8, Ln - 0.8, 0, 4.0, 2, 4, brick, wf=0.6, hf=0.65, sill=trim, edge=0.8, lit=0.6)
        else:
            windows(K, L, 0.8, Ln - 0.8, 0, 4.0, 2, 4, brick, wf=0.45, hf=0.6, sill=trim, edge=0.8)
    gable(K, x0, x1, y0, y1, H, 3.4, roofc, brick)
    # copper cupola on the ridge (the still's vent) [G]
    cx, cy = (x0 + x1) / 2 + 2, (y0 + y1) / 2
    K.box(cx - 1.2, cx + 1.2, cy - 1.2, cy + 1.2, H + 2.6, H + 4.8, copper)
    pyramid(K, cx, cy, 3.0, H + 4.8, 1.4, scale(copper, 0.8))
    # river-view deck on the east side at street level, posts down to the lower level
    dx0, dx1 = x1, x1 + 3.2
    K.box(dx0, dx1, y0 + 1, y1 - 1, -0.25, 0.0, lin('#7a5a3a'), BODY, ())
    for yy in (y0 + 1.1, (y0 + y1) / 2, y1 - 1.1):
        K.box(dx1 - 0.25, dx1 - 0.05, yy - 0.1, yy + 0.1, -4.5, -0.25, lin('#5a4a3a'))
    rail(K, [(dx0, y0 + 1), (dx1, y0 + 1), (dx1, y1 - 1), (dx0, y1 - 1)], 0.0, 1.0, lin('#2a2420'), closed=False)
    lod0 = K.obj('distillery_lod0')
    K1 = Kit(502)
    K1.prism(P, -4.5, H, brick, top=False)
    gable(K1, x0, x1, y0, y1, H, 3.4, roofc, brick, ov=0.2)
    for i, L, Ln, mid in sides(P):
        if mid[0] < x0 + 0.5:
            K1.quad(L, 0.8, Ln - 0.8, 0.5, 3.6, 0.03, LIT_C, LIT)
    lod1 = K1.obj('distillery_lod1')
    res = finish('distillery', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('distillery', (8, 0, 4), 38, lod1, views=((-120, 12), (60, 20)))
    return res


REG['distillery'] = distillery


# ================================================================ BARD HOTEL (207 N Cody Rd)
# The tallest building in the Cody Road Historic District: three storeys (NRHP nomination / Wikipedia). OSM way
# 791117512. Built c.1850 (listing); later home of Sneaky Pete's. Red-brown soft brick Italianate front [G from the
# district's style: flat roof, parapet, bracketed metal cornice, segmental window heads], shopfront on Cody Rd,
# limestone footing; the lot drops ~3 m to the river so the back shows a basement storey.
def bard(render=True):
    anchor = (19512.0, -8329.0)
    G = g2l(anchor)
    brick, trim, stone, roofc = lin('#8e4632'), lin('#d9ccb0'), lin('#b9ad94'), lin('#55534f')
    P = ccw([G(*p) for p in [(19512.0, -8316.2), (19530.2, -8316.0), (19530.3, -8335.2), (19521.4, -8335.2), (19521.5, -8338.9),
                              (19517.7, -8338.9), (19517.7, -8342.5), (19510.6, -8342.6), (19510.5, -8329.3), (19512.1, -8329.2)]])
    K = Kit(511)
    fl = [4.4, 3.7, 3.7]
    top = sum(fl)
    for i, L, Ln, mid in sides(P):
        front = mid[0] < 1.0 and Ln > 6  # the Cody Rd (west) faces
        K.quad(L, 0, Ln, -4.6, 0, 0, stone)
        if Ln < 4.5:
            K.quad(L, 0, Ln, 0, top, 0, brick)
            continue
        if front:
            storefront(K, L, 0.7, Ln - 0.7, 0, fl[0] - 0.3, lin('#3a3028'), max(2, round(Ln / 4)), lit=0.85)
            K.quad(L, 0, 0.7, 0, fl[0], 0, brick)
            K.quad(L, Ln - 0.7, Ln, 0, fl[0], 0, brick)
            K.quad(L, 0.7, Ln - 0.7, fl[0] - 0.3, fl[0], 0, brick)
            windows(K, L, 0.8, Ln - 0.8, fl[0], 3.7, 2, max(2, round(Ln / 2.6)), brick, wf=0.5, hf=0.68, sill=stone, head=trim, edge=0.8, pair=True)
            cornice(K, L, 0, Ln, top + 1.3, trim, proj=0.8, depth=1.2, brackets=1.1)
            K.quad(L, 0, Ln, top, top + 0.1, 0, brick)
        else:
            windows(K, L, 0.8, Ln - 0.8, 0, 3.7, 3, max(1, round(Ln / 3.2)), brick, wf=0.42, hf=0.6, sill=stone, edge=0.8, lit=0.35)
    # signboard over the shopfront on the main (north) part of the front
    fi = max((s for s in sides(P) if s[3][0] < 1.0), key=lambda s: s[2])
    L, Ln = fi[1], fi[2]
    K.text('BARD HOTEL', L, Ln / 2, fl[0] + 0.15, 0.06, 0.62, trim, BODY, 0.04, res=1)
    roof(K, P, top + 0.1, roofc, par=brick, parh=0.9)
    rooftop_junk(K, 9, -2, top, K.rnd, 2, 3)
    # rear balcony / fire stair on the river side [G]
    K.box(18.3, 18.9, -2, 4, -4.6, top - 1, lin('#2a2a2a'), BODY, ())
    lod0 = K.obj('bard_lod0')
    K1 = Kit(512)
    lod1_bands(K1, P, 0, 3, top / 3, brick, lit=0.4)
    for i, L, Ln, mid in sides(P):
        if mid[0] < 1.0 and Ln > 6:
            K1.obox(L, 0, Ln, top - 0.2, top + 1.3, 0, 0.6, trim, BODY, ('d-',))
    K1.prism(P, -4.6, 0, stone, top=False)
    lod1 = K1.obj('bard_lod1')
    res = finish('bard', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bard', (8, -2, 6), 40, lod1, views=((-110, 12), (70, 25)))
    return res


REG['bard'] = bard


# ================================================================ RIVERBOAT TWILIGHT
# Victorian "floating palace" replica built 1987 by Capt. Dennis Trone; 140 passengers, three decks with wrap-around
# windows and a pilot house (riverboattwilight.com); not a paddle-wheeler (steamboats.org), so no wheel. Length
# ~40 m, beam ~10 m [G]. White with dark red trim and gingerbread railings, two tall black stacks with feathered crowns
# forward [G, typical of the replica boats]. Moored bow-upstream (north) at the levee landing.
# Origin: the waterline is 0.6 m above it (the game sets y = river surface - 0.6, like belle.glb). Length along -y/+y,
# bow to +y (game north).
def twilight(render=True):
    anchor = (19617.0, -8345.0)
    white, red, black, hullc, wood = lin('#f3f1ea'), lin('#8e1f24'), lin('#1b1b1b'), lin('#3a2a24'), lin('#9a7b55')
    K = Kit(521, ao=0)
    W = 5.0
    hull = [(-W, -20), (W, -20), (W, 15), (3.2, 19), (0, 20.5), (-3.2, 19), (-W, 15)]
    for i in range(len(hull)):
        a, b = hull[i], hull[(i + 1) % len(hull)]
        K.oface([Vector((a[0], a[1], -0.6)), Vector((b[0], b[1], -0.6)), Vector((b[0], b[1], 1.6)), Vector((a[0], a[1], 1.6))], Vector((0, 0, 0.5)), hullc)
        K.oface([Vector((a[0], a[1], 1.6)), Vector((b[0], b[1], 1.6)), Vector((b[0], b[1], 2.0)), Vector((a[0], a[1], 2.0))], Vector((0, 0, 0.5)), red)
    K.prism(ccw(hull), 2.0, 2.0, wood, sides=False)

    def deck(z0, z1, xw, ya, yb, n_win, roof_over=0.9):
        """an enclosed deck: white cabin with wrap-around windows, overhanging roof deck with a railing"""
        K.box(-xw, xw, ya, yb, z0, z0 + 0.8, white)
        for s in (-1, 1):  # long sides: window band
            L = (lambda u, h, d, s=s: (s * (xw + d), ya + u if s > 0 else yb - u, h))
            Ln = yb - ya
            for k in range(n_win):
                u0 = 0.4 + k * (Ln - 0.8) / n_win
                u1 = u0 + (Ln - 0.8) / n_win
                K.quad(L, u0, u0 + 0.25, z0 + 0.8, z1 - 0.4, 0, white)
                on = K.rnd.random() < 0.7
                K.quad(L, u0 + 0.25, u1, z0 + 0.8, z1 - 0.4, -0.02, LIT_C if on else GLASS_C, LIT if on else GLASS)
            K.quad(L, 0, Ln, z1 - 0.4, z1, 0, white)
        for e, yy in ((-1, ya), (1, yb)):  # ends: windows too
            L = (lambda u, h, d, e=e, yy=yy: (-e * u if True else u, yy + e * d, h))
            K.quad(L, -xw, xw, z0, z0 + 0.8, 0, white)
            K.quad(L, -xw, xw, z0 + 0.8, z1 - 0.4, -0.02, LIT_C, LIT)
            K.quad(L, -xw, xw, z1 - 0.4, z1, 0, white)
        ro = roof_over
        K.box(-xw - ro, xw + ro, ya - ro, yb + ro, z1, z1 + 0.25, white, BODY, ())
        K.box(-xw - ro, xw + ro, ya - ro, yb + ro, z1 + 0.25, z1 + 0.32, red, BODY, ('h-',))
        # thin columns at the deck edge holding the roof (the gingerbread posts)
        for y in [ya - ro + 0.2 + k * 2.4 for k in range(int((yb - ya + 2 * ro) / 2.4) + 1)]:
            for s in (-1, 1):
                K.box(s * (xw + ro - 0.15) - 0.08, s * (xw + ro - 0.15) + 0.08, y - 0.08, y + 0.08, z0, z1, white)
        return z1 + 0.32

    z = deck(2.0, 4.8, 4.2, -18.5, 15.0, 9)
    rail(K, [(-W, -19.6), (W, -19.6), (W, 15.2), (-W, 15.2)], 2.0, 1.0, white, post=1.6)
    z = deck(z, z + 2.7, 3.8, -16.5, 12.5, 8)
    rail(K, [(-4.6, -17.3), (4.6, -17.3), (4.6, 13.3), (-4.6, 13.3)], z - 0.32, 1.0, white, post=1.6)
    z3 = z
    z = deck(z, z + 2.5, 3.0, -12.0, 4.0, 5, roof_over=0.6)
    rail(K, [(-4.6, -17.3), (4.6, -17.3), (4.6, 13.3), (-4.6, 13.3)], z3, 1.0, red, post=2.0)
    # pilot house forward on the top roof
    K.box(-1.6, 1.6, 0.0, 3.2, z, z + 2.2, white)
    for s in (-1, 1):
        K.quad(lambda u, h, d, s=s: (s * (1.6 + d), 0.0 + u if s > 0 else 3.2 - u, h), 0.3, 2.9, z + 0.9, z + 1.9, 0.02, GLASS_C, GLASS)
    K.quad(lambda u, h, d: (-u, 3.2 + d, h), -1.3, 1.3, z + 0.9, z + 1.9, 0.02, GLASS_C, GLASS)
    pyramid(K, 0, 1.6, 4.0, z + 2.2, 0.8, red)
    K.cyl(0, 1.6, 0.5, z + 3.0, z + 3.5, lin('#c9a24a'), BODY, 8)  # gilded acorn
    # twin black stacks with feathered crowns forward of the pilot house
    for s in (-1, 1):
        K.cyl(s * 2.2, 8.0, 0.42, z3, z + 7.0, black, BODY, 8)
        K.cyl(s * 2.2, 8.0, 0.42, z + 7.0, z + 7.8, black, BODY, 8, r1=0.75)
        for k in range(8):
            a = 2 * math.pi * k / 8
            cx, cy = s * 2.2 + math.cos(a) * 0.62, 8.0 + math.sin(a) * 0.62
            K.box(cx - 0.12, cx + 0.12, cy - 0.12, cy + 0.12, z + 7.8, z + 8.4, lin('#c9a24a'))
    K.box(-2.2, 2.2, 7.95, 8.05, z + 5.6, z + 5.75, lin('#c9a24a'))  # spreader bar between the stacks
    # name boards on the top deck sides
    for s in (-1, 1):
        L = (lambda u, h, d, s=s: (s * (3.0 + 0.25 + d), -4 + u if s > 0 else -4 - u, h))
        K.quad(L, -5, 5, z3 + 0.9, z3 + 1.9, 0, white)
        K.text('TWILIGHT', L, 0, z3 + 1.05, 0.02, 0.8, red, BODY, 0.04, res=1)
    # gangway to the landing (west side, game shore)
    K.box(-W - 4.0, -W, -2.0, -0.6, 1.9, 2.05, wood, BODY, ())
    K.text('TWILIGHT', lambda u, h, d: (W + d, u, h), 0, 0.45, 0.02, 0.9, white, BODY, 0.03, res=1)
    K.text('TWILIGHT', lambda u, h, d: (-W - d, -u, h), 0, 0.45, 0.02, 0.9, white, BODY, 0.03, res=1)
    lod0 = K.obj('twilight_lod0')
    K1 = Kit(522, ao=0)
    K1.prism(ccw(hull), -0.6, 2.0, hullc, topcol=wood)
    K1.box(-4.2, 4.2, -18.5, 15.0, 2.0, 4.8, white)
    K1.box(-3.8, 3.8, -16.5, 12.5, 5.1, 7.8, white)
    K1.box(-3.0, 3.0, -12.0, 4.0, 8.1, 10.6, white)
    for s in (-1, 1):
        K1.quad(lambda u, h, d, s=s: (s * (4.2 + d), u if s > 0 else -u, h), -18 if s > 0 else -14.5, 14.5 if s > 0 else 18, 2.8, 4.4, 0.03, LIT_C, LIT)
        K1.box(s * 2.2 - 0.4, s * 2.2 + 0.4, 7.6, 8.4, 7.8, 18.0, black)
    lod1 = K1.obj('twilight_lod1')
    res = finish('twilight', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('twilight', (0, 0, 5), 55, lod1, views=((-120, 15), (60, 25)))
    return res


REG['twilight'] = twilight


# ================================================================ SCOTT COUNTY FREEDOM ROCK
# A 7.5-ton boulder on the levee painted by Ray "Bubba" Sorensen II (2014): flag and tribute to Scott County's Medal of
# Honor recipients; "Honor and Remember" (waymarking.com). ~3 x 2 x 1.8 m [G]. Low-poly lump, painted by facing side:
# the flag on the west/south faces, a dark blue-green scene with soldiers on the other side [G].
def freedomrock(render=True):
    anchor = (19555.0, -8086.0)
    K = Kit(531, ao=0)
    rnd = random.Random(7)
    nu, nv = 10, 6
    rx, ry, rz = 1.6, 1.05, 1.85
    V = {}
    for j in range(nv + 1):
        t = math.pi * j / nv
        for i in range(nu):
            p = 2 * math.pi * i / nu
            k = 1.0 + rnd.uniform(-0.12, 0.12) if 0 < j < nv else 1.0
            z = rz * (1 - math.cos(t)) / 2 * (0.9 if j == nv else 1)
            V[i, j] = Vector((math.cos(p) * math.sin(t) * rx * k, math.sin(p) * math.sin(t) * ry * k, z - 0.25))
    red, white, blue, star = lin('#b22234'), lin('#f2f2ee'), lin('#22305e'), lin('#e8e4d8')
    scene = [lin('#2f4a3a'), lin('#3a4f6a'), lin('#6b5a44'), lin('#1f2a3a')]
    ctr = Vector((0, 0, 0.7))
    for j in range(nv):
        for i in range(nu):
            q = [V[i, j], V[(i + 1) % nu, j], V[(i + 1) % nu, j + 1], V[i, j + 1]]
            c = sum(q, Vector()) / 4
            if j == 0:
                q = [V[i, 0], V[(i + 1) % nu, 1], V[i, 1]]
            elif j == nv - 1:
                q = [V[i, j], V[(i + 1) % nu, j], V[0, nv]]
            if c.x < 0.15:  # flag side: stripes by height, canton top-left
                col = blue if (c.z > 0.9 and c.y > 0.0) else (red if int((c.z + 0.25) / 0.27) % 2 == 0 else white)
                if col is blue and rnd.random() < 0.3:
                    col = star
            else:
                col = scene[(i + j) % 4]
            if c.z > 1.45:
                col = lin('#d8d2c0') if c.x >= 0.15 else col  # "HONOR AND REMEMBER" band on top [G: plain cream]
            K.oface(q, ctr, col)
    lod0 = K.obj('freedomrock_lod0')
    K1 = Kit(532, ao=0)
    K1.box(-1.5, 1.5, -0.95, 0.95, -0.25, 1.4, red)
    lod1 = K1.obj('freedomrock_lod1')
    res = finish('freedomrock', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('freedomrock', (0, 0, 0.8), 8, lod1, views=((-100, 15), (80, 20)))
    return res


REG['freedomrock'] = freedomrock


if __name__ == '__main__' or True:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:
        bpy.context.scene.name = LM_SCENE
        B.update(REG)
        for n in argv:
            r = build(n, render='norender' not in argv) if n != 'norender' else None
            if r:
                print('RESULT', n, r)
