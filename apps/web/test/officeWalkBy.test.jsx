// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeWalkBy from '../src/components/OfficeWalkBy.jsx';
import {
  _resetForTests,
  setOfficeCaptions,
  setOfficeNarration
} from '../src/state/officeMomentStore.js';

const walkBy = {
  id: 'walkby-1',
  colleagueId: 'intern',
  body: 'is that a Gantt chart with feelings?',
  actionPrompt: 'Make it less of a feelings deck'
};

describe('OfficeWalkBy', () => {
  beforeEach(() => {
    _resetForTests();
    setOfficeNarration(true);
    setOfficeCaptions(false);
  });

  afterEach(() => cleanup());

  it('leans a big head in from above without a speech body when narration is on', () => {
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} onAdoptPrompt={vi.fn()} />);
    expect(screen.getByTestId('office-walkby')).toBeTruthy();
    expect(document.querySelector('.office-walkby--shoulder')).toBeTruthy();
    expect(document.querySelector('.office-walkby-head')).toBeTruthy();
    expect(screen.queryByText(walkBy.body)).toBeNull();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
  });

  it('shows the spoken line when captions are on', () => {
    setOfficeCaptions(true);
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} />);
    expect(screen.getByText(walkBy.body)).toBeTruthy();
  });

  it('shows the spoken line when narration is off', () => {
    setOfficeNarration(false);
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} />);
    expect(screen.getByText(walkBy.body)).toBeTruthy();
  });
});
