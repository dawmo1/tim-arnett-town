# Cars: a parametric vehicle builder (assets/models/cars.glb). Every road vehicle is lofted from
# cross-sections along its length at real-world dimensions (wheelbase, overhangs, track, roof and
# belt heights, ground clearance for the class it parodies): a lower body with a shoulder crease,
# tumblehome, rocker and wheel arches, then a glasshouse with pillars, frames and inset glass. Lamps,
# grilles, plates, handles, mirrors and trim are projected onto that surface by ray casts, so they sit
# flush on the curved panels. Each vehicle is built twice, at high and low detail (LODs).
#
# Output contract (read by src/carmodel.js, carmods.js, vehicles.js, carlights.js, occupants.js):
#   root empty  car_<key>
#     parts     <key>__body, cabin, doorL, doorR, doorL2, doorR2, hood, trunk, bumpF, bumpR, details,
#               interior, cargo, rotor, tailrotor: empties at their hinge / pivot, each holding
#               <key>__<part>_hi and (usually) <key>__<part>_lo meshes; the game shows one or the other
#     empties   w_FL w_FR w_RL w_RR (wheel centres; bikes w_F w_R), seat_D seat_P seat_RL seat_RR (top
#               centre of each seat cushion), lamp_head_L/R, lamp_tail_L/R (lamp centres)
#   wheel       one shared wheel (radius 0.33): wheel_hi, wheel_lo and caliper_hi (does not spin)
# Blender axes: Z up, the car faces -Y, its left side is +X. Lengths in metres.
# Material names the game recognises: paint, paint2 (second colour), glass, trim, chrome, lamp_head,
# lamp_tail, interior, tire, rim, plate, decal. Others (lamp_amber, lamp_rev, disc, caliper) keep the
# colours from this file.
import math, os
exec(open(os.environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/tat.py').read(), globals())
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

MAT = {}


def make_mats():
    MAT.update({
        'paint': mat('paint', (0.6, 0.6, 0.62), 0.3, 0.4),
        'paint2': mat('paint2', (0.95, 0.95, 0.95), 0.3, 0.4),
        'glass': mat('glass', (0.08, 0.1, 0.12), 0.05, 0.2),
        'trim': mat('trim', (0.035, 0.035, 0.04), 0.6),
        'chrome': mat('chrome', (0.8, 0.8, 0.82), 0.15, 1.0),
        'lamp_head': mat('lamp_head', (0.9, 0.9, 0.85), 0.1),
        'lamp_tail': mat('lamp_tail', (0.6, 0.02, 0.02), 0.2),
        'lamp_amber': mat('lamp_amber', (0.85, 0.38, 0.03), 0.2),
        'lamp_rev': mat('lamp_rev', (0.82, 0.82, 0.84), 0.15, 0.3),
        'interior': mat('interior', (0.12, 0.11, 0.1), 0.85),
        'tire': mat('tire', (0.03, 0.03, 0.03), 0.9),
        'rim': mat('rim', (0.55, 0.56, 0.58), 0.3, 0.9),
        'disc': mat('disc', (0.33, 0.33, 0.34), 0.45, 0.9),
        'caliper': mat('caliper', (0.16, 0.16, 0.17), 0.5, 0.3),
        'plate': mat('plate', (0.95, 0.95, 0.95), 0.5),
        'decal': mat('decal', (1, 1, 1), 0.4),
    })


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, a, b):
    return a if v < a else b if v > b else v


def curve(keys, t):
    """smooth interpolation through (t, value) keys"""
    if not isinstance(keys, (list, tuple)):
        return keys
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0
            u = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * u
    return keys[-1][1]


# ---------------------------------------------------------------- mesh accumulator
class Mesh:
    """Collects verts and faces, each face tagged with a material and a part name."""
    def __init__(s):
        s.v, s.f, s.m, s.p, s.uv = [], [], [], [], []

    def vert(s, p):
        s.v.append((p[0], p[1], p[2]))
        return len(s.v) - 1

    def face(s, idx, m, part, uv=None):
        if len(set(idx)) < 3:
            return
        s.f.append(list(idx))
        s.m.append(m)
        s.p.append(part)
        s.uv.append(uv)

    def quad(s, a, b, c, d, m, part, uv=None):
        s.face([a, b, c, d], m, part, uv)

    def parts(s):
        return sorted(set(s.p))

    def build(s, name, part, pivot=(0, 0, 0), sharp=32):
        fi = [i for i, p in enumerate(s.p) if p == part]
        if not fi:
            return None
        remap, V, F, Mi, UV = {}, [], [], [], []
        px, py, pz = pivot
        for i in fi:
            nf = []
            for vi in s.f[i]:
                if vi not in remap:
                    remap[vi] = len(V)
                    x, y, z = s.v[vi]
                    V.append((x - px, y - py, z - pz))
                nf.append(remap[vi])
            F.append(nf)
            Mi.append(s.m[i])
            UV.append(s.uv[i])
        me = bpy.data.meshes.new('m_' + name)
        me.from_pydata(V, [], F)
        me.update()
        o = bpy.data.objects.new(name, me)
        link(o)
        used = sorted(set(Mi))
        for mn in used:
            me.materials.append(MAT[mn])
        for poly, mn in zip(me.polygons, Mi):
            poly.material_index = used.index(mn)
        if any(u is not None for u in UV):
            uvl = me.uv_layers.new(name='UVMap')
            for poly, u in zip(me.polygons, UV):
                for k, li in enumerate(poly.loop_indices):
                    uvl.data[li].uv = u[k] if u else (0.98, 0.02)
        me.shade_smooth()
        try:
            me.set_sharp_from_angle(angle=math.radians(sharp))
        except Exception:
            pass
        return o


# ---------------------------------------------------------------- small primitives
def frame_from(n, up=(0, 0, 1)):
    """3x3 basis (right, up, normal) with `normal` along n"""
    n = Vector(n).normalized()
    u = Vector(up)
    if abs(n.dot(u)) > 0.95:
        u = Vector((0, 1, 0)) if abs(n.y) < 0.95 else Vector((1, 0, 0))
    r = u.cross(n).normalized()
    u = n.cross(r).normalized()
    return r, u, n


def xf(p, c, R):
    """local point p (x right, y up, z normal) -> world via centre c and basis R=(r,u,n)"""
    r, u, n = (Vector(v) for v in R)
    return Vector(c) + r * p[0] + u * p[1] + n * p[2]


def rbox(M, c, size, R, m, part, seg=(6, 4), e=0.35, front_m=None):
    """rounded box (superellipsoid): size = (sx, sy, sz) along (r, u, n). front_m paints the +n face."""
    nu, nv = seg[0] * 2, seg[1] * 2
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    sgn = lambda a: (1 if a >= 0 else -1)
    pw = lambda a, k: sgn(a) * abs(a) ** k
    ring = []
    for j in range(nv + 1):
        v = -math.pi / 2 + math.pi * j / nv
        row = []
        for i in range(nu):
            u = -math.pi + 2 * math.pi * i / nu
            x = pw(math.cos(v), e) * pw(math.cos(u), e) * sx
            z = pw(math.cos(v), e) * pw(math.sin(u), e) * sz
            y = pw(math.sin(v), e) * sy
            row.append(M.vert(xf((x, y, z), c, R)))
        ring.append(row)
    for j in range(nv):
        for i in range(nu):
            i2 = (i + 1) % nu
            mm = m
            if front_m:
                um = -math.pi + 2 * math.pi * (i + 0.5) / nu
                vm = -math.pi / 2 + math.pi * (j + 0.5) / nv
                if math.sin(um) > 0.75 and abs(math.sin(vm)) < 0.7:
                    mm = front_m
            M.quad(ring[j][i], ring[j + 1][i], ring[j + 1][i2], ring[j][i2], mm, part)


def box(M, c, size, R, m, part, mats=None):
    """plain box; mats optional dict face->material for '+n' '-n' '+r' '-r' '+u' '-u'"""
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    P = [M.vert(xf((x * sx, y * sy, z * sz), c, R)) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    idx = lambda x, y, z: P[(x > 0) * 4 + (y > 0) * 2 + (z > 0)]
    faces = {'+r': [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)], '-r': [(-1, -1, 1), (-1, 1, 1), (-1, 1, -1), (-1, -1, -1)],
             '+u': [(-1, 1, -1), (-1, 1, 1), (1, 1, 1), (1, 1, -1)], '-u': [(1, -1, -1), (1, -1, 1), (-1, -1, 1), (-1, -1, -1)],
             '+n': [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)], '-n': [(-1, 1, -1), (1, 1, -1), (1, -1, -1), (-1, -1, -1)]}
    for k, f in faces.items():
        mm = (mats or {}).get(k, m)
        if mm is None:
            continue
        M.face([idx(*p) for p in f], mm, part)


def cyl(M, p0, p1, r, n, m, part, caps=True, r1=None, cap_m=None):
    p0, p1 = Vector(p0), Vector(p1)
    ax = (p1 - p0)
    R = frame_from(ax)
    r1 = r if r1 is None else r1
    a = [M.vert(p0 + R[0] * math.cos(2 * math.pi * i / n) * r + R[1] * math.sin(2 * math.pi * i / n) * r) for i in range(n)]
    b = [M.vert(p1 + R[0] * math.cos(2 * math.pi * i / n) * r1 + R[1] * math.sin(2 * math.pi * i / n) * r1) for i in range(n)]
    for i in range(n):
        j = (i + 1) % n
        M.quad(a[i], a[j], b[j], b[i], m, part)
    if caps:
        M.face(list(reversed(a)), cap_m or m, part)
        M.face(b, cap_m or m, part)


def tube(M, pts, r, n, m, part, closed=False):
    """sweep a circle of radius r along pts"""
    rings = []
    N = len(pts)
    for i, p in enumerate(pts):
        p = Vector(p)
        a = Vector(pts[(i + 1) % N] if closed or i + 1 < N else pts[i]) - Vector(pts[i - 1] if closed or i > 0 else pts[i])
        R = frame_from(a)
        rings.append([M.vert(p + R[0] * math.cos(2 * math.pi * k / n) * r + R[1] * math.sin(2 * math.pi * k / n) * r) for k in range(n)])
    for i in range(N if closed else N - 1):
        A, B = rings[i], rings[(i + 1) % N]
        for k in range(n):
            k2 = (k + 1) % n
            M.quad(A[k], A[k2], B[k2], B[k], m, part)


def lathe(M, prof, n, m, part, c=(0, 0, 0), mats=None, phase=0.0):
    """revolve (x, r) profile points about the X axis through c. mats: per-segment material list"""
    rings = []
    for x, r in prof:
        rings.append([M.vert((c[0] + x, c[1] + math.cos(phase + 2 * math.pi * k / n) * r, c[2] + math.sin(phase + 2 * math.pi * k / n) * r)) for k in range(n)])
    for i in range(len(prof) - 1):
        mm = mats[i] if mats else m
        if mm is None:
            continue
        A, B = rings[i], rings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            M.quad(A[k], A[k2], B[k2], B[k], mm, part)
    return rings


def disk(M, ring, center, m, part, flip=False):
    c = M.vert(center)
    n = len(ring)
    for k in range(n):
        k2 = (k + 1) % n
        M.face([ring[k2], ring[k], c] if flip else [ring[k], ring[k2], c], m, part)


# ---------------------------------------------------------------- ray-cast projection onto the body
class Surf:
    def __init__(s, M, parts=None):
        idx = [i for i in range(len(M.f)) if parts is None or M.p[i] in parts]
        verts = [Vector(v) for v in M.v]
        polys = [M.f[i] for i in idx]
        s.bvh = BVHTree.FromPolygons(verts, polys, all_triangles=False)

    def hit(s, o, d, dist=6.0):
        d = Vector(d).normalized()
        loc, nrm, _, _ = s.bvh.ray_cast(Vector(o) - d * 1.5, d, dist)
        if loc is None:
            return None
        if nrm.dot(d) > 0:
            nrm = -nrm
        return loc, nrm


def patch(M, S, corners, d, nu, nv, off, m, part, wall=0.0, uvbox=None, flipu=False, graze=0.2):
    """A lens / panel conforming to the body: grid over the quad `corners` (c00, c10, c11, c01), ray-cast
    along d onto the surface, lifted `off` along the surface normal. `wall` adds side walls down into
    the body so the patch reads as a solid piece. Returns the centre hit (for lamp empties)."""
    c00, c10, c11, c01 = [Vector(c) for c in corners]
    G = {}
    for i in range(nu + 1):
        for j in range(nv + 1):
            u, v = i / nu, j / nv
            p = c00.lerp(c10, u).lerp(c01.lerp(c11, u), v)
            h = S.hit(p, d)
            if h and -h[1].dot(Vector(d).normalized()) > graze:
                G[i, j] = (h[0] + h[1] * off, h[0] - h[1] * 0.006, h[1], u, v)
    if not G:
        return None
    vid = {k: M.vert(g[0]) for k, g in G.items()}
    cells = []
    for i in range(nu):
        for j in range(nv):
            ks = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            if all(k in G for k in ks):
                cells.append((i, j))
                f = [vid[k] for k in ks]
                nrm = sum((G[k][2] for k in ks), Vector())
                a, b, c = (Vector(M.v[f[0]]), Vector(M.v[f[1]]), Vector(M.v[f[3]]))
                fn = (b - a).cross(c - a)
                uv = None
                if uvbox:
                    u0, v0, u1, v1 = uvbox
                    uv = [(u0 + (u1 - u0) * ((1 - G[k][3]) if flipu else G[k][3]), v0 + (v1 - v0) * G[k][4]) for k in ks]
                if fn.dot(nrm) < 0:
                    f = list(reversed(f))
                    if uv:
                        uv = list(reversed(uv))
                M.face(f, m, part, uv)
    if wall and cells:
        cs = set(cells)
        bot = {}
        for (i, j) in cells:
            for (a, b, nb) in (((i, j), (i + 1, j), (i, j - 1)), ((i + 1, j), (i + 1, j + 1), (i + 1, j)), ((i + 1, j + 1), (i, j + 1), (i, j + 1)), ((i, j + 1), (i, j), (i - 1, j))):
                if nb in cs:
                    continue
                for k in (a, b):
                    if k not in bot:
                        bot[k] = M.vert(G[k][1])
                f = [vid[a], vid[b], bot[b], bot[a]]
                # outward: away from the cell centre
                cc = sum((Vector(G[k][0]) for k in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))), Vector()) / 4
                mid = (Vector(G[a][0]) + Vector(G[b][0])) / 2
                A, B, C = Vector(M.v[f[0]]), Vector(M.v[f[1]]), Vector(M.v[f[3]])
                if (B - A).cross(C - A).dot(mid - cc) < 0:
                    f = list(reversed(f))
                M.face(f, wall if isinstance(wall, str) else m, part)
    ci, cj = nu // 2, nv // 2
    g = G.get((ci, cj)) or next(iter(G.values()))
    return g[0], g[2]


def disc_patch(M, S, c, d, rad, n, rings, off, m, part, up=(0, 0, 1), wall=None):
    """round lens projected along d around point c"""
    R = frame_from(d, up)
    pts = []
    for k in range(rings + 1):
        rr = rad * k / rings
        row = []
        for i in range(n if k else 1):
            a = 2 * math.pi * i / n
            p = Vector(c) + R[0] * math.cos(a) * rr + R[1] * math.sin(a) * rr
            h = S.hit(p, d)
            row.append(M.vert(h[0] + h[1] * off) if h else None)
        pts.append(row)
    nd = -Vector(d).normalized()
    for k in range(rings):
        for i in range(n):
            i2 = (i + 1) % n
            if k == 0:
                f = [pts[0][0], pts[1][i], pts[1][i2]]
            else:
                f = [pts[k][i], pts[k + 1][i], pts[k + 1][i2], pts[k][i2]]
            if None in f:
                continue
            A, B, C = Vector(M.v[f[0]]), Vector(M.v[f[1]]), Vector(M.v[f[-1]])
            if (B - A).cross(C - A).dot(nd) < 0:
                f = list(reversed(f))
            M.face(f, m, part)
    if wall:
        outer = pts[-1]
        for i in range(n):
            i2 = (i + 1) % n
            if outer[i] is None or outer[i2] is None:
                continue
            a, b = Vector(M.v[outer[i]]), Vector(M.v[outer[i2]])
            a2, b2 = M.vert(a - nd * wall), M.vert(b - nd * wall)
            f = [outer[i], outer[i2], b2, a2]
            mid = (a + b) / 2
            A, B, C = a, b, a - nd * wall
            if (B - A).cross(C - A).dot(mid - Vector(c)) < 0:
                f = list(reversed(f))
            M.face(f, m, part)


def place(S, p, d, up=(0, 0, 1)):
    """hit point + basis (r, u, n) with n = surface normal"""
    h = S.hit(p, d)
    if not h:
        return None
    return h[0], frame_from(h[1], up)


# ---------------------------------------------------------------- the car body
SPECS = {}


def spec(key, **kw):
    SPECS[key] = kw
    return kw


def y_of(S, t):
    return -S['L'] / 2 + t * S['L']


def t_of(S, y):
    return (y + S['L'] / 2) / S['L']


def axles(S):
    return [S['fo'] / S['L'], (S['fo'] + S['wb']) / S['L']]


def half_w(S, t):
    hw = S['W'] / 2 * curve(S['plan'], t)
    y = y_of(S, t)
    for ta in axles(S):
        d = abs(y - y_of(S, ta)) / (S['r'] + 0.32)
        if d < 1:
            hw += S.get('flare', 0.012) * (0.5 + 0.5 * math.cos(d * math.pi))
    return hw


NS = 14  # points per half section (hi)
HI_PTS = list(range(NS))
LO_PTS = [0, 2, 4, 6, 8, 10, 12, 13]


def section(S, t):
    """left half of the lower body at t: list of (tag, x, z) from the bottom centre to the top centre"""
    hw = half_w(S, t)
    zb, zs = curve(S['belt'], t), curve(S['sill'], t)
    sh = zb - curve(S.get('shdrop', 0.1), t)
    tb = curve(S.get('tumble', 0.05), t)
    rr = min(S.get('rr', 0.06), (zb - sh) * 0.6)
    cr = S.get('crown', 0.025)
    xs = hw - tb - rr
    pts = [['under', 0, zs + 0.03], ['under', hw - 0.12, zs], ['rocker', hw - 0.04, zs + 0.02], ['side', hw - 0.014, zs + 0.09],
           ['side', hw - 0.004, lerp(zs + 0.09, sh, 0.5)], ['side', hw, sh - 0.035], ['upper', hw - 0.002, sh],
           ['upper', hw - tb * 0.55, lerp(sh, zb - rr, 0.55)], ['round', hw - tb, zb - rr], ['round', hw - tb - rr * 0.3, zb - rr * 0.3],
           ['seam', xs, zb], ['top', xs - 0.012, zb + 0.0015], ['top', xs * 0.5, zb + cr * 0.75], ['end', 0, zb + cr]]
    # wheel arches: the lower side rises over each wheel
    y = y_of(S, t)
    Ra = S['r'] + S.get('arch_gap', 0.055)
    for ta in axles(S):
        dy = y - y_of(S, ta)
        if abs(dy) < Ra:
            az = S['r'] + math.sqrt(Ra * Ra - dy * dy)
            cap = pts[6][2] - 0.03
            for i in range(1, 6):
                if pts[i][2] < az:
                    pts[i][2] = min(az + (i - 1) * 0.004, cap - (5 - i) * 0.004)
                    if i <= 2:
                        pts[i][1] = hw - 0.05 + i * 0.02
    return pts


def bulge(S, t, x, z, hw):
    """y offset near the nose and tail: the fascia curves forward in the middle and leans back at the top"""
    dy = 0.0
    f = max(0.0, 1 - t / 0.05)
    if f:
        dy -= S.get('noseb', 0.06) * (1 - (x / hw) ** 2) * f
        dy += S.get('lean_f', 0.12) * (z - curve(S['belt'], 0)) * f
    r = max(0.0, 1 - (1 - t) / 0.05)
    if r:
        dy += S.get('tailb', 0.04) * (1 - (x / hw) ** 2) * r
        dy -= S.get('lean_r', 0.1) * (z - curve(S['belt'], 1)) * r
    return dy


def stations(S, lo):
    L = S['L']
    step = 0.6 if lo else S.get('step', 0.2)
    ts = set(round(i / max(1, round(L / step)), 5) for i in range(int(round(L / step)) + 1))
    Ra = S['r'] + S.get('arch_gap', 0.055)
    na = 4 if lo else 10
    for ta in axles(S):
        for i in range(na + 1):
            ts.add(round(t_of(S, y_of(S, ta) - Ra + 2 * Ra * i / na), 5))
        ts.add(round(t_of(S, y_of(S, ta) - Ra - 0.06), 5))
        ts.add(round(t_of(S, y_of(S, ta) + Ra + 0.06), 5))
    ne = 2 if lo else 4
    for i in range(1, ne + 1):
        ts.add(round(0.16 / L * i / ne, 5))
        ts.add(round(1 - 0.16 / L * i / ne, 5))
    C = S['cabin']
    ts.update([C['a'], C['c']])
    if not lo:
        sw = S.get('seam', 0.01) / L
        for d0, d1 in S['doors']:
            ts.update([d0, d0 + sw, d1, d1 + sw])
        for a, b in (S['hood'], S.get('trunk') or (2, 2)):
            ts.update([a, a + sw, b - sw, b])
        if S.get('bed'):
            ts.update([S['bed'][0], S['bed'][0] + sw])
    else:
        for d0, d1 in S['doors']:
            ts.update([d0, d1])
        ts.update([S['hood'][1]])
        if S.get('trunk'):
            ts.update([S['trunk'][0]])
        if S.get('bed'):
            ts.update([S['bed'][0], S['bed'][1]])
    ts = sorted(t for t in ts if 0 <= t <= 1)
    out = [ts[0]]
    for t in ts[1:]:
        if (t - out[-1]) * L > 0.004:
            out.append(t)
    return out


def in_rng(t, r):
    return r is not None and r[0] <= t < r[1]


def door_at(S, t):
    for i, (d0, d1) in enumerate(S['doors']):
        if d0 + S.get('seam', 0.01) / S['L'] <= t < d1:
            return i
    return None


def body_part(S, t, tag, z, side, lo):
    """(material, part) of a lower-body face at t with section tag"""
    sw = S.get('seam', 0.01) / S['L']
    C = S['cabin']
    m = 'paint'
    if tag == 'under':
        return 'trim', 'body'
    if tag == 'rocker':
        m = S.get('rocker', 'paint')
    if tag in ('side', 'upper') and S.get('clad') and z < S['clad']:
        m = 'trim'
    part = 'body'
    bF, bR = S['bumpers']
    if t < bF[0] and z < bF[1]:
        part = 'bumpF'
        if S.get('bumper_m'):
            m = S['bumper_m']
        if z < curve(S['sill'], t) + 0.1:
            m = 'trim'
    elif t > bR[0] and z < bR[1]:
        part = 'bumpR'
        if S.get('bumper_m'):
            m = S['bumper_m']
        if z < curve(S['sill'], t) + 0.14:
            m = 'trim'
    elif tag in ('side', 'upper', 'round') and z > curve(S['sill'], t) + 0.08:
        if not lo:
            for d0, d1 in S['doors']:
                if d0 <= t < d0 + sw:
                    return 'trim', 'body'
        i = door_at(S, t) if not lo else next((k for k, (d0, d1) in enumerate(S['doors']) if d0 <= t < d1), None)
        if i is not None and not (tag == 'round' and S.get('doorcut_low')):
            part = ('doorL' if side > 0 else 'doorR') + ('' if i == 0 else '2')
    elif tag in ('seam', 'top', 'end'):
        h0, h1 = S['hood']
        tr = S.get('trunk')
        if h0 <= t < h1:
            if not lo and (t < h0 + sw or t >= h1 - sw or tag == 'seam'):
                return 'trim', 'body'
            part = 'hood'
        elif tr and tr[0] <= t < tr[1]:
            if not lo and (t < tr[0] + sw or t >= tr[1] - sw or tag == 'seam'):
                return 'trim', 'body'
            part = 'trunk'
    if S.get('stripes') and tag in ('top', 'end') and part in ('hood', 'trunk', 'body'):
        m = 'paint2'
    if S.get('two_tone') and part.startswith('door'):
        m = 'paint2'
    return m, part


def build_lower(M, S, lo):
    ts = stations(S, lo)
    C = S['cabin']
    rings = []
    pick = LO_PTS if lo else HI_PTS
    for t in ts:
        pts = section(S, t)
        pts = [pts[i] for i in pick]
        y0 = y_of(S, t)
        hw = half_w(S, t)
        left = [M.vert((x, y0 + bulge(S, t, x, z, hw), z)) for _, x, z in pts]
        right = [M.vert((-x, y0 + bulge(S, t, -x, z, hw), z)) for _, x, z in pts[1:-1]]
        rings.append((t, pts, left, right))
    n = len(pick)
    sw = S.get('seam', 0.01) / S['L']
    for (t0, p0, l0, r0), (t1, p1, l1, r1) in zip(rings, rings[1:]):
        tm = (t0 + t1) / 2
        open_top = C['a'] + 0.002 < tm < C['c'] - 0.002 and not S.get('closed_top')
        bed = S.get('bed')
        for side in (1, -1):
            A = l0 if side > 0 else [l0[0]] + r0 + [l0[-1]]
            B = l1 if side > 0 else [l1[0]] + r1 + [l1[-1]]
            for j in range(n - 1):
                tag = p0[j][0]
                if open_top and tag in ('top', 'end') or open_top and tag == 'seam' and not S.get('keep_seam'):
                    continue
                if bed and bed[0] + sw <= tm < bed[1] and tag in ('top', 'end'):
                    continue
                z = (p0[j][2] + p0[j + 1][2] + p1[j][2] + p1[j + 1][2]) / 4
                m, part = body_part(S, tm, tag, z, side, lo)
                if side > 0:
                    M.quad(A[j], B[j], B[j + 1], A[j + 1], m, part)
                else:
                    M.quad(A[j + 1], B[j + 1], B[j], A[j], m, part)
    # nose and tail caps (strips between the left and right halves)
    for (t, pts, l, r), front in ((rings[0], True), (rings[-1], False)):
        R = [l[0]] + r + [l[-1]]
        for j in range(n - 1):
            z = (pts[j][2] + pts[j + 1][2]) / 2
            bz = S['bumpers'][0][1] if front else S['bumpers'][1][1]
            part = ('bumpF' if front else 'bumpR') if z < bz and (front or S['bumpers'][1][0] <= 1) else 'body'
            m = 'trim' if z < curve(S['sill'], t) + 0.1 else (S.get('bumper_m') or 'paint') if part != 'body' else 'paint'
            if not front and (S.get('gate') or S.get('tg')) and z > bz and S['bumpers'][1][0] <= 1:
                part = 'trunk'
            f = [l[j], l[j + 1], R[j + 1], R[j]]
            M.face(f if front else list(reversed(f)), m, part)
    return rings


GN = 9


def gsection(S, t):
    """left half of the glasshouse at t (from the belt to the roof centre). returns list of (tag, x, z)"""
    C = S['cabin']
    zb = curve(S['belt'], t)
    hw = half_w(S, t)
    x0 = hw - curve(S.get('tumble', 0.05), t) - min(S.get('rr', 0.06), curve(S.get('shdrop', 0.1), t) * 0.6) - 0.004
    a, r1, r2, c = C['a'], C['r1'], C['r2'], C['c']
    roof = C['roof']
    xr = S['W'] / 2 * C['roofw']
    if t < r1:
        u = clamp((t - a) / (r1 - a), 0, 1)
        e = 1 - (1 - u) ** C.get('wcurve', 1.5)
        h = zb + (roof - zb) * e
        xrt = lerp(x0 - 0.03, xr, u ** 0.7)
    elif t > r2:
        u = clamp((c - t) / (c - r2), 0, 1)
        e = 1 - (1 - u) ** C.get('rcurve', 1.6)
        h = zb + (roof - zb) * e
        xrt = lerp(x0 - 0.03, xr, u ** 0.7) if not S.get('gate') else xr * lerp(0.96, 1, u)
    else:
        h = roof + C.get('crown_l', 0.015) * math.sin(math.pi * (t - r1) / (r2 - r1))
        xrt = xr
    H = max(0.0, h - zb)
    fr = C.get('frame', 0.075)
    z1 = zb + min(0.022, H * 0.12)
    z2 = zb + min(0.036, H * 0.2)
    z3 = zb + max(H * 0.25, H - fr)
    z4 = z3 + min(0.014, H * 0.05)
    z5 = h - min(0.03, H * 0.1)
    xs = lambda z: lerp(x0, xrt, ((z - zb) / H) ** 0.85) if H > 1e-4 else x0
    cr = C.get('crown', 0.045)
    ins = 0.012 if H > 0.06 else 0.0
    return [['belt', x0, zb], ['seal', x0 - 0.006, z1], ['glass', xs(z2) - ins, z2], ['frame', xs(z3) - ins, z3],
            ['pillar', xs(z4), z4], ['rail', xrt, z5], ['roof', xrt - 0.06, h], ['roof', xrt * 0.5, h + cr * 0.75], ['end', 0, h + cr]]


def gstations(S, lo):
    C = S['cabin']
    a, c = C['a'], C['c']
    L = S['L']
    step = 0.5 if lo else S.get('gstep', 0.12)
    n = max(2, int(round((c - a) * L / step)))
    ts = set(round(a + (c - a) * i / n, 5) for i in range(n + 1))
    for k in ('r1', 'r2'):
        ts.add(C[k])
        if not lo:
            ts.update([C[k] - 0.012 / L, C[k] + 0.012 / L])
    if not lo:
        ts.update([a + 0.008 / L, c - 0.008 / L])
        for t in [x for r in S['sideglass'] for x in r]:
            ts.add(t)
        sw = S.get('seam', 0.01) / L
        for d0, d1 in S['doors']:
            ts.update([d0, d0 + sw, d1, d1 + sw])
        for k in range(1, 4):  # windshield / rear glass rounding into the roof
            ts.add(C['r1'] - (C['r1'] - a) * 0.12 * k)
            ts.add(C['r2'] + (c - C['r2']) * 0.12 * k)
    else:
        for d0, d1 in S['doors']:
            ts.update([d0, d1])
    if S.get('open'):
        ts = set(t for t in ts if t <= C['r1'] + 1e-6)
    ts = sorted(t for t in ts if a <= t <= c)
    out = [ts[0]]
    for t in ts[1:]:
        if (t - out[-1]) * L > 0.004:
            out.append(t)
    return out


def glass_part(S, t, j, side, lo):
    """(material, part) for glasshouse band j at t; None to skip"""
    C = S['cabin']
    a, r1, r2, c = C['a'], C['r1'], C['r2'], C['c']
    L = S['L']
    sw = S.get('seam', 0.01) / L
    inglass = any(g0 <= t < g1 for g0, g1 in S['sideglass'])
    door = None
    for i, (d0, d1) in enumerate(S['doors']):
        if (d0 + (0 if lo else sw)) <= t < d1:
            door = ('doorL' if side > 0 else 'doorR') + ('' if i == 0 else '2')
    cabin = 'cabin'
    if S.get('gate') and t > r2 and j >= 5:
        cabin = 'trunk'
    if j == 0:
        return S.get('belt_m', 'trim'), door or cabin
    if j == 1:
        return 'trim', door or cabin
    if j == 2:
        if S.get('open'):
            return None
        if inglass:
            return 'glass', door or cabin
        m = S.get('pillar', 'trim')
        if S.get('cargo') and t > S['doors'][0][1]:
            m = 'paint'
        if t > r2 and S.get('cpillar'):
            m = S['cpillar']
        return m, door or cabin
    if j == 3:
        if S.get('open'):
            return None
        m = S.get('frame_m', 'trim')
        if S.get('cargo') and t > S['doors'][0][1]:
            m = 'paint'
        return m, door or cabin
    if j == 4:
        if t < r1:
            return S.get('apillar', 'paint'), cabin
        return 'paint', cabin
    # roof bands: windshield, roof, rear window
    if a + 0.006 / L * 0 < t < r1 - 0.004 / L:
        if j == 5:
            return 'trim', cabin
        return 'glass', cabin
    if r2 + 0.004 / L < t < c and not S.get('cargo_rear'):
        if j == 5:
            return 'trim', cabin
        return 'glass', cabin
    m = S.get('roof_m', 'paint')
    return m, cabin


def build_glass(M, S, lo):
    ts = gstations(S, lo)
    pick = [0, 2, 3, 5, 6, 8] if lo else list(range(GN))
    rings = []
    for t in ts:
        pts = gsection(S, t)
        pts = [pts[i] for i in pick]
        y = y_of(S, t)
        left = [M.vert((x, y, z)) for _, x, z in pts]
        right = [M.vert((-x, y, z)) for _, x, z in pts[:-1]]
        rings.append((t, pts, left, right))
    n = len(pick)
    jmap = pick
    for (t0, p0, l0, r0), (t1, p1, l1, r1) in zip(rings, rings[1:]):
        tm = (t0 + t1) / 2
        for side in (1, -1):
            A = l0 if side > 0 else r0 + [l0[-1]]
            B = l1 if side > 0 else r1 + [l1[-1]]
            for j in range(n - 1):
                jj = jmap[j]
                if lo:  # lo bands: belt..glass bottom, side glass, frame..rail, roof edge, roof
                    jj = {0: 1, 2: 2, 3: 4, 5: 5, 6: 6}[jmap[j]]
                r = glass_part(S, tm, jj, side, lo)
                if r is None:
                    continue
                m, part = r
                if side > 0:
                    M.quad(A[j], B[j], B[j + 1], A[j + 1], m, part)
                else:
                    M.quad(A[j + 1], B[j + 1], B[j], A[j], m, part)
    if S.get('open'):  # windshield header
        t, pts, l, r = rings[-1]
        y = y_of(S, t)
        top = pts[-1][2]
        box(M, (0, y + 0.02, top - 0.02), (pts[-2][1] * 2 + 0.06, 0.06, 0.05), ((1, 0, 0), (0, 0, 1), (0, -1, 0)), 'paint', 'cabin')
    return rings


# ---------------------------------------------------------------- details
def lamps_and_trim(M, S, Sf, lo):
    """headlights, tail lights, grille, plates, intakes, badges... returns lamp empties"""
    W = S['W']
    hw = W / 2
    yF, yR = y_of(S, 0) - 0.2, y_of(S, 1) + 0.2
    out = {}
    nu, nv = (3, 2) if lo else (6, 3)
    H = S['head']
    hp = H.get('part', 'body')
    for sx in (1, -1):
        if H.get('round'):  # classic round lamps: chrome bezel + lens
            cs = []
            for x, z, rr in H['round']:
                c = Vector((sx * x, yF, z))
                dd = Vector((-sx * H.get('wrap', 0.0), 1, 0)).normalized()
                if not lo:
                    disc_patch(M, Sf, c, dd, rr + 0.014, 12, 1, 0.005, H.get('housing', 'chrome'), hp, wall=0.012)
                disc_patch(M, Sf, c, dd, rr, 12 if not lo else 6, 2 if not lo else 1, 0.01 if not lo else 0.006, 'lamp_head', hp)
                h = Sf.hit(c, dd)
                if h:
                    cs.append(h[0] - dd * 0.03)
            if cs:
                out['lamp_head_' + ('L' if sx > 0 else 'R')] = sum(cs, Vector()) / len(cs)
            continue
        x0, x1, z0, z1 = H['x0'], H['x1'], H['z0'], H['z1']
        sl = H.get('slant', 0.0)
        d = Vector((-sx * H.get('wrap', 0.25), 1, H.get('down', 0.0))).normalized()
        cs = [(sx * x0, yF, z0 + sl), (sx * x1, yF, z0), (sx * x1, yF, z1), (sx * x0, yF, z1 + sl * 0.6)]
        if not lo:  # housing (black/chrome bezel) slightly larger, lens on top
            g = 0.012
            patch(M, Sf, [(sx * (x0 - g), yF, z0 + sl - g), (sx * (x1 + g), yF, z0 - g), (sx * (x1 + g), yF, z1 + g), (sx * (x0 - g), yF, z1 + sl * 0.6 + g)],
                  d, nu, nv, 0.004, H.get('housing', 'trim'), hp, wall=True)
        c = patch(M, Sf, cs, d, nu, nv, 0.009 if not lo else 0.006, 'lamp_head', hp, wall=not lo)
        if c:
            out['lamp_head_' + ('L' if sx > 0 else 'R')] = c[0] + c[1] * 0.02
        if not lo:
            if H.get('drl', True):  # LED strip
                pz = z0 + (z1 - z0) * 0.2
                patch(M, Sf, [(sx * x0, yF, pz + sl * 0.9), (sx * x1, yF, pz - 0.01), (sx * x1, yF, pz + 0.012), (sx * x0, yF, pz + 0.012 + sl * 0.9)], d, 6, 1, 0.012, 'lamp_rev', hp)
            for k in range(H.get('proj', 2)):  # projectors
                px = lerp(x0, x1, (k + 0.5) / max(1, H.get('proj', 2)) * 0.8 + 0.1)
                pc = Vector((sx * px, yF, (z0 + z1) / 2 + 0.01))
                pr = min(0.04, (z1 - z0) * 0.32)
                disc_patch(M, Sf, pc, d, pr, 10, 1, 0.012, 'chrome', hp)
                disc_patch(M, Sf, pc, d, pr * 0.6, 8, 1, 0.014, 'lamp_head', hp)
            # side marker / indicator repeater on the front fender
            mk = place(Sf, (sx * (hw + 0.4), y_of(S, axles(S)[0]) - S['r'] - 0.12, curve(S['belt'], 0.1) - 0.12), (-sx, 0, 0))
            if mk:
                rbox(M, mk[0] + mk[1][2] * 0.002, (0.07, 0.025, 0.012), mk[1], 'lamp_amber', 'body', seg=(3, 2))
    T = S.get('tail') or {}
    tp = T.get('part', 'body')
    for sx in ((1, -1) if T else ()):
        x0, x1, z0, z1 = T['x0'], T['x1'], T['z0'], T['z1']
        d = Vector((-sx * T.get('wrap', 0.35), -1, 0)).normalized()
        cs = [(sx * x0, yR, z0), (sx * x1, yR, z0 + T.get('slant', 0)), (sx * x1, yR, z1), (sx * x0, yR, z1)]
        if not lo:
            g = 0.008
            patch(M, Sf, [(sx * (x0 - g), yR, z0 - g), (sx * (x1 + g), yR, z0 - g + T.get('slant', 0)), (sx * (x1 + g), yR, z1 + g), (sx * (x0 - g), yR, z1 + g)], d, nu, nv, 0.004, 'trim', tp, wall=True)
        c = patch(M, Sf, cs, d, nu, nv, 0.009 if not lo else 0.006, 'lamp_tail', tp, wall=not lo)
        if c:
            out['lamp_tail_' + ('L' if sx > 0 else 'R')] = c[0] + c[1] * 0.02
        if not lo:
            rz = lerp(z0, z1, 0.3)  # reverse lamp, inboard
            patch(M, Sf, [(sx * (x0 + 0.01), yR, rz - 0.02), (sx * lerp(x0, x1, 0.35), yR, rz - 0.02), (sx * lerp(x0, x1, 0.35), yR, rz + 0.025), (sx * (x0 + 0.01), yR, rz + 0.025)], d, 3, 1, 0.012, 'lamp_rev', tp)
            if T.get('bar'):  # LED bar across the inner edge
                patch(M, Sf, [(sx * x0, yR, z1 - 0.025), (sx * x1, yR, z1 - 0.025), (sx * x1, yR, z1 - 0.012), (sx * x0, yR, z1 - 0.012)], d, 6, 1, 0.013, 'trim', tp)
    if T and T.get('centre'):  # light bar across the tail between the lamps
        x0, z0, z1 = T['x0'], T['z1'] - 0.05, T['z1'] - 0.015
        patch(M, Sf, [(x0, yR, z0), (-x0, yR, z0), (-x0, yR, z1), (x0, yR, z1)], (0, -1, 0), 6 if not lo else 1, 1, 0.009, 'lamp_tail', tp)
    G = S.get('grille')
    if G:
        gz0, gz1, gw = G['z0'], G['z1'], G['w']
        part = G.get('part', 'body')
        tpg = G.get('taper', 0)
        if not lo:
            patch(M, Sf, [(gw + 0.015, yF, gz0 - 0.015), (-gw - 0.015, yF, gz0 - 0.015), (-gw - 0.015 + tpg, yF, gz1 + 0.015), (gw + 0.015 - tpg, yF, gz1 + 0.015)],
                  (0, 1, 0), 8, 3, 0.004, G.get('surround', 'chrome'), part, wall=True)
        patch(M, Sf, [(gw, yF, gz0), (-gw, yF, gz0), (-gw + tpg, yF, gz1), (gw - tpg, yF, gz1)], (0, 1, 0), 8 if not lo else 2, 3 if not lo else 1, 0.007 if not lo else 0.005, 'trim', part)
        if not lo:
            nb = G.get('bars', 3)
            for k in range(nb):
                z = lerp(gz0, gz1, (k + 1) / (nb + 1))
                t = tpg * (z - gz0) / max(0.01, gz1 - gz0)
                patch(M, Sf, [(gw - t - 0.01, yF, z - 0.007), (-gw + t + 0.01, yF, z - 0.007), (-gw + t + 0.01, yF, z + 0.007), (gw - t - 0.01, yF, z + 0.007)], (0, 1, 0), 8, 1, 0.012, G.get('bar_m', 'chrome'), part)
            disc_patch(M, Sf, Vector((0, yF, (gz0 + gz1) / 2)), (0, 1, 0), 0.035, 12, 1, 0.016, 'chrome', part)  # badge
    I = S.get('intake')
    if I:
        patch(M, Sf, [(I['w'], yF, I['z0']), (-I['w'], yF, I['z0']), (-I['w'] + 0.03, yF, I['z1']), (I['w'] - 0.03, yF, I['z1'])], (0, 1, 0), 8 if not lo else 2, 2 if not lo else 1, 0.004, 'trim', 'bumpF', wall='trim' if not lo else False)
        if not lo and I.get('fog'):
            for sx in (1, -1):
                disc_patch(M, Sf, Vector((sx * I['fog'][0], yF, I['fog'][1])), (0, 1, 0), 0.04, 10, 1, 0.007, 'lamp_head', 'bumpF', wall=0.01)
    if not lo and T:  # rear diffuser / lower valance
        bz = curve(S['sill'], 1) + 0.04
        patch(M, Sf, [(hw * 0.7, yR, bz), (-hw * 0.7, yR, bz), (-hw * 0.7, yR, bz + 0.09), (hw * 0.7, yR, bz + 0.09)], (0, -1, 0), 8, 1, 0.003, 'trim', 'bumpR')
    # number plates (flat, UV mapped to the decal atlas; text reads left to right) in a dark frame
    for front, P in ((True, S.get('plateF')), (False, S.get('plateR'))):
        if not P:
            continue
        pz, part = P[0], P[1]
        h = Sf.hit((0, yF if front else yR, pz), (0, 1 if front else -1, 0))
        if not h:
            continue
        n = Vector((0, -1 if front else 1, 0))
        c = h[0] + n * 0.012
        R = frame_from(n)  # r is the viewer's right when looking at the face
        pw, ph = 0.305, 0.152
        vs = [M.vert(c + R[0] * a * pw / 2 + R[1] * b * ph / 2) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        M.face(vs, 'plate', part, [(0.5 * (0.5 + 0.5 * a), 0.25 * (0.5 + 0.5 * b)) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        if not lo:
            bk = [M.vert(c - n * 0.014 + R[0] * a * (pw / 2 + 0.012) + R[1] * b * (ph / 2 + 0.012)) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            fr = [M.vert(c - n * 0.001 + R[0] * a * (pw / 2 + 0.012) + R[1] * b * (ph / 2 + 0.012)) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            for k in range(4):
                k2 = (k + 1) % 4
                M.quad(fr[k], vs[k], vs[k2], fr[k2], 'trim', part)
                M.quad(bk[k], fr[k], fr[k2], bk[k2], 'trim', part)
    return out


def side_details(M, S, Sf, lo):
    L, W = S['L'], S['W']
    hw = W / 2
    C = S['cabin']
    for sx in (1, -1):  # mirrors on the doors at the A-pillar base
        dpart = 'doorL' if sx > 0 else 'doorR'
        tm = C['a'] + (C['r1'] - C['a']) * 0.42
        zb = curve(S['belt'], tm)
        h = Sf.hit((sx * (hw + 0.5), y_of(S, tm), zb + 0.06), (-sx, 0, 0))
        base = h[0] if h else Vector((sx * (half_w(S, tm) - 0.06), y_of(S, tm), zb + 0.05))
        k = S.get('mirror_k', 1.0)
        mc = base + Vector((sx * 0.13, 0.03, 0.03)) * k
        mw = 0.2 * k
        R = (Vector((sx, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0)))
        if lo:
            box(M, mc, (mw, 0.1, 0.08), RF, S.get('mirror_m', 'paint'), dpart)
            continue
        rbox(M, mc, (mw, 0.115, 0.11), RF, S.get('mirror_m', 'paint'), dpart, seg=(5, 3), e=0.45)
        box(M, mc + Vector((0, 0.052, 0)), (mw * 0.8, 0.09, 0.004), RB, 'chrome', dpart)  # mirror glass
        box(M, base + Vector((sx * 0.04, 0.02, 0.0)), (0.09, 0.045, 0.06), RF, 'trim', dpart)
        box(M, mc + Vector((sx * mw * 0.32, -0.04, -0.035)), (mw * 0.3, 0.012, 0.012), RF, 'lamp_amber', dpart)
    if lo:
        return
    for sx in (1, -1):  # door handles
        for i, (d0, d1) in enumerate(S['doors']):
            part = ('doorL' if sx > 0 else 'doorR') + ('' if i == 0 else '2')
            tt = d1 - 0.2 / L
            sh = curve(S['belt'], tt) - curve(S.get('shdrop', 0.1), tt) - S.get('handle_dz', 0.04)
            p = place(Sf, (sx * (hw + 0.5), y_of(S, tt), sh), (-sx, 0, 0))
            if p:
                rbox(M, p[0] + p[1][2] * 0.008, (0.14, 0.03, 0.022), p[1], S.get('handle_m', 'paint'), part, seg=(4, 2), e=0.4)
                rbox(M, p[0] + p[1][2] * 0.002, (0.17, 0.045, 0.01), p[1], 'trim', part, seg=(4, 2), e=0.4)
    a = C['a']  # wipers
    zc = curve(S['belt'], a + 0.01)
    for x in (0.42, -0.12):
        y = y_of(S, a) + 0.08
        tube(M, [(x, y, zc + 0.03), (x - 0.5, y + 0.1, zc + 0.06)], 0.008, 4, 'trim', 'cabin')
    if not S.get('open') and not S.get('noantenna'):  # shark-fin antenna
        z = C['roof'] + C.get('crown', 0.045)
        rbox(M, (0, y_of(S, C['r2'] - 0.03), z + 0.025), (0.06, 0.06, 0.16), RF, S.get('fin_m', 'trim'), 'cabin', seg=(3, 2), e=0.5)
    for x, rr in S.get('exhaust', [(-0.55, 0.035)]):  # exhaust tips
        z = curve(S['sill'], 0.99) + 0.03
        yb = y_of(S, 1) - 0.06
        h = Sf.hit((x, yb + 0.5, z + 0.02), (0, -1, 0))
        y = h[0].y if h else yb
        cyl(M, (x, y - 0.25, z + 0.02), (x, y + 0.03, z + 0.02), rr, 10, 'chrome', 'bumpR', caps=False)
        cyl(M, (x, y - 0.2, z + 0.02), (x, y + 0.025, z + 0.02), rr * 0.8, 10, 'trim', 'bumpR', caps=True)
    if not S.get('open') and S.get('chmsl', True) and not S.get('cargo_rear'):  # third brake light
        if S.get('gate'):
            box(M, (0, y_of(S, C['r2']) + 0.03, C['roof'] - 0.005), (0.4, 0.04, 0.03), RB, 'lamp_tail', 'trunk')
        else:
            box(M, (0, y_of(S, C['r2']) + 0.09, C['roof'] - 0.025), (0.28, 0.02, 0.025), RB, 'lamp_tail', 'cabin')


def arches(M, S, Sf, lo):
    """dark wheel-well liners (so you can't see through the body) and optional cladding lips"""
    Ra = S['r'] + S.get('arch_gap', 0.055)
    n = 6 if lo else 14
    for ta in axles(S):
        if not 0 < ta < 1:
            continue
        yc = y_of(S, ta)
        for sx in (1, -1):
            xo = half_w(S, ta) + 0.01
            xi = S['track'] / 2 - 0.2
            ring_o, ring_i = [], []
            for k in range(n + 1):
                a = math.radians(-100 + 200 * k / n)
                y, z = yc + math.sin(a) * Ra, S['r'] + math.cos(a) * Ra
                ring_o.append(M.vert((sx * min(xo, half_w(S, clamp(t_of(S, y), 0, 1)) - 0.015), y, z)))
                ring_i.append(M.vert((sx * xi, y, z)))
            for k in range(n):
                f = [ring_o[k], ring_o[k + 1], ring_i[k + 1], ring_i[k]]
                M.face(f if sx > 0 else list(reversed(f)), 'trim', 'body')
            c = M.vert((sx * xi, yc, S['r'] - 0.05))
            for k in range(n):
                f = [ring_i[k], ring_i[k + 1], c]
                M.face(f if sx < 0 else list(reversed(f)), 'trim', 'body')
            lip = S.get('lip')
            if lip and not lo:
                pts = []
                for k in range(n + 1):
                    a = math.radians(-95 + 190 * k / n)
                    y, z = yc + math.sin(a) * (Ra + lip * 0.5), S['r'] + math.cos(a) * (Ra + lip * 0.5)
                    h = Sf.hit((sx * (xo + 0.5), y, z), (-sx, 0, 0))
                    if h and abs(h[0].x) > xo - 0.15:
                        pts.append((h[0].x, y, z))
                if len(pts) > 2:
                    tube(M, pts, lip, 5, S.get('lip_m', 'trim'), 'body')


def interior(M, S, lo):
    """seats, dash, steering wheel, console, and a floor tub so the cabin reads as solid"""
    W = S['W']
    C = S['cabin']
    part = 'interior'
    seats = {}
    zfl = S.get('floor', curve(S['sill'], 0.5) + 0.12)
    hz = S.get('hip', zfl + 0.27)  # top of the seat cushion
    yD = y_of(S, S.get('seat_t', (S['doors'][0][0] + S['doors'][0][1]) / 2 + 0.03))
    xs = S.get('seat_x', 0.37)
    ya, yc = y_of(S, C['a']), y_of(S, C['c'] if not S.get('cabin_end') else S['cabin_end'])
    hwi = half_w(S, 0.5) - 0.09
    zbelt = curve(S['belt'], 0.5)
    yRr = None
    if len(S['doors']) > 1 or S.get('rear_seat'):
        yRr = y_of(S, S.get('rear_t', (S['doors'][1][0] + S['doors'][1][1]) / 2 + 0.03 if len(S['doors']) > 1 else 0.6))
    seats['D'] = (xs, yD, hz)
    seats['P'] = (-xs, yD, hz)
    if yRr is not None:
        seats['RL'] = (xs, yRr, hz + 0.02)
        seats['RR'] = (-xs, yRr, hz + 0.02)
    if lo:
        for sx in (1, -1):
            box(M, (sx * xs, yD + 0.12, hz + 0.25), (0.48, 0.55, 0.12), RU, 'interior', part)
        if yRr is not None:
            box(M, (0, yRr + 0.12, hz + 0.25), (hwi * 2 - 0.1, 0.5, 0.12), RU, 'interior', part)
        box(M, (0, ya + 0.3, zbelt - 0.05), (hwi * 2, 0.16, 0.4), RF, 'interior', part)
        return seats
    tilt = math.radians(S.get('recline', 16))
    Rb = (Vector((1, 0, 0)), Vector((0, math.sin(tilt), math.cos(tilt))), Vector((0, -math.cos(tilt), math.sin(tilt))))
    bh = S.get('backh', 0.6)
    for sx in (1, -1):
        cx = sx * xs
        rbox(M, (cx, yD, hz - 0.06), (0.5, 0.12, 0.52), RF, 'interior', part, seg=(3, 2), e=0.3)
        rbox(M, (cx, yD + 0.27 + math.sin(tilt) * bh / 2, hz - 0.02 + math.cos(tilt) * bh / 2), (0.5, bh, 0.13), Rb, 'interior', part, seg=(3, 2), e=0.3)
        rbox(M, (cx, yD + 0.29 + math.sin(tilt) * (bh + 0.1), hz + math.cos(tilt) * (bh + 0.1)), (0.26, 0.17, 0.09), Rb, 'interior', part, seg=(3, 2), e=0.5)
    if yRr is not None:
        rw = hwi * 2 - 0.08
        rbox(M, (0, yRr, hz - 0.05), (rw, 0.12, 0.5), RF, 'interior', part, seg=(5, 2), e=0.25)
        rbox(M, (0, yRr + 0.27 + math.sin(tilt) * 0.28, hz + math.cos(tilt) * 0.28), (rw, 0.56, 0.12), Rb, 'interior', part, seg=(5, 2), e=0.25)
        for sx in (1, -1):
            rbox(M, (sx * xs, yRr + 0.31 + math.sin(tilt) * 0.62, hz + math.cos(tilt) * 0.62), (0.24, 0.15, 0.08), Rb, 'interior', part, seg=(3, 2), e=0.5)
    # dashboard with an instrument hood and centre stack
    yd = ya + S.get('dash_dy', 0.32)
    rbox(M, (0, yd, zbelt - 0.06), (hwi * 2, 0.24, 0.5), RF, 'interior', part, seg=(4, 2), e=0.25)
    rbox(M, (xs, yd + 0.12, zbelt + 0.02), (0.36, 0.1, 0.16), RF, 'trim', part, seg=(4, 2), e=0.4)
    rbox(M, (0, yd + 0.18, zbelt - 0.2), (0.24, 0.34, 0.16), RF, 'trim', part, seg=(3, 3), e=0.3)
    if S.get('screen', True):
        box(M, (0, yd + 0.16, zbelt + 0.04), (0.26, 0.15, 0.015), (Vector((1, 0, 0)), Vector((0, 0.3, 0.95)).normalized(), Vector((0, 0.95, -0.3)).normalized()), 'glass', part)
    # centre console with a gear lever
    rbox(M, (0, yD - 0.05, zfl + 0.15), (0.2, 0.3, 0.7), RF, 'interior', part, seg=(3, 3), e=0.3)
    cyl(M, (0, yD - 0.3, zfl + 0.3), (0, yD - 0.33, zfl + 0.42), 0.012, 6, 'chrome', part)
    rbox(M, (0, yD - 0.335, zfl + 0.44), (0.045, 0.06, 0.045), RF, 'trim', part, seg=(3, 2), e=0.6)
    # steering wheel: rim, three spokes, hub, column
    sc = Vector((xs, yD - S.get('wheel_dy', 0.42), hz + S.get('wheel_dz', 0.33)))
    ang = math.radians(S.get('wheel_tilt', 24))
    Rw = frame_from(-Vector((0, -math.cos(ang), math.sin(ang))), (0, 0, 1))
    rr = S.get('wheel_r', 0.185)
    ring = [tuple(sc + Rw[0] * math.cos(2 * math.pi * k / 16) * rr + Rw[1] * math.sin(2 * math.pi * k / 16) * rr) for k in range(16)]
    tube(M, ring, 0.017, 5, 'trim', part, closed=True)
    for a in (0, math.pi, -math.pi / 2):
        p1 = sc + Rw[0] * math.cos(a) * rr * 0.92 + Rw[1] * math.sin(a) * rr * 0.92
        tube(M, [tuple(sc), tuple(p1)], 0.014, 4, 'trim', part)
    cyl(M, sc - Rw[2] * 0.01, sc + Rw[2] * 0.03, 0.055, 10, 'trim', part)
    cyl(M, sc + Rw[2] * 0.03, sc + Rw[2] * 0.3, 0.035, 8, 'trim', part, caps=False)
    # floor, firewall, side walls and parcel shelf (inward facing)
    yb = yc - 0.05
    zb2 = zbelt - 0.02
    f0 = [M.vert((hwi, ya, zfl)), M.vert((-hwi, ya, zfl)), M.vert((-hwi, yb, zfl)), M.vert((hwi, yb, zfl))]
    M.face(f0, 'interior', part)
    fw = [M.vert((hwi, ya + 0.05, zb2)), M.vert((-hwi, ya + 0.05, zb2))]
    M.face([f0[1], f0[0], fw[0], fw[1]], 'interior', part)
    for sx in (1, -1):
        x = sx * (hwi + 0.02)
        q = [M.vert((x, ya, zfl)), M.vert((x, yb, zfl)), M.vert((x, yb, zb2)), M.vert((x, ya, zb2))]
        M.face(q if sx < 0 else list(reversed(q)), 'interior', part)
    if not S.get('open') and not S.get('gate'):
        M.face([M.vert((hwi, yb, zb2)), M.vert((-hwi, yb, zb2)), M.vert((-hwi, yb, zfl)), M.vert((hwi, yb, zfl))], 'interior', part)
    return seats


def make_wheel():
    """one shared wheel, radius 0.33, axle along X; outer face +X (right-side wheels are mirrored in-game)"""
    root = bpy.data.objects.new('wheel', None)
    link(root)
    M = Mesh()
    tyre = [(-0.094, 0.214), (-0.106, 0.236), (-0.112, 0.27), (-0.108, 0.305), (-0.094, 0.323), (-0.07, 0.33),
            (-0.03, 0.33), (-0.028, 0.321), (-0.016, 0.321), (-0.014, 0.33), (0.014, 0.33), (0.016, 0.321), (0.028, 0.321), (0.03, 0.33),
            (0.07, 0.33), (0.094, 0.323), (0.108, 0.305), (0.112, 0.27), (0.106, 0.236), (0.094, 0.214)]
    lathe(M, tyre, 26, 'tire', 'hi')
    # rim barrel (seen through the spokes), outer lip, hub with centre cap
    lathe(M, [(0.085, 0.208), (0.07, 0.2), (-0.09, 0.206), (-0.094, 0.214)], 26, 'rim', 'hi', mats=['rim', 'trim', 'rim'])
    lathe(M, [(0.094, 0.214), (0.1, 0.212), (0.102, 0.204), (0.096, 0.196), (0.085, 0.208)], 26, 'rim', 'hi')
    lathe(M, [(0.06, 0.068), (0.075, 0.066), (0.082, 0.052), (0.086, 0.03), (0.088, 0.0)], 14, 'rim', 'hi', mats=['rim', 'rim', 'chrome', 'chrome'])
    # 5 split spokes (10 arms), deep at the hub and flush at the lip
    for k in range(10):
        a = 2 * math.pi * (k // 2) / 5 + (0.17 if k % 2 else -0.17)
        a2 = 2 * math.pi * (k // 2) / 5 + (0.06 if k % 2 else -0.06)
        ca, sa, ca2, sa2 = math.cos(a), math.sin(a), math.cos(a2), math.sin(a2)
        P = lambda x, r, c, s, off: (x, c * r - s * off, s * r + c * off)
        hw0, hw1 = 0.013, 0.017
        f = [M.vert(p) for p in (P(0.074, 0.062, ca2, sa2, -hw0), P(0.074, 0.062, ca2, sa2, hw0), P(0.092, 0.198, ca, sa, hw1), P(0.092, 0.198, ca, sa, -hw1))]
        b = [M.vert(p) for p in (P(0.05, 0.062, ca2, sa2, -hw0 * 0.8), P(0.05, 0.062, ca2, sa2, hw0 * 0.8), P(0.075, 0.2, ca, sa, hw1 * 0.8), P(0.075, 0.2, ca, sa, -hw1 * 0.8))]
        for q in ([f[0], f[3], f[2], f[1]], [f[0], b[0], b[3], f[3]], [f[1], f[2], b[2], b[1]]):
            A, B, C = Vector(M.v[q[0]]), Vector(M.v[q[1]]), Vector(M.v[q[3]])
            mid = sum((Vector(M.v[i]) for i in q), Vector()) / 4
            out = Vector((1, 0, 0)) if q[0] == f[0] and q[1] == f[3] else Vector((0, mid.y, mid.z)).cross(Vector((1, 0, 0))) * 0 + (mid - Vector((mid.x, ca * 0.13, sa * 0.13)))
            if (B - A).cross(C - A).dot(out) < 0:
                q = q[::-1]
            M.face(q, 'rim', 'hi')
    for k in range(5):  # lug nuts
        a = 2 * math.pi * (k + 0.5) / 5
        cyl(M, (0.07, math.cos(a) * 0.045, math.sin(a) * 0.045), (0.088, math.cos(a) * 0.045, math.sin(a) * 0.045), 0.009, 6, 'chrome', 'hi')
    lathe(M, [(-0.012, 0.07), (-0.012, 0.172), (0.012, 0.172), (0.012, 0.07), (0.04, 0.07), (0.04, 0.0)], 18, 'disc', 'hi')  # brake disc
    # caliper (does not spin): a curved block hugging the disc behind the top
    C = Mesh()
    rows = []
    for i in range(6):
        a = lerp(math.radians(25), math.radians(75), i / 5)
        rows.append([C.vert((x, math.sin(a) * r, math.cos(a) * r)) for (x, r) in ((-0.03, 0.13), (0.034, 0.13), (0.034, 0.188), (-0.03, 0.188))])
    for i in range(5):
        for k in range(4):
            k2 = (k + 1) % 4
            C.quad(rows[i][k], rows[i + 1][k], rows[i + 1][k2], rows[i][k2], 'caliper', 'hi')
    C.face(rows[0], 'caliper', 'hi')
    C.face(list(reversed(rows[-1])), 'caliper', 'hi')
    Lm = Mesh()  # lo: a 12-sided tyre and a flat rim face
    lathe(Lm, [(-0.1, 0.215), (-0.112, 0.29), (-0.09, 0.33), (0.09, 0.33), (0.112, 0.29), (0.1, 0.215)], 12, 'tire', 'lo')
    rr = lathe(Lm, [(0.1, 0.215), (0.085, 0.2)], 12, 'rim', 'lo')
    disk(Lm, rr[-1], (0.085, 0, 0), 'rim', 'lo')
    for o in (M.build('wheel_hi', 'hi', sharp=40), Lm.build('wheel_lo', 'lo', sharp=40), C.build('caliper_hi', 'hi', sharp=40)):
        o.parent = root
    cal = bpy.data.objects['caliper_hi']
    bm = bmesh.new()
    bm.from_mesh(cal.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cal.data)
    bm.free()
    return root


def set_pivot_children(empty_obj, objs):
    for o in objs:
        if o:
            o.parent = empty_obj


PIVOT_PARTS = ('doorL', 'doorR', 'doorL2', 'doorR2', 'hood', 'trunk', 'bumpF', 'bumpR')


def pivot_of(S, part):
    L, W = S['L'], S['W']
    C = S['cabin']
    if part.startswith('door'):
        i = 1 if part.endswith('2') else 0
        d0 = S['doors'][i][0]
        sx = 1 if 'L' in part else -1
        if S.get('slide') and i == 1:
            d0 = S['doors'][i][1]
        return (sx * half_w(S, d0) * 0.97, y_of(S, d0), 0.0)
    if part == 'hood':
        t = S['hood'][1]
        return (0, y_of(S, t), curve(S['belt'], t))
    if part == 'trunk':
        if S.get('gate'):
            return (0, y_of(S, C['r2']), C['roof'])
        if S.get('bed'):
            return (0, y_of(S, 1), curve(S['sill'], 1) + 0.25)
        t = S['trunk'][0]
        return (0, y_of(S, t), curve(S['belt'], t))
    if part == 'bumpF':
        return (0, y_of(S, 0), S['bumpers'][0][1] * 0.6)
    if part == 'bumpR':
        return (0, y_of(S, 1), S['bumpers'][1][1] * 0.6)
    return (0, 0, 0)


def assemble(key, root, Mh, Ml, S, pivots=None):
    """one empty per part (at its pivot) holding <part>_hi and <part>_lo meshes"""
    parts = sorted(set(Mh.parts()) | set(Ml.parts()))
    for pn in parts:
        pv = (pivots or {}).get(pn) or (pivot_of(S, pn) if S and pn in PIVOT_PARTS else (0, 0, 0))
        e = bpy.data.objects.new(pn, None)
        link(e)
        e.location = pv
        e.parent = root
        for M, suf in ((Mh, '_hi'), (Ml, '_lo')):
            o = M.build(key + '__' + pn + suf, pn, pv)
            if o:
                o.parent = e
    return root


def E(root, name, p):
    e = empty(name, tuple(p), root)
    e.empty_display_size = 0.1
    return e


BUILT = {}


def clone_car(key, src, S=None):
    """a new root that reuses another vehicle's meshes (the GLB stores them once), plus S['extra'] parts"""
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    for c in src.children:
        base = c.name.split('__', 1)[-1].split('.')[0]
        e = bpy.data.objects.new(base, None)
        link(e)
        e.location = c.location.copy()
        e.parent = root
        for m in c.children:
            o = bpy.data.objects.new(base + ('_hi' if m.name.endswith('_hi') else '_lo'), m.data)
            link(o)
            o.parent = e
    if S and S.get('extra'):
        Mh, Ml = Mesh(), Mesh()
        for M, lo in ((Mh, False), (Ml, True)):
            S['extra'](M, S, None, lo)
        assemble(key, root, Mh, Ml, S)
    return root


def build_car(key, S):
    if S.get('share'):
        src = BUILT.get(S['share'])
        tmp = None
        if src is None:
            src = tmp = build_car(S['share'], SPECS[S['share']])
        r = clone_car(key, src, S)
        if tmp:
            for o in list(tmp.children_recursive) + [tmp]:
                bpy.data.objects.remove(o, do_unlink=True)
            BUILT.pop(S['share'], None)
        return r
    Mh, Ml = Mesh(), Mesh()
    for M, lo in ((Mh, False), (Ml, True)):
        build_lower(M, S, lo)
        build_glass(M, S, lo)
    Sh, Sl = Surf(Mh), Surf(Ml)
    lamps = None
    for M, Sf, lo in ((Mh, Sh, False), (Ml, Sl, True)):
        lp = lamps_and_trim(M, S, Sf, lo)
        if not lo:
            lamps = lp
        side_details(M, S, Sf, lo)
        arches(M, S, Sf, lo)
        seats = interior(M, S, lo)
        if not lo:
            hiseats = seats
        if S.get('extra'):
            S['extra'](M, S, Sf, lo)
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    assemble(key, root, Mh, Ml, S)
    # empties the game reads
    tf, tr = axles(S)
    for i, ta in enumerate((tf, tr)):
        for sx in (1, -1):
            E(root, ('w_F' if i == 0 else 'w_R') + ('L' if sx > 0 else 'R'), (sx * S['track'] / 2, y_of(S, ta), S['r']))
    for k, p in hiseats.items():
        E(root, 'seat_' + k, p)
    for k, p in lamps.items():
        E(root, k, p)
    BUILT[key] = root
    return root


# ---------------------------------------------------------------- vehicle specs (real-world sizes)
def base_spec(L, W, H, wb, fo, r, track, **kw):
    d = dict(L=L, W=W, H=H, wb=wb, fo=fo, r=r, track=track)
    d.update(kw)
    return d


# mid-size sedan (Camry / Accord class): 4.88 x 1.84 x 1.44 m, wheelbase 2.82 m, 215/55R17
SEDAN = base_spec(4.86, 1.84, 1.445, 2.82, 0.97, 0.334, 1.59,
    belt=[(0, 0.6), (0.015, 0.7), (0.04, 0.77), (0.1, 0.835), (0.2, 0.875), (0.3, 0.925), (0.5, 0.965), (0.8, 0.99), (0.9, 1.0), (0.96, 0.985), (0.99, 0.9), (1, 0.8)],
    sill=[(0, 0.34), (0.05, 0.24), (0.13, 0.17), (0.87, 0.17), (0.95, 0.25), (1, 0.36)],
    plan=[(0, 0.8), (0.02, 0.89), (0.06, 0.96), (0.16, 0.995), (0.5, 1.0), (0.84, 0.995), (0.95, 0.96), (0.99, 0.89), (1, 0.84)],
    shdrop=[(0, 0.07), (0.15, 0.1), (1, 0.1)], tumble=0.05, rr=0.06, crown=0.025,
    cabin=dict(a=0.305, r1=0.465, r2=0.655, c=0.835, roof=1.445, roofw=0.76, crown=0.035),
    doors=[(0.37, 0.555), (0.555, 0.735)], sideglass=[(0.33, 0.546), (0.566, 0.712), (0.722, 0.758)],
    hood=(0.035, 0.3), trunk=(0.84, 0.975), bumpers=((0.06, 0.6), (0.945, 0.68)),
    head=dict(x0=0.36, x1=0.8, z0=0.62, z1=0.71, slant=0.03, wrap=0.35),
    tail=dict(x0=0.5, x1=0.86, z0=0.79, z1=0.88, wrap=0.6, bar=True),
    grille=dict(z0=0.48, z1=0.6, w=0.36, taper=0.04, bars=3),
    intake=dict(z0=0.3, z1=0.42, w=0.55, fog=(0.66, 0.38)),
    plateF=(0.4, 'bumpF'), plateR=(0.62, 'bumpR'),
    exhaust=[(-0.55, 0.035)])


def sedan_like(**kw):
    d = dict(SEDAN)
    d.update(kw)
    return d


spec('sedan', **SEDAN)


def taxi_sign(M, S, Sf, lo):
    C = S['cabin']
    t = (C['r1'] + C['r2']) / 2
    z = C['roof'] + C.get('crown', 0.035) + 0.01
    y = y_of(S, t)
    if lo:
        box(M, (0, y, z + 0.11), (0.62, 0.2, 0.2), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'decal', 'details')
        return
    rbox(M, (0, y, z + 0.015), (0.66, 0.03, 0.24), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'trim', 'details', seg=(4, 2), e=0.4)
    # the sign: a wedge with text on both long faces (front reads TAXI, uv box (0.5, 0.75)-(1, 1))
    hw, h, d2 = 0.31, 0.2, 0.1
    pts = {}
    for sx in (-1, 1):
        for sy in (-1, 1):
            pts[sx, sy, 0] = M.vert((sx * hw, y + sy * d2, z + 0.03))
            pts[sx, sy, 1] = M.vert((sx * hw * 0.92, y + sy * d2 * 0.45, z + 0.03 + h))
    uv = [(0.5, 0.75), (1.0, 0.75), (1.0, 1.0), (0.5, 1.0)]  # both faces start at the viewer's left
    M.face([pts[-1, -1, 0], pts[1, -1, 0], pts[1, -1, 1], pts[-1, -1, 1]], 'decal', 'details', uv)
    M.face([pts[1, 1, 0], pts[-1, 1, 0], pts[-1, 1, 1], pts[1, 1, 1]], 'decal', 'details', uv)
    for sx in (-1, 1):
        f = [pts[sx, -1, 0], pts[sx, 1, 0], pts[sx, 1, 1], pts[sx, -1, 1]]
        M.face(f if sx > 0 else list(reversed(f)), 'decal', 'details', [(0.98, 0.98)] * 4)
    M.face([pts[1, -1, 1], pts[1, 1, 1], pts[-1, 1, 1], pts[-1, -1, 1]], 'decal', 'details', [(0.98, 0.98)] * 4)


def police_kit(M, S, Sf, lo):
    C = S['cabin']
    t = (C['r1'] + C['r2']) / 2 - 0.03
    z = C['roof'] + C.get('crown', 0.035) + 0.005
    y = y_of(S, t)
    Rf = (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0)))
    if lo:
        box(M, (0, y, z + 0.06), (1.2, 0.3, 0.1), Rf, 'trim', 'details')
        for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_head')):
            box(M, (sx * 0.3, y, z + 0.08), (0.52, 0.26, 0.08), Rf, nm, 'details')
        return
    # low-profile LED light bar: base, red (left) and blue (right) lenses, clear centre
    for sx in (1, -1):
        box(M, (sx * 0.5, y, z + 0.02), (0.05, 0.12, 0.04), Rf, 'trim', 'details')
    rbox(M, (0, y, z + 0.045), (1.25, 0.04, 0.3), Rf, 'trim', 'details', seg=(6, 2), e=0.3)
    for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_head')):
        rbox(M, (sx * 0.33, y, z + 0.09), (0.56, 0.075, 0.27), Rf, nm, 'details', seg=(6, 2), e=0.3)
    rbox(M, (0, y, z + 0.09), (0.1, 0.07, 0.25), Rf, 'chrome', 'details', seg=(2, 2), e=0.4)
    # push bar
    yF = y_of(S, 0) - 0.06
    for sx in (1, -1):
        tube(M, [(sx * 0.32, yF + 0.12, 0.3), (sx * 0.32, yF - 0.02, 0.34), (sx * 0.32, yF - 0.04, 0.74), (sx * 0.32, yF + 0.04, 0.8)], 0.028, 6, 'trim', 'bumpF')
    box(M, (0, yF - 0.03, 0.62), (0.75, 0.06, 0.05), Rf, 'trim', 'bumpF')
    box(M, (0, yF - 0.03, 0.44), (0.75, 0.06, 0.05), Rf, 'trim', 'bumpF')
    for sx in (1, -1):
        box(M, (sx * 0.2, yF - 0.07, 0.54), (0.1, 0.02, 0.05), Rf, 'lamp_tail' if sx > 0 else 'lamp_head', 'bumpF')
    # A-pillar spotlight (driver side)
    tA = C['a'] + (C['r1'] - C['a']) * 0.3
    p = place(Sf, (0.95 + 0.5, y_of(S, tA), curve(S['belt'], tA) + 0.12), (-1, 0, 0))
    if p:
        c = p[0] + Vector((0.07, -0.03, 0.02))
        cyl(M, c + Vector((0, -0.07, 0)), c + Vector((0, 0.06, 0)), 0.055, 10, 'chrome', 'cabin')
        disk(M, [M.vert(c + Vector((math.cos(2 * math.pi * k / 10) * 0.05, -0.071, math.sin(2 * math.pi * k / 10) * 0.05))) for k in range(10)], c + Vector((0, -0.071, 0)), 'lamp_head', 'cabin', flip=True)
    # antennas
    for x, tt in ((0.3, C['r2'] - 0.02), (-0.3, C['r2'] - 0.02)):
        cyl(M, (x, y_of(S, tt), C['roof'] + 0.03), (x, y_of(S, tt) + 0.02, C['roof'] + 0.45), 0.004, 4, 'trim', 'cabin', caps=False)


spec('taxi', **sedan_like(extra=taxi_sign, share='sedan'))
# full-size police sedan (Charger Pursuit class): 5.08 x 1.91 x 1.48 m, wheelbase 3.05 m
spec('police', **base_spec(5.05, 1.9, 1.48, 3.05, 0.98, 0.35, 1.62,
    belt=[(0, 0.62), (0.015, 0.73), (0.04, 0.8), (0.1, 0.86), (0.2, 0.9), (0.31, 0.95), (0.5, 0.99), (0.8, 1.01), (0.9, 1.02), (0.96, 1.0), (0.99, 0.92), (1, 0.82)],
    sill=[(0, 0.34), (0.05, 0.24), (0.13, 0.17), (0.87, 0.17), (0.95, 0.25), (1, 0.36)],
    plan=[(0, 0.82), (0.02, 0.9), (0.06, 0.965), (0.16, 0.995), (0.5, 1.0), (0.84, 0.995), (0.95, 0.965), (0.99, 0.9), (1, 0.86)],
    shdrop=[(0, 0.07), (0.15, 0.11), (1, 0.11)], tumble=0.05, rr=0.06, crown=0.025,
    cabin=dict(a=0.32, r1=0.465, r2=0.66, c=0.83, roof=1.48, roofw=0.76, crown=0.035),
    doors=[(0.37, 0.555), (0.555, 0.73)], sideglass=[(0.335, 0.546), (0.566, 0.715)],
    hood=(0.035, 0.31), trunk=(0.835, 0.975), bumpers=((0.06, 0.6), (0.945, 0.7)),
    head=dict(x0=0.38, x1=0.82, z0=0.66, z1=0.74, slant=0.0, wrap=0.3),
    tail=dict(x0=0.12, x1=0.88, z0=0.84, z1=0.92, wrap=0.4, centre=True),
    grille=dict(z0=0.5, z1=0.64, w=0.42, taper=0.0, bars=2),
    intake=dict(z0=0.3, z1=0.44, w=0.6), plateF=(0.42, 'bumpF'), plateR=(0.66, 'bumpR'),
    exhaust=[(-0.6, 0.04), (0.6, 0.04)], two_tone=True, extra=police_kit, apillar='paint'))


def roof_rails(M, S, Sf, lo):
    C = S['cabin']
    if lo:
        return
    z = C['roof'] + 0.02
    for sx in (1, -1):
        x = sx * (S['W'] / 2 * C['roofw'] - 0.1)
        ya, yb = y_of(S, C['r1'] + 0.03), y_of(S, C['r2'] - 0.01)
        tube(M, [(x, ya, z - 0.02), (x, ya + 0.12, z + 0.04), (x, yb - 0.12, z + 0.04), (x, yb, z - 0.02)], 0.016, 5, 'trim', 'cabin')


def suv_extra(M, S, Sf, lo):
    roof_rails(M, S, Sf, lo)


def pickup_bed(M, S, Sf, lo):
    """bed floor, inner walls, wheel tubs and the inside of the tailgate"""
    b0, b1 = S['bed']
    y0, y1 = y_of(S, b0) + 0.04, y_of(S, 1) - 0.06
    zf = S.get('bed_floor', 0.9)
    zt = curve(S['belt'], (b0 + b1) / 2) - 0.02
    t = (b0 + b1) / 2
    xi = half_w(S, t) - curve(S.get('tumble', 0.05), t) - min(S.get('rr', 0.06), curve(S.get('shdrop', 0.1), t) * 0.6) - 0.01
    M.face([M.vert((xi, y0, zf)), M.vert((-xi, y0, zf)), M.vert((-xi, y1, zf)), M.vert((xi, y1, zf))], 'trim', 'body')
    for sx in (1, -1):
        q = [M.vert((sx * xi, y0, zf)), M.vert((sx * xi, y1, zf)), M.vert((sx * xi, y1, zt)), M.vert((sx * xi, y0, zt))]
        M.face(q if sx < 0 else list(reversed(q)), 'paint' if lo else 'trim', 'body')
    M.face([M.vert((xi, y0, zt)), M.vert((-xi, y0, zt)), M.vert((-xi, y0, zf)), M.vert((xi, y0, zf))][::-1], 'trim', 'body')
    # tailgate inner face (moves with the tailgate)
    M.face([M.vert((xi, y1, zf)), M.vert((-xi, y1, zf)), M.vert((-xi, y1, zt)), M.vert((xi, y1, zt))][::-1], 'trim', 'trunk')
    if not lo:
        ya = y_of(S, axles(S)[1])
        for sx in (1, -1):
            rbox(M, (sx * (xi - 0.14), ya, zf + 0.12), (0.3, 0.26, 0.9), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'trim', 'body', seg=(2, 2), e=0.3)
        # hitch and receiver
        box(M, (0, y_of(S, 1) + 0.1, curve(S['sill'], 1) + 0.02), (0.07, 0.07, 0.3), RF, 'trim', 'bumpR')
        # running boards
        for sx in (1, -1):
            box(M, (sx * (S['W'] / 2 - 0.08), y_of(S, (S['doors'][0][0] + S['doors'][-1][1]) / 2), curve(S['sill'], 0.5) - 0.06),
                (0.16, (S['doors'][-1][1] - S['doors'][0][0]) * S['L'], 0.04), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'trim', 'body')


def muscle_extra(M, S, Sf, lo):
    if lo:
        return
    # power bulge with a scoop on the hood
    h0, h1 = S['hood']
    t = (h0 + h1) / 2 + 0.03
    p = Sf.hit((0, y_of(S, t), 3), (0, 0, -1))
    if p:
        rbox(M, p[0] + Vector((0, 0, 0.0)), (0.7, (h1 - h0) * S['L'] * 0.65, 0.07), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'paint', 'hood', seg=(4, 2), e=0.25)
        box(M, p[0] + Vector((0, -0.25, 0.045)), (0.36, 0.06, 0.03), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'trim', 'hood')
    # ducktail spoiler lip
    tz = curve(S['belt'], 0.97)
    box(M, (0, y_of(S, 0.975), tz + 0.03), (S['W'] - 0.3, 0.12, 0.025), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'paint', 'trunk')


def sports_extra(M, S, Sf, lo):
    C = S['cabin']
    # rear wing on two posts
    t = 0.955
    z = curve(S['belt'], t)
    y = y_of(S, t)
    wz = z + 0.2
    if lo:
        box(M, (0, y, wz), (S['W'] - 0.25, 0.26, 0.03), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'trim', 'trunk')
        return
    prof = [(0, 0), (0.06, 0.018), (0.16, 0.022), (0.28, 0.008), (0.3, 0)]
    hwg = S['W'] / 2 - 0.12
    top, bot = [], []
    for sx in (1, -1):
        top.append([M.vert((sx * hwg, y - 0.12 + a, wz + b)) for a, b in prof])
        bot.append([M.vert((sx * hwg, y - 0.12 + a, wz - b * 0.4)) for a, b in prof])
    n = len(prof)
    for k in range(n - 1):
        M.quad(top[1][k], top[1][k + 1], top[0][k + 1], top[0][k], 'trim', 'trunk')
        M.quad(bot[0][k], bot[0][k + 1], bot[1][k + 1], bot[1][k], 'trim', 'trunk')
    for sx_i, sx in ((0, 1), (1, -1)):
        ring = top[sx_i] + bot[sx_i][::-1][1:-1]
        M.face(ring if sx > 0 else ring[::-1], 'trim', 'trunk')
        box(M, (sx * (hwg - 0.25), y + 0.02, z + 0.1), (0.025, 0.12, 0.2), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'trim', 'trunk')
    # side intakes behind the doors
    for sx in (1, -1):
        t0 = S['doors'][0][1] + 0.01
        z0 = curve(S['sill'], t0) + 0.18
        patch(M, Sf, [(sx * 2, y_of(S, t0), z0), (sx * 2, y_of(S, t0 + 0.08), z0 + 0.02), (sx * 2, y_of(S, t0 + 0.07), z0 + 0.2), (sx * 2, y_of(S, t0), z0 + 0.12)],
              (-sx, 0, 0), 4, 2, 0.004, 'trim', 'body', wall='trim')
    # engine cover glass slats
    for k in range(3):
        tt = C['c'] + 0.02 + k * 0.025
        p = Sf.hit((0, y_of(S, tt), 3), (0, 0, -1))
        if p:
            box(M, p[0] + Vector((0, 0, 0.006)), (0.6, 0.03, 0.008), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'trim', 'trunk')


def roadster_extra(M, S, Sf, lo):
    C = S['cabin']
    zb = curve(S['belt'], C['c'] - 0.02)
    y = y_of(S, C['c']) - 0.12
    Rf = (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0)))
    for sx in (1, -1):
        if lo:
            box(M, (sx * 0.37, y, zb + 0.12), (0.4, 0.24, 0.12), Rf, 'trim', 'cabin')
            continue
        # roll hoops behind the seats with a fairing
        rbox(M, (sx * 0.37, y + 0.12, zb + 0.02), (0.44, 0.07, 0.5), Rf, 'paint', 'cabin', seg=(4, 2), e=0.4)
        pts = [(sx * (0.37 + 0.2 * math.cos(a)), y, zb + 0.02 + 0.22 * math.sin(a)) for a in [math.pi * k / 8 for k in range(9)]]
        tube(M, pts, 0.022, 6, 'chrome', 'cabin')
    if not lo:
        # soft-top folded under a tonneau
        rbox(M, (0, y + 0.42, zb + 0.0), (S['W'] - 0.42, 0.06, 0.45), Rf, 'trim', 'cabin', seg=(4, 2), e=0.3)


def limo_extra(M, S, Sf, lo):
    if lo:
        return
    # bar / bench along the stretched cabin
    C = S['cabin']
    z = S.get('hip', 0.5)
    ya, yb = y_of(S, 0.4), y_of(S, 0.62)
    rbox(M, (-0.55, (ya + yb) / 2, z - 0.05), (0.42, 0.12, yb - ya), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'interior', 'interior', seg=(3, 2), e=0.3)
    rbox(M, (0.62, (ya + yb) / 2, z + 0.05), (0.3, 0.5, yb - ya), (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0))), 'trim', 'interior', seg=(3, 2), e=0.3)


# compact hatchback (Golf class): 4.28 x 1.79 x 1.46 m, wheelbase 2.62 m, 205/55R16
spec('hatch', **base_spec(4.28, 1.79, 1.46, 2.62, 0.88, 0.316, 1.55,
    belt=[(0, 0.62), (0.015, 0.72), (0.05, 0.79), (0.12, 0.84), (0.22, 0.88), (0.31, 0.93), (0.6, 0.98), (0.9, 1.0), (0.97, 0.99), (0.995, 0.92), (1, 0.85)],
    sill=[(0, 0.33), (0.06, 0.24), (0.14, 0.17), (0.86, 0.17), (0.94, 0.27), (1, 0.4)],
    plan=[(0, 0.82), (0.02, 0.9), (0.07, 0.965), (0.17, 0.995), (0.5, 1), (0.85, 0.995), (0.95, 0.97), (0.99, 0.92), (1, 0.88)],
    shdrop=[(0, 0.07), (0.15, 0.1), (1, 0.1)], tumble=0.05, rr=0.06, noseb=0.05, tailb=0.03, lean_r=0.02,
    cabin=dict(a=0.31, r1=0.49, r2=0.85, c=0.985, roof=1.46, roofw=0.8, crown=0.035, rcurve=1.2),
    doors=[(0.37, 0.56), (0.56, 0.74)], sideglass=[(0.335, 0.553), (0.567, 0.725), (0.745, 0.8)], cpillar='paint',
    hood=(0.03, 0.3), trunk=(0.983, 1.0), gate=True, bumpers=((0.055, 0.6), (0.95, 0.62)),
    head=dict(x0=0.3, x1=0.8, z0=0.69, z1=0.77, slant=0.0, wrap=0.4),
    tail=dict(x0=0.42, x1=0.85, z0=0.86, z1=0.95, wrap=0.6, part='body'),
    grille=dict(z0=0.68, z1=0.75, w=0.3, bars=1), intake=dict(z0=0.3, z1=0.52, w=0.6, fog=(0.68, 0.38)),
    plateF=(0.46, 'bumpF'), plateR=(0.72, 'trunk'), exhaust=[(-0.5, 0.032)], seat_t=0.49, rear_t=0.67))

# mid-size SUV (Explorer class): 5.05 x 2.00 x 1.78 m, wheelbase 3.03 m, 255/55R20
spec('suv', **base_spec(5.05, 2.0, 1.78, 3.03, 0.93, 0.385, 1.7,
    belt=[(0, 0.82), (0.015, 0.92), (0.05, 0.98), (0.12, 1.02), (0.2, 1.05), (0.3, 1.1), (0.6, 1.14), (0.9, 1.16), (0.97, 1.15), (0.995, 1.08), (1, 1.0)],
    sill=[(0, 0.45), (0.05, 0.36), (0.12, 0.3), (0.88, 0.3), (0.95, 0.38), (1, 0.5)],
    plan=[(0, 0.86), (0.02, 0.93), (0.07, 0.975), (0.16, 0.997), (0.5, 1), (0.86, 0.997), (0.96, 0.975), (0.995, 0.93), (1, 0.9)],
    shdrop=[(0, 0.08), (0.15, 0.12), (1, 0.12)], tumble=0.04, rr=0.06, noseb=0.05, tailb=0.03, lean_f=0.06, lean_r=0.03,
    cabin=dict(a=0.3, r1=0.44, r2=0.93, c=0.985, roof=1.78, roofw=0.82, crown=0.03, rcurve=1.2),
    doors=[(0.36, 0.56), (0.56, 0.75)], sideglass=[(0.325, 0.553), (0.567, 0.74), (0.76, 0.905)], cpillar='trim',
    hood=(0.03, 0.29), trunk=(0.983, 1.0), gate=True, bumpers=((0.05, 0.72), (0.95, 0.75)),
    clad=0.5, rocker='trim', lip=0.03, flare=0.015,
    head=dict(x0=0.42, x1=0.88, z0=0.88, z1=0.96, wrap=0.4),
    tail=dict(x0=0.62, x1=0.94, z0=0.98, z1=1.12, wrap=0.7, part='body'),
    grille=dict(z0=0.6, z1=0.9, w=0.42, bars=4, taper=0.03), intake=dict(z0=0.42, z1=0.56, w=0.62, fog=(0.72, 0.5)),
    plateF=(0.5, 'bumpF'), plateR=(0.86, 'trunk'), exhaust=[(-0.6, 0.04), (0.6, 0.04)],
    floor=0.5, hip=0.78, seat_t=0.48, rear_t=0.67, extra=suv_extra))

# half-ton crew-cab pickup (F-150 SuperCrew 5.5 ft bed): 5.89 x 2.03 x 1.96 m, wheelbase 3.68 m, 275/65R18
spec('pickup', **base_spec(5.89, 2.03, 1.96, 3.68, 0.99, 0.405, 1.73,
    belt=[(0, 1.0), (0.012, 1.08), (0.04, 1.13), (0.1, 1.16), (0.2, 1.19), (0.29, 1.22), (0.5, 1.26), (0.7, 1.28), (0.98, 1.28), (1, 1.24)],
    sill=[(0, 0.5), (0.04, 0.42), (0.1, 0.4), (0.9, 0.4), (0.96, 0.45), (1, 0.52)],
    plan=[(0, 0.9), (0.02, 0.96), (0.06, 0.99), (0.15, 1), (0.98, 1), (1, 0.985)],
    shdrop=[(0, 0.1), (0.1, 0.14), (1, 0.14)], tumble=0.03, rr=0.05, noseb=0.03, tailb=0.0, lean_f=0.05, lean_r=0.0,
    cabin=dict(a=0.289, r1=0.382, r2=0.655, c=0.68, roof=1.96, roofw=0.85, crown=0.03, rcurve=1.0),
    doors=[(0.314, 0.5), (0.5, 0.654)], sideglass=[(0.31, 0.493), (0.508, 0.64)], bed=(0.69, 0.99), keep_seam=True,
    hood=(0.025, 0.28), trunk=None, tg=True, bumpers=((0.05, 0.72), (0.975, 0.75)), bumper_m='chrome', lip=0.035,
    head=dict(x0=0.5, x1=0.92, z0=1.0, z1=1.1, wrap=0.35),
    tail=dict(x0=0.86, x1=1.0, z0=0.88, z1=1.2, wrap=1.6, part='body'),
    grille=dict(z0=0.74, z1=1.1, w=0.5, bars=2, bar_m='chrome'),
    plateF=(0.56, 'bumpF'), plateR=(0.56, 'bumpR'), exhaust=[(-0.7, 0.04)],
    floor=0.56, hip=0.86, seat_t=0.43, rear_t=0.59, extra=pickup_bed, bed_floor=0.92, mirror_k=1.2))
spec('monster', share='pickup')

# minivan (Odyssey / Sienna class): 5.21 x 1.99 x 1.77 m, wheelbase 3.0 m, 235/60R18
spec('minivan', **base_spec(5.21, 1.99, 1.77, 3.0, 1.0, 0.37, 1.73,
    belt=[(0, 0.7), (0.015, 0.8), (0.05, 0.88), (0.12, 0.93), (0.2, 0.97), (0.27, 1.0), (0.6, 1.05), (0.9, 1.08), (0.97, 1.06), (0.995, 0.98), (1, 0.9)],
    sill=[(0, 0.37), (0.05, 0.28), (0.12, 0.21), (0.88, 0.21), (0.95, 0.3), (1, 0.42)],
    plan=[(0, 0.84), (0.02, 0.92), (0.07, 0.97), (0.16, 0.996), (0.5, 1), (0.86, 0.997), (0.96, 0.975), (0.995, 0.93), (1, 0.9)],
    shdrop=[(0, 0.08), (0.15, 0.11), (1, 0.11)], tumble=0.05, rr=0.06, noseb=0.06, tailb=0.03, lean_f=0.15, lean_r=0.03,
    cabin=dict(a=0.25, r1=0.42, r2=0.94, c=0.985, roof=1.77, roofw=0.83, crown=0.035, rcurve=1.2, wcurve=1.8),
    doors=[(0.32, 0.5), (0.5, 0.72)], slide=True, sideglass=[(0.29, 0.493), (0.507, 0.7), (0.73, 0.925)], cpillar='trim',
    hood=(0.03, 0.24), trunk=(0.983, 1.0), gate=True, bumpers=((0.055, 0.62), (0.95, 0.64)),
    head=dict(x0=0.4, x1=0.88, z0=0.72, z1=0.81, slant=0.02, wrap=0.45),
    tail=dict(x0=0.55, x1=0.95, z0=0.95, z1=1.08, wrap=0.7, part='body'),
    grille=dict(z0=0.56, z1=0.72, w=0.42, bars=3, taper=0.03), intake=dict(z0=0.32, z1=0.47, w=0.6, fog=(0.7, 0.4)),
    plateF=(0.48, 'bumpF'), plateR=(0.8, 'trunk'), exhaust=[(-0.6, 0.035)], floor=0.36, hip=0.66, seat_t=0.42, rear_t=0.63, extra=roof_rails))

# muscle coupe (Challenger class): 5.02 x 1.92 x 1.45 m, wheelbase 2.95 m, 245/45R20
spec('muscle', **base_spec(5.0, 1.93, 1.42, 2.95, 0.97, 0.36, 1.62,
    belt=[(0, 0.72), (0.012, 0.79), (0.04, 0.84), (0.1, 0.86), (0.25, 0.9), (0.36, 0.94), (0.6, 0.98), (0.85, 1.0), (0.96, 1.0), (0.99, 0.95), (1, 0.88)],
    sill=[(0, 0.32), (0.05, 0.22), (0.13, 0.16), (0.87, 0.16), (0.95, 0.24), (1, 0.34)],
    plan=[(0, 0.9), (0.015, 0.96), (0.05, 0.99), (0.15, 1), (0.85, 1), (0.95, 0.985), (0.99, 0.95), (1, 0.92)],
    shdrop=[(0, 0.08), (0.15, 0.11), (1, 0.11)], tumble=0.06, rr=0.05, noseb=0.02, tailb=0.02, lean_f=-0.1, lean_r=0.0, flare=0.02,
    cabin=dict(a=0.36, r1=0.51, r2=0.66, c=0.85, roof=1.42, roofw=0.74, crown=0.03, rcurve=1.3),
    doors=[(0.4, 0.64)], sideglass=[(0.39, 0.632), (0.645, 0.735)], cpillar='paint',
    hood=(0.025, 0.35), trunk=(0.855, 0.98), bumpers=((0.04, 0.55), (0.96, 0.62)),
    head=dict(round=[(0.62, 0.66, 0.065), (0.78, 0.66, 0.065)], wrap=0.05),
    tail=dict(x0=0.1, x1=0.88, z0=0.84, z1=0.93, wrap=0.25, centre=True),
    grille=dict(z0=0.56, z1=0.76, w=0.5, bars=2, surround='chrome', bar_m='trim'),
    intake=dict(z0=0.3, z1=0.44, w=0.65), plateF=(0.42, 'bumpF'), plateR=(0.66, 'bumpR'),
    exhaust=[(-0.6, 0.048), (0.6, 0.048)], hip=0.48, floor=0.24, extra=muscle_extra))

# mid-engine sports car (C8 class): 4.63 x 1.93 x 1.24 m, wheelbase 2.72 m
spec('sports', **base_spec(4.6, 1.93, 1.24, 2.72, 1.0, 0.34, 1.65,
    belt=[(0, 0.5), (0.012, 0.56), (0.05, 0.62), (0.15, 0.68), (0.27, 0.74), (0.5, 0.84), (0.75, 0.9), (0.95, 0.92), (0.99, 0.86), (1, 0.78)],
    sill=[(0, 0.2), (0.05, 0.14), (0.13, 0.11), (0.87, 0.11), (0.95, 0.17), (1, 0.3)],
    plan=[(0, 0.76), (0.02, 0.86), (0.08, 0.95), (0.2, 0.985), (0.45, 0.965), (0.75, 1), (0.95, 0.98), (0.99, 0.92), (1, 0.88)],
    shdrop=[(0, 0.05), (0.15, 0.08), (0.5, 0.12), (1, 0.1)], tumble=0.08, rr=0.06, noseb=0.12, tailb=0.03, lean_f=0.5, lean_r=0.1, flare=0.035,
    cabin=dict(a=0.3, r1=0.45, r2=0.56, c=0.88, roof=1.24, roofw=0.62, crown=0.03, rcurve=1.0, wcurve=1.3),
    doors=[(0.33, 0.58)], sideglass=[(0.31, 0.57)], cpillar='paint',
    hood=(0.02, 0.29), trunk=(0.885, 0.985), bumpers=((0.05, 0.5), (0.95, 0.6)),
    head=dict(x0=0.45, x1=0.84, z0=0.41, z1=0.47, slant=0.02, wrap=0.55, proj=3),
    tail=dict(x0=0.48, x1=0.88, z0=0.8, z1=0.86, wrap=0.5, bar=True),
    grille=dict(z0=0.32, z1=0.4, w=0.45, bars=1), intake=dict(z0=0.18, z1=0.3, w=0.7),
    plateF=None, plateR=(0.5, 'bumpR'), exhaust=[(-0.08, 0.04), (0.08, 0.04), (-0.2, 0.04), (0.2, 0.04)],
    floor=0.16, hip=0.36, seat_x=0.38, recline=24, extra=sports_extra))

# two-seat roadster (Z4 / MX-5 class): 4.32 x 1.86 x 1.30 m, wheelbase 2.47 m
spec('convertible', **base_spec(4.32, 1.86, 1.3, 2.47, 0.86, 0.33, 1.6,
    belt=[(0, 0.6), (0.015, 0.67), (0.05, 0.73), (0.15, 0.78), (0.3, 0.84), (0.45, 0.88), (0.7, 0.92), (0.9, 0.94), (0.97, 0.92), (0.995, 0.85), (1, 0.76)],
    sill=[(0, 0.25), (0.05, 0.18), (0.13, 0.14), (0.87, 0.14), (0.95, 0.2), (1, 0.3)],
    plan=[(0, 0.8), (0.02, 0.89), (0.07, 0.96), (0.17, 0.99), (0.5, 0.98), (0.8, 1), (0.95, 0.97), (0.99, 0.9), (1, 0.86)],
    shdrop=[(0, 0.06), (0.15, 0.1), (1, 0.1)], tumble=0.06, rr=0.06, noseb=0.08, tailb=0.04, lean_f=0.3, flare=0.02,
    cabin=dict(a=0.42, r1=0.52, r2=0.6, c=0.78, roof=1.3, roofw=0.72, crown=0.01, wcurve=1.2),
    doors=[(0.44, 0.66)], sideglass=[], open=True, noantenna=True,
    hood=(0.025, 0.4), trunk=(0.79, 0.975), bumpers=((0.05, 0.56), (0.95, 0.62)),
    head=dict(x0=0.45, x1=0.84, z0=0.65, z1=0.72, slant=0.02, wrap=0.5),
    tail=dict(x0=0.5, x1=0.86, z0=0.8, z1=0.87, wrap=0.55),
    grille=dict(z0=0.42, z1=0.58, w=0.26, bars=2), intake=dict(z0=0.26, z1=0.38, w=0.6),
    plateF=(0.4, 'bumpF'), plateR=(0.62, 'bumpR'), exhaust=[(-0.5, 0.04), (0.5, 0.04)],
    floor=0.2, hip=0.42, seat_t=0.6, recline=22, extra=roadster_extra))

# stretch limousine (Town Car, 100 in stretch): 8.0 x 1.99 x 1.48 m, wheelbase 5.55 m
spec('limo', **base_spec(8.0, 1.99, 1.48, 5.55, 1.0, 0.345, 1.6,
    belt=[(0, 0.64), (0.01, 0.74), (0.025, 0.8), (0.06, 0.85), (0.12, 0.88), (0.17, 0.92), (0.5, 0.95), (0.9, 1.0), (0.97, 0.99), (0.995, 0.92), (1, 0.82)],
    sill=[(0, 0.34), (0.03, 0.24), (0.08, 0.17), (0.92, 0.17), (0.97, 0.25), (1, 0.36)],
    plan=[(0, 0.84), (0.012, 0.92), (0.04, 0.975), (0.1, 0.998), (0.9, 0.998), (0.97, 0.975), (0.995, 0.92), (1, 0.88)],
    shdrop=[(0, 0.07), (0.1, 0.1), (1, 0.1)], tumble=0.04, rr=0.06, noseb=0.03, lean_f=-0.05, step=0.3, gstep=0.2,
    cabin=dict(a=0.17, r1=0.235, r2=0.83, c=0.89, roof=1.48, roofw=0.8, crown=0.035),
    doors=[(0.205, 0.33), (0.71, 0.82)], sideglass=[(0.19, 0.322), (0.345, 0.52), (0.53, 0.7), (0.725, 0.81)], cpillar='paint',
    hood=(0.02, 0.165), trunk=(0.895, 0.985), bumpers=((0.035, 0.6), (0.97, 0.68)), bumper_m='chrome', belt_m='chrome',
    head=dict(x0=0.4, x1=0.86, z0=0.62, z1=0.72, wrap=0.3),
    tail=dict(x0=0.4, x1=0.9, z0=0.8, z1=0.9, wrap=0.5),
    grille=dict(z0=0.48, z1=0.68, w=0.34, bars=5, surround='chrome', bar_m='chrome'),
    plateF=(0.42, 'bumpF'), plateR=(0.64, 'bumpR'), exhaust=[(-0.6, 0.035), (0.6, 0.035)],
    seat_t=0.27, rear_t=0.76, extra=limo_extra))

# full-size cargo van (Express / Savana class): 5.69 x 2.01 x 2.08 m, wheelbase 3.43 m
spec('van', **base_spec(5.69, 2.01, 2.08, 3.43, 0.92, 0.37, 1.73,
    belt=[(0, 0.86), (0.015, 0.95), (0.04, 1.0), (0.1, 1.05), (0.17, 1.08), (0.2, 1.13), (0.5, 1.15), (0.97, 1.16), (1, 1.12)],
    sill=[(0, 0.42), (0.04, 0.36), (0.1, 0.33), (0.9, 0.33), (0.96, 0.38), (1, 0.45)],
    plan=[(0, 0.88), (0.02, 0.95), (0.06, 0.985), (0.14, 1), (0.995, 1), (1, 0.985)],
    shdrop=[(0, 0.1), (0.1, 0.13), (1, 0.13)], tumble=0.03, rr=0.05, noseb=0.03, tailb=0.0, lean_f=0.05, lean_r=0.0,
    cabin=dict(a=0.18, r1=0.28, r2=0.99, c=0.997, roof=2.08, roofw=0.92, crown=0.03, rcurve=1.0),
    doors=[(0.2, 0.34)], sideglass=[(0.19, 0.335)], cargo=True, cargo_rear=True, closed_top=False,
    hood=(0.03, 0.17), trunk=(0.997, 1.0), tg=True, bumpers=((0.04, 0.68), (0.97, 0.66)), bumper_m='trim',
    head=dict(x0=0.5, x1=0.88, z0=0.78, z1=0.88, wrap=0.3),
    tail=dict(x0=0.86, x1=1.0, z0=0.78, z1=1.14, wrap=1.6, part='body'),
    grille=dict(z0=0.6, z1=0.84, w=0.46, bars=2, surround='chrome'),
    plateF=(0.52, 'bumpF'), plateR=(0.54, 'bumpR'), exhaust=[(-0.7, 0.04)], chmsl=False,
    floor=0.5, hip=0.86, seat_t=0.29, mirror_k=1.3))


# ---------------------------------------------------------------- trucks: a lofted cab + a body on a chassis
def slab(M, x0, x1, y0, y1, z0, z1, m, part, r=0.0, seg=2, caps=(True, True), mats=None):
    """box from y0 to y1 with rounded vertical/horizontal edges of radius r (cross-section in x/z)"""
    hw = (x1 - x0) / 2
    cx = (x0 + x1) / 2
    pts = []
    if r <= 0:
        pts = [(x1, z0), (x1, z1), (x0, z1), (x0, z0)]
    else:
        for (ccx, ccz, a0) in ((x1 - r, z0 + r, -90), (x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180)):
            for k in range(seg + 1):
                a = math.radians(a0 + 90 * k / seg)
                pts.append((ccx + math.cos(a) * r, ccz + math.sin(a) * r))
    A = [M.vert((x, y0, z)) for x, z in pts]
    B = [M.vert((x, y1, z)) for x, z in pts]
    n = len(pts)
    for k in range(n):
        k2 = (k + 1) % n
        mm = m
        if mats:
            xm, zm = (pts[k][0] + pts[k2][0]) / 2, (pts[k][1] + pts[k2][1]) / 2
            if zm < z0 + 0.01:
                mm = mats.get('bottom', m)
            elif zm > z1 - 0.01:
                mm = mats.get('top', m)
        M.quad(A[k], B[k], B[k2], A[k2], mm, part)
    if caps[0]:
        M.face(A, m if not mats else mats.get('front', m), part)
    if caps[1]:
        M.face(B[::-1], m if not mats else mats.get('rear', m), part)


def panel(M, c, R, w, h, m, part, uv=None):
    """flat quad centred at c in the plane (R[0], R[1]), facing R[2]. uv box (u0, v0, u1, v1) reads left to right"""
    c = Vector(c)
    vs = [M.vert(c + R[0] * a * w / 2 + R[1] * b * h / 2) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    uvs = None
    if uv:
        u0, v0, u1, v1 = uv
        uvs = [(u0 + (u1 - u0) * (0.5 + 0.5 * a), v0 + (v1 - v0) * (0.5 + 0.5 * b)) for (a, b) in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    M.face(vs, m, part, uvs)


RX = lambda sx: (Vector((0, sx, 0)), Vector((0, 0, 1)), Vector((sx, 0, 0)))  # on a side face (+x side when sx=1)
RF = (Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, -1, 0)))  # facing forward (-y)
RB = (Vector((-1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0)))  # facing back (+y)
RU = (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)))  # facing up


def chassis(M, S, y0, y1, lo, fuel=True):
    """frame rails, fuel tank, mud flaps, rear bumper bar"""
    zr = S.get('frame_z', 0.85)
    for sx in (1, -1):
        slab(M, sx * 0.43 - 0.05, sx * 0.43 + 0.05, y0, y1, zr - 0.12, zr + 0.12, 'trim', 'cargo')
    if lo:
        return
    if fuel:
        yt = y0 + 0.6
        cyl(M, (S['W'] / 2 - 0.35, yt, zr - 0.15), (S['W'] / 2 - 0.35, yt + 0.8, zr - 0.15), 0.25, 10, 'chrome', 'cargo')
    for sx in (1, -1):
        box(M, (sx * (S['track'] / 2), y1 - 0.25, 0.45), (0.5, 0.02, 0.6), RB, 'trim', 'cargo')
    slab(M, -S['W'] / 2 + 0.1, S['W'] / 2 - 0.1, y1 - 0.05, y1 + 0.08, 0.5, 0.65, 'trim', 'cargo', r=0.02, seg=1)


def side_markers(M, x, ys, z, part, m='lamp_amber', sx=(1, -1)):
    for s in sx:
        for y in ys:
            box(M, (s * x, y, z), (0.12, 0.06, 0.02), RX(s), m, part)


def cab_truck(key, S, total, kind):
    """cab built by the car loft, shifted to the front of a longer vehicle; the body behind it is 'cargo'"""
    root = build_car(key, S)
    dy = -(total - S['L']) / 2
    for c in root.children:
        c.location.y += dy
    Mh, Ml = Mesh(), Mesh()
    yc = -total / 2 + S['L']  # back of the cab
    yR = total / 2
    lamps = {}
    for M, lo in ((Mh, False), (Ml, True)):
        lamps = BODY[kind](M, S, total, yc, yR, lo) or lamps
    assemble(key, root, Mh, Ml, None)
    names = {c.name.split('__')[-1].split('.')[0]: c for c in root.children}
    for k, p in lamps.items():
        if k in names:
            names[k].location = p
        else:
            E(root, k, p)
    # extra rear wheels (duals / tandems): any w_ empty is a wheel in the game
    ry = -total / 2 + S['fo'] + S['wb']
    tandem = S.get('tandem', 0)
    for nm in ('w_RL', 'w_RR'):
        if nm in names:
            names[nm].location.y = ry - tandem / 2
    k = 2
    for sx in (1, -1):
        if S.get('duals'):
            E(root, ('w_RL' if sx > 0 else 'w_RR') + str(k), (sx * (S['track'] / 2 - 0.29), ry - tandem / 2, S['r']))
        if tandem:
            E(root, ('w_RL' if sx > 0 else 'w_RR') + str(k + 1), (sx * S['track'] / 2, ry + tandem / 2, S['r']))
            if S.get('duals'):
                E(root, ('w_RL' if sx > 0 else 'w_RR') + str(k + 2), (sx * (S['track'] / 2 - 0.29), ry + tandem / 2, S['r']))
    return root


def box_body(M, S, total, yc, yR, lo):
    """16 ft dry-freight box with a roll-up rear door"""
    W = 2.44
    y0 = yc + 0.12
    chassis(M, S, yc - 0.3, yR - 0.05, lo)
    slab(M, -W / 2, W / 2, y0, yR, 1.05, 3.35, 'paint2', 'cargo', r=0.04 if not lo else 0, seg=1, mats={'bottom': 'trim'})
    if not lo:
        # corner posts, top rails and the rear door frame
        for sx in (1, -1):
            slab(M, sx * W / 2 - 0.035, sx * W / 2 + 0.035, yR - 0.08, yR + 0.02, 1.05, 3.35, 'chrome', 'cargo')
            slab(M, sx * W / 2 - 0.035, sx * W / 2 + 0.035, y0 - 0.02, y0 + 0.06, 1.05, 3.35, 'chrome', 'cargo')
            slab(M, sx * (W / 2 + 0.008) - 0.012, sx * (W / 2 + 0.008) + 0.012, y0, yR, 3.28, 3.36, 'chrome', 'cargo', caps=(False, False))
            slab(M, sx * (W / 2 + 0.008) - 0.012, sx * (W / 2 + 0.008) + 0.012, y0, yR, 1.03, 1.12, 'trim', 'cargo', caps=(False, False))
        # roll-up door slats
        for k in range(12):
            z = 1.2 + k * 0.17
            panel(M, (0, yR + 0.004, z), RB, W - 0.2, 0.012, 'trim', 'cargo')
        box(M, (0, yR + 0.03, 1.22), (0.25, 0.04, 0.05), RB, 'chrome', 'cargo')
        side_markers(M, W / 2 + 0.005, (y0 + 0.2,), 3.2, 'cargo')
        side_markers(M, W / 2 + 0.005, (yR - 0.2,), 3.2, 'cargo', 'lamp_tail')
        for x in (-0.3, 0, 0.3):
            box(M, (x, yR + 0.004, 3.3), (0.1, 0.02, 0.04), RB, 'lamp_tail', 'cargo')
        # tail lamps on the rear sill
        for sx in (1, -1):
            box(M, (sx * 0.95, yR + 0.03, 0.9), (0.3, 0.04, 0.12), RB, 'lamp_tail', 'cargo')
            box(M, (sx * 0.62, yR + 0.03, 0.9), (0.14, 0.04, 0.12), RB, 'lamp_rev', 'cargo')
        panel(M, (0, yR + 0.09, 0.73), RB, 0.305, 0.152, 'plate', 'cargo', uv=(0.0, 0.0, 0.5, 0.25))
    return {'lamp_tail_L': (0.95, yR + 0.05, 0.9), 'lamp_tail_R': (-0.95, yR + 0.05, 0.9)}


def garbage_body(M, S, total, yc, yR, lo):
    """rear-loader refuse body: a tall hopper, then the packer tailgate with its loading opening"""
    W = 2.48
    y0 = yc + 0.1
    yt = yR - 1.75  # tailgate seam
    chassis(M, S, yc - 0.3, yR - 0.3, lo, fuel=False)
    slab(M, -W / 2, W / 2, y0, yt, 1.0, 3.45, 'paint2', 'cargo', r=0.12 if not lo else 0, seg=2, mats={'bottom': 'trim'})
    # tailgate: slopes back from the roof to the hopper lip
    tg = [(yt, 1.0), (yt, 3.45), (yt + 0.9, 3.3), (yR, 2.0), (yR, 1.1), (yR - 0.3, 0.75), (yt + 0.2, 0.75)]
    for sx in (1, -1):
        vs = [M.vert((sx * (W / 2 - 0.02), y, z)) for y, z in tg]
        M.face(vs if sx < 0 else vs[::-1], 'paint', 'cargo')
    n = len(tg)
    for k in range(n):
        k2 = (k + 1) % n
        a, b = tg[k], tg[k2]
        q = [M.vert((W / 2 - 0.02, a[0], a[1])), M.vert((W / 2 - 0.02, b[0], b[1])), M.vert((-W / 2 + 0.02, b[0], b[1])), M.vert((-W / 2 + 0.02, a[0], a[1]))]
        M.face(q, 'trim' if k == 4 else 'paint', 'cargo')
    if not lo:
        # hopper opening (dark) and the riding steps / grab bars
        panel(M, (0, yR + 0.004, 1.55), RB, W - 0.3, 0.75, 'trim', 'cargo')
        for sx in (1, -1):
            box(M, (sx * (W / 2 - 0.25), yR + 0.2, 0.62), (0.45, 0.35, 0.04), RU, 'chrome', 'cargo')
            tube(M, [(sx * (W / 2 + 0.03), yR - 0.4, 1.4), (sx * (W / 2 + 0.06), yR - 0.4, 2.2)], 0.02, 5, 'chrome', 'cargo')
            # body ribs
            for k in range(5):
                y = y0 + 0.5 + k * (yt - y0 - 0.8) / 4
                slab(M, sx * (W / 2) - 0.03, sx * (W / 2) + 0.03, y - 0.05, y + 0.05, 1.05, 3.4, 'paint2', 'cargo', caps=(False, False))
            # hydraulic cylinder for the tailgate
            cyl(M, (sx * (W / 2 + 0.06), yt - 0.4, 2.6), (sx * (W / 2 + 0.06), yt + 0.5, 3.2), 0.06, 8, 'chrome', 'cargo')
        side_markers(M, W / 2 + 0.005, (y0 + 0.2, yt - 0.2), 3.3, 'cargo')
        for sx in (1, -1):
            box(M, (sx * (W / 2 - 0.15), yR + 0.02, 2.2), (0.18, 0.04, 0.3), RB, 'lamp_tail', 'cargo')
            box(M, (sx * (W / 2 - 0.15), yR + 0.02, 2.55), (0.18, 0.04, 0.16), RB, 'lamp_amber', 'cargo')
        # beacon on the cab roof
        cyl(M, (0, yc - 0.6, S['cabin']['roof'] + 0.03), (0, yc - 0.6, S['cabin']['roof'] + 0.15), 0.08, 10, 'lamp_amber', 'cargo')
    return {'lamp_tail_L': (W / 2 - 0.15, yR + 0.04, 2.2), 'lamp_tail_R': (-W / 2 + 0.15, yR + 0.04, 2.2)}


def tow_body(M, S, total, yc, yR, lo):
    """wrecker: side toolboxes, deck, hydraulic boom with hazard stripes and a wheel-lift"""
    W = 2.36
    y0 = yc + 0.12
    chassis(M, S, yc - 0.3, yR - 0.1, lo, fuel=False)
    for sx in (1, -1):
        xa, xb = sorted((sx * W / 2, sx * (W / 2 - 0.5)))
        slab(M, xa, xb, y0, yR - 0.35, 0.62, 1.45, 'paint', 'cargo', r=0.03 if not lo else 0, seg=1)
        if not lo:
            for k in range(3):
                yy = y0 + 0.15 + k * (yR - 0.5 - y0) / 3
                panel(M, (sx * (W / 2 + 0.003), yy + (yR - 0.5 - y0) / 6 - 0.05, 1.03), RX(sx), (yR - 0.5 - y0) / 3 - 0.1, 0.7, 'chrome', 'cargo')
                box(M, (sx * (W / 2 + 0.012), yy + (yR - 0.5 - y0) / 6 - 0.05, 1.25), (0.14, 0.04, 0.02), RX(sx), 'trim', 'cargo')
    slab(M, -W / 2 + 0.5, W / 2 - 0.5, y0, yR - 0.35, 1.0, 1.08, 'trim', 'cargo')
    # boom: from the deck up and back
    by0, by1 = y0 + 0.6, yR - 0.2
    if lo:
        box(M, (0, (by0 + by1) / 2, 1.75), (0.3, by1 - by0, 0.3), (Vector((1, 0, 0)), Vector((0, math.cos(0.25), math.sin(0.25))), Vector((0, -math.sin(0.25), math.cos(0.25)))), 'decal', 'cargo')
    else:
        bm = Mesh()
        a = 0.28
        Rb = (Vector((1, 0, 0)), Vector((0, math.cos(a), math.sin(a))), Vector((0, -math.sin(a), math.cos(a))))
        c = Vector((0, (by0 + by1) / 2, 1.55))
        Lb = by1 - by0 + 0.4
        # four faces with hazard-stripe UVs (uv box 0.75, 0.25 - 1, 0.5)
        for face_n, (ax, ay) in (('+r', (1, 0)), ('-r', (-1, 0)), ('+n', (0, 1)), ('-n', (0, -1))):
            pass
        hx, hz = 0.15, 0.15
        corners = [(-hx, -hz), (hx, -hz), (hx, hz), (-hx, hz)]
        ends = []
        for s_ in (-1, 1):
            ends.append([M.vert(c + Rb[0] * x + Rb[1] * s_ * Lb / 2 + Rb[2] * z) for x, z in corners])
        for k in range(4):
            k2 = (k + 1) % 4
            uv = [(0.75, 0.25), (0.75, 0.5), (1.0, 0.5), (1.0, 0.25)]
            M.face([ends[0][k], ends[1][k], ends[1][k2], ends[0][k2]][::-1], 'decal', 'cargo', uv[::-1])
        M.face(ends[0], 'trim', 'cargo')
        M.face(ends[1][::-1], 'trim', 'cargo')
        cyl(M, (0, by0 + 0.3, 1.1), (0, by0 + 1.2, 1.6), 0.07, 8, 'chrome', 'cargo')
        # cable and hook at the boom tip
        tip = c + Rb[1] * Lb / 2 + Rb[2] * -0.1
        cyl(M, tip, tip + Vector((0, 0.02, -0.7)), 0.01, 4, 'trim', 'cargo', caps=False)
        rbox(M, tip + Vector((0, 0.02, -0.76)), (0.08, 0.12, 0.04), RF, 'chrome', 'cargo', seg=(2, 2))
        # wheel-lift underneath at the back
        slab(M, -0.08, 0.08, yR - 0.5, yR + 0.3, 0.45, 0.6, 'trim', 'cargo')
        slab(M, -0.9, 0.9, yR + 0.25, yR + 0.4, 0.4, 0.55, 'decal', 'cargo')
        for sx in (1, -1):
            box(M, (sx * 0.95, yR - 0.33, 0.9), (0.26, 0.04, 0.12), RB, 'lamp_tail', 'cargo')
        # amber light bar on the cab roof
        z = S['cabin']['roof'] + 0.035
        rbox(M, (0, yc - 0.8, z + 0.05), (1.3, 0.08, 0.28), RF, 'lamp_amber', 'cargo', seg=(5, 2), e=0.3)
        rbox(M, (0, yc - 0.8, z + 0.01), (1.34, 0.04, 0.3), RF, 'trim', 'cargo', seg=(5, 2), e=0.3)
    return {'lamp_tail_L': (0.95, yR - 0.3, 0.9), 'lamp_tail_R': (-0.95, yR - 0.3, 0.9)}


def ambulance_body(M, S, total, yc, yR, lo):
    """Type III module: a white box with a red stripe, star of life, warning lamps and rear doors"""
    W = 2.36
    y0 = yc - 0.15  # the module front sits just behind the cab, overhanging it a little
    chassis(M, S, yc - 0.3, yR - 0.2, lo, fuel=False)
    slab(M, -W / 2, W / 2, y0, yR, 0.78, 2.85, 'paint2', 'cargo', r=0.06 if not lo else 0, seg=2, mats={'bottom': 'trim'})
    if lo:
        for sx in (1, -1):
            panel(M, (sx * (W / 2 + 0.004), (y0 + yR) / 2, 1.45), RX(sx), yR - y0 - 0.1, 0.28, 'decal', 'cargo', uv=(0.0, 0.25, 0.5, 0.5))
        for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_tail')):
            box(M, (sx * 0.5, y0 - 0.02, 2.75), (0.4, 0.04, 0.14), RF, nm, 'cargo')
        return {'lamp_tail_L': (0.85, yR + 0.04, 1.0), 'lamp_tail_R': (-0.85, yR + 0.04, 1.0)}
    for sx in (1, -1):
        # red stripe with AMBULANCE text, star of life, side windows, compartment doors
        panel(M, (sx * (W / 2 + 0.004), (y0 + yR) / 2, 1.45), RX(sx), yR - y0 - 0.2, 0.3, 'decal', 'cargo', uv=(0.0, 0.25, 0.5, 0.5))
        panel(M, (sx * (W / 2 + 0.004), y0 + (yR - y0) * 0.62, 2.25), RX(sx), 0.75, 0.75, 'decal', 'cargo', uv=(0.5, 0.25, 0.75, 0.5))
        panel(M, (sx * (W / 2 + 0.004), y0 + 0.55, 2.2), RX(sx), 0.6, 0.45, 'glass', 'cargo')
        for k, (ya, yb) in enumerate(((y0 + 0.25, y0 + 0.95), (yR - 0.95, yR - 0.25))):
            if sx < 0 and k == 0:
                continue
            panel(M, (sx * (W / 2 + 0.005), (ya + yb) / 2, 1.1), RX(sx), yb - ya, 0.42, 'chrome', 'cargo')
        # warning lamps at the top corners
        for y in (y0 + 0.1, yR - 0.1):
            box(M, (sx * (W / 2 - 0.12), y, 2.88), (0.18, 0.1, 0.07), RU, 'lamp_tail', 'cargo')
        for y in (y0 + 1.2, yR - 1.2):
            box(M, (sx * (W / 2 + 0.01), y, 2.65), (0.2, 0.02, 0.1), RX(sx), 'lamp_tail', 'cargo')
    # side door (right) with a window
    panel(M, (-(W / 2 + 0.006), y0 + 0.75, 1.8), RX(-1), 0.75, 1.9, 'trim', 'cargo')
    panel(M, (-(W / 2 + 0.008), y0 + 0.75, 2.25), RX(-1), 0.5, 0.45, 'glass', 'cargo')
    # front of the module above the cab: red-white-red light bar
    for x, nm in ((0.75, 'lamp_tail'), (0.25, 'lamp_head'), (-0.25, 'lamp_head'), (-0.75, 'lamp_tail')):
        rbox(M, (x, y0 - 0.02, 2.72), (0.4, 0.12, 0.05), RF, nm, 'cargo', seg=(3, 2), e=0.3)
    # rear doors: two windows, handles, lamps, step
    panel(M, (0, yR + 0.004, 1.8), RB, 0.02, 1.9, 'trim', 'cargo')
    for sx in (1, -1):
        panel(M, (sx * 0.45, yR + 0.004, 2.25), RB, 0.6, 0.5, 'glass', 'cargo')
        panel(M, (sx * 0.45, yR + 0.004, 1.45), RB, 0.75, 0.25, 'decal', 'cargo', uv=(0.0, 0.25, 0.5, 0.5))
        box(M, (sx * 0.85, yR + 0.02, 1.0), (0.2, 0.04, 0.3), RB, 'lamp_tail', 'cargo')
        box(M, (sx * 0.85, yR + 0.02, 0.85), (0.2, 0.04, 0.08), RB, 'lamp_rev', 'cargo')
        box(M, (sx * (W / 2 - 0.12), yR + 0.02, 2.88), (0.18, 0.04, 0.07), RB, 'lamp_amber', 'cargo')
    slab(M, -0.8, 0.8, yR, yR + 0.3, 0.55, 0.62, 'chrome', 'cargo')
    panel(M, (0, yR + 0.004, 0.68), RB, 0.305, 0.152, 'plate', 'cargo', uv=(0.0, 0.0, 0.5, 0.25))
    return {'lamp_tail_L': (0.85, yR + 0.04, 1.0), 'lamp_tail_R': (-0.85, yR + 0.04, 1.0)}


def fire_body(M, S, total, yc, yR, lo):
    """pumper: pump panel, roll-up compartment doors, hose bed, ladders, light bars"""
    W = 2.48
    y0 = yc + 0.1
    yp = y0 + 0.75  # pump panel width
    chassis(M, S, yc - 0.3, yR - 0.2, lo, fuel=False)
    slab(M, -W / 2, W / 2, y0, yR, 0.7, 2.35, 'paint', 'cargo', r=0.04 if not lo else 0, seg=1, mats={'bottom': 'trim'})
    if lo:
        for sx in (1, -1):
            panel(M, (sx * (W / 2 + 0.004), (yp + yR) / 2, 1.5), RX(sx), yR - yp - 0.3, 1.3, 'chrome', 'cargo')
        box(M, (0.55, (y0 + yR) / 2, 2.55), (0.5, yR - y0, 0.12), RU, 'chrome', 'cargo')
        return {'lamp_tail_L': (0.9, yR + 0.04, 0.95), 'lamp_tail_R': (-0.9, yR + 0.04, 0.95)}
    for sx in (1, -1):
        # pump panel with gauges
        panel(M, (sx * (W / 2 + 0.004), y0 + 0.37, 1.5), RX(sx), 0.66, 1.4, 'chrome', 'cargo')
        for k in range(3):
            disc_patch_flat(M, (sx * (W / 2 + 0.01), y0 + 0.2 + k * 0.17, 1.85), sx, 0.05, 'trim', 'cargo')
        cyl(M, (sx * (W / 2), y0 + 0.37, 1.1), (sx * (W / 2 + 0.12), y0 + 0.37, 1.1), 0.07, 8, 'chrome', 'cargo')
        # compartments: roll-up doors (chrome slats) separated by red posts
        n = 3
        span = yR - yp - 0.25
        for k in range(n):
            ya = yp + 0.1 + k * span / n
            yb = ya + span / n - 0.1
            if k == 1:  # rear wheel well under this one: a shorter door
                panel(M, (sx * (W / 2 + 0.004), (ya + yb) / 2, 1.75), RX(sx), yb - ya, 1.1, 'chrome', 'cargo')
            else:
                panel(M, (sx * (W / 2 + 0.004), (ya + yb) / 2, 1.5), RX(sx), yb - ya, 1.6, 'chrome', 'cargo')
            for j in range(8):
                z = 0.85 + j * 0.19 if k != 1 else 1.3 + j * 0.12
                panel(M, (sx * (W / 2 + 0.007), (ya + yb) / 2, z), RX(sx), yb - ya, 0.01, 'trim', 'cargo')
        # rub rail and a white reflective stripe
        slab(M, sx * W / 2 - 0.02, sx * W / 2 + 0.03, y0, yR, 0.72, 0.8, 'chrome', 'cargo', caps=(False, False))
        panel(M, (sx * (W / 2 + 0.006), (y0 + yR) / 2, 2.25), RX(sx), yR - y0 - 0.05, 0.1, 'paint2', 'cargo')
        # warning lamps along the body
        for y in (y0 + 0.1, (y0 + yR) / 2, yR - 0.1):
            box(M, (sx * (W / 2 + 0.01), y, 2.15), (0.16, 0.02, 0.09), RX(sx), 'lamp_tail', 'cargo')
    # hose bed on top and ladders on a rack (right side)
    slab(M, -W / 2 + 0.06, W / 2 - 0.06, yR - 2.6, yR - 0.05, 2.35, 2.5, 'trim', 'cargo')
    for k in range(5):
        slab(M, -0.9 + k * 0.4, -0.7 + k * 0.4, yR - 2.5, yR - 0.1, 2.36, 2.47, 'lamp_amber' if k % 2 else 'paint2', 'cargo', caps=(False, True))
    ly0, ly1 = y0 + 0.2, yR - 0.4
    for x0 in (-0.95, -0.55):
        for sx in (0, 1):
            xr = x0 + sx * 0.36
            slab(M, xr - 0.02, xr + 0.02, ly0, ly1, 2.62, 2.7, 'chrome', 'cargo', caps=(True, True))
        for k in range(int((ly1 - ly0) / 0.3) + 1):
            yy = ly0 + k * 0.3
            cyl(M, (x0, yy, 2.66), (x0 + 0.36, yy, 2.66), 0.012, 4, 'chrome', 'cargo', caps=False)
    for y in (ly0 + 0.3, ly1 - 0.3):
        slab(M, -1.1, -0.35, y - 0.04, y + 0.04, 2.35, 2.62, 'trim', 'cargo')
    # rear: tail step, lamps, plate
    slab(M, -W / 2 + 0.1, W / 2 - 0.1, yR, yR + 0.35, 0.5, 0.6, 'chrome', 'cargo')
    for sx in (1, -1):
        box(M, (sx * 0.95, yR + 0.02, 0.95), (0.22, 0.04, 0.22), RB, 'lamp_tail', 'cargo')
        box(M, (sx * 0.95, yR + 0.02, 1.2), (0.22, 0.04, 0.12), RB, 'lamp_amber', 'cargo')
        box(M, (sx * 0.95, yR + 0.02, 2.2), (0.22, 0.04, 0.12), RB, 'lamp_tail', 'cargo')
    panel(M, (0, yR + 0.004, 0.9), RB, 0.305, 0.152, 'plate', 'cargo', uv=(0.0, 0.0, 0.5, 0.25))
    # cab roof light bar: red ends, white middle
    z = S['cabin']['roof'] + 0.05
    yb = -total / 2 + 0.75
    rbox(M, (0, yb, z), (2.2, 0.04, 0.3), RF, 'trim', 'cargo', seg=(5, 2), e=0.3)
    for x, nm in ((0.75, 'lamp_tail'), (0.0, 'lamp_head'), (-0.75, 'lamp_tail')):
        rbox(M, (x, yb, z + 0.05), (0.66 if x else 0.7, 0.08, 0.26), RF, nm, 'cargo', seg=(4, 2), e=0.3)
    return {'lamp_tail_L': (0.95, yR + 0.04, 0.95), 'lamp_tail_R': (-0.95, yR + 0.04, 0.95)}


def disc_patch_flat(M, c, sx, r, m, part, n=10):
    ring = [M.vert((c[0], c[1] + math.cos(2 * math.pi * k / n) * r, c[2] + math.sin(2 * math.pi * k / n) * r)) for k in range(n)]
    disk(M, ring, c, m, part, flip=sx < 0)


BODY = {'box': box_body, 'garbage': garbage_body, 'tow': tow_body, 'ambulance': ambulance_body, 'fire': fire_body}


def cabover(L, W, roof, fo, wb, r, track, **kw):
    """a flat-fronted cab (cab-over / cab-forward)"""
    d = base_spec(L, W, roof, wb, fo, r, track,
        belt=[(0, 1.3), (0.02, 1.34), (0.06, 1.36), (1, 1.38)],
        sill=[(0, 0.42), (0.03, 0.52), (1, 0.55)],
        plan=[(0, 0.93), (0.03, 0.98), (0.08, 1), (1, 1)],
        shdrop=0.15, tumble=0.02, rr=0.04, noseb=0.03, tailb=0.0, lean_f=0.03, lean_r=0.0,
        cabin=dict(a=0.035, r1=0.14, r2=0.985, c=0.998, roof=roof, roofw=0.92, crown=0.03, wcurve=1.0, rcurve=1.0),
        doors=[(0.25, 0.8)], sideglass=[(0.2, 0.79)], hood=(0, 0), trunk=None, bumpers=((0.03, 0.62), (2, 2)), bumper_m='trim',
        head=dict(x0=0.62, x1=0.92, z0=0.72, z1=0.84, wrap=0.4), tail=None,
        grille=dict(z0=0.86, z1=1.18, w=0.5, bars=4, surround='chrome'), plateF=(0.47, 'bumpF'), plateR=None,
        exhaust=[], noantenna=True, chmsl=False, mirror_k=1.7, mirror_m='trim', handle_m='chrome',
        floor=1.0, hip=1.42, seat_t=0.55, seat_x=0.48, dash_dy=0.18, cabin_end=0.95, closed_top=False)
    d.update(kw)
    return d


# box truck (Isuzu NPR class, 16 ft box): 7.3 x 2.44 x 3.4 m, wheelbase 3.81 m
spec('truck', **cabover(2.05, 2.0, 2.25, 1.1, 3.81, 0.405, 1.68, duals=True))
# rear-loader refuse truck (Mack LR / Heil class): 9.0 x 2.5 x 3.5 m
spec('garbage', **cabover(2.35, 2.45, 2.7, 1.75, 4.9, 0.5, 2.0, duals=True, tandem=1.35,
     belt=[(0, 1.1), (0.02, 1.15), (0.06, 1.18), (1, 1.2)], sill=[(0, 0.42), (0.03, 0.48), (1, 0.48)],
     cabin=dict(a=0.03, r1=0.12, r2=0.985, c=0.998, roof=2.7, roofw=0.94, crown=0.02, wcurve=1.0, rcurve=1.0),
     doors=[(0.12, 0.42)], sideglass=[(0.1, 0.41), (0.43, 0.9)], head=dict(x0=0.7, x1=1.0, z0=0.62, z1=0.74, wrap=0.4),
     grille=dict(z0=0.78, z1=1.05, w=0.6, bars=5, surround='trim'), floor=0.75, hip=1.15, seat_t=0.27, seat_x=0.55))
# wrecker on a medium-duty conventional cab (F-550 class): 6.9 x 2.4 x 2.6 m, wheelbase 4.2 m
spec('tow', **base_spec(3.2, 2.03, 2.45, 4.2, 0.95, 0.4, 1.75,
    belt=[(0, 1.12), (0.015, 1.2), (0.05, 1.26), (0.15, 1.3), (0.45, 1.34), (0.56, 1.38), (1, 1.42)],
    sill=[(0, 0.56), (0.05, 0.5), (0.15, 0.5), (1, 0.55)],
    plan=[(0, 0.88), (0.02, 0.95), (0.06, 0.985), (0.15, 1), (1, 1)],
    shdrop=[(0, 0.1), (0.1, 0.15), (1, 0.15)], tumble=0.03, rr=0.05, noseb=0.03, tailb=0.0, lean_f=0.05, lean_r=0.0,
    cabin=dict(a=0.555, r1=0.68, r2=0.95, c=0.985, roof=2.45, roofw=0.86, crown=0.03, rcurve=1.0),
    doors=[(0.6, 0.94)], sideglass=[(0.585, 0.93)], hood=(0.02, 0.54), trunk=None, bumpers=((0.04, 0.82), (2, 2)), bumper_m='chrome',
    head=dict(x0=0.56, x1=0.92, z0=0.94, z1=1.06, wrap=0.35), tail=None,
    grille=dict(z0=0.74, z1=1.06, w=0.55, bars=2, bar_m='chrome'), plateF=(0.66, 'bumpF'), plateR=None, lip=0.05, flare=0.04,
    exhaust=[], noantenna=True, chmsl=False, mirror_k=1.6, mirror_m='chrome', duals=True,
    floor=0.72, hip=1.05, seat_t=0.76, rear_t=0.9, step=0.24, frame_z=0.8))
# Type III ambulance on a cutaway van chassis (E-450 class): 6.9 x 2.4 x 2.85 m, wheelbase 4.2 m
spec('ambulance', **base_spec(2.75, 2.01, 2.2, 4.2, 0.92, 0.39, 1.75,
    belt=[(0, 0.86), (0.03, 0.95), (0.1, 1.02), (0.22, 1.07), (0.36, 1.1), (0.42, 1.14), (1, 1.16)],
    sill=[(0, 0.42), (0.08, 0.37), (0.2, 0.36), (1, 0.4)],
    plan=[(0, 0.88), (0.04, 0.95), (0.12, 0.985), (0.28, 1), (1, 1)],
    shdrop=[(0, 0.1), (0.2, 0.13), (1, 0.13)], tumble=0.03, rr=0.05, noseb=0.03, tailb=0.0, lean_f=0.05, lean_r=0.0,
    cabin=dict(a=0.37, r1=0.58, r2=0.97, c=0.995, roof=2.2, roofw=0.9, crown=0.03, rcurve=1.0),
    doors=[(0.42, 0.75)], sideglass=[(0.4, 0.745)], hood=(0.06, 0.35), trunk=None, bumpers=((0.08, 0.68), (2, 2)), bumper_m='chrome',
    head=dict(x0=0.5, x1=0.88, z0=0.74, z1=0.84, wrap=0.3), tail=None,
    grille=dict(z0=0.56, z1=0.8, w=0.46, bars=2, surround='chrome'), plateF=(0.52, 'bumpF'), plateR=None,
    exhaust=[], noantenna=True, chmsl=False, mirror_k=1.5, mirror_m='chrome', duals=True,
    floor=0.5, hip=0.86, seat_t=0.6, frame_z=0.7))
# custom-cab pumper (Pierce Enforcer class): 10.0 x 2.5 x 3.2 m, wheelbase 5.0 m
spec('fire', **cabover(3.45, 2.5, 2.95, 1.55, 5.0, 0.5, 2.05, duals=True,
     belt=[(0, 1.4), (0.015, 1.48), (0.04, 1.52), (1, 1.55)], sill=[(0, 0.4), (0.03, 0.55), (1, 0.55)],
     cabin=dict(a=0.025, r1=0.1, r2=0.99, c=0.998, roof=2.95, roofw=0.95, crown=0.02, wcurve=1.0, rcurve=1.0),
     doors=[(0.42, 0.68), (0.68, 0.94)], sideglass=[(0.12, 0.38), (0.425, 0.672), (0.688, 0.93)], two_tone=False, roof_m='paint2',
     head=dict(x0=0.72, x1=1.05, z0=0.72, z1=0.86, wrap=0.4, proj=2), bumpers=((0.06, 0.72), (2, 2)), bumper_m='chrome',
     grille=dict(z0=0.9, z1=1.32, w=0.55, bars=6, surround='chrome', bar_m='chrome'), plateF=(0.55, 'bumpF'),
     floor=0.95, hip=1.35, seat_t=0.3, rear_t=0.8, seat_x=0.55))


# ---------------------------------------------------------------- city bus (Gillig Low Floor 35 ft)
def build_bus(key):
    L, W, H = 10.7, 2.59, 3.1
    fo, wb, r, track = 2.1, 5.18, 0.5, 2.1
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    yF, yR = -L / 2, L / 2
    Mh, Ml = Mesh(), Mesh()
    for M, lo in ((Mh, False), (Ml, True)):
        seg = 1 if lo else 3
        # shell: rounded rectangle section; the front face is the windshield end, slightly raked
        z0, z1 = 0.32, H - 0.05
        rr = 0.18
        pts = []
        for (cx, cz, a0) in ((W / 2 - 0.06, z0 + 0.06, -90), (W / 2 - rr, z1 - rr, 0), (-W / 2 + rr, z1 - rr, 90), (-W / 2 + 0.06, z0 + 0.06, 180)):
            rad = 0.06 if a0 in (-90, 180) else rr
            for k in range(seg + 1):
                a = math.radians(a0 + 90 * k / seg)
                pts.append((cx + math.cos(a) * rad, cz + math.sin(a) * rad))
        ys = [yF + 0.12, yF + 0.3] + [yF + 0.3 + (yR - yF - 0.5) * k / (3 if lo else 10) for k in range(1, (3 if lo else 10) + 1)]
        rings = []
        for y in ys:
            k = 1.0 if y > yF + 0.25 else 0.97
            rings.append([M.vert((x * k, y, z if y > yF + 0.25 else z0 + (z - z0) * 0.985)) for x, z in pts])
        n = len(pts)
        for A, B in zip(rings, rings[1:]):
            for k in range(n):
                k2 = (k + 1) % n
                M.quad(A[k], B[k], B[k2], A[k2], 'paint2', 'body')
        # caps
        cF = M.vert((0, yF + 0.12, (z0 + z1) / 2))
        cR = M.vert((0, yR - 0.2, (z0 + z1) / 2))
        for k in range(n):
            k2 = (k + 1) % n
            M.face([rings[0][k], rings[0][k2], cF], 'paint2', 'body')
            M.face([rings[-1][k2], rings[-1][k], cR], 'paint2', 'body')
        Sf = Surf(M)
        # wheel wells (dark boxes cut visually into the sides)
        for ya in (yF + fo, yF + fo + wb):
            for sx in (1, -1):
                pts2 = []
                for k in range(9):
                    a = math.radians(-90 + 180 * k / 8)
                    pts2.append((ya + math.sin(a) * (r + 0.08), r + math.cos(a) * (r + 0.08)))
                vs = [M.vert((sx * (W / 2 + 0.004), y, max(z0, z))) for y, z in pts2]
                bt = [M.vert((sx * (W / 2 + 0.004), y, z0 - 0.0)) for y, z in pts2]
                for k in range(8):
                    f = [bt[k], bt[k + 1], vs[k + 1], vs[k]]
                    M.face(f if sx < 0 else f[::-1], 'trim', 'body')
        # side windows: dark band with mullions, a colour stripe and skirt
        for sx in (1, -1):
            yw0, yw1 = yF + 1.0 if sx > 0 else yF + 1.55, yR - 2.6
            panel(M, (sx * (W / 2 + 0.003), (yw0 + yw1) / 2, 2.05), RX(sx), yw1 - yw0, 1.0, 'glass', 'body')
            if not lo:
                nwin = 6
                for k in range(nwin + 1):
                    y = yw0 + (yw1 - yw0) * k / nwin
                    panel(M, (sx * (W / 2 + 0.006), y, 2.05), RX(sx), 0.07, 1.0, 'trim', 'body')
                panel(M, (sx * (W / 2 + 0.006), (yw0 + yw1) / 2, 1.53), RX(sx), yw1 - yw0 + 0.1, 0.05, 'trim', 'body')
                panel(M, (sx * (W / 2 + 0.006), (yw0 + yw1) / 2, 2.57), RX(sx), yw1 - yw0 + 0.1, 0.05, 'trim', 'body')
            panel(M, (sx * (W / 2 + 0.005), 0.0, 1.15), RX(sx), L - 0.8, 0.3, 'paint', 'body')
            panel(M, (sx * (W / 2 + 0.005), 0.0, 0.42), RX(sx), L - 0.6, 0.16, 'trim', 'body')
        # doors on the curb side (right, -x): front double door and the rear door
        for (yd, wd) in ((yF + 0.85, 1.05), (yF + fo + wb - 1.3, 0.95)):
            panel(M, (-(W / 2 + 0.006), yd, 1.5), RX(-1), wd, 2.25, 'trim', 'body')
            for sy in (-1, 1):
                panel(M, (-(W / 2 + 0.009), yd + sy * wd / 4, 1.6), RX(-1), wd / 2 - 0.08, 1.85, 'glass', 'body')
        # front: two-piece windshield, destination sign, headlamps, bumper, bike rack
        yf = yF + 0.12
        panel(M, (0, yf - 0.005, 1.95), RF, W - 0.3, 1.55, 'glass', 'body')
        if not lo:
            panel(M, (0, yf - 0.01, 1.95), RF, 0.06, 1.55, 'trim', 'body')
        panel(M, (0, yf - 0.006, 2.88), RF, W - 0.5, 0.26, 'decal', 'body', uv=(0.0, 0.5, 1.0, 0.625))
        if not lo:
            panel(M, (0, yf - 0.004, 2.88), RF, W - 0.4, 0.34, 'trim', 'body')
        for sx in (1, -1):
            box(M, (sx * (W / 2 - 0.35), yf - 0.01, 0.82), (0.42, 0.03, 0.16), RF, 'lamp_head', 'body')
            if not lo:
                box(M, (sx * (W / 2 - 0.35), yf - 0.005, 0.82), (0.48, 0.02, 0.22), RF, 'trim', 'body')
                box(M, (sx * (W / 2 - 0.12), yf - 0.01, 0.82), (0.1, 0.03, 0.16), RF, 'lamp_amber', 'body')
        slab(M, -W / 2 + 0.02, W / 2 - 0.02, yF - 0.08, yF + 0.13, 0.35, 0.62, 'trim', 'bumpF', r=0.04 if not lo else 0, seg=1)
        if not lo:
            panel(M, (0, yF - 0.085, 0.48), RF, 0.305, 0.152, 'plate', 'bumpF', uv=(0.0, 0.0, 0.5, 0.25))
            for x in (-0.5, 0.5):
                tube(M, [(x, yF - 0.06, 0.6), (x, yF - 0.35, 0.65), (x, yF - 0.35, 1.0)], 0.02, 5, 'chrome', 'bumpF')
            for x in (-0.9, 0.9):
                tube(M, [(x, yF - 0.33, 0.66), (-x * 0.1, yF - 0.33, 0.66)], 0.018, 5, 'chrome', 'bumpF')
            # mirrors on arms
            for sx in (1, -1):
                tube(M, [(sx * (W / 2 - 0.1), yF + 0.25, 2.5), (sx * (W / 2 + 0.2), yF - 0.15, 2.6), (sx * (W / 2 + 0.2), yF - 0.25, 2.3)], 0.018, 5, 'trim', 'body')
                rbox(M, (sx * (W / 2 + 0.2), yF - 0.27, 2.15), (0.26, 0.4, 0.06), RF, 'trim', 'body', seg=(2, 2), e=0.5)
        # rear: engine grille, round tail lamps, bumper, roof A/C pod
        yr = yR - 0.2
        if not lo:
            panel(M, (0, yr + 0.006, 1.4), RB, 1.9, 0.9, 'trim', 'body')
            for k in range(6):
                panel(M, (0, yr + 0.01, 1.05 + k * 0.14), RB, 1.85, 0.03, 'chrome', 'body')
        for sx in (1, -1):
            for k, (z, nm) in enumerate(((1.05, 'lamp_tail'), (1.27, 'lamp_tail'), (1.49, 'lamp_amber'), (0.83, 'lamp_rev'))):
                if lo and k > 0:
                    continue
                ring = [M.vert((sx * (W / 2 - 0.2) + math.cos(2 * math.pi * i / 10) * 0.09, yr + 0.012, z + math.sin(2 * math.pi * i / 10) * 0.09)) for i in range(10)]
                disk(M, ring, (sx * (W / 2 - 0.2), yr + 0.012, z), nm, 'body', flip=True)
        slab(M, -W / 2 + 0.02, W / 2 - 0.02, yR - 0.25, yR - 0.02, 0.35, 0.6, 'trim', 'bumpR', r=0.04 if not lo else 0, seg=1)
        slab(M, -W / 2 + 0.25, W / 2 - 0.25, yF + 2.2, yF + 5.2, H - 0.06, H + 0.12, 'paint2', 'body', r=0.08 if not lo else 0, seg=1)
        # interior: driver seat, rows of seats seen through the windows, handrails
        if not lo:
            for k in range(7):
                y = yF + 2.7 + k * 0.85
                for sx in (1, -1):
                    rbox(M, (sx * 0.72, y, 1.0), (0.85, 0.42, 0.42), (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))), 'interior', 'interior', seg=(2, 2), e=0.3)
                    rbox(M, (sx * 0.72, y + 0.22, 1.32), (0.85, 0.08, 0.55), RF, 'interior', 'interior', seg=(2, 2), e=0.3)
            cyl(M, (0.35, yF + 1.0, 2.55), (0.35, yR - 1.0, 2.55), 0.02, 5, 'chrome', 'interior', caps=False)
            cyl(M, (-0.35, yF + 1.0, 2.55), (-0.35, yR - 1.0, 2.55), 0.02, 5, 'chrome', 'interior', caps=False)
            rbox(M, (0.72, yF + 1.15, 1.05), (0.5, 0.5, 0.15), RU, 'interior', 'interior', seg=(2, 2), e=0.3)
            rbox(M, (0.72, yF + 1.43, 1.4), (0.5, 0.12, 0.6), RF, 'interior', 'interior', seg=(2, 2), e=0.3)
            rbox(M, (0, yF + 0.45, 1.25), (W - 0.3, 0.4, 0.35), RF, 'interior', 'interior', seg=(3, 2), e=0.3)
            sc = Vector((0.72, yF + 0.72, 1.55))
            ring = [tuple(sc + Vector((math.cos(2 * math.pi * k / 14) * 0.24, math.sin(2 * math.pi * k / 14) * 0.24 * 0.5, math.sin(2 * math.pi * k / 14) * 0.24 * 0.86))) for k in range(14)]
            tube(M, ring, 0.02, 5, 'trim', 'interior', closed=True)
            M.face([M.vert((W / 2 - 0.05, yF + 0.3, 0.45)), M.vert((-W / 2 + 0.05, yF + 0.3, 0.45)), M.vert((-W / 2 + 0.05, yR - 0.4, 0.45)), M.vert((W / 2 - 0.05, yR - 0.4, 0.45))], 'interior', 'interior')
    assemble(key, root, Mh, Ml, None, pivots={'bumpF': (0, yF, 0.5), 'bumpR': (0, yR, 0.5)})
    for nm, p in {'w_FL': (track / 2, yF + fo, r), 'w_FR': (-track / 2, yF + fo, r), 'w_RL': (track / 2, yF + fo + wb, r), 'w_RR': (-track / 2, yF + fo + wb, r),
                  'w_RL2': (track / 2 - 0.3, yF + fo + wb, r), 'w_RR2': (-track / 2 + 0.3, yF + fo + wb, r),
                  'seat_D': (0.72, yF + 1.15, 1.12), 'seat_P': (-0.72, yF + 2.7, 1.22), 'seat_RL': (0.72, yF + 3.55, 1.22), 'seat_RR': (-0.72, yF + 3.55, 1.22),
                  'lamp_head_L': (W / 2 - 0.35, yF + 0.06, 0.82), 'lamp_head_R': (-W / 2 + 0.35, yF + 0.06, 0.82),
                  'lamp_tail_L': (W / 2 - 0.2, yR - 0.16, 1.05), 'lamp_tail_R': (-W / 2 + 0.2, yR - 0.16, 1.05)}.items():
        E(root, nm, p)
    return root


# ---------------------------------------------------------------- motorbike and scooter
def build_bike(key, scooter=False):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    Mh, Ml = Mesh(), Mesh()
    if scooter:  # Vespa-style: step-through body, leg shield, 12 in wheels
        wf, wr, rad = -0.66, 0.66, 0.235
    else:  # naked roadster (MT-07 / CB650 class): wheelbase 1.4 m, 17 in wheels
        wf, wr, rad = -0.7, 0.7, 0.31
    for M, lo in ((Mh, False), (Ml, True)):
        sg = (2, 2) if lo else (5, 3)
        if scooter:
            rbox(M, (0, 0.38, 0.58), (0.4, 0.5, 0.7), RF, 'paint', 'body', seg=sg, e=0.45)  # rear cowl over the engine
            rbox(M, (0, -0.08, 0.3), (0.3, 0.12, 0.62), RF, 'trim', 'body', seg=sg, e=0.3)  # floorboard
            rbox(M, (0, -0.48, 0.66), (0.42, 0.75, 0.16), (Vector((1, 0, 0)), Vector((0, math.sin(0.25), math.cos(0.25))), Vector((0, -math.cos(0.25), math.sin(0.25)))), 'paint', 'body', seg=sg, e=0.35)  # leg shield
            rbox(M, (0, 0.3, 0.86), (0.3, 0.1, 0.66), RF, 'interior', 'body', seg=sg, e=0.35)  # seat
            rbox(M, (0, wf, rad + 0.16), (0.16, 0.12, 0.4), RF, 'paint', 'body', seg=(3, 2), e=0.4)  # front mudguard
            cyl(M, (0, -0.62, 0.45), (0, -0.56, 1.0), 0.03, 6, 'trim', 'body')  # steering column
            rbox(M, (0, -0.58, 1.04), (0.3, 0.12, 0.2), RF, 'paint', 'body', seg=sg, e=0.4)  # headset
            tube(M, [(-0.34, -0.55, 1.06), (0.34, -0.55, 1.06)], 0.014, 5, 'trim', 'body')
            for sx in (1, -1):
                cyl(M, (sx * 0.26, -0.55, 1.06), (sx * 0.36, -0.55, 1.06), 0.02, 6, 'trim', 'body')
            ring = [M.vert((math.cos(2 * math.pi * k / 10) * 0.06, -0.655, 1.05 + math.sin(2 * math.pi * k / 10) * 0.06)) for k in range(10)]
            disk(M, ring, (0, -0.656, 1.05), 'lamp_head', 'body', flip=True)
            box(M, (0, 0.73, 0.74), (0.14, 0.04, 0.06), RB, 'lamp_tail', 'body')
            if not lo:
                box(M, (0, 0.72, 0.64), (0.17, 0.008, 0.09), RB, 'plate', 'body')
                cyl(M, (-0.15, 0.3, 0.3), (-0.15, 0.75, 0.33), 0.04, 8, 'chrome', 'body')  # exhaust
                for sx in (1, -1):
                    box(M, (sx * 0.14, -0.6, 1.0), (0.05, 0.03, 0.03), RF, 'lamp_amber', 'body')
                    tube(M, [(sx * 0.18, -0.55, 1.08), (sx * 0.26, -0.5, 1.22)], 0.007, 4, 'chrome', 'body')
                    rbox(M, (sx * 0.27, -0.5, 1.25), (0.09, 0.02, 0.06), RF, 'chrome', 'body', seg=(2, 2), e=0.5)
                rbox(M, (0, 0.5, 0.9), (0.28, 0.04, 0.2), RF, 'chrome', 'body', seg=(2, 2), e=0.3)  # rear rack
            seat = (0, 0.25, 0.86)
            head, tail = (0, -0.68, 1.05), (0, 0.76, 0.74)
        else:
            Rt = (Vector((1, 0, 0)), Vector((0, math.sin(0.12), math.cos(0.12))), Vector((0, -math.cos(0.12), math.sin(0.12))))
            rbox(M, (0, -0.18, 0.95), (0.34, 0.24, 0.5), Rt, 'paint', 'body', seg=sg, e=0.5)  # tank
            rbox(M, (0, 0.28, 0.85), (0.26, 0.09, 0.5), RF, 'interior', 'body', seg=sg, e=0.35)  # seat
            rbox(M, (0, 0.62, 0.9), (0.2, 0.1, 0.36), (Vector((1, 0, 0)), Vector((0, math.sin(-0.3), math.cos(-0.3))), Vector((0, -math.cos(-0.3), math.sin(-0.3)))), 'paint', 'body', seg=sg, e=0.4)  # tail
            rbox(M, (0, -0.06, 0.55), (0.3, 0.32, 0.4), RF, 'trim', 'body', seg=sg, e=0.3)  # engine block
            if not lo:
                for k in range(2):
                    cyl(M, (0.03 - k * 0.06, -0.12, 0.62), (0.03 - k * 0.06, -0.3, 0.82), 0.05, 8, 'chrome', 'body')  # cylinders
                rbox(M, (0, -0.38, 0.68), (0.32, 0.3, 0.06), RF, 'trim', 'body', seg=(2, 2), e=0.3)  # radiator
                tube(M, [(0, -0.35, 0.5), (0.05, -0.2, 0.3), (0.12, 0.2, 0.3), (0.17, 0.55, 0.45)], 0.035, 6, 'chrome', 'body')  # header + pipe
                cyl(M, (0.17, 0.5, 0.42), (0.17, 0.8, 0.52), 0.06, 10, 'trim', 'body')  # muffler
                for sx in (1, -1):  # swingarm, footpegs
                    tube(M, [(sx * 0.1, 0.05, 0.42), (sx * 0.1, wr, rad)], 0.025, 5, 'trim', 'body')
                    box(M, (sx * 0.17, 0.05, 0.38), (0.1, 0.03, 0.03), RF, 'trim', 'body')
                cyl(M, (0, 0.35, 0.6), (0, 0.55, 0.85), 0.03, 6, 'caliper', 'body')  # shock
                rbox(M, (0, wf + 0.02, rad + 0.13), (0.13, 0.08, 0.42), RF, 'paint', 'body', seg=(3, 2), e=0.4)  # front fender
                box(M, (0, 0.92, 0.74), (0.18, 0.008, 0.11), RB, 'plate', 'body')
                for sx in (1, -1):
                    box(M, (sx * 0.12, 0.88, 0.8), (0.05, 0.03, 0.03), RB, 'lamp_amber', 'body')
                    box(M, (sx * 0.12, -0.84, 1.0), (0.05, 0.03, 0.03), RF, 'lamp_amber', 'body')
                    tube(M, [(sx * 0.2, -0.56, 1.12), (sx * 0.26, -0.5, 1.28)], 0.007, 4, 'chrome', 'body')
                    rbox(M, (sx * 0.27, -0.5, 1.3), (0.1, 0.02, 0.06), RF, 'chrome', 'body', seg=(2, 2), e=0.5)
            for sx in (1, -1):  # forks
                cyl(M, (sx * 0.08, wf, rad), (sx * 0.08, -0.52, 1.02), 0.025, 6, 'chrome', 'body')
            tube(M, [(-0.36, -0.5, 1.1), (-0.12, -0.53, 1.08), (0.12, -0.53, 1.08), (0.36, -0.5, 1.1)], 0.012, 5, 'trim', 'body')
            for sx in (1, -1):
                cyl(M, (sx * 0.28, -0.5, 1.1), (sx * 0.38, -0.5, 1.1), 0.018, 6, 'trim', 'body')
            ring = [M.vert((math.cos(2 * math.pi * k / 12) * 0.085, -0.66, 1.0 + math.sin(2 * math.pi * k / 12) * 0.085)) for k in range(12)]
            if not lo:
                cyl(M, (0, -0.58, 1.0), (0, -0.66, 1.0), 0.095, 12, 'trim', 'body', caps=False)
            disk(M, ring, (0, -0.665, 1.0), 'lamp_head', 'body', flip=True)
            box(M, (0, 0.82, 0.86), (0.12, 0.04, 0.05), RB, 'lamp_tail', 'body')
            seat = (0, 0.22, 0.86)
            head, tail = (0, -0.7, 1.0), (0, 0.85, 0.86)
    assemble(key, root, Mh, Ml, None)
    E(root, 'w_F', (0, wf, rad))
    E(root, 'w_R', (0, wr, rad))
    E(root, 'seat_D', seat)
    E(root, 'lamp_head_L', head)
    E(root, 'lamp_tail_L', tail)
    return root


# ---------------------------------------------------------------- speedboat (6 m bowrider) and helicopter (Bell 407 class)
def build_boat(key):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    L, W = 6.0, 2.3
    Mh, Ml = Mesh(), Mesh()
    for M, lo in ((Mh, False), (Ml, True)):
        N = 8 if lo else 20
        rings = []
        for i in range(N + 1):
            t = i / N
            y = -L / 2 + t * L
            hw = W / 2 * curve([(0, 0.04), (0.12, 0.55), (0.35, 0.95), (1, 0.93)], t)
            keel = curve([(0, 0.62), (0.18, 0.12), (1, 0.18)], t)
            deck = curve([(0, 1.12), (0.3, 1.0), (1, 0.92)], t)
            chine = keel + (deck - keel) * 0.35
            pts = [(0, keel - 0.32), (hw * 0.55, keel - 0.12), (hw * 0.95, chine - 0.08), (hw, chine), (hw * 1.01, deck - 0.12), (hw, deck), (hw - 0.08, deck)]
            if lo:
                pts = [pts[0], pts[2], pts[3], pts[5]]
            ring = [M.vert((x, y, z)) for x, z in pts] + [M.vert((-x, y, z)) for x, z in reversed(pts[1:])]
            rings.append((ring, len(pts)))
        n = len(rings[0][0])
        np_ = rings[0][1]
        for (r0, _), (r1, _) in zip(rings, rings[1:]):
            for k in range(n - 1):
                kk = k if k < np_ - 1 else n - 2 - k
                m = 'paint' if kk in (2, 3) else 'paint2' if kk < 5 else 'trim'
                M.quad(r0[k], r1[k], r1[k + 1], r0[k + 1], m, 'body')
        # transom
        rr, _ = rings[-1]
        c = M.vert((0, L / 2, 0.5))
        for k in range(n - 1):
            M.face([rr[k], rr[k + 1], c], 'paint2', 'body')
        Rf = RF
        # deck, cockpit, console + windscreen, seats, rails, outboard
        box(M, (0, 0.4, 0.86), (W - 0.36, L * 0.72, 0.04), RU, 'interior' if not lo else 'paint2', 'details')
        rbox(M, (0.35, -0.05, 1.18), (0.6, 0.65, 0.5), Rf, 'paint2', 'details', seg=(3, 2), e=0.3)
        Rw = (Vector((1, 0, 0)), Vector((0, 0.45, 0.9)).normalized(), Vector((0, -0.9, 0.45)).normalized())
        box(M, (0.35, -0.38, 1.55), (0.68, 0.36, 0.01), Rw, 'glass', 'details')
        box(M, (-0.35, -0.05, 1.12), (0.55, 0.5, 0.45), Rf, 'paint2', 'details')
        box(M, (-0.35, -0.38, 1.45), (0.62, 0.3, 0.01), Rw, 'glass', 'details')
        if not lo:
            rbox(M, (0.35, 0.55, 1.0), (0.5, 0.15, 0.5), Rf, 'interior', 'details', seg=(3, 2), e=0.3)
            rbox(M, (0.35, 0.78, 1.25), (0.5, 0.45, 0.1), Rf, 'interior', 'details', seg=(3, 2), e=0.3)
            rbox(M, (-0.35, 0.55, 1.0), (0.5, 0.15, 0.5), Rf, 'interior', 'details', seg=(3, 2), e=0.3)
            rbox(M, (0, 1.7, 0.98), (W - 0.45, 0.2, 0.55), Rf, 'interior', 'details', seg=(4, 2), e=0.3)
            rbox(M, (0, -1.4, 1.02), (1.2, 0.2, 0.9), Rf, 'interior', 'details', seg=(4, 2), e=0.3)
            for sx in (1, -1):
                tube(M, [(sx * 0.12, -2.85, 1.2), (sx * 0.6, -2.3, 1.22), (sx * 0.95, -1.4, 1.15)], 0.015, 5, 'chrome', 'details')
            sc = Vector((0.35, -0.22, 1.5))
            ring = [tuple(sc + Vector((math.cos(2 * math.pi * k / 12) * 0.16, math.sin(2 * math.pi * k / 12) * 0.16 * 0.5, math.sin(2 * math.pi * k / 12) * 0.16 * 0.85))) for k in range(12)]
            tube(M, ring, 0.014, 4, 'trim', 'details', closed=True)
        rbox(M, (0, L / 2 + 0.22, 1.05), (0.38, 0.45, 0.62), Rf, 'trim', 'details', seg=(3, 2) if not lo else (2, 1), e=0.4)
        box(M, (0, L / 2 + 0.3, 0.55), (0.1, 0.2, 0.6), Rf, 'trim', 'details')
        if not lo:
            box(M, (0, L / 2 + 0.33, 0.22), (0.05, 0.14, 0.2), Rf, 'chrome', 'details')
            for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_head')):
                box(M, (sx * 0.15, -2.75, 1.13), (0.08, 0.06, 0.04), Rf, nm, 'details')
    assemble(key, root, Mh, Ml, None)
    E(root, 'seat_D', (0.35, 0.55, 1.0))
    E(root, 'seat_P', (-0.35, 0.55, 1.0))
    E(root, 'lamp_head_L', (0.0, -L / 2 + 0.4, 1.15))
    E(root, 'lamp_tail_L', (0.0, L / 2 - 0.1, 1.2))
    return root


def build_heli(key):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    Mh, Ml = Mesh(), Mesh()
    for M, lo in ((Mh, False), (Ml, True)):
        N, K = (8, 8) if lo else (22, 16)
        rings = []
        for i in range(N + 1):
            t = i / N
            y = -2.45 + t * 4.2
            r = curve([(0, 0.15), (0.08, 0.62), (0.3, 0.92), (0.6, 0.88), (0.85, 0.55), (1, 0.32)], t)
            zc = curve([(0, 1.15), (0.25, 1.35), (0.7, 1.45), (1, 1.75)], t)
            hz = curve([(0, 0.6), (0.3, 1.0), (0.7, 1.0), (1, 0.8)], t)
            ring = []
            for k in range(K):
                a = 2 * math.pi * k / K
                ring.append(M.vert((math.sin(a) * r * 0.82, y, zc + math.cos(a) * r * hz)))
            rings.append((t, ring))
        for (t0, r0), (t1, r1) in zip(rings, rings[1:]):
            for k in range(K):
                k2 = (k + 1) % K
                am = 2 * math.pi * (k + 0.5) / K
                canopy = (t0 < 0.38 and math.cos(am) > -0.2) or (0.38 <= t0 < 0.6 and 0.0 < math.cos(am) < 0.8 and abs(math.sin(am)) > 0.45)
                m = 'glass' if canopy else ('paint2' if math.cos(am) < -0.45 else 'paint')
                M.quad(r0[k], r0[k2], r1[k2], r1[k], m, 'body')
        c = M.vert((0, 1.75, 1.75))
        rr = rings[-1][1]
        for k in range(K):
            M.face([rr[k], rr[(k + 1) % K], c], 'paint', 'body')
        # tail boom, fins, engine fairing, skids
        cyl(M, (0, 1.6, 1.78), (0, 6.6, 1.95), 0.26 if not lo else 0.25, 10 if not lo else 6, 'paint', 'body', r1=0.12)
        rbox(M, (0, 0.6, 2.25), (0.85, 0.5, 1.7), RF, 'paint', 'body', seg=(4, 2) if not lo else (2, 1), e=0.4)
        box(M, (0, 6.55, 2.45), (0.06, 0.55, 1.0), RX(1), 'paint', 'body')
        box(M, (0, 5.4, 1.95), (1.4, 0.32, 0.05), RU, 'paint', 'body')
        for sx in (1, -1):
            tube(M, [(sx * 0.95, -1.3, 0.2), (sx * 0.95, -1.0, 0.08), (sx * 0.95, 1.6, 0.08)], 0.04, 6 if not lo else 4, 'trim', 'body')
            for y in (-0.6, 0.9):
                tube(M, [(sx * 0.95, y, 0.08), (sx * 0.62, y, 0.75)], 0.035, 5 if not lo else 3, 'trim', 'body')
        if not lo:
            cyl(M, (0, 0.6, 3.05), (0, 0.6, 3.25), 0.16, 10, 'trim', 'body')
            for sx in (1, -1):  # cabin seats behind the glass
                rbox(M, (sx * 0.32, -1.05, 1.05), (0.42, 0.12, 0.42), RF, 'interior', 'interior', seg=(2, 2), e=0.3)
                rbox(M, (sx * 0.32, -0.82, 1.35), (0.42, 0.5, 0.12), RF, 'interior', 'interior', seg=(2, 2), e=0.3)
            rbox(M, (0, -1.7, 1.3), (1.0, 0.18, 0.3), RF, 'interior', 'interior', seg=(3, 2), e=0.3)
            box(M, (0, 6.75, 2.0), (0.08, 0.08, 0.08), RF, 'lamp_tail', 'body')
            box(M, (0, -2.4, 1.0), (0.14, 0.05, 0.08), RF, 'lamp_head', 'body')
    assemble(key, root, Mh, Ml, None)
    # rotors: separate parts the game spins
    for nm, loc, rot, size, nb in (('rotor', (0, 0.6, 3.28), (0, 0, 0), (0.3, 10.6, 0.05), 2), ('tailrotor', (0.16, 6.6, 2.05), (0, 0, 0), (0.12, 1.65, 0.03), 1)):
        Mr = Mesh()
        Rr = RU
        for k in range(nb):
            a = math.pi * k / nb + 0.3
            Rk = (Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0)), Vector((0, 0, 1)))
            box(Mr, (0, 0, 0), size, Rk, 'trim', 'hi')
        cyl(Mr, (0, 0, -0.06), (0, 0, 0.08), 0.12 if nm == 'rotor' else 0.06, 8, 'chrome', 'hi')
        e = bpy.data.objects.new(nm, None)
        link(e)
        e.location = loc
        e.rotation_euler = rot
        e.parent = root
        o = Mr.build(key + '__' + nm + '_hi', 'hi', (0, 0, 0))
        o.parent = e
        if nm == 'tailrotor':  # the tail rotor spins about its own axis across the boom
            o.rotation_euler = (0, math.pi / 2, 0)
    E(root, 'seat_D', (0.32, -1.05, 1.05))
    E(root, 'seat_P', (-0.32, -1.05, 1.05))
    E(root, 'lamp_head_L', (0, -2.45, 1.0))
    E(root, 'lamp_tail_L', (0, 6.8, 2.0))
    return root


# ---------------------------------------------------------------- build + export
CARS = ['sedan', 'sports', 'police', 'hatch', 'suv', 'pickup', 'minivan', 'muscle', 'convertible', 'limo', 'monster', 'taxi', 'van']
TRUCKS = {'truck': 7.3, 'garbage': 9.0, 'tow': 6.9, 'ambulance': 6.9, 'fire': 10.0}
BUILD = {k: (lambda k: (lambda: build_car(k, SPECS[k])))(k) for k in CARS}
BUILD.update({k: (lambda k: (lambda: cab_truck(k, SPECS[k], TRUCKS[k], k if k != 'truck' else 'box')))(k) for k in TRUCKS})
BUILD.update({'bus': lambda: build_bus('bus'), 'bike': lambda: build_bike('bike'), 'scooter': lambda: build_bike('scooter', True),
              'boat': lambda: build_boat('boat'), 'heli': lambda: build_heli('heli')})
# vehicle type index order (src/vehicles.js TYPES); shared models come after their source
ORDER = ['sedan', 'sports', 'truck', 'van', 'bike', 'scooter', 'police', 'bus', 'boat', 'heli', 'hatch', 'suv', 'pickup', 'minivan',
         'muscle', 'convertible', 'limo', 'monster', 'taxi', 'garbage', 'tow', 'ambulance', 'fire']


def build_all(keys=None):
    reset()
    make_mats()
    BUILT.clear()
    roots = []
    keys = keys or ORDER
    for k in keys:
        r = BUILD[k]()
        for c in r.children_recursive:  # unique names <key>__<part> (the game strips the prefix)
            base = c.name.split('.')[0]
            if '__' in base:
                base = base.split('__', 1)[1]
            c.name = k + '__' + base
        roots.append(r)
    wh = make_wheel()
    return roots, wh


ONLY = os.environ.get('ONLY')
roots, wh = build_all(ONLY.split(',') if ONLY else globals().get('ONLY_KEYS'))
result = {'built': [r.name for r in roots]}
if os.environ.get('EXPORT', '1') == '1':
    objs = [o for o in bpy.data.objects if o.name.startswith('car_')] + [wh]
    for o in objs:
        o.location = (0, 0, 0)
    result['kb'] = export_glb(os.environ.get('OUTNAME', 'cars'), objs)
print('RESULT', result)
