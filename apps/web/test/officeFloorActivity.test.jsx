// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { PersonaFace } from '../src/components/personaFaces/index.jsx';
import { PERSONA_FACE_TRAITS, personaFaceTraits } from '../src/components/personaFaces/registry.js';
import {
  FLOOR_HOLDS,
  FLOOR_POSES,
  baseDoingFor,
  conversationSpeakerId,
  deskDoingFor,
  floorActivityFor,
  meetingActivityFor
} from '../src/utils/officeFloorActivity.js';
import { DESK_WORK_DOING, OFFICE_DESK_WORK } from '../src/utils/officeDeskWork.js';
import {
  setOfficeCaptions,
  setOfficeHeadphones,
  setOfficeNarration
} from '../src/state/officeMomentStore.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';
import { OFFICE_DAY_PHASES } from '../src/utils/officeCadence.js';

/**
 * Slice 13 — what everybody is visibly doing.
 *
 * The derivation is pure and gets unit tests; the four things it is *for* get
 * render tests, because every one of them is a claim about a drawing and the
 * bug they replace ("the figure is there, it just says nothing") passes any
 * test that only asserts a figure rendered.
 */

function renderFloor(props = {}) {
  standUp();
  return render(<OfficeFloor {...props} />);
}

/** The figure inside a seat, which is where the accessory and hold live. */
function seatFigure(view, id) {
  return view.container.querySelector(`[data-seat="${id}"] .office-floor-person-figure`);
}

beforeEach(() => {
  setOfficeCaptions(true);
  setOfficeNarration(false);
});

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
  setOfficeHeadphones(false);
  setOfficeCaptions(false);
});

describe('the baked half — one row per character', () => {
  it('gives every cast member a `doing` the art can draw', () => {
    // Same drift guard as `look`: a new colleague costs one field, and a typo
    // silently falls through to `typing` where nothing would look wrong.
    for (const [id, work] of Object.entries(OFFICE_DESK_WORK)) {
      expect(DESK_WORK_DOING, `${id} is doing something unrenderable`).toContain(work.doing);
    }
  });

  it('maps every `doing` into the closed art sets', () => {
    for (const doing of DESK_WORK_DOING) {
      const art = deskDoingFor(
        Object.keys(OFFICE_DESK_WORK).find((id) => OFFICE_DESK_WORK[id].doing === doing)
      );
      expect(FLOOR_POSES, `${doing} has an unknown pose`).toContain(art.pose);
      if (art.hold) expect(FLOOR_HOLDS, `${doing} holds something undrawable`).toContain(art.hold);
    }
  });

  it('falls back to typing for the one person with no row, who is you', () => {
    // `officeDeskWork.test.js` pins that you have no row on purpose. Your desk
    // should still read like everybody else's rather than going inert.
    expect(deskDoingFor('you')).toEqual({ pose: 'typing', hold: null, headwear: null });
  });
});

describe('floorActivityFor precedence', () => {
  it('puts a call over your own headphones', () => {
    // You did not join the sync to listen to music, and two bits of headwear is
    // one drawing.
    const both = floorActivityFor('you', { onCall: true, headphones: true });
    expect(both.headwear).toBe('headset');
    expect(both.pose).toBe('call');
  });

  it('gives you headphones from the posture alone', () => {
    expect(floorActivityFor('you', { headphones: true }).headwear).toBe('headphones');
  });

  it('puts a coffee over whatever the trait row had in that hand', () => {
    // Gary is never without his mug; a coffee break still replaces it, because
    // a set piece is happening and a trait row is only generally true.
    expect(deskDoingFor('facilities').hold).toBe('mug');
    expect(floorActivityFor('facilities', { coffee: true }).hold).toBe('coffee');
  });

  it('drops the pose while moving but never the hand', () => {
    const walking = floorActivityFor('greybeard', { moving: true });
    expect(walking.pose).toBe('idle');
    // Ulrich crossing the room with his mug is going somewhere; Ulrich crossing
    // it empty-handed is lost.
    expect(walking.hold).toBe('mug');
  });

  it('puts what they picked up over the trait row, and a set piece over both', () => {
    // Ulrich's own mug is what he has generally; the printout is what he has
    // because he just walked to the printer.
    expect(deskDoingFor('greybeard').hold).toBe('mug');
    expect(floorActivityFor('greybeard', { carrying: 'papers' }).hold).toBe('papers');
    // The two never collide today (`coffee` only ever describes you, `carrying`
    // only ever a wanderer), but the order is the documented one.
    expect(floorActivityFor('greybeard', { coffee: true, carrying: 'papers' }).hold).toBe('coffee');
  });

  it('leaves the hand alone when they picked nothing up', () => {
    // The whiteboard hands over nothing, and "nothing" must not read as "empty
    // hand" — they still have their own mug.
    expect(floorActivityFor('greybeard', { carrying: null }).hold).toBe('mug');
    expect(floorActivityFor('greybeard', {}).hold).toBe('mug');
  });

  it('carries what it was given across a walk', () => {
    // The whole point: the hold has to survive `moving`, or the errand is only
    // visible in the one frame they are stood still.
    const walkingBack = floorActivityFor('greybeard', { moving: true, carrying: 'coffee' });
    expect(walkingBack.pose).toBe('idle');
    expect(walkingBack.hold).toBe('coffee');
  });
});

describe('who is talking', () => {
  const history = [
    { colleagueId: 'intern', body: 'hello?', outbound: false },
    { colleagueId: 'greybeard', body: 'We tried that in 1979.', outbound: false }
  ];

  it('follows the newest turn rather than who you walked up to', () => {
    expect(conversationSpeakerId(history, 'greybeard', 'you')).toBe('greybeard');
    expect(
      conversationSpeakerId(
        [...history, { colleagueId: 'greybeard', outbound: true }],
        'greybeard',
        'you'
      )
    ).toBe('you');
  });

  it('marks nobody before anything has been said', () => {
    // The opener is in flight: nobody has spoken, so nobody is lit. Slice 8 lit
    // your partner from the moment you arrived, which answers a different
    // question ("who are you with").
    expect(conversationSpeakerId(history, 'scrumMaster', 'you')).toBeNull();
    expect(conversationSpeakerId([], 'greybeard', 'you')).toBeNull();
    expect(conversationSpeakerId(history, null, 'you')).toBeNull();
  });
});

describe('the drawing', () => {
  /*
   * These mount the real floor, so unlike the pure-function tests below they
   * read the *wall clock* — and the hour is rung 5 of `floorActivityFor`, above
   * the trait row. That made every assertion here about what a character's own
   * row says they hold silently time-dependent: during `earlyMorning` the whole
   * cast holds `PHASE_ART`'s mug (so Russ's phone is a mug and Gilfoyle's empty
   * hands are not empty), and during `standUp` nobody holds anything at all, so
   * "actually draws the item" finds no art. Measured: red for roughly seven and
   * a half hours a day (06:00–09:30 and 16:30–20:00 local) and green the rest,
   * which is why it survived — CI happened to run in the quiet window.
   *
   * Pinned to midday, which is deliberately one of the two phases with no
   * `PHASE_ART` entry, so the trait row is what reaches the drawing. Only
   * `Date` is faked: the floor's own poll timer and React's scheduling must
   * keep running or nothing renders.
   */
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws headphones differently from a headset', () => {
    // Both are a band and two cups at 34 px; the distinction is the boom, and a
    // shared drawing would make the Admin posture read as "you are on a call".
    const { container: phones } = render(
      <PersonaFace id="gilfoyle" accessoryOverride="headphones" />
    );
    const headphones = phones.querySelector('svg').innerHTML;
    expect(headphones.length).toBeGreaterThan(0);
    cleanup();
    const { container: set } = render(<PersonaFace id="gilfoyle" accessoryOverride="headset" />);
    expect(set.querySelector('svg').innerHTML).not.toBe(headphones);
  });

  it('puts your headphones on you, and on nobody else, when the posture is on', () => {
    setOfficeHeadphones(true);
    const view = renderFloor();
    expect(seatFigure(view, 'you').querySelector('[data-accessory="headphones"]')).toBeTruthy();
    expect(seatFigure(view, 'gilfoyle').querySelector('[data-accessory="headphones"]')).toBeNull();
  });

  it('takes them off again when the posture goes off', () => {
    setOfficeHeadphones(true);
    const on = renderFloor();
    expect(seatFigure(on, 'you').querySelector('[data-accessory="headphones"]')).toBeTruthy();
    cleanup();
    setOfficeHeadphones(false);
    const off = renderFloor();
    expect(seatFigure(off, 'you').querySelector('[data-accessory="headphones"]')).toBeNull();
  });

  it('gives the cast what their row says they are holding', () => {
    const view = renderFloor();
    // Ulrich's mug and Russ's phone are the two ends of the vocabulary.
    expect(seatFigure(view, 'greybeard').dataset.hold).toBe('mug');
    expect(seatFigure(view, 'russ').dataset.hold).toBe('phone');
    // Typing is the empty-handed one, and most of the room is typing.
    expect(seatFigure(view, 'gilfoyle').dataset.hold).toBeUndefined();
    expect(seatFigure(view, 'gilfoyle').className).toMatch(/is-pose-typing/);
    expect(seatFigure(view, 'gilfoyle').querySelector('.office-floor-person-hold')).toBeNull();
  });

  it('actually draws the item, not just the marker attribute', () => {
    // `data-hold` is what the tests above read, and it would keep passing with
    // `HeldItem` returning nothing for every value — which is exactly what a
    // renamed case or a broken import looks like from the outside.
    const view = renderFloor();
    for (const id of ['greybeard', 'russ', 'hr']) {
      const layer = seatFigure(view, id).querySelector('.office-floor-person-hold');
      expect(layer, `${id} has a hold marker and no art`).toBeTruthy();
      expect(layer.innerHTML.length, `${id}'s item is empty`).toBeGreaterThan(0);
    }
  });

  it('hands a coffee to everyone in a coffee break', () => {
    const view = renderFloor({
      coffee: {
        id: 'coffee-1',
        accepted: true,
        lines: [
          { speakerId: 'intern', text: 'Is it meant to make that noise?' },
          { speakerId: 'greybeard', text: 'It has made that noise since 1979.' }
        ]
      }
    });
    for (const id of ['intern', 'greybeard']) {
      const actor = screen.getByTestId(`office-floor-scene-actor-${id}`);
      expect(actor.querySelector('.office-floor-person-figure').dataset.hold).toBe('coffee');
    }
    // And to you — you are stood at the machine having one (`useFloorCoffeeWalk`).
    expect(
      screen.getByTestId('office-floor-player').querySelector('.office-floor-person-figure').dataset
        .hold
    ).toBe('coffee');
  });

  it('marks the current speaker in a set piece, not both participants', () => {
    const view = renderFloor({
      coffee: {
        id: 'coffee-2',
        accepted: true,
        lines: [
          { speakerId: 'intern', text: 'Is it meant to make that noise?' },
          { speakerId: 'greybeard', text: 'It has made that noise since 1979.' }
        ]
      }
    });
    const marked = view.container.querySelectorAll('.office-floor-scene-actor.is-speaking');
    expect(marked.length).toBe(1);
    // Which of the two it is depends on where `useScenePacing` has got to, so
    // the assertion is the invariant rather than the beat: the marked one is
    // the one with the balloon.
    expect(marked[0].querySelector('.office-floor-bubble')).toBeTruthy();
  });
});

describe('the office day reaches the figures (slice 20)', () => {
  /**
   * Dave is the test subject throughout because his row is the one § 8 named:
   * "in his headset at 4 pm exactly as at 9 am" was the whole complaint.
   */
  const DAVE = 'helpdesk';

  it('leaves the trait rows alone at the two phases that have no art', () => {
    // Midday is the baseline on purpose — the longest stretch of the day is
    // the one where the baked characterization is what you see.
    for (const phase of ['midday', 'afterHours']) {
      expect(baseDoingFor(DAVE, phase)).toEqual(deskDoingFor(DAVE));
    }
    // And no phase at all is identical to midday, so an unphased mount (a
    // standalone `FloorScene`, an older caller) draws exactly what it used to.
    expect(baseDoingFor(DAVE, null)).toEqual(deskDoingFor(DAVE));
  });

  it('gives the whole room the hour, including the people with strong rows', () => {
    // The premise § 8 complained about: Dave's row really is the headset, so
    // the assertions below are overrides rather than coincidences.
    expect(deskDoingFor(DAVE).headwear).toBe('headset');
    // Whole-office rather than per-person: sixteen mugs reads as 9 am, four
    // reads as four people who happen to have mugs.
    expect(floorActivityFor(DAVE, { dayPhase: 'earlyMorning' }).hold).toBe('mug');
    expect(floorActivityFor(DAVE, { dayPhase: 'earlyMorning' }).headwear).toBe(null);
    expect(floorActivityFor(DAVE, { dayPhase: 'windDown' }).hold).toBe('papers');
    // Russ's row is `phone`, so this is a real override rather than a value
    // that happened to already be there.
    expect(deskDoingFor('russ').hold).toBe('phone');
    expect(floorActivityFor('russ', { dayPhase: 'earlyMorning' }).hold).toBe('mug');
    // The remote stand-up: everybody on the call, nobody in the same room.
    expect(floorActivityFor('russ', { dayPhase: 'standUp' }).headwear).toBe('headset');
  });

  it('never invents art outside the closed vocabularies', () => {
    for (const phase of ['earlyMorning', 'standUp', 'midday', 'windDown', 'afterHours']) {
      const art = floorActivityFor(DAVE, { dayPhase: phase });
      expect(FLOOR_POSES).toContain(art.pose);
      if (art.hold !== null) expect(FLOOR_HOLDS).toContain(art.hold);
    }
  });

  it('loses to every live input, because those are things happening', () => {
    // An actual call outranks the hour: Dave on a sync at 8 am wears the
    // headset he would otherwise have swapped for a mug.
    const onCall = floorActivityFor(DAVE, { dayPhase: 'earlyMorning', onCall: true });
    expect(onCall.headwear).toBe('headset');
    expect(onCall.pose).toBe('call');

    // Your own Headphones posture is still yours at any hour.
    expect(floorActivityFor(DAVE, { dayPhase: 'windDown', headphones: true }).headwear).toBe(
      'headphones'
    );

    // A set piece and an errand both own the hand over the hour.
    expect(floorActivityFor(DAVE, { dayPhase: 'windDown', coffee: true }).hold).toBe('coffee');
    expect(floorActivityFor(DAVE, { dayPhase: 'earlyMorning', carrying: 'papers' }).hold).toBe(
      'papers'
    );
  });

  it('moves hands and posture, and leaves a baked face accessory alone', () => {
    // Found in a browser capture, and recorded because it is a decision rather
    // than a gap. `PersonaFace` resolves `accessoryOverride ?? traits.accessory`,
    // so the `headwear: null` an hour like earlyMorning produces means "no
    // override" and Dave keeps the headset that is part of his *face*. Only the
    // explicit 'none' would strip it, and letting the clock erase somebody's
    // face is a much larger claim than letting it hand them a mug.
    expect(personaFaceTraits(DAVE).accessory).toBe('headset');
    expect(floorActivityFor(DAVE, { dayPhase: 'earlyMorning' })).toEqual({
      pose: 'idle',
      hold: 'mug',
      headwear: null
    });
    // He is the only one it could apply to, which is why it stays a footnote:
    // every other baked accessory is a neck or chest item and nothing about the
    // hour ever competes with it.
    const headsets = Object.values(PERSONA_FACE_TRAITS).filter(
      (row) => row.accessory === 'headset'
    );
    expect(headsets.length).toBe(1);
  });

  it('lands the hour on the floor root, where the light reads it', () => {
    // The stylesheet is the only consumer of this attribute, so the contract
    // is that it exists and carries a phase — not what colour it produces.
    const view = renderFloor();
    const floor = view.container.querySelector('.office-floor');
    expect(OFFICE_DAY_PHASES).toContain(floor.dataset.dayPhase);
  });
});

describe('what people bring to a meeting (slice 29)', () => {
  it('gives the agenda to whoever called it, and to nobody else', () => {
    expect(meetingActivityFor('scrumMaster', { facilitator: true })).toEqual({
      pose: 'reading',
      hold: 'papers',
      headwear: null
    });
    expect(meetingActivityFor('scrumMaster', { facilitator: false }).hold).toBe(null);
  });

  it('seats everybody else with the hour, and empty-handed when it has none', () => {
    expect(meetingActivityFor('gilfoyle', { dayPhase: 'earlyMorning' }).hold).toBe('mug');
    expect(meetingActivityFor('gilfoyle', { dayPhase: 'windDown' }).hold).toBe('papers');
    // Midday is the baseline hour and has no art, so the table is listening.
    expect(meetingActivityFor('gilfoyle', { dayPhase: 'midday' })).toEqual({
      pose: 'idle',
      hold: null,
      headwear: null
    });
    // An unphased mount is the same, so a standalone `FloorMeeting` with no
    // day-phase prop draws exactly what a midday one does.
    expect(meetingActivityFor('gilfoyle', {})).toEqual(
      meetingActivityFor('gilfoyle', { dayPhase: 'midday' })
    );
  });

  it('never wears the hour’s headset, because that is the other modality', () => {
    // The premise: `standUp` really is a headset for the room's standing
    // population, so this is an override rather than a value that was absent.
    expect(floorActivityFor('gilfoyle', { dayPhase: 'standUp' }).headwear).toBe('headset');
    // But these people walked to a room, and a headset in the glass room draws
    // the *remote* modality on top of the physical one.
    for (const phase of OFFICE_DAY_PHASES) {
      expect(meetingActivityFor('gilfoyle', { dayPhase: phase }).headwear, phase).toBe(null);
      expect(meetingActivityFor('gilfoyle', { dayPhase: phase }).pose, phase).not.toBe('call');
    }
  });

  it('never seats the desk trait row, which is the one thing a meeting is sure is wrong', () => {
    // Russ takes calls and Gilfoyle types — at their desks. Neither survives
    // being summoned, at any hour, which is the whole claim of the rule.
    expect(deskDoingFor('russ').hold).toBe('phone');
    expect(deskDoingFor('gilfoyle').pose).toBe('typing');
    for (const phase of [...OFFICE_DAY_PHASES, null]) {
      expect(meetingActivityFor('russ', { dayPhase: phase }).hold, phase).not.toBe('phone');
      expect(meetingActivityFor('gilfoyle', { dayPhase: phase }).pose, phase).not.toBe('typing');
    }
    // The companion claim: the sweep above is examining something. Without it,
    // an `OFFICE_DAY_PHASES` that went empty would pass every assertion in it.
    expect(OFFICE_DAY_PHASES.length).toBeGreaterThan(0);
  });

  it('never invents art outside the closed vocabularies', () => {
    for (const facilitator of [true, false]) {
      for (const phase of [...OFFICE_DAY_PHASES, null]) {
        const art = meetingActivityFor('gilfoyle', { facilitator, dayPhase: phase });
        expect(FLOOR_POSES).toContain(art.pose);
        if (art.hold !== null) expect(FLOOR_HOLDS).toContain(art.hold);
      }
    }
  });
});
