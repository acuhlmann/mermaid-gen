// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react';
import NameTag from '../src/components/NameTag.jsx';
import {
  _resetUserIdentityForTests,
  getStoredUserName,
  resolveUserName
} from '../src/state/userIdentityStore.js';

beforeEach(() => {
  window.localStorage.clear();
  _resetUserIdentityForTests();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  _resetUserIdentityForTests();
});

describe('NameTag', () => {
  it('shows the default placeholder until the user names themselves', () => {
    render(<NameTag />);
    expect(screen.getByText('Newbie')).toBeTruthy();
    expect(resolveUserName()).toBe('Newbie');
  });

  it('lets the user type a name and commits it to the shared store', () => {
    render(<NameTag />);
    fireEvent.click(screen.getByTestId('name-tag'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Bighead' } });
    fireEvent.submit(input.closest('form'));
    expect(getStoredUserName()).toBe('Bighead');
    expect(screen.getByText('Bighead')).toBeTruthy();
  });

  it('persists the name while typing so a refresh does not lose it', async () => {
    vi.useFakeTimers();
    render(<NameTag />);
    fireEvent.click(screen.getByTestId('name-tag'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Bighead' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(getStoredUserName()).toBe('Bighead');
    vi.useRealTimers();
  });

  it('discards the edit on Escape', () => {
    render(<NameTag />);
    fireEvent.click(screen.getByTestId('name-tag'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Jian-Yang' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(getStoredUserName()).toBe('');
    expect(screen.getByText('Newbie')).toBeTruthy();
  });
});
