/**
 * What of *your* work is visible in the room
 * (docs/office-isometric-mode.md § 5 slice 16).
 *
 * Fifteen slices went into making the floor feel inhabited and none of them
 * connected it to the thing you are actually doing: your own monitor was a flat
 * blue rectangle while every colleague's showed fiction, and the glass room's
 * table screen was blank during a meeting about your diagram. This module is
 * the one derivation **both** of those surfaces read, for the same reason
 * `officeFloorActivity.js` exists: two surfaces deriving "what is on the board"
 * separately are two surfaces that can disagree, and the one that is wrong is
 * whichever one you are not looking at.
 *
 * **Which surfaces, and the count has moved twice.** The whiteboard read this
 * module until the owner retired the mirror in § 6a: your monitor already shows
 * your work and the table shows it in a meeting about it, so a whiteboard that
 * showed it as well was the room's third copy of one thing. It now carries the
 * room's own record instead — `officeFloorNotes.js`, which derives from the
 * office log rather than from your slot. § 6b then gave the fourth surface a
 * drawing: the page you walk away from the printer holding is `printoutFrom`
 * below, where it had been the prop card's `lineYours` and nothing else. So
 * three surfaces off two renderings — `bars` for your monitor and the glass
 * room's table, `rows` for the page in your hand — while `mini` is kept for the
 * panel it was drawn for, which no longer reads it.
 *
 * **Pure, and deliberately DOM-free.** The obvious reuse — the advisor's
 * `getAdvisorVisibleLabels` — is half unusable here: its mermaid and infographic
 * branches read the *rendered* SVG and filter nodes by **viewport
 * intersection**, so once the floor is covering the canvas the answer is either
 * empty or about whatever happens to be scrolled into view. The floor needs to
 * know what the diagram *is*, not what is on screen, so everything below parses
 * source text. Its four source-based branches (chart, anything, metaphor3d,
 * forms) are reused as-is.
 *
 * **It derives, it never stores** (ADR-0011 rule 1), and nothing here implies
 * the cast produced anything (ADR-0010) — the board is *your* content, rendered
 * in the room's own language. No prop gains a `verb` from any of this: a
 * surface here is a second **view** of the diagram, never a second editor
 * (ADR-0011 rule 3 — diegesis duplicates, and the canvas keeps its conventional
 * control). (Cited as rule 2 until 2026-10-24; rule 2 of that ADR is "the floor
 * is DOM/CSS + SVG". The mis-number is what let a reader conclude the
 * whiteboard may never hold anything of its own — it may not hold a second
 * *editor*, and § 6a is what it holds instead.)
 *
 * **What it deliberately does not do: reproduce your layout.** The whiteboard
 * panel is 62 px tall and the monitor's screen face is 19 px. At that size a
 * faithful five-node routing is five rectangles and a smudge, and building one
 * would make this module a second layout engine that can disagree with the real
 * one. So the room reports the *shape* of the work — how big it is, how
 * connected, what kind of thing it is — which is what you can actually read
 * about somebody's screen from across an office. The readable text lives on the
 * **Look closer** card, where there is room for it.
 */

import {
  collectFlowchartParticipantInfo,
  collectSequenceParticipantInfo,
  collectStateDiagramParticipantInfo,
  peekDiagramDirective
} from './mermaidFlowchartDiff.js';
import { stripLineComment } from './mermaidSourceLocate.js';
import {
  extractAnythingAdvisorLabels,
  extractChartAdvisorLabels,
  extractFormsAdvisorLabels,
  extractMetaphorAdvisorLabels
} from './advisorVisibleLabels.js';

/**
 * How many labels the board keeps. The **Look closer** card names the first
 * few; nothing reads more than that, and a board object is sampled often enough
 * (see `boardFrom`'s callers) that it should stay small.
 */
export const BOARD_MAX_LABELS = 8;

/** Most boxes the whiteboard miniature ever draws — a 3 × 2 grid, minus one. */
export const BOARD_MAX_MINI_NODES = 5;

/** Most bars a 19 px screen face can carry before it reads as noise. */
const MAX_SCREEN_ROWS = 4;

/**
 * Ink at floor scale. Deliberately literal hex rather than `var(--accent)`:
 * these land inside the stage SVG, which the arrival harness and the verify
 * recipe both render without the app's stylesheet (§ 6 — a `var(--accent)`
 * accent paints wrong in a bare harness).
 */
const INK = '#334155';
const INK_SOFT = '#94a3b8';
const INK_ACCENT = '#2563eb';
const SCREEN_INK = '#dbeafe';
const SCREEN_INK_SOFT = '#93c5fd';

/**
 * How the room draws a slot.
 *
 * - `graph` — boxes with connectors between them (mermaid). The only shape with
 *   edges, because it is the only slot whose source describes a topology.
 * - `list`  — stacked rows (chart, forms, infographic): ordered content.
 * - `page`  — a header and two blocks (anything, metaphor3d): a composed thing.
 *
 * @type {Record<string, 'graph' | 'list' | 'page'>}
 */
const SHAPE_BY_CONTENT_TYPE = {
  mermaid: 'graph',
  chart: 'list',
  forms: 'list',
  infographic: 'list',
  anything: 'page',
  metaphor3d: 'page'
};

/**
 * @typedef {{ x: number, y: number, w: number, h: number, c: string }} BoardBar
 *   A rectangle in screen-face fractions — the exact row shape `SCREEN_LOOKS`
 *   already uses in `isoArt.jsx`, so the monitor needs no new drawing code, only
 *   a different source of rows.
 *
 * @typedef {{ x: number, y: number, w: number, h: number }} BoardMiniNode
 *   A box on the whiteboard panel, in 0…1 panel fractions.
 *
 * @typedef {object} BoardState
 * @property {string} kind the content type this was derived from
 * @property {'graph' | 'list' | 'page'} shape how the room draws it
 * @property {number} nodes how many things are in it
 * @property {number} edges how many connections (always 0 off `graph`)
 * @property {string[]} labels up to `BOARD_MAX_LABELS`, in source order
 * @property {BoardBar[]} bars the monitor / table-screen rendering
 * @property {{ nodes: BoardMiniNode[], edges: Array<[number, number]> }} mini
 *   the whiteboard rendering
 */

function cleanLabel(raw) {
  return String(raw ?? '')
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What closes each shape opener. `>` opens the asymmetric shape, which `]` closes. */
const SHAPE_CLOSERS = { '[': ']', '(': ')', '{': '}', '>': ']' };

/**
 * Read a shape label starting just after its opener, balancing on the opener's
 * own bracket type only.
 *
 * Balancing matters twice over: `A[Auth (v2)]` must not stop at the paren, and
 * `A((Round))` must run to the outer `)`. Tracking one bracket type gets both
 * right, and the surviving wrapper brackets are stripped by `cleanLabel`'s
 * caller — a doubled shape is `((Round))`, and `(Round)` is a fine thing to hand
 * to `cleanLabel`.
 *
 * @param {string} line
 * @param {number} from index of the first character *after* the opener
 * @param {string} opener
 * @returns {{ text: string, end: number }}
 */
function readShapeLabel(line, from, opener) {
  const closer = SHAPE_CLOSERS[opener];
  let depth = 1;
  for (let i = from; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === opener && opener !== '>') depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return { text: line.slice(from, i), end: i + 1 };
    }
  }
  return { text: line.slice(from), end: line.length };
}

/**
 * Trim the wrapper brackets a doubled shape leaves behind, then normalize.
 *
 * `((Round))` comes back from `readShapeLabel` as `(Round)`, `[[Subroutine]]` as
 * `[Subroutine]`, `([Stadium])` as `[Stadium]`. A blunt strip of leading and
 * trailing brackets would also eat the real ones in `Auth (v2)`, so a pair is
 * only removed when it genuinely **wraps** — when the opener's own match is the
 * last character.
 */
function shapeLabelText(raw) {
  let text = String(raw ?? '').trim();
  for (let guard = 0; guard < 3; guard += 1) {
    const opener = text[0];
    if (text.length < 2 || !SHAPE_CLOSERS[opener] || opener === '>') break;
    const { end } = readShapeLabel(text, 1, opener);
    if (end !== text.length) break;
    text = text.slice(1, -1).trim();
  }
  return cleanLabel(text);
}

/** An id followed by a shape opener, anywhere on the line. */
const SHAPE_OPEN_RE = /([A-Za-z][A-Za-z0-9_-]*)\s*([[({>{])/g;

/**
 * Pipe-delimited edge labels, which are **not** nodes.
 *
 * `stripShapeLabelsForEdgeTokens` in `mermaidFlowchartDiff.js` clears `[]`,
 * `()` and `{}` before its token scan but leaves `|…|` alone, so `a -->|yes| b`
 * files `yes` as a participant. That is harmless for fingerprint diffing (an
 * edge label changing really is that edge changing) and wrong here: it would
 * put "yes" on your whiteboard as if it were a box. Stripped before counting.
 *
 * The `-- text -->` spelling of the same thing still slips through. Left alone
 * deliberately: it only inflates a count that the art caps at five boxes
 * anyway, and stripping it needs a real edge grammar rather than a regex.
 */
const EDGE_LABEL_RE = /\|[^|\n]*\|/g;

/**
 * Every mermaid id that has a display label, from the whole source.
 *
 * This is a **second, deliberate** pass over lines `collectFlowchartParticipantInfo`
 * has already read, and it earns its keep: that collector's `VERTEX_DEFINE_RE`
 * is anchored to the start of a line, because it was built for fingerprint
 * diffing where the definition *line* is the unit. In real Mermaid most nodes
 * are labelled mid-line — `client[Client] --> gw[API Gateway]` defines two, and
 * the collector only files the first — so reusing its `explicitDef` for labels
 * would name most of your diagram after its ids. Counting stays with the
 * collectors; naming happens here.
 *
 * First definition wins, which is also Mermaid's own rule.
 *
 * @param {string} source
 * @returns {Map<string, string>}
 */
function mermaidLabelIndex(source) {
  /** @type {Map<string, string>} */
  const labels = new Map();

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripLineComment(rawLine).trim();
    if (!line || line.startsWith('%%')) continue;

    // `participant a as Alice` / `actor b as Bob` — the alias is the label.
    const actorAs = line.match(/^\s*(?:participant|actor)\s+([A-Za-z][\w-]*)\s+as\s+(.+?)\s*$/i);
    if (actorAs) {
      if (!labels.has(actorAs[1])) labels.set(actorAs[1], cleanLabel(actorAs[2]));
      continue;
    }

    // `state "Waiting for approval" as waiting` — label *before* the alias,
    // which is the one place mermaid reverses the order.
    const stateAs = line.match(/^\s*state\s+(.+?)\s+as\s+([A-Za-z][\w-]*)\s*$/i);
    if (stateAs) {
      if (!labels.has(stateAs[2])) labels.set(stateAs[2], cleanLabel(stateAs[1]));
      continue;
    }

    SHAPE_OPEN_RE.lastIndex = 0;
    let match;
    while ((match = SHAPE_OPEN_RE.exec(line)) !== null) {
      const [, id, opener] = match;
      const { text, end } = readShapeLabel(line, match.index + match[0].length, opener);
      SHAPE_OPEN_RE.lastIndex = end;
      const label = shapeLabelText(text);
      if (!label || labels.has(id)) continue;
      labels.set(id, label);
    }
  }

  return labels;
}

/**
 * Mermaid, from source. Nodes are the union of "defined somewhere" and
 * "mentioned on an edge" — the same union `diffMermaidFlowcharts` walks — and
 * edges are the **distinct** normalized edge lines, because each one is filed
 * under both of its endpoints.
 *
 * @param {string} source
 * @returns {{ nodes: number, edges: number, labels: string[] } | null}
 */
function mermaidFacts(source) {
  const kind = peekDiagramDirective(source);
  const info =
    kind === 'sequence'
      ? collectSequenceParticipantInfo(source)
      : kind === 'state'
        ? collectStateDiagramParticipantInfo(source)
        : collectFlowchartParticipantInfo(source.replace(EDGE_LABEL_RE, ' '));

  const ids = [...new Set([...info.explicitDef.keys(), ...info.edgeLinesById.keys()])];
  if (!ids.length) return null;

  const edgeLines = new Set();
  for (const lines of info.edgeLinesById.values()) {
    for (const line of lines) edgeLines.add(line);
  }

  const labelIndex = mermaidLabelIndex(source);
  const labels = [];
  const seen = new Set();
  for (const id of ids) {
    // The id is the honest fallback rather than a gap: `A --> B` really is a
    // diagram whose boxes are called A and B.
    const label = labelIndex.get(id) || id;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= BOARD_MAX_LABELS) break;
  }

  return { nodes: ids.length, edges: edgeLines.size, labels };
}

/**
 * Infographic, from source. The DSL is indentation-driven `key value` text
 * (`apps/server/src/prompts/infographicSyntaxGuard.js`), so the reader-facing
 * strings are the `label` / `title` / `text` / `name` values — no parser, and
 * in particular not `@antv/infographic`'s `parseSyntax`, which would drag a
 * renderer dependency into a floor utility for a 62 px panel.
 *
 * @param {string} source
 * @returns {string[]}
 */
function infographicLabels(source) {
  if (typeof source !== 'string') return [];
  const labels = [];
  const seen = new Set();
  for (const rawLine of source.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*-?\s*(?:label|title|text|name|heading)\s+(.+?)\s*$/i);
    if (!match) continue;
    const label = cleanLabel(match[1]);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= BOARD_MAX_LABELS) break;
  }
  return labels;
}

/**
 * The four slots whose advisor extractors are already source-based. Reused
 * rather than re-derived — `advisorVisibleLabels.js` is where "what is in this
 * slot, in words" is decided, and a second opinion here is a second opinion the
 * office can hold against itself.
 *
 * @param {string} contentType
 * @param {string} source
 * @returns {string[] | null} `null` when this slot has no source-based reader
 */
function sourceLabelsFor(contentType, source) {
  switch (contentType) {
    case 'chart':
      return extractChartAdvisorLabels(source).labels;
    case 'anything':
      return extractAnythingAdvisorLabels(source).labels;
    case 'metaphor3d':
      return extractMetaphorAdvisorLabels(source).labels;
    case 'forms':
      return extractFormsAdvisorLabels(source).labels;
    case 'infographic':
      return infographicLabels(source);
    default:
      return null;
  }
}

/**
 * The monitor / table-screen rendering: a handful of light rows over the blue
 * that already marks your desk as yours.
 *
 * The background is **not** changed. `#3b82f6` is a landmark — it is how you
 * pick your own desk out of sixteen at a glance — so the slice adds to the
 * screen rather than repainting it.
 *
 * @param {'graph' | 'list' | 'page'} shape
 * @param {number} nodes
 * @param {number} edges
 * @returns {BoardBar[]}
 */
function barsFor(shape, nodes, edges) {
  /** @type {BoardBar[]} */
  const bars = [];

  if (shape === 'graph') {
    // Two boxes and a connector read as "a diagram" at 19 px; a third below
    // reads as "a bigger one". More than that is a smudge.
    bars.push({ x: 0.08, y: 0.12, w: 0.3, h: 0.24, c: SCREEN_INK });
    if (nodes >= 2) {
      if (edges > 0) bars.push({ x: 0.38, y: 0.21, w: 0.24, h: 0.06, c: SCREEN_INK_SOFT });
      bars.push({ x: 0.62, y: 0.12, w: 0.3, h: 0.24, c: SCREEN_INK });
    }
    if (nodes >= 3) {
      if (edges > 1) bars.push({ x: 0.2, y: 0.36, w: 0.06, h: 0.22, c: SCREEN_INK_SOFT });
      bars.push({ x: 0.3, y: 0.58, w: 0.34, h: 0.24, c: SCREEN_INK });
    }
    if (nodes >= 5) bars.push({ x: 0.72, y: 0.62, w: 0.2, h: 0.2, c: SCREEN_INK_SOFT });
    return bars;
  }

  if (shape === 'page') {
    bars.push({ x: 0.08, y: 0.12, w: 0.56, h: 0.14, c: SCREEN_INK });
    bars.push({ x: 0.08, y: 0.36, w: 0.38, h: 0.46, c: SCREEN_INK_SOFT });
    if (nodes >= 3) bars.push({ x: 0.54, y: 0.36, w: 0.38, h: 0.2, c: SCREEN_INK_SOFT });
    if (nodes >= 5) bars.push({ x: 0.54, y: 0.62, w: 0.38, h: 0.2, c: SCREEN_INK_SOFT });
    return bars;
  }

  const rows = Math.min(Math.max(nodes, 1), MAX_SCREEN_ROWS);
  for (let i = 0; i < rows; i += 1) {
    const y = 0.12 + i * (0.76 / rows);
    bars.push({ x: 0.08, y, w: 0.1, h: 0.76 / rows - 0.08, c: SCREEN_INK });
    bars.push({
      x: 0.22,
      y: y + 0.02,
      w: i % 2 ? 0.5 : 0.7,
      h: 0.76 / rows - 0.12,
      c: SCREEN_INK_SOFT
    });
  }
  return bars;
}

/**
 * The whiteboard rendering: up to five boxes on a 3 × 2 grid, chained.
 *
 * The chain is **not** your topology (see the module note). It says how much
 * there is and whether it is connected, which is the honest amount of
 * information a 62 px panel across a room can carry.
 *
 * @param {'graph' | 'list' | 'page'} shape
 * @param {number} nodes
 * @param {number} edges
 * @returns {{ nodes: BoardMiniNode[], edges: Array<[number, number]> }}
 */
function miniFor(shape, nodes, edges) {
  const count = Math.min(Math.max(nodes, 1), BOARD_MAX_MINI_NODES);
  /** @type {BoardMiniNode[]} */
  const boxes = [];

  if (shape === 'list') {
    const rows = Math.min(count, 4);
    for (let i = 0; i < rows; i += 1) {
      boxes.push({ x: 0.12, y: 0.14 + i * (0.72 / rows), w: 0.76, h: 0.72 / rows - 0.06 });
    }
    return { nodes: boxes, edges: [] };
  }

  if (shape === 'page') {
    boxes.push({ x: 0.12, y: 0.12, w: 0.76, h: 0.16 });
    boxes.push({ x: 0.12, y: 0.36, w: 0.36, h: 0.5 });
    if (count >= 3) boxes.push({ x: 0.54, y: 0.36, w: 0.34, h: 0.22 });
    if (count >= 4) boxes.push({ x: 0.54, y: 0.64, w: 0.34, h: 0.22 });
    return { nodes: boxes, edges: [] };
  }

  // graph: columns first, so three nodes read as a row and five as two rows.
  const cols = count <= 2 ? count : 3;
  const rows = count <= 3 ? 1 : 2;
  const w = 0.76 / cols - 0.06;
  const h = 0.72 / rows - 0.1;
  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    boxes.push({
      x: 0.12 + col * (0.76 / cols),
      y: 0.16 + row * (0.72 / rows),
      w,
      h
    });
  }

  /** @type {Array<[number, number]>} */
  const links = [];
  if (edges > 0) {
    for (let i = 0; i + 1 < count; i += 1) links.push([i, i + 1]);
    // A graph with more edges than a chain needs gets one visible extra, so a
    // dense diagram does not draw the same as a pipeline.
    if (edges > count && count >= 3) links.push([0, count - 1]);
  }
  return { nodes: boxes, edges: links };
}

/**
 * What is on the board right now, or `null` when the slot is empty.
 *
 * `null` is a designed state, not a gap: an empty slot leaves your monitor the
 * flat blue it has always been and leaves the whiteboard carrying the
 * architecture from two re-orgs ago, which is exactly what a whiteboard has on
 * it before you draw anything.
 *
 * **Sample this, do not subscribe to it.** `OfficeLayer` takes the diagram as
 * *getters* (`getDiagramSource` / `getContentType`) on purpose — the office does
 * not re-render on keystrokes, and it must not start: sixteen animated figures
 * repainting per keypress is a real regression. Callers read the board on an
 * edge (a completed run, standing up, a meeting opening), which also makes the
 * fiction truer — a whiteboard shows what was *drawn* on it, not what you are
 * typing.
 *
 * @param {{ contentType?: string, diagramSource?: string }} [params]
 * @returns {BoardState | null}
 */
export function boardFrom({ contentType = 'mermaid', diagramSource = '' } = {}) {
  const source = typeof diagramSource === 'string' ? diagramSource : '';
  if (!source.trim()) return null;

  const shape = SHAPE_BY_CONTENT_TYPE[contentType];
  if (!shape) return null;

  let nodes = 0;
  let edges = 0;
  let labels = [];

  if (contentType === 'mermaid') {
    const facts = mermaidFacts(source);
    if (!facts) return null;
    ({ nodes, edges, labels } = facts);
  } else {
    const found = sourceLabelsFor(contentType, source);
    if (!found?.length) return null;
    labels = found.slice(0, BOARD_MAX_LABELS);
    nodes = found.length;
  }

  return {
    kind: contentType,
    shape,
    nodes,
    edges,
    labels,
    bars: barsFor(shape, nodes, edges),
    mini: miniFor(shape, nodes, edges)
  };
}

/**
 * Most rules of ink the page in your hand ever carries.
 *
 * Four, and the number is forced rather than chosen: the sheet `HeldItem` draws
 * is 9.6 x 10.4 units of a 16 x 24 frame, your own hand covers its bottom
 * third, and what is left is about six units of readable band. Four hairlines
 * at that pitch still read as lines; a fifth is a grey smear.
 */
export const PRINTOUT_MAX_ROWS = 4;

/**
 * @typedef {{ y: number, w: number }} PrintoutRow
 *   One rule of ink, in 0...1 fractions of the sheet's readable band — the same
 *   fraction space `bars` and `mini` use, so the art owns the geometry and this
 *   module owns only what is on the page.
 *
 * @typedef {object} PrintoutState
 * @property {PrintoutRow[]} rows at most `PRINTOUT_MAX_ROWS`, top down
 * @property {boolean} joined whether anything on the page was connected
 */

/**
 * What is printed on the page you walked away from the printer holding
 * (docs/automations/office-life.md § 6b).
 *
 * The third surface off this derivation, and the last one § 6 named: your
 * monitor gets `bars`, the glass room's table gets the same, the whiteboard
 * stopped mirroring you in § 6a and carries the room's own record instead
 * (`officeFloorNotes.js`). The printer was the one surface left that reflected
 * your work only through the prop card's words, which is why `HeldItem`'s
 * `papers` case drew the same three rules whether you had printed a
 * sixteen-node architecture or nothing at all.
 *
 * **It is gated on the hand, not on the hold.** `carrying` is what a prop put
 * there (`useFloorPropUse`), and the printer is the only prop that hands over
 * `papers` (`FLOOR_PROP_USES`). The *hold* is a weaker thing: `PHASE_ART` puts
 * `papers` in everybody's hand at the wind-down hour, and a sheet that drew
 * your diagram then would be the mirror § 6a just took off the wall,
 * reappearing in sixteen hands at five o'clock.
 *
 * **What it deliberately does not do: name anything.** Same argument as this
 * module's `mini` and for a harder reason — a 62 px panel cannot hold a layout
 * and a 7 px page cannot hold a word. What survives at this size is how many
 * lines of ink there are, how long they are, and whether anything on the page
 * was joined up, which is also exactly as much as you can tell about a page in
 * somebody else's hand from across a room.
 *
 * @param {{ board?: BoardState | null, carrying?: string | null }} [params]
 * @returns {PrintoutState | null} `null` when nothing in your hand came off the
 *   printer, or when the slot was empty when it did — and `null` is the
 *   designed state, not a gap: it leaves the generic sheet `HeldItem` has always
 *   drawn, which is what everybody else on this floor is carrying.
 */
export function printoutFrom({ board = null, carrying = null } = {}) {
  if (carrying !== 'papers' || !board) return null;

  /** @type {PrintoutRow[]} */
  const rows = [];

  // A composed page prints as a composed page: a full-width header and the
  // blocks under it. The one shape whose rows are not all the same kind of
  // thing, so it is the one that does not come off the pitch below.
  if (board.shape === 'page') {
    rows.push({ y: 0, w: 1 });
    rows.push({ y: 0.4, w: 0.66 });
    if (board.nodes >= 3) rows.push({ y: 0.7, w: 0.66 });
    return { rows, joined: false };
  }

  // A fixed pitch rather than a band split over the row count, so two rules
  // read as a short document instead of a sparse one.
  const count = Math.min(Math.max(board.nodes, 1), PRINTOUT_MAX_ROWS);
  for (let i = 0; i < count; i += 1) {
    // A graph's rules run uneven, because a printed routing is boxes with gaps
    // between them; a list's run even, because a list is a list.
    const w = board.shape === 'graph' ? (i % 2 ? 0.62 : 1) : 0.86;
    rows.push({ y: i / PRINTOUT_MAX_ROWS, w });
  }

  // The one mark that separates "boxes with arrows" from "a list", and it only
  // exists where there is a second rule for it to reach.
  return { rows, joined: board.shape === 'graph' && board.edges > 0 && count >= 2 };
}

/** Ink the whiteboard miniature draws in. Exported so the art has one source. */
export const BOARD_INK = Object.freeze({
  box: INK,
  boxSoft: INK_SOFT,
  edge: INK_ACCENT
});

export default boardFrom;
