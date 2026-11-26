# E-bike and bike-share dock: a step-through city e-bike (battery on the down tube, rear hub motor,
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
    head_b, head_t = (0, -0.43, 0.6), (0, -0.47, 0.84)
    seat_t = (0, 0.2, 0.82)
    # frame: low step-through down tube, seat tube, stays
    p.append(tube(head_b, head_t, 0.03, 'paint', 10))
    p.append(tube(head_b, (0, -0.2, 0.33), 0.028, 'paint', 10))
    p.append(tube((0, -0.2, 0.33), BB, 0.03, 'paint', 10))
    p.append(tube(BB, seat_t, 0.026, 'paint', 10))
    p.append(tube((0, -0.36, 0.52), (0, 0.15, 0.66), 0.018, 'paint'))  # a slim top brace (step-through)
    for x in (0.06, -0.06):
        p.append(tube((x * 0.5, BB[1] + 0.02, BB[2]), (x, YR, R), 0.014, 'paint'))
        p.append(tube((x * 0.4, 0.18, 0.74), (x, YR, R), 0.012, 'paint'))
        p.append(tube((x * 0.8, -0.44, 0.6), (x, YF, R), 0.016, 'paint'))  # fork blades
    p.append(box('crown', (0.14, 0.05, 0.04), (0, -0.44, 0.6), 'paint', 0.01))
    # battery on the down tube and the rear hub motor
    p.append(along('battery', (0, -0.36, 0.52), (0, -0.14, 0.355), 0.09, 0.08, 'paint2', 0.02))
    p.append(along('batcap', (0, -0.15, 0.36), (0, -0.11, 0.335), 0.095, 0.085, 'trim', 0.01))
    p.append(tube((0.045, YR, R), (-0.045, YR, R), 0.075, 'paint2', 14))
    p.append(tube((0.05, YF, R), (-0.05, YF, R), 0.03, 'trim', 10))
    # seatpost, saddle
    p.append(tube(seat_t, (0, 0.23, 0.92), 0.014, 'chrome'))
    p.append(box('saddle', (0.15, 0.24, 0.05), (0, 0.25, 0.94), 'trim', 0.02))
    p.append(box('saddlenose', (0.07, 0.1, 0.04), (0, 0.15, 0.94), 'trim', 0.015))
    # stem, handlebar (swept back), grips, display, bell
    p.append(tube(head_t, (0, -0.45, 1.0), 0.016, 'trim'))
    p.append(tube((0, -0.45, 1.0), (0, -0.4, 1.03), 0.016, 'trim'))
    bar = [(0.3, -0.33, 1.04), (0.2, -0.38, 1.04), (0, -0.4, 1.03), (-0.2, -0.38, 1.04), (-0.3, -0.33, 1.04)]
    for a, b in zip(bar, bar[1:]):
        p.append(tube(a, b, 0.012, 'trim'))
    for x in (0.27, -0.27):
        p.append(tube((x, -0.345, 1.04), (x * 1.13, -0.325, 1.04), 0.017, 'interior'))
    p.append(box('display', (0.07, 0.04, 0.045), (0.08, -0.4, 1.06), 'paint2', 0.008))
    p.append(tube((-0.12, -0.39, 1.045), (-0.12, -0.39, 1.075), 0.02, 'chrome', 10))
    # front basket on the head tube
    bx0, by0, bz0, bw, bd, bh = 0, -0.66, 0.84, 0.34, 0.26, 0.17
    p.append(box('basketfloor', (bw, bd, 0.012), (bx0, by0, bz0), 'trim'))
    for sx in (-1, 1):
        p.append(along('bside', (sx * bw / 2, by0 - bd / 2, bz0 + bh), (sx * bw / 2, by0 + bd / 2, bz0 + bh), 0.012, 0.012, 'trim'))
        for k in range(4):
            yy = by0 - bd / 2 + bd * k / 3
            p.append(tube((sx * bw / 2, yy, bz0), (sx * bw / 2, yy, bz0 + bh), 0.005, 'trim', 4))
    for sy in (-1, 1):
        p.append(along('bfront', (-bw / 2, by0 + sy * bd / 2, bz0 + bh), (bw / 2, by0 + sy * bd / 2, bz0 + bh), 0.012, 0.012, 'trim'))
        for k in range(5):
            xx = -bw / 2 + bw * k / 4
            p.append(tube((xx, by0 + sy * bd / 2, bz0), (xx, by0 + sy * bd / 2, bz0 + bh), 0.005, 'trim', 4))
    p.append(tube((0, -0.53, bz0), (0, -0.46, 0.8), 0.012, 'trim'))
    # rear rack
    p.append(box('rack', (0.14, 0.34, 0.015), (0, 0.6, 0.76), 'trim'))
    for x in (0.065, -0.065):
        p.append(tube((x, 0.75, 0.76), (x, YR, R + 0.02), 0.008, 'trim', 6))
        p.append(tube((x, 0.45, 0.76), (x * 0.5, 0.2, 0.78), 0.008, 'trim', 6))
    # fenders (mudguards)
    p += arc(0, YF, R, R + 0.04, math.radians(20), math.radians(150), 0.07, 0.008, 'paint', 9)
    p += arc(0, YR, R, R + 0.04, math.radians(20), math.radians(165), 0.07, 0.008, 'paint', 9)
    # chain guard + chain on the right (-X) side
    p.append(along('chain', (-0.07, BB[1], BB[2] + 0.09), (-0.07, YR, R + 0.05), 0.008, 0.012, 'trim'))
    p.append(along('chain2', (-0.07, BB[1], BB[2] - 0.09), (-0.07, YR, R - 0.05), 0.008, 0.012, 'trim'))
    p.append(along('guard', (-0.085, BB[1] + 0.02, BB[2] + 0.11), (-0.085, YR - 0.08, R + 0.08), 0.006, 0.05, 'paint'))
    # kickstand (folded up along the left chainstay)
    p.append(tube((0.05, 0.14, 0.27), (0.07, 0.34, 0.2), 0.009, 'trim', 6))
    # lights
    p.append(box('lampH', (0.07, 0.05, 0.05), (0, by0 - bd / 2 - 0.035, bz0 + 0.04), 'lamp_head', 0.012))
    p.append(box('lampT', (0.07, 0.025, 0.035), (0, 0.78, 0.76), 'lamp_tail', 0.008))
    p.append(box('reflF', (0.03, 0.01, 0.06), (0, -0.44, 0.74), 'chrome'))
    for o in p:
        o.parent = None
    body = join(p, 'body')
    body.parent = root
    shade_auto(body, 50)
    # crank: chainring on the right, two arms, pedals; origin at the bottom bracket
    c = []
    c.append(tube((-0.06, 0, 0), (-0.07, 0, 0), 0.1, 'chrome', 20))
    c.append(tube((0.07, 0, 0), (-0.07, 0, 0), 0.022, 'trim', 10))
    c.append(along('armR', (-0.085, 0, 0), (-0.085, 0, -0.17), 0.016, 0.028, 'trim'))
    c.append(along('armL', (0.085, 0, 0), (0.085, 0, 0.17), 0.016, 0.028, 'trim'))
    c.append(box('pedR', (0.1, 0.06, 0.022), (-0.14, 0, -0.17), 'paint2', 0.006))
    c.append(box('pedL', (0.1, 0.06, 0.022), (0.14, 0, 0.17), 'paint2', 0.006))
    crank = join(c, 'crank')
    crank.location = BB
    crank.parent = root
    for nm, loc in (('w_F', (0, YF, R)), ('w_R', (0, YR, R)), ('seat_D', (0, 0.25, 0.965)), ('bb', BB),
                    ('grip_L', (0.29, -0.335, 1.04)), ('grip_R', (-0.29, -0.335, 1.04)),
                    ('lamp_head_L', (0, by0 - bd / 2 - 0.06, bz0 + 0.04)), ('lamp_tail_L', (0, 0.795, 0.76))):
        empty(nm, loc, root)
    return root


def build_wheel():
    w = []
    bpy.ops.mesh.primitive_torus_add(major_radius=R - 0.03, minor_radius=0.03, major_segments=32, minor_segments=8, rotation=(0, math.pi / 2, 0))
    t = bpy.context.object
    assign(t, MAT['tire'])
    for p in t.data.polygons:
        p.use_smooth = True
    w.append(t)
    bpy.ops.mesh.primitive_torus_add(major_radius=R - 0.065, minor_radius=0.012, major_segments=32, minor_segments=6, rotation=(0, math.pi / 2, 0))
    r = bpy.context.object
    assign(r, MAT['rim'])
    w.append(r)
    for k in range(18):
        a = k * 2 * math.pi / 18
        side = 0.025 if k % 2 else -0.025
        w.append(tube((side, 0, 0), (0, math.cos(a) * (R - 0.07), math.sin(a) * (R - 0.07)), 0.0025, 'chrome', 4))
    w.append(tube((0.035, 0, 0), (-0.035, 0, 0), 0.022, 'chrome', 10))
    o = join(w, 'ebike_wheel')
    return o


def build_dock():
    d = []
    # concrete pad and base rail
    d.append(box('pad', (4.7, 1.1, 0.06), (0.35, -0.55, 0.03), 'dock_concrete', 0.02))
    d.append(box('rail', (3.8, 0.12, 0.08), (0, -0.95, 0.1), 'dock_metal', 0.02))
    # five docking posts (front wheel goes in front of each), each with a lock head and a status light
    for k in range(5):
        x = -1.5 + k * 0.75
        d.append(box('post', (0.1, 0.12, 0.72), (x, -1.0, 0.46), 'dock_paint', 0.03))
        d.append(box('head', (0.14, 0.2, 0.16), (x, -0.96, 0.78), 'dock_metal', 0.03))
        d.append(box('jaw', (0.06, 0.12, 0.12), (x, -0.84, 0.72), 'trim', 0.01))
        d.append(box('led', (0.04, 0.01, 0.03), (x, -1.065, 0.82), 'lamp_head'))
    # the kiosk: a payment totem with a screen, card slot and a map panel, plus a roof sign
    kx = 2.35
    d.append(box('kiosk', (0.42, 0.32, 1.7), (kx, -0.75, 0.88), 'dock_paint', 0.05))
    d.append(box('screen', (0.3, 0.02, 0.24), (kx, -0.92, 1.35), 'dock_screen', 0.01))
    d.append(box('keypad', (0.18, 0.04, 0.12), (kx, -0.93, 1.1), 'dock_metal', 0.01))
    d.append(box('mappanel', (0.36, 0.02, 0.6), (kx, -0.585, 1.1), 'dock_white', 0.01))
    d.append(box('cap', (0.5, 0.4, 0.06), (kx, -0.75, 1.76), 'dock_white', 0.02))
    d.append(box('solar', (0.6, 0.5, 0.03), (kx, -0.75, 1.82), 'dock_screen', 0.005, rot=(0.2, 0, 0)))
    o = join(d, 'ebike_dock')
    shade_auto(o, 40)
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
