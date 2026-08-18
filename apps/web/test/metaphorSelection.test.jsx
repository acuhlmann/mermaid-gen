// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  TAP_SLOP_PX,
  createMetaphorSelectionStore,
  createTapGesture
} from '../src/components/metaphorSelection.js';
import { MetaphorInspectorPanel } from '../src/components/MetaphorOverlays.jsx';

/**
 * Tap-to-inspect is the phone's only route to an item's encoded metrics — hover
 * is a mouse affordance and a touch "hover" is a flash under the finger. These
 * pin the store's contract and the panel that reads it.
 */
describe('metaphor selection store', () => {
  it('holds a pick until it is cleared', () => {
    const store = createMetaphorSelectionStore();
    expect(store.get()).toBeNull();
    const pick = { item: { id: 'checkout', label: 'Checkout' }, metaphor: 'city' };
    store.set(pick);
    expect(store.get()).toBe(pick);
    store.clear();
    expect(store.get()).toBeNull();
  });

  it('toggles the same item off and swaps to a different one', () => {
    const store = createMetaphorSelectionStore();
    store.toggle({ item: { id: 'checkout' }, metaphor: 'city' });
    expect(store.get()?.item.id).toBe('checkout');
    // A second tap on the same shape is a dismissal, not a re-select.
    store.toggle({ item: { id: 'checkout' }, metaphor: 'city' });
    expect(store.get()).toBeNull();
    store.toggle({ item: { id: 'checkout' }, metaphor: 'city' });
    store.toggle({ item: { id: 'payments' }, metaphor: 'city' });
    expect(store.get()?.item.id).toBe('payments');
  });

  it('notifies subscribers and stops after unsubscribe', () => {
    const store = createMetaphorSelectionStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set({ item: { id: 'a' } });
    expect(listener).toHaveBeenCalledTimes(1);
    // A no-op set must not wake the panel or the in-canvas marker.
    store.clear();
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.set({ item: { id: 'b' } });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps a tap budget small enough that an orbit drag is never a pick', () => {
    expect(TAP_SLOP_PX).toBeGreaterThan(0);
    expect(TAP_SLOP_PX).toBeLessThanOrEqual(12);
  });
});

describe('tap gesture', () => {
  const at = (x, y, pointerId = 1) => ({ clientX: x, clientY: y, pointerId });

  it('accepts a press and release in the same place', () => {
    const tap = createTapGesture();
    tap.start(at(100, 100));
    expect(tap.end(at(103, 102))).toBe(true);
  });

  it('rejects an orbit drag that happens to end over an item', () => {
    // Every rotation on a phone is a finger drag across the scene; selecting
    // whatever it lands on would make the scene impossible to turn.
    const tap = createTapGesture();
    tap.start(at(100, 100));
    expect(tap.end(at(160, 140))).toBe(false);
  });

  it('rejects a release from a different finger, and a release with no press', () => {
    const tap = createTapGesture();
    tap.start(at(100, 100, 1));
    expect(tap.end(at(100, 100, 2))).toBe(false);
    expect(tap.end(at(100, 100, 1))).toBe(false);
  });

  it('does not let one press arm two picks', () => {
    const tap = createTapGesture();
    tap.start(at(50, 50));
    expect(tap.end(at(50, 50))).toBe(true);
    expect(tap.end(at(50, 50))).toBe(false);
  });
});

describe('MetaphorInspectorPanel', () => {
  const store = () => {
    const s = createMetaphorSelectionStore();
    s.set({
      item: {
        id: 'payments-api',
        label: 'Payments API',
        height: 14,
        district: 'Commerce',
        note: 'Every checkout path runs through it.'
      },
      metaphor: 'city',
      layerLabel: 'Services as towers'
    });
    return s;
  };

  it('names the item, its layer, its metrics in the author’s words, and its note', () => {
    render(<MetaphorInspectorPanel store={store()} legend={{ height: 'team size' }} />);
    expect(screen.getByText('Payments API')).toBeTruthy();
    expect(screen.getByText('Layer: Services as towers')).toBeTruthy();
    // The legend phrase relabels the axis — that is what makes a number mean
    // something rather than read as "Height: 14".
    expect(screen.getByText('Team size')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('Commerce')).toBeTruthy();
    expect(screen.getByText('Every checkout path runs through it.')).toBeTruthy();
  });

  it('renders nothing until something is picked, and clears from the close button', () => {
    const s = createMetaphorSelectionStore();
    const { container, rerender } = render(<MetaphorInspectorPanel store={s} legend={null} />);
    expect(container.textContent).toBe('');

    const picked = store();
    rerender(<MetaphorInspectorPanel store={picked} legend={null} />);
    const close = container.querySelector('.metaphor-inspector-close');
    expect(close.getAttribute('aria-label')).toBe('Dismiss selection');
    fireEvent.click(close);
    expect(picked.get()).toBeNull();
  });

  it('reads a fused item through its own layer kind, not through "composite"', () => {
    // In a fused world HoverableItem passes the LAYER's kind, which is what
    // picks the metric vocabulary — 'composite' has none of its own.
    const s = createMetaphorSelectionStore();
    s.set({
      item: { id: 'auth', label: 'Auth', mass: 8, chain: 'Platform' },
      metaphor: 'archipelago',
      layerLabel: 'Domains as islands'
    });
    render(<MetaphorInspectorPanel store={s} legend={{ mass: 'domain scale' }} />);
    expect(screen.getByText('Domain scale')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('Platform')).toBeTruthy();
  });
});
