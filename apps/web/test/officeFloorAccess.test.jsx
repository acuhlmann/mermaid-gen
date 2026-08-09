// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import FloorLiveRegion from '../src/components/officeFloor/FloorLiveRegion.jsx';
import { floorAnnouncement } from '../src/components/officeFloor/floorAnnouncement.js';
import { useWalkAnimation } from '../src/components/officeFloor/useWalkAnimation.js';
import { officeChromeCopy, officeSenderInfo } from '../src/utils/officeCast.js';
import { projectIso } from '../src/utils/officeFloorPlan.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';

/**
 * The floor, for somebody who is not looking at it (slice 10).
 *
 * Behaviour only. The slice's other half is CSS whose consequences have no
 * runtime shape — jsdom has no layout engine and Vitest stubs stylesheet
 * imports to empty — and lives in `officeFloorStyles.test.js`.
 */

const copy = officeChromeCopy().floor;
const lines = copy.narration;
const CHAD = officeSenderInfo('intern').name;

afterEach(() => {
  cleanup();
  _resetOfficeViewModeForTests();
});

describe('floorAnnouncement', () => {
  it('ranks by how much of your body is committed, like the card slot', () => {
    const everything = {
      copy,
      meeting: { state: 'playing' },
      talk: { colleagueId: 'gilfoyle', phase: 'talking' },
      peek: { colleagueId: 'intern', phase: 'looking' },
      prop: { propKind: 'printer', phase: 'using' },
      presence: { phase: 'standing', key: 3 },
      walkBy: { id: 'w1', colleagueId: 'intern' }
    };

    // Peeling the top item off must reveal exactly the next one down.
    expect(floorAnnouncement(everything).text).toBe(lines.inMeeting);
    expect(floorAnnouncement({ ...everything, meeting: null }).key).toMatch(/^talk:/);
    expect(floorAnnouncement({ ...everything, meeting: null, talk: null }).key).toMatch(/^peek:/);
    expect(floorAnnouncement({ ...everything, meeting: null, talk: null, peek: null }).key).toMatch(
      /^prop:/
    );
    expect(
      floorAnnouncement({ ...everything, meeting: null, talk: null, peek: null, prop: null }).key
    ).toMatch(/^walkby:/);
  });

  it('says where you are rather than what anybody said', () => {
    const walking = floorAnnouncement({
      copy,
      peek: { colleagueId: 'intern', phase: 'walking' }
    });
    const arrived = floorAnnouncement({
      copy,
      peek: { colleagueId: 'intern', phase: 'looking' }
    });

    expect(walking.text).toMatch(/^Walking over to /);
    expect(arrived.text).toMatch(/^Standing at /);
    // Both name the person; neither quotes them. The bubble owns the line.
    expect(walking.text).toContain(CHAD);
    expect(arrived.text).toContain(CHAD);
  });

  it('names the prop it walked you to, not its kind', () => {
    const said = floorAnnouncement({ copy, prop: { propKind: 'coffeeMachine', phase: 'using' } });
    expect(said.text).toContain(copy.props.items.coffeeMachine.name);
    expect(said.text).not.toContain('coffeeMachine');
  });

  it('gives each walk its own key even when the wording is identical', () => {
    const first = floorAnnouncement({ copy, presence: { phase: 'walking', key: 1 } });
    const second = floorAnnouncement({ copy, presence: { phase: 'walking', key: 2 } });

    // Interrupting a walk with another walk: same sentence, different event.
    expect(second.text).toBe(first.text);
    expect(second.key).not.toBe(first.key);
  });

  it('treats no presence as your own chair, which is also how the floor opens', () => {
    expect(floorAnnouncement({ copy }).text).toBe(lines.atDesk);
  });
});

describe('FloorLiveRegion', () => {
  it('is in the document before it has anything to say', () => {
    render(<FloorLiveRegion message="" eventKey="desk" />);
    const region = screen.getByTestId('office-floor-narration');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
  });

  it('mutates the text node again when the same sentence repeats', () => {
    const view = render(<FloorLiveRegion message="Walking across the floor." eventKey="roam:1" />);
    const region = screen.getByTestId('office-floor-narration');
    const first = region.textContent;

    view.rerender(<FloorLiveRegion message="Walking across the floor." eventKey="roam:2" />);

    /*
     * A live region speaks because its contents changed. Identical text is not
     * a change, so the second walk would be silent — the pad is what makes the
     * announcement happen without altering a word of it.
     */
    expect(region.textContent).not.toBe(first);
    expect(region.textContent.trim()).toBe('Walking across the floor.');
  });

  it('stays put when nothing new happened', () => {
    const view = render(<FloorLiveRegion message="At your own desk." eventKey="desk" />);
    const region = screen.getByTestId('office-floor-narration');
    const first = region.textContent;

    view.rerender(<FloorLiveRegion message="At your own desk." eventKey="desk" />);

    expect(region.textContent).toBe(first);
  });

  // Same event (still at reception) but the sentence was rewritten for a new
  // locale — keep the region current without forcing a pad flip.
  it('rewrites the wording when the same event changes language', () => {
    const view = render(
      <FloorLiveRegion message="At reception. Sign in to begin." eventKey="arrival:reception" />
    );
    const region = screen.getByTestId('office-floor-narration');
    expect(region.textContent).toMatch(/At reception/);

    view.rerender(<FloorLiveRegion message="在前台。签到开始。" eventKey="arrival:reception" />);

    expect(region.textContent).toBe('在前台。签到开始。');
  });
});

describe('the floor narrates itself', () => {
  it('tells you where you are on arrival and after a walk', () => {
    standUp();
    render(<OfficeFloor />);
    const region = screen.getByTestId('office-floor-narration');
    expect(region.textContent).toBe(lines.atDesk);

    const { left, top } = projectIso(4, 3);
    fireEvent.click(screen.getByTestId('office-floor-roam'), { clientX: left, clientY: top });

    // No WAAPI engine here, so the walk settles in the same tick and the
    // announcement is the arrival rather than the departure.
    expect(region.textContent).toBe(lines.standingFloor);
  });

  it('leaves the announcing to one region, not to each card', () => {
    standUp();
    const view = render(<OfficeFloor />);

    // Every other live region on the floor is a speech bubble, which stays
    // mounted while its text changes underneath — the shape that works. A card
    // arriving with its text already in it is the shape that does not.
    const live = [...view.container.querySelectorAll('[aria-live]')];
    expect(live).toHaveLength(1);
    expect(live[0].dataset.testid).toBe('office-floor-narration');
  });
});

describe('reduced motion is a decision, not an accident', () => {
  it('places the walker at the destination without animating it', () => {
    const el = document.createElement('div');
    el.animate = vi.fn();
    vi.stubGlobal('matchMedia', (query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener() {},
      removeEventListener() {}
    }));
    const onArrive = vi.fn();

    function Harness() {
      useWalkAnimation(
        { current: el },
        [
          { x: 0, y: 0 },
          { x: 6, y: 2 }
        ],
        { walkKey: 'still', onArrive }
      );
      return null;
    }
    render(<Harness />);

    const { left, top } = projectIso(6, 2);
    expect(el.animate).not.toHaveBeenCalled();
    expect(el.style.transform).toBe(`translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`);
    // The beat still happens — you arrive, you just did not travel. Every
    // jsdom floor suite leans on this, which is why it is worth stating.
    expect(onArrive).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
