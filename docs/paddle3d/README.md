# Paddle Power paddle — procedural Three.js model

Built from `public/images/paddlepower-paddle.jpeg` with the `img2threejs` skill: a code-only
procedural reconstruction, not a mesh import. Ten named, separable parts; 13,564 triangles.

## Using it

```tsx
import { PaddleViewer } from "@/lib/paddle3d/paddle-viewer"
;<PaddleViewer className="h-[520px] w-full" spinSpeed={18} />
```

Transparent background, drag to orbit, auto-spins when idle, pauses off-screen and on hidden
tabs, and does not auto-spin under `prefers-reduced-motion`.

For a custom scene, use the pieces directly:

```ts
import {
  createPaddleScene,
  configurePaddleRenderer,
} from "@/lib/paddle3d/paddle-scene"
```

`root.userData.sculptRuntime` exposes `nodes`, `meshes`, `sockets`, `colliders` and
`destructionGroups`. Useful sockets: `root:grip-hand` (the swing pivot, at y = 0.070) and
`root:sweet-spot` (ball contact, on the front face at the plate centroid).

## Files

| Path                                    | What                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/paddle3d/createPaddleModel.ts` | Generated factory. **Do not hand-edit** — regenerate instead.                |
| `src/lib/paddle3d/paddle-scene.ts`      | Lighting, environment, camera, and the measured material response.           |
| `src/lib/paddle3d/paddle-viewer.tsx`    | Drop-in React viewer.                                                        |
| `src/app/paddle-3d/page.tsx`            | Review harness — renders at the reference framing and exposes capture hooks. |
| `tools/patch_paddle_factory.py`         | Post-generation patch. Idempotent; re-run after every regeneration.          |
| `public/images/paddle-face-*`           | Face plate PBR set (de-lit reference albedo + 4 extracted channels).         |
| `public/images/paddle-grip-*`           | Grip PBR set (de-lit albedo + 4 extracted channels).                         |

## Regenerating

```bash
SKILL=~/.claude/skills/img2threejs
python3 $SKILL/forge/stage2_spec/validate_sculpt_spec.py docs/paddle3d/object-sculpt-spec.json --strict-quality
python3 $SKILL/forge/stage3_build/generate_threejs_factory.py docs/paddle3d/object-sculpt-spec.json \
  --out src/lib/paddle3d/createPaddleModel.ts --pass-id surface-pass --force
python3 tools/patch_paddle_factory.py
npm run typecheck
```

The patch step is not optional. The generator replaces a component's authored geometry with a
tapered cylinder whenever it has a complete `attachment`, which is right for the handle core and
the three collar rings and wrong for the extruded face plate, the guard ring, the two lathed grip
parts and the tube helix. It also remaps the face plate's UVs from metres to 0..1 so the decal
lands where it was measured.

## How faithful is it

Measured against the reference, front view at matched framing:

| Check                              | Result                                  |
| ---------------------------------- | --------------------------------------- |
| Silhouette IoU                     | 0.990                                   |
| Aspect / scale delta               | 0.0045 / 0.0045                         |
| Bilateral symmetry error           | 0.0086                                  |
| Width profile at 6 landmarks       | within 0.0022 of total length           |
| Self-intersection                  | 0 vertices inside, across all 10 meshes |
| Turntable 0/90/180/270             | non-degenerate, no interior holes       |
| Part coverage                      | 9 specified, 10 built, 0 errors         |
| Per-material colour, own footprint | mean absolute channel delta 9.6 / 255   |

The face outline is not estimated: it is a rounded rectangle fitted to the mask at W=1032,
H=1266, r=366 px, verified against three independent measured rows. Every other dimension is a
measured pixel ratio at S = 0.42 m / 2029 px.

## What is inferred, not measured

The reference is a single dead-on frontal photo, so it carries **no Z evidence at all**:

- **Head thickness** (16 mm, guard 2 mm proud per side) is category convention.
- **The rear face** is assumed to mirror the front, decal included. Many paddles print a
  different rear. This is the lowest-confidence claim in the model (0.35).
- **The handle core** is modelled octagonal by convention; it is never visible under the wrap.
- **Overall length** (0.42 m) is convention. Proportions are measured, so they hold even if the
  absolute scale is wrong.
- **Wrap helix**: 11 turns, right-handed, estimated from low-contrast ridge spacing.

A side view and a rear view would resolve the first three. Ask for them before treating any
thickness or rear-face detail as accurate.

## Known open item

`diagnose_render.py`'s per-part colour check compares each component's recipe against five
k-means clusters over the **whole frame** — a coarse proxy its own docstring flags as such. It
holds the grip family at delta-E 21–22 against a 20 threshold, while the grip measured on its own
visible footprint is within 8/255 and improving. The two metrics moved in opposite directions
across three iterations. The residual is the grip cylinder's shading falloff, which the reference
does not show because it was shot under a large wraparound softbox.

Because that gate does not pass, `surface-pass` was not credited, and the **lighting**,
**interaction** and **optimization** passes were not run. The model is complete and usable as it
stands; those passes would tune lighting presets, formalise the interaction rig, and set LOD
tiers. Triangle count is already 13,564 against a 60,000 budget.

## Pipeline artifacts

`analysis.md` (layered observation of the reference), `assessment.json` (complexity + quality
contract), `detail-inventory.json`, `projection.json`, `object-sculpt-spec.json` (the spec, with
the full review history under `reviewHistory`), `parts.json`, `pipeline-state.json`, and
`renders/`. `measure.py` and `cluster.py` are the two measurement scripts referenced above.
