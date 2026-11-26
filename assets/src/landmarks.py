# Quad Cities landmarks: one GLB per building in assets/models/landmarks/<name>.glb, sources saved to
# assets/src/landmarks/<name>.blend (only the 'Landmarks' scene). Run in Blender:
#   exec(open(ROOT + 'assets/src/landmarks.py').read()); build('blackhawk')   (or build_all())
# or headless (safer while other people use the open Blender), with a small runner that execs this file, renames
# the default scene to LM_SCENE and calls build(name):  Blender -b --factory-startup --python runner.py -- isle tbk
# References for every model: docs/landmarks-references.md. <name>_int files are walk-in interiors (see landmarks.js).
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
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/tat.py').read(), globals())
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
    vl = bpy.context.view_layer
    for o in bpy.context.scene.objects:
        if o:
            o.select_set(False)
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
        with bpy.context.temp_override(scene=bpy.context.scene, view_layer=vl):
            bpy.ops.export_scene.gltf(**kw)
    logging.disable(logging.NOTSET)
    repack(path)
    # only this landmark's scene goes in the .blend (other agents may have their own scenes open in this Blender)
    bpy.data.libraries.write(SRC + name + '.blend', {bpy.context.scene}, fake_user=True, compress=True)
    out = {'kb': os.path.getsize(path) // 1024, 'anchor': anchor, 'tris': {o.name: tris(o) for o in objs if o.type == 'MESH'},
           'colour_ok': colour_ok(path)}
    return out


def colour_ok(path):
    """True when every mesh's COLOR_0 is present and not all white (the old Blender 5 placeholder bug)"""
    import json, struct
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]
    J = json.loads(b[20:20 + jl])
    bin0 = b[20 + jl + 8:]
    white = []
    for me in J.get('meshes', []):
        for pr in me['primitives']:
            if 'COLOR_0' not in pr['attributes']:
                return False
            a = J['accessors'][pr['attributes']['COLOR_0']]
            v = J['bufferViews'][a['bufferView']]
            d = bin0[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
            if a['componentType'] != 5121:
                return False
            white.append(all(x == 255 for x in d))
    return not all(white)  # a white sign can be all white; the whole model can't


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
        lm_preview(p, target, dist, yaw, pitch, (900, 700), 35)
        sh.color_type = 'VERTEX'
        bpy.ops.render.render(write_still=True)
        paths.append(p)
    if lod1:
        lod1.hide_render = False
    return paths


def inside_shot(name, cam, target, lens=18):
    """a render from a camera standing inside (the interior hall), workbench, vertex colours"""
    tmp = '/private/tmp/claude-501/-Users-dainmoens-Documents-Tim-Arnett-Town/392d4b1d-feae-4f8b-b8db-07c7ac05def9/scratchpad/'
    d = Vector(target) - Vector(cam)
    yaw = math.degrees(math.atan2(-d.x, d.y)) if False else 0
    lm_preview(tmp + name + '_in.png', target, 1, 0, 0, (900, 600), lens)
    c = bpy.context.scene.camera
    c.location = cam
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    c.data.clip_start = 0.05
    for o in bpy.context.scene.objects:
        if o.name.endswith('_lod1'):
            o.hide_render = True
    bpy.ops.render.render(write_still=True)
    for o in bpy.context.scene.objects:
        o.hide_render = False
    return tmp + name + '_in.png'


B = {}  # builders


def lm_preview(path, target, dist, yaw, pitch, size, lens):
    """tat.preview with this scene's own camera"""
    sc = bpy.context.scene
    cam = sc.objects.get('_lmcam')
    if cam is None:
        cam = bpy.data.objects.new('_lmcam', bpy.data.cameras.new('_lmcam'))
        sc.collection.objects.link(cam)
    cam.data.lens = lens
    cam.data.clip_end = 3000
    y, p = math.radians(yaw), math.radians(pitch)
    tx, ty, tz = target
    cam.location = (tx + math.sin(y) * math.cos(p) * dist, ty - math.cos(y) * math.cos(p) * dist, tz + math.sin(p) * dist)
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light, sh.color_type, sh.show_cavity, sh.show_backface_culling = 'STUDIO', 'VERTEX', True, True
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.render.filepath = path


LM_SCENE = 'Landmarks'  # every landmark is built in this scene only; other scenes in this Blender are left alone


def build(name, render=True):
    win = bpy.context.window
    prev = win.scene if win else None
    sc = bpy.data.scenes.get(LM_SCENE) or bpy.data.scenes.new(LM_SCENE)
    if win:
        win.scene = sc
    try:
        if bpy.context.object and bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        for o in list(sc.objects):
            if o.name != '_lmcam':
                me = o.data if o.type == 'MESH' else None
                bpy.data.objects.remove(o, do_unlink=True)
                if me and me.users == 0:
                    bpy.data.meshes.remove(me)
        if win:
            with bpy.context.temp_override(window=win, scene=sc, view_layer=sc.view_layers[0]):
                return B[name](render)
        return B[name](render)  # background Blender: the landmarks scene is the only one open
    finally:
        if win and prev:
            win.scene = prev


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


# ================================================================ QUAD CITIES (roadmap 2): shared bits
LAT0, LON0 = 41.5236, -90.5776


def game(lat, lon):
    """lat/lon -> game x/z (same projection as tools/map-config.mjs)"""
    return ((lon - LON0) * 111320 * math.cos(math.radians(LAT0)), -(lat - LAT0) * 110574)


def g2l(anchor):
    """game x/z -> Blender xy around the anchor"""
    ax, az = anchor
    return lambda x, z: (x - ax, -(z - az))


def iface(K, pts, ctr, col, m=BODY):
    """a face whose winding points toward ctr (inside walls, floors seen from above, ceilings from below)"""
    pts = [Vector(p) for p in pts]
    n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
    if n.dot(sum(pts, Vector()) / len(pts) - Vector(ctr)) > 0:
        pts = pts[::-1]
    K.face(pts, col, m)


def hall(K, x0, x1, y0, y1, z0, z1, wall, ceil, floors, doors=(), tile=3.0, dado=None, trim=None):
    """inward-facing room shell in Blender coords: a tiled floor (colours cycle through `floors`), ceiling, four
    walls with door gaps. doors: [(side, a, b, h)] with side 'n' (+y), 's' (-y), 'e' (+x), 'w' (-x) and a..b along
    that wall (x for n/s, y for e/w). dado: (height, colour) lower wall band; trim: colour of a band at the top."""
    ctr = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    nx, ny = max(1, round((x1 - x0) / tile)), max(1, round((y1 - y0) / tile))
    for i in range(nx):
        for j in range(ny):
            a, b = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
            c, d = y0 + (y1 - y0) * j / ny, y0 + (y1 - y0) * (j + 1) / ny
            iface(K, [(a, c, z0), (b, c, z0), (b, d, z0), (a, d, z0)], ctr, floors[(i + j) % len(floors)])
    iface(K, [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], ctr, ceil)
    walls = {'s': ((x0, y0), (x1, y0)), 'n': ((x0, y1), (x1, y1)), 'w': ((x0, y0), (x0, y1)), 'e': ((x1, y0), (x1, y1))}
    for side, (p, q) in walls.items():
        along = 0 if side in 'ns' else 1
        lo, hi = p[along], q[along]
        P = lambda t, z: (t, p[1], z) if along == 0 else (p[0], t, z)
        gaps = sorted((a, b, h) for s, a, b, h in doors if s == side)
        t = lo
        spans = []
        for a, b, h in gaps:
            spans.append((t, a, z0))
            iface(K, [P(a, z0 + h), P(b, z0 + h), P(b, z1), P(a, z1)], ctr, wall)  # lintel
            t = b
        spans.append((t, hi, z0))
        for a, b, _ in spans:
            if b - a < 0.01:
                continue
            zb = z0
            if dado:
                iface(K, [P(a, z0), P(b, z0), P(b, z0 + dado[0]), P(a, z0 + dado[0])], ctr, dado[1])
                zb = z0 + dado[0]
            iface(K, [P(a, zb), P(b, zb), P(b, z1), P(a, z1)], ctr, wall)
        if trim:
            iface(K, [P(lo, z1 - 0.35), P(hi, z1 - 0.35), P(hi, z1 - 0.05), P(lo, z1 - 0.05)], (ctr[0], ctr[1], z1 - 0.2), trim)


def walls_with_door(K, P, H, col, door_edge, d0, d1, dh, z0=-3, glass=None):
    """prism walls of polygon P from z0 to H, with an opening d0..d1 (along the edge, height dh) in edge door_edge"""
    for i, L, Ln, mid in sides(P):
        if i != door_edge:
            K.quad(L, 0, Ln, z0, H, 0, col)
            continue
        K.quad(L, 0, d0, z0, H, 0, col)
        K.quad(L, d1, Ln, z0, H, 0, col)
        K.quad(L, d0, d1, dh, H, 0, col)
        K.quad(L, d0, d1, z0, 0, 0, col)
        # reveal of the opening
        dk = scale(col, 0.7)
        K.face([L(d0, 0, 0), L(d0, 0, -0.6), L(d0, dh, -0.6), L(d0, dh, 0)], dk)
        K.face([L(d1, 0, 0), L(d1, dh, 0), L(d1, dh, -0.6), L(d1, 0, -0.6)], dk)
        K.face([L(d0, dh, 0), L(d0, dh, -0.6), L(d1, dh, -0.6), L(d1, dh, 0)], scale(col, 0.5))


def glaze(K, P, h0, nfl, fh, wall, bay=3.3, glass=GLASS_C, lit=0.45, wf=0.6, hf=0.6, minlen=4):
    """cheap window grid: plain wall per side plus one glass quad per window just proud of it"""
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, h0, h0 + nfl * fh, 0, wall)
        if Ln < minlen:
            continue
        nb = max(1, round((Ln - 1.2) / bay))
        bw = (Ln - 1.2) / nb
        for f in range(nfl):
            b = h0 + f * fh + fh * (1 - hf) * 0.45
            for k in range(nb):
                c = 0.6 + bw * (k + 0.5)
                on = K.rnd.random() < lit
                K.quad(L, c - bw * wf / 2, c + bw * wf / 2, b, b + fh * hf, 0.04, LIT_C if on else glass, LIT if on else GLASS)


def slot_bank(K, x, y, n, axis, col_cab, screens, rnd, facing=1):
    """a row of n slot machines along x (axis 0) or y (axis 1) facing +/- the other axis"""
    for i in range(n):
        u = i * 1.0
        if axis == 0:
            cx, cy = x + u, y
            F = lambda a, h, d, cx=cx, cy=cy: (cx + a, cy + d * facing, h)
        else:
            cx, cy = x, y + u
            F = lambda a, h, d, cx=cx, cy=cy: (cx - d * facing, cy + a, h)
        K.obox(F, -0.45, 0.45, 0, 1.9, -0.45, 0.4, col_cab, BODY, ('h-', 'd-'))
        K.quad(F, -0.35, 0.35, 1.05, 1.6, 0.41, screens[rnd.randrange(len(screens))], NEON)
        K.quad(F, -0.4, 0.4, 1.9, 2.25, 0.3, screens[(i + 1) % len(screens)], NEON)
        K.obox(F, -0.25, 0.25, 0, 0.65, 1.0, 1.4, lin('#8e1b2b'), BODY, ('h-', 'd-'))


# ================================================================ ISLE CASINO HOTEL BETTENDORF
# 1777 Isle Pkwy (land casino 2016, HBG): the OSM complex outline, a single-storey tan precast casino block with
# rooftop parking on its north strip, the 12-storey hotel tower (east), the older 8-storey cream tower on the river
# side (south) with teal pyramid caps, a green octagonal rotunda, a glass octagon dome, the curved red
# porte-cochere at the grand entrance (east), the skywalk to the parking garage and red ISLE signs.
# Interior (node isle_int): the casino floor hall behind the east doors (game x 5832..5916, z -4..38), carpet,
# dark ceiling with lit coves, slot banks and the Lone Wolf bar in the west half (the playable tables, cage and bar
# come from interiors.js in the east half).
def isle(render=True):
    anchor = (5862.0, 36.0)
    G = g2l(anchor)
    tan, tan2, cream, glass, teal = lin('#c9b79c'), lin('#b5a284'), lin('#e8dcc4'), lin('#3e6b78'), lin('#4f9a8a')
    red, dark, roofc = lin('#c8102e'), lin('#3a3a3c'), lin('#9a9894')
    H = 10.0
    out = [(5941.3, -41.6), (5959.7, -42.0), (5959.7, 16.7), (5940.9, 16.2), (5940.7, -8.5), (5934.8, -8.3), (5934.6, 12.8),
           (5923.6, 12.7), (5916.0, 14.0), (5916.0, 38.0), (5908.3, 48.6), (5902.9, 48.6), (5902.3, 113.4), (5891.8, 113.7),
           (5891.8, 109.0), (5846.4, 108.6), (5845.5, 111.3), (5826.8, 111.3), (5827.1, 87.1), (5884.2, 87.3), (5884.5, 48.6),
           (5871.8, 48.6), (5871.7, 70.0), (5805.3, 70.2), (5805.2, 97.6), (5811.1, 103.8), (5810.9, 108.8), (5806.8, 111.3),
           (5770.1, 112.1), (5765.4, 108.2), (5765.2, 103.0), (5769.4, 99.2), (5772.0, 99.2), (5771.6, -21.9), (5781.3, -29.9),
           (5928.2, -29.5), (5928.0, -18.7), (5941.1, -18.4)]
    P = ccw([G(*p) for p in out])
    door_edge = next(i for i, L, Ln, mid in sides(P) if abs(mid[0] - G(5916, 26)[0]) < 0.5 and Ln > 20)
    K = Kit(301)
    # casino block: tan precast, reveals, dark base, cornice
    walls_with_door(K, P, H, tan, door_edge, 8.0, 16.0, 4.0)
    K.prism(P, H - 0.2, H, roofc, sides=False)
    for i, L, Ln, mid in sides(P):
        if Ln < 3:
            continue
        K.obox(L, 0, Ln, H - 0.6, H + 0.6, -0.1, 0.35, tan2, BODY, ('d-',))  # cap
        K.obox(L, 0, Ln, 0, 0.9, -0.1, 0.12, scale(tan2, 0.8), BODY, ('d-', 'h-'))
        for h in (3.4, 6.8):
            K.quad(L, 0, Ln, h, h + 0.12, 0.02, tan2)
        if i != door_edge and Ln > 12 and mid[0] > G(5900, 0)[0]:  # glazing toward the entrance drive
            for k in range(int(Ln // 6)):
                u = 1 + k * 6
                K.quad(L, u, u + 4.5, 1.0, 3.2, 0.03, glass, LIT)
    # the door edge: glass doors, transom and the lit name over them
    for i, L, Ln, mid in sides(P):
        if i == door_edge:
            K.quad(L, 8.0, 16.0, 4.0, 6.6, 0.03, glass, LIT)
            K.obox(L, 5, 19, 6.8, 8.4, 0, 0.5, red, BODY, ('d-',))
            K.text('ISLE', L, 12, 7.0, 0.52, 1.3, lin('#ffffff'), NEON, 0.1, bold=0.02, res=1)
    # rooftop parking on the north strip: parapet, stripes, parked cars, light poles
    y0, y1 = G(0, -5.5)[1], G(0, -29.0)[1]
    x0, x1 = G(5773, 0)[0], G(5927, 0)[0]
    for x in (x0, x1):
        K.box(x - 0.2, x + 0.2, y0, y1, H, H + 1.1, tan2)
    for yy in (y0, y1):
        K.box(x0, x1, yy - 0.2, yy + 0.2, H, H + 1.1, tan2)
    rnd = K.rnd
    carc = [lin('#b71c1c'), lin('#eeeeee'), lin('#1f1f1f'), lin('#5d6d7e'), lin('#1e4d8c'), lin('#c0c0c0')]
    for k in range(int((x1 - x0) / 2.8)):
        x = x0 + 1.6 + k * 2.8
        K.box(x - 0.05, x + 0.05, y1 + 0.4, y1 + 5.6, H + 0.01, H + 0.02, lin('#f2f2f2'))
        K.box(x - 0.05, x + 0.05, y0 - 5.6, y0 - 0.4, H + 0.01, H + 0.02, lin('#f2f2f2'))
        for yc in (y1 + 3.0, y0 - 3.0):
            if rnd.random() < 0.55:
                c = carc[rnd.randrange(len(carc))]
                K.box(x + 0.3, x + 2.2, yc - 2.2, yc + 2.2, H, H + 0.8, c)
                K.box(x + 0.45, x + 2.05, yc - 1.2, yc + 1.0, H + 0.8, H + 1.35, scale(c, 0.85))
    for k in range(5):
        x = x0 + 15 + k * 30
        K.box(x - 0.12, x + 0.12, (y0 + y1) / 2 - 0.12, (y0 + y1) / 2 + 0.12, H, H + 7, dark)
        K.box(x - 0.6, x + 0.6, (y0 + y1) / 2 - 0.3, (y0 + y1) / 2 + 0.3, H + 7, H + 7.3, lin('#fff3d0'), LIT)
    rooftop_junk(K, *G(5850, 20), H, rnd, 10, 30)
    # tall hotel tower (east): podium (4 storeys) to z -10, 12-storey slab to z -42
    fh = 3.2
    T = ccw([G(5941.3, -41.8), G(5959.7, -41.8), G(5959.7, -10), G(5941.3, -10)])
    K.prism(T, -3, 2 * fh, cream, top=False)
    glaze(K, T, 2 * fh, 12, fh, cream, bay=3.3, glass=glass, lit=0.5, wf=0.62, hf=0.62)
    top = 14 * fh
    roof(K, T, top + 1.0, dark, par=cream, parh=1.2)
    K.prism(T, top, top + 1.0, cream, top=False)
    Pd = ccw([G(5941.3, -10), G(5959.7, -10), G(5959.7, 16.7), G(5941.3, 16.7)])
    K.prism(Pd, -3, 4 * fh, cream, top=False)
    glaze(K, Pd, fh, 3, fh, cream, bay=3.3, glass=glass, lit=0.5)
    roof(K, Pd, 4 * fh, lin('#f0f0ec'), par=cream, parh=0.8)
    for i, L, Ln, mid in sides(Pd):
        K.quad(L, 0.5, Ln - 0.5, 0.3, fh - 0.3, 0.03, glass, LIT)
    # crown: dark band and the red ISLE letters on the north and south faces
    cx = G(5950.5, 0)[0]
    for yy, s in ((G(0, -41.8)[1], 1), (G(0, -10)[1], -1)):
        F = lambda u, h, d, yy=yy, s=s: (cx - u * s, yy + d * s, h)
        K.obox(F, -9.0, 9.0, top - 5.0, top + 1.0, 0, 0.3, dark, BODY, ('d-',))
        K.text('ISLE', F, 0, top - 4.4, 0.35, 4.8, red, NEON, 0.25, bold=0.03, res=1)
    # older hotel tower (south, by the river): cream, 8 storeys, teal pyramid caps on the stair towers at the ends
    T2 = ccw([G(5827.1, 87.1), G(5891.8, 87.1), G(5891.8, 113.0), G(5827.1, 113.0)])
    K.prism(T2, -3, H, cream, top=False)
    glaze(K, T2, H, 7, fh, cream, bay=3.2, glass=glass, lit=0.45)
    t2 = H + 7 * fh
    roof(K, T2, t2, dark, par=cream, parh=1.0)
    for gx in (5823.0, 5895.5):
        sx, sy = G(gx, 92.0)
        K.box(sx - 4, sx + 4, sy - 4, sy + 4, -3, t2 + 2.5, cream)
        pyramid(K, sx, sy, 4.5, t2 + 2.5, 5.5, teal)
        F = lambda u, h, d, sx=sx, sy=sy: (sx + u, sy - 4 - d, h)
        for k in range(8):
            K.quad(F, -1.2, 1.2, 2 + k * 3.2, 4 + k * 3.2, 0.02, glass, LIT)
    sx, sy = G(5859.5, 113.0)
    F = lambda u, h, d: (sx + u, sy - d, h)
    K.obox(F, -12, 12, t2 - 3.2, t2 + 0.6, 0, 0.3, dark, BODY, ('d-',))
    K.text('ISLE CASINO HOTEL', F, 0, t2 - 2.6, 0.35, 2.0, red, NEON, 0.15, bold=0.02, res=1)
    # green octagonal rotunda by the tower and the glass octagon dome at the west end
    rx, ry = G(5920.5, -5.0)
    K.cyl(rx, ry, 7.5, -3, 13, tan, BODY, 8)
    K.cyl(rx, ry, 7.6, 13, 13.6, tan2, BODY, 8)
    K.cyl(rx, ry, 7.9, 13.6, 20, teal, BODY, 8, r1=0.4)
    for k in range(8):
        a = (k + 0.5) * math.pi / 4
        F = lambda u, h, d, a=a: (rx + math.cos(a) * (7.3 + d) - math.sin(a) * u, ry + math.sin(a) * (7.3 + d) + math.cos(a) * u, h)
        K.quad(F, -1.5, 1.5, 4, 11, 0.25, glass, LIT)
    dx_, dy_ = G(5803.0, -3.5)
    K.cyl(dx_, dy_, 8, H, H + 3, tan2, BODY, 8)
    K.cyl(dx_, dy_, 8, H + 3, H + 8, glass, LIT, 8, r1=1.5)
    # curved red porte-cochere over the entrance drive
    ccx, ccy = G(5934.0, 52.0)
    for k in range(10):
        a0, a1 = math.radians(92 + k * 9), math.radians(92 + (k + 1) * 9)
        r0, r1 = 20.0, 34.0
        pts = [(ccx + math.cos(a) * r, ccy + math.sin(a) * r) for a, r in ((a0, r0), (a1, r0), (a1, r1), (a0, r1))]
        iface(K, [(p[0], p[1], 7.4) for p in pts], (ccx, ccy, 0), lin('#fff1c4'), LIT)  # lit soffit
        iface(K, [(p[0], p[1], 8.3) for p in pts], (ccx, ccy, 50), lin('#9e1b22'))
        for r, s in ((r0, 1), (r1, -1)):
            pa, pb = (ccx + math.cos(a0) * r, ccy + math.sin(a0) * r), (ccx + math.cos(a1) * r, ccy + math.sin(a1) * r)
            K.oface([Vector((*pa, 7.4)), Vector((*pb, 7.4)), Vector((*pb, 8.3)), Vector((*pa, 8.3))], Vector((ccx, ccy, 7.8)) if s < 0 else Vector((ccx + math.cos(a0) * 60, ccy + math.sin(a0) * 60, 7.8)), red)
    for k in range(0, 11, 2):
        a = math.radians(92 + k * 9)
        for r in (21.0, 33.0):
            K.cyl(ccx + math.cos(a) * r, ccy + math.sin(a) * r, 0.45, -1, 7.4, tan2, BODY, 8)
    # skywalk to the parking garage (second level)
    sw = ccw([G(5902.6, 101.5), G(5941.0, 99.8), G(5941.0, 105.0), G(5902.6, 107.0)])
    K.prism(sw, 6.0, 10.0, tan, top=True, topcol=roofc)
    for i, L, Ln, mid in sides(sw):
        if Ln > 10:
            K.quad(L, 0.5, Ln - 0.5, 6.8, 9.4, 0.03, glass, LIT)
    # landscaping strip and the ISLE monument sign on the drive
    mx, my = G(5968.0, 40.0)
    K.box(mx - 0.6, mx + 0.6, my - 4, my + 4, -1, 1.2, tan2)
    F = lambda u, h, d: (mx + 0.6 + d, my + u, h)
    K.obox(F, -3.6, 3.6, 1.2, 4.6, -1.2, 0, red, BODY, ('d-',))
    K.text('ISLE', F, 0, 1.6, 0.05, 2.2, lin('#ffffff'), NEON, 0.1, res=1)
    F2 = lambda u, h, d: (mx - 0.6 - d, my - u, h)
    K.text('ISLE', F2, 0, 1.6, 0.05, 2.2, lin('#ffffff'), NEON, 0.1, res=1)
    lod0 = K.obj('isle_lod0')

    # ---- interior: the casino floor (game x 5832..5916, z -4..38), ceiling 4.6 m
    KI = Kit(302, ao=0)
    hx0, hy1 = G(5832, -4)
    hx1, hy0 = G(5916, 38)
    zc = 4.6
    hall(KI, hx0, hx1, hy0, hy1, 0.02, zc, lin('#3b1222'), lin('#1c1418'),
         [lin('#5a0f22'), lin('#1d2f5c'), lin('#5a0f22'), lin('#6b4a1a')], doors=[('e', G(0, 32)[1], G(0, 24)[1], 4.0)],
         tile=2.4, dado=(1.1, lin('#2a0f18')), trim=lin('#c9a23a'))
    # light coves: lit strips in the ceiling, and gold columns
    for gx in range(5840, 5912, 12):
        for gz in range(0, 38, 9):
            x, y = G(gx + 4, gz + 3)
            iface(KI, [(x - 3, y - 0.6, zc - 0.03), (x + 3, y - 0.6, zc - 0.03), (x + 3, y + 0.6, zc - 0.03), (x - 3, y + 0.6, zc - 0.03)], (x, y, 0), lin('#fff1c4'), LIT)
    for gx in (5852, 5872, 5892):
        for gz in (6, 28):
            x, y = G(gx, gz)
            KI.box(x - 0.45, x + 0.45, y - 0.45, y + 0.45, 0, zc, lin('#c9a23a'))
    # slot banks in the west half (the east half is the game's table floor)
    screens = [lin('#ff4081'), lin('#40c4ff'), lin('#ffeb3b'), lin('#69f0ae'), lin('#b388ff')]
    for gz in (4.0, 13.0, 22.0, 31.0):
        x, y = G(5838, gz)
        slot_bank(KI, x, y, 12, 0, lin('#2a1450'), screens, KI.rnd, 1)
        slot_bank(KI, x, y - 1.0, 12, 0, lin('#2a1450'), screens, KI.rnd, -1)
    # the Lone Wolf bar against the north wall
    bx0, by = G(5856, -3.6)
    BF = lambda u, h, d: (bx0 + u, by - d, h)
    KI.obox(BF, 0, 16, 0, 1.1, 2.0, 2.8, lin('#3e2418'), BODY, ('h-',))
    KI.obox(BF, -0.2, 16.2, 1.1, 1.18, 1.9, 2.95, lin('#c9a23a'), BODY, ())
    KI.obox(BF, 0, 16, 0, 2.6, 0.02, 0.5, lin('#2a1a12'), BODY, ('h-',))
    for k in range(32):
        KI.quad(BF, 0.3 + k * 0.48, 0.55 + k * 0.48, 1.5 + (k % 3) * 0.45, 1.8 + (k % 3) * 0.45, 0.52, screens[k % 5], NEON)
    KI.text('LONE WOLF', BF, 8, 3.2, 0.06, 0.8, lin('#40c4ff'), NEON, 0.05, res=1)
    # Keller's / buffet frontages on the west wall
    WF_ = lambda u, h, d: (hx0 + d, hy0 + u, h)
    KI.text("KELLER'S AMERICAN GRILL", WF_, 30, 3.2, 0.06, 0.55, lin('#ffd54f'), NEON, 0.04, res=1)
    KI.quad(WF_, 26, 34, 0.02, 2.8, 0.05, lin('#ffe1a0'), LIT)
    KI.text("FARMER'S PICK BUFFET", WF_, 12, 3.2, 0.06, 0.55, lin('#69f0ae'), NEON, 0.04, res=1)
    KI.quad(WF_, 8, 16, 0.02, 2.8, 0.05, lin('#ffe1a0'), LIT)
    intr = KI.obj('isle_int')

    K1 = Kit(303)
    K1.prism(P, -3, H, tan, topcol=roofc)
    lod1_bands(K1, T, 0, 14, fh, cream)
    lod1_bands(K1, T2, H, 7, fh, cream)
    lod1_bands(K1, Pd, 0, 4, fh, cream)
    K1.cyl(rx, ry, 7.5, -3, 13, tan, BODY, 8)
    K1.cyl(rx, ry, 7.9, 13, 20, teal, BODY, 8, r1=0.4)
    for yy, s in ((G(0, -41.8)[1], 1), (G(0, -10)[1], -1)):
        F = lambda u, h, d, yy=yy, s=s: (cx - u * s, yy + d * s, h)
        K1.text('ISLE', F, 0, top - 4.4, 0.35, 4.8, red, NEON, 0.25, res=1)
    for k in range(10):
        a0, a1 = math.radians(92 + k * 9), math.radians(92 + (k + 1) * 9)
        pts = [(ccx + math.cos(a) * r, ccy + math.sin(a) * r) for a, r in ((a0, 20), (a1, 20), (a1, 34), (a0, 34))]
        iface(K1, [(p[0], p[1], 8.3) for p in pts], (ccx, ccy, 50), lin('#9e1b22'))
    lod1 = K1.obj('isle_lod1')
    res = finish('isle', [lod0, lod1, intr], anchor)
    if render:
        res['png'] = shots('isle', (40, 0, 10), 260, lod1, views=((60, 25), (200, 30)))
        res['png'].append(inside_shot('isle', (*G(5913, 28), 1.7), (*G(5850, 15), 1.5)))
    return res


B['isle'] = isle


def lines(K, x0, x1, y0, y1, z, w, col, m=BODY):
    """rectangle outline of floor lines (w wide) seen from above"""
    for a, b, c, d in ((x0, x1, y0, y0 + w), (x0, x1, y1 - w, y1), (x0, x0 + w, y0, y1), (x1 - w, x1, y0, y1)):
        K.face([(a, c, z), (b, c, z), (b, d, z), (a, d, z)], col, m)


def room_frame(anchor, cx, cz, rot):
    """room coords (u = room x, v = room z, as interiors.js: game x = cx + u cos + v sin, z = cz - u sin + v cos)
    -> Blender xy around the anchor"""
    c, s = math.cos(rot), math.sin(rot)
    ax, az = anchor
    return lambda u, v: (cx + u * c + v * s - ax, -(cz - u * s + v * c - az))


# ================================================================ TBK BANK SPORTS COMPLEX (Bettendorf)
# 4850 Competition Dr (2019): a 179 x 121 m metal-panelled fieldhouse with a two-storey glass entrance block on its
# south side (the lobby, sports bar and fun centre), grey panels with a blue band, a clerestory of translucent
# panels and the white TBK BANK SPORTS COMPLEX lettering. Interior: the fieldhouse hall (turf field with lines in
# the west half, eight wood courts and sand courts in the east) and the lobby with the bar.
def tbk(render=True):
    anchor = (9457.0, -7690.0)
    G = g2l(anchor)
    grey, grey2, char, blue, glass = lin('#c3c8cc'), lin('#9aa1a7'), lin('#5a6168'), lin('#1f4e8c'), lin('#35566e')
    H = 14.0
    M = ccw([G(9367.4, -7751.2), G(9546.3, -7751.2), G(9546.3, -7630.1), G(9367.4, -7630.1)])
    Lb = ccw([G(9386.6, -7630.1), G(9456.8, -7630.1), G(9456.8, -7579.0), G(9386.6, -7579.0)])
    K = Kit(311)
    for P, h, door in ((M, H, None), (Lb, 9.0, 'lobby')):
        for i, L, Ln, mid in sides(P):
            if door and abs(mid[1] - G(0, -7579.0)[1]) < 0.5:  # lobby front: glass curtain wall with the doors
                K.quad(L, 0, Ln, -3, 0.6, 0, char)
                K.quad(L, 0, Ln, 8.2, h, 0, char)
                for k in range(int(Ln // 3.5)):
                    u = 0.4 + k * 3.5
                    if abs(u + 1.6 - Ln / 2) < 7.5 and k % 1 == 0 and abs(u + 1.6 - Ln / 2) < 7:
                        pass
                    K.quad(L, u, u + 3.2, 0.6, 8.0, 0.02, glass, LIT)
                    K.obox(L, u - 0.15, u + 0.05, 0.6, 8.2, 0, 0.15, char, BODY, ('d-', 'h-', 'h+'))
                continue
            K.quad(L, 0, Ln, -3, h, 0, grey if not door else char)
            K.quad(L, 0, Ln, -3, 1.2, 0.02, grey2)
            if not door:
                K.quad(L, 0, Ln, 10.4, 11.4, 0.03, blue)
                for k in range(1, int(Ln // 6)):
                    K.obox(L, k * 6 - 0.15, k * 6 + 0.15, 1.2, H, 0, 0.25, grey2, BODY, ('d-', 'h-'))
                if Ln > 100:  # clerestory of translucent panels on the long sides
                    for k in range(int(Ln // 6)):
                        K.quad(L, k * 6 + 0.5, k * 6 + 5.5, 7.6, 9.8, 0.05, lin('#d8e4ea'), LIT)
        K.prism(P, h - 0.1, h, lin('#e4e6e8') if not door else char, sides=False)
        for i, L, Ln, mid in sides(P):
            K.obox(L, -0.2, Ln + 0.2, h - 0.5, h + 0.5, -0.1, 0.25, char if door else grey2, BODY, ('d-',))
    # entrance canopy and the doors
    cx = G(9421.7, 0)[0]
    fy = G(0, -7579.0)[1]
    F = lambda u, h, d: (cx + u, fy - d, h)
    K.obox(F, -9, 9, 4.0, 4.6, 0, 5.0, char, BODY, ('d-',))
    iface(K, [F(-8.8, 3.99, 0.1), F(8.8, 3.99, 0.1), F(8.8, 3.99, 4.9), F(-8.8, 3.99, 4.9)], (cx, fy - 2, 0), lin('#fff1c4'), LIT)
    K.quad(F, -4, 4, 0, 3.2, 0.05, lin('#ffe8b0'), LIT)
    K.text('TBK BANK SPORTS COMPLEX', F, 0, 5.0, 0.08, 1.1, lin('#ffffff'), NEON, 0.1, res=1)
    # the name on the fieldhouse above the lobby, and on the north side toward the lots
    F2 = lambda u, h, d: (cx + u, G(0, -7630.1)[1] - d, h)
    K.text('TBK BANK SPORTS COMPLEX', F2, 0, 11.6, 0.1, 1.8, lin('#ffffff'), NEON, 0.12, res=1)
    nx = G(9456.8, 0)[0]
    F3 = lambda u, h, d: (nx - u, G(0, -7751.2)[1] + d, h)
    K.text('TBK BANK SPORTS COMPLEX', F3, 0, 11.6, 0.1, 2.6, lin('#ffffff'), NEON, 0.12, res=1)
    rooftop_junk(K, *G(9457, -7690), H, K.rnd, 12, 70)
    lod0 = K.obj('tbk_lod0')

    # ---- interior: the fieldhouse (x 9369..9544, z -7749..-7630.6) and the lobby (x 9388..9455, z -7630.6..-7580.5)
    KI = Kit(312, ao=0)
    hx0, hy1 = G(9369, -7749)
    hx1, hy0 = G(9544, -7630.6)
    hall(KI, hx0, hx1, hy0, hy1, 0.02, 12.5, lin('#e2e4e6'), lin('#8a9096'), [lin('#9aa0a4')],
         doors=[('s', G(9410, 0)[0], G(9426, 0)[0], 4.0)], tile=30, dado=(2.5, lin('#1f4e8c')))
    turf, white = lin('#3f8f3a'), lin('#f4f4f4')
    # turf field: west half with a soccer layout
    fx0, fx1, fy0, fy1 = hx0 + 3, hx0 + 88, hy0 + 4, hy1 - 4
    KI.face([(fx0, fy0, 0.04), (fx1, fy0, 0.04), (fx1, fy1, 0.04), (fx0, fy1, 0.04)], turf)
    lines(KI, fx0 + 3, fx1 - 3, fy0 + 3, fy1 - 3, 0.06, 0.15, white)
    mx = (fx0 + fx1) / 2
    KI.face([(mx - 0.08, fy0 + 3, 0.06), (mx + 0.08, fy0 + 3, 0.06), (mx + 0.08, fy1 - 3, 0.06), (mx - 0.08, fy1 - 3, 0.06)], white)
    cy = (fy0 + fy1) / 2
    for k in range(16):
        a0, a1 = k * math.pi / 8, (k + 1) * math.pi / 8
        for r0 in (9.0,):
            KI.face([(mx + math.cos(a0) * r0, cy + math.sin(a0) * r0, 0.06), (mx + math.cos(a0) * (r0 + .15), cy + math.sin(a0) * (r0 + .15), 0.06),
                     (mx + math.cos(a1) * (r0 + .15), cy + math.sin(a1) * (r0 + .15), 0.06), (mx + math.cos(a1) * r0, cy + math.sin(a1) * r0, 0.06)][::-1], white)
    for gx, s in ((fx0 + 3, 1), (fx1 - 3, -1)):
        lines(KI, min(gx, gx + s * 16), max(gx, gx + s * 16), cy - 20, cy + 20, 0.06, 0.15, white)
        KI.box(min(gx, gx - s * 1.5), max(gx, gx - s * 1.5), cy - 3.7, cy + 3.7, 0, 0.1, white)
        for yy in (cy - 3.7, cy + 3.7):
            KI.box(gx - s * 1.5 - 0.06, gx - s * 1.5 + 0.06, yy - 0.06, yy + 0.06, 0, 2.4, white)
        KI.box(gx - s * 1.5 - 0.06, gx - s * 1.5 + 0.06, cy - 3.7, cy + 3.7, 2.34, 2.46, white)
    # netting divider between field and courts
    for s in (0, 1):
        iface(KI, [(fx1 + 1, hy0, 0), (fx1 + 1, hy1, 0), (fx1 + 1, hy1, 9), (fx1 + 1, hy0, 9)], (fx1 + 1 + (1 if s else -1), cy, 4), lin('#2b2f33'))
    # eight wood courts (2 x 4) and four sand courts in the east half
    wood, wl = lin('#c8a06a'), lin('#1f4e8c')
    for i in range(4):
        for j in range(2):
            x0 = fx1 + 4 + i * 17.5
            y0 = hy0 + 6 + j * 30
            KI.face([(x0, y0, 0.04), (x0 + 16, y0, 0.04), (x0 + 16, y0 + 28, 0.04), (x0, y0 + 28, 0.04)], wood)
            lines(KI, x0 + 0.5, x0 + 15.5, y0 + 0.5, y0 + 27.5, 0.06, 0.08, wl)
            KI.face([(x0 + 0.5, y0 + 13.96, 0.06), (x0 + 15.5, y0 + 13.96, 0.06), (x0 + 15.5, y0 + 14.04, 0.06), (x0 + 0.5, y0 + 14.04, 0.06)], wl)
            for yy, s in ((y0 + 1.2, 1), (y0 + 26.8, -1)):  # hoops
                KI.box(x0 + 7.9, x0 + 8.1, yy - s * 0.6 - 0.1, yy - s * 0.6 + 0.1, 0, 3.4, lin('#333333'))
                KI.box(x0 + 7.1, x0 + 8.9, yy - 0.03, yy + 0.03, 3.0, 4.1, lin('#f4f4f4'))
                KI.box(x0 + 7.75, x0 + 8.25, yy + s * 0.2, yy + s * 0.7, 3.04, 3.08, lin('#ff6d00'))
    sx0 = fx1 + 4 + 4 * 17.5 + 2
    for j in range(4):
        y0 = hy0 + 4 + j * 15
        KI.face([(sx0, y0, 0.05), (hx1 - 2, y0, 0.05), (hx1 - 2, y0 + 13, 0.05), (sx0, y0 + 13, 0.05)], lin('#d9c48f'))
        KI.box((sx0 + hx1) / 2 - 1 - 0.05, (sx0 + hx1) / 2 - 1 + 0.05, y0 + 0.5, y0 + 12.5, 1.6, 2.4, lin('#f4f4f4'))
    # ceiling lights
    for i in range(10):
        for j in range(5):
            x = hx0 + 9 + i * 17.5
            y = hy0 + 12 + j * 24
            iface(KI, [(x - 2, y - 0.4, 12.45), (x + 2, y - 0.4, 12.45), (x + 2, y + 0.4, 12.45), (x - 2, y + 0.4, 12.45)], (x, y, 0), lin('#ffffff'), LIT)
    # lobby: terrazzo, reception desk, the sports bar along the east wall with screens
    lx0, ly1 = G(9388, -7630.6)
    lx1, ly0 = G(9455, -7580.5)
    hall(KI, lx0, lx1, ly0, ly1, 0.02, 7.6, lin('#e8e6e1'), lin('#4a5056'), [lin('#c9c6bf'), lin('#b7b3ab')],
         doors=[('s', G(9414, 0)[0], G(9429, 0)[0], 3.2), ('n', G(9410, 0)[0], G(9426, 0)[0], 4.0)], tile=3.0, dado=(1.0, lin('#1f4e8c')))
    dx, dy = G(9421.7, -7598)
    KI.box(dx - 4, dx + 4, dy - 0.5, dy + 0.5, 0, 1.1, lin('#1f4e8c'))
    KI.box(dx - 4.1, dx + 4.1, dy - 0.6, dy + 0.6, 1.1, 1.18, lin('#e8e6e1'))
    KI.text('WELCOME', lambda u, h, d: (dx + u, dy - 0.5 - d, h), 0, 0.4, 0.02, 0.4, lin('#ffffff'), NEON, 0.02, res=1)
    bx = lx1 - 3.0
    KI.box(bx - 0.5, bx + 0.5, ly0 + 8, ly0 + 30, 0, 1.1, lin('#3e2418'))
    KI.box(bx - 0.6, bx + 0.6, ly0 + 7.9, ly0 + 30.1, 1.1, 1.18, lin('#2b2b2b'))
    KI.box(lx1 - 0.5, lx1 - 0.1, ly0 + 8, ly0 + 30, 0, 2.4, lin('#2a1a12'))
    for k in range(5):
        y = ly0 + 9 + k * 4.4
        KI.box(lx1 - 0.25, lx1 - 0.1, y, y + 3.2, 3.0, 4.8, lin('#111111'))
        KI.quad(lambda u, h, d: (lx1 - 0.25 - d, y + u, h), 0.15, 3.05, 3.1, 4.7, 0.01, [lin('#2e7d32'), lin('#1565c0'), lin('#c62828')][k % 3], NEON)
    KI.text('SPORTS BAR', lambda u, h, d: (lx1 - 0.12 - d, ly0 + 19 + u, h), 0, 5.4, 0.0, 0.9, lin('#40c4ff'), NEON, 0.05, res=1)
    for k in range(6):
        tx, ty = lx0 + 8 + (k % 3) * 8, ly0 + 10 + (k // 3) * 10
        KI.cyl(tx, ty, 0.9, 0.72, 0.78, lin('#2b2b2b'), BODY, 8)
        KI.cyl(tx, ty, 0.08, 0, 0.72, lin('#2b2b2b'), BODY, 4, top=False)
    intr = KI.obj('tbk_int')

    K1 = Kit(313)
    for P, h in ((M, H), (Lb, 9.0)):
        K1.prism(P, -3, h, grey if h == H else char, topcol=lin('#e4e6e8'))
    for i, L, Ln, mid in sides(M):
        K1.quad(L, 0, Ln, 10.4, 11.4, 0.03, blue)
    K1.text('TBK BANK SPORTS COMPLEX', F3, 0, 11.6, 0.1, 2.6, lin('#ffffff'), NEON, 0.12, res=1)
    lod1 = K1.obj('tbk_lod1')
    res = finish('tbk', [lod0, lod1, intr], anchor)
    if render:
        res['png'] = shots('tbk', (0, 0, 5), 260, lod1, views=((20, 25), (200, 30)))
        res['png'].append(inside_shot('tbk', (*G(9418, -7633), 1.7), (*G(9380, -7700), 1.0)))
    return res


B['tbk'] = tbk


# ================================================================ BUFFALO BILL MUSEUM + LONE STAR (Le Claire)
def lonestar(K, P):
    """the 1868 sternwheel towboat Lone Star in a frame P(u, v, h): u across (beam 7.5), v along (bow at -v), h up
    from the waterline; hull 27.4 m, wheel at the stern (+v)"""
    white, red, black, wood = lin('#f2f0e8'), lin('#9e2a2b'), lin('#1d1d1d'), lin('#6b4a2b')
    F = lambda u, h, d: P(u, d, h)  # frame for obox: u across, h up, d along
    hull = [(-3.75, 12.2), (3.75, 12.2), (3.75, -10.5), (2.6, -13.2), (-2.6, -13.2), (-3.75, -10.5)]
    pts = [P(u, v, 0) for u, v in hull]
    n = len(pts)
    for i in range(n):  # hull sides and deck
        a, b = hull[i], hull[(i + 1) % n]
        K.oface([Vector(P(*a, -1.2)), Vector(P(*b, -1.2)), Vector(P(*b, 1.0)), Vector(P(*a, 1.0))], Vector(P(0, 0, 0)), lin('#4a3a2c'))
    iface(K, [P(u, v, 1.0) for u, v in hull], P(0, 0, 9), wood)
    # main deck cabin (boilers and engines), Texas deck cabin, pilot house
    K.obox(F, -3.3, 3.3, 1.0, 3.6, -9.5, 11.0, white, BODY, ('h-',))
    K.obox(F, -3.8, 3.8, 3.6, 3.8, -11.5, 12.0, white, BODY, ())
    for v in range(-8, 11, 2):
        K.quad(lambda u, h, d, v=v: P(3.3 + d, v + u, h), -0.5, 0.5, 1.8, 3.0, 0.02, lin('#2b3a46'), GLASS)
        K.quad(lambda u, h, d, v=v: P(-3.3 - d, v - u, h), -0.5, 0.5, 1.8, 3.0, 0.02, lin('#2b3a46'), GLASS)
    K.obox(F, -2.4, 2.4, 3.8, 6.0, -6.5, 4.0, white, BODY, ('h-',))
    K.obox(F, -2.7, 2.7, 6.0, 6.2, -7.0, 4.5, white, BODY, ())
    K.obox(F, -1.4, 1.4, 6.2, 8.3, -6.0, -3.2, white, BODY, ('h-',))
    K.obox(F, -1.7, 1.7, 8.3, 8.5, -6.3, -2.9, red, BODY, ())
    for u in (-1.41, 1.41):
        K.quad(lambda a, h, d, u=u: P(u + (d if u > 0 else -d), -4.6 + (a if u > 0 else -a), h), -1.2, 1.2, 7.0, 7.9, 0.01, lin('#2b3a46'), GLASS)
    for u in (-1.6, 1.6):  # tall black stacks forward of the pilot house
        cx, cy, _ = P(u, -8.4, 0)
        K.cyl(cx, cy, 0.35, 3.8, 13.0, black, BODY, 8)
        K.cyl(cx, cy, 0.5, 13.0, 13.4, black, BODY, 8)
    # stern paddlewheel
    for u in (-3.2, 3.2):
        K.obox(F, u - 0.12, u + 0.12, 0.2, 3.8, 12.0, 15.6, wood, BODY, ())
    for k in range(10):
        a = k * math.pi / 5
        v, h = 13.8 + math.cos(a) * 2.2, 1.9 + math.sin(a) * 2.2
        K.obox(F, -3.0, 3.0, h - 0.1, h + 0.1, v - 0.35, v + 0.35, red, BODY, ())
    K.obox(F, -3.1, 3.1, 1.75, 2.05, 13.6, 14.0, black, BODY, ())
    K.text('LONE STAR', lambda u, h, d: P(-3.81 - d, -u, h), 0, 2.2, 0.0, 0.7, black, BODY, 0.04, res=1)
    K.text('LONE STAR', lambda u, h, d: P(3.81 + d, u, h), 0, 2.2, 0.0, 0.7, black, BODY, 0.04, res=1)


# 199 N Front St (1971, additions 2001 and the 2008 River Pilots annex): a long low tan building on the levee with
# the Lone Star towboat in its glass-walled annex at the north end. Entrance from Front St (west).
# Interior: the exhibit hall (cases, a bison, Cody's saddle and wagon display) and the annex around the boat.
def buffalobill(render=True):
    anchor = (19588.0, -8275.0)
    G = g2l(anchor)
    tan, trim, roofc, dark, glass = lin('#d9cdb4'), lin('#7a4a2a'), lin('#8f8a80'), lin('#2e3338'), lin('#3a5566')
    A, Bp, C, D_, E, F_, Gp, Hp, I, J, Kp, L_ = [G(*p) for p in [(19577.1, -8234.0), (19591.0, -8232.5), (19596.1, -8277.3), (19596.7, -8277.2), (19598.8, -8295.6), (19598.4, -8295.6), (19600.4, -8313.8), (19586.3, -8315.4), (19584.2, -8297.0), (19578.3, -8297.6), (19576.5, -8281.6), (19582.3, -8281.0)]]
    mus = ccw([A, Bp, C, L_])
    anx = ccw([L_, C, D_, E, F_, Gp, Hp, I, J, Kp])
    rot = -0.11
    RM = room_frame(anchor, 19587.0, -8257.0, rot)  # museum hall frame
    RA = room_frame(anchor, 19590.5, -8297.0, rot)  # annex hall frame
    K = Kit(321)
    door_i = next(i for i, L, Ln, mid in sides(mus) if mid[0] < -6 and Ln > 30)
    walls_with_door(K, mus, 6.5, tan, door_i, 22.0, 26.0, 3.0)
    K.prism(mus, 6.3, 6.5, roofc, sides=False)
    for i, L, Ln, mid in sides(mus):
        K.obox(L, -0.2, Ln + 0.2, 6.2, 7.0, -0.1, 0.3, trim, BODY, ('d-',))
        K.quad(L, 0, Ln, -3, 0.6, 0.02, lin('#9a8f7c'))
        if i == door_i:
            K.obox(L, 20.5, 27.5, 3.2, 3.6, 0, 2.5, trim, BODY, ('d-',))
            K.text('BUFFALO BILL MUSEUM', L, 24, 4.2, 0.05, 0.9, lin('#7a1f1f'), NEON, 0.06, res=1)
            for u in (6, 11, 32, 37):
                K.quad(L, u, u + 2.5, 1.0, 2.6, 0.03, glass, LIT)
    rooftop_junk(K, *RM(0, 0), 6.5, K.rnd, 3, 4)
    # annex: dark steel frame, glass walls, dark roof
    for i, L, Ln, mid in sides(anx):
        K.quad(L, 0, Ln, -3, 1.0, 0, dark)
        K.quad(L, 0, Ln, 1.0, 9.0, 0, glass, LIT)
        K.quad(L, 0, Ln, 9.0, 10.5, 0, dark)
        for k in range(int(Ln // 3) + 1):
            u = min(Ln, k * 3.0)
            K.obox(L, u - 0.12, u + 0.12, 1.0, 9.0, 0, 0.2, dark, BODY, ('d-', 'h-', 'h+'))
    K.prism(anx, 10.3, 10.5, lin('#24282c'), sides=False)
    for i, L, Ln, mid in sides(anx):
        K.obox(L, -0.3, Ln + 0.3, 10.3, 10.9, -0.1, 0.5, dark, BODY, ('d-',))
    # sign post by the Front St doors
    sx, sy = RM(-11.5, 2)
    K.box(sx - 0.1, sx + 0.1, sy - 2, sy + 2, 0, 2.6, trim)
    lod0 = K.obj('buffalobill_lod0')

    KI = Kit(322, ao=0)
    # museum hall: room coords u -6.3..6.3, v -20.5..20.5 (north = -v); door west (u-), to the annex north
    W_ = lambda u, v, h: (*RM(u, v), h)
    ctr = W_(0, 0, 2.5)
    def rq(Rf, pts, col, m=BODY, c=None):
        iface(KI, [(*Rf(u, v), h) for u, v, h in pts], c or (*Rf(0, 0), 2.5), col, m)
    def rhall(Rf, w, d, hgt, wall, ceil, floors, doors, tile=2.0, dado=None):
        """hall() in a rotated room frame: doors [(side, a, b, h)] on 'w' (u-), 'e' (u+), 'n' (v-), 's' (v+)"""
        u0, u1, v0, v1 = -w / 2, w / 2, -d / 2, d / 2
        c = (*Rf(0, 0), hgt / 2)
        nu, nv = max(1, round(w / tile)), max(1, round(d / tile))
        for i in range(nu):
            for j in range(nv):
                a, b = u0 + w * i / nu, u0 + w * (i + 1) / nu
                e, f = v0 + d * j / nv, v0 + d * (j + 1) / nv
                rq(Rf, [(a, e, 0.02), (b, e, 0.02), (b, f, 0.02), (a, f, 0.02)], floors[(i + j) % len(floors)], c=c)
        rq(Rf, [(u0, v0, hgt), (u1, v0, hgt), (u1, v1, hgt), (u0, v1, hgt)], ceil, c=c)
        for side, p, q in (('n', (u0, v0), (u1, v0)), ('s', (u0, v1), (u1, v1)), ('w', (u0, v0), (u0, v1)), ('e', (u1, v0), (u1, v1))):
            al = 0 if side in 'ns' else 1
            Pt = (lambda t, p=p: (t, p[1])) if al == 0 else (lambda t, p=p: (p[0], t))
            t = p[al]
            segs = []
            for s_, a, b, hh in sorted([x for x in doors if x[0] == side], key=lambda x: x[1]):
                segs.append((t, a))
                rq(Rf, [(*Pt(a), hh), (*Pt(b), hh), (*Pt(b), hgt), (*Pt(a), hgt)], wall, c=c)
                t = b
            segs.append((t, q[al]))
            for a, b in segs:
                if dado:
                    rq(Rf, [(*Pt(a), 0), (*Pt(b), 0), (*Pt(b), dado[0]), (*Pt(a), dado[0])], dado[1], c=c)
                rq(Rf, [(*Pt(a), dado[0] if dado else 0), (*Pt(b), dado[0] if dado else 0), (*Pt(b), hgt), (*Pt(a), hgt)], wall, c=c)
    rhall(RM, 12.6, 41.0, 4.2, lin('#e9e1cf'), lin('#d8d2c4'), [lin('#7a5a3a'), lin('#71533a')], [('w', -1.5, 2.5, 3.0), ('n', -3.0, 3.0, 3.2)], tile=2.0, dado=(1.0, lin('#5a3e28')))
    # exhibit cases along the walls and a bison and a covered wagon in the middle
    for v in range(-17, 18, 5):
        for u, s in ((-5.6, 1), (5.6, -1)):
            if u < 0 and -3 < v < 4:
                continue
            x0, x1 = (u, u + 1.0) if s > 0 else (u - 1.0, u)
            KI.obox(lambda a, h, d, v=v: (*RM(a, v + d), h), x0, x1, 0, 0.9, -1.6, 1.6, lin('#5a3e28'), BODY, ('h-',))
            KI.obox(lambda a, h, d, v=v: (*RM(a, v + d), h), x0, x1, 0.9, 2.0, -1.6, 1.6, lin('#cfe3ea'), LIT, ('h-',))
            KI.obox(lambda a, h, d, v=v: (*RM(a, v + d), h), x0 + 0.3, x1 - 0.3, 0.9, 1.4, -0.4, 0.4, [lin('#8d6e63'), lin('#b0a080'), lin('#6d4c41')][v % 3], BODY, ('h-',))
    BF = lambda a, h, d: (*RM(a, -8 + d), h)  # bison
    KI.obox(BF, -0.6, 0.6, 0.7, 1.9, -1.4, 1.0, lin('#4a3222'), BODY, ('h-',))
    KI.obox(BF, -0.7, 0.7, 1.0, 2.2, -1.5, -0.3, lin('#3a2618'), BODY, ('h-',))
    KI.obox(BF, -0.3, 0.3, 0.8, 1.6, -2.1, -1.4, lin('#2e1e14'), BODY, ('h-',))
    for a, d in ((-0.4, -1.0), (0.4, -1.0), (-0.4, 0.7), (0.4, 0.7)):
        KI.obox(BF, a - 0.1, a + 0.1, 0, 0.8, d - 0.1, d + 0.1, lin('#2e1e14'), BODY, ('h-',))
    KI.obox(BF, -1.2, 1.2, 0, 0.3, -2.6, 1.6, lin('#a0855c'), BODY, ('h-',))
    WG = lambda a, h, d: (*RM(a, 8 + d), h)  # covered wagon
    KI.obox(WG, -0.8, 0.8, 0.6, 1.3, -2.0, 2.0, lin('#6b4a2b'), BODY, ('h-',))
    for k in range(6):
        a0, a1 = math.pi * k / 6, math.pi * (k + 1) / 6
        KI.obox(lambda a, h, d: (*RM(a, 8 + d), h), -0.01, 0.01, 0, 0, -1.9, 1.9, lin('#efe6d2'), BODY, ())
        p = lambda t, s: (math.cos(t) * 0.95, 1.3 + math.sin(t) * 1.1, s)
        for s0, s1 in ((-1.9, 1.9),):
            pa, pb = p(a0, 0), p(a1, 0)
            iface(KI, [(*RM(pa[0], 8 + s0), pa[1]), (*RM(pb[0], 8 + s0), pb[1]), (*RM(pb[0], 8 + s1), pb[1]), (*RM(pa[0], 8 + s1), pa[1])], (*RM(0, 8), 0.5), lin('#efe6d2'))
    for d in (-1.5, 1.5):
        for a in (-0.85, 0.85):
            cx, cy = RM(a, 8 + d)
            KI.cyl(cx, cy, 0.45, 0.0, 0.08, lin('#3a2618'), BODY, 8)
    KI.text('BUFFALO BILL CODY 1846-1917', lambda u, h, d: (*RM(6.25 - d, -u), h), 0, 2.6, 0.0, 0.45, lin('#7a1f1f'), BODY, 0.02, res=1)
    # annex hall around the Lone Star: room coords u -7..7, v -17..17, door south (to the museum)
    rhall(RA, 14.0, 34.0, 9.5, lin('#3a4048'), lin('#2a2e33'), [lin('#9a958c'), lin('#8e8a82')], [('s', -3.0, 3.0, 3.2)], tile=4.0)
    for v in range(-16, 17, 4):  # glass wall panels seen from inside
        for u, s in ((-6.95, 1), (6.95, -1)):
            rq(RA, [(u, v - 1.8, 1.0), (u, v + 1.8, 1.0), (u, v + 1.8, 8.8), (u, v - 1.8, 8.8)], lin('#9fc6d8'), LIT, c=(*RA(0, v), 4))
    lonestar(KI, lambda u, v, h: (*RA(u * 0.95, v * 0.98 - 1.0), h + 0.9))
    intr = KI.obj('buffalobill_int')

    K1 = Kit(323)
    K1.prism(mus, -3, 6.8, tan, topcol=roofc)
    K1.prism(anx, -3, 10.5, glass, topcol=lin('#24282c'))
    lod1 = K1.obj('buffalobill_lod1')
    res = finish('buffalobill', [lod0, lod1, intr], anchor)
    if render:
        res['png'] = shots('buffalobill', (0, -15, 3), 90, lod1, views=((-120, 22), (60, 30)))
        res['png'].append(inside_shot('buffalobill', (*RA(-5.5, 15), 2.0), (*RA(1, -5), 4.0)))
    return res


B['buffalobill'] = buffalobill


# ================================================================ ANTIQUE ARCHAEOLOGY (Le Claire)
# 115 Davenport St, behind the gas station off Cody Rd: the American Pickers shop, a plain two-storey former
# fabrication shop painted blue, front (door, shop windows, the hand-painted name) on Davenport St (north),
# rusty signs on the walls, an old truck and the Nash out front. Interior: the shop floor, packed.
def antique(render=True):
    anchor = (19429.0, -7973.5)
    G = g2l(anchor)
    blue, white, roofc, rust = lin('#3d5f8a'), lin('#eeeeea'), lin('#4a4a4a'), lin('#8a4b2a')
    P = ccw([G(19424.2, -7980.8), G(19433.6, -7980.8), G(19433.6, -7966.2), G(19424.2, -7966.2)])
    K = Kit(331)
    front = next(i for i, L, Ln, mid in sides(P) if mid[1] < -6)  # Davenport St is south of the shop
    walls_with_door(K, P, 7.4, blue, front, 3.6, 5.6, 2.6)
    K.prism(P, 7.2, 7.4, roofc, sides=False)
    for i, L, Ln, mid in sides(P):
        K.obox(L, -0.15, Ln + 0.15, 7.2, 7.7, -0.05, 0.2, white, BODY, ('d-',))
        K.obox(L, -0.1, 0.1, -3, 7.2, -0.05, 0.12, white, BODY, ('d-', 'h-'))
        K.quad(L, 0, Ln, 3.4, 3.55, 0.02, white)
        for u in [x for x in (1.5, Ln - 3.0) if x > 0] + ([] if i == front else [Ln / 2 - 0.8]):
            K.quad(L, u, u + 1.5, 4.4, 6.2, 0.03, lin('#2b3a46'), GLASS)
        if i == front:
            K.quad(L, 0.6, 3.2, 0.6, 2.6, 0.03, lin('#ffe1a0'), LIT)
            K.quad(L, 6.0, 8.8, 0.6, 2.6, 0.03, lin('#ffe1a0'), LIT)
            K.obox(L, 0.3, Ln - 0.3, 3.7, 4.3, 0, 0.12, white, BODY, ('d-',))
            K.text('ANTIQUE ARCHAEOLOGY', L, Ln / 2, 3.8, 0.13, 0.42, lin('#1d1d1d'), BODY, 0.03, res=1)
        else:  # old metal signs on the side walls
            for k in range(int(Ln // 3)):
                c = [lin('#b71c1c'), lin('#f9a825'), lin('#2e7d32'), lin('#e0e0e0')][(k + i) % 4]
                K.quad(L, 0.8 + k * 3, 2.4 + k * 3, 1.0 + (k % 2) * 0.6, 2.0 + (k % 2) * 0.6, 0.04, c)
    # the rusty old truck and the Nash out front (north, on the lot by Davenport St)
    def car(cx, cy, col, L=4.8, W=1.9, cab=(-0.6, 1.2), truck=False):
        K.box(cx - L / 2, cx + L / 2, cy - W / 2, cy + W / 2, 0.45, 1.15, col)
        K.box(cx + cab[0], cx + cab[1], cy - W / 2 + 0.15, cy + W / 2 - 0.15, 1.15, 1.75, scale(col, 0.9))
        for wx in (cx - L / 2 + 0.8, cx + L / 2 - 0.8):
            for wy in (cy - W / 2, cy + W / 2):
                K.cyl(wx, wy, 0.38, 0.0, 0.0, lin('#151515'), BODY, 6)
                K.box(wx - 0.35, wx + 0.35, wy - 0.12, wy + 0.12, 0.05, 0.75, lin('#151515'))
        if truck:
            K.box(cx - L / 2, cx + cab[0] - 0.1, cy - W / 2, cy + W / 2, 1.15, 1.45, scale(col, 0.8))
    fx, fy = G(19420.0, -7962.0)
    car(fx, fy, rust, 5.2, 2.0, (0.0, 1.6), truck=True)
    nx, ny = G(19437.0, -7961.0)
    car(nx, ny, lin('#5f7f73'), 4.9, 1.85, (-0.9, 1.0))
    lod0 = K.obj('antique_lod0')

    KI = Kit(332, ao=0)
    x0, y1 = G(19424.6, -7980.4)  # y1: the back (north) wall, y0: the front (south, Davenport St)
    x1, y0 = G(19433.2, -7966.6)
    hall(KI, x0, x1, y0, y1, 0.02, 3.4, lin('#d8d0c0'), lin('#6b5a48'), [lin('#8a7a66'), lin('#7f705e')],
         doors=[('s', G(19427.6, 0)[0], G(19429.6, 0)[0], 2.6)], tile=1.5)
    rnd = KI.rnd
    cols = [lin('#b71c1c'), lin('#f9a825'), lin('#2e7d32'), lin('#1565c0'), lin('#8a4b2a'), lin('#e0e0e0')]
    for k in range(6):  # wall signs
        KI.box(x0 + 0.05, x0 + 0.12, y0 + 1 + k * 2.1, y0 + 2.6 + k * 2.1, 1.6, 2.6, cols[k % 6])
        KI.box(x1 - 0.12, x1 - 0.05, y0 + 1 + k * 2.1, y0 + 2.6 + k * 2.1, 1.4 + (k % 2) * 0.5, 2.3 + (k % 2) * 0.5, cols[(k + 3) % 6])
    for k in range(3):  # merch tables and an old motorcycle
        cx, cy = x0 + 2.2 + (k % 2) * 4.2, y0 + 3.5 + k * 3.2
        KI.box(cx - 0.9, cx + 0.9, cy - 0.6, cy + 0.6, 0, 0.8, lin('#6b4a2b'))
        for j in range(4):
            KI.box(cx - 0.8 + j * 0.42, cx - 0.45 + j * 0.42, cy - 0.4, cy + 0.4, 0.8, 0.95, cols[(j + k) % 6])
    mx, my = x1 - 1.4, y0 + 4
    KI.box(mx - 0.15, mx + 0.15, my - 1.0, my + 1.0, 0.3, 0.75, lin('#1d1d1d'))
    for d in (-0.75, 0.75):
        KI.cyl(mx, my + d, 0.33, 0, 0, lin('#151515'), BODY, 6)
        KI.box(mx - 0.06, mx + 0.06, my + d - 0.33, my + d + 0.33, 0.0, 0.66, lin('#151515'))
    cx, cy = (x0 + x1) / 2 + 1.5, y1 - 1.5  # the counter at the back
    KI.box(cx - 2, cx + 2, cy - 0.45, cy + 0.45, 0, 1.0, lin('#3e2418'))
    intr = KI.obj('antique_int')

    K1 = Kit(333)
    K1.prism(P, -3, 7.4, blue, topcol=roofc)
    lod1 = K1.obj('antique_lod1')
    res = finish('antique', [lod0, lod1, intr], anchor)
    if render:
        res['png'] = shots('antique', (0, -4, 3), 40, lod1, views=((-20, 15),))
        res['png'].append(inside_shot('antique', (*G(19428.6, -7967.5), 1.7), (*G(19429, -7978), 1.0)))
    return res


B['antique'] = antique


# ================================================================ I-74 BRIDGE: the twin basket-handle arches (2021)
# One file for both main-span arches. Origin: midway between the two carriageways at the middle of the 242 m main
# span, at deck level; Blender -Y = game direction of travel southbound (the game turns it to the bridge heading).
# Each carriageway (22 m deck, centres 36.6 m apart) has two white box ribs springing from the river piers 14 m below
# the deck, leaning in to meet 50 m above the deck under two crown struts and two intermediate struts, with strand
# hangers to the deck edges. LED floodlights wash the ribs from below: their undersides glow blue at night.
# (The decks themselves are the OSM roads.)
def i74(render=True):
    white, blue, steel, conc = lin('#f1f2f0'), lin('#5b8cff'), lin('#8e959b'), lin('#b9b6ae')
    half, S, zs, rise = 121.0, 0.0, -14.0, 64.0

    def rib_pts(c, side, n):
        """points along one rib: c = carriageway centre x, side = -1/+1"""
        out = []
        for k in range(n + 1):
            y = -half + 2 * half * k / n
            z = zs + rise * (1 - (y / half) ** 2)
            t = (z - zs) / rise
            out.append(Vector((c + side * (12.0 - 10.2 * t), y, z)))
        return out

    def rib(K, pts, w, h, glow=True):
        secs = []
        for i, p in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
            t = (b - a).normalized()
            s = Vector((1, 0, 0))
            s = (s - t * s.dot(t)).normalized()
            n = t.cross(s).normalized()
            if n.z < 0:
                n = -n
            secs.append([p + s * w / 2 + n * h / 2, p - s * w / 2 + n * h / 2, p - s * w / 2 - n * h / 2, p + s * w / 2 - n * h / 2])
        for i in range(len(secs) - 1):
            A, Bq = secs[i], secs[i + 1]
            ctr = (pts[i] + pts[i + 1]) / 2
            for j in range(4):
                under = j == 2  # the face between corners 2 and 3 points down
                K.oface([A[j], A[(j + 1) % 4], Bq[(j + 1) % 4], Bq[j]], ctr, blue if (under and glow) else white, NEON if (under and glow) else BODY)

    def build_k(K, n, detail):
        for c in (-18.3, 18.3):
            L_, R_ = rib_pts(c, -1, n), rib_pts(c, 1, n)
            rib(K, L_, 2.4, 3.2)
            rib(K, R_, 2.4, 3.2)
            # struts between the ribs: two at the crown, two intermediate
            for y in (-9.0, 9.0, -44.0, 44.0):
                z = zs + rise * (1 - (y / half) ** 2)
                t = (z - zs) / rise
                xo = 12.0 - 10.2 * t
                K.box(c - xo, c + xo, y - 1.0, y + 1.0, z - 1.0, z + 1.0, white, BODY, ())
            if detail:
                # hangers to the deck edges
                for y in [k * 10.5 for k in range(-10, 11)]:
                    z = zs + rise * (1 - (y / half) ** 2)
                    t = (z - zs) / rise
                    xo = 12.0 - 10.2 * t
                    for sd in (-1, 1):
                        K.rod((c + sd * xo, y, z - 1.6), (c + sd * 11.3, y, 0.3), 0.07, lin('#c9ccd0'), BODY, 3)
                # deck edge girders and parapet lights along the span
                for sd in (-1, 1):
                    K.box(c + sd * 11.0 - 0.4, c + sd * 11.0 + 0.4, -110, 110, -2.4, -0.2, steel)
                    for k in range(-10, 11):
                        K.box(c + sd * 11.2 - 0.12, c + sd * 11.2 + 0.12, k * 10.5 - 0.12, k * 10.5 + 0.12, -0.2, 1.4, lin('#3a3f44'))
                        K.box(c + sd * 11.2 - 0.25, c + sd * 11.2 + 0.25, k * 10.5 - 0.25, k * 10.5 + 0.25, 1.4, 1.55, lin('#e8f0ff'), NEON)
            # river piers at the springings (Y-shaped: a wide cap on two legs into the water)
            for y in (-half, half):
                K.box(c - 14, c + 14, y - 4, y + 4, zs - 3.5, zs + 1.0, conc)
                for sd in (-1, 1):
                    K.box(c + sd * 7 - 3, c + sd * 7 + 3, y - 3, y + 3, -40, zs - 3.5, conc)
                K.box(c - 6, c + 6, y - 4.5, y + 4.5, -40, -24, conc)
                if detail:
                    for sd in (-1, 1):
                        K.quad(lambda u, h, d, sd=sd, y=y: (c + u, y + sd * (4.0 + d), h), -13.8, 13.8, zs - 3.4, zs + 0.9, 0.02, lin('#f4f4ff'), NEON) if False else None
    K = Kit(341, ao=0)
    build_k(K, 30, True)
    lod0 = K.obj('i74_lod0')
    K1 = Kit(342, ao=0)
    build_k(K1, 12, False)
    lod1 = K1.obj('i74_lod1')
    res = finish('i74', [lod0, lod1], None)
    if render:
        res['png'] = shots('i74', (0, 0, 10), 420, lod1, views=((70, 12), (10, 4)))
    return res


B['i74'] = i74


# ================================================================ DAVENPORT INTERIORS (walk-in, ground floor first)
# Interior-only files <name>_int.glb (node <name>_int) placed at the landmark's anchor; src/landmarks.js turns the
# rooms into halls (interiors.js) and swaps the building's solid block for walls with door gaps. You go in through
# the real doors (the exterior's door faces are one-sided, so they read as the doors from outside).
def ghall(K, G, x0, x1, z0, z1, h, wall, ceil, floors, doors=(), **kw):
    """hall() from a game rect x0..x1, z0..z1 (z0 = north); doors [(side n/s/e/w, a, b, height)] in game x (n/s)
    or game z (e/w)"""
    bx0, by1 = G(x0, z0)
    bx1, by0 = G(x1, z1)
    dd = []
    for side, a, b, dh in doors:
        if side in 'ns':
            dd.append((side, a - G(0, 0)[0] - 0 if False else G(a, 0)[0], G(b, 0)[0], dh))
        else:
            ya, yb = sorted((G(0, a)[1], G(0, b)[1]))
            dd.append((side, ya, yb, dh))
    hall(K, bx0, bx1, by0, by1, 0.02, h, wall, ceil, floors, doors=dd, **kw)
    return bx0, bx1, by0, by1


def int_finish(name, K, anchor, cam, target, render):
    o = K.obj(name + '_int')
    res = finish(name + '_int', [o], anchor)
    if render:
        res['png'] = [inside_shot(name + '_int', cam, target)]
    return res


def chandelier(K, x, y, ztop, r=1.0, col=lin('#ffe6a8')):
    K.box(x - 0.04, x + 0.04, y - 0.04, y + 0.04, ztop - 1.2, ztop, lin('#c9a23a'))
    K.cyl(x, y, r, ztop - 1.9, ztop - 1.2, col, LIT, 8, r1=r * 0.6)
    K.cyl(x, y, r * 0.4, ztop - 2.4, ztop - 1.9, col, LIT, 8, r1=r)


def seats(K, x0, x1, y, z, col, step=0.6, d=0.5, h=0.9):
    """a row of theatre seats along x at y, floor z"""
    # one cushion strip and one back strip per run (cheap), with a dark armrest line between seats on the back
    K.box(x0, x1, y - d / 2, y + d / 2, z, z + 0.45, col)
    K.box(x0, x1, y + d / 2 - 0.1, y + d / 2, z + 0.45, z + h, scale(col, 0.85), BODY, ('h-', 'd+'))
    for i in range(1, int((x1 - x0) / step)):
        x = x0 + i * step
        K.face([(x - 0.03, y + d / 2 - 0.11, z + 0.45), (x + 0.03, y + d / 2 - 0.11, z + 0.45), (x + 0.03, y + d / 2 - 0.11, z + h), (x - 0.03, y + d / 2 - 0.11, z + h)], scale(col, 0.5))


def blackhawk_int(render=True):
    anchor = (451.6, 96.5)
    G = g2l(anchor)
    K = Kit(401, ao=0)
    cream, wood, marble = lin('#ede3cf'), lin('#4a2e1f'), [lin('#efefea'), lin('#151515')]
    x0, x1, y0, y1 = ghall(K, G, 439.6, 463.6, 100.0, 118.4, 9.5, cream, lin('#e2d6bc'), marble, [('s', 449.6, 453.6, 3.6)], tile=1.2, dado=(1.2, wood), trim=lin('#c9a23a'))
    # the original pink-and-green marble centre
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for i in range(6):
        for j in range(4):
            a, b = cx - 7.2 + i * 2.4, cy - 4.8 + j * 2.4
            K.face([(a, b, 0.03), (a + 2.4, b, 0.03), (a + 2.4, b + 2.4, 0.03), (a, b + 2.4, 0.03)], lin('#d9a3a0') if (i + j) % 2 else lin('#6e8b6a'))
    # skylight in the ceiling, mezzanine balcony round three sides at 4.8 m with a rail
    iface(K, [(cx - 6, cy - 4, 9.48), (cx + 6, cy - 4, 9.48), (cx + 6, cy + 4, 9.48), (cx - 6, cy + 4, 9.48)], (cx, cy, 0), lin('#fff4d6'), LIT)
    for (a, b, c, d) in ((x0, x0 + 2.4, y0, y1), (x1 - 2.4, x1, y0, y1), (x0, x1, y1 - 2.4, y1)):
        K.box(a, b, c, d, 4.6, 4.9, cream, BODY, ())
        K.face([(a, c, 4.59), (a, d, 4.59), (b, d, 4.59), (b, c, 4.59)], lin('#d8ccb2'))
    for x in (x0 + 2.4, x1 - 2.4):
        K.box(x - 0.05, x + 0.05, y0, y1 - 2.4, 4.9, 5.9, lin('#c9a23a'))
    K.box(x0 + 2.4, x1 - 2.4, y1 - 2.45, y1 - 2.35, 4.9, 5.9, lin('#c9a23a'))
    for x in (x0 + 2.4, x1 - 2.4):  # columns under the balcony
        for y in (y0 + 3, cy, y1 - 2.4):
            K.box(x - 0.35, x + 0.35, y - 0.35, y + 0.35, 0, 4.6, cream)
    # arched windows (lit) on the upper walls
    for k in range(5):
        y = y0 + 2 + k * 3.4
        for x, s in ((x0 + 0.02, 1), (x1 - 0.02, -1)):
            iface(K, [(x, y, 6.0), (x, y + 1.6, 6.0), (x, y + 1.6, 8.6), (x, y, 8.6)], (x + s, y, 7), lin('#ffe6b8'), LIT)
    # the 1915 front desk (north, under the balcony) and the lobby bar (east)
    K.box(cx - 5, cx + 5, y1 - 4.2, y1 - 3.4, 0, 1.15, wood)
    K.box(cx - 5.1, cx + 5.1, y1 - 4.3, y1 - 3.3, 1.15, 1.22, lin('#2a1a12'))
    K.box(cx - 5, cx + 5, y1 - 0.5, y1 - 0.1, 0, 3.6, wood)
    K.text('HOTEL BLACKHAWK', lambda u, h, d: (cx + u, y1 - 0.5 - d, h), 0, 3.85, 0.0, 0.5, lin('#c9a23a'), BODY, 0.03, res=1)
    K.box(x1 - 4.2, x1 - 3.4, y0 + 3, y0 + 10, 0, 1.1, wood)
    for k in range(3):
        K.box(x1 - 0.5, x1 - 0.2, y0 + 3, y0 + 10, 1.1 + k * 0.6, 1.15 + k * 0.6, lin('#5d4037'))
    for k in range(2):
        chandelier(K, cx - 4 + k * 8, cy - 1, 9.4, 1.0)
    for x in (cx - 5, cx + 1):  # sofas
        K.box(x, x + 3, cy - 2.6, cy - 1.8, 0, 0.45, lin('#6b1e2a'))
        K.box(x, x + 3, cy - 2.9, cy - 2.6, 0, 0.9, lin('#6b1e2a'))
    return int_finish('blackhawk', K, anchor, (*G(451.6, 117), 1.7), (*G(451.6, 104), 3.5), render)


def adler_int(render=True):
    anchor = (342.4, 91.2)
    G = g2l(anchor)
    K = Kit(402, ao=0)
    ivory, gold, wine, maho = lin('#efe6d2'), lin('#c9a24a'), lin('#6b1e2a'), lin('#5a2e1c')
    # grand lobby (x 332.4..352.4, z 100..109.4) and the auditorium (x 323.5..361.3, z 73.5..98.6)
    x0, x1, y0, y1 = ghall(K, G, 332.4, 352.4, 100.0, 109.4, 6.7, ivory, lin('#d9c690'), [lin('#7a2030'), lin('#5a1824')],
                           [('s', 339.4, 345.4, 3.2), ('n', 338.4, 346.4, 3.4)], tile=1.0, dado=(1.4, maho), trim=gold)
    for i in range(5):  # stepped coffers
        for j in range(2):
            a, b = x0 + 1 + i * 3.8, y0 + 1 + j * 4.2
            iface(K, [(a, b, 6.66), (a + 3, b, 6.66), (a + 3, b + 3.4, 6.66), (a, b + 3.4, 6.66)], (a, b, 0), lin('#ead9a6'), LIT)
    for x in (x0 + 5, x1 - 5):
        chandelier(K, x, (y0 + y1) / 2, 6.6, 1.1)
    # grand stair up to the mezzanine (west), mezzanine ledge with rail
    for k in range(12):
        K.box(x0 + 0.2, x0 + 3.2, y0 + 1 + k * 0.5, y0 + 1.5 + k * 0.5, 0, 0.3 + k * 0.3, maho)
    K.box(x0, x1, y1 - 1.6, y1, 3.6, 3.9, ivory, BODY, ())
    K.box(x0 + 3.2, x1, y1 - 1.65, y1 - 1.55, 3.9, 4.9, gold)
    K.box(x1 - 2.4, x1 - 0.4, y0 + 2, y0 + 3, 0, 2.6, lin('#9c7a3a'))  # bronze elevator doors
    # auditorium
    ax0, ax1, ay0, ay1 = ghall(K, G, 323.5, 361.3, 73.5, 98.6, 17.5, lin('#b8925a'), lin('#efe6d2'), [lin('#5a1824'), lin('#4c1420')],
                               [('s', 338.4, 346.4, 3.4)], tile=2.0, dado=(2.0, lin('#3a1a14')), trim=gold)
    # stage (north, y high), proscenium arch, curtain
    sy = ay1 - 9.0
    K.box(ax0, ax1, sy, ay1, 0, 1.1, lin('#3a2418'), BODY, ())
    K.box(ax0, ax0 + 6, sy - 0.4, sy, 0, 14, gold)
    K.box(ax1 - 6, ax1, sy - 0.4, sy, 0, 14, gold)
    K.box(ax0, ax1, sy - 0.4, sy, 12, 17.5, gold)
    K.face([(ax0 + 6, sy + 0.3, 1.1), (ax1 - 6, sy + 0.3, 1.1), (ax1 - 6, sy + 0.3, 12), (ax0 + 6, sy + 0.3, 12)], lin('#8e1b2b'))
    K.text('ADLER', lambda u, h, d: ((ax0 + ax1) / 2 + u, sy - 0.4 - d, h), 0, 14.2, 0.0, 1.6, lin('#5a1824'), BODY, 0.05, res=1)
    # raked seating rows (the floor rises toward the back, south), aisles either side of centre
    for r in range(16):
        y = sy - 3.5 - r * 0.95
        z = 0.05 + r * 0.18
        K.box(ax0 + 1, ax1 - 1, y - 0.95, y, 0, z, lin('#4c1420'))
        for a, b in ((ax0 + 2, (ax0 + ax1) / 2 - 1.2), ((ax0 + ax1) / 2 + 1.2, ax1 - 2)):
            seats(K, a, b, y - 0.4, z, wine)
    # the balcony over the back (south) third
    K.box(ax0, ax1, ay0, ay0 + 9, 6.5, 7.3, lin('#b8925a'), BODY, ())
    K.face([(ax0, ay0 + 9, 6.49), (ax0, ay0, 6.49), (ax1, ay0, 6.49), (ax1, ay0 + 9, 6.49)][::-1], lin('#efe6d2'))
    K.box(ax0, ax1, ay0 + 8.9, ay0 + 9.1, 7.3, 8.3, gold)
    for k in range(6):
        seats(K, ax0 + 1, ax1 - 1, ay0 + 7.8 - k * 1.2, 7.3 + k * 0.35, wine)
    for k in range(4):  # Deco light coves on the side walls
        y = ay0 + 3 + k * 5
        for x, s in ((ax0 + 0.02, 1), (ax1 - 0.02, -1)):
            iface(K, [(x, y, 9), (x, y + 1.2, 9), (x, y + 1.2, 13), (x, y, 13)], (x + s, y, 11), lin('#ffd98a'), LIT)
    chandelier(K, (ax0 + ax1) / 2, (ay0 + ay1) / 2, 17.4, 2.0)
    return int_finish('adler', K, anchor, (*G(342.4, 97.5), 2.5), (*G(342.4, 78), 6.0), render)


def figge_int(render=True):
    anchor = (109.0, 340.0)
    G = g2l(anchor)
    K = Kit(403, ao=0)
    white, terr = lin('#f5f5f2'), [lin('#cfcbc4'), lin('#c8c4bd')]
    x0, x1, y0, y1 = ghall(K, G, 70.0, 148.0, 322.0, 358.0, 7.0, white, lin('#e9e9e6'), terr, [('n', 106.0, 112.0, 3.2)], tile=4.0)
    # frosted glass wall toward the river (south) and the plaza windows
    for k in range(12):
        x = x0 + 1 + k * 6.4
        iface(K, [(x, y0 + 0.03, 0.4), (x + 5.6, y0 + 0.03, 0.4), (x + 5.6, y0 + 0.03, 6.5), (x, y0 + 0.03, 6.5)], (x, y0 + 1, 3), lin('#dce6e8'), LIT)
    # the grand stair (east, rising south to the galleries) and its landing
    for k in range(20):
        K.box(x1 - 9, x1 - 4, y1 - 4 - k * 0.45, y1 - 3.55 - k * 0.45, 0, 0.35 + k * 0.33, lin('#d8d4cc'))
    K.box(x1 - 9.1, x1 - 8.95, y1 - 13, y1 - 3.5, 0.5, 7.0, lin('#e0e8ea'))
    # reception desk, a lounge, a cafe counter
    cx, cy = G(109, 330)
    K.box(cx - 4, cx + 4, cy - 0.6, cy + 0.6, 0, 1.1, lin('#e9e6e0'))
    K.text('FIGGE ART MUSEUM', lambda u, h, d: (cx + u, y1 - 0.03 - d, h), 0, 4.6, 0.0, 0.9, lin('#2b2b2b'), BODY, 0.03, res=1)
    for k in range(4):
        x = x0 + 8 + k * 3
        K.box(x, x + 2.2, y0 + 5, y0 + 6, 0, 0.45, lin('#3a3a3a'))
    K.box(x0 + 2, x0 + 3, y0 + 8, y0 + 20, 0, 1.1, lin('#5d4037'))
    # art: a stripe wall drawing and framed pictures on the north wall, a sculpture plinth
    pal = [lin('#c62828'), lin('#f9a825'), lin('#1565c0'), lin('#2e7d32'), lin('#111111')]
    for k in range(10):
        x = x0 + 30 + k * 1.2
        iface(K, [(x, y1 - 0.03, 1.2), (x + 1.2, y1 - 0.03, 1.2), (x + 1.2, y1 - 0.03, 5.0), (x, y1 - 0.03, 5.0)], (x, y1 - 1, 3), pal[k % 5])
    for k in range(4):
        x = x0 + 46 + k * 5
        iface(K, [(x, y1 - 0.04, 1.6), (x + 2.6, y1 - 0.04, 1.6), (x + 2.6, y1 - 0.04, 3.6), (x, y1 - 0.04, 3.6)], (x, y1 - 1, 3), [lin('#8a7a46'), lin('#4f6d8a'), lin('#9a5a3a'), lin('#6b8a4a')][k])
    K.box(cx - 0.6, cx + 0.6, cy - 9.6, cy - 8.4, 0, 1.0, white)
    K.cyl(cx, cy - 9, 0.4, 1.0, 2.6, lin('#8a6a3a'), BODY, 6)
    return int_finish('figge', K, anchor, (*G(109, 323), 1.8), (*G(125, 350), 2.5), render)


def banktower_int(render=True):
    anchor = (141.0, 164.7)
    G = g2l(anchor)
    K = Kit(404, ao=0)
    marble, walnut, iron = [lin('#e6dcc8'), lin('#d8cdb6')], lin('#3b2516'), lin('#2a2a2a')
    x0, x1, y0, y1 = ghall(K, G, 127.5, 154.5, 144.0, 170.0, 13.5, lin('#e8dcc0'), lin('#d8c9a3'), marble, [('n', 139.0, 143.0, 4.0)], tile=2.0, dado=(1.6, walnut), trim=lin('#b8923a'))
    # painted groin vaults: coloured coffers on the ceiling
    pal = [lin('#8c3a2b'), lin('#3e5a7a'), lin('#b8923a'), lin('#d8c9a3')]
    for i in range(5):
        for j in range(5):
            a, b = x0 + 1 + i * 5, y0 + 1 + j * 4.8
            iface(K, [(a, b, 13.45), (a + 4.4, b, 13.45), (a + 4.4, b + 4.2, 13.45), (a, b + 4.2, 13.45)], (a, b, 0), pal[(i + j) % 4])
            iface(K, [(a + 1.6, b + 1.5, 13.4), (a + 2.8, b + 1.5, 13.4), (a + 2.8, b + 2.7, 13.4), (a + 1.6, b + 2.7, 13.4)], (a, b, 0), lin('#f4e9c8'), LIT)
    # tall arched windows on Main St (east wall)
    for k in range(4):
        y = y0 + 2.5 + k * 6
        iface(K, [(x1 - 0.03, y, 2.5), (x1 - 0.03, y + 3, 2.5), (x1 - 0.03, y + 3, 11.5), (x1 - 0.03, y, 11.5)], (x1 - 1, y, 6), lin('#ffe9b8'), LIT)
    # teller line: walnut counter with wrought-iron cages along the west and south
    K.box(x0 + 3, x0 + 4, y0 + 3, y1 - 6, 0, 1.2, walnut)
    for k in range(30):
        y = y0 + 3 + k * 0.55
        if y > y1 - 6:
            break
        K.box(x0 + 3.45, x0 + 3.55, y - 0.03, y + 0.03, 1.2, 2.6, iron)
    K.box(x0 + 3.4, x0 + 3.6, y0 + 3, y1 - 6, 2.55, 2.7, iron)
    # the 1832 treaty mural on the south wall
    iface(K, [(x0 + 9, y0 + 0.04, 5), (x0 + 18, y0 + 0.04, 5), (x0 + 18, y0 + 0.04, 9.5), (x0 + 9, y0 + 0.04, 9.5)], (x0 + 13, y0 + 1, 7), lin('#8a7050'))
    iface(K, [(x0 + 10, y0 + 0.06, 5.6), (x0 + 17, y0 + 0.06, 5.6), (x0 + 17, y0 + 0.06, 7.0), (x0 + 10, y0 + 0.06, 7.0)], (x0 + 13, y0 + 1, 7), lin('#5a7a4a'))
    for k in range(3):  # writing desks
        cx, cy = x0 + 13 + k * 0.1, y0 + 8 + k * 5
        K.box(cx - 1.5, cx + 1.5, cy - 0.5, cy + 0.5, 0, 1.1, walnut)
    for x in (x0 + 9, x1 - 6):
        for y in (y0 + 6, y1 - 6):
            K.box(x - 0.6, x + 0.6, y - 0.6, y + 0.6, 0, 13.5, lin('#e6dcc8'))
    return int_finish('banktower', K, anchor, (*G(141, 145.5), 1.8), (*G(141, 165), 5.0), render)


def cityhall_int(render=True):
    anchor = (81.5, -27.5)
    G = g2l(anchor)
    K = Kit(405, ao=0)
    oak, carpet = lin('#9a6b3f'), [lin('#4a4f5c'), lin('#454a56')]
    # vestibule in the tower and the council chambers behind it
    ghall(K, G, 78.7, 84.3, -16.5, -9.2, 4.6, lin('#cdbf9f'), lin('#b3a585'), [lin('#9a8f7c')], [('s', 80.0, 83.0, 3.2), ('n', 80.0, 83.0, 3.0)], tile=1.4)
    x0, x1, y0, y1 = ghall(K, G, 62.0, 101.0, -41.0, -16.5, 4.6, lin('#e9e4d6'), lin('#ededE8'.lower()), carpet, [('s', 80.0, 83.0, 3.0)], tile=3.0, dado=(1.0, oak))
    # raised curved dais at the north end with the council desks, flags, the city seal
    cx = (x0 + x1) / 2
    for k in range(9):
        a0, a1 = math.pi * (0.1 + 0.8 * k / 9), math.pi * (0.1 + 0.8 * (k + 1) / 9)
        r = 8.0
        p = lambda a, rr: (cx + math.cos(a) * rr, y1 - 1 - math.sin(a) * rr * 0.5)
        K.oface([Vector((*p(a0, r), 0)), Vector((*p(a1, r), 0)), Vector((*p(a1, r), 1.1)), Vector((*p(a0, r), 1.1))], Vector((cx, y1, 0.5)), oak)
        K.face([(*p(a0, r), 1.1), (*p(a1, r), 1.1), (*p(a1, r + 0.8), 1.1), (*p(a0, r + 0.8), 1.1)][::-1], lin('#6b4a2b'))
    K.box(cx - 9, cx + 9, y1 - 2.2, y1, 0, 0.45, oak)
    K.cyl(cx, y1 - 0.05, 1.2, 2.2, 2.2, lin('#c9a23a'), BODY, 12)
    iface(K, [(cx - 1.2, y1 - 0.04, 1.6), (cx + 1.2, y1 - 0.04, 1.6), (cx + 1.2, y1 - 0.04, 3.8), (cx - 1.2, y1 - 0.04, 3.8)], (cx, y1 - 1, 2), lin('#1d3c6e'))
    K.text('CITY OF DAVENPORT', lambda u, h, d: (cx + u, y1 - 0.06 - d, h), 0, 4.0, 0.0, 0.45, lin('#c9a23a'), BODY, 0.02, res=1)
    for x in (cx - 4, cx + 4):
        K.cyl(x, y1 - 1, 0.04, 0, 2.6, lin('#c9a23a'), BODY, 4, top=False)
        K.box(x, x + 0.9, y1 - 1.02, y1 - 0.98, 1.7, 2.5, lin('#b22234') if x < cx else lin('#1d5a9a'))
    # public seating
    for r in range(6):
        seats(K, cx - 10, cx - 1.2, y0 + 3 + r * 1.2, 0.02, lin('#3a4050'))
        seats(K, cx + 1.2, cx + 10, y0 + 3 + r * 1.2, 0.02, lin('#3a4050'))
    for i in range(6):
        for j in range(4):
            a, b = x0 + 2 + i * 6.2, y0 + 2 + j * 6
            iface(K, [(a, b, 4.57), (a + 2.4, b, 4.57), (a + 2.4, b + 1.2, 4.57), (a, b + 1.2, 4.57)], (a, b, 0), lin('#fffbe8'), LIT)
    return int_finish('cityhall', K, anchor, (*G(81.5, -17.5), 1.7), (*G(81.5, -38), 1.5), render)


def rivercenter_int(render=True):
    anchor = (461.0, 172.0)
    G = g2l(anchor)
    K = Kit(406, ao=0)
    # the glass atrium on the 3rd St corner, then Great River Hall
    x0, x1, y0, y1 = ghall(K, G, 401.0, 430.0, 142.5, 168.0, 18.0, lin('#e6e2da'), lin('#b5b8ba'), [lin('#3d4a5c'), lin('#46546a')],
                           [('n', 412.5, 418.5, 3.4), ('e', 152.25, 158.25, 4.0)], tile=3.0)
    for k in range(9):  # glazed walls with mullions, seen from inside
        x = x0 + 0.5 + k * 3.2
        iface(K, [(x, y1 - 0.04, 0.5), (x + 2.9, y1 - 0.04, 0.5), (x + 2.9, y1 - 0.04, 17.5), (x, y1 - 0.04, 17.5)], (x, y1 - 1, 5), lin('#bcd8e4'), LIT)
    for k in range(8):
        y = y0 + 0.5 + k * 3.1
        iface(K, [(x0 + 0.04, y, 0.5), (x0 + 0.04, y + 2.8, 0.5), (x0 + 0.04, y + 2.8, 17.5), (x0 + 0.04, y, 17.5)], (x0 + 1, y, 5), lin('#bcd8e4'), LIT)
    K.box(x0 + 2, x1 - 2, y1 - 7, y1 - 5, 6.0, 6.4, lin('#b5b8ba'), BODY, ())  # walkway to the skywalk
    K.box(x0 + 2, x1 - 2, y1 - 7.05, y1 - 6.95, 6.4, 7.4, lin('#b5b8ba'))
    for k in range(3):
        K.cyl(x0 + 6 + k * 8, y0 + 6, 1.2, 0, 0.6, lin('#7a5a3a'), BODY, 8)
        K.cyl(x0 + 6 + k * 8, y0 + 6, 0.9, 0.6, 3.2, lin('#3f7f3a'), BODY, 8, r1=0.1)
    hx0, hx1, hy0, hy1 = ghall(K, G, 430.0, 500.0, 145.0, 199.0, 12.0, lin('#d9d6cf'), lin('#6e7378'), [lin('#a7a39b')],
                               [('w', 152.25, 158.25, 4.0)], tile=6.0)
    for i in range(7):  # exposed roof trusses and high-bay lights
        x = hx0 + 5 + i * 10
        K.box(x - 0.3, x + 0.3, hy0, hy1, 10.5, 11.95, lin('#6e7378'), BODY, ())
        for j in range(4):
            y = hy0 + 7 + j * 13
            K.box(x + 3, x + 4, y - 0.5, y + 0.5, 10.6, 10.9, lin('#fffbe8'), LIT, ())
    for k in range(6):  # trade-show booths
        bx, by = hx0 + 8 + (k % 3) * 20, hy0 + 15 + (k // 3) * 22
        K.box(bx, bx + 6, by, by + 0.15, 0, 2.5, [lin('#1565c0'), lin('#c62828'), lin('#2e7d32')][k % 3])
        K.box(bx + 1, bx + 5, by + 1.5, by + 2.3, 0, 0.9, lin('#efefef'))
    return int_finish('rivercenter', K, anchor, (*G(415.5, 144), 1.8), (*G(430, 158), 3.0), render)


def ambrose_int(render=True):
    anchor = (-287.0, -1693.0)
    G = g2l(anchor)
    K = Kit(407, ao=0)
    plaster, oak, terr = lin('#ede4d0'), lin('#8a5a32'), [lin('#b9a88e'), lin('#ad9c82')]
    ghall(K, G, -294.4, -289.9, -1711.3, -1700.9, 4.6, plaster, lin('#e6dcc6'), terr, [('n', -293.15, -291.15, 3.2), ('s', -293.15, -291.15, 3.0)], tile=1.5, dado=(1.1, oak))
    x0, x1, y0, y1 = ghall(K, G, -300.3, -278.5, -1700.9, -1688.0, 4.6, plaster, lin('#e6dcc6'), terr,
                           [('n', -293.15, -291.15, 3.0), ('s', -291.4, -287.4, 3.0)], tile=1.5, dado=(1.1, oak))
    # central oak stair to the upper floors and a bench
    for k in range(10):
        K.box(x1 - 4, x1 - 2.2, y1 - 1.5 - k * 0.32, y1 - 1.18 - k * 0.32, 0, 0.2 + k * 0.2, oak)
    K.box(x1 - 4.1, x1 - 3.95, y1 - 4.7, y1 - 1.2, 0.9, 1.0, oak)
    K.box(x0 + 1, x0 + 3, y1 - 6, y1 - 5.5, 0, 0.45, oak)
    K.text('AMBROSE HALL', lambda u, h, d: ((x0 + x1) / 2 + u, y0 + 0.03 + d, h), 0, 3.4, 0.0, 0.45, lin('#7a1f1f'), BODY, 0.02, res=1)
    cx0, cx1, cy0, cy1 = ghall(K, G, -328.6, -266.5, -1688.0, -1683.5, 4.2, plaster, lin('#e6dcc6'), terr, [('n', -291.4, -287.4, 3.0)], tile=1.5, dado=(1.1, oak))
    for k in range(10):  # classroom doors along the corridor
        x = cx0 + 3 + k * 6
        for y, s in ((cy0 + 0.03, 1), (cy1 - 0.03, -1)):
            iface(K, [(x, y, 0.02), (x + 1.0, y, 0.02), (x + 1.0, y, 2.3), (x, y, 2.3)], (x, y + s, 1), oak)
    for k in range(8):
        x = cx0 + 4 + k * 7.5
        iface(K, [(x, cy0 + 1.6, 4.17), (x + 1.2, cy0 + 1.6, 4.17), (x + 1.2, cy0 + 2.8, 4.17), (x, cy0 + 2.8, 4.17)], (x, cy0 + 2, 0), lin('#fffbe8'), LIT)
    return int_finish('ambrose', K, anchor, (*G(-292.15, -1710), 1.7), (*G(-290, -1692), 1.6), render)


def conservatory_int(render=True):
    anchor = (196.0, -2394.0)
    G = g2l(anchor)
    K = Kit(408, ao=0)
    glass, path, soil = lin('#cfe6ea'), [lin('#bdb6a8')], lin('#5a4030')
    # west wing (x 160..186), palm house under the dome (x 189..211), east wing (x 214..229); entrance east
    rooms = [(160.0, 186.0, -2405.0, -2383.0, 4.4, [('e', -2396.0, -2392.0, 3.0)]),
             (189.0, 211.0, -2405.0, -2383.0, 9.5, [('w', -2396.0, -2392.0, 3.0), ('e', -2396.0, -2392.0, 3.0)]),
             (214.0, 229.0, -2401.0, -2387.0, 3.9, [('w', -2396.0, -2392.0, 3.0), ('e', -2395.5, -2392.5, 2.8)])]
    pal = [lin('#e53935'), lin('#fdd835'), lin('#ec407a'), lin('#ffffff'), lin('#ab47bc'), lin('#ff7043')]
    for x0g, x1g, z0g, z1g, h, doors in rooms:
        x0, x1, y0, y1 = ghall(K, G, x0g, x1g, z0g, z1g, h, glass, glass, path, doors, tile=4.0, dado=(1.0, lin('#8b5a44')))
        # raised beds along both long sides, planted
        for y, s in ((y0 + 0.2, 1), (y1 - 2.2, -1)):
            K.box(x0 + 0.5, x1 - 0.5, y, y + 2.0, 0, 0.6, lin('#8b5a44'))
            K.box(x0 + 0.6, x1 - 0.6, y + 0.1, y + 1.9, 0.6, 0.62, soil, BODY, ())
            for k in range(int((x1 - x0 - 1) / 1.2)):
                x = x0 + 1.1 + k * 1.2
                if K.rnd.random() < 0.5:
                    K.box(x - 0.3, x + 0.3, y + 0.5, y + 1.3, 0.62, 1.0, pal[K.rnd.randrange(6)])
                else:
                    K.cyl(x, y + 1.0, 0.45, 0.62, 1.6 + K.rnd.random(), lin('#3f7f3a'), BODY, 5, r1=0.1)
    # palms and a pool under the dome
    cx, cy = G(200, -2394)
    K.cyl(cx, cy, 3.2, 0, 0.5, lin('#9a958c'), BODY, 12)
    K.cyl(cx, cy, 2.9, 0.5, 0.45, lin('#4f8fa8'), BODY, 12)
    K.cyl(cx, cy, 0.2, 0.4, 1.6, lin('#d8d4cc'), BODY, 6)
    for a in range(4):
        px, py = cx + math.cos(a * 1.57 + 0.78) * 6.5, cy + math.sin(a * 1.57 + 0.78) * 6.5
        K.cyl(px, py, 0.25, 0, 6.5, lin('#7a6a4a'), BODY, 5)
        for k in range(6):
            t = k * math.pi / 3
            K.face([(px, py, 6.5), (px + math.cos(t) * 2.6, py + math.sin(t) * 2.6, 5.6), (px + math.cos(t + 0.4) * 2.6, py + math.sin(t + 0.4) * 2.6, 5.6)], lin('#2e7d32'))
            K.face([(px, py, 6.5), (px + math.cos(t + 0.4) * 2.6, py + math.sin(t + 0.4) * 2.6, 5.6), (px + math.cos(t) * 2.6, py + math.sin(t) * 2.6, 5.6)], lin('#2e7d32'))
    return int_finish('conservatory', K, anchor, (*G(228, -2394), 1.7), (*G(195, -2394), 2.0), render)


for _n, _f in (('blackhawk_int', blackhawk_int), ('adler_int', adler_int), ('figge_int', figge_int), ('banktower_int', banktower_int),
               ('cityhall_int', cityhall_int), ('rivercenter_int', rivercenter_int), ('ambrose_int', ambrose_int), ('conservatory_int', conservatory_int)):
    B[_n] = _f


# ================================================================ PLANES (assets/models/planes.glb, manifest 'planes')
# Two root nodes for src/planes.js: 'cessna' (Cessna 172: 8.28 m long, 11.0 m span, 2.72 m high, strut-braced high
# wing, fixed tricycle gear, white with a blue cheatline) and 'cropduster' (Air Tractor AT-502B: 10.2 m, 15.85 m span,
# low wing, tail-dragger, long turboprop nose, cockpit aft of the hopper, chrome yellow). Nose toward Blender -Y
# (three +z), wheels on z = 0, the propeller a child '<plane>_prop' pivoting on its hub. Plain coloured materials
# (no vertex colours): planes.js uses the GLB materials as they are.
class PKit(Kit):
    def obj(self, name, origin=None):
        cols = []
        for _, c, _m in self.faces:
            k = tuple(round(x, 4) for x in c)
            if k not in cols:
                cols.append(k)
        bm = bmesh.new()
        for pts, c, m in self.faces:
            try:
                f = bm.faces.new([bm.verts.new(p) for p in pts])
            except ValueError:
                continue
            f.material_index = cols.index(tuple(round(x, 4) for x in c))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.001)
        if origin:
            bmesh.ops.translate(bm, verts=bm.verts, vec=-Vector(origin))
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        o = bpy.data.objects.new(name, me)
        link(o)
        if origin:
            o.location = origin
        for c in cols:
            glassy = c[2] > c[0] and sum(c) < 0.25
            me.materials.append(mat('pl_%02x%02x%02x' % tuple(int(min(1, x) ** (1 / 2.2) * 255) for x in c), c, rough=0.15 if glassy else 0.55, metal=0.3 if glassy else 0.0))
        return o


def loft(K, secs, col, stripe=None):
    """fuselage from sections (y, half width, z bottom, z top), nose first; stripe = (z0, z1, colour) on the sides"""
    ring = lambda s: [Vector((-s[1], s[0], s[2])), Vector((s[1], s[0], s[2])), Vector((s[1], s[0], s[3])), Vector((-s[1], s[0], s[3]))]
    for a, b in zip(secs, secs[1:]):
        A, Bq = ring(a), ring(b)
        ctr = (sum(A, Vector()) + sum(Bq, Vector())) / 8
        for j in range(4):
            K.oface([A[j], A[(j + 1) % 4], Bq[(j + 1) % 4], Bq[j]], ctr, col)
        if stripe:
            z0, z1, sc = stripe
            for sd in (-1, 1):
                pa = [Vector((sd * (a[1] + 0.01), a[0], z0)), Vector((sd * (b[1] + 0.01), b[0], z0)), Vector((sd * (b[1] + 0.01), b[0], z1)), Vector((sd * (a[1] + 0.01), a[0], z1))]
                if a[2] < z0 < a[3] and b[2] < z0 < b[3] and z1 < min(a[3], b[3]):
                    K.oface(pa, Vector((0, (a[0] + b[0]) / 2, (z0 + z1) / 2)), sc)
    for s, sgn in ((secs[0], -1), (secs[-1], 1)):
        R = ring(s)
        K.oface(R, Vector((0, s[0] - sgn, (s[2] + s[3]) / 2)), col)


def wing(K, y0, y1, z0, z1, span, col, tip=0.8, x0=0.0):
    """a flat wing panel from the root x0 out to +-span/2, chord y0..y1 tapering to `tip` of the chord"""
    for sd in (-1, 1):
        c = (y0 + y1) / 2
        ty0, ty1 = c - (c - y0) * tip, c + (y1 - c) * tip
        p = [(sd * x0, y0), (sd * span / 2, ty0), (sd * span / 2, ty1), (sd * x0, y1)]
        bot = [Vector((x, y, z0)) for x, y in p]
        top = [Vector((x, y, z1)) for x, y in p]
        ctr = Vector((sd * span / 4, c, (z0 + z1) / 2))
        K.oface(top, ctr, col)
        K.oface(bot, ctr, col)
        for j in range(4):
            K.oface([bot[j], bot[(j + 1) % 4], top[(j + 1) % 4], top[j]], ctr, col)


def wheel(K, x, y, r, w, col=lin('#151515')):
    K.rod((x - w / 2, y, r), (x + w / 2, y, r), r, col, BODY, 8)
    for sx in (x - w / 2, x + w / 2):
        K.face([(sx, y + math.cos(a) * r, r + math.sin(a) * r) for a in [k * math.pi / 4 for k in range(8)]][::(1 if sx > x else -1)], col)


def prop_obj(name, hub, blades, R, col, spin_col):
    P = PKit(1, ao=0)
    for k in range(blades):
        a = 2 * math.pi * k / blades
        ca, sa = math.cos(a), math.sin(a)
        pts = [(ca * 0.12 - sa * 0.08, sa * 0.12 + ca * 0.08), (ca * R - sa * 0.06, sa * R + ca * 0.06), (ca * R + sa * 0.06, sa * R - ca * 0.06), (ca * 0.12 + sa * 0.08, sa * 0.12 - ca * 0.08)]
        for dy, flip in ((-0.03, True), (0.03, False)):
            f = [(hub[0] + u, hub[1] + dy, hub[2] + v) for u, v in pts]
            P.face(f[::-1] if flip else f, col)
    o = P.obj(name, origin=hub)
    return o


def planes(render=True):
    white, blue, glass, black, grey, yellow = lin('#f4f4f2'), lin('#1f4e9a'), lin('#1c2733'), lin('#1b1b1b'), lin('#9aa0a6'), lin('#f2c230')
    # ---- Cessna 172
    K = PKit(501, ao=0)
    loft(K, [(-4.15, 0.18, 1.15, 1.45), (-3.9, 0.45, 0.95, 1.7), (-2.9, 0.55, 0.85, 1.85), (-2.2, 0.58, 0.8, 2.0), (-0.2, 0.58, 0.85, 2.05),
             (1.0, 0.42, 1.1, 1.95), (3.6, 0.13, 1.45, 1.75), (4.0, 0.06, 1.5, 1.7)], white, (1.3, 1.42, blue))
    # cabin greenhouse: windshield and side windows up to the wing
    K.oface([Vector((-0.55, -2.2, 2.0)), Vector((0.55, -2.2, 2.0)), Vector((0.55, -1.7, 2.55)), Vector((-0.55, -1.7, 2.55))], Vector((0, 0, 1.5)), glass)
    for sd in (-1, 1):
        K.oface([Vector((sd * 0.59, -2.15, 1.55)), Vector((sd * 0.59, -0.3, 1.55)), Vector((sd * 0.59, -0.3, 2.0)), Vector((sd * 0.59, -2.15, 2.0))], Vector((0, -1.2, 1.7)), glass)
        K.oface([Vector((sd * 0.57, -2.2, 2.0)), Vector((sd * 0.57, -0.2, 2.05)), Vector((sd * 0.5, -0.2, 2.55)), Vector((sd * 0.5, -1.7, 2.55))], Vector((0, -1.2, 2.2)), glass)
    K.box(-0.5, 0.5, -1.7, -0.2, 2.05, 2.55, white)
    wing(K, -2.0, -0.4, 2.55, 2.7, 11.0, white, 0.85)
    for sd in (-1, 1):
        K.box(sd * 5.5 - (0.25 if sd > 0 else 0), sd * 5.5 + (0 if sd > 0 else 0.25), -2.0, -0.6, 2.54, 2.71, blue)
        K.rod((sd * 0.56, -1.0, 0.95), (sd * 2.6, -1.4, 2.55), 0.04, grey, BODY, 4)
        K.rod((sd * 0.5, -0.6, 0.85), (sd * 1.25, -0.5, 0.35), 0.05, grey, BODY, 4)
        wheel(K, sd * 1.27, -0.5, 0.3, 0.16)
        K.box(sd * 1.27 - 0.12, sd * 1.27 + 0.12, -0.85, -0.15, 0.25, 0.62, white)
    K.rod((0, -3.2, 0.9), (0, -3.2, 0.25), 0.05, grey, BODY, 4)
    wheel(K, 0, -3.2, 0.25, 0.12)
    wing(K, 3.0, 4.0, 1.58, 1.66, 3.4, white, 0.7)
    K.oface([Vector((0, 2.6, 1.75)), Vector((0, 4.0, 1.7)), Vector((0, 4.05, 2.72)), Vector((0, 3.4, 2.72))], Vector((-1, 3.4, 2)), white)
    K.oface([Vector((0, 2.6, 1.75)), Vector((0, 4.0, 1.7)), Vector((0, 4.05, 2.72)), Vector((0, 3.4, 2.72))], Vector((1, 3.4, 2)), white)
    K.oface([Vector((0, 3.55, 2.35)), Vector((0, 4.03, 2.35)), Vector((0, 4.05, 2.72)), Vector((0, 3.4, 2.72))], Vector((-1, 3.7, 2.5)), blue)
    K.oface([Vector((0, 3.55, 2.35)), Vector((0, 4.03, 2.35)), Vector((0, 4.05, 2.72)), Vector((0, 3.4, 2.72))], Vector((1, 3.7, 2.5)), blue)
    K.cyl(0, -4.15, 0.18, 1.12, 1.48, grey, BODY, 6) if False else None
    ces = K.obj('cessna')
    pc = prop_obj('cessna_prop', (0, -4.2, 1.3), 2, 0.95, black, grey)
    pc.parent = ces
    pc.location = (0, -4.2, 1.3)
    # ---- Air Tractor AT-502B crop duster (placed beside the Cessna in the file; the game finds it by name)
    D = PKit(502, ao=0)
    loft(D, [(-5.0, 0.3, 1.6, 2.0), (-4.4, 0.48, 1.25, 2.25), (-2.6, 0.58, 1.05, 2.5), (-0.8, 0.5, 1.0, 2.4), (1.5, 0.35, 1.05, 1.85),
             (4.6, 0.12, 0.95, 1.25), (5.2, 0.05, 1.0, 1.2)], yellow, (1.6, 1.75, black))
    D.oface([Vector((-0.45, -1.3, 2.42)), Vector((0.45, -1.3, 2.42)), Vector((0.35, -0.9, 3.0)), Vector((-0.35, -0.9, 3.0))], Vector((0, 0, 2.5)), glass)
    for sd in (-1, 1):
        D.oface([Vector((sd * 0.45, -1.3, 2.42)), Vector((sd * 0.45, 0.4, 2.3)), Vector((sd * 0.35, 0.4, 2.85)), Vector((sd * 0.35, -0.9, 3.0))], Vector((0, -0.5, 2.6)), glass)
    D.box(-0.35, 0.35, -0.9, 0.4, 2.85, 3.0, yellow)
    D.oface([Vector((-0.35, 0.4, 2.85)), Vector((0.35, 0.4, 2.85)), Vector((0.35, 1.5, 1.85)), Vector((-0.35, 1.5, 1.85))], Vector((0, 0, 1.5)), yellow)
    wing(D, -2.9, -1.0, 1.15, 1.35, 15.85, yellow, 0.9)
    for sd in (-1, 1):
        D.rod((sd * 0.6, -0.9, 1.0), (sd * 7.0, -0.9, 1.0), 0.03, grey, BODY, 4)
        D.rod((sd * 0.5, -2.6, 1.1), (sd * 1.4, -2.4, 0.45), 0.07, grey, BODY, 4)
        wheel(D, sd * 1.45, -2.4, 0.45, 0.22)
        D.box(sd * 7.92 - 0.06, sd * 7.92 + 0.06, -2.9, -1.0, 1.15, 1.45, black)
    D.rod((0, 4.9, 1.0), (0, 5.0, 0.15), 0.03, grey, BODY, 4)
    wheel(D, 0, 5.0, 0.15, 0.08)
    wing(D, 4.1, 5.0, 1.3, 1.4, 4.6, yellow, 0.75)
    for sd in (-1, 1):
        D.oface([Vector((0, 3.6, 1.25)), Vector((0, 5.2, 1.2)), Vector((0, 5.25, 3.0)), Vector((0, 4.4, 3.0))], Vector((sd, 4.5, 2)), yellow)
    dus = D.obj('cropduster')
    # both roots sit at the origin (planes.js clones each root with its transform)
    pd = prop_obj('cropduster_prop', (0, -5.05, 1.8), 3, 1.35, black, grey)
    pd.parent = dus
    pd.location = (0, -5.05, 1.8)
    # export with materials, normals (planes.js lights them like cars)
    path = OUT + 'planes.glb'
    for o in bpy.context.scene.objects:
        o.select_set(o.name in ('cessna', 'cropduster', 'cessna_prop', 'cropduster_prop'))
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_texcoords=False,
              export_normals=True, export_materials='EXPORT', export_animations=False, export_extras=False, export_cameras=False, export_lights=False)
    bpy.ops.export_scene.gltf(**kw)
    bpy.data.libraries.write(SRC + 'planes.blend', {bpy.context.scene}, fake_user=True, compress=True)
    res = {'kb': os.path.getsize(path) // 1024, 'tris': {o.name: tris(o) for o in (ces, dus, pc, pd)}}
    if render:
        tmp = '/private/tmp/claude-501/-Users-dainmoens-Documents-Tim-Arnett-Town/392d4b1d-feae-4f8b-b8db-07c7ac05def9/scratchpad/'
        lm_preview(tmp + 'planes_0.png', (2, 0, 1.4), 22, -35, 20, (900, 600), 35)
        bpy.context.scene.display.shading.color_type = 'MATERIAL'
        bpy.ops.render.render(write_still=True)
        lm_preview(tmp + 'planes_1.png', (2, 0, 1.4), 22, 150, 12, (900, 600), 35)
        bpy.context.scene.display.shading.color_type = 'MATERIAL'
        bpy.ops.render.render(write_still=True)
        res['png'] = [tmp + 'planes_0.png', tmp + 'planes_1.png']
    return res


B['planes'] = planes


# ================================================================ MOLINE / ROCK ISLAND / ARSENAL / AIRPORT
def rbox(K, R, u0, u1, v0, v1, h0, h1, col, m=BODY, skip=('h-',)):
    """box in a rotated room frame R(u, v)"""
    K.obox(lambda u, h, d: (*R(u, d), h), u0, u1, h0, h1, v0, v1, col, m, skip)


def rpoly(R, u0, u1, v0, v1):
    return ccw([R(u0, v0), R(u1, v0), R(u1, v1), R(u0, v1)])


def tractor(K, R, u, v, a, s=1.0, green=lin('#367c2b'), yellow=lin('#ffde00')):
    """a green tractor in room frame R at (u, v) facing angle a (radians, 0 = +u)"""
    ca, sa = math.cos(a), math.sin(a)
    T = lambda x, h, y: (*R(u + (x * ca - y * sa) * s, v + (x * sa + y * ca) * s), h * s)
    K.obox(T, -1.6, 1.2, 0.8, 1.7, -0.5, 0.5, green, BODY, ('h-',))     # hood/body
    K.obox(T, -1.2, 0.2, 1.7, 2.9, -0.7, 0.7, lin('#2b3a46'), GLASS, ('h-',))  # cab glass
    K.obox(T, -1.3, 0.3, 2.9, 3.05, -0.8, 0.8, green, BODY, ())
    for x, r, y in ((-0.9, 0.85, 0.95), (1.0, 0.5, 0.75)):
        for sd in (-1, 1):
            K.rod(T(x, r, sd * (y - 0.2)), T(x, r, sd * (y + 0.25)), r * s, lin('#151515'), BODY, 8)
            K.obox(T, x - r * 0.4, x + r * 0.4, r - r * 0.4, r + r * 0.4, sd * (y + 0.26) - 0.01, sd * (y + 0.26) + 0.01, yellow, BODY, ())


# JOHN DEERE PAVILION (1400 River Dr, Moline, 1997): a 14,000 sq ft glass hall on a green steel frame, the grid
# turned 26 deg, doors toward River Drive (north-west long side). Interior: the machines, old and new.
def pavilion(render=True):
    anchor = (4980.0, 1778.0)
    rot = 0.4545
    R = room_frame(anchor, 4980.05, 1778.1, rot)
    green, yellow, glass, conc = lin('#367c2b'), lin('#ffde00'), lin('#9fc6d8'), lin('#c4bdb0')
    w, d, H = 49.0, 32.2, 11.0
    P = rpoly(R, -w / 2, w / 2, -d / 2, d / 2)
    K = Kit(601)
    door_i = next(i for i, L, Ln, mid in sides(P) if Ln > 40 and math.hypot(mid[0] - R(0, -d / 2)[0], mid[1] - R(0, -d / 2)[1]) < 1)
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, -3, 0.6, 0, conc)
        if i == door_i:
            K.quad(L, 0, Ln / 2 - 3, 0.6, H, 0, glass, LIT)
            K.quad(L, Ln / 2 + 3, Ln, 0.6, H, 0, glass, LIT)
            K.quad(L, Ln / 2 - 3, Ln / 2 + 3, 3.2, H, 0, glass, LIT)
        else:
            K.quad(L, 0, Ln, 0.6, H, 0, glass, LIT)
        for k in range(int(Ln // 3.0) + 1):
            u = min(Ln, k * 3.0)
            K.obox(L, u - 0.15, u + 0.15, 0, H, 0, 0.3, green, BODY, ('d-', 'h-', 'h+'))
        for h in (3.2, 7.0):
            K.obox(L, 0, Ln, h - 0.12, h + 0.12, 0, 0.3, green, BODY, ('d-',))
        K.obox(L, -0.3, Ln + 0.3, H, H + 1.2, -0.1, 0.5, green, BODY, ('d-',))
    K.prism(P, H, H + 0.05, lin('#8a9096'), sides=False)
    # raised glass clerestory along the middle
    Pc = rpoly(R, -w / 2 + 4, w / 2 - 4, -5, 5)
    for i, L, Ln, mid in sides(Pc):
        K.quad(L, 0, Ln, H, H + 3.5, 0, glass, LIT)
    K.prism(Pc, H + 3.5, H + 3.7, green, sides=False)
    L, Ln = frame(*[P[door_i], P[(door_i + 1) % len(P)]])
    K.text('JOHN DEERE PAVILION', L, Ln / 2, H + 0.1, 0.52, 0.9, yellow, NEON, 0.06, res=1)
    for k, (u, v, a) in enumerate(((-30, -22, 0.4), (-26, -26, 0.2), (28, -21, 2.8))):  # new machines out front
        tractor(K, R, u + 0.0 if False else u * 0.6, v, a, 1.2)
    lod0 = K.obj('pavilion_lod0')
    KI = Kit(602, ao=0)
    rhall_ = lambda: None
    # interior hall (room coords), concrete floor, the exhibits
    c = (*R(0, 0), 5)
    for i in range(12):
        for j in range(8):
            u0, v0 = -w / 2 + 0.5 + i * 4.0, -d / 2 + 0.5 + j * 3.9
            iface(KI, [(*R(u0, v0), 0.02), (*R(u0 + 4.0, v0), 0.02), (*R(u0 + 4.0, v0 + 3.9), 0.02), (*R(u0, v0 + 3.9), 0.02)], c, lin('#b9b6ae') if (i + j) % 2 else lin('#c4c1b9'))
    iface(KI, [(*R(-w / 2 + 0.5, -d / 2 + 0.5), H - 0.1), (*R(w / 2 - 0.5, -d / 2 + 0.5), H - 0.1), (*R(w / 2 - 0.5, d / 2 - 0.5), H - 0.1), (*R(-w / 2 + 0.5, d / 2 - 0.5), H - 0.1)], c, lin('#dfe6ea'), LIT)
    for k, (u, v, a, sc) in enumerate(((-15, -6, 0.3, 1.3), (-4, 5, 2.9, 1.0), (8, -6, 0.0, 1.5), (16, 6, 3.3, 1.0), (-17, 8, 1.6, 0.9))):
        tractor(KI, R, u, v, a, sc)
    # the 1949 combine: a long green body with a yellow header
    rbox(KI, R, 2, 11, 9, 13, 0.6, 3.6, lin('#367c2b'))
    rbox(KI, R, -0.5, 2, 8, 14, 0.2, 1.2, lin('#ffde00'))
    for vv in (9.2, 12.8):
        KI.rod((*R(8, vv), 0.8), (*R(8, vv + (0.3 if vv > 11 else -0.3)), 0.8), 0.8, lin('#151515'), BODY, 8)
    # 'For Generations' display wall and the store counter
    rbox(KI, R, -w / 2 + 1, -w / 2 + 1.4, -10, 10, 0, 4, lin('#367c2b'))
    KI.text('FOR GENERATIONS', lambda u, h, dd: (*R(-w / 2 + 1.41 + dd, -u), h), 0, 2.4, 0.0, 0.9, yellow, BODY, 0.04, res=1)
    rbox(KI, R, w / 2 - 6, w / 2 - 2, d / 2 - 3, d / 2 - 2, 0, 1.1, lin('#3e2418'))
    intr = KI.obj('pavilion_int')
    K1 = Kit(603)
    K1.prism(P, -3, H, glass, topcol=lin('#8a9096'))
    for i, L, Ln, mid in sides(P):
        K1.quad(L, 0, Ln, H - 1.2, H, 0.05, green)
    lod1 = K1.obj('pavilion_lod1')
    res = finish('pavilion', [lod0, lod1, intr], anchor)
    if render:
        res['png'] = shots('pavilion', (0, 0, 4), 90, lod1, views=((150, 22),))
        res['png'].append(inside_shot('pavilion', (*R(0, -15), 1.7), (*R(0, 5), 1.0)))
    return res


B['pavilion'] = pavilion


# VIBRANT ARENA AT THE MARK (1201 River Dr, Moline, 1993): the round seating bowl under a dark roof with a white
# rim band, the square west block, a glass rotunda entrance with a dark cone roof on the east, charcoal walls with
# purple bands and the lit VIBRANT ARENA rim sign.
def arena(render=True):
    anchor = (4770.0, 1725.0)
    G = g2l(anchor)
    ring = [(4735.7, 1768.7), (4744.2, 1769.8), (4743.8, 1775.6), (4753.1, 1778.5), (4760.4, 1779.1), (4768.6, 1778.8), (4776.6, 1777.1), (4778.3, 1782.9),
            (4788.0, 1778.7), (4799.6, 1772.9), (4807.5, 1764.7), (4813.1, 1757.0), (4817.8, 1746.5), (4828.7, 1750.5), (4832.1, 1738.7), (4830.5, 1730.2),
            (4830.1, 1720.4), (4827.9, 1709.2), (4825.5, 1702.6), (4821.8, 1694.5), (4817.2, 1687.4), (4812.9, 1682.0), (4805.8, 1674.9), (4796.8, 1668.3),
            (4787.7, 1663.8), (4781.9, 1679.6), (4775.5, 1677.6), (4768.5, 1676.3), (4760.0, 1676.1), (4751.2, 1677.4), (4744.1, 1679.2), (4744.0, 1685.3),
            (4711.1, 1684.9), (4710.4, 1704.4), (4704.1, 1714.8), (4703.8, 1740.2), (4711.6, 1750.9), (4710.6, 1768.1)]
    P = ccw([G(*p) for p in ring])
    char, purple, white, roofc, glass = lin('#6b6e73'), lin('#5b2c83'), lin('#e8e8e8'), lin('#2c2f36'), lin('#3a5566')
    K = Kit(611)
    H = 24.0
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, -3, H, 0, char)
        K.quad(L, 0, Ln, 4.0, 5.2, 0.03, purple)
        K.quad(L, 0, Ln, H - 3.0, H, 0.05, white)
        if Ln > 6:
            K.quad(L, 0.5, Ln - 0.5, 0.4, 3.6, 0.04, glass, LIT)
    K.prism(P, H - 0.1, H, roofc, sides=False)
    # the bowl's roof rises in a shallow dome over the round part
    cx, cy = G(4780, 1725)
    for k in range(16):
        a0, a1 = k * math.pi / 8, (k + 1) * math.pi / 8
        K.face([(cx + math.cos(a0) * 40, cy + math.sin(a0) * 40, H), (cx + math.cos(a1) * 40, cy + math.sin(a1) * 40, H), (cx + math.cos(a1) * 18, cy + math.sin(a1) * 18, H + 4), (cx + math.cos(a0) * 18, cy + math.sin(a0) * 18, H + 4)], roofc)
    K.cyl(cx, cy, 18, H + 4, H + 4.01, roofc, BODY, 16)
    rooftop_junk(K, *G(4725, 1725), H, K.rnd, 4, 10)
    # glass rotunda entrance (east) with a dark cone roof and the name on the rim facing it
    rx, ry = G(4832, 1740)
    K.cyl(rx, ry, 8, -3, 12, glass, LIT, 12)
    K.cyl(rx, ry, 8.4, 12, 18, roofc, BODY, 12, r1=1.0)
    for k in range(12):
        a = k * math.pi / 6
        K.box(rx + math.cos(a) * 8.05 - 0.15, rx + math.cos(a) * 8.05 + 0.15, ry + math.sin(a) * 8.05 - 0.15, ry + math.sin(a) * 8.05 + 0.15, 0, 12, white)
    for (gx, gz) in ((4806, 1677), (4813, 1764), (4776, 1779), (4790, 1665)):
        sx, sy = G(gx, gz)
        ox, oy = sx - cx, sy - cy
        ol = math.hypot(ox, oy)
        ox, oy = ox / ol, oy / ol  # facing out from the bowl
        F = lambda u, h, dd, sx=sx, sy=sy, ox=ox, oy=oy: (sx - oy * u + ox * dd, sy + ox * u + oy * dd, h)
        K.text('VIBRANT ARENA', F, 0, H - 2.75, 0.3, 2.5, purple, NEON, 0.15, res=1)
    lod0 = K.obj('arena_lod0')
    K1 = Kit(612)
    K1.prism(P, -3, H, char, topcol=roofc)
    for i, L, Ln, mid in sides(P):
        K1.quad(L, 0, Ln, H - 3, H, 0.05, white)
    K1.cyl(rx, ry, 8, -3, 12, glass, LIT, 8)
    K1.cyl(rx, ry, 8.4, 12, 18, roofc, BODY, 8, r1=1.0)
    lod1 = K1.obj('arena_lod1')
    res = finish('arena', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('arena', (10, 0, 8), 200, lod1, views=((60, 25),))
    return res


B['arena'] = arena


# ROCK ISLAND ARSENAL CLOCK TOWER BUILDING (Storehouse A, 1864-67): 180 x 60 ft of buff LeClaire limestone, three
# storeys and an attic under a slate roof with gabled ends, the 117 ft square tower on the NW (lock) front with
# four 12 ft clock faces and a pyramid roof; the east wing behind.
def clocktower(render=True):
    anchor = (1140.0, 778.0)
    rot = 0.624
    R = room_frame(anchor, 1140.9, 778.0, rot)  # long axis NE-SW (u), v toward the back (SE)
    lime, lime2, slate, face = lin('#cfc4ae'), lin('#b8ac94'), lin('#4d4f55'), lin('#f4f1e6')
    w, d, eave, ridge = 56.0, 18.3, 15.0, 22.0
    P = rpoly(R, -w / 2, w / 2, -d / 2, d / 2)
    K = Kit(621)
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, -3, 1.2, 0.02, lin('#a89c84'))
        if Ln > 30:
            windows(K, L, 0.8, Ln - 0.8, 1.2, 4.4, 3, max(1, round(Ln / 3.4)), lime, wf=0.45, hf=0.62, rec=0.35, sill=lime2, glass=GLASS_C, lit=0.35)
            K.quad(L, 0, Ln, 1.2 + 13.2, eave, 0, lime)
        else:
            windows(K, L, 0.8, Ln - 0.8, 1.2, 4.4, 3, 4, lime, wf=0.45, hf=0.62, rec=0.35, sill=lime2, lit=0.35)
            K.quad(L, 0, Ln, 14.4, eave, 0, lime)
            # gable end
            K.face([L(0, eave, 0), L(Ln, eave, 0), L(Ln / 2, ridge, 0)], lime)
        belt(K, L, 0, Ln, 1.0, lime2)
        belt(K, L, 0, Ln, eave - 0.5, lime2, 0.4, 0.5)
    for s in (-1, 1):  # slate roof planes
        K.oface([Vector((*R(-w / 2 - 0.4, s * (d / 2 + 0.6)), eave - 0.3)), Vector((*R(w / 2 + 0.4, s * (d / 2 + 0.6)), eave - 0.3)), Vector((*R(w / 2 + 0.4, 0), ridge + 0.2)), Vector((*R(-w / 2 - 0.4, 0), ridge + 0.2))],
                Vector((*R(0, 0), 0)), slate)
    for u in (-w / 2, w / 2):
        K.oface([Vector((*R(u, -d / 2 - 0.6), eave - 0.3)), Vector((*R(u, d / 2 + 0.6), eave - 0.3)), Vector((*R(u, 0), ridge + 0.2))], Vector((*R(0, 0), eave)), slate)
    # chimneys
    for u in (-18, 18):
        rbox(K, R, u - 0.8, u + 0.8, -1, 1, ridge - 2, ridge + 2.5, lime2)
    # the tower: 7.6 m square on the front centre, clock stage, pyramid roof
    tw = 3.8
    T = rpoly(R, -tw, tw, -d / 2 - 2 * tw + 1.0, -d / 2 + 1.0)
    for i, L, Ln, mid in sides(T):
        K.quad(L, 0, Ln, -3, 27.0, 0, lime)
        windows(K, L, 1.6, Ln - 1.6, 2.0, 5.0, 4, 1, lime, wf=0.5, hf=0.6, rec=0.4, edge=0, lit=0.3)
        belt(K, L, 0, Ln, 22.0, lime2, 0.3, 0.6)
        K.quad(L, 0, Ln, 27.0, 31.5, 0, lime)
        # the clock face
        cxu = Ln / 2
        pts = [L(cxu + math.cos(k * math.pi / 8) * 1.8, 27.8 + 1.8 + math.sin(k * math.pi / 8) * 1.8, 0.08) for k in range(16)]
        K.face(pts, face, NEON)
        K.face([L(cxu - 0.08, 29.6, 0.12), L(cxu + 0.08, 29.6, 0.12), L(cxu + 0.08, 31.0, 0.12), L(cxu - 0.08, 31.0, 0.12)], lin('#111111'))
        K.face([L(cxu - 0.06, 29.5, 0.12), L(cxu + 0.9, 29.5, 0.12), L(cxu + 0.9, 29.66, 0.12), L(cxu - 0.06, 29.66, 0.12)], lin('#111111'))
        K.obox(L, -0.3, Ln + 0.3, 31.5, 32.2, -0.1, 0.4, lime2, BODY, ('d-',))
    tc = Vector((0, 0, 0))
    for p in T:
        tc += Vector((p[0], p[1], 0))
    tc /= 4
    for i in range(4):
        a, b = T[i], T[(i + 1) % 4]
        K.face([(a[0] + (a[0] - tc.x) * 0.1, a[1] + (a[1] - tc.y) * 0.1, 32.2), (b[0] + (b[0] - tc.x) * 0.1, b[1] + (b[1] - tc.y) * 0.1, 32.2), (tc.x, tc.y, 36.0)], slate)
    K.cyl(tc.x, tc.y, 0.1, 36, 37.5, lin('#2a2a2a'), BODY, 4)
    # east wing behind (the annex part of the OSM outline)
    Gq = g2l(anchor)
    Wg = ccw([Gq(1146.2, 766.4), Gq(1163.9, 753.4), Gq(1175.9, 769.8), Gq(1161.4, 780.3)])
    for i, L, Ln, mid in sides(Wg):
        windows(K, L, 0.6, Ln - 0.6, 0, 4.2, 3, max(1, round(Ln / 3.4)), lime, wf=0.45, hf=0.6, rec=0.3, lit=0.3)
    roof(K, Wg, 12.6, slate)
    lod0 = K.obj('clocktower_lod0')
    K1 = Kit(622)
    K1.prism(P, -3, eave, lime, top=False)
    for s in (-1, 1):
        K1.oface([Vector((*R(-w / 2, s * d / 2), eave)), Vector((*R(w / 2, s * d / 2), eave)), Vector((*R(w / 2, 0), ridge)), Vector((*R(-w / 2, 0), ridge))], Vector((*R(0, 0), 0)), slate)
    for u in (-w / 2, w / 2):
        K1.oface([Vector((*R(u, -d / 2), eave)), Vector((*R(u, d / 2), eave)), Vector((*R(u, 0), ridge))], Vector((*R(0, 0), eave)), lime)
    K1.prism(T, -3, 32.2, lime, topcol=slate)
    for i in range(4):
        a, b = T[i], T[(i + 1) % 4]
        K1.face([(a[0], a[1], 32.2), (b[0], b[1], 32.2), (tc.x, tc.y, 36.0)], slate)
    K1.prism(Wg, -3, 12.6, lime, topcol=slate)
    lod1 = K1.obj('clocktower_lod1')
    res = finish('clocktower', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('clocktower', (*R(0, -10), 12), 110, lod1, views=((-150, 15),))
    return res


B['clocktower'] = clocktower


# LOCK AND DAM 15 (1934): the 1,203 ft roller dam, 11 roller gates between 12 concrete piers, each pier carrying a
# hipped machinery house, under the open-truss service bridge; set skew across the river from the Iowa bank
# (game 581.9, 430.1) to the Arsenal (875.4, 669.0). Origin: the middle of the dam at the water line.
def lockdam(render=True):
    a0, a1 = (581.9, 430.1), (875.4, 669.0)
    anchor = ((a0[0] + a1[0]) / 2, (a0[1] + a1[1]) / 2)
    G = g2l(anchor)
    ex, ey = G(*a1)
    Ld = math.hypot(ex, ey)
    ux, uy = ex / Ld, ey / Ld
    nx, ny = -uy, ux
    A = lambda s, t, h: (ux * s + nx * t, uy * s + ny * t, h)  # s along the dam, t across (upstream +)
    conc, roller, house, steel, roofc = lin('#b9b6ae'), lin('#5a5f63'), lin('#d8d2c2'), lin('#3d4a52'), lin('#6a4a3a')
    K = Kit(631, ao=0)
    n = 11
    piers = [-Ld / 2 + Ld * k / n for k in range(n + 1)]
    F = lambda u, h, d: A(u, d, h)
    for k, s in enumerate(piers):
        K.obox(F, s - 2.2, s + 2.2, -6, 13.0, -9, 9, conc, BODY, ('h-',))
        K.obox(F, s - 1.6, s + 1.6, -6, 3.0, -14, -9, conc, BODY, ('h-',))  # nose upstream
        # machinery house with a hipped roof
        K.obox(F, s - 2.6, s + 2.6, 13.0, 17.5, -3.5, 3.5, house, BODY, ('h-',))
        for j in range(2):
            K.quad(lambda u, h, d, s=s, j=j: A(u, (3.5 if j else -3.5) + (d if j else -d), h), s - 1.4, s + 1.4, 14.5, 16.5, 0.02, lin('#2b3a46') if (k + j) % 2 else lin('#ffe1a0'), GLASS if (k + j) % 2 else LIT) if False else None
        cx_, cy_, _ = A(s, 0, 0)
        hip = [A(s - 3.0, -4.0, 17.5), A(s + 3.0, -4.0, 17.5), A(s + 3.0, 4.0, 17.5), A(s - 3.0, 4.0, 17.5)]
        top = [A(s, -1.5, 20.0), A(s, 1.5, 20.0)]
        K.oface([Vector(hip[0]), Vector(hip[1]), Vector(top[0])], Vector((cx_, cy_, 17)), roofc)
        K.oface([Vector(hip[2]), Vector(hip[3]), Vector(top[1])], Vector((cx_, cy_, 17)), roofc)
        K.oface([Vector(hip[1]), Vector(hip[2]), Vector(top[1]), Vector(top[0])], Vector((cx_, cy_, 17)), roofc)
        K.oface([Vector(hip[3]), Vector(hip[0]), Vector(top[0]), Vector(top[1])], Vector((cx_, cy_, 17)), roofc)
        for side in (-1, 1):  # windows on the house
            K.quad(lambda u, h, d, side=side, s=s: A(s + u, side * (3.5 + d), h) if side > 0 else A(s - u, side * (3.5 + d), h), -1.6, 1.6, 14.4, 16.6, 0.03, lin('#ffe1a0') if k % 2 else GLASS_C, LIT if k % 2 else GLASS)
    # roller gates: long horizontal drums between the piers, half in the water
    for k in range(n):
        s0, s1 = piers[k] + 2.2, piers[k + 1] - 2.2
        K.rod(A(s0, 0, 1.0), A(s1, 0, 1.0), 3.2, roller, BODY, 10)
        K.obox(F, s0, s1, -1.0, 4.4, -1.6, 1.6, scale(roller, 0.9), BODY, ('h-',)) if False else None
        # white water over the downstream apron
        K.face([A(s0, -3.5, 0.05), A(s1, -3.5, 0.05), A(s1, -9.0, 0.02), A(s0, -9.0, 0.02)], lin('#e6eef2'))
    # service bridge: two trusses along the top
    for t in (-2.6, 2.6):
        K.obox(F, -Ld / 2, Ld / 2, 17.5, 17.9, t - 0.2, t + 0.2, steel, BODY, ())
        K.obox(F, -Ld / 2, Ld / 2, 21.5, 21.9, t - 0.2, t + 0.2, steel, BODY, ())
        for k in range(int(Ld / 5)):
            s = -Ld / 2 + k * 5
            K.rod(A(s, t, 17.9), A(s + 5, t, 21.5), 0.12, steel, BODY, 4)
            K.rod(A(s, t, 17.9), A(s, t, 21.5), 0.12, steel, BODY, 4)
    K.obox(F, -Ld / 2, Ld / 2, 17.5, 17.7, -2.6, 2.6, steel, BODY, ())
    lod0 = K.obj('lockdam_lod0')
    K1 = Kit(632, ao=0)
    for s in piers:
        K1.obox(F, s - 2.2, s + 2.2, -6, 17.5, -9, 9, conc, BODY, ('h-',))
    for k in range(n):
        K1.obox(F, piers[k] + 2.2, piers[k + 1] - 2.2, -2.0, 4.0, -2.5, 2.5, roller, BODY, ('h-',))
    K1.obox(F, -Ld / 2, Ld / 2, 17.5, 21.9, -2.6, 2.6, steel, BODY, ('h-',))
    lod1 = K1.obj('lockdam_lod1')
    res = finish('lockdam', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('lockdam', (0, 0, 5), 320, lod1, views=((30, 18),))
    return res


B['lockdam'] = lockdam


# THE LOCKS at Lock 15 (main 110 x 600 ft, auxiliary 110 x 360 ft alongside to the NW): concrete walls, mitre
# gates, the lock control house on the middle wall. Origin: the main lock's centre at the water line.
def lock15(render=True):
    p0, p1 = (1060.1, 655.4), (1206.8, 511.7)
    anchor = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
    G = g2l(anchor)
    ex, ey = G(*p1)
    Lm = 183.0
    ux, uy = ex / math.hypot(ex, ey), ey / math.hypot(ex, ey)
    nx, ny = -uy, ux
    A = lambda s, t, h: (ux * s + nx * t, uy * s + ny * t, h)
    F = lambda u, h, d: A(u, d, h)
    conc, gate, house, roofc = lin('#c4bfb4'), lin('#4a5a64'), lin('#e8e2d0'), lin('#6a4a3a')
    K = Kit(641, ao=0)
    # walls: river wall (t -20), middle wall (t +20 .. +26), land wall of the auxiliary lock (t +60)
    W = [(-23.0, -16.8, -Lm / 2 - 20, Lm / 2 + 20), (16.8, 23.5, -Lm / 2 - 30, Lm / 2 + 30), (57.0, 63.0, -20, Lm / 2 + 30)]
    for t0, t1, s0, s1 in W:
        K.obox(F, s0, s1, -8, 5.0, t0, t1, conc, BODY, ('h-',))
        for k in range(int((s1 - s0) / 12)):
            s = s0 + 6 + k * 12
            K.box(*[0] * 0, *(), *()) if False else None
            K.obox(F, s - 0.2, s + 0.2, 5.0, 5.6, (t0 + t1) / 2 - 0.2, (t0 + t1) / 2 + 0.2, lin('#ffd54f'), BODY, ())  # bollards
    # lock water level marks and mitre gates at both ends of both chambers
    for (t0, t1) in ((-16.8, 16.8), (23.5, 57.0)):
        for s in (-Lm / 2, Lm / 2) if t0 < 0 else (-10, Lm / 2):
            for side in (-1, 1):
                tt = t0 if side < 0 else t1
                K.obox(F, s - 0.6, s + 0.6, -4, 4.6, min(tt, (t0 + t1) / 2), max(tt, (t0 + t1) / 2), gate, BODY, ('h-',))
            K.obox(F, s - 0.8, s + 0.8, 4.6, 5.2, t0, t1, gate, BODY, ())  # walkway on the gate
    # control house on the middle wall
    cs = 0
    K.obox(F, cs - 6, cs + 6, 5.0, 11.0, 17.3, 23.0, house, BODY, ('h-',))
    for side, t in ((-1, 17.3), (1, 23.0)):
        K.quad(lambda u, h, d, side=side, t=t: A(cs + u * side, t + side * d, h), -5, 5, 7.2, 10.0, 0.03, lin('#ffe1a0'), LIT)
    K.obox(F, cs - 6.8, cs + 6.8, 11.0, 11.6, 16.6, 23.7, roofc, BODY, ())
    K.text('LOCK 15', lambda u, h, d: A(cs + u, 17.3 - d, h), 0, 11.8, 0.0, 1.2, lin('#1d3c6e'), BODY, 0.05, res=1) if False else None
    lod0 = K.obj('lock15_lod0')
    K1 = Kit(642, ao=0)
    for t0, t1, s0, s1 in W:
        K1.obox(F, s0, s1, -8, 5.0, t0, t1, conc, BODY, ('h-',))
    K1.obox(F, cs - 6, cs + 6, 5.0, 11.6, 17.3, 23.0, house, BODY, ('h-',))
    lod1 = K1.obj('lock15_lod1')
    res = finish('lock15', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('lock15', (0, 0, 3), 220, lod1, views=((40, 25),))
    return res


B['lock15'] = lock15


def outward(L):
    a, b = Vector(L(0, 0, 0)), Vector(L(0, 0, 1))
    return b - a


# AUGUSTANA COLLEGE OLD MAIN (1884-93): 54 x 24 m, three storeys of buff LeClaire limestone (rough ground floor,
# smooth above), a central pediment on four two-storey pilasters over the north doors, end pediments, and the
# copper dome (blue-green patina) on a balustraded drum with a columned cupola.
def oldmain(render=True):
    anchor = (2333.0, 2126.5)
    G = g2l(anchor)
    out = [(2307.4, 2116.8), (2315.8, 2116.8), (2315.8, 2117.5), (2325.5, 2117.6), (2325.5, 2114.8), (2340.3, 2114.9), (2340.3, 2118.1), (2350.7, 2118.2),
           (2350.8, 2116.6), (2359.1, 2116.7), (2359.0, 2123.5), (2360.3, 2123.6), (2360.2, 2130.3), (2358.6, 2130.3), (2358.6, 2136.9), (2351.5, 2136.9),
           (2351.5, 2135.5), (2340.1, 2135.5), (2340.1, 2138.5), (2326.7, 2138.5), (2326.7, 2135.8), (2315.1, 2135.8), (2315.1, 2137.5), (2308.3, 2137.5),
           (2308.3, 2129.2), (2306.4, 2129.2), (2306.4, 2124.4), (2307.4, 2124.4)]
    P = ccw([G(*p) for p in out])
    lime, lime2, rough, cop, roofc = lin('#d8c9a3'), lin('#c6b68e'), lin('#b8a882'), lin('#6fa08f'), lin('#55534f')
    K = Kit(651)
    fl = [5.0, 4.6, 4.6]
    top = sum(fl)
    for i, L, Ln, mid in sides(P):
        if Ln < 3.5:
            K.quad(L, 0, Ln, -3, top, 0, lime)
            continue
        nb = max(1, round((Ln - 1.2) / 3.0))
        K.quad(L, 0, Ln, -3, 0.8, 0, rough)
        windows(K, L, 0.6, Ln - 0.6, 0.8, fl[0] - 0.8, 1, nb, rough, wf=0.45, hf=0.62, rec=0.35, lit=0.35)
        windows(K, L, 0.6, Ln - 0.6, fl[0], fl[1], 2, nb, lime, wf=0.42, hf=0.68, rec=0.35, lit=0.4, sill=lime2, head=lime2)
        belt(K, L, 0, Ln, fl[0] - 0.3, lime2, 0.25, 0.35)
        cornice(K, L, 0, Ln, top + 1.2, lime2, 0.9, 1.2, brackets=0)
        K.obox(L, 0, Ln, top + 1.2, top + 2.0, -0.2, 0.1, lime, BODY, ('h-',))
    roof(K, P, top + 1.2, roofc)
    # central pediment on four pilasters over the north doors (the projecting bay x 2325.5..2340.3)
    x0, x1 = G(2325.5, 0)[0], G(2340.3, 0)[0]
    yN = G(0, 2114.8)[1]
    F = lambda u, h, d: (x0 + u, yN + d, h)
    Wd = x1 - x0
    for k in range(4):
        u = 1.2 + k * (Wd - 2.4) / 3
        K.obox(F, u - 0.5, u + 0.5, fl[0], top, 0, 0.5, lime2, BODY, ('d-', 'h-'))
    K.obox(F, -0.3, Wd + 0.3, top, top + 1.4, 0, 0.8, lime2, BODY, ('d-',))
    K.oface([Vector(F(-0.3, top + 1.4, 0.6)), Vector(F(Wd + 0.3, top + 1.4, 0.6)), Vector(F(Wd / 2, top + 5.0, 0.6))], Vector(F(Wd / 2, top + 2, -3)), lime)
    for sgn in (0, 1):
        a = Vector(F(-0.3 if not sgn else Wd + 0.3, top + 1.4, 0.8))
        b = Vector(F(Wd / 2, top + 5.2, 0.8))
        K.oface([a, b, Vector((b.x, b.y - 6, b.z)), Vector((a.x, a.y - 6, a.z))], Vector(F(Wd / 2, top, -3)), roofc)
    K.quad(F, Wd / 2 - 1.6, Wd / 2 + 1.6, 0.3, 3.4, 0.05, lin('#ffe1a0'), LIT)
    for k in range(6):  # steps
        K.obox(F, Wd / 2 - 3 - k * 0.2, Wd / 2 + 3 + k * 0.2, -0.3 - 0.0, 0.3 - k * 0.05 if False else 0.25 * (6 - k) * 0.2 + 0.0, k * 0.4, (k + 1) * 0.4 + 0.4, lime2, BODY, ('h-', 'd-')) if False else None
    # dome: square base, balustraded drum, dome, cupola
    cx, cy = G(2333.0, 2126.5)
    K.box(cx - 6, cx + 6, cy - 6, cy + 6, top, top + 3.5, lime)
    K.cyl(cx, cy, 5.2, top + 3.5, top + 8.5, lime, BODY, 16)
    for k in range(16):
        a = k * math.pi / 8
        K.box(cx + math.cos(a) * 5.3 - 0.25, cx + math.cos(a) * 5.3 + 0.25, cy + math.sin(a) * 5.3 - 0.25, cy + math.sin(a) * 5.3 + 0.25, top + 3.5, top + 8.5, lime2)
    K.cyl(cx, cy, 5.6, top + 8.5, top + 9.2, lime2, BODY, 16)
    prev = (5.4, top + 9.2)
    for k in range(1, 7):
        t = k / 6 * math.pi / 2
        cur = (5.4 * math.cos(t), top + 9.2 + 6.5 * math.sin(t))
        K.cyl(cx, cy, prev[0], prev[1], cur[1], cop, BODY, 16, r1=max(0.9, cur[0]), top=False)
        prev = (max(0.9, cur[0]), cur[1])
    K.cyl(cx, cy, 1.1, prev[1], prev[1] + 2.4, lime, BODY, 8)
    K.cyl(cx, cy, 1.3, prev[1] + 2.4, prev[1] + 3.6, cop, BODY, 8, r1=0.1)
    lod0 = K.obj('oldmain_lod0')
    K1 = Kit(652)
    lod1_bands(K1, P, 0, 3, top / 3, lime)
    roof(K1, P, top + 1.2, roofc)
    K1.cyl(cx, cy, 5.2, top, top + 9.2, lime, BODY, 8)
    K1.cyl(cx, cy, 5.4, top + 9.2, top + 15.7, cop, BODY, 8, r1=1.0)
    lod1 = K1.obj('oldmain_lod1')
    res = finish('oldmain', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('oldmain', (0, 0, 12), 90, lod1, views=((160, 15),))
    return res


B['oldmain'] = oldmain


# FORT ARMSTRONG THEATRE / CIRCA '21 (1828 3rd Ave, Rock Island, 1921): three storeys of Indian-red brick framed in
# ivory terra cotta with polychrome bands, the curved corner at 19th St, the replica marquee hung on chains over the
# 3rd Ave doors (north), the taller plain brick auditorium behind; the speakeasy block next door to the west.
def circa21(render=True):
    anchor = (337.0, 1545.0)
    G = g2l(anchor)
    brick, tc, blue, green, roofc = lin('#8b3a2b'), lin('#ede3c8'), lin('#2f6fb0'), lin('#3f8f5a'), lin('#55534f')
    K = Kit(661)
    # front block (z 1522..1534) with the rounded NE corner, auditorium behind
    fx0, fx1 = G(323.7, 0)[0], G(350.2, 0)[0]
    yF, yB = G(0, 1522.3)[1], G(0, 1534.0)[1]
    r = 4.0
    pts = [(fx0, yB), (fx1, yB)] + [(fx1 - r + math.cos(a) * r, yF - r + math.sin(a) * r) for a in [k * math.pi / 12 for k in range(7)]] + [(fx0, yF)]
    Pf = ccw(pts)
    H = 14.5
    for i, L, Ln, mid in sides(Pf):
        front = mid[1] > yF - 1.0
        K.quad(L, 0, Ln, -3, H, 0, brick)
        if Ln > 6:
            nb = max(1, round(Ln / 3.6))
            windows(K, L, 0.8, Ln - 0.8, 4.6, 4.4, 2, nb, brick, wf=0.55, hf=0.6, rec=0.25, lit=0.5, sill=tc, head=tc)
            for k in range(nb + 1):  # terra cotta piers
                u = 0.8 + k * (Ln - 1.6) / nb
                K.obox(L, u - 0.35, u + 0.35, 0, H, 0, 0.2, tc, BODY, ('d-', 'h-'))
            for h, c in ((4.2, tc), (4.45, blue), (H - 1.6, green), (H - 1.35, tc)):
                K.obox(L, 0, Ln, h, h + 0.25, 0, 0.22, c, BODY, ('d-',))
            if front:
                storefront(K, L, 0.5, Ln - 0.5, 0, 4.0, tc, max(1, round(Ln / 4)))
        else:
            K.obox(L, 0, Ln, 4.2, 4.45, 0, 0.22, tc, BODY, ('d-',))
        K.obox(L, -0.2, Ln + 0.2, H, H + 0.9, -0.1, 0.35, tc, BODY, ('d-',))
    roof(K, Pf, H, roofc)
    # auditorium block
    Pa = ccw([G(325.7, 1534.0), G(349.8, 1534.0), G(349.8, 1567.4), G(325.7, 1567.2)])
    for i, L, Ln, mid in sides(Pa):
        K.quad(L, 0, Ln, -3, 18.0, 0, scale(brick, 0.9))
    roof(K, Pa, 18.0, roofc, par=scale(brick, 0.85), parh=0.8)
    # marquee on chains over the doors (centre of the 3rd Ave front)
    mx = (fx0 + fx1) / 2 - 2
    F = lambda u, h, d: (mx - u, yF + d, h)  # facing north (+y), reading left to right from the street
    K.obox(F, -5, 5, 4.4, 6.4, 0.2, 2.6, lin('#1d1d1f'), BODY, ())
    for side in (-1, 1):
        K.rod(F(side * 4.6, 6.4, 2.4), F(side * 4.6, 9.0, 0.2), 0.04, lin('#2a2a2a'), BODY, 3)
    K.text("CIRCA '21", F, 0, 4.8, 2.62, 1.1, lin('#ffd76a'), NEON, 0.08, res=1)
    for k in range(20):
        K.obox(F, -4.8 + k * 0.5, -4.65 + k * 0.5, 6.25, 6.4, 2.6, 2.7, lin('#fff1c4'), NEON, ())
        K.obox(F, -4.8 + k * 0.5, -4.65 + k * 0.5, 4.4, 4.55, 2.6, 2.7, lin('#fff1c4'), NEON, ())
    iface(K, [F(-4.9, 4.39, 0.3), F(4.9, 4.39, 0.3), F(4.9, 4.39, 2.5), F(-4.9, 4.39, 2.5)], F(0, 0, 1), lin('#fff1c4'), LIT)
    # speakeasy block next door (west): two storeys of brick
    Ps = ccw([G(307.5, 1522.0), G(323.7, 1522.2), G(323.6, 1544.0), G(307.3, 1543.9)])
    for i, L, Ln, mid in sides(Ps):
        K.quad(L, 0, Ln, -3, 9.0, 0, lin('#9a5a44'))
        if Ln > 15:
            windows(K, L, 0.6, Ln - 0.6, 4.2, 4.0, 1, 4, lin('#9a5a44'), wf=0.5, hf=0.6, lit=0.4)
            if mid[1] > yF - 1.0:
                storefront(K, L, 0.4, Ln - 0.4, 0, 4.0, lin('#2a2a2a'), 3)
                K.text('SPEAKEASY', L, Ln / 2, 4.3, 0.15, 0.6, lin('#ff4f9a'), NEON, 0.05, res=1)
    roof(K, Ps, 9.0, roofc, par=lin('#9a5a44'), parh=0.6)
    lod0 = K.obj('circa21_lod0')
    K1 = Kit(662)
    K1.prism(Pf, -3, H, brick, topcol=roofc)
    K1.prism(Pa, -3, 18.0, brick, topcol=roofc)
    K1.prism(Ps, -3, 9.0, lin('#9a5a44'), topcol=roofc)
    lod1 = K1.obj('circa21_lod1')
    res = finish('circa21', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('circa21', (0, 18, 6), 60, lod1, views=((160, 12),))
    return res


B['circa21'] = circa21


# JOHN DEERE WORLD HEADQUARTERS (Eero Saarinen, 1964): the seven-storey administrative building over the ravine,
# a frame of unpainted Cor-Ten weathering steel with deep louvred sunshades over bronze glass, and the two-storey
# display building to the east linked by a glass bridge.
def deerehq(render=True):
    anchor = (12637.0, 5202.0)
    G = g2l(anchor)
    cor, cor2, bronze, roofc = lin('#6a3b22'), lin('#7a4428'), lin('#7a6440'), lin('#4a3a30')
    P = ccw([G(12689.9, 5189.2), G(12687.4, 5223.3), G(12584.4, 5215.8), G(12586.9, 5181.6)])
    K = Kit(671)
    fh, nfl = 4.0, 7
    H = fh * nfl
    for i, L, Ln, mid in sides(P):
        K.quad(L, 0, Ln, -6, H, -0.6, bronze, LIT if False else GLASS)
        for f in range(nfl):  # floor slabs and louvre bands
            h = f * fh
            K.obox(L, -0.4, Ln + 0.4, h + fh - 0.5, h + fh, -0.6, 1.0, cor, BODY, ('d-',))
            for j in range(3):
                K.obox(L, -0.4, Ln + 0.4, h + 1.4 + j * 0.6, h + 1.5 + j * 0.6, 0.4, 1.0, cor2, BODY, ())
            if f % 2:
                for k in range(int(Ln // 3.2)):
                    u = 1 + k * 3.2
                    if K.rnd.random() < 0.4:
                        K.quad(L, u, u + 2.6, h + 0.3, h + 1.3, -0.55, LIT_C, LIT)
        for k in range(int(Ln // 9.15) + 1):  # columns
            u = min(Ln, k * Ln / max(1, int(Ln // 9.15)))
            K.obox(L, u - 0.35, u + 0.35, -6, H, -0.2, 0.6, cor, BODY, ('h-',))
    roof(K, P, H, roofc)
    K.prism(P, -6, 0, lin('#3a2a20'), top=False)
    # display building east
    D_ = ccw([G(12744.7, 5157.4), G(12785.7, 5160.7), G(12784.0, 5181.5), G(12755.2, 5179.2), G(12751.3, 5227.4), G(12721.4, 5240.3), G(12726.6, 5175.7)])
    for i, L, Ln, mid in sides(D_):
        K.quad(L, 0, Ln, -3, 10.7, -0.5, bronze, GLASS)
        for h in (4.6, 10.2):
            K.obox(L, -0.3, Ln + 0.3, h, h + 0.5, -0.5, 0.9, cor, BODY, ('d-',))
        for k in range(int(Ln // 6) + 1):
            u = min(Ln, k * 6)
            K.obox(L, u - 0.3, u + 0.3, -3, 10.7, -0.2, 0.5, cor, BODY, ('h-',))
    roof(K, D_, 10.7, roofc)
    # glass bridge on the 4th floor
    bx0, by0 = G(12689, 5200)
    bx1, by1 = G(12728, 5200)
    K.box(bx0, bx1, by0 - 2, by0 + 2, 12, 15.5, bronze, GLASS, ())
    K.box(bx0, bx1, by0 - 2.2, by0 + 2.2, 15.5, 16.0, cor, BODY, ())
    lod0 = K.obj('deerehq_lod0')
    K1 = Kit(672)
    K1.prism(P, -6, H, bronze, topcol=roofc)
    for i, L, Ln, mid in sides(P):
        for f in range(nfl):
            K1.quad(L, 0, Ln, f * fh + fh - 0.5, f * fh + fh, 0.05, cor)
    K1.prism(D_, -3, 10.7, bronze, topcol=roofc)
    lod1 = K1.obj('deerehq_lod1')
    res = finish('deerehq', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('deerehq', (40, 0, 10), 170, lod1, views=((200, 18),))
    return res


B['deerehq'] = deerehq


# QUAD CITIES INTERNATIONAL AIRPORT (MLI) terminal: the landside hall (1985, renovated 2001 and 2025) under a dark
# slate-teal standing-seam roof with a glass front and entry canopy toward the curb (north-east), Concourses A and B
# on the apron side with jet bridges. Tower and the Elliott hangars are 'mlitower'.
def mli(render=True):
    anchor = (5930.0, 7740.0)
    G = g2l(anchor)
    T = [(5863.6, 7627.4), (5961.9, 7702.3), (5969.1, 7706.2), (6023.6, 7720.1), (6016.6, 7747.5), (6020.8, 7748.8), (6015.8, 7766.7), (5981.2, 7760.3),
         (5960.0, 7751.9), (5942.4, 7763.5), (5927.1, 7794.3), (5936.5, 7798.8), (5912.3, 7843.0), (5900.3, 7836.4), (5886.6, 7823.6), (5892.4, 7807.8),
         (5914.2, 7796.8), (5935.3, 7755.9), (5928.2, 7752.4), (5939.6, 7728.6), (5843.1, 7655.4)]
    A_ = [(5924.1, 7826.3), (5912.3, 7843.0), (5927.2, 7855.9), (5966.9, 7885.5), (5979.7, 7869.4), (5938.9, 7838.2)]
    B_ = [(5892.4, 7807.8), (5824.3, 7753.8), (5827.0, 7750.3), (5798.5, 7735.7), (5788.2, 7749.2), (5793.1, 7752.9), (5790.1, 7756.8), (5831.3, 7788.0),
          (5839.7, 7795.2), (5879.1, 7825.1)]
    roofc, wall, glass, white = lin('#3f5560'), lin('#d9d4c8'), lin('#3a5566'), lin('#eeeeea')
    K = Kit(681)
    for poly, H, rc in ((T, 11.0, roofc), (A_, 7.0, lin('#c9ccd0')), (B_, 7.0, lin('#c9ccd0'))):
        P = ccw([G(*p) for p in poly])
        for i, L, Ln, mid in sides(P):
            K.quad(L, 0, Ln, -3, H, 0, wall)
            n = outward(L)
            if Ln > 8:
                land = poly is T and n.y > 0.3
                K.quad(L, 0.5, Ln - 0.5, 0.4 if land else 3.0, H - 1.2 if land else 5.6, 0.03, glass, LIT)
                if land:
                    for k in range(int(Ln // 3) + 1):
                        u = min(Ln - 0.5, 0.5 + k * 3)
                        K.obox(L, u - 0.08, u + 0.08, 0.4, H - 1.2, 0, 0.15, white, BODY, ('d-', 'h-', 'h+'))
                if poly is not T and n.y < -0.3 and Ln > 20:  # jet bridges off the apron side
                    for k in range(int((Ln - 10) // 28) + 1):
                        u = 8 + k * 28
                        K.obox(L, u - 1.4, u + 1.4, 3.6, 6.2, 0, 17, lin('#b0b4b8'), BODY, ())
                        K.obox(L, u - 2.4, u + 2.4, 3.2, 6.6, 17, 21, lin('#b0b4b8'), BODY, ())
                        K.obox(L, u - 0.4, u + 0.4, 0, 3.2, 18.6, 19.4, lin('#555555'), BODY, ())
            K.obox(L, -0.2, Ln + 0.2, H - 0.8, H + 0.4, -0.1, 0.5, rc, BODY, ('d-',))
        K.prism(P, H - 0.1, H, rc, sides=False)
    # curbside canopy and the name over the doors
    F_, Ln = frame(G(5961.9, 7702.3), G(5863.6, 7627.4))
    K.obox(F_, 20, 100, 4.2, 4.8, 0, 9, white, BODY, ())
    iface(K, [F_(20, 4.19, 0.2), F_(100, 4.19, 0.2), F_(100, 4.19, 8.8), F_(20, 4.19, 8.8)], F_(60, 0, 4), lin('#fff1c4'), LIT)
    K.text('QUAD CITIES INTERNATIONAL AIRPORT', F_, 60, 7.2, 0.55, 1.6, lin('#ffffff'), NEON, 0.1, res=1)
    for k in range(6):
        K.cyl(*F_(25 + k * 15, 0, 8.0)[:2], 0.35, 0, 4.2, white, BODY, 8)
    lod0 = K.obj('mli_lod0')
    K1 = Kit(682)
    for poly, H, rc in ((T, 11.0, roofc), (A_, 7.0, lin('#c9ccd0')), (B_, 7.0, lin('#c9ccd0'))):
        K1.prism(ccw([G(*p) for p in poly]), -3, H, wall, topcol=rc)
    lod1 = K1.obj('mli_lod1')
    res = finish('mli', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('mli', (0, 0, 5), 260, lod1, views=((-150, 30), (30, 30)))
    return res


B['mli'] = mli


# MLI tower ("Moline Tower", white concrete, 10 levels, ~35 m) and the big Elliott Aviation hangar beside it.
def mlitower(render=True):
    anchor = (5698.0, 8971.0)
    G = g2l(anchor)
    white, glass, roofc, metal = lin('#eeeeea'), lin('#2b4a5a'), lin('#4a4f55'), lin('#c4c8cc')
    K = Kit(691)
    K.box(-5.2, 5.2, -5.2, 5.2, -3, 6, white)
    K.cyl(0, 0, 3.0, 6, 30, white, BODY, 8)
    for h in range(9, 30, 3):
        K.cyl(0, 0, 3.05, h, h + 0.6, lin('#2b3a46'), GLASS, 8, top=False) if h % 6 == 0 else None
    K.cyl(0, 0, 4.6, 30, 31, white, BODY, 8)
    K.cyl(0, 0, 4.4, 31, 34.2, glass, LIT, 8, r1=4.9)
    K.cyl(0, 0, 5.1, 34.2, 35.0, roofc, BODY, 8)
    K.cyl(0, 0, 0.15, 35, 39, lin('#cc2222'), BODY, 4)
    K.cyl(0, 0, 0.3, 39, 39.4, lin('#ff3030'), NEON, 6)
    # Elliott hangar: 71 x 131 m, curved roof, big doors on the apron side (west)
    hx, hy = G(5904.0, 8990.0)
    w, d = 71.0, 131.0
    x0, x1, y0, y1 = hx - w / 2, hx + w / 2, hy - d / 2, hy + d / 2
    K.box(x0, x1, y0, y1, -3, 14, metal, BODY, ('h-', 'h+'))
    for k in range(12):
        a0, a1 = math.pi * k / 12, math.pi * (k + 1) / 12
        za0, za1 = 14 + math.sin(a0) * 6, 14 + math.sin(a1) * 6
        xa0, xa1 = hx - math.cos(a0) * w / 2, hx - math.cos(a1) * w / 2
        K.face([(xa0, y0, za0), (xa1, y0, za1), (xa1, y1, za1), (xa0, y1, za0)][::-1], lin('#9aa0a6'))
        K.face([(xa0, y0, za0), (xa1, y0, za1), (xa1, y0, 14), (xa0, y0, 14)], metal)
        K.face([(xa0, y1, za0), (xa0, y1, 14), (xa1, y1, 14), (xa1, y1, za1)], metal)
    for k in range(4):
        K.quad(lambda u, h, dd: (x0 - dd, hy - u, h), -60 + k * 30, -33 + k * 30, 0, 12, 0.05, lin('#8a9096'))
    K.text('ELLIOTT AVIATION', lambda u, h, dd: (x0 - dd, hy - u, h), 0, 12.4, 0.06, 1.8, lin('#1d3c6e'), BODY, 0.06, res=1)
    lod0 = K.obj('mlitower_lod0')
    K1 = Kit(692)
    K1.cyl(0, 0, 3.0, -3, 30, white, BODY, 6)
    K1.cyl(0, 0, 4.6, 30, 35, glass, LIT, 6)
    K1.box(x0, x1, y0, y1, -3, 18, metal)
    lod1 = K1.obj('mlitower_lod1')
    res = finish('mlitower', [lod0, lod1], anchor)
    if render:
        res['png'] = shots('mlitower', (100, 0, 10), 230, lod1, views=((-120, 18),))
    return res


B['mlitower'] = mlitower
