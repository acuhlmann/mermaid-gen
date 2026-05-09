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

  it('contains only co-author settings controls and no prompt field', () => {
    render(
      <ControlsPanel
        settings={baseSettings}
        onSettingsChange={vi.fn()}
        onUndo={vi.fn()}
        loading={false}
      />
    );

    expect(screen.queryByLabelText('Prompt')).toBeNull();
    expect(screen.getByLabelText('Agent tone')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('sends settings changes and undo actions', () => {
    const onSettingsChange = vi.fn();
    const onUndo = vi.fn();
    render(
      <ControlsPanel
        settings={baseSettings}
        onSettingsChange={onSettingsChange}
        onUndo={onUndo}
        loading={false}
      />
    );

    fireEvent.change(screen.getByLabelText('Agent tone'), {
      target: { value: 'bold' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(onSettingsChange).toHaveBeenCalledWith('styleGuide', 'bold');
    expect(onUndo).toHaveBeenCalled();
  });
});
