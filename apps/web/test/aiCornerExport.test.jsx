// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      previewUrl: action === 'download' ? 'blob:preview-mock' : null,
      payload
    })),
    startWebShare: vi.fn(async (payload) => 'share-file'),
    isWebShareAvailable: vi.fn(() => true),
    canCopyExportPayload: vi.fn(() => true),
    canShareExportPayload: vi.fn(() => true)
  };
});

import {
  buildExportPayload,
  deliverExportPayload,
  startWebShare
} from '../src/utils/exportDiagram.js';

const chartSource = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    mark: 'bar',
    data: { values: [{ a: 'x', b: 1 }] }
  }
});

function openExportList() {
  fireEvent.click(screen.getByRole('button', { name: /^Export$/i }));
}

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

    openExportList();

    expect(screen.getByText(/Spreadsheet CSV/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Save$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Copy$/i }).length).toBeGreaterThan(0);
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Share$/i }).length).toBeGreaterThan(0);
    });

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

  it('uses pre-warmed payload for share without rebuilding on click', async () => {
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

    openExportList();

    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalled();
    });

    const shareButtons = screen.getAllByRole('button', { name: /^Share$/i });
    const callsBeforeShare = buildExportPayload.mock.calls.length;
    fireEvent.click(shareButtons[0]);

    await waitFor(() => {
      expect(startWebShare).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'archislop-chart-20260716-120000.csv' })
      );
    });
    expect(buildExportPayload.mock.calls.length).toBe(callsBeforeShare);
    expect(deliverExportPayload).not.toHaveBeenCalledWith(expect.any(Object), 'share');
  });

  it('shows a brief copy toast without action buttons', async () => {
    vi.useFakeTimers();
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

    openExportList();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /^Copy$/i })[0]);
      await Promise.resolve();
    });

    const toast = screen.getByRole('status');
    expect(toast.className).toContain('settings-export-toast');
    expect(toast.textContent).toMatch(/Copied to clipboard/i);
    expect(screen.queryByRole('button', { name: /Dismiss/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy again/i })).toBeNull();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText(/Copied to clipboard/i)).toBeNull();
    vi.useRealTimers();
  });

  it('shares mermaid SVG rows as the pre-warmed PNG raster', async () => {
    buildExportPayload.mockImplementation(async ({ formatId }) => ({
      filename: `archislop-mermaid-20260716-120000.${formatId === 'mermaid-png' ? 'png' : 'svg'}`,
      mime: formatId === 'mermaid-png' ? 'image/png' : 'image/svg+xml;charset=utf-8',
      ext: formatId === 'mermaid-png' ? 'png' : 'svg',
      delivery: formatId === 'mermaid-png' ? 'image' : 'text',
      ...(formatId === 'mermaid-png'
        ? { blob: new Blob(['png'], { type: 'image/png' }) }
        : { body: '<svg></svg>' })
    }));

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
        diagramSource={'flowchart TD\n  A --> B'}
      />
    );

    openExportList();

    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalledWith(
        expect.objectContaining({ formatId: 'mermaid-png' })
      );
    });

    const svgRow = screen.getByText(/SVG/i).closest('li');
    const shareButton = svgRow?.querySelector('button[title="Share"]');
    expect(shareButton).toBeTruthy();
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(startWebShare).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'archislop-mermaid-20260716-120000.png',
          delivery: 'image'
        })
      );
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
