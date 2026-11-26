# E-bike and bike-share dock, in the game's chunky PS2-era look (few faces, fat tubes, flat colour
# regions): a step-through city e-bike (battery on the down tube, rear hub motor,
# front basket, rack, fenders, lights) plus the "Arnett Bike" docking station, in assets/models/ebike.glb.
# Kept out of cars.py so the car models can be rebuilt on their own. src/ebikemodel.js reads it.
#   car_ebike: root empty with children body (frame, paint), crank (chainring + arms + pedals, spins
#              round its origin at the bottom bracket), empties w_F, w_R (axles, z = wheel radius),
#              seat_D (saddle top), bb (bottom bracket), grip_L / grip_R, lamp_head_L, lamp_tail_L
#   ebike_wheel: one bicycle wheel (axle along X, origin at the hub), cloned for both wheels
#   ebike_dock: the docking station: a kiosk at +X and a rail of 5 posts; bikes stand at x = -1.5 .. 1.5,
#               y = 0, facing -Y with their front wheels in the posts
# Blender axes: Z up, the bike faces -Y, its left side is +X. Metres.
# Material names the game recognises: paint (bike colour), paint2, trim, chrome, tire, rim, lamp_head,
# lamp_tail, interior; the dock keeps its own colours (dock_*).
# Run: TAT_ROOT=$PWD/ blender -b -P assets/src/ebike.py   (from the repo root)
import math, os
_ROOT = os.environ.get('TAT_ROOT', '/Users/dainmoens/Documents/Tim Arnett Town/')
exec(open(_ROOT + 'assets/src/tat.py').read(), globals())
ROOT = _ROOT
OUT = ROOT + 'assets/models/'
from mathutils import Vector

reset()
MAT = {
    'paint': mat('paint', (0.1, 0.35, 0.75), 0.3, 0.4),
    'paint2': mat('paint2', (0.06, 0.06, 0.07), 0.4, 0.2),
    'trim': mat('trim', (0.04, 0.04, 0.045), 0.6),
    'chrome': mat('chrome', (0.8, 0.8, 0.82), 0.15, 1.0),
    'tire': mat('tire', (0.03, 0.03, 0.03), 0.9),
    'rim': mat('rim', (0.55, 0.56, 0.58), 0.3, 0.9),
    'lamp_head': mat('lamp_head', (0.9, 0.9, 0.85), 0.1),
    'lamp_tail': mat('lamp_tail', (0.6, 0.02, 0.02), 0.2),
    'interior': mat('interior', (0.12, 0.11, 0.1), 0.85),
    'dock_paint': mat('dock_paint', (0.07, 0.33, 0.72), 0.35, 0.3),
    'dock_metal': mat('dock_metal', (0.42, 0.44, 0.46), 0.35, 0.8),
    'dock_screen': mat('dock_screen', (0.05, 0.08, 0.1), 0.1, 0.3),
    'dock_white': mat('dock_white', (0.88, 0.88, 0.86), 0.5),
    'dock_concrete': mat('dock_concrete', (0.45, 0.44, 0.41), 0.9),
}


def tube(a, b, r, m, verts=8):
    """a cylinder from point a to point b"""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(rotation=True, location=False, scale=True)
    assign(o, MAT[m])
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def box(name, size, loc, m, bev=0.0, rot=(0, 0, 0)):
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
    return o


def along(name, a, b, w, h, m, bev=0.0):
    """a box stretched from a to b (w across, h up)"""
    a, b = Vector(a), Vector(b)
    d = b - a
    o = box(name, (w, d.length, h), (0, 0, 0), m, bev)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Y', 'Z')
    o.location = (a + b) / 2
    bpy.ops.object.transform_apply(rotation=True, location=True, scale=True)
    return o


def arc(cx, cy, cz, r, a0, a1, w, t, m, n=10):
    """a fender: a curved strip round the axle (cx, cy, cz) in the YZ plane, angles from +Y toward +Z"""
    out = []
    for k in range(n):
        u0 = a0 + (a1 - a0) * k / n
        u1 = a0 + (a1 - a0) * (k + 1) / n
        p0 = (cx, cy + math.cos(u0) * r, cz + math.sin(u0) * r)
        p1 = (cx, cy + math.cos(u1) * r, cz + math.sin(u1) * r)
        out.append(along('fender', p0, p1, w, t, m))
    return out


R = 0.35          # wheel radius (27.5" with tyre)
YF, YR = -0.58, 0.54   # axles
BB = (0, 0.04, 0.29)


def build_bike():
    root = bpy.data.objects.new('car_ebike', None)
    link(root)
    p = []
    head_b, head_t = (0, -0.43, 0.6), (0, -0.47, 0.86)
    seat_t = (0, 0.2, 0.82)
    # chunky step-through frame: a few fat 6-sided tubes in one colour
    p.append(tube(head_b, head_t, 0.045, 'paint', 6))
    p.append(tube(head_b, (0, -0.2, 0.32), 0.045, 'paint', 6))
    p.append(tube((0, -0.2, 0.32), BB, 0.045, 'paint', 6))
    p.append(tube(BB, seat_t, 0.04, 'paint', 6))
    for x in (0.055, -0.055):
        p.append(tube((x * 0.6, BB[1] + 0.02, BB[2]), (x, YR, R), 0.024, 'paint', 4))
        p.append(tube((x * 0.5, 0.18, 0.74), (x, YR, R), 0.022, 'paint', 4))
        p.append(tube((x * 0.9, -0.44, 0.6), (x, YF, R), 0.026, 'paint', 4))  # fork legs
    # the battery: a big dark block along the down tube, and the rear hub motor drum
    p.append(along('battery', (0, -0.38, 0.55), (0, -0.12, 0.36), 0.13, 0.11, 'paint2', 0.01))
    p.append(tube((0.05, YR, R), (-0.05, YR, R), 0.085, 'paint2', 8))
    # seatpost and a fat saddle
    p.append(tube(seat_t, (0, 0.23, 0.92), 0.022, 'trim', 6))
    p.append(box('saddle', (0.18, 0.28, 0.07), (0, 0.25, 0.94), 'trim'))
    # stem, straight bar, grips
    p.append(tube(head_t, (0, -0.42, 1.03), 0.026, 'trim', 6))
    p.append(tube((0.3, -0.36, 1.04), (-0.3, -0.36, 1.04), 0.018, 'trim', 6))
    for x in (0.27, -0.27):
        p.append(tube((x, -0.36, 1.04), (x * 1.15, -0.36, 1.04), 0.028, 'interior', 6))
    # front basket: a solid open-topped box
    bx0, by0, bz0, bw, bd, bh = 0, -0.67, 0.84, 0.36, 0.28, 0.18
    p.append(box('bfloor', (bw, bd, 0.02), (bx0, by0, bz0), 'trim'))
    for sx in (-1, 1):
        p.append(box('bside', (0.02, bd, bh), (sx * bw / 2, by0, bz0 + bh / 2), 'trim'))
    for sy in (-1, 1):
        p.append(box('bend', (bw, 0.02, bh), (bx0, by0 + sy * bd / 2, bz0 + bh / 2), 'trim'))
    p.append(tube((0, -0.54, bz0), (0, -0.46, 0.78), 0.02, 'trim', 4))
    # rear rack: one slab on two struts
    p.append(box('rack', (0.16, 0.36, 0.03), (0, 0.6, 0.76), 'trim'))
    p.append(tube((0, 0.76, 0.76), (0, YR + 0.02, R + 0.03), 0.018, 'trim', 4))
    # fenders: four flat segments each
    p += arc(0, YF, R, R + 0.05, math.radians(25), math.radians(150), 0.09, 0.02, 'paint', 4)
    p += arc(0, YR, R, R + 0.05, math.radians(25), math.radians(160), 0.09, 0.02, 'paint', 4)
    # chain guard (one slab on the right)
    p.append(along('guard', (-0.08, BB[1] - 0.02, BB[2] + 0.04), (-0.08, YR - 0.06, R + 0.04), 0.02, 0.12, 'paint'))
    # lights
    p.append(box('lampH', (0.1, 0.06, 0.08), (0, by0 - bd / 2 - 0.04, bz0 + 0.06), 'lamp_head'))
    p.append(box('lampT', (0.1, 0.03, 0.05), (0, 0.79, 0.76), 'lamp_tail'))
    for o in p:
        o.parent = None
    body = join(p, 'body')
    body.parent = root
    for poly in body.data.polygons:
        poly.use_smooth = False
    # crank: chainring disc, two arms, block pedals; origin at the bottom bracket
    c = []
    c.append(tube((-0.06, 0, 0), (-0.075, 0, 0), 0.11, 'chrome', 8))
    c.append(tube((0.08, 0, 0), (-0.08, 0, 0), 0.03, 'trim', 6))
    c.append(along('armR', (-0.09, 0, 0), (-0.09, 0, -0.17), 0.025, 0.04, 'trim'))
    c.append(along('armL', (0.09, 0, 0), (0.09, 0, 0.17), 0.025, 0.04, 'trim'))
    c.append(box('pedR', (0.12, 0.08, 0.035), (-0.15, 0, -0.17), 'paint2'))
    c.append(box('pedL', (0.12, 0.08, 0.035), (0.15, 0, 0.17), 'paint2'))
    crank = join(c, 'crank')
    crank.location = BB
    crank.parent = root
    for nm, loc in (('w_F', (0, YF, R)), ('w_R', (0, YR, R)), ('seat_D', (0, 0.25, 0.975)), ('bb', BB),
                    ('grip_L', (0.29, -0.36, 1.04)), ('grip_R', (-0.29, -0.36, 1.04)),
                    ('lamp_head_L', (0, by0 - bd / 2 - 0.07, bz0 + 0.06)), ('lamp_tail_L', (0, 0.81, 0.76))):
        empty(nm, loc, root)
    return root


def build_wheel():
    # chunky: a fat 12-sided tyre, a solid rim band and a five-spoke mag hub
    w = []
    bpy.ops.mesh.primitive_torus_add(major_radius=R - 0.04, minor_radius=0.045, major_segments=14, minor_segments=5, rotation=(0, math.pi / 2, 0))
    t = bpy.context.object
    assign(t, MAT['tire'])
    w.append(t)
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=R - 0.075, depth=0.05, rotation=(0, math.pi / 2, 0))
    r = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    assign(r, MAT['rim'])
    w.append(r)
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=R - 0.1, depth=0.055, rotation=(0, math.pi / 2, 0))
    hole = bpy.context.object
    bpy.ops.object.transform_apply(rotation=True)
    m = r.modifiers.new('cut', 'BOOLEAN'); m.object = hole; m.operation = 'DIFFERENCE'
    apply_mods(r)
    bpy.data.objects.remove(hole, do_unlink=True)
    for k in range(5):
        a = k * 2 * math.pi / 5
        w.append(along('spoke', (0, 0, 0), (0, math.cos(a) * (R - 0.09), math.sin(a) * (R - 0.09)), 0.03, 0.035, 'rim'))
    w.append(tube((0.05, 0, 0), (-0.05, 0, 0), 0.045, 'chrome', 8))
    o = join(w, 'ebike_wheel')
    for poly in o.data.polygons:
        poly.use_smooth = False
    return o


def build_dock():
    d = []
    d.append(box('pad', (4.7, 1.1, 0.06), (0.35, -0.55, 0.03), 'dock_concrete'))
    d.append(box('rail', (3.8, 0.16, 0.1), (0, -0.95, 0.1), 'dock_metal'))
    for k in range(5):
        x = -1.5 + k * 0.75
        d.append(box('post', (0.14, 0.16, 0.72), (x, -1.0, 0.46), 'dock_paint'))
        d.append(box('head', (0.2, 0.26, 0.18), (x, -0.95, 0.8), 'dock_metal'))
        d.append(box('led', (0.06, 0.02, 0.04), (x, -1.085, 0.84), 'lamp_head'))
    kx = 2.35
    d.append(box('kiosk', (0.46, 0.34, 1.7), (kx, -0.75, 0.88), 'dock_paint'))
    d.append(box('screen', (0.32, 0.02, 0.26), (kx, -0.93, 1.35), 'dock_screen'))
    d.append(box('keypad', (0.2, 0.05, 0.14), (kx, -0.94, 1.1), 'dock_metal'))
    d.append(box('mappanel', (0.38, 0.02, 0.6), (kx, -0.575, 1.1), 'dock_white'))
    d.append(box('cap', (0.56, 0.44, 0.08), (kx, -0.75, 1.77), 'dock_white'))
    o = join(d, 'ebike_dock')
    for poly in o.data.polygons:
        poly.use_smooth = False
    return o


roots = [build_bike()]
wheel = build_wheel()
dock = build_dock()
for c in roots[0].children_recursive:
    base = c.name.split('.')[0]
    c.name = 'ebike__' + base
result = {'tris': {o.name: tris(o) for o in [wheel, dock] + [c for c in roots[0].children_recursive if c.type == 'MESH']}}

if os.environ.get('TAT_PREVIEW'):
    wheel.location = (0, YF, R)
    w2 = wheel.copy(); w2.data = wheel.data; link(w2); w2.location = (0, YR, R)
    dock.location = (0, 3, 0)
    preview(os.environ['TAT_PREVIEW'], target=(0, 0, 0.6), dist=3.2, yaw=70, pitch=12)
    preview(os.environ['TAT_PREVIEW'].replace('.png', '_dock.png'), target=(0.3, 3, 0.6), dist=6, yaw=200, pitch=20)
    bpy.data.objects.remove(w2, do_unlink=True)
    wheel.location = (0, 0, 0)
    dock.location = (0, 0, 0)

objs = roots + [wheel, dock]
for o in objs:
    o.location = (0, 0, 0)
result['kb'] = export_glb('ebike', objs)
print('EBIKE', result)
