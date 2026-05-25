import { useMemo } from 'react';
import { sanitizeMetaphorDsl } from '@archislop/shared';

const AXES_BY_METAPHOR = {
  city: ['height', 'footprint', 'district'],
  layercake: ['thickness'],
  galaxy: ['magnitude', 'cluster'],
  tree: ['weight'],
  terrain: ['elevation', 'intensity']
};

function legendEntries(metaphor, legend, surfaceMetric) {
  const relevant = AXES_BY_METAPHOR[metaphor] ?? [];
  const out = [];
  for (const axis of relevant) {
    const value = legend?.[axis];
    if (typeof value === 'string' && value.trim()) {
      out.push({ axis, value });
    }
  }
  if (metaphor === 'terrain' && typeof surfaceMetric === 'string' && surfaceMetric.trim()) {
    if (!out.some((entry) => entry.axis === 'elevation')) {
      out.push({ axis: 'elevation', value: surfaceMetric });
    }
  }
  return out;
}

export default function MetaphorSceneOverlay({ diagramSource, streamingPreview = false }) {
  const overlay = useMemo(() => {
    if (streamingPreview) return null;
    const raw = (diagramSource ?? '').trim();
    if (!raw) return null;
    const sanitized = sanitizeMetaphorDsl(raw, { allowStructureRewrite: false });
    const dsl = sanitized.dsl;
    if (!dsl) return null;
    const scene = dsl.scene ?? {};
    const entries = legendEntries(dsl.metaphor, scene.legend, scene.surface?.metric);
    if (!scene.title && !scene.subtitle && entries.length === 0) return null;
    return {
      title: scene.title ?? '',
      subtitle: scene.subtitle ?? '',
      entries
    };
  }, [diagramSource, streamingPreview]);

  if (!overlay) return null;

  return (
    <div className="metaphor-scene-overlay" aria-live="polite">
      {overlay.title ? <h2 className="metaphor-scene-title">{overlay.title}</h2> : null}
      {overlay.subtitle ? <p className="metaphor-scene-subtitle">{overlay.subtitle}</p> : null}
      {overlay.entries.length ? (
        <ul className="metaphor-scene-legend">
          {overlay.entries.map(({ axis, value }) => (
            <li key={axis}>
              <span className="metaphor-scene-legend-axis">{axis}</span>
              <span className="metaphor-scene-legend-separator"> = </span>
              <span className="metaphor-scene-legend-value">{value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
