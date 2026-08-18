/**
 * HTML overlays drawn over the metaphor3d <Canvas> (as sibling DIVs, not drei
 * <Html>, so the text stays crisp and is never subject to the post-processing
 * tone-mapping / bloom / depth-of-field applied inside the canvas).
 *
 * These surface what the metaphor agent authors: the scene title/subtitle, the
 * per-axis legend, the accent thesis, and (for fused composites) the layer
 * reading key. See metaphorLegendAxes.js and metaphorReading.js.
 */

import { useSyncExternalStore } from 'react';
import { legendAxesFor, formatItemMetric } from '../utils/metaphorLegendAxes.js';
import { METAPHOR_KINDS, METAPHOR_KIND_LABELS } from '../utils/switchMetaphorKind.js';
import { compositeLayerSummaries } from '../utils/metaphorReading.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

function kindLabel(controls, kind) {
  return controls.metaphor.kinds[kind] ?? METAPHOR_KIND_LABELS[kind] ?? kind;
}

/** Top-left card: title, subtitle, and the accented item's thesis sentence. */
export function MetaphorTitleOverlay({ scene, thesis = '' }) {
  const title = typeof scene?.title === 'string' ? scene.title.trim() : '';
  const subtitle = typeof scene?.subtitle === 'string' ? scene.subtitle.trim() : '';
  const claim = typeof thesis === 'string' ? thesis.trim() : '';
  if (!title && !subtitle && !claim) return null;
  return (
    <div className="metaphor-overlay metaphor-title-overlay" aria-hidden="false">
      {title ? <p className="metaphor-title-overlay-title">{title}</p> : null}
      {subtitle ? <p className="metaphor-title-overlay-subtitle">{subtitle}</p> : null}
      {claim ? <p className="metaphor-title-overlay-thesis">{claim}</p> : null}
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
 * Compact inline reading strip: title + thesis + axis chips. Fullscreen keeps
 * the larger title card and legend panel; this is the inline canvas's way of
 * saying what the scene is about without colliding with the app chrome.
 */
export function MetaphorReadingOverlay({ scene, metaphor, legend, thesis = '' }) {
  const { controls } = useUiCopy();
  const title = typeof scene?.title === 'string' ? scene.title.trim() : '';
  const subtitle = typeof scene?.subtitle === 'string' ? scene.subtitle.trim() : '';
  const claim = typeof thesis === 'string' ? thesis.trim() : '';
  const rows = legendAxesFor(metaphor, legend);
  if (!title && !subtitle && !claim && rows.length === 0) return null;
  return (
    <div
      className="metaphor-overlay metaphor-context-overlay"
      role="group"
      aria-label={controls.metaphor.reading}
    >
      <div className="metaphor-context-heading">
        {title ? <p className="metaphor-context-title">{title}</p> : null}
        {subtitle ? <p className="metaphor-context-subtitle">{subtitle}</p> : null}
        {claim ? <p className="metaphor-context-thesis">{claim}</p> : null}
      </div>
      {rows.length ? (
        <dl className="metaphor-context-axes">
          {rows.map((row) => (
            <div className="metaphor-context-axis" key={row.key}>
              <dt>{row.label}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * Fused-world reading key: each layer's label next to the spatial grammar it
 * is drawn in (islands, towers, river…). Without this a composite is a pretty
 * landscape whose layers the viewer has to reverse-engineer.
 */
export function MetaphorCompositeLayersOverlay({ dsl }) {
  const { controls } = useUiCopy();
  const layers = compositeLayerSummaries(dsl);
  if (layers.length === 0) return null;
  return (
    <div
      className="metaphor-overlay metaphor-layers-overlay"
      role="group"
      aria-label={controls.metaphor.layers}
    >
      <p className="metaphor-layers-heading">{controls.metaphor.layers}</p>
      <ul className="metaphor-layers-list">
        {layers.map((layer) => (
          <li key={layer.id} className="metaphor-layers-row">
            <span className="metaphor-layers-label">{layer.label}</span>
            <span className="metaphor-layers-kind">{kindLabel(controls, layer.as)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Fullscreen-only note for an invalid/empty composite while a stream is forming.
 */
export function MetaphorCompositeHint({ layerCount = 0 }) {
  const { controls } = useUiCopy();
  if (layerCount >= 1) return null;
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
            {kindLabel(controls, kind)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MetaphorHoverTooltip({ store, legend }) {
  const { controls } = useUiCopy();
  const hovered = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!hovered?.item) return null;

  const info = formatItemMetric(hovered.metaphor, hovered.item, legend);
  const note = typeof hovered.item.note === 'string' ? hovered.item.note.trim() : '';
  const layerLabel = typeof hovered.layerLabel === 'string' ? hovered.layerLabel.trim() : '';
  if (!info.label && info.rows.length === 0 && !note && !layerLabel) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const flipX = hovered.x > vw - 260;
  const flipY = hovered.y > vh - 190;
  const style = {
    left: flipX ? undefined : hovered.x + 16,
    right: flipX ? vw - hovered.x + 16 : undefined,
    top: flipY ? undefined : hovered.y + 16,
    bottom: flipY ? vh - hovered.y + 16 : undefined
  };

  return (
    <div className="metaphor-overlay metaphor-hover-tooltip" style={style} role="status">
      <p className="metaphor-hover-label">{info.label}</p>
      {layerLabel ? (
        <p className="metaphor-hover-layer">
          {controls.metaphor.layer}: {layerLabel}
        </p>
      ) : null}
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
