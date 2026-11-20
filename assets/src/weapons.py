# Weapons and thrown things. Each weapon is one object named w_<name> with its grip at the origin,
# the barrel pointing forward (-Y) and up = +Z, plus an empty child "muzzle_<name>" at the barrel tip.
# Run in Blender:  exec(open(ROOT + 'assets/src/weapons.py').read())
import math
exec(open('/Users/dainmoens/Documents/Tim Arnett Town/assets/src/tat.py').read(), globals())
from mathutils import Vector

reset()
M = {
    'metal': mat('gun_metal', (0.05, 0.05, 0.055), 0.32, 0.75),
    'poly': mat('gun_poly', (0.03, 0.03, 0.03), 0.65),
    'wood': mat('gun_wood', (0.28, 0.14, 0.06), 0.55),
    'batwood': mat('bat_wood', (0.72, 0.5, 0.28), 0.5),
    'steel': mat('steel', (0.62, 0.63, 0.65), 0.28, 0.9),
    'brass': mat('brass', (0.78, 0.6, 0.22), 0.3, 0.9),
    'red': mat('red_paint', (0.6, 0.05, 0.04), 0.4),
    'olive': mat('olive', (0.22, 0.25, 0.12), 0.6),
    'glass': mat('glass_green', (0.18, 0.42, 0.18), 0.08, 0.0),
    'cloth': mat('cloth', (0.82, 0.76, 0.6), 0.9),
    'lens': mat('lens', (0.05, 0.12, 0.25), 0.05, 0.3),
    'grip': mat('grip_rubber', (0.08, 0.08, 0.08), 0.85),
}


def box(size, loc, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL')
        b.width = bevel
        b.segments = 2
        b.limit_method = 'ANGLE'
        apply_mods(o)
    assign(o, M[m])
    return o


def cyl(r, depth, loc, m, rot=(math.pi / 2, 0, 0), verts=12, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    for p in o.data.polygons:
        p.use_smooth = True
    assign(o, M[m])
    return o


def weapon(name, parts, muzzle):
    o = join(parts, 'w_' + name)
    select_only([o])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # grip at the origin, no leftover rotation
    shade_auto(o, 35)
    e = empty('muzzle_' + name, muzzle, o)
    return o


out = []
# pistol: slide, frame, raked grip, trigger guard
p = [box((0.03, 0.19, 0.032), (0, -0.075, 0.075), 'metal', 0.004),
     box((0.028, 0.14, 0.022), (0, -0.05, 0.048), 'poly', 0.003),
     box((0.028, 0.045, 0.11), (0, 0.01, -0.0), 'grip', 0.006, rot=(-0.28, 0, 0)),
     box((0.006, 0.04, 0.004), (0, -0.045, 0.02), 'poly'),
     box((0.006, 0.004, 0.025), (0, -0.065, 0.03), 'poly'),
     cyl(0.006, 0.012, (0, -0.172, 0.078), 'metal')]
out.append(weapon('pistol', p, (0, -0.18, 0.078)))
# SMG: compact receiver, long mag, short barrel, stub stock, front grip
p = [box((0.04, 0.3, 0.07), (0, -0.08, 0.07), 'metal', 0.006),
     box((0.03, 0.05, 0.16), (0, -0.07, -0.03), 'poly', 0.004),
     box((0.032, 0.045, 0.1), (0, 0.04, 0.0), 'grip', 0.006, rot=(-0.25, 0, 0)),
     cyl(0.012, 0.09, (0, -0.27, 0.08), 'metal'),
     box((0.02, 0.18, 0.02), (0, 0.17, 0.08), 'metal'),
     box((0.025, 0.03, 0.07), (0, -0.19, 0.01), 'poly', 0.004),
     box((0.012, 0.03, 0.02), (0, -0.14, 0.115), 'metal')]
out.append(weapon('smg', p, (0, -0.32, 0.08)))
# shotgun: long barrel + tube mag, pump, receiver, wood stock
p = [cyl(0.014, 0.62, (0, -0.42, 0.09), 'metal'),
     cyl(0.012, 0.5, (0, -0.36, 0.06), 'metal'),
     cyl(0.024, 0.18, (0, -0.32, 0.065), 'wood', verts=10),
     box((0.044, 0.2, 0.07), (0, -0.04, 0.07), 'metal', 0.006),
     box((0.04, 0.32, 0.07), (0, 0.22, 0.03), 'wood', 0.01, rot=(0.12, 0, 0)),
     box((0.03, 0.06, 0.09), (0, 0.06, -0.01), 'wood', 0.008, rot=(-0.35, 0, 0))]
out.append(weapon('shotgun', p, (0, -0.73, 0.09)))
# assault rifle: receiver, handguard, curved mag, stock, rail sight
p = [box((0.045, 0.3, 0.075), (0, -0.06, 0.08), 'metal', 0.006),
     box((0.05, 0.25, 0.06), (0, -0.33, 0.085), 'poly', 0.008),
     cyl(0.01, 0.2, (0, -0.55, 0.09), 'metal'),
     box((0.03, 0.06, 0.18), (0, -0.12, -0.03), 'poly', 0.005, rot=(0.25, 0, 0)),
     box((0.032, 0.045, 0.1), (0, 0.04, 0.0), 'grip', 0.006, rot=(-0.3, 0, 0)),
     box((0.04, 0.24, 0.08), (0, 0.24, 0.06), 'poly', 0.01, rot=(0.08, 0, 0)),
     box((0.02, 0.2, 0.02), (0, -0.08, 0.13), 'metal'),
     box((0.012, 0.02, 0.04), (0, -0.42, 0.13), 'metal')]
out.append(weapon('rifle', p, (0, -0.66, 0.09)))
# sniper: long barrel, wood stock, bolt, scope
p = [cyl(0.011, 0.8, (0, -0.52, 0.09), 'metal'),
     box((0.045, 0.24, 0.07), (0, -0.02, 0.075), 'metal', 0.006),
     box((0.045, 0.6, 0.075), (0, -0.05, 0.045), 'wood', 0.012),
     box((0.04, 0.26, 0.11), (0, 0.33, 0.03), 'wood', 0.012, rot=(0.1, 0, 0)),
     cyl(0.022, 0.3, (0, -0.06, 0.15), 'metal', verts=14),
     cyl(0.03, 0.06, (0, -0.22, 0.15), 'metal', verts=14),
     cyl(0.026, 0.05, (0, 0.11, 0.15), 'metal', verts=14),
     cyl(0.024, 0.005, (0, -0.25, 0.15), 'lens', verts=14),
     box((0.04, 0.012, 0.012), (0.03, 0.04, 0.095), 'steel')]
out.append(weapon('sniper', p, (0, -0.93, 0.09)))
# RPG: tube with grips and a warhead in front
p = [cyl(0.045, 1.0, (0, -0.15, 0.13), 'olive', verts=14),
     cyl(0.055, 0.12, (0, 0.33, 0.13), 'olive', verts=14),
     cyl(0.05, 0.18, (0, -0.72, 0.13), 'olive', verts=14, r2=0.012),
     cyl(0.058, 0.08, (0, -0.6, 0.13), 'olive', verts=14),
     box((0.03, 0.045, 0.1), (0, 0.0, 0.04), 'grip', 0.006, rot=(-0.2, 0, 0)),
     box((0.03, 0.045, 0.1), (0, -0.3, 0.04), 'grip', 0.006, rot=(-0.1, 0, 0)),
     box((0.02, 0.05, 0.05), (0.06, -0.15, 0.17), 'metal')]
out.append(weapon('rpg', p, (0, -0.82, 0.13)))
# bat: tapered wood with a knob; the grip is at the origin and it points forward (-Y)
p = [cyl(0.018, 0.4, (0, -0.15, 0), 'batwood', verts=12, r2=0.024),
     cyl(0.024, 0.5, (0, -0.6, 0), 'batwood', verts=12, r2=0.036),
     cyl(0.026, 0.015, (0, 0.06, 0), 'batwood', verts=12),
     cyl(0.0185, 0.16, (0, -0.0, 0), 'grip', verts=12)]
out.append(weapon('bat', p, (0, -0.85, 0)))
# knife
p = [box((0.006, 0.17, 0.028), (0, -0.13, 0.0), 'steel', 0.002),
     box((0.02, 0.11, 0.028), (0, 0.0, 0.0), 'grip', 0.006),
     box((0.03, 0.012, 0.04), (0, -0.05, 0.0), 'metal')]
blade = p[0]
for v in blade.data.vertices:
    if v.co.y < -0.19:
        v.co.z *= 0.2
out.append(weapon('knife', p, (0, -0.22, 0)))
# crowbar: hexagonal bar with a hooked end
p = [cyl(0.011, 0.6, (0, -0.25, 0), 'red', verts=6),
     cyl(0.011, 0.1, (0, -0.58, 0.04), 'red', verts=6, rot=(math.pi / 2 - 0.9, 0, 0)),
     cyl(0.011, 0.08, (0, 0.07, -0.02), 'red', verts=6, rot=(math.pi / 2 + 0.6, 0, 0))]
out.append(weapon('crowbar', p, (0, -0.62, 0.06)))
# grenade
p = [cyl(0.032, 0.08, (0, 0, 0), 'olive', rot=(0, 0, 0), verts=12),
     cyl(0.012, 0.03, (0, 0, 0.05), 'metal', rot=(0, 0, 0), verts=8),
     box((0.012, 0.012, 0.07), (0.022, 0, 0.03), 'metal')]
bpy.ops.mesh.primitive_torus_add(major_radius=0.012, minor_radius=0.002, major_segments=10, minor_segments=4, location=(-0.02, 0, 0.065), rotation=(math.pi / 2, 0, 0))
ring = bpy.context.object
assign(ring, M['steel'])
p.append(ring)
out.append(weapon('grenade', p, (0, 0, 0)))
# molotov: bottle + rag
p = [cyl(0.035, 0.16, (0, 0, 0), 'glass', rot=(0, 0, 0), verts=12),
     cyl(0.035, 0.05, (0, 0, 0.105), 'glass', rot=(0, 0, 0), verts=12, r2=0.013),
     cyl(0.013, 0.05, (0, 0, 0.155), 'glass', rot=(0, 0, 0), verts=10),
     box((0.03, 0.03, 0.08), (0, 0.0, 0.2), 'cloth', 0.008, rot=(0.3, 0.2, 0))]
out.append(weapon('molotov', p, (0, 0, 0.22)))
# rocket in flight (points -Y)
p = [cyl(0.045, 0.5, (0, 0, 0), 'olive', verts=12),
     cyl(0.045, 0.22, (0, -0.36, 0), 'olive', verts=12, r2=0.005),
     box((0.006, 0.12, 0.14), (0, 0.24, 0), 'metal'),
     box((0.14, 0.12, 0.006), (0, 0.24, 0), 'metal')]
out.append(weapon('rocket', p, (0, 0.3, 0)))
# shell casing
c = cyl(0.0045, 0.02, (0, 0, 0), 'brass', rot=(0, 0, 0), verts=6)
c.name = 'casing'
c.data.name = 'casing'
out.append(c)

for o in out:
    o.select_set(True)
kb = export_glb('weapons', out)
result = {'kb': kb, 'tris': {o.name: tris(o) for o in out}}
