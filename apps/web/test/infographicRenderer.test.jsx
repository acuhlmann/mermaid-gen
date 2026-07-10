// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { normalizeRootSvgElement } from '@archislop/shared';

const renderMock = vi.fn();

vi.mock('@antv/infographic', () => ({
  parseSyntax: vi.fn(() => ({ errors: [] })),
  Infographic: vi.fn(function InfographicMock({ container }) {
    this.container = container;
    this.render = (dsl) => {
      renderMock(dsl);
      container.innerHTML =
        '<svg viewBox="-20 -20 320 130" width="100%" height="100%"><rect width="10"/></svg>';
    };
    this.destroy = vi.fn();
  })
}));

import InfographicRenderer from '../src/components/InfographicRenderer.jsx';

describe('InfographicRenderer', () => {
  afterEach(() => {
    cleanup();
    renderMock.mockClear();
  });

  it('normalizes AntV root svg from viewBox after render (fixes 100% collapse on canvas)', async () => {
    const dsl = `infographic list-row-simple-horizontal-arrow
  data
    lists
      - label A`;

    const { container } = render(
      <InfographicRenderer diagramSource={dsl} streamingPreview={false} />
    );

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalled();
    });

    const svg = container.querySelector('.infographic-canvas svg');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('width')).toBe('320');
    expect(svg.getAttribute('height')).toBe('130');
    expect(svg.getAttribute('width')).not.toBe('100%');
  });
});

describe('normalizeRootSvgElement', () => {
  it('pins pixel dimensions from viewBox attribute', () => {
    document.body.innerHTML = '<svg viewBox="-20 -20 320 130" width="100%" height="100%"></svg>';
    const svg = document.querySelector('svg');
    expect(normalizeRootSvgElement(svg)).toBe(true);
    expect(svg.getAttribute('width')).toBe('320');
    expect(svg.getAttribute('height')).toBe('130');
  });

  it('expands viewBox to include off-canvas content before pinning size', () => {
    document.body.innerHTML =
      '<svg viewBox="0 0 10 10" width="10" height="10"><rect x="40" y="30" width="20" height="15"/></svg>';
    const svg = document.querySelector('svg');
    svg.getBBox = () => ({ x: 40, y: 30, width: 20, height: 15 });
    expect(normalizeRootSvgElement(svg)).toBe(true);
    expect(svg.getAttribute('viewBox')).toMatch(/^20 10 60 55$/);
    expect(svg.getAttribute('width')).toBe('60');
  });
});
