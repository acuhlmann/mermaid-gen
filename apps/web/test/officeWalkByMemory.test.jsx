// @vitest-environment jsdom
/**
 * Waving away what somebody walked over to offer leaves a mark
 * (`docs/automations/office-life.md` queue 13 — *"every surface has an ✕ and
 * every ✕ is silent"*).
 *
 * The dropped errand, the declined calendar invite and the declined set piece
 * closed the first three. This is the fourth, and the one the sweep should have
 * started with: it is the only refusal in the office whose **acceptance was
 * already recorded**. `handleAdopt` has written `pitchTaken` on whoever's idea
 * you used since working memory existed, and the ✕ sitting beside that same
 * **Do it** button on the same bubble wrote nothing at all.
 *
 * Four things are pinned and only one of them is the write.
 *
 * - **The gate is `actionPrompt`**, which is also exactly what makes the
 *   **Do it** button render. With a prompt the bubble is a question and ✕ is an
 *   answer; without one it is somebody saying a thing and closing it means you
 *   read it. A beat there would invent a suggestion to have refused.
 * - **A clock is not a refusal.** `pushOfficeWalkBy` schedules its own expiry,
 *   so a walk-by you never answer clears itself through the store's own
 *   mutator — and must leave nothing behind.
 * - **Noticed, never chased** (ADR-0010): no second offer, no reminder, one
 *   beat.
 * - **The handler calls the wrapper**, not the bare store function. A slice
 *   where every unit passes and `OfficeLayer` still calls the store directly
 *   looks exactly like a slice that works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  WALKBY_TTL_MS,
  _resetForTests,
  getOfficeSnapshot,
  pushOfficeWalkBy
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import { dismissOfficeWalkByWithMemory } from '../src/utils/officeWalkByMemory.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';
import { officeSenderInfo } from '../src/utils/officeCast.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';
import { formatLocale } from '../src/i18n/formatLocale.js';

const DECLINED_LINE = 'you came over with a suggestion; the user did not take it';

/*
 * `greybeard` rather than a name picked for flavour: the walk-by cast is
 * `OFFICE_WALKBY_LLM_CAST` and the fallback bank, and a colleague who cannot
 * walk over cannot be refused at your desk. Gilfoyle is in neither, so a
 * fixture on him would be a reachable-looking state the room never produces.
 */
const PITCH = {
  colleagueId: 'greybeard',
  body: 'We tried that in 1979. It is still in the mainframe.',
  actionPrompt: 'Add the legacy system'
};

/** The same walk-by with nothing to take — the bubble renders no **Do it**. */
const REMARK = {
  colleagueId: 'greybeard',
  body: 'Your auth box is doing three jobs. One of them is a lie.'
};

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetDeskCommsUiForTests();
  _resetOfficeWorkingMemoryForTests();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('waving away a suggestion', () => {
  it('leaves the mark on whoever came over, and reads as the answer you gave', () => {
    const id = pushOfficeWalkBy(PITCH);

    const dismissed = dismissOfficeWalkByWithMemory(id);

    expect(dismissed?.id).toBe(id);
    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(true);
    expect(workingMemoryPromptLines('greybeard')).toEqual([DECLINED_LINE]);
  });

  /*
   * The gate, and the control for every case above it. A walk-by with nothing
   * to take is not a question — `OfficeWalkBy.jsx` and `FloorWalker.jsx` both
   * render the **Do it** button off this same field — so closing it means you
   * read it. A beat here would hand the next `/moment` a suggestion that was
   * never made, which is the fabrication the situation rule in
   * `docs/agents/domains/office.md` was measured on (8 of 12 turns), arriving
   * through memory instead of through a prompt.
   */
  it('writes nothing when there was nothing to take', () => {
    const id = pushOfficeWalkBy(REMARK);

    expect(dismissOfficeWalkByWithMemory(id)?.id).toBe(id);
    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });

  it('treats a blank prompt as nothing to take', () => {
    const id = pushOfficeWalkBy({ ...PITCH, actionPrompt: '   ' });

    expect(dismissOfficeWalkByWithMemory(id)?.id).toBe(id);
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });

  it('is not a refusal when there was nothing on screen to refuse', () => {
    expect(dismissOfficeWalkByWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });

  /*
   * The store's own staleness guard, read from the memory side: a dismiss aimed
   * at a walk-by that has already gone is ignored, so it cannot write a beat
   * for the one that replaced it.
   */
  it('writes nothing for a walk-by that is no longer the one on screen', () => {
    const first = pushOfficeWalkBy(PITCH);
    pushOfficeWalkBy({ ...PITCH, colleagueId: 'dinesh' });

    expect(dismissOfficeWalkByWithMemory(first)).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
    expect(hasWorkingMemoryFact('dinesh')).toBe(false);
  });

  it('remembers nobody when the walk-by was attached to nobody', () => {
    const id = pushOfficeWalkBy({ ...PITCH, colleagueId: '' });

    expect(dismissOfficeWalkByWithMemory(id)?.id).toBe(id);
    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(workingMemoryPromptLines('greybeard')).toEqual([]);
  });
});

/**
 * The half that decides where the writer lives rather than what it writes.
 *
 * Every walk-by schedules its own expiry, so most of them in a real session are
 * cleared by `WALKBY_TTL_MS` and not by you. That path calls the store's
 * `dismissOfficeWalkBy` directly — which is the whole reason the beat is
 * written in a module the press handler calls, and not inside the mutator.
 * Put it in the mutator and every colleague who walked over while you were
 * reading something else remembers being turned down.
 */
describe('a clock is not a refusal', () => {
  it('writes nothing when the walk-by simply times out', () => {
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
    vi.useFakeTimers();
    pushOfficeWalkBy(PITCH);

    vi.advanceTimersByTime(WALKBY_TTL_MS + 1_000);

    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });
});

/**
 * Queue 13's own rule, asserted rather than trusted: the room notices and never
 * chases. A refusal that re-raises the suggestion is auto-fix-on-idle wearing a
 * lanyard (ADR-0010 consequence #4).
 */
describe('noticed, never chased', () => {
  it('leaves nothing on screen and exactly one beat, ten minutes later', () => {
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
    vi.useFakeTimers();
    dismissOfficeWalkByWithMemory(pushOfficeWalkBy(PITCH));

    vi.advanceTimersByTime(10 * 60_000);

    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(workingMemoryPromptLines('greybeard')).toEqual([DECLINED_LINE]);
  });
});

/**
 * The wiring, through the real `OfficeLayer`.
 *
 * The writes are covered above; what nothing else sees is which function the ✕
 * is attached to. Both renderers route their dismiss through the one handler
 * (ADR-0011 rule 1), so that handler is the whole surface area — and one left
 * on the bare store call fails nothing above it.
 */
describe('end to end, through OfficeLayer', () => {
  const BASE_PROPS = {
    pause: false,
    advisorBusy: false,
    getDiagramSource: () => 'flowchart LR\n  A-->B',
    getContentType: () => 'mermaid',
    getSessionId: () => 'test-session',
    getSvgRoot: () => document,
    getUserTitle: () => 'Intern Architect',
    onUsage: () => {},
    onAdoptPrompt: () => {},
    onMeetingMinutes: () => {},
    onOfficeEvent: () => {},
    onTalkToTeam: () => {},
    onCheckHrProgression: () => {},
    playChime: () => {}
  };

  const dismissName = (colleagueId) =>
    formatLocale(OFFICE_CHROME_COPY.walkby.dismissAria, {
      name: officeSenderInfo(colleagueId).name
    });

  it('pressing ✕ on the bubble leaves the person who came over knowing', () => {
    pushOfficeWalkBy(PITCH);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: dismissName('greybeard') }));

    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(workingMemoryPromptLines('greybeard')).toEqual([DECLINED_LINE]);
  });

  /*
   * The same press on a bubble that offered nothing, through the same handler —
   * the control that would go red if the gate were moved out of the writer and
   * into the test's own fixture.
   */
  it('pressing ✕ on a bubble that offered nothing leaves nothing behind', () => {
    pushOfficeWalkBy(REMARK);
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: dismissName('greybeard') }));

    expect(getOfficeSnapshot().walkBy).toBeNull();
    expect(hasWorkingMemoryFact('greybeard')).toBe(false);
  });
});
