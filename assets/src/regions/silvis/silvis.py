# Silvis region models (src/regions/silvis.js). Background Blender only:
#   Blender -b --factory-startup -P assets/src/regions/silvis/silvis.py -- shop hero
# Reuses the landmark kit (assets/src/landmarks.py) and writes GLBs to assets/models/regions/silvis/,
# sources to assets/src/regions/silvis/. References: docs/regions/silvis.md.
import sys, math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/landmarks.py').read(), globals())
LOUT = OUT + 'regions/silvis/'
SRC = ROOT + 'assets/src/regions/silvis/'
bpy.context.scene.name = LM_SCENE


# ================================================================ SILVIS SHOP
# The former Rock Island Lines Silvis locomotive shop (1903; Chrome 1981, NRE 1990-2021, RRHMA since 2022).
# Footprint = OSM way 489120819 (the ~270 m main shop north of 1st Ave). Red-brown brick walls with tall multi-pane
# shop windows between pilasters, flat roof with two long glazed clerestory monitors, track doors on the west end,
# a painted ROCK ISLAND herald facing 1st Avenue. Look is generic for Rock Island-era shops (no close-up reference).
SHOP_POLY = [(13626, 864), (13890, 933), (13881, 966), (13878, 979), (13868, 1014), (13820, 1002), (13818, 1009),
             (13672, 970), (13674, 962), (13614, 947), (13622, 918), (13590, 910), (13598, 881), (13599, 876),
             (13632, 885), (13635, 873), (13625, 870)]
SHOP_A = (13745, 940)


def shop(render=False):
    anchor = SHOP_A
    P = local(SHOP_POLY, anchor)
    brick, brick2, conc = lin('#8a4a36'), lin('#6e3a2b'), lin('#b9ae9a')
    roofc, mon = lin('#4b4947'), lin('#5b5a57')
    H = 15.0
    # long axis of the shop (Blender xy): game (264, 69) -> (264, -69)
    ax = Vector((264, -69, 0)).normalized()
    av = Vector((ax.y * -1, ax.x, 0))  # left of the axis = game north
    o = Vector(local([(13626, 864)], anchor)[0] + (0,))
    A = lambda u, v, h: tuple(o + ax * u + av * (-v) + Vector((0, 0, h)))  # v metres south of the north wall

    def build(K, lod):
        n = len(P)
        K.prism(P, -4, 0, conc, top=False)
        for i in range(n):
            L, Ln = frame(P[i], P[(i + 1) % n])
            nrm = Vector(L(0, 0, 1)) - Vector(L(0, 0, 0))
            west = nrm.dot(ax) < -0.8
            south = nrm.y < -0.8
            if lod:
                K.quad(L, 0, Ln, 0, H, 0, brick)
                if Ln > 20:
                    for t in (3.2, 9.2):
                        K.quad(L, 1.5, Ln - 1.5, t, t + 3.6, 0.03, GLASS_C, GLASS)
            elif Ln < 7:
                K.quad(L, 0, Ln, 0, H, 0, brick)
            elif west and Ln > 20:
                # track doors: tall openings with dark interiors, brick between
                nd = max(1, int(Ln // 9))
                bw = Ln / nd
                for k in range(nd):
                    a, b = k * bw + 2, (k + 1) * bw - 2
                    K.quad(L, k * bw, a, 0, H, 0, brick)
                    K.quad(L, b, (k + 1) * bw, 0, H, 0, brick)
                    K.quad(L, a, b, 8, H, 0, brick)
                    K.quad(L, a, b, 0, 8, -0.6, lin('#1c1b1a'), GLASS)
                    K.obox(L, a - 0.2, b + 0.2, 7.8, 8.3, -0.05, 0.2, conc, BODY, ('d-', 'h-'))
                windows(K, L, 1, Ln - 1, 9.5, 4.5, 1, max(1, round(Ln / 4.5)), brick, wf=0.6, hf=0.65, lit=0.2, edge=1)
            else:
                bays = max(1, round(Ln / 6.0))
                K.quad(L, 0, Ln, 0, 1.2, 0, brick2)
                windows(K, L, 0.8, Ln - 0.8, 1.2, 6.0, 2, bays, brick, wf=0.62, hf=0.78, rec=0.3, lit=0.25,
                        sill=conc, edge=0.8, glass=lin('#34424c'))
                K.quad(L, 0, Ln, 13.2, H, 0, brick)
                bw = (Ln - 1.6) / bays
                for k in range(bays + 1):  # pilasters
                    u = 0.8 + k * bw
                    K.obox(L, u - 0.45, u + 0.45, 0, H, 0, 0.35, brick2, BODY, ('d-', 'h-'))
            # parapet with a concrete coping
            K.obox(L, 0, Ln, H, H + 1.0, -0.35, 0, brick, BODY, ('h-', 'd+') if not lod else ('h-',))
            K.obox(L, -0.1, Ln + 0.1, H + 1.0, H + 1.25, -0.45, 0.1, conc, BODY, ('h-',))
            if south and Ln > 120:  # the herald facing 1st Avenue
                c = Ln * 0.5
                K.obox(L, c - 13, c + 13, 9.2, 14.6, 0, 0.12, lin('#b3202a'), BODY, ('d-', 'h-'))
                K.obox(L, c - 12.4, c + 12.4, 9.6, 14.2, 0.12, 0.16, lin('#e9e4da'), BODY, ('d-', 'h-'))
                K.obox(L, c - 11.6, c + 11.6, 10.2, 13.6, 0.16, 0.2, lin('#b3202a'), BODY, ('d-', 'h-'))
                K.text('ROCK ISLAND', L, c, 11.0, 0.22, 2.2, lin('#f4efe6'), BODY, 0.08, res=1 if lod else 2)
        roof(K, P, H + 0.2, roofc)
        # two long clerestory monitors along the shop
        for v0, v1 in ((10, 22), (31, 43)):
            u0, u1 = 10, 262
            hb, ht = H + 0.2, H + 4.2
            pts = [A(u0, v0, 0)[:2], A(u1, v0, 0)[:2], A(u1, v1, 0)[:2], A(u0, v1, 0)[:2]]
            pts = ccw(pts)
            for i in range(4):
                L, Ln = frame(pts[i], pts[(i + 1) % 4])
                if Ln > 50 and not lod:
                    K.quad(L, 0, Ln, hb, hb + 0.8, 0, mon)
                    nb = int(Ln // 3)
                    for k in range(nb):
                        on = K.rnd.random() < 0.3
                        K.quad(L, k * Ln / nb + 0.15, (k + 1) * Ln / nb - 0.15, hb + 0.8, ht - 0.5, 0, LIT_C if on else GLASS_C, LIT if on else GLASS)
                        K.quad(L, k * Ln / nb - 0.15, k * Ln / nb + 0.15, hb + 0.8, ht - 0.5, 0, mon)
                    K.quad(L, 0, Ln, ht - 0.5, ht, 0, mon)
                elif Ln > 50:
                    K.quad(L, 0, Ln, hb, ht, 0, GLASS_C, GLASS)
                else:
                    K.quad(L, 0, Ln, hb, ht, 0, mon)
            # low gable cap
            m0, m1 = (v0 + v1) / 2, 0
            ridge = ht + 1.4
            for (va, vb) in ((v0, m0), (v1, m0)):
                f = [A(u0, va, ht), A(u1, va, ht), A(u1, vb, ridge), A(u0, vb, ridge)]
                ctr = Vector(A((u0 + u1) / 2, m0, ht - 3))
                K.oface([Vector(p) for p in f], ctr, roofc)
            for uu in (u0, u1):
                K.oface([Vector(A(uu, v0, ht)), Vector(A(uu, v1, ht)), Vector(A(uu, m0, ridge))], Vector(A((u0 + u1) / 2, m0, ht)), mon)
        if not lod:
            rooftop_junk(K, A(60, 50, 0)[0], A(60, 50, 0)[1], H + 0.2, K.rnd, 4, 6)
            rooftop_junk(K, A(200, 50, 0)[0], A(200, 50, 0)[1], H + 0.2, K.rnd, 4, 6)

    K = Kit(31, ao=6)
    build(K, False)
    lod0 = K.obj('shop_lod0')
    K1 = Kit(32, ao=6)
    build(K1, True)
    lod1 = K1.obj('shop_lod1')
    # collision boxes along the axis (game coordinates), printed for the region module
    g = lambda u, v: (SHOP_A[0] + (A(u, v, 0)[0]), SHOP_A[1] - (A(u, v, 0)[1]))
    boxes = []
    for (u0, u1, v0, v1) in ((-2, 274, 0, 54), (60, 262, 54, 82), (-24, 0, 12, 50)):
        cx, cz = g((u0 + u1) / 2, (v0 + v1) / 2)
        boxes.append([round(cx, 1), round(cz, 1), (u1 - u0) / 2, (v1 - v0) / 2, H + 1.3, 0, -0.2555])
    res = finish('shop', [lod0, lod1], anchor)
    res['solid'] = boxes
    return res


# ================================================================ HERO STREET MEMORIAL
# Hero Street USA monument (2007; sculptors Guadalupe Diaz and Pedro Rodriguez, portraits Jim Anderson) at 1st Ave and
# Hero Street: a massive stone monument over 17 ft tall, reliefs of the eight Hero Street men round the base and a
# bronze bald eagle with spread wings holding an American flag on top. Sits in the little triangle park (OSM way
# 866069700) at the corner; front faces 1st Avenue (north = Blender +y).
HERO_A = (12791, 1018)


def hero(render=False):
    stone, stone2, conc = lin('#9a958d'), lin('#7c776f'), lin('#c4bdb0')
    bronze, gold, dark = lin('#5f4a2c'), lin('#a8874a'), lin('#3c3a37')
    relief = lin('#7d6140')

    def build(K, lod):
        seg = 10 if lod else 20
        K.cyl(0, 0, 5.2, -0.4, 0.12, conc, seg=seg)
        K.box(-2.5, 2.5, -1.7, 1.7, 0.12, 0.7, stone2)          # base step
        K.box(-2.0, 2.0, -1.25, 1.25, 0.7, 3.1, stone)          # relief block
        K.box(-2.15, 2.15, -1.4, 1.4, 3.1, 3.35, stone2)        # cap moulding
        K.box(-0.75, 0.75, -0.55, 0.55, 3.35, 4.6, stone)       # upper shaft
        K.box(-0.9, 0.9, -0.7, 0.7, 4.6, 4.75, stone2)
        if not lod:
            # eight relief portraits (four on the front, four on the back), bronze-toned
            for side in (1, -1):
                L = (lambda u, h, d, s=side: (u * s, s * (1.25 + d), h))
                for k in range(4):
                    u = -1.5 + k * 1.0
                    K.obox(L, u - 0.38, u + 0.38, 1.0, 2.2, 0, 0.05, bronze, BODY, ('d-',))
                    K.obox(L, u - 0.14, u + 0.14, 1.75, 2.05, 0.05, 0.12, relief, BODY, ('d-',))  # head
                    K.obox(L, u - 0.3, u + 0.3, 1.1, 1.7, 0.05, 0.1, relief, BODY, ('d-',))      # shoulders
            F = lambda u, h, d: (-u, 1.25 + d, h)  # front (north): u runs west so the text reads left to right
            Bk = lambda u, h, d: (u, -(1.25 + d), h)
            for L in (F, Bk):
                K.text('HERO STREET U.S.A.', L, 0, 2.5, 0.0, 0.26, gold, BODY, 0.04)
        # bronze eagle, wings spread, on the top
        z = 4.75
        K.box(-0.28, 0.28, -0.35, 0.35, z, z + 0.85, bronze)       # body
        K.box(-0.14, 0.14, 0.1, 0.42, z + 0.75, z + 1.0, lin('#e8e2d4'))  # white head
        K.box(-0.04, 0.04, 0.42, 0.52, z + 0.8, z + 0.88, gold)   # beak
        for s in (-1, 1):
            # each wing: an inner and an outer panel rising outwards, front and back faces a few cm apart
            inner = [(0.2, 0, 0.3), (1.0, 0, 0.9), (1.0, 0, 1.7), (0.2, 0, 0.95)]
            outer = [(1.0, 0, 0.9), (1.6, 0, 1.6), (1.55, 0, 2.2), (1.0, 0, 1.7)]
            for pan in (inner, outer):
                for dy, cy in ((0.03, -2), (-0.03, 2)):
                    K.oface([Vector((s * x, y + dy, z + h)) for x, y, h in pan], Vector((0, cy, z)), bronze)
        # flag held in the talons
        K.rod((0.3, 0.2, z + 0.2), (0.3, 0.2, z + 2.6), 0.03, gold)
        fx0, fx1, fz1 = 0.32, 1.72, z + 2.55
        fz0 = fz1 - 0.92
        stripes = 7 if not lod else 3
        for k in range(stripes):
            a, b = fz0 + (fz1 - fz0) * k / stripes, fz0 + (fz1 - fz0) * (k + 1) / stripes
            c = lin('#b22234') if k % 2 == 0 else lin('#f2efe8')
            for s in (1, -1):
                K.face([(fx0, 0.2 + s * 0.01, a), (fx1, 0.2 + s * 0.01, a), (fx1, 0.2 + s * 0.01, b), (fx0, 0.2 + s * 0.01, b)][::-s], c)
        for s in (1, -1):
            K.face([(fx0, 0.2 + s * 0.02, fz1 - 0.5), (fx0 + 0.6, 0.2 + s * 0.02, fz1 - 0.5), (fx0 + 0.6, 0.2 + s * 0.02, fz1), (fx0, 0.2 + s * 0.02, fz1)][::-s], lin('#3c3b6e'))
        if not lod:
            # two benches facing the monument
            for s in (1, -1):
                K.box(s * 3.4 - 0.25, s * 3.4 + 0.25, -1.0, 1.0, 0.42, 0.5, lin('#6b5a44'))
                for y in (-0.8, 0.8):
                    K.box(s * 3.4 - 0.2, s * 3.4 + 0.2, y - 0.05, y + 0.05, 0.12, 0.42, dark)

    K = Kit(41, ao=2.5)
    build(K, False)
    lod0 = K.obj('hero_lod0')
    K1 = Kit(42, ao=2.5)
    build(K1, True)
    lod1 = K1.obj('hero_lod1')
    return finish('hero', [lod0, lod1], HERO_A)


B2 = {'shop': shop, 'hero': hero}
names = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(B2)
for nm in names:
    for o in list(bpy.context.scene.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    print('RESULT', nm, B2[nm]())
