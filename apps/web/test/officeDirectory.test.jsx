// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import OfficeDirectory from '../src/components/OfficeDirectory.jsx';
import {
  readOfficeDirectorySeen,
  OFFICE_DIRECTORY_STORAGE_KEY
} from '../src/utils/officeAmbienceStorage.js';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('OfficeDirectory', () => {
  it('opens on first run and introduces every colleague with name, role, and bit', () => {
    render(<OfficeDirectory />);
    expect(screen.getByText(/Welcome to the office/)).toBeTruthy();
    for (const name of ['Chad', 'Pam', 'Ticket Bot Dave', 'Gary', 'Linda', 'Ulrich']) {
      expect(screen.getByText(name)).toBeTruthy();
    }
    expect(screen.getByText('Facilities & Fridge Czar')).toBeTruthy();
    expect(screen.getByText(/accidentally profound/)).toBeTruthy();
  });

  it('collapses to the Meet-the-office chip on Clock in, and persists', () => {
    render(<OfficeDirectory />);
    fireEvent.click(screen.getByRole('button', { name: 'Clock in' }));
    expect(screen.queryByText('Facilities & Fridge Czar')).toBeNull();
    expect(screen.getByRole('button', { name: /Meet the office/ })).toBeTruthy();
    expect(readOfficeDirectorySeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DIRECTORY_STORAGE_KEY)).toBe('1');
  });

  it('starts collapsed for returning users and re-expands on demand', () => {
    window.localStorage.setItem(OFFICE_DIRECTORY_STORAGE_KEY, '1');
    render(<OfficeDirectory />);
    expect(screen.queryByText(/Welcome to the office/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Meet the office/ }));
    expect(screen.getByText(/Welcome to the office/)).toBeTruthy();
  });
});
