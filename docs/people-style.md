# People style: PS2-era, San Andreas-like

Dain wants the people (players and NPCs) to look like GTA San Andreas pedestrians, not modern realistic ones.
Cars and everything else stay as they are. This note collects what makes that look, and how our people
(`assets/src/people.py`, `src/people/*`) follow it. Reference shots were used for style only: every person in the
game is an original Quad Cities local, with our own names, clothes, faces and textures.

## What the San Andreas look is made of

**Budgets.** No official numbers exist. Community figures put San Andreas's main characters at roughly 2,000 polygons
with a single 256×256 8-bit texture, and background pedestrians at about 1,200 polygons
([Polycount thread](https://polycount.com/discussion/comment/718209)). The PS2 had 32 MB of RAM shared across everything, so
each area streamed only a handful of pedestrian models, picked to suit the neighbourhood
([GamesRadar](https://gamesradar.com/games/grand-theft-auto/on-its-20th-anniversary-gta-san-andreas-veteran-shares-the-open-world-was-originally-split-into-three-maps-memory-was-very-tight-on-the-ps2),
[GamePro](https://www.gamepro.de/artikel/ps2-32-mb-ram-gta-san-andreas-tricks,3413612.html)). Peds stayed around Vice City's
polygon counts ([Guru3D](https://guru3d.com/review/grand-theft-auto-san-andreas/page-3)), and players noted they look odd up close.
That's part of the charm.

**How the models were built.** Each ped is one skinned mesh (RenderWare DFF) on a shared ped skeleton, with its textures in a
texture dictionary (TXD) and referenced by name ([MultimediaWiki: TXD](https://wiki.multimedia.cx/index.php/TXD),
[GTAForums rigging tutorial](https://gtaforums.com/topic/265657-the-simplest-rigging-tutorial-in-the-universe/)). Because the skeleton is shared,
any ped can play any animation. The main character's body could also be reshaped (fat and muscle), which is the same idea as our
body-type morphs.

**Silhouette and proportions** (from looking at reference shots):
- The head is a little big for the body (about 1:7 of the height, against a realistic 1:7.5–8), which helps read faces at distance.
- Broad, squarish shoulders and a boxy chest, a narrower waist and simple tube limbs with few joints' worth of rings.
- Hands are chunky blocks: a palm, the fingers as one or two curled slabs, and a separate thumb. Feet are big blocky shoes.
- Builds read from the silhouette alone. *Heavy* has a round belly, wide hips, thick arms and a short-looking neck.
  *Slim* is narrow and stringy. *Muscle* has a big wedge of a chest and shoulders with thick forearms. Women have a narrower
  waist, wider hips and a simple bust shape.

**Faces, hair, clothes: painted, not modelled.**
- The head is a low-poly ball with only the big shapes modelled: brow ridge, a wedge of a nose, the chin and jaw, and blocky ears.
- Eyes, brows, lips, stubble, wrinkles and much of the shading are painted into the face texture: strong dark brows, simple eyes,
  a defined lip line, and baked light on the forehead and cheekbones with shadow under the brows, nose and jaw.
- Hair is a chunky shell over the skull (or a few big clumps), with strands painted in. Only a few styles get extra pieces:
  ponytail, bun, dreads, caps.
- Clothes are mostly texture: seams, folds, pockets, logos, collars and stripes are painted, with heavy baked folds and darkening
  at the sides and under the arms. A few things are real geometry: caps and hats, hoods, collars, a skirt, a tactical vest.
- Textures are low-res and a bit crunchy. Many SA ped textures were later upscaled by modders because the originals are so small
  ([LibertyCity](https://libertycity.net/files/gta-san-andreas/59015-original-skin-pack-for-gta-sa.html)).

**Colour and light.** The 2004 game had a warm, orange-tinted palette, which the 2021 remaster lost and was criticised for
([PCGamesN](https://www.pcgamesn.com/grand-theft-auto-san-andreas/definitive-edition-update)). Much of it came from the time-cycle
colours and a PS2 colour filter ([SkyGFX](https://github.com/aap/skygfx)). On PS2, peds and vehicles always get a light source, so
they never go muddy-dark ([80.lv](https://80.lv/articles/here-are-some-fun-facts-about-gta-san-andreas-insides)). Clothing colours are
mostly muted and earthy (denim, khaki, browns, greys, faded primaries), with a few loud gang and sports colours.

**Animation.** Walks come in groups chosen per ped type: civilian, gang (two swaggering styles), fat, old, old-fat, drunk, shuffle,
jogger, and women's normal, shopping, busy, "sexy", professional, old and fat walks
([MTA wiki: Animation Groups](https://wiki.multitheftauto.com/wiki/Animation_Groups)). Motion is exaggerated and readable rather
than subtle: big arm swings, bouncing gang walks with a lean back and rolling shoulders, a side-to-side waddle for the fat walk,
and a stooped shuffle for old people. Idles are a short loop of breathing, a weight shift and the odd look around. Actions such as
entering cars, punching, hands up and buying snap through clear key poses with quick blends.

## How our people follow it

- **Budget:** about 1,700 triangles for the body (24 bones' worth of rigid-ish rings, 4 body-type shape keys), plus a few hundred
  for hair, hat and overlays. Two draw calls a person (body + merged accessories), one material and one shared atlas.
- **Proportions:** a slightly larger head, broad square shoulders, chunky mitten hands (palm and fingers as one curled block plus a
  thumb), big blocky shoes.
- **Faces:** simple sculpt (brow, nose wedge, mouth block, chin, cheekbones), with eyes, brows, lips, stubble, freckles, wrinkles and
  baked shading painted per face in `src/people/paint.js`. 14 faces (6 men, 4 women, a teen boy and girl, an older man, a freckled
  woman), each with a scared variant.
- **Hair:** 20 chunky shells whose edge follows a real hairline (temples, sideburns, around the ears, the nape), plus curtains for
  long hair and a few extra pieces (ponytail, bun, dreads, braids, man bun).
- **Clothes:** painted regions in an 8×12 cell atlas (1024 px on medium) with baked folds. Loose clothes stand off the body in the
  shader (`pFit`). Geometry overlays: hood, coat collar, skirt, SWAT vest, police duty belt, and caps and hats.
- **Palette:** our `CLOTH` palette is already muted. The daylight and colour grade are not changed (people only).
- **Animation:** SA-like walk styles per type (gang swagger, heavy waddle, old shuffle, women's walk) and readable key poses for the
  interactive actions; see `src/people/pose.js` and `src/anim.js`.

## Flynn Arnett (story lead)

Look array `[2, 1, 10, 1, 1, 6, 29, 0, 0, 4, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]`: heavy body, teen face (10), light skin, short hair in
blonde (hair colour 6), torn T-shirt (top 29) in white, grey sweatpants (bottom 4, colour 2), white sneakers. At rig scale 1.0 he
stands about 1.78 m (5'10").
