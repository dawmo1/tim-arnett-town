# Rock Island region models -> assets/models/regions/rock-island/<name>.glb (sources: <name>.blend next to this file).
# Uses the landmark kit (assets/src/landmarks.py: Kit, windows, finish, ...). Run headless only:
#   Blender -b --factory-startup -P assets/src/regions/rock-island/ri_models.py -- quarters1 shops_n shops_s downtown
# References: docs/regions/rock-island.md. Conventions as landmarks.py (Blender X = game x, Blender -Y = game +z,
# origin = the model's anchor at its base height, <name>_lod0 / <name>_lod1, colours baked into 'Col').
import sys, math
ROOT = '/Users/dainmoens/Documents/Tim Arnett Town/'
exec(open(ROOT + 'assets/src/landmarks.py').read(), globals())
SRC = ROOT + 'assets/src/regions/rock-island/'
LOUT = ROOT + 'assets/models/regions/rock-island/'

LIME = lin('#d6caa8')    # Joliet limestone, buff
LIME2 = lin('#c2b28c')   # cut-stone trim, quoins, belt courses
LIME3 = lin('#a99a78')   # water table / basement
SHINGLE = lin('#4b4c50')
COPPER = lin('#5f6e64')
IRON = lin('#2f302d')
TAN = lin('#c9b68e')     # porch woodwork, painted to match the stone


# ================================================================ QUARTERS ONE
# Commanding Officer's Quarters, Rock Island Arsenal (1870-71, Gen. T. J. Rodman), HABS IL-1001E: three-storey
# Italianate villa of smooth ashlar Joliet limestone with rusticated quoins; main block 74' x 52', truncated hip roof
# with a flat deck and a single pedimented gable to the north, bracketed stone cornice; four-storey square tower
# (19' x 11') centred on the east (front) elevation with an arched double door and a parapet; a one-storey porch with
# paired cast-iron columns wraps the east front and the east end of the north side, ending south in a 19' x 18'
# porte cochere; a three-storey hipped rear wing (31' x 44') to the west; two one-storey bay windows on the south.
def quarters1(render=True):
    anchor = (2357.0, 128.0)
    G = g2l(anchor)
    K = Kit(1871)
    MB = local([(2350, 115.5), (2366, 115.5), (2366, 138.6), (2350, 138.6)], anchor)
    WG = local([(2334, 120.6), (2350, 120.6), (2350, 131.4), (2334, 131.4)], anchor)
    TW = local([(2366, 124.2), (2369.6, 124.2), (2369.6, 130.0), (2366, 130.0)], anchor)
    eave, wing_eave, h0, fh = 13.2, 12.4, 0.9, 4.0
    for P, top in ((MB, eave), (WG, wing_eave)):
        for i, L, Ln, mid in sides(P):
            K.quad(L, 0, Ln, -3, h0, 0.02, LIME3)
            nb = max(1, round((Ln - 1.2) / 3.6))
            windows(K, L, 0.9, Ln - 0.9, h0, fh, 3, nb, LIME, wf=0.42, hf=0.62, rec=0.3, sill=LIME2, head=LIME2, lit=0.35, edge=0.9)
            K.quad(L, 0, Ln, h0 + 3 * fh, top, 0, LIME)
            belt(K, L, 0, Ln, h0 + 2 * fh - 0.1, LIME2, 0.15, 0.35)
            cornice(K, L, 0, Ln, top + 0.6, LIME2, proj=0.9, depth=1.1, brackets=1.1)
            for u in (0.35, Ln - 0.35):  # rusticated quoins
                K.obox(L, u - 0.4, u + 0.4, h0, top - 0.3, 0, 0.08, LIME2, BODY, ('h-', 'd-'))
    # truncated hip roof with a copper flat deck, and the north pediment
    def trunc_hip(P, z, rise, inset, col):
        cx = sum(p[0] for p in P) / 4
        cy = sum(p[1] for p in P) / 4
        top = [(p[0] + (cx - p[0]) * 0 + (inset if p[0] < cx else -inset), p[1] + (inset if p[1] < cy else -inset)) for p in P]
        n = len(P)
        for i in range(n):
            a, b = P[i], P[(i + 1) % n]
            ta, tb = top[i], top[(i + 1) % n]
            K.oface([Vector((a[0], a[1], z)), Vector((b[0], b[1], z)), Vector((tb[0], tb[1], z + rise)), Vector((ta[0], ta[1], z + rise))], Vector((cx, cy, z - 5)), col)
        K.face([(p[0], p[1], z + rise) for p in top], COPPER)
        return top
    big = lambda P, e: [(p[0] + (e if p[0] > sum(q[0] for q in P) / 4 else -e), p[1] + (e if p[1] > sum(q[1] for q in P) / 4 else -e)) for p in P]
    trunc_hip(big(MB, 0.9), eave + 0.6, 3.2, 4.6, SHINGLE)
    trunc_hip(big(WG, 0.8), wing_eave + 0.6, 2.6, 3.4, SHINGLE)
    nx0, nx1, ny = G(2353, 115.5)[0], G(2363, 115.5)[0], G(2358, 115.5)[1]
    NL = lambda u, h, d: (nx0 + u, ny + d, h)  # north face, d = outward (+y)
    K.face([NL(0, eave + 0.6, 0.95), NL(nx1 - nx0, eave + 0.6, 0.95), NL((nx1 - nx0) / 2, eave + 3.8, 0.95)][::-1], LIME)
    K.obox(NL, -0.2, nx1 - nx0 + 0.2, eave + 0.4, eave + 0.7, 0.6, 1.2, LIME2, BODY, ('d-',))
    # tower: four storeys, the third exceptionally tall, parapet on top
    tt = 21.5
    for i, L, Ln, mid in sides(TW):
        K.quad(L, 0, Ln, -3, h0, 0.02, LIME3)
        front = Ln > 5
        if front:  # arched main door in the east face
            c = Ln / 2
            K.quad(L, 0, c - 1.1, h0, h0 + fh, 0, LIME)
            K.quad(L, c + 1.1, Ln, h0, h0 + fh, 0, LIME)
            K.quad(L, c - 1.1, c + 1.1, h0 + 3.2, h0 + fh, 0, LIME)
            K.quad(L, c - 1.1, c + 1.1, h0, h0 + 2.6, -0.4, lin('#4a3424'))
            arch_heads(K, L, c - 1.1, c + 1.1, 1, h0 + 2.6, 2.2, LIME2, d=-0.38)
            for u in (c - 1.5, c + 1.1):
                K.obox(L, u, u + 0.4, h0, h0 + 3.6, 0, 0.25, LIME2, BODY, ('h-', 'd-'))
            K.obox(L, c - 1.7, c + 1.7, h0 + 3.6, h0 + 4.0, 0, 0.35, LIME2, BODY, ('d-',))
        else:
            windows(K, L, 0.7, Ln - 0.7, h0, fh, 1, 1, LIME, wf=0.6, hf=0.6, rec=0.3, sill=LIME2, edge=0.7, lit=0.3)
        windows(K, L, 0.7, Ln - 0.7, h0 + fh, fh, 1, 2 if front else 1, LIME, wf=0.5, hf=0.62, rec=0.3, sill=LIME2, head=LIME2, edge=0.7, lit=0.3)
        windows(K, L, 0.7, Ln - 0.7, h0 + 2 * fh, 6.0, 1, 2 if front else 1, LIME, wf=0.45, hf=0.7, rec=0.35, sill=LIME2, edge=0.7, lit=0.2)
        arch_heads(K, L, 0.7, Ln - 0.7, 2 if front else 1, h0 + 2 * fh + 0.7 + 4.2, (Ln - 1.4) / (2 if front else 1) * 0.45, LIME2)
        windows(K, L, 0.7, Ln - 0.7, h0 + 2 * fh + 6.0, tt - (h0 + 2 * fh + 6.0) - 1.4, 1, 2 if front else 1, LIME, wf=0.35, hf=0.55, rec=0.3, edge=0.7, lit=0.2)
        K.quad(L, 0, Ln, tt - 1.4, tt, 0, LIME)
        cornice(K, L, 0, Ln, tt + 0.4, LIME2, proj=0.7, depth=0.9, brackets=0.9)
        K.obox(L, -0.3, Ln + 0.3, tt + 0.4, tt + 1.3, -0.35, 0, LIME, BODY, ('h-', 'd-'))  # parapet
        for u in (0.3, Ln - 0.3):
            K.obox(L, u - 0.35, u + 0.35, h0, tt - 1.0, 0, 0.1, LIME2, BODY, ('h-', 'd-'))
    K.prism(TW, tt + 0.1, tt + 0.2, COPPER, sides=False)
    # wrap-around porch: east front + east end of the north side, porte cochere at its south end
    deck, proof = h0, 4.6
    def porch(x0, x1, z0, z1, roof_h, cols, open_=False):
        a, b = G(x0, z1), G(x1, z0)  # Blender xy min/max
        if not open_:
            K.box(a[0], b[0], a[1], b[1], -1, deck, TAN, BODY, ('h-',))
        K.box(a[0] - 0.2, b[0] + 0.2, a[1] - 0.2, b[1] + 0.2, roof_h, roof_h + 0.55, TAN, BODY, ())
        K.box(a[0] - 0.1, b[0] + 0.1, a[1] - 0.1, b[1] + 0.1, roof_h + 0.55, roof_h + 0.6, COPPER, BODY, ('h-',))
        for (x, z) in cols:
            px, py = G(x, z)
            for dx in (-0.18, 0.18):
                K.cyl(px + dx, py, 0.09, deck if not open_ else 0, roof_h, IRON, BODY, 6, top=False)
    ecols = [(2368.8, z) for z in (116.0, 119.6, 123.0, 131.4, 134.9, 138.3)]
    porch(2366, 2369.2, 115.5, 124.2, proof, ecols[:3])
    porch(2366, 2369.2, 130.0, 138.6, proof, ecols[3:])
    porch(2356, 2366, 112.8, 115.5, proof, [(x, 113.1) for x in (2356.4, 2359.6, 2362.8)])
    porch(2364.8, 2369.6, 138.6, 144.2, proof - 0.6, [(2365.1, 143.9), (2369.3, 143.9)], open_=True)
    rx0, rx1 = G(2369.2, 0)[0], G(2369.25, 0)[0]
    for z0, z1 in ((115.5, 124.2), (130.0, 138.6)):
        y0, y1 = G(0, z1)[1], G(0, z0)[1]
        K.box(rx0, rx1 + 0.04, y0, y1, deck + 0.85, deck + 0.95, IRON, BODY, ('h-',))
    # porch steps in front of the tower, flaring out
    sx, sy = G(2369.6, 127.1)
    for k in range(4):
        K.box(sx + k * 0.35, sx + (k + 1) * 0.35, sy - 1.6 - k * 0.2, sy + 1.6 + k * 0.2, -1, deck - k * 0.22, LIME2, BODY, ('h-',))
    # two one-storey bay windows on the south side
    for xa, xb in ((2351.2, 2353.6), (2355.0, 2357.4)):
        a, b = G(xa, 141.0), G(xb, 138.6)
        Pb = ccw([(a[0], a[1]), (b[0], a[1]), (b[0], b[1]), (a[0], b[1])])
        for i, L, Ln, mid in sides(Pb):
            if mid[1] > b[1] - 0.01:
                continue
            windows(K, L, 0.3, Ln - 0.3, h0, 4.0, 1, 1, LIME, wf=0.7, hf=0.6, rec=0.25, edge=0.3, lit=0.4)
        K.box(a[0] - 0.2, b[0] + 0.2, a[1] - 0.2, b[1], h0 + 4.0, h0 + 4.4, LIME2, BODY, ('h-',))
    # chimneys: two on the south side of the main block, one in the wing
    for x, z in ((2353.5, 135.5), (2362.5, 135.5), (2342, 126)):
        px, py = G(x, z)
        K.box(px - 0.6, px + 0.6, py - 0.45, py + 0.45, eave, eave + 5.6, LIME2)
        K.box(px - 0.8, px + 0.8, py - 0.65, py + 0.65, eave + 5.6, eave + 6.0, LIME3)
    lod0 = K.obj('quarters1_lod0')
    # LOD1
    K1 = Kit(1872)
    for P, top in ((MB, eave), (WG, wing_eave)):
        lod1_bands(K1, P, h0, 3, fh, LIME, hf=0.55, lit=0.35)
        K1.prism(P, h0 + 3 * fh, top + 0.6, LIME, top=False)
    K = K1
    trunc_hip(big(MB, 0.9), eave + 0.6, 3.2, 4.6, SHINGLE)
    trunc_hip(big(WG, 0.8), wing_eave + 0.6, 2.6, 3.4, SHINGLE)
    K1.prism(TW, -3, tt + 1.3, LIME, topcol=COPPER)
    a, b = G(2366, 144.2), G(2369.6, 112.8)
    K1.box(a[0], b[0], a[1], b[1], proof, proof + 0.6, TAN)
    lod1 = K1.obj('quarters1_lod1')
    res = finish('quarters1', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('quarters1', (4, 0, 8), 55, lod1, views=((70, 14), (-60, 25)))
    return res


B['quarters1'] = quarters1


# ================================================================ THE STONE SHOPS (Rodman Avenue)
# Rodman's ten Joliet-limestone shops (1867-1893): five on Armory Row (north of Rodman Ave) and five on Arsenal Row
# (south), each a U open away from the avenue; the 1917-18 two-storey links (Buildings 61, 67, ...) join pairs of them.
# Greek Revival per the HAER/LOC record: three storeys of tall stone-headed windows, pilaster pavilions where the OSM
# outline steps out, a heavy cornice and a pedimented centre on each Rodman Avenue front. Outlines are OSM's.
ROWS = {
    'n': [[[2716.2, 591.4], [2715.8, 580], [2718.7, 579.9], [2717.9, 555.5], [2714.8, 555.6], [2713.9, 529.4], [2715, 529.4], [2714.4, 511], [2710.1, 511.1], [2709.8, 499.2], [2693.2, 499.7], [2695.4, 572.7], [2666.1, 573.6], [2663.9, 502.3], [2647.7, 502.8], [2648.1, 515.4], [2644.9, 515.5], [2645.5, 531.4], [2648.3, 531.3], [2649.3, 560.2], [2616.5, 561.3], [2615.7, 534.7], [2618.5, 534.6], [2617.9, 514.5], [2614.6, 514.6], [2614.2, 503.1], [2548.6, 505.3], [2549, 518.2], [2544.8, 518.3], [2545.6, 539], [2549.5, 538.9], [2550.5, 565.4], [2547, 565.5], [2547.8, 586.7], [2551.6, 586.5], [2552, 597.6], [2619.4, 595.3], [2619, 582.2], [2647.2, 581.2], [2647.6, 593.7]],
          [[2792.4, 565.9], [2766.2, 567.5], [2762, 495.5], [2742.8, 496.6], [2743.5, 508.8], [2740, 508.9], [2741.2, 529.3], [2744.1, 529.1], [2745.7, 556.5], [2742.2, 556.7], [2743.3, 576.6], [2746.7, 576.4], [2747.3, 588.1], [2812.4, 584.4], [2811.8, 573.5], [2814.7, 573.4], [2813.5, 553.4], [2811, 553.6], [2809.3, 525.6], [2812.9, 525.3], [2811.8, 505.5], [2808.8, 505.7], [2808.1, 493.4], [2788.2, 494.6]],
          [[2844.4, 582.8], [2909.8, 581.4], [2909.5, 567.9], [2941.4, 567.2], [2941.7, 577.9], [3006.9, 576.4], [3006.6, 564], [3009.3, 563.9], [3008.9, 544.1], [3005.3, 544.2], [3004.7, 516], [3007.4, 516], [3006.9, 496.5], [3002.9, 496.6], [3002.6, 484.5], [2984.3, 485], [2985.9, 557.4], [2959.7, 558.1], [2958.1, 487.4], [2886.9, 489.1], [2888.6, 561.9], [2862.2, 562.6], [2860.6, 491.1], [2840.7, 491.5], [2841, 504.2], [2839.8, 504.2], [2840.9, 551.9], [2839.8, 552], [2840.3, 571.9], [2844.2, 571.8]]],
    's': [[[2720, 680.5], [2720.6, 693], [2724, 692.8], [2724.9, 711.7], [2721.1, 711.9], [2722.5, 741.2], [2726.3, 741], [2727.2, 759.5], [2723.6, 759.7], [2724.2, 771.7], [2700.7, 772.8], [2700.3, 765.8], [2704.7, 765.6], [2701.7, 700.4], [2688.8, 701], [2689.4, 713.5], [2694.8, 713.2], [2695.9, 735.7], [2692, 735.9], [2692.2, 739.7], [2687.6, 739.9], [2687.4, 736], [2683.1, 736.2], [2682.1, 713.5], [2687.4, 713.2], [2686.9, 701.5], [2675, 702.1], [2678, 766.7], [2682.7, 766.5], [2683.1, 773.7], [2659.6, 774.8], [2659, 763.3], [2655, 763.5], [2654.1, 743.8], [2657.9, 743.6], [2656.6, 715.4], [2624.1, 716.9], [2625.5, 745.6], [2628.3, 745.5], [2629.2, 764.7], [2626.3, 764.8], [2626.9, 776.5], [2607.7, 777.4], [2604.3, 706], [2577.5, 707.2], [2580.9, 778], [2562.4, 778.9], [2561.8, 767.4], [2557.8, 767.6], [2556.9, 748.7], [2560.5, 748.6], [2559.1, 719.7], [2555.6, 719.9], [2554.7, 701.2], [2558.5, 701.1], [2557.8, 688.2], [2622.7, 685.1], [2623.3, 697.7], [2655.5, 696.1], [2654.9, 683.6]],
          [[2817.3, 675.4], [2817.9, 687.2], [2821.4, 687], [2822.5, 707.5], [2818.5, 707.7], [2819.5, 727.3], [2822.6, 727.1], [2824, 754.6], [2820.2, 754.8], [2820.8, 767], [2802.7, 767.9], [2799, 695.8], [2771.8, 697.2], [2775.5, 769.4], [2756.3, 770.4], [2755.7, 758.4], [2752.3, 758.6], [2751.3, 739.3], [2755.1, 739.2], [2753.6, 710.2], [2750, 710.4], [2749, 691.4], [2752.7, 691.2], [2752.1, 678.6]],
          [[3011.5, 666.3], [3012.1, 678.7], [3015.5, 678.5], [3016.4, 697.6], [3012.6, 697.8], [3014, 726.9], [3017.9, 726.7], [3018.8, 745.5], [3015.2, 745.6], [3015.8, 757.6], [2992, 758.7], [2991.7, 751.5], [2996, 751.3], [2993, 687.4], [2967, 688.6], [2970.1, 752.5], [2974.1, 752.3], [2974.5, 759.5], [2951.1, 760.6], [2950.5, 749.1], [2946.5, 749.3], [2945.6, 729.6], [2949.4, 729.4], [2948, 701.2], [2915.6, 702.7], [2917, 731.4], [2920.5, 731.3], [2921.5, 750.5], [2917.7, 750.7], [2918.2, 762.2], [2899.3, 763.1], [2895.8, 691.7], [2868.9, 693], [2872.3, 763.8], [2853.9, 764.6], [2853.3, 753.2], [2849.3, 753.4], [2848.4, 734.6], [2852, 734.4], [2850.6, 705.5], [2847.1, 705.7], [2846.2, 687.1], [2850, 686.9], [2849.3, 674], [2914.2, 670.8], [2914.8, 683.4], [2946.9, 681.9], [2946.3, 669.4]]],
}
SHOP_ANCHOR = {'n': (2777.0, 541.0), 's': (2787.0, 722.0)}


def stone_wall(K, L, Ln, h0, fh, nfl, top, bay=4.6):
    """cheap stone facade: one wall quad, then per window a glass pane and a stone lintel standing just proud of it"""
    K.quad(L, 0, Ln, -3, top, 0, LIME)
    K.quad(L, 0, Ln, -3, h0, 0.03, LIME3)
    n = int((Ln - 1.0) // bay)
    if n < 1:
        return
    bw = (Ln - 1.0) / n
    for f in range(nfl):
        wb = h0 + f * fh + 0.9
        wt = wb + fh * (0.62 if f < nfl - 1 else 0.5)
        for b in range(n):
            c = 0.5 + bw * (b + 0.5)
            on = K.rnd.random() < 0.35
            K.quad(L, c - 0.75, c + 0.75, wb, wt, 0.04, LIT_C if on else GLASS_C, LIT if on else GLASS)
            K.quad(L, c - 0.95, c + 0.95, wt, wt + 0.45, 0.06, LIME2)


def shops(row, render=True):
    anchor = SHOP_ANCHOR[row]
    name = 'shops_' + row
    K, K1 = Kit(60 + ord(row)), Kit(61 + ord(row))
    h0, fh, nfl, top = 0.8, 4.3, 3, 14.0
    face_dir = -1 if row == 'n' else 1  # Blender y of the outward normal of the Rodman Avenue fronts
    for poly in ROWS[row]:
        P = local([tuple(p) for p in poly], anchor)
        for i, L, Ln, mid in sides(P):
            stone_wall(K, L, Ln, h0, fh, nfl, top)
            K.obox(L, -0.4, Ln + 0.4, top, top + 0.9, -0.1, 0.55, LIME2, BODY, ('d-',))  # cornice
            K.obox(L, 0, Ln, h0 + fh - 0.15, h0 + fh + 0.15, 0, 0.12, LIME2, BODY, ('d-', 'h-'))  # belt course
            nrm = Vector(L(0, 0, 1)) - Vector(L(0, 0, 0))
            if Ln > 50 and nrm.y * face_dir > 0.9:  # Rodman Avenue front: pedimented centre pavilion with pilasters
                c = Ln / 2
                K.obox(L, c - 7, c + 7, -3, top + 0.9, 0, 0.6, LIME, BODY, ('d-', 'h-'))
                for u in (c - 7, c - 2.3, c + 2.3, c + 7):
                    K.obox(L, u - 0.5, u + 0.5, h0, top, 0.6, 0.85, LIME2, BODY, ('d-', 'h-'))
                K.obox(L, c - 1.6, c + 1.6, h0, h0 + 3.6, 0.6, 0.62, lin('#3b2f26'), BODY, ('d-',))
                ptop = top + 0.9 + 3.2
                K.face([L(c - 7.4, top + 0.9, 0.9), L(c + 7.4, top + 0.9, 0.9), L(c, ptop, 0.9)], LIME)
                inner = Vector(L(c, top, -6))
                K.oface([Vector(L(c - 7.6, top + 0.8, 1.0)), Vector(L(c, ptop + 0.25, 1.0)), Vector(L(c, ptop + 0.25, -4)), Vector(L(c - 7.6, top + 0.8, -4))], inner, SLATE)
                K.oface([Vector(L(c + 7.6, top + 0.8, 1.0)), Vector(L(c + 7.6, top + 0.8, -4)), Vector(L(c, ptop + 0.25, -4)), Vector(L(c, ptop + 0.25, 1.0))], inner, SLATE)
                K1.face([L(c - 7.4, top, 0.3), L(c + 7.4, top, 0.3), L(c, ptop, 0.3)], LIME)
            # LOD1: wall + one window band per floor
            K1.quad(L, 0, Ln, -3, top + 0.9, 0, LIME)
            if Ln > 6:
                for f in range(nfl):
                    b = h0 + f * fh + 0.9
                    K1.quad(L, 0.5, Ln - 0.5, b, b + fh * 0.55, 0.03, GLASS_C, GLASS)
        K.prism(P, top + 0.6, top + 0.7, SLATE, sides=False)
        K1.prism(P, top + 0.8, top + 0.9, SLATE, sides=False)
    lod0 = K.obj(name + '_lod0')
    lod1 = K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], anchor)
    if render:
        res['png'] = shots(name, (0, 0, 8), 260, lod1, views=((10 if row == 'n' else 190, 22),))
    return res


SLATE = lin('#5d5f63')
B['shops_n'] = lambda render=True: shops('n', render)
B['shops_s'] = lambda render=True: shops('s', render)


# ================================================================ DOWNTOWN ROCK ISLAND (Rebuild Downtown, 2024-25)
# The gateway arch over 18th Street at 1st Avenue, across from Schwiebert Park ("Welcome to Downtown Rock Island";
# exact design unverified: modelled as two stone-clad piers and a dark steel arch with lit lettering), and the
# 4 1/2 ft steel ROCK ISLAND block letters on the Green Lawn at 2nd Avenue & 18th Street. Anchor: 18th St just
# south of 1st Ave.
def downtown(render=True):
    anchor = (246.4, 1284.0)
    G = g2l(anchor)
    K, K1 = Kit(1801), Kit(1802)
    steel, pier, cap, lettr = lin('#26292c'), lin('#8c7f6e'), lin('#b9b2a4'), lin('#f2efe6')
    span, clear_h = 9.2, 6.4
    for s in (-1, 1):  # piers either side of 18th St (on the sidewalks)
        x = s * span
        K.box(x - 0.75, x + 0.75, -0.75, 0.75, -1, 5.2, pier)
        K.box(x - 0.9, x + 0.9, -0.9, 0.9, 5.2, 5.6, cap)
        K1.box(x - 0.75, x + 0.75, -0.75, 0.75, -1, 5.6, pier)
    # the arch: a curved box beam from pier to pier, plus a flat sign band under its crown
    segs = 14
    for k in range(segs):
        a0, a1 = math.pi * k / segs, math.pi * (k + 1) / segs
        x0, x1 = -math.cos(a0) * span, -math.cos(a1) * span
        z0, z1 = 5.6 + math.sin(a0) * 2.6, 5.6 + math.sin(a1) * 2.6
        for d in (-0.3, 0.3):
            K.face([(x0, d, z0), (x1, d, z1), (x1, d, z1 + 0.5), (x0, d, z0 + 0.5)][::(1 if d > 0 else -1)], steel)
        K.face([(x0, -0.3, z0 + 0.5), (x0, 0.3, z0 + 0.5), (x1, 0.3, z1 + 0.5), (x1, -0.3, z1 + 0.5)], steel)
        K.face([(x0, -0.3, z0), (x1, -0.3, z1), (x1, 0.3, z1), (x0, 0.3, z0)], steel)
        K1.face([(x0, 0, z0), (x1, 0, z1), (x1, 0, z1 + 0.5), (x0, 0, z0 + 0.5)], steel)
    K.box(-6.0, 6.0, -0.2, 0.2, clear_h, clear_h + 1.4, steel)
    for d, fl in ((-0.22, False), (0.22, True)):  # both faces: south (toward downtown) and north (toward the park)
        Lf = (lambda u, h, dd: (u, -0.2 - dd, h)) if not fl else (lambda u, h, dd: (-u, 0.2 + dd, h))
        K.text('DOWNTOWN', Lf, 0, clear_h + 0.75, 0.03, 0.55, lettr, NEON, 0.04, res=1)
        K.text('ROCK ISLAND', Lf, 0, clear_h + 0.12, 0.03, 0.55, lettr, NEON, 0.04, res=1)
    # ROCK ISLAND block letters on the Green Lawn (NE corner of 2nd Ave & 18th St), facing the corner
    lx, ly = G(259.5, 1372.0)
    rot = math.radians(35)
    LL = lambda u, h, d: (lx + u * math.cos(rot) - d * math.sin(rot), ly + u * math.sin(rot) + d * math.cos(rot), h)
    Lb = lambda u, h, d: LL(u, h, -d)  # letters face -d (south-west, toward the corner)
    K.obox(LL, -5.6, 5.6, -0.5, 0.35, -0.6, 0.6, cap, BODY, ('h-',))
    K.text('ROCK ISLAND', lambda u, h, d: LL(-u, h, -d), 0, 0.35, 0.25, 1.37, lin('#2e3135'), BODY, 0.45, res=1, bold=0.02)
    K1.obox(LL, -5.4, 5.4, 0.3, 1.7, -0.3, 0.3, lin('#2e3135'), BODY, ('h-',))
    lod0 = K.obj('downtown_lod0')
    lod1 = K1.obj('downtown_lod1')
    res = finish('downtown', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('downtown', (0, 0, 5), 32, lod1, views=((180, 10), (0, 10)))
        res['png'] += shots('downtown_letters', (lx, ly, 1), 12, lod1, views=((215, 8),))
    return res


B['downtown'] = downtown


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(B)
    if bpy.context.scene.name != LM_SCENE:
        bpy.context.scene.name = LM_SCENE
    for n in [a for a in args if a != 'norender']:
        print('RESULT', n, build(n, render='norender' not in sys.argv))
