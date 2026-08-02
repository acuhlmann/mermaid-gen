// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import DiagramFullscreenMailroom from '../src/components/DiagramFullscreenMailroom.jsx';
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

describe('DiagramFullscreenMailroom', () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('renders nothing when not fullscreen', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenMailroom
        isFullscreen={false}
        host={host}
        hasSource
        contentType="chart"
        diagramSource={CHART_SOURCE}
      />
    );
    expect(screen.queryByRole('button', { name: /Mailroom/i })).toBeNull();
  });

  it('renders nothing when there is no deliverable source', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenMailroom
        isFullscreen
        host={host}
        hasSource={false}
        contentType="chart"
        diagramSource=""
      />
    );
    expect(screen.queryByRole('button', { name: /Mailroom/i })).toBeNull();
  });

  it('portals a mailroom trigger and opens the export panel in fullscreen', () => {
    const host = hostElement();
    render(
      <DiagramFullscreenMailroom
        isFullscreen
        host={host}
        hasSource
        contentType="chart"
        diagramSource={CHART_SOURCE}
      />
    );

    const trigger = screen.getByRole('button', {
      name: CONTROLS_EN.settings.outboxShow
    });
    expect(host.contains(trigger)).toBe(true);

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: CONTROLS_EN.settings.outboxRegion })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export/i })).toBeTruthy();
  });
});
