/**
 * Prompt corpus for benchAnythingGeneration.js.
 *
 * Unlike benchAnythingCorpus.js — which holds hand-written HTML documents and
 * asks "does the ladder classify this the way we declared?" — these are user
 * PROMPTS. The bench sends each through the real agent and measures what comes
 * back, so the corpus is a sample of demand rather than a set of fixtures.
 *
 * Families are chosen so that each one stresses a different part of the ladder
 * (see the `stresses` field). Two of them — `canvas` and `layout` — exist
 * specifically because the jsdom runtime check is blind to them: it stubs the
 * canvas context with an inert Proxy and has no layout engine at all, so a page
 * that draws nothing or collapses to zero width passes rung 5 untouched. Those
 * families are where the browser observer is expected to earn its keep.
 *
 * Keep prompts SHORT and in the register a user actually types. A prompt that
 * spells out the implementation is measuring the corpus author, not the agent.
 */

/**
 * @typedef {object} GenerationCase
 * @property {string} id
 * @property {string} family
 * @property {string} prompt        What the user asks for.
 * @property {string} stresses      Which part of the pipeline this case is for.
 * @property {string} [seedPrompt]  When set, run this first to seed a document, then the
 *                                  measured turn runs against it.
 * @property {string} [transformMode] When set with `seedPrompt`, the measured turn uses
 *                                    `applyTransformIntent` (Gilfoyle/Dinesh/Barker prefer
 *                                    `apply_anything_edit`) and passes `prompt` as the
 *                                    stakeholder suggestion — exercises the edit path.
 * @property {string[]} [expectLibs] Lib ids this case is expected to opt into, if any.
 */

/** @type {GenerationCase[]} */
export const ANYTHING_GENERATION_CORPUS = [
  // ── static: the floor. Anything failing here is a real problem. ──────────
  {
    id: 'static-explainer',
    family: 'static',
    prompt: 'Explain how tides work, as a nicely typeset one-page explainer.',
    stresses: 'baseline — no JS, no canvas; should never fail'
  },
  {
    id: 'static-comparison',
    family: 'static',
    prompt: 'A side-by-side comparison of TCP and UDP with a short verdict at the bottom.',
    stresses: 'table/grid markup, structure lint'
  },

  // ── interactive widgets: the common case. Event wiring. ──────────────────
  {
    id: 'widget-tip-calculator',
    family: 'widget',
    prompt:
      'A tip calculator where I can set the bill, the tip percent, and how many people split it.',
    stresses: 'event listeners, live recomputation, empty/edge states'
  },
  {
    id: 'widget-unit-converter',
    family: 'widget',
    prompt:
      'A temperature converter between Celsius, Fahrenheit and Kelvin that updates as I type.',
    stresses: 'two-way binding, number parsing edge cases'
  },

  // ── canvas: rung 5 is structurally blind here. ───────────────────────────
  {
    id: 'canvas-solar-system',
    family: 'canvas',
    prompt: 'An animated solar system with the inner planets orbiting the sun.',
    stresses: 'canvas + requestAnimationFrame — jsdom stubs the context entirely'
  },
  {
    id: 'canvas-sorting-visual',
    family: 'canvas',
    prompt: 'Visualise bubble sort running on 30 random bars, with a start button.',
    stresses: 'canvas drawing driven by a timer; blank-canvas risk'
  },

  // ── layout: where CSS breaks and nothing throws. ─────────────────────────
  {
    id: 'layout-dashboard',
    family: 'layout',
    prompt:
      'A dashboard for a coffee shop: revenue, cups sold, top drinks, and a week-over-week trend.',
    stresses: 'multi-region grid/flex layout — collapse is invisible to jsdom'
  },
  {
    id: 'layout-pricing',
    family: 'layout',
    prompt: 'A three-tier pricing page with the middle tier highlighted as most popular.',
    stresses: 'equal-height columns, contrast on the highlighted card'
  },

  // ── games: longest documents, most JS. ───────────────────────────────────
  {
    id: 'game-memory',
    family: 'game',
    prompt: 'A memory matching card game with 12 cards and a move counter.',
    stresses: 'largest document, most state, size budget'
  },

  // ── libraries: marker expansion inside the runtime check. ────────────────
  {
    id: 'lib-d3-network',
    family: 'lib',
    prompt: 'A force-directed graph of 12 microservices and which ones call each other.',
    stresses: '@lib:d3 marker + expandAnythingLibs inside rung 5',
    expectLibs: ['d3']
  },
  {
    id: 'lib-matter-stack',
    family: 'lib',
    prompt: 'A physics toy where I can drop boxes and watch them stack and topple.',
    stresses: '@lib:matter marker; canvas render loop owned by the engine',
    expectLibs: ['matter']
  },

  // ── refine: a second turn against a document that already exists. ────────
  //
  // `transformMode: 'barker'` routes the measured turn through applyTransformIntent
  // (not applyIntent / mode `go`), with the follow-up ask in advisorPrompt. Barker
  // prefers apply_anything_edit for scoped changes — the path the prompt bar never
  // hits. The bench reports `editToolUsed` so we can track whether the model obeyed.
  {
    id: 'refine-add-control',
    family: 'refine',
    seedPrompt: 'A countdown timer that counts down from 60 seconds with a start button.',
    prompt: 'Add a reset button next to start, and show the remaining time as mm:ss.',
    transformMode: 'barker',
    stresses: 'applyTransformIntent + apply_anything_edit on a scoped follow-up'
  }
];
