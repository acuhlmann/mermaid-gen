// @vitest-environment jsdom
/**
 * Pairing with somebody leaves a mark — the conversation the office forgot.
 *
 * A pair huddle is the longest exchange this room supports: one named
 * colleague, a transcript the server reads back so each answer replies to the
 * one before it, a phase that advances on nothing but you typing. Twelve turns
 * of it and `hasWorkingMemoryFact(partner)` was still false, so the next time
 * you stood next to them `useFloorDwell` dealt from the canned deck — the hole
 * queue 2 closed for somebody you merely walked into. A desk visit was
 * remembered three ways; the one real conversation was remembered none.
 *
 * Six things are pinned and only one of them is the write. The beat is the
 * **last real exchange** in the order it happened, so the model never reads a
 * reply to something it had not heard; a **mob writes nothing**, because
 * roster-at-a-time is a different question (the ledger's
 * `meeting-attendees-hold-nothing`); an **`edit` turn is not speech** and is
 * never quoted as one; a chair with no script yet writes nothing; **one
 * conversation is one beat**, so a long chat cannot evict everything else
 * between you two today; and the handler behind the button goes through the
 * wrapper, because a slice where the unit passes and `OfficeLayer` still tears
 * the huddle down silently looks exactly like a slice that works.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeLayer from '../src/components/OfficeLayer.jsx';
import {
  _resetForTests,
  getOfficeSnapshot,
  PAIR_TURNS_MAX,
  recordOfficePairTurn,
  setOfficeHuddleBeats,
  setOfficeHuddleListening,
  startOfficeHuddle
} from '../src/state/officeMomentStore.js';
import {
  _resetOfficeWorkingMemoryForTests,
  getWorkingMemoryWith,
  hasWorkingMemoryFact,
  listWorkingMemoryColleagueIds,
  workingMemoryPromptLines
} from '../src/state/officeWorkingMemoryStore.js';
import { rememberPairHuddle } from '../src/utils/officeHuddleMemory.js';
import { _resetDeskCommsUiForTests } from '../src/state/deskCommsUiStore.js';
import { _resetOfficeViewModeForTests } from '../src/state/officeViewModeStore.js';

const PARTNER = 'gilfoyle';

/** Seat a pair, land its opening line, and leave it waiting on you. */
function seatPair(turns = []) {
  const id = startOfficeHuddle([PARTNER], { mode: 'pair' });
  setOfficeHuddleBeats(id, [{ speakerId: PARTNER, text: 'This retry loop is a prayer.' }]);
  for (const [role, text] of turns) recordOfficePairTurn(id, role, text);
  setOfficeHuddleListening(id);
  return id;
}

beforeEach(() => {
  _resetForTests();
  _resetOfficeViewModeForTests();
  _resetDeskCommsUiForTests();
  _resetOfficeWorkingMemoryForTests();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('what a pair leaves behind', () => {
  it('writes the last exchange on the person who was in the chair', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'So where does it belong?'],
      ['partner', 'Behind the queue, where you can see it fail.']
    ]);

    expect(rememberPairHuddle(getOfficeSnapshot().huddle)).toBe(PARTNER);
    expect(workingMemoryPromptLines(PARTNER)).toEqual([
      'the user said: So where does it belong?',
      'you said: Behind the queue, where you can see it fail.'
    ]);
    expect(hasWorkingMemoryFact(PARTNER)).toBe(true);
  });

  it('pairs their last line with the one you said before it, not after', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'So where does it belong?'],
      ['partner', 'Behind the queue.'],
      ['you', 'Fine, I will move it.']
    ]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    /*
     * The trailing line of yours is left out on purpose: an exchange nobody has
     * answered yet is not an exchange, and `workingMemoryPromptLines` renders
     * `yours` ahead of `theirs` — so pairing it with an older answer would hand
     * the model a reply to something it had not heard.
     */
    expect(workingMemoryPromptLines(PARTNER)).toEqual([
      'the user said: So where does it belong?',
      'you said: Behind the queue.'
    ]);
  });

  it('remembers their line alone when you never answered', () => {
    seatPair([['partner', 'This retry loop is a prayer.']]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(workingMemoryPromptLines(PARTNER)).toEqual(['you said: This retry loop is a prayer.']);
  });

  it('never quotes a canvas edit as something somebody said', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'Watch.'],
      ['edit', 'added Retry queue'],
      ['partner', 'Better.']
    ]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    const lines = workingMemoryPromptLines(PARTNER);
    expect(lines).toEqual(['the user said: Watch.', 'you said: Better.']);
    expect(lines.join(' ')).not.toContain('added Retry queue');
  });

  it('keeps one conversation to one beat however long it ran', () => {
    const turns = [];
    for (let i = 0; i < PAIR_TURNS_MAX; i += 1) {
      turns.push([i % 2 === 0 ? 'partner' : 'you', `line ${i}`]);
    }
    seatPair(turns);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(getWorkingMemoryWith(PARTNER).beats).toHaveLength(1);
  });

  it('writes nothing for a chair with no script yet', () => {
    startOfficeHuddle([PARTNER], { mode: 'pair' });

    expect(rememberPairHuddle(getOfficeSnapshot().huddle)).toBeNull();
    expect(listWorkingMemoryColleagueIds()).toEqual([]);
  });

  it('writes nothing for a mob, on anybody in it', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh', 'jared'], { mode: 'mob' });
    setOfficeHuddleBeats(id, [{ speakerId: 'dinesh', text: 'It is fine.' }]);
    recordOfficePairTurn(id, 'partner', 'It is fine.');

    expect(rememberPairHuddle(getOfficeSnapshot().huddle)).toBeNull();
    expect(listWorkingMemoryColleagueIds()).toEqual([]);
  });

  it('writes nothing when there is no huddle at all', () => {
    expect(rememberPairHuddle(null)).toBeNull();
    expect(listWorkingMemoryColleagueIds()).toEqual([]);
  });
});

describe('the button behind it', () => {
  const BASE_PROPS = {
    onFloor: false,
    getDiagramSource: () => 'flowchart TD\n  A[Sign up] --> B[Verify email]',
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

  it('closing the chair leaves the mark, from the phase a pair actually ends in', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'So where does it belong?'],
      ['partner', 'Behind the queue, where you can see it fail.']
    ]);
    // `listening` is where a pair waits on you, and it is not one of the two
    // phases that pay XP — the beat must not ride that gate.
    expect(getOfficeSnapshot().huddle.phase).toBe('listening');

    render(<OfficeLayer {...BASE_PROPS} />);
    fireEvent.click(screen.getByTestId('office-huddle-end'));

    expect(getOfficeSnapshot().huddle).toBeNull();
    expect(workingMemoryPromptLines(PARTNER)).toEqual([
      'the user said: So where does it belong?',
      'you said: Behind the queue, where you can see it fail.'
    ]);
  });
});
