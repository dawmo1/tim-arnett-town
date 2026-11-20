# Davenport landmarks: one GLB per building in assets/models/landmarks/<name>.glb, sources saved to
# assets/src/landmarks/<name>.blend. Run in Blender:
#   exec(open(ROOT + 'assets/src/landmarks.py').read()); build('blackhawk')   (or build_all())
#
# Conventions (src/landmarks.js relies on these):
# - Blender X = game x (east), Blender -Y = game +z (south), Z up. Each model's origin is the landmark's
#   anchor point (ANCHOR below, in game x/z) at its base height, so the game places it with no rotation.
# - Two objects per file: <name>_lod0 (full detail) and <name>_lod1 (massing + window bands), plus any
#   moving parts as separate nodes (named in the comments).
# - Colours are baked into the 'Col' vertex colour layer; materials are only slots the game swaps by name:
#   lm_body (walls/trim), lm_glass (dark windows), lm_lit (windows that glow at night), lm_neon (signs:
#   glow in their own vertex colour at night). No normals are exported (the game shades flat).
import math, random, os
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/tat.py').read(), globals())
import bmesh
from mathutils import Vector, Matrix

SRC = ROOT + 'assets/src/landmarks/'
LOUT = OUT + 'landmarks/'
MATS = ['lm_body', 'lm_glass', 'lm_lit', 'lm_neon']
BODY, GLASS, LIT, NEON = 0, 1, 2, 3


def lin(h):
    """'#rrggbb' (sRGB) -> linear rgb"""
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(ch * 2 for ch in h)
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def mix(a, b, t):
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def scale(c, k):
    return tuple(min(1, x * k) for x in c)


GLASS_C = lin('#2b3a46')
LIT_C = lin('#3a4650')


# ---------------------------------------------------------------- geometry kit
class Kit:
    """Accumulates flat faces with a colour and material slot each; .obj() turns them into a mesh."""

    def __init__(self, seed=1, ao=5.0):
        self.faces = []  # (pts[world], col, mat)
        self.rnd = random.Random(seed)
        self.ao = ao  # ground darkening height

    def face(self, pts, col, m=BODY):
        self.faces.append(([Vector(p) for p in pts], col, m))

    def obox(self, L, u0, u1, h0, h1, d0, d1, col, m=BODY, skip=('h-',)):
        """box in a frame L(u, h, d) -> world; skip faces named u-/u+/h-/h+/d-/d+"""
        c = {}
        for iu, u in enumerate((u0, u1)):
            for ih, h in enumerate((h0, h1)):
                for idd, d in enumerate((d0, d1)):
                    c[iu, ih, idd] = Vector(L(u, h, d))
        ctr = sum(c.values(), Vector()) / 8
        quads = {'u-': [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)], 'u+': [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
                 'h-': [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)], 'h+': [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
                 'd-': [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)], 'd+': [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)]}
        for k, q in quads.items():
            if k in skip:
                continue
            self.oface([c[i] for i in q], ctr, col, m)

    def oface(self, pts, ctr, col, m=BODY):
        """a face whose winding is fixed to point away from ctr"""
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-9 and len(pts) > 3:
            n = (pts[2] - pts[0]).cross(pts[3] - pts[0])
        fc = sum(pts, Vector()) / len(pts)
        if n.dot(fc - ctr) < 0:
            pts = pts[::-1]
        self.face(pts, col, m)

    def box(self, x0, x1, y0, y1, z0, z1, col, m=BODY, skip=('h-',)):
        self.obox(WF, x0, x1, z0, z1, y0, y1, col, m, skip)

    def quad(self, L, u0, u1, h0, h1, d, col, m=BODY):
        """flat rectangle facing +d"""
        self.face([L(u0, h0, d), L(u1, h0, d), L(u1, h1, d), L(u0, h1, d)], col, m)

    def prism(self, pts, z0, z1, col, m=BODY, top=True, sides=True, topcol=None):
        """extrude a CCW xy polygon"""
        n = len(pts)
        if sides:
            for i in range(n):
                a, b = pts[i], pts[(i + 1) % n]
                self.face([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], col, m)
        if top:
            self.face([(p[0], p[1], z1) for p in pts], topcol or col, m)

    def cyl(self, cx, cy, r, z0, z1, col, m=BODY, seg=12, r1=None, top=True, a0=0, a1=2 * math.pi, closed=True):
        r1 = r if r1 is None else r1
        full = closed and abs(a1 - a0 - 2 * math.pi) < 1e-6
        k = seg if full else seg + 1
        ring = lambda rr, z: [(cx + math.cos(a0 + (a1 - a0) * i / seg) * rr, cy + math.sin(a0 + (a1 - a0) * i / seg) * rr, z) for i in range(k)]
        lo, hi = ring(r, z0), ring(r1, z1)
        for i in range(seg):
            j = (i + 1) % k
            self.face([lo[i], lo[j], hi[j], hi[i]], col, m)
        if top and r1 > 0.01 and full:
            self.face(hi, col, m)

    def rod(self, a, b, r, col, m=BODY, seg=4):
        a, b = Vector(a), Vector(b)
        d = (b - a)
        q = d.to_track_quat('Z', 'Y')
        R = q.to_matrix()
        L = d.length
        pts = []
        for i in range(seg):
            t = 2 * math.pi * (i + 0.5) / seg
            pts.append(Vector((math.cos(t) * r, math.sin(t) * r, 0)))
        for i in range(seg):
            j = (i + 1) % seg
            self.face([a + R @ pts[i], a + R @ pts[j], a + R @ (pts[j] + Vector((0, 0, L))), a + R @ (pts[i] + Vector((0, 0, L)))], col, m)

    def mesh_from(self, me, M4, col, m=BODY):
        for p in me.polygons:
            self.face([M4 @ me.vertices[i].co for i in p.vertices], col, m)

    def text(self, s, L, u, h, d, size, col, m=NEON, depth=0.15, align='CENTER', res=2, bold=0.0):
        """letters standing in frame L: baseline centre at (u, h), front at d (facing +d)"""
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = s
        cu.size = size
        cu.extrude = depth / 2
        cu.resolution_u = res
        cu.align_x = align
        cu.offset = bold
        ob = bpy.data.objects.new('t', cu)
        bpy.context.scene.collection.objects.link(ob)
        dg = bpy.context.evaluated_depsgraph_get()
        me = ob.evaluated_get(dg).to_mesh()
        o, eu, eh, ed = Vector(L(u, h, d - depth / 2)), Vector(L(u + 1, h, d - depth / 2)), Vector(L(u, h + 1, d - depth / 2)), Vector(L(u, h, d + 1 - depth / 2))
        M4 = Matrix(((*(eu - o), 0), (*(eh - o), 0), (*(ed - o), 0), (0, 0, 0, 1))).transposed()
        M4.translation = o
        cnt = 0
        for p in me.polygons:
            self.face([M4 @ (me.vertices[i].co + Vector((0, 0, depth / 2))) for i in p.vertices], col, m)
            cnt += 1
        ob.evaluated_get(dg).to_mesh_clear()
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        return cnt

    def obj(self, name, origin=None):
        """origin: pivot point (for moving parts); the object sits there with its mesh relative to it"""
        bm = bmesh.new()
        col = bm.loops.layers.float_color.new('Col')
        for pts, c, m in self.faces:
            vs = [bm.verts.new(p) for p in pts]
            try:
                f = bm.faces.new(vs)
            except ValueError:
                continue
            f.material_index = m
            for lp in f.loops:
                z = lp.vert.co.z
                k = 0.72 + 0.28 * min(1.0, max(0.0, z / self.ao)) if self.ao else 1
                lp[col] = (c[0] * k, c[1] * k, c[2] * k, 1.0)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.002)
        if origin:
            bmesh.ops.translate(bm, verts=bm.verts, vec=-Vector(origin))
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.color_attributes.active_color = me.color_attributes['Col']
        o = bpy.data.objects.new(name, me)
        link(o)
        if origin:
            o.location = origin
        for mn in MATS:
            me.materials.append(lm_mat(mn))
        return o


def lm_mat(name):
    cols = {'lm_body': (0.8, 0.8, 0.8), 'lm_glass': (0.1, 0.15, 0.2), 'lm_lit': (1, 0.85, 0.6), 'lm_neon': (1, 0.3, 0.3)}
    m = mat(name, cols[name])
    # previews show the vertex colours
    nt = m.node_tree
    if not nt.nodes.get('vcol'):
        a = nt.nodes.new('ShaderNodeVertexColor'); a.name = 'vcol'; a.layer_name = 'Col'
        nt.links.new(a.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m


WF = lambda u, h, d: (u, d, h)  # world frame: u = x, d = y, h = z


def frame(p0, p1):
    """wall frame along CCW polygon edge p0->p1: u along the edge, d outward, h up"""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    Ln = math.hypot(dx, dy)
    ux, uy = dx / Ln, dy / Ln
    nx, ny = uy, -ux
    return (lambda u, h, d: (p0[0] + ux * u + nx * d, p0[1] + uy * u + ny * d, h)), Ln


def ccw(pts):
    a = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
    return pts if a > 0 else pts[::-1]


def local(game_pts, anchor):
    """game x/z polygon -> Blender xy relative to the anchor, CCW"""
    ax, az = anchor
    return ccw([(x - ax, -(z - az)) for x, z in game_pts])


# ---------------------------------------------------------------- facade pieces
def windows(K, L, u0, u1, h0, fh, nfl, bays, wall, wf=0.55, hf=0.6, rec=0.25, lit=0.45, sill=None, pair=False,
            head=None, glass=GLASS_C, arch=False, sillh=None, edge=0.6, litc=None):
    """a wall with a grid of recessed windows: nfl floors of height fh from h0, `bays` openings across u0..u1
    (plus plain wall `edge` wide beyond each end)"""
    if edge:
        K.quad(L, u0 - edge, u0, h0, h0 + nfl * fh, 0, wall)
        K.quad(L, u1, u1 + edge, h0, h0 + nfl * fh, 0, wall)
    bw = (u1 - u0) / bays
    ww, wh = bw * wf, fh * hf
    sh = (fh - wh) * 0.42 if sillh is None else sillh
    for f in range(nfl):
        fb = h0 + f * fh
        wb, wt = fb + sh, fb + sh + wh
        K.quad(L, u0, u1, fb, wb, 0, wall)
        K.quad(L, u0, u1, wt, fb + fh, 0, wall)
        for b in range(bays):
            c = u0 + bw * (b + 0.5)
            a, z = c - ww / 2, c + ww / 2
            K.quad(L, (u0 + bw * b), a, wb, wt, 0, wall)
            K.quad(L, z, u0 + bw * (b + 1), wb, wt, 0, wall)
            dk = scale(wall, 0.7)
            K.face([L(a, wb, 0), L(a, wb, -rec), L(a, wt, -rec), L(a, wt, 0)], dk)        # jambs
            K.face([L(z, wb, 0), L(z, wt, 0), L(z, wt, -rec), L(z, wb, -rec)], dk)
            K.face([L(a, wb, 0), L(z, wb, 0), L(z, wb, -rec), L(a, wb, -rec)], scale(wall, 0.9))  # sill floor
            K.face([L(a, wt, 0), L(a, wt, -rec), L(z, wt, -rec), L(z, wt, 0)], scale(wall, 0.55))  # head soffit
            on = K.rnd.random() < lit
            K.quad(L, a, z, wb, wt, -rec, (litc or LIT_C) if on else glass, LIT if on else GLASS)
            if pair:
                K.quad(L, c - 0.07, c + 0.07, wb, wt, -rec + 0.04, scale(wall, 0.8))
            if sill:  # front and top only
                K.obox(L, a - 0.12, z + 0.12, wb - 0.14, wb, -0.02, 0.12, sill, BODY, ('d-', 'h-', 'u-', 'u+'))
            if head:
                K.obox(L, a - 0.15, z + 0.15, wt, wt + 0.3, -0.02, 0.08, head, BODY, ('d-', 'h-', 'u-', 'u+'))


def storefront(K, L, u0, u1, h0, h1, frame_c, bays, rec=0.4, lit=0.8, transom=True):
    """ground-floor shop windows between stone piers"""
    bw = (u1 - u0) / bays
    pw = min(0.9, bw * 0.18)
    for b in range(bays):
        a, z = u0 + bw * b + pw / 2, u0 + bw * (b + 1) - pw / 2
        K.obox(L, u0 + bw * b - pw / 2, u0 + bw * b + pw / 2, h0, h1, -0.01, 0.15, frame_c, BODY, ('h-', 'd-'))
        K.quad(L, a, z, h1 - 0.01, h1, 0, frame_c)
        K.face([L(a, h0, 0), L(a, h0, -rec), L(a, h1, -rec), L(a, h1, 0)], scale(frame_c, 0.6))
        K.face([L(z, h0, 0), L(z, h1, 0), L(z, h1, -rec), L(z, h0, -rec)], scale(frame_c, 0.6))
        K.face([L(a, h1, 0), L(a, h1, -rec), L(z, h1, -rec), L(z, h1, 0)], scale(frame_c, 0.4))
        on = K.rnd.random() < lit
        K.quad(L, a, z, h0 + 0.5, h1 - (1.0 if transom else 0), -rec, LIT_C if on else GLASS_C, LIT if on else GLASS)
        K.quad(L, a, z, h0, h0 + 0.5, -rec, scale(frame_c, 0.5))
        if transom:
            K.obox(L, a, z, h1 - 1.0, h1 - 0.9, -rec, -rec + 0.08, scale(frame_c, 0.5), BODY, ('d-',))
            K.quad(L, a, z, h1 - 0.9, h1, -rec, LIT_C, LIT)
    K.obox(L, u1 - pw / 2, u1 + pw / 2, h0, h1, -0.01, 0.15, frame_c, BODY, ('h-', 'd-'))


def cornice(K, L, u0, u1, top, col, proj=1.2, depth=1.6, brackets=1.4, ext=None):
    """stepped classical cornice ending at height `top`, with brackets under the overhang"""
    e = proj if ext is None else ext
    K.obox(L, u0 - e * 0.3, u1 + e * 0.3, top - depth, top - depth * 0.7, -0.1, proj * 0.25, col, BODY, ('d-',))
    K.obox(L, u0 - e * 0.6, u1 + e * 0.6, top - depth * 0.7, top - depth * 0.35, -0.1, proj * 0.45, scale(col, 0.95), BODY, ('d-',))
    K.obox(L, u0 - e, u1 + e, top - depth * 0.3, top, -0.1, proj, col, BODY, ('d-',))
    if brackets:
        n = int((u1 - u0) / brackets)
        for i in range(n):
            u = u0 + (i + 0.5) * (u1 - u0) / n
            K.obox(L, u - 0.12, u + 0.12, top - depth * 0.7, top - depth * 0.3, proj * 0.4, proj * 0.85, scale(col, 0.9), BODY, ('d-', 'h+'))


def belt(K, L, u0, u1, h, col, proj=0.2, hh=0.4, ext=0.2):
    K.obox(L, u0 - ext, u1 + ext, h, h + hh, -0.05, proj, col, BODY, ('d-',))


def roof(K, pts, z, col=lin('#5a5856'), par=None, parh=1.0, part=0.35):
    K.prism(pts, z - 0.2, z, col, sides=False)
    if par:
        n = len(pts)
        for i in range(n):
            L, Ln = frame(pts[i], pts[(i + 1) % n])
            K.obox(L, 0, Ln, z, z + parh, -part, 0, par, BODY, ('h-', 'd+'))


def rooftop_junk(K, cx, cy, z, rnd, n=4, spread=8):
    for i in range(n):
        x, y = cx + rnd.uniform(-spread, spread), cy + rnd.uniform(-spread, spread)
        w, d, h = rnd.uniform(1.5, 3.5), rnd.uniform(1.5, 3), rnd.uniform(1, 2.2)
        K.box(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + h, lin('#9a9a96'))


def lod1_bands(K, pts, z0, nfl, fh, wall, hf=0.55, lit=0.45, start=0):
    """LOD1: walls with one glass strip per floor per side"""
    n = len(pts)
    K.prism(pts, z0 - 3, z0 + nfl * fh, wall, top=True, topcol=lin('#5a5856'))
    for i in range(n):
        L, Ln = frame(pts[i], pts[(i + 1) % n])
        if Ln < 4:
            continue
        for f in range(start, nfl):
            b = z0 + f * fh + fh * (1 - hf) * 0.45
            on = K.rnd.random() < lit
            K.quad(L, 0.8, Ln - 0.8, b, b + fh * hf, 0.03, LIT_C if on else GLASS_C, LIT if on else GLASS)


# ---------------------------------------------------------------- output
def finish(name, objs, anchor, prev=None):
    os.makedirs(LOUT, exist_ok=True)
    os.makedirs(SRC, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    path = LOUT + name + '.glb'
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
              export_texcoords=False, export_normals=False, export_materials='EXPORT', export_animations=False,
              export_extras=False, export_cameras=False, export_lights=False, export_vertex_color='ACTIVE')
    import io, contextlib, logging
    logging.disable(logging.INFO)
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        bpy.ops.export_scene.gltf(**kw)
    logging.disable(logging.NOTSET)
    repack(path)
    bpy.ops.wm.save_as_mainfile(filepath=SRC + name + '.blend', copy=True, compress=True)
    if os.path.exists(SRC + name + '.blend1'):
        os.remove(SRC + name + '.blend1')
    out = {'kb': os.path.getsize(path) // 1024, 'anchor': anchor, 'tris': {o.name: tris(o) for o in objs if o.type == 'MESH'}}
    return out


def repack(path):
    """shrink the GLB: one colour set (the baked 'Col' layer, linear) as COLOR_0, normalized uint8 (three reads it)"""
    import json, struct
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    J = json.loads(b[20:20 + jl])
    bin0 = b[20 + jl + 8:]
    views, accs = J['bufferViews'], J['accessors']
    used, cols = [], set()
    for me in J.get('meshes', []):
        for pr in me['primitives']:
            # Blender 5 writes a white placeholder as COLOR_0 and the 'Col' layer as the last COLOR_n: keep that one
            ck = sorted((k for k in pr['attributes'] if k.startswith('COLOR_')), key=lambda k: int(k[6:]))
            if ck:
                src = pr['attributes'][ck[-1]]
                for k in ck:
                    del pr['attributes'][k]
                pr['attributes']['COLOR_0'] = src
            if 'COLOR_0' in pr['attributes']:
                cols.add(pr['attributes']['COLOR_0'])
            used += list(pr['attributes'].values()) + ([pr['indices']] if 'indices' in pr else [])
    for s_ in J.get('skins', []):
        used.append(s_['inverseBindMatrices'])
    for an in J.get('animations', []):
        for sm in an['samplers']:
            used += [sm['input'], sm['output']]
    amap = {}
    newacc, newviews, out = [], [], bytearray()
    for ai in sorted(set(used)):
        a = accs[ai]
        v = views[a['bufferView']]
        data = bin0[v.get('byteOffset', 0) + a.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        if ai in cols and a['componentType'] != 5121:
            nc = 4 if a['type'] == 'VEC4' else 3
            fmt, mx = ('f', 1.0) if a['componentType'] == 5126 else ('H', 65535.0)
            vals = struct.unpack('<%d%s' % (a['count'] * nc, fmt), data[:a['count'] * nc * struct.calcsize(fmt)])
            px = bytearray()
            for i in range(a['count']):
                px += bytes(max(0, min(255, round(x / mx * 255))) for x in vals[i * nc:i * nc + 3]) + b'\xff'
            data = bytes(px)
            a['componentType'], a['normalized'], a['type'] = 5121, True, 'VEC4'
        while len(out) % 4:
            out += b'\0'
        nv = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
        if 'target' in v:
            nv['target'] = v['target']
        out += data
        a['bufferView'] = len(newviews)
        a.pop('byteOffset', None)
        newviews.append(nv)
        amap[ai] = len(newacc)
        newacc.append(a)
    for me in J.get('meshes', []):
        for pr in me['primitives']:
            pr['attributes'] = {k: amap[v] for k, v in pr['attributes'].items()}
            if 'indices' in pr:
                pr['indices'] = amap[pr['indices']]
    for s_ in J.get('skins', []):
        s_['inverseBindMatrices'] = amap[s_['inverseBindMatrices']]
    for an in J.get('animations', []):
        for sm in an['samplers']:
            sm['input'], sm['output'] = amap[sm['input']], amap[sm['output']]
    J['accessors'], J['bufferViews'] = newacc, newviews
    while len(out) % 4:
        out += b'\0'
    J['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(J, separators=(',', ':')).encode()
    while len(js) % 4:
        js += b' '
    total = 12 + 8 + len(js) + 8 + len(out)
    open(path, 'wb').write(struct.pack('<III', 0x46546C67, 2, total) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out))


def shots(name, target, dist, lod1=None, views=((25, 12), (200, 25))):
    paths = []
    tmp = '/private/tmp/claude-501/-Users-dainmoens-Documents-Tim-Arnett-Town/392d4b1d-feae-4f8b-b8db-07c7ac05def9/scratchpad/'
    sh = bpy.context.scene.display.shading
    sh.color_type = 'VERTEX'
    if lod1:
        lod1.hide_render = True
    for i, (yaw, pitch) in enumerate(views):
        p = tmp + '%s_%d.png' % (name, i)
        preview(p, target, dist, yaw, pitch, (900, 700), 35)
        sh.color_type = 'VERTEX'
        bpy.ops.render.render(write_still=True)
        paths.append(p)
    if lod1:
        lod1.hide_render = False
    return paths


B = {}  # builders


def build(name, render=True):
    reset()
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    return B[name](render)


def build_all(render=False):
    return {n: build(n, render) for n in B}


# ================================================================ HOTEL BLACKHAWK
# 200 E 3rd St (1915): eleven storeys, two-storey limestone base with shopfronts and the hotel canopy on
# 3rd Street, red-brown brick shaft with paired sash windows, stone top storey under a deep bracketed
# cornice, and the red HOTEL BLACKHAWK roof sign.
def blackhawk(render=True):
    anchor = (451.6, 96.5)
    P = local([(469.4, 74.2), (469.4, 82.4), (476.1, 82.4), (476.1, 118.8), (427.1, 118.8), (427.1, 74.3)], anchor)
    K = Kit(11)
    brick, stone, trim = lin('#7a3b2a'), lin('#c9bba0'), lin('#d8ccb2')
    fl = [5.5, 4.2] + [3.45] * 8 + [4.0]
    top = sum(fl)
    n = len(P)
    K.prism(P, -4, 0, stone, top=False)
    for i in range(n):
        L, Ln = frame(P[i], P[(i + 1) % n])
        mid = (L(Ln / 2, 0, 0))
        party = mid[0] < -24  # west wall against the River Center
        front = mid[1] < -20  # 3rd Street
        if Ln < 9:
            K.quad(L, 0, Ln, 0, top, 0, brick)
            continue
        bays = max(1, round(Ln / 3.6))
        if party:
            K.quad(L, 0, Ln, 0, 29, 0, brick)
            windows(K, L, 0.6, Ln - 0.6, 29, 3.45, 3, bays, brick, wf=0.5, hf=0.55, pair=True, sill=stone)
            K.quad(L, 0, Ln, 29 + 3 * 3.45, top, 0, brick)
        else:
            # base: shopfronts, mezzanine windows
            if front or Ln > 30:
                storefront(K, L, 0.5, Ln - 0.5, 0, 4.6, stone, bays)
                K.quad(L, 0, Ln, 4.6, fl[0], 0, stone)
            else:
                windows(K, L, 0.6, Ln - 0.6, 0, fl[0], 1, bays, stone, wf=0.45, hf=0.5)
            windows(K, L, 0.6, Ln - 0.6, fl[0], fl[1], 1, bays, stone, wf=0.6, hf=0.62, rec=0.35, head=trim)
            belt(K, L, 0, Ln, fl[0] - 0.4, trim, 0.25, 0.4)
            belt(K, L, 0, Ln, fl[0] + fl[1] - 0.2, trim, 0.4, 0.6)
            h = fl[0] + fl[1]
            windows(K, L, 0.6, Ln - 0.6, h, 3.45, 8, bays, brick, wf=0.56, hf=0.58, pair=True, sill=stone)
            # brick quoins / pilasters at the ends
            for u in (0, Ln):
                K.obox(L, u - 0.6, u + 0.6, h, h + 8 * 3.45, -0.05, 0.12, scale(brick, 0.85), BODY, ('d-', 'h-'))
            h += 8 * 3.45
            belt(K, L, 0, Ln, h, trim, 0.3, 0.45)
            windows(K, L, 0.6, Ln - 0.6, h, 4.0, 1, bays, stone, wf=0.5, hf=0.55, head=trim)
        cornice(K, L, 0, Ln, top + 1.7, trim, 1.4, 1.7)
        # attic parapet over the cornice
        K.obox(L, 0, Ln, top + 1.7, top + 2.6, -0.3, 0.1, stone, BODY, ('h-',))
        if front:
            # the hotel canopy over the 3rd Street doors with lit soffit
            c = Ln / 2
            K.obox(L, c - 6, c + 6, 4.0, 4.6, 0, 4.2, lin('#1d1d1f'), BODY, ('d-', 'h-'))
            K.face([L(c - 5.8, 3.99, 0.1), L(c - 5.8, 3.99, 4.0), L(c + 5.8, 3.99, 4.0), L(c + 5.8, 3.99, 0.1)][::-1], lin('#ffe1a0'), LIT)
            K.text('HOTEL BLACKHAWK', L, c, 4.06, 4.22, 0.42, lin('#ffd76a'), NEON, 0.04)
            for s in (-1, 1):
                K.rod(L(c + s * 5.6, 4.5, 4.0), L(c + s * 5.6, 9.5, 0.1), 0.05, lin('#1d1d1f'))
    roof(K, P, top + 1.7)
    rooftop_junk(K, -2, 2, top + 1.7, K.rnd, 5, 10)
    # water-tank style elevator penthouse
    K.box(5, 13, 10, 17, top + 1.7, top + 6.5, brick)
    K.box(4.8, 13.2, 9.8, 17.2, top + 6.5, top + 7.0, stone)
    # roof sign: steel frame with red letters facing 3rd Street and the river
    sy = 2.0
    sz = top + 2.6
    SF = lambda u, h, d: (u, sy - d, h)
    for x in range(-20, 21, 4):
        K.box(x - 0.1, x + 0.1, sy - 0.1, sy + 0.1, sz, sz + 6.2, lin('#2a2a2a'))
        K.rod((x, sy, sz), (x, sy + 3, sz), 0.07, lin('#2a2a2a'))
        K.rod((x, sy + 3, sz), (x, sy + 0.1, sz + 5.5), 0.07, lin('#2a2a2a'))
    for hh in (sz + 0.2, sz + 3.3, sz + 6.0):
        K.box(-21, 21, sy - 0.08, sy + 0.08, hh, hh + 0.2, lin('#2a2a2a'))
    red = lin('#ff2020')
    K.text('HOTEL', SF, 0, sz + 3.6, 0.2, 3.0, red, NEON, 0.25)
    K.text('BLACKHAWK', SF, 0, sz + 0.4, 0.2, 3.0, red, NEON, 0.25)
    lod0 = K.obj('blackhawk_lod0')

    K1 = Kit(12)
    lod1_bands(K1, P, 0, 11, top / 11, brick)
    roof(K1, P, top + 1.7)
    for i in range(n):
        L, Ln = frame(P[i], P[(i + 1) % n])
        K1.obox(L, -1, Ln + 1, top, top + 1.7, -0.1, 1.3, trim, BODY, ('d-',))
    K1.text('HOTEL', SF, 0, sz + 3.6, 0.2, 3.0, red, NEON, 0.25, res=1)
    K1.text('BLACKHAWK', SF, 0, sz + 0.4, 0.2, 3.0, red, NEON, 0.25, res=1)
    lod1 = K1.obj('blackhawk_lod1')
    res = finish('blackhawk', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('blackhawk', (0, 0, 20), 120, lod1)
    return res


B['blackhawk'] = blackhawk


ROOF = lin('#55534f')


def rect(x0, x1, y0, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def sides(P):
    """(index, frame, length, midpoint) for each edge of a CCW polygon"""
    n = len(P)
    for i in range(n):
        L, Ln = frame(P[i], P[(i + 1) % n])
        yield i, L, Ln, L(Ln / 2, 0, 0)


def shaft(K, P, h0, nfl, fh, wall, bay=3.4, keep=None, minlen=4, **kw):
    """window grid on every side of polygon P (sides where keep(i, mid) is False get plain wall)"""
    for i, L, Ln, mid in sides(P):
        if Ln < minlen or (keep and not keep(i, mid)):
            K.quad(L, 0, Ln, h0, h0 + nfl * fh, 0, wall)
            continue
        windows(K, L, 0.6, Ln - 0.6, h0, fh, nfl, max(1, round((Ln - 1.2) / bay)), wall, **kw)


def arch_heads(K, L, u0, u1, bays, wt, ww, stone, d=0.02, seg=6):
    """semicircular glass fanlight + stone voussoir ring over each window"""
    bw = (u1 - u0) / bays
    r = ww / 2
    for b in range(bays):
        c = u0 + bw * (b + 0.5)
        pts = [(c + math.cos(math.pi * k / seg) * r, wt + math.sin(math.pi * k / seg) * r) for k in range(seg + 1)]
        K.face([L(c, wt, d)] + [L(u, h, d) for u, h in pts], GLASS_C, GLASS)
        for k in range(seg):
            (ua, ha), (ub, hb) = pts[k], pts[k + 1]
            s = 1 + 0.3 / r
            K.face([L(ua, ha, d + 0.08), L(c + (ua - c) * s, wt + (ha - wt) * s, d + 0.08), L(c + (ub - c) * s, wt + (hb - wt) * s, d + 0.08), L(ub, hb, d + 0.08)][::-1], stone)


def hip_roof(K, x0, x1, y0, y1, z, hr, col):
    """hipped roof, ridge along the longer axis"""
    W, D = x1 - x0, y1 - y0
    if W >= D:
        a, b, ym = x0 + D / 2, x1 - D / 2, (y0 + y1) / 2
        r0, r1 = (a, ym, z + hr), (b, ym, z + hr)
        K.face([(x0, y0, z), (x1, y0, z), r1, r0], col)
        K.face([(x1, y1, z), (x0, y1, z), r0, r1], col)
        K.face([(x1, y0, z), (x1, y1, z), r1], col)
        K.face([(x0, y1, z), (x0, y0, z), r0], col)
    else:
        a, b, xm = y0 + W / 2, y1 - W / 2, (x0 + x1) / 2
        r0, r1 = (xm, a, z + hr), (xm, b, z + hr)
        K.face([(x1, y0, z), (x1, y1, z), r1, r0], col)
        K.face([(x0, y1, z), (x0, y0, z), r0, r1], col)
        K.face([(x0, y0, z), (x1, y0, z), r0], col)
        K.face([(x1, y1, z), (x0, y1, z), r1], col)


def pyramid(K, cx, cy, w, z, h, col):
    p = [(cx - w, cy - w, z), (cx + w, cy - w, z), (cx + w, cy + w, z), (cx - w, cy + w, z)]
    for i in range(4):
        K.face([p[i], p[(i + 1) % 4], (cx, cy, z + h)], col)


# ================================================================ ADLER THEATRE
# 136 E 3rd St (1931, Art Deco, the old RKO Orpheum): buff-brick front block with continuous piers and a
# stepped centre, the ADLER blade sign and a bulb-lit marquee over the doors; plain brick auditorium and
# fly tower behind.
def adler(render=True):
    anchor = (342.4, 91.2)
    K = Kit(21)
    buff, deco, stone, brick = lin('#c9ab7c'), lin('#9d7b52'), lin('#d9ccb0'), lin('#8a5a40')
    yF = -18.7
    aud = rect(-19.7, 19.7, -8, 18.7)
    K.prism(aud, -4, 19, brick, topcol=ROOF)
    for i, L, Ln, mid in sides(aud):
        K.obox(L, 0, Ln, 18.6, 19.2, -0.2, 0.15, stone, BODY, ('d-', 'h-'))
    fly = rect(-12, 12, 6, 18.7)
    K.prism(fly, 19, 27, brick, topcol=ROOF)
    for i, L, Ln, mid in sides(fly):
        K.obox(L, 0, Ln, 26.6, 27.2, -0.2, 0.15, stone, BODY, ('d-', 'h-'))
    # side exit doors and a few high windows on the auditorium
    for x0, L in ((19.7, lambda u, h, d: (19.7 + d, u, h)), (-19.7, lambda u, h, d: (-19.7 - d, -u, h))):
        for u in (-4, 6, 14):
            K.quad(L, u, u + 2, 0, 2.4, 0.02, lin('#3c3a38'))
            K.obox(L, u - 0.3, u + 2.3, 2.5, 2.8, 0, 0.6, lin('#444'), BODY, ('d-',))
        windows(K, L, -6, 16, 12, 4, 1, 5, brick, wf=0.35, hf=0.6, edge=0, lit=0.3)
    # front block
    P = rect(-19.7, 19.7, yF, -8)
    K.prism(P, -4, 0, stone, top=False)
    K.prism(P, 22, 22.2, ROOF, sides=False)
    F = lambda u, h, d: (u - 19.7, yF - d, h)
    Ln = 39.4
    # ground floor: shopfronts either side, lit lobby doors in the middle
    storefront(K, F, 0.5, 11.5, 0, 5.2, stone, 3)
    storefront(K, F, 27.9, 38.9, 0, 5.2, stone, 3)
    K.quad(F, 11.5, 27.9, 5.2, 6.4, 0, stone)
    K.obox(F, 11.5, 27.9, 0, 0.3, -2.2, 0, stone, BODY, ('d-', 'd+'))
    for k in range(6):
        u = 12.2 + k * 2.55
        K.quad(F, u, u + 2.2, 0.3, 4.6, -2.2, LIT_C, LIT)
        K.obox(F, u + 2.2, u + 2.55, 0.3, 5.2, -2.2, -1.9, lin('#7a5c2e'), BODY, ('d-',))
    K.quad(F, 11.5, 27.9, 4.6, 5.2, -2.2, lin('#7a5c2e'))
    for u in (11.5, 27.9):
        K.face([F(u, 0, 0), F(u, 0, -2.2), F(u, 5.2, -2.2), F(u, 5.2, 0)], scale(stone, 0.7))
    K.face([F(11.5, 5.2, 0), F(11.5, 5.2, -2.2), F(27.9, 5.2, -2.2), F(27.9, 5.2, 0)], lin('#ffe1a0'), LIT)
    belt(K, F, 0, Ln, 6.2, stone, 0.3, 0.5, 0)
    # upper floors: windows between continuous piers; stepped centre bays
    bays, bw = 12, Ln / 12
    windows(K, F, 0, Ln, 6.7, 3.3, 5, bays, buff, wf=0.55, hf=0.66, rec=0.35, edge=0, glass=lin('#26323a'))
    for b in range(bays):
        c = bw * (b + 0.5)
        for f in range(5):  # dark deco spandrel panels
            h = 6.7 + f * 3.3
            K.obox(F, c - bw * 0.27, c + bw * 0.27, h - 0.05, h + 0.55, 0, 0.06, deco, BODY, ('d-',))
    for b in range(bays + 1):
        u = b * bw
        centre = 4 <= b <= 8
        top = 27.2 if centre else 23.6
        K.obox(F, u - 0.4, u + 0.4, 6.4, top, -0.05, 0.4, buff, BODY, ('d-', 'h-'))
        K.obox(F, u - 0.25, u + 0.25, top, top + 0.8, 0.05, 0.3, stone, BODY, ('d-', 'h-'))
    K.quad(F, 0, Ln, 23.2, 23.6, 0, buff)
    K.obox(F, -0.2, Ln + 0.2, 23.4, 23.8, -0.3, 0.25, stone, BODY, ('d-',))
    # stepped centre: a taller block over bays 4-8
    c0, c1 = 4 * bw - 19.7, 8 * bw - 19.7
    ctr = rect(c0, c1, yF, yF + 6)
    K.prism(ctr, 23.6, 27.2, buff, topcol=ROOF)
    K.obox(F, 4 * bw, 8 * bw, 26.8, 27.4, -0.2, 0.3, stone, BODY, ('d-',))
    for k in range(3):  # deco chevrons in the parapet
        u = 4 * bw + (k + 0.5) * bw * 4 / 3
        K.face([F(u - 1.2, 24.4, 0.05), F(u + 1.2, 24.4, 0.05), F(u, 26.2, 0.05)], deco)
    # north face of the front block above the auditorium roof
    K.quad(lambda u, h, d: (19.7 - u, -8 + d, h), 0, Ln, 19, 23.6, 0, buff)
    # side faces of the front block
    for L in (lambda u, h, d: (19.7 + d, yF + u, h), lambda u, h, d: (-19.7 - d, -8 - u, h)):
        K.quad(L, 0, 10.7, 0, 23.6, 0, buff)
        windows(K, L, 2, 9, 6.7, 3.3, 5, 2, buff, wf=0.5, hf=0.6, edge=0)
    # marquee: dark sign box, bulb borders, lit soffit, lettering front and sides
    mx0, mx1, my = -7.5, 7.5, yF - 4.6
    K.box(mx0, mx1, my, yF, 4.2, 6.6, lin('#141414'), BODY, ())
    K.face([(mx0 + 0.1, my + 0.1, 4.19), (mx0 + 0.1, yF, 4.19), (mx1 - 0.1, yF, 4.19), (mx1 - 0.1, my + 0.1, 4.19)], lin('#ffe9b0'), LIT)
    MF = lambda u, h, d: (u, my - d, h)
    gold, white = lin('#ffd54f'), lin('#ffffff')
    for h in (4.3, 6.42):
        K.quad(MF, mx0, mx1, h, h + 0.12, 0.02, gold, NEON)
    K.text('ADLER THEATRE', MF, 0, 5.35, 0.02, 0.85, gold, NEON, 0.06, bold=0.01)
    K.text('THE TIM ARNETT REVUE', MF, 0, 4.55, 0.02, 0.6, white, NEON, 0.06)
    for sgn, L in ((1, lambda u, h, d: (mx1 + d, my + u, h)), (-1, lambda u, h, d: (mx0 - d, yF - u, h))):
        K.text('ADLER', L, 2.3, 4.9, 0.02, 1.1, gold, NEON, 0.06)
    for x in (mx0 + 1, mx1 - 1):
        K.rod((x, my + 0.4, 6.6), (x, yF, 10.5), 0.05, lin('#222'))
    # the ADLER blade: tall double-faced sign on the east side of the front
    bx, by0, by1 = 13.4, yF - 0.3, yF - 3.9
    yc = (by0 + by1) / 2
    K.box(bx - 0.45, bx + 0.45, by1, by0, 7.0, 25.0, lin('#5a0d0d'), BODY, ())
    K.box(bx - 0.6, bx + 0.6, by1 - 0.2, by0 + 0.1, 25.0, 25.6, lin('#2a2a2a'), BODY, ())
    K.box(bx - 0.4, bx + 0.4, by1 + 0.4, by0 - 0.4, 25.6, 26.6, lin('#2a2a2a'), BODY, ())
    K.cyl(bx, yc, 0.45, 26.6, 27.2, lin('#ff4040'), NEON, 8)
    red = lin('#ff3b3b')
    for L in (lambda u, h, d: (bx + 0.45 + d, yc + u, h), lambda u, h, d: (bx - 0.45 - d, yc - u, h)):
        for k, ch in enumerate('ADLER'):
            K.text(ch, L, 0, 21.4 - k * 3.4, 0.02, 2.7, red, NEON, 0.12, bold=0.02)
        for h in range(8, 25):  # chaser bulbs down both edges
            for u in (-1.55, 1.55):
                K.quad(L, u - 0.1, u + 0.1, h, h + 0.2, 0.03, lin('#fff3c0'), NEON)
    lod0 = K.obj('adler_lod0')

    K1 = Kit(22)
    K1.prism(aud, -4, 19, brick, topcol=ROOF)
    K1.prism(fly, 19, 27, brick, topcol=ROOF)
    lod1_bands(K1, P, 6.7, 5, 3.3, buff)
    K1.prism(P, -4, 6.7, stone, top=False)
    K1.prism(ctr, 23.2, 27.2, buff, topcol=ROOF)
    K1.box(mx0, mx1, my, yF, 4.2, 6.6, lin('#141414'), BODY, ())
    K1.face([(mx0, my, 4.19), (mx0, yF, 4.19), (mx1, yF, 4.19), (mx1, my, 4.19)], lin('#ffe9b0'), LIT)
    K1.quad(MF, mx0, mx1, 4.3, 6.5, 0.02, gold, NEON)
    K1.box(bx - 0.45, bx + 0.45, by1, by0, 7.0, 25.0, lin('#5a0d0d'), BODY, ())
    for L in (lambda u, h, d: (bx + 0.45 + d, yc + u, h), lambda u, h, d: (bx - 0.45 - d, yc - u, h)):
        for k, ch in enumerate('ADLER'):
            K1.text(ch, L, 0, 21.4 - k * 3.4, 0.02, 2.7, red, NEON, 0.12, res=1)
    lod1 = K1.obj('adler_lod1')
    res = finish('adler', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('adler', (0, -10, 12), 75, lod1)
    return res


B['adler'] = adler


# ================================================================ FIGGE ART MUSEUM
# 225 W 2nd St (2005, David Chipperfield): a long box wrapped in horizontal panels of pale green fritted
# glass over a dark glazed ground floor, the upper box overhanging the riverfront plaza, glowing at night.
def figge(render=True):
    anchor = (109.0, 340.0)
    K = Kit(31)
    frit = [lin('#cfe0d6'), lin('#c3d6cc'), lin('#d8e6de'), lin('#bccfc6')]
    back, conc = lin('#55615c'), lin('#b9b6ae')
    x0, x1, y0, y1 = -48.0, 48.0, -20.2, 20.0
    P = rect(x0, x1, y0, y1)

    def panels(K, L, Ln, h0, h1, ph=1.25, pw=4.2, lit=0.5, clear=None):
        K.quad(L, 0, Ln, h0, h1, -0.15, back)
        rows, cols = max(1, round((h1 - h0) / ph)), max(1, round(Ln / pw))
        rh, cw = (h1 - h0) / rows, Ln / cols
        for r in range(rows):
            hb = h0 + r * rh
            on = K.rnd.random() < lit
            for c in range(cols):
                a, b = c * cw + 0.025, (c + 1) * cw - 0.025
                if clear and clear[0] <= hb < clear[1] and 0.2 < c / cols < 0.8:
                    K.quad(L, a, b, hb + 0.02, hb + rh - 0.02, 0, lin('#2c3a40'), LIT if on else GLASS)
                    continue
                k = 0.94 + 0.08 * K.rnd.random()
                K.quad(L, a, b, hb + 0.03, hb + rh - 0.03, 0, scale(frit[r % 2], k), LIT if on else BODY)
        for u in (0, Ln):  # corner fins
            K.obox(L, u - 0.12, u + 0.12, h0, h1, -0.15, 0.08, back, BODY, ('d-',))

    # dark glazed ground floor, set back 2 m under the upper box
    G = rect(x0 + 2, x1 - 2, y0 + 2, y1 - 2)
    K.prism(rect(x0, x1, y0, y1), -4, 0, conc, top=False)
    for i, L, Ln, mid in sides(G):
        K.quad(L, 0, Ln, 0, 5, 0, lin('#2e3a40'), GLASS)
        for k in range(int(Ln / 2.5) + 1):
            u = min(Ln, k * 2.5)
            K.obox(L, u - 0.06, u + 0.06, 0, 5, 0, 0.12, lin('#222'), BODY, ('d-', 'h-'))
        K.face([L(0, 5, 0), L(0, 5, 2), L(Ln, 5, 2), L(Ln, 5, 0)], lin('#e8e2d0'), LIT)  # lit soffit
        for k in range(6):  # interior glow behind the glass
            u = (k + 0.5) * Ln / 6
            K.quad(L, u - 2, u + 2, 0.6, 4.4, -0.6, lin('#ffe6b8'), LIT)
    # plaza with steps down to River Drive
    K.box(x0 - 2, x1 + 2, y0 - 3, y0, -0.6, 0.05, conc)
    # main box: two gallery floors
    for i, L, Ln, mid in sides(P):
        panels(K, L, Ln, 5, 16.5)
    K.prism(P, 16.5, 16.7, ROOF, sides=False)
    # upper box: set back to the east, cantilevered over the plaza on the river side
    U = rect(-24, 4, -20.2, 20)  # the taller gallery block (OSM part at x 87-109)
    for i, L, Ln, mid in sides(U):
        panels(K, L, Ln, 16.5, 24, lit=0.6, clear=(18, 22.5) if mid[1] < -19 else None)
    K.prism(U, 24, 24.6, lin('#9aa59f'), topcol=ROOF)
    # lettering on the west end
    K.text('FIGGE ART MUSEUM', lambda u, h, d: (x0 - d, -u, h), 0, 2.0, 0.05, 1.0, lin('#ffffff'), NEON, 0.08)
    lod0 = K.obj('figge_lod0')

    K1 = Kit(32)
    K1.prism(G, -4, 5, lin('#2e3a40'), top=False)
    K1.prism(P, 5, 16.5, frit[0], topcol=ROOF)
    K1.box(x0, x1, y0, y1, 4.9, 5, lin('#e8e2d0'), LIT, ())
    K1.prism(U, 16.5, 24.6, frit[1], topcol=ROOF)
    for i, L, Ln, mid in sides(P):
        for h in (6, 9.5, 13):
            K1.quad(L, 1, Ln - 1, h, h + 2.2, 0.05, frit[2], LIT)
    for i, L, Ln, mid in sides(U):
        K1.quad(L, 1, Ln - 1, 18, 22.5, 0.05, frit[2], LIT)
    lod1 = K1.obj('figge_lod1')
    res = finish('figge', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('figge', (0, 0, 10), 130, lod1)
    return res


B['figge'] = figge


# ================================================================ DAVENPORT BANK & TRUST (the bank tower)
# 203 W 3rd St (1927): Davenport's tallest, 17 storeys of limestone over a banking hall with tall arched
# windows; setback crown with a colonnade, copper hipped roof and a beacon.
def banktower(render=True):
    anchor = (141.0, 164.7)
    K = Kit(41)
    lime, lime2, cop, brick = lin('#d6cdb8'), lin('#c4baa3'), lin('#5f8a78'), lin('#b49a7a')
    x0, x1, y0, y1 = -15.2, 15.2, -22.9, 22.9   # north face (+y) on 3rd St, east (+x) on Main St
    base = rect(x0, x1, y0, y1)
    K.prism(base, -4, 0, lime2, top=False)
    # banking hall: tall arched windows
    for i, L, Ln, mid in sides(base):
        nb = max(2, round(Ln / 5))
        windows(K, L, 0.8, Ln - 0.8, 0, 9.5, 1, nb, lime, wf=0.62, hf=0.72, rec=0.5, sillh=1.2, edge=0.8, lit=0.7)
        arch_heads(K, L, 0.8, Ln - 0.8, nb, 1.2 + 9.5 * 0.72, (Ln - 1.6) / nb * 0.62, lime2)
        windows(K, L, 0.8, Ln - 0.8, 9.5, 3.6, 1, nb * 2, lime, wf=0.5, hf=0.55, edge=0.8)
        belt(K, L, 0, Ln, 9.3, lime2, 0.3, 0.4)
        cornice(K, L, 0, Ln, 14.2, lime2, 0.9, 1.1, 1.6)
    # rear wing (south) to 6 floors, tower over the north 30 m
    rear = rect(x0, x1, y0, -7.5)
    K.prism(base, 14.2, 14.4, ROOF, sides=False)
    shaft(K, rear, 14.4, 3, 3.5, brick, 3.2, keep=lambda i, m: m[1] < 0, wf=0.5, hf=0.55)
    K.prism(rear, 24.9, 25.3, lime2, sides=True, topcol=ROOF)
    T = rect(x0, x1, -7.5, y1)
    nfl, fh = 14, 3.55
    tz = 14.4 + nfl * fh
    shaft(K, T, 14.4, nfl, fh, lime, 3.5, wf=0.58, hf=0.62, rec=0.3, lit=0.5)
    for i, L, Ln, mid in sides(T):  # vertical piers carry the eye up
        nb = max(1, round((Ln - 1.2) / 3.5))
        for b in range(1, nb, 2):
            u = 0.6 + b * (Ln - 1.2) / nb
            K.obox(L, u - 0.18, u + 0.18, 14.4, tz, -0.05, 0.22, lime2, BODY, ('d-', 'h-'))
        cornice(K, L, 0, Ln, tz + 1.4, lime2, 0.8, 1.4, 1.2)
    # crown: setback colonnade storey, attic, copper hipped roof, beacon
    C = rect(x0 + 2.4, x1 - 2.4, -5.1, y1 - 2.4)
    K.prism(T, tz + 1.4, tz + 1.6, ROOF, sides=False)
    cz = tz + 1.6
    for i, L, Ln, mid in sides(C):
        K.quad(L, 0, Ln, cz, cz + 6.5, -1.2, lin('#2c3338'), GLASS)
        n = max(2, round(Ln / 2.4))
        for k in range(n + 1):
            u = k * Ln / n
            K.cyl(*L(u, 0, 0)[:2], 0.35, cz, cz + 6.5, lime, BODY, 6, top=False)
        K.obox(L, -0.3, Ln + 0.3, cz + 6.5, cz + 7.6, -1.3, 0.3, lime2, BODY, ('d-',))
    K.prism(C, cz, cz + 0.01, ROOF, sides=False)
    hip_roof(K, x0 + 2.1, x1 - 2.1, -5.4, y1 - 2.1, cz + 7.6, 6.5, cop)
    K.cyl(0, (y1 - 5.1) / 2 - 2.6, 0.25, cz + 12, cz + 17, lin('#333'), BODY, 6)
    K.cyl(0, (y1 - 5.1) / 2 - 2.6, 0.45, cz + 17, cz + 17.8, lin('#ff3030'), NEON, 8)
    # name in white letters on the 3rd St and Main St attic
    NF = lambda u, h, d: (x1 - 2.4 - u, y1 - 2.4 + 0.3 + d, h)
    K.text('DAVENPORT BANK', NF, (x1 - x0 - 4.8) / 2, cz + 6.65, 0.02, 0.8, lin('#ffffff'), NEON, 0.06)
    lod0 = K.obj('banktower_lod0')

    K1 = Kit(42)
    lod1_bands(K1, base, 0, 3, 14.2 / 3, lime, start=0)
    K1.prism(rear, 14.2, 25.3, brick, topcol=ROOF)
    lod1_bands(K1, T, 14.4, nfl, fh, lime)
    K1.prism(T, tz, tz + 1.6, lime2, topcol=ROOF)
    K1.prism(C, cz, cz + 7.6, lin('#5d6266'), topcol=ROOF)
    hip_roof(K1, x0 + 2.1, x1 - 2.1, -5.4, y1 - 2.1, cz + 7.6, 6.5, cop)
    K1.cyl(0, (y1 - 5.1) / 2 - 2.6, 0.45, cz + 12, cz + 17.8, lin('#ff3030'), NEON, 6)
    lod1 = K1.obj('banktower_lod1')
    res = finish('banktower', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('banktower', (0, 0, 40), 170, lod1, views=((160, 10), (230, 20)))
    return res


B['banktower'] = banktower


# ================================================================ PUTNAM BUILDING
# 215 N Main St (1910): twelve storeys of buff brick, two-storey stone base, deep cornice.
def putnam(render=True):
    anchor = (189.5, 215.7)
    K = Kit(51)
    tan, stone, trim = lin('#c6a77c'), lin('#d3c7ae'), lin('#e0d6c0')
    P = local([(179.5, 193.6), (199.3, 193.7), (199.7, 237.9), (179.3, 237.5)], anchor)
    K.prism(P, -4, 0, stone, top=False)
    main = lambda i, m: m[0] < -8 or abs(m[1]) > 18
    for i, L, Ln, mid in sides(P):
        nb = max(1, round((Ln - 1.2) / 3.3))
        if mid[0] < -8:
            storefront(K, L, 0.5, Ln - 0.5, 0, 4.8, stone, nb)
            K.quad(L, 0, Ln, 4.8, 5.4, 0, stone)
        else:
            windows(K, L, 0.6, Ln - 0.6, 0, 5.4, 1, nb, stone, wf=0.4, hf=0.5)
        windows(K, L, 0.6, Ln - 0.6, 5.4, 4.0, 1, nb, stone, wf=0.6, hf=0.6)
        belt(K, L, 0, Ln, 9.2, trim, 0.35, 0.5)
        windows(K, L, 0.6, Ln - 0.6, 9.4, 3.4, 9, nb, tan, wf=0.52, hf=0.6, pair=True, sill=trim)
        belt(K, L, 0, Ln, 40.0, trim, 0.25, 0.4)
        windows(K, L, 0.6, Ln - 0.6, 40.0, 3.8, 1, nb, trim, wf=0.45, hf=0.5)
        cornice(K, L, 0, Ln, 45.4, trim, 1.3, 1.6)
        K.obox(L, 0, Ln, 45.4, 46.2, -0.3, 0.1, tan, BODY, ('h-',))
    roof(K, P, 45.4)
    rooftop_junk(K, 0, 5, 45.4, K.rnd, 3, 5)
    K.box(-4, 4, -16, -9, 45.4, 49, tan)
    lod0 = K.obj('putnam_lod0')
    K1 = Kit(52)
    lod1_bands(K1, P, 0, 12, 45.4 / 12, tan)
    for i, L, Ln, mid in sides(P):
        K1.obox(L, -1, Ln + 1, 44, 45.6, -0.1, 1.2, trim, BODY, ('d-',))
    lod1 = K1.obj('putnam_lod1')
    res = finish('putnam', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('putnam', (0, 0, 22), 110, lod1, views=((250, 10), (180, 25)))
    return res


B['putnam'] = putnam


# ================================================================ DAVENPORT CITY HALL
# 226 W 4th St (1895, Richardsonian Romanesque): rock-faced limestone, round-arched windows, a steep
# hipped slate roof with front gables, and the tall clock tower over the 4th Street entrance.
def cityhall(render=True):
    anchor = (81.5, -27.5)
    K = Kit(61)
    lime, lime2, slate, red = lin('#cdbf9f'), lin('#b3a585'), lin('#4d4f55'), lin('#8a3a2a')
    x0, x1, y0, y1 = -22.7, 23.1, -17.1, 17.2     # front (south, -y) faces 4th St
    P = rect(x0, x1, y0, y1)
    K.prism(P, -4, 0, lime2, top=False)
    eave = 15.5
    for i, L, Ln, mid in sides(P):
        nb = max(2, round((Ln - 2) / 3.6))
        K.obox(L, -0.3, Ln + 0.3, 0, 1.6, -0.1, 0.35, lime2, BODY, ('d-',))   # rusticated base course
        windows(K, L, 1, Ln - 1, 1.6, 4.4, 1, nb, lime, wf=0.5, hf=0.62, rec=0.35, edge=1, sill=lime2)
        windows(K, L, 1, Ln - 1, 6.0, 4.6, 2, nb, lime, wf=0.48, hf=0.56, rec=0.35, edge=1, sill=lime2)
        arch_heads(K, L, 1, Ln - 1, nb, 6.0 + 4.6 + (4.6 - 4.6 * 0.56) * 0.42 + 4.6 * 0.56, (Ln - 2) / nb * 0.48, lime2)
        belt(K, L, 0, Ln, 5.8, lime2, 0.25, 0.35)
        K.obox(L, -0.4, Ln + 0.4, eave - 0.6, eave, -0.1, 0.6, lime2, BODY, ('d-',))
    hip_roof(K, x0 - 0.6, x1 + 0.6, y0 - 0.6, y1 + 0.6, eave, 8.5, slate)
    # front gables either side of the tower
    for gx in (-14, 14):
        F = lambda u, h, d, gx=gx: (gx - 4 + u, y0 - 0.4 - d, h)
        K.face([F(0, eave, 0), F(8, eave, 0), F(4, eave + 6, 0)], lime)
        K.face([F(-0.3, eave, 0.15), F(4, eave + 6.4, 0.15), F(4, eave + 6.4, -6), F(-0.3, eave, -6)][::-1], slate)
        K.face([F(8.3, eave, 0.15), F(8.3, eave, -6), F(4, eave + 6.4, -6), F(4, eave + 6.4, 0.15)][::-1], slate)
        windows(K, F, 2.6, 5.4, eave + 0.6, 2.6, 1, 1, lime, wf=0.8, hf=0.7, edge=0)
    # clock tower
    tx0, tx1, ty0, ty1 = -3.8, 3.8, y0 - 1.6, y0 + 6
    T = rect(tx0, tx1, ty0, ty1)
    top = 36.0
    for i, L, Ln, mid in sides(T):
        K.quad(L, 0, Ln, 0, 8, 0, lime)
        K.quad(L, 0, Ln, 8 + 3 * 5.5, top, 0, lime)
        K.quad(L, 0, 2.4, 8, 8 + 3 * 5.5, 0, lime)
        K.quad(L, Ln - 2.4, Ln, 8, 8 + 3 * 5.5, 0, lime)
        for u in (0, Ln):
            K.obox(L, u - 0.5, u + 0.5, 0, top, -0.1, 0.25, lime2, BODY, ('d-', 'h-'))
        if mid[1] < ty0 + 1:   # entrance arch on 4th St
            K.quad(L, 2.2, 5.4, 0, 4.2, 0.03, lin('#3b2c22'))
            K.quad(L, 2.5, 5.1, 0, 3.6, 0.05, lin('#ffe1a0'), LIT)
            arch_heads(K, L, 2.2, 5.4, 1, 4.2, 3.2, lime2, 0.01)
        windows(K, L, 2.4, Ln - 2.4, 8, 5.5, 3, 1, lime, wf=0.6, hf=0.6, edge=0, lit=0.5)
        belt(K, L, 0, Ln, top - 8.5, lime2, 0.4, 0.5)
        # clock faces, lit at night
        c = Ln / 2
        cx, cy, _ = L(c, top - 5, 0.15)
        seg = 16
        ring = [L(c + math.cos(2 * math.pi * k / seg) * 1.9, top - 5 + math.sin(2 * math.pi * k / seg) * 1.9, 0.16) for k in range(seg)]
        K.face(ring, lin('#fff6dc'), LIT)
        ring2 = [L(c + math.cos(2 * math.pi * k / seg) * 2.2, top - 5 + math.sin(2 * math.pi * k / seg) * 2.2, 0.1) for k in range(seg)]
        K.face(ring2, lime2)
        K.face([L(c - 0.07, top - 5, 0.18), L(c + 0.07, top - 5, 0.18), L(c + 0.07, top - 3.6, 0.18), L(c - 0.07, top - 3.6, 0.18)], lin('#111'))
        K.face([L(c, top - 5.07, 0.18), L(c + 1.1, top - 5.07, 0.18), L(c + 1.1, top - 4.93, 0.18), L(c, top - 4.93, 0.18)], lin('#111'))
        # open belfry with corner turrets
        K.obox(L, -0.6, Ln + 0.6, top, top + 0.8, -0.1, 0.6, lime2, BODY, ('d-',))
    K.prism(T, top, top + 0.01, ROOF, sides=False)
    for (x, y) in T:
        K.cyl(x, y, 0.7, top + 0.8, top + 3.2, lime, BODY, 8)
        K.cyl(x, y, 0.8, top + 3.2, top + 6.0, slate, BODY, 8, r1=0.0)
    K.box(tx0 + 0.6, tx1 - 0.6, ty0 + 0.6, ty1 - 0.6, top, top + 3.2, lime)
    pyramid(K, 0, (ty0 + ty1) / 2, 4.2, top + 3.2, 12, slate)
    K.cyl(0, (ty0 + ty1) / 2, 0.08, top + 15, top + 18, lin('#c9a227'), BODY, 4)
    lod0 = K.obj('cityhall_lod0')

    K1 = Kit(62)
    lod1_bands(K1, P, 0, 3, eave / 3, lime)
    hip_roof(K1, x0 - 0.6, x1 + 0.6, y0 - 0.6, y1 + 0.6, eave, 8.5, slate)
    K1.prism(T, -4, top + 3.2, lime, topcol=ROOF)
    pyramid(K1, 0, (ty0 + ty1) / 2, 4.2, top + 3.2, 12, slate)
    for i, L, Ln, mid in sides(T):
        K1.face([L(Ln / 2 + math.cos(2 * math.pi * k / 8) * 1.9, top - 5 + math.sin(2 * math.pi * k / 8) * 1.9, 0.1) for k in range(8)], lin('#fff6dc'), LIT)
    lod1 = K1.obj('cityhall_lod1')
    res = finish('cityhall', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('cityhall', (0, 0, 16), 90, lod1)
    return res


B['cityhall'] = cityhall


# ================================================================ RIVERCENTER
# 136 E 3rd St (1983/2003 convention centre): long brick halls with glass bands and a tall glass atrium on
# the 3rd Street corner, linked over 3rd Street by the glass skywalk to the Adler/Blackhawk block.
def rivercenter(render=True):
    anchor = (461.0, 172.0)
    K = Kit(71)
    brick, brick2, conc = lin('#9a6248'), lin('#7f4c37'), lin('#c4bdb0')
    P = local([(522.7, 143), (523.3, 170.4), (502.6, 171.3), (502, 193.7), (483.7, 193.7), (484, 201.7), (402.4, 202.5),
               (402.8, 186.1), (402.4, 165.5), (399.3, 153.5), (399.6, 142.1), (421.2, 142.5), (426.5, 142.6), (427.7, 142.1),
               (427.6, 144.6), (503.4, 143.7)], anchor)
    K.prism(P, -4, 0, conc, top=False)
    H = 18.0
    for i, L, Ln, mid in sides(P):
        if Ln < 6:
            K.quad(L, 0, Ln, 0, H, 0, brick)
            continue
        nb = max(1, round(Ln / 6))
        storefront(K, L, 0.5, Ln - 0.5, 0, 4.5, conc, nb, lit=0.6, transom=False)
        K.quad(L, 0, Ln, 4.5, 6.0, 0, conc)
        K.quad(L, 0, Ln, 6.0, 8.5, 0, brick)
        windows(K, L, 0.6, Ln - 0.6, 8.5, 4.2, 1, max(1, round(Ln / 4)), brick, wf=0.85, hf=0.55, edge=0.6)
        K.quad(L, 0, Ln, 12.7, H, 0, brick)
        for k in range(int(Ln / 6) + 1):  # brick piers
            u = min(Ln - 0.4, max(0.4, k * Ln / max(1, int(Ln / 6))))
            K.obox(L, u - 0.4, u + 0.4, 4.5, H, 0, 0.35, brick2, BODY, ('d-', 'h-'))
        K.obox(L, -0.2, Ln + 0.2, H, H + 0.8, -0.2, 0.3, conc, BODY, ('d-',))
    roof(K, P, H + 0.8)
    rooftop_junk(K, 10, -5, H + 0.8, K.rnd, 6, 22)
    # glass atrium on the north-west corner (3rd St and Perry)
    ax0, ax1, ay0, ay1 = -61.5, -32, 3, 30.5
    A = rect(ax0, ax1, ay0, ay1)
    for i, L, Ln, mid in sides(A):
        K.quad(L, 0, Ln, 0, 24, 0, lin('#2f4552'), GLASS)
        for k in range(int(Ln / 2.4) + 1):
            u = min(Ln, k * 2.4)
            K.obox(L, u - 0.08, u + 0.08, 0, 24, 0, 0.15, lin('#d8d8d8'), BODY, ('d-', 'h-'))
        for h in range(3, 24, 3):
            K.obox(L, 0, Ln, h - 0.08, h + 0.08, 0, 0.15, lin('#d8d8d8'), BODY, ('d-',))
        for k in range(4):
            u = (k + 0.5) * Ln / 4
            K.quad(L, u - 2.5, u + 2.5, 1, 20, -2, lin('#ffe6b8'), LIT)
    # pyramid skylight roof
    K.prism(A, 24, 24.4, lin('#d8d8d8'), topcol=lin('#d8d8d8'))
    cx, cy = (ax0 + ax1) / 2, (ay0 + ay1) / 2
    for i, L, Ln, mid in sides(A):
        a, b = A[i], A[(i + 1) % 4]
        K.face([(a[0], a[1], 24.4), (b[0], b[1], 24.4), (cx, cy, 31)], lin('#3d5563'), GLASS)
    K.text('RIVERCENTER', lambda u, h, d: (ax1 - u, ay1 + 0.2 + d, h), 14.75, 21, 0.0, 1.6, lin('#ffffff'), NEON, 0.1)  # on 3rd St
    # skywalk over 3rd St to the River Center/Adler block
    sx = -40.0
    K.box(sx - 2.2, sx + 2.2, 30.4, 53.5, 6.0, 6.6, conc, BODY, ())
    K.box(sx - 2.2, sx + 2.2, 30.4, 53.5, 9.6, 10.2, conc, BODY, ('h-',))
    for xs in (sx - 2.2, sx + 2.2):
        L = (lambda u, h, d, xs=xs: (xs + d, 30.4 + u, h)) if xs > sx else (lambda u, h, d, xs=xs: (xs - d, 53.5 - u, h))
        K.quad(L, 0, 23.1, 6.6, 9.6, 0, lin('#35505e'), GLASS)
        for k in range(10):
            K.obox(L, k * 2.31, k * 2.31 + 0.12, 6.6, 9.6, 0, 0.1, lin('#d8d8d8'), BODY, ('d-',))
    lod0 = K.obj('rivercenter_lod0')
    K1 = Kit(72)
    K1.prism(P, -4, H + 0.8, brick, topcol=ROOF)
    for i, L, Ln, mid in sides(P):
        if Ln > 6:
            K1.quad(L, 0.5, Ln - 0.5, 0.5, 4.2, 0.03, LIT_C, LIT)
            K1.quad(L, 0.5, Ln - 0.5, 9.5, 11.8, 0.03, GLASS_C, GLASS)
    K1.prism(A, 0, 24.4, lin('#2f4552'), GLASS, topcol=lin('#d8d8d8'))
    K1.box(sx - 2.2, sx + 2.2, 30.4, 53.5, 6.0, 10.2, lin('#35505e'), GLASS, ())
    lod1 = K1.obj('rivercenter_lod1')
    res = finish('rivercenter', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('rivercenter', (-10, 10, 10), 150, lod1, views=((150, 18), (220, 30)))
    return res


B['rivercenter'] = rivercenter


def rail(K, pts, z, h, col, post=2.0, closed=True):
    """deck railing along a polyline: posts and a top rail"""
    n = len(pts)
    for i in range(n if closed else n - 1):
        a, b = Vector((*pts[i], z)), Vector((*pts[(i + 1) % n], z))
        d = b - a
        Ln = d.length
        if Ln < 0.1:
            continue
        L, _ = frame(pts[i], pts[(i + 1) % n])
        K.obox(L, 0, Ln, z + h - 0.08, z + h, -0.05, 0.05, col, BODY, ('d-', 'h-'))
        K.quad(L, 0, Ln, z + h * 0.45, z + h * 0.5, 0.0, col)
        for k in range(int(Ln / post) + 1):
            u = min(Ln, k * post)
            K.obox(L, u - 0.04, u + 0.04, z, z + h, -0.04, 0.04, col, BODY, ('h-', 'h+', 'd-'))


# ================================================================ THE ARNETT BELLE (made-up riverboat casino)
# A Mississippi sternwheeler moored parallel to the bank: hull, three white decks with railings and lit
# windows, twin feathered stacks, pilot house, neon name boards and the red paddlewheel (node belle_wheel,
# axle along z in the game) at the stern (west, -x). Boarding door mid-ship on the shore (+Y, game -z) side.
def belle(render=True):
    K = Kit(81, ao=0)
    white, red, black, gold, wood = lin('#f4f2ec'), lin('#b3201c'), lin('#1b1b1d'), lin('#d4a63a'), lin('#8a6a48')
    trimc = lin('#c9c4b8')
    # hull: rounded bow at +x, square stern at -x
    hull = ccw([(-34, -9)] + [(28 + math.sin(math.pi * k / 10) * 8, -math.cos(math.pi * k / 10) * 9) for k in range(11)] + [(-34, 9)])
    K.prism(hull, -1.5, 1.4, black, top=False)
    K.prism(hull, 1.4, 2.6, red, top=False)
    K.prism(hull, 2.6, 3.0, white, topcol=wood)
    # deck 1: casino saloon with lit arched windows, promenade + railing
    D1 = rect(-32, 26, -7.6, 7.6)
    for i, L, Ln, mid in sides(D1):
        nb = max(1, round(Ln / 2.6))
        windows(K, L, 0.4, Ln - 0.4, 3.0, 4.0, 1, nb, white, wf=0.6, hf=0.62, rec=0.1, lit=0.85, edge=0.4)
        arch_heads(K, L, 0.4, Ln - 0.4, nb, 3.0 + (4 - 4 * 0.62) * 0.42 + 4 * 0.62, (Ln - 0.8) / nb * 0.6, gold, 0.01, 4)
    rail(K, [(x, y * 8.7 / 9) for x, y in hull], 3.0, 1.1, white, 2.0)
    # deck 2
    K.prism(rect(-34, 30, -9, 9), 7.0, 7.4, white, topcol=wood)
    D2 = rect(-28, 22, -6.6, 6.6)
    for i, L, Ln, mid in sides(D2):
        windows(K, L, 0.4, Ln - 0.4, 7.4, 3.6, 1, max(1, round(Ln / 2.4)), white, wf=0.55, hf=0.6, rec=0.1, lit=0.7, edge=0.4)
    rail(K, rect(-33.6, 29.6, -8.6, 8.6), 7.4, 1.1, white, 1.6)
    # gingerbread fascia + chaser lights under each deck edge
    for z in (7.0, 11.0):
        for i, L, Ln, mid in sides(rect(-34, 30, -9, 9) if z == 7.0 else rect(-29, 23, -7.4, 7.4)):
            K.obox(L, 0, Ln, z - 0.5, z, 0, 0.1, trimc, BODY, ('d-',))
            for k in range(int(Ln / 1.2)):
                c = lin(['#ffe066', '#ff4fa0', '#4fd2ff'][k % 3])
                K.quad(L, k * 1.2 + 0.4, k * 1.2 + 0.7, z - 0.4, z - 0.1, 0.12, c, NEON)
    # deck 3 (texas) and pilot house
    K.prism(rect(-29, 23, -7.4, 7.4), 11.0, 11.4, white, topcol=wood)
    D3 = rect(-18, 12, -5, 5)
    for i, L, Ln, mid in sides(D3):
        windows(K, L, 0.4, Ln - 0.4, 11.4, 3.0, 1, max(1, round(Ln / 2.2)), white, wf=0.55, hf=0.55, rec=0.1, lit=0.6, edge=0.4)
    K.prism(rect(-19, 13, -6, 6), 14.4, 14.7, white, topcol=lin('#a8a49a'))
    rail(K, rect(-28.6, 22.6, -7.0, 7.0), 11.4, 1.0, white, 1.6)
    PH = rect(10, 17, -3.2, 3.2)
    for i, L, Ln, mid in sides(PH):
        K.quad(L, 0, Ln, 14.7, 15.6, 0, white)
        K.quad(L, 0, Ln, 15.6, 17.4, 0, GLASS_C, GLASS)
        for k in range(5):
            K.obox(L, k * Ln / 4 - 0.06, k * Ln / 4 + 0.06, 15.6, 17.4, 0, 0.08, white, BODY, ('d-',))
    K.prism(rect(9.5, 17.5, -3.7, 3.7), 17.4, 17.7, white, topcol=lin('#a8a49a'))
    K.cyl(13.5, 0, 0.5, 17.7, 18.6, gold, BODY, 8, r1=0.2)
    # twin stacks with feathered crowns, forward of the pilot house
    for y in (-3.6, 3.6):
        K.cyl(20, y, 0.9, 11.4, 25, black, BODY, 10)
        for k in range(10):
            a = 2 * math.pi * k / 10
            K.face([(20 + math.cos(a) * 0.9, y + math.sin(a) * 0.9, 25), (20 + math.cos(a + 0.63) * 0.9, y + math.sin(a + 0.63) * 0.9, 25),
                    (20 + math.cos(a + 0.5) * 1.6, y + math.sin(a + 0.5) * 1.6, 27.0), (20 + math.cos(a + 0.13) * 1.6, y + math.sin(a + 0.13) * 1.6, 27.4)], gold)
        K.rod((20, y, 25), (20, -y * 0.2, 24), 0.05, black)
    # neon name boards on both sides, and CASINO over the gangway door
    for sgn in (1, -1):
        L = (lambda u, h, d: (-u, 6.0 + d, h)) if sgn > 0 else (lambda u, h, d: (u, -6.0 - d, h))
        K.obox(L, -11.5, 11.5, 14.7, 19.2, -0.2, 0.0, lin('#1a0033'), BODY, ('d-',))
        for h in (14.9, 18.85):
            K.quad(L, -11.4, 11.4, h, h + 0.2, 0.01, lin('#ff4081'), NEON)
        K.text('THE ARNETT BELLE', L, 0, 16.9, 0.02, 1.6, lin('#ffd54f'), NEON, 0.08, bold=0.01)
        K.text('CASINO  -  OPEN 24 HOURS', L, 0, 15.4, 0.02, 0.9, lin('#ff80c0'), NEON, 0.06)
    door = lambda u, h, d: (-u, 7.6 + d, h)
    K.quad(door, -2.0, 2.0, 3.0, 6.2, 0.02, lin('#ffe1a0'), LIT)
    K.obox(door, -3, 3, 6.2, 6.6, 0, 1.4, red, BODY, ())
    K.text('CASINO', door, 0, 6.65, 0.4, 0.6, lin('#ffd54f'), NEON, 0.06)
    # bow: flagstaff and capstans
    K.cyl(34, 0, 0.12, 3.0, 13, white, BODY, 6)
    K.quad(lambda u, h, d: (34 + u, d, h), 0.1, 2.4, 11.4, 12.9, 0.0, lin('#2050a0'))
    for y in (-3, 3):
        K.cyl(31, y, 0.4, 3.0, 3.7, black, BODY, 8)
    # stern wheel housing: side frames and pitman arms
    for y in (-7.4, 7.4):
        K.box(-44.5, -34, y - 0.2, y + 0.2, 4.5, 5.0, white, BODY, ())
        K.rod((-34, y, 7.0), (-44, y, 5.5), 0.2, white)
        K.rod((-30, y, 4.0), (-40, y, 5.2), 0.18, red)
    lod0 = K.obj('belle_lod0')
    # the paddlewheel: its own node so the game can turn it (pivot on the axle)
    W = Kit(83, ao=0)
    ax = (-40.0, 0.0, 5.2)
    R, half = 5.4, 7.0
    for y in (-half, half):
        for k in range(24):
            a, b = 2 * math.pi * k / 24, 2 * math.pi * (k + 1) / 24
            p = lambda a_, r: (ax[0] + math.cos(a_) * r, y, ax[2] + math.sin(a_) * r)
            W.face([p(a, R - 0.3), p(b, R - 0.3), p(b, R), p(a, R)], red)
            W.face([p(a, R), p(b, R), p(b, R - 0.3), p(a, R - 0.3)], red)
        for k in range(8):
            a = 2 * math.pi * k / 8
            W.rod((ax[0], y, ax[2]), (ax[0] + math.cos(a) * R, y, ax[2] + math.sin(a) * R), 0.12, red)
    for k in range(16):
        a = 2 * math.pi * k / 16
        c = (ax[0] + math.cos(a) * (R - 0.6), ax[2] + math.sin(a) * (R - 0.6))
        WL = lambda u, h, d, a=a, c=c: (c[0] + math.cos(a) * h - math.sin(a) * d, u, c[1] + math.sin(a) * h + math.cos(a) * d)
        W.obox(WL, -half, half, -0.8, 0.9, -0.08, 0.08, lin('#7a1512'), BODY, ())
    W.rod((ax[0], -half - 0.5, ax[2]), (ax[0], half + 0.5, ax[2]), 0.3, black, seg=8)
    wheel = W.obj('belle_wheel', ax)
    K1 = Kit(82, ao=0)
    K1.prism(hull, -1.5, 3.0, red, topcol=wood)
    K1.prism(D1, 3.0, 7.0, white, top=False)
    K1.prism(rect(-34, 30, -9, 9), 7.0, 7.4, white)
    K1.prism(D2, 7.4, 11.0, white, top=False)
    K1.prism(rect(-29, 23, -7.4, 7.4), 11.0, 11.4, white)
    for P_, h0 in ((D1, 4.0), (D2, 8.4)):
        for i, L, Ln, mid in sides(P_):
            K1.quad(L, 0.5, Ln - 0.5, h0, h0 + 2.2, 0.03, LIT_C, LIT)
    K1.prism(D3, 11.4, 14.7, white)
    for y in (-3.6, 3.6):
        K1.cyl(20, y, 0.9, 11.4, 26, black, BODY, 6)
    K1.box(-11.5, 11.5, -6.2, 6.2, 14.7, 19.2, lin('#1a0033'), NEON, ())
    lod1 = K1.obj('belle_lod1')
    res = finish('belle', [lod0, lod1, wheel], None)
    if render:
        res['png'] = shots('belle', (0, 0, 8), 95, lod1, views=((160, 12), (20, 20)))
    return res


B['belle'] = belle


# ================================================================ BIX BEIDERBECKE BANDSHELL (LeClaire Park)
# Concentric white arches stepping down to the back wall over a raised stage; opens east (+x) to the lawn.
def bandshell(render=True):
    anchor = (-180.0, 530.0)
    K = Kit(91)
    white, conc, wood = lin('#f2f0ea'), lin('#bdb8ad'), lin('#7b5a3c')
    # stage
    K.box(-6.5, 5.5, -10, 10, -2, 1.2, conc)
    K.box(-6.5, 5.5, -10, 10, 1.2, 1.25, wood, BODY, ('h-',))
    for k in range(4):
        K.box(5.5 + k * 0.6, 6.1 + k * 0.6, -4, 4, -2, 1.2 - (k + 1) * 0.3, conc)
    # arches: each a half ring in the y-z plane, stepping back and down
    rings = [(-5.5, 6.0, 9.6), (-3.5, 6.6, 10.0), (-1.5, 7.2, 10.3), (0.5, 7.8, 10.5), (2.5, 8.4, 10.6), (4.5, 9.0, 10.6)]
    seg = 14
    for i, (x, rz, ry) in enumerate(rings):
        x0, x1 = x, x + 2.2
        pt = lambda a, r, xx: (xx, math.cos(a) * r * ry / rz, 1.2 + math.sin(a) * r)
        for k in range(seg):
            a, b = math.pi * k / seg, math.pi * (k + 1) / seg
            # underside (lit at night), outer skin, front edge
            K.face([pt(a, rz, x0), pt(b, rz, x0), pt(b, rz, x1), pt(a, rz, x1)], white)
            K.face([pt(a, rz + 0.4, x1), pt(b, rz + 0.4, x1), pt(b, rz + 0.4, x0), pt(a, rz + 0.4, x0)], white)
            K.face([pt(a, rz, x1), pt(b, rz, x1), pt(b, rz + 0.4, x1), pt(a, rz + 0.4, x1)], white)
            if i < len(rings) - 1:
                K.face([pt(a, rz + 0.4, x1), pt(a, rz + 0.6, x1), pt(b, rz + 0.6, x1), pt(b, rz + 0.4, x1)][::-1], white)
        for k in range(0, seg, 2):  # footlights along each arch edge
            a = math.pi * (k + 0.5) / seg
            c = pt(a, rz - 0.05, x1 - 0.05)
            K.face([(c[0], c[1] - 0.15, c[2] - 0.15), (c[0], c[1] + 0.15, c[2] - 0.15), (c[0], c[1] + 0.15, c[2] + 0.15), (c[0], c[1] - 0.15, c[2] + 0.15)], lin('#fff1c4'), NEON)
    # back wall
    pts = [(-5.6, math.cos(math.pi * k / seg) * 9.6, 1.2 + math.sin(math.pi * k / seg) * 6.0) for k in range(seg + 1)]
    K.face([(-5.6, 0, 1.2)] + pts, white)
    K.face(([(-5.7, 0, 1.2)] + [(p[0] - 0.1, p[1], p[2]) for p in pts])[::-1], conc)
    K.prism(rect(-9, -5.85, -4, 4), -2, 4.5, conc, topcol=ROOF)  # dressing rooms
    lod0 = K.obj('bandshell_lod0')
    K1 = Kit(92)
    K1.box(-6.5, 5.5, -10, 10, -2, 1.2, conc)
    for k in range(7):
        a, b = math.pi * k / 7, math.pi * (k + 1) / 7
        K1.face([(6.6, math.cos(a) * 10.6, 1.2 + math.sin(a) * 9.4), (6.6, math.cos(b) * 10.6, 1.2 + math.sin(b) * 9.4), (-5.6, math.cos(b) * 9.6, 1.2 + math.sin(b) * 6.4), (-5.6, math.cos(a) * 9.6, 1.2 + math.sin(a) * 6.4)], white)
    lod1 = K1.obj('bandshell_lod1')
    res = finish('bandshell', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('bandshell', (0, 0, 4), 38, lod1, views=((70, 12), (200, 20)))
    return res


B['bandshell'] = bandshell


# ================================================================ BRIDGES (span modules the game repeats)
# Each module runs along Blender -Y (game +z) from 0 to -100 m with the road surface at z = 0; the game
# rotates it to the bridge heading and stretches it along its length to fit each span.
def centennial(render=True):
    """Centennial Bridge: one tied steel arch span (the real bridge has five) on concrete piers."""
    K = Kit(101, ao=0)
    steel, conc, dark = lin('#7d98a3'), lin('#bdb9b0'), lin('#4b5a60')
    Ln, W, rise = 100.0, 8.0, 30.0
    P = lambda s: -s  # distance along the span -> blender y
    K.box(-W + 0.4, W - 0.4, -Ln, 0, -1.1, -0.3, conc, BODY, ('u-', 'u+', 'd-', 'd+'))
    for x in (-W, W):  # tie girders
        K.box(x - 0.5, x + 0.5, -Ln, 0, -2.4, 0.9, steel, BODY, ('d-', 'd+'))
    for x in (-W + 0.9, W - 0.9):  # parapet rails
        K.box(x - 0.15, x + 0.15, -Ln, 0, -0.3, 0.75, conc, BODY, ('d-', 'd+', 'h-'))
    N = 20
    arch = lambda t: rise * 4 * t * (1 - t) + 0.9
    for x in (-W, W):
        for i in range(N):
            t0, t1 = i / N, (i + 1) / N
            K.rod((x, P(t0 * Ln), arch(t0)), (x, P(t1 * Ln), arch(t1)), 0.85, steel, seg=4)
        for i in range(1, 20):  # hangers
            t = i / 20
            K.rod((x, P(t * Ln), 0.9), (x, P(t * Ln), arch(t)), 0.07, dark, seg=3)
    for i in range(3, 18, 2):  # top lateral bracing between the two ribs
        t0, t1 = i / 20, (i + 2) / 20
        K.rod((-W, P(t0 * Ln), arch(t0)), (W, P(t0 * Ln), arch(t0)), 0.3, steel, seg=4)
        K.rod((-W, P(t0 * Ln), arch(t0)), (W, P(t1 * Ln), arch(t1)), 0.18, steel, seg=4)
        K.rod((W, P(t0 * Ln), arch(t0)), (-W, P(t1 * Ln), arch(t1)), 0.18, steel, seg=4)
    for t in (0.04, 0.96):  # portal struts
        K.rod((-W, P(t * Ln), arch(t)), (W, P(t * Ln), arch(t)), 0.4, steel, seg=4)
    # pier with cutwaters (upstream and downstream)
    K.box(-W - 1, W + 1, -2.6, 2.6, -32, -2.4, conc)
    for x in (-W - 1, W + 1):
        sg = 1 if x > 0 else -1
        K.face([(x, -2.6, -32), (x + sg * 3, 0, -32), (x + sg * 3, 0, -2.4), (x, -2.6, -2.4)], conc)
        K.face([(x, 2.6, -2.4), (x + sg * 3, 0, -2.4), (x + sg * 3, 0, -32), (x, 2.6, -32)], conc)
        K.face([(x, -2.6, -2.4), (x + sg * 3, 0, -2.4), (x, 2.6, -2.4)][::(1 if sg > 0 else -1)], conc)
    for s_ in (25, 75):  # lamp posts
        for x in (-W + 0.9, W - 0.9):
            K.rod((x, P(s_), 0.7), (x, P(s_), 8), 0.08, dark, seg=4)
            K.rod((x, P(s_), 8), (x * 0.82, P(s_), 8.3), 0.06, dark, seg=4)
            K.box(x * 0.82 - 0.3, x * 0.82 + 0.3, P(s_) - 0.2, P(s_) + 0.2, 7.9, 8.2, lin('#fff1c4'), NEON, ())
    for x in (-W, W):  # navigation/aesthetic lights along the arch crowns
        for i in range(2, 19, 2):
            t = i / 20
            K.box(x - 0.3, x + 0.3, P(t * Ln) - 0.3, P(t * Ln) + 0.3, arch(t) + 0.85, arch(t) + 1.15, lin('#fff6e0'), NEON, ())
    lod0 = K.obj('centennial_lod0')
    K1 = Kit(102, ao=0)
    K1.box(-W - 0.5, W + 0.5, -Ln, 0, -2.4, -0.3, steel, BODY, ('d-', 'd+'))
    for x in (-W, W):
        for i in range(8):
            t0, t1 = i / 8, (i + 1) / 8
            K1.rod((x, P(t0 * Ln), arch(t0)), (x, P(t1 * Ln), arch(t1)), 0.9, steel, seg=3)
    K1.box(-W - 1, W + 1, -2.6, 2.6, -32, -2.4, conc)
    lod1 = K1.obj('centennial_lod1')
    res = finish('centennial', [lod0, lod1], None)
    if render:
        res['png'] = shots('centennial', (0, -50, 5), 120, lod1, views=((70, 10),))
    return res


B['centennial'] = centennial


def govtruss(render=True, swing=False):
    """Government Bridge (1896): double-deck steel through truss, rail on top, road inside, on stone piers.
    The swing module (102 m) turns on a round centre pier; its top chord humps over the middle."""
    K = Kit(111 + swing, ao=0)
    steel, stone, dark, rust = lin('#55603a'), lin('#a8a296'), lin('#2e3324'), lin('#5b4636')
    Ln = 102.0 if swing else 60.0
    W, H = 5.6, 9.0
    P = lambda s: -s
    top = (lambda s: H + 5.0 * math.sin(math.pi * s / Ln)) if swing else (lambda s: H)
    K.box(-W + 0.3, W - 0.3, -Ln, 0, -1.4, -0.35, lin('#8b877e'), BODY, ('u-', 'u+', 'd-', 'd+'))
    panel = Ln / (8 if swing else 5)
    n = int(round(Ln / panel))
    for x in (-W, W):
        K.box(x - 0.35, x + 0.35, -Ln, 0, -1.6, -0.6, steel, BODY, ('d-', 'd+'))           # bottom chord
        for i in range(n):
            s0, s1 = i * panel, (i + 1) * panel
            K.rod((x, P(s0), top(s0)), (x, P(s1), top(s1)), 0.4, steel, seg=4)          # top chord
            K.rod((x, P(s0), -0.6), (x, P(s0), top(s0)), 0.28, steel, seg=4)            # verticals
            a, b = (s0, s1) if (i < n / 2) else (s1, s0)
            K.rod((x, P(a), top(a)), (x, P(b), -0.6), 0.2, steel, seg=4)                 # diagonals
            K.rod((x, P(s0), top(s0) * 0.5), (x, P(s1), top(s1) * 0.5), 0.07, dark, seg=3)  # rail guard
        K.rod((x, P(Ln), -0.6), (x, P(Ln), top(Ln)), 0.28, steel, seg=4)
    # upper deck: railway on top of the trusses, with ties and rails
    for i in range(n):
        s0 = i * panel
        K.rod((-W, P(s0), top(s0)), (W, P(s0), top(s0)), 0.25, steel, seg=4)
    if not swing:
        K.box(-W, W, -Ln, 0, H + 0.2, H + 0.6, steel, BODY, ('d-', 'd+'))
        K.box(-2.0, 2.0, -Ln, 0, H + 0.6, H + 0.8, rust, BODY, ('d-', 'd+', 'h-'))
        for x in (-0.75, 0.75):
            K.box(x - 0.05, x + 0.05, -Ln, 0, H + 0.8, H + 0.95, lin('#8c8c8c'), BODY, ('d-', 'd+', 'h-'))
        K.box(-W - 1.2, W + 1.2, -3.5, 3.5, -30, -1.6, stone)
        K.box(-W - 1.4, W + 1.4, -3.7, 3.7, -1.9, -1.6, lin('#c8c2b5'))
    else:
        K.cyl(0, P(Ln / 2), 7.5, -30, -1.6, stone, BODY, 16)
        K.cyl(0, P(Ln / 2), 7.9, -1.9, -1.6, lin('#c8c2b5'), BODY, 16)
        K.box(-1.6, 1.6, P(Ln / 2) - 1.6, P(Ln / 2) + 1.6, top(Ln / 2), top(Ln / 2) + 3.2, lin('#d9d4c4'))   # operator house
        K.box(-1.9, 1.9, P(Ln / 2) - 1.9, P(Ln / 2) + 1.9, top(Ln / 2) + 3.2, top(Ln / 2) + 3.5, steel)
        for s_ in (1.0, Ln - 1.0):
            K.box(-W - 1.2, W + 1.2, P(s_) - 3.0, P(s_) + 3.0, -30, -1.6, stone)
        for s_ in (8, Ln - 8):
            K.box(-1.0, 1.0, P(s_) - 0.2, P(s_) + 0.2, top(s_) + 0.4, top(s_) + 1.2, lin('#ff3030'), NEON, ())
    name = 'govswing' if swing else 'govtruss'
    lod0 = K.obj(name + '_lod0')
    K1 = Kit(113 + swing, ao=0)
    K1.box(-W, W, -Ln, 0, -1.6, -0.4, steel, BODY, ('d-', 'd+'))
    for x in (-W, W):
        for i in range(n):
            s0, s1 = i * panel, (i + 1) * panel
            K1.rod((x, P(s0), top(s0)), (x, P(s1), top(s1)), 0.45, steel, seg=3)
            K1.rod((x, P(s0), -0.6), (x, P(s0), top(s0)), 0.3, steel, seg=3)
    if swing:
        K1.cyl(0, P(Ln / 2), 7.5, -30, -1.6, stone, BODY, 8)
    else:
        K1.box(-W - 1.2, W + 1.2, -3.5, 3.5, -30, -1.6, stone)
    lod1 = K1.obj(name + '_lod1')
    res = finish(name, [lod0, lod1], None)
    if render:
        res['png'] = shots(name, (0, -Ln / 2, 4), Ln * 1.1, lod1, views=((70, 10),))
    return res


B['govtruss'] = govtruss
B['govswing'] = lambda render=True: govtruss(render, True)


# ================================================================ SKYBRIDGE
# The 2002 glass skywalk from 2nd Street over River Drive and the tracks to LeClaire Park: a glazed
# tube under white steel ribs, with lift towers at both ends; LED-lit (violet) at night.
# Built along Blender -Y (game +z) from 0 to -161 m, walkway floor at z = 7.
def skybridge(render=True):
    anchor = (225.0, 310.0)
    K = Kit(121, ao=0)
    white, glass, conc, led = lin('#eeeeee'), lin('#7fa6ba'), lin('#c9c6be'), lin('#8a5cff')
    Ln, w, z0 = 161.0, 2.6, 7.0
    K.box(-w - 0.3, w + 0.3, -Ln, 0, z0 - 0.7, z0, conc, BODY, ('d-', 'd+'))
    for x in (-w, w):
        L = (lambda u, h, d, x=x: (x + d, -u, h)) if x > 0 else (lambda u, h, d, x=x: (x - d, -Ln + u, h))
        K.quad(L, 0, Ln, z0, z0 + 3.2, 0, glass, GLASS)
        K.quad(L, 0, Ln, z0 - 0.7, z0 - 0.5, 0.05, led, NEON)
    # barrel roof of ribs + glazing
    seg = 6
    arc = lambda k: (math.cos(math.pi * k / seg) * w, z0 + 3.2 + math.sin(math.pi * k / seg) * 1.4)
    for k in range(seg):
        (xa, za), (xb, zb) = arc(k), arc(k + 1)
        K.face([(xa, 0, za), (xb, 0, zb), (xb, -Ln, zb), (xa, -Ln, za)][::-1], glass, GLASS)
    for i in range(0, int(Ln) + 1, 4):
        y = -min(Ln, i)
        for k in range(seg):
            (xa, za), (xb, zb) = arc(k), arc(k + 1)
            K.rod((xa, y, za), (xb, y, zb), 0.08, white, seg=3)
        for x in (-w, w):
            K.rod((x, y, z0), (x, y, z0 + 3.2), 0.07, white, seg=3)
    # support columns and lift towers
    for s_ in (40, 80, 120):
        K.box(-1, 1, -s_ - 1, -s_ + 1, -3, z0 - 0.7, conc)
    for s_ in (0, Ln):
        y = -s_ + (5 if s_ else -5)
        K.box(-4, 4, y - 4, y + 4, -3, z0 + 6, glass, GLASS)
        K.box(-4.2, 4.2, y - 4.2, y + 4.2, z0 + 6, z0 + 6.6, white)
        for x in (-4, 4):
            for yy in (y - 4, y + 4):
                K.box(x - 0.2, x + 0.2, yy - 0.2, yy + 0.2, -3, z0 + 6, white)
        K.box(-4.3, 4.3, y - 4.3, y + 4.3, z0 + 6.6, z0 + 6.8, led, NEON)
    lod0 = K.obj('skybridge_lod0')
    K1 = Kit(122, ao=0)
    K1.box(-w, w, -Ln, 0, z0 - 0.7, z0 + 4.6, glass, GLASS, ())
    for s_ in (0, Ln):
        y = -s_ + (5 if s_ else -5)
        K1.box(-4, 4, y - 4, y + 4, -3, z0 + 6.6, glass, GLASS)
    lod1 = K1.obj('skybridge_lod1')
    res = finish('skybridge', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('skybridge', (0, -80, 6), 90, lod1, views=((70, 15),))
    return res


B['skybridge'] = skybridge


def resample(pts, n):
    """n points evenly spaced along a polyline"""
    d = [0.0]
    for i in range(1, len(pts)):
        d.append(d[-1] + math.dist(pts[i - 1], pts[i]))
    out, j = [], 1
    for k in range(n):
        t = d[-1] * k / (n - 1)
        while j < len(pts) - 1 and d[j] < t:
            j += 1
        f = (t - d[j - 1]) / ((d[j] - d[j - 1]) or 1)
        out.append((pts[j - 1][0] + (pts[j][0] - pts[j - 1][0]) * f, pts[j - 1][1] + (pts[j][1] - pts[j - 1][1]) * f))
    return out


# ================================================================ MODERN WOODMEN PARK grandstand
# The curved grandstand wrapping home plate (OSM outline): stepped seating bowl down to the field, brick
# outer wall with arched openings toward River Drive, a canopy roof on columns, press box behind home.
# (Light towers, the Ferris wheel and the sign stay in landmarks.js, they move/glow.)
def ballpark(render=True):
    anchor = (-400.0, 520.0)
    K = Kit(131)
    brick, conc, seat, seat2, roofc, steel = lin('#8b3f2c'), lin('#bdb8ad'), lin('#24508a'), lin('#2a5f9e'), lin('#d9d9d4'), lin('#3a3f44')
    outer = [(-438, 550), (-440, 546), (-441, 541), (-441, 532), (-441, 523), (-439, 516), (-436, 509), (-432, 502), (-427, 496), (-422, 492),
             (-416, 487), (-409, 484), (-402, 482), (-395, 480), (-386, 481), (-353, 482), (-327, 483)]
    field = [(-411, 562), (-411, 545), (-410, 534), (-406, 527), (-399, 521), (-390, 517), (-375, 515), (-360, 512), (-345, 507), (-327, 504)]
    tl = lambda p: (p[0] - anchor[0], -(p[1] - anchor[1]))
    N = 26
    O = [tl(p) for p in resample(outer, N)]
    F = [tl(p) for p in resample(field, N)]
    rows = 9
    zf, zo = 0.9, 10.0
    for i in range(N - 1):
        for r in range(rows):
            t0, t1 = r / rows, (r + 1) / rows
            a0 = [F[i][j] + (O[i][j] - F[i][j]) * t0 for j in (0, 1)]
            b0 = [F[i + 1][j] + (O[i + 1][j] - F[i + 1][j]) * t0 for j in (0, 1)]
            a1 = [F[i][j] + (O[i][j] - F[i][j]) * t1 for j in (0, 1)]
            b1 = [F[i + 1][j] + (O[i + 1][j] - F[i + 1][j]) * t1 for j in (0, 1)]
            z0, z1 = zf + (zo - zf) * t0, zf + (zo - zf) * t1
            col = conc if r == 4 else (seat if (r + i) % 2 else seat2)
            K.oface([Vector((*a0, z1)), Vector((*b0, z1)), Vector((*b1, z1)), Vector((*a1, z1))], Vector((*a0, z1 - 5)), col)
    # risers face the field
    for i in range(N - 1):
        for r in range(rows):
            t0 = r / rows
            a0 = [F[i][j] + (O[i][j] - F[i][j]) * t0 for j in (0, 1)]
            b0 = [F[i + 1][j] + (O[i + 1][j] - F[i + 1][j]) * t0 for j in (0, 1)]
            z0, z1 = zf + (zo - zf) * t0, zf + (zo - zf) * (r + 1) / rows
            fx, fy = F[i][0] - O[i][0], F[i][1] - O[i][1]
            q = [Vector((*a0, z0)), Vector((*b0, z0)), Vector((*b0, z1)), Vector((*a0, z1))]
            n = (q[1] - q[0]).cross(q[3] - q[0])
            if n.x * fx + n.y * fy < 0:
                q = q[::-1]
            K.face(q, scale(conc, 0.85))
    # field wall (padded, dark green) and the outer brick wall with arches
    for i in range(N - 1):
        p0, p1 = F[i], F[i + 1]
        L, Ln = frame(p1, p0)
        K.quad(L, 0, Ln, -0.5, zf, 0, lin('#1f4d2e'))
    for i in range(N - 1):
        L, Ln = frame(O[i + 1], O[i])
        K.quad(L, 0, Ln, -3, 13.5, 0, brick)
        K.quad(L, 0, Ln, 0, 13.5, -2.0, brick)
        nb = max(1, round(Ln / 4.5))
        for b in range(nb):
            c = (b + 0.5) * Ln / nb
            K.quad(L, c - 1.3, c + 1.3, 0, 3.8, 0.02, lin('#2b2622'))
            arch_heads(K, L, c - 1.3, c + 1.3, 1, 3.8, 2.6, conc, 0.02, 5)
            K.quad(L, c - 1.0, c + 1.0, 6.5, 9.5, 0.02, GLASS_C, GLASS)
        K.obox(L, -0.2, Ln + 0.2, 13.5, 14.2, -2.2, 0.3, conc, BODY, ())
        K.obox(L, -0.2, Ln + 0.2, 4.6, 5.0, -0.1, 0.25, conc, BODY, ('d-',))
    for k in (0, N - 1):  # end walls
        a, b = F[k], O[k]
        L, Ln = frame(a, b) if k == 0 else frame(b, a)
        K.face([L(0, -3, 0), L(Ln, -3, 0), L(Ln, 13.5, 0), L(0, zf, 0)], brick)
    # canopy roof over the upper rows, on steel columns
    for i in range(N - 1):
        a = [O[i][j] + (F[i][j] - O[i][j]) * 0.4 for j in (0, 1)]
        b = [O[i + 1][j] + (F[i + 1][j] - O[i + 1][j]) * 0.4 for j in (0, 1)]
        q = [(*O[i], 16.5), (*O[i + 1], 16.5), (*b, 15.4), (*a, 15.4)]
        K.oface([Vector(p) for p in q], Vector((*O[i], 0)), roofc)
        K.oface([Vector((p[0], p[1], p[2] - 0.3)) for p in q], Vector((*O[i], 40)), scale(roofc, 0.6))
        if i % 3 == 0:
            K.rod((*a, 7.0), (*a, 15.4), 0.18, steel, seg=4)
            K.box(a[0] - 0.4, a[0] + 0.4, a[1] - 0.4, a[1] + 0.4, 15.0, 15.4, lin('#fff1c4'), NEON, ())
    # press box behind home plate
    k = N // 3
    c = [(O[k][j] + F[k][j] * 0.4) / 1.4 for j in (0, 1)]
    K.box(c[0] - 6, c[0] + 6, c[1] - 3, c[1] + 3, 10.0, 14.6, conc)
    K.box(c[0] - 5.8, c[0] + 5.8, c[1] - 3.05, c[1] + 3.05, 11.4, 13.6, GLASS_C, LIT, ('h-', 'h+'))
    lod0 = K.obj('ballpark_lod0')
    K1 = Kit(132)
    for i in range(N - 1):
        q = [Vector((*F[i], zf)), Vector((*F[i + 1], zf)), Vector((*O[i + 1], zo)), Vector((*O[i], zo))]
        n = (q[1] - q[0]).cross(q[3] - q[0])
        K1.face(q if n.z > 0 else q[::-1], seat)
        L, Ln = frame(O[i + 1], O[i])
        K1.quad(L, 0, Ln, -3, 14.2, 0, brick)
        a = [O[i][j] + (F[i][j] - O[i][j]) * 0.4 for j in (0, 1)]
        b = [O[i + 1][j] + (F[i + 1][j] - O[i + 1][j]) * 0.4 for j in (0, 1)]
        K1.oface([Vector(p) for p in [(*O[i], 16.5), (*O[i + 1], 16.5), (*b, 15.4), (*a, 15.4)]], Vector((*O[i], 0)), roofc)
    lod1 = K1.obj('ballpark_lod1')
    res = finish('ballpark', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('ballpark', (10, 0, 5), 110, lod1, views=((150, 25), (300, 20)))
    return res


B['ballpark'] = ballpark


# ================================================================ AMBROSE HALL (St. Ambrose University)
# 1885 Victorian Gothic: red brick, stone trim, steep slate roofs and the slender central tower and spire
# over the north entrance pavilion.
def ambrose(render=True):
    anchor = (-287.0, -1693.0)
    K = Kit(141)
    brick, stone, slate = lin('#8e3b26'), lin('#cfc2a4'), lin('#3f4248')
    P = local([(-244.2, -1677.4), (-254.8, -1677.4), (-254.7, -1689), (-266.1, -1689.1), (-266.2, -1677.4), (-278, -1677.5), (-278, -1682.6),
               (-284, -1682.7), (-284.1, -1676.3), (-301, -1676.4), (-301, -1681.8), (-305.9, -1681.8), (-306, -1676.2), (-329.2, -1676.4),
               (-329.1, -1694.5), (-305.9, -1694.4), (-306, -1686.8), (-300.9, -1686.7), (-300.8, -1700.2), (-294.9, -1700.2), (-294.8, -1711.8),
               (-289.4, -1711.7), (-289.5, -1700.9), (-278, -1700.9), (-277.9, -1709), (-244, -1708.8)], anchor)
    eave = 14.0
    K.prism(P, -4, 0, stone, top=False)
    for i, L, Ln, mid in sides(P):
        if Ln < 4.5:
            K.quad(L, 0, Ln, 0, eave, 0, brick)
            continue
        nb = max(1, round((Ln - 1.2) / 3.2))
        windows(K, L, 0.6, Ln - 0.6, 0, 3.6, 1, nb, brick, wf=0.45, hf=0.55, sill=stone)
        windows(K, L, 0.6, Ln - 0.6, 3.6, 3.5, 3, nb, brick, wf=0.42, hf=0.62, sill=stone, head=stone)
        belt(K, L, 0, Ln, 3.4, stone, 0.15, 0.3)
        K.obox(L, -0.3, Ln + 0.3, eave - 0.5, eave, -0.1, 0.5, stone, BODY, ('d-',))
    # roofs: hipped over the main bar and the wings, flat links between
    hip_roof(K, -42.6, 43.2, -1.9, 16.7, eave, 7.5, slate)
    hip_roof(K, 8.8, 43.2, -16.4, -1.9, eave, 5.5, slate)
    hip_roof(K, -14.4, 9.4, -7.6, 6.0, eave, 5.0, slate)
    K.prism(P, eave - 0.01, eave, ROOF, sides=False)
    # dormers on the long south roof
    for x in range(-36, 42, 9):
        F = lambda u, h, d, x=x: (x - 1.2 + u, 16.4 - 2.6 - d, h)
        K.quad(F, 0, 2.4, eave + 0.5, eave + 2.3, 0, stone)
        K.quad(F, 0.5, 1.9, eave + 0.8, eave + 2.0, 0.02, GLASS_C, LIT if x % 2 else GLASS)
        K.face([F(-0.2, eave + 2.3, 0.1), F(2.6, eave + 2.3, 0.1), F(1.2, eave + 3.4, 0.1)], slate)
    # central tower over the north porch, with belfry and spire
    tx, ty, tw = (-292.1 - anchor[0]), -(-1706 - anchor[1]), 3.2
    T = rect(tx - tw, tx + tw, ty - tw, ty + tw)
    ttop = 30.0
    for i, L, Ln, mid in sides(T):
        K.quad(L, 0, Ln, 0, 4, 0, brick)
        K.quad(L, 0, Ln, 4, ttop, 0, brick)
        K.quad(L, 1.6, Ln - 1.6, 1.0, 3.6, 0.02, lin('#3a2a20'))
        for h in (8, 13, 18):
            K.quad(L, 2.4, Ln - 2.4, h, h + 2.6, 0.02, GLASS_C, GLASS)
            arch_heads(K, L, 2.4, Ln - 2.4, 1, h + 2.6, Ln - 4.8, stone, 0.03, 4)
        K.quad(L, 1.6, Ln - 1.6, ttop - 6, ttop - 1.5, 0.02, lin('#1a1a1a'))  # belfry openings
        arch_heads(K, L, 1.6, Ln - 1.6, 1, ttop - 1.5, Ln - 3.2, stone, 0.03, 5)
        belt(K, L, 0, Ln, ttop - 6.6, stone, 0.25, 0.4)
        K.obox(L, -0.3, Ln + 0.3, ttop, ttop + 1.6, -0.1, 0.35, stone, BODY, ('d-',))
        c = Ln / 2  # clock
        ring = [L(c + math.cos(2 * math.pi * k / 12) * 1.3, ttop - 9.5 + math.sin(2 * math.pi * k / 12) * 1.3, 0.06) for k in range(12)]
        K.face(ring, lin('#fff6dc'), LIT)
    for (x, y) in T:
        K.cyl(x, y, 0.5, ttop + 1.6, ttop + 5, slate, BODY, 6, r1=0)
    pyramid(K, tx, ty, tw + 0.3, ttop + 1.6, 18, slate)
    K.rod((tx, ty, ttop + 19.6), (tx, ty, ttop + 22.5), 0.08, lin('#c9a227'), seg=4)
    K.rod((tx - 0.8, ty, ttop + 21.4), (tx + 0.8, ty, ttop + 21.4), 0.07, lin('#c9a227'), seg=4)
    lod0 = K.obj('ambrose_lod0')
    K1 = Kit(142)
    lod1_bands(K1, P, 0, 4, eave / 4, brick)
    hip_roof(K1, -42.6, 43.2, -1.9, 16.7, eave, 7.5, slate)
    hip_roof(K1, 8.8, 43.2, -16.4, -1.9, eave, 5.5, slate)
    K1.prism(T, 0, ttop + 1.6, brick, topcol=ROOF)
    pyramid(K1, tx, ty, tw + 0.3, ttop + 1.6, 18, slate)
    lod1 = K1.obj('ambrose_lod1')
    res = finish('ambrose', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('ambrose', (0, 0, 12), 110, lod1, views=((160, 15), (20, 20)))
    return res


B['ambrose'] = ambrose


# ================================================================ VANDER VEER CONSERVATORY
# White-framed glass house: a central domed palm house between gabled glass wings, on a low brick base.
def conservatory(render=True):
    anchor = (196.0, -2394.0)
    K = Kit(151)
    white, brick, glass = lin('#f0f0ec'), lin('#8b5a44'), lin('#9fc3cf')
    # (game x 159..231, z -2406..-2382)
    def glasshouse(x0, x1, y0, y1, wall_h, ridge_h, along_x=True):
        P = rect(x0, x1, y0, y1)
        for i, L, Ln, mid in sides(P):
            K.quad(L, 0, Ln, -2, 1.0, 0, brick)
            K.quad(L, 0, Ln, 1.0, wall_h, 0, glass, LIT if K.rnd.random() < 0.5 else GLASS)
            for k in range(int(Ln / 1.6) + 1):
                u = min(Ln, k * 1.6)
                K.obox(L, u - 0.05, u + 0.05, 1.0, wall_h, 0, 0.08, white, BODY, ('d-',))
            K.obox(L, 0, Ln, wall_h - 0.1, wall_h + 0.15, 0, 0.15, white, BODY, ('d-',))
        if along_x:
            ym = (y0 + y1) / 2
            for s, ya in ((1, y0), (-1, y1)):
                K.oface([Vector((x0, ya, wall_h)), Vector((x1, ya, wall_h)), Vector((x1, ym, ridge_h)), Vector((x0, ym, ridge_h))], Vector((0, ym, 0)), glass, GLASS)
            for xa in (x0, x1):
                K.oface([Vector((xa, y0, wall_h)), Vector((xa, y1, wall_h)), Vector((xa, ym, ridge_h))], Vector(((x0 + x1) / 2, ym, wall_h)), glass, GLASS)
            for k in range(int((x1 - x0) / 1.6) + 1):
                x = min(x1, x0 + k * 1.6)
                K.rod((x, y0, wall_h), (x, ym, ridge_h), 0.05, white, seg=3)
                K.rod((x, y1, wall_h), (x, ym, ridge_h), 0.05, white, seg=3)
            K.rod((x0, ym, ridge_h + 0.1), (x1, ym, ridge_h + 0.1), 0.12, white, seg=4)
    glasshouse(-37, -9, -12, 12, 4.5, 8.5)
    glasshouse(17, 34, -8, 8, 4.0, 7.0)
    # central palm house: octagonal drum and glass dome with ribs and lantern
    cx, cy, R = 4, 0, 12.5
    seg = 16
    K.cyl(cx, cy, R, -2, 1.0, brick, BODY, seg, top=False)
    K.cyl(cx, cy, R, 1.0, 7.5, glass, LIT, seg, top=False)
    for k in range(seg):
        a = 2 * math.pi * k / seg
        K.rod((cx + math.cos(a) * R, cy + math.sin(a) * R, 1), (cx + math.cos(a) * R, cy + math.sin(a) * R, 7.5), 0.08, white, seg=3)
    rings = 6
    prev = None
    for r in range(rings + 1):
        t = r / rings
        rr, z = R * math.cos(t * math.pi / 2 * 0.92), 7.5 + 8.0 * math.sin(t * math.pi / 2 * 0.92)
        ring = [(cx + math.cos(2 * math.pi * k / seg) * rr, cy + math.sin(2 * math.pi * k / seg) * rr, z) for k in range(seg)]
        if prev:
            for k in range(seg):
                j = (k + 1) % seg
                K.oface([Vector(prev[k]), Vector(prev[j]), Vector(ring[j]), Vector(ring[k])], Vector((cx, cy, 0)), glass, GLASS)
        prev = ring
    for k in range(0, seg, 2):
        a = 2 * math.pi * k / seg
        pts = [(cx + math.cos(a) * R * math.cos(t * math.pi / 2 * 0.92), cy + math.sin(a) * R * math.cos(t * math.pi / 2 * 0.92), 7.5 + 8.0 * math.sin(t * math.pi / 2 * 0.92)) for t in [r / rings for r in range(rings + 1)]]
        for p0, p1 in zip(pts, pts[1:]):
            K.rod(p0, p1, 0.1, white, seg=3)
    K.face(prev, glass, GLASS)
    K.cyl(cx, cy, 2.0, 15.3, 17.5, white, BODY, 8)
    K.cyl(cx, cy, 2.3, 17.5, 19.0, white, BODY, 8, r1=0.2)
    K.box(-9, -8.5, -3, 3, 1, 6, white)  # link vestibules
    K.box(16.5, 17, -3, 3, 1, 5, white)
    lod0 = K.obj('conservatory_lod0')
    K1 = Kit(152)
    K1.box(-37, -9, -12, 12, -2, 4.5, glass, GLASS)
    K1.box(17, 34, -8, 8, -2, 4.0, glass, GLASS)
    K1.cyl(cx, cy, R, -2, 7.5, glass, LIT, 8)
    K1.cyl(cx, cy, R, 7.5, 15.5, glass, GLASS, 8, r1=2)
    lod1 = K1.obj('conservatory_lod1')
    res = finish('conservatory', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('conservatory', (0, 0, 5), 75, lod1, views=((25, 18),))
    return res


B['conservatory'] = conservatory


# ================================================================ NORTHPARK MALL entrance
# The mall itself stays the OSM building; this is its south entrance off the Kimberly Road lot: a tall
# glazed gable between brick towers, the lit NORTHPARK name, and a drive-up canopy. Back face at y = 0.
def northpark(render=True):
    K = Kit(161)
    brick, cream, glass, steel = lin('#a8634a'), lin('#e6dccb'), lin('#3a5566'), lin('#d0d0d0')
    w, d = 15.0, 10.0
    for x in (-w, w - 5):  # brick towers
        K.box(x, x + 5, -d, 0, -3, 14, brick)
        K.box(x - 0.2, x + 5.2, -d - 0.2, 0.2, 14, 14.8, cream)
        F = lambda u, h, dd, x=x: (x + u, -d - dd, h)
        for h in (2, 6.5, 10):
            K.quad(F, 1.5, 3.5, h, h + 2.5, 0.02, glass, GLASS)
    # glazed gable between them
    gx0, gx1 = -w + 5, w - 5
    F = lambda u, h, dd: (gx0 + u, -d + 1 - dd, h)
    Wd = gx1 - gx0
    K.face([F(0, 0, 0), F(Wd, 0, 0), F(Wd, 12, 0), F(Wd / 2, 17, 0), F(0, 12, 0)], glass, LIT)
    for k in range(9):
        u = k * Wd / 8
        top = 12 + 5 * (1 - abs(u - Wd / 2) / (Wd / 2))
        K.obox(F, u - 0.1, u + 0.1, 0, top, 0, 0.15, steel, BODY, ('d-',))
    for h in (3.5, 7, 10.5):
        K.obox(F, 0, Wd, h - 0.08, h + 0.08, 0, 0.15, steel, BODY, ('d-',))
    for sgn in (-1, 1):  # roof slopes
        K.oface([Vector((gx0 if sgn < 0 else gx1, -d + 1, 12)), Vector((0, -d + 1, 17)), Vector((0, 0, 17)), Vector((gx0 if sgn < 0 else gx1, 0, 12))], Vector((0, -d / 2, 0)), lin('#5b5f63'))
    # name over the entrance
    K.box(-11, 11, -d - 0.6, -d + 1, 14.8, 17.0, cream, BODY, ())
    K.text('NORTHPARK', lambda u, h, dd: (u, -d - 0.6 - dd, h), 0, 15.2, 0.0, 1.9, lin('#c8102e'), NEON, 0.12, bold=0.02)
    # entrance doors and drive-up canopy on columns
    K.quad(F, 3, Wd - 3, 0, 3.2, 0.05, lin('#ffe6b8'), LIT)
    K.box(-9, 9, -d - 8, -d + 1, 4.6, 5.2, cream, BODY, ())
    K.face([(-8.8, -d - 7.8, 4.59), (-8.8, -d + 0.8, 4.59), (8.8, -d + 0.8, 4.59), (8.8, -d - 7.8, 4.59)], lin('#fff1c4'), LIT)
    for x in (-8.4, 8.4):
        K.cyl(x, -d - 7.4, 0.35, -1, 4.6, cream, BODY, 8)
    lod0 = K.obj('northpark_lod0')
    K1 = Kit(162)
    K1.box(-w, w, -d, 0, -3, 14.8, brick)
    K1.quad(F, 0, Wd, 0, 12, 0.3, glass, LIT)
    K1.box(-11, 11, -d - 0.6, -d + 1, 14.8, 17.0, cream, BODY, ())
    K1.text('NORTHPARK', lambda u, h, dd: (u, -d - 0.6 - dd, h), 0, 15.2, 0.0, 1.9, lin('#c8102e'), NEON, 0.12, res=1)
    K1.box(-9, 9, -d - 8, -d + 1, 4.6, 5.2, cream, BODY, ())
    lod1 = K1.obj('northpark_lod1')
    res = finish('northpark', [lod0, lod1], None)
    if render:
        res['png'] = shots('northpark', (0, -8, 7), 55, lod1, views=((20, 10),))
    return res


B['northpark'] = northpark
