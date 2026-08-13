import * as THREE from "three"

/**
 * Cheap per-viewer copies of a procedurally built model.
 *
 * Both factories on this page are expensive one-time builds — the paddle is
 * ~1.7s of synchronous geometry construction, the ball rasterises a 1024x512
 * perforation mask texel by texel — and the page stands up several viewers of
 * each. Paying the build per viewer blocked the main thread for seconds, which
 * is what made the 3D slow to appear; the chunks are down in ~120ms, so the
 * wait was never the network.
 *
 * The copy deliberately does not use `Object3D.clone()`. Three's `copy()`
 * round-trips `userData` through `JSON.parse(JSON.stringify(...))`, and both
 * factories hang their sculpt spec off `userData` on every node. Anything in
 * there that reaches a `THREE.Texture` gets `toJSON`'d, which serialises the
 * PBR maps into data URLs — measured at ~1.4s of `getDataURL`, trading the
 * geometry cost for an even worse one.
 *
 * So: walk the tree, and share geometry, materials, textures and `userData` by
 * reference, copying only the per-node transform. Nothing mutates those at
 * runtime except `applyMeasuredResponse` in `paddle-scene`, which is idempotent
 * and writes the same measured values in every scene. Sharing the materials
 * also keeps each map to a single fetch and a single GPU upload for the page.
 *
 * The consequence for teardown is that an instance owns *nothing*: see
 * `disposeInstance`.
 */
export function shallowCopyNode(source: THREE.Object3D): THREE.Object3D {
  const target =
    source instanceof THREE.Mesh
      ? new THREE.Mesh(source.geometry, source.material)
      : source instanceof THREE.Group
        ? new THREE.Group()
        : new THREE.Object3D()

  target.name = source.name
  target.position.copy(source.position)
  target.quaternion.copy(source.quaternion)
  target.scale.copy(source.scale)
  target.visible = source.visible
  target.castShadow = source.castShadow
  target.receiveShadow = source.receiveShadow
  target.renderOrder = source.renderOrder
  target.frustumCulled = source.frustumCulled
  // By reference on purpose: it is read-only provenance metadata, and copying it
  // is exactly what makes `Object3D.clone()` expensive here.
  target.userData = source.userData

  for (const child of source.children) target.add(shallowCopyNode(child))
  return target
}

/**
 * Detaching an instance is the whole of its teardown.
 *
 * Every geometry, material and texture under a copied model belongs to the
 * shared prototype, which is a page-lifetime cache — another viewer is very
 * likely still rendering with it. Disposing any of them here would yank the
 * GPU resources out from under that viewer (and force the prototype's next
 * instance to re-upload them), so an instance releases only its own scene
 * graph, which is plain JS objects the GC can take.
 */
export function disposeInstance(model: THREE.Object3D): void {
  model.removeFromParent()
}
