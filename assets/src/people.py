# People: one rigged body (body-type morphs as shape keys) plus hair, hats, beards and glasses.
# Run in Blender:  exec(open(ROOT + 'assets/src/people.py').read())
#
# The body is lofted from cross-sections (torso, limbs, hands, shoes) so its shape, UVs and skin
# weights are all computed here exactly.
# UV convention (read by src/people/paint.js and the people shader): u = region + local_u, v = local_v,
# so floor(u) says which atlas cell family a face uses:
#   0 face/head   1 skin (hands, neck, ears)   2 top (torso + arms)   3 bottom (pelvis + legs)
#   4 shoes   5 hair   6 hat / accent   7 fixed-colour bits (glasses, badges)
# Blender axes: Z up, the character faces -Y, its left side is +X.
import math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/tat.py').read(), globals())
from mathutils import Vector

# ---------------- skeleton (rest pose: A-pose) ----------------
BONES = [
    ('hips', (0, 0, 0.93), (0, 0, 1.04), None),
    ('spine', (0, 0, 1.04), (0, 0, 1.22), 'hips'),
    ('chest', (0, 0, 1.22), (0, 0, 1.43), 'spine'),
    ('neck', (0, 0.01, 1.47), (0, 0.012, 1.56), 'chest'),
    ('head', (0, 0.012, 1.56), (0, 0.012, 1.78), 'neck'),
]
J = {}  # joint positions
for s, sx in (('L', 1), ('R', -1)):
    J['sh' + s] = Vector((0.172 * sx, 0.0, 1.395))
    J['el' + s] = Vector((0.378 * sx, 0.004, 1.205))
    J['wr' + s] = Vector((0.545 * sx, -0.004, 1.005))
    J['ft' + s] = Vector((0.640 * sx, -0.012, 0.888))
    J['hi' + s] = Vector((0.095 * sx, 0.0, 0.92))
    J['kn' + s] = Vector((0.105 * sx, -0.012, 0.50))
    J['an' + s] = Vector((0.11 * sx, 0.012, 0.095))
    J['to' + s] = Vector((0.115 * sx, -0.16, 0.03))
    BONES += [
        ('shoulder.' + s, (0.03 * sx, 0.0, 1.42), tuple(J['sh' + s]), 'chest'),
        ('upper_arm.' + s, tuple(J['sh' + s]), tuple(J['el' + s]), 'shoulder.' + s),
        ('forearm.' + s, tuple(J['el' + s]), tuple(J['wr' + s]), 'upper_arm.' + s),
        ('hand.' + s, tuple(J['wr' + s]), tuple(J['ft' + s]), 'forearm.' + s),
        ('thigh.' + s, tuple(J['hi' + s]), tuple(J['kn' + s]), 'hips'),
        ('shin.' + s, tuple(J['kn' + s]), tuple(J['an' + s]), 'thigh.' + s),
        ('foot.' + s, tuple(J['an' + s]), tuple(J['to' + s]), 'shin.' + s),
    ]

# ---------------- body types ----------------
# torso keys: (z, half width, front depth, back depth); limbs: radius multipliers
TYPES = {
    'base': dict(torso=[(0.80, 0.07, 0.06, 0.07), (0.86, 0.169, 0.09, 0.11), (0.93, 0.181, 0.098, 0.118), (0.985, 0.167, 0.102, 0.104),
                        (1.05, 0.152, 0.104, 0.094), (1.13, 0.148, 0.100, 0.090), (1.22, 0.163, 0.112, 0.096), (1.30, 0.178, 0.122, 0.100),
                        (1.37, 0.192, 0.112, 0.102), (1.43, 0.192, 0.085, 0.088), (1.475, 0.144, 0.055, 0.062), (1.50, 0.062, 0.048, 0.048)],
                 arm=1.0, leg=1.0, neck=1.0),
    'heavy': dict(torso=[(0.80, 0.08, 0.07, 0.08), (0.86, 0.198, 0.11, 0.13), (0.93, 0.211, 0.135, 0.14), (0.985, 0.206, 0.165, 0.125),
                         (1.05, 0.205, 0.19, 0.12), (1.13, 0.2, 0.18, 0.115), (1.22, 0.198, 0.16, 0.115), (1.30, 0.2, 0.15, 0.115),
                         (1.37, 0.208, 0.13, 0.112), (1.43, 0.206, 0.095, 0.095), (1.475, 0.163, 0.065, 0.07), (1.50, 0.072, 0.056, 0.056)],
                  arm=1.22, leg=1.22, neck=1.2),
    'slim': dict(torso=[(0.80, 0.06, 0.052, 0.06), (0.86, 0.149, 0.078, 0.095), (0.93, 0.158, 0.084, 0.1), (0.985, 0.144, 0.086, 0.088),
                        (1.05, 0.132, 0.086, 0.08), (1.13, 0.13, 0.085, 0.078), (1.22, 0.143, 0.096, 0.084), (1.30, 0.157, 0.104, 0.088),
                        (1.37, 0.17, 0.098, 0.09), (1.43, 0.172, 0.075, 0.078), (1.475, 0.130, 0.05, 0.055), (1.50, 0.056, 0.044, 0.044)],
                 arm=0.86, leg=0.88, neck=0.9),
    'female': dict(torso=[(0.80, 0.075, 0.06, 0.075), (0.86, 0.190, 0.09, 0.125), (0.93, 0.197, 0.096, 0.13), (0.985, 0.170, 0.096, 0.108),
                          (1.05, 0.138, 0.094, 0.088), (1.13, 0.128, 0.09, 0.082), (1.22, 0.148, 0.135, 0.086), (1.27, 0.158, 0.148, 0.09),
                          (1.33, 0.165, 0.12, 0.094), (1.43, 0.175, 0.078, 0.082), (1.475, 0.125, 0.05, 0.056), (1.50, 0.054, 0.043, 0.043)],
                   arm=0.84, leg=1.02, neck=0.86),
    'muscle': dict(torso=[(0.80, 0.07, 0.06, 0.07), (0.86, 0.172, 0.09, 0.115), (0.93, 0.181, 0.098, 0.12), (0.985, 0.165, 0.1, 0.104),
                          (1.05, 0.152, 0.104, 0.096), (1.13, 0.155, 0.106, 0.096), (1.22, 0.182, 0.13, 0.104), (1.30, 0.205, 0.142, 0.11),
                          (1.37, 0.222, 0.128, 0.112), (1.43, 0.218, 0.095, 0.1), (1.475, 0.163, 0.062, 0.072), (1.50, 0.07, 0.054, 0.054)],
                   arm=1.25, leg=1.12, neck=1.25),
}
TORSO_Z = [0.80, 0.86, 0.93, 0.985, 1.05, 1.13, 1.22, 1.27, 1.30, 1.33, 1.37, 1.43, 1.475, 1.50]


def torso_at(kind, z):
    ks = TYPES[kind]['torso']
    for a, b in zip(ks, ks[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 4)]
    return list(ks[-1][1:]) if z > ks[-1][0] else list(ks[0][1:])


# limb profiles: (t along the limb, radius x, radius y)
ARM_P = [(-0.14, 0.05, 0.056), (0.0, 0.062, 0.064), (0.18, 0.06, 0.06), (0.4, 0.054, 0.056), (0.48, 0.047, 0.047),
         (0.53, 0.046, 0.046), (0.62, 0.049, 0.044), (0.8, 0.039, 0.035), (1.0, 0.032, 0.026)]
LEG_P = [(-0.08, 0.08, 0.085), (0.0, 0.092, 0.095), (0.2, 0.088, 0.09), (0.45, 0.074, 0.074), (0.53, 0.06, 0.061),
         (0.58, 0.058, 0.062), (0.68, 0.06, 0.068), (0.85, 0.046, 0.05), (1.0, 0.04, 0.042)]
NA, NL, NT = 10, 12, 18  # segments around arms, legs, torso


class Builder:
    def __init__(s):
        s.v, s.f, s.fuv, s.w = [], [], [], []

    def vert(s, p, w):
        s.v.append(tuple(p))
        s.w.append(w)
        return len(s.v) - 1

    def face(s, idx, uvs):
        s.f.append(idx)
        s.fuv.append(uvs)


def ring_frame(axis):
    axis = axis.normalized()
    f = Vector((0, -1, 0))
    if abs(axis.dot(f)) > 0.9:
        f = Vector((0, 0, 1))
    f = (f - axis * f.dot(axis)).normalized()
    side = axis.cross(f)
    return f, side


def blend(a, b, t):
    return {a: 1 - t, b: t} if 0 < t < 1 else ({a: 1.0} if t <= 0 else {b: 1.0})


def build(kind):
    T = TYPES[kind]
    B = Builder()

    def tube(rings, n, region_uv, closed_end=True, start_cap=False):
        """rings: list of (center, axis, rx, ry, weights, v); region_uv(u, v) -> (U, V)"""
        ids = []
        for c, ax, rx, ry, wts, vv in rings:
            fwd, side = ring_frame(ax)
            row = []
            for k in range(n):
                th = 2 * math.pi * k / n  # 0 = back
                p = c + side * (math.sin(th) * rx) - fwd * (math.cos(th) * ry)
                row.append(B.vert(p, wts))
            ids.append((row, vv))
        for (r0, v0), (r1, v1) in zip(ids, ids[1:]):
            for k in range(n):
                k2 = (k + 1) % n
                u0, u1 = k / n, (k + 1) / n
                B.face([r0[k], r0[k2], r1[k2], r1[k]], [region_uv(u0, v0), region_uv(u1, v0), region_uv(u1, v1), region_uv(u0, v1)])
        if closed_end:
            row, vv = ids[-1]
            c = sum((Vector(B.v[i]) for i in row), Vector()) / n
            ci = B.vert(c, B.w[row[0]])
            for k in range(n):
                k2 = (k + 1) % n
                B.face([row[k], row[k2], ci], [region_uv(k / n, vv), region_uv((k + 1) / n, vv), region_uv((k + 0.5) / n, vv)])
        return ids

    # ---- torso ----
    rings = []
    for z in TORSO_Z:
        w, df, db = torso_at(kind, z)
        wt = blend('hips', 'spine', (z - 0.98) / 0.12) if z < 1.13 else blend('spine', 'chest', (z - 1.16) / 0.12)
        if z > 1.46:
            wt = blend('chest', 'neck', (z - 1.46) / 0.04)
        rings.append((z, w, df, db, wt))
    trows = []
    for z, w, df, db, wt in rings:
        row = []
        for k in range(NT):
            th = 2 * math.pi * k / NT
            sx, cy = math.sin(th), math.cos(th)
            # superellipse-ish: squarer sides
            e = 0.82
            px = math.copysign(abs(sx) ** e, sx) * w
            py = (cy * db if cy > 0 else cy * df)
            py = math.copysign(abs(py / (db if cy > 0 else df)) ** e, py) * (db if cy > 0 else df)
            # glutes a touch lower than the hips, chest a touch higher than the shoulder blades
            row.append(B.vert((px, py, z), dict(wt)))
        trows.append((row, z))

    def torso_uv(u, z, region):
        if region == 2:
            return (2 + 0.6 * u, max(0.001, min(0.999, (z - 0.985) / 0.515)))
        return (3 + u, 0.8 + 0.2 * max(0, min(1, (z - 0.80) / 0.185)))

    for (r0, z0), (r1, z1) in zip(trows, trows[1:]):
        region = 2 if (z0 + z1) / 2 > 0.985 else 3
        for k in range(NT):
            k2 = (k + 1) % NT
            u0, u1 = k / NT, (k + 1) / NT
            B.face([r0[k], r1[k], r1[k2], r0[k2]], [torso_uv(u0, z0, region), torso_uv(u0, z1, region), torso_uv(u1, z1, region), torso_uv(u1, z0, region)])
    # cap at the crotch (hidden between the legs)
    r0 = trows[0][0]
    ci = B.vert((0, 0.005, 0.79), {'hips': 1.0})
    for k in range(NT):
        k2 = (k + 1) % NT
        B.face([r0[k2], r0[k], ci], [(3.5, 0.8), (3.5, 0.8), (3.5, 0.8)])

    # ---- neck ----
    nk = T['neck']
    nrings = []
    for i, z in enumerate((1.46, 1.52, 1.575, 1.61)):
        r = (0.056 - 0.006 * i / 3) * nk
        nrings.append((Vector((0, 0.012, z)), Vector((0, 0.08, 1)), r * 1.05, r, blend('neck', 'head', (z - 1.52) / 0.07), i / 3))
    tube(nrings, 12, lambda u, v: (1 + 0.1 + u * 0.3, 0.2 + v * 0.3), closed_end=False)

    # ---- arms + hands ----
    for s, sx in (('L', 1), ('R', -1)):
        a, b, c, d = J['sh' + s], J['el' + s], J['wr' + s], J['ft' + s]
        rings = []
        for t, rx, ry in ARM_P:
            if t <= 0.5:
                p = a + (b - a) * (t / 0.5)
                ax = b - a
            else:
                p = b + (c - b) * ((t - 0.5) / 0.5)
                ax = c - b
            if t < 0:
                p = p + Vector((-0.045 * sx, 0, 0.0))
            if t < 0.38:
                wt = blend('shoulder.' + s, 'upper_arm.' + s, (t + 0.12) / 0.2) if t < 0.08 else {'upper_arm.' + s: 1.0}
            elif t < 0.62:
                wt = blend('upper_arm.' + s, 'forearm.' + s, (t - 0.44) / 0.14)
            else:
                wt = blend('forearm.' + s, 'hand.' + s, (t - 0.9) / 0.1)
            m = T['arm'] if t < 0.75 else (1 + (T['arm'] - 1) * 0.5)
            rings.append((p, ax, rx * m, ry * m, wt, t))
        u0 = 0.6 if s == 'L' else 0.8
        tube(rings, NA, lambda u, v, u0=u0: (2 + u0 + 0.2 * u, max(0.001, min(0.999, 1 - max(0, v)))), closed_end=False)
        # hand: flattened tube, palm facing the body, plus a thumb
        hm = 1 + (T['arm'] - 1) * 0.3
        hax = d - c
        hr = []
        for t, rx, ry in ((0.0, 0.031, 0.027), (0.25, 0.042, 0.02), (0.55, 0.046, 0.017), (0.8, 0.043, 0.015), (1.0, 0.03, 0.011)):
            p = c + hax * t
            hr.append((p, hax, ry * hm, rx * hm, {'hand.' + s: 1.0}, t))
        tube(hr, 8, lambda u, v: (1 + 0.55 + u * 0.4, 0.55 + v * 0.4), closed_end=True)
        tb = c + hax * 0.2 + Vector((0, -0.028, 0))
        tdir = (hax.normalized() * 0.6 + Vector((0, -0.8, 0))).normalized()
        th = [(tb, tdir, 0.014, 0.012, {'hand.' + s: 1.0}, 0), (tb + tdir * 0.035, tdir, 0.012, 0.011, {'hand.' + s: 1.0}, 0.5), (tb + tdir * 0.06, tdir, 0.009, 0.009, {'hand.' + s: 1.0}, 1)]
        tube(th, 6, lambda u, v: (1 + 0.55 + u * 0.4, 0.55 + v * 0.4), closed_end=True)

    # ---- legs + shoes ----
    for s, sx in (('L', 1), ('R', -1)):
        a, b, c = J['hi' + s], J['kn' + s], J['an' + s]
        rings = []
        for t, rx, ry in LEG_P:
            if t <= 0.53:
                p = a + (b - a) * (t / 0.53)
                ax = b - a
            else:
                p = b + (c - b) * ((t - 0.53) / 0.47)
                ax = c - b
            if t < 0:
                p = p + Vector((-0.02 * sx, 0, 0.02))
            if t < 0.45:
                wt = blend('hips', 'thigh.' + s, (t + 0.06) / 0.14)
            elif t < 0.62:
                wt = blend('thigh.' + s, 'shin.' + s, (t - 0.47) / 0.12)
            else:
                wt = {'shin.' + s: 1.0}
            m = T['leg'] if t < 0.6 else (1 + (T['leg'] - 1) * 0.6)
            ry2 = ry * m
            rings.append((p, ax, rx * m, ry2, wt, t))
        u0 = 0.0 if s == 'L' else 0.5
        tube(rings, NL, lambda u, v, u0=u0: (3 + u0 + 0.5 * u, max(0.001, min(0.799, 0.8 * (1 - max(0, v))))), closed_end=False)
        # shoe: lofted along -Y from heel to toe; flat sole
        sh = []
        for y, w, h, z0 in ((0.07, 0.042, 0.105, 0.0), (0.05, 0.048, 0.115, 0.0), (0.0, 0.052, 0.1, 0.0), (-0.06, 0.054, 0.075, 0.0), (-0.13, 0.05, 0.06, 0.0), (-0.175, 0.04, 0.045, 0.004)):
            sh.append((y, w, h, z0))
        rows = []
        for y, w, h, z0 in sh:
            row = []
            for k in range(10):
                th = 2 * math.pi * k / 10  # 0 = bottom centre
                px = math.sin(th) * w
                pz = z0 + (1 - math.cos(th)) * 0.5 * h
                pz = max(z0, pz)
                row.append(B.vert((c.x + px, c.y + y - 0.02, pz), {'foot.' + s: 1.0} if y < 0.0 else blend('shin.' + s, 'foot.' + s, 0.6)))
            rows.append((row, y))
        for (r0, y0), (r1, y1) in zip(rows, rows[1:]):
            for k in range(10):
                k2 = (k + 1) % 10
                uu = lambda kk, yy: (4 + (0.0 if s == 'L' else 0.5) + 0.5 * (kk / 10), max(0.001, min(0.999, (0.08 - yy) / 0.27)))
                B.face([r0[k], r1[k], r1[k2], r0[k2]], [uu(k, y0), uu(k, y1), uu(k + 1, y1), uu(k + 1, y0)])
        for rr, yy, flip in ((rows[0][0], rows[0][1], True), (rows[-1][0], rows[-1][1], False)):
            cc = sum((Vector(B.v[i]) for i in rr), Vector()) / 10
            ci = B.vert(cc, B.w[rr[0]])
            for k in range(10):
                k2 = (k + 1) % 10
                uv = (4 + (0.0 if s == 'L' else 0.5) + 0.25, max(0.001, min(0.999, (0.08 - yy) / 0.27)))
                B.face([rr[k], rr[k2], ci] if flip else [rr[k2], rr[k], ci], [uv, uv, uv])

    # ---- head: deformed sphere with nose, brow, jaw and ears ----
    SEG, RINGS = 20, 14
    hid = {}
    for j in range(RINGS + 1):
        phi = math.pi * j / RINGS  # 0 top
        for k in range(SEG):
            th = 2 * math.pi * k / SEG  # 0 = back
            x, y, z = math.sin(phi) * math.sin(th), -math.sin(phi) * math.cos(th), math.cos(phi)
            y = -y  # 0 = back means +Y at th=0
            x, y = math.sin(phi) * math.sin(th), math.sin(phi) * math.cos(th)
            hx, hy, hz = x * 0.091, y * 0.104, z * 0.116
            front = max(0.0, -y)
            if z < 0:
                kz = -z
                hx *= 1 - 0.22 * kz * kz
                hy *= 1 - 0.08 * kz
                if front > 0.3:
                    hy -= 0.012 * front * kz
            if front > 0.6 and -0.5 < z < 0.3:
                hy += 0.008 * (front - 0.6) / 0.4  # flatter face
            if front > 0.86 and abs(x) < 0.3 and -0.38 < z < 0.08:
                hy -= 0.03 * (1 - abs(x) / 0.3) * max(0, 1 - abs(z + 0.14) / 0.24)  # nose
            if front > 0.7 and 0.08 < z < 0.26 and abs(x) < 0.75:
                hy -= 0.007  # brow
            if front > 0.6 and -0.06 < z < 0.1 and 0.25 < abs(x) < 0.6:
                hy += 0.006  # eye sockets
            p = Vector((hx, hy + 0.014, hz + 1.66))
            wt = {'head': 1.0} if hz > -0.07 else blend('neck', 'head', (hz + 0.12) / 0.05)
            hid[(j, k)] = B.vert(p, wt)

    def head_u(k):
        a = k / SEG  # 0 = back; 0.5 = front
        d = a - 0.5
        ad = abs(d)
        r = ad / (1 / 6) * 0.3 if ad < 1 / 6 else 0.3 + (ad - 1 / 6) / (1 / 3) * 0.2
        return 0.5 + math.copysign(r, d)

    for j in range(RINGS):
        for k in range(SEG):
            k2 = (k + 1) % SEG
            uk, uk2 = head_u(k), head_u(k2 if k2 else SEG)
            if k2 == 0:
                uk2 = 1.0
            v0, v1 = 1 - j / RINGS, 1 - (j + 1) / RINGS
            # wound so the faces point outward
            B.face([hid[(j, k2)], hid[(j + 1, k2)], hid[(j + 1, k)], hid[(j, k)]], [(0 + min(0.999, uk2), v0), (0 + min(0.999, uk2), v1), (0 + max(0.001, uk), v1), (0 + max(0.001, uk), v0)])
    # ears
    for sx in (1, -1):
        c = Vector((0.09 * sx, 0.012, 1.655))
        er = []
        for i, (dx, r1, r2) in enumerate(((-0.006, 0.02, 0.032), (0.004, 0.018, 0.03), (0.012, 0.012, 0.022))):
            er.append((c + Vector((dx * sx, 0, 0)), Vector((sx, 0, 0)), r1, r2, {'head': 1.0}, i / 2))
        tube(er, 8, lambda u, v: (1 + 0.1 + u * 0.3, 0.6 + v * 0.3), closed_end=True)

    me = bpy.data.meshes.new('person_' + kind)
    me.from_pydata(B.v, [], B.f)
    me.update()
    o = bpy.data.objects.new('person_' + kind, me)
    link(o)
    uvl = me.uv_layers.new(name='UVMap')
    for poly, uvs in zip(me.polygons, B.fuv):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
    groups = {}
    for i, w in enumerate(B.w):
        tot = sum(w.values())
        for bn, ww in w.items():
            g = groups.get(bn) or o.vertex_groups.new(name=bn)
            groups[bn] = g
            g.add([i], ww / tot, 'REPLACE')
    for p in me.polygons:
        p.use_smooth = True
    return o


def build_people():
    reset()
    base = build('base')
    assign(base, mat('person', (0.8, 0.8, 0.8), 0.8))
    # body types as shape keys (same topology, different measurements)
    base.shape_key_add(name='Basis')
    for kind in ('heavy', 'slim', 'female', 'muscle'):
        o = build(kind)
        key = base.shape_key_add(name=kind)
        for i, v in enumerate(o.data.vertices):
            key.data[i].co = v.co
        bpy.data.objects.remove(o, do_unlink=True)
    base.name = 'body'
    base.data.name = 'body'
    # armature
    arm_data = bpy.data.armatures.new('rig')
    rig = bpy.data.objects.new('rig', arm_data)
    link(rig)
    select_only([rig])
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones
    for n, h, t, par in BONES:
        b = eb.new(n)
        b.head, b.tail = h, t
        b.roll = 0
        if par:
            b.parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    base.parent = rig
    md = base.modifiers.new('rig', 'ARMATURE')
    md.object = rig
    return base, rig


body, rig = build_people()
result = {'tris': tris(body), 'verts': len(body.data.vertices)}


# ---------------- hair, hats, beards, glasses, carried things ----------------
HC = Vector((0, 0.014, 1.66))
HR = (0.091, 0.104, 0.116)


def head_dir(phi, th):
    """unit-sphere direction; th = 0 at the back (+Y), pi at the face (-Y)."""
    return math.sin(phi) * math.sin(th), math.sin(phi) * math.cos(th), math.cos(phi)


def head_surface(x, y, z, grow=0.0):
    """Same jaw/face shaping as the head mesh, then pushed outward by `grow` metres."""
    hx, hy, hz = x * HR[0], y * HR[1], z * HR[2]
    if z < 0:
        kz = -z
        hx *= 1 - 0.22 * kz * kz
        hy *= 1 - 0.08 * kz
    n = Vector((x / HR[0], y / HR[1], z / HR[2])).normalized()
    return HC + Vector((hx, hy, hz)) + n * grow


def grid_mesh(name, fn, region, seg=20, rings=14, phi0=0.0, phi1=math.pi, keep=None, uvfn=None):
    """Sphere-like grid; fn(phi, th) -> point. keep(phi, th) decides which quads exist."""
    vid, V, F, FU = {}, [], [], []
    for j in range(rings + 1):
        phi = phi0 + (phi1 - phi0) * j / rings
        for k in range(seg):
            th = 2 * math.pi * k / seg
            vid[(j, k)] = len(V)
            V.append(tuple(fn(phi, th)))
    for j in range(rings):
        for k in range(seg):
            k2 = (k + 1) % seg
            pm = phi0 + (phi1 - phi0) * (j + 0.5) / rings
            tm = 2 * math.pi * (k + 0.5) / seg
            if keep and not keep(pm, tm):
                continue
            F.append([vid[(j, k2)], vid[(j + 1, k2)], vid[(j + 1, k)], vid[(j, k)]])  # outward
            u0, u1 = k / seg, (k + 1) / seg
            v0, v1 = 1 - j / rings, 1 - (j + 1) / rings
            FU.append([(region + max(0.001, min(0.999, u1)), v0), (region + max(0.001, min(0.999, u1)), v1), (region + u0, v1), (region + u0, v0)])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = (uv[0] if uv[0] < region + 1 else region + 0.999, max(0.001, min(0.999, uv[1])))
    select_only([o])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.object.mode_set(mode='OBJECT')
    return o


def hairline(th, front=0.35, side=-0.12, back=-0.55):
    c = math.cos(th)  # 1 back, -1 front
    if c < 0:
        return side + (front - side) * (-c)
    return side + (back - side) * c


def hair_style(name, thick=0.012, front=0.35, side=-0.12, back=-0.55, puff=1.0, ridge=None, bumps=0.0):
    def keep(phi, th):
        x, y, z = head_dir(phi, th)
        if ridge is not None and abs(x) > ridge:
            return False
        return z > hairline(th, front, side, back) - 0.02

    def fn(phi, th):
        x, y, z = head_dir(phi, th)
        g = thick
        top = max(0.0, z)
        g += (puff - 1) * 0.11 * (0.4 + 0.6 * top)
        if bumps:
            g += bumps * (0.5 + 0.5 * math.sin(phi * 23) * math.sin(th * 17))
        if ridge is not None:
            g += 0.05 * max(0, 1 - abs(x) / ridge) * top
        return head_surface(x, y, z, g)

    return grid_mesh('hair_' + name, fn, 5, seg=22, rings=12, keep=keep)


def curtain(name, z0, z1, flare=0.02, a0=0.7, thick=0.014, seg=14, rows=4):
    """Hair hanging from the back and sides: th in [a0*pi .. (2-a0)*pi] around the back."""
    V, F, FU = [], [], []
    for j in range(rows + 1):
        t = j / rows
        z = z0 + (z1 - z0) * t
        for k in range(seg + 1):
            th = -a0 * math.pi + 2 * a0 * math.pi * k / seg  # around the back (0)
            x, y = math.sin(th), math.cos(th)
            g = thick + flare * t
            V.append((HC.x + x * (HR[0] + g), HC.y + y * (HR[1] + g), z))
    for j in range(rows):
        for k in range(seg):
            a, b = j * (seg + 1) + k, (j + 1) * (seg + 1) + k
            F.append([a, a + 1, b + 1, b])
            FU.append([(5 + k / seg * 0.999, 1 - j / rows), (5 + (k + 1) / seg * 0.999, 1 - j / rows), (5 + (k + 1) / seg * 0.999, 1 - (j + 1) / rows), (5 + k / seg * 0.999, 1 - (j + 1) / rows)])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = (uv[0], max(0.001, min(0.999, uv[1])))
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.01
    apply_mods(o)
    return o


def tube_obj(name, pts, radii, region, seg=8, cap=True):
    """A tube through pts (Vector list) with radii; UVs in `region`."""
    V, F, FU = [], [], []
    for i, (p, r) in enumerate(zip(pts, radii)):
        a = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        f, s = ring_frame(a)
        for k in range(seg):
            th = 2 * math.pi * k / seg
            V.append(tuple(p + s * math.sin(th) * r + f * math.cos(th) * r))
    n = len(pts)
    for i in range(n - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            F.append([i * seg + k, i * seg + k2, (i + 1) * seg + k2, (i + 1) * seg + k])
            FU.append([(region + k / seg, i / (n - 1)), (region + min(0.999, (k + 1) / seg), i / (n - 1)), (region + min(0.999, (k + 1) / seg), (i + 1) / (n - 1)), (region + k / seg, (i + 1) / (n - 1))])
    if cap:
        for i, flip in ((0, True), (n - 1, False)):
            c = len(V)
            V.append(tuple(pts[i]))
            for k in range(seg):
                k2 = (k + 1) % seg
                F.append([i * seg + k2, i * seg + k, c] if flip else [i * seg + k, i * seg + k2, c])
                FU.append([(region + 0.5, 0.5)] * 3)
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = (uv[0], max(0.001, min(0.999, uv[1])))
    return o


def box_obj(name, size, loc, region, uv=(0.5, 0.5), rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=False)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = 2
        apply_mods(o)
    uvl = o.data.uv_layers.get('UVMap') or o.data.uv_layers.new(name='UVMap')
    for l in uvl.data:
        l.uv = (region + uv[0], uv[1])
    assign(o, mat('person', (0.8, 0.8, 0.8)))
    return o


def rehome(o, name):
    """Apply transforms, put the origin at the world origin (rest-pose space)."""
    select_only([o])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.name = name
    o.data.name = name
    return o


def build_accessories():
    out = []
    # --- hair ---
    out.append(hair_style('short', 0.012))
    out.append(hair_style('crew', 0.007, front=0.42))
    out.append(hair_style('buzz', 0.003, front=0.4))
    out.append(hair_style('curly', 0.022, bumps=0.006))
    out.append(hair_style('afro', 0.03, front=0.3, side=-0.2, puff=1.5, bumps=0.004))
    out.append(hair_style('mohawk', 0.004, ridge=0.22))
    out.append(hair_style('balding', 0.009, front=0.55, side=-0.15, back=-0.5))
    # balding: drop the crown
    o = out[-1]
    select_only([o])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons:
        c = o.data.vertices[p.vertices[0]].co
        if c.z > HC.z + 0.075:
            p.select = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')
    # long styles: scalp + curtain
    for nm, z1, fl, front in (('long', 1.40, 0.03, 0.3), ('bob', 1.56, 0.02, 0.3), ('shoulder', 1.48, 0.025, 0.32)):
        s = hair_style(nm, 0.016, front=front, side=-0.3)
        c = curtain('c', 1.69, z1, fl, a0=0.62)
        out.append(join([s, c], 'hair_' + nm))
    s = hair_style('pony', 0.012, front=0.38)
    t = tube_obj('pt', [HC + Vector((0, 0.1, 0.04)), HC + Vector((0, 0.135, -0.02)), HC + Vector((0, 0.15, -0.12)), HC + Vector((0, 0.14, -0.22))], [0.03, 0.032, 0.026, 0.012], 5)
    out.append(join([s, t], 'hair_pony'))
    s = hair_style('bunb', 0.012, front=0.38)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=7, radius=0.048, location=tuple(HC + Vector((0, 0.07, 0.1))))
    b = bpy.context.object
    uvl = b.data.uv_layers.get('UVMap')
    for l in uvl.data:
        l.uv = (5 + l.uv[0] * 0.999, l.uv[1])
    out.append(join([s, b], 'hair_bun'))
    s = hair_style('dreadb', 0.016, front=0.36)
    parts = [s]
    for i in range(9):
        a = -2.0 + i * 0.5
        top = HC + Vector((math.sin(a) * 0.085, math.cos(a) * 0.095, 0.02))
        parts.append(tube_obj('d', [top, top + Vector((math.sin(a) * 0.03, math.cos(a) * 0.03, -0.12)), top + Vector((math.sin(a) * 0.04, math.cos(a) * 0.04, -0.24))], [0.014, 0.013, 0.01], 5, seg=5))
    out.append(join(parts, 'hair_dreads'))
    # --- beards ---
    def beard(name, zt, zb, front, grow, mx=1.0):
        def keep(phi, th):
            x, y, z = head_dir(phi, th)
            return zb < z < zt and -y > front and abs(x) < mx

        def fn(phi, th):
            x, y, z = head_dir(phi, th)
            return head_surface(x, y, z, grow) + Vector((0, -0.004, 0))
        return grid_mesh('beard_' + name, fn, 5, seg=28, rings=16, keep=keep)
    out.append(beard('full', -0.15, -0.98, 0.05, 0.012))
    out.append(beard('goatee', -0.3, -0.98, 0.72, 0.012, mx=0.3))
    out.append(beard('mustache', -0.2, -0.36, 0.8, 0.012, mx=0.42))
    # --- hats ---
    def dome(name, scale, zcut, extra=0.0):
        def keep(phi, th):
            x, y, z = head_dir(phi, th)
            return z > zcut(th)

        def fn(phi, th):
            x, y, z = head_dir(phi, th)
            return HC + Vector((x * HR[0] * scale, y * HR[1] * scale, z * HR[2] * scale + extra))
        return grid_mesh(name, fn, 6, seg=20, rings=10, keep=keep)

    def disc(name, cx, cy, z, rx, ry, a0, a1, seg=12, thick=0.008, region=6):
        V, F = [], []
        for k in range(seg + 1):
            a = a0 + (a1 - a0) * k / seg
            V.append((cx + math.sin(a) * rx * 0.35, cy + math.cos(a) * ry * 0.35, z))
            V.append((cx + math.sin(a) * rx, cy + math.cos(a) * ry, z - 0.01))
        for k in range(seg):
            F.append([2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1])
        o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
        uvl = o.data.uv_layers.new(name='UVMap')
        for l in uvl.data:
            l.uv = (region + 0.5, 0.1)
        sol = o.modifiers.new('sol', 'SOLIDIFY')
        sol.thickness = thick
        apply_mods(o)
        return o
    crown = dome('c', 1.12, lambda th: 0.18 if math.cos(th) < 0 else 0.05)
    brim = disc('b', 0, -0.06, HC.z + 0.035, 0.1, 0.13, math.pi * 0.62, math.pi * 1.38)
    out.append(join([crown, brim], 'hat_cap'))
    out.append(dome('hat_beanie', 1.14, lambda th: 0.12 if math.cos(th) < 0 else -0.05, 0.012))
    band = tube_obj('b', [HC + Vector((0, 0.0, 0.03)), HC + Vector((0, 0.005, 0.09)), HC + Vector((0, 0.012, 0.135))], [0.1, 0.106, 0.122], 6, seg=18)
    band.scale = (1.0, 1.12, 1.0)
    peak = disc('p', 0, -0.06, HC.z + 0.045, 0.092, 0.118, math.pi * 0.66, math.pi * 1.34, thick=0.006)
    band = rehome(band, 'b')
    out.append(join([band, peak], 'hat_police'))
    crown = dome('c', 1.24, lambda th: 0.08, 0.015)
    rim = disc('r', 0, 0.005, HC.z + 0.03, 0.15, 0.17, 0, 2 * math.pi, seg=20, thick=0.006)
    out.append(join([crown, rim], 'hat_hard'))
    crown = dome('c', 1.26, lambda th: 0.0, 0.02)
    rim = disc('r', 0, 0.03, HC.z + 0.01, 0.15, 0.2, 0, 2 * math.pi, seg=20, thick=0.008)
    out.append(join([crown, rim], 'hat_fire'))
    out.append(dome('hat_swat', 1.2, lambda th: -0.15 if math.cos(th) > 0 else 0.15, 0.01))
    # --- glasses (fixed colours: region 7) ---
    parts = []
    for sx in (1, -1):
        parts.append(box_obj('l', (0.042, 0.004, 0.028), (0.036 * sx, HC.y - 0.108, HC.z + 0.0), 7, (0.25, 0.75), bevel=0.006))
        parts.append(box_obj('t', (0.004, 0.11, 0.005), (0.09 * sx, HC.y - 0.05, HC.z + 0.008), 7, (0.75, 0.75)))
    parts.append(box_obj('br', (0.026, 0.004, 0.005), (0, HC.y - 0.109, HC.z + 0.006), 7, (0.75, 0.75)))
    out.append(join(parts, 'glasses_shades'))
    parts = []
    for sx in (1, -1):
        parts.append(box_obj('l', (0.04, 0.003, 0.026), (0.036 * sx, HC.y - 0.108, HC.z + 0.0), 7, (0.25, 0.25), bevel=0.006))
        parts.append(box_obj('t', (0.003, 0.11, 0.004), (0.09 * sx, HC.y - 0.05, HC.z + 0.008), 7, (0.75, 0.75)))
    parts.append(box_obj('br', (0.026, 0.003, 0.004), (0, HC.y - 0.109, HC.z + 0.006), 7, (0.75, 0.75)))
    out.append(join(parts, 'glasses_clear'))
    # --- carried things (rigid on a bone; origin at the attach point) ---
    bp = box_obj('acc_backpack', (0.3, 0.16, 0.4), (0, 0, 0), 6, (0.3, 0.5), bevel=0.03)
    out.append(bp)
    bag = box_obj('b', (0.08, 0.26, 0.24), (0, 0, -0.16), 6, (0.6, 0.5), bevel=0.02)
    strap = box_obj('s', (0.01, 0.02, 0.2), (0, 0, -0.02), 6, (0.6, 0.9))
    out.append(join([bag, strap], 'acc_bag'))
    out.append(box_obj('acc_mailbag', (0.12, 0.34, 0.26), (0, 0, 0), 6, (0.6, 0.5), bevel=0.02))
    body_ = box_obj('g1', (0.34, 0.08, 0.42), (0, 0, -0.1), 6, (0.8, 0.3), bevel=0.04)
    neck_ = box_obj('g2', (0.05, 0.03, 0.5), (0, 0, 0.36), 7, (0.75, 0.25))
    out.append(join([body_, neck_], 'acc_guitar'))
    out.append(tube_obj('acc_cane', [Vector((0, 0, 0)), Vector((0, 0, -0.85))], [0.012, 0.012], 7, seg=6))
    out.append(box_obj('acc_phone', (0.035, 0.008, 0.07), (0, 0, 0), 7, (0.25, 0.25), bevel=0.003))
    out.append(tube_obj('acc_cig', [Vector((0, 0, 0)), Vector((0, -0.07, 0))], [0.0045, 0.0045], 7, seg=5))
    out.append(tube_obj('acc_coffee', [Vector((0, 0, -0.05)), Vector((0, 0, 0.06))], [0.03, 0.038], 6, seg=10))
    sign = box_obj('s1', (0.5, 0.012, 0.36), (0, 0, 0.75), 7, (0.25, 0.75))
    pole = box_obj('s2', (0.02, 0.02, 0.9), (0, 0.01, 0.2), 7, (0.75, 0.25))
    out.append(join([sign, pole], 'acc_sign'))
    return out


accs = build_accessories()
result = {'accs': len(accs), 'tris': sum(tris(a) for a in accs)}
kb = export_glb('people', [rig, body] + accs)
result = {'kb': kb, 'body_tris': tris(body), 'acc_tris': sum(tris(a) for a in accs), 'n': len(accs)}
