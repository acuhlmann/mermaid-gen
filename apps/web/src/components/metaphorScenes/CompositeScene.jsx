/**
 * Experimental composite metaphor — mounts existing base metaphor scenes as
 * layers at runtime without modifying those scenes. `adjacent` parks layers
 * side-by-side; `overlay` stacks them near the origin (more collision-prone).
 */
import { useMemo } from 'react';
import { ItemLabel, MetaphorLinks } from './MetaphorSceneChrome.jsx';
import { resolveCompositeLayerTransform } from './compositeLayerTransform.js';

/**
 * @param {object} props
 * @param {object} props.dsl — composite MetaphorDsl
 * @param {object} props.theme
 * @param {(childDsl: object, theme: object) => import('react').ReactNode} props.renderBaseScene
 *        Renders one base metaphor scene (city/river/…) — supplied by MetaphorRenderer
 *        so City/Layercake stay local to that module without extraction.
 */
export function CompositeScene({ dsl, theme, renderBaseScene }) {
  const layers = Array.isArray(dsl.layers) ? dsl.layers : [];
  const layout = dsl.layout === 'overlay' ? 'overlay' : 'adjacent';

  const layerWorld = useMemo(
    () =>
      layers.map((layer, index) => ({
        layer,
        transform: resolveCompositeLayerTransform(layer, index, layout, layers.length)
      })),
    [layers, layout]
  );

  // Approximate cross-layer link anchors: layer origin + a small lift. Exact
  // per-item anchors would require each base scene to export them; good enough
  // for the experiment so cross-layer edges remain visible.
  const anchors = useMemo(() => {
    const map = new Map();
    for (const { layer, transform } of layerWorld) {
      const [ox, oy, oz] = transform.position;
      const items = Array.isArray(layer.items) ? layer.items : [];
      for (const item of items) {
        if (!item?.id) continue;
        map.set(item.id, [ox, oy + 2.5 * transform.scale, oz]);
      }
    }
    return map;
  }, [layerWorld]);

  return (
    <group>
      {layerWorld.map(({ layer, transform }) => {
        const childDsl = {
          metaphor: layer.as,
          scene: dsl.scene ?? {},
          items: Array.isArray(layer.items) ? layer.items : [],
          // Per-layer links stay empty; composite-level links draw once below.
          links: []
        };
        const label = layer.label || layer.as;
        return (
          <group
            key={layer.id}
            position={transform.position}
            scale={[transform.scale, transform.scale, transform.scale]}
          >
            {renderBaseScene(childDsl, theme)}
            {layout === 'adjacent' ? (
              <ItemLabel
                text={label}
                position={[0, 14, 0]}
                fontSize={0.7}
                color={theme.labelColor}
                outlineColor={theme.labelOutline}
              />
            ) : null}
          </group>
        );
      })}
      <MetaphorLinks links={dsl.links ?? []} anchors={anchors} theme={theme} />
    </group>
  );
}
