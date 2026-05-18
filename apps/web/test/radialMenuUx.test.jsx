// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RadialActionMenu from '../src/components/RadialActionMenu.jsx';

const MOCK_ANCHOR = {
  left: 200,
  top: 220,
  nodeTop: 160,
  nodeBottom: 200,
  nodeLeft: 160,
  nodeRight: 240,
  centerY: 180
};

const MOCK_DESCRIPTOR = {
  id: 'flowchart-A-0',
  label: 'Alpha',
  partKind: 'node',
  partName: 'Alpha'
};

const OTHER_DESCRIPTOR = {
  id: 'flowchart-B-0',
  label: 'Beta',
  partKind: 'node',
  partName: 'Beta'
};

const MOCK_ACTIONS = [
  { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'The Polisher' },
  { id: 'explain', label: 'Explain', icon: 'i', variant: 'explain', persona: 'The Wise Architect' }
];

/** Mirrors App.jsx radial menu open/close rules without the full shell. */
function RadialMenuHarness({ initialSelected = null, anchorsById = null }) {
  const [selectedNode, setSelectedNode] = useState(initialSelected);
  const [hoverDescriptor, setHoverDescriptor] = useState(null);
  const [radialMenuVisible, setRadialMenuVisible] = useState(Boolean(initialSelected?.id));
  const [radialMenuSession, setRadialMenuSession] = useState(null);
  const prevSelectedNodeIdRef = useRef(initialSelected?.id ?? null);

  useEffect(() => {
    const id = selectedNode?.id ?? null;
    if (id && id !== prevSelectedNodeIdRef.current) {
      setRadialMenuVisible(true);
    } else if (!id) {
      setRadialMenuVisible(false);
    }
    prevSelectedNodeIdRef.current = id;
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!radialMenuVisible || !selectedNode?.id) {
      setRadialMenuSession(null);
      return;
    }
    const anchor = anchorsById?.[selectedNode.id] ?? MOCK_ANCHOR;
    setRadialMenuSession({ descriptor: selectedNode, anchor });
  }, [anchorsById, radialMenuVisible, selectedNode?.id, selectedNode]);

  function handleSelect() {
    if (radialMenuVisible && selectedNode?.id === MOCK_DESCRIPTOR.id) {
      setRadialMenuVisible(false);
      return;
    }
    setSelectedNode(MOCK_DESCRIPTOR);
  }

  function handleSelectOther() {
    if (selectedNode?.id && selectedNode.id !== OTHER_DESCRIPTOR.id) {
      setRadialMenuSession(null);
      setRadialMenuVisible(true);
    }
    setSelectedNode(OTHER_DESCRIPTOR);
  }

  return (
    <div
      data-testid="radial-harness"
      data-hover={hoverDescriptor?.id ?? ''}
      data-session={radialMenuSession?.descriptor?.id ?? ''}
    >
      <button type="button" onClick={() => setHoverDescriptor(MOCK_DESCRIPTOR)}>
        Simulate hover
      </button>
      <button type="button" onClick={handleSelect}>
        Simulate select
      </button>
      <button type="button" onClick={handleSelectOther}>
        Simulate select other
      </button>
      <button type="button" onClick={() => setRadialMenuVisible(false)}>
        Simulate pan dismiss
      </button>
      <RadialActionMenu
        descriptor={radialMenuSession?.descriptor ?? null}
        anchor={radialMenuSession?.anchor ?? null}
        actions={MOCK_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={() => setRadialMenuVisible(false)}
        onClose={vi.fn()}
      />
    </div>
  );
}

describe('radial menu click-to-open UX', () => {
  afterEach(() => {
    cleanup();
  });

  it('does not open the menu on hover alone', () => {
    render(<RadialMenuHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate hover' }));
    expect(screen.getByTestId('radial-harness').getAttribute('data-session')).toBe('');
    expect(screen.queryByRole('menu', { name: 'Diagram selection actions' })).toBeNull();
  });

  it('opens the menu when a part is selected', () => {
    render(<RadialMenuHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Simulate select' }));
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    // Labels are no longer rendered in the radial menu — accessibility still
    // surfaces the action name (with persona) via `aria-label`.
    const refineBtn = screen.getByRole('button', { name: 'Refine (Polisher)' });
    expect(refineBtn).toBeTruthy();
    expect(refineBtn.getAttribute('data-persona')).toBe('Polisher');
    // No persona / label chip rendered inside the button anymore.
    expect(screen.queryByText('Polisher', { selector: '.radial-action-button-persona' })).toBeNull();
  });

  it('closes the menu when the same part is clicked again', () => {
    render(<RadialMenuHarness initialSelected={MOCK_DESCRIPTOR} />);
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate select' }));
    expect(screen.queryByRole('menu', { name: 'Diagram selection actions' })).toBeNull();
  });

  it('closes the menu when the backdrop hit area is clicked', () => {
    render(<RadialMenuHarness initialSelected={MOCK_DESCRIPTOR} />);
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    fireEvent.pointerDown(screen.getByTestId('radial-hit-area'), { button: 0 });
    expect(screen.queryByRole('menu', { name: 'Diagram selection actions' })).toBeNull();
  });

  it('reopens the menu at a new anchor when another part is selected', () => {
    const anchorA = { ...MOCK_ANCHOR, left: 200, centerY: 180 };
    const anchorB = { ...MOCK_ANCHOR, left: 420, centerY: 320 };
    render(
      <RadialMenuHarness
        initialSelected={MOCK_DESCRIPTOR}
        anchorsById={{
          [MOCK_DESCRIPTOR.id]: anchorA,
          [OTHER_DESCRIPTOR.id]: anchorB
        }}
      />
    );
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate select other' }));
    expect(screen.getByTestId('radial-harness').getAttribute('data-session')).toBe(OTHER_DESCRIPTOR.id);
    const chip = document.querySelector('.radial-action-chip');
    expect(chip).toBeTruthy();
    expect(chip.style.left).toBe(`${anchorB.left}px`);
  });

  it('closes the menu on pan dismiss while selection state remains', () => {
    render(<RadialMenuHarness initialSelected={MOCK_DESCRIPTOR} />);
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate pan dismiss' }));
    expect(screen.queryByRole('menu', { name: 'Diagram selection actions' })).toBeNull();
    expect(screen.getByTestId('radial-harness').getAttribute('data-session')).toBe('');
  });
});

/**
 * Once a primary button promotes the menu into "popover mode", any pending
 * 450ms hover-close timer must be cancelled, and neither the popover nor the
 * hit area should be allowed to schedule a fresh one — the popover is modal
 * and only closes via X / Escape / backdrop. Regression for the user-reported
 * "menu only shows briefly until it disappears".
 */
describe('radial menu popover survives the hover-close grace period', () => {
  afterEach(() => {
    cleanup();
  });

  const PRIMARY_ACTIONS = [
    {
      id: 'definition',
      label: 'What is this?',
      icon: '?',
      variant: 'definition',
      group: 'primary',
      behavior: 'showExplanation',
      persona: 'Quick Reference'
    },
    {
      id: 'stakeholders',
      label: 'Stakeholders',
      icon: 'S',
      variant: 'stakeholders',
      group: 'primary',
      behavior: 'expandStakeholders',
      persona: 'Stakeholders'
    },
    { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'The Polisher' }
  ];

  function renderMenuWithSpies() {
    const onHoverHold = vi.fn();
    const onHoverRelease = vi.fn();
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onHoverHold={onHoverHold}
        onHoverRelease={onHoverRelease}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    return { onHoverHold, onHoverRelease };
  }

  it('cancels any pending hover-close timer when the explainer opens', () => {
    const { onHoverHold } = renderMenuWithSpies();
    onHoverHold.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    expect(screen.getByRole('dialog', { name: /What does .* mean\?/i })).toBeTruthy();
    // The component must defensively cancel any close timer that the
    // outgoing arc-button's pointerLeave may have scheduled.
    expect(onHoverHold).toHaveBeenCalled();
  });

  it('cancels any pending hover-close timer when the stakeholders popover opens', () => {
    const { onHoverHold } = renderMenuWithSpies();
    onHoverHold.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders (Stakeholders)' }));
    expect(screen.getByRole('dialog', { name: /Stakeholders for this element/i })).toBeTruthy();
    expect(onHoverHold).toHaveBeenCalled();
  });

  it('does not schedule a close from the explainer popover on pointer leave', () => {
    const { onHoverRelease } = renderMenuWithSpies();
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    onHoverRelease.mockClear();
    fireEvent.pointerLeave(screen.getByRole('dialog', { name: /What does .* mean\?/i }));
    expect(onHoverRelease).not.toHaveBeenCalled();
  });

  it('does not schedule a close from the stakeholders popover on pointer leave', () => {
    const { onHoverRelease } = renderMenuWithSpies();
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders (Stakeholders)' }));
    onHoverRelease.mockClear();
    fireEvent.pointerLeave(screen.getByRole('dialog', { name: /Stakeholders for this element/i }));
    expect(onHoverRelease).not.toHaveBeenCalled();
  });

  it('does not schedule a close from the hit area while in popover mode', () => {
    const { onHoverRelease } = renderMenuWithSpies();
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    onHoverRelease.mockClear();
    fireEvent.pointerLeave(screen.getByTestId('radial-hit-area'));
    expect(onHoverRelease).not.toHaveBeenCalled();
  });
});

/**
 * The "?" answer is voiced by the Wise Architect and offers two follow-ups:
 * "Dumb it Down" rephrases inline; "Drill Deeper" hands off to the Thinking
 * panel via onDrillDeeper. These are core to the help-button UX rework.
 */
describe('explainer popover follow-ups (Wise Architect)', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
        json: async () => ({ explanation: 'Test gloss for Alpha.' })
      })
    );
  });

  const PRIMARY_ACTIONS = [
    {
      id: 'definition',
      label: 'What is this?',
      icon: '?',
      variant: 'definition',
      group: 'primary',
      behavior: 'showExplanation',
      persona: 'Quick Reference'
    },
    { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'The Polisher' }
  ];

  it('attributes the answer to the Wise Architect in the popover head', () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    const dialog = screen.getByRole('dialog', { name: /What does .* mean\?/i });
    expect(dialog.querySelector('.radial-explainer-attribution')?.textContent).toMatch(/Wise Architect/);
    expect(dialog.querySelector('.radial-explainer-eyebrow')?.getAttribute('aria-label')).toBe('The Wise Architect');
  });

  it('renders Dumb it Down and Drill Deeper follow-up chips', () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onDrillDeeper={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    expect(screen.getByRole('button', { name: /Dumb it Down/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Drill Deeper/ })).toBeTruthy();
  });

  it('hands the descriptor to onDrillDeeper when Drill Deeper is clicked', () => {
    const onDrillDeeper = vi.fn();
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onDrillDeeper={onDrillDeeper}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    fireEvent.click(screen.getByRole('button', { name: /Drill Deeper/ }));
    expect(onDrillDeeper).toHaveBeenCalledWith(MOCK_DESCRIPTOR);
  });

  it('marks Dumb it Down as pressed once selected', async () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    const dumbBtn = await screen.findByRole('button', { name: /Dumb it Down/ });
    expect(dumbBtn.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(dumbBtn);
    await waitFor(() => expect(dumbBtn.getAttribute('aria-pressed')).toBe('true'));
  });
});

/**
 * Popovers exposed via the radial menu can sit outside the viewport on small
 * screens when the anchor node is near an edge. To keep them readable in
 * those cases the head doubles as a drag handle: the user can grab it and
 * reposition the popover. Pointer down on the head must not propagate to the
 * backdrop close handler.
 */
describe('radial popover drag handle', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
        json: async () => ({ explanation: 'Test gloss.' })
      })
    );
  });

  const PRIMARY_ACTIONS = [
    {
      id: 'definition',
      label: 'What is this?',
      icon: '?',
      variant: 'definition',
      group: 'primary',
      behavior: 'showExplanation',
      persona: 'Quick Reference'
    },
    {
      id: 'stakeholders',
      label: 'Stakeholders',
      icon: 'S',
      variant: 'stakeholders',
      group: 'primary',
      behavior: 'expandStakeholders',
      persona: 'Stakeholders'
    },
    { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'The Polisher' }
  ];

  it('exposes the explainer head as a drag handle', () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    const dialog = screen.getByRole('dialog', { name: /What does .* mean\?/i });
    const head = dialog.querySelector('.radial-explainer-head');
    expect(head).toBeTruthy();
    expect(head.getAttribute('title')).toMatch(/drag/i);
  });

  it('exposes the stakeholders head as a drag handle', () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders (Stakeholders)' }));
    const dialog = screen.getByRole('dialog', { name: /Stakeholders for this element/i });
    const head = dialog.querySelector('.radial-stakeholders-head');
    expect(head).toBeTruthy();
    expect(head.getAttribute('title')).toMatch(/drag/i);
  });

  it('repositions the popover when the user drags the head', () => {
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    const dialog = screen.getByRole('dialog', { name: /What does .* mean\?/i });
    const head = dialog.querySelector('.radial-explainer-head');
    // Anchored placement uses the centered-on-anchor transform.
    expect(dialog.style.transform).toMatch(/translate/);

    // Simulate a drag from the head: pointerDown captures the initial offset,
    // pointerMove updates the absolute position, pointerUp ends the drag.
    fireEvent.pointerDown(head, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(head, { pointerId: 1, clientX: 200, clientY: 160 });
    fireEvent.pointerUp(head, { pointerId: 1 });

    // After dragging, placement switches from "anchored + transform" to
    // "absolute top-left + no transform" so the position the user set sticks.
    expect(dialog.classList.contains('is-repositioned')).toBe(true);
    expect(dialog.style.transform).toBe('none');
  });

  it('does not start a drag from the close button inside the head', () => {
    const onClose = vi.fn();
    render(
      <RadialActionMenu
        descriptor={MOCK_DESCRIPTOR}
        anchor={MOCK_ANCHOR}
        actions={PRIMARY_ACTIONS}
        onActionPick={vi.fn()}
        onBackdropPointerDown={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'What is this? (Quick Reference)' }));
    const closeBtn = screen.getByRole('button', { name: /Close explanation/i });
    fireEvent.pointerDown(closeBtn, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(closeBtn, { pointerId: 1, clientX: 200, clientY: 160 });
    fireEvent.pointerUp(closeBtn, { pointerId: 1 });
    const dialog = screen.getByRole('dialog', { name: /What does .* mean\?/i });
    // Drag should not have engaged — popover stays in its computed placement.
    expect(dialog.classList.contains('is-repositioned')).toBe(false);
    expect(dialog.classList.contains('is-dragging')).toBe(false);

    // Clicking the close button still works.
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
