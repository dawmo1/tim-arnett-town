# People: one rigged body (body-type morphs as shape keys) plus hair, hats, beards, glasses, clothing
# overlays (hood, skirt, vest, collars) and carried things.
# Run headless:  TAT_ROOT=/path/to/repo/ blender -b -P assets/src/people.py   (TAT_PREVIEW=1 also renders PNGs)
# or in Blender:  exec(open(ROOT + 'assets/src/people.py').read())
#
# Everything is lofted from cross-sections in plain Python, so shape, UVs and skin weights are exact.
# UV convention (read by src/people/paint.js and the people shader): u = region + local_u, v = local_v,
# so floor(u) says which atlas cell family a face uses:
#   0 face/head   1 skin (hands, neck, ears)   2 top (torso + arms)   3 bottom (pelvis + legs)
#   4 shoes   5 hair   6 hat / accent   7 fixed-colour bits (glasses, badges)
# The face cell is painted in the head's own (u, v): u = 0.5 at the front, v = 1 - polar angle / pi, so the
# sculpted features below (FACE_*) sit exactly where paint.js draws the eyes, brows and lips.
# Style: PS2-era (San Andreas-like) people: low-poly, a bit chunky, clear silhouettes, mitten hands, a simply
# sculpted nose/brow/chin with the eyes, brows and mouth painted on, chunky hair shapes, clothes as colour regions.
# Blender axes: Z up, the character faces -Y, its left side is +X.
# Bones, their names and joints are a contract with src/people/pose.js and the game: don't rename them.
import math, os
ROOT = os.environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/')
exec(open(ROOT + 'assets/src/tat.py').read(), globals())
ROOT = os.environ.get('TAT_ROOT', ROOT)
OUT = ROOT + 'assets/models/'
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
# torso keys: (z, half width, front depth, back depth); bumps: named muscle/fat amounts; limbs: radius multipliers
TYPES = {
    'base': dict(torso=[(0.80, 0.07, 0.06, 0.07), (0.86, 0.160, 0.085, 0.10), (0.92, 0.172, 0.092, 0.108), (0.985, 0.160, 0.096, 0.098),
                        (1.05, 0.146, 0.098, 0.090), (1.12, 0.142, 0.098, 0.088), (1.20, 0.152, 0.106, 0.092), (1.28, 0.166, 0.112, 0.098),
                        (1.35, 0.178, 0.104, 0.100), (1.41, 0.170, 0.084, 0.088), (1.455, 0.132, 0.064, 0.070), (1.49, 0.066, 0.052, 0.054)],
                 pec=0.010, bust=0.0, glute=0.022, belly=0.0, blade=0.007, arm=1.0, fore=1.0, leg=1.0, calf=1.0, neck=1.0, hand=1.0,
                 jaw=0.0, brow=1.0, nose=1.0, lips=1.0, cheek=1.0, chin=1.0),
    'heavy': dict(torso=[(0.80, 0.08, 0.07, 0.08), (0.86, 0.192, 0.11, 0.125), (0.92, 0.206, 0.14, 0.135), (0.985, 0.204, 0.17, 0.125),
                         (1.05, 0.204, 0.188, 0.118), (1.12, 0.200, 0.180, 0.114), (1.20, 0.196, 0.160, 0.114), (1.28, 0.196, 0.145, 0.112),
                         (1.35, 0.200, 0.125, 0.110), (1.41, 0.194, 0.095, 0.096), (1.455, 0.150, 0.068, 0.072), (1.49, 0.070, 0.056, 0.056)],
                  pec=0.006, bust=0.012, glute=0.02, belly=0.012, blade=0.002, arm=1.22, fore=1.14, leg=1.2, calf=1.12, neck=1.22, hand=1.08,
                  jaw=0.005, brow=0.9, nose=1.08, lips=1.05, cheek=1.6, chin=0.6),
    'slim': dict(torso=[(0.80, 0.06, 0.052, 0.06), (0.86, 0.142, 0.074, 0.088), (0.92, 0.150, 0.080, 0.094), (0.985, 0.138, 0.082, 0.086),
                        (1.05, 0.126, 0.082, 0.078), (1.12, 0.124, 0.082, 0.076), (1.20, 0.134, 0.090, 0.080), (1.28, 0.146, 0.096, 0.084),
                        (1.35, 0.158, 0.092, 0.088), (1.41, 0.154, 0.074, 0.078), (1.455, 0.116, 0.052, 0.058), (1.49, 0.054, 0.044, 0.046)],
                 pec=0.004, bust=0.0, glute=0.014, belly=0.0, blade=0.009, arm=0.86, fore=0.9, leg=0.88, calf=0.9, neck=0.9, hand=0.95,
                 jaw=-0.002, brow=1.1, nose=1.0, lips=0.9, cheek=0.4, chin=1.1),
    'female': dict(torso=[(0.80, 0.075, 0.06, 0.075), (0.86, 0.182, 0.088, 0.118), (0.92, 0.188, 0.092, 0.124), (0.985, 0.164, 0.090, 0.104),
                          (1.05, 0.132, 0.086, 0.084), (1.12, 0.122, 0.084, 0.080), (1.20, 0.136, 0.094, 0.084), (1.28, 0.148, 0.100, 0.088),
                          (1.35, 0.156, 0.094, 0.090), (1.41, 0.154, 0.076, 0.080), (1.455, 0.114, 0.050, 0.056), (1.49, 0.052, 0.042, 0.044)],
                   pec=0.0, bust=0.040, glute=0.034, belly=0.0, blade=0.005, arm=0.84, fore=0.84, leg=1.02, calf=0.95, neck=0.84, hand=0.86,
                   jaw=-0.006, brow=0.35, nose=0.8, lips=1.25, cheek=1.1, chin=0.75),
    'muscle': dict(torso=[(0.80, 0.07, 0.06, 0.07), (0.86, 0.164, 0.088, 0.108), (0.92, 0.172, 0.094, 0.112), (0.985, 0.160, 0.098, 0.100),
                          (1.05, 0.150, 0.100, 0.094), (1.12, 0.154, 0.102, 0.096), (1.20, 0.178, 0.118, 0.104), (1.28, 0.202, 0.128, 0.110),
                          (1.35, 0.220, 0.120, 0.112), (1.41, 0.212, 0.094, 0.100), (1.455, 0.160, 0.066, 0.076), (1.49, 0.068, 0.054, 0.056)],
                   pec=0.022, bust=0.0, glute=0.026, belly=0.0, blade=0.014, arm=1.28, fore=1.2, leg=1.14, calf=1.15, neck=1.28, hand=1.08,
                   jaw=0.004, brow=1.2, nose=1.05, lips=1.0, cheek=0.9, chin=1.25),
}
TORSO_Z = [0.80, 0.86, 0.92, 0.985, 1.06, 1.14, 1.22, 1.30, 1.37, 1.42, 1.46, 1.49]


def torso_at(kind, z):
    w, df, db = _torso_at(kind, z)
    if z > 1.40:  # trapezius: slope from the shoulders in to the neck
        t = sstep(1.40, 1.49, z)
        w *= 1 - 0.38 * t
        df *= 1 - 0.12 * t
    if z < 0.86:  # crotch: taper smoothly between the legs
        t = sstep(0.86, 0.80, z)
        w *= 1 - 0.25 * t
    return [w, df, db]


def _torso_at(kind, z):
    ks = TYPES[kind]['torso']
    for a, b in zip(ks, ks[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            t = t * t * (3 - 2 * t)
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 4)]
    return list(ks[-1][1:]) if z > ks[-1][0] else list(ks[0][1:])


def g1(x, s):
    return math.exp(-(x / s) ** 2)


def sstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


NT, NA, NL = 14, 8, 8  # segments around the torso, arms, legs (low-poly)


class Builder:
    def __init__(s):
        s.v, s.f, s.fuv, s.w = [], [], [], []

    def vert(s, p, w):
        s.v.append(tuple(p))
        s.w.append(dict(w))
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


def mix_w(w1, w2, t):
    out = {}
    for k, v in w1.items():
        out[k] = out.get(k, 0) + v * (1 - t)
    for k, v in w2.items():
        out[k] = out.get(k, 0) + v * t
    return {k: v for k, v in out.items() if v > 1e-4}


def ruv(region, u, v):
    """UV inside a region, never touching the next region's integer."""
    return (region + max(0.001, min(0.999, u)), max(0.001, min(0.999, v)))


# ---------------- head ----------------
HC = Vector((0, 0.012, 1.643))  # (a touch below the head bone's old centre: a shorter neck)
HR = (0.080, 0.097, 0.113)
SEGH, RINGH = 20, 13


def head_theta(k):
    """k in [0, SEGH]: 0 = back; denser toward the face (k = SEGH / 2)."""
    d = k / SEGH - 0.5
    return math.pi + math.copysign(abs(2 * d) ** 1.45, d) * math.pi


def head_u(th):
    a = th / (2 * math.pi)  # 0 back, 0.5 front
    d = a - 0.5
    ad = abs(d)
    r = ad / (1 / 6) * 0.3 if ad < 1 / 6 else 0.3 + (ad - 1 / 6) / (1 / 3) * 0.2
    return 0.5 + math.copysign(r, d)


def head_dir(phi, th):
    """unit-sphere direction; th = 0 at the back (+Y), pi at the face (-Y)."""
    return math.sin(phi) * math.sin(th), math.sin(phi) * math.cos(th), math.cos(phi)


def skull(x, y, z, kind='base'):
    """The head without facial features (hair and hats sit on this), relative to HC. (x, y, z) is a unit direction."""
    T = TYPES[kind]
    rr = math.hypot(x, y)
    dx, dy = (x / rr, y / rr) if rr > 1e-6 else (0.0, -1.0)
    front, back = max(0.0, -dy), max(0.0, dy)
    R = rr
    sx_, sy_ = 1.0, 1.0
    if z < 0:
        kz = -z
        # the lower face keeps its width and depth (a jaw and chin, not an egg), closing into a flat underside
        rf = (0.94 - 0.26 * kz * kz) * min(1.0, (1 - kz) / 0.14)
        R = rr + (max(rr, rf) - rr) * sstep(0.05, 0.6, front)
        sx_ = 1 - (0.2 - T['jaw'] * 6) * kz * kz  # jaw narrows toward the chin
        sy_ = 1 - 0.5 * back * kz * kz  # the back of the skull tucks in above the neck
    else:
        sy_ = 1 - 0.07 * front * z  # forehead slopes back
        sx_ = 1 + 0.03 * z * (1 - z)  # a little fuller at the temples
    hx, hy, hz = dx * R * HR[0] * sx_, dy * R * HR[1] * sy_, z * HR[2]
    if z < 0 and front > 0.3:
        hz -= 0.008 * (-z) * sstep(0.3, 0.9, front)  # a longer face
    if back > 0.2 and -0.2 < z < 0.6:
        hy += 0.006 * back  # occipital bulge
    return Vector((hx, hy, hz))


def face_disp(u, v, kind='base'):
    """Forward displacement (metres) of the face at face-texture coords (u, v): big, simple shapes only
    (brow, eye hollows, a wedge of a nose, the mouth block and the chin); the rest is painted."""
    T = TYPES[kind]
    du, au = u - 0.5, abs(u - 0.5)
    d = 0.0
    d += 0.008 * T['brow'] * g1(v - 0.61, 0.035) * g1(du, 0.18)  # brow ridge
    d -= 0.006 * g1(au - 0.112, 0.06) * g1(v - 0.545, 0.04)  # eye hollows
    nz = T['nose']
    if 0.40 < v < 0.64:
        t = sstep(0.62, 0.45, v)
        d += (0.004 + 0.022 * t) * nz * sstep(0.405, 0.45, v) * g1(du, 0.03 + 0.025 * t)  # nose wedge
    d += 0.005 * T['cheek'] * g1(au - 0.17, 0.07) * g1(v - 0.47, 0.06)  # cheekbones
    d += 0.006 * T['lips'] * g1(du, 0.08) * g1(v - 0.37, 0.035)  # mouth block
    d += 0.009 * T['chin'] * g1(du, 0.09) * g1(v - 0.29, 0.045)  # chin
    d += 0.004 * (T['cheek'] - 1) * g1(au - 0.15, 0.08) * g1(v - 0.38, 0.08)  # heavy: fuller cheeks
    return d


def head_point(phi, th, kind='base', grow=0.0, features=True):
    x, y, z = head_dir(phi, th)
    p = skull(x, y, z, kind)
    n = Vector((x / HR[0], y / HR[1], z / HR[2])).normalized()
    if features:
        u, v = head_u(th), 1 - phi / math.pi
        p += n * face_disp(u, v, kind)
        # heavy: a soft double chin under the jaw
        if kind == 'heavy':
            p += Vector((0, -0.004, -0.007)) * g1(u - 0.5, 0.12) * g1(v - 0.24, 0.06)
    return HC + p + n * grow


def build(kind):
    T = TYPES[kind]
    B = Builder()

    def tube(rings, n, region_uv, closed_end=True, start_cap=False, rfn=None):
        """rings: list of (center, axis, rx, ry, weights, v, t); region_uv(u, v) -> (U, V);
        rfn(t, th) -> radius multiplier (muscle shaping), th = 0 at the back."""
        ids = []
        for ring in rings:
            c, ax, rx, ry, wts, vv = ring[:6]
            tt = ring[6] if len(ring) > 6 else 0
            fwd, side = ring_frame(ax)
            row = []
            for k in range(n):
                th = 2 * math.pi * k / n  # 0 = back
                m = rfn(tt, th) if rfn else 1.0
                p = c + side * (math.sin(th) * rx * m) - fwd * (math.cos(th) * ry * m)
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
        if start_cap:
            row, vv = ids[0]
            c = sum((Vector(B.v[i]) for i in row), Vector()) / n
            ci = B.vert(c, B.w[row[0]])
            for k in range(n):
                k2 = (k + 1) % n
                B.face([row[k2], row[k], ci], [region_uv(k / n, vv), region_uv((k + 1) / n, vv), region_uv((k + 0.5) / n, vv)])
        return ids

    # ---- torso ----
    trows = []
    for z in TORSO_Z:
        w, df, db = torso_at(kind, z)
        wt = blend('hips', 'spine', (z - 0.98) / 0.12) if z < 1.13 else blend('spine', 'chest', (z - 1.16) / 0.12)
        if z > 1.455:
            wt = blend('chest', 'neck', (z - 1.455) / 0.035)
        row = []
        for k in range(NT):
            th = 2 * math.pi * k / NT
            sx, cy = math.sin(th), math.cos(th)
            e = 0.80  # superellipse: squarer sides
            px = math.copysign(abs(sx) ** e, sx) * w
            dd = db if cy > 0 else df
            py = math.copysign(abs(cy) ** e, cy) * dd
            ax = abs(px)
            # sculpted bumps, pushed out along the section's outward direction
            out = 0.0
            if cy < 0:  # front
                fr = -cy
                out += T['pec'] * g1(ax - 0.075, 0.06) * g1(z - 1.33, 0.05) * fr
                out += T['bust'] * g1(ax - 0.085, 0.05) * g1(z - 1.27, 0.045) * fr
                out += T['belly'] * g1(z - 1.06, 0.1) * fr ** 2
                out -= 0.004 * g1(ax, 0.015) * g1(z - 1.2, 0.12) * fr  # the line down the middle
                out += 0.004 * g1(ax - 0.07, 0.04) * g1(z - 1.44, 0.012) * fr  # collarbones
            else:  # back
                bk = cy
                out += T['glute'] * g1(ax - 0.075, 0.055) * g1(z - 0.885, 0.05) * bk
                out -= 0.010 * g1(ax, 0.02) * g1(z - 0.83, 0.03) * bk  # the cleft
                out += T['blade'] * g1(ax - 0.085, 0.04) * g1(z - 1.34, 0.06) * bk
                out -= 0.005 * g1(ax, 0.018) * g1(z - 1.15, 0.16) * bk  # spine groove
                out -= 0.006 * g1(z - 1.03, 0.05) * bk  # small of the back
            # the trapezius slope from the neck to the shoulders
            if z > 1.40:
                px *= 1 - 0.15 * sstep(1.40, 1.49, z) * (1 - abs(sx))
            nrm = Vector((sx * (dd / max(w, 1e-3)), cy * (w / max(dd, 1e-3)) * 0.0 + cy, 0)).normalized()
            p = Vector((px, py, z)) + nrm * out
            vw = dict(wt)
            # outer shoulder-top skin follows the shoulder bone a little
            if z > 1.33 and ax > 0.11:
                sb = 'shoulder.' + ('L' if px > 0 else 'R')
                vw = mix_w(vw, {sb: 1.0}, 0.5 * sstep(0.11, 0.17, ax) * sstep(1.33, 1.41, z))
            row.append(B.vert(p, vw))
        trows.append((row, z))

    def torso_uv(u, z, region):
        if region == 2:
            return ruv(2, 0.6 * u, (z - 0.985) / 0.505)
        return ruv(3, u, 0.8 + 0.2 * max(0, min(1, (z - 0.80) / 0.185)))

    for (r0, z0), (r1, z1) in zip(trows, trows[1:]):
        region = 2 if (z0 + z1) / 2 > 0.985 else 3
        for k in range(NT):
            k2 = (k + 1) % NT
            u0, u1 = k / NT, (k + 1) / NT
            B.face([r0[k], r1[k], r1[k2], r0[k2]], [torso_uv(u0, z0, region), torso_uv(u0, z1, region), torso_uv(u1, z1, region), torso_uv(u1, z0, region)])
    r0 = trows[0][0]  # cap at the crotch (hidden between the legs)
    ci = B.vert((0, 0.005, 0.79), {'hips': 1.0})
    for k in range(NT):
        k2 = (k + 1) % NT
        B.face([r0[k2], r0[k], ci], [(3.5, 0.8)] * 3)

    # ---- neck ----
    nk = T['neck']
    nrings = []
    for i, z in enumerate((1.445, 1.49, 1.525, 1.555, 1.59)):
        r = (0.064 - 0.009 * i / 4) * nk
        nrings.append((Vector((0, 0.008 + 0.006 * i / 4, z)), Vector((0, 0.1, 1)), r * 1.08, r * (0.98 if i < 2 else 0.95),
                       blend('chest', 'neck', (z - 1.45) / 0.04) if z < 1.5 else blend('neck', 'head', (z - 1.55) / 0.06), i / 4, i / 4))

    def neck_r(t, th):  # adam's-apple / sternocleidomastoid hint at the front
        return 1 + (0.06 if kind != 'female' else 0.02) * g1(th - math.pi, 0.35) * g1(t - 0.55, 0.25)
    tube(nrings[::2], 8, lambda u, v: ruv(1, 0.1 + u * 0.3, 0.2 + v * 0.3), closed_end=False, rfn=neck_r)

    # ---- arms + hands ----
    ARM_P = [(-0.14, 0.056, 0.062), (0.0, 0.066, 0.068), (0.2, 0.062, 0.062), (0.44, 0.050, 0.052), (0.56, 0.051, 0.050),
             (0.8, 0.042, 0.038), (1.0, 0.034, 0.027)]
    for s, sx in (('L', 1), ('R', -1)):
        a, b, c, dtip = J['sh' + s], J['el' + s], J['wr' + s], J['ft' + s]
        _, side0 = ring_frame(b - a)
        lat = math.pi / 2 if side0.x * sx > 0 else 3 * math.pi / 2  # th of the outer side

        def arm_r(t, th, lat=lat):
            m = 1.0
            m += 0.16 * g1(t - 0.07, 0.09) * g1(math.cos(th - lat) - 1, 0.9)  # deltoid
            m += 0.08 * g1(t - 0.27, 0.1) * g1(th - math.pi, 0.8)  # biceps (front)
            m += 0.07 * g1(t - 0.24, 0.12) * g1(math.cos(th) - 1, 0.8)  # triceps (back)
            m += 0.10 * g1(t - 0.6, 0.08) * g1(math.cos(th - lat) - 1, 1.0)  # forearm muscle
            return m
        rings = []
        for t, rx, ry in ARM_P:
            if t <= 0.5:
                p = a + (b - a) * (t / 0.5)
                ax = b - a
            else:
                p = b + (c - b) * ((t - 0.5) / 0.5)
                ax = c - b
            if t < 0:
                p = p + Vector((0.01 * sx, 0, -0.045))
            if t < 0.38:
                wt = blend('shoulder.' + s, 'upper_arm.' + s, (t + 0.12) / 0.2) if t < 0.08 else {'upper_arm.' + s: 1.0}
            elif t < 0.62:
                wt = blend('upper_arm.' + s, 'forearm.' + s, (t - 0.44) / 0.14)
            else:
                wt = blend('forearm.' + s, 'hand.' + s, (t - 0.92) / 0.08)
            m = T['arm'] if t < 0.5 else T['fore'] if t < 0.85 else 1 + (T['fore'] - 1) * 0.5
            rings.append((p, ax, rx * m, ry * m, wt, t, t))
        u0 = 0.6 if s == 'L' else 0.8
        tube(rings, NA, lambda u, v, u0=u0: ruv(2, u0 + 0.2 * u, 1 - max(0, v)), closed_end=False, rfn=arm_r)
        # hand: a chunky mitten (palm + fingers as one block, curled a little) and a thumb. Palm faces the body.
        hm = T['hand'] * 1.15
        hax = (dtip - c)
        L = hax.length
        hd = hax.normalized()
        fwd, sd = ring_frame(hd)
        inward = sd if sd.x * sx < 0 else -sd  # toward the palm side (the body)
        huv = lambda u, v: ruv(1, 0.55 + u * 0.4, 0.55 + v * 0.4)
        hw = {'hand.' + s: 1.0}
        pr = []
        cur = c.copy()
        dirn = hd.copy()
        prev_t = 0
        for t, wd, th_ in ((0.0, 0.032, 0.026), (0.3, 0.046, 0.022), (0.6, 0.047, 0.019), (0.85, 0.042, 0.016), (1.0, 0.03, 0.012)):
            if t > 0.55:
                dirn = (dirn + inward * 0.35).normalized()  # the fingers curl toward the palm
            cur = cur + dirn * (L * (t - prev_t))
            prev_t = t
            pr.append((cur.copy(), dirn, th_ * hm, wd * hm, mix_w({'forearm.' + s: 1.0}, hw, min(1, t / 0.1)) if t < 0.1 else hw, t, t))
        tube(pr, 6, huv, closed_end=True, start_cap=False)
        tb = c + hd * (L * 0.1) + fwd * (0.016 * hm) + inward * 0.004
        tdir = (hd * 0.6 + fwd * 0.5 + inward * 0.45).normalized()
        tp = [tb, tb + tdir * 0.03 * hm, tb + tdir * 0.03 * hm + (tdir + hd * 0.6).normalized() * 0.03 * hm]
        fr = [(tp[j], (tp[min(j + 1, 2)] - tp[max(j - 1, 0)]), (0.016 - 0.002 * j) * hm, (0.014 - 0.002 * j) * hm, hw, j / 2, j / 2) for j in range(3)]
        tube(fr, 5, huv, closed_end=True)

    # ---- legs + shoes ----
    LEG_P = [(-0.08, 0.086, 0.092), (0.0, 0.096, 0.1), (0.26, 0.086, 0.086), (0.5, 0.064, 0.066), (0.58, 0.062, 0.066),
             (0.72, 0.060, 0.066), (0.9, 0.046, 0.048), (1.0, 0.045, 0.047)]
    for s, sx in (('L', 1), ('R', -1)):
        a, b, c = J['hi' + s], J['kn' + s], J['an' + s]
        lat = 3 * math.pi / 2 if sx > 0 else math.pi / 2

        def leg_r(t, th, lat=lat):
            m = 1.0
            m += 0.07 * g1(t - 0.25, 0.14) * g1(th - math.pi, 0.9)  # quads (front)
            m += 0.05 * g1(t - 0.16, 0.12) * g1(math.cos(th - lat) - 1, 0.8)  # outer thigh
            m += 0.08 * g1(t - 0.53, 0.035) * g1(th - math.pi, 0.6)  # kneecap
            m += 0.12 * T['calf'] * g1(t - 0.68, 0.08) * g1(math.cos(th) - 1, 1.0)  # calf (back)
            return m
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
            rings.append((p, ax, rx * m, ry * m, wt, t, t))
        u0 = 0.0 if s == 'L' else 0.5
        tube(rings, NL, lambda u, v, u0=u0: ruv(3, u0 + 0.5 * u, 0.8 * (1 - max(0, v))), closed_end=True, rfn=leg_r)
        # shoe: lofted heel to toe; flat sole with a lip, rounded toe box, collar round the ankle
        sh = [(0.075, 0.042, 0.105), (0.04, 0.056, 0.115), (-0.03, 0.058, 0.085), (-0.11, 0.057, 0.066), (-0.165, 0.048, 0.052), (-0.19, 0.03, 0.036)]
        NS = 8
        rows = []
        for y, w, h in sh:
            row = []
            for k in range(NS):
                th = 2 * math.pi * k / NS  # 0 = bottom centre
                sn, cs = math.sin(th), math.cos(th)
                if cs > 0.35:  # the sole: flat, a touch wider
                    px = sn / max(1e-3, math.sqrt(1 - 0.35 ** 2)) * w * 1.04 if abs(sn) < 0.94 else sn * w * 1.04
                    px = max(-w * 1.04, min(w * 1.04, px))
                    pz = 0.0 if cs > 0.8 else 0.012
                else:
                    px = sn * w
                    pz = 0.012 + (0.35 - cs) / 1.35 * (h - 0.012)
                    pz = 0.012 + (h - 0.012) * (1 - (1 - (0.35 - cs) / 1.35) ** 1.8)
                wv = {'foot.' + s: 1.0} if y < -0.01 else blend('shin.' + s, 'foot.' + s, 0.65)
                row.append(B.vert((c.x + px, c.y + y - 0.02, pz), wv))
            rows.append((row, y))
        uu = lambda kk, yy: ruv(4, (0.0 if s == 'L' else 0.5) + 0.5 * (kk / NS), (0.085 - yy) / 0.275)
        for (r0, y0), (r1, y1) in zip(rows, rows[1:]):
            for k in range(NS):
                k2 = (k + 1) % NS
                B.face([r0[k], r1[k], r1[k2], r0[k2]], [uu(k, y0), uu(k, y1), uu(k + 1, y1), uu(k + 1, y0)])
        for rr, yy, flip in ((rows[0][0], rows[0][1], True), (rows[-1][0], rows[-1][1], False)):
            cc = sum((Vector(B.v[i]) for i in rr), Vector()) / NS
            ci = B.vert(cc, B.w[rr[0]])
            for k in range(NS):
                k2 = (k + 1) % NS
                uv = uu(NS * 0.5, yy)
                B.face([rr[k], rr[k2], ci] if flip else [rr[k2], rr[k], ci], [uv, uv, uv])

    # ---- head ----
    hid = {}
    for j in range(RINGH + 1):
        phi = math.pi * j / RINGH  # 0 top
        for k in range(SEGH):
            th = head_theta(k)
            p = head_point(phi, th, kind)
            hz = p.z - HC.z
            wt = {'head': 1.0} if hz > -0.05 else blend('neck', 'head', (hz + 0.09) / 0.04)
            hid[(j, k)] = B.vert(p, wt)
    for j in range(RINGH):
        for k in range(SEGH):
            k2 = (k + 1) % SEGH
            uk, uk2 = head_u(head_theta(k)), head_u(head_theta(k + 1))
            v0, v1 = 1 - j / RINGH, 1 - (j + 1) / RINGH
            B.face([hid[(j, k2)], hid[(j + 1, k2)], hid[(j + 1, k)], hid[(j, k)]],
                   [ruv(0, uk2, v0), ruv(0, uk2, v1), ruv(0, uk, v1), ruv(0, uk, v0)])
    # ears: an outer rim, a bowl and a lobe, lofted as rings around the ear's outline
    for sx in (1, -1):
        c0 = HC + Vector((0.0 * sx, 0.012, 0.004))
        # project onto the skull side
        sp = skull(sx * 1.0, 0.12, 0.04, kind)
        c0 = HC + Vector((sp.x, 0.012, 0.004))
        prof = [(1.0, 0.0), (0.92, 0.014), (0.6, 0.008)]
        NE = 7
        er = []
        for ri, (rs, out) in enumerate(prof):
            row = []
            for k in range(NE):
                a_ = 2 * math.pi * k / NE  # 0 = top, going backward
                ry_, rz_ = 0.019 * rs, 0.031 * rs
                lobe = 0.15 * g1(a_ - math.pi, 0.5) * rs  # the lobe hangs a bit lower and rounder
                y = math.sin(a_) * ry_ * (1 - 0.15 * g1(a_ - math.pi * 1.5, 0.6))
                zz = math.cos(a_) * rz_ * (1 + lobe)
                # tilt back ~12 degrees
                ty, tz = y * math.cos(0.21) + zz * math.sin(0.21), -y * math.sin(0.21) + zz * math.cos(0.21)
                p = c0 + Vector((sx * (out - 0.004), ty + 0.004, tz))
                row.append(B.vert(p, {'head': 1.0}))
            er.append(row)
        for ri in range(len(er) - 1):
            r0, r1 = er[ri], er[ri + 1]
            for k in range(NE):
                k2 = (k + 1) % NE
                q = [r0[k], r0[k2], r1[k2], r1[k]] if sx > 0 else [r0[k2], r0[k], r1[k], r1[k2]]
                B.face(q, [ruv(1, 0.1 + 0.3 * (k / NE), 0.6 + 0.3 * ri / 2)] * 4)
        last = er[-1]
        cc = sum((Vector(B.v[i]) for i in last), Vector()) / NE
        ci = B.vert(cc - Vector((sx * 0.002, 0, 0)), {'head': 1.0})
        for k in range(NE):
            k2 = (k + 1) % NE
            B.face([last[k], last[k2], ci] if sx > 0 else [last[k2], last[k], ci], [ruv(1, 0.25, 0.75)] * 3)

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


def make_rig():
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
    return rig


def build_people():
    reset()
    base = build('base')
    assign(base, mat('person', (0.8, 0.8, 0.8), 0.8))
    base.shape_key_add(name='Basis')
    for kind in ('heavy', 'slim', 'female', 'muscle'):
        o = build(kind)
        key = base.shape_key_add(name=kind)
        for i, v in enumerate(o.data.vertices):
            key.data[i].co = v.co
        bpy.data.objects.remove(o, do_unlink=True)
    base.name = 'body'
    base.data.name = 'body'
    rig = make_rig()
    base.parent = rig
    md = base.modifiers.new('rig', 'ARMATURE')
    md.object = rig
    return base, rig


body, rig = build_people()


# ---------------- hair, hats, beards, glasses ----------------
def grid_mesh(name, fn, region, seg=24, rings=14, phi0=0.0, phi1=math.pi, keep=None, warp=True):
    """Sphere-like grid; fn(phi, th) -> point. keep(phi, th) decides which quads exist."""
    vid, V, F, FU = {}, [], [], []
    ths = [head_theta(k * SEGH / seg) if warp else 2 * math.pi * k / seg for k in range(seg)]
    for j in range(rings + 1):
        phi = phi0 + (phi1 - phi0) * j / rings
        for k in range(seg):
            vid[(j, k)] = len(V)
            V.append(tuple(fn(phi, ths[k])))
    for j in range(rings):
        for k in range(seg):
            k2 = (k + 1) % seg
            pm = phi0 + (phi1 - phi0) * (j + 0.5) / rings
            tm = (ths[k] + (ths[k2] if k2 else 2 * math.pi)) / 2
            if keep and not keep(pm, tm):
                continue
            F.append([vid[(j, k2)], vid[(j + 1, k2)], vid[(j + 1, k)], vid[(j, k)]])  # outward
            u0, u1 = k / seg, (k + 1) / seg
            v0, v1 = 1 - j / rings, 1 - (j + 1) / rings
            FU.append([ruv(region, u1, v0), ruv(region, u1, v1), ruv(region, u0, v1), ruv(region, u0, v0)])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
    clean(o)
    return o


def clean(o):
    select_only([o])
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0003)
    bpy.ops.mesh.delete_loose()
    bpy.ops.object.mode_set(mode='OBJECT')


def hairline(th, front=0.62, nape=-0.55, burns=-0.12, above=0.4):
    """z (unit) of the hairline at angle th (0 back, pi front): forehead, temples, sideburns, round the ears, nape."""
    af = abs(((th - math.pi) + math.pi) % (2 * math.pi) - math.pi) * 180 / math.pi  # 0 at the face, 180 at the back
    pts = [(0, front), (22, front + 0.03), (45, min(front, 0.5)), (58, 0.32), (66, burns), (74, burns + 0.05), (79, above - 0.08), (92, above),
           (106, above - 0.05), (116, 0.1), (128, -0.3), (150, nape + 0.05), (180, nape)]
    for (a0, z0), (a1, z1) in zip(pts, pts[1:]):
        if a0 <= af <= a1:
            t = (af - a0) / (a1 - a0)
            t = t * t * (3 - 2 * t)
            return z0 + (z1 - z0) * t
    return nape


def hair_style(name, thick=0.012, front=0.62, nape=-0.55, burns=-0.12, puff=1.0, ridge=None, bumps=0.0, top=0.0,
               part=None, fringe=0.0, sweep=0.0, sides=1.0, crown=0.0, seg=18, rings=6, above=0.4, chunk=1.5):
    """A cap of hair over the skull whose edge follows the hairline exactly and thins out there.
    thick: depth at the sides; top: extra on top; sides: multiplier above the ears (fades); part: x of a side parting;
    fringe: brings the front edge down over the forehead; sweep: volume swept back off the forehead."""
    V, F, FU = [], [], []
    ths = [head_theta(k * SEGH / seg) for k in range(seg)]
    for j in range(rings + 1):
        for k in range(seg):
            th = ths[k]
            hl = hairline(th, front - fringe, nape, burns, above)
            if ridge is not None and abs(math.sin(th)) > ridge:
                hl = 0.985
            pmax = math.acos(max(-0.98, min(0.98, hl)))
            pmax = pmax + 0.06 if hl < 0.5 else pmax  # tuck the edge just under the line
            f = j / rings
            phi = pmax * f
            x, y, z = head_dir(phi, th)
            up = max(0.0, z)
            g = thick * (sides + (1 - sides) * sstep(0.2, 0.6, z))
            g += top * up ** 1.5
            g += (puff - 1) * 0.11 * (0.4 + 0.6 * up)
            g += crown * max(0, y) * up
            g += sweep * max(0, -y) * sstep(0.2, 0.6, z)
            if bumps:
                g += bumps * (0.5 + 0.5 * math.sin(phi * 23 + th * 3) * math.sin(th * 17))
            if ridge is not None:
                g += 0.05 * max(0, 1 - abs(x) / ridge) * up
            if part is not None and up > 0.3:
                g -= 0.005 * g1(x - part, 0.04) * max(0, -y + 0.3)
            edge = sstep(1.0, 0.75, f) if not fringe else sstep(1.0, 0.88, f)
            g = 0.002 + g * chunk * edge  # (chunky)
            p = head_point(phi, th, 'base', 0, features=False)
            n = Vector((x / HR[0], y / HR[1], z / HR[2])).normalized()
            p = p + n * g
            if fringe and -y > 0.3 and f > 0.7:
                p += Vector((0, -0.006, -0.004)) * sstep(0.7, 1.0, f) * sstep(0.3, 0.8, -y)  # bangs stand off the forehead
            V.append(tuple(p))
    for j in range(rings):
        for k in range(seg):
            k2 = (k + 1) % seg
            a_, b_, c_, d_ = j * seg + k, j * seg + k2, (j + 1) * seg + k2, (j + 1) * seg + k
            F.append([a_, b_, c_, d_][::-1])
            u0, u1 = k / seg, (k + 1) / seg
            v0, v1 = 1 - j / rings, 1 - (j + 1) / rings
            FU.append([ruv(5, u0, v1), ruv(5, u1, v1), ruv(5, u1, v0), ruv(5, u0, v0)][::-1][::-1])
    o = mesh_obj('hair_' + name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
    clean(o)
    # faces must point outward (the game culls back faces): check one near the crown and flip if needed
    o.data.update()
    pz = max(o.data.polygons, key=lambda p: p.center.z)
    if pz.normal.z < 0:
        select_only([o])
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.flip_normals()
        bpy.ops.object.mode_set(mode='OBJECT')
    return o


def curtain(name, z0, z1, flare=0.02, a0=0.7, thick=0.02, seg=10, rows=3, wave=0.0, ragged=0.015, tuck=0.0):
    """Hair hanging from the back and sides: th within a0*pi of the back. Ends are uneven (ragged)."""
    V, F, FU = [], [], []
    for j in range(rows + 1):
        t = j / rows
        for k in range(seg + 1):
            th = -a0 * math.pi + 2 * a0 * math.pi * k / seg  # around the back (0)
            x, y = math.sin(th), math.cos(th)
            zz = z0 + (z1 - z0) * t
            if t == 1:
                zz += ragged * math.sin(k * 2.7) + ragged * 0.6 * math.sin(k * 5.3)
                zz += (0.03 * (1 - abs(y))) if abs(th) > 0.6 * math.pi else 0  # front locks a little shorter
            # follow the skull at the top, then fall over the shoulders
            sk = skull(x, y, max(-1, min(1, (zz - HC.z) / HR[2])) if zz > HC.z - HR[2] else -0.3)
            r0 = math.hypot(sk.x, sk.y)
            g = thick + flare * t ** 1.2 + wave * math.sin(t * 9 + k * 0.8) * t
            r = max(r0, math.hypot(HR[0] * x, HR[1] * y) * (1 - 0.1 * t)) + g
            px, py = x * r * (HR[0] / max(HR[0], HR[1]) * 1.12 if abs(x) > 0 else 1), y * r
            px = x * (abs(sk.x) / max(1e-4, abs(x)) if abs(x) > 1e-3 else HR[0]) + x * g
            py = y * (abs(sk.y) / max(1e-4, abs(y)) if abs(y) > 1e-3 else HR[1]) + y * g
            if zz < HC.z - 0.05:  # below the ears: drape over the neck/shoulders
                fall = sstep(HC.z - 0.05, HC.z - 0.22, zz)
                px = x * (HR[0] * (1 + 0.25 * fall) + g)
                py = y * (HR[1] * (0.95 + 0.25 * fall) + g) + 0.02 * fall
                if tuck:
                    py -= tuck * fall
            V.append((HC.x + px, HC.y + py, zz))
    for j in range(rows):
        for k in range(seg):
            a, b = j * (seg + 1) + k, (j + 1) * (seg + 1) + k
            F.append([a, a + 1, b + 1, b])
            FU.append([ruv(5, k / seg, 1 - j / rows), ruv(5, (k + 1) / seg, 1 - j / rows), ruv(5, (k + 1) / seg, 1 - (j + 1) / rows), ruv(5, k / seg, 1 - (j + 1) / rows)])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.008
    apply_mods(o)
    return o


def tube_obj(name, pts, radii, region, seg=8, cap=True, uvx=(0.0, 1.0)):
    """A tube through pts (Vector list) with radii; UVs in `region`."""
    V, F, FU = [], [], []
    for i, (p, r) in enumerate(zip(pts, radii)):
        a = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        f, s = ring_frame(a)
        rx, ry = (r, r) if not isinstance(r, tuple) else r
        for k in range(seg):
            th = 2 * math.pi * k / seg
            V.append(tuple(p + s * math.sin(th) * rx + f * math.cos(th) * ry))
    n = len(pts)
    for i in range(n - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            F.append([i * seg + k, i * seg + k2, (i + 1) * seg + k2, (i + 1) * seg + k])
            u0, u1 = uvx[0] + (uvx[1] - uvx[0]) * k / seg, uvx[0] + (uvx[1] - uvx[0]) * (k + 1) / seg
            FU.append([ruv(region, u0, i / (n - 1)), ruv(region, u1, i / (n - 1)), ruv(region, u1, (i + 1) / (n - 1)), ruv(region, u0, (i + 1) / (n - 1))])
    if cap:
        for i, flip in ((0, True), (n - 1, False)):
            c = len(V)
            V.append(tuple(pts[i]))
            for k in range(seg):
                k2 = (k + 1) % seg
                F.append([i * seg + k2, i * seg + k, c] if flip else [i * seg + k, i * seg + k2, c])
                FU.append([ruv(region, (uvx[0] + uvx[1]) / 2, 0.5)] * 3)
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
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


def sphere_obj(name, loc, r, region, uv=(0.5, 0.5), seg=8, rings=5, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=tuple(loc))
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    uvl = o.data.uv_layers.get('UVMap')
    for l in uvl.data:
        l.uv = ruv(region, l.uv[0] if uv is None else uv[0], l.uv[1] if uv is None else uv[1])
    for p in o.data.polygons:
        p.use_smooth = True
    assign(o, mat('person', (0.8, 0.8, 0.8)))
    return o


def rehome(o, name):
    select_only([o])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.name = name
    o.data.name = name
    return o


def braid(name, pts, r, region=5, links=None):
    """A braid: a chain of squashed spheres along pts."""
    parts = []
    tot = sum((b - a).length for a, b in zip(pts, pts[1:]))
    n = links or max(4, int(tot / (r * 1.5)))
    for i in range(n):
        t = i / (n - 1) * tot
        acc = 0
        for a, b in zip(pts, pts[1:]):
            L = (b - a).length
            if acc + L >= t - 1e-6:
                p = a + (b - a) * ((t - acc) / L)
                break
            acc += L
        rr = r * (1 - 0.35 * i / n)
        parts.append(sphere_obj('bl', p, rr, region, uv=(0.3 + 0.4 * (i % 2), 0.5), seg=6, rings=4, scale=(1.1, 1.1, 1.4)))
    return join(parts, name)


def head_dome(name, scale, zcut, extra=0.0, region=6, seg=14, rings=7, shape=None):
    """A shell over the skull (hats). zcut(th) -> lowest z (unit) kept."""
    def keep(phi, th):
        x, y, z = head_dir(phi, th)
        return z > zcut(th)

    def fn(phi, th):
        x, y, z = head_dir(phi, th)
        p = skull(x, y, max(z, -0.3)) * scale
        if shape:
            p = shape(p, x, y, z)
        return HC + p + Vector((0, 0, extra))
    return grid_mesh(name, fn, region, seg=seg, rings=rings, keep=keep)


def brim(name, cx, cy, z, rx, ry, a0, a1, seg=8, thick=0.009, region=6, inner=0.35, droop=0.0, curl=0.0, v=0.1):
    """A flat (or drooping/curled) brim: ring between inner*r and r over angles a0..a1 (0 = back, pi = front)."""
    V, F = [], []
    for k in range(seg + 1):
        a = a0 + (a1 - a0) * k / seg
        s_, c_ = math.sin(a), math.cos(a)
        V.append((cx + s_ * rx * inner, cy + c_ * ry * inner, z))
        side = abs(s_)
        V.append((cx + s_ * rx, cy + c_ * ry, z - droop + curl * side ** 2))
    for k in range(seg):
        F.append([2 * k, 2 * k + 2, 2 * k + 3, 2 * k + 1])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for l in uvl.data:
        l.uv = ruv(region, 0.5, v)
    sol = o.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = thick
    apply_mods(o)
    return o


def build_head_things():
    out = []
    # --- hair (names in src/people/looks.js HAIRS) ---
    out.append(hair_style('short', 0.011, top=0.014, sides=0.7, bumps=0.002, sweep=0.006))
    out.append(hair_style('crew', 0.006, front=0.66, top=0.008, sides=0.55))
    out.append(hair_style('buzz', 0.0028, front=0.66, sides=1.0))
    out.append(hair_style('curly', 0.02, front=0.58, top=0.014, bumps=0.007))
    out.append(hair_style('afro', 0.03, front=0.55, puff=1.5, bumps=0.005, above=0.3))
    out.append(hair_style('mohawk', 0.003, ridge=0.22))
    o = hair_style('balding', 0.008, front=0.72, nape=-0.5, sides=1.0)
    select_only([o])  # drop the crown
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in o.data.polygons:
        c = o.data.vertices[p.vertices[0]].co
        if c.z > HC.z + 0.07:
            p.select = True
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.delete(type='FACE')
    bpy.ops.object.mode_set(mode='OBJECT')
    out.append(o)
    # long styles: scalp + curtain
    for nm, z1, fl, front, wave in (('long', 1.40, 0.03, 0.3, 0.0), ('bob', 1.575, 0.022, 0.3, 0.0), ('shoulder', 1.48, 0.025, 0.32, 0.0)):
        s = hair_style(nm, 0.014, front=0.6, burns=-0.3, top=0.012, part=0.25 if nm != 'bob' else None, fringe=0.2 if nm == 'bob' else 0.0, above=0.2)
        c = curtain('c', HC.z + 0.03, z1, fl, a0=0.62 if nm != 'bob' else 0.66, wave=wave)
        out.append(join([s, c], 'hair_' + nm))
    s = hair_style('pony', 0.011, front=0.6, top=0.006, sweep=0.008)
    tie = HC + Vector((0, 0.105, 0.035))
    t = tube_obj('pt', [tie, tie + Vector((0, 0.03, -0.02)), tie + Vector((0, 0.045, -0.1)), tie + Vector((0, 0.04, -0.2)), tie + Vector((0, 0.03, -0.27))],
                 [0.022, 0.03, 0.028, 0.02, 0.006], 5, seg=10)
    band = tube_obj('pb', [tie + Vector((0, -0.004, 0.004)), tie + Vector((0, 0.012, -0.004))], [0.02, 0.02], 6, seg=10)
    out.append(join([s, t, band], 'hair_pony'))
    s = hair_style('bunb', 0.011, front=0.6, top=0.006, sweep=0.008)
    b = sphere_obj('bun', HC + Vector((0, 0.07, 0.1)), 0.045, 5, uv=None, seg=8, rings=5, scale=(1.1, 1.0, 0.85))
    out.append(join([s, b], 'hair_bun'))
    s = hair_style('dreadb', 0.015, front=0.58, bumps=0.004)
    parts = [s]
    for i in range(9):
        a = -2.3 + i * 0.575
        top = HC + Vector((math.sin(a) * 0.08, math.cos(a) * 0.09 + 0.01, 0.025))
        ln = 0.2 + 0.06 * math.sin(i * 2.1)
        parts.append(tube_obj('d', [top, top + Vector((math.sin(a) * 0.035, math.cos(a) * 0.03, -ln * 0.5)), top + Vector((math.sin(a) * 0.045, math.cos(a) * 0.045, -ln))],
                              [0.017, 0.015, 0.011], 5, seg=4))
    out.append(join(parts, 'hair_dreads'))
    # new styles (appended to HAIRS): side part, slicked back, skin fade, pixie, long wavy, braids, man bun
    out.append(hair_style('sidepart', 0.011, front=0.6, top=0.018, part=0.32, sweep=0.012, sides=0.75))
    out.append(hair_style('slick', 0.009, front=0.62, top=0.008, sweep=0.016, crown=0.006, sides=0.9))
    out.append(hair_style('fade', 0.012, front=0.62, top=0.022, sides=0.12, bumps=0.002))
    out.append(hair_style('pixie', 0.013, front=0.6, top=0.016, fringe=0.2, part=0.2, burns=-0.2))
    s = hair_style('wavyb', 0.016, front=0.6, burns=-0.3, top=0.014, part=-0.22, above=0.2)
    c = curtain('c', HC.z + 0.03, 1.38, 0.05, a0=0.62, wave=0.008, ragged=0.02)
    out.append(join([s, c], 'hair_wavy'))
    s = hair_style('braidsb', 0.009, front=0.6, top=0.004)
    parts = [s]
    for sx in (1, -1):
        root_ = HC + Vector((0.07 * sx, 0.05, -0.02))
        parts.append(braid('br', [root_, root_ + Vector((0.025 * sx, 0.02, -0.08)), root_ + Vector((0.03 * sx, -0.0, -0.2)), root_ + Vector((0.035 * sx, -0.03, -0.3))], 0.016))
    out.append(join(parts, 'hair_braids'))
    s = hair_style('manbunb', 0.011, front=0.62, top=0.006, sweep=0.012, sides=0.8)
    b = sphere_obj('bun', HC + Vector((0, 0.095, 0.075)), 0.034, 5, uv=None, seg=8, rings=5, scale=(1.15, 1.0, 0.95))
    out.append(join([s, b], 'hair_manbun'))

    # --- beards: shells over the face surface itself ---
    def beard(name, keepf, grow, bumps=0.0, seg=26, rings=16):
        def keep(phi, th):
            u, v = head_u(th), 1 - phi / math.pi
            return keepf(u - 0.5, v)

        def fn(phi, th):
            g = grow + (bumps * math.sin(phi * 40) * math.sin(th * 30) if bumps else 0)
            return head_point(phi, th, 'base', g)
        return grid_mesh('beard_' + name, fn, 5, seg=seg, rings=rings, keep=keep)
    mouth = lambda du, v: abs(du) < 0.07 and 0.345 < v < 0.395  # leave the mouth clear
    out.append(beard('full', lambda du, v: abs(du) < 0.36 and 0.18 < v < (0.5 if abs(du) > 0.2 else 0.42 if abs(du) > 0.09 else 0.415) and not mouth(du, v) and not (abs(du) < 0.03 and v > 0.405), 0.007, 0.0015))
    out.append(beard('goatee', lambda du, v: abs(du) < 0.075 and 0.2 < v < 0.415 and not mouth(du, v) and not (abs(du) < 0.025 and v > 0.402), 0.006))
    out.append(beard('mustache', lambda du, v: abs(du) < 0.075 - (0.4 - v) * 0.5 and 0.375 < v < 0.418 and not (abs(du) < 0.012 and v > 0.405), 0.005))
    out.append(beard('chinstrap', lambda du, v: (0.2 < v < 0.36 and abs(du) < 0.34 and (abs(du) > 0.22 or v < 0.3)) or (abs(du) > 0.25 and abs(du) < 0.33 and v < 0.52), 0.004))
    out.append(beard('boxed', lambda du, v: abs(du) < 0.3 and 0.22 < v < (0.47 if abs(du) > 0.2 else 0.415) and not mouth(du, v) and not (abs(du) < 0.03 and v > 0.405), 0.0045, 0.001))

    # --- hats ---
    crown = head_dome('c', 1.1, lambda th: 0.16 if math.cos(th) < 0 else 0.0, 0.004,
                      shape=lambda p, x, y, z: p + Vector((0, -0.006 * max(0, -y), 0.01 * max(0, z) ** 2)))
    peak = brim('b', 0, -0.07, HC.z + 0.032, 0.088, 0.17, math.pi * 0.66, math.pi * 1.34, droop=0.012, curl=0.018, inner=0.55)
    button = sphere_obj('bt', HC + Vector((0, 0.005, HR[2] * 1.1 + 0.012)), 0.007, 6, seg=8, rings=4)
    out.append(join([crown, peak, button], 'hat_cap'))
    crown = head_dome('c', 1.13, lambda th: 0.08 if math.cos(th) < 0 else -0.08, 0.01,
                      shape=lambda p, x, y, z: p * (1 + 0.03 * sstep(0.0, 0.3, z) * 0))
    cuff = tube_obj('cf', [HC + Vector((0, 0.012, 0.0)), HC + Vector((0, 0.013, 0.035))], [(0.1, 0.117), (0.1, 0.117)], 6, seg=12, cap=False, uvx=(0.0, 1.0))
    out.append(join([crown, cuff], 'hat_beanie'))
    band = tube_obj('b', [HC + Vector((0, 0.0, 0.03)), HC + Vector((0, 0.005, 0.09)), HC + Vector((0, 0.012, 0.135))], [(0.09, 0.106), (0.096, 0.112), (0.112, 0.128)], 6, seg=12)
    peak = brim('p', 0, -0.06, HC.z + 0.042, 0.088, 0.122, math.pi * 0.64, math.pi * 1.36, thick=0.006, droop=0.012, inner=0.6, v=0.05)
    out.append(join([band, peak], 'hat_police'))
    crown = head_dome('c', 1.22, lambda th: 0.06, 0.015, shape=lambda p, x, y, z: p + Vector((0, 0, 0.012 * g1(x, 0.25) * max(0, z))))
    rim = brim('r', 0, 0.0, HC.z + 0.032, 0.125, 0.155, 0, 2 * math.pi, seg=14, thick=0.008, inner=0.7)
    out.append(join([crown, rim], 'hat_hard'))
    crown = head_dome('c', 1.25, lambda th: 0.0, 0.02)
    rim = brim('r', 0, 0.035, HC.z + 0.012, 0.15, 0.2, 0, 2 * math.pi, seg=14, thick=0.008, inner=0.6, droop=0.02)
    shield = box_obj('sh', (0.06, 0.008, 0.07), HC + Vector((0, -HR[1] * 1.25 - 0.004, 0.09)), 7, (0.75, 0.75), bevel=0.004)
    out.append(join([crown, rim, shield], 'hat_fire'))
    crown = head_dome('c', 1.2, lambda th: -0.15 if math.cos(th) > 0 else 0.16, 0.01)
    strap = tube_obj('st', [HC + Vector((-0.083, -0.01, -0.02)), HC + Vector((-0.06, -0.03, -0.11)), HC + Vector((0, -0.04, -0.135)), HC + Vector((0.06, -0.03, -0.11)), HC + Vector((0.083, -0.01, -0.02))], [0.004] * 5, 7, seg=4, cap=False, uvx=(0.5, 0.9))
    out.append(join([crown, strap], 'hat_swat'))
    # new hats: trucker (mesh-back seed cap), cowboy, bucket
    crown = head_dome('c', 1.12, lambda th: 0.16 if math.cos(th) < 0 else 0.0, 0.006,
                      shape=lambda p, x, y, z: p + Vector((0, -0.012 * max(0, -y) * max(0, z), 0.022 * max(0, z) ** 2 * max(0, -y + 0.3))))
    peak = brim('b', 0, -0.07, HC.z + 0.034, 0.09, 0.172, math.pi * 0.66, math.pi * 1.34, droop=0.004, curl=0.012, inner=0.55)
    out.append(join([crown, peak], 'hat_trucker'))
    crown = head_dome('c', 1.2, lambda th: 0.05, 0.03,
                      shape=lambda p, x, y, z: Vector((p.x * (1 - 0.1 * max(0, z)), p.y * (1 - 0.05 * max(0, z)), p.z + 0.028 * max(0, z) - 0.016 * g1(x, 0.3) * max(0, z - 0.6) * 3)))
    rim = brim('r', 0, 0.01, HC.z + 0.036, 0.19, 0.205, 0, 2 * math.pi, seg=16, thick=0.006, inner=0.45, curl=0.045, droop=0.004)
    out.append(join([crown, rim], 'hat_cowboy'))
    crown = head_dome('c', 1.16, lambda th: 0.0, 0.02, shape=lambda p, x, y, z: Vector((p.x, p.y, min(p.z, HR[2] * 0.95))))
    rim = brim('r', 0, 0.012, HC.z + 0.034, 0.13, 0.15, 0, 2 * math.pi, seg=14, thick=0.005, inner=0.68, droop=0.025)
    out.append(join([crown, rim], 'hat_bucket'))

    # --- glasses (fixed colours: region 7), sitting on the bridge of the nose ---
    ey = HC.y + head_point(math.pi * 0.46, math.pi, 'base').y - HC.y - 0.012
    for nm, lens, frame in (('shades', (0.25, 0.75), 0.006), ('clear', (0.25, 0.25), 0.004)):
        parts = []
        for sx in (1, -1):
            parts.append(box_obj('l', (0.044, 0.003, 0.03), (0.032 * sx, ey, HC.z + 0.016), 7, lens, bevel=0.008))
            parts.append(tube_obj('rim', [Vector((0.032 * sx + 0.024 * math.cos(a), ey - 0.001, HC.z + 0.016 + 0.017 * math.sin(a))) for a in [i * 2 * math.pi / 12 for i in range(13)]],
                                  [frame / 2] * 13, 7, seg=4, cap=False, uvx=(0.5, 0.9) if nm == 'clear' else (0.05, 0.45)))
            parts.append(box_obj('t', (0.004, 0.105, 0.005), (0.078 * sx, ey + 0.052, HC.z + 0.024), 7, (0.75, 0.75) if nm == 'clear' else (0.25, 0.75)))
        parts.append(box_obj('br', (0.018, 0.004, 0.004), (0, ey - 0.003, HC.z + 0.022), 7, (0.75, 0.75)))
        out.append(join(parts, 'glasses_' + nm))
    return out


def build_props():
    # carried things (rigid on a bone; origin at the attach point)
    out = []
    bp = box_obj('b', (0.29, 0.15, 0.4), (0, 0, 0), 6, (0.3, 0.5), bevel=0.035)
    pk = box_obj('p', (0.22, 0.05, 0.16), (0, -0.09, -0.09), 6, (0.6, 0.5), bevel=0.02)
    out.append(join([bp, pk], 'acc_backpack'))
    bag = box_obj('b', (0.08, 0.26, 0.24), (0, 0, -0.16), 6, (0.6, 0.5), bevel=0.02)
    strap = box_obj('s', (0.01, 0.02, 0.2), (0, 0, -0.02), 6, (0.6, 0.9))
    out.append(join([bag, strap], 'acc_bag'))
    out.append(box_obj('acc_mailbag', (0.12, 0.34, 0.26), (0, 0, 0), 6, (0.6, 0.5), bevel=0.02))
    body_ = box_obj('g1', (0.34, 0.08, 0.42), (0, 0, -0.1), 6, (0.8, 0.3), bevel=0.04)
    neck_ = box_obj('g2', (0.05, 0.03, 0.5), (0, 0, 0.36), 7, (0.75, 0.25))
    out.append(join([body_, neck_], 'acc_guitar'))
    out.append(tube_obj('acc_cane', [Vector((0, 0, 0)), Vector((0, 0, -0.85))], [0.012, 0.012], 7, seg=6))
    out.append(box_obj('acc_phone', (0.036, 0.008, 0.074), (0, 0, 0), 7, (0.25, 0.25), bevel=0.004))
    out.append(tube_obj('acc_cig', [Vector((0, 0, 0)), Vector((0, -0.07, 0))], [0.0045, 0.0045], 7, seg=5))
    out.append(tube_obj('acc_coffee', [Vector((0, 0, -0.05)), Vector((0, 0, 0.06))], [0.03, 0.038], 6, seg=10))
    sign = box_obj('s1', (0.5, 0.012, 0.36), (0, 0, 0.75), 7, (0.25, 0.75))
    pole = box_obj('s2', (0.02, 0.02, 0.9), (0, 0.01, 0.2), 7, (0.75, 0.25))
    out.append(join([sign, pole], 'acc_sign'))
    # new: things for the interactive animations
    out.append(tube_obj('acc_cue', [Vector((0, 0, 0.45)), Vector((0, 0, -0.95))], [0.006, 0.014], 7, seg=6, uvx=(0.55, 0.95)))  # pool cue (wood)
    out.append(tube_obj('acc_dart', [Vector((0, 0, 0.0)), Vector((0, -0.1, 0))], [0.004, 0.002], 7, seg=5, uvx=(0.55, 0.95)))
    cash = box_obj('acc_cash', (0.075, 0.012, 0.035), (0, 0, 0), 7, (0.25, 0.25), bevel=0.002)
    out.append(cash)
    sack = sphere_obj('s', (0, 0, -0.14), 0.13, 6, uv=(0.4, 0.5), seg=10, rings=7, scale=(1.0, 0.8, 1.15))
    neckt = tube_obj('n', [Vector((0, 0, -0.02)), Vector((0, 0, 0.02))], [0.025, 0.02], 6, seg=8)
    out.append(join([sack, neckt], 'acc_moneybag'))
    out.append(box_obj('acc_cards', (0.06, 0.004, 0.088), (0, 0, 0), 7, (0.25, 0.75), bevel=0.003))
    out.append(tube_obj('acc_beer', [Vector((0, 0, -0.07)), Vector((0, 0, 0.05)), Vector((0, 0, 0.09)), Vector((0, 0, 0.12))], [0.03, 0.03, 0.012, 0.011], 7, seg=8, uvx=(0.55, 0.95)))
    return out


# ---------------- clothing overlays: skinned to the body's bones ----------------
def skinned(o, wfn):
    """Give mesh o vertex groups from wfn(co) -> {bone: weight}."""
    groups = {}
    for v in o.data.vertices:
        w = wfn(v.co)
        tot = sum(w.values()) or 1
        for bn, ww in w.items():
            g = groups.get(bn) or o.vertex_groups.new(name=bn)
            groups[bn] = g
            g.add([v.index], ww / tot, 'REPLACE')
    o.parent = rig
    md = o.modifiers.new('rig', 'ARMATURE')
    md.object = rig
    return o


def torso_w(co):
    z = co.z
    if z < 1.13:
        w = blend('hips', 'spine', (z - 0.98) / 0.12)
    else:
        w = blend('spine', 'chest', (z - 1.16) / 0.12)
    if z > 1.455:
        w = blend('chest', 'neck', (z - 1.455) / 0.04)
    return w


def leg_w(co):
    s = 'L' if co.x > 0 else 'R'
    z = co.z
    t = (0.92 - z) / 0.42  # 0 at the hip joint, 1 at the knee
    side = sstep(0.0, 0.07, abs(co.x))  # the middle follows the hips
    w = blend('hips', 'thigh.' + s, (t + 0.1) / 0.5)
    return mix_w({'hips': 1.0}, w, side)


def section(kind, z, grow):
    """Torso cross-section at z (for overlays): list of points around (th = 0 back)."""
    w, df, db = torso_at(kind, z)
    pts = []
    for k in range(NT):
        th = 2 * math.pi * k / NT
        sx, cy = math.sin(th), math.cos(th)
        px = math.copysign(abs(sx) ** 0.8, sx) * (w + grow)
        dd = (db if cy > 0 else df) + grow
        py = math.copysign(abs(cy) ** 0.8, cy) * dd
        pts.append(Vector((px, py, z)))
    return pts


def loft(name, rows, region, uvfn, closed=True):
    """rows: list of point lists (same length); faces outward when rows go top->bottom with th increasing."""
    V, F, FU = [], [], []
    n = len(rows[0])
    for r in rows:
        V += [tuple(p) for p in r]
    m = n if closed else n - 1
    for j in range(len(rows) - 1):
        for k in range(m):
            k2 = (k + 1) % n
            a, b, c, d = j * n + k, j * n + k2, (j + 1) * n + k2, (j + 1) * n + k
            F.append([a, d, c, b])
            FU.append([uvfn(k / n, j / (len(rows) - 1)), uvfn(k / n, (j + 1) / (len(rows) - 1)), uvfn((k + 1) / n, (j + 1) / (len(rows) - 1)), uvfn((k + 1) / n, j / (len(rows) - 1))])
    o = mesh_obj(name, V, F, mat('person', (0.8, 0.8, 0.8)), smooth=True)
    uvl = o.data.uv_layers.new(name='UVMap')
    for poly, uvs in zip(o.data.polygons, FU):
        for li, uv in zip(poly.loop_indices, uvs):
            uvl.data[li].uv = uv
    return o


def build_overlays():
    out = []
    # skirt: a flared tube from the waist to above the knee (bottom colour)
    rows = []
    for i, z in enumerate((0.99, 0.93, 0.86, 0.78, 0.70, 0.62)):
        t = i / 5
        base = section('female', max(0.86, z), 0.012)
        flare = 1 + 0.12 * t + (0.0 if z >= 0.86 else 0.0)
        row = []
        for p in base:
            q = Vector((p.x * flare * (1.0 + 0.1 * t), p.y * flare + 0.004 * t, z))
            if z < 0.86:  # below the hips: wrap round both legs
                q.x = math.copysign(max(abs(q.x), 0.17 + 0.03 * t), q.x) if abs(q.x) > 0.02 else q.x
            row.append(q)
        rows.append(row)
    sk = loft('skirt', rows, 3, lambda u, v: ruv(3, u, 0.8 + 0.18 * (1 - v)))
    sol = sk.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.005
    apply_mods(sk)
    skinned(sk, lambda co: mix_w({'hips': 1.0}, leg_w(co), sstep(0.9, 0.7, co.z) * 0.7))
    sk.name = sk.data.name = 'top_skirt'
    out.append(sk)
    # hood: a bunched-up hood behind the neck (top colour)
    rows = []
    for i, z in enumerate((1.56, 1.52, 1.48, 1.44, 1.41)):
        t = i / 4
        row = []
        for k in range(17):
            a = -0.62 * math.pi + 1.24 * math.pi * k / 16  # around the back
            r = 0.085 + 0.03 * math.sin(t * math.pi) + 0.01 * (1 - t)
            row.append(Vector((math.sin(a) * r * 1.25, 0.03 + math.cos(a) * r * 0.9 + 0.02 * math.sin(t * math.pi), z - 0.015 * abs(math.sin(a)))))
        rows.append(row)
    hd = loft('hood', rows, 2, lambda u, v: ruv(2, 0.27 + 0.06 * u, 0.98), closed=False)
    sol = hd.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.012
    apply_mods(hd)
    skinned(hd, lambda co: blend('chest', 'neck', (co.z - 1.47) / 0.08))
    hd.name = hd.data.name = 'top_hood'
    out.append(hd)
    # collar: a stand-up coat / puffer collar round the neck
    rows = []
    for i, z in enumerate((1.53, 1.49, 1.455)):
        row = []
        for k in range(20):
            a = 2 * math.pi * k / 20
            gap = g1(a - math.pi, 0.25)  # open at the front
            r = 0.07 + 0.012 * i
            row.append(Vector((math.sin(a) * r * 1.15, 0.01 + math.cos(a) * r * (1 - 0.2 * gap), z - 0.03 * gap)))
        rows.append(row)
    cl = loft('collar', rows, 2, lambda u, v: ruv(2, 0.6 * u, 0.98))
    sol = cl.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = 0.008
    apply_mods(cl)
    skinned(cl, lambda co: blend('chest', 'neck', (co.z - 1.47) / 0.06))
    cl.name = cl.data.name = 'top_collar'
    out.append(cl)
    # tactical vest (SWAT / armour): a thick shell over the chest with pouches (fixed dark colours via the top cell)
    rows = []
    for z in (1.44, 1.39, 1.32, 1.24, 1.16, 1.08, 1.02):
        rows.append([Vector((p.x, p.y, z)) for p in section('muscle', z, 0.026)])
    vs = loft('vest', rows, 2, lambda u, v: ruv(2, 0.6 * u, 0.94 - 0.85 * v))
    pouches = []
    for i, u in enumerate((-0.07, 0.0, 0.07)):
        pouches.append(box_obj('pu', (0.055, 0.03, 0.07), (u, -0.135, 1.13), 2, (0.3, 0.2), bevel=0.008))
    vs = join([vs] + pouches, 'vest')
    skinned(vs, torso_w)
    vs.name = vs.data.name = 'top_vest'
    out.append(vs)
    # duty belt: holster, radio, cuffs (police)
    rows = []
    for z in (0.995, 0.955):
        rows.append([Vector((p.x, p.y, z)) for p in section('base', z, 0.016)])
    bl = loft('belt', rows, 7, lambda u, v: ruv(7, 0.1 + 0.3 * u, 0.6 + 0.3 * v))
    hol = box_obj('h', (0.045, 0.06, 0.16), (-0.185, 0.01, 0.92), 7, (0.25, 0.75), bevel=0.01)
    rad = box_obj('r', (0.04, 0.035, 0.08), (0.17, -0.06, 0.95), 7, (0.25, 0.75), bevel=0.006)
    cuf = box_obj('c', (0.06, 0.03, 0.04), (0.08, 0.13, 0.965), 7, (0.75, 0.75), bevel=0.006)
    bl = join([bl, hol, rad, cuf], 'belt')
    skinned(bl, lambda co: {'hips': 1.0})
    bl.name = bl.data.name = 'bot_dutybelt'
    out.append(bl)
    return out


heads = build_head_things()
props = build_props()
overlays = build_overlays()
accs = heads + props
result = {'accs': len(accs), 'tris': sum(tris(a) for a in accs)}

if os.environ.get('TAT_PREVIEW'):
    pv = os.environ.get('TAT_PREVIEW_DIR', '/tmp/')
    for o in accs + overlays:
        o.hide_render = True
    preview(pv + 'body_front.png', target=(0, 0, 0.95), dist=3.2, yaw=0, pitch=5, size=(600, 900), lens=50)
    preview(pv + 'body_34.png', target=(0, 0, 0.95), dist=3.2, yaw=35, pitch=5, size=(600, 900), lens=50)
    preview(pv + 'body_back.png', target=(0, 0, 0.95), dist=3.2, yaw=180, pitch=5, size=(600, 900), lens=50)
    preview(pv + 'head_front.png', target=(0, 0, 1.64), dist=0.75, yaw=0, pitch=3, size=(600, 600), lens=50)
    preview(pv + 'head_34.png', target=(0, 0, 1.64), dist=0.75, yaw=40, pitch=3, size=(600, 600), lens=50)
    preview(pv + 'head_side.png', target=(0, 0, 1.64), dist=0.75, yaw=90, pitch=3, size=(600, 600), lens=50)
    preview(pv + 'hand.png', target=(0.58, -0.02, 0.96), dist=0.45, yaw=60, pitch=5, size=(600, 600), lens=50)
    preview(pv + 'feet.png', target=(0, -0.05, 0.08), dist=0.9, yaw=30, pitch=15, size=(600, 400), lens=50)
    for kind in ('heavy', 'slim', 'female', 'muscle'):
        body.data.shape_keys.key_blocks[kind].value = 1
        preview(pv + 'body_' + kind + '.png', target=(0, 0, 0.95), dist=3.2, yaw=25, pitch=5, size=(600, 900), lens=50)
        preview(pv + 'head_' + kind + '.png', target=(0, 0, 1.64), dist=0.75, yaw=30, pitch=3, size=(600, 600), lens=50)
        body.data.shape_keys.key_blocks[kind].value = 0

kb = export_glb('people', [rig, body] + accs + overlays)
result = {'kb': kb, 'body_tris': tris(body), 'acc_tris': sum(tris(a) for a in accs), 'overlay_tris': sum(tris(a) for a in overlays), 'n': len(accs) + len(overlays)}
print('PEOPLE', result)
