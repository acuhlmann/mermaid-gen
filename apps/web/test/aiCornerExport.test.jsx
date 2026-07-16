// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiCornerControlsInner } from '../src/components/AiCornerControlsInner.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

vi.mock('../src/utils/exportDiagram.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    exportDiagram: vi.fn(async () => ({ filename: 'archislop-chart.csv' }))
  };
});

import { exportDiagram } from '../src/utils/exportDiagram.js';

const chartSource = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    mark: 'bar',
    data: { values: [{ a: 'x', b: 1 }] }
  }
});

describe('AiCornerControlsInner export', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows an expandable export list for the active mode', async () => {
    render(
      <AiCornerControlsInner
        controls={CONTROLS_EN.settings}
        modelProfile="fast"
        onSelectModelProfile={() => {}}
        pendingHandshake={null}
        externalAgentPresence={[]}
        onInviteAgent={() => {}}
        agentThinkingChrome={false}
        insightsOpen={false}
        onToggleInsights={() => {}}
        includeThinkingToggle={false}
        contentType="chart"
        diagramSource={chartSource}
      />
    );

    // Settings panel starts open in test mode; export disclosure too.
    expect(screen.getByRole('button', { name: /Export/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Spreadsheet CSV/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Chart JSON/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Vega-Lite spec/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Spreadsheet CSV/i }));
    await waitFor(() => {
      expect(exportDiagram).toHaveBeenCalledWith({
        contentType: 'chart',
        diagramSource: chartSource,
        formatId: 'chart-csv'
      });
    });
  });

  it('disables export when there is no source', () => {
    render(
      <AiCornerControlsInner
        controls={CONTROLS_EN.settings}
        modelProfile="fast"
        onSelectModelProfile={() => {}}
        pendingHandshake={null}
        externalAgentPresence={[]}
        onInviteAgent={() => {}}
        agentThinkingChrome={false}
        insightsOpen={false}
        onToggleInsights={() => {}}
        includeThinkingToggle={false}
        contentType="mermaid"
        diagramSource=""
      />
    );

    expect(screen.getByRole('button', { name: /Export/i }).disabled).toBe(true);
    expect(screen.getByText(/Generate something first/i)).toBeTruthy();
  });
});
