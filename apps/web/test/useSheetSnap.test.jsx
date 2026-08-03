// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { DEFAULT_SHEET_SNAP, SHEET_SNAPS, useSheetSnap } from '../src/hooks/useSheetSnap.js';

function SheetHarness({ enabled = true, onDismiss = undefined, initialSnap = DEFAULT_SHEET_SNAP }) {
  const { nodeRef, snap, setSnap, cycleSnap, dragHandleProps } = useSheetSnap({
    enabled,
    onDismiss
  });
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || initialSnap === DEFAULT_SHEET_SNAP) return;
    seeded.current = true;
    setSnap(initialSnap);
  }, [initialSnap, setSnap]);

  return (
    <div ref={nodeRef} data-snap={snap} data-testid="sheet">
      <div data-testid="handle" {...dragHandleProps}>
        <button type="button">Inner control</button>
      </div>
      <button type="button" onClick={cycleSnap}>
        Cycle snap
      </button>
    </div>
  );
}

function dragHandle(fromY, toY, { pointerId = 1 } = {}) {
  const handle = screen.getByTestId('handle');
  fireEvent.pointerDown(handle, { clientY: fromY, pointerId, button: 0, pointerType: 'mouse' });
  fireEvent.pointerMove(handle, { clientY: toY, pointerId });
  fireEvent.pointerUp(handle, { clientY: toY, pointerId });
}

afterEach(() => {
  cleanup();
});

describe('useSheetSnap constants', () => {
  it('opens phone sheets at full height by default', () => {
    expect(DEFAULT_SHEET_SNAP).toBe('full');
    expect(SHEET_SNAPS).toEqual(['peek', 'half', 'full']);
  });
});

describe('useSheetSnap gestures', () => {
  it('cycleSnap toggles full and half for keyboard and tap users', () => {
    render(<SheetHarness />);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('full');

    fireEvent.click(screen.getByRole('button', { name: 'Cycle snap' }));
    expect(screen.getByTestId('sheet').dataset.snap).toBe('half');

    fireEvent.click(screen.getByRole('button', { name: 'Cycle snap' }));
    expect(screen.getByTestId('sheet').dataset.snap).toBe('full');
  });

  it('steps down one snap per downward drag threshold', () => {
    render(<SheetHarness />);
    dragHandle(100, 160);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('half');

    dragHandle(100, 160);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('peek');
  });

  it('steps up one snap per upward drag threshold', () => {
    render(<SheetHarness initialSnap="peek" />);
    dragHandle(200, 140);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('half');

    dragHandle(200, 140);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('full');
  });

  it('dismisses from peek when the pull exceeds the dismiss threshold', () => {
    const onDismiss = vi.fn();
    render(<SheetHarness initialSnap="peek" onDismiss={onDismiss} />);

    dragHandle(100, 200);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sheet').dataset.snap).toBe('peek');
  });

  it('does not dismiss from peek on a short downward drag', () => {
    const onDismiss = vi.fn();
    render(<SheetHarness initialSnap="peek" onDismiss={onDismiss} />);

    dragHandle(100, 160);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('sheet').dataset.snap).toBe('peek');
  });

  it('ignores pointer down on nested controls inside the handle', () => {
    render(<SheetHarness />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inner control' }), {
      clientY: 100,
      pointerId: 1,
      button: 0
    });
    fireEvent.pointerMove(screen.getByTestId('handle'), { clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId('handle'), { clientY: 200, pointerId: 1 });

    expect(screen.getByTestId('sheet').dataset.snap).toBe('full');
  });

  it('resets snap and clears inline transform when disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => {
        const snap = useSheetSnap({ enabled });
        return snap;
      },
      { initialProps: { enabled: true } }
    );

    const node = document.createElement('div');
    result.current.nodeRef.current = node;
    node.style.transform = 'translateY(40px)';

    act(() => {
      result.current.setSnap('half');
    });
    expect(result.current.snap).toBe('half');

    rerender({ enabled: false });

    expect(result.current.snap).toBe(DEFAULT_SHEET_SNAP);
    expect(node.style.transform).toBe('');
  });
});
