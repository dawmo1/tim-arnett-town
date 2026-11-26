# Moline signature models (region 'moline'): LeClaire Hotel, Wharton Field House, Deere-Wiman House.
# Uses the landmark kit in assets/src/landmarks.py; GLBs go to assets/models/regions/moline/<name>.glb.
# Headless:  Blender -b --factory-startup -P assets/src/regions/moline/moline.py -- leclaire wharton deerewiman
# References: docs/regions/moline.md.
import sys
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/landmarks.py').read(), globals())
LOUT = OUT + 'regions/moline/'
SRC = ROOT + 'assets/src/regions/moline/'


# ================================================================ LECLAIRE HOTEL
# 421 19th St (Kirsch & Kolb, 1921-22): 15 storeys, 51 m, the tallest building in the Quad Cities when built.
# Two-storey stone base and mezzanine with a round-arched entry flanked by arched windows on 19th St, brick
# shaft with belt courses, a deep bracketed cornice on top. Footprint from OSM way 166965101.
def leclaire(render=True):
    anchor = (5511.3, 1692.0)
    K = Kit(301)
    brick, stone, trim = lin('#8e5a3e'), lin('#d6cbb4'), lin('#e3dac6')
    P = local([(5511.0, 1666.1), (5531.6, 1708.1), (5512.3, 1717.5), (5490.4, 1676.1)], anchor)
    K.prism(P, -4, 0, stone, top=False)
    fh, nshaft = 3.3, 12
    top0 = 9.0 + nshaft * fh  # 48.6
    for i, L, Ln, mid in sides(P):
        front = mid[0] > 6  # the 19th Street face
        nb = max(1, round((Ln - 1.2) / 3.7))
        if front:
            # arched entry in the middle, arched windows either side, on a stone base
            mid_u = Ln / 2
            K.quad(L, 0, Ln, 0, 9.0, 0, stone)
            for k in range(-3, 4):
                c = mid_u + k * 5.2
                r = 2.2 if k == 0 else 1.6
                top = 5.6 if k == 0 else 5.0
                K.quad(L, c - r, c + r, 0 if k == 0 else 1.0, top, 0.03, LIT_C if k else lin('#3a2a20'), LIT if k else BODY)
                pts = [(c + math.cos(math.pi * j / 6) * r, top + math.sin(math.pi * j / 6) * r) for j in range(7)]
                K.face([L(c, top, 0.03)] + [L(u, h, 0.03) for u, h in pts], GLASS_C, GLASS)
                K.obox(L, c - r - 0.3, c + r + 0.3, top + r, top + r + 0.5, 0, 0.25, trim, BODY, ('d-',))
            K.obox(L, mid_u - 4, mid_u + 4, 6.4, 6.7, 0, 1.6, lin('#2c2620'), BODY, ('d-',))  # entry canopy
            windows(K, L, 0.6, Ln - 0.6, 6.0, 3.0, 1, nb, stone, wf=0.5, hf=0.55, edge=0)
        else:
            storefront(K, L, 0.6, Ln - 0.6, 0, 5.0, stone, max(1, round(Ln / 4.5)), lit=0.5)
            K.quad(L, 0, Ln, 5.0, 6.0, 0, stone)
            windows(K, L, 0.6, Ln - 0.6, 6.0, 3.0, 1, nb, stone, wf=0.5, hf=0.55, edge=0.6)
        belt(K, L, 0, Ln, 9.0, trim, 0.35, 0.5)
        windows(K, L, 0.6, Ln - 0.6, 9.4, fh, nshaft, nb, brick, wf=0.5, hf=0.62, rec=0.3)
        K.quad(L, 0, Ln, 9.0, 9.4, 0, brick)
        belt(K, L, 0, Ln, 9.0 + 2 * fh + 0.4, trim, 0.15, 0.3)
        belt(K, L, 0, Ln, top0 - 0.3, trim, 0.25, 0.4)
        windows(K, L, 0.6, Ln - 0.6, top0, 2.6, 1, nb, trim, wf=0.45, hf=0.5)
        cornice(K, L, 0, Ln, top0 + 3.6, trim, 1.6, 1.4, 1.2)
    roof(K, P, top0 + 3.6)
    K.box(-4, 5, -6, 6, top0 + 3.6, top0 + 7.5, brick)  # elevator / water tank penthouse
    K.box(-3.5, 4.5, -5.5, 5.5, top0 + 7.5, top0 + 7.9, trim)
    rooftop_junk(K, 0, 0, top0 + 3.6, K.rnd, 3, 6)
    lod0 = K.obj('leclaire_lod0')
    K1 = Kit(302)
    lod1_bands(K1, P, 0, 15, (top0 + 3.6) / 15, brick)
    for i, L, Ln, mid in sides(P):
        K1.obox(L, -1, Ln + 1, top0 + 2.6, top0 + 3.8, -0.1, 1.4, trim, BODY, ('d-',))
        K1.quad(L, 0, Ln, 0, 9.0, 0.05, stone)
    K1.box(-4, 5, -6, 6, top0 + 3.6, top0 + 7.5, brick)
    lod1 = K1.obj('leclaire_lod1')
    res = finish('leclaire', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('leclaire', (0, 0, 25), 120, lod1, views=((60, 10), (220, 25)))
    return res


# ================================================================ WHARTON FIELD HOUSE
# 1800 20th Ave (William Schulzke, 1928; ~6,000-7,250 seats): long brick hall under a shallow barrel roof,
# a raised entrance front on 20th Avenue (north) with three arched openings and the name over them, tall
# arched gym windows down both sides. Footprint from OSM way 319538556 (45.6 x 60.2 m, on the street grid).
def wharton(render=True):
    anchor = (5598.4, 3511.7)
    K = Kit(311)
    brick, stone, roofc = lin('#8a3f2c'), lin('#d8ccb0'), lin('#6c6f70')
    hw, hd, wall, rise = 22.8, 30.1, 11.0, 6.0
    P = local([(5575.6, 3481.6), (5621.0, 3481.6), (5621.0, 3541.8), (5575.6, 3541.8)], anchor)
    K.prism(P, -4, 0, stone, top=False)
    ew, ed, eh = 11.0, 3.5, 14.5
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, 0, wall, 0, brick)
        K.obox(L, -0.4, Ln + 0.4, wall, wall + 0.8, -0.05, 0.4, stone, BODY, ('d-', 'h-'))  # coping
        if abs(mid[0]) > 20:  # long sides: tall arched gym windows between pilasters
            for b in range(8):
                c = 4 + b * (Ln - 8) / 7
                on = b % 3 == 0
                K.quad(L, c - 1.4, c + 1.4, 3.5, 8.6, 0.03, LIT_C if on else GLASS_C, LIT if on else GLASS)
                pts = [(c + math.cos(math.pi * j / 6) * 1.4, 8.6 + math.sin(math.pi * j / 6) * 1.4) for j in range(7)]
                K.face([L(c, 8.6, 0.03)] + [L(u, h, 0.03) for u, h in pts], GLASS_C, GLASS)
                K.obox(L, c - 1.7, c + 1.7, 3.2, 3.5, 0, 0.2, stone, BODY, ('d-',))
                if b < 7:
                    K.obox(L, c + 3.0, c + 3.8, 0, wall, 0, 0.45, scale(brick, 0.85), BODY, ('d-', 'h-'))  # pilasters
        elif mid[1] > 20:  # north front on 20th Avenue: entrance block, three arches, the name, stepped parapet
            m = Ln / 2
            K.obox(L, m - ew, m + ew, 0, eh, 0, ed, brick, BODY, ('d-', 'h-'))
            K.obox(L, m - ew - 0.3, m + ew + 0.3, eh, eh + 0.6, -0.1, ed + 0.3, stone, BODY, ('d-', 'h-'))
            K.obox(L, m - 4, m + 4, eh + 0.6, eh + 2.2, 0.5, ed, brick, BODY, ('d-', 'h-'))
            K.obox(L, m - 4.3, m + 4.3, eh + 2.2, eh + 2.6, 0.3, ed + 0.2, stone, BODY, ('d-', 'h-'))
            for c in (m - 6.5, m, m + 6.5):
                r, door = 2.4, c == m
                K.quad(L, c - r, c + r, 0, 5.5, ed + 0.03, lin('#3a2a20') if door else LIT_C, BODY if door else LIT)
                pts = [(c + math.cos(math.pi * j / 8) * r, 5.5 + math.sin(math.pi * j / 8) * r) for j in range(9)]
                K.face([L(c, 5.5, ed + 0.03)] + [L(u, h, ed + 0.03) for u, h in pts], GLASS_C, GLASS)
                for j in range(8):
                    (ua, ha), (ub, hb) = pts[j], pts[j + 1]
                    k = 1 + 0.5 / r
                    K.face([L(ua, ha, ed + 0.08), L(c + (ua - c) * k, 5.5 + (ha - 5.5) * k, ed + 0.08), L(c + (ub - c) * k, 5.5 + (hb - 5.5) * k, ed + 0.08), L(ub, hb, ed + 0.08)][::-1], stone)
            K.obox(L, m - 9.5, m + 9.5, 9.8, 12.6, ed, ed + 0.12, stone, BODY, ('d-',))
            K.text('WHARTON FIELD HOUSE', L, m, 10.6, ed + 0.14, 1.25, lin('#6b1f2a'), BODY, 0.08, res=1)
            for c in (m - ew + 0.4, m + ew - 0.4):
                K.obox(L, c - 0.6, c + 0.6, 0, eh + 0.8, ed - 0.2, ed + 0.4, stone, BODY, ('d-', 'h-'))
    # shallow barrel roof along the long (north-south) axis, curved brick end walls
    seg = 10
    arc = [(-math.cos(math.pi * k / seg) * hw, wall + math.sin(math.pi * k / seg) * rise) for k in range(seg + 1)]
    for k in range(seg):
        (x0, z0), (x1, z1) = arc[k], arc[k + 1]
        K.oface([Vector((x0, -hd, z0)), Vector((x1, -hd, z1)), Vector((x1, hd, z1)), Vector((x0, hd, z0))], Vector((0, 0, wall - 40)), roofc)
        for sy in (-1, 1):
            K.oface([Vector((x0, sy * hd, z0)), Vector((x1, sy * hd, z1)), Vector((x1, sy * hd, wall)), Vector((x0, sy * hd, wall))], Vector((0, 0, wall)), brick)
        for r in range(5):  # roof ribs
            y = -hd + (r + 1) * 2 * hd / 6
            K.box(x0, x1, y - 0.25, y + 0.25, min(z0, z1), max(z0, z1) + 0.25, scale(roofc, 0.8))
    lod0 = K.obj('wharton_lod0')
    K1 = Kit(312)
    K1.prism(P, -4, wall, brick, top=False)
    arc = arc[::2]
    for k in range(len(arc) - 1):
        (x0, z0), (x1, z1) = arc[k], arc[k + 1]
        K1.oface([Vector((x0, -hd, z0)), Vector((x1, -hd, z1)), Vector((x1, hd, z1)), Vector((x0, hd, z0))], Vector((0, 0, wall - 40)), roofc)
        for sy in (-1, 1):
            K1.oface([Vector((x0, sy * hd, z0)), Vector((x1, sy * hd, z1)), Vector((x1, sy * hd, wall)), Vector((x0, sy * hd, wall))], Vector((0, 0, wall)), brick)
    K1.box(-ew, ew, hd, hd + ed, -4, eh, brick)
    K1.box(-9.5, 9.5, hd + ed, hd + ed + 0.1, 9.8, 12.6, stone)
    lod1 = K1.obj('wharton_lod1')
    res = finish('wharton', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('wharton', (0, 0, 8), 110, lod1, views=((20, 15), (215, 30)))
    return res


# ================================================================ DEERE-WIMAN HOUSE ("Overlook")
# 817 11th Ave (1872, for Charles Deere; W. L. B. Jenney attributed): clapboard Swiss-villa house on the bluff;
# after the 1899 fire the steep roof became a shallower one over a full third floor; rounded bays (1908) and a
# domed steel-and-glass conservatory on the south-east corner. Footprint from OSM way 1271506080.
def deerewiman(render=True):
    anchor = (4373.7, 2356.1)
    K = Kit(321)
    wallc, trim, roofc, found = lin('#ece4d0'), lin('#3f5a3c'), lin('#55585a'), lin('#9c8f7c')
    G = [(4383, 2347.8), (4383.1, 2349.2), (4382.5, 2350.2), (4381.4, 2350.9), (4380.6, 2350.9), (4380.3, 2352.8), (4382.2, 2353.2),
         (4383.2, 2354), (4383.7, 2355.2), (4383.5, 2356.5), (4382.6, 2357.5), (4381.4, 2358), (4379.5, 2357.8), (4378.5, 2364.6),
         (4379.9, 2364.8), (4378.9, 2371), (4371.1, 2369.8), (4368.7, 2368.9), (4368.9, 2367.9), (4363.4, 2367.1), (4364.4, 2360.6),
         (4359.4, 2359.9), (4360, 2356.3), (4355.7, 2355.7), (4356.5, 2350.8), (4360.7, 2351.5), (4361.7, 2344.8), (4366.6, 2345.6),
         (4366.9, 2343.5), (4381.3, 2345.6)]
    P = local(G, anchor)
    fh, nfl = 3.6, 3
    H = fh * nfl
    K.prism(P, -4, 0.8, found, top=False)
    for i, L, Ln, mid in sides(P):
        if Ln < 2.2:
            K.quad(L, 0, Ln, 0.8, H, 0, wallc)
            continue
        windows(K, L, 0.4, Ln - 0.4, 0.8, fh, nfl, max(1, round(Ln / 3.0)), wallc, wf=0.42, hf=0.62, sill=trim, head=trim, edge=0.4, lit=0.35)
        K.obox(L, -0.1, Ln + 0.1, H - 0.05, H + 0.35, -0.05, 0.35, trim, BODY, ('d-',))
        for j in range(nfl - 1):  # clapboard belts
            K.obox(L, 0, Ln, 0.8 + (j + 1) * fh - 0.12, 0.8 + (j + 1) * fh + 0.08, -0.02, 0.1, scale(wallc, 0.9), BODY, ('d-', 'h-'))
    K.prism(P, H + 0.35, H + 0.6, roofc, sides=True)
    # low hipped roofs over the main block and the west wing (post-1899 shallow roofline)
    gx = lambda x, z: (x - anchor[0], -(z - anchor[1]))
    for (ax, az, bx, bz, hr) in ((4361.5, 2346, 4381.5, 2357.5, 2.6), (4364.5, 2357, 4378.5, 2369.5, 2.4), (4356.3, 2351.3, 4362, 2359.5, 1.6)):
        (x0, y1), (x1, y0) = gx(ax, az), gx(bx, bz)
        hip_roof(K, x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5, H + 0.6, hr, roofc)
    for cx, cz in ((4366, 2350), (4377, 2362)):  # chimneys
        x, y = gx(cx, cz)
        K.box(x - 0.5, x + 0.5, y - 0.7, y + 0.7, H, H + 4.4, lin('#8a4a36'))
    # domed conservatory on the south-east corner (steel frame, glass)
    cx, cy = gx(4375.0, 2373.8)
    K.cyl(cx, cy, 3.4, 0, 0.6, found, BODY, 14)
    K.cyl(cx, cy, 3.3, 0.6, 4.2, LIT_C, LIT, 14, top=False)
    for j in range(5):
        a0, a1 = math.pi / 2 * j / 5, math.pi / 2 * (j + 1) / 5
        K.cyl(cx, cy, 3.3 * math.cos(a0), 4.2 + 2.6 * math.sin(a0), 4.2 + 2.6 * math.sin(a1), GLASS_C, GLASS, 14, r1=3.3 * math.cos(a1), top=False)
    for j in range(14):
        a = 2 * math.pi * j / 14
        K.rod((cx + math.cos(a) * 3.35, cy + math.sin(a) * 3.35, 0.6), (cx + math.cos(a) * 3.35, cy + math.sin(a) * 3.35, 4.2), 0.06, trim)
    K.cyl(cx, cy, 0.35, 6.8, 7.4, trim, BODY, 6)
    # north porch facing the river view, steps
    x0, y0 = gx(4366, 2343.5)
    x1, _ = gx(4378, 2343.5)
    K.box(x0, x1, y0, y0 + 2.6, 0, 0.8, found)
    K.box(x0, x1, y0, y0 + 2.6, 3.8, 4.1, trim)
    for k in range(5):
        x = x0 + 0.2 + k * (x1 - x0 - 0.4) / 4
        K.box(x - 0.12, x + 0.12, y0 + 2.2, y0 + 2.45, 0.8, 3.8, wallc)
    lod0 = K.obj('deerewiman_lod0')
    K1 = Kit(322)
    lod1_bands(K1, P, 0.8, nfl, fh, wallc, lit=0.3)
    for (ax, az, bx, bz, hr) in ((4361.5, 2346, 4381.5, 2357.5, 2.6), (4364.5, 2357, 4378.5, 2369.5, 2.4)):
        (x0, y1), (x1, y0) = gx(ax, az), gx(bx, bz)
        hip_roof(K1, x0 - 0.5, x1 + 0.5, y0 - 0.5, y1 + 0.5, H + 0.8, hr, roofc)
    K1.cyl(cx, cy, 3.3, 0, 6.5, GLASS_C, GLASS, 8, r1=1.0)
    lod1 = K1.obj('deerewiman_lod1')
    res = finish('deerewiman', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('deerewiman', (0, 0, 5), 50, lod1, views=((30, 20), (200, 30)))
    return res


B['leclaire'], B['wharton'], B['deerewiman'] = leclaire, wharton, deerewiman

if __name__ == '__main__' or bpy.app.background:
    names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['leclaire', 'wharton', 'deerewiman']
    bpy.context.scene.name = LM_SCENE
    for n in names:
        print('RESULT', n, build(n, True))
