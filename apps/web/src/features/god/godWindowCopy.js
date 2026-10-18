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
    droppedNarration:
      'The last act billed but its final line did not match the observe contract (`finding:<id> …` or exactly `waiting`), so the run is recorded as dropped. See docs/automations/god.md § Observe output.'
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
      'God only acts once new signals clear the floor. Below it, every tick is a no-op by design. Synthetic probe turns count toward a probe finding but not this production floor.',
    floor: 'Floor',
    agentTurns: 'Agent turns',
    uxSignals: 'Usage signals',
    probeTurns: 'Probe turns (7d pool)',
    sessions: 'Sessions',
    findings: 'Findings',
    sufficient: 'Clears the floor',
    notClear: 'Below the floor',
    noDigest: 'This tick recorded no digest.'
  },
  settings: {
    heading: 'Settings',
    blockedTitle: 'Live values are not readable yet.',
    blockedBody:
      'The knobs live as GitHub Actions repository variables. This deployment cannot read them without the narrow Actions token (not created yet), and cannot write them either.',
    defaultsTitle: 'Code defaults (when a variable is unset)',
    limitsTitle: 'Hard limits (cannot be exceeded even with variables)',
    variableColumn: 'Repository variable',
    valueColumn: 'Default',
    defaultsHint:
      'What the gate actually used on the last tick is the tier and gate reason on Now — not necessarily these defaults.',
    keys: {
      enabled: 'Enabled',
      autonomy: 'Autonomy tier',
      everyHours: 'Cadence (hours)',
      windowUtc: 'UTC window',
      maxMinutes: 'Max minutes per run',
      maxUsdPerRun: 'Max USD per run',
      maxUsdPerMonth: 'Max USD per month'
    },
    limits: {
      minNewSignals: 'Min new signals per tick',
      minBalanceUsd: 'Min wallet balance to start',
      minUsdPerRun: 'Min USD per run (floor)',
      maxUsdPerRun: 'Max USD per run (ceiling)',
      maxUsdPerMonth: 'Max USD per month (ceiling)'
    }
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
