import { describe, expect, it } from 'vitest';
import { createMetaphorLayerFocusStore } from '../src/components/metaphorLayerFocus.js';

describe('createMetaphorLayerFocusStore', () => {
  it('normalizes empty and non-string values to null', () => {
    const store = createMetaphorLayerFocusStore();
    store.set('');
    expect(store.get()).toBeNull();
    store.set(null);
    expect(store.get()).toBeNull();
    store.set(undefined);
    expect(store.get()).toBeNull();
  });

  it('does not notify when set to the same value', () => {
    const store = createMetaphorLayerFocusStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.set('services');
    store.set('services');
    expect(calls).toBe(1);
  });

  it('toggles off when the same layer is pressed again', () => {
    const store = createMetaphorLayerFocusStore();
    store.toggle('services');
    expect(store.get()).toBe('services');
    store.toggle('services');
    expect(store.get()).toBeNull();
  });

  it('moves focus rather than stacking when another layer is toggled', () => {
    const store = createMetaphorLayerFocusStore();
    store.toggle('domains');
    store.toggle('services');
    expect(store.get()).toBe('services');
  });

  it('clear is idempotent', () => {
    const store = createMetaphorLayerFocusStore();
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.clear();
    expect(calls).toBe(0);
    store.set('services');
    store.clear();
    expect(store.get()).toBeNull();
    store.clear();
    expect(calls).toBe(2);
  });
});
