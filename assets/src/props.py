# Street and rooftop props. Each prop is one object named p_<name>, origin at its base on the
# ground (or, for wall parts, on the wall at floor level), front facing -Y. Colours are baked into a
# vertex colour layer so the game can draw every copy of a prop in one instanced call.
# Run in Blender:  exec(open(ROOT + 'assets/src/props.py').read())
import math, random
exec(open(__import__('os').environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/') + 'assets/src/tat.py').read(), globals())
from mathutils import Vector, noise

reset()
C = {
    'iron': (0.05, 0.05, 0.05), 'steel': (0.45, 0.46, 0.47), 'galv': (0.62, 0.63, 0.62), 'dark': (0.12, 0.12, 0.13),
    'ac': (0.66, 0.67, 0.66), 'grille': (0.08, 0.08, 0.08), 'wood': (0.33, 0.22, 0.12), 'wood2': (0.45, 0.31, 0.18),
    'green': (0.08, 0.22, 0.12), 'lid': (0.03, 0.03, 0.03), 'bag': (0.02, 0.02, 0.02), 'red': (0.55, 0.05, 0.03),
    'yellow': (0.8, 0.55, 0.05), 'blue': (0.04, 0.12, 0.35), 'white': (0.85, 0.85, 0.82), 'concrete': (0.42, 0.41, 0.38),
    'pole': (0.16, 0.18, 0.19), 'bark': (0.16, 0.11, 0.07), 'leaf': (1, 1, 1), 'glass': (0.3, 0.38, 0.42), 'ad': (0.7, 0.62, 0.4),
    'tankwood': (0.36, 0.25, 0.15), 'hedge': (0.06, 0.16, 0.05), 'soil': (0.1, 0.07, 0.04), 'brick': (0.35, 0.14, 0.09),
}
M = {k: mat('p_' + k, v) for k, v in C.items()}


def box(size, loc, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 1; b.limit_method = 'ANGLE'
        apply_mods(o)
    assign(o, M[m])
    return o


def cyl(r, depth, loc, m, rot=(0, 0, 0), verts=10, r2=None, smooth=True):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    for p in o.data.polygons:
        p.use_smooth = smooth
    assign(o, M[m])
    return o


def rod(a, b, r, m, verts=6):
    """a cylinder from point a to point b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cyl(r, d.length, (a + b) / 2, m, verts=verts)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return o


def blob(r, loc, m, sub=1, rough=0.25, seed=0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object
    for v in o.data.vertices:
        p = v.co.normalized()
        v.co = v.co * (1 + rough * noise.noise(p * 2.3 + Vector((seed, seed * 1.7, 0))))
    assign(o, M[m])
    return o


def bake(o, shade=None):
    """material colours -> one vertex colour layer, one material; shade(v world pos) darkens"""
    me = o.data
    layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    mats = [s.material for s in o.material_slots]
    for p in me.polygons:
        c = mats[p.material_index].diffuse_color if mats else (1, 1, 1, 1)
        for li in p.loop_indices:
            k = 1.0
            if shade:
                k = shade(me.vertices[me.loops[li].vertex_index].co)
            layer.data[li].color = (c[0] * k, c[1] * k, c[2] * k, 1)
    me.color_attributes.active_color = layer
    me.materials.clear()
    me.materials.append(bpy.data.materials.get('p_prop') or mat('p_prop', (1, 1, 1)))


def prop(name, parts, smooth=35, shade=None):
    o = join(parts, 'p_' + name)
    select_only([o])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    shade_auto(o, smooth)
    bake(o, shade)
    return o


out = []

# --- rooftop AC unit (condenser box with a fan grille on top) ---
p = [box((1.2, 0.9, 0.8), (0, 0, 0.5), 'ac', 0.03),
     box((1.28, 0.98, 0.1), (0, 0, 0.05), 'steel'),
     cyl(0.32, 0.04, (0.2, 0, 0.91), 'grille', verts=14),
     cyl(0.06, 0.06, (0.2, 0, 0.94), 'dark', verts=8),
     box((0.38, 0.02, 0.5), (-0.33, -0.455, 0.5), 'grille'),
     rod((-0.6, 0.3, 0.3), (-0.6, 0.9, 0.06), 0.03, 'steel')]
for k in range(5):
    p.append(box((1.0, 0.01, 0.02), (0.05, -0.452, 0.28 + k * 0.1), 'steel'))
out.append(prop('ac', p))

# --- wooden rooftop water tank on a steel stand ---
p = []
for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
    p.append(box((0.14, 0.14, 2.4), (sx * 1.0, sy * 1.0, 1.2), 'iron'))
p += [rod((1, 1, 0.4), (-1, -1, 2.2), 0.03, 'iron'), rod((1, -1, 0.4), (-1, 1, 2.2), 0.03, 'iron'),
      box((2.5, 2.5, 0.12), (0, 0, 2.45), 'iron'),
      cyl(1.35, 2.6, (0, 0, 3.8), 'tankwood', verts=18),
      cyl(1.42, 0.9, (0, 0, 5.55), 'dark', verts=18, r2=0.08),
      rod((1.3, -0.6, 2.5), (1.3, -0.6, 5.2), 0.025, 'iron'), rod((1.3, -0.2, 2.5), (1.3, -0.2, 5.2), 0.025, 'iron')]
for z in (2.8, 3.6, 4.4, 5.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=1.37, minor_radius=0.03, major_segments=12, minor_segments=3, location=(0, 0, z))
    t = bpy.context.object; assign(t, M['iron']); p.append(t)
out.append(prop('tank', p))

# --- one storey of fire escape: grated landing, railing, stair down to the floor below ---
p = [box((3.0, 1.1, 0.05), (0, -0.6, 0), 'iron')]
for x in (-1.5, 1.5):
    p.append(box((0.04, 1.1, 0.04), (x, -0.6, 1.0), 'iron'))
    p.append(box((0.04, 0.04, 1.0), (x, -1.15, 0.5), 'iron'))
p += [box((3.0, 0.04, 0.04), (0, -1.15, 1.0), 'iron'), box((3.0, 0.03, 0.03), (0, -1.15, 0.5), 'iron'),
      box((0.08, 0.06, 0.12), (0, -0.06, -0.03), 'iron')]
for k in range(9):
    p.append(box((0.025, 0.025, 1.0), (-1.35 + k * 0.33, -1.15, 0.5), 'iron'))
# stair from this landing's far end down to the next landing, inside the cage
for side in (-0.95, -0.35):
    p.append(rod((1.2, side, 0.0), (-1.1, side, -3.25), 0.035, 'iron', 4))
for k in range(11):
    f = (k + 0.5) / 11
    p.append(box((0.22, 0.6, 0.025), (1.2 - 2.3 * f, -0.65, -3.25 * f), 'iron'))
p.append(rod((1.2, -0.95, 0.9), (-1.1, -0.95, -2.35), 0.02, 'iron', 4))
for sx in (-1.4, 1.4):
    p.append(rod((sx, -0.05, 0.02), (sx, -1.1, 0.02), 0.04, 'iron', 4))
    p.append(rod((sx, -0.05, -0.6), (sx, -1.1, 0.0), 0.025, 'iron', 4))
out.append(prop('fesc', p))

# --- commercial dumpster with lids, pockets and casters ---
p = [box((1.9, 1.1, 1.05), (0, 0, 0.68), 'green', 0.03),
     box((2.0, 0.08, 0.1), (0, -0.56, 1.18), 'green'),
     box((0.94, 1.15, 0.05), (-0.48, 0.02, 1.24), 'lid', rot=(0.06, 0, 0)),
     box((0.94, 1.15, 0.05), (0.48, 0.02, 1.24), 'lid', rot=(0.06, 0, 0)),
     box((0.12, 1.2, 0.14), (-1.0, 0, 0.75), 'green'), box((0.12, 1.2, 0.14), (1.0, 0, 0.75), 'green')]
for sx, sy in ((0.8, 0.4), (0.8, -0.4), (-0.8, 0.4), (-0.8, -0.4)):
    p.append(cyl(0.07, 0.05, (sx, sy, 0.08), 'dark', rot=(0, math.pi / 2, 0), verts=8))
    p.append(box((0.08, 0.08, 0.06), (sx, sy, 0.15), 'dark'))
out.append(prop('dumpster', p))

# --- trash bag: lumpy sack with a knotted neck ---
random.seed(3)
p = [blob(0.33, (0, 0, 0.28), 'bag', 2, 0.18, 1), cyl(0.07, 0.14, (0, 0, 0.6), 'bag', verts=6, r2=0.03)]
p[0].scale = (1, 0.85, 0.85); select_only([p[0]]); bpy.ops.object.transform_apply(scale=True)
out.append(prop('bag', p, 60))

# --- park bench: cast-iron ends, wooden slats ---
p = []
for x in (-0.8, 0.8):
    p += [box((0.06, 0.55, 0.06), (x, 0, 0.42), 'iron'), box((0.06, 0.06, 0.45), (x, -0.22, 0.22), 'iron'),
          box((0.06, 0.06, 0.45), (x, 0.22, 0.22), 'iron'), box((0.06, 0.06, 0.5), (x, 0.26, 0.68), 'iron', rot=(-0.2, 0, 0)),
          box((0.06, 0.45, 0.05), (x, -0.02, 0.62), 'iron')]
for k in range(4):
    p.append(box((1.9, 0.1, 0.035), (0, -0.2 + k * 0.13, 0.46), 'wood2', 0.01))
for k in range(3):
    p.append(box((1.9, 0.035, 0.09), (0, 0.27 + k * 0.03, 0.6 + k * 0.13), 'wood2', 0.01, rot=(-0.2, 0, 0)))
out.append(prop('bench', p))

# --- fire hydrant ---
p = [cyl(0.15, 0.06, (0, 0, 0.03), 'red', verts=12), cyl(0.11, 0.55, (0, 0, 0.33), 'red', verts=12),
     cyl(0.14, 0.05, (0, 0, 0.6), 'red', verts=12), cyl(0.12, 0.1, (0, 0, 0.68), 'yellow', verts=12, r2=0.06),
     cyl(0.03, 0.05, (0, 0, 0.75), 'yellow', verts=6),
     cyl(0.05, 0.1, (0, -0.13, 0.42), 'yellow', rot=(math.pi / 2, 0, 0), verts=8),
     cyl(0.04, 0.08, (0.12, 0, 0.42), 'yellow', rot=(0, math.pi / 2, 0), verts=8),
     cyl(0.04, 0.08, (-0.12, 0, 0.42), 'yellow', rot=(0, math.pi / 2, 0), verts=8)]
out.append(prop('hydrant', p))

# --- city trash can: green slatted drum with a dome lid ---
p = [cyl(0.3, 0.85, (0, 0, 0.45), 'green', verts=14), cyl(0.33, 0.06, (0, 0, 0.88), 'dark', verts=14),
     cyl(0.31, 0.14, (0, 0, 0.98), 'green', verts=14, r2=0.12), cyl(0.33, 0.05, (0, 0, 0.03), 'dark', verts=14)]
for k in range(3):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.305, minor_radius=0.015, major_segments=14, minor_segments=4, location=(0, 0, 0.25 + k * 0.25))
    t = bpy.context.object; assign(t, M['dark']); p.append(t)
out.append(prop('bin', p))

# --- newspaper box ---
p = [box((0.45, 0.4, 0.55), (0, 0, 0.75), 'blue', 0.015), box((0.38, 0.02, 0.22), (0, -0.205, 0.84), 'glass'),
     box((0.4, 0.02, 0.08), (0, -0.205, 0.62), 'white'), box((0.47, 0.42, 0.04), (0, 0, 1.04), 'dark')]
for sx, sy in ((0.18, 0.15), (0.18, -0.15), (-0.18, 0.15), (-0.18, -0.15)):
    p.append(box((0.04, 0.04, 0.48), (sx, sy, 0.24), 'dark'))
out.append(prop('newsbox', p))

# --- mailbox (blue, domed) ---
p = [box((0.45, 0.5, 0.75), (0, 0, 0.62), 'blue', 0.02), cyl(0.225, 0.5, (0, 0, 1.0), 'blue', rot=(math.pi / 2, 0, 0), verts=12),
     box((0.32, 0.02, 0.06), (0, -0.26, 0.98), 'dark'), box((0.47, 0.52, 0.05), (0, 0, 0.27), 'dark')]
for sx in (-0.2, 0.2):
    for sy in (-0.2, 0.2):
        p.append(box((0.05, 0.05, 0.25), (sx, sy, 0.12), 'dark'))
out.append(prop('mailbox', p))

# --- parking meter ---
p = [cyl(0.04, 1.05, (0, 0, 0.52), 'pole', verts=8), box((0.18, 0.14, 0.3), (0, 0, 1.2), 'dark', 0.02),
     cyl(0.09, 0.14, (0, 0, 1.35), 'steel', rot=(math.pi / 2, 0, 0), verts=10), box((0.1, 0.01, 0.07), (0, -0.075, 1.23), 'glass')]
out.append(prop('meter', p))

# --- bus stop shelter: frame, roof, back glass, ad panel, bench (glass drawn opaque-tinted) ---
p = [box((3.2, 1.4, 0.08), (0, 0, 2.45), 'dark', 0.02), box((3.0, 0.03, 1.9), (0, 0.6, 1.25), 'glass'),
     box((0.03, 1.1, 1.9), (1.5, 0.05, 1.25), 'glass'), box((1.2, 0.08, 1.8), (-1.45, 0.25, 1.2), 'ad', rot=(0, 0, math.pi / 2)),
     box((1.8, 0.35, 0.05), (0.2, 0.35, 0.45), 'steel'), box((0.05, 0.05, 0.45), (-0.5, 0.4, 0.22), 'steel'), box((0.05, 0.05, 0.45), (0.9, 0.4, 0.22), 'steel')]
for x in (-1.55, 1.55):
    for y in (-0.6, 0.62):
        p.append(box((0.08, 0.08, 2.4), (x, y, 1.2), 'dark'))
out.append(prop('busstop', p))

# --- cobra-head streetlight: tapered pole, curved arm (lens is its own glowing object) ---
p = [cyl(0.2, 0.5, (0, 0, 0.25), 'concrete', verts=10), cyl(0.11, 7.4, (0, 0, 4.1), 'pole', verts=10, r2=0.07)]
pts = [(0, 0, 7.4), (0, -0.4, 7.75), (0, -1.0, 7.9), (0, -2.0, 7.85)]
for a, b in zip(pts, pts[1:]):
    p.append(rod(a, b, 0.05, 'pole', 6))
p += [box((0.38, 0.75, 0.16), (0, -2.25, 7.82), 'pole', 0.05)]
out.append(prop('streetlight', p))
lens = box((0.3, 0.55, 0.03), (0, -2.28, 7.73), 'white')
out.append(prop('streetlight_lens', [lens]))

# --- traffic signal head (three lamps, back plate); the game tints the lit lamp ---
p = [box((0.36, 0.3, 1.0), (0, 0, 0), 'yellow', 0.02), box((0.5, 0.03, 1.15), (0, 0.17, 0), 'dark')]
for z in (0.32, 0, -0.32):
    p.append(cyl(0.11, 0.03, (0, -0.16, z), 'dark', rot=(math.pi / 2, 0, 0), verts=10))
    p.append(box((0.26, 0.18, 0.03), (0, -0.24, z + 0.12), 'yellow', rot=(0.5, 0, 0)))
out.append(prop('signal', p))

# --- picket fence segment (2.4 m) and chain-link segment (3 m) ---
p = [box((2.4, 0.04, 0.08), (0, 0, 0.3), 'white'), box((2.4, 0.04, 0.08), (0, 0, 0.75), 'white'), box((0.1, 0.1, 1.1), (-1.2, 0, 0.55), 'white')]
for k in range(8):
    x = -1.05 + k * 0.3
    p.append(box((0.09, 0.025, 1.0), (x, -0.03, 0.5), 'white'))
out.append(prop('picket', p, 20))
p = [cyl(0.03, 1.8, (-1.5, 0, 0.9), 'galv', verts=6), rod((-1.5, 0, 1.78), (1.5, 0, 1.78), 0.02, 'galv', 4), rod((-1.5, 0, 0.05), (1.5, 0, 0.05), 0.012, 'galv', 4)]
for k in range(16):
    x = -1.45 + k * 0.19
    p.append(rod((x, 0, 0.05), (x + 0.19, 0, 1.75), 0.006, 'galv', 3))
    p.append(rod((x + 0.19, 0, 0.05), (x, 0, 1.75), 0.006, 'galv', 3))
out.append(prop('chainlink', p, 20))

# --- trees: trunk and canopy are separate so the game can tint and sway the leaves on their own ---
def canopy(name, blobs, seed, shade_top=1.0, sub=2):
    random.seed(seed)
    parts = [blob(r, loc, 'leaf', sub, 0.32, seed + i) for i, (r, loc) in enumerate(blobs)]
    top = max(l[2] + r for r, l in blobs); bot = min(l[2] - r for r, l in blobs)
    # darker underneath and inside: cheap baked ambient occlusion
    o = prop(name, parts, 180, lambda v: 0.45 + 0.55 * min(1, max(0, (v.z - bot) / (top - bot))) ** 0.8)
    return o


def trunk(name, h, r, branches):
    p = [cyl(r, h, (0, 0, h / 2), 'bark', verts=7, r2=r * 0.6)]
    for a, b, br in branches:
        p.append(rod(a, b, br, 'bark', 5))
    return prop(name, p, 50)


# broad oak: wide crown of many clumps
out.append(trunk('oak_trunk', 4.2, 0.28, [((0, 0, 3.0), (1.4, 0.4, 4.6), 0.12), ((0, 0, 3.4), (-1.3, -0.6, 4.9), 0.12), ((0, 0, 3.8), (0.2, 1.3, 5.2), 0.1)]))
out.append(canopy('oak_leaves', [(2.2, (0, 0, 5.6)), (1.7, (1.7, 0.5, 5.0)), (1.6, (-1.6, -0.6, 5.2)), (1.5, (0.3, 1.6, 5.3)),
                                (1.5, (-0.4, -1.7, 5.0)), (1.6, (0.8, -0.4, 6.6)), (1.3, (-0.9, 0.7, 6.5))], 11))
# maple: rounder, taller crown
out.append(trunk('maple_trunk', 4.0, 0.22, [((0, 0, 3.2), (0.9, 0.3, 4.8), 0.09), ((0, 0, 3.5), (-0.8, -0.4, 5.0), 0.09)]))
out.append(canopy('maple_leaves', [(1.9, (0, 0, 5.6)), (1.5, (1.1, 0.3, 5.0)), (1.5, (-1.1, -0.3, 5.1)), (1.4, (0.2, 1.1, 5.4)),
                                  (1.4, (-0.2, -1.1, 5.3)), (1.5, (0.2, 0.1, 6.9))], 23))
# pine: stacked cones of drooping tiers
out.append(trunk('pine_trunk', 9.0, 0.2, []))
p = []
for k, (r, z) in enumerate([(2.2, 2.4), (1.9, 3.8), (1.6, 5.1), (1.25, 6.3), (0.9, 7.4), (0.55, 8.4)]):
    bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=r, radius2=r * 0.15, depth=2.0, location=(0, 0, z), rotation=(0, 0, k * 0.6))
    c = bpy.context.object
    for v in c.data.vertices:
        if v.co.z < 0:
            v.co.z -= 0.25 * noise.noise(v.co * 3)  # ragged drooping hem
    assign(c, M['leaf']); p.append(c)
out.append(prop('pine_leaves', p, 180, lambda v: 0.5 + 0.5 * min(1, max(0, (v.z - 1.4) / 7.5))))
# small ornamental street tree
out.append(trunk('small_trunk', 2.6, 0.12, []))
out.append(canopy('small_leaves', [(1.1, (0, 0, 3.0)), (0.85, (0.6, 0.2, 2.7)), (0.85, (-0.5, -0.3, 2.8)), (0.8, (0.1, 0.1, 3.7))], 31, sub=1))
# far-away canopies: same shapes, fewer triangles
out.append(canopy('oak_leaves_lo', [(2.3, (0, 0, 5.6)), (1.8, (1.6, 0.5, 5.0)), (1.7, (-1.5, -0.6, 5.2)), (1.6, (0.2, 1.4, 5.6)), (1.6, (0.6, -0.8, 6.4))], 11, sub=1))
out.append(canopy('maple_leaves_lo', [(2.0, (0, 0, 5.6)), (1.6, (1.0, 0.3, 5.1)), (1.6, (-1.0, -0.3, 5.2)), (1.5, (0.1, 0.1, 6.8))], 23, sub=1))
# boxwood hedge block (2 m) and a flower bed
p = [box((2.0, 0.8, 0.9), (0, 0, 0.45), 'hedge', 0.15)]
for k in range(4):
    p.append(blob(0.42, (-0.75 + k * 0.5, 0, 0.85), 'hedge', 1, 0.3, k))
out.append(prop('hedge', p, 180, lambda v: 0.55 + 0.45 * min(1, v.z / 1.1)))
p = [box((1.6, 0.8, 0.25), (0, 0, 0.125), 'brick', 0.02), box((1.5, 0.7, 0.05), (0, 0, 0.23), 'soil')]
random.seed(5)
fl = [mat('p_f%d' % i, c) for i, c in enumerate([(0.7, 0.05, 0.08), (0.85, 0.6, 0.05), (0.6, 0.2, 0.55), (0.9, 0.85, 0.8)])]
for k in range(10):
    x, y = random.uniform(-0.65, 0.65), random.uniform(-0.28, 0.28)
    s = blob(0.09, (x, y, 0.36), 'hedge', 1, 0.2, k)
    p.append(s)
    f = blob(0.06, (x, y, 0.44), 'hedge', 0, 0.1, k)
    assign(f, random.choice(fl)); p.append(f)
out.append(prop('flowers', p, 180))

kb = export_glb('props', out)
result = {'kb': kb, 'tris': {o.name: tris(o) for o in out}}
