// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { FloorPropCard } from '../src/components/officeFloor/FloorProps.jsx';
import {
  isOfficeColleagueId,
  officeChromeCopy,
  setActiveOfficeBundle
} from '../src/utils/officeCast.js';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import { deskWorkFor } from '../src/utils/officeDeskWork.js';
import {
  BOARD_MAX_NOTES,
  BOARD_NOTE_KINDS,
  BOARD_NOTE_PROMPT_KEYS,
  boardNoteMarks,
  boardNotePromptLines,
  boardNotesFor
} from '../src/utils/officeFloorNotes.js';
import { usablePropKinds } from '../src/utils/officeFloorMovement.js';
import { propUseFor } from '../src/utils/officeFloorProps.js';
import { PRINTOUT_MAX_ROWS, printoutFrom } from '../src/utils/officeFloorBoard.js';
import FloorFigure from '../src/components/officeFloor/FloorFigure.jsx';
import {
  _resetOfficeLogForTests,
  getOfficeLogDigest,
  getOfficeLogSnapshot,
  recordOfficeLogEntry
} from '../src/state/officeLogStore.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import { renderFloor, unpinOfficeFloorDeterminism } from './helpers/officeFloorTestUtils.jsx';

/**
 * Props you can use (slice 9) — ADR-0011 rule 2's first worked example on the
 * floor: the coffee machine pours the same break the desk dock's labelled
 * *Get coffee* pours, through the same verb.
 *
 * As in the peek and talk suites, jsdom has no WAAPI engine so `useWalkAnimation`
 * settles immediately — clicking the machine lands you at it in one tick, which
 * is also exactly the reduced-motion behaviour.
 */

const machine = () => screen.getByRole('button', { name: /Coffee machine/i });

afterEach(() => {
  cleanup();
  unpinOfficeFloorDeterminism();
  _resetOfficeViewModeForTests();
  _resetOfficeLogForTests();
  // The prompt-face suite at the foot of this file switches the chrome bundle
  // to prove the board's prompt lines do *not* follow it.
  setActiveOfficeBundle(null);
  window.localStorage.clear();
});

/** What your own figure has in its hand right now. */
const yourHold = () =>
  screen.getByTestId('office-floor-player').querySelector('.office-floor-person-figure').dataset
    .hold;

describe('usable props (slice 9)', () => {
  it('pours the same coffee break the desk verb pours', async () => {
    const onGetCoffee = vi.fn().mockResolvedValue(true);
    renderFloor({ onGetCoffee });

    fireEvent.click(machine());

    // Rule 2: the machine *duplicates* the labelled control, so what it fires
    // has to be that control and not a floor-only copy of it.
    await waitFor(() => expect(onGetCoffee).toHaveBeenCalledTimes(1));
  });

  it('fires the printer cue sequence when you walk up to the printer', async () => {
    const onPropCue = vi.fn();
    renderFloor({ onPropCue, onGetCoffee: vi.fn().mockResolvedValue(true) });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));

    await waitFor(() => expect(onPropCue).toHaveBeenCalledWith('printer'));
  });

  it('walks you there and empties your own desk on the way', () => {
    const view = renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBeUndefined();

    fireEvent.click(machine());

    expect(screen.getByTestId('office-floor-player')).toBeTruthy();
    // § 6 rule 5 once more: the furniture stays, the person doesn't.
    expect(view.container.querySelector('[data-seat="you"]')?.dataset.vacant).toBe('true');
  });

  it('says what happened in the card slot, not over the machine', async () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    fireEvent.click(machine());

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/it grinds, it hisses/i));
    // § 6 rule 12: chrome goes in the slot. Nothing is pinned to the room, and
    // nobody is speaking — a printer with a speech bubble is a different game.
    expect(screen.queryByTestId('office-floor-panel')).toBeNull();
    expect(screen.queryByTestId('office-floor-peek-line')).toBeNull();
  });

  it('says so instead of failing silently when the verb is blocked', async () => {
    // `getCoffee` returns false when the desk is busy or a surface is already
    // up. A machine that quietly does nothing reads as a broken machine.
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(false) });
    fireEvent.click(machine());

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/already making one/i));
  });

  it('pours exactly one coffee however often it re-renders', async () => {
    const onGetCoffee = vi.fn().mockResolvedValue(true);
    const view = renderFloor({ onGetCoffee });
    fireEvent.click(machine());
    await waitFor(() => expect(onGetCoffee).toHaveBeenCalledTimes(1));

    view.rerender(<OfficeFloor onGetCoffee={onGetCoffee} />);
    view.rerender(<OfficeFloor onGetCoffee={vi.fn()} />);

    expect(onGetCoffee).toHaveBeenCalledTimes(1);
  });

  it('fires no desk verb at the props that duplicate none', async () => {
    // ADR-0011 rule 2: only the machine duplicates a labelled control. The
    // other two leave a mark of their own (below) and still call nothing.
    const onGetCoffee = vi.fn();
    renderFloor({ onGetCoffee });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));

    const card = await screen.findByTestId('office-floor-prop-card');
    await waitFor(() => expect(card.textContent).toMatch(/PC LOAD LETTER/i));
    expect(onGetCoffee).not.toHaveBeenCalled();
  });

  it('walks you home again, and Escape does the same before it sits you down', () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    fireEvent.click(machine());

    fireEvent.click(screen.getByRole('button', { name: /Back to my desk/i }));
    expect(screen.queryByTestId('office-floor-prop-card')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.click(machine());
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('office-floor-prop-card')).toBeNull();
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('offers a button only for the props the room can give you a mark for', () => {
    const view = renderFloor({ onGetCoffee: vi.fn() });

    // Sorted because the DOM order is the paint order (`FLOOR_PROPS`, back to
    // front) while the roster's is `FLOOR_PROP_USES` — the same set either way.
    const buttons = view.container.querySelectorAll('.office-floor-prop--usable');
    expect([...buttons].map((el) => el.dataset.prop).sort()).toEqual([...usablePropKinds()].sort());
    // The cooler and the plants stay scenery: no dead click, and no disabled
    // control explaining why it is disabled (§ 6 rule 21).
    expect(view.container.querySelector('[data-prop="waterCooler"]')).toBeNull();
    expect(screen.queryByRole('button', { name: /cooler/i })).toBeNull();
  });

  it('draws three plants and offers one of nothing', () => {
    // Only the first prop of a kind is the usable one, or the kitchen would
    // grow three identically-named buttons.
    const view = renderFloor({ onGetCoffee: vi.fn() });
    const plants = view.container.querySelectorAll('.office-floor-prop');
    expect(plants.length).toBeGreaterThan(10);
    expect(view.container.querySelectorAll('[data-prop="coffeeMachine"]')).toHaveLength(1);
  });

  it('takes the machine away while a meeting has you in a chair', () => {
    const meeting = {
      state: 'playing',
      title: 'Architecture Review Board',
      attendees: ['scrumMaster', 'gilfoyle'],
      facilitatorId: 'scrumMaster',
      transcript: [{ speakerId: 'gilfoyle', kind: 'substantive', text: 'The gateway is fine.' }],
      interjectionsLeft: 2
    };
    const view = renderFloor({ onGetCoffee: vi.fn() });
    view.rerender(<OfficeFloor meeting={meeting} onGetCoffee={vi.fn()} />);

    expect(view.container.querySelector('.office-floor-prop--usable')).toBeNull();
    expect(screen.getByTestId('office-floor-meeting-seat-you')).toBeTruthy();
  });

  it('replaces the person card, because you have one body', async () => {
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true), onMessage: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    expect(screen.getByRole('button', { name: /Go and talk/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();

    fireEvent.click(machine());

    expect(await screen.findByTestId('office-floor-prop-card')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Message/ })).toBeNull();
  });
});

/**
 * What using a prop leaves behind.
 *
 * Two things, and neither is an artifact — ADR-0010 reserves a *deliverable*
 * for the human's own pipeline and neither a hand nor a memory is one. The hand
 * is `floorActivityFor`'s rung 4, which until now only ever described a
 * wanderer; the memory is the office log, whose writers are "the surfaces that
 * already know".
 *
 * These assertions are deliberately clock-independent, which is not the usual
 * state of a floor test that mounts (`docs/agents/domains/office.md`): rung 4
 * outranks `PHASE_ART` at rung 5, so what a prop put in your hand is what you
 * are holding in all five day phases. The hour can only change what the
 * assertion would have been *without* the pickup, which is why the blocked case
 * below asserts the absence of a `coffee` rather than an empty hand.
 */
describe('what a prop leaves behind', () => {
  it('hands you the printout, and the whiteboard does not take it back', async () => {
    renderFloor({ onGetCoffee: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));
    await waitFor(() => expect(yourHold()).toBe('papers'));

    // `propHandsFor('whiteboard')` is null because you cannot carry a
    // whiteboard — which must mean "hands over nothing", never "empties your
    // hands".
    fireEvent.click(screen.getByRole('button', { name: /Whiteboard/i }));
    await waitFor(() => expect(screen.getByTestId('office-floor-prop-card')).toBeTruthy());
    expect(yourHold()).toBe('papers');
  });

  it('hands you the coffee the machine poured, and nothing when it jams', async () => {
    const view = renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });
    fireEvent.click(machine());
    await waitFor(() => expect(yourHold()).toBe('coffee'));

    cleanup();
    _resetOfficeViewModeForTests();
    view.unmount();

    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(false) });
    fireEvent.click(machine());
    await waitFor(() => expect(screen.getByTestId('office-floor-prop-card')).toBeTruthy());
    expect(yourHold()).not.toBe('coffee');
  });

  it('tells the office you were at the printer, and at the board, as two things', async () => {
    renderFloor({ onGetCoffee: vi.fn() });

    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));
    await waitFor(() => expect(yourHold()).toBe('papers'));
    fireEvent.click(screen.getByRole('button', { name: /Whiteboard/i }));

    // Two props inside a minute with no colleague between them: the log's
    // consecutive-duplicate collapse used to read them as one repeat, so this
    // is the assertion that pins `detail` into that key.
    await waitFor(() => expect(getOfficeLogDigest()).toHaveLength(2));
    expect(getOfficeLogDigest().join('\n')).toMatch(/printed something off/);
    expect(getOfficeLogDigest().join('\n')).toMatch(/read the whiteboard/);
  });

  it('says nothing to the office about the prop that pours a real verb', async () => {
    // The break logs `coffee` through the office-event funnel already; a second
    // line here would say one thing twice.
    renderFloor({ onGetCoffee: vi.fn().mockResolvedValue(true) });

    fireEvent.click(machine());
    await waitFor(() => expect(yourHold()).toBe('coffee'));
    expect(getOfficeLogDigest()).toEqual([]);
  });
});

/**
 * Looking closer (§ 8 "examine / look at").
 *
 * § 8's own examples name the fridge and its sticky notes, but no unclaimed
 * kitchen prop is reachable — `propTileFor('fridge')` and `propTileFor(
 * 'waterCooler')` are both null — so the idea lands on what § 8 actually
 * describes: "a few props that today only have a line", given somewhere for
 * that line to go.
 */
describe('looking closer at a prop', () => {
  const propCopy = () => officeChromeCopy().floor.props;

  const renderCard = (propKind, phase = 'idle') =>
    render(
      <FloorPropCard
        prop={{ propKind, phase: 'using' }}
        phase={phase}
        copy={officeChromeCopy().floor}
        onBack={vi.fn()}
      />
    );

  /*
   * The coffee machine rather than the whiteboard, since § 6a: this case is
   * about the *mechanism* (line first, detail on a click), and the whiteboard's
   * first detail is now a derived note, so asserting `details[0]` there was
   * reading the room's record and calling it the card's behaviour. The
   * whiteboard's own Look closer is pinned in `the whiteboard's own record`.
   */
  it('shows the main line first, and the detail only once you look', () => {
    const item = propCopy().items.coffeeMachine;
    renderCard('coffeeMachine');
    expect(screen.getByText(item.line)).toBeTruthy();

    fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.queryByText(item.line)).toBeNull();
    expect(screen.getByText(item.details[0])).toBeTruthy();
  });

  it('cycles and wraps, so a prop never runs out of things to notice', () => {
    const item = propCopy().items.printer;
    renderCard('printer');
    for (let i = 0; i < item.details.length; i += 1) {
      fireEvent.click(screen.getByTestId('office-floor-prop-look'));
      expect(screen.getByText(item.details[i])).toBeTruthy();
    }
    fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.getByText(item.details[0])).toBeTruthy();
  });

  it('every usable prop has something to find', () => {
    for (const kind of usablePropKinds()) {
      expect(propCopy().items[kind]?.details?.length ?? 0).toBeGreaterThan(0);
    }
  });

  /** Mid-pour there is nothing to read — the card is reporting a verb. */
  it('does not offer a look while the prop is working or blocked', () => {
    renderCard('coffeeMachine', 'working');
    expect(screen.queryByTestId('office-floor-prop-look')).toBeNull();
    cleanup();
    renderCard('coffeeMachine', 'blocked');
    expect(screen.queryByTestId('office-floor-prop-look')).toBeNull();
  });
});

/**
 * What the props have to say (slice 16, re-scoped by § 6a).
 *
 * The card is where the *readable* half lives — 62 px of panel can carry a
 * shape and not its labels — so these pin the copy states rather than the
 * drawing. Two camps since § 6a: the printer reflects **your** work, and the
 * whiteboard carries the **room's** own record.
 */
describe('the props carry your diagram', () => {
  const propCopy = () => officeChromeCopy().floor.props;

  const renderCardFor = (propKind, board) =>
    render(
      <FloorPropCard
        prop={{ propKind, phase: 'using' }}
        phase="idle"
        copy={officeChromeCopy().floor}
        board={board}
        onBack={vi.fn()}
      />
    );

  const renderCard = (board) =>
    render(
      <FloorPropCard
        prop={{ propKind: 'whiteboard', phase: 'using' }}
        phase="idle"
        copy={officeChromeCopy().floor}
        board={board}
        onBack={vi.fn()}
      />
    );

  const board = {
    kind: 'mermaid',
    shape: 'graph',
    nodes: 4,
    edges: 3,
    labels: ['Client', 'API Gateway', 'Auth Service', 'Orders'],
    bars: [],
    mini: { nodes: [], edges: [] }
  };

  /*
   * § 6a. The whiteboard's headline is the old board — the architecture nobody
   * erased — and it stays that whether or not you have drawn anything, because
   * the board is not about you. What the room has *added* reads on Look closer.
   */
  it('keeps the architecture from two re-orgs ago as its headline', () => {
    renderCard(null);
    expect(screen.getByText(propCopy().items.whiteboard.line)).toBeTruthy();
    cleanup();
    renderCard(board);
    expect(screen.getByText(propCopy().items.whiteboard.line)).toBeTruthy();
  });

  it('never names your diagram, however much of it you have drawn', () => {
    renderCard(board);
    // The printer's filled line interpolates the node count, so this is the
    // assertion that the whiteboard is no longer in that camp at all.
    expect(screen.queryByText(/4 boxes/)).toBeNull();
    expect(propCopy().items.whiteboard.lineYours).toBeUndefined();
  });

  it('reads the room’s own notes out on Look closer', () => {
    const notes = boardNotesFor({ copy: propCopy().items.whiteboard.notes });
    // Companion non-empty assertion: a board with nothing on it would let the
    // loop below pass while reading nothing.
    expect(notes.length).toBeGreaterThan(0);
    renderCard(board);
    for (const note of notes) {
      fireEvent.click(screen.getByTestId('office-floor-prop-look'));
      expect(screen.getByText(note.text), note.id).toBeTruthy();
    }
  });

  /*
   * The hearsay note is the one that mentions your work, and it is the room
   * quoting you badly rather than the room mirroring you: it only exists once
   * somebody has been in a position to hear about it.
   */
  it('puts your work on the board only as something somebody misheard', () => {
    recordOfficeLogEntry('run', { colleagueId: 'dinesh', detail: 'Billing' });
    renderCard(board);
    const heard = boardNotesFor({
      officeLog: getOfficeLogSnapshot(),
      board,
      copy: propCopy().items.whiteboard.notes
    }).find((note) => note.kind === 'heard-about-yours');
    expect(heard?.colleagueId).toBe('dinesh');
    expect(heard.text).toContain('Client');

    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByTestId('office-floor-prop-look'));
    expect(screen.getByText(heard.text)).toBeTruthy();
  });

  /*
   * The printer joining the whiteboard (§ 8's remaining slice-16 debt), and
   * the reason this is a sweep rather than a second copy of the case above:
   * the rule is about a **class** of prop, and the class is derived. A usable
   * prop with no `verb` is one whose entire use is looking at it — the same
   * set that records a line in the office log — so a third one cannot ship
   * showing you somebody else's 2023 print queue while handing you your own
   * diagram.
   *
   * This case previously asserted the opposite about the printer ("leaves a
   * prop with no board variant on its own copy"), which was a true statement
   * about the room of the day and a `lineYours`-shaped hole pinned as a
   * feature.
   */
  it('gives every prop whose whole use is looking at it something of its own to say', () => {
    const reflective = usablePropKinds().filter((kind) => !propUseFor(kind)?.verb);
    // Companion non-empty assertion — see the locale sweep.
    expect(reflective).toEqual(['printer', 'whiteboard']);
    for (const kind of reflective) {
      const item = propCopy().items[kind];
      // One camp or the other, never neither: a third reflective prop cannot
      // ship reading you somebody else's 2023 print queue.
      expect(Boolean(item.lineYours) !== Boolean(item.notes), `${kind} declares a camp`).toBe(true);

      cleanup();
      renderCardFor(kind, board);
      if (item.lineYours) {
        expect(
          screen.queryByText(item.line),
          `${kind} still shows its empty state with a board up`
        ).toBeNull();
        // The node count is interpolated, so an empty-state line cannot pass
        // by accident — this asserts the *filled* line specifically.
        expect(screen.getByText(/4 boxes/), `${kind} never names your diagram`).toBeTruthy();
        fireEvent.click(screen.getByTestId('office-floor-prop-look'));
        expect(
          screen.getByText(/Client, API Gateway, Auth Service/),
          `${kind} never reads your labels out`
        ).toBeTruthy();
      } else {
        const notes = boardNotesFor({ copy: item.notes });
        expect(notes.length, `${kind} has nothing of its own on it`).toBeGreaterThan(0);
        fireEvent.click(screen.getByTestId('office-floor-prop-look'));
        expect(screen.getByText(notes[0].text), `${kind} reads its own record`).toBeTruthy();
      }
    }
  });

  /*
   * The negative case, and it is a boundary rather than an omission: the
   * coffee machine's use is a verb (ADR-0011 rule 2), so what it has to say
   * is about the coffee. A machine that poured you your own diagram would be
   * the "different and much stupider game" `FloorPropCard`'s header names.
   */
  it('leaves the prop that pours a real verb on its own copy', () => {
    renderCardFor('coffeeMachine', board);
    expect(screen.getByText(propCopy().items.coffeeMachine.line)).toBeTruthy();
  });
});

/**
 * § 6b — what is printed on the page the printer hands you.
 *
 * Two halves, and they are deliberately split: the derivation is pure and
 * pinned by value, while the drawing can only be pinned structurally (jsdom has
 * no layout engine, so whether four hairlines at a 1.8-unit pitch are legible
 * is the § 6 verify recipe's question, not this suite's).
 *
 * The gate under test is the **hand**, never the hold. `PHASE_ART` puts
 * `papers` in sixteen hands at the wind-down hour, and a sheet keyed on the
 * hold would print your diagram in all of them — which is the mirror § 6a took
 * off the whiteboard, reappearing in somebody else's fist.
 */
describe('the page the printer hands you (§ 6b)', () => {
  const graphBoard = { kind: 'mermaid', shape: 'graph', nodes: 4, edges: 3, labels: [] };
  const listBoard = { kind: 'chart', shape: 'list', nodes: 2, edges: 0, labels: [] };
  const pageBoard = { kind: 'anything', shape: 'page', nodes: 3, edges: 0, labels: [] };

  /** The sheet's rules, as the one `path` the art draws them in. */
  const ink = (root) => root.querySelectorAll('.office-floor-person-hold path');

  it('prints nothing for a hand no prop filled', () => {
    expect(printoutFrom({ board: graphBoard, carrying: null })).toBeNull();
    // The hour's `papers` is not the printer's: `carrying` is only ever what a
    // prop handed over, and `coffee` came from the one that pours.
    expect(printoutFrom({ board: graphBoard, carrying: 'coffee' })).toBeNull();
    expect(printoutFrom({ carrying: 'papers' })).toBeNull();
  });

  it('prints the shape of the thing, and only joins up what was joined', () => {
    const printed = printoutFrom({ board: graphBoard, carrying: 'papers' });
    expect(printed.rows).toHaveLength(4);
    // A routing prints as uneven rules; the accent tick is the one mark that
    // says the page had arrows on it.
    expect(new Set(printed.rows.map((row) => row.w)).size).toBe(2);
    expect(printed.joined).toBe(true);
    expect(printoutFrom({ board: { ...graphBoard, edges: 0 }, carrying: 'papers' }).joined).toBe(
      false
    );
    // One box and nothing to reach: a tick needs a second rule to exist.
    expect(printoutFrom({ board: { ...graphBoard, nodes: 1 }, carrying: 'papers' }).joined).toBe(
      false
    );

    const list = printoutFrom({ board: listBoard, carrying: 'papers' });
    expect(list.rows).toHaveLength(2);
    expect(new Set(list.rows.map((row) => row.w)).size, 'a list is a list').toBe(1);
    expect(list.joined).toBe(false);

    // A composed page prints as a header over its blocks — the one shape whose
    // rules are not all the same kind of thing.
    const page = printoutFrom({ board: pageBoard, carrying: 'papers' });
    expect(page.rows[0].w).toBe(1);
    expect(page.rows.slice(1).every((row) => row.w < 1)).toBe(true);
  });

  it('never prints more than the sheet can carry', () => {
    const big = printoutFrom({ board: { ...graphBoard, nodes: 16 }, carrying: 'papers' });
    expect(big.rows).toHaveLength(PRINTOUT_MAX_ROWS);
    expect(Math.max(...big.rows.map((row) => row.y))).toBeLessThan(1);
  });

  it('inks what you printed onto the page in your hand', async () => {
    renderFloor({ board: graphBoard, onGetCoffee: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));
    await waitFor(() => expect(yourHold()).toBe('papers'));

    const player = screen.getByTestId('office-floor-player');
    // Four rules off a four-node diagram, plus the accent tick for its arrows.
    expect(ink(player)).toHaveLength(2);
    expect(ink(player)[0].getAttribute('d').match(/M/g)).toHaveLength(4);
  });

  it('leaves the blank sheet blank when there was nothing to print', async () => {
    renderFloor({ onGetCoffee: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: /Printer/i }));
    await waitFor(() => expect(yourHold()).toBe('papers'));

    const player = screen.getByTestId('office-floor-player');
    // The three rules every sheet on this floor has always carried, and no
    // tick: an empty slot prints the generic page rather than a blank one.
    expect(ink(player)).toHaveLength(1);
    expect(ink(player)[0].getAttribute('d').match(/M/g)).toHaveLength(3);
  });

  it('never puts your printout in a colleague’s hand (ADR-0010)', () => {
    const sheet = printoutFrom({ board: { ...graphBoard, nodes: 16 }, carrying: 'papers' });
    // Four rules is what the sheet would carry if the figure drew it.
    expect(sheet.rows).toHaveLength(PRINTOUT_MAX_ROWS);

    const { container } = render(
      <FloorFigure id="gilfoyle" accent="#64748b" activity={{ hold: 'papers' }} sheet={sheet} />
    );
    // The guard is in `FloorFigure`, not in its one caller: eight components
    // draw a figure, and a ninth must not be able to get round it.
    expect(ink(container)).toHaveLength(1);
    expect(ink(container)[0].getAttribute('d').match(/M/g)).toHaveLength(3);
  });
});

/**
 * The drawing half of slice 16. Structural rather than pixel assertions —
 * jsdom has no layout engine, so what these can honestly pin is *which
 * surfaces gained marks*; the § 6 verify recipe is what says they are legible.
 */
describe('the room draws what you are working on', () => {
  const board = {
    kind: 'mermaid',
    shape: 'graph',
    nodes: 4,
    edges: 3,
    labels: ['Client', 'API Gateway'],
    bars: [
      { x: 0.08, y: 0.12, w: 0.3, h: 0.24, c: '#dbeafe' },
      { x: 0.62, y: 0.12, w: 0.3, h: 0.24, c: '#dbeafe' }
    ],
    mini: {
      nodes: [
        { x: 0.12, y: 0.16, w: 0.2, h: 0.26 },
        { x: 0.44, y: 0.16, w: 0.2, h: 0.26 }
      ],
      edges: [[0, 1]]
    }
  };

  const yourScreen = (container) => container.querySelector('.floor-screen--you');
  const whiteboard = (container) => container.querySelector('[data-prop="whiteboard"]');

  it('puts bars on your monitor and leaves it alone when the slot is empty', () => {
    const { container: empty } = renderFloor();
    const bare = yourScreen(empty).querySelectorAll('polygon').length;
    cleanup();

    const { container: full } = renderFloor({ board });
    expect(yourScreen(full).querySelectorAll('polygon').length).toBeGreaterThan(bare);
  });

  it('never puts your work on a colleague’s screen (ADR-0010)', () => {
    const { container } = renderFloor({ board });
    // Gilfoyle's monitor is his own fiction whatever you are working on.
    const theirs = container.querySelector('[data-seat="gilfoyle"] .floor-screen');
    expect(theirs.classList.contains('floor-screen--you')).toBe(false);
    cleanup();

    const { container: bare } = renderFloor();
    expect(
      bare.querySelector('[data-seat="gilfoyle"] .floor-screen').querySelectorAll('polygon').length
    ).toBe(theirs.querySelectorAll('polygon').length);
  });

  /*
   * The rewrite of slice 16's whiteboard case, to § 6a's contract rather than a
   * deletion: the board is inked by the **room**, not by your slot, so the
   * marks move with what the office has written and not with what you drew. A
   * deleted test would be indistinguishable from a lost invariant.
   */
  it('inks the whiteboard from the room’s record, not from your slot', () => {
    const { container: yours } = renderFloor({ board });
    const withBoard = whiteboard(yours).querySelectorAll('polygon').length;
    cleanup();

    const { container: bare } = renderFloor();
    expect(
      whiteboard(bare).querySelectorAll('polygon').length,
      'your diagram no longer changes what is on the whiteboard'
    ).toBe(withBoard);
    // Standing items are standing: a board the room has not touched today is
    // still not a blank board.
    expect(whiteboard(bare).querySelectorAll('polygon').length).toBeGreaterThan(0);
  });

  it('draws no connectors on it, because it is not a diagram any more', () => {
    // `IsoPanel` draws a `polyline` frame; a bare `line` only ever came from
    // the board's connectors, which is what the mirror used to put up there.
    const { container } = renderFloor({ board });
    expect(whiteboard(container).querySelectorAll('line').length).toBe(0);
  });

  it('inks more of it once the room has heard about your work', () => {
    const { container: quiet } = renderFloor({ board });
    const before = whiteboard(quiet).querySelectorAll('polygon').length;
    cleanup();

    recordOfficeLogEntry('pitch', { colleagueId: 'gilfoyle' });
    const { container: busy } = renderFloor({ board });
    expect(whiteboard(busy).querySelectorAll('polygon').length).toBeGreaterThan(before);
  });
});

/**
 * The derivation behind § 6a, as a pure module.
 *
 * It lives in this suite rather than in an `officeFloorNotes.test.js` of its
 * own: a new `officeFloor*`-named suite fails `npm test` until it is listed in
 * `ISOMETRIC_FLOOR_BLAST_TESTS`, which is `improve`'s file (playbook § 4), and
 * the contract these pin is the same one the card and the panel above read.
 */
describe('the whiteboard’s own record (§ 6a)', () => {
  const bank = () => officeChromeCopy().floor.props.items.whiteboard.notes;

  const board = {
    kind: 'mermaid',
    shape: 'graph',
    nodes: 4,
    edges: 3,
    labels: ['Client', 'API Gateway'],
    bars: [],
    mini: { nodes: [], edges: [] }
  };

  it('is never blank, never longer than three, and always leads with the old board', () => {
    const notes = boardNotesFor({ copy: bank() });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.length).toBeLessThanOrEqual(BOARD_MAX_NOTES);
    expect(notes[0].kind).toBe('stale');
    expect(notes.map((note) => note.id)).toEqual([...new Set(notes.map((note) => note.id))]);
  });

  it('attributes every note somebody could be asked about', () => {
    const notes = boardNotesFor({ copy: bank() });
    for (const note of notes) {
      expect(BOARD_NOTE_KINDS, note.id).toContain(note.kind);
      expect(note.text.length, note.id).toBeGreaterThan(0);
      // `stale` is the one note with no author, and that is its content: the
      // person who wrote it left two re-orgs ago.
      if (note.kind === 'stale') expect(note.colleagueId).toBeNull();
      else
        expect(
          isOfficeColleagueId(note.colleagueId) || Boolean(deskWorkFor(note.colleagueId))
        ).toBe(true);
    }
  });

  it('refuses the hearsay note when nobody could have heard about it', () => {
    // No board: nothing to have misremembered.
    recordOfficeLogEntry('run', { colleagueId: 'dinesh' });
    expect(
      boardNotesFor({ officeLog: getOfficeLogSnapshot(), copy: bank() }).some(
        (note) => note.kind === 'heard-about-yours'
      )
    ).toBe(false);

    // A board, but the only thing in the log is you reading this very board.
    _resetOfficeLogForTests();
    recordOfficeLogEntry('prop', { detail: 'whiteboard' });
    expect(
      boardNotesFor({ officeLog: getOfficeLogSnapshot(), board, copy: bank() }).some(
        (note) => note.kind === 'heard-about-yours'
      )
    ).toBe(false);
  });

  it('puts the handwriting you recognise at the front', () => {
    const cold = boardNotesFor({ copy: bank() });
    recordOfficeLogEntry('chat', { colleagueId: 'hr' });
    const warm = boardNotesFor({ officeLog: getOfficeLogSnapshot(), copy: bank() });

    expect(cold.find((note) => note.kind === 'open')?.colleagueId).not.toBe('hr');
    expect(warm.find((note) => note.kind === 'open')?.colleagueId).toBe('hr');
  });

  it('keeps the hearsay note even when the board is full of standing items', () => {
    recordOfficeLogEntry('meeting', { colleagueId: 'gilfoyle' });
    const notes = boardNotesFor({ officeLog: getOfficeLogSnapshot(), board, copy: bank() });
    expect(notes).toHaveLength(BOARD_MAX_NOTES);
    expect(notes[notes.length - 1].kind).toBe('heard-about-yours');
  });

  it('marks the panel inside its own bounds, and more of it per note', () => {
    const one = boardNoteMarks(boardNotesFor({ copy: { stale: 'x' } }));
    const three = boardNoteMarks(
      boardNotesFor({ officeLog: [{ kind: 'run', colleagueId: 'hr' }], board, copy: bank() })
    );
    expect(boardNoteMarks([])).toEqual([]);
    expect(three.length).toBeGreaterThan(one.length);
    for (const mark of three) {
      expect(mark.x).toBeGreaterThanOrEqual(0);
      expect(mark.y).toBeGreaterThanOrEqual(0);
      expect(mark.x + mark.w).toBeLessThanOrEqual(1);
      expect(mark.y + mark.h).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * The board's prompt face — § 15's "quotable both ways", now that something
 * sends it.
 *
 * The notes were made text rather than pixels so a colleague could quote them,
 * and for one slice nothing did. What stood in the way was a collision rather
 * than plumbing: note text is localized UI copy in four bundles, while
 * `officeLogDigest.js`'s own header says the prompt side is always English. So
 * there are two banks and exactly one derivation, and these are the assertions
 * that keep that true — a second derivation would let the model quote a note
 * that is not on the panel.
 */
describe('what a colleague can quote off the board (§ 15)', () => {
  const bank = () => officeChromeCopy().floor.props.items.whiteboard.notes;
  const labels = ['Client', 'API Gateway'];

  it('says the same notes, in the same order, as the panel draws', () => {
    recordOfficeLogEntry('pitch', { colleagueId: 'gilfoyle' });
    const log = getOfficeLogSnapshot();
    const drawn = boardNotesFor({ officeLog: log, board: { labels }, copy: bank() });
    const spoken = boardNotePromptLines({ officeLog: log, labels });

    // Same count and same order: one derivation, two sets of words. A prompt
    // that can name a fourth note, or name them in another order, is quoting a
    // board nobody is looking at.
    expect(spoken).toHaveLength(drawn.length);
    expect(spoken.length).toBeGreaterThan(1);
    expect(spoken.length).toBeLessThanOrEqual(BOARD_MAX_NOTES);
    expect(spoken[0]).toMatch(/two re-orgs ago/);
    expect(spoken[spoken.length - 1]).toContain('Client');
  });

  it('stays English when the office is not, and names cast ids rather than people', () => {
    setActiveOfficeBundle(getUiLocaleBundle('zh-CN').office);
    // The reader's board really is translated — that is the control for the
    // assertion after it.
    expect(bank().stale).toMatch(/[\u4e00-\u9fff]/);

    recordOfficeLogEntry('meeting', { colleagueId: 'gilfoyle' });
    const spoken = boardNotePromptLines({ officeLog: getOfficeLogSnapshot(), labels });
    expect(spoken.length).toBeGreaterThan(0);
    for (const line of spoken) {
      // Localizing the prompt would translate the input twice and hand the
      // model a second language to be confused by (`officeLogDigest.js`).
      expect(line, line).not.toMatch(/[\u4e00-\u9fff]/);
      // The digest's other convention: ids, not display names, because those
      // are what every server prompt builder already speaks.
      expect(line, line).not.toMatch(/\bGilfoyle\b/);
      expect(line.length, line).toBeLessThanOrEqual(200);
    }
    expect(spoken.join(' ')).toMatch(/gilfoyle/);
  });

  it('keeps a note on the reader board from silently never reaching a prompt', () => {
    const reader = bank();
    // The sweep that catches the drift this split invites: a note kind, or an
    // author, added to the locale bundles and not to the prompt bank is a mark
    // on the wall that no colleague can ever mention.
    expect([...BOARD_NOTE_PROMPT_KEYS.top].sort()).toEqual(Object.keys(reader).sort());
    expect([...BOARD_NOTE_PROMPT_KEYS.open].sort()).toEqual(Object.keys(reader.open).sort());
  });

  it('cannot write a line the route would reject', () => {
    // The hearsay note interpolates a label off the user's own diagram, and
    // `visibleLabels` allows 200 characters each — so before the cap this one
    // note could carry the whole field budget by itself and the request came
    // back a 400, which the user reads as the office going quiet.
    recordOfficeLogEntry('run', { colleagueId: 'gilfoyle' });
    const spoken = boardNotePromptLines({
      officeLog: getOfficeLogSnapshot(),
      labels: ['N'.repeat(200)]
    });
    expect(spoken.some((line) => line.includes('from memory'))).toBe(true);
    for (const line of spoken) expect(line.length, line).toBeLessThanOrEqual(200);
    // And the cut lands on the label, not on the sentence: the clause that says
    // the sketch is *wrong* is the whole content of that note.
    expect(spoken[spoken.length - 1]).toMatch(/one of the words wrong$/);
  });

  it('sends nothing rather than a bare board when nobody could have heard about your work', () => {
    // No log at all: the standing notes are still up there (a board is never
    // blank) and the hearsay sketch is refused, because the office does not get
    // to invent a witness.
    const cold = boardNotePromptLines({ labels });
    expect(cold.length).toBeGreaterThan(0);
    expect(cold.some((line) => line.includes('Client'))).toBe(false);
    // And with no labels there is nothing to have misremembered either.
    recordOfficeLogEntry('run', { colleagueId: 'dinesh' });
    expect(
      boardNotePromptLines({ officeLog: getOfficeLogSnapshot() }).some((line) =>
        line.includes('from memory')
      )
    ).toBe(false);
  });
});
