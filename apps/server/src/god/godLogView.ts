/**
 * The owner's read-only view of ArchiSlop God's own run history (ADR-0019 §10, stage 2c).
 *
 * God records every tick on the `god-log` branch. Until now the only way to read that back was a CI
 * log and a 30-day artifact — so an idle rung (52 ticks, every one a skip) had no way to answer the
 * one question the owner has: *why did it do nothing, and how close was it to doing something?*
 *
 * This module reads the month rollup over `raw.githubusercontent.com`. That needs no credential
 * because the repo is public — the same reason ADR-0019 insists every field God writes is
 * content-free. It is deliberately **read-only**: the settings half of the window writes GitHub
 * Actions variables and needs its own narrow token, which does not exist yet.
 *
 * It also deliberately does **not** call `decideGodRun`. The gate's config lives in Actions
 * variables, which this process cannot read; recomputing the decision from its own environment
 * would print a confident answer about a configuration it cannot see. The tick's recorded reason is
 * what the real gate decided under the real config, so that is what gets shown.
 */
import {
  GOD_ACT_VERDICTS,
  GodMonthRollupSchema,
  GodMonthTotalsSchema,
  GodRollupRowSchema,
  type GodMonthTotals,
  type GodNarration,
  type GodRollupRow
} from '@archislop/shared';

type Env = Record<string, string | undefined>;

export const GOD_LOG_DEFAULT_REPO = 'acuhlmann/mermaid-gen';
export const GOD_LOG_DEFAULT_BRANCH = 'god-log';
const DEFAULT_TTL_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;
/** Current month plus the one before: a tick just after midnight on the 1st still owes an answer. */
const MONTHS_TO_READ = 2;
/** Rows handed to the window newest-first. The month file is the full history; this is the tail. */
const RECENT_CAP = 48;
const REPO_SLUG_RE = /^[\w.-]{1,80}\/[\w.-]{1,80}$/;
const BRANCH_RE = /^[\w./-]{1,120}$/;

/** Verdicts that mean the harness actually started. Shared with `scripts/god/godLog.mjs`. */
const ACT_VERDICTS = new Set<string>(GOD_ACT_VERDICTS);

export type GodStatusIssue =
  | 'source_invalid'
  | 'fetch_failed'
  | 'rollup_unreadable'
  | 'rollup_rows_dropped'
  | 'rollup_totals_missing';

export type GodStatusView = {
  v: 1;
  generatedAt: string;
  /** `live` read this call or is within TTL; `stale` is cached after a failed refresh; `none` is nothing readable. */
  source: 'live' | 'stale' | 'none';
  repo: string | null;
  branch: string | null;
  months: string[];
  ticks: number;
  /** Ticks that reached the harness. Same source as `ticks`, so the two are comparable. */
  acts: number;
  /** Sum of `usd` over the newest month only — the number `GOD_MAX_USD_PER_MONTH` is measured against. */
  monthSpendUsd: number;
  /**
   * Where the three numbers above came from. `records` is the truth, stamped at fold time from
   * `runs/*.json`; `rollupRows` counts only the rows that survived in this file, which a truncated
   * rollup understates — so the view must never pass those off as the month.
   */
  numbersFrom: 'records' | 'rollupRows';
  /**
   * Acts that billed, completed, named nothing and changed nothing. `null` when the month was never
   * judged — a stamp written before this field, or no stamp at all. Never a silent `0`: "we did not
   * measure" and "we measured nothing wasted" are different answers about money.
   */
  unproductiveActs: number | null;
  unproductiveUsd: number | null;
  /** What the newest act's final text did with the observe contract; `null` for a pre-`narration` record. */
  lastActNarration: GodNarration | null;
  lastTick: GodRollupRow | null;
  /** Newest tick that reached the harness, or null if God has never acted. */
  lastActAt: string | null;
  /** Skip reasons newest-month-first, so "it has been idle for a month" names the cause. */
  reasonTally: { reason: string; count: number }[];
  recent: GodRollupRow[];
  issues: GodStatusIssue[];
};

export type GodLogSource = { repo: string; branch: string };

/**
 * Resolve where to read the branch from. Both settings have defaults so nothing new has to be
 * configured; an explicitly set but malformed value is refused rather than interpolated into a URL.
 */
export function resolveGodLogSource(env: Env = process.env): GodLogSource | null {
  const repo = (env.GOD_LOG_REPO ?? GOD_LOG_DEFAULT_REPO).trim();
  const branch = (env.GOD_LOG_BRANCH ?? GOD_LOG_DEFAULT_BRANCH).trim();
  if (!REPO_SLUG_RE.test(repo) || !BRANCH_RE.test(branch)) return null;
  return { repo, branch };
}

/** `YYYY-MM` UTC labels, newest first, `count` long. */
export function recentMonthLabels(
  nowMs: number = Date.now(),
  count: number = MONTHS_TO_READ
): string[] {
  const labels: string[] = [];
  const cursor = new Date(nowMs);
  cursor.setUTCDate(1);
  for (let i = 0; i < count; i += 1) {
    labels.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return labels;
}

export function godRollupUrl(source: GodLogSource, month: string): string {
  return `https://raw.githubusercontent.com/${source.repo}/${source.branch}/index/${month}.json`;
}

type MonthRead = {
  month: string;
  rows: GodRollupRow[];
  /** True month numbers stamped by the fold, or null on a month file written before it landed. */
  totals: GodMonthTotals | null;
  missing: boolean;
  issues: GodStatusIssue[];
};

function readTotals(body: unknown): GodMonthTotals | null {
  const parsed = GodMonthTotalsSchema.safeParse((body as { totals?: unknown })?.totals);
  return parsed.success ? parsed.data : null;
}

/**
 * A missing month file is a fact, not a failure: the branch has no ticks for that month yet.
 * Anything else that will not validate is reported rather than quietly rendered as a short month.
 */
function parseMonth(month: string, body: unknown): MonthRead {
  const strict = GodMonthRollupSchema.safeParse(body);
  if (strict.success)
    return {
      month,
      rows: strict.data.runs,
      totals: strict.data.totals ?? null,
      missing: false,
      issues: []
    };

  const rawRuns = (body as { runs?: unknown })?.runs;
  const totals = readTotals(body);
  if (!Array.isArray(rawRuns))
    return { month, rows: [], totals, missing: false, issues: ['rollup_unreadable'] };
  const rows: GodRollupRow[] = [];
  for (const candidate of rawRuns) {
    const parsed = GodRollupRowSchema.safeParse(candidate);
    if (parsed.success) rows.push(parsed.data);
  }
  return {
    month,
    rows,
    totals,
    missing: false,
    issues: rows.length === rawRuns.length ? ['rollup_unreadable'] : ['rollup_rows_dropped']
  };
}

async function readMonth(
  source: GodLogSource,
  month: string,
  fetchImpl: typeof fetch
): Promise<MonthRead> {
  const response = await fetchImpl(godRollupUrl(source, month), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (response.status === 404) return { month, rows: [], totals: null, missing: true, issues: [] };
  if (!response.ok) throw new Error(`god-log rollup ${response.status}`);
  return parseMonth(month, await response.json());
}

/** Rows newest-first across months, so one list answers both "last tick" and "this month". */
export function summarizeGodLog(input: {
  generatedAt: string;
  source: GodStatusView['source'];
  repo: string | null;
  branch: string | null;
  months: string[];
  reads: MonthRead[];
}): GodStatusView {
  const rows: GodRollupRow[] = [];
  const issues = new Set<GodStatusIssue>();
  for (const read of input.reads) {
    rows.push(...read.rows);
    for (const issue of read.issues) issues.add(issue);
  }
  rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const newestMonth = input.months[0] ?? '';
  const monthRows = rows.filter((row) => row.endedAt.slice(0, 7) === newestMonth);
  const lastAct = rows.find((row) => ACT_VERDICTS.has(row.verdict)) ?? null;

  // The fold's stamp beats counting rows whenever it is there. October 2026 is the proof: one
  // surviving row made this view report `ticks: 1, monthSpendUsd: 0` over a month of 54 ticks that
  // really billed $0.018813. A rollup is a list; the records are the ledger.
  const totals = input.reads.find((read) => read.month === newestMonth)?.totals ?? null;
  if (!totals && monthRows.length > 0) issues.add('rollup_totals_missing');
  const stampedActs = input.reads
    .map((read) => read.totals?.lastActAt ?? null)
    .filter((value): value is string => value !== null)
    .sort((a, b) => b.localeCompare(a));

  const tally = new Map<string, number>();
  for (const row of monthRows) {
    const reason = row.gateReason ?? 'unlabelled';
    tally.set(reason, (tally.get(reason) ?? 0) + 1);
  }

  return {
    v: 1,
    generatedAt: input.generatedAt,
    source: input.source,
    repo: input.repo,
    branch: input.branch,
    months: input.months,
    ticks: totals?.ticks ?? monthRows.length,
    acts: totals?.acts ?? rows.filter((row) => ACT_VERDICTS.has(row.verdict)).length,
    monthSpendUsd:
      totals?.monthSpendUsd ?? round6(monthRows.reduce((sum, row) => sum + row.usd, 0)),
    numbersFrom: totals ? 'records' : 'rollupRows',
    // Rows carry no filesChanged or branch, so only the fold's stamp can tell a silent run from a
    // propose run that patched. Absence stays null rather than becoming a reassuring zero.
    unproductiveActs: totals?.unproductiveActs ?? null,
    unproductiveUsd: totals?.unproductiveUsd ?? null,
    lastActNarration: lastAct?.narration ?? null,
    lastTick: rows[0] ?? null,
    lastActAt: stampedActs[0] ?? (lastAct ? lastAct.startedAt : null),
    reasonTally: [...tally.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    recent: rows.slice(0, RECENT_CAP),
    issues: [...issues]
  };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

let cache: { view: GodStatusView; atMs: number } | null = null;
let inflight: Promise<GodStatusView> | null = null;
/**
 * How long a total failure is remembered without retrying. `live` and `stale` are both bounded by
 * `ttlMs`; a `none` view is not cached at all (there is nothing worth serving again), so this is the
 * only thing standing between an owner refreshing an error page and a burst of requests to GitHub.
 */
const FAILURE_BACKOFF_MS = 30_000;
let failedAtMs: number | null = null;
let lastFailure: GodStatusView | null = null;

/** Test seam: `fetchImpl` and `nowMs` are injected so the route never needs network or a clock. */
export type GodStatusOptions = {
  env?: Env;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  ttlMs?: number;
};

export async function getGodStatusView(options: GodStatusOptions = {}): Promise<GodStatusView> {
  const env = options.env ?? process.env;
  const nowMs = options.nowMs ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (cache && nowMs() - cache.atMs < ttlMs) return cache.view;
  // After a total failure, retry no sooner than the backoff — whatever the owner's refresh rate.
  if (lastFailure && failedAtMs != null && nowMs() - failedAtMs < FAILURE_BACKOFF_MS)
    return lastFailure;
  if (inflight) return inflight;

  inflight = (async () => {
    const generatedAt = new Date(nowMs()).toISOString();
    const source = resolveGodLogSource(env);
    if (!source) {
      // A malformed slug is never fetched: unvalidated config must not reach a URL.
      return fail(
        emptyView({ generatedAt, source: 'none', repo: null, branch: null }, ['source_invalid']),
        nowMs()
      );
    }
    const months = recentMonthLabels(nowMs());
    try {
      const reads = await Promise.all(months.map((month) => readMonth(source, month, fetchImpl)));
      return remember(
        summarizeGodLog({
          generatedAt,
          source: 'live',
          repo: source.repo,
          branch: source.branch,
          months,
          reads
        }),
        nowMs()
      );
    } catch {
      // A GitHub hiccup must not blank the owner's page: keep the last good numbers, say they are old.
      if (cache) {
        const stale: GodStatusView = {
          ...cache.view,
          generatedAt,
          source: 'stale',
          issues: withIssue(cache.view.issues, 'fetch_failed')
        };
        // Re-armed at the current clock so a broken network costs one retry per TTL, not per request.
        cache = { view: stale, atMs: nowMs() };
        return stale;
      }
      return fail(
        emptyView({ generatedAt, source: 'none', repo: source.repo, branch: source.branch }, [
          'fetch_failed'
        ]),
        nowMs()
      );
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function emptyView(
  base: {
    generatedAt: string;
    source: GodStatusView['source'];
    repo: string | null;
    branch: string | null;
  },
  issues: GodStatusIssue[]
): GodStatusView {
  return {
    v: 1,
    ...base,
    months: [],
    ticks: 0,
    acts: 0,
    monthSpendUsd: 0,
    numbersFrom: 'rollupRows',
    unproductiveActs: null,
    unproductiveUsd: null,
    lastActNarration: null,
    lastTick: null,
    lastActAt: null,
    reasonTally: [],
    recent: [],
    issues
  };
}

/** Cache a readable view. `none` is never cached — there is nothing there worth serving twice. */
function remember(view: GodStatusView, atMs: number): GodStatusView {
  if (view.source !== 'none') cache = { view, atMs };
  return view;
}

/** Remember a total failure just long enough to stop an auto-refreshing page hammering GitHub. */
function fail(view: GodStatusView, atMs: number): GodStatusView {
  failedAtMs = atMs;
  lastFailure = view;
  return view;
}

function withIssue(issues: GodStatusIssue[], issue: GodStatusIssue): GodStatusIssue[] {
  return issues.includes(issue) ? issues : [...issues, issue];
}

/** Drop the memo so a long-lived process does not answer forever after a branch change. */
export function resetGodStatusCache(): void {
  cache = null;
  inflight = null;
  failedAtMs = null;
  lastFailure = null;
}
