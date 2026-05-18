// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ErrorToast from '../src/components/ErrorToast.jsx';
import {
  _resetForTests,
  dismissError,
  getErrors,
  pushError
} from '../src/state/errorToastStore.js';

describe('errorToastStore + ErrorToast', () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    _resetForTests();
  });

  it('renders nothing when there are no errors', () => {
    const { container } = render(<ErrorToast />);
    expect(container.querySelector('.error-toast-root')).toBeNull();
  });

  it('pushError surfaces a toast in the DOM', () => {
    render(<ErrorToast />);
    act(() => {
      pushError('Network unreachable');
    });
    const toasts = screen.getAllByTestId('error-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toContain('Network unreachable');
  });

  it('auto-dismisses after the TTL', () => {
    render(<ErrorToast />);
    act(() => {
      pushError('Temporary issue', { ttlMs: 1000 });
    });
    expect(screen.getAllByTestId('error-toast')).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryAllByTestId('error-toast')).toHaveLength(0);
  });

  it('manual dismiss removes the toast', () => {
    render(<ErrorToast />);
    act(() => {
      pushError('Click me to dismiss', { ttlMs: 0 });
    });
    expect(screen.getAllByTestId('error-toast')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss error' }));
    expect(screen.queryAllByTestId('error-toast')).toHaveLength(0);
  });

  it('dedupes identical messages within the 1s window', () => {
    render(<ErrorToast />);
    act(() => {
      pushError('Same message');
      pushError('Same message');
      pushError('Same message');
    });
    expect(screen.getAllByTestId('error-toast')).toHaveLength(1);
  });

  it('allows the same message again after the dedupe window passes', () => {
    render(<ErrorToast />);
    act(() => {
      pushError('Recurring', { ttlMs: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    act(() => {
      pushError('Recurring', { ttlMs: 0 });
    });
    expect(screen.getAllByTestId('error-toast')).toHaveLength(2);
  });

  it('caps visible toasts at 5', () => {
    render(<ErrorToast />);
    act(() => {
      for (let i = 0; i < 8; i += 1) pushError(`msg ${i}`, { ttlMs: 0 });
    });
    expect(screen.getAllByTestId('error-toast')).toHaveLength(5);
  });

  it('ignores empty or whitespace-only messages', () => {
    const before = getErrors().length;
    act(() => {
      const id1 = pushError('');
      const id2 = pushError('   ');
      const id3 = pushError(null);
      expect(id1).toBeNull();
      expect(id2).toBeNull();
      expect(id3).toBeNull();
    });
    expect(getErrors().length).toBe(before);
  });

  it('dismissError on unknown id is a no-op', () => {
    act(() => {
      pushError('keep me', { ttlMs: 0 });
    });
    const before = getErrors().length;
    dismissError('nonexistent');
    expect(getErrors().length).toBe(before);
  });
});
