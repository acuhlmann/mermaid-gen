// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OFFICE_WORKING_MEMORY_BEAT_CAP,
  OFFICE_WORKING_MEMORY_STORAGE_KEY,
  readOfficeWorkingMemory,
  writeOfficeWorkingMemory
} from '../src/utils/officeAmbienceStorage.js';

/**
 * jsdom, because the whole point of these is what survives a reload.
 *
 * The store is imported fresh per test (`vi.resetModules` + dynamic import) so
 * each case exercises the real module-load hydration path rather than a reset
 * hook that could quietly diverge from it.
 */

const at = (hour, minute) => new Date(2026, 7, 1, hour, minute).getTime();
const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

async function freshStore() {
  vi.resetModules();
  return import('../src/state/officeWorkingMemoryStore.js');
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('officeWorkingMemoryStore', () => {
  it('records beats and a board fingerprint per colleague', async () => {
    const {
      getWorkingMemoryWith,
      hasWorkingMemoryFact,
      rememberWorkingMemoryBeat,
      stampWorkingMemoryBoard,
      workingMemoryPromptLines
    } = await freshStore();
    stampWorkingMemoryBoard('intern', 'mermaid:Auth:40', at(9, 0));
    rememberWorkingMemoryBeat('intern', { theirs: 'those boxes multiplied', now: at(9, 1) });
    rememberWorkingMemoryBeat('intern', { yours: 'yeah the auth path', now: at(9, 2) });

    expect(hasWorkingMemoryFact('intern')).toBe(true);
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
    expect(getWorkingMemoryWith('intern').boardFingerprint).toBe('mermaid:Auth:40');
    expect(workingMemoryPromptLines('intern')).toEqual([
      'last board they noticed: mermaid:Auth:40',
      'they said: those boxes multiplied',
      'you said: yeah the auth path'
    ]);
  });

  it('caps beats per colleague', async () => {
    const { getWorkingMemoryWith, rememberWorkingMemoryBeat } = await freshStore();
    for (let i = 0; i < OFFICE_WORKING_MEMORY_BEAT_CAP + 3; i += 1) {
      rememberWorkingMemoryBeat('intern', { theirs: `line ${i}`, now: at(9, i) });
    }
    expect(getWorkingMemoryWith('intern').beats).toHaveLength(OFFICE_WORKING_MEMORY_BEAT_CAP);
  });

  it('survives a reload on the same day', async () => {
    const first = await freshStore();
    first.stampWorkingMemoryBoard('scrumMaster', 'mermaid:Bake:12', Date.now());
    first.rememberWorkingMemoryBeat('scrumMaster', { theirs: 'time-box it?' });
    const second = await freshStore();
    expect(second.hasWorkingMemoryFact('scrumMaster')).toBe(true);
    expect(
      second.workingMemoryPromptLines('scrumMaster').some((line) => line.includes('time-box'))
    ).toBe(true);
  });

  it('lists memory ids with the most recent beat first', async () => {
    const { listWorkingMemoryColleagueIds, rememberWorkingMemoryBeat } = await freshStore();
    rememberWorkingMemoryBeat('intern', { theirs: 'hey', now: at(9, 0) });
    rememberWorkingMemoryBeat('greybeard', { theirs: 'batch job', now: at(10, 0) });
    expect(listWorkingMemoryColleagueIds()).toEqual(['greybeard', 'intern']);
  });
});

describe('working memory day stamping', () => {
  it('discards memory written on another day', () => {
    const yesterday = new Date(2026, 6, 31, 9, 0).getTime();
    const today = new Date(2026, 7, 1, 9, 0).getTime();
    writeOfficeWorkingMemory(
      { intern: { beats: [{ at: yesterday, theirs: 'yesterday' }], boardFingerprint: 'x' } },
      yesterday
    );
    expect(Object.keys(readOfficeWorkingMemory(yesterday))).toEqual(['intern']);
    expect(readOfficeWorkingMemory(today)).toEqual({});
  });

  it('survives corrupt storage without throwing', () => {
    window.localStorage.setItem(OFFICE_WORKING_MEMORY_STORAGE_KEY, '{not json');
    expect(readOfficeWorkingMemory(Date.now())).toEqual({});
  });
});

describe('working memory does not trigger ambience', () => {
  it('is not imported by cadence or the ambient director', () => {
    const cadence = readFileSync(join(webRoot, 'src/utils/officeCadence.js'), 'utf8');
    const ambience = readFileSync(join(webRoot, 'src/hooks/useOfficeAmbience.js'), 'utf8');
    expect(cadence).not.toMatch(/officeWorkingMemoryStore/);
    expect(ambience).not.toMatch(/officeWorkingMemoryStore/);
  });
});
