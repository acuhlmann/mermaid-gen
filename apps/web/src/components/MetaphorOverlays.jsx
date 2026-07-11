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
  const rows = legendAxesFor(metaphor, legend);
  if (rows.length === 0) return null;
  return (
    <div className="metaphor-overlay metaphor-legend-overlay" role="group" aria-label="Legend">
      <p className="metaphor-legend-heading">Legend</p>
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function MetaphorContextHeading({ title, subtitle }) {
  if (!title && !subtitle) return null;
  return (
    <div className="metaphor-context-heading">
      {title ? <p className="metaphor-context-title">{title}</p> : null}
      {subtitle ? <p className="metaphor-context-subtitle">{subtitle}</p> : null}
    </div>
  );
}

function MetaphorContextAxes({ rows }) {
  if (rows.length === 0) return null;
  return (
    <dl className="metaphor-context-axes">
      {rows.map((row) => (
        <div className="metaphor-context-axis" key={row.key}>
          <dt>{row.label}</dt>
          <dd>{row.text}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Compact inline title + semantic key. Fullscreen keeps the larger split cards;
 * the normal canvas gets this centered strip so the topic and encodings remain
 * visible without colliding with corner controls.
 */
export function MetaphorContextOverlay({ metaphor, scene }) {
  const title = cleanText(scene?.title);
  const subtitle = cleanText(scene?.subtitle);
  const rows = legendAxesFor(metaphor, scene?.legend);
  if (!title && !subtitle && rows.length === 0) return null;
  return (
    <section
      className="metaphor-overlay metaphor-context-overlay"
      aria-label="Metaphor topic and visual key"
    >
      <MetaphorContextHeading title={title} subtitle={subtitle} />
      <MetaphorContextAxes rows={rows} />
    </section>
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
export function MetaphorKindSwitcher({ metaphor, disabled = false, onSelectKind }) {
  if (!metaphor) return null;
  return (
    <div
      className="metaphor-overlay metaphor-kind-switcher"
      role="group"
      aria-label="Metaphor type"
    >
      <span className="metaphor-kind-switcher-label">View as</span>
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
            {METAPHOR_KIND_LABELS[kind] ?? kind}
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
