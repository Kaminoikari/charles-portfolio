"""Mika's base body: the VRoid export this build starts from.

These are not choices. They are measurements of art the export already contains,
and the build has to read them to avoid recolouring the wrong texels. A second
base body needs its own module with its own numbers, which is why they are not
in build.py where they read as the pipeline's settings.

Measured rather than derived, and the difference is worth stating. The two hair
material names that used to sit beside these ARE derived now, from the
primitives the partition labelled Hair_*, because a name has somewhere stable to
be read from. A hue does not: finding the cap in the atlas without being told
where it is means clustering texels by colour and deciding which cluster is hair
rather than blush, on a body where the blush sits 9 degrees from the lips.
Until that detector exists and can be checked against a second export, a
measured number that says which export it was measured on is the honest form.
"""

# The hue the scalp cap sits at BEFORE anything here touches it. VRoid paints a
# hair-coloured cap into the face atlas so a parting shows hair and not skin,
# and neither the untouched export nor the pink repaint moved it: it is still
# the original purple, 265 on the export and 257 on the repaint. A window either
# side catches both without reaching the skin at 9 or the lips at 0.
SCALP_HUE, SCALP_WINDOW = 261.0, 45.0
# The cap's anti-aliased edge. Along it the hue walks from the cap (265)
# through magenta to the skin (9): it leaves the window at 306 and only reaches
# skin at about 345. Recolouring the window alone left that edge to the SKIN
# solve, which turned it mauve -- the purple lines behind the neck and along the
# hairline the owner reported on 2026-09-04, still there after the 09-03 fix.
# Texels on the arc with chroma above SCALP_FRINGE_SAT that touch the cap are
# the fringe; the lips (0) and the blush (9) sit past the end and never touch it.
SCALP_FRINGE_TO, SCALP_FRINGE_SAT = 345.0, 0.12


# ---------------------------------------------------------------------------
# The export's own vocabulary: what VRoid named the textures and the two skin
# materials. These were twenty-two inline occurrences in build.py until
# 2026-09-11, on eighteen lines, spelling the twelve distinct names below, which
# is why the constant inventory in
# docs/plans/avatar-build-module-contracts.md missed them: a name spelled inside
# a function is not a constant and does not show up when you list them. (The
# file held twenty-four occurrences in all; the other two were the module-level
# constants HEAD_HAIR and OUTLINE_KEEP, which that inventory did find.)
#
# Declared rather than derived, and not for the same reason as the hues above.
# Some of these could be found from the meshes -- the face atlas is the texture
# on the Face part's skin material -- but the brow and the iris can only be told
# apart from the rest of the face atlas' siblings by their names, so a rule that
# derives some and declares others would be harder to check than one that
# declares them all. build.py derives the two hair MATERIAL names, because those
# have somewhere stable to be read from; everything here is a name.
# ---------------------------------------------------------------------------

# The hair colour lives in six textures rather than in a material factor, so
# moving it means rotating the textures themselves.
HAIR_TEXTURES = tuple(f'F00_000_Hair_00_0{i}' for i in range(1, 7))
BROW_TEXTURE = 'F00_000_00_FaceBrow_00'
IRIS_TEXTURE = 'F00_000_00_EyeIris_00'

# The two skin atlases. They are solved onto one target so the neck seam stays
# closed, so anything that touches one usually has to touch the other.
FACE_ATLAS = 'F00_000_00_Face_00'
BODY_ATLAS = 'F00_000_00_Body_00'
SKIN_ATLASES = (FACE_ATLAS, BODY_ATLAS)

# The materials those atlases are painted on, which is what the MToon tone pass
# addresses.
FACE_SKIN_MATERIAL = 'F00_000_00_Face_00_SKIN'
BODY_SKIN_MATERIAL = 'F00_000_00_Body_00_SKIN'
