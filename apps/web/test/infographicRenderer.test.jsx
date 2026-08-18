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
        '<svg viewBox="-20 -20 320 130" width="100%" height="100%"><g data-indexes="0,0"><rect width="10"/></g></svg>';
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

  it('re-selects by data-indexes after AntV remounts the same node', async () => {
    const first = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  root
    label Company
    children
      - label Engineering
`;
    const next = `${first}      - label Legal\n`;
    const selected = { kind: 'infographic-item', indexes: '0,0', label: 'Engineering' };
    const { rerender, container } = render(
      <InfographicRenderer diagramSource={first} selectedNode={selected} streamingPreview={false} />
    );
    await waitFor(() => {
      expect(
        container
          .querySelector('[data-indexes="0,0"]')
          ?.classList.contains('is-infographic-selected')
      ).toBe(true);
    });
    rerender(
      <InfographicRenderer diagramSource={next} selectedNode={selected} streamingPreview={false} />
    );
    await waitFor(() => {
      expect(
        container
          .querySelector('[data-indexes="0,0"]')
          ?.classList.contains('is-infographic-selected')
      ).toBe(true);
    });
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
