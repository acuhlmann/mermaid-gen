/**
 * The scripted visit — the `office-life` automation's acceptance instrument
 * (docs/automations/office-life.md § 2, queue item 0).
 *
 * Every productive rung on the feature shelf has a number it re-measures
 * nightly (`benchMetaphor.js`, `benchAnything.js`). The office's number is a
 * **fixed visit**: enter the floor, walk to a named colleague, step into their
 * path, stand beside them for six seconds, use the printer, open the
 * whiteboard, say one sentence in the composer. It prints **one JSON object**,
 * and that object is what goes in the ledger row.
 *
 * ## Run it
 *
 * ```bash
 * npm ci                                   # playwright-core is NOT a repo dependency
 * mkdir -p /tmp/pw && (cd /tmp/pw && npm i playwright-core)
 * OFFICE_VISIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright-core \
 *   node apps/web/test/officeVisitTrace.mjs --out trace.json
 * node apps/web/test/officeVisitTrace.mjs --no-llm      # deliberate canned-fallback trace
 * ```
 *
 * ## Why it lives in `apps/web/test/` and not `scripts/`
 *
 * The playbook's prose says "one file under `scripts/`". The playbook's
 * **front-matter** — which is what `npm run routine:guard --postflight`
 * actually enforces, and which is `improve`'s to edit and not a run's
 * (ADR-0017) — does not reach `scripts/`; `routine-guard --reachable
 * scripts/<anything>` answers `improve`. So the instrument sits at the nearest
 * in-budget home (`apps/web/test/office*`), beside the office suites it shares
 * a subject with, and the ledger carries the `blocked-by-paths` row asking for
 * the two to be reconciled. It is deliberately **not** a `*.test.js`: vitest
 * must not pick it up, because it needs a browser, a server and ~40 seconds.
 *
 * ## The three traps this walks around
 *
 * 1. **`chromium.launch()` with no `executablePath` fails here.** The
 *    preinstalled browsers under `PLAYWRIGHT_BROWSERS_PATH` are revision 1194;
 *    a freshly installed `playwright-core` wants whatever revision it shipped
 *    with and reports `Executable doesn't exist at …chromium_headless_shell-<n>`,
 *    which reads exactly like a broken image. Resolve the binary off disk.
 * 2. **A floor harness must import `components/OfficeFloor.css` itself.**
 *    `ArchiSlop.jsx` is its only importer, so the `index.css` + `App.css`
 *    recipe leaves `.office-floor-prop` unpositioned and every prop falls into
 *    static flow at `y ≈ 2000`. The tell is geometry, not blankness.
 * 3. **A walker is a zero-size anchor.** `.office-floor-walker` measures 0×0,
 *    so `waitForSelector` on the default `visible` state times out and reads
 *    like the room is broken. Use `{ state: 'attached' }`, and click a tile
 *    through the figure's own `getBoundingClientRect()` rather than through
 *    hand-rolled stage maths — the roam surface and the walker do not share an
 *    origin, and the arithmetic lands ~430 px away onto bare floor, which looks
 *    identical to the feature not firing.
 *
 * ## What the trace must never become
 *
 * The visit is **fixed**. A run that edits the visit to make the numbers better
 * has measured nothing, and the diff will show it did. The one field that is
 * allowed to change the reading of every other field is `mode.llmConfigured`:
 * with no backend the office falls back to its banks and looks exactly like a
 * worse office, so a canned-fallback trace and a generated one are never
 * compared.
 *
 * The harness page it writes into `apps/web/.office-visit/` is scratch and is
 * deleted on the way out. It never reaches a commit.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '..');
const REPO_ROOT = path.resolve(WEB_ROOT, '../..');
const SCRATCH_DIR = path.join(WEB_ROOT, '.office-visit');

/** The one sentence the visit types. Fixed, like every other step. */
const COMPOSER_LINE = 'Does this diagram make sense to you?';

/** Six seconds beside somebody, against a `DWELL_MS` of five. */
const DWELL_HOLD_MS = 6_000;

/** The instant the floor's own suites pin, so a trace and a test share an office. */
const PINNED_CLOCK = Date.UTC(2026, 7, 11, 4, 0, 0);

/** The fixture the office looks at. Never a user's diagram (ADR-0010). */
const FIXTURE_DIAGRAM = 'flowchart LR\n  Intake --> Triage\n  Triage --> Ship';

const STEP_TIMEOUT_MS = 20_000;

/* ------------------------------------------------------------------ *
 * Resolving the two things this repo deliberately does not depend on. *
 * ------------------------------------------------------------------ */

/**
 * `playwright-core` is not a repo dependency and adding one is a licence,
 * supply-chain and bundle decision the feature-automation contract reserves for
 * an issue. So it is resolved from wherever the operator put it.
 *
 * @returns {Promise<object>} the `playwright-core` module namespace
 */
async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const hinted = process.env.OFFICE_VISIT_PLAYWRIGHT?.trim();
  const candidates = [hinted, hinted && path.join(hinted, 'index.js'), 'playwright-core'].filter(
    Boolean
  );
  for (const candidate of candidates) {
    try {
      const resolved = candidate.startsWith('/')
        ? candidate
        : require.resolve(candidate, { paths: [REPO_ROOT, process.cwd()] });
      /* CJS: `import()` hands back `{ default: module.exports }`, and cjs-module-lexer
         does not always find `chromium` as a named export. Unwrap either shape. */
      const mod = await import(pathToFileURL(resolved).href);
      return mod?.chromium ? mod : mod.default;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(
    'playwright-core did not resolve. It is not a repo dependency on purpose. Install it ' +
      'outside the repo and point at it:\n' +
      '  mkdir -p /tmp/pw && (cd /tmp/pw && npm i playwright-core)\n' +
      '  OFFICE_VISIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright-core node apps/web/test/officeVisitTrace.mjs'
  );
}

/**
 * Trap 1. The preinstalled Chromium's revision is not the one a freshly
 * installed `playwright-core` looks for, so the registry lookup misses and the
 * error names a path nobody chose.
 *
 * @returns {Promise<string | undefined>} an explicit executable path, or
 *   undefined to let playwright's own registry try
 */
async function resolveChromium() {
  const hinted = process.env.OFFICE_VISIT_CHROMIUM?.trim();
  if (hinted) return hinted;
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() || '/opt/pw-browsers';
  let entries = [];
  try {
    entries = await readdir(browsersPath);
  } catch {
    return undefined;
  }
  const dirs = entries.filter((name) => /^chromium-\d+$/.test(name)).sort();
  const newest = dirs.at(-1);
  return newest ? path.join(browsersPath, newest, 'chrome-linux', 'chrome') : undefined;
}

/* ---------------------------------------------- *
 * The scratch harness page. Written, then unlinked. *
 * ---------------------------------------------- */

/**
 * Mounts `OfficeLayer` — not `OfficeFloor` — on purpose. The floor component
 * takes its dialogue as props, so a harness that mounted it would be answering
 * its own questions and `llmConfigured` would mean nothing. `OfficeLayer` owns
 * the real plumbing, so the visit's office calls are the app's office calls.
 */
const HARNESS_JSX = `import { createRoot } from 'react-dom/client';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import { standUp } from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions } from '../src/state/officeMomentStore.js';
import '../src/index.css';
import '../src/App.css';
/* Trap 2: ArchiSlop.jsx is this stylesheet's only importer. Without it every
   prop falls into static flow and the room reads as a projection bug. */
import '../src/components/OfficeFloor.css';

const FIXTURE = ${JSON.stringify(FIXTURE_DIAGRAM)};

/* Captions are the accessibility path and the TTS-failure path both, and
   headless Chromium has no voice — pin them on so the trace can read what was
   said instead of inferring it from a bubble that never drew. */
setOfficeCaptions(true);
standUp();

createRoot(document.getElementById('root')).render(
  <OfficeLayer
    pause={false}
    advisorBusy={false}
    getDiagramSource={() => FIXTURE}
    getContentType={() => 'mermaid'}
    getSessionId={() => 'office-visit-trace'}
    getSvgRoot={() => document}
    getUserTitle={() => 'Intern Architect'}
    getUserName={() => 'Visitor'}
    modelProfile="fast"
    onUsage={(usage) => window.__visit?.note('usage', usage)}
    onAdoptPrompt={(text, colleagueId) => window.__visit?.note('adopt', { text, colleagueId })}
    onMeetingMinutes={() => {}}
    onOfficeEvent={(event) => window.__visit?.note('officeEvent', event)}
    onTalkToTeam={() => {}}
    onCheckHrProgression={() => {}}
    playChime={() => {}}
  />
);
`;

const HARNESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>office visit trace</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/.office-visit/harness.jsx"></script>
  </body>
</html>
`;

async function writeScratchHarness() {
  await mkdir(SCRATCH_DIR, { recursive: true });
  await writeFile(path.join(SCRATCH_DIR, 'harness.jsx'), HARNESS_JSX, 'utf8');
  await writeFile(path.join(SCRATCH_DIR, 'harness.html'), HARNESS_HTML, 'utf8');
}

/* ------------------------------- *
 * Processes: the server and vite. *
 * ------------------------------- */

/**
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status < 500) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env?: Record<string, string> }} options
 */
function launch(command, args, { cwd, env = {} }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = [];
  child.stdout.on('data', (chunk) => log.push(String(chunk)));
  child.stderr.on('data', (chunk) => log.push(String(chunk)));
  return { child, log };
}

/* ------------------------------------------------------------ *
 * The in-page instrument. Installed before any page script runs. *
 * ------------------------------------------------------------ */

/**
 * Runs in the browser via `addInitScript`, so it is serialized — it may close
 * over nothing but its own argument.
 *
 * @param {{ pinnedClock: number }} config
 */
function installInstrument(config) {
  /* Monotonic, and it must be: the clock below is skewed by weeks, so a
     timestamp taken with `Date.now()` before the skew and one after it differ
     by the skew rather than by anything that happened in the room. */
  const t0 = performance.now();
  const elapsed = () => Math.round(performance.now() - t0);
  const state = {
    fetches: [],
    speech: [],
    notes: [],
    samples: [],
    errors: []
  };

  /*
   * Pinned exactly the way every floor suite that mounts pins it. Both globals
   * are inherited and never named by the thing under test: unpinned, a trace
   * disagrees with itself between two nights for reasons that have nothing to
   * do with the office.
   */
  Math.random = () => 0.75;

  /*
   * The clock is *skewed*, not frozen. Freezing `Date.now` would give a
   * deterministic hour and break every elapsed-time measurement in the page —
   * walk animations, TTLs, the dwell timer — which is a worse trade than the
   * one it buys.
   */
  const RealDate = Date;
  const skew = config.pinnedClock - RealDate.now();
  const PinnedDate = new Proxy(RealDate, {
    construct(target, args) {
      return args.length === 0 ? new target(target.now() + skew) : new target(...args);
    },
    get(target, prop, receiver) {
      if (prop === 'now') return () => target.now() + skew;
      return Reflect.get(target, prop, receiver);
    }
  });
  globalThis.Date = PinnedDate;

  /*
   * The bank-versus-model tell, and the only honest one available without
   * touching product code: `deliverLlmMoment` returns false on any non-2xx and
   * the caller deals from a bank instead. So a 503 ("Office LLM is not
   * configured on this server") and a regression are identical from the
   * outside — which is why the status of every office call is reported raw.
   */
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    const at = elapsed();
    if (!/\/api\//.test(url)) return realFetch(input, init);
    const t0 = performance.now();
    try {
      const response = await realFetch(input, init);
      state.fetches.push({
        atMs: at,
        url,
        method: init?.method ?? 'GET',
        status: response.status,
        ok: response.ok,
        ms: Math.round(performance.now() - t0)
      });
      return response;
    } catch (err) {
      state.fetches.push({
        atMs: at,
        url,
        method: init?.method ?? 'GET',
        status: 0,
        ok: false,
        error: String(err?.message ?? err),
        ms: Math.round(performance.now() - t0)
      });
      throw err;
    }
  };

  /** Which surface a line appeared on decides which channel it was said over. */
  const CHANNELS = [
    ['office-floor-talk-line', 'talk'],
    ['office-floor-dwell-line', 'dwell'],
    ['office-floor-shop-talk-line', 'shopTalk'],
    ['office-floor-narration', 'narration'],
    ['office-floor-walker', 'walkby'],
    ['office-floor-prop-card', 'prop'],
    ['office-floor-peek-card', 'peek'],
    ['office-floor-talk-card', 'talkCard'],
    ['office-floor-errand-card', 'errand'],
    ['office-floor-meeting-bubble', 'meeting']
  ];

  function channelOf(node) {
    let cursor = node instanceof Element ? node : node.parentElement;
    while (cursor) {
      const testId = cursor.getAttribute?.('data-testid');
      if (testId) {
        const hit = CHANNELS.find(([id]) => id === testId);
        /* An unmapped surface still names itself. Reporting `unknown` with no
           surface loses the one fact that would let the next run map it. */
        return hit ? { channel: hit[1], surface: testId } : { channel: 'other', surface: testId };
      }
      cursor = cursor.parentElement;
    }
    return null;
  }

  const seen = new Set();

  function harvest() {
    const nodes = document.querySelectorAll(
      '.office-floor-bubble-body, [data-testid$="-line"], [data-testid="office-floor-narration"]'
    );
    for (const node of nodes) {
      const text = (node.textContent ?? '').trim();
      if (!text) continue;
      const where = channelOf(node);
      const key = `${where?.surface ?? 'unknown'}::${text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const nameNode = node
        .closest('.office-floor-bubble, .office-floor-walker, [data-testid]')
        ?.querySelector('.office-floor-bubble-name');
      state.speech.push({
        atMs: elapsed(),
        channel: where?.channel ?? 'unknown',
        surface: where?.surface ?? null,
        speaker: (nameNode?.textContent ?? '').trim() || null,
        text
      });
    }
  }

  /*
   * "How long each figure stayed where it was, and who moved first." Sampled
   * rather than derived from the store: what the trace is about is the room a
   * visitor sees, and the room a visitor sees is the DOM.
   */
  const positions = new Map();

  function sampleFigures() {
    const at = elapsed();
    /*
     * Positions are measured **relative to the stage, normalised by its width**,
     * not in viewport pixels. The stage is authored at a fixed size and
     * CSS-scaled to fit, so the fit-scale settling once after mount moves every
     * figure's viewport rect in the same tick — which a pixel key reads as the
     * entire cast moving simultaneously, and `firstMover` then reports a
     * reflow instead of whoever actually took a step.
     */
    const stage = document.querySelector('.office-floor-stage') ?? document.body;
    const stageRect = stage.getBoundingClientRect();
    const figures = [
      ...document.querySelectorAll('.office-floor-person:not(.is-you)'),
      ...document.querySelectorAll('[data-testid="office-floor-player"]'),
      ...document.querySelectorAll('[data-testid="office-floor-wanderer"]')
    ];
    for (const figure of figures) {
      const id =
        figure.querySelector?.('.office-floor-person-name')?.textContent?.trim() ||
        figure.getAttribute('data-testid') ||
        'unknown';
      const rect = figure.getBoundingClientRect();
      const unit = stageRect.width || 1;
      const key =
        `${Math.round(((rect.left - stageRect.left) / unit) * 1000)},` +
        `${Math.round(((rect.top - stageRect.top) / unit) * 1000)}`;
      const prior = positions.get(id);
      if (!prior) {
        positions.set(id, { id, key, since: at, moves: 0, firstMoveAtMs: null, stillMs: 0 });
        continue;
      }
      if (prior.key === key) {
        prior.stillMs = Math.max(prior.stillMs, at - prior.since);
        continue;
      }
      prior.moves += 1;
      if (prior.firstMoveAtMs === null) prior.firstMoveAtMs = at;
      prior.key = key;
      prior.since = at;
    }
  }

  /** A room signature — what the room looked like, as a comparable object. */
  function roomShot() {
    const floor = document.querySelector('.office-floor');
    const counts = {};
    for (const node of document.querySelectorAll('[data-testid^="office-floor-"]')) {
      const id = node.getAttribute('data-testid');
      counts[id] = (counts[id] ?? 0) + 1;
    }
    const vacant = [...document.querySelectorAll('[data-seat]')]
      .filter((seat) => seat.dataset.vacant === 'true')
      .map((seat) => seat.getAttribute('data-seat'))
      .sort();
    return {
      viewPhase: floor?.getAttribute('data-view-phase') ?? null,
      dayPhase: floor?.getAttribute('data-day-phase') ?? null,
      surfaces: counts,
      vacantSeats: vacant,
      people: [...document.querySelectorAll('.office-floor-person:not(.is-you)')].length,
      cards: [...document.querySelectorAll('.office-floor-card')].map((card) =>
        card.getAttribute('data-testid')
      )
    };
  }

  window.addEventListener('error', (event) => {
    state.errors.push(String(event.message ?? event.error ?? 'error'));
  });

  /**
   * What every speech surface is holding when the visit ends. The mutation
   * harvest can only see a line that was *drawn*; this is the fallback that
   * says whether a line the model produced ever reached the room at all.
   */
  function speechSurfacesNow() {
    const out = [];
    for (const node of document.querySelectorAll(
      '.office-floor-bubble, .office-floor-card, [data-testid="office-floor-narration"]'
    )) {
      const text = (node.textContent ?? '').trim();
      if (text) out.push({ surface: node.getAttribute('data-testid'), text: text.slice(0, 400) });
    }
    return out;
  }

  window.__visit = {
    state,
    speechSurfacesNow,
    note: (kind, payload) => {
      state.notes.push({ atMs: elapsed(), kind, payload: payload ?? null });
    },
    roomShot,
    figures: () => [...positions.values()],
    begin() {
      new MutationObserver(harvest).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      setInterval(() => {
        harvest();
        sampleFigures();
      }, 200);
    }
  };
}

/* -------------- *
 * The fixed visit. *
 * -------------- */

/**
 * Runs one step, recording whether it happened rather than throwing. A visit
 * whose fourth step could not fire is data; a visit that aborted at the fourth
 * step is a night with no row.
 *
 * @param {object[]} steps
 * @param {string} name
 * @param {() => Promise<string | void>} run
 */
async function step(steps, name, run) {
  const t0 = Date.now();
  try {
    const note = await run();
    steps.push({ step: name, ok: true, ms: Date.now() - t0, note: note ?? null });
  } catch (err) {
    steps.push({
      step: name,
      ok: false,
      ms: Date.now() - t0,
      note: String(err?.message ?? err).split('\n')[0]
    });
  }
}

/**
 * The visit, in the playbook's own order. Do not reorder it to make a number
 * move — that is the one edit § 2 names as measuring nothing.
 *
 * @param {import('playwright-core').Page} page
 * @returns {Promise<object[]>}
 */
async function walkTheVisit(page) {
  const steps = [];

  await step(steps, 'enter-the-floor', async () => {
    await page.waitForSelector('.office-floor', { timeout: STEP_TIMEOUT_MS });
    await page.waitForSelector('[data-testid="office-floor-roam"]', { timeout: STEP_TIMEOUT_MS });
    await page.evaluate(() => window.__visit.begin());
    return 'floor mounted, instrument armed';
  });

  /** The named colleague — pinned by name so two nights pick the same person. */
  const named = await page.evaluate(() => {
    const people = [...document.querySelectorAll('.office-floor-person:not(.is-you)')]
      .map((node) => node.querySelector('.office-floor-person-name')?.textContent?.trim())
      .filter(Boolean)
      .sort();
    return people[0] ?? null;
  });

  await step(steps, 'walk-to-a-named-colleague', async () => {
    if (!named) throw new Error('no colleague on the floor to walk to');
    const before = await playerKey(page);
    await page.evaluate((name) => {
      const target = [...document.querySelectorAll('.office-floor-person:not(.is-you)')].find(
        (node) => node.querySelector('.office-floor-person-name')?.textContent?.trim() === name
      );
      target?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, named);
    await page.waitForTimeout(2_500);
    const after = await playerKey(page);
    /* Always assert you actually moved: the room's answer to an illegal tile is
       silence, which reads exactly like the feature failing to fire. */
    return `${named}; player ${before === after ? 'did NOT move' : 'moved'}`;
  });

  await step(steps, 'step-into-their-path', async () => {
    /*
     * Wait for one. Ambient traffic starts when the room decides to, not when
     * the visit reaches this line — measured, the first wanderer appears around
     * 11 s in, and a visit that clicked at 5 s reported "no wanderer on the
     * floor" every night. That is not the interrupt rung being broken, it is
     * the instrument arriving early, and it would leave `goHome({ byYou })` —
     * the whole subject of the next queue item — permanently unobserved.
     */
    await page
      .waitForSelector(
        '[data-testid="office-floor-wanderer"], [data-testid="office-floor-walker"]',
        {
          state: 'attached',
          timeout: STEP_TIMEOUT_MS
        }
      )
      .catch(() => null);
    /* Trap 3: a walker is a 0×0 anchor, and its own rect already *is* the
       tile's screen position. Stage maths lands ~430 px away on bare floor. */
    const moved = await page.evaluate(() => {
      const walker = document.querySelector(
        '[data-testid="office-floor-wanderer"], [data-testid="office-floor-walker"]'
      );
      const roam = document.querySelector('.office-floor-roam');
      if (!walker || !roam) return 'no wanderer on the floor';
      const rect = walker.getBoundingClientRect();
      roam.dispatchEvent(
        new MouseEvent('click', { clientX: rect.x, clientY: rect.y, bubbles: true })
      );
      return 'clicked the wanderer’s own tile';
    });
    await page.waitForTimeout(2_500);
    return moved;
  });

  await step(steps, 'stand-beside-them-six-seconds', async () => {
    /*
     * Leaving the conversation first is not tidying up, it is what makes this
     * step a step. `useFloorDwell` is gated on `active`, and a card open is a
     * *reason* to be stood there — so loitering with the talk card up cannot
     * produce a dwell line by construction, and the step would measure nothing
     * while looking like it had run.
     */
    const left = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="office-floor-talk-card"]');
      const leave = [...(card?.querySelectorAll('button') ?? [])].at(-1);
      leave?.click();
      return Boolean(leave);
    });
    const before = await page.evaluate(() => window.__visit.state.speech.length);
    await page.waitForTimeout(DWELL_HOLD_MS);
    const after = await page.evaluate(() => window.__visit.state.speech.length);
    return `${after - before} line(s) while loitering (DWELL_MS is 5000; talk card ${left ? 'closed' : 'was not open'})`;
  });

  await step(steps, 'use-the-printer', () => clickProp(page, /printer/i));
  await step(steps, 'open-the-whiteboard', () => clickProp(page, /whiteboard/i));

  await step(steps, 'say-one-sentence-in-the-composer', async () => {
    if (!named) throw new Error('no colleague to speak to');
    await page.evaluate((name) => {
      const target = [...document.querySelectorAll('.office-floor-person:not(.is-you)')].find(
        (node) => node.querySelector('.office-floor-person-name')?.textContent?.trim() === name
      );
      target?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    }, named);
    const input = await page
      .waitForSelector('[data-testid="office-floor-talk-card"] .office-floor-talk-input', {
        timeout: STEP_TIMEOUT_MS
      })
      .catch(() => null);
    if (!input) throw new Error('the talk composer never opened');
    await input.fill(COMPOSER_LINE);
    await page.keyboard.press('Enter');
    /* A typed sentence is the most reactive channel the office has (§ 11), so
       this is the one wait worth being generous with. */
    await page.waitForTimeout(12_000);
    return `sent: ${COMPOSER_LINE}`;
  });

  return steps;
}

/**
 * @param {import('playwright-core').Page} page
 * @param {RegExp} label
 */
async function clickProp(page, label) {
  const found = await page.evaluate((source) => {
    const re = new RegExp(source, 'i');
    const button = [...document.querySelectorAll('button[aria-label]')].find((node) =>
      re.test(node.getAttribute('aria-label') ?? '')
    );
    if (!button) return null;
    button.click();
    return button.getAttribute('aria-label');
  }, label.source);
  await page.waitForTimeout(3_000);
  if (!found) throw new Error(`no prop matching ${label}`);
  return found;
}

/** @param {import('playwright-core').Page} page */
function playerKey(page) {
  return page.evaluate(() => {
    const player = document.querySelector('[data-testid="office-floor-player"]');
    if (!player) return null;
    const rect = player.getBoundingClientRect();
    return `${Math.round(rect.left)},${Math.round(rect.top)}`;
  });
}

/* ----- *
 * Main. *
 * ----- */

function parseArgs(argv) {
  return {
    noLlm: argv.includes('--no-llm'),
    keep: argv.includes('--keep'),
    out: argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null,
    webPort: Number(argv.includes('--web-port') ? argv[argv.indexOf('--web-port') + 1] : 5199),
    apiPort: Number(argv.includes('--api-port') ? argv[argv.indexOf('--api-port') + 1] : 4199)
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  /** @type {Array<{ child: import('node:child_process').ChildProcess, log: string[] }>} */
  const running = [];
  let browser = null;

  try {
    const { chromium } = await loadPlaywright();

    if (!args.noLlm) {
      running.push(
        launch(process.execPath, ['dist/index.js'], {
          cwd: path.join(REPO_ROOT, 'apps/server'),
          env: { PORT: String(args.apiPort), NODE_ENV: 'development' }
        })
      );
      await waitForHttp(`http://127.0.0.1:${args.apiPort}/api/health`, 40_000);
    }

    await writeScratchHarness();
    running.push(
      launch(
        process.execPath,
        [
          path.join(REPO_ROOT, 'node_modules/vite/bin/vite.js'),
          '--port',
          String(args.webPort),
          '--strictPort'
        ],
        { cwd: WEB_ROOT, env: { PORT: String(args.apiPort) } }
      )
    );
    const viteUp = await waitForHttp(`http://127.0.0.1:${args.webPort}/`, 60_000);
    if (!viteUp) throw new Error('vite never came up');

    const executablePath = await resolveChromium();
    browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(installInstrument, { pinnedClock: PINNED_CLOCK });

    await page.goto(`http://127.0.0.1:${args.webPort}/.office-visit/harness.html`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000
    });
    await page.waitForSelector('.office-floor', { timeout: 60_000 });

    const before = await page.evaluate(() => window.__visit.roomShot());
    const steps = await walkTheVisit(page);
    const after = await page.evaluate(() => window.__visit.roomShot());
    /*
     * The office's own record of the conversation, read through the dev
     * server's module graph rather than through the DOM. Without it the trace
     * cannot tell "the model said nothing" from "the model said something the
     * room never drew" — and those two look identical from the outside while
     * meaning opposite things about the code.
     */
    const imHistoryAtEnd = await page
      .evaluate(() =>
        import('/src/state/officeMomentStore.js').then((mod) =>
          (mod.getOfficeSnapshot().imHistory ?? []).map((msg) => ({
            colleagueId: msg.colleagueId ?? null,
            channel: msg.channel ?? null,
            outbound: Boolean(msg.outbound),
            body: String(msg.body ?? '').slice(0, 200)
          }))
        )
      )
      .catch((err) => ({ error: String(err?.message ?? err).split('\n')[0] }));

    const collected = await page.evaluate(() => ({
      speech: window.__visit.state.speech,
      fetches: window.__visit.state.fetches,
      notes: window.__visit.state.notes,
      errors: window.__visit.state.errors,
      figures: window.__visit.figures(),
      endSurfaces: window.__visit.speechSurfacesNow()
    }));

    const trace = buildTrace({
      args,
      startedAt,
      t0,
      steps,
      before,
      after,
      collected: { ...collected, imHistoryAtEnd }
    });
    const json = JSON.stringify(trace, null, 2);
    console.log(json);
    if (args.out) await writeFile(path.resolve(process.cwd(), args.out), json, 'utf8');
  } finally {
    if (browser) await browser.close().catch(() => {});
    for (const { child } of running) child.kill('SIGTERM');
    if (!args.keep) await rm(SCRATCH_DIR, { recursive: true, force: true });
  }
}

/**
 * Assembles the one JSON object. Everything derived is labelled as derived and
 * shipped beside the raw signal it came from, so a later run can disagree with
 * the derivation without having to re-run the visit.
 */
function buildTrace({ args, startedAt, t0, steps, before, after, collected }) {
  const officeCalls = collected.fetches.filter((call) => /\/api\/office\//.test(call.url));
  /*
   * `/api/office/speak` is Cloud TTS and answers **200 with `audio: null`** when
   * it is off or unconfigured, precisely so the client can degrade without a
   * toast. Counting it would report `llmConfigured` on an office that had not
   * asked a model anything — the exact confusion § 2 says never to make.
   */
  const llmCalls = officeCalls.filter((call) => !/\/api\/office\/speak\b/.test(call.url));
  const succeeded = llmCalls.filter((call) => call.ok);
  const llmConfigured = succeeded.length > 0;
  const verdict = args.noLlm
    ? 'canned-fallback (--no-llm: no server started)'
    : llmConfigured
      ? 'generated'
      : llmCalls.length === 0
        ? 'no-llm-calls (nothing asked the model anything this visit)'
        : `canned-fallback (${[...new Set(llmCalls.map((c) => c.status))].join(', ')})`;

  /*
   * Derived, and deliberately crude: a line is credited to the model when a
   * successful office call resolved in the eight seconds before it appeared.
   * The raw call log sits beside it because that heuristic is the first thing
   * a later run should want to check.
   */
  const attribute = (line) =>
    succeeded.some((call) => line.atMs - call.atMs >= 0 && line.atMs - call.atMs < 8_000)
      ? 'model'
      : 'bank';

  /*
   * Ground truth for "did a model speak", independent of rendering: `onUsage`
   * only fires on a turn that actually produced tokens. The harvest below can
   * miss a line the room drew and undrew (voice leads, text is the fallback —
   * a bubble is hidden while TTS speaks), so a trace that reported only
   * `bySource` would read 0 model lines on a night the model answered.
   */
  const modelTurns = collected.notes
    .filter((note) => note.kind === 'usage')
    .map((note) => ({ atMs: note.atMs, ...note.payload }));

  const speech = collected.speech.map((line) => ({ ...line, source: attribute(line) }));
  const byChannel = {};
  const bySource = { model: 0, bank: 0 };
  for (const line of speech) {
    byChannel[line.channel] = (byChannel[line.channel] ?? 0) + 1;
    bySource[line.source] += 1;
  }

  const figures = collected.figures
    .map((figure) => ({
      id: figure.id,
      moves: figure.moves,
      firstMoveAtMs: figure.firstMoveAtMs,
      longestStillMs: figure.stillMs
    }))
    .sort((a, b) => (a.firstMoveAtMs ?? Infinity) - (b.firstMoveAtMs ?? Infinity));

  return {
    harness: 'officeVisitTrace',
    version: 1,
    startedAt,
    durationMs: Date.now() - t0,
    mode: {
      llmConfigured,
      verdict,
      officeCalls: officeCalls.map(({ url, method, status, ms, atMs }) => ({
        atMs,
        method,
        path: url.replace(/^https?:\/\/[^/]+/, ''),
        status,
        ms
      })),
      apiCallsTotal: collected.fetches.length,
      pinned: { mathRandom: 0.75, clock: new Date(PINNED_CLOCK).toISOString() }
    },
    visit: steps,
    speech: {
      lines: speech,
      count: speech.length,
      byChannel,
      bySource,
      modelTurns,
      endSurfaces: collected.endSurfaces,
      imHistoryAtEnd: collected.imHistoryAtEnd,
      sourceRule:
        'derived: a line within 8000ms after a 2xx /api/office call is credited to the model'
    },
    movement: {
      firstMover: figures.find((figure) => figure.firstMoveAtMs !== null)?.id ?? null,
      figures
    },
    roomDelta: diffRoom(before, after),
    pageErrors: collected.errors,
    notes: collected.notes
  };
}

/** What the room looked like at the end that did not look like that at the start. */
function diffRoom(before, after) {
  const changed = {};
  for (const key of ['viewPhase', 'dayPhase', 'people']) {
    if (before[key] !== after[key]) changed[key] = { before: before[key], after: after[key] };
  }
  const surfaces = {};
  const ids = new Set([...Object.keys(before.surfaces), ...Object.keys(after.surfaces)]);
  for (const id of ids) {
    const from = before.surfaces[id] ?? 0;
    const to = after.surfaces[id] ?? 0;
    if (from !== to) surfaces[id] = { before: from, after: to };
  }
  const seatsBefore = new Set(before.vacantSeats);
  const seatsAfter = new Set(after.vacantSeats);
  return {
    changed,
    surfaces,
    seatsVacated: after.vacantSeats.filter((seat) => !seatsBefore.has(seat)),
    seatsRefilled: before.vacantSeats.filter((seat) => !seatsAfter.has(seat)),
    cards: { before: before.cards, after: after.cards }
  };
}

main().catch((err) => {
  console.error(String(err?.stack ?? err));
  process.exitCode = 1;
});
