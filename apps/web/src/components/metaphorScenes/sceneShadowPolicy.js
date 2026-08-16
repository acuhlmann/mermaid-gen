/**
 * Which meshes take part in shadow casting.
 *
 * Casting is opt-out by material, not blanket. Glows, sprites, particle
 * billboards and troika label quads are `MeshBasicMaterial` or transparent;
 * letting them cast paints hard black rectangles across the scene where a soft
 * halo was intended. Ambience subtrees are excluded entirely — a firefly
 * casting a shadow is both wrong and expensive.
 *
 * Split from SceneKeyLight.jsx so the component file exports only components
 * (the repo's react-refresh boundary, same reason sceneFraming.js is separate).
 */
import { FRAME_IGNORE } from './sceneFraming.js';

/** How dark a fully-shadowed surface goes. 1 blacks out low-ambient themes. */
export const SHADOW_INTENSITY = 0.62;

/** Shadow-map resolution. 2048 is the usual quality/cost knee for one light. */
export const SHADOW_MAP_SIZE = 2048;

/**
 * True when a mesh should cast. The rule that matters: unlit or transparent
 * decoration never casts.
 */
export function meshShouldCast(object) {
  if (!object.isMesh || object.userData?.[FRAME_IGNORE]) return false;
  const material = object.material;
  if (!material) return false;
  const materials = Array.isArray(material) ? material : [material];
  return materials.every(
    (mat) =>
      !mat.isMeshBasicMaterial &&
      // Troika's label material is a derived shader, not a standard material.
      !mat.isRawShaderMaterial &&
      !mat.isShaderMaterial &&
      !mat.transparent
  );
}

/**
 * Receiving is broader than casting on purpose: the ground discs are often
 * drawn with a transparent material (so they never cast), but a tower's shadow
 * has to land on them or the scene reads unlit.
 */
export function meshShouldReceive(object) {
  return Boolean(object.material) && !object.material.isMeshBasicMaterial;
}
