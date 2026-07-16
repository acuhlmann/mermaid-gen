// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiCornerControlsInner } from '../src/components/AiCornerControlsInner.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

vi.mock('../src/utils/exportDiagram.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildExportPayload: vi.fn(async () => ({
      filename: 'archislop-chart-20260716-120000.csv',
      mime: 'text/csv;charset=utf-8',
      ext: 'csv',
      delivery: 'text',
      body: 'a,b\nx,1\n'
    })),
    deliverExportPayload: vi.fn(async (payload, action) => ({
      method: action === 'copy' ? 'clipboard-text' : action === 'share' ? 'share-file' : 'download',
      filename: payload.filename,
      previewUrl: 'blob:preview-mock',
      payload,
      formatId: 'chart-csv'
    })),
    isWebShareAvailable: vi.fn(() => true),
    canCopyExportPayload: vi.fn(() => true),
    canShareExportPayload: vi.fn(() => true)
  };
});

import { buildExportPayload, deliverExportPayload } from '../src/utils/exportDiagram.js';

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

  it('shows per-format save, copy, and share actions', async () => {
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

    expect(screen.getByText(/Spreadsheet CSV/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Save$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Copy$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Share$/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /^Save$/i })[0]);
    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalledWith({
        contentType: 'chart',
        diagramSource: chartSource,
        formatId: 'chart-csv'
      });
      expect(deliverExportPayload).toHaveBeenCalledWith(expect.any(Object), 'download');
    });

    expect(screen.getByText(/Saved to your device/i)).toBeTruthy();
    expect(screen.getByText(/archislop-chart-20260716-120000.csv/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open preview/i }).getAttribute('href')).toBe(
      'blob:preview-mock'
    );
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
