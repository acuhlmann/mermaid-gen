// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OutboxDock from '../src/components/OutboxDock.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

vi.mock('../src/utils/exportDiagram.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildExportPayload: vi.fn(async ({ formatId }) => {
      const isPng = formatId === 'chart-png';
      return {
        filename: `archislop-chart-20260716-120000.${isPng ? 'png' : 'csv'}`,
        mime: isPng ? 'image/png' : 'text/csv;charset=utf-8',
        ext: isPng ? 'png' : 'csv',
        delivery: isPng ? 'image' : 'text',
        ...(isPng ? { blob: new Blob(['png'], { type: 'image/png' }) } : { body: 'a,b\nx,1\n' })
      };
    }),
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

describe('OutboxDock export', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows per-format save and copy actions plus a primary share button', async () => {
    render(
      <OutboxDock controls={CONTROLS_EN.settings} contentType="chart" diagramSource={chartSource} />
    );

    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalledWith(
        expect.objectContaining({ formatId: 'chart-png' })
      );
      // Accessible name is "Preparing…" until pre-warm finishes.
      expect(screen.getByRole('button', { name: /^Share$/i })).toBeTruthy();
    });

    openExportList();

    expect(screen.getByText(/Spreadsheet CSV/i)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Save$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^Copy$/i }).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole('button', { name: /^Share$/i }).length).toBe(1);

    fireEvent.click(screen.getAllByRole('button', { name: /^Save$/i })[0]);
    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalledWith({
        contentType: 'chart',
        diagramSource: chartSource,
        formatId: 'chart-png'
      });
      expect(deliverExportPayload).toHaveBeenCalledWith(expect.any(Object), 'download');
    });

    expect(screen.getByText(/Saved to your device/i)).toBeTruthy();
    expect(screen.getByText(/archislop-chart-20260716-120000.png/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open preview/i }).getAttribute('href')).toBe(
      'blob:preview-mock'
    );
  });

  it('uses pre-warmed payload for primary share without rebuilding on click', async () => {
    render(
      <OutboxDock controls={CONTROLS_EN.settings} contentType="chart" diagramSource={chartSource} />
    );

    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /^Share$/i })).toBeTruthy();
    });

    const shareButton = screen.getByRole('button', { name: /^Share$/i });
    const callsBeforeShare = buildExportPayload.mock.calls.length;
    fireEvent.click(shareButton);

    await waitFor(() => {
      expect(startWebShare).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'archislop-chart-20260716-120000.png' })
      );
    });
    expect(buildExportPayload.mock.calls.length).toBe(callsBeforeShare);
    expect(deliverExportPayload).not.toHaveBeenCalledWith(expect.any(Object), 'share');
  });

  it('shows a brief copy toast without action buttons', async () => {
    vi.useFakeTimers();
    render(
      <OutboxDock controls={CONTROLS_EN.settings} contentType="chart" diagramSource={chartSource} />
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

  it('shares mermaid SVG rows as the pre-warmed PNG raster via primary share', async () => {
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
      <OutboxDock
        controls={CONTROLS_EN.settings}
        contentType="mermaid"
        diagramSource={'flowchart TD\n  A --> B'}
      />
    );

    await waitFor(() => {
      expect(buildExportPayload).toHaveBeenCalledWith(
        expect.objectContaining({ formatId: 'mermaid-png' })
      );
      // Wait for ready label — under full-suite load the pre-warm can still be
      // resolving when the call is first observed (button stays "Preparing…").
      expect(screen.getByRole('button', { name: /^Share$/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Share$/i }));

    await waitFor(() => {
      expect(startWebShare).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'archislop-mermaid-20260716-120000.png',
          delivery: 'image'
        })
      );
    });

    openExportList();
    const svgRow = screen.getByText(/SVG/i).closest('li');
    expect(svgRow?.querySelectorAll('button').length).toBe(1);
  });

  it('disables export when there is no source', () => {
    render(<OutboxDock controls={CONTROLS_EN.settings} contentType="mermaid" diagramSource="" />);

    expect(screen.getByRole('button', { name: /Export/i }).disabled).toBe(true);
    expect(screen.getByText(/Generate something first/i)).toBeTruthy();
  });
});
