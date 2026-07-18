// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DayOneBadge from '../src/components/DayOneBadge.jsx';
import {
  OFFICE_DAY_ONE_BADGE_STORAGE_KEY,
  readDayOneBadgeSeen
} from '../src/utils/officeAmbienceStorage.js';

const COPY = {
  eyebrow: 'ArchiSlop Corp. · Employee Badge',
  rolePrefix: 'New Hire',
  hrLine: 'Badge photo: pending.',
  pitchLine: 'They hired a rockstar.',
  dismissAria: 'Put the badge away'
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('DayOneBadge', () => {
  it('renders the new-hire role with the current level title', () => {
    render(<DayOneBadge copy={COPY} userTitle="Intern Architect" />);
    expect(screen.getByTestId('day-one-badge')).toBeTruthy();
    expect(screen.getByText('New Hire — Intern Architect')).toBeTruthy();
    expect(screen.getByText(COPY.eyebrow)).toBeTruthy();
    expect(screen.getByText(COPY.pitchLine)).toBeTruthy();
  });

  it('renders the bare role when no level title is available yet', () => {
    render(<DayOneBadge copy={COPY} userTitle="" />);
    expect(screen.getByText('New Hire')).toBeTruthy();
  });

  it('dismisses persistently, like the office directory tour', () => {
    render(<DayOneBadge copy={COPY} userTitle="Intern Architect" />);
    fireEvent.click(screen.getByRole('button', { name: COPY.dismissAria }));
    expect(screen.queryByTestId('day-one-badge')).toBeNull();
    expect(readDayOneBadgeSeen()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_DAY_ONE_BADGE_STORAGE_KEY)).toBe('1');

    cleanup();
    render(<DayOneBadge copy={COPY} userTitle="Intern Architect" />);
    expect(screen.queryByTestId('day-one-badge')).toBeNull();
  });

  it('renders nothing without copy (locale bundle missing the section)', () => {
    const { container } = render(<DayOneBadge copy={undefined} userTitle="Intern Architect" />);
    expect(container.firstChild).toBeNull();
  });
});
