// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import IntroTranscriptButton from '../src/components/IntroTranscriptButton.jsx';

describe('IntroTranscriptButton', () => {
  afterEach(() => cleanup());

  it('toggles transcript visibility on click', () => {
    const onToggle = vi.fn();
    render(
      <IntroTranscriptButton
        enabled={false}
        label="Transcript"
        enabledLabel="Hide text"
        title="Show text"
        onToggle={onToggle}
      />
    );
    fireEvent.click(screen.getByTestId('intro-transcript-button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { pressed: false }).textContent).toContain('Transcript');
  });

  it('shows the on label when enabled', () => {
    render(
      <IntroTranscriptButton
        enabled
        label="Transcript"
        enabledLabel="Hide text"
        title="Show text"
        onToggle={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { pressed: true }).textContent).toContain('Hide text');
  });
});
