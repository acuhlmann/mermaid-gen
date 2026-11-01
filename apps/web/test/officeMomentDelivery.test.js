// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deliverCannedMoment,
  deliverLlmMoment,
  llmColleagueFor
} from '../src/utils/officeMomentDelivery.js';
import { ambientSpeakerFrom } from '../src/utils/officeAmbientSpeaker.js';
import { officeWalkbyFallbacks } from '../src/utils/officeWalkbyFallbacks.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';
import { _resetOfficeLogForTests, recordOfficeLogEntry } from '../src/state/officeLogStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  rememberWorkingMemoryBeat
} from '../src/state/officeWorkingMemoryStore.js';

/**
 * The delivery seam between `/api/office/moment` and the store.
 *
 * Every assertion here is about what survives the hop. A moment is a plain
 * object on the wire and a store entry afterwards, and each field that is not
 * explicitly forwarded is silently gone — which is exactly how `actionPrompt`
 * used to vanish on the IM branch while emails and walk-bys kept theirs.
 */

const CTX = {
  contentType: 'mermaid',
  diagramSource: 'flowchart TD\n  Auth-->Billing',
  labels: ['Auth', 'Billing'],
  label: 'Auth',
  userTitle: 'Principal Slopitect',
  userName: 'Alex'
};

function memory() {
  return { lastFiredAt: 0, seenTemplateIds: [] };
}

let originalFetch;

function stubMoment(moment) {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ moment })
  });
}

beforeEach(() => {
  _resetForTests();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('deliverLlmMoment carries a pitch to every surface', () => {
  it('keeps an IM pitch in history so it can be adopted later', async () => {
    stubMoment({
      body: 'Auth is doing two jobs and you know it.',
      actionPrompt: 'Split Auth into Authentication and Authorization'
    });

    const delivered = await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'gilfoyle'
    });

    expect(delivered).toBe(true);
    const [msg] = getOfficeSnapshot().imHistory;
    expect(msg.body).toBe('Auth is doing two jobs and you know it.');
    expect(msg.actionPrompt).toBe('Split Auth into Authentication and Authorization');
  });

  it('keeps the pitch on the talk channel, where the desk card renders it', async () => {
    stubMoment({ body: 'Three services, one job.', actionPrompt: 'Collapse the three services' });

    await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'jared',
      channel: 'talk'
    });

    const [msg] = getOfficeSnapshot().imHistory;
    expect(msg.channel).toBe('talk');
    expect(msg.actionPrompt).toBe('Collapse the three services');
    // A talk answer speaks for itself — announcing it would be absurd.
    expect(getOfficeSnapshot().deskArrivals).toHaveLength(0);
  });

  // Most lines have nothing to pitch, and that has to stay visible in the data:
  // an always-present key would put a "Do it" under every remark.
  it('leaves the key off entirely when the speaker had no pitch', async () => {
    stubMoment({ body: 'anyone else see the fridge email' });

    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'intern' });

    const [msg] = getOfficeSnapshot().imHistory;
    expect('actionPrompt' in msg).toBe(false);
  });

  it('still carries pitches on emails and walk-bys', async () => {
    stubMoment({
      subject: 'Re: Auth',
      body: 'Filed as a finding.',
      actionPrompt: 'Name an owner for Billing'
    });
    await deliverLlmMoment('email', CTX, { memory: memory(), colleagueId: 'jared' });
    expect(getOfficeSnapshot().emails[0].actionPrompt).toBe('Name an owner for Billing');

    stubMoment({ body: 'That arrow lies.', actionPrompt: 'Reverse the Auth to Billing edge' });
    await deliverLlmMoment('walkby', CTX, { memory: memory(), colleagueId: 'greybeard' });
    expect(getOfficeSnapshot().walkBy.actionPrompt).toBe('Reverse the Auth to Billing edge');
  });

  it('falls back rather than throwing when the server has nothing usable', async () => {
    stubMoment(null);
    const delivered = await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'intern'
    });
    expect(delivered).toBe(false);
    expect(getOfficeSnapshot().imHistory).toHaveLength(0);
  });

  it('forwards Brain mode as modelProfile on the wire', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ moment: { body: 'ping', colleagueId: 'intern', kind: 'im' } })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      modelProfile: 'quality'
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.modelProfile).toBe('quality');
  });

  it('forwards the situation, and omits the key entirely without one', async () => {
    // The field is the difference between "a colleague said something" and "a
    // colleague said something *because you were standing there*". It is a
    // forwarded field like `actionPrompt`, so it fails the same silent way.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ moment: { body: 'ping', colleagueId: 'intern', kind: 'im' } })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      situation: 'dwell'
    });
    const withSituation = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(withSituation.situation).toBe('dwell');

    // Absent, not empty-string: the route's enum has no '' member, so sending
    // one would 400 every ambient moment in the office.
    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'intern' });
    const ambient = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect('situation' in ambient).toBe(false);
  });

  it('sends the speaking colleague their own history, keyed on who is talking', async () => {
    // The shared digest names colleagues, but it is budgeted as one list and
    // drops from the front — so by mid-afternoon the person who should remember
    // your four exchanges is the one who cannot. This field is the same entries
    // read for one speaker, so it survives that budget.
    _resetOfficeLogForTests();
    recordOfficeLogEntry('email', { colleagueId: 'intern', detail: 'onboarding' });
    recordOfficeLogEntry('chat', { colleagueId: 'intern' });
    recordOfficeLogEntry('walkby', { colleagueId: 'greybeard' });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ moment: { body: 'ping', colleagueId: 'intern', kind: 'im' } })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'intern' });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.officeRelationship[0]).toContain('you and intern have crossed paths 2 times');
    // Greybeard's walk-by is his history, not the intern's.
    expect(String(body.officeRelationship)).not.toContain('greybeard');
    // And the shared digest still carries everybody's, unchanged.
    expect(String(body.officeLog)).toContain('greybeard');

    // Somebody with no history sends an empty array, and the server drops the
    // block rather than printing a heading over nothing.
    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'hr' });
    const stranger = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect(stranger.officeRelationship).toEqual([]);
    _resetOfficeLogForTests();
  });

  it('sends the speaker their own work, which is nobody else in the request', async () => {
    // Every other context field on a moment request is about the user. This one
    // is the speaker's own fiction, and until this slice it was written down in
    // `officeDeskWork.js`, drawn on a monitor, and fed to no prompt at all.
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ moment: { body: 'ping', colleagueId: 'russ', kind: 'im' } })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'russ' });
    const russ = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(russ.officeDeskWork).toHaveLength(2);
    expect(String(russ.officeDeskWork)).toContain('phone');

    // And it is keyed on the speaker, so two colleagues do not sound like one
    // person — the whole point of the field.
    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'jared' });
    const jared = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    expect(jared.officeDeskWork).not.toEqual(russ.officeDeskWork);
    expect(String(jared.officeDeskWork)).toContain('printouts');
  });

  it('sends what the room has written on its own whiteboard, keyed on nobody', async () => {
    // The one context field on this request that belongs to neither the user
    // nor the speaker: a thing on a wall that the whole floor has read, so the
    // same lines go to everybody and the server block says so out loud.
    _resetOfficeLogForTests();
    recordOfficeLogEntry('pitch', { colleagueId: 'gilfoyle' });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ moment: { body: 'ping', colleagueId: 'gilfoyle', kind: 'im' } })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'gilfoyle' });
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(sent.officeBoard.length).toBeGreaterThan(1);
    expect(sent.officeBoard.length).toBeLessThanOrEqual(3);
    // Standing items plus the sketch somebody drew of your work from hearsay —
    // which needs a visible label, so it is the proof the funnel's own context
    // reached the derivation rather than a bank being read out.
    expect(String(sent.officeBoard)).toMatch(/two re-orgs ago/);
    expect(String(sent.officeBoard)).toContain('Auth');

    await deliverLlmMoment('im', CTX, { memory: memory(), colleagueId: 'hr' });
    const other = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body ?? '{}'));
    // Public means public: unlike `officeDeskWork` and `officeRelationship`,
    // this field does not change with the speaker.
    expect(other.officeBoard).toEqual(sent.officeBoard);
    _resetOfficeLogForTests();
  });

  it('sends working-memory beats and can strip a pitch on initiation', async () => {
    const {
      stampWorkingMemoryBoard,
      rememberWorkingMemoryBeat,
      _resetOfficeWorkingMemoryForTests
    } = await import('../src/state/officeWorkingMemoryStore.js');
    _resetOfficeWorkingMemoryForTests();
    stampWorkingMemoryBoard('intern', 'mermaid:Auth:40');
    rememberWorkingMemoryBeat('intern', { theirs: 'those boxes multiplied' });

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        moment: {
          body: 'auth is still doing too much',
          colleagueId: 'intern',
          kind: 'walkby',
          actionPrompt: 'split auth'
        }
      })
    }));
    globalThis.fetch = fetchMock;

    await deliverLlmMoment('walkby', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      situation: 'runWalk',
      allowPitch: false
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'));
    expect(body.officeWorkingMemory.some((line) => line.includes('those boxes multiplied'))).toBe(
      true
    );
    expect(getOfficeSnapshot().walkBy.actionPrompt).toBeUndefined();
    _resetOfficeWorkingMemoryForTests();
  });
});

/**
 * The reply branches are three copies of one shape, and the email one was a
 * copy with a line missing. Nothing could see it: the email still arrived, the
 * office log still carried the subject, and the only symptom was a colleague
 * who had no memory of the longest sentence the user had typed at anybody all
 * day — which reads as the office being canned rather than as a beat not
 * written.
 */
describe('an emailed exchange is a fact about the two of you', () => {
  it('writes the beat from the canned bank, tagged as writing', async () => {
    const { _resetOfficeWorkingMemoryForTests, hasWorkingMemoryFact, workingMemoryPromptLines } =
      await import('../src/state/officeWorkingMemoryStore.js');
    _resetOfficeWorkingMemoryForTests();

    const delivered = deliverCannedMoment('email', CTX, {
      memory: memory(),
      colleagueId: 'jared',
      recordWorkingMemory: true,
      replyContext: { colleagueId: 'jared', userMessage: 'does billing read the ledger?' }
    });

    expect(delivered).toBe(true);
    // The gate `remarkTo` deals a dwell line from: false here is the whole
    // difference between walking over to somebody who knows you and walking
    // over to a stranger.
    expect(hasWorkingMemoryFact('jared')).toBe(true);
    const lines = workingMemoryPromptLines('jared');
    expect(lines).toContain('you emailed them: does billing read the ledger?');
    // The *filled* reply, not the template: a beat quoting `{userName}` back at
    // the model is a memory of a sentence nobody read.
    expect(lines.some((line) => line.startsWith('they wrote back:'))).toBe(true);
    expect(String(lines)).not.toContain('{');
    _resetOfficeWorkingMemoryForTests();
  });

  it('writes nothing at all when the caller did not ask', async () => {
    // The ambient director never passes the flag, and an inbox filling itself
    // on a timer is not something anybody did to anybody (ADR-0010).
    const { _resetOfficeWorkingMemoryForTests, hasWorkingMemoryFact } =
      await import('../src/state/officeWorkingMemoryStore.js');
    _resetOfficeWorkingMemoryForTests();

    deliverCannedMoment('email', CTX, {
      memory: memory(),
      colleagueId: 'jared',
      replyContext: { colleagueId: 'jared', userMessage: 'does billing read the ledger?' }
    });

    expect(hasWorkingMemoryFact('jared')).toBe(false);
    _resetOfficeWorkingMemoryForTests();
  });

  it('tags the LLM rung the same way, so which one answered cannot change the memory', async () => {
    const { _resetOfficeWorkingMemoryForTests, workingMemoryPromptLines } =
      await import('../src/state/officeWorkingMemoryStore.js');
    _resetOfficeWorkingMemoryForTests();
    stubMoment({ subject: 'Re: Auth', body: 'Filed as a finding.' });

    await deliverLlmMoment('email', CTX, {
      memory: memory(),
      colleagueId: 'jared',
      recordWorkingMemory: true,
      replyContext: { colleagueId: 'jared', userMessage: 'does billing read the ledger?' }
    });

    // The board fingerprint this rung also stamps leads the list; the quotes
    // are the two lines after it.
    expect(workingMemoryPromptLines('jared').slice(-2)).toEqual([
      'you emailed them: does billing read the ledger?',
      'they wrote back: Filed as a finding.'
    ]);
    _resetOfficeWorkingMemoryForTests();
  });

  it('leaves an IM beat spoken, which is what the medium is for', async () => {
    // The invariance guard: every beat the office wrote before this slice is
    // phrased exactly as it was, and only the channel the office itself
    // refuses to voice reads differently.
    const { _resetOfficeWorkingMemoryForTests, workingMemoryPromptLines } =
      await import('../src/state/officeWorkingMemoryStore.js');
    _resetOfficeWorkingMemoryForTests();
    stubMoment({ body: 'no.' });

    await deliverLlmMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'jared',
      recordWorkingMemory: true,
      replyContext: { colleagueId: 'jared', userMessage: 'does billing read the ledger?' }
    });

    expect(workingMemoryPromptLines('jared').slice(-2)).toEqual([
      'you said: does billing read the ledger?',
      'they said: no.'
    ]);
    _resetOfficeWorkingMemoryForTests();
  });
});

describe('a dwell remark falls back in character, not as a cold-open ping', () => {
  it('uses the dwell bank when the LLM is unavailable', () => {
    const delivered = deliverCannedMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      situation: 'dwell',
      channel: 'talk',
      recordWorkingMemory: true
    });

    expect(delivered).toBe(true);
    const line = getOfficeSnapshot().imHistory.find((m) => !m.outbound);
    expect(line?.channel).toBe('talk');
    expect(line?.body.toLowerCase()).toContain('auth');
    expect(line?.body).not.toMatch(/reply-all|ticket updated/i);
  });
});

describe('an ambient walk-by falls back as a cold open, not a provoked reply', () => {
  it('uses the walk-by bank when the LLM is unavailable', () => {
    const delivered = deliverCannedMoment('walkby', CTX, {
      memory: memory(),
      random: () => 0
    });

    expect(delivered).toBe(true);
    const line = getOfficeSnapshot().walkBy?.body ?? '';
    expect(line.toLowerCase()).toContain('auth');
    expect(line).not.toMatch(/^re:\s/i);
    expect(line).not.toMatch(/got ur/i);
    expect(line).not.toMatch(/you asked/i);
  });
});

describe('a provoked email answer falls back as a reply, not a cold-open pitch', () => {
  it('uses the email reply bank when the user composed mail', () => {
    const delivered = deliverCannedMoment('email', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      recordWorkingMemory: true,
      replyContext: {
        colleagueId: 'intern',
        userMessage: 'Does Billing talk to Auth?'
      },
      random: () => 0
    });

    expect(delivered).toBe(true);
    const mail = getOfficeSnapshot().emails[0];
    expect(mail?.subject.toLowerCase()).toMatch(/^re:/);
    expect(mail?.body.toLowerCase()).toContain('billing');
    expect(mail?.body.toLowerCase()).toContain('auth');
    expect(mail?.body).not.toMatch(/mandatory fun hour/i);
    expect(mail?.body).not.toMatch(/welcome aboard/i);
  });
});

describe('a provoked talk answer falls back spoken, not as a typed IM', () => {
  it('uses the talk reply bank when the user spoke out loud', () => {
    const delivered = deliverCannedMoment('im', CTX, {
      memory: memory(),
      colleagueId: 'intern',
      channel: 'talk',
      recordWorkingMemory: true,
      replyContext: {
        colleagueId: 'intern',
        userMessage: 'Does Billing talk to Auth?'
      }
    });

    expect(delivered).toBe(true);
    const line = getOfficeSnapshot().imHistory.find((m) => !m.outbound);
    expect(line?.channel).toBe('talk');
    expect(line?.body.toLowerCase()).toContain('billing');
    expect(line?.body).not.toMatch(/^re:\s/i);
    expect(line?.body).not.toMatch(/got ur/i);
  });
});

/*
 * Who the room sends, as opposed to what they say.
 *
 * These live here rather than in a suite of their own on purpose: the picker
 * has exactly one consumer and it is this module, and a fresh
 * `officeAmbientSpeaker.test.js` would land in neither `npm run test:floor` nor
 * `ISOMETRIC_FLOOR_BLAST_TESTS` (the 2026-10-31 finding), while this file is
 * selected by the content ladder's `test/officeMoment` prefix.
 *
 * Every distribution assertion below is a **sweep with a deterministic roll
 * sequence**, never a single roll. One roll of a weighted draw says nothing —
 * the same lesson the generation benches pay for with `--samples 3` — and a
 * sweep is also robust to somebody adding a line to the walk-by bank, which a
 * hardcoded index is not.
 */

/*
 * 1320, because every exact-count assertion below divides it: 4 (a cast), 5
 * (that cast plus one ticket), 8 (the cast entered twice once everybody is
 * familiar), 12 (the cast plus eight tickets) and 3. A sample count that does
 * not divide the pool makes a *uniform* draw come back 165/166 and the test
 * then reads as a bias that is not there.
 */
const SAMPLES = 1320;

/** `i/N` over [0,1) — every bucket of the pool hit in proportion to its size. */
function rollsOf(samples = SAMPLES) {
  let i = -1;
  return () => {
    i += 1;
    return (i % samples) / samples;
  };
}

function tally(ids) {
  const counts = {};
  for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

describe('ambientSpeakerFrom gives a familiar colleague extra tickets, never the floor', () => {
  const CAST = ['a', 'b', 'c', 'd'];

  function sweep(memoryIds, tickets) {
    const random = rollsOf();
    return tally(
      Array.from({ length: SAMPLES }, () => ambientSpeakerFrom(CAST, memoryIds, random, tickets))
    );
  }

  it('draws uniformly when nobody has memory of you', () => {
    const counts = sweep([], 1);
    expect(Object.keys(counts).sort()).toEqual(CAST);
    for (const id of CAST) expect(counts[id]).toBe(SAMPLES / CAST.length);
  });

  it('draws a familiar colleague exactly twice as often as a stranger', () => {
    const counts = sweep(['c'], 1);
    // 4 cast entries + 1 ticket = 5 buckets; c holds two of them.
    expect(counts.c).toBe((SAMPLES / 5) * 2);
    for (const id of ['a', 'b', 'd']) expect(counts[id]).toBe(SAMPLES / 5);
  });

  it('never drops anybody to zero, which is what makes this a thumb and not a gate', () => {
    const counts = sweep(['c'], 8);
    expect(counts.c).toBeGreaterThan(counts.a);
    for (const id of CAST) expect(counts[id]).toBeGreaterThan(0);
  });

  it('fades back to uniform once the whole cast is familiar', () => {
    const counts = sweep([...CAST], 1);
    for (const id of CAST) expect(counts[id]).toBe(SAMPLES / CAST.length);
  });

  it('ignores memory of somebody this kind of moment cannot cast', () => {
    const counts = sweep(['belson', 'gilfoyle'], 1);
    for (const id of CAST) expect(counts[id]).toBe(SAMPLES / CAST.length);
  });

  it('is the old uniform draw at zero tickets, so the rollback is a constant', () => {
    const counts = sweep(['c'], 0);
    for (const id of CAST) expect(counts[id]).toBe(SAMPLES / CAST.length);
  });

  it('keeps a repeated id as weight rather than de-duplicating the bank', () => {
    const random = rollsOf();
    const counts = tally(
      Array.from({ length: SAMPLES }, () => ambientSpeakerFrom(['a', 'a', 'b'], [], random, 1))
    );
    expect(counts.a).toBe((SAMPLES / 3) * 2);
    expect(counts.b).toBe(SAMPLES / 3);
  });

  it('answers null for an empty cast rather than throwing', () => {
    expect(ambientSpeakerFrom([], ['c'], () => 0)).toBe(null);
    expect(ambientSpeakerFrom(undefined, ['c'], () => 0)).toBe(null);
  });
});

describe('the ambient director reads working memory when it picks a speaker', () => {
  beforeEach(() => {
    _resetOfficeWorkingMemoryForTests();
  });

  afterEach(() => {
    _resetOfficeWorkingMemoryForTests();
  });

  it('leans the LLM walk-by cast toward somebody you dealt with, at fire time', () => {
    const cold = rollsOf();
    const before = tally(Array.from({ length: SAMPLES }, () => llmColleagueFor('walkby', cold)));

    rememberWorkingMemoryBeat('greybeard', { interrupted: 'gotIt' });

    const warm = rollsOf();
    const after = tally(Array.from({ length: SAMPLES }, () => llmColleagueFor('walkby', warm)));

    expect(after.greybeard).toBeGreaterThan(before.greybeard);
    // Everybody the cast allows still speaks — the thumb is not a gate.
    for (const id of Object.keys(before)) expect(after[id]).toBeGreaterThan(0);
  });

  it('leaves the IM and email casts alone for a colleague they do not hold', () => {
    const cold = rollsOf();
    const before = tally(Array.from({ length: SAMPLES }, () => llmColleagueFor('im', cold)));

    // `facilities` is in the walk-by cast and in neither of the other two.
    rememberWorkingMemoryBeat('facilities', { errandDropped: true });

    const warm = rollsOf();
    const after = tally(Array.from({ length: SAMPLES }, () => llmColleagueFor('im', warm)));

    expect(after).toEqual(before);
    expect(after.facilities).toBeUndefined();
  });

  it('sends the colleague whose errand you wrecked over to your desk more often', () => {
    function walkBySweep() {
      const random = rollsOf();
      const speakers = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        _resetForTests();
        deliverCannedMoment('walkby', CTX, { memory: memory(), random });
        const id = getOfficeSnapshot().walkBy?.colleagueId;
        if (id) speakers.push(id);
      }
      return tally(speakers);
    }

    const before = walkBySweep();

    rememberWorkingMemoryBeat('hr', { interrupted: 'gaveUp' });
    const after = walkBySweep();

    expect(before.hr).toBeGreaterThan(0);
    expect(after.hr).toBeGreaterThan(before.hr);
    // The bank still casts the scene: nobody in it goes silent, and nobody who
    // was never in it starts walking over.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const id of Object.keys(before)) expect(after[id]).toBeGreaterThan(0);
  });

  it('does not let a familiar colleague repeat a line the session has already heard', () => {
    rememberWorkingMemoryBeat('hr', { interrupted: 'gaveUp' });
    const hrIds = officeWalkbyFallbacks()
      .filter((entry) => entry.colleagueId === 'hr')
      .map((entry) => entry.id);
    expect(hrIds.length).toBeGreaterThan(0);

    const random = rollsOf();
    const speakers = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      _resetForTests();
      deliverCannedMoment('walkby', CTX, {
        memory: { lastFiredAt: 0, seenTemplateIds: [...hrIds] },
        random
      });
      const id = getOfficeSnapshot().walkBy?.colleagueId;
      if (id) speakers.push(id);
    }

    /*
     * The tickets win her the *speaker* draw often, and she still never
     * speaks — because the narrowing is to her **unseen** lines, so a spent
     * bank falls through to the whole one and anti-repetition survives the
     * thumb intact. Without that `.filter` on `seenTemplateIds` this is the
     * case that goes red.
     */
    const counts = tally(speakers);
    expect(counts.hr).toBeUndefined();
    expect(speakers.length).toBe(SAMPLES);
  });
});
