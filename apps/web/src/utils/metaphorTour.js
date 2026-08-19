/**
 * Guided reading ("tour") for metaphor3d scenes.
 *
 * A metaphor is only meaningful if the viewer can decode it, and until now
 * decoding was entirely pull-based: orbit until something looks interesting,
 * then hover or tap it and read the metrics. That asks the viewer to already
 * know what the scene is claiming — which is exactly what they opened it to
 * find out. On a phone it is worse, because orbiting to hunt for the tall thing
 * is most of the interaction budget.
 *
 * The tour is the push-based answer. Everything it says is already in the DSL —
 * the author's title, their legend phrases, their accent note, the layer
 * labels — so this module invents no claims; it *orders* them into the sequence
 * a person would narrate if they were standing at the scene: what this is, how
 * to read it, what stands out, how it connects, and what the point is.
 *
 * Three rules the beat list follows, each a correction to the obvious version:
 *
 * 1. **The thesis goes last, not first.** `accent` + its `note` is the scene's
 *    punchline; leading with it means the viewer reads the conclusion before
 *    they can read the encoding it rests on.
 * 2. **A composite gets per-layer beats instead of a global peak.** A fused
 *    world mixes grammars, so "the biggest item" would compare an island's
 *    `mass` against a tower's `height` — two different scales wearing one word.
 *    Each layer names its own standout instead, which is also the only place
 *    the layer labels ever get explained rather than merely listed.
 * 3. **A beat with no author text is dropped, never padded.** A tour that says
 *    "How to read it: (nothing)" teaches the viewer the tour is noise.
 *
 * Pure and copy-injected so the whole contract is testable without a WebGL
 * context — the component supplies localized copy, this file supplies order.
 */

import { flattenMetaphorItems, compositeLayerSummaries } from './metaphorReading.js';
import { METAPHOR_PRIMARY_METRIC, axisLabel, legendAxesFor } from './metaphorLegendAxes.js';

/**
 * Hard cap on beats. Past about seven steps a "guided read" becomes a slide
 * deck, and the viewer stops reading and starts clicking Next to reach the end.
 */
export const MAX_TOUR_BEATS = 7;

/** Layers narrated individually before the rest collapse into the layer key. */
const MAX_LAYER_BEATS = 3;

/** Accented items narrated. The sanitizer caps `accent` at two. */
const MAX_ACCENT_BEATS = 2;

/**
 * English fallbacks. The panel passes `controls.metaphor.tour`, so these only
 * ever surface in tests and in a locale that somehow lost the block.
 */
export const DEFAULT_TOUR_COPY = {
  overview: 'The scene',
  overviewBody: 'Drag to orbit. Each step zooms to the part it is talking about.',
  legend: 'How to read it',
  peak: 'What stands out',
  peakBody: 'Largest by {axis}: {value}.',
  layer: 'Layer',
  layerBody: 'Drawn as {kind}, {count} items.',
  layerBodyWithPeak: 'Drawn as {kind}, {count} items — largest is {item}.',
  link: 'How it connects',
  linkBody: '{from} → {to}',
  accent: 'The point'
};

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function format(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}

function itemLabel(item) {
  return text(item?.label) || text(item?.id);
}

/** Round like the inspector does, so a tour line and a metric row never disagree. */
function formatValue(value) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * The item carrying the largest value of `kind`'s primary metric, or null when
 * no item in the set encodes it. Ties go to the first, which keeps the beat
 * stable across re-renders of the same document.
 */
function peakItemOf(entries, kindOf) {
  let best = null;
  for (const entry of entries) {
    const kind = kindOf(entry);
    const metric = METAPHOR_PRIMARY_METRIC[kind];
    if (!metric) continue;
    const value = entry.item?.[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (!best || value > best.value) best = { ...entry, kind, metric, value };
  }
  return best;
}

function focusOf(entry) {
  const id = text(entry?.item?.id);
  if (!id) return null;
  return {
    id,
    metaphor: entry.kind,
    item: entry.item,
    layerLabel: text(entry.layerLabel) || null
  };
}

/**
 * Ordered beats for one scene.
 *
 * @param {object | null | undefined} dsl — a parsed MetaphorDsl
 * @param {object} [options]
 * @param {Record<string, string>} [options.copy] — localized tour strings
 * @param {(kind: string) => string} [options.kindLabel] — localized metaphor-kind name
 * @returns {Array<{ id: string, kind: string, title: string, body: string,
 *   focus: { id: string, metaphor: string, item: object, layerLabel: string | null } | null }>}
 */
export function buildMetaphorTour(dsl, options = {}) {
  if (!dsl || typeof dsl !== 'object') return [];
  const copy = { ...DEFAULT_TOUR_COPY, ...(options.copy ?? {}) };
  const kindLabel = options.kindLabel ?? ((kind) => kind);
  const legend = dsl.scene?.legend ?? null;
  const isComposite = dsl.metaphor === 'composite';
  const entries = flattenMetaphorItems(dsl).map((entry) => ({
    item: entry.item,
    kind: isComposite ? text(entry.layer?.as) || 'city' : dsl.metaphor,
    layerId: text(entry.layer?.id),
    layerLabel: text(entry.layer?.label) || text(entry.layer?.as) || ''
  }));

  // Resolved before the peak beat on purpose: an item that is both the extreme
  // AND the thesis gets one beat, not two saying the same thing in sequence.
  const accented = entries
    .filter((entry) => entry.item?.accent === true && text(entry.item?.note))
    .slice(0, MAX_ACCENT_BEATS);
  const accentIds = new Set(accented.map((entry) => text(entry.item.id)));

  /**
   * Three buckets, not one list, because the cap must never eat the ending:
   * the thesis is the beat everything before it was setting up, so when a
   * fused world has more layers than the budget the *middle* is what yields.
   */
  const opening = [];
  const middle = [];
  const closing = [];

  // 1. What this is. Always present when the author titled the scene; a scene
  //    with no title at all has nothing to open with and the tour starts on the
  //    legend instead.
  const title = text(dsl.scene?.title);
  const subtitle = text(dsl.scene?.subtitle);
  if (title || subtitle) {
    opening.push({
      id: 'overview',
      kind: 'overview',
      title: title || copy.overview,
      body: subtitle || copy.overviewBody,
      focus: null
    });
  }

  // 2. How to read it — the author's own legend phrases, joined. This is the
  //    one beat that turns geometry back into the topic's vocabulary.
  const axes = legendAxesFor(dsl.metaphor, legend);
  if (axes.length) {
    opening.push({
      id: 'legend',
      kind: 'legend',
      title: copy.legend,
      body: axes.map((axis) => `${axis.label} = ${axis.text}`).join(' · '),
      focus: null
    });
  }

  if (isComposite) {
    // 3a. A fused world's layers, each with its own standout. Comparing across
    //     layers is meaningless (see the file header), so each is read alone.
    const summaries = compositeLayerSummaries(dsl).slice(0, MAX_LAYER_BEATS);
    for (const summary of summaries) {
      // Matched on layer id, not on the label or the grammar: two layers may
      // legitimately share an `as` (two city layers), and then a label match
      // would hand both of them the same standout.
      const layerEntries = entries.filter((entry) => entry.layerId === summary.id);
      const peak = peakItemOf(layerEntries, (entry) => entry.kind);
      const vars = {
        kind: kindLabel(summary.as),
        count: summary.itemCount,
        item: peak ? itemLabel(peak.item) : ''
      };
      const focus = peak ? focusOf(peak) : focusOf(layerEntries[0]);
      middle.push({
        id: `layer-${summary.id}`,
        kind: 'layer',
        title: summary.label,
        body: format(peak ? copy.layerBodyWithPeak : copy.layerBody, vars),
        focus
      });
    }
  } else {
    // 3b. A single-grammar scene compares cleanly, so name the extreme. This is
    //     the beat that answers "where do I look first".
    const peak = peakItemOf(entries, (entry) => entry.kind);
    if (peak && !accentIds.has(text(peak.item.id))) {
      middle.push({
        id: `peak-${text(peak.item.id)}`,
        kind: 'peak',
        title: itemLabel(peak.item),
        body: format(copy.peakBody, {
          axis: axisLabel(peak.kind, peak.metric, legend).toLowerCase(),
          value: formatValue(peak.value)
        }),
        focus: focusOf(peak)
      });
    }
  }

  // 4. How it connects — the first labelled link, in the author's words. An
  //    unlabelled edge says nothing a viewer cannot already see drawn.
  const links = Array.isArray(dsl.links) ? dsl.links : [];
  const labelledLink = links.find((link) => text(link?.label));
  if (labelledLink) {
    const byId = new Map(entries.map((entry) => [text(entry.item?.id), entry]));
    const from = byId.get(text(labelledLink.from));
    const to = byId.get(text(labelledLink.to));
    if (from && to) {
      middle.push({
        id: `link-${text(labelledLink.from)}-${text(labelledLink.to)}`,
        kind: 'link',
        title: text(labelledLink.label),
        body: format(copy.linkBody, { from: itemLabel(from.item), to: itemLabel(to.item) }),
        focus: focusOf(from)
      });
    }
  }

  // 5. The point, last. `accent` is the author's marker for the item that IS
  //    the claim, and its `note` is the sentence about why.
  for (const entry of accented) {
    closing.push({
      id: `accent-${text(entry.item.id)}`,
      kind: 'accent',
      title: itemLabel(entry.item) || copy.accent,
      body: text(entry.item.note),
      focus: focusOf(entry)
    });
  }

  const room = Math.max(0, MAX_TOUR_BEATS - opening.length - closing.length);
  return [...opening, ...middle.slice(0, room), ...closing];
}
