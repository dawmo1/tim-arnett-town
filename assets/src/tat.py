# Shared helpers for building Tim Arnett Town models in Blender.
# Each asset script starts with:  exec(open(ROOT + 'assets/src/tat.py').read(), globals())
# then builds its objects and calls export_glb(). Run them through Blender's Python (the MCP or
# blender --background --python assets/src/<script>.py).
import bpy, bmesh, math, os
from mathutils import Vector, Matrix, Euler

ROOT = '/Users/dainmoens/Documents/Tim Arnett Town/'
OUT = ROOT + 'assets/models/'


def reset():
    """Empty the scene and purge unused data so every build starts clean."""
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures, bpy.data.actions, bpy.data.images, bpy.data.curves):
        for d in list(coll):
            if d.users == 0:
                coll.remove(d)
    for c in list(bpy.data.collections):
        bpy.data.collections.remove(c)


_mats = {}


def mat(name, color=(0.8, 0.8, 0.8), rough=0.7, metal=0.0, emit=None, alpha=1.0):
    """A Principled material; the game swaps in its own materials by name, so names matter."""
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*color, 1)  # what the quick previews show
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1.0
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def assign(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)


def link(obj, coll=None):
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, m=None, smooth=False):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    link(o)
    if m:
        assign(o, m)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return o


def empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    link(e)
    if parent:
        e.parent = parent
    return e


def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def apply_mods(o):
    select_only([o])
    for md in list(o.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=md.name)
        except Exception as e:
            print('modifier', md.name, e)


def join(objs, name):
    select_only(objs)
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def shade_auto(o, angle=40):
    for p in o.data.polygons:
        p.use_smooth = True
    try:
        select_only([o])
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        pass


def export_glb(name, objs=None, anims=False):
    """Export the given objects (default: everything) to assets/models/<name>.glb."""
    os.makedirs(OUT, exist_ok=True)
    objs = objs or [o for o in bpy.context.scene.objects]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
        for c in o.children_recursive:
            c.select_set(True)
    path = OUT + name + '.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='EXPORT', export_animations=anims, export_skins=True,
                              export_extras=False, export_cameras=False, export_lights=False)
    return os.path.getsize(path) // 1024


def preview(path, target=(0, 0, 1), dist=3.0, yaw=20, pitch=8, size=(640, 640), lens=50, engine='BLENDER_WORKBENCH'):
    """Render a quick look at the scene from a camera orbiting `target` (yaw 0 = from the front, -Y)."""
    sc = bpy.context.scene
    cam = bpy.data.objects.get('_cam')
    if cam is None:
        cam = bpy.data.objects.new('_cam', bpy.data.cameras.new('_cam'))
        sc.collection.objects.link(cam)
    cam.data.lens = lens
    y, p = math.radians(yaw), math.radians(pitch)
    tx, ty, tz = target
    cam.location = (tx + math.sin(y) * math.cos(p) * dist, ty - math.cos(y) * math.cos(p) * dist, tz + math.sin(p) * dist)
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.engine = engine
    if engine == 'BLENDER_WORKBENCH':
        sh = sc.display.shading
        sh.light = 'STUDIO'
        sh.color_type = 'MATERIAL'
        sh.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = size
    sc.render.film_transparent = False
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path
