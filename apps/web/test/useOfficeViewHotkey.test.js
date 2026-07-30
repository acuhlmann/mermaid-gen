// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode
} from '../src/state/officeViewModeStore.js';
import { useOfficeViewHotkey } from '../src/hooks/useOfficeViewHotkey.js';
import { renderHook } from '@testing-library/react';

describe('useOfficeViewHotkey', () => {
  beforeEach(() => {
    _resetOfficeViewModeForTests();
  });

  afterEach(() => {
    cleanup();
    _resetOfficeViewModeForTests();
  });

  it('toggles desk ↔ floor on Shift+O', () => {
    renderHook(() => useOfficeViewHotkey({ enabled: true }));
    expect(getOfficeViewMode()).toBe('desk');

    fireEvent.keyDown(window, { key: 'O', shiftKey: true });
    expect(getOfficeViewMode()).toBe('floor');

    fireEvent.keyDown(window, { key: 'O', shiftKey: true });
    expect(getOfficeViewMode()).toBe('desk');
  });

  it('does not fire while typing in a field', () => {
    renderHook(() => useOfficeViewHotkey({ enabled: true }));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'O', shiftKey: true });
    expect(getOfficeViewMode()).toBe('desk');
    input.remove();
  });

  it('stays off during boot when disabled', () => {
    renderHook(() => useOfficeViewHotkey({ enabled: false }));
    fireEvent.keyDown(window, { key: 'O', shiftKey: true });
    expect(getOfficeViewMode()).toBe('desk');
  });
});
