// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverLlmMoment } from '../src/utils/officeMomentDelivery.js';
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
