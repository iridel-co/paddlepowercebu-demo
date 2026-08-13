# Image Analysis — paddlepower-paddle.jpeg

Reference: `public/images/paddlepower-paddle.jpeg`, 2048×2048 JPEG, pure-white studio
background, single centred subject, near-orthographic frontal product view, flat diffuse
studio lighting (no hard specular streak on the face plate).

All pixel measurements below are in original 2048 px image space. Subject centre line
x = 1021 (image centre 1024 → bilateral symmetry confirmed to within 3 px).

---

## Layer 1 — Identification & classification

- **Observe:** rigid, bilaterally symmetric striking implement: a large flat plate on a
  short tapered neck ending in a wrapped cylindrical handle with a butt flare.
- **Work type:** pickleball paddle, elongated-face profile.
- **Broad classification:** sports implement / rigid composite prop.
- **`primaryDomain`:** `object`.
- **Confidence:** 0.96. (Padel racket ruled out — no perforated face holes, no cord
  bridge; pickleball paddles are solid-faced with a flush edge guard.)
- **Inference (marked):** face construction is a honeycomb-core composite sandwich; not
  observable, inferred from category.

## Layer 2 — Overall form & silhouette

- **Bounding volume:** an extruded planar profile (face + throat) plus a cylinder of
  revolution (handle). Not one primitive — two, joined at the collar.
- **Symmetry:** bilateral about the vertical long axis. The handle is additionally
  near-radial.
- **Shape language:** geometric, with tangent-continuous fillets between regions.
- **Measured silhouette** (px):
  | Landmark | y | half-width / width |
  |---|---|---|
  | face plate top edge | 13 | — |
  | face plate max width | 397–909 | 1032 (x 505–1537) |
  | face plate bottom edge (fitted) | 1279 | — |
  | throat mid | 1357 | 331 |
  | collar top (black ring) | 1388 | ~200 |
  | collar bottom | 1462 | ~195 |
  | grip barrel | 1549–1900 | 187–190 |
  | butt cap flare / bottom | 1997 / 2042 | 217 |
- **Fitted face outline:** rounded rectangle, W = 1032, H = 1266 (y 13→1279), corner
  radius **r = 366 px** (r/W = 0.355). Fit verified at three independent rows —
  predicted vs measured half-width: y141 428 / 428.5, y1101 464 / 464, y1165 415 / 415.5.
  This is a measurement, not an estimate.
- **Aspect:** face H/W = 1.226; total length / face width = 2029 / 1032 = 1.966.

## Layer 3 — Macro → meso → micro decomposition

- **Macro:** (1) face plate, (2) perimeter edge guard, (3) throat, (4) collar assembly,
  (5) grip, (6) butt cap.
- **Meso:** face front skin, face rear skin, edge-guard bead (raised lip proud of the
  face skins), collar ring A (black), ring B (gold), ring C (black), grip wrap spiral,
  wrap terminal seam, butt-cap flange.
- **Micro:** grip perforation dot field (measured dark-pixel fraction 0.036 of the grip
  area — small sparse round perforations, not a dense knurl), wrap overlap ridge running
  as a helix, edge-guard seam stipple visible along the perimeter, face graphic decal
  (triangle mark + "PADDLE" / "POWER" / "PLAY. CONNECT. RECHARGE.").

## Layer 4 — Spatial relationships (scene-graph)

- `<edgeGuard, wraps-perimeter-of, facePlate>` — contact: overlap, guard bead proud on
  both front and rear faces.
- `<throat, tangent-continuous-with, facePlate>` — contact: fused; the throat fillet
  leaves the face plate's bottom corner arcs tangentially (confirmed: measured widths at
  y1229 sit on the fitted corner arc, y1293 and below depart from it).
- `<collarAssembly, encircles, handleCore>` at the proximal handle end — contact: socket.
- `<gripWrap, wound-around, handleCore>` — contact: overlap helix, distal of the collar.
- `<buttCap, socket-joins, handleCore>` at the distal end, flaring outward.

## Layer 5 — Materials & surface (PBR)

One material claim per distinct surface, all measured as median RGB over a sampled region:

| Region                    | Median RGB              | Read                                          |
| ------------------------- | ----------------------- | --------------------------------------------- |
| face plate field          | (59, 71, 71)            | dielectric, metalness 0, satin-matte          |
| edge guard (left / right) | (55,66,68) / (65,75,77) | same albedo family, slightly higher roughness |
| logo triangle + "PADDLE"  | (173, 203, 4)           | opaque decal ink, matte                       |
| "POWER" + tagline         | ≈(235, 216, 190)        | opaque decal ink, matte                       |
| collar rings A/C          | (26, 29, 33)            | near-black polymer, satin                     |
| collar ring B             | (182, 153, 92)          | **metallic** — the only metal on the object   |
| grip wrap                 | (228, 211, 182)         | PU synthetic, high roughness, perforated      |
| butt cap                  | (222, 206, 178)         | same wrap material continuing over the flange |

- **Observation:** the left/right edge-guard samples differ by ~10 levels — that is the
  key light falling from the upper right, _not_ two albedos. Do not bake it in.
- **Inference (marked):** face roughness ≈ 0.6 (satin composite, no visible sheen band);
  gold ring metalness ≈ 0.9 / roughness ≈ 0.35; grip roughness ≈ 0.85.

## Layer 6 — Colour & finish

- Face: hue ≈ 185° (cyan-leaning), very low saturation, low value — dark slate/gunmetal.
  Finish: **satin**, uniform, no gradient across the plate.
- Logo green: hue ≈ 71°, high saturation, mid-high value — vivid yellow-green. Matte.
- Cream: hue ≈ 34°, low saturation, high value. Matte.
- Gold ring: hue ≈ 41°, mid saturation — **metallic**, not a yellow paint. It is the one
  region whose value varies along its own width, which is the metal cue.
- Grip: hue ≈ 36°, low saturation, high value, matte.
- No multi-tone finish, gradient stops, or pattern anywhere. This is a solid-albedo
  object with one decal — the opposite of a patterned skin.

## Layer 7 — Identity-defining features

1. **Elongated face outline** with r/W = 0.355 corner radius — the single strongest
   silhouette identifier; a square-cornered or oval face reads as a different paddle.
2. **Face graphic decal** — triangle mark with negative-space bell/paddle figure, plus
   the three text lines. This is what makes it _Paddle Power_ rather than a generic
   paddle.
3. **Gold collar ring between two black rings** — the only metal, and the only high-value
   accent on an otherwise dark upper half.
4. **Cream perforated grip** — off-white against a dark head; a black grip reads wrong.
5. **Perimeter edge guard proud of the face** — visible as a distinct band 12–18 px wide
   inside the silhouette all the way around.
6. **Tangent-continuous throat fillet** — no shoulder, no step between face and handle.

## Layer 8 — Uncertainty & single-image limits

- **Hidden:** the entire rear face. Inferred symmetric with the front but with unknown
  graphics (many paddles print a different rear). _Needs another view._
- **Hidden:** total thickness. A frontal orthographic view gives zero Z evidence. The
  core thickness, the edge-guard bead depth, and the handle cross-section (round vs
  octagonal — pickleball handles are usually octagonal under the wrap) are all
  **undetermined from this image** and will be filled from category convention, flagged
  as inference.
- **Uncertain:** grip wrap helix pitch and direction — readable but low contrast.
- **Uncertain:** butt cap profile below y=1997; it may be partially in its own shadow.
- **Occluded:** the collar's rear side and the wrap's start terminal.
- **Not derivable:** real-world scale. Length set from category convention
  (0.42 m overall), all other dimensions derived from measured pixel ratios.

## Suitability verdict

**PASS.** One unambiguous target, fills the frame, clean silhouette against white, all
major materials visible, hidden side reasonably inferable by symmetry, and the whole form
is reachable with an extruded profile + surfaces of revolution. No smoke/liquid/glass/lace.
The only honest caveat is the thickness axis, recorded above as inference.
