/**
 * HTML overlays drawn over the metaphor3d <Canvas> (as sibling DIVs, not drei
 * <Html>, so the text stays crisp and is never subject to the post-processing
 * tone-mapping / bloom / depth-of-field applied inside the canvas).
 *
 * These surface what the metaphor agent authors: the scene title/subtitle, the
 * per-axis legend, the accent thesis, (for fused composites) the layer reading
 * key, and — on a tap — one item's encoded metrics. See metaphorLegendAxes.js
 * and metaphorReading.js.
 *
 * Two of them answer the same question for different input devices:
 * `MetaphorHoverTooltip` follows a mouse, `MetaphorInspectorPanel` holds a
 * touch pick. They are mutually exclusive in CSS, not in JS — see the
 * `.metaphor-inspector ~ …` rule and the DOM order it depends on.
 */

import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { legendAxesFor, formatItemMetric } from '../utils/metaphorLegendAxes.js';
import { METAPHOR_KINDS, METAPHOR_KIND_LABELS } from '../utils/switchMetaphorKind.js';
import { compositeLayerSummaries } from '../utils/metaphorReading.js';
import { buildMetaphorTour } from '../utils/metaphorTour.js';
import { currentBeat } from './metaphorTourStore.js';
import { CHROME_ATTR } from './metaphorScenes/overlaySafeArea.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

function kindLabel(controls, kind) {
  return controls.metaphor.kinds[kind] ?? METAPHOR_KIND_LABELS[kind] ?? kind;
}

/** Stable no-op store shape for a layer key mounted without a focus store. */
const NO_LAYER_FOCUS_SUBSCRIBE = () => () => {};
const NO_LAYER_FOCUS_GET = () => null;

/** Top-left card: title, subtitle, and the accented item's thesis sentence. */
export function MetaphorTitleOverlay({ scene, thesis = '', action = null }) {
  const title = typeof scene?.title === 'string' ? scene.title.trim() : '';
  const subtitle = typeof scene?.subtitle === 'string' ? scene.subtitle.trim() : '';
  const claim = typeof thesis === 'string' ? thesis.trim() : '';
  if (!title && !subtitle && !claim && !action) return null;
  return (
    <div
      className="metaphor-overlay metaphor-title-overlay"
      aria-hidden="false"
      {...{ [CHROME_ATTR]: 'title' }}
    >
      {title ? <p className="metaphor-title-overlay-title">{title}</p> : null}
      {subtitle ? <p className="metaphor-title-overlay-subtitle">{subtitle}</p> : null}
      {claim ? <p className="metaphor-title-overlay-thesis">{claim}</p> : null}
      {action}
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
      {...{ [CHROME_ATTR]: 'legend' }}
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
 * Axes the compact strip keeps on a small canvas. The rest are marked and
 * hidden by the phone / short-landscape CSS blocks rather than dropped here,
 * so a roomy canvas still shows the whole legend from the same markup.
 *
 * The number is not a taste call. Every chip is a full phrase the author wrote
 * ("relative service importance from prompt"), so on a phone each one takes a
 * row of its own: the fused commerce composite's six axes turned the strip into
 * a 277px band on an 844px screen — a third of the phone spent explaining a
 * scene that then had two thirds left to be in. Three chips is one row of a
 * foldable cover and three of a phone, and the axes that do not fit are not
 * lost: the guided read speaks every legend phrase, the tap inspector labels
 * each metric it prints, and fullscreen restores the full legend panel.
 */
const COMPACT_AXIS_LIMIT = 3;

/**
 * Compact inline reading strip: title + thesis + axis chips. Fullscreen keeps
 * the larger title card and legend panel; this is the inline canvas's way of
 * saying what the scene is about without colliding with the app chrome.
 */
export function MetaphorReadingOverlay({ scene, metaphor, legend, thesis = '', action = null }) {
  const { controls } = useUiCopy();
  const title = typeof scene?.title === 'string' ? scene.title.trim() : '';
  const subtitle = typeof scene?.subtitle === 'string' ? scene.subtitle.trim() : '';
  const claim = typeof thesis === 'string' ? thesis.trim() : '';
  const rows = legendAxesFor(metaphor, legend);
  const overflow = rows.slice(COMPACT_AXIS_LIMIT);
  if (!title && !subtitle && !claim && rows.length === 0 && !action) return null;
  return (
    <div
      className="metaphor-overlay metaphor-context-overlay"
      role="group"
      aria-label={controls.metaphor.reading}
      {...{ [CHROME_ATTR]: 'reading' }}
    >
      <div className="metaphor-context-heading">
        {title ? <p className="metaphor-context-title">{title}</p> : null}
        {subtitle ? <p className="metaphor-context-subtitle">{subtitle}</p> : null}
        {claim ? <p className="metaphor-context-thesis">{claim}</p> : null}
      </div>
      {rows.length ? (
        <dl className="metaphor-context-axes">
          {rows.map((row, index) => (
            <div
              className={
                index < COMPACT_AXIS_LIMIT
                  ? 'metaphor-context-axis'
                  : 'metaphor-context-axis metaphor-context-axis--extra'
              }
              key={row.key}
            >
              <dt>{row.label}</dt>
              <dd>{row.text}</dd>
            </div>
          ))}
          {/* Counts what the small-canvas rules hide, and names them in its
              tooltip — a chip that silently swallowed three encodings would
              make the scene less readable than the band it saved. */}
          {overflow.length ? (
            <div
              className="metaphor-context-axis metaphor-context-axis-more"
              title={overflow.map((row) => `${row.label}: ${row.text}`).join(' · ')}
            >
              <dt>{`+${overflow.length}`}</dt>
            </div>
          ) : null}
        </dl>
      ) : null}
      {action}
    </div>
  );
}

/**
 * Fused-world reading key: each layer's label next to the spatial grammar it
 * is drawn in (islands, towers, river…). Without this a composite is a pretty
 * landscape whose layers the viewer has to reverse-engineer.
 *
 * Each row is also the control that reads that layer: pressing it recedes the
 * others into the scene's haze and drops their names, which is what finally
 * ties the row "Services · City · 3" to three particular shapes among a dozen.
 * See metaphorLayerFocus.js. Without a `store` — the fullscreen embed, a
 * standalone mount — the rows stay plain list items rather than dead buttons.
 */
export function MetaphorCompositeLayersOverlay({ dsl, store = null }) {
  const { controls } = useUiCopy();
  const layers = compositeLayerSummaries(dsl);
  const focused = useSyncExternalStore(
    store?.subscribe ?? NO_LAYER_FOCUS_SUBSCRIBE,
    store?.get ?? NO_LAYER_FOCUS_GET,
    store?.get ?? NO_LAYER_FOCUS_GET
  );
  if (layers.length === 0) return null;
  const copy = controls.metaphor;
  const stopScene = (event) => event.stopPropagation();
  return (
    <div
      className={`metaphor-overlay metaphor-layers-overlay${focused ? ' is-focusing' : ''}`}
      role="group"
      aria-label={copy.layers}
      {...{ [CHROME_ATTR]: 'layers' }}
    >
      <p className="metaphor-layers-heading">{copy.layers}</p>
      <ul className="metaphor-layers-list">
        {layers.map((layer) => {
          const isFocused = focused === layer.id;
          const body = (
            <>
              <span className="metaphor-layers-label">{layer.label}</span>
              {/* The count is the layer's weight in the world. Without it two
                  rows read as equal partners when one holds twelve islands and
                  the other holds a single tower. */}
              <span className="metaphor-layers-kind">
                {kindLabel(controls, layer.as)}
                {layer.itemCount > 0 ? (
                  <span className="metaphor-layers-count"> · {layer.itemCount}</span>
                ) : null}
              </span>
            </>
          );
          if (!store) {
            return (
              <li key={layer.id} className="metaphor-layers-row">
                {body}
              </li>
            );
          }
          return (
            <li key={layer.id} className="metaphor-layers-item">
              <button
                type="button"
                className={`metaphor-layers-row is-pressable${isFocused ? ' is-focused' : ''}`}
                aria-pressed={isFocused}
                title={isFocused ? copy.layerFocusClear : copy.layerFocus}
                onPointerDown={stopScene}
                onClick={(event) => {
                  stopScene(event);
                  store.toggle(layer.id);
                }}
              >
                {body}
              </button>
            </li>
          );
        })}
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
  const selectId = useId();
  if (!metaphor) return null;
  const stopScene = (event) => event.stopPropagation();
  return (
    <div className="metaphor-overlay metaphor-kind-switcher" {...{ [CHROME_ATTR]: 'kinds' }}>
      <label className="metaphor-kind-switcher-label" htmlFor={selectId}>
        {controls.metaphor.viewAs}
      </label>
      <select
        id={selectId}
        className="metaphor-kind-switcher-select"
        value={metaphor}
        disabled={disabled || !onSelectKind}
        aria-label={controls.metaphor.type}
        onPointerDown={stopScene}
        onMouseDown={stopScene}
        onClick={stopScene}
        onChange={(event) => {
          const next = event.target.value;
          if (next && next !== metaphor) onSelectKind?.(next);
        }}
      >
        {METAPHOR_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kindLabel(controls, kind)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Bottom-anchored detail card for the tap-selected item — the touch answer to
 * the hover tooltip.
 *
 * It is anchored to the canvas rather than to the pointer for the reason the
 * tooltip cannot be: on a phone the pointer is a finger, and a card under it is
 * a card you cannot read. It stays until dismissed, so the metrics survive the
 * lift. Row labels come from `formatItemMetric`, which prefers the author's own
 * legend phrase — "Monthly transaction volume: 12", not "Height: 12".
 */
export function MetaphorInspectorPanel({ store, legend }) {
  const { controls } = useUiCopy();
  const selected = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!selected?.item) return null;

  const info = formatItemMetric(selected.metaphor, selected.item, legend);
  const note = typeof selected.item.note === 'string' ? selected.item.note.trim() : '';
  const layerLabel = typeof selected.layerLabel === 'string' ? selected.layerLabel.trim() : '';
  const label = info.label || (typeof selected.item.id === 'string' ? selected.item.id : '');
  if (!label && info.rows.length === 0 && !note) return null;

  return (
    <div
      className="metaphor-overlay metaphor-inspector"
      role="group"
      aria-label={controls.metaphor.selected}
    >
      <div className="metaphor-inspector-head">
        <p className="metaphor-inspector-label">
          {info.glyph ? (
            <span className="metaphor-inspector-glyph" aria-hidden="true">
              {info.glyph}
            </span>
          ) : null}
          <span>{label}</span>
        </p>
        <button
          type="button"
          className="metaphor-inspector-close"
          aria-label={controls.metaphor.dismiss}
          onClick={() => store.clear()}
        >
          ×
        </button>
      </div>
      {layerLabel ? (
        <p className="metaphor-inspector-layer">
          {controls.metaphor.layer}: {layerLabel}
        </p>
      ) : null}
      {info.rows.length ? (
        <dl className="metaphor-inspector-rows">
          {info.rows.map((row) => (
            <div className="metaphor-inspector-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {note ? <p className="metaphor-inspector-note">{note}</p> : null}
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

/**
 * The affordance that starts a guided read. It is deliberately NOT a panel: it
 * renders inside the reading strip (inline) or the title card (fullscreen), so
 * offering the tour costs the canvas no additional card. A scene the builder
 * found nothing to say about offers nothing.
 */
export function MetaphorTourButton({ store, dsl }) {
  const { controls } = useUiCopy();
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const copy = controls.metaphor.tour;
  // Built here rather than in the renderer so the localized copy never reaches
  // MetaphorRendererImpl — a locale switch must not re-render the R3F tree.
  const beats = useMemo(
    () => buildMetaphorTour(dsl, { copy, kindLabel: (kind) => kindLabel(controls, kind) }),
    [dsl, copy, controls]
  );
  if (beats.length === 0) return null;
  if (state.index >= 0) return null;
  const stopScene = (event) => event.stopPropagation();
  return (
    <button
      type="button"
      className="metaphor-tour-start"
      title={copy.startTitle}
      onPointerDown={stopScene}
      onClick={(event) => {
        stopScene(event);
        store.start(beats);
      }}
    >
      <span aria-hidden="true">▸</span>
      <span>{copy.start}</span>
    </button>
  );
}

/**
 * The guided read itself: one beat at a time, with Back / Next and the picked
 * item's own metrics.
 *
 * It renders FIRST among the overlay siblings, ahead of the inspector, because
 * it inherits that panel's exclusive budget: a read in progress owns the screen
 * (the CSS is `.metaphor-tour ~ …`, which needs this DOM order). The reason is
 * the same one the inspector had — on a phone the canvas is small and three
 * translucent cards over it leave nothing to read them against — but stronger,
 * since the tour is also flying the camera and a card stack would hide the
 * arrival.
 *
 * It owns two side effects, both of which have to be here rather than in the
 * store, because the store must stay free of React and of the selection:
 *
 * 1. It rings the beat's item through the selection store, which is what ties
 *    the sentence to the shape. Ending the read clears the ring.
 * 2. It ENDS the read when the viewer picks something else. A tap that lands on
 *    a different item is the viewer taking over; leaving the tour running would
 *    then narrate one item while the ring marks another.
 */
export function MetaphorTourPanel({ store, selectionStore, legend }) {
  const { controls } = useUiCopy();
  const copy = controls.metaphor.tour;
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  const beat = currentBeat(state);

  // The ring the tour raised, so it can retract that one and only that one.
  const ownedIdRef = useRef(null);
  useEffect(() => {
    if (!beat) return undefined;
    if (beat.focus) {
      // The id is recorded BEFORE the store write, because the handover
      // subscription below fires synchronously inside `set` — recording after
      // would make the tour's own ring look like the viewer's pick and end the
      // read on every step that focuses something.
      ownedIdRef.current = beat.focus.id;
      selectionStore.set({ ...beat.focus });
    } else {
      if (ownedIdRef.current) selectionStore.clear();
      ownedIdRef.current = null;
    }
    return () => {
      // Retract only a ring the tour itself put up. A viewer who taps a
      // different item ends the read (below) — clearing unconditionally here
      // would then wipe the pick they just made, one frame after making it.
      const owned = ownedIdRef.current;
      if (owned && selectionStore.get()?.item?.id === owned) selectionStore.clear();
      ownedIdRef.current = null;
    };
  }, [beat, selectionStore]);

  // Subscribed rather than derived from a render, because "who picked this"
  // has to be answered at the moment of the write: a render-time comparison
  // reads last render's pick against this render's beat, which reports every
  // ordinary step forward as the viewer taking over.
  useEffect(
    () =>
      selectionStore.subscribe(() => {
        const picked = selectionStore.get()?.item?.id ?? null;
        if (picked && picked !== ownedIdRef.current) store.stop();
      }),
    [selectionStore, store]
  );

  if (!beat) return null;
  const info = beat.focus ? formatItemMetric(beat.focus.metaphor, beat.focus.item, legend) : null;
  const total = state.beats.length;
  const step = state.index + 1;
  const last = step >= total;
  const stopScene = (event) => event.stopPropagation();

  return (
    <div
      className="metaphor-overlay metaphor-tour"
      role="group"
      aria-label={copy.aria}
      onPointerDown={stopScene}
    >
      <div className="metaphor-tour-head">
        <p className="metaphor-tour-step">{formatLocale(copy.step, { step, total })}</p>
        <button
          type="button"
          className="metaphor-tour-close"
          aria-label={copy.close}
          onClick={() => store.stop()}
        >
          ×
        </button>
      </div>
      <p className="metaphor-tour-title">{beat.title}</p>
      {beat.body ? <p className="metaphor-tour-body">{beat.body}</p> : null}
      {info?.rows.length ? (
        <dl className="metaphor-tour-rows">
          {info.rows.map((row) => (
            <div className="metaphor-tour-row" key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="metaphor-tour-nav">
        <button
          type="button"
          className="metaphor-tour-nav-btn"
          disabled={state.index <= 0}
          onClick={() => store.prev()}
        >
          {copy.back}
        </button>
        <button
          type="button"
          className="metaphor-tour-nav-btn is-primary"
          onClick={() => store.next()}
        >
          {last ? copy.done : copy.next}
        </button>
      </div>
    </div>
  );
}
