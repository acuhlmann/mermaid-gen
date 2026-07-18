// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeDirectory from '../src/components/OfficeDirectory.jsx';
import {
  readOfficeDirectorySeen,
  OFFICE_DIRECTORY_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES } from '../src/utils/officeCast.js';

// Derived from the live roster so this test doesn't need a manual update every
// time a colleague is added or removed (see docs/office-parody.md roster).
const COLLEAGUE_COUNT = Object.keys(OFFICE_COLLEAGUES).length;

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('OfficeDirectory', () => {
  it('opens a stepped first-run tour instead of dumping the whole roster', () => {
    render(<OfficeDirectory />);
    expect(screen.getByTestId('office-directory-tour')).toBeTruthy();
    expect(screen.getByTestId('office-directory-welcome')).toBeTruthy();
    expect(screen.getByText(/Your new floor/)).toBeTruthy();
    expect(screen.queryByTestId('office-directory-roster')).toBeNull();
    expect(screen.queryByText('Facilities & Fridge Czar')).toBeNull();
  });

  it('introduces colleagues one at a time, then clocks in', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByRole('button', { name: /Meet the floor/ }));
    expect(screen.getByTestId('office-directory-spotlight')).toBeTruthy();
    expect(screen.getByText('Chad')).toBeTruthy();
    expect(screen.getByText(`1 of ${COLLEAGUE_COUNT}`)).toBeTruthy();
    expect(screen.queryByText('Pam')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('Pam')).toBeTruthy();
    expect(screen.getByText(`2 of ${COLLEAGUE_COUNT}`)).toBeTruthy();

    // Two steps down already (welcome -> Chad -> Pam); click through the rest
    // of the roster. The guard makes extra iterations harmless once the tour
    // reaches its last step and the button becomes "Clock in".
    for (let i = 0; i < COLLEAGUE_COUNT; i += 1) {
      const next = screen.queryByRole('button', { name: /Next/ });
      if (next) fireEvent.click(next);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Clock in' }));
    expect(screen.queryByText('Facilities & Fridge Czar')).toBeNull();
    expect(screen.getByRole('button', { name: /Meet the floor/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY)).toBe('1');
  });

  it('skips the tour and collapses to the Meet-the-office chip', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('button', { name: /Meet the floor/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
  });

  it('reopens the full roster for returning users', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    render(<OfficeDirectory />);
    expect(screen.queryByText(/Day one at ArchiSlop/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Meet the floor/ }));
    expect(screen.getByTestId('office-directory-roster')).toBeTruthy();
    for (const name of ['Chad', 'Pam', 'Ticket Bot Dave', 'Gary', 'Linda', 'Ulrich', 'Sasha']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText('Facilities & Fridge Czar')).toBeTruthy();
  });
});
