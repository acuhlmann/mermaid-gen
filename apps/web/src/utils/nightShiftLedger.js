/**
 * The Night Shift — what the scheduled fleet did while nobody was in the
 * office, read from the ledgers it already keeps.
 *
 * Every NFR routine (`docs/routines/ledger/*.md`) and feature automation
 * (`docs/automations/ledger/*.md`) appends one row per firing to a markdown
 * table, "including runs that changed nothing" (`docs/routines/README.md`).
 * Those tables are the fleet's durable memory, so they are also the only
 * honest source for a standup about it: nothing here asks GitHub, a model or
 * the server. The Vite config calls `buildNightShiftManifest` at build time
 * and bakes the result into the bundle (`nightShiftManifest.js`), and because
 * every merge to `main` deploys, the board is as fresh as the last ledger row
 * that landed.
 *
 * **Pure and Node-safe.** This file is imported by `vite.config.js` as well as
 * the browser, so it must not import anything that touches the DOM.
 *
 * **It reads, it never writes** (ADR-0010 consequence #4, "record, never
 * trigger"). The board reports what the fleet did; nothing on it can start,
 * retry or schedule a run.
 */

/**
 * Who works nights, in night-ladder order (`docs/routines/review.md`), with
 * `deps` last because it runs off the ladder. `summaryColumn` is the header of
 * the run-log column that best says what the firing did; each ledger names it
 * differently because each table grew on its own.
 *
 * Left out on purpose: `digest` is the `report` tier and may not commit, so it
 * has no run log to read, and `god` logs code changes made *to* God rather than
 * runs *by* it (the Altar already gives God a floor presence).
 *
 * @type {ReadonlyArray<{ id: string, ledger: string, summaryColumn: string, parked?: boolean }>}
 */
export const NIGHT_SHIFT_CREW = Object.freeze([
  { id: 'metaphor3d', ledger: 'docs/automations/ledger/metaphor3d.md', summaryColumn: 'Slice' },
  { id: 'prune', ledger: 'docs/routines/ledger/prune.md', summaryColumn: 'Class' },
  { id: 'office-life', ledger: 'docs/automations/ledger/office-life.md', summaryColumn: 'Slice' },
  { id: 'anything', ledger: 'docs/automations/ledger/anything.md', summaryColumn: 'Slice taken' },
  {
    id: 'canvas-graph-edit',
    ledger: 'docs/automations/ledger/canvas-graph-edit.md',
    summaryColumn: 'Slice',
    // CLAUDE.md § Scheduled feature automations marks it parked.
    parked: true
  },
  { id: 'review', ledger: 'docs/routines/ledger/review.md', summaryColumn: 'Issues filed' },
  { id: 'improve', ledger: 'docs/routines/ledger/improve.md', summaryColumn: 'Slice taken' },
  { id: 'resolve', ledger: 'docs/routines/ledger/resolve.md', summaryColumn: 'Issue picked' },
  { id: 'deps', ledger: 'docs/routines/ledger/deps.md', summaryColumn: 'Queue' }
]);

/** Longest summary a card carries; the ledger cell itself can run to pages. */
export const NIGHT_SHIFT_SUMMARY_MAX = 160;

/** How many earlier entries each crew member keeps, for the "earlier" line. */
export const NIGHT_SHIFT_RECENT_MAX = 5;

const REPO_PULL_URL = 'https://github.com/acuhlmann/mermaid-gen/pull/';

const DATE_CELL = /^(\d{4}-\d{2}-\d{2})/;

/**
 * Split one markdown table row into trimmed cells, honouring `\|` escapes.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function splitTableRow(line) {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells = [];
  let current = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '\\' && body[i + 1] === '|') {
      current += '|';
      i += 1;
    } else if (ch === '|') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Inline markdown down to plain words: links keep their text, emphasis and
 * code fences lose their markers.
 *
 * @param {string} text
 * @returns {string}
 */
export function plainText(text) {
  return String(text ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The first sentence of a cell, cut at a word boundary if it is still long.
 *
 * @param {string} text
 * @param {number} [max]
 * @returns {string}
 */
export function summarize(text, max = NIGHT_SHIFT_SUMMARY_MAX) {
  const plain = plainText(text);
  const sentence = plain.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? plain;
  if (sentence.length <= max) return sentence;
  const cut = sentence.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:—-]+$/, '')}…`;
}

/**
 * PR numbers a cell names, in order, deduplicated. Accepts both `#123` and
 * `[#123](…/pull/123)`.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function prNumbersIn(text) {
  const seen = new Set();
  for (const match of String(text ?? '').matchAll(/#(\d{2,6})\b/g)) {
    seen.add(Number(match[1]));
  }
  return [...seen];
}

/**
 * Words in a summary that mean "the run took nothing", which no PR link
 * overrides — a ledger-only PR is the row being filed, not work shipped.
 */
const QUIET_SUMMARY = /^(?:(?:none|no slice|n\/a|quiet|nothing)\b|[—–-](?:\s|$))/i;

/** @param {string} line */
function isTableRow(line) {
  return line.trim().startsWith('|');
}

/** @param {string[]} cells */
function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

/**
 * @typedef {{
 *   date: string,
 *   summary: string,
 *   prs: number[],
 *   shipped: boolean
 * }} NightShiftEntry
 */

/**
 * Every run-log row in one ledger.
 *
 * Each ledger keeps two kinds of dated table: a two-column `Date | Decision`
 * table that records policy, and a run log with three or more columns. That
 * width is the whole discriminator, and deliberately so — the ledgers are
 * hand-appended by cold-start agents and drift in every structural way a
 * markdown parser could lean on: blank lines between rows, a run log split by
 * a `### trace` section with its own JSON and its own unrelated table, a
 * separator row repeated mid-table, a header with no separator at all. A
 * parser that tracked "the current table" read office-life's first five nights
 * and stopped, and read resolve as empty. Width survives all of it (measured
 * across all nine ledgers on 2026-11-25: every decision row has 2 cells, every
 * run row has 4 or more).
 *
 * Column positions come from the run log's own header — the first `Date` row
 * three or more cells wide. A row with an unescaped `|` inside a code span has
 * extra cells, which can only push later columns right; the summary is read
 * from an early column, so the cost is at worst a missed PR link.
 *
 * @param {string} markdown
 * @param {{ summaryColumn: string }} crew
 * @returns {NightShiftEntry[]} newest first
 */
export function parseLedgerRuns(markdown, crew) {
  const rows = String(markdown ?? '')
    .split(/\r?\n/)
    .filter(isTableRow)
    .map(splitTableRow)
    .filter((cells) => cells.length >= 3 && !isSeparatorRow(cells));

  const header = rows.find(
    (cells) => /^date/i.test(plainText(cells[0] ?? '')) && !/^decision/i.test(cells[1] ?? '')
  );
  if (!header) return [];

  /** @type {NightShiftEntry[]} */
  const entries = [];
  for (const cells of rows) {
    const date = (cells[0] ?? '').match(DATE_CELL)?.[1];
    if (!date) continue;

    const summaryIndex = Math.max(
      1,
      header.findIndex((name) => plainText(name).toLowerCase() === crew.summaryColumn.toLowerCase())
    );
    const prIndex = header.findIndex((name) => /^pr$/i.test(plainText(name)));
    const summary = summarize(cells[summaryIndex] ?? '');
    const prs = prNumbersIn(prIndex >= 0 ? (cells[prIndex] ?? '') : '');
    entries.push({
      date,
      summary,
      prs,
      shipped: prs.length > 0 && !QUIET_SUMMARY.test(summary)
    });
  }

  // Ledgers disagree on direction (most append, one prepends), so sort here.
  // A stable sort keeps two same-day rows in the order the ledger wrote them.
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}

/**
 * @typedef {{
 *   id: string,
 *   parked: boolean,
 *   lastSeen: string | null,
 *   tonight: NightShiftEntry[],
 *   earlier: NightShiftEntry[]
 * }} NightShiftCrewRecord
 *
 * @typedef {{
 *   shiftDate: string | null,
 *   crew: NightShiftCrewRecord[]
 * }} NightShiftManifest
 */

/**
 * The whole board, from every ledger's text. A missing ledger is a crew member
 * with no record, not an error — the board must still render on a checkout
 * that has no `docs/`.
 *
 * "The shift" is the newest date any run log carries. Everyone whose newest row
 * is older than that did not clock in, which is the same question `digest`'s
 * first watchdog asks ("a job that did not run").
 *
 * @param {Record<string, string | null | undefined>} ledgersById markdown by crew id
 * @returns {NightShiftManifest}
 */
export function buildNightShiftManifest(ledgersById) {
  const parsed = NIGHT_SHIFT_CREW.map((crew) => ({
    crew,
    runs: parseLedgerRuns(ledgersById?.[crew.id] ?? '', crew)
  }));

  const shiftDate =
    parsed
      .flatMap(({ runs }) => (runs[0] ? [runs[0].date] : []))
      .sort()
      .at(-1) ?? null;

  return {
    shiftDate,
    crew: parsed.map(({ crew, runs }) => {
      const tonight = shiftDate ? runs.filter((run) => run.date === shiftDate) : [];
      return {
        id: crew.id,
        parked: Boolean(crew.parked),
        lastSeen: runs[0]?.date ?? null,
        tonight,
        earlier: runs.filter((run) => run.date !== shiftDate).slice(0, NIGHT_SHIFT_RECENT_MAX)
      };
    })
  };
}

/**
 * GitHub link for a PR number this repo's ledgers cite.
 *
 * @param {number} pr
 * @returns {string}
 */
export function nightShiftPrUrl(pr) {
  return `${REPO_PULL_URL}${pr}`;
}
