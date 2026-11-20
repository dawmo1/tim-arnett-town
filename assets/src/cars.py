# Cars: a parametric car builder. A body is lofted from cross-sections along its length (lower
# body + glasshouse), split into parts the game animates or knocks off (doors, hood, trunk,
# bumpers), plus glass, lamps, grille, mirrors, plates, an interior, and empties for wheels, seats
# and lamps. Each vehicle type is one root empty "car_<key>" in assets/models/cars.glb.
# Blender axes: Z up, the car faces -Y, its left side is +X. Lengths in metres.
# Material names the game recognises: paint, paint2 (second colour), glass, trim, chrome, lamp_head,
# lamp_tail, interior, tire, rim, plate, decal.
import math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/tat.py').read(), globals())
from mathutils import Vector

MAT = {}


def make_mats():
    MAT.update({
    'paint': mat('paint', (0.6, 0.6, 0.62), 0.3, 0.4),
    'paint2': mat('paint2', (0.95, 0.95, 0.95), 0.3, 0.4),
    'glass': mat('glass', (0.08, 0.1, 0.12), 0.05, 0.2),
    'trim': mat('trim', (0.04, 0.04, 0.045), 0.6),
    'chrome': mat('chrome', (0.8, 0.8, 0.82), 0.15, 1.0),
    'lamp_head': mat('lamp_head', (0.9, 0.9, 0.85), 0.1),
    'lamp_tail': mat('lamp_tail', (0.6, 0.02, 0.02), 0.2),
    'interior': mat('interior', (0.12, 0.11, 0.1), 0.85),
    'tire': mat('tire', (0.03, 0.03, 0.03), 0.9),
    'rim': mat('rim', (0.55, 0.56, 0.58), 0.3, 0.9),
    'plate': mat('plate', (0.95, 0.95, 0.95), 0.5),
    'decal': mat('decal', (1, 1, 1), 0.4),
    })


def lerp(a, b, t):
    return a + (b - a) * t


def curve(keys, t):
    """piecewise smooth interpolation through (t, value) keys"""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t0 <= t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 0
            u = u * u * (3 - 2 * u)
            return v0 + (v1 - v0) * u
    return keys[-1][1]


class Mesh:
    """collects verts/faces with per-face material and part names"""
    def __init__(s):
        s.v, s.f, s.m, s.p, s.uv = [], [], [], [], []

    def vert(s, p):
        s.v.append(tuple(p))
        return len(s.v) - 1

    def face(s, idx, m, part, uv=None):
        s.f.append(list(idx))
        s.m.append(m)
        s.p.append(part)
        s.uv.append(uv)

    def build(s, name, parts=None):
        """make one object per part (faces whose part is in `parts`, or all)"""
        out = {}
        names = sorted(set(s.p)) if parts is None else parts
        for pn in names:
            fi = [i for i, p in enumerate(s.p) if p == pn]
            if not fi:
                continue
            remap, V, F, Mi, UV = {}, [], [], [], []
            for i in fi:
                nf = []
                for vi in s.f[i]:
                    if vi not in remap:
                        remap[vi] = len(V)
                        V.append(s.v[vi])
                    nf.append(remap[vi])
                F.append(nf)
                Mi.append(s.m[i])
                UV.append(s.uv[i])
            me = bpy.data.meshes.new(name + '_' + pn)
            me.from_pydata(V, [], F)
            me.update()
            o = bpy.data.objects.new(name + '_' + pn, me)
            link(o)
            used = sorted(set(Mi))
            for mn in used:
                o.data.materials.append(MAT[mn])
            for poly, mn in zip(o.data.polygons, Mi):
                poly.material_index = used.index(mn)
                poly.use_smooth = True
            if any(u is not None for u in UV):
                uvl = o.data.uv_layers.new(name='UVMap')
                for poly, u in zip(o.data.polygons, UV):
                    for k, li in enumerate(poly.loop_indices):
                        uvl.data[li].uv = u[k] if u else (0.5, 0.5)
            out[pn] = o
        return out


def ring_shape(w, zb, zt, r_top, r_bot, tumble, n=16):
    """cross-section of the lower body: rounded rectangle, sides leaning in toward the top.
    returns list of (x, z) going around: bottom-centre -> left side -> top -> right side"""
    pts = []
    # corners: (cx, cz, radius, start angle, end angle)
    wt = w - tumble
    corners = [(w - r_bot, zb + r_bot, r_bot, -math.pi / 2, 0), (wt - r_top, zt - r_top, r_top, 0, math.pi / 2)]
    seg = n // 4
    left = []
    for cx, cz, r, a0, a1 in corners:
        for k in range(seg + 1):
            a = a0 + (a1 - a0) * k / seg
            left.append((cx + math.cos(a) * r, cz + math.sin(a) * r))
    right = [(-x, z) for x, z in reversed(left)]
    return left + right


SPECS = {}


def spec(key, **kw):
    SPECS[key] = kw


# t runs 0 (front bumper) -> 1 (rear bumper). heights in metres above ground.
spec('sedan', L=4.5, W=1.86, wheel_r=0.33, wb=(0.17, 0.79), clear=0.2,
     top=[(0, 0.62), (0.04, 0.75), (0.2, 0.82), (0.3, 0.9), (0.72, 0.95), (0.86, 0.98), (0.96, 0.92), (1, 0.72)],
     bot=[(0, 0.32), (0.06, 0.24), (0.94, 0.24), (1, 0.34)],
     plan=[(0, 0.86), (0.05, 0.97), (0.15, 1), (0.85, 1), (0.95, 0.97), (1, 0.88)],
     cabin=dict(a=0.3, r1=0.45, r2=0.66, c=0.84, roof=1.42, inset=0.13, roofw=0.72),
     doors=[(0.34, 0.56), (0.56, 0.75)], hood=(0.03, 0.29), trunk=(0.85, 0.99), bumpers=(0.05, 0.95))

GROUND = 0.0


def build_car(key, S, color_parts=None):
    L, W = S['L'], S['W']
    hw = W / 2
    M = Mesh()
    NT = 30
    # stations along the length: evenly spaced + every boundary we need crisp
    ts = set(round(i / NT, 4) for i in range(NT + 1))
    for d0, d1 in S['doors']:
        ts.update([d0, d1])
    ts.update([S['hood'][0], S['hood'][1], S['trunk'][0], S['trunk'][1], S['bumpers'][0], S['bumpers'][1]])
    for w in S['wb']:
        ts.update([w - 0.06, w - 0.03, w, w + 0.03, w + 0.06])
    ts = sorted(t for t in ts if 0 <= t <= 1)
    y_of = lambda t: -L / 2 + t * L
    # wheel arches: lift the bottom edge over the wheels
    wr = S['wheel_r']

    def bottom(t, x_side):
        zb = curve(S['bot'], t)
        for wt in S['wb']:
            dy = (t - wt) * L
            if abs(dy) < wr + 0.08:
                arch = math.sqrt(max(0.0, (wr + 0.08) ** 2 - dy * dy))
                zb = max(zb, wr + 0.02 + arch * 0.92 if abs(x_side) > 0.5 else zb)
        return zb

    rings = []
    for t in ts:
        y = y_of(t)
        w = hw * curve(S['plan'], t)
        zt = curve(S['top'], t)
        zb_center = curve(S['bot'], t)
        r_top = min(0.12, (zt - zb_center) * 0.3)
        shape = ring_shape(w, zb_center, zt, r_top, 0.06, 0.04)
        ring = []
        for x, z in shape:
            # arches: side vertices near the bottom rise over the wheel
            if z < zb_center + 0.1:
                zb = bottom(t, x / w)
                z = max(z, zb) if abs(x) > w * 0.55 else z
            ring.append(M.vert((x, y, z)))
        rings.append((t, ring, shape))
    n = len(rings[0][1])
    hood0, hood1 = S['hood']
    tr0, tr1 = S['trunk']
    b0, b1 = S['bumpers']

    def part_of(t, x, z, zt, side_face):
        if t < b0:
            return 'bumpF'
        if t > b1:
            return 'bumpR'
        if not side_face and hood0 <= t < hood1 and z > zt - 0.08:
            return 'hood'
        if not side_face and tr0 <= t < tr1 and z > zt - 0.08:
            return 'trunk'
        if side_face:
            for i, (d0, d1) in enumerate(S['doors']):
                if d0 <= t < d1 and z > 0.32:
                    return ('doorL' if x > 0 else 'doorR') + ('' if i == 0 else '2')
        return 'body'

    for (t0, r0, s0), (t1, r1, s1) in zip(rings, rings[1:]):
        tm = (t0 + t1) / 2
        zt = curve(S['top'], tm)
        for k in range(n - 1):
            x = (s0[k][0] + s0[k + 1][0]) / 2
            z = (s0[k][1] + s0[k + 1][1]) / 2
            nx = s0[k + 1][1] - s0[k][1]  # outward-ish: side faces have small slope in z-change vs x-change
            side_face = abs(s0[k + 1][0] - s0[k][0]) < abs(s0[k + 1][1] - s0[k][1]) * 1.5 and abs(x) > hw * 0.6
            p = part_of(tm, x, z, zt, side_face)
            if S.get('bed') and S['bed'][0] < tm < S['bed'][1] and not side_face and z > zt - 0.12 and abs(x) < hw - 0.12:
                continue
            low = z < (0.36 if p in ('bumpF', 'bumpR') else 0.3)
            mm = 'trim' if low and S.get('trimlow', True) else 'paint'
            if S.get('two_tone') and p.startswith('door') and mm == 'paint':
                mm = 'paint2'
            if S.get('stripes') and not side_face and abs(x) < 0.2 and z > zt - 0.1 and mm == 'paint':
                mm = 'paint2'
            M.face([r1[k], r1[k + 1], r0[k + 1], r0[k]], mm, p)  # outward
        # bottom (closing the ring under the car)
        M.face([r1[n - 1], r1[0], r0[0], r0[n - 1]], 'trim', 'body')
    # end caps (front and rear)
    for (t, ring, shape), flip in ((rings[0], True), (rings[-1], False)):
        c = M.vert((0, y_of(t), sum(z for _, z in shape) / len(shape)))
        for k in range(n - 1):
            M.face([ring[k], ring[k + 1], c] if flip else [ring[k + 1], ring[k], c], 'paint', 'bumpF' if flip else 'bumpR')

    # ---- glasshouse: belt -> window band -> roof, lofted between cabin a..c ----
    C = S['cabin']
    cts = sorted(set([C['a'], C['a'] + 0.02, C['r1'], C['r2'], C['c'] - 0.02, C['c']] + [round(C['a'] + (C['c'] - C['a']) * i / 16, 4) for i in range(17)]
                     + [d for pair in S['doors'] for d in pair if C['a'] < d < C['c']]))
    bpil = [(S['doors'][0][1] - 0.012, S['doors'][0][1] + 0.012)] if len(S['doors']) > 1 else []
    cts = sorted(set(cts + [b for pr in bpil for b in pr]))
    if S.get('open'):
        cts = [t for t in cts if t <= C['r1']] + [C['r1'] + 0.005]
    grings = []
    for t in cts:
        y = y_of(t)
        belt = curve(S['top'], t)
        roof = C['roof']
        if t < C['r1']:
            h = belt + (roof - belt) * ((t - C['a']) / (C['r1'] - C['a']))
        elif t > C['r2']:
            h = belt + (roof - belt) * ((C['c'] - t) / (C['c'] - C['r2']))
        else:
            h = roof + 0.02 * math.sin((t - C['r1']) / (C['r2'] - C['r1']) * math.pi)
        wb = hw * curve(S['plan'], t) - 0.05
        wr_ = hw * C['roofw']
        # side profile of the window band: belt, window bottom, window top, roof edge
        pts = [(wb, belt), (wb - 0.01, belt + 0.03), (lerp(wb, wr_, 0.88), lerp(belt, h, 0.9)), (wr_ - 0.04, h), (0, h + 0.03)]
        ring = []
        for x, z in pts:
            ring.append(M.vert((x, y, z)))
        for x, z in reversed(pts[:-1]):
            ring.append(M.vert((-x, y, z)))
        grings.append((t, ring))
    gn = len(grings[0][1])
    for (t0, r0), (t1, r1) in zip(grings, grings[1:]):
        tm = (t0 + t1) / 2
        in_bp = any(a <= tm <= b for a, b in bpil)
        for k in range(gn - 1):
            # k: 0 belt strip, 1 side window, 2 roof edge, 3 roof (left); mirrored for the right
            kk = k if k < 4 else gn - 2 - k
            if S.get('open') and kk in (0, 1):
                continue
            if kk == 1:
                m = 'trim' if in_bp or tm < C['a'] + 0.02 or tm > C['c'] - 0.02 else 'glass'
                if S.get('cargo') and tm > S['doors'][0][1]:
                    m = 'paint'
                if S.get('limo') and S['doors'][0][1] < tm < S['doors'][1][0]:
                    m = 'glass'
            elif kk in (2, 3):
                if tm < C['r1']:
                    m = 'glass' if (kk == 3 and tm > C['a'] + 0.015) else 'paint'
                elif tm > C['r2']:
                    m = 'glass' if (kk == 3 and tm < C['c'] - 0.015) else 'paint'
                else:
                    m = 'paint'
            else:
                m = 'trim'
            part = 'cabin'
            if m == 'glass' and kk == 1:
                for i, (d0, d1) in enumerate(S['doors']):
                    if d0 <= tm < d1:
                        part = ('doorL' if k < 4 else 'doorR') + ('' if i == 0 else '2')
            M.face([r0[k], r1[k], r1[k + 1], r0[k + 1]], m, part)

    # ---- details: grille, lamps, mirrors, plates, handles ----
    objs = M.build('c_' + key)
    det = []
    yF, yR = y_of(0.0), y_of(1.0)
    zt0 = curve(S['top'], 0.02)
    lampz = zt0 - 0.08
    for sx in (1, -1):
        lw = S.get('lampw', 0.36)
        det.append(box_d('lampH', (lw, 0.12, S.get('lamph', 0.13)), (sx * (hw * 0.64), yF + 0.07, lampz), 'lamp_head', bev=0.025))
        det.append(box_d('lampT', (S.get('tailw', 0.34), 0.1, 0.13), (sx * (hw * 0.68), yR - 0.06, curve(S['top'], 0.98) - 0.1), 'lamp_tail', bev=0.025))
        for i, (d0, d1) in enumerate(S['doors']):
            det.append(box_d('handle', (0.03, 0.14, 0.03), (sx * (hw * curve(S['plan'], d1) + 0.005), y_of(d1) - 0.12, curve(S['top'], d1) - 0.1), 'chrome', bev=0.008))
        det.append(box_d('mirror', (0.14, 0.06, 0.08), (sx * (hw + 0.04), y_of(C['a'] + 0.04), curve(S['top'], C['a']) + 0.08), 'paint', bev=0.02))
    det.append(box_d('grille', (hw * S.get('grillew', 0.62), 0.1, S.get('grilleh', 0.15)), (0, yF + 0.06, lampz - 0.04), 'trim', bev=0.02))
    det.append(box_d('grille2', (hw * S.get('grillew', 0.62) + 0.04, 0.09, S.get('grilleh', 0.15) + 0.04), (0, yF + 0.065, lampz - 0.04), 'chrome', bev=0.02))
    det.append(box_d('plateF', (0.34, 0.01, 0.1), (0, yF - 0.0, curve(S['bot'], 0.0) + 0.1), 'plate', uvbox=(0.0, 0.0, 0.5, 0.25)))
    det.append(box_d('plateR', (0.34, 0.01, 0.1), (0, yR + 0.0, curve(S['top'], 1.0) - 0.15), 'plate', uvbox=(0.0, 0.0, 0.5, 0.25)))
    if S.get('taxi'):
        det.append(box_d('taxisign', (0.62, 0.22, 0.2), (0, y_of((C['r1'] + C['r2']) / 2), C['roof'] + 0.12), 'decal', bev=0.03, uvbox=(0.5, 0.75, 1.0, 1.0)))
    if S.get('scoop'):
        det.append(box_d('scoop', (0.5, 0.6, 0.1), (0, y_of(0.18), curve(S['top'], 0.18) + 0.03), 'trim', bev=0.04))
    if S.get('spoiler'):
        det.append(box_d('wing', (W - 0.2, 0.22, 0.03), (0, y_of(0.95), curve(S['top'], 0.95) + 0.2), 'paint', bev=0.01))
        for sx in (1, -1):
            det.append(box_d('wingpost', (0.04, 0.08, 0.2), (sx * (hw - 0.3), y_of(0.94), curve(S['top'], 0.94) + 0.1), 'trim'))
    if S.get('police'):
        det.append(box_d('bar', (1.1, 0.26, 0.11), (0, y_of((C['r1'] + C['r2']) / 2 - 0.02), C['roof'] + 0.07), 'trim', bev=0.03))
        for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_head')):
            det.append(box_d('barlamp', (0.48, 0.24, 0.09), (sx * 0.28, y_of((C['r1'] + C['r2']) / 2 - 0.02), C['roof'] + 0.1), nm, bev=0.02))
        det.append(box_d('pushbar', (hw * 1.1, 0.08, 0.32), (0, yF - 0.06, 0.48), 'trim', bev=0.02))
    if S.get('bed'):
        b0, b1 = S['bed']
        yb0, yb1 = y_of(b0), y_of(b1)
        zb = curve(S['top'], (b0 + b1) / 2)
        det.append(box_d('bedfloor', (W - 0.3, yb1 - yb0, 0.04), (0, (yb0 + yb1) / 2, zb - 0.42), 'trim'))
        for sx in (1, -1):
            det.append(box_d('bedwall', (0.05, yb1 - yb0, 0.44), (sx * (hw - 0.14), (yb0 + yb1) / 2, zb - 0.2), 'trim'))
        det.append(box_d('bedfront', (W - 0.28, 0.05, 0.44), (0, yb0 + 0.02, zb - 0.2), 'trim'))
        det.append(box_d('tailgate', (W - 0.28, 0.05, 0.44), (0, yb1 - 0.02, zb - 0.2), 'paint'))
    for o in det:
        o.parent = None
    details = join(det, 'c_' + key + '_details')
    # interior: front seats, rear bench, dashboard, steering wheel
    it = []
    yd = y_of(C['a'] + 0.04)
    beltz = curve(S['top'], 0.5)
    seat_y = y_of((S['doors'][0][0] + S['doors'][0][1]) / 2 + 0.02)
    for sx in (1, -1):
        it.append(box_d('seat', (0.48, 0.5, 0.12), (sx * 0.38, seat_y, beltz - 0.42), 'interior', bev=0.04))
        it.append(box_d('back', (0.48, 0.12, 0.6), (sx * 0.38, seat_y + 0.28, beltz - 0.08), 'interior', bev=0.05, rot=(-0.18, 0, 0)))
        it.append(box_d('rest', (0.24, 0.1, 0.14), (sx * 0.38, seat_y + 0.33, beltz + 0.28), 'interior', bev=0.03))
    if len(S['doors']) > 1:
        rs = y_of((S['doors'][1][0] + S['doors'][1][1]) / 2 + 0.03)
        it.append(box_d('bench', (W - 0.35, 0.5, 0.12), (0, rs, beltz - 0.4), 'interior', bev=0.04))
        it.append(box_d('bback', (W - 0.35, 0.12, 0.55), (0, rs + 0.3, beltz - 0.08), 'interior', bev=0.05, rot=(-0.2, 0, 0)))
    it.append(box_d('dash', (W - 0.2, 0.4, 0.25), (0, yd + 0.12, beltz - 0.05), 'interior', bev=0.06))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.02, major_segments=16, minor_segments=5, location=(0.38, seat_y - 0.45, beltz + 0.05), rotation=(math.radians(62), 0, 0))
    sw = bpy.context.object
    assign(sw, MAT['trim'])
    it.append(sw)
    interior = join(it, 'c_' + key + '_interior')

    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    for pn, o in objs.items():
        o.name = pn if pn != 'cabin' else 'cabin'
    # rename parts to plain names under the root (the root gives the type)
    for pn, o in list(objs.items()):
        o.parent = root
    details.parent = root
    interior.parent = root
    details.name, interior.name = 'details', 'interior'
    # pivots: doors hinge at their front edge, hood near the windshield, trunk at the rear window
    for pn, o in objs.items():
        if pn.startswith('door'):
            i = 0 if not pn.endswith('2') else 1
            d0 = S['doors'][i][0]
            set_origin(o, (hw * (1 if 'L' in pn else -1) * 0.98, y_of(d0), 0.6))
        elif pn == 'hood':
            set_origin(o, (0, y_of(S['hood'][1]), curve(S['top'], S['hood'][1])))
        elif pn == 'trunk':
            set_origin(o, (0, y_of(S['trunk'][0]), curve(S['top'], S['trunk'][0])))
        elif pn in ('bumpF', 'bumpR'):
            set_origin(o, (0, y_of(0 if pn == 'bumpF' else 1), 0.4))
    # empties the game reads
    def E(name, p):
        e = empty(name, p, root)
        return e
    for i, wt in enumerate(S['wb']):
        for sx in (1, -1):
            E(('w_F' if i == 0 else 'w_R') + ('L' if sx > 0 else 'R'), (sx * (hw - 0.17), y_of(wt), wr))
    E('seat_D', (0.38, seat_y, beltz - 0.36))
    E('seat_P', (-0.38, seat_y, beltz - 0.36))
    if len(S['doors']) > 1:
        rs = y_of((S['doors'][1][0] + S['doors'][1][1]) / 2 + 0.03)
        E('seat_RL', (0.38, rs, beltz - 0.34))
        E('seat_RR', (-0.38, rs, beltz - 0.34))
    for sx, nm in ((1, 'L'), (-1, 'R')):
        E('lamp_head_' + nm, (sx * hw * 0.62, yF - 0.02, lampz))
        E('lamp_tail_' + nm, (sx * hw * 0.66, yR + 0.02, curve(S['top'], 0.98) - 0.09))
    return root


def set_origin(o, p):
    p = Vector(p)
    o.data.transform(Matrix.Translation(-p))
    o.location = p


def box_d(name, size, loc, m, bev=0.0, rot=(0, 0, 0), uvbox=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True, rotation=True, location=False)
    if bev:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bev
        b.segments = 2
        apply_mods(o)
    assign(o, MAT[m])
    for p in o.data.polygons:
        p.use_smooth = True
    if uvbox:
        uvl = o.data.uv_layers.get('UVMap') or o.data.uv_layers.new(name='UVMap')
        u0, v0, u1, v1 = uvbox
        for poly in o.data.polygons:
            for li in poly.loop_indices:
                vco = o.data.vertices[o.data.loops[li].vertex_index].co
                uvl.data[li].uv = (u0 + (u1 - u0) * (0.5 + vco.x / size[0] * (1 if poly.normal.y > 0 else -1)), v0 + (v1 - v0) * (0.5 + vco.z / size[2]))
    return o


def wheel():
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.33, depth=0.22, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
    tire = bpy.context.object
    b = tire.modifiers.new('bev', 'BEVEL')
    b.width = 0.05
    b.segments = 3
    apply_mods(tire)
    assign(tire, MAT['tire'])
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.22, depth=0.235, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
    rim = bpy.context.object
    assign(rim, MAT['rim'])
    spokes = []
    for k in range(5):
        a = k * 2 * math.pi / 5
        spokes.append(box_d('sp', (0.02, 0.05, 0.36), (0.12, 0, 0), 'rim', rot=(a, 0, 0)))
    w = join([tire, rim] + spokes, 'wheel')
    for p in w.data.polygons:
        p.use_smooth = True
    shade_auto(w, 40)
    return w



def copy_spec(base, **kw):
    d = dict(SPECS[base])
    d.update(kw)
    return d


spec('police', **copy_spec('sedan', L=4.75, W=1.92, police=True, two_tone=True))
spec('taxi', **copy_spec('sedan', taxi=True))
spec('sports', L=4.3, W=1.96, wheel_r=0.33, wb=(0.19, 0.8), clear=0.15,
     top=[(0, 0.5), (0.05, 0.6), (0.25, 0.7), (0.36, 0.76), (0.7, 0.83), (0.88, 0.86), (0.97, 0.78), (1, 0.6)],
     bot=[(0, 0.22), (0.06, 0.16), (0.94, 0.16), (1, 0.25)],
     plan=[(0, 0.82), (0.05, 0.95), (0.18, 1), (0.82, 1), (0.95, 0.96), (1, 0.86)],
     cabin=dict(a=0.36, r1=0.52, r2=0.62, c=0.88, roof=1.14, inset=0.13, roofw=0.66),
     doors=[(0.38, 0.65)], hood=(0.03, 0.35), trunk=(0.88, 0.99), bumpers=(0.05, 0.95), spoiler=True, lamph=0.09, grilleh=0.08)
spec('muscle', L=4.8, W=2.0, wheel_r=0.35, wb=(0.17, 0.8), clear=0.2,
     top=[(0, 0.64), (0.04, 0.8), (0.3, 0.86), (0.4, 0.9), (0.7, 0.92), (0.9, 0.94), (0.97, 0.88), (1, 0.7)],
     bot=[(0, 0.3), (0.06, 0.22), (0.94, 0.22), (1, 0.32)],
     plan=[(0, 0.9), (0.04, 0.98), (0.12, 1), (0.88, 1), (0.96, 0.98), (1, 0.9)],
     cabin=dict(a=0.42, r1=0.54, r2=0.66, c=0.92, roof=1.3, inset=0.13, roofw=0.7),
     doors=[(0.43, 0.67)], hood=(0.03, 0.41), trunk=(0.92, 0.99), bumpers=(0.04, 0.96), scoop=True, grillew=0.8)
spec('convertible', **copy_spec('sports', L=4.4, open=True, spoiler=False, wb=(0.18, 0.8),
     cabin=dict(a=0.38, r1=0.48, r2=0.6, c=0.86, roof=1.12, inset=0.13, roofw=0.68)))
spec('hatch', L=3.9, W=1.8, wheel_r=0.31, wb=(0.16, 0.83), clear=0.2,
     top=[(0, 0.62), (0.04, 0.76), (0.22, 0.85), (0.32, 0.9), (0.85, 0.96), (0.97, 0.94), (1, 0.76)],
     bot=[(0, 0.32), (0.06, 0.24), (0.94, 0.24), (1, 0.34)],
     plan=[(0, 0.86), (0.05, 0.97), (0.15, 1), (0.88, 1), (0.97, 0.97), (1, 0.9)],
     cabin=dict(a=0.32, r1=0.47, r2=0.84, c=0.985, roof=1.46, inset=0.13, roofw=0.74),
     doors=[(0.35, 0.56), (0.56, 0.75)], hood=(0.03, 0.31), trunk=(0.97, 0.99), bumpers=(0.05, 0.96))
spec('suv', L=4.85, W=2.0, wheel_r=0.38, wb=(0.18, 0.8), clear=0.35,
     top=[(0, 0.78), (0.04, 0.95), (0.24, 1.04), (0.3, 1.1), (0.88, 1.14), (0.98, 1.12), (1, 0.88)],
     bot=[(0, 0.46), (0.06, 0.38), (0.94, 0.38), (1, 0.46)],
     plan=[(0, 0.9), (0.05, 0.98), (0.15, 1), (0.88, 1), (0.97, 0.98), (1, 0.92)],
     cabin=dict(a=0.3, r1=0.42, r2=0.93, c=0.985, roof=1.86, inset=0.13, roofw=0.84),
     doors=[(0.32, 0.55), (0.55, 0.76)], hood=(0.03, 0.29), trunk=(0.97, 0.99), bumpers=(0.05, 0.95), grilleh=0.22, grillew=0.7)
spec('minivan', L=5.0, W=2.0, wheel_r=0.34, wb=(0.16, 0.8), clear=0.25,
     top=[(0, 0.7), (0.04, 0.86), (0.16, 0.96), (0.22, 1.02), (0.9, 1.05), (0.98, 1.0), (1, 0.82)],
     bot=[(0, 0.36), (0.06, 0.3), (0.94, 0.3), (1, 0.38)],
     plan=[(0, 0.88), (0.05, 0.97), (0.14, 1), (0.88, 1), (0.97, 0.98), (1, 0.92)],
     cabin=dict(a=0.2, r1=0.36, r2=0.94, c=0.985, roof=1.8, inset=0.13, roofw=0.84),
     doors=[(0.24, 0.44), (0.44, 0.7)], hood=(0.03, 0.19), trunk=(0.97, 0.99), bumpers=(0.05, 0.95))
spec('pickup', L=5.4, W=2.05, wheel_r=0.38, wb=(0.17, 0.8), clear=0.4,
     top=[(0, 0.82), (0.04, 1.0), (0.3, 1.06), (0.36, 1.1), (0.97, 1.12), (1, 1.0)],
     bot=[(0, 0.5), (0.06, 0.42), (0.94, 0.42), (1, 0.5)],
     plan=[(0, 0.92), (0.04, 0.99), (0.1, 1), (0.92, 1), (0.98, 0.99), (1, 0.95)],
     cabin=dict(a=0.33, r1=0.42, r2=0.53, c=0.57, roof=1.88, inset=0.13, roofw=0.84),
     doors=[(0.35, 0.56)], hood=(0.03, 0.32), trunk=(0.985, 0.99), bumpers=(0.04, 0.97), bed=(0.6, 0.965), grilleh=0.26, grillew=0.78)
spec('monster', **copy_spec('pickup'))
spec('limo', L=7.4, W=2.0, wheel_r=0.33, wb=(0.11, 0.86), clear=0.2,
     top=[(0, 0.64), (0.025, 0.77), (0.12, 0.84), (0.19, 0.92), (0.82, 0.96), (0.92, 0.98), (0.975, 0.92), (1, 0.72)],
     bot=[(0, 0.32), (0.04, 0.24), (0.96, 0.24), (1, 0.34)],
     plan=[(0, 0.86), (0.03, 0.97), (0.09, 1), (0.91, 1), (0.97, 0.97), (1, 0.88)],
     cabin=dict(a=0.19, r1=0.27, r2=0.84, c=0.91, roof=1.44, inset=0.13, roofw=0.74),
     doors=[(0.22, 0.36), (0.66, 0.8)], hood=(0.02, 0.18), trunk=(0.91, 0.99), bumpers=(0.03, 0.97), limo=True)
spec('van', L=5.0, W=2.1, wheel_r=0.36, wb=(0.15, 0.8), clear=0.3,
     top=[(0, 0.85), (0.05, 1.0), (0.12, 1.06), (0.18, 1.12), (0.98, 1.16), (1, 1.0)],
     bot=[(0, 0.42), (0.05, 0.34), (0.95, 0.34), (1, 0.42)],
     plan=[(0, 0.9), (0.04, 0.98), (0.1, 1), (0.95, 1), (1, 0.97)],
     cabin=dict(a=0.16, r1=0.28, r2=0.965, c=0.995, roof=2.2, inset=0.13, roofw=0.92),
     doors=[(0.19, 0.36)], hood=(0.03, 0.15), trunk=(0.985, 0.99), bumpers=(0.04, 0.97), cargo=True, grilleh=0.2)
# the cab of a work truck (front 2.4 m); the rest is added by build_truck
spec('cab', L=2.5, W=2.4, wheel_r=0.48, wb=(0.36, 0.95), clear=0.45,
     top=[(0, 1.05), (0.06, 1.25), (0.16, 1.32), (0.26, 1.36), (1, 1.38)],
     bot=[(0, 0.6), (0.06, 0.5), (1, 0.5)],
     plan=[(0, 0.94), (0.05, 0.99), (0.12, 1), (1, 1)],
     cabin=dict(a=0.2, r1=0.36, r2=0.97, c=0.995, roof=2.75, inset=0.13, roofw=0.93),
     doors=[(0.4, 0.9)], hood=(0.03, 0.19), trunk=(0.995, 0.999), bumpers=(0.05, 0.999), grilleh=0.35, grillew=0.7, lampw=0.3)


def move_children(root, dy=0.0, dz=0.0):
    for c in root.children:
        c.location.y += dy
        c.location.z += dz


def build_truck(key, total_L, kind):
    root = build_car(key, SPECS['cab'])
    cabL = SPECS['cab']['L']
    move_children(root, dy=-(total_L - cabL) / 2)
    # rear axle(s) under the body
    for c in list(root.children):
        if c.name in ('w_RL', 'w_RR'):
            c.location.y = total_L / 2 - (1.6 if total_L > 7 else 1.2)
    W = SPECS['cab']['W']
    bodyL = total_L - cabL - 0.15
    y0 = -total_L / 2 + cabL + 0.15
    yc = y0 + bodyL / 2
    parts = []
    if kind == 'box':
        parts.append(box_d('box', (W + 0.05, bodyL, 2.4), (0, yc, 1.75), 'paint2', bev=0.04))
        parts.append(box_d('frame', (W * 0.8, bodyL, 0.3), (0, yc, 0.55), 'trim'))
    elif kind == 'ambulance':
        parts.append(box_d('box', (W + 0.05, bodyL, 2.3), (0, yc, 1.75), 'paint2', bev=0.06))
        for sx in (1, -1):
            parts.append(box_d('stripe', (0.02, bodyL, 0.25), (sx * (W / 2 + 0.03), yc, 1.3), 'decal', uvbox=(0.0, 0.25, 0.5, 0.5)))
            parts.append(box_d('cross', (0.02, 0.9, 0.9), (sx * (W / 2 + 0.035), yc, 2.2), 'decal', uvbox=(0.5, 0.25, 0.75, 0.5)))
        for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_head')):
            parts.append(box_d('barlamp', (0.5, 0.2, 0.12), (sx * 0.4, -total_L / 2 + cabL - 0.3, 2.85), nm, bev=0.02))
            parts.append(box_d('cornerlamp', (0.16, 0.16, 0.12), (sx * (W / 2 - 0.1), total_L / 2 - 0.1, 2.95), nm))
        parts.append(box_d('frame', (W * 0.8, bodyL, 0.3), (0, yc, 0.55), 'trim'))
    elif kind == 'garbage':
        parts.append(box_d('hopper', (W + 0.05, bodyL * 0.78, 2.6), (0, yc - bodyL * 0.1, 1.9), 'paint', bev=0.05))
        tail = box_d('tail', (W, bodyL * 0.26, 2.2), (0, y0 + bodyL * 0.87, 1.55), 'paint2', bev=0.05, rot=(0.35, 0, 0))
        parts.append(tail)
        for sx in (1, -1):
            parts.append(box_d('stripe', (0.02, bodyL * 0.78, 0.18), (sx * (W / 2 + 0.03), yc - bodyL * 0.1, 1.2), 'chrome'))
        parts.append(box_d('frame', (W * 0.8, bodyL, 0.3), (0, yc, 0.55), 'trim'))
    elif kind == 'tow':
        parts.append(box_d('bed', (W, bodyL, 0.22), (0, yc, 0.95), 'trim', bev=0.02))
        boom = box_d('boom', (0.26, bodyL * 0.85, 0.26), (0, yc + 0.2, 1.6), 'decal', rot=(-0.35, 0, 0), uvbox=(0.75, 0.25, 1.0, 0.5))
        parts.append(boom)
        parts.append(box_d('hook', (0.5, 0.2, 0.3), (0, total_L / 2 - 0.1, 0.8), 'trim', bev=0.02))
        for sx, nm in ((1, 'lamp_head'), (-1, 'lamp_head')):
            parts.append(box_d('amber', (0.4, 0.18, 0.1), (sx * 0.35, -total_L / 2 + cabL - 0.3, 2.83), 'lamp_head', bev=0.02))
    elif kind == 'fire':
        parts.append(box_d('body', (W + 0.05, bodyL, 1.7), (0, yc, 1.4), 'paint', bev=0.04))
        for k in range(4):
            for sx in (1, -1):
                parts.append(box_d('door', (0.02, bodyL / 4 - 0.12, 1.2), (sx * (W / 2 + 0.03), y0 + bodyL * (k + 0.5) / 4, 1.35), 'chrome'))
        for sx in (1, -1):
            parts.append(box_d('rail', (0.07, bodyL * 1.05, 0.07), (sx * 0.4, yc - 0.3, 2.45), 'chrome'))
        for k in range(10):
            parts.append(box_d('rung', (0.8, 0.05, 0.05), (0, y0 - 0.6 + k * bodyL / 9, 2.45), 'chrome'))
        for sx, nm in ((1, 'lamp_tail'), (-1, 'lamp_tail')):
            parts.append(box_d('barlamp', (0.6, 0.22, 0.12), (sx * 0.4, -total_L / 2 + cabL - 0.3, 2.85), nm, bev=0.02))
    for o in parts:
        o.parent = None
    extra = join(parts, 'c_' + key + '_extra')
    extra.parent = root
    extra.name = 'cargo'
    return root


def build_bus(key):
    L, W, H = 10.2, 2.55, 3.05
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    p = []
    p.append(box_d('shell', (W, L, H - 0.45), (0, 0, 0.45 + (H - 0.45) / 2), 'paint', bev=0.1))
    for sx in (1, -1):
        p.append(box_d('win', (0.03, L - 1.6, 0.95), (sx * (W / 2 + 0.005), 0.4, 2.15), 'glass'))
        p.append(box_d('stripe', (0.03, L - 0.4, 0.25), (sx * (W / 2 + 0.006), 0, 1.3), 'paint2'))
    p.append(box_d('wind', (W - 0.2, 0.04, 1.4), (0, -L / 2 - 0.01, 1.95), 'glass'))
    p.append(box_d('rearwin', (W - 0.5, 0.04, 0.7), (0, L / 2 + 0.01, 2.3), 'glass'))
    p.append(box_d('sign', (W - 0.6, 0.05, 0.3), (0, -L / 2 - 0.02, 2.85), 'decal', uvbox=(0.0, 0.5, 1.0, 0.625)))
    p.append(box_d('door', (0.03, 1.1, 2.1), (-W / 2 - 0.01, -L / 2 + 1.4, 1.5), 'glass'))
    p.append(box_d('bumpF', (W + 0.04, 0.2, 0.35), (0, -L / 2 - 0.06, 0.55), 'trim', bev=0.03))
    p.append(box_d('bumpR', (W + 0.04, 0.2, 0.35), (0, L / 2 + 0.06, 0.55), 'trim', bev=0.03))
    for sx in (1, -1):
        p.append(box_d('lampH', (0.3, 0.06, 0.18), (sx * (W / 2 - 0.3), -L / 2 - 0.03, 0.85), 'lamp_head', bev=0.02))
        p.append(box_d('lampT', (0.2, 0.06, 0.4), (sx * (W / 2 - 0.2), L / 2 + 0.03, 1.0), 'lamp_tail', bev=0.02))
    for o in p:
        o.parent = None
    body = join(p, 'c_bus_body')
    body.parent = root
    body.name = 'body'
    for nm, (x, y, z) in {'w_FL': (W / 2 - 0.25, -L / 2 + 2.2, 0.5), 'w_FR': (-W / 2 + 0.25, -L / 2 + 2.2, 0.5), 'w_RL': (W / 2 - 0.25, L / 2 - 2.6, 0.5), 'w_RR': (-W / 2 + 0.25, L / 2 - 2.6, 0.5),
                          'seat_D': (0.6, -L / 2 + 1.2, 1.0), 'lamp_head_L': (W / 2 - 0.3, -L / 2 - 0.06, 0.85), 'lamp_head_R': (-W / 2 + 0.3, -L / 2 - 0.06, 0.85),
                          'lamp_tail_L': (W / 2 - 0.2, L / 2 + 0.06, 1.0), 'lamp_tail_R': (-W / 2 + 0.2, L / 2 + 0.06, 1.0)}.items():
        empty(nm, (x, y, z), root)
    return root


def build_bike(key, scooter=False):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    p = []
    if scooter:
        p.append(box_d('shell', (0.36, 0.62, 0.5), (0, 0.25, 0.62), 'paint', bev=0.12))
        p.append(box_d('floor', (0.3, 0.55, 0.06), (0, -0.2, 0.32), 'trim', bev=0.02))
        p.append(box_d('front', (0.32, 0.2, 0.75), (0, -0.55, 0.65), 'paint', bev=0.08, rot=(-0.25, 0, 0)))
        p.append(box_d('seat', (0.3, 0.6, 0.1), (0, 0.25, 0.9), 'trim', bev=0.04))
        p.append(box_d('bars', (0.62, 0.05, 0.05), (0, -0.62, 1.08), 'chrome'))
        p.append(box_d('lampH', (0.14, 0.08, 0.1), (0, -0.68, 0.98), 'lamp_head', bev=0.03))
        p.append(box_d('lampT', (0.12, 0.05, 0.06), (0, 0.58, 0.72), 'lamp_tail', bev=0.02))
        wf, wr, rad = -0.62, 0.55, 0.22
    else:
        p.append(box_d('tank', (0.3, 0.55, 0.24), (0, -0.2, 0.92), 'paint', bev=0.09))
        p.append(box_d('engine', (0.32, 0.45, 0.32), (0, -0.05, 0.5), 'chrome', bev=0.06))
        p.append(box_d('seat', (0.28, 0.6, 0.1), (0, 0.32, 0.88), 'trim', bev=0.04))
        p.append(box_d('tail', (0.22, 0.45, 0.14), (0, 0.66, 0.84), 'paint', bev=0.05, rot=(-0.2, 0, 0)))
        p.append(box_d('fork', (0.08, 0.06, 0.62), (0, -0.66, 0.66), 'chrome', rot=(-0.4, 0, 0)))
        p.append(box_d('fairing', (0.34, 0.2, 0.32), (0, -0.62, 0.98), 'paint', bev=0.08, rot=(-0.4, 0, 0)))
        p.append(box_d('bars', (0.66, 0.05, 0.05), (0, -0.52, 1.1), 'trim'))
        p.append(box_d('exhaust', (0.08, 0.6, 0.08), (-0.16, 0.35, 0.42), 'chrome'))
        p.append(box_d('lampH', (0.16, 0.08, 0.12), (0, -0.78, 1.0), 'lamp_head', bev=0.03))
        p.append(box_d('lampT', (0.14, 0.05, 0.06), (0, 0.9, 0.86), 'lamp_tail', bev=0.02))
        wf, wr, rad = -0.78, 0.72, 0.33
    for o in p:
        o.parent = None
    body = join(p, 'c_' + key + '_body')
    body.parent = root
    body.name = 'body'
    empty('w_F', (0, wf, rad), root)
    empty('w_R', (0, wr, rad), root)
    empty('seat_D', (0, 0.25, 0.85 if not scooter else 0.85), root)
    empty('lamp_head_L', (0, wf - 0.08, 1.0), root)
    empty('lamp_tail_L', (0, wr + 0.18, 0.84), root)
    return root


def build_boat(key):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    M = Mesh()
    L, W = 6.0, 2.3
    rings = []
    for i in range(13):
        t = i / 12
        y = -L / 2 + t * L
        hw = W / 2 * curve([(0, 0.05), (0.15, 0.6), (0.4, 0.97), (1, 0.92)], t)
        keel = curve([(0, 0.55), (0.2, 0.05), (1, 0.12)], t)
        deck = curve([(0, 1.05), (0.3, 0.95), (1, 0.88)], t)
        pts = [(0, keel - 0.35), (hw * 0.7, keel - 0.1), (hw, deck - 0.35), (hw, deck)]
        ring = [M.vert((x, y, z)) for x, z in pts] + [M.vert((-x, y, z)) for x, z in reversed(pts[1:])]
        rings.append(ring)
    n = len(rings[0])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(n - 1):
            M.face([r0[k], r1[k], r1[k + 1], r0[k + 1]], 'paint' if k in (1, 2, n - 3, n - 2) else 'paint2', 'hull')
        M.face([r0[n - 1], r1[n - 1], r1[0], r0[0]], 'paint2', 'hull')
    hull = M.build('c_boat')['hull']
    hull.name = 'body'
    hull.parent = root
    det = [box_d('deck', (W - 0.3, L * 0.8, 0.05), (0, 0.3, 0.88), 'paint2'),
           box_d('console', (0.7, 0.5, 0.75), (0, 0.0, 1.2), 'paint2', bev=0.06),
           box_d('screen', (0.8, 0.05, 0.35), (0, -0.3, 1.6), 'glass', rot=(-0.4, 0, 0)),
           box_d('seat', (1.2, 0.55, 0.4), (0, 1.0, 1.1), 'interior', bev=0.08),
           box_d('motor', (0.4, 0.45, 0.8), (0, L / 2 + 0.1, 1.0), 'trim', bev=0.08)]
    for o in det:
        o.parent = None
    d = join(det, 'c_boat_det')
    d.parent = root
    d.name = 'details'
    empty('seat_D', (0.25, 0.4, 1.0), root)
    empty('lamp_head_L', (0.0, -L / 2 + 0.4, 1.1), root)
    empty('lamp_tail_L', (0.0, L / 2 - 0.1, 1.2), root)
    return root


def build_heli(key):
    root = bpy.data.objects.new('car_' + key, None)
    link(root)
    M = Mesh()
    rings = []
    for i in range(15):
        t = i / 14
        y = -2.4 + t * 5.4
        r = curve([(0, 0.25), (0.12, 0.85), (0.4, 1.0), (0.6, 0.85), (0.75, 0.4), (1, 0.18)], t)
        zc = curve([(0, 1.25), (0.3, 1.35), (0.7, 1.6), (1, 1.95)], t)
        ring = []
        for k in range(12):
            a = 2 * math.pi * k / 12
            ring.append(M.vert((math.sin(a) * r * 0.95, y, zc + math.cos(a) * r)))
        rings.append((t, ring))
    for (t0, r0), (t1, r1) in zip(rings, rings[1:]):
        for k in range(12):
            k2 = (k + 1) % 12
            canopy = t0 < 0.3 and (k <= 3 or k >= 9)
            M.face([r0[k], r0[k2], r1[k2], r1[k]], 'glass' if canopy else 'paint', 'body')
    b = M.build('c_heli')['body']
    b.name = 'body'
    b.parent = root
    det = [box_d('stripe', (2.0, 2.6, 0.12), (0, 0.2, 0.75), 'paint2', bev=0.05),
           box_d('fin', (0.08, 0.6, 0.9), (0, 3.2, 2.2), 'paint', bev=0.03),
           box_d('mast', (0.2, 0.2, 0.4), (0, 0.2, 2.45), 'trim')]
    for sx in (1, -1):
        det.append(box_d('skid', (0.08, 3.4, 0.08), (sx * 0.95, 0.2, 0.08), 'trim'))
        for y in (-0.6, 1.0):
            det.append(box_d('strut', (0.06, 0.06, 0.6), (sx * 0.85, y, 0.38), 'trim', rot=(0, sx * 0.3, 0)))
    for o in det:
        o.parent = None
    d = join(det, 'c_heli_det')
    d.parent = root
    d.name = 'details'
    blades = [box_d('blade', (0.28, 10.0, 0.05), (0, 0, 0), 'trim', rot=(0, 0, r)) for r in (0, math.pi / 2)]
    rotor = join(blades, 'rotor')
    rotor.location = (0, 0.2, 2.7)
    rotor.parent = root
    tr = [box_d('tblade', (0.1, 1.4, 0.03), (0, 0, 0), 'trim', rot=(0, r, 0)) for r in (0, math.pi / 2)]
    trot = join(tr, 'tailrotor')
    tr_obj = trot
    tr_obj.rotation_euler = (0, 0, math.pi / 2)
    tr_obj.location = (0.12, 3.3, 2.0)
    tr_obj.parent = root
    empty('seat_D', (0.35, -1.3, 1.0), root)
    empty('seat_P', (-0.35, -1.3, 1.0), root)
    empty('lamp_head_L', (0, -2.35, 1.0), root)
    empty('lamp_tail_L', (0, 3.4, 2.6), root)
    return root


# vehicle type index (src/vehicles.js TYPES) -> builder
BUILD = {
    'sedan': lambda: build_car('sedan', SPECS['sedan']), 'sports': lambda: build_car('sports', SPECS['sports']),
    'truck': lambda: build_truck('truck', 5.8, 'box'), 'van': lambda: build_car('van', SPECS['van']),
    'bike': lambda: build_bike('bike'), 'scooter': lambda: build_bike('scooter', True),
    'police': lambda: build_car('police', SPECS['police']), 'bus': lambda: build_bus('bus'),
    'boat': lambda: build_boat('boat'), 'heli': lambda: build_heli('heli'),
    'hatch': lambda: build_car('hatch', SPECS['hatch']), 'suv': lambda: build_car('suv', SPECS['suv']),
    'pickup': lambda: build_car('pickup', SPECS['pickup']), 'minivan': lambda: build_car('minivan', SPECS['minivan']),
    'muscle': lambda: build_car('muscle', SPECS['muscle']), 'convertible': lambda: build_car('convertible', SPECS['convertible']),
    'limo': lambda: build_car('limo', SPECS['limo']), 'monster': lambda: build_car('monster', SPECS['monster']),
    'taxi': lambda: build_car('taxi', SPECS['taxi']), 'garbage': lambda: build_truck('garbage', 8.0, 'garbage'),
    'tow': lambda: build_truck('tow', 6.6, 'tow'), 'ambulance': lambda: build_truck('ambulance', 6.2, 'ambulance'),
    'fire': lambda: build_truck('fire', 9.5, 'fire'),
}
ORDER = ['sedan', 'sports', 'truck', 'van', 'bike', 'scooter', 'police', 'bus', 'boat', 'heli', 'hatch', 'suv', 'pickup', 'minivan',
         'muscle', 'convertible', 'limo', 'monster', 'taxi', 'garbage', 'tow', 'ambulance', 'fire']


def build_all(keys=None):
    reset()
    make_mats()
    roots = []
    for k in (keys or ORDER):
        r = BUILD[k]()
        # unique names: <key>__<part> (the game strips the prefix)
        for c in r.children_recursive:
            base = c.name.split('.')[0]
            if '__' in base:
                base = base.split('__')[1]
            c.name = k + '__' + base
        roots.append(r)
    wh = wheel()
    return roots, wh


if __name__ == '__main__' or True:
    roots, wh = build_all(globals().get('ONLY'))
    result = {'built': [r.name for r in roots], 'tris': {r.name: sum(tris(c) for c in r.children_recursive if c.type == 'MESH') for r in roots}}

if globals().get('EXPORT', True):
    objs = [o for o in bpy.data.objects if o.name.startswith('car_')] + [bpy.data.objects['wheel']]
    for o in objs:
        o.location = (0, 0, 0)
    kb = export_glb('cars', objs)
    result['kb'] = kb
