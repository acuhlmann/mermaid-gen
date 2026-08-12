/**
 * ADR-0011 executable contracts for isometric mode.
 *
 * These tests encode architecture rules agents must not break when extending
 * the floor. Prefer adding an assertion here over repeating prose in comments.
 */

import { describe, expect, it } from 'vitest';
import { floorAnnouncement } from '../src/components/officeFloor/floorAnnouncement.js';
import { FLOOR_PROP_USES, propUseFor } from '../src/utils/officeFloorProps.js';
import { reachTileFor, whereaboutsOf } from '../src/utils/officeFloorReach.js';
import { approachTileFor, propTileFor } from '../src/utils/officeFloorMovement.js';
import { officeChromeCopy, officeSenderInfo } from '../src/utils/officeCast.js';
import { isStandableTile, seatFor, YOU_SEAT_ID } from '../src/utils/officeFloorPlan.js';
import { wanderTripsFor, wanderingSeatIds } from '../src/utils/officeFloorWander.js';
import { boardFrom } from '../src/utils/officeFloorBoard.js';
import { overheardPartnerFor, shopTalkExchange } from '../src/utils/officeFloorShopTalk.js';

const copy = officeChromeCopy().floor;
const lines = copy.narration;

describe('ADR-0011 rule 2 — diegesis duplicates, never replaces', () => {
  it('only the coffee machine wires through to a desk verb', () => {
    /*
     * Asserted as "which kinds carry a verb" rather than as whole rows: the
     * contract in the title is about the `verb` column alone, and pinning the
     * entire object shape here made an unrelated column (`hands`) fail a test
     * about ADR-0011 rule 2, which is a false alarm in the one file that should
     * never cry wolf.
     */
    const withVerb = FLOOR_PROP_USES.filter((row) => row.verb);
    expect(withVerb.map((row) => row.kind)).toEqual(['coffeeMachine']);
    expect(propUseFor('coffeeMachine')?.verb).toBe('coffee');
    expect(propUseFor('printer')?.verb).toBeNull();
    expect(propUseFor('whiteboard')?.verb).toBeNull();
  });

  it('putting something in a hand is not wiring through to a verb', () => {
    /*
     * Rule 2's boundary, now that a prop can also hand something over. The
     * printer fills a hand and still produces nothing — a printout somebody is
     * carrying is scenery, not an artifact (ADR-0010's Sign-off rule). If a
     * `hands` value ever starts implying a `verb`, that is the rule bending.
     */
    const handsWithoutVerb = FLOOR_PROP_USES.filter((row) => row.hands && !row.verb);
    expect(handsWithoutVerb.map((row) => row.kind)).toEqual(['printer']);
  });

  it('lists every prop kind exactly once', () => {
    const kinds = FLOOR_PROP_USES.map((row) => row.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});

describe('spatial narration never quotes speech (slice 10)', () => {
  it('floorAnnouncement names people and places, not their lines', () => {
    const intern = officeSenderInfo('intern');
    const introSnippet = intern.introLine?.slice(0, 24) ?? '';
    const said = floorAnnouncement({
      copy,
      talk: { colleagueId: 'intern', phase: 'talking' }
    });
    expect(said.text).toContain(intern.name);
    if (introSnippet.length > 8) {
      expect(said.text).not.toContain(introSnippet);
    }
  });

  it('walk-by narration says they are arriving, not what they said', () => {
    const said = floorAnnouncement({
      copy,
      walkBy: { id: 'w1', colleagueId: 'greybeard' }
    });
    expect(said.text).toMatch(/walking over/i);
    expect(said.text).not.toMatch(/mainframe/i);
  });
});

describe('geometry POV — isStandableTile excludeSeatId (§6 rule 27)', () => {
  it('defaults to skipping your seat in face clearance', () => {
    const you = seatFor(YOU_SEAT_ID);
    expect(you).toBeTruthy();
    expect(isStandableTile({ x: you.x, y: you.y })).toBe(false);
  });

  it('can validate a wanderer mark against every seat including yours', () => {
    for (const id of wanderingSeatIds()) {
      for (const trip of wanderTripsFor(id)) {
        expect(isStandableTile(trip.mark, { excludeSeatId: id })).toBe(true);
        expect(isStandableTile(trip.mark, { excludeSeatId: YOU_SEAT_ID })).toBe(
          isStandableTile(trip.mark)
        );
      }
    }
  });
});

describe('only a settled figure is reachable (slice 12)', () => {
  /*
   * The invariant, stated once: a verb the room cannot honour must not render,
   * and the room's answer is a **mark**. Everything downstream — whether
   * `FloorWanderer` draws a button, whether the person card offers _Go and
   * talk_ — is that mark existing, so this is the only place the rule needs to
   * hold.
   */
  const trip = (phase) => ({
    seatId: 'intern',
    kind: 'printer',
    to: propTileFor('printer'),
    phase
  });

  it('gives a mark for somebody stood still, and none for somebody mid-stride', () => {
    const settled = whereaboutsOf('intern', { wanderer: trip('dwell') });
    expect(settled.tile).toEqual(propTileFor('printer'));
    expect(reachTileFor('intern', settled)).toBeTruthy();

    for (const phase of ['out', 'home']) {
      const walking = whereaboutsOf('intern', { wanderer: trip(phase) });
      expect(walking.tile, phase).toBeNull();
      expect(reachTileFor('intern', walking), phase).toBeNull();
    }
  });

  it('never offers a second way to reach somebody a moment already owns', () => {
    // A scene or the glass room is drawing them with chrome of its own, and
    // § 6 rule 5 does not allow two of anybody.
    const claimed = whereaboutsOf('intern', { awayIds: ['intern'] });
    expect(reachTileFor('intern', claimed)).toBeNull();
  });

  it('aims at where they are, not at the chair they left', () => {
    const settled = whereaboutsOf('intern', { wanderer: trip('dwell') });
    expect(reachTileFor('intern', settled)).not.toEqual(reachTileFor('intern', null));
    // And somebody who has not moved still gets the plain seat approach.
    expect(reachTileFor('intern', null)).toEqual(approachTileFor('intern'));
  });
});

describe('card-slot narration order matches floorAnnouncement priority', () => {
  it('meeting beats talk beats peek beats prop beats walk-by beats join beats roam', () => {
    const stack = {
      copy,
      meeting: { state: 'playing' },
      talk: { colleagueId: 'intern', phase: 'talking' },
      peek: { colleagueId: 'intern', phase: 'looking' },
      prop: { propKind: 'printer', phase: 'using' },
      presence: { phase: 'standing', key: 1 },
      walkBy: { id: 'w1', colleagueId: 'intern' },
      join: { colleagueId: 'intern', partnerId: 'dinesh', kind: 'whiteboard' }
    };
    expect(floorAnnouncement(stack).text).toBe(lines.inMeeting);
    expect(floorAnnouncement({ ...stack, meeting: null }).key).toMatch(/^talk:/);
    expect(floorAnnouncement({ ...stack, meeting: null, talk: null }).key).toMatch(/^peek:/);
    expect(floorAnnouncement({ ...stack, meeting: null, talk: null, peek: null }).key).toMatch(
      /^prop:/
    );
    expect(
      floorAnnouncement({ ...stack, meeting: null, talk: null, peek: null, prop: null }).key
    ).toMatch(/^walkby:/);
    /*
     * Slice 23's rung, and the reason the whole chain is asserted rather than
     * the new pair alone: the live region is a *third renderer* of the card
     * slot's ordering (ADR-0011 rule 1 applied to narration), so a card added
     * without its sentence — or with the sentence in a different place — is two
     * surfaces disagreeing about what you are doing.
     */
    const idle = { ...stack, meeting: null, talk: null, peek: null, prop: null, walkBy: null };
    expect(floorAnnouncement(idle).key).toMatch(/^join:/);
    expect(floorAnnouncement({ ...idle, join: null }).key).toMatch(/^roam:/);
  });
});

/**
 * Slice 16 — the room shows your work. Three doctrines meet on this feature,
 * and each of them is one line away from being broken by a well-meaning edit.
 */
describe('ADR-0010 / ADR-0011 — showing your work in the room', () => {
  const source = 'flowchart LR\n  a[Client] --> b[API]';

  it('derives and stores nothing (ADR-0011 rule 1)', () => {
    // Same source, same board — twice, with nothing in between. A board that
    // remembered anything (a last-seen count, a "has changed" flag) would show
    // up here as two different answers.
    const first = boardFrom({ contentType: 'mermaid', diagramSource: source });
    const second = boardFrom({ contentType: 'mermaid', diagramSource: source });
    expect(second).toEqual(first);
    // And the empty slot never inherits the last one.
    expect(boardFrom({ contentType: 'mermaid', diagramSource: '' })).toBeNull();
  });

  it('leaves the whiteboard producing nothing (ADR-0011 rule 2)', () => {
    /*
     * The board is a second *view* of your diagram, never a second editor. If a
     * later slice gives the whiteboard a `verb`, it stops duplicating a desk
     * control and starts being the only way to do something — which is the
     * exact thing rule 2 forbids, and the reason `usablePropKinds()` treats it
     * as a prop that produces nothing but a line.
     */
    expect(propUseFor('whiteboard')?.verb ?? null).toBeNull();
  });

  it('shows only your own content, never the cast’s (ADR-0010)', () => {
    /*
     * Every field the board carries is derived from `diagramSource`. Nothing on
     * it is authored by a colleague, and the room has no way to write to it —
     * which is what keeps "the office generates no artifacts" true even though
     * the office now has something of yours on the wall.
     */
    const board = boardFrom({ contentType: 'mermaid', diagramSource: source });
    expect(board.labels).toEqual(['Client', 'API']);
    expect(Object.keys(board).sort()).toEqual(
      ['bars', 'edges', 'kind', 'labels', 'mini', 'nodes', 'shape'].sort()
    );
  });
});

describe('office-parody §11 — an overheard exchange is spent on you, not on a timer', () => {
  const trip = {
    seatId: 'gilfoyle',
    kind: 'whiteboard',
    to: propTileFor('whiteboard'),
    phase: 'dwell',
    leg: 1
  };

  /**
   * The clause that licenses slice 22 at all, and the one a later slice is most
   * likely to erode by accident.
   *
   * Slice 11 sealed ambient floor traffic silent — "the instant a wanderer could
   * say something they would be a walk-by" — and CLAUDE.md states the durable
   * form of it: do not give ambience a second reason to talk. Shop talk is legal
   * because nothing is addressed to the user *and* nothing exists unless the
   * user is stood near enough to hear it, so the room never chatters to itself
   * in a corner nobody is in. Delete the earshot gate and the mechanic still
   * looks fine in every screenshot while quietly becoming the thing this whole
   * program has been unwinding.
   */
  it('cannot exist while nobody is there to overhear it', () => {
    expect(overheardPartnerFor(trip, null, { wanderer: trip })).toBeNull();
    const acrossTheRoom = { x: 1, y: 8 };
    expect(overheardPartnerFor(trip, acrossTheRoom, { wanderer: trip })).toBeNull();
  });

  it('produces nothing — no pitch, no prompt, no way to answer', () => {
    /*
     * ADR-0010's one-producer clause seen from the audience's side. A walk-by
     * carries an `actionPrompt` and lands in a thread because it is addressed to
     * you; this carries a speaker and a string and nothing else, which is the
     * whole difference between scenery with words and a moment.
     */
    const exchange = shopTalkExchange(trip, 'dinesh', copy, 0);
    for (const line of exchange.lines) {
      expect(Object.keys(line).sort()).toEqual(['speakerId', 'text']);
      expect(line.speakerId).not.toBe(YOU_SEAT_ID);
    }
  });

  /**
   * Slice 23, and the clause it had to get past to exist at all.
   *
   * The test above says the exchange offers no way to answer; joining looks at
   * first glance like exactly such a way, and the distinction that keeps both
   * true is that **join is a walk, not a reply**. What the offer carries is two
   * seat ids and a prop kind — no line, no quote of what was said, no
   * `actionPrompt` — so nothing you press is attached to the sentence you
   * overheard. Taking it walks you over and hands you an empty composer, which
   * is what walking up to anybody has always done (slice 8: you speak first).
   *
   * If a `text`, a `line` or a prompt ever appears on this object, the exchange
   * has started addressing the user and belongs in the moment store as a
   * walk-by instead.
   */
  it('offers a walk, never a reply (slice 23)', () => {
    const listening = { x: propTileFor('whiteboard').x, y: propTileFor('whiteboard').y + 2 };
    const partner = overheardPartnerFor(trip, listening, { wanderer: trip });
    expect(partner, 'nobody to overhear — the rest of this proves nothing').toBeTruthy();

    // The shape the view is handed, built the way `useFloorShopTalk` builds it.
    const offer = { colleagueId: trip.seatId, partnerId: partner, kind: trip.kind };
    expect(Object.keys(offer).sort()).toEqual(['colleagueId', 'kind', 'partnerId']);

    const exchange = shopTalkExchange(trip, partner, copy, 0);
    const spoken = exchange.lines.map((line) => line.text).join(' ');
    for (const value of Object.values(offer)) {
      expect(spoken, 'the offer must not carry the line it came from').not.toContain(value);
    }

    // And the two people it names are the two who were talking — you are not
    // one of them, before or after.
    expect([offer.colleagueId, offer.partnerId]).not.toContain(YOU_SEAT_ID);
  });
});
