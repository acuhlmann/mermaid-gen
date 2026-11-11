/**
 * The scripted visit — the `office-life` automation's acceptance instrument
 * (docs/automations/office-life.md § 2, queue item 0).
 *
 * Every productive rung on the feature shelf has a number it re-measures
 * nightly (`benchMetaphor.js`, `benchAnything.js`). The office's number is a
 * **fixed visit**: enter the floor, walk to a named colleague, step into their
 * path, stand beside them for six seconds, use the printer, open the
 * whiteboard, say one sentence in the composer, read somebody's screen, and
 * wave away an idea somebody brought over. It prints **one JSON object**, and
 * that object is what goes in the ledger row.
 *
 * ## Run it
 *
 * ```bash
 * npm ci                                   # playwright-core is NOT a repo dependency
 * npm run build                            # the API server is started from dist/ — see below
 * mkdir -p /tmp/pw && (cd /tmp/pw && npm i playwright-core)
 * OFFICE_VISIT_PLAYWRIGHT=/tmp/pw/node_modules/playwright-core \
 *   node apps/web/test/officeVisitTrace.mjs --out trace.json
 * node apps/web/test/officeVisitTrace.mjs --no-llm      # deliberate canned-fallback trace
 * ```
 *
 * **`npm run build` is not optional, and a missed one used to be silent.** This
 * harness spawns the server's *build output*, not its sources, so on a fresh
 * checkout there is no API at all: vite answers every office call with a 502
 * and the visit prints a perfectly well-formed `canned-fallback` trace while
 * `DEEPSEEK_API_KEY` sits in the shell looking like the generated arm. The
 * health wait is now fatal and says so; a run that reports an arm it did not
 * reach is worse than a run that stops.
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
 *    which reads exactly like a broken image. Resolve the binary off disk —
 *    and **probe the path rather than building it**: the directory inside the
 *    revision is `chrome-linux` on some images and `chrome-linux64` on others,
 *    and three nightly runs lost time to a constructed path that did not exist,
 *    failing with the very message this trap exists to prevent.
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
 * **The steps are fixed; the report is not.** Those are two different rules
 * wearing one sentence, and collapsing them once cost a night: an instrument
 * that cannot observe the axis a slice is on reports "nothing moved" for a
 * slice that moved something, which is a false negative dressed as a
 * measurement. So a later run may add an *observation* — `afterwards` below is
 * the first, and it exists because queue 2 changed what the office knows
 * rather than what it draws. Add the observation in **its own run**, never in
 * the run that needs the number it produces. `movement.wanderers` (version 4)
 * is the second, and it exists for the same reason one run later: 2026-10-29
 * made an ambient errand's destination depend on what the player had just
 * done, and no field here named where a wanderer was going.
 *
 * **The step count has moved twice — seven to eight, then eight to nine — and
 * the rule that forbade it is narrowed rather than dropped.** For eight weeks this header
 * said a run "may never add, reorder or retime a step", full stop, and that
 * sentence was doing two jobs: keeping a run from editing the visit to move a
 * number, and keeping eight nights of traces comparable. The first job is
 * untouched and absolute. The second broke on 2026-11-06, when a slice gave
 * the colleague whose screen you read a memory of it and the trace reported
 * **no `peeked` row in 3 of 3** — not because the report was missing an axis
 * (that is 2026-09-06's shape and `afterwards` is its fix) but because **not
 * one of the seven steps read a screen**. Desk peeking is the most deliberate
 * approach the floor has: you choose it off a card, cross the room, your own
 * seat empties. A visit with no peek in it cannot see a third of question 1's
 * own list, and no observation can recover a verb the visit never performs.
 *
 * So the rule now reads: **a step may never be reordered, retimed or
 * rewritten, and a step may be appended only in a run that wants nothing from
 * the number it produces, with the ledger carrying the spec first.** This one
 * was spec'd as `visit-has-no-peek-step` the night before it was built, and it
 * is appended *after* step 7 so that every earlier step keeps its order, its
 * waits and its subject. The cost is paid once and paid openly: totals that
 * sum over the whole visit (`speech.count`, `byChannel`, `bySource`) are a
 * version-5 number and are **not** comparable with versions ≤4, so
 * `speech.throughStep7` reports the same totals cut at the eighth step's
 * start — eight nights of baselines are read off that field instead of being
 * thrown away. `roomDelta.cards.after` is the other one-time change: the visit
 * used to end with the talk card open and now ends standing at somebody
 * else's desk, which is where a peek leaves you.
 *
 * **The ninth step, 2026-11-11, is the same rule applied a second time and is
 * the better test of it.** Spec'd in the ledger as `visit-has-no-walkby-step`
 * three nights before it was built; appended *after* step 8 so no earlier step
 * moves; taken in a run that wanted nothing from the number. What it buys is
 * larger than the peek's: the walk-by is the one surface four separate slices
 * have landed on without the instrument ever seeing one, because
 * `shouldHoldFire()` turns the ambient director off for the whole length of a
 * floor visit, so no amount of waiting produces one. The cost is the same cost,
 * paid the same way — version-6 totals, `speech.throughStep7` unchanged, and
 * the step placed last because a walk-by writes into the office log and working
 * memory that every earlier step's prompt reads from.
 *
 * The harness page it writes into `apps/web/.office-visit/` is scratch and is
 * deleted on the way out. It never reaches a commit.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
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

/**
 * The walk-by the ninth step receives, fixed the way `COMPOSER_LINE` is.
 *
 * Three choices in it are load-bearing, and the first two are the 2026-11-08
 * slice's own findings re-used rather than re-derived.
 *
 * - **`actionPrompt` is the gate**, not decoration. `dismissOfficeWalkByWithMemory`
 *   writes a refusal only when the bubble was carrying a Do it button: with a
 *   prompt the bubble is a question and ✕ is an answer, without one it is
 *   somebody saying a thing and closing it means you read it. A fixture with no
 *   prompt would make this step report a green ✕ and no beat, for ever, and
 *   read as a broken writer.
 * - **`greybeard` can actually walk over.** He is in `OFFICE_WALKBY_LLM_CAST`,
 *   in the canned bank and in all three ambient casts, so the state this step
 *   drives is one the room produces on its own. He is also the one seated
 *   colleague no earlier step touches, which is what keeps the new beat
 *   unambiguous: steps 3, 4, 7 and 8 leave rows on `intern`, `dinesh` and
 *   `gilfoyle`, and a fixture sharing any of those would hide a writer that
 *   wrote onto the wrong person.
 * - **The body names the fixture diagram and the prompt is a real edit**, so
 *   the sentence a later exchange quotes back reads like the room rather than
 *   like a test fixture.
 */
const WALKBY_FIXTURE = Object.freeze({
  colleagueId: 'greybeard',
  body: 'Saw your funnel on the way past. Intake straight into Ship is going to bite you by Q3.',
  actionPrompt: 'Add a rejection edge from Triage back to Intake'
});

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
 * **And the directory inside the revision has two spellings.** This function
 * assumed `chrome-linux` for its first eight weeks; three nights running
 * (2026-10-28/29/30) the image shipped **`chrome-linux64`**, so the path it
 * built did not exist and `launch()` reported "executable doesn't exist at …" —
 * which reads exactly like the broken image the comment above exists to rule
 * out, and each of those runs worked around it by hand with
 * `OFFICE_VISIT_CHROMIUM`. So: **probe, never construct.** Every candidate is
 * stat'ed before it is returned, and `<browsersPath>/chromium` — a symlink
 * straight at the real binary, which resolves under either layout — is the last
 * one tried. Returning a path that does not exist is worse than returning
 * nothing, because playwright's own registry is a working fallback and a bad
 * explicit path overrides it.
 *
 * @returns {Promise<string | undefined>} an executable path that exists, or
 *   undefined to let playwright's own registry try
 */
async function resolveChromium() {
  const hinted = process.env.OFFICE_VISIT_CHROMIUM?.trim();
  if (hinted) return hinted;
  const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH?.trim() || '/opt/pw-browsers';
  let entries;
  try {
    entries = await readdir(browsersPath);
  } catch {
    return undefined;
  }
  const newest = entries
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .at(-1);
  const candidates = [
    newest && path.join(browsersPath, newest, 'chrome-linux64', 'chrome'),
    newest && path.join(browsersPath, newest, 'chrome-linux', 'chrome'),
    path.join(browsersPath, 'chromium')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      /* try the next spelling */
    }
  }
  return undefined;
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
    errors: [],
    /* Prop (and other) cards the visit opened — blurbs live on `.office-floor-card-blurb`,
       which `harvest()` deliberately does not select, so they belong here rather than in
       `speech`. */
    read: [],
    /* The model's own words, read off the responses the room is about to
       render. See `recordDelivered` below for why this exists. */
    delivered: []
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
  /*
   * Keys whose values are identifiers rather than anything a colleague said.
   * `model` is the slug, `kind`/`colleagueId`/`speakerId` are enums and ids —
   * crediting a rendered line to the model because it happens to contain the
   * word "dwell" is the same class of error as the clock window this replaces.
   */
  const DELIVERED_ID_KEYS = new Set([
    'colleagueId',
    'kind',
    'model',
    'speakerId',
    'scriptVersion',
    'reason',
    'error'
  ]);

  /** Every string in a response that could be shown as speech. */
  function collectDelivered(value, out) {
    if (typeof value === 'string') {
      const text = value.replace(/\s+/g, ' ').trim();
      if (text.length >= 4) out.push(text);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectDelivered(item, out);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (!DELIVERED_ID_KEYS.has(key)) collectDelivered(item, out);
      }
    }
  }

  /**
   * **What makes `source` an observation instead of a guess.** The field used
   * to be a clock window — a line within 8 s of a successful office call was
   * the model's — and that held only while every generated visit made its one
   * call at the *last* step, with nothing behind it. A mid-visit call (the
   * dwell, ~18 s) sweeps up whatever narration the room happened to draw next,
   * and the trace then reports five model lines for two model turns.
   *
   * A response body is the only thing on this page that is the model's words
   * verbatim, so the clone is read here and the match is made on text. The
   * clone is deliberate: reading the real response would consume the body the
   * app is about to parse. Failures are swallowed — a body that is not JSON is
   * a call this attribution has nothing to say about, not a broken visit.
   */
  function recordDelivered(url, response) {
    response
      .clone()
      .json()
      .then((body) => {
        const texts = [];
        collectDelivered(body, texts);
        if (texts.length) {
          state.delivered.push({
            atMs: elapsed(),
            path: url.replace(/^https?:\/\/[^/]+/, ''),
            texts
          });
        }
      })
      .catch(() => {
        /* not JSON, or already gone: nothing to attribute */
      });
  }

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
      /* `/speak` is Cloud TTS: it carries audio, never words. Everything else
         under `/api/office/` can carry a line the room is about to say. */
      if (response.ok && /\/api\/office\//.test(url) && !/\/api\/office\/speak\b/.test(url)) {
        recordDelivered(url, response);
      }
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
    /*
     * The interrupted errand's one line, and it is new here only because the
     * step above never provoked one before: an unmapped surface reports
     * `other` with its own name so the next run can map it, and this is that
     * next run. It is a *different actor* from `office-floor-walker` above
     * despite the shared class — that is a walk-by coming to bother you, this
     * is somebody whose coffee run you ended.
     */
    ['office-floor-wanderer', 'interrupt'],
    /*
     * What they say about what is on their monitor, once you have got there.
     * Mapped 2026-11-07 with the step that provokes it: before the eighth step
     * existed nothing on this floor could produce the surface, so it had never
     * reported itself as `other` and there had been nothing to map. The card
     * below is the chrome beside it (the way back and the caption) and is a
     * different surface, not a duplicate.
     */
    ['office-floor-peek-line', 'peek'],
    /* Prop cards are read surfaces, not speech — see `readPropCardNow` / `state.read`. */
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
    const matched = [
      ...document.querySelectorAll(
        '.office-floor-bubble-body, [data-testid$="-line"], [data-testid="office-floor-narration"]'
      )
    ];
    /*
     * **Innermost match only, and this is a correction rather than a tidy-up.**
     * A dwell surface satisfies this selector twice — the
     * `office-floor-dwell-line` container and the `.office-floor-bubble-body`
     * inside it — and the container's `textContent` is the speaker's name
     * welded onto the sentence ("Gary · Facilities & Fridge CzarMotion lights
     * on 3 are haunted…"). The `surface::text` dedupe below could not catch it,
     * because the two texts genuinely differ. So **every dwell line was
     * counted twice**: the 2026-09-05 baseline's "dwell: 0 or 2" is one line
     * either way, and `speech.count` was inflated by exactly the number of
     * dwells in the visit.
     *
     * Dropping any node that contains another match keeps the row whose text
     * *is* the line. Nothing else about the row changes — `channelOf` walks up
     * to the same `data-testid` from either node, and the speaker is read off
     * the same `.closest(…)` bubble — which is why the duplicate pair agreed
     * on channel, surface and speaker and disagreed only on `text`.
     */
    const nodes = matched.filter(
      (node) => !matched.some((other) => other !== node && node.contains(other))
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

  /*
   * **Where ambient traffic went, and whether it got there.** Sampled on the
   * same 200 ms tick as the figures and for the same reason: the subject is the
   * room a visitor sees.
   *
   * Keyed on **who and where** — `seatId` plus the prop — because the same
   * colleague sent to two different props is the observation's whole point, and
   * keying on the prop alone would merge two people at one machine. The honest
   * cost of that choice: one colleague sent to the *same* prop twice in a visit
   * collapses into one row with the earlier `firstSeenAtMs`. No run has ever
   * produced a second errand, so this is reasoned rather than measured; a run
   * that sees two rows should say whether the keying held.
   *
   * The prop comes off `data-wander-prop`, which the walker now carries — the
   * 2026-10-29 probe had to infer it from nearest-rect geometry, and geometry
   * standing in for a fact the DOM could carry is the thing that breaks the
   * first time two props sit near each other.
   *
   * `settledAtMs` is the one derived field and it is derived by *observation*:
   * `data-settled` is only true for `phase === 'dwell'`, so a single sample at
   * the end of the visit cannot tell the way out from the way home, while a
   * tick that has watched the whole trip can say whether they ever stood at the
   * thing. `null` therefore means "turned round before arriving", which is
   * exactly the state `goHome({ byYou })` produces and the state the visit's
   * own step 3 creates on purpose.
   */
  const wanderers = new Map();

  function sampleWanderers() {
    const at = elapsed();
    for (const node of document.querySelectorAll('[data-testid="office-floor-wanderer"]')) {
      const seatId = node.getAttribute('data-wanderer');
      if (!seatId) continue;
      const prop = node.getAttribute('data-wander-prop') ?? null;
      /* A trip is keyed on who *and* where: the same colleague sent out twice
         is two rows, and re-keying on the prop alone would merge two people. */
      const key = `${seatId}::${prop ?? 'unknown'}`;
      const prior = wanderers.get(key);
      const settled = node.getAttribute('data-settled') === 'true';
      if (!prior) {
        wanderers.set(key, {
          seatId,
          prop,
          firstSeenAtMs: at,
          settledAtMs: settled ? at : null,
          said: node.getAttribute('data-said') ?? null
        });
        continue;
      }
      if (settled && prior.settledAtMs === null) prior.settledAtMs = at;
      /* The line an interrupted errand carries home arrives after the row does,
         so it is filled in rather than read once. */
      prior.said = node.getAttribute('data-said') ?? prior.said;
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

  /** What the visible prop card is showing — not speech, and not in `harvest()`. */
  function readPropCardNow() {
    const card = document.querySelector('[data-testid="office-floor-prop-card"]');
    if (!card) return null;
    const blurb = (card.querySelector('.office-floor-card-blurb')?.textContent ?? '').trim();
    if (!blurb) return null;
    const title = (card.querySelector('.office-floor-card-title')?.textContent ?? '').trim();
    return { surface: 'office-floor-prop-card', title: title || null, blurb: blurb.slice(0, 400) };
  }

  window.__visit = {
    state,
    speechSurfacesNow,
    readPropCardNow,
    recordRead(entry) {
      state.read.push({ atMs: elapsed(), ...entry });
    },
    note: (kind, payload) => {
      state.notes.push({ atMs: elapsed(), kind, payload: payload ?? null });
    },
    roomShot,
    /* The instrument's own elapsed clock, so a mark the driver takes and an
       `atMs` a line carries are the same number measured the same way. */
    now: () => elapsed(),
    figures: () => [...positions.values()],
    wanderers: () => [...wanderers.values()],
    begin() {
      new MutationObserver(harvest).observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      setInterval(() => {
        harvest();
        sampleFigures();
        sampleWanderers();
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
     * Wait for one, and wait for them to have **arrived**. Ambient traffic
     * starts when the room decides to, not when the visit reaches this line —
     * measured, the first wanderer appears around 11 s in, and a visit that
     * clicked at 5 s reported "no wanderer on the floor" every night.
     *
     * `data-settled` is the second half of that wait and it is what this step
     * was missing for three nights. `useFloorWander`'s gate is
     * `sameTile(wanderer.to, yourOrigin)` — the tile they are **heading for**,
     * which is the prop's mark — and for the whole walk out that is not the
     * tile they are standing on. Clicking the figure the instant it attaches
     * therefore claims the square they have just left (their own chair,
     * measured at 15.8 s against a click at ~7.6 s), the errand runs to
     * completion, and `goHome({ byYou })` never fires. Three nights of traces
     * reported this step `ok` with "clicked the wanderer's own tile" and no
     * interrupt beat anywhere in `afterwards` — a green step that performed
     * nothing, which is the failure mode the ledger's Open observations name.
     *
     * `data-settled="true"` is the DOM's own word for `phase === 'dwell'`:
     * standing at `to`, the one moment their live rect and their destination
     * are the same point. Narrowed to the wanderer at the same time — the old
     * selector also matched `office-floor-walker`, a *walk-by* coming to bother
     * you, whose tile has nothing to do with anybody's errand.
     */
    const settled = await page
      .waitForSelector('[data-testid="office-floor-wanderer"][data-settled="true"]', {
        state: 'attached',
        timeout: STEP_TIMEOUT_MS
      })
      .catch(() => null);
    /* Trap 3: a walker is a 0×0 anchor (both its branches position their child
       absolutely, so the box stays empty in either phase), and its own rect
       already *is* the tile's screen position. Stage maths lands ~430 px away
       on bare floor. */
    const clicked = await page.evaluate(() => {
      const walker = document.querySelector('[data-testid="office-floor-wanderer"]');
      const roam = document.querySelector('.office-floor-roam');
      if (!walker || !roam) return 'no wanderer on the floor';
      const rect = walker.getBoundingClientRect();
      roam.dispatchEvent(
        new MouseEvent('click', { clientX: rect.x, clientY: rect.y, bubbles: true })
      );
      return 'clicked the wanderer’s own tile';
    });
    /*
     * Always assert you actually did it. `data-said` is written from
     * `interruptSpeech`'s answer, so it exists only when the room turned
     * somebody round *because of you* — which is the difference between a step
     * that performed and a step that reported `ok` for a click on bare floor.
     *
     * The wait is spent **inside** the step's existing 2 500 ms pause rather
     * than added to it. The step still gets longer — measured 7.5–8.0 s before
     * this change against 9.5 s after, all of it the `data-settled` wait above
     * — and that is the cost of a step that performs rather than reports. Not
     * a step was added, reordered or given a different pause; keep it that way,
     * because the visit is the one thing here that may not drift.
     */
    const clickedAt = Date.now();
    const spoke = await page
      .waitForSelector('[data-testid="office-floor-wanderer"][data-said]', {
        state: 'attached',
        timeout: 2_500
      })
      .catch(() => null);
    const reaction = spoke ? await spoke.getAttribute('data-said') : null;
    const spent = Date.now() - clickedAt;
    if (spent < 2_500) await page.waitForTimeout(2_500 - spent);
    const where = settled ? 'at their mark' : 'never settled — clicked mid-stride';
    return `${clicked} (${where}); interrupted: ${reaction ?? 'no'}`;
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

  /*
   * **The eighth step, appended 2026-11-07 — read the header's rule before
   * touching it.** It exists because the verb it performs is the one aimed at a
   * named person that the visit did not contain, so an entire slice (the peek
   * beat, 2026-11-06) was unobservable here by construction.
   *
   * Three things in it are load-bearing.
   *
   * 1. **Leave the conversation first.** The card slot is single-occupancy and
   *    ordered by how much of your body is committed (`FloorCardSlot`): a talk
   *    outranks a peek *and* the person card the peek verb lives on, so a step
   *    that clicked the person without leaving would be clicking through a card
   *    that is still showing — the same trap step 4 pays for with the same
   *    `at(-1)` button.
   * 2. **The verb is found by what it says, not by where it sits.** The card's
   *    actions are `talk` / `message` / `peek` in offer order and `message` is
   *    false on the floor, so the peek is "the second button" only until
   *    somebody adds a verb. Matching the label keeps the step aimed at the
   *    verb rather than at an index, and a missing button is recorded as a
   *    failed step rather than silently clicking `talk` again.
   * 3. **Arrival is the assertion, and `office-floor-peek-line` is what proves
   *    it.** `FloorPeek` renders nothing until `phase === 'looking'`, which is
   *    also the exact condition `useFloorPeekMemory` latches on — so the line
   *    being in the DOM and the beat being written are the same fact, and a
   *    step that only waited for the card would report `ok` for a walk that
   *    Escape or a meeting had abandoned halfway.
   *
   * It does not walk you home. A peek ends with you standing at their desk
   * reading their screen; sending you back would be a second walk whose only
   * purpose is to make `roomDelta` look like it used to, which is editing the
   * visit to protect a number.
   */
  await step(steps, 'read-their-screen', async () => {
    if (!named) throw new Error('no colleague whose screen to read');
    /* The mark `speech.throughStep7` is cut at — see the header. Read from the
       instrument's own clock so it is the same clock every line carries. */
    const startedAtMs = await page.evaluate(() => {
      window.__visit.state.eighthStepAtMs = window.__visit.now();
      return window.__visit.state.eighthStepAtMs;
    });
    const left = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="office-floor-talk-card"]');
      const leave = [...(card?.querySelectorAll('button') ?? [])].at(-1);
      leave?.click();
      return Boolean(leave);
    });
    await page.waitForTimeout(2_500);
    await page.evaluate((name) => {
      const target = [...document.querySelectorAll('.office-floor-person:not(.is-you)')].find(
        (node) => node.querySelector('.office-floor-person-name')?.textContent?.trim() === name
      );
      target?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, named);
    const pressed = await page.evaluate(() => {
      const actions = [...document.querySelectorAll('.office-floor-card-action')];
      const verb = actions.find((node) => /screen/i.test(node.textContent ?? ''));
      verb?.click();
      return verb ? (verb.textContent ?? '').trim() : null;
    });
    if (!pressed) {
      throw new Error(`no peek verb on ${named}'s card (${left ? 'talk left' : 'no talk card'})`);
    }
    const line = await page
      .waitForSelector('[data-testid="office-floor-peek-line"]', {
        state: 'attached',
        timeout: STEP_TIMEOUT_MS
      })
      .catch(() => null);
    /* Long enough for the harvest tick (200 ms) to see the line it just drew,
       and no longer: the beat is written in an effect on arrival, not on a
       timer. */
    await page.waitForTimeout(1_200);
    const arrived = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="office-floor-peek-card"]'))
    );
    return (
      `${named}; pressed “${pressed}”; ` +
      `${arrived ? 'standing at their desk' : 'never arrived'}; ` +
      `${line ? 'their screen line drew' : 'no line'} (step opened at ${startedAtMs} ms)`
    );
  });

  /*
   * **The ninth step, appended 2026-11-11 — read the header's rule before
   * touching it.** It exists for the reason the eighth step did: four slices
   * land on the walk-by surface (the ambient speaker draw, the reply bank, the
   * canned fallbacks, and the refusal beat) and **not one of the eight steps
   * ever receives a walk-by**, so every one of them was measured by a sweep or
   * an audition and none by the nightly instrument. It was spec'd in the ledger
   * as `visit-has-no-walkby-step` three nights before it was built, down to the
   * two actions below.
   *
   * Four things in it are load-bearing.
   *
   * 1. **The instrument pushes the walk-by, and that is not the auto-fix hat.**
   *    `useOfficeAmbience`'s `shouldHoldFire()` returns on `floorActive`, so
   *    the ambient director is **off for the entire length of a floor visit by
   *    design** (the ledger's `ambient-director-is-off-during-a-visit`). A
   *    visit that waited for a walk-by would wait for ever. So the harness
   *    stands in for the director the same way it stands in for a mouse — a
   *    *step* drives the room, which is what the other eight do. The rule the
   *    `afterwards` block states still holds unchanged and is about the other
   *    half: an **observation** may only read, because a report that mutates
   *    cannot be trusted about what it reports.
   * 2. **The ✕ is pressed in the DOM, never through the store.** The whole
   *    subject is the wire from the bubble's dismiss button to
   *    `dismissOfficeWalkByWithMemory`, and `dismissOfficeWalkBy` — the bare
   *    store mutator the 24 s TTL calls — deliberately writes nothing. A step
   *    that called the store would report the beat as missing on a night the
   *    product was fine, and as present on a night the button had come
   *    unwired.
   * 3. **The arrival line is given a tick to be harvested before the bubble is
   *    closed.** The walk-by's body is the only `walkby`-channel line any visit
   *    has ever produced, and the harvest runs on a 200 ms interval plus a
   *    mutation observer; dismissing in the same tick as the push would remove
   *    the surface that is the step's own evidence.
   * 4. **It is last, and it has to be.** A walk-by writes a `walkby` entry into
   *    the office log and a beat into working memory, both of which feed the
   *    prompts every earlier step reads from. Put it anywhere but the end and
   *    it would change the inputs of eight steps whose baselines go back nine
   *    weeks. `speech.throughStep7` is cut at the eighth step's mark and so is
   *    unaffected either way — that is the field to read across versions.
   */
  await step(steps, 'refuse-a-walk-by', async () => {
    const pushed = await page.evaluate(
      (fixture) =>
        import('/src/state/officeMomentStore.js').then((store) => store.pushOfficeWalkBy(fixture)),
      WALKBY_FIXTURE
    );
    if (!pushed) throw new Error('the store took no walk-by');
    /* Trap 3: the walker is a zero-size anchor, so `attached` rather than the
       default `visible` — and the dismiss button is the thing under test, so it
       is what the wait is on. A bubble that drew without its chrome is a
       different failure from a bubble that never drew. */
    const bubble = await page
      .waitForSelector('[data-testid="office-floor-walker"] .office-floor-bubble-dismiss', {
        state: 'attached',
        timeout: STEP_TIMEOUT_MS
      })
      .catch(() => null);
    if (!bubble) throw new Error(`${WALKBY_FIXTURE.colleagueId} never arrived with the bubble`);
    await page.waitForTimeout(1_200);
    const offered = await page.evaluate(() =>
      Boolean(
        document.querySelector('[data-testid="office-floor-walker"] .office-floor-bubble-action')
      )
    );
    /* Dispatched in page context for step 8's reason: a real click has to
       hit-test a bubble that is inverse-scaled inside a 0×0 anchor, and a miss
       there reads exactly like the button not being wired. */
    const pressed = await page.evaluate(() => {
      const button = document.querySelector(
        '[data-testid="office-floor-walker"] .office-floor-bubble-dismiss'
      );
      button?.click();
      return Boolean(button);
    });
    if (!pressed) throw new Error('the ✕ went missing between the wait and the press');
    /*
     * **Wait for them to actually leave, and the reason is `roomDelta`.** A
     * dismissed walk-by does not vanish: `useFloorWalker` keeps a departing
     * copy mounted until the walk home finishes, which is presentation state
     * the floor owns (ADR-0011) and takes longer than the press. Ending the
     * visit mid-departure leaves `office-floor-walker` in the end-of-visit room
     * shot *sometimes*, which is a one-time baseline change that also flaps —
     * the worst kind, because the next reader cannot tell noise from a slice.
     * Waiting for the detach makes the room's end state the same room nine
     * weeks of traces end in, and the flag below is what says so out loud
     * rather than leaving it to be inferred from an absent surface.
     */
    const departed = await page
      .waitForSelector('[data-testid="office-floor-walker"]', {
        state: 'detached',
        timeout: STEP_TIMEOUT_MS
      })
      .then(() => true)
      .catch(() => false);
    const cleared = await page.evaluate(() =>
      import('/src/state/officeMomentStore.js').then((store) =>
        Boolean(store.getOfficeSnapshot().walkBy)
      )
    );
    return (
      `${WALKBY_FIXTURE.colleagueId} came over with ` +
      `${offered ? 'a Do it button' : 'no action'}; pressed ✕; ` +
      `${cleared ? 'still in the store' : 'store cleared'}; ` +
      `${departed ? 'walked back to their desk' : 'still on the floor at the end'}`
    );
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
  const read = await page.evaluate(() => window.__visit.readPropCardNow());
  if (read) {
    await page.evaluate(
      ({ propLabel, read: snapshot }) =>
        window.__visit.recordRead({ kind: 'prop', propLabel, ...snapshot }),
      { propLabel: found, read }
    );
  }
  const preview = read?.blurb ? read.blurb.replace(/\s+/g, ' ').slice(0, 96) : 'no card text';
  return `${found}; card: ${preview}`;
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
      const api = launch(process.execPath, ['dist/index.js'], {
        cwd: path.join(REPO_ROOT, 'apps/server'),
        env: { PORT: String(args.apiPort), NODE_ENV: 'development' }
      });
      running.push(api);
      const apiUp = await waitForHttp(`http://127.0.0.1:${args.apiPort}/api/health`, 40_000);
      /*
       * **Fatal, the way vite's is, and it was not for ten nights.** The
       * boolean used to be discarded here, so a checkout that had not been
       * built produced a server that exited on `Cannot find module dist/index.js`,
       * vite proxied every office call to a 502, and the visit finished and
       * printed a trace reading `canned-fallback (502)` — with the key sitting
       * in the shell looking like the generated arm. A run that cannot reach
       * the office's own API has not produced a worse trace, it has produced no
       * trace: this is the ledger's own "a 503 and a regression are identical
       * from the outside" with the server on the wrong side of it.
       */
      if (!apiUp) {
        throw new Error(
          `the API server never answered /api/health on :${args.apiPort}. It is started from ` +
            'its build output, so an unbuilt checkout fails exactly here — run `npm run build` ' +
            '(or `npm run build -w apps/server`) and try again. Where its output starts:\n' +
            /* The *start*, not the tail: a process that dies on startup puts the
               reason on its first line and a node stack frame on its last. */
            api.log.join('').trim().split('\n').slice(0, 8).join('\n')
        );
      }
    }

    await writeScratchHarness();
    running.push(
      launch(
        process.execPath,
        [
          path.join(REPO_ROOT, 'node_modules/vite/bin/vite.js'),
          '--host',
          '127.0.0.1',
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

    /*
     * **The afterwards axis, which this trace could not see at all.** Queue
     * items 2, 4 and 7 change what the office *knows* about you rather than
     * what it draws, and every field above is a DOM reading — so the beat
     * `useFloorInterruptMemory` writes when you step into somebody's errand was
     * invisible at the next step and absent from `roomDelta`, and the
     * 2026-09-06 row could only report that the trace had not moved. It had
     * nowhere to move.
     *
     * Read at the end through the dev server's module graph, exactly as
     * `imHistoryAtEnd` is. This is an **observation added to the report**, not
     * an eighth step: the seven steps are fixed (§ 2), and a run that grew them
     * to make a number move would have measured nothing. It is also still only
     * a read — ADR-0010's line is about what the office *does*, and an
     * instrument that asked the store to change would be the auto-fix-on-idle
     * failure wearing a lab coat.
     */
    const afterwards = await page
      .evaluate(() =>
        Promise.all([
          import('/src/state/officeWorkingMemoryStore.js'),
          import('/src/state/officeLogStore.js')
        ]).then(([memory, log]) => ({
          workingMemory: memory.listWorkingMemoryColleagueIds().map((id) => {
            const row = memory.getWorkingMemoryWith(id);
            return {
              colleagueId: id,
              beats: (row?.beats ?? []).map((beat) => ({
                interrupted: beat.interrupted ?? null,
                /*
                 * Added 2026-11-07 with the step that produces it. The beat
                 * `useFloorPeekMemory` writes is a boolean and was absent from
                 * this projection, so even a visit that *had* peeked would have
                 * shown the fact only indirectly, as a sentence in
                 * `promptLines` — which is the next exchange's view of it, not
                 * the record. Both are reported; they can disagree, and a run
                 * that only had the sentence could not tell which half broke.
                 */
                peeked: beat.peeked ?? null,
                /*
                 * Added 2026-11-11 with the ninth step, for the reason
                 * `peeked` was added with the eighth: it is a boolean the
                 * record carries and the projection did not, so a visit that
                 * refused a walk-by would have shown the fact only as a
                 * sentence in `promptLines` — the *next* exchange's view of
                 * it. The ledger's `visit-trace-reads-promptlines-not-the-record`
                 * is the whole argument: a run that broke the writer but not
                 * the bank, or the bank but not the writer, looks identical
                 * from `promptLines` alone.
                 */
                pitchDeclined: beat.pitchDeclined ?? null,
                theirs: beat.theirs ? String(beat.theirs).slice(0, 160) : null,
                yours: beat.yours ? String(beat.yours).slice(0, 160) : null
              })),
              sawTheBoard: Boolean(row?.boardFingerprint),
              /* The one field here that is about the *next* exchange rather
                 than the last one: what the dwell and talk paths would speak
                 from. A beat nothing can say is a beat that changed nothing. */
              promptLines: memory.workingMemoryPromptLines(id)
            };
          }),
          logDigest: log.getOfficeLogDigest()
        }))
      )
      .catch((err) => ({ error: String(err?.message ?? err).split('\n')[0] }));

    /*
     * **What the peek produced, read as a fact rather than inferred from a
     * count.** The eighth step's whole purpose is a line addressed to you by
     * somebody whose screen you just read, and the open question the ledger
     * carries about it (`peek-line-is-still-recited`) is not *whether* a line
     * appeared but whether it was `deskWorkFor(id).line` — one fixed sentence
     * per colleague, every peek, every session. `speech.bySource` cannot
     * answer that: it attributes against what a 2xx office response delivered,
     * so a canned line and a line nobody asked for both read `bank`.
     *
     * So this reads the bank's own string beside the drawn one and leaves the
     * comparison to `buildTrace`. The colleague comes from the **store**, not
     * from the step's display name — the beat is the thing under test, and a
     * block that looked up the name the driver typed could report a bank line
     * for a colleague the room never wrote a beat about.
     */
    const peek = await page
      .evaluate(() =>
        import('/src/state/officeWorkingMemoryStore.js').then((memory) =>
          import('/src/utils/officeDeskWork.js').then((deskWork) => {
            const peeked = memory
              .listWorkingMemoryColleagueIds()
              .find((id) =>
                (memory.getWorkingMemoryWith(id)?.beats ?? []).some((beat) => beat.peeked === true)
              );
            /* The **body**, not the surface. The surface's own `textContent`
               welds the speaker's name and title onto the sentence ("Bertram
               Gilfoyle · Systems Architect, UnimpressedI already fixed it…"),
               which is the same shape the harvest's innermost-match filter
               exists to drop — and reporting it here would make `drawn` a
               string no bank holds. */
            const surface = document.querySelector('[data-testid="office-floor-peek-line"]');
            const node = surface?.querySelector('.office-floor-bubble-body') ?? surface;
            const work = peeked ? deskWork.deskWorkFor(peeked) : null;
            return {
              colleagueId: peeked ?? null,
              standingThere: Boolean(
                document.querySelector('[data-testid="office-floor-peek-card"]')
              ),
              drawn: node ? (node.textContent ?? '').trim().slice(0, 400) : null,
              bankLine: work?.line ?? null,
              doing: work?.doing ?? null,
              look: work?.look ?? null
            };
          })
        )
      )
      .catch((err) => ({ error: String(err?.message ?? err).split('\n')[0] }));

    /*
     * **What the refusal left behind, read as the record rather than as its
     * rendering.** The ninth step's subject is a wire with three links in it —
     * the bubble's ✕, `dismissOfficeWalkBy`'s return value, and
     * `officeWalkByMemory.js`'s writer — and a `walkby` line in `speech` only
     * proves the first colleague arrived. So this reads the beat, the sentence
     * the beat will speak as, and the **twin**: `pitchTaken` is what the other
     * button on the same bubble writes, and a run where ✕ started writing
     * *that* instead would otherwise read as a working refusal.
     *
     * `onScreen` is the state after the press and is expected `false`; it is
     * reported rather than asserted because a walk-by still on screen with a
     * beat written is a different defect from one cleared with no beat, and the
     * step's own note cannot say which happened at the end of the visit.
     */
    const walkby = await page
      .evaluate(
        (fixture) =>
          Promise.all([
            import('/src/state/officeWorkingMemoryStore.js'),
            import('/src/state/officeMomentStore.js')
          ]).then(([memory, store]) => {
            const beats = memory.getWorkingMemoryWith(fixture.colleagueId)?.beats ?? [];
            return {
              colleagueId: fixture.colleagueId,
              offeredAPrompt: Boolean(fixture.actionPrompt),
              declined: beats.filter((beat) => beat.pitchDeclined === true).length,
              taken: beats.filter((beat) => beat.pitchTaken === true).length,
              promptLines: memory.workingMemoryPromptLines(fixture.colleagueId),
              onScreen: Boolean(store.getOfficeSnapshot().walkBy)
            };
          }),
        WALKBY_FIXTURE
      )
      .catch((err) => ({ error: String(err?.message ?? err).split('\n')[0] }));

    const collected = await page.evaluate(() => ({
      speech: window.__visit.state.speech,
      eighthStepAtMs: window.__visit.state.eighthStepAtMs ?? null,
      read: window.__visit.state.read,
      fetches: window.__visit.state.fetches,
      notes: window.__visit.state.notes,
      delivered: window.__visit.state.delivered,
      errors: window.__visit.state.errors,
      figures: window.__visit.figures(),
      wanderers: window.__visit.wanderers(),
      endSurfaces: window.__visit.speechSurfacesNow()
    }));

    const trace = buildTrace({
      args,
      startedAt,
      t0,
      steps,
      before,
      after,
      collected: { ...collected, imHistoryAtEnd, afterwards, peek, walkby }
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
   * Derived, and no longer from a clock. **The rule this replaces credited a
   * line to the model when a successful office call resolved in the 8 s before
   * it appeared**, and its own comment asked a later run to check it. On
   * 2026-09-16 that came due: the dwell became a model call (#704), so for the
   * first time a generated visit made a call that was *not* the last thing to
   * happen, the window swept up the three narration lines behind it, and the
   * trace reported five model lines for two model turns. Every earlier
   * generated run had made its single call at the final step, where there was
   * nothing behind it to over-credit — the rule was never right, it was
   * untested.
   *
   * So a line is the model's when its text **is** text the model delivered.
   * Comparison is on a loose form (whitespace collapsed, lower-cased, a
   * trailing ellipsis dropped) because a surface may truncate; containment
   * either way is allowed once both sides are long enough that a coincidence
   * is not plausible, which is what `MIN_LOOSE_MATCH` is for.
   *
   * `delivered` ships raw beside this, the same way the call log shipped beside
   * the window, so a later run can disagree without re-running the visit — and
   * `modelTurns` remains the count to trust, because a line the room drew and
   * undrew (voice leads, text is the fallback) never reaches `speech` at all.
   */
  const MIN_LOOSE_MATCH = 12;
  const loose = (value) =>
    String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[…]+$|\.{3,}$/u, '')
      .trim()
      .toLowerCase();
  const deliveredTexts = (collected.delivered ?? [])
    .flatMap((entry) => entry.texts.map(loose))
    .filter(Boolean);
  const attribute = (line) => {
    const text = loose(line.text);
    if (!text) return 'bank';
    return deliveredTexts.some(
      (delivered) =>
        delivered === text ||
        (Math.min(delivered.length, text.length) >= MIN_LOOSE_MATCH &&
          (delivered.includes(text) || text.includes(delivered)))
    )
      ? 'model'
      : 'bank';
  };

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

  /*
   * **The eight nights of baselines the eighth step would otherwise have
   * thrown away.** Totals above now sum over a longer visit, so a version-5
   * `speech.count` and a version-4 one are two different measurements with one
   * name. This is the same three numbers cut at the mark the eighth step took
   * on its way in, which makes it the version-4 figure and directly comparable
   * with every generated run from 2026-10-30 onward. `null` when the eighth
   * step never opened — in which case the totals above already *are* the
   * seven-step ones and inventing a second copy of them would be the more
   * confusing answer.
   */
  const cutAt = collected.eighthStepAtMs;
  let throughStep7 = null;
  if (typeof cutAt === 'number') {
    const earlier = speech.filter((line) => line.atMs < cutAt);
    const channels = {};
    const sources = { model: 0, bank: 0 };
    for (const line of earlier) {
      channels[line.channel] = (channels[line.channel] ?? 0) + 1;
      sources[line.source] += 1;
    }
    throughStep7 = { atMs: cutAt, count: earlier.length, byChannel: channels, bySource: sources };
  }

  /*
   * Derived here rather than in the page, so the raw strings ship beside the
   * verdict and a later run can disagree without re-running the visit. The
   * comparison is the same loose form `attribute` uses — a surface may collapse
   * whitespace — because the question is "is this the sentence the bank holds",
   * not "are these two strings byte-equal".
   */
  const peek = collected.peek?.error
    ? collected.peek
    : {
        ...(collected.peek ?? {}),
        beatWritten: Boolean(collected.peek?.colleagueId),
        isTheBankLine:
          collected.peek?.drawn && collected.peek?.bankLine
            ? loose(collected.peek.drawn).includes(loose(collected.peek.bankLine))
            : null,
        source: collected.peek?.drawn ? attribute({ text: collected.peek.drawn }) : null,
        rule:
          'derived: `isTheBankLine` compares the drawn line with `deskWorkFor(id).line`; ' +
          '`source` is the same attribution `speech.bySource` uses, and the two answer ' +
          'different questions — a canned line and an unasked-for one both read `bank`'
      };

  const figures = collected.figures
    .map((figure) => ({
      id: figure.id,
      moves: figure.moves,
      firstMoveAtMs: figure.firstMoveAtMs,
      longestStillMs: figure.stillMs
    }))
    .sort((a, b) => (a.firstMoveAtMs ?? Infinity) - (b.firstMoveAtMs ?? Infinity));

  /* Oldest errand first, so a reading is in the order the room produced it. */
  const wanderers = (collected.wanderers ?? [])
    .slice()
    .sort((a, b) => a.firstSeenAtMs - b.firstSeenAtMs);

  return {
    harness: 'officeVisitTrace',
    /*
     * 2: `speech.bySource` is attributed by text against `speech.delivered`.
     * 3: `read.cards` records prop-card blurbs the visit opened (not speech).
     * 4: `movement.wanderers` names the prop each ambient errand was for.
     * 5: an **eighth step** reads a colleague's screen, so `speech` totals are
     * summed over a longer visit than versions ≤4 and are not comparable with
     * them — read `speech.throughStep7` against those, and see the header for
     * why the step was appended and what else moved once (`roomDelta.cards`).
     * The report gained `peek`, `afterwards…beats[].peeked`, and a `peek`
     * channel that can now actually fire.
     * 6: a **ninth step** receives a walk-by carrying a Do it button and
     * presses ✕, so `speech` totals sum over a visit one step longer again and
     * `speech.throughStep7` is still the field to read against every version
     * from 4 onward. The report gained `walkby` and
     * `afterwards…beats[].pitchDeclined`, and the `walkby` channel — mapped
     * since version 1 and never once fired — finally has a step that provokes
     * it.
     * Version 1 attributed `bySource` by an 8 s clock window, which over-credits any
     * bank line drawn behind a mid-visit model call — so a v1 `bySource.model`
     * from a run whose call was not the last thing to happen has to be re-read
     * against `modelTurns`, and this field is how a reader can tell which.
     */
    version: 6,
    startedAt,
    durationMs: Date.now() - t0,
    mode: {
      llmConfigured,
      /*
       * The two fields that stop `llmConfigured: false` being read as a fact
       * about the server, which is how the 2026-09-06 row read it and how the
       * `visit-llm-not-configured` todo was written. `false` has two causes and
       * they mean opposite things: **nothing asked** (`askedTheModel: 0` — the
       * office never reached for a model, so the backend was never consulted
       * and the run says nothing about whether one is configured) versus
       * **something asked and was refused** (`askedTheModel` > 0 with
       * `answeredByModel: 0` — a 503, which is the canned-fallback trap § 2 is
       * about). `verdict` already spelled the difference out in prose; nobody
       * reads a sentence when there is a boolean beside it.
       */
      askedTheModel: llmCalls.length,
      answeredByModel: succeeded.length,
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
      throughStep7,
      modelTurns,
      delivered: collected.delivered ?? [],
      endSurfaces: collected.endSurfaces,
      imHistoryAtEnd: collected.imHistoryAtEnd,
      sourceRule:
        'derived: a line whose text matches text a 2xx /api/office response delivered is the ' +
        "model's; `delivered` is the raw evidence and `modelTurns` is the count to trust"
    },
    peek,
    walkby: collected.walkby?.error
      ? collected.walkby
      : {
          ...(collected.walkby ?? {}),
          /* Derived here rather than in the page, the way `peek` is, so the
             raw counts ship beside the verdict and a later run can disagree
             with the reading without re-running the visit. */
          beatWritten: (collected.walkby?.declined ?? 0) > 0,
          wroteTheTwinInstead: (collected.walkby?.taken ?? 0) > 0,
          rule:
            'observed: ✕ pressed in the DOM on a walk-by carrying an `actionPrompt`; ' +
            '`beatWritten` is the refusal `officeWalkByMemory.js` writes, and ' +
            '`wroteTheTwinInstead` catches the Do it path firing from the dismiss button'
        },
    read: {
      cards: collected.read ?? [],
      rule:
        'prop cards are read surfaces: blurbs live on `.office-floor-card-blurb` and are ' +
        'never harvested into `speech`'
    },
    movement: {
      firstMover: figures.find((figure) => figure.firstMoveAtMs !== null)?.id ?? null,
      figures,
      /*
       * Ambient traffic, per errand. `figures` already reports *that* a
       * wanderer moved — it has sampled `[data-testid="office-floor-wanderer"]`
       * since version 1 — but it keys them all as one unnamed row, and nothing
       * anywhere named the prop a trip was for. That mattered on 2026-10-29,
       * when a slice made a wanderer's destination depend on what the player had
       * just done and the trace had no field to show it: the measurement had to
       * be a separate browser probe inferring the prop from nearest-rect
       * geometry. Read `props` against `read.cards` and the office log in
       * `afterwards.logDigest` — the two props the visit uses are what a
       * news-weighted trip would be reacting to.
       */
      wanderers,
      props: [...new Set(wanderers.map((trip) => trip.prop).filter(Boolean))].sort(),
      wandererRule:
        'observed: one row per errand (seat + prop, off `data-wander-prop`); `settledAtMs` is ' +
        'null when they never stood at the thing, which is what an interrupted trip looks like'
    },
    roomDelta: diffRoom(before, after),
    afterwards: collected.afterwards,
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
