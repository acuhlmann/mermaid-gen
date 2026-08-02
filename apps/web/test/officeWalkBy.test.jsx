// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficeWalkBy from '../src/components/OfficeWalkBy.jsx';
import {
  _resetForTests,
  setOfficeCaptions,
  setOfficeNarration
} from '../src/state/officeMomentStore.js';
import { FOCUS_Z_BASE, resetOverlayStackForTests } from '../src/state/overlayStack.js';

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

  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
  });

  it('hides the speech body while TTS is speaking (voice-first)', async () => {
    const narrateLine = vi.fn(() => new Promise(() => {}));
    render(
      <OfficeWalkBy
        walkBy={walkBy}
        onDismiss={vi.fn()}
        onAdoptPrompt={vi.fn()}
        narrateLine={narrateLine}
      />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId('office-walkby')).toBeTruthy();
    expect(document.querySelector('.office-walkby--shoulder')).toBeTruthy();
    expect(document.querySelector('.office-walkby-head')).toBeTruthy();
    expect(screen.queryByText(walkBy.body)).toBeNull();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
  });

  it('falls back to the spoken line when TTS returns silent', async () => {
    const narrateLine = vi.fn(async () => ({ spoken: false }));
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} narrateLine={narrateLine} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(walkBy.body)).toBeTruthy();
  });

  it('shows the spoken line when captions are on', async () => {
    setOfficeCaptions(true);
    const narrateLine = vi.fn(async () => ({ spoken: true }));
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} narrateLine={narrateLine} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(walkBy.body)).toBeTruthy();
  });

  it('shows the spoken line when narration is off', () => {
    setOfficeNarration(false);
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} />);
    expect(screen.getByText(walkBy.body)).toBeTruthy();
  });

  it('registers on the focus stack above floating windows', async () => {
    render(<OfficeWalkBy walkBy={walkBy} onDismiss={vi.fn()} />);
    await act(async () => {
      await Promise.resolve();
    });
    const overlay = screen.getByTestId('office-walkby');
    expect(Number(overlay.style.zIndex)).toBeGreaterThanOrEqual(FOCUS_Z_BASE);
  });
});
