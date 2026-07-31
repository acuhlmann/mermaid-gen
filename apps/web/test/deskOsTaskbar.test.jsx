// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DeskOsTaskbar from '../src/components/DeskOsTaskbar.jsx';
import { registerOverlay, resetOverlayStackForTests } from '../src/state/overlayStack.js';
import {
  _resetOfficeViewModeForTests,
  getOfficeViewMode,
  standUp
} from '../src/state/officeViewModeStore.js';

const GAMIFICATION = {
  level: 3,
  levelTitle: 'Associate Slopitect',
  levelShortLabel: 'Lvl 3',
  levelFlair: '🏗️',
  levelProgressRatio: 0.4,
  xpIntoLevel: 40,
  xpForNextLevel: 100,
  xp: 240,
  prestigeShortLabel: 'P1',
  totalRuns: 12,
  runsByVariant: {},
  achievements: []
};

beforeEach(() => {
  resetOverlayStackForTests();
  _resetOfficeViewModeForTests();
});

afterEach(() => {
  cleanup();
  resetOverlayStackForTests();
  _resetOfficeViewModeForTests();
});

describe('DeskOsTaskbar', () => {
  // ADR-0011 rule 3: Stand up left the desk menu for the taskbar's leading
  // corner, but it is still a labelled conventional control, not a glyph.
  it('carries Stand up as the leading corner control', () => {
    render(<DeskOsTaskbar />);
    const standUpButton = screen.getByTestId('desk-standup-button');
    expect(standUpButton).toBeTruthy();
    expect(standUpButton.textContent).toMatch(/Stand up/i);

    fireEvent.click(standUpButton);
    expect(getOfficeViewMode()).toBe('floor');
  });

  // The bar reads the view-mode store directly, which is why it can live in the
  // shell tree instead of inside OfficeLayer.
  it('renders nothing on the isometric floor', () => {
    const view = render(<DeskOsTaskbar />);
    expect(screen.getByTestId('desk-os-taskbar')).toBeTruthy();

    standUp();
    view.rerender(<DeskOsTaskbar />);
    expect(screen.queryByTestId('desk-os-taskbar')).toBeNull();
  });

  it('shows the window list alongside its permanent residents', () => {
    registerOverlay('office-inbox', 'officeModal', {
      title: 'Inbox',
      kind: 'inbox',
      manageable: true
    });

    render(<DeskOsTaskbar gamification={GAMIFICATION} />);

    expect(screen.getByTestId('desk-standup-button')).toBeTruthy();
    expect(screen.getByTestId('desk-os-tray')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Inbox/ })).toBeTruthy();
  });

  it('keeps Stand up and the tray when no window is open', () => {
    render(<DeskOsTaskbar gamification={GAMIFICATION} />);
    expect(screen.queryByTestId('desk-os-tray')).toBeNull();
    expect(screen.getByTestId('desk-standup-button')).toBeTruthy();
    expect(screen.getByTestId('xp-progress-bar')).toBeTruthy();
  });

  // Run status moved out of the bottom chrome — the tray end is where an OS
  // puts "what is happening right now".
  it('shows run status and the stop control in the tray end', () => {
    const onStop = vi.fn();
    render(
      <DeskOsTaskbar status="Transforming diagram." stoppable stopLabel="Stop" onStop={onStop} />
    );

    expect(screen.getByRole('status').textContent).toBe('Transforming diagram.');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('flags an error status', () => {
    render(<DeskOsTaskbar status="Something broke." error />);
    expect(screen.getByRole('status').className).toContain('is-error');
  });

  it('hides the stop control when the run is not stoppable', () => {
    render(<DeskOsTaskbar status="Working." stopLabel="Stop" onStop={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });

  // XP demoted from the brand chip to the tray, like a system clock.
  it('renders XP and the prestige badge in the tray, not the brand chip', () => {
    render(<DeskOsTaskbar gamification={GAMIFICATION} onToggleXpInfoPanel={vi.fn()} />);
    const xp = screen.getByTestId('xp-progress-bar');
    expect(xp.closest('.desk-os-taskbar-xp')).toBeTruthy();
    expect(screen.getByTestId('brand-prestige-badge').textContent).toBe('P1');
  });

  it('opens the level panel from the tray XP chip', () => {
    const onToggleXpInfoPanel = vi.fn();
    const view = render(
      <DeskOsTaskbar gamification={GAMIFICATION} onToggleXpInfoPanel={onToggleXpInfoPanel} />
    );
    fireEvent.click(screen.getByTestId('xp-progress-bar'));
    expect(onToggleXpInfoPanel).toHaveBeenCalledTimes(1);

    view.rerender(
      <DeskOsTaskbar
        gamification={GAMIFICATION}
        xpInfoPanelOpen
        onToggleXpInfoPanel={onToggleXpInfoPanel}
      />
    );
    expect(screen.getByTestId('levelup-info-panel')).toBeTruthy();
  });

  it('omits the XP chip entirely before the first level lands', () => {
    render(<DeskOsTaskbar gamification={null} />);
    expect(screen.queryByTestId('xp-progress-bar')).toBeNull();
  });

  it('offers Concentration only when a handler is wired', () => {
    const onSelectModelProfile = vi.fn();
    const view = render(<DeskOsTaskbar />);
    expect(screen.queryByTestId('concentration-control')).toBeNull();

    view.rerender(
      <DeskOsTaskbar modelProfile="quality" onSelectModelProfile={onSelectModelProfile} />
    );
    expect(screen.getByTestId('concentration-control').className).toContain(
      'concentration-control--tray'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rush job' }));
    expect(onSelectModelProfile).toHaveBeenCalledWith('fast');
  });
});
