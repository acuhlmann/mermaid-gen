// @vitest-environment jsdom
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearDeskSlotElement,
  getDeskSlotElement,
  setDeskSlotElement,
  subscribeDeskSlotElement
} from '../src/state/deskSlotStore.js';

describe('deskSlotStore', () => {
  beforeEach(() => {
    setDeskSlotElement(null);
  });

  afterEach(() => {
    setDeskSlotElement(null);
    cleanup();
  });

  it('publishes slot element updates to subscribers', () => {
    const el = document.createElement('div');
    const seen = [];
    const unsubscribe = subscribeDeskSlotElement(() => {
      seen.push(getDeskSlotElement());
    });

    setDeskSlotElement(el);
    expect(getDeskSlotElement()).toBe(el);
    expect(seen).toEqual([el]);

    clearDeskSlotElement(el);
    expect(getDeskSlotElement()).toBeNull();
    unsubscribe();
  });
});
