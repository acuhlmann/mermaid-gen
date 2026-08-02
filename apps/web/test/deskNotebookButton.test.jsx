// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeskNotebookButton from '../src/components/DeskNotebookButton.jsx';
import { resolveNotebookLiveCue } from '../src/utils/resolveNotebookLiveCue.js';

afterEach(() => cleanup());

describe('resolveNotebookLiveCue', () => {
  it('returns null when nothing is in flight', () => {
    expect(resolveNotebookLiveCue(null, false, {})).toBeNull();
  });

  it('uses busy fallback copy when the entry has not landed yet', () => {
    const cue = resolveNotebookLiveCue(null, true, {
      thinkingLiveWorking: 'Still scribbling…'
    });
    expect(cue).toEqual({
      emoji: '✏️',
      name: null,
      statusLine: 'Still scribbling…'
    });
  });

  it('surfaces persona + status from a live entry', () => {
    const cue = resolveNotebookLiveCue(
      {
        status: 'running',
        variant: 'gilfoyle',
        statusText: 'Polishing the edges…'
      },
      false,
      { thinkingLiveWorking: 'Still scribbling…' }
    );
    expect(cue?.name).toMatch(/Gilfoyle/i);
    expect(cue?.emoji).toBeTruthy();
    expect(cue?.statusLine).toMatch(/Polishing|Fixing|Working|scribbling/i);
  });
});

describe('DeskNotebookButton live cue', () => {
  it('hides the live cue while the notebook pane is open', () => {
    render(
      <DeskNotebookButton
        thinkingOpen
        busy
        liveEntry={{ status: 'running', variant: 'gilfoyle', statusText: 'Working…' }}
        onToggleThinking={vi.fn()}
      />
    );
    expect(screen.queryByTestId('desk-notebook-live-cue')).toBeNull();
    expect(screen.getByTestId('desk-notebook-button').className).not.toMatch(/is-live-run/);
  });

  it('shows a compact live cue when the pane is closed mid-run', () => {
    const onToggleThinking = vi.fn();
    render(
      <DeskNotebookButton
        thinkingOpen={false}
        busy
        liveEntry={{
          status: 'running',
          variant: 'gilfoyle',
          statusText: 'Still working…'
        }}
        onToggleThinking={onToggleThinking}
      />
    );
    const cue = screen.getByTestId('desk-notebook-live-cue');
    expect(cue.textContent).toMatch(/Still working|scribbling|Fixing|Working/i);
    expect(screen.getByTestId('desk-notebook-button').className).toMatch(/is-live-run/);
    fireEvent.click(cue);
    expect(onToggleThinking).toHaveBeenCalledTimes(1);
  });
});
