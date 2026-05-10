// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InsightsPane from '../src/components/InsightsPane.jsx';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

describe('InsightsPane', () => {
  it('renders rich content and technical action lane', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-1',
            title: 'Go - diagram',
            status: 'running',
            statusText: 'Working on your request...',
            content: '### Recommended edits\n- **Rename** _Prototype Ideas_',
            technicalActions: [
              { id: 't1', name: 'get_diagram_state', label: 'Read diagram snapshot', status: 'done' }
            ]
          }
        ]}
        soundEnabled
        onSoundEnabledChange={vi.fn()}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Content updates')).toBeTruthy();
    expect(screen.getByText('Technical actions')).toBeTruthy();
    expect(screen.getByText('Read diagram snapshot')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Working on your request...')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('shows done state and supports sound toggle', () => {
    const onSoundEnabledChange = vi.fn();
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-1',
            title: 'Refine - diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: []
          }
        ]}
        soundEnabled={false}
        onSoundEnabledChange={onSoundEnabledChange}
        celebratingEntryId="entry-1"
      />
    );

    expect(screen.getByText('Done')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onSoundEnabledChange).toHaveBeenCalledWith(true);
  });

  it('shows agent phases, patch summary, and optional stream debug', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-phases',
            title: 'Go — diagram',
            status: 'running',
            statusText: 'Working…',
            content: '',
            technicalActions: [],
            phases: [
              { id: 'intent', label: 'Applying your request…' },
              { id: 'agent_run', label: 'Planning and executing tools…' }
            ],
            artifacts: [
              { kind: 'patch_summary', revisionId: 7, linesAdded: 3, linesRemoved: 1 }
            ],
            streamDebugLog: [{ type: 'phase', id: 'intent', _ts: 1 }]
          }
        ]}
        soundEnabled
        onSoundEnabledChange={vi.fn()}
        celebratingEntryId={null}
        streamDebugEnabled
      />
    );

    expect(screen.getByRole('region', { name: 'Agent phases' })).toBeTruthy();
    expect(screen.getByText('Applying your request…')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Working…')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Patch summary' })).toBeTruthy();
    expect(screen.getByText('+3 / −1 lines')).toBeTruthy();
    expect(screen.getByText(/Raw stream events/i)).toBeTruthy();
  });
});
