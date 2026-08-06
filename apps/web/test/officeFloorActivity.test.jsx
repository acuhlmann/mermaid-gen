// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { PersonaFace } from '../src/components/personaFaces/index.jsx';
import {
  FLOOR_HOLDS,
  FLOOR_POSES,
  conversationSpeakerId,
  deskDoingFor,
  floorActivityFor
} from '../src/utils/officeFloorActivity.js';
import { DESK_WORK_DOING, OFFICE_DESK_WORK } from '../src/utils/officeDeskWork.js';
import {
  setOfficeCaptions,
  setOfficeHeadphones,
  setOfficeNarration
} from '../src/state/officeMomentStore.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';

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
