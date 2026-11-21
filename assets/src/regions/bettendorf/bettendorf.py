# Bettendorf region models (src/regions/bettendorf.js): one GLB per place in assets/models/regions/bettendorf/.
# Uses the landmark kit (assets/src/landmarks.py: Kit, windows, finish, colour check, repack). Headless only:
#   Blender -b --factory-startup -P assets/src/regions/bettendorf/bettendorf.py -- convention cityhall museum
# Footprints are the OSM outlines (game x/z). Facade colours and details are guesses unless docs/regions/bettendorf.md
# names a source. Each file: <name>_lod0 + <name>_lod1, origin = the anchor in the JS module at ground level.
import sys, math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/landmarks.py').read(), globals())
LOUT = ROOT + 'assets/models/regions/bettendorf/'
SRC = ROOT + 'assets/src/regions/bettendorf/'

R = {}


def text_on(K, L, s, u, h, size, col, m=NEON, d=0.12):
    K.text(s, L, u, h, d, size, col, m, 0.1, res=1)


# ---------------------------------------------------------------- Quad Cities Waterfront Convention Center
# 2021 State St, opened Jan 2009, 24,000 sq ft (15,000 sq ft ballroom), modernist, skywalk to the Isle.
def convention(render=False):
    anchor = (6020.0, -135.0)
    G = g2l(anchor)
    tan, tan2, dark, glass, roofc = lin('#cbb89a'), lin('#a8977c'), lin('#4c4f52'), lin('#3b5b6a'), lin('#8c8a86')
    P = ccw([G(*p) for p in [(5973.7, -168), (6050.6, -169.8), (6051.4, -140.6), (6051.2, -132.1), (6051.7, -110.3),
                             (6032.9, -109.8), (6033.2, -100.9), (5977, -99.5), (5975.9, -146.4), (5972, -146.3),
                             (5971.8, -153.5), (5974.1, -153.6)]])
    lob = ccw([G(5973.7, -168), G(6050.6, -169.8), G(6050.9, -156.0), G(5974.0, -154.5)])   # the glass lobby along State St
    cor = ccw([G(6051.4, -140.6), G(6070.0, -141.0), G(6070.1, -132.6), G(6051.2, -132.1)])  # east link (skywalk side)
    K = Kit(901)
    H, HL = 11.0, 9.5
    # ballroom block: precast panels with pilasters and a dark top band
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, -3, H, 0, tan)
        K.quad(L, 0, Ln, -3, 1.0, 0.02, tan2)
        K.quad(L, 0, Ln, H - 1.4, H - 0.6, 0.03, dark)
        for k in range(1, int(Ln // 7.5)):
            K.obox(L, k * 7.5 - 0.3, k * 7.5 + 0.3, 1.0, H - 1.4, 0, 0.3, tan2, BODY, ('d-', 'h-'))
    K.prism(P, H - 0.1, H, roofc, sides=False)
    for i, L, Ln, mid in sides(P):
        K.obox(L, -0.2, Ln + 0.2, H - 0.1, H + 0.6, -0.1, 0.25, tan2, BODY, ('d-',))
    # two-storey glass lobby (prefunction) in front, a little lower, with mullions and a slab line
    for i, L, Ln, mid in sides(lob):
        front = mid[1] > G(0, -162)[1]
        if not front and Ln > 20:
            continue
        K.quad(L, 0, Ln, -3, 0.5, 0, dark)
        K.quad(L, 0, Ln, HL - 1.2, HL, 0, dark)
        K.quad(L, 0, Ln, 0.5, HL - 1.2, 0.02, glass, LIT)
        for k in range(int(Ln // 2.5) + 1):
            K.obox(L, k * 2.5 - 0.06, k * 2.5 + 0.06, 0.5, HL - 1.2, 0, 0.12, dark, BODY, ('d-', 'h-', 'h+'))
        K.obox(L, 0, Ln, 4.4, 4.7, 0, 0.15, dark, BODY, ('d-',))
    K.prism(lob, HL - 0.1, HL + 0.05, dark, sides=False)
    # entrance canopy and the name over the glass
    cx, fy = G(6012, 0)[0], G(0, -168.9)[1]
    F = lambda u, h, d: (cx - u, fy + d, h)   # north face: d out (+y), u reads left to right from State St
    K.obox(F, -10, 10, 4.2, 4.9, 0, 6.5, lin('#d9d6cf'), BODY, ('d-',))
    iface(K, [F(-9.8, 4.19, 0.1), F(9.8, 4.19, 0.1), F(9.8, 4.19, 6.4), F(-9.8, 4.19, 6.4)], (cx, fy - 3, 0), lin('#fff1c4'), LIT)
    for u in (-9, 9):
        K.cyl(F(u, 0, 6)[0], F(u, 0, 6)[1], 0.25, 0, 4.2, lin('#d9d6cf'), BODY, 8)
    text_on(K, F, 'QUAD CITIES WATERFRONT', 0, 7.2, 0.95, lin('#f4f1ea'), NEON, 0.14)
    text_on(K, F, 'CONVENTION CENTER', 0, 5.9, 0.95, lin('#f4f1ea'), NEON, 0.14)
    # east link toward the Isle (skywalk side)
    K.prism(cor, -3, 7.0, tan2, topcol=roofc)
    for i, L, Ln, mid in sides(cor):
        if Ln < 12:
            continue
        K.quad(L, 0.5, Ln - 0.5, 3.6, 6.2, 0.02, glass, LIT)
    rooftop_junk(K, *G(6010, -125), H, K.rnd, 8, 22)
    lod0 = K.obj('convention_lod0')
    K1 = Kit(902)
    K1.prism(P, -3, H, tan, topcol=roofc)
    for i, L, Ln, mid in sides(lob):
        if mid[1] > G(0, -162)[1]:
            K1.quad(L, 0.5, Ln - 0.5, 0.5, HL - 1.2, 0.05, glass, LIT)
    K1.prism(lob, -3, HL, dark, topcol=dark)
    K1.prism(cor, -3, 7.0, tan2)
    lod1 = K1.obj('convention_lod1')
    res = finish('convention', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bett_convention', (0, 0, 5), 110, lod1, views=((200, 18),))
    return res


R['convention'] = convention


# ---------------------------------------------------------------- City Hall, Police and Fire Station 1 (1609 State St)
# one civic block on the south side of State St: City Hall (east, council chambers 2nd floor), Police (middle),
# Fire Station 1 (west, apparatus doors to State St). 2018: fountain + sculpture landscaping in front of City Hall.
def cityhall(render=False):
    anchor = (5664.0, -145.0)
    G = g2l(anchor)
    brick, brick2, stone, glass, roofc, red = lin('#8a4e3b'), lin('#6e3c2e'), lin('#cfc6b4'), lin('#33495a'), lin('#6b6b69'), lin('#b3261e')
    ch = ccw([G(*p) for p in [(5685.1, -161.1), (5686.3, -126.8), (5708, -127.5), (5707.0, -159.0), (5701.5, -161.4)]])
    po = ccw([G(*p) for p in [(5685.1, -161.1), (5655.7, -159.2), (5656.7, -130.4), (5678.4, -131.2), (5678.6, -126.6), (5686.3, -126.8)]])
    fs = ccw([G(*p) for p in [(5655.7, -159.2), (5655.6, -161.2), (5618.3, -159.9), (5619.2, -134.8), (5636.6, -135.4), (5636.8, -129.7), (5656.7, -130.4)]])
    drumA, drumB = G(5707.3, -151.5), G(5701.5, -159.5)   # OSM: a round stair tower on the east side, a rounded NE corner
    K = Kit(911)
    north = lambda mid: mid[1] > G(0, -158)[1]

    def block(P, H, nfl, bay, sign=None, stone_base=True):
        for i, L, Ln, mid in sides(P):
            if Ln < 3:
                K.quad(L, 0, Ln, -3, H, 0, brick)
                continue
            K.quad(L, 0, Ln, -3, 0.9, 0, stone if stone_base else brick2)
            windows(K, L, 0.8, Ln - 0.8, 0.9, (H - 1.9) / nfl, nfl, max(1, round((Ln - 1.6) / bay)), brick, wf=0.5, hf=0.55, edge=0.8, sill=stone)
            K.quad(L, 0, Ln, H - 1.0, H, 0, brick)
            K.obox(L, -0.15, Ln + 0.15, H - 0.5, H, -0.1, 0.25, stone, BODY, ('d-',))
        K.prism(P, H - 0.1, H, roofc, sides=False)

    block(ch, 9.6, 2, 3.4)
    block(po, 8.8, 2, 3.4)
    # fire station: apparatus bays on the State St side, offices behind
    H = 8.0
    for i, L, Ln, mid in sides(fs):
        K.quad(L, 0, Ln, -3, H, 0, brick)
        K.quad(L, 0, Ln, -3, 0.9, 0.02, stone)
        if north(mid) and Ln > 30:
            for k in range(4):
                u0 = 3 + k * 8.6
                K.quad(L, u0, u0 + 4.6, 0, 4.6, 0.03, lin('#d6d8d6'))
                for r in range(5):
                    K.quad(L, u0 + 0.2, u0 + 4.4, 0.6 + r * 0.8, 0.95 + r * 0.8, 0.05, glass if r == 3 else lin('#b9bcbb'), LIT if r == 3 else BODY)
                K.obox(L, u0 - 0.35, u0 + 4.95, 4.6, 5.0, 0, 0.2, red, BODY, ('d-',))
            text_on(K, L, 'BETTENDORF FIRE STATION 1', Ln / 2, 5.6, 0.75, lin('#f2efe6'), BODY)
        elif Ln > 6:
            windows(K, L, 0.8, Ln - 0.8, 0.9, 3.4, 2, max(1, round((Ln - 1.6) / 3.6)), brick, wf=0.45, hf=0.5, edge=0.8)
        K.obox(L, -0.15, Ln + 0.15, H - 0.5, H, -0.1, 0.25, stone, BODY, ('d-',))
    K.prism(fs, H - 0.1, H, roofc, sides=False)
    # the round glass corner (council chambers upstairs) and the glass stair drum, both a little above the roof
    for (c, r, top) in ((drumB, 4.3, 10.6), (drumA, 3.0, 11.2)):
        K.cyl(c[0], c[1], r, -3, 0.9, stone, BODY, 16)
        K.cyl(c[0], c[1], r, 0.9, top, glass, LIT, 16)
        K.cyl(c[0], c[1], r + 0.25, top, top + 0.6, stone, BODY, 16)
        for k in range(8):
            a = k * math.pi / 4
            x, y = c[0] + math.cos(a) * (r + 0.05), c[1] + math.sin(a) * (r + 0.05)
            K.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 0.9, top, stone)
    # main entrance on State St: stone portal, canopy, name
    ex, fy = G(5692, 0)[0], G(0, -161.2)[1]
    F = lambda u, h, d: (ex - u, fy + d, h)
    K.obox(F, -4.5, 4.5, -3, 9.9, -0.2, 0.6, stone, BODY, ('d-',))
    K.quad(F, -3.2, 3.2, 0, 3.4, 0.62, lin('#ffe9b8'), LIT)
    K.quad(F, -3.2, 3.2, 4.4, 8.4, 0.62, glass, LIT)
    K.obox(F, -5, 5, 3.6, 4.1, 0.6, 3.6, stone, BODY, ('d-',))
    text_on(K, F, 'CITY OF BETTENDORF', 0, 8.9, 0.6, lin('#2c2a28'), BODY, 0.63)
    px, py = G(5670, 0)[0], G(0, -159.9)[1]
    F2 = lambda u, h, d: (px - u, py + d, h)
    K.obox(F2, -3, 3, 3.2, 3.6, 0, 2.6, stone, BODY, ('d-',))
    K.quad(F2, -2.2, 2.2, 0, 3.0, 0.05, lin('#ffe9b8'), LIT)
    text_on(K, F2, 'POLICE', 0, 4.4, 0.7, lin('#f2efe6'), BODY)
    # front plaza: round fountain and a stainless sculpture (2018 landscaping)
    fx, fz = G(5700, -170.5)
    K.cyl(fx, fz, 3.2, -0.5, 0.55, stone, BODY, 16)
    K.cyl(fx, fz, 2.8, 0.55, 0.56, lin('#4f86a0'), LIT, 16)
    K.cyl(fx, fz, 0.35, 0.5, 1.8, stone, BODY, 8)
    K.cyl(fx, fz, 0.9, 1.8, 2.0, stone, BODY, 10)
    sx, sz = G(5680, -170.5)
    K.box(sx - 0.8, sx + 0.8, sz - 0.8, sz + 0.8, -0.3, 0.6, stone)
    for k in range(10):
        a0, a1 = math.pi * k / 10, math.pi * (k + 1) / 10
        K.rod((sx + math.cos(a0) * 1.6, sz, 0.6 + math.sin(a0) * 3.2), (sx + math.cos(a1) * 1.6, sz, 0.6 + math.sin(a1) * 3.2), 0.18, lin('#c9ced3'), BODY, 6)
    lod0 = K.obj('cityhall_lod0')
    K1 = Kit(912)
    lod1_bands(K1, ch, 0, 2, 4.8, brick)
    lod1_bands(K1, po, 0, 2, 4.4, brick)
    K1.prism(fs, -3, 8.0, brick, topcol=roofc)
    K1.cyl(drumB[0], drumB[1], 4.3, -3, 10.6, glass, LIT, 8)
    K1.cyl(drumA[0], drumA[1], 3.0, -3, 11.2, glass, LIT, 8)
    lod1 = K1.obj('cityhall_lod1')
    res = finish('cityhall', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bett_cityhall', (10, 0, 4), 80, lod1, views=((200, 20), (120, 25)))
    return res


R['cityhall'] = cityhall


# ---------------------------------------------------------------- Family Museum (2900 Learning Campus Dr, 1997)
# children's museum on the Learning Campus beside Faye's Field and the library. Two wings; the curved bay on the west.
def museum(render=False):
    anchor = (6252.0, -3226.0)
    G = g2l(anchor)
    buff, buff2, teal, glass, roofc, yel, red = lin('#d8c7a4'), lin('#b29f7c'), lin('#2f7f86'), lin('#355466'), lin('#77746f'), lin('#f2b632'), lin('#c8432f')
    west = ccw([G(*p) for p in [(6218.1, -3226.9), (6257.1, -3226.0), (6258.5, -3195.0), (6226.5, -3195), (6216.7, -3195.2)]])
    east = ccw([G(*p) for p in [(6258.3, -3236.2), (6254.1, -3255.1), (6252.6, -3266.1), (6270.8, -3266.7), (6283.1, -3184.9), (6226.5, -3191.7),
                                (6226.5, -3195), (6258.5, -3195.0), (6257.2, -3231.3)]])
    bay_c = G(6262.0, -3245.5)
    K = Kit(921)
    for P, H in ((west, 8.5), (east, 11.0)):
        for i, L, Ln, mid in sides(P):
            if Ln < 3:
                K.quad(L, 0, Ln, -3, H, 0, buff)
                continue
            K.quad(L, 0, Ln, -3, 1.0, 0, buff2)
            K.quad(L, 0, Ln, 1.0, H, 0, buff)
            for k in range(int(Ln // 9)):   # tall slot windows and coloured accent bands
                u = 4 + k * 9
                if u + 2 > Ln - 1:
                    break
                on = K.rnd.random() < 0.5
                K.quad(L, u, u + 1.6, 1.4, H - 2.2, 0.02, LIT_C if on else glass, LIT if on else GLASS)
            K.quad(L, 0, Ln, H - 1.6, H - 1.0, 0.03, teal)
            K.obox(L, -0.2, Ln + 0.2, H - 0.4, H + 0.3, -0.1, 0.35, teal, BODY, ('d-',))
        K.prism(P, H - 0.1, H, roofc, sides=False)
    # curved glass bay (west face of the east wing)
    K.cyl(bay_c[0], bay_c[1], 10.5, -0.5, 9.0, glass, LIT, 12, a0=math.radians(150), a1=math.radians(212), closed=False)
    K.cyl(bay_c[0], bay_c[1], 10.8, 9.0, 9.8, teal, BODY, 12, a0=math.radians(150), a1=math.radians(212), closed=False)
    # entrance: a tall glass box with a bright arched canopy facing Learning Campus Drive (north-east end)
    a, b = G(6276.5, -3185.7), G(6262.0, -3187.4)
    L, Ln = frame(a, b)   # east -> west along the CCW outline, so d points out (north)
    K.obox(L, 0, Ln, -3, 13.0, -0.2, 2.5, glass, LIT, ('h-',))
    for k in range(7):
        u = k * Ln / 6
        K.obox(L, u - 0.1, u + 0.1, 0, 13.0, 2.5, 2.7, lin('#e8e6e0'), BODY, ('h-',))
    for k in range(10):
        t0, t1 = math.pi * k / 10, math.pi * (k + 1) / 10
        u0, u1 = Ln / 2 - math.cos(t0) * 7, Ln / 2 - math.cos(t1) * 7
        h0, h1 = 4.0 + math.sin(t0) * 2.0, 4.0 + math.sin(t1) * 2.0
        K.face([L(u0, h0, 2.7), L(u1, h1, 2.7), L(u1, h1, 8.0), L(u0, h0, 8.0)], yel)
        K.face([L(u0, h0 - 0.05, 8.0), L(u1, h1 - 0.05, 8.0), L(u1, h1 - 0.05, 2.7), L(u0, h0 - 0.05, 2.7)], lin('#fff1c4'), LIT)
    for u in (Ln / 2 - 6.5, Ln / 2 + 6.5):
        x, y, _ = L(u, 0, 7.6)
        K.cyl(x, y, 0.22, 0, 4.0, red, BODY, 8)
    text_on(K, L, 'FAMILY MUSEUM', Ln / 2, 10.6, 1.25, lin('#ffffff'), NEON, 2.8)
    # playful roof drums (exhibit hall skylights)
    for (gx, gz, r) in ((6262, -3215, 3.0), (6268, -3240, 2.4)):
        x, y = G(gx, gz)
        K.cyl(x, y, r, 11.0, 13.2, red if r > 2.6 else yel, BODY, 12)
        K.cyl(x, y, r * 0.8, 13.2, 13.25, glass, LIT, 12)
    lod0 = K.obj('museum_lod0')
    K1 = Kit(922)
    K1.prism(west, -3, 8.5, buff, topcol=roofc)
    K1.prism(east, -3, 11.0, buff, topcol=roofc)
    K1.obox(L, 0, Ln, -3, 13.0, -0.2, 2.5, glass, LIT, ('h-',))
    K1.cyl(bay_c[0], bay_c[1], 10.5, -0.5, 9.0, glass, LIT, 6, a0=math.radians(150), a1=math.radians(212), closed=False)
    lod1 = K1.obj('museum_lod1')
    res = finish('museum', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bett_museum', (12, 0, 5), 90, lod1, views=((-30, 20), (230, 20)))
    return res


R['museum'] = museum

if __name__ == '__main__':
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(R)
    render = 'render' in names
    names = [n for n in names if n != 'render']
    bpy.context.scene.name = LM_SCENE
    for n in names:
        for o in list(bpy.context.scene.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        print('BETT', n, R[n](render))
