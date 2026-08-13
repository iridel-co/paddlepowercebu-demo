#!/usr/bin/env python3
"""Post-generation patch for the img2threejs-generated paddle factory.

Run after every `generate_threejs_factory.py` run. Idempotent.

Two fixes, both recorded in object-sculpt-spec.json under `assumptions`:

1. attachment-cylinder substitution
   The generator replaces a component's authored geometry with a tapered cylinder along
   `attachment.localStart -> localEnd` whenever the attachment is complete. That is correct for
   the handle core and the three collar rings — they are cylinders and their spans carry the
   measured radii — and destroys the extruded face plate, the swept edge-guard bead, the two
   lathed grip parts and the tube helix, whose forms are authored in `geometryDescriptor`.
   Setting those components' endpoint consts to null restores the authored geometry and the
   authored transform. The attachment metadata stays in `userData`, so the join is still
   described; it just no longer fabricates a cylinder.

2. face-plate UVs
   `THREE.ExtrudeGeometry` emits front/back UVs in the shape's local units — here, metres. The
   de-lit reference albedo needs 0..1 over the profile bounding box or it tiles. Appends a
   normalisation over the geometry's own bounding box.

Usage:  python3 tools/patch_paddle_factory.py [path/to/createPaddleModel.ts]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

DEFAULT_TARGET = Path("src/lib/paddle3d/createPaddleModel.ts")

# Components whose form is authored in geometryDescriptor, not by an attachment span.
AUTHORED_GEOMETRY = ("facePlate", "edgeGuard", "gripWrap", "gripWrapHelix", "buttCap")

MARKER = "/* patched by tools/patch_paddle_factory.py */"

# A plain `const x: AttachmentEndpoint | null = null` gets narrowed to `null` by TypeScript, which
# turns the generator's `if (endpoint)` branches into `never`. Returning it from a function keeps
# the declared union, so the generated branches still typecheck.
AUTHORED_ENDPOINT = """
function authoredGeometryEndpoint(): AttachmentEndpoint | null {
  /* patched by tools/patch_paddle_factory.py */
  // This component's form comes from its geometryDescriptor, so it takes the generator's
  // authored-geometry branch instead of the attachment-cylinder branch.
  return null;
}
"""

UV_REMAP = """
function remapExtrudeUvsToBounds(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  /* patched by tools/patch_paddle_factory.py */
  // ExtrudeGeometry emits UVs in the shape's local units (metres here). The de-lit reference
  // albedo is authored over the profile bounding box, so normalise to 0..1 or it tiles.
  const uv = geometry.getAttribute('uv');
  if (!uv) return geometry;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) return geometry;
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  if (w <= 0 || h <= 0) return geometry;

  // Both extrude caps share the shape's XY coordinates, so they share UVs — which means the
  // back cap shows the decal mirrored, read from behind. Mirror U on the back cap only, so the
  // logo reads correctly from both sides. Cap vertices are identified by their normal facing
  // straight down -Z; the side walls (whose normals point outward in XY) are left alone.
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < uv.count; i += 1) {
    let u = (uv.getX(i) - box.min.x) / w;
    const v = (uv.getY(i) - box.min.y) / h;
    if (normal && normal.getZ(i) < -0.9) u = 1 - u;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
  return geometry;
}
"""


def patch(source: str) -> tuple[str, list[str]]:
    applied: list[str] = []

    for component in AUTHORED_GEOMETRY:
        pattern = re.compile(
            rf"^(\s*)const (endpoint_{component}_\d+) = makeAttachmentEndpoint\(([^)]*)\);$",
            re.MULTILINE,
        )

        def replace(match: re.Match[str]) -> str:
            indent, name, arg = match.group(1), match.group(2), match.group(3)
            return (
                f"{indent}// {MARKER} authored geometryDescriptor form, not an attachment cylinder.\n"
                f"{indent}void makeAttachmentEndpoint({arg});\n"
                f"{indent}const {name} = authoredGeometryEndpoint();"
            )

        source, count = pattern.subn(replace, source)
        if count:
            applied.append(f"endpoint-null:{component}")

    anchor = "// Generated from ObjectSculptSpec target:"
    if "authoredGeometryEndpoint" in source and "function authoredGeometryEndpoint" not in source:
        source = source.replace(anchor, AUTHORED_ENDPOINT.strip() + "\n\n" + anchor, 1)
        applied.append("authored-endpoint:helper")

    if "remapExtrudeUvsToBounds" not in source:
        source = source.replace(anchor, UV_REMAP.strip() + "\n\n" + anchor, 1)
        applied.append("uv-remap:helper")

    uv_call = re.compile(
        r"^(\s*)(const (mesh_facePlate_\d+Geometry) = [\s\S]*?);$",
        re.MULTILINE,
    )
    if "remapExtrudeUvsToBounds(mesh_facePlate" not in source:
        match = uv_call.search(source)
        if match:
            indent, var = match.group(1), match.group(3)
            source = (
                source[: match.end()]
                + f"\n{indent}remapExtrudeUvsToBounds({var});"
                + source[match.end():]
            )
            applied.append("uv-remap:call")

    return source, applied


def main() -> int:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TARGET
    if not target.exists():
        print(f"error: {target} not found", file=sys.stderr)
        return 2
    original = target.read_text()
    patched, applied = patch(original)
    if not applied:
        print(f"{target}: already patched, no change")
        return 0
    target.write_text(patched)
    print(f"{target}: applied {len(applied)} patch(es)")
    for item in applied:
        print(f"  - {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
