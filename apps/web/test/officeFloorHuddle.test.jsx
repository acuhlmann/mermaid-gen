// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloorHuddleCard } from '../src/components/officeFloor/FloorHuddle.jsx';
import { officeChromeCopy } from '../src/utils/officeCast.js';
import { awayFromDeskIds } from '../src/utils/officeSceneCast.js';
import { HUDDLE_TILES, floorZoneToneAt } from '../src/utils/officeFloorPlan.js';

describe('floor huddle', () => {
  afterEach(() => cleanup());

  it('reserves six ring tiles around your desk', () => {
    expect(HUDDLE_TILES).toHaveLength(6);
  });

  it('empties teammate desks while huddling without moving you', () => {
    const away = awayFromDeskIds({
      huddle: { attendees: ['gilfoyle', 'dinesh'] },
      playerId: 'you'
    });
    expect(away).toContain('gilfoyle');
    expect(away).toContain('dinesh');
    expect(away).not.toContain('you');
  });

  it('renders a hard-stop card for the floor huddle', () => {
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', phase: 'gathering', attendees: ['gilfoyle'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
      />
    );
    expect(screen.getByTestId('office-floor-huddle-card')).toBeTruthy();
    expect(screen.getByText(/Hard stop/i)).toBeTruthy();
  });

  it('shows Do it on the floor card when the active beat carries an action prompt', () => {
    const handleDoIt = vi.fn();
    render(
      <FloorHuddleCard
        huddle={{ id: 'h1', phase: 'speaking', attendees: ['dinesh'] }}
        copy={officeChromeCopy().floor}
        onHardStop={vi.fn()}
        ringControls={{
          activeBeat: { speakerId: 'dinesh', text: 'Split Auth.', actionPrompt: 'Split Auth node' },
          activeSpeakerId: 'dinesh',
          pinnedSpeakerId: null,
          pinnedPrompt: null,
          handleDoIt
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Do it/i }));
    expect(handleDoIt).toHaveBeenCalledWith('dinesh', 'Split Auth node');
  });
});

describe('floorZoneToneAt', () => {
  it('maps kitchen / meeting / pod tiles to zone tones', () => {
    expect(floorZoneToneAt({ x: 1, y: 7 })).toBe('kitchen');
    expect(floorZoneToneAt({ x: 10, y: 7 })).toBe('glass');
    expect(floorZoneToneAt({ x: 7, y: 7 })).toBe('pod');
    expect(floorZoneToneAt(null)).toBe('neutral');
  });
});
