// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverLlmMoment } from '../src/utils/officeMomentDelivery.js';
import { _resetForTests, getOfficeSnapshot } from '../src/state/officeMomentStore.js';

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
});
