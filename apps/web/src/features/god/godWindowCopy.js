/**
 * Copy for the owner's God window (ADR-0019 §10).
 *
 * Plain module, not an i18n bundle: like `utils/coldStartCopy.ts`, this is chrome for a surface outside
 * the office floor, and the office locale-bundle obligations (`docs/agents/domains/office.md`) are
 * exactly what the standalone `/god` route was chosen to avoid.
 *
 * `notMeasured` is a separate string from `none` on purpose. A dash over `unproductiveUsd` reads as zero,
 * and zero is good news about money — the two answers must not look alike.
 */
export const GOD_WINDOW_COPY = {
  eyebrow: 'ArchiSlop · Owner',
  title: 'God Window',
  subtitle: 'What the automation is doing, what it costs, and why it stopped.',
  tabs: {
    now: 'Now',
    history: 'History',
    signals: 'Signals',
    settings: 'Settings'
  },
  refresh: 'Refresh',
  refreshing: 'Reading the branch…',
  access: {
    label: 'Owner token',
    submit: 'Open the window',
    submitting: 'Checking…',
    hint: 'Gated by GOD_WINDOW_TOKEN, not the door code. Spend figures stay behind it.',
    refused: 'That is not the owner token.',
    unconfigured: 'God window access is not configured on this deployment.',
    unreachable: 'Could not reach the server.',
    unreadableTitle: 'The window is open; the branch is not readable.',
    unreadableBody:
      'The owner token worked, but the run records could not be read. This is a GitHub read, not a credentials problem — nothing here needs rotating.'
  },
  now: {
    heading: 'This month',
    tickHeading: 'Most recent tick',
    running: 'Reached the harness',
    idle: 'Skipped before the harness',
    never: 'No tick on this branch yet.',
    spend: 'Spend this month',
    ticks: 'Ticks',
    acts: 'Acts',
    lastAct: 'Last act',
    noAct: 'Has never acted',
    reason: 'Why it stopped',
    generated: 'Numbers as of',
    stale: 'Cached — the last read of the branch failed',
    sourceNone: 'Nothing readable on the branch right now.',
    liveHeading: 'Live run',
    liveEmpty: 'No harness events in the buffer yet.',
    liveRun: 'Run id'
  },
  history: {
    heading: 'Recent ticks',
    empty: 'No rows survived in the month rollup.',
    understated:
      'Counted from the surviving rollup rows, not the run records — a truncated month reads smaller than it is.',
    fromRecords: 'Month totals come from the run records, so a truncated rollup cannot hide spend.',
    unproductive: 'Acts that billed and named nothing',
    unproductiveUsd: 'Wasted',
    reasonTally: 'Skip reasons'
  },
  signals: {
    heading: 'What it is being fed',
    blurb:
      'God only acts once new signals clear the floor. Below it, every tick is a no-op by design.',
    floor: 'Floor',
    agentTurns: 'Agent turns',
    uxSignals: 'Usage signals',
    sessions: 'Sessions',
    findings: 'Findings',
    sufficient: 'Clears the floor',
    notClear: 'Below the floor',
    noDigest: 'This tick recorded no digest.'
  },
  settings: {
    heading: 'Settings',
    blockedTitle: 'Not wired yet.',
    blockedBody:
      'The knobs (tier, window, budgets) are GitHub Actions variables. Reading them needs the narrow Actions token that does not exist yet, and writing them needs it too — so there is nothing honest to show here.',
    defaultsHint:
      'What it runs under today is recorded per tick: the tier and the gate reason above.'
  },
  fields: {
    verdict: 'Verdict',
    tier: 'Tier',
    trigger: 'Trigger',
    started: 'Started',
    usd: 'Cost',
    narration: 'Narration',
    run: 'Run',
    notMeasured: 'not measured',
    unknown: '—'
  },
  issuesIntro: 'The read of the branch reported',
  monthSpendLabel: 'Month spend'
};
