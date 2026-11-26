# Geneseo (IL) signature models -> assets/models/regions/geneseo/<name>.glb, sources -> assets/src/regions/geneseo/<name>.blend.
# Reuses the landmark kit (assets/src/landmarks.py: Kit, windows, storefront, cornice, finish...). Background only:
#   Blender -b --factory-startup -P assets/src/regions/geneseo/geneseo.py -- bandstand storefronts congregational
# Footprints are OSM (ids in docs/regions/geneseo.md); anchors are game x/z (tools/map-config.mjs project()).
# Blender X = game x - anchor x, Blender Y = -(game z - anchor z), Z up, base at 0 (the game sits it on the terrain).
import sys, math
ROOT = __import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + ''
exec(open(ROOT + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/geneseo/'
LOUT = OUT + 'regions/geneseo/'
SHOTS = '/private/tmp/claude-501/-Users-dainmoens-Documents-Tim-Arnett-Town/392d4b1d-feae-4f8b-b8db-07c7ac05def9/scratchpad/'


def shots(name, target, dist, lod1=None, views=((25, 12), (200, 25))):
    paths = []
    if lod1:
        lod1.hide_render = True
    for i, (yaw, pitch) in enumerate(views):
        p = SHOTS + '%s_%d.png' % (name, i)
        lm_preview(p, target, dist, yaw, pitch, (800, 600), 35)
        bpy.ops.render.render(write_still=True)
        paths.append(p)
    if lod1:
        lod1.hide_render = False
    return paths


def octagon(r, rot=math.pi / 8):
    return [(math.cos(rot + k * math.pi / 4) * r, math.sin(rot + k * math.pi / 4) * r) for k in range(8)]


WHITE, CREAM = lin('#f1efe8'), lin('#e4dccb')


# ================================================================ CITY PARK BANDSTAND
# The octagonal gazebo in the north block of Geneseo City Park (OSM way 706132429, ~9 m across, between the
# fountain and the First Congregational Church). Classic white Victorian bandstand: brick base, steps on the
# State Street (east) side, turned posts, spindle railing, bracketed frieze, octagonal roof with a lantern.
# (Colours are the usual for the type; no photo source found, see docs/regions/geneseo.md.)
def bandstand(render=True):
    anchor = (35065.1, 8105.0)
    R = 4.5
    brick, cap, deck, roofc = lin('#8b4b3a'), lin('#c2bbae'), lin('#9c8b73'), lin('#3f5446')
    K = Kit(301, ao=2.0)
    O = octagon(R)
    K.prism(O, -1.5, 0.9, brick, top=False)
    K.prism(octagon(R + 0.12), 0.9, 1.05, cap, topcol=deck)
    # steps up the east side
    for k in range(4):
        x0 = R * math.cos(math.pi / 8) + k * 0.32
        K.box(x0 - 0.3, x0 + 0.32, -1.1, 1.1, -1.5, 1.05 - (k + 1) * 0.26, cap)
    # posts, rails, spindles
    P = octagon(R - 0.25)
    for (x, y) in P:
        K.box(x - 0.11, x + 0.11, y - 0.11, y + 0.11, 1.05, 4.2, WHITE)
        K.box(x - 0.17, x + 0.17, y - 0.17, y + 0.17, 1.05, 1.35, WHITE)
    for i in range(8):
        a, b = P[i], P[(i + 1) % 8]
        L, Ln = frame(a, b)
        mid = L(Ln / 2, 0, 0)
        # frieze band + brackets on every side
        K.obox(L, 0.1, Ln - 0.1, 3.8, 4.2, -0.05, 0.05, WHITE, BODY, ('h-',))
        for u in (0.12, Ln - 0.12):
            uu = u + (0.45 if u < 1 else -0.45)
            K.face([L(u, 3.8, 0.04), L(u, 3.2, 0.04), L(uu, 3.8, 0.04)][::(1 if u < 1 else -1)], WHITE)
            K.face([L(u, 3.8, -0.04), L(uu, 3.8, -0.04), L(u, 3.2, -0.04)][::(1 if u < 1 else -1)], WHITE)
        if mid[0] > R * 0.8:  # the east side stays open for the steps
            continue
        K.obox(L, 0.1, Ln - 0.1, 1.95, 2.05, -0.06, 0.06, WHITE)
        K.obox(L, 0.1, Ln - 0.1, 1.15, 1.22, -0.05, 0.05, WHITE)
        n = int(Ln / 0.3)
        for s in range(1, n):
            u = s * Ln / n
            K.obox(L, u - 0.025, u + 0.025, 1.22, 1.95, -0.025, 0.025, WHITE, BODY, ('h-', 'h+'))
    # roof: soffit, eave fascia, octagonal pyramid, lantern, finial
    E = octagon(R + 0.6)
    K.face([(x, y, 4.2) for x, y in E][::-1], CREAM)
    K.prism(E, 4.2, 4.42, WHITE, top=False)
    for i in range(8):
        a, b = E[i], E[(i + 1) % 8]
        K.face([(a[0], a[1], 4.42), (b[0], b[1], 4.42), (0, 0, 7.0)], roofc)
    Lc = octagon(0.55)
    K.prism(Lc, 6.5, 7.3, WHITE, top=False)
    Lr = octagon(0.8)
    for i in range(8):
        a, b = Lr[i], Lr[(i + 1) % 8]
        K.face([(a[0], a[1], 7.3), (b[0], b[1], 7.3), (0, 0, 8.0)], roofc)
    K.cyl(0, 0, 0.05, 8.0, 8.6, lin('#c9a24a'), BODY, 4)
    K.cyl(0, 0, 0.12, 8.6, 8.75, lin('#c9a24a'), BODY, 6, r1=0)
    lod0 = K.obj('bandstand_lod0')
    K1 = Kit(302, ao=2.0)
    K1.prism(O, -1.5, 1.05, brick, topcol=deck)
    for (x, y) in P:
        K1.box(x - 0.12, x + 0.12, y - 0.12, y + 0.12, 1.05, 4.2, WHITE)
    K1.prism(E, 4.0, 4.42, WHITE, top=False)
    for i in range(8):
        a, b = E[i], E[(i + 1) % 8]
        K1.face([(a[0], a[1], 4.42), (b[0], b[1], 4.42), (0, 0, 7.0)], roofc)
    lod1 = K1.obj('bandstand_lod1')
    res = finish('bandstand', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bandstand', (0, 0, 3.5), 16, lod1, views=((60, 12), (200, 30)))
    return res


B['bandstand'] = bandstand


# ================================================================ NORTH STATE STREET ROW (101-119 N State)
# The west side of N State St between Exchange and 1st: Mel Foster (119), Brown & Ray (115), Katsch (115),
# the Central Theatre (111, opened 1924 as the New Geneseo Theatre; its canopy marquee was rebuilt to look like
# the original) and Central Bank Illinois (101, on the 1st St corner; the bank owns the theatre building).
# Two-storey 19th-c. brick commercial fronts facing east onto the State St boulevard. OSM footprints.
ROW = [  # name, OSM footprint (game x/z), height, wall, trim, shop bays, upper bays
    ('mel', [(35120.4, 7714.8), (35145.0, 7720.1), (35145.4, 7727.3), (35120.2, 7726.6)], 8.6, '#8c4a36', '#d8cfb8', 2, 3),
    ('brownray', [(35117.2, 7726.4), (35145.4, 7727.3), (35145.3, 7739.1), (35116.9, 7738.5)], 9.2, '#b89a6e', '#efe6d2', 3, 4),
    ('katsch', [(35116.9, 7738.5), (35145.3, 7739.1), (35145.2, 7748.2), (35116.6, 7747.6)], 8.2, '#9b5a40', '#e2d6bd', 2, 3),
    ('theatre', [(35116.6, 7747.6), (35145.2, 7748.2), (35145.1, 7756.9), (35116.4, 7756.4)], 10.4, '#c8b48a', '#f2ead8', 0, 3),
    ('bank', [(35116.4, 7756.4), (35145.1, 7756.9), (35144.7, 7777.7), (35116.0, 7777.1)], 9.8, '#cfc6b0', '#ebe5d6', 4, 5),
]


def storefronts(render=True):
    anchor = (35131.0, 7746.0)
    K = Kit(311)
    K1 = Kit(312)
    for name, gp, H, wc, tc, sb, ub in ROW:
        wall, trim = lin(wc), lin(tc)
        P = local(gp, anchor)
        es = list(sides(P))
        front = max(es, key=lambda e: e[3][0])[0]  # east edge = State St
        corner = min(es, key=lambda e: e[3][1])[0] if name == 'bank' else -1  # south edge on 1st St
        for i, L, Ln, mid in es:
            if i in (front, corner):
                continue
            K.quad(L, 0, Ln, -3, H, 0, scale(wall, 0.85))
        roof(K, P, H, ROOF)
        for i, L, Ln, mid in es:
            if i not in (front, corner):
                continue
            K.quad(L, 0, Ln, -3, 0, 0, scale(trim, 0.7))
            if name == 'theatre' and i == front:
                K.quad(L, 0, Ln, 0, 4.4, 0, trim)
                for k in range(3):  # lobby doors
                    u = 2.6 + k * 1.5
                    K.quad(L, u, u + 1.2, 0, 2.5, 0.02, LIT_C, LIT)
                K.quad(L, 0.4, 1.8, 0.6, 2.6, 0.02, lin('#7a1c1c'))  # poster cases
                K.quad(L, Ln - 1.8, Ln - 0.4, 0.6, 2.6, 0.02, lin('#7a1c1c'))
            elif i == front:
                storefront(K, L, 0.3, Ln - 0.3, 0, 4.0, scale(trim, 0.6) if name != 'bank' else trim, sb or 2)
                K.quad(L, 0, 0.3, 0, 4.0, 0, wall)
                K.quad(L, Ln - 0.3, Ln, 0, 4.0, 0, wall)
                K.quad(L, 0, Ln, 4.0, 4.4, 0, wall)
            else:  # bank side on 1st St: tall windows, side door
                windows(K, L, 0.6, Ln - 0.6, 0, 4.4, 1, max(1, round(Ln / 3.4)), wall, wf=0.5, hf=0.7, edge=0.6, lit=0.6)
            belt(K, L, 0, Ln, 4.0, trim, 0.25, 0.4, 0)
            windows(K, L, 0.6, Ln - 0.6, 4.4, H - 6.0, 1, ub, wall, wf=0.5, hf=0.7, rec=0.25, sill=trim, head=trim, edge=0.6,
                    glass=lin('#26323a'))
            K.quad(L, 0, Ln, H - 1.6, H, 0, wall)
            cornice(K, L, 0, Ln, H + 0.5, trim, proj=0.6, depth=0.9, brackets=1.2, ext=0)
            K.obox(L, 0, Ln, H, H + 0.5, -0.3, 0, wall, BODY, ('d-', 'h-'))
            if name == 'bank' and i == front:
                K.text('CENTRAL BANK', L, Ln / 2, 4.45, 0.32, 0.45, lin('#7a5c2e'), BODY, 0.08, res=1)
        # LOD1
        K1.prism(P, -3, H, wall, topcol=ROOF)
        L, Ln = es[front][1], es[front][2]
        K1.quad(L, 0.3, Ln - 0.3, 0.5, 3.6, 0.03, LIT_C, LIT)
        K1.quad(L, 0.6, Ln - 0.6, 5.2, H - 2.2, 0.03, GLASS_C, GLASS)
    # Central Theatre canopy marquee over the State St sidewalk, bulb-lit, CENTRAL on three faces
    P = local(ROW[3][1], anchor)
    es = list(sides(P))
    i, L, Ln, mid = max(es, key=lambda e: e[3][0])
    u0, u1, dd = 0.7, Ln - 0.7, 3.2
    dark, gold, bulb, red = lin('#1a1414'), lin('#ffd54f'), lin('#fff1c4'), lin('#b81d1d')
    K.obox(L, u0, u1, 3.3, 4.6, 0, dd, red, BODY, ())
    K.face([L(u0, 3.29, 0), L(u1, 3.29, 0), L(u1, 3.29, dd), L(u0, 3.29, dd)], lin('#ffe9b0'), LIT)
    F = lambda u, h, d: L(u, h, dd + d)
    K.quad(F, u0 + 0.2, u1 - 0.2, 3.5, 4.4, 0.01, dark)
    K.text('CENTRAL', F, (u0 + u1) / 2, 3.62, 0.02, 0.7, gold, NEON, 0.05, res=1)
    for h in (3.38, 4.48):
        for k in range(int((u1 - u0) / 0.4)):
            u = u0 + 0.2 + k * 0.4
            K.quad(F, u - 0.06, u + 0.06, h - 0.06, h + 0.06, 0.02, bulb, NEON)
    for s, uu in ((1, u1), (-1, u0)):
        S = lambda u, h, d, uu=uu, s=s: L(uu + s * d, h, dd - u if s > 0 else u)
        K.text('CENTRAL', S, dd / 2, 3.62, 0.02, 0.5, gold, NEON, 0.04, res=1)
    for uu in (u0 + 0.5, u1 - 0.5):  # tie rods back to the wall
        K.rod(L(uu, 4.6, dd - 0.3), L(uu, 7.4, 0), 0.04, lin('#222'))
    K1.obox(L, u0, u1, 3.3, 4.6, 0, dd, red, BODY, ())
    K1.quad(F, u0 + 0.2, u1 - 0.2, 3.4, 4.5, 0.01, gold, NEON)
    lod0 = K.obj('storefronts_lod0')
    lod1 = K1.obj('storefronts_lod1')
    res = finish('storefronts', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('storefronts', (10, 0, 5), 42, lod1, views=((95, 10), (140, 25)))
    return res


B['storefronts'] = storefronts


# ================================================================ FIRST CONGREGATIONAL CHURCH (UCC), 319 S State
# The colony church (organised 1836; the 1855-56 building stood on this site) at the east side of City Park's north
# block, facing the State St boulevard. OSM way 707077022: ~19 x 33 m nave + a 11 x 6 m projection on the south
# (Pearl St) end, which carries the tower here, + a low wing on the west. Red brick, stone trim, gabled slate roof,
# square belfry and spire. Massing from OSM; the facade details are generic (no photo source found).
def congregational(render=True):
    anchor = (35128.0, 8180.0)
    brick, stone, slate, spire = lin('#8e4a38'), lin('#d6cdb8'), lin('#4b4d52'), lin('#55595a')
    K = Kit(321, ao=4.0)
    K1 = Kit(322, ao=4.0)
    G = lambda gx, gz: (gx - anchor[0], -(gz - anchor[1]))
    x0, y1 = G(35118.6, 8160.2)
    x1, y0 = G(35137.9, 8193.4)
    eave, ridge = 9.0, 15.5
    nave = rect(x0, x1, y0, y1)
    # walls with tall round-headed windows on the long sides
    for i, L, Ln, mid in sides(nave):
        K.quad(L, 0, Ln, -3, 0, 0, stone)
        long = Ln > 25
        if long:
            bays = 6
            windows(K, L, 1.5, Ln - 1.5, 0, eave - 1.5, 1, bays, brick, wf=0.42, hf=0.62, rec=0.3, sill=stone,
                    edge=1.5, glass=lin('#3a3050'), lit=0.5, litc=lin('#e7c27a'))
            fh = eave - 1.5
            arch_heads(K, L, 1.5, Ln - 1.5, bays, (fh - fh * 0.62) * 0.42 + fh * 0.62, (Ln - 3) / bays * 0.42, stone)
            K.quad(L, 0, Ln, eave - 1.5, eave, 0, brick)
        else:  # gable ends
            K.quad(L, 0, Ln, 0, eave, 0, brick)
            K.face([L(0, eave, 0), L(Ln, eave, 0), L(Ln / 2, ridge, 0)], brick)
            # big rose-ish window in each gable end
            for k in range(10):
                a, b = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
                K.face([L(Ln / 2, 5.5, 0.03), L(Ln / 2 + math.cos(a) * 2.2, 5.5 + math.sin(a) * 2.2, 0.03),
                        L(Ln / 2 + math.cos(b) * 2.2, 5.5 + math.sin(b) * 2.2, 0.03)], lin('#3a3050'), GLASS)
        belt(K, L, 0, Ln, 0, stone, 0.15, 0.6, 0)
    # gable roof along the nave (north-south)
    xm = (x0 + x1) / 2
    for (xa, xb) in ((x0 - 0.5, xm), (x1 + 0.5, xm)):
        pts = [(xa, y0 - 0.4, eave - 0.3), (xa, y1 + 0.4, eave - 0.3), (xb, y1 + 0.4, ridge + 0.2), (xb, y0 - 0.4, ridge + 0.2)]
        ctr = Vector((xm, (y0 + y1) / 2, eave))
        K.oface([Vector(p) for p in pts], ctr, slate)
        K1.oface([Vector(p) for p in pts], ctr, slate)
    # west wing (one storey, flat)
    wing = local([(35118.5, 8160.2), (35121.9, 8160.2), (35121.9, 8174.1), (35118.5, 8174.1)], anchor)
    # tower over the south projection
    tx0, ty1 = G(35124.7, 8193.4)
    tx1, ty0 = G(35135.6, 8199.4)
    tcx, tcy, tw = (tx0 + tx1) / 2, (ty0 + ty1) / 2, 3.2
    T = rect(tcx - tw, tcx + tw, tcy - tw, tcy + tw)
    porch = rect(tx0, tx1, ty0, ty1)
    K.prism(porch, -3, 6.0, brick, topcol=slate)
    K.prism(T, 6.0, 19.0, brick, top=False)
    for i, L, Ln, mid in sides(T):
        belt(K, L, 0, Ln, 6.0, stone, 0.2, 0.4)
        belt(K, L, 0, Ln, 14.8, stone, 0.2, 0.4)
        K.quad(L, 1.6, Ln - 1.6, 8.5, 12.5, 0.02, lin('#3a3050'), GLASS)  # tall lancet-ish window
        K.face([L(1.6, 12.5, 0.02), L(Ln - 1.6, 12.5, 0.02), L(Ln / 2, 13.8, 0.02)], lin('#3a3050'), GLASS)
        # belfry: louvred openings
        K.quad(L, 1.4, Ln - 1.4, 15.6, 18.2, -0.25, lin('#2a2624'))
        for k in range(6):
            h = 15.8 + k * 0.4
            K.obox(L, 1.4, Ln - 1.4, h, h + 0.12, -0.25, -0.05, lin('#6d6a64'), BODY, ('d-',))
        K.face([L(1.4, 18.2, 0.01), L(Ln - 1.4, 18.2, 0.01), L(Ln / 2, 18.9, 0.01)], stone)
        cornice(K, L, 0, Ln, 19.6, stone, proj=0.5, depth=0.8, brackets=0.9, ext=0)
    # front door in the porch (south face, onto Pearl St)
    PF = lambda u, h, d: (tx1 - u, ty0 - d, h)
    K.quad(PF, (tx1 - tx0) / 2 - 1.2, (tx1 - tx0) / 2 + 1.2, 0, 2.9, 0.03, lin('#5a2e1e'))
    K.face([PF((tx1 - tx0) / 2 - 1.2, 2.9, 0.03), PF((tx1 - tx0) / 2 + 1.2, 2.9, 0.03), PF((tx1 - tx0) / 2, 4.0, 0.03)], stone)
    # spire: octagonal, from the tower top, with corner pinnacles
    S = octagon(2.9)
    K.prism([(tcx + x, tcy + y) for x, y in S], 19.6, 20.6, stone, top=False)
    for i in range(8):
        a, b = S[i], S[(i + 1) % 8]
        f = [(tcx + a[0], tcy + a[1], 20.6), (tcx + b[0], tcy + b[1], 20.6), (tcx, tcy, 37.0)]
        K.face(f, spire)
        K1.face(f, spire)
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = tcx + sx * (tw - 0.3), tcy + sy * (tw - 0.3)
            K.box(px - 0.3, px + 0.3, py - 0.3, py + 0.3, 19.6, 20.6, stone)
            K.cyl(px, py, 0.3, 20.6, 22.4, spire, BODY, 4, r1=0)
    gold = lin('#c9a24a')
    K.box(tcx - 0.06, tcx + 0.06, tcy - 0.06, tcy + 0.06, 37.0, 38.6, gold)
    K.box(tcx - 0.45, tcx + 0.45, tcy - 0.06, tcy + 0.06, 37.9, 38.05, gold)
    K.prism(wing, -3, 4.5, brick, topcol=ROOF)
    lod0 = K.obj('congregational_lod0')
    K1.prism(nave, -3, eave, brick, top=False)
    for i, L, Ln, mid in sides(nave):
        if Ln < 25:
            K1.face([L(0, eave, 0), L(Ln, eave, 0), L(Ln / 2, ridge, 0)], brick)
    K1.prism(porch, -3, 6.0, brick, topcol=slate)
    K1.prism(T, 6.0, 20.6, brick, topcol=stone)
    K1.prism(wing, -3, 4.5, brick, topcol=ROOF)
    lod1 = K1.obj('congregational_lod1')
    res = finish('congregational', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('congregational', (0, -5, 14), 70, lod1, views=((150, 12), (40, 20)))
    return res


B['congregational'] = congregational


if __name__ == '__main__' or True:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if argv:
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for n in argv:
            for o in list(bpy.context.scene.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            r = B[n](True)
            print('RESULT', n, r)
