// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DiagramFullscreenToolbar from '../src/components/DiagramFullscreenToolbar.jsx';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

const CHART_SOURCE = JSON.stringify({
  archislopVersion: 1,
  theme: 'whiteboard',
  spec: {
    mark: 'bar',
    data: { values: [{ a: 'x', b: 1 }] }
  }
});

function hostElement() {
  const host = document.createElement('div');
  host.className = 'diagram-output';
  document.body.appendChild(host);
  return host;
}

describe('DiagramFullscreenToolbar', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('renders nothing when not fullscreen', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenToolbar
        isFullscreen={false}
        host={host}
        hasSource
        contentType="chart"
        diagramSource={CHART_SOURCE}
        onExit={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /Mailroom/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Exit fullscreen/i })).toBeNull();
  });

  it('portals mailroom and exit as siblings in the top-right toolbar cluster', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenToolbar
        isFullscreen
        host={host}
        hasSource
        contentType="chart"
        diagramSource={CHART_SOURCE}
        onExit={() => {}}
      />
    );

    const toolbar = host.querySelector('.diagram-fullscreen-toolbar');
    expect(toolbar).toBeTruthy();
    expect(
      toolbar?.contains(screen.getByRole('button', { name: CONTROLS_EN.settings.outboxShow }))
    ).toBe(true);
    expect(
      toolbar?.contains(screen.getByRole('button', { name: CONTROLS_EN.fullscreen.exit }))
    ).toBe(true);

    const mailroom = screen.getByRole('button', { name: CONTROLS_EN.settings.outboxShow });
    const close = screen.getByRole('button', { name: CONTROLS_EN.fullscreen.exit });
    expect(mailroom.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the export panel from the mailroom trigger', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenToolbar
        isFullscreen
        host={host}
        hasSource
        contentType="chart"
        diagramSource={CHART_SOURCE}
        onExit={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: CONTROLS_EN.settings.outboxShow }));
    expect(screen.getByRole('dialog', { name: CONTROLS_EN.settings.outboxRegion })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export/i })).toBeTruthy();
  });
});
