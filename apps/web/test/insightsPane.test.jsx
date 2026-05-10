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
        onClose={vi.fn()}
        soundEnabled
        onSoundEnabledChange={vi.fn()}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Content updates')).toBeTruthy();
    expect(screen.getByText('Technical actions')).toBeTruthy();
    expect(screen.getByText('Read diagram snapshot')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();
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
        onClose={vi.fn()}
        soundEnabled={false}
        onSoundEnabledChange={onSoundEnabledChange}
        celebratingEntryId="entry-1"
      />
    );

    expect(screen.getByText('Done')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(onSoundEnabledChange).toHaveBeenCalledWith(true);
  });
});
