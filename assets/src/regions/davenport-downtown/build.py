# Downtown Davenport region models (town agent): one GLB per place in assets/models/regions/davenport-downtown/,
# sources saved next to this file. Reuses the landmark kit (assets/src/landmarks.py: Kit, windows, finish, ...),
# so the conventions are the same: Blender X = game x, -Y = game z, origin = anchor at base height, <name>_lod0 /
# <name>_lod1, colours baked into the 'Col' layer (COLOR_0), lm_body / lm_glass / lm_lit / lm_neon slots.
# Headless only:  Blender -b --factory-startup -P build.py -- kahl unionstation freighthouse dillon
# References: docs/regions/davenport-downtown.md.
import sys
ROOT_ = '/Users/dainmoens/Documents/Tim Arnett Town/'
exec(open(ROOT_ + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/davenport-downtown/'
LOUT = OUT + 'regions/davenport-downtown/'


def gpoly(G, pts):
    return ccw([G(*p) for p in pts])


def piers(K, L, u0, u1, h0, h1, bays, col, w=0.55, proj=0.3):
    bw = (u1 - u0) / bays
    for b in range(bays + 1):
        u = u0 + bw * b
        K.obox(L, u - w / 2, u + w / 2, h0, h1, -0.02, proj, col, BODY, ('d-', 'h-'))


# ================================================================ KAHL BUILDING + CAPITOL THEATRE
# 326 W 3rd St (1920, Arthur Ebeling; theatre interior Rapp & Rapp; 1925 stage house): ten storeys (45 m) of
# white terra cotta over steel, Chicago School after Sullivan's Wainwright: ornate two-storey base, continuous piers
# with recessed spandrels, paired round-arch windows in the top storey under a heavy cornice. L-shaped office block on
# the 3rd St (south) and Ripley (west) fronts wrapping the brick auditorium; CAPITOL marquee + blade sign on 3rd St.
def kahl(render=True):
    anchor = (-40.65, 91.3)
    G = g2l(anchor)
    tc, tc2, tc3, brick = lin('#ece6d6'), lin('#d9d0bb'), lin('#c8bea6'), lin('#a5805c')
    K = Kit(901)
    L_ = gpoly(G, [(-63.2, 114.7), (-17.9, 114.9), (-17.7, 97.0), (-53.6, 97.2), (-53.5, 67.8), (-62.9, 67.8)])
    K.prism(L_, -4, 0, tc3, top=False)
    fl0, fh, nup, topf = 7.2, 3.75, 8, 4.4
    shaft_top = fl0 + nup * fh
    top = shaft_top + topf
    for i, L, Ln, mid in sides(L_):
        street = mid[1] < -15 or mid[0] < -18     # 3rd St (south) and Ripley (west) fronts
        if Ln < 6:
            K.quad(L, 0, Ln, 0, top, 0, tc2)
            continue
        nb = max(2, round((Ln - 1.2) / 3.1))
        if street:
            storefront(K, L, 0.6, Ln - 0.6, 0, 4.6, tc2, max(2, round(Ln / 5.5)))
            windows(K, L, 0.6, Ln - 0.6, 4.6, fl0 - 4.6, 1, nb, tc, wf=0.62, hf=0.62, edge=0.6)
            belt(K, L, 0, Ln, fl0 - 0.5, tc3, 0.35, 0.5)
            windows(K, L, 0.6, Ln - 0.6, fl0, fh, nup, nb, tc, wf=0.62, hf=0.7, lit=0.4)
            piers(K, L, 0.6, Ln - 0.6, fl0, shaft_top, nb, tc)
        else:   # light-court sides: plain cream brick with a simple grid
            K.quad(L, 0, Ln, 0, fl0, 0, tc3)
            windows(K, L, 0.6, Ln - 0.6, fl0, fh, nup, max(1, nb // 2), tc3, wf=0.5, hf=0.6, lit=0.35)
        belt(K, L, 0, Ln, shaft_top, tc3, 0.3, 0.45)
        windows(K, L, 0.6, Ln - 0.6, shaft_top + 0.4, topf - 0.4, 1, nb, tc, wf=0.62, hf=0.55, lit=0.3)
        if street:
            ww = (Ln - 1.2) / nb * 0.62
            arch_heads(K, L, 0.6, Ln - 0.6, nb, shaft_top + 0.4 + (topf - 0.4) * (1 - 0.55) * 0.42 + (topf - 0.4) * 0.55, ww, tc2)
        cornice(K, L, 0, Ln, top + 1.4, tc2, 1.5, 1.8, brackets=1.2)
        K.obox(L, 0, Ln, top + 1.4, top + 2.2, -0.3, 0.1, tc, BODY, ('h-',))
    roof(K, L_, top + 1.4)
    K.box(-18, -12, 8, 14, top + 1.4, top + 5.5, tc3)          # elevator penthouse over the corner
    rooftop_junk(K, 0, -10, top + 1.4, K.rnd, 3, 8)
    # brick auditorium and the 1925 stage house behind (north)
    A = gpoly(G, [(-53.5, 68.2), (-17.7, 68.2), (-17.7, 96.8), (-53.5, 96.8)])
    K.prism(A, -3, 19.5, brick, topcol=ROOF)
    S = gpoly(G, [(-53.5, 68.2), (-17.7, 68.2), (-17.7, 80.5), (-53.5, 80.5)])
    K.prism(S, 19.4, 26.5, scale(brick, 0.92), topcol=ROOF)
    for i, L, Ln, mid in sides(S):
        K.obox(L, -0.2, Ln + 0.2, 26.5, 27.2, -0.2, 0.15, tc3, BODY, ('h-',))
    # CAPITOL marquee + vertical blade sign on 3rd St (theatre doors at the east part of the front)
    yS = G(0, 114.85)[1]
    F = lambda u, h, d: (u, yS - d, h)     # u = x, d = out over the 3rd St sidewalk (game +z)
    mx0, mx1 = G(-34, 0)[0], G(-22, 0)[0]
    K.box(mx0, mx1, yS - 3.6, yS, 4.3, 5.9, lin('#2a2420'))
    K.quad(F, mx0 + 0.2, mx1 - 0.2, 4.45, 5.75, 3.62, lin('#fff4d8'), LIT)
    K.text('CAPITOL', F, (mx0 + mx1) / 2, 4.6, 3.66, 1.0, lin('#d8261c'), NEON, depth=0.08)
    for sx in (mx0, mx1):    # marquee ends
        K.face([(sx, yS, 4.45), (sx, yS - 3.6, 4.45), (sx, yS - 3.6, 5.75), (sx, yS, 5.75)], lin('#fff4d8'), LIT)
    K.quad(F, mx0 + 0.3, mx1 - 0.3, 3.2, 4.25, 0.02, lin('#ffe1a0'), LIT)   # lit lobby doors under it
    bx = (mx0 + mx1) / 2
    K.box(bx - 0.25, bx + 0.25, yS - 2.6, yS - 0.05, 6.5, 18.5, lin('#b51f1f'))
    Bs = lambda u, h, d: (bx + 0.26 + d, yS - 2.65 + u, h)   # side facing east (u runs north so letters aren't mirrored)
    Bw = lambda u, h, d: (bx - 0.26 - d, yS - u, h)          # side facing west
    for k, ch in enumerate('CAPITOL'):
        for FF, u in ((Bs, 1.32), (Bw, 1.33)):
            K.text(ch, FF, u, 17.0 - k * 1.6, 0.0, 1.25, lin('#ffe9a8'), NEON, depth=0.06)
    lod0 = K.obj('kahl_lod0')
    K1 = Kit(902)
    lod1_bands(K1, L_, 0, 10, top / 10, tc)
    for i, L, Ln, mid in sides(L_):
        K1.obox(L, -0.5, Ln + 0.5, top, top + 1.6, -0.1, 1.3, tc2, BODY, ('d-',))
    K1.prism(A, -3, 19.5, brick, topcol=ROOF)
    K1.prism(S, 19.4, 26.5, brick, topcol=ROOF)
    K1.box(bx - 0.25, bx + 0.25, yS - 2.6, yS - 0.05, 6.5, 18.5, lin('#b51f1f'))
    lod1 = K1.obj('kahl_lod1')
    res = finish('kahl', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('dd_kahl', (0, 0, 20), 120, lod1, views=((200, 12), (300, 30)))
    return res


B['kahl'] = kahl


# ================================================================ UNION STATION + BURLINGTON FREIGHT HOUSE
# 120 S Harrison St (1924, Georgian/Colonial Revival): two storeys of tan brick on concrete, twin temple fronts
# (north to the River Dr lot, south to the tracks) of four attached square columns under a dentilled entablature,
# arched first-floor windows with concrete keystones, heavy cornice, deep awnings over the doors. The one-storey
# Burlington freight house (same tan brick, concrete band at the cornice, big dock doors) adjoins it to the west.
def unionstation(render=True):
    anchor = (-14.45, 421.55)
    G = g2l(anchor)
    tan, tan2, conc, roofc, awn = lin('#c9a679'), lin('#b8935f'), lin('#ddd6c6'), lin('#5a5652'), lin('#2f4a3a')
    K = Kit(911)
    St = gpoly(G, [(-15.1, 412.9), (17.4, 413.0), (17.3, 426.2), (-15.1, 426.1)])
    Fh = gpoly(G, [(-46.3, 414.6), (-15.1, 414.6), (-15.1, 430.2), (-46.3, 430.2)])
    K.prism(St, -3, 0, conc, top=False)
    K.prism(Fh, -3, 0, conc, top=False)
    eave = 9.6
    for i, L, Ln, mid in sides(St):
        if mid[0] < G(-15, 0)[0] + 1:   # party wall with the freight house: only the part above it shows
            K.quad(L, 0, Ln, 5.6, eave, 0, tan)
            continue
        nb = max(1, round((Ln - 1.2) / 3.4))
        K.quad(L, -0.2, Ln + 0.2, 0, 0.8, 0.05, conc)
        windows(K, L, 0.6, Ln - 0.6, 0.8, 4.0, 1, nb, tan, wf=0.5, hf=0.68, rec=0.3, lit=0.6, sill=conc)
        ww = (Ln - 1.2) / nb * 0.5
        arch_heads(K, L, 0.6, Ln - 0.6, nb, 0.8 + 4.0 * 0.68 + (4.0 - 4.0 * 0.68) * 0.42, ww, conc)
        belt(K, L, 0, Ln, 4.9, conc, 0.2, 0.3)
        windows(K, L, 0.6, Ln - 0.6, 5.0, 3.6, 1, nb, tan, wf=0.5, hf=0.6, rec=0.3, lit=0.5, sill=conc)
        cornice(K, L, 0, Ln, eave, conc, 0.8, 1.1, brackets=0)
        K.obox(L, 0, Ln, eave, eave + 0.9, -0.25, 0.05, tan, BODY, ('h-',))
        if Ln > 20:   # temple front: four attached square columns, entablature, medallions, awning over the doors
            c = Ln / 2
            for k in range(4):
                u = c - 6 + k * 4
                K.obox(L, u - 0.45, u + 0.45, 0.8, eave - 1.4, 0, 0.55, conc, BODY, ('d-', 'h-'))
                K.obox(L, u - 0.6, u + 0.6, eave - 1.6, eave - 1.3, 0, 0.7, conc, BODY, ('d-', 'h-'))
            K.obox(L, c - 7, c + 7, eave - 1.3, eave + 0.2, 0, 0.75, conc, BODY, ('d-',))
            for k in range(28):
                u = c - 6.9 + k * 0.5
                K.obox(L, u, u + 0.22, eave - 0.1, eave + 0.15, 0.75, 0.9, conc, BODY, ('d-', 'h-'))
            K.obox(L, c - 7.4, c + 7.4, eave + 0.2, eave + 1.5, -0.1, 0.4, conc, BODY, ('d-',))
            if mid[1] > 0:
                K.text('UNION STATION', L, c, eave - 1.15, 0.78, 0.8, lin('#3b3226'), BODY, depth=0.05)
            else:
                K.text('DAVENPORT', L, c, eave - 1.15, 0.78, 0.8, lin('#3b3226'), BODY, depth=0.05)
            K.quad(L, c - 1.6, c + 1.6, 0.8, 3.6, 0.02, lin('#ffe1a0'), LIT)
            K.obox(L, c - 2.6, c + 2.6, 3.8, 4.0, 0, 2.2, awn, BODY, ('d-',))
            K.face([L(c - 2.6, 4.0, 0), L(c + 2.6, 4.0, 0), L(c + 2.6, 4.5, 0.2), L(c - 2.6, 4.5, 0.2)][::-1], awn)
    roof(K, St, eave + 0.9, roofc)
    hip_roof(K, G(-13.5, 0)[0], G(15.8, 0)[0], G(0, 424.8)[1], G(0, 414.3)[1], eave + 0.9, 2.2, lin('#6b4b3a'))
    fe = 5.6
    for i, L, Ln, mid in sides(Fh):
        if mid[0] > G(-15.1, 0)[0] - 1:
            continue
        K.quad(L, 0, Ln, 0, fe, 0, tan2)
        K.obox(L, -0.1, Ln + 0.1, fe - 0.7, fe - 0.35, -0.02, 0.15, conc, BODY, ('d-',))
        K.obox(L, -0.15, Ln + 0.15, fe, fe + 0.5, -0.2, 0.05, tan2, BODY, ('h-',))
        if Ln > 20:   # dock doors + a few windows
            for k in range(3):
                u = 4 + k * (Ln - 8) / 2
                K.quad(L, u - 1.7, u + 1.7, 0.3, 3.9, 0.02, lin('#5b4636'))
                for j in range(4):
                    K.quad(L, u - 1.7, u + 1.7, 0.3 + j * 0.9, 0.36 + j * 0.9, 0.04, lin('#463528'))
            for k in range(2):
                u = 4 + (k + 0.5) * (Ln - 8) / 2
                K.quad(L, u - 0.8, u + 0.8, 1.6, 3.5, 0.02, GLASS_C, GLASS)
    roof(K, Fh, fe + 0.5, roofc)
    # wood post-and-beam shelter at the trackside junction (south)
    sx0, sx1 = G(-24, 0)[0], G(-8, 0)[0]
    sy = G(0, 430.2)[1]
    for k in range(5):
        x = sx0 + k * (sx1 - sx0) / 4
        K.box(x - 0.15, x + 0.15, sy - 3.8, sy - 3.5, 0, 3.6, lin('#6a4a32'))
    K.prism([(sx0 - 0.3, sy - 4.1), (sx1 + 0.3, sy - 4.1), (sx1 + 0.3, sy), (sx0 - 0.3, sy)], 3.6, 3.9, lin('#4a3a2c'))
    lod0 = K.obj('unionstation_lod0')
    K1 = Kit(912)
    lod1_bands(K1, St, 0, 2, 4.8, tan)
    roof(K1, St, eave + 0.9, roofc)
    lod1_bands(K1, Fh, 0, 1, fe, tan2, lit=0.1)
    lod1 = K1.obj('unionstation_lod1')
    res = finish('unionstation', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('dd_unionstation', (-8, 0, 4), 60, lod1, views=((20, 15), (200, 20)))
    return res


B['unionstation'] = unionstation


# ================================================================ THE FREIGHT HOUSE (Milwaukee Road, 1917)
# 421 W River Dr (102 S Ripley): a 154 x 12 m brick freight shed on the levee, two-storey office block at the east
# (Ripley St) end, the long one-storey warehouse to the west. Now the year-round Freight House Farmers Market (stalls
# under the canopy on the River Dr side), Front Street Brewery taproom, Antonella's II and Boozie's.
def freighthouse(render=True):
    anchor = (-166.1, 396.0)
    G = g2l(anchor)
    brick, brick2, conc, roofc, canopy = lin('#8a4a35'), lin('#7a3f2d'), lin('#d6cfc0'), lin('#4f4d4a'), lin('#2e4f3a')
    K = Kit(921)
    xE = -110.0     # west end of the two-storey office block
    Wh = gpoly(G, [(-243.2, 390.4), (xE, 389.8), (xE, 402.0), (-243.2, 402.4)])
    Of = gpoly(G, [(xE, 389.8), (-89.0, 389.5), (-89.0, 400.9), (xE, 401.6)])
    K.prism(Wh, -3, 0, conc, top=False)
    K.prism(Of, -3, 0, conc, top=False)
    we, oe = 5.8, 9.4
    for i, L, Ln, mid in sides(Wh):
        if abs(mid[0] - G(xE, 0)[0]) < 1:
            continue
        K.quad(L, -0.2, Ln + 0.2, 0, 0.6, 0.05, conc)
        if Ln > 30:   # long sides: a rhythm of big glazed bay doors between brick piers
            n = int(Ln / 6.4)
            bw = Ln / n
            for k in range(n):
                a, b = k * bw, (k + 1) * bw
                K.quad(L, a, a + 0.9, 0.6, we, 0, brick)
                K.quad(L, b - 0.9, b, 0.6, we, 0, brick)
                K.quad(L, a + 0.9, b - 0.9, 4.4, we, 0, brick)
                on = K.rnd.random() < 0.6
                K.quad(L, a + 0.9, b - 0.9, 0.6, 4.4, -0.2, LIT_C if on else GLASS_C, LIT if on else GLASS)
                for j in range(1, 4):   # garage-door mullions
                    K.quad(L, a + 0.9, b - 0.9, 0.6 + j * 0.95, 0.68 + j * 0.95, -0.15, lin('#3a3a38'))
                K.obox(L, a + 0.8, b - 0.8, 4.4, 4.55, -0.2, 0.05, conc, BODY, ('d-',))
        else:
            K.quad(L, 0, Ln, 0.6, we, 0, brick)
            K.quad(L, Ln / 2 - 1.8, Ln / 2 + 1.8, 0.6, 4.0, 0.02, lin('#4a3a30'))
        K.obox(L, -0.15, Ln + 0.15, we, we + 0.7, -0.25, 0.08, brick2, BODY, ('h-',))
        K.obox(L, -0.2, Ln + 0.2, we + 0.7, we + 0.85, -0.25, 0.15, conc, BODY, ('h-',))
    roof(K, Wh, we + 0.7, roofc)
    for i, L, Ln, mid in sides(Of):
        nb = max(1, round((Ln - 1.2) / 3.2))
        K.quad(L, -0.2, Ln + 0.2, 0, 0.6, 0.05, conc)
        storefront(K, L, 0.6, Ln - 0.6, 0.6, 4.4, brick2, max(1, nb // 2 + 1), lit=0.85)
        belt(K, L, 0, Ln, 4.4, conc, 0.2, 0.3)
        windows(K, L, 0.6, Ln - 0.6, 4.7, oe - 4.7, 1, nb, brick, wf=0.5, hf=0.62, lit=0.5, sill=conc)
        K.obox(L, -0.2, Ln + 0.2, oe, oe + 0.8, -0.25, 0.1, brick2, BODY, ('h-',))
        K.obox(L, -0.25, Ln + 0.25, oe + 0.8, oe + 0.95, -0.25, 0.18, conc, BODY, ('h-',))
    roof(K, Of, oe + 0.8, roofc)
    # signs: FREIGHT HOUSE on the office block (north face to River Dr and south face to the river), taproom sign
    yN, yS = G(0, 389.6)[1], G(0, 401.3)[1]
    cx = (G(xE, 0)[0] + G(-89, 0)[0]) / 2
    N = lambda u, h, d: (-u, yN + d, h)     # north face: u runs west so the text reads left-to-right
    Sf = lambda u, h, d: (u, yS - d, h)
    for FF, u in ((N, -cx), (Sf, cx)):
        FF2 = FF
        K.obox(FF2, u - 9, u + 9, oe + 0.95, oe + 2.6, 0, 0.2, lin('#1e1e1e'), BODY, ('h-',))
        K.text('FREIGHT HOUSE', FF2, u, oe + 1.15, 0.22, 1.25, lin('#f2efe6'), NEON, depth=0.06)
    K.text('FRONT STREET BREWERY', N, -cx, 3.55, 0.3, 0.5, lin('#f4c542'), NEON, depth=0.05)
    # market canopy along the River Dr (north) side of the warehouse: steel posts, shallow shed roof
    c0, c1 = G(-238, 0)[0], G(-114, 0)[0]
    for k in range(21):
        x = c0 + k * (c1 - c0) / 20
        K.box(x - 0.12, x + 0.12, yN + 5.6, yN + 5.85, 0, 4.0, lin('#3b4a44'))
    K.prism([(c0 - 0.5, yN - 0.0), (c1 + 0.5, yN - 0.0), (c1 + 0.5, yN + 6.2), (c0 - 0.5, yN + 6.2)], 4.0, 4.25, canopy)
    K.prism([(c0 - 0.5, yN), (c1 + 0.5, yN), (c1 + 0.5, yN + 0.4), (c0 - 0.5, yN + 0.4)], 4.25, 4.9, canopy, top=True)
    lod0 = K.obj('freighthouse_lod0')
    K1 = Kit(922)
    lod1_bands(K1, Wh, 0, 1, we, brick, lit=0.5)
    lod1_bands(K1, Of, 0, 2, oe / 2, brick)
    K1.prism([(c0, yN), (c1, yN), (c1, yN + 6.2), (c0, yN + 6.2)], 4.0, 4.25, canopy)
    lod1 = K1.obj('freighthouse_lod1')
    res = finish('freighthouse', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('dd_freighthouse', (40, 0, 4), 110, lod1, views=((160, 15), (330, 25)))
    return res


B['freighthouse'] = freighthouse


# ================================================================ DILLON MEMORIAL (1918, Ware & Ware with Paul Schulz)
# Foot of Main St, south of River Dr (in the 1997 plaza): a fluted marble column with a bronze beacon lantern on top,
# rising from a base with lion-head and garland panels; water spouts from the lion heads into a raised round basin.
def dillon(render=True):
    anchor = (167.0, 400.0)
    marble, marble2, bronze, water, pave = lin('#ece8df'), lin('#d6d0c3'), lin('#5d4a2e'), lin('#3f6f86'), lin('#bdb6a8')
    K = Kit(931, ao=3)
    K.cyl(0, 0, 9.0, -0.6, 0.05, pave, BODY, 24)                     # plaza disc
    K.cyl(0, 0, 4.6, 0.05, 0.75, marble2, BODY, 24, top=False)      # basin wall
    K.cyl(0, 0, 4.75, 0.75, 0.9, marble, BODY, 24, top=False)
    K.cyl(0, 0, 4.6, 0.6, 0.8, water, BODY, 24)                      # water surface (inside the rim)
    K.box(-1.3, 1.3, -1.3, 1.3, 0.7, 3.4, marble)                    # pedestal
    K.box(-1.5, 1.5, -1.5, 1.5, 3.4, 3.8, marble2)
    for a in range(4):                                               # lion heads + spouts, one per face
        dx, dy = [(1, 0), (0, 1), (-1, 0), (0, -1)][a]
        cx, cy = dx * 1.32, dy * 1.32
        K.box(cx - 0.3, cx + 0.3, cy - 0.3, cy + 0.3, 1.7, 2.4, marble2)
        K.rod((dx * 1.6, dy * 1.6, 1.9), (dx * 2.6, dy * 2.6, 0.8), 0.06, lin('#9fc3d4'), BODY, 4)
        for s in (-1, 1):   # garland swag studs
            K.box(cx + dy * s * 0.8 - 0.12, cx + dy * s * 0.8 + 0.12, cy + dx * s * 0.8 - 0.12, cy + dx * s * 0.8 + 0.12, 2.8, 3.1, marble2)
    K.cyl(0, 0, 0.95, 3.8, 4.3, marble2, BODY, 16)                   # column base
    K.cyl(0, 0, 0.72, 4.3, 10.6, marble, BODY, 20, r1=0.64)          # fluted shaft (20 facets)
    for k in range(10):
        a = k * math.pi / 5
        K.box(math.cos(a) * 0.7 - 0.05, math.cos(a) * 0.7 + 0.05, math.sin(a) * 0.7 - 0.05, math.sin(a) * 0.7 + 0.05, 4.4, 10.4, marble2)
    K.cyl(0, 0, 0.7, 10.6, 11.1, marble2, BODY, 16, r1=1.0)          # capital
    K.box(-1.05, 1.05, -1.05, 1.05, 11.1, 11.4, marble)
    K.cyl(0, 0, 0.45, 11.4, 11.8, bronze, BODY, 8)                   # bronze beacon lantern
    K.cyl(0, 0, 0.42, 11.8, 12.7, lin('#ffe6a0'), LIT, 8)
    for k in range(8):
        a = k * math.pi / 4
        K.box(math.cos(a) * 0.44 - 0.04, math.cos(a) * 0.44 + 0.04, math.sin(a) * 0.44 - 0.04, math.sin(a) * 0.44 + 0.04, 11.8, 12.7, bronze)
    K.cyl(0, 0, 0.6, 12.7, 13.4, bronze, BODY, 8, r1=0.05)
    lod0 = K.obj('dillon_lod0')
    K1 = Kit(932, ao=3)
    K1.cyl(0, 0, 4.7, 0.05, 0.85, marble2, BODY, 10)
    K1.box(-1.4, 1.4, -1.4, 1.4, 0.85, 3.8, marble)
    K1.cyl(0, 0, 0.75, 3.8, 11.2, marble, BODY, 6, r1=0.65)
    K1.cyl(0, 0, 0.45, 11.2, 13.4, bronze, BODY, 6, r1=0.1)
    lod1 = K1.obj('dillon_lod1')
    res = finish('dillon', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('dd_dillon', (0, 0, 6), 22, lod1, views=((25, 12),))
    return res


B['dillon'] = dillon


if __name__ == '__main__':
    import json
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(B)
    names = [n for n in names if n in ('kahl', 'unionstation', 'freighthouse', 'dillon')]
    bpy.context.scene.name = LM_SCENE
    os.makedirs(LOUT, exist_ok=True)
    os.makedirs(SRC, exist_ok=True)
    out = {}
    for n in names:
        try:
            out[n] = build(n, render='--norender' not in sys.argv)
        except Exception as e:
            import traceback; traceback.print_exc()
            out[n] = 'ERROR %s' % e
    print('RESULT', json.dumps(out, default=str))
