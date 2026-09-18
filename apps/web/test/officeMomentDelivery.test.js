// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverCannedMoment, deliverLlmMoment } from '../src/utils/officeMomentDelivery.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';
import { _resetOfficeLogForTests, recordOfficeLogEntry } from '../src/state/officeLogStore.js';

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
