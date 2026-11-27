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
 * Since 2026-11-23 it leaves **two** marks, not one — see
 * `docs/office-isometric-mode.md` § 8's `pair-huddle-is-never-huddled`. The
 * partner keeps the body on their beat and the room keeps the bare fact in
 * `officeLogStore.js`, both behind the one guard, because a conversation the
 * partner remembers and the room does not is a conversation two memories can
 * disagree about. The room's line names the person: before this, the only
 * `huddle` sentence the digest had was "the team crowded around your screen",
 * which is a false fact about one colleague and is why the write waited for the
 * branch.
 *
 * Six things are pinned about the beat and only one of them is the write. The beat is the
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
import {
  _resetOfficeLogForTests,
  getOfficeLogDigest,
  getOfficeLogSnapshot,
  getOfficeRelationshipWith
} from '../src/state/officeLogStore.js';
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
  _resetOfficeLogForTests();
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

describe('what the room keeps', () => {
  it('files the conversation under the person who was in it', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'So where does it belong?'],
      ['partner', 'Behind the queue, where you can see it fail.']
    ]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    const entries = getOfficeLogSnapshot();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'huddle', colleagueId: PARTNER });
    expect(getOfficeLogDigest()[0]).toContain(
      `the user and ${PARTNER} talked something through at their desk`
    );
  });

  /*
   * The whole reason the gate stayed shut: the digest's one `huddle` sentence
   * was written for a mob, and filing a pair through it would have said "the
   * team" about one person more often than it does now.
   */
  it('never calls one colleague the team', () => {
    seatPair([['partner', 'This retry loop is a prayer.']]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(getOfficeLogDigest()[0]).not.toContain('the team');
  });

  /*
   * Bodiless, like a chat and like an interruption's line: what was said rides
   * on the partner's own beat, which only they are handed. The room knows the
   * two of you talked, never what about.
   */
  it('keeps what was said out of the room’s record', () => {
    seatPair([
      ['partner', 'This retry loop is a prayer.'],
      ['you', 'So where does it belong?'],
      ['partner', 'Behind the queue, where you can see it fail.']
    ]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    const lines = getOfficeLogDigest();
    // One line, so "bodiless" is a claim about a record that exists rather
    // than a claim about an empty log.
    expect(lines).toHaveLength(1);
    const digest = lines.join(' ');
    expect(digest).not.toContain('retry loop');
    expect(digest).not.toContain('Behind the queue');
    // ...and the partner does have it, so this is a split rather than a loss.
    expect(workingMemoryPromptLines(PARTNER).join(' ')).toContain('Behind the queue');
  });

  /*
   * Public. A chair pulled up to your desk is drawn by both renderers and has
   * witnesses, so it is the `walkby` case rather than the `chat` one — a third
   * colleague may mention it.
   */
  it('tells the conversation to somebody who was not in it', () => {
    seatPair([['partner', 'This retry loop is a prayer.']]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(getOfficeLogDigest({ audience: 'dinesh' })).toHaveLength(1);
  });

  /*
   * `interrupt`'s exclusion, at its strongest: the partner's beat holds the
   * exchange verbatim and rides on the same `/moment` request, so "1 chat at
   * your desk" here would be a worse telling of the same conversation.
   */
  it('stays out of the relationship block the partner already carries', () => {
    seatPair([['partner', 'This retry loop is a prayer.']]);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(getOfficeRelationshipWith(PARTNER)).toEqual([]);
  });

  it('files nothing for a chair nobody spoke from', () => {
    startOfficeHuddle([PARTNER], { mode: 'pair' });

    expect(rememberPairHuddle(getOfficeSnapshot().huddle)).toBeNull();
    expect(getOfficeLogSnapshot()).toEqual([]);
  });

  /*
   * The mob keeps the path it had — `onOfficeEvent('huddled')` through
   * `useRunCeremony.js`, which is the only writer of the team sentence. Nothing
   * here may file a second entry for it.
   */
  it('files nothing for a mob, which has its own writer', () => {
    const id = startOfficeHuddle(['gilfoyle', 'dinesh', 'jared'], { mode: 'mob' });
    setOfficeHuddleBeats(id, [{ speakerId: 'dinesh', text: 'It is fine.' }]);
    recordOfficePairTurn(id, 'partner', 'It is fine.');

    expect(rememberPairHuddle(getOfficeSnapshot().huddle)).toBeNull();
    expect(getOfficeLogSnapshot()).toEqual([]);
  });

  it('files one line for one conversation however long it ran', () => {
    const turns = [];
    for (let i = 0; i < PAIR_TURNS_MAX; i += 1) {
      turns.push([i % 2 === 0 ? 'partner' : 'you', `line ${i}`]);
    }
    seatPair(turns);

    rememberPairHuddle(getOfficeSnapshot().huddle);
    expect(getOfficeLogSnapshot()).toHaveLength(1);
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
    // Both marks, from the one press, through the handler the overlay actually
    // calls — a unit that passes while `OfficeLayer` tears the chair down
    // silently looks exactly like a slice that works.
    expect(getOfficeLogDigest()[0]).toContain(
      `the user and ${PARTNER} talked something through at their desk`
    );
  });
});
