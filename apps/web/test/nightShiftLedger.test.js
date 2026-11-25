import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  NIGHT_SHIFT_CREW,
  NIGHT_SHIFT_RECENT_MAX,
  buildNightShiftManifest,
  parseLedgerRuns,
  plainText,
  prNumbersIn,
  splitTableRow,
  summarize
} from '../src/utils/nightShiftLedger.js';

/**
 * The Night Shift reads the fleet's ledgers, which are hand-appended markdown
 * written by cold-start agents. These fixtures carry the structural drift the
 * real files have — blank lines between rows, a decisions table in the same
 * date-first shape, a run log interrupted by a trace section with its own
 * unrelated table — because a parser that only saw tidy tables read one of
 * nine ledgers as empty and another as a single night.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const CREW = { summaryColumn: 'Slice' };

const DRIFTED_LEDGER = `# Ledger

## Decisions

| Date       | Decision                         |
| ---------- | -------------------------------- |
| 2026-11-25 | A policy row, newer than any run |

## Runs

| Date       | Slice                       | Bench | PR   | Notes |
| ---------- | --------------------------- | ----- | ---- | ----- |
| 2026-11-20 | Queue 1 — \`first-night\`. More words. | ok | #101 | n |

| 2026-11-21 | Queue 2 — **bold** [link](https://x.test/y) | ok | [#102](https://github.com/o/r/pull/102) | n |

### 2026-11-21 trace

| metric | value |
| ------ | ----- |
| runs   | 3     |

| 2026-11-22 | none — all todos blocked | n/a | #103 | ledger-only PR |
| 2026-11-23 | Queue 3 — quiet night | ok | — | nothing to ship |
`;

describe('splitTableRow / plainText / summarize', () => {
  it('splits on pipes but keeps escaped ones', () => {
    expect(splitTableRow('| a | b \\| c | d |')).toEqual(['a', 'b | c', 'd']);
  });

  it('strips inline markdown down to words', () => {
    expect(plainText('**bold** `code` [text](https://x.test) _em_')).toBe('bold code text em');
  });

  it('keeps the first sentence and cuts long ones at a word', () => {
    expect(summarize('First sentence. Second one.')).toBe('First sentence.');
    const long = `${'word '.repeat(60)}end`;
    const cut = summarize(long, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('finds PR numbers in either link form, once each', () => {
    expect(prNumbersIn('[#958](https://github.com/o/r/pull/958) and #12 and #958')).toEqual([
      958, 12
    ]);
  });
});

describe('parseLedgerRuns', () => {
  const runs = parseLedgerRuns(DRIFTED_LEDGER, CREW);

  it('reads every run row through blank lines and an interleaved section', () => {
    expect(runs.map((run) => run.date)).toEqual([
      '2026-11-23',
      '2026-11-22',
      '2026-11-21',
      '2026-11-20'
    ]);
  });

  it('never reads a decisions row as a run', () => {
    expect(runs.some((run) => run.date === '2026-11-25')).toBe(false);
  });

  it('summarises the named column and reads PRs from the PR column', () => {
    expect(runs.at(-1)).toEqual({
      date: '2026-11-20',
      summary: 'Queue 1 — first-night.',
      prs: [101],
      shipped: true
    });
    expect(runs.find((run) => run.date === '2026-11-21')?.summary).toBe('Queue 2 — bold link');
  });

  it('does not call a quiet night shipped, even when the ledger row has its own PR', () => {
    const quiet = runs.find((run) => run.date === '2026-11-22');
    expect(quiet?.prs).toEqual([103]);
    expect(quiet?.shipped).toBe(false);
    expect(runs.find((run) => run.date === '2026-11-23')?.shipped).toBe(false);
  });

  it('returns nothing for a ledger with no run log', () => {
    expect(parseLedgerRuns('| Date | Decision |\n| --- | --- |\n| 2026-01-01 | x |', CREW)).toEqual(
      []
    );
    expect(parseLedgerRuns('', CREW)).toEqual([]);
  });
});

describe('buildNightShiftManifest', () => {
  const crewIds = NIGHT_SHIFT_CREW.map((crew) => crew.id);

  it('takes the newest run date anywhere as the shift, and sorts everyone against it', () => {
    const [first, second] = crewIds;
    const manifest = buildNightShiftManifest({
      [first]: `| Date | Slice | PR |\n| --- | --- | --- |\n| 2026-11-24 | Did a thing. | #90 |\n| 2026-11-23 | Older. | #80 |`,
      [second]: `| Date | Class | PR |\n| --- | --- | --- |\n| 2026-09-19 | dead-pair | #70 |`
    });
    expect(manifest.shiftDate).toBe('2026-11-24');
    const one = manifest.crew.find((record) => record.id === first);
    const two = manifest.crew.find((record) => record.id === second);
    expect(one?.tonight.map((run) => run.prs)).toEqual([[90]]);
    expect(one?.earlier.map((run) => run.date)).toEqual(['2026-11-23']);
    expect(two?.tonight).toEqual([]);
    expect(two?.lastSeen).toBe('2026-09-19');
  });

  it('keeps every crew member, even with no ledger at all', () => {
    const manifest = buildNightShiftManifest({});
    expect(manifest.shiftDate).toBeNull();
    expect(manifest.crew.map((record) => record.id)).toEqual(crewIds);
    expect(manifest.crew.every((record) => record.lastSeen === null)).toBe(true);
  });
});

/**
 * The sensor half: the real ledgers, read the way `vite.config.js` reads them.
 * If a ledger is renamed or its run log changes shape, the board goes quietly
 * blank in production — this is where that becomes a red test instead.
 */
describe('the real ledgers', () => {
  const ledgers = Object.fromEntries(
    NIGHT_SHIFT_CREW.map((crew) => [
      crew.id,
      readFileSync(path.join(repoRoot, crew.ledger), 'utf8')
    ])
  );
  const manifest = buildNightShiftManifest(ledgers);

  it('names a ledger file that exists for every crew member', () => {
    expect(NIGHT_SHIFT_CREW.length).toBeGreaterThan(0);
    for (const crew of NIGHT_SHIFT_CREW) {
      expect(existsSync(path.join(repoRoot, crew.ledger)), crew.ledger).toBe(true);
    }
  });

  it('finds a run log in every ledger', () => {
    expect(manifest.crew.length).toBe(NIGHT_SHIFT_CREW.length);
    for (const record of manifest.crew) {
      expect(record.lastSeen, record.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has a shift, and at least one crew member who clocked in on it', () => {
    expect(manifest.shiftDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.crew.some((record) => record.tonight.length > 0)).toBe(true);
  });

  it('keeps the baked manifest small', () => {
    for (const record of manifest.crew) {
      expect(record.earlier.length).toBeLessThanOrEqual(NIGHT_SHIFT_RECENT_MAX);
    }
    expect(JSON.stringify(manifest).length).toBeLessThan(40_000);
  });
});
