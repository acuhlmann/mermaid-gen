/**
 * HTML overlays drawn over the metaphor3d <Canvas> (as sibling DIVs, not drei
 * <Html>, so the text stays crisp and is never subject to the post-processing
 * tone-mapping / bloom / depth-of-field applied inside the canvas).
 *
 * These finally surface what the metaphor agent authors but the renderer never
 * showed: the scene title/subtitle and the per-axis legend (what height /
 * magnitude / elevation actually mean for this topic). See metaphorLegendAxes.js.
 */

import { useSyncExternalStore } from 'react';
import { legendAxesFor, formatItemMetric } from '../utils/metaphorLegendAxes.js';
import { METAPHOR_KINDS, METAPHOR_KIND_LABELS } from '../utils/switchMetaphorKind.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

/** Top-left card: the scene's title and one-line subtitle. */
export function MetaphorTitleOverlay({ scene }) {
  const title = typeof scene?.title === 'string' ? scene.title.trim() : '';
  const subtitle = typeof scene?.subtitle === 'string' ? scene.subtitle.trim() : '';
  if (!title && !subtitle) return null;
  return (
    <div className="metaphor-overlay metaphor-title-overlay" aria-hidden="false">
      {title ? <p className="metaphor-title-overlay-title">{title}</p> : null}
      {subtitle ? <p className="metaphor-title-overlay-subtitle">{subtitle}</p> : null}
    </div>
  );
}

/**
 * Bottom-left panel: the legend that decodes the spatial encodings. Renders only
 * the axes the author populated for this metaphor; nothing if none.
 */
export function MetaphorLegendOverlay({ metaphor, legend }) {
  const { controls } = useUiCopy();
  const rows = legendAxesFor(metaphor, legend);
  if (rows.length === 0) return null;
  return (
    <div
      className="metaphor-overlay metaphor-legend-overlay"
      role="group"
      aria-label={controls.metaphor.legend}
    >
      <p className="metaphor-legend-heading">{controls.metaphor.legend}</p>
      <dl className="metaphor-legend-rows">
        {rows.map((row) => (
          <div className="metaphor-legend-row" key={row.key}>
            <dt className="metaphor-legend-axis">{row.label}</dt>
            <dd className="metaphor-legend-text">{row.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Cursor-following tooltip showing the hovered item's label + its encoded
 * metrics (in the author's legend words). Subscribes to the external hover store
 * so only this small element re-renders on hover — never the 3D scene.
 */
/**
 * Fullscreen-only segmented control for switching the spatial metaphor kind
 * (city, layer cake, galaxy, tree, terrain) without leaving the canvas.
 */
/**
 * Fullscreen-only note when composite has a single layer — rare after the
 * kind switcher invents a companion; kept for agent-authored one-layer docs.
 */
export function MetaphorCompositeHint({ layerCount = 0 }) {
  const { controls } = useUiCopy();
  if (layerCount >= 2) return null;
  return (
    <div className="metaphor-overlay metaphor-composite-hint" role="status">
      <p className="metaphor-composite-hint-title">{controls.metaphor.compositeHintTitle}</p>
      <p className="metaphor-composite-hint-body">{controls.metaphor.compositeHintBody}</p>
    </div>
  );
}

export function MetaphorKindSwitcher({ metaphor, disabled = false, onSelectKind }) {
  const { controls } = useUiCopy();
  if (!metaphor) return null;
  return (
    <div
      className="metaphor-overlay metaphor-kind-switcher"
      role="group"
      aria-label={controls.metaphor.type}
    >
      <span className="metaphor-kind-switcher-label">{controls.metaphor.viewAs}</span>
      <div className="metaphor-kind-switcher-segment">
        {METAPHOR_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`metaphor-kind-switcher-option${metaphor === kind ? ' is-selected' : ''}`}
            aria-pressed={metaphor === kind}
            disabled={disabled || metaphor === kind}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onSelectKind?.(kind)}
          >
            {controls.metaphor.kinds[kind] ?? METAPHOR_KIND_LABELS[kind] ?? kind}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MetaphorHoverTooltip({ store, legend }) {
  const hovered = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!hovered?.item) return null;

  const info = formatItemMetric(hovered.metaphor, hovered.item, legend);
  const note = typeof hovered.item.note === 'string' ? hovered.item.note.trim() : '';
  if (!info.label && info.rows.length === 0 && !note) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const flipX = hovered.x > vw - 240;
  const flipY = hovered.y > vh - 170;
  const style = {
    left: flipX ? undefined : hovered.x + 16,
    right: flipX ? vw - hovered.x + 16 : undefined,
    top: flipY ? undefined : hovered.y + 16,
    bottom: flipY ? vh - hovered.y + 16 : undefined
  };

  return (
    <div className="metaphor-overlay metaphor-hover-tooltip" style={style} role="status">
      <p className="metaphor-hover-label">{info.label}</p>
      {info.rows.length ? (
        <dl className="metaphor-hover-rows">
          {info.rows.map((row) => (
            <div className="metaphor-hover-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="metaphor-hover-note">{note}</p> : null}
    </div>
  );
}
