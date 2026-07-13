// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ModeRevealSpotlight from '../src/components/ModeRevealSpotlight.jsx';
import {
  readModeRevealSeen,
  writeModeRevealSeen,
  MODE_REVEAL_SEEN_KEY
} from '../src/utils/modeRevealStorage.js';

const MODES = [
  { id: 'mermaid', shortLabel: 'Diagram', subtitle: 'Mermaid graph' },
  { id: 'chart', shortLabel: 'Chart', subtitle: 'Vega-Lite data view' },
  { id: 'metaphor3d', shortLabel: '3D', subtitle: 'Three.js scene' }
];

describe('ModeRevealSpotlight', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders eyebrow, body, mode chips, and dismiss', () => {
    render(
      <ModeRevealSpotlight
        eyebrow="Same topic, another form"
        body="You can switch modes anytime in Settings."
        modes={MODES}
        currentMode="mermaid"
        onPickMode={vi.fn()}
        dismissLabel="Got it"
        ariaLabel="Try another mode"
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getByText('Same topic, another form')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chart' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '3D' })).toBeTruthy();
  });

  it('marks the current mode chip and fires onPickMode / onDismiss', () => {
    const onPickMode = vi.fn();
    const onDismiss = vi.fn();
    render(
      <ModeRevealSpotlight
        eyebrow="Same topic, another form"
        body="You can switch modes anytime in Settings."
        modes={MODES}
        currentMode="mermaid"
        onPickMode={onPickMode}
        dismissLabel="Got it"
        ariaLabel="Try another mode"
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByRole('button', { name: 'Diagram' }).className).toContain('is-current');
    fireEvent.click(screen.getByRole('button', { name: 'Chart' }));
    expect(onPickMode).toHaveBeenCalledWith('chart');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without usable modes', () => {
    const { container } = render(<ModeRevealSpotlight modes={[]} dismissLabel="Got it" />);
    expect(container.querySelector('[data-testid="mode-reveal-spotlight"]')).toBeNull();
  });
});

describe('modeRevealStorage', () => {
  afterEach(() => window.localStorage.clear());

  it('defaults to not-seen, then persists seen', () => {
    expect(readModeRevealSeen()).toBe(false);
    writeModeRevealSeen();
    expect(window.localStorage.getItem(MODE_REVEAL_SEEN_KEY)).toBe('1');
    expect(readModeRevealSeen()).toBe(true);
  });
});
