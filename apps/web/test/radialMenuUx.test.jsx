// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const MOCK_ACTIONS = [
  { id: 'refine', label: 'Refine', icon: 'R', variant: 'refine', persona: 'The Polisher' },
  { id: 'explain', label: 'Explain', icon: 'i', variant: 'explain', persona: 'The Wise Architect' }
];

/** Mirrors App.jsx radial menu open/close rules without the full shell. */
function RadialMenuHarness({ initialSelected = null }) {
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
    setRadialMenuSession({ descriptor: selectedNode, anchor: MOCK_ANCHOR });
  }, [radialMenuVisible, selectedNode]);

  function handleSelect() {
    if (radialMenuVisible && selectedNode?.id === MOCK_DESCRIPTOR.id) {
      setRadialMenuVisible(false);
      return;
    }
    setSelectedNode(MOCK_DESCRIPTOR);
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

  it('closes the menu on pan dismiss while selection state remains', () => {
    render(<RadialMenuHarness initialSelected={MOCK_DESCRIPTOR} />);
    expect(screen.getByRole('menu', { name: 'Diagram selection actions' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate pan dismiss' }));
    expect(screen.queryByRole('menu', { name: 'Diagram selection actions' })).toBeNull();
    expect(screen.getByTestId('radial-harness').getAttribute('data-session')).toBe('');
  });
});
