// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ControlsPanel from '../src/components/ControlsPanel.jsx';

const baseSettings = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

describe('ControlsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  it('contains only settings controls and no prompt field', () => {
    render(
      <ControlsPanel
        settings={baseSettings}
        onSettingsChange={vi.fn()}
        onUndo={vi.fn()}
        onCoAuthorExtend={vi.fn()}
        loading={false}
        prompt="Add an API gateway"
      />
    );

    expect(screen.queryByLabelText('Prompt')).toBeNull();
    expect(screen.getByRole('button', { name: 'Co-author extend' })).toBeTruthy();
  });

  it('sends manual co-author trigger with the shared prompt', () => {
    const onCoAuthorExtend = vi.fn();
    render(
      <ControlsPanel
        settings={baseSettings}
        onSettingsChange={vi.fn()}
        onUndo={vi.fn()}
        onCoAuthorExtend={onCoAuthorExtend}
        loading={false}
        prompt="Design a resilient ingestion flow"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Co-author extend' }));
    expect(onCoAuthorExtend).toHaveBeenCalledWith('Design a resilient ingestion flow');
  });
});
