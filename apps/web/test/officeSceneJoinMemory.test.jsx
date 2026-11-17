// @vitest-environment jsdom
/**
 * Coming to a set piece leaves a mark — the other half of
 * `officeSceneDeclineMemory.test.jsx`, and the half that was missing.
 *
 * Every player-side refusal in this room has written a fact since 2026-10-31.
 * The only acceptance that wrote one was `pitchTaken`, so a set piece inverted
 * the walk-by's asymmetry: the office kept every no and forgot every yes. And
 * the inverse is the worse one, because `declineOfficeCoffee` leaves the scene
 * standing and `sceneJoinOfferFor` keeps offering the way back in — so "no,
 * then yes" is a path the floor actively invites, and walking it left the asker
 * carrying *"they stayed at their desk and you went anyway"* about somebody who
 * crossed the room and stood in their kitchen.
 *
 * Five things are pinned and only one of them is the write. The mark lands on
 * **whoever asked** and nobody else; it is written through **both doors** (the
 * accept on the invite and the floor's _Join in_) with **one sentence** that
 * names the scene and never the door; a join after a decline leaves **both**
 * facts in order, because that is the history rather than a contradiction; the
 * **bare store call writes nothing**, which is what keeps `getCoffee` — you
 * walking to the machine with nobody having asked you — from inventing an
 * invitation; and the handler behind each button is the wrapper rather than the
 * store, because a slice where the unit passes and `OfficeLayer` still calls the
 * store directly looks exactly like a slice that works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests,
  acceptOfficeCoffee,
  getOfficeSnapshot,
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  hasWorkingMemoryFact,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import {
  acceptOfficeBattleWithMemory,
  acceptOfficeCoffeeWithMemory,
  joinOfficeBattleWithMemory,
  joinOfficeCoffeeWithMemory
} from '../src/utils/officeSceneJoinMemory.js';
import {
  declineOfficeBattleWithMemory,
  declineOfficeCoffeeWithMemory
} from '../src/utils/officeSceneDeclineMemory.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';
import { OFFICE_CHROME_COPY } from '../src/utils/officeCast.js';

const COFFEE_JOINED = 'the user came along to your coffee break';
const BATTLE_JOINED = 'the user came in on your argument';
const COFFEE_DECLINED =
  'you asked the user along for a coffee; they stayed at their desk and you went anyway';

const COFFEE_CAST = [
  { speakerId: 'gary', text: 'Kitchen?' },
  { speakerId: 'jared', text: 'Go on then.' }
];

const BATTLE_CAST = [
  { speakerId: 'gilfoyle', text: 'Tabs.' },
  { speakerId: 'dinesh', text: 'Spaces, obviously.' }
];

const BATTLE_VERDICTS = { gilfoyle: 'Tabs it is.', dinesh: 'Spaces win.' };

const CLOSING = { speakerId: 'gary', text: '…anyway. Oh — hello.' };
const BATTLE_CLOSING = { speakerId: 'gilfoyle', text: 'Well? Settle it.' };

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

describe('saying yes on the invite', () => {
  it('leaves the mark on whoever asked you, and on nobody else', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });

    const accepted = acceptOfficeCoffeeWithMemory();

    expect(accepted?.accepted).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_JOINED]);
    /*
     * Jared was standing right there and said the second line. The invitation
     * was Gary's and so is the answer — handing Jared a memory of being joined
     * would be the fabrication the situation rule warns about.
     */
    expect(hasWorkingMemoryFact('jared')).toBe(false);
  });

  it('leaves its own mark for an argument, not the coffee one', () => {
    pushOfficeBattleInvite({ lines: BATTLE_CAST, verdicts: BATTLE_VERDICTS, topic: 'tabs' });

    expect(acceptOfficeBattleWithMemory()?.accepted).toBe(true);

    expect(workingMemoryPromptLines('gilfoyle')).toEqual([BATTLE_JOINED]);
    expect(hasWorkingMemoryFact('dinesh')).toBe(false);
  });

  it('is not an answer when there was nothing to accept', () => {
    expect(acceptOfficeCoffeeWithMemory()).toBeNull();
    expect(acceptOfficeBattleWithMemory()).toBeNull();
    expect(workingMemoryPromptLines('gary')).toEqual([]);
  });

  it('writes once for a break you are already in', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    acceptOfficeCoffeeWithMemory();

    // The idempotent case: a second press is not a second arrival.
    expect(acceptOfficeCoffeeWithMemory()).toBeNull();
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_JOINED]);
  });

  it('accepts a cast-less scene and remembers nobody', () => {
    pushOfficeCoffeeInvite({ lines: [] });

    expect(acceptOfficeCoffeeWithMemory()?.accepted).toBe(true);
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });
});

/*
 * The negative case that keeps the whole writer honest, and the reason it is a
 * wrapper rather than a line in the store: `acceptOfficeCoffee` has a second
 * caller — `useDeskActions.getCoffee`, you walking to the machine with nobody
 * having asked you, which pushes a scripted break and accepts it in one go. A
 * beat written inside the store would tell that scene's cast they had invited
 * you somewhere they never did.
 */
describe('a coffee nobody invited you to', () => {
  it('writes nothing when the bare store call accepts it', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });

    acceptOfficeCoffee();

    expect(getOfficeSnapshot().coffee.accepted).toBe(true);
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });
});

describe('changing your mind and walking over', () => {
  it('keeps the no and records the yes, in that order', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    const declined = declineOfficeCoffeeWithMemory();

    expect(joinOfficeCoffeeWithMemory(declined, CLOSING)).toBe(true);

    /*
     * Both facts, in the order they happened. The refusal is not erased — the
     * room saw it — and it is no longer the office's whole record of an episode
     * that ended with you standing in the kitchen.
     */
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_DECLINED, COFFEE_JOINED]);
  });

  it('writes the beat on whoever asked, not on whoever speaks last', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    const declined = declineOfficeCoffeeWithMemory();

    /*
     * The store swaps the remaining script for the closing beat, and that beat
     * can be spoken by the other half of the pair. Read the cast after the swap
     * and the memory lands on the wrong person — which is why the scene goes in
     * beside the line.
     */
    joinOfficeCoffeeWithMemory(declined, { speakerId: 'jared', text: '…oh, hello.' });

    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_DECLINED, COFFEE_JOINED]);
    expect(hasWorkingMemoryFact('jared')).toBe(false);
  });

  it('records the argument you came back for', () => {
    pushOfficeBattleInvite({ lines: BATTLE_CAST, verdicts: BATTLE_VERDICTS, topic: 'tabs' });
    const declined = declineOfficeBattleWithMemory();

    expect(joinOfficeBattleWithMemory(declined, BATTLE_CLOSING)).toBe(true);

    const lines = workingMemoryPromptLines('gilfoyle');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(BATTLE_JOINED);
  });

  it('writes nothing when there was no unattended scene to join', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });

    // Still an open invite, so there is nothing to walk back into.
    expect(joinOfficeCoffeeWithMemory(getOfficeSnapshot().coffee, CLOSING)).toBe(false);
    expect(hasWorkingMemoryFact('gary')).toBe(false);
  });

  it('writes nothing when the closing line is missing, so the verb is withheld whole', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    const declined = declineOfficeCoffeeWithMemory();

    // An untranslated locale hands `line.text` through empty; the store refuses
    // the join, and a memory of a join that did not happen must not survive it.
    expect(joinOfficeCoffeeWithMemory(declined, { speakerId: 'gary', text: '' })).toBe(false);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_DECLINED]);
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

  it('pressing the coffee invite’s yes leaves the person who asked knowing', () => {
    pushOfficeCoffeeInvite({ lines: COFFEE_CAST });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.coffee.accept }));

    expect(getOfficeSnapshot().coffee.accepted).toBe(true);
    expect(workingMemoryPromptLines('gary')).toEqual([COFFEE_JOINED]);
  });

  it('taking a side in the argument leaves the one who wanted you in it knowing', () => {
    pushOfficeBattleInvite({ lines: BATTLE_CAST, verdicts: BATTLE_VERDICTS, topic: 'tabs' });
    render(<OfficeLayer {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole('button', { name: OFFICE_CHROME_COPY.battle.accept }));

    expect(getOfficeSnapshot().battle.accepted).toBe(true);
    expect(workingMemoryPromptLines('gilfoyle')).toEqual([BATTLE_JOINED]);
  });
});
