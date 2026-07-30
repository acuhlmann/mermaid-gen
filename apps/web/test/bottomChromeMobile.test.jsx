// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentPresenceBar from '../src/components/AgentPresenceBar.jsx';

describe('mobile bottom chrome helpers', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('caps visible agent chips on narrow viewports', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query) => ({
        matches: query.includes('1024px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    );

    const agents = [
      { agentId: 'a1', agentName: 'One' },
      { agentId: 'a2', agentName: 'Two' },
      { agentId: 'a3', agentName: 'Three' },
      { agentId: 'a4', agentName: 'Four' }
    ];

    render(<AgentPresenceBar presence={agents} />);
    expect(screen.getByLabelText('1 more agents').textContent).toBe('+1');
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.queryByText('Four')).toBeNull();
  });
});
