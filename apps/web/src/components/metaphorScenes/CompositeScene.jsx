/**
 * Composite dispatcher. V2 `fused` plans one integrated kinetic world; explicit
 * v1 `adjacent`/`overlay` documents still mount their original base scenes.
 */
import { useMemo } from 'react';
import { ItemLabel, MetaphorLinks } from './MetaphorSceneChrome.jsx';
import { resolveCompositeLayerTransform } from './compositeLayerTransform.js';
import { FusedCompositeScene } from './FusedCompositeScene.jsx';

/**
 * @param {object} props
 * @param {object} props.dsl — composite MetaphorDsl
 * @param {object} props.theme
 * @param {(childDsl: object, theme: object) => import('react').ReactNode} props.renderBaseScene
 *        Renders one base metaphor scene (city/river/…) — supplied by MetaphorRenderer
 *        so City/Layercake stay local to that module without extraction.
 */
function LegacyCompositeScene({ dsl, theme, renderBaseScene }) {
  const layout = dsl.layout === 'overlay' ? 'overlay' : 'adjacent';

  const layerWorld = useMemo(() => {
    const layers = Array.isArray(dsl.layers) ? dsl.layers : [];
    return layers.map((layer, index) => ({
      layer,
      transform: resolveCompositeLayerTransform(layer, index, layout, layers.length)
    }));
  }, [dsl.layers, layout]);

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

export function CompositeScene({ dsl, theme, renderBaseScene }) {
  if (dsl.layout !== 'adjacent' && dsl.layout !== 'overlay') {
    return <FusedCompositeScene dsl={dsl} theme={theme} />;
  }
  return <LegacyCompositeScene dsl={dsl} theme={theme} renderBaseScene={renderBaseScene} />;
}
