// @vitest-environment jsdom
/**
 * Turning down a set piece leaves a mark (`docs/automations/office-life.md`
 * queue 13 — the instance the playbook names by file, and the last of the three
 * ✕s the refusal sweep found silent).
 *
 * The dropped errand and the declined calendar invite closed the first two.
 * This one is the ✕ that was still silent afterwards, and it is the refusal
 * with the strongest claim to a memory precisely because **nothing else
 * happens**: slice 28 made declining mean "not for me" rather than "not
 * happening", so Richard asks you along, you say no in front of him, and he has
 * his coffee without you. Before this module the office's whole record of that
 * was a flag that switched a card on.
 *
 * Four things are pinned and only one of them is the write. The mark lands on
 * **the person who asked** and on nobody else; the two scenes are **two
 * different noes**, which is the entire reason the beat carries an enum rather
 * than a boolean; the refusal is **noticed and never chased** (ADR-0010), with
 * the scene still playing out and the way back in still open; and the handler
 * behind each button is the wrapper rather than the bare store call — a slice
 * where the unit passes and `OfficeLayer` still calls the store directly looks
 * exactly like a slice that works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests,
  acceptOfficeCoffee,
  getOfficeSnapshot,
  joinOfficeCoffee,
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import {
  declineOfficeBattleWithMemory,
  declineOfficeCoffeeWithMemory
} from '../src/utils/officeSceneDeclineMemory.js';
import { isUnattendedScene, sceneJoinOfferFor } from '../src/utils/officeFloorSceneJoin.js';
import { COFFEE_TILES } from '../src/utils/officeFloorPlan.js';
import { BATTLE_LINE_PACE_MS } from '../src/hooks/officeScenePacingConstants.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

const COFFEE_LINE =
  'they asked you along for a coffee; you stayed at your desk and they went anyway';
const BATTLE_LINE =
  'they wanted you in on an argument; you walked away and it carried on without you';

const COFFEE_CAST = [
  { speakerId: 'gary', text: 'Kitchen?' },
  { speakerId: 'jared', text: 'Go on then.' }
];

const BATTLE_CAST = [
  { speakerId: 'gilfoyle', text: 'Tabs.' },
  { speakerId: 'dinesh', text: 'Spaces, obviously.' }
];

/*
 * The overlay derives its two fighters from `verdicts`, not from `lines`, so an
 * invite without them renders nothing and the end-to-end case below would fail
 * for a reason that has nothing to do with memory.
 */
const BATTLE_VERDICTS = { gilfoyle: 'Tabs it is.', dinesh: 'Spaces win.' };

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

describe('refusing a coffee break', () => {
  it('leaves the mark on whoever asked you, and on nobody else', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });

    const declined = declineOfficeCoffeeWithMemory();

    expect(declined?.declined).toBe(true);
    expect(hasWorkingMemoryFact('gary')).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_LINE]);
    /*
     * The fiction rule rather than the wiring one, and it is sharper here than
     * on the calendar invite: Jared was standing *right there*. He was not the
     * one doing the asking — `sceneJoinOfferFor` already calls the first
     * participant "the one that asked you in the first place" — and a memory on
     * him is a colleague remembering a conversation he was not having with you,
     * which is the fabrication the situation rule in
     * `docs/agents/domains/office.md` was measured on, arriving through memory
     * instead of through a prompt.
     */
    expect(hasWorkingMemoryFact('jared')).toBe(false);
  });

  it('is not a refusal when there was nothing to refuse', () => {
    expect(declineOfficeCoffeeWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });

  /*
   * The store's own idempotency guard, read from the memory side. Accepting and
   * then declining is not reachable through the panel but is trivially
   * reachable through the store, and a beat written there would tell the next
   * `/moment` you skipped a break you are standing in.
   */
  it('writes nothing for a break you are already in', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    acceptOfficeCoffee();

    expect(declineOfficeCoffeeWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });

  /*
   * A scene with no cast degrades the way `sceneJoinOfferFor` already chose to:
   * a refusal aimed at nobody is not a refusal. The scene is still declined —
   * the store did that before the writer ran — so the panel behaves
   * identically, which is the half that would otherwise regress silently.
   */
  it('declines a cast-less scene and remembers nobody', () => {
    pushOfficeCoffeeInvite({ lines: [] });

    expect(declineOfficeCoffeeWithMemory()?.declined).toBe(true);
    expect(getOfficeSnapshot().coffee.declined).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([]);
  });
});

describe('walking away from an argument', () => {
  it('leaves its own mark, not the coffee one', () => {
    pushOfficeBattleInvite({
      topic: 'Tabs vs spaces',
      lines: BATTLE_CAST,
      verdicts: BATTLE_VERDICTS
    });

    expect(declineOfficeBattleWithMemory()?.declined).toBe(true);
    /*
     * The whole argument for the enum, in one assertion. The other two refusals
     * each describe something that can only have happened one way, so one
     * sentence is the circumstance. These two cannot share one: a coffee you
     * did not want is company turned down, a shouting match you left is a side
     * nobody took, and a line covering both would have to say "you did not join
     * their thing".
     */
    expect(workingMemoryPromptLines('gilfoyle')).toEqual([BATTLE_LINE]);
    expect(workingMemoryPromptLines('gilfoyle')).not.toContain(COFFEE_LINE);
    expect(hasWorkingMemoryFact('dinesh')).toBe(false);
  });

  it('is not a refusal when there was nothing to refuse', () => {
    expect(declineOfficeBattleWithMemory()).toBeNull();
    expect(hasWorkingMemoryFact('gilfoyle')).toBe(false);
  });
});

/**
 * Queue 13's own rule, asserted rather than trusted — and this is the surface
 * where "noticed, never chased" is hardest to read off the code, because the
 * scene deliberately *keeps going* and the floor deliberately *keeps offering*.
 * Both of those predate this slice and are derived from the scene's own
 * `declined` flag; what must not appear is a second invitation, a second beat,
 * or a memory that grows while you stand there.
 */
describe('noticed, never chased', () => {
  it('keeps the scene running and the way in open, and writes exactly one beat', () => {
    vi.useFakeTimers();
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    declineOfficeCoffeeWithMemory();

    vi.advanceTimersByTime(10 * 60_000);

    const coffee = getOfficeSnapshot().coffee;
    // Slice 28's distinction survives the memory writer: "not for me", not
    // "not happening" — same scene, same cast, still declined.
    expect(coffee).not.toBeNull();
    expect(coffee.lines).toEqual(COFFEE_CAST);
    expect(isUnattendedScene(coffee)).toBe(true);
    // And the way back in is still there, which is the thing a "chase" would
    // look like if it were this module's doing. It is not: the offer is derived
    // from the flag, not scheduled by anybody.
    expect(sceneJoinOfferFor(coffee, COFFEE_TILES[0])?.colleagueId).toBe('gary');
    // The noticing did not grow a second copy of itself in the meantime.
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_LINE]);
  });

  /*
   * Changing your mind does not erase the fact that you said no first. That is
   * the honest reading — the room saw both — and it is also what stops a join
   * from needing to know about memory at all.
   */
  it('keeps the beat when you later walk over and join after all', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    declineOfficeCoffeeWithMemory();

    expect(joinOfficeCoffee({ speakerId: 'gary', text: '…anyway. Oh — hello.' })).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_LINE]);
  });
});

/**
 * The wiring, through the real `OfficeLayer`.
 *
 * The writes are covered above; what nothing else sees is which function each
 * button is attached to. Both panels render in both worlds (ADR-0011 rule 1),
 * so one handler each is the whole surface area — and a handler left on the
 * bare store call fails nothing above.
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

  it('pressing “Deadline” leaves the person who asked knowing', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.coffee.decline }));

    expect(getOfficeSnapshot().coffee.declined).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_LINE]);
  });

  it('pressing “Not my circus” leaves the one who wanted you in it knowing', () => {
    pushOfficeBattleInvite({
      topic: 'Tabs vs spaces',
      lines: BATTLE_CAST,
      verdicts: BATTLE_VERDICTS
    });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.battle.decline }));

    expect(getOfficeSnapshot().battle.declined).toBe(true);
    expect(workingMemoryPromptLines('gilfoyle')).toEqual([BATTLE_LINE]);
    /*
     * The other half of the wiring, and the half that would look like the
     * feature being broken rather than missing: the argument carries on in the
     * store, so the pill has to be hidden by the renderer instead of deleted by
     * the handler. Without `battle={…declined ? null : …}` the overlay re-draws
     * the invite you just turned down.
     */
    expect(screen.queryByTestId('office-battle-invite')).toBeNull();
  });

  /*
   * The one way this wiring change could break the office rather than merely
   * itself, asserted rather than reasoned about. `battle` counts toward
   * `hasActiveOfficeSurface`, and declining from the desk is a state the desk
   * could not reach until tonight — so if the unattended script ever stops
   * pacing out, the ambient director goes silent for the rest of the session
   * while every assertion above still passes. (`officeFloorSceneJoin.test.jsx`
   * pins the same property for the floor, which is where it used to be the
   * only way in.)
   */
  it('still ends by itself after a desk decline, instead of holding the office silent', async () => {
    vi.useFakeTimers();
    pushOfficeBattleInvite({
      topic: 'Tabs vs spaces',
      lines: BATTLE_CAST,
      verdicts: BATTLE_VERDICTS
    });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.battle.decline }));
    expect(getOfficeSnapshot().battle.declined).toBe(true);

    /*
     * Its own act block, after the click's: the effect that schedules the
     * pacing timer flushes when the scope closes, so advancing the clock in the
     * same block advances it before the timer exists.
     *
     * The budget is the script's own — one gap per line plus the tail — and
     * deliberately not a round six minutes. A live `OfficeLayer` keeps running
     * for however long the clock is advanced, so a generous advance ends with
     * `hasActiveOfficeSurface()` true for something the office started in the
     * meantime, which says nothing about this scene. The property that matters
     * is the one asserted: the declined battle left the store, which is what it
     * would be holding the director with. `officeFloorSceneJoin.test.jsx` makes
     * the predicate claim where it can be made in isolation.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BATTLE_LINE_PACE_MS * BATTLE_CAST.length + 4000);
    });

    expect(getOfficeSnapshot().battle, 'a declined battle never left the store').toBeNull();
    // And the beat the whole slice is about survived the scene it was about.
    expect(workingMemoryPromptLines('gilfoyle')).toEqual([BATTLE_LINE]);
  });

  /*
   * Accepting is the negative case that keeps both lines honest. It is the same
   * panel and the same scene, and it is not a refusal — a beat here would tell
   * the next `/moment` you skipped a break you walked into.
   */
  it('taking the break leaves no mark', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.coffee.accept }));

    expect(getOfficeSnapshot().coffee.accepted).toBe(true);
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });
});
