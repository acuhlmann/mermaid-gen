// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  computeCenteredViewport,
  computeFitViewport,
  readSvgLayoutSize
} from '../src/utils/diagramViewportFit.js';

describe('diagramViewportFit', () => {
  it('reads SVG dimensions from viewBox', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 800 600');
    expect(readSvgLayoutSize(svg)).toEqual({ width: 800, height: 600 });
  });

  it('fits large diagrams down without upscaling small ones', () => {
    const fitted = computeFitViewport({
      svgWidth: 2000,
      svgHeight: 1000,
      innerWidth: 1000,
      innerHeight: 500,
      inset: 0
    });
    expect(fitted.scale).toBeLessThan(1);
    expect(fitted.scale).toBeCloseTo(0.5, 5);

    const centered = computeFitViewport({
      svgWidth: 200,
      svgHeight: 100,
      innerWidth: 1000,
      innerHeight: 500,
      inset: 0
    });
    expect(centered.scale).toBe(1);
  });

  it('centers at 1× zoom', () => {
    const vp = computeCenteredViewport({
      svgWidth: 200,
      svgHeight: 100,
      innerWidth: 1000,
      innerHeight: 500,
      inset: 32
    });
    expect(vp.scale).toBe(1);
    expect(vp.x).toBeCloseTo(32 + (1000 - 64 - 200) / 2, 5);
    expect(vp.y).toBeCloseTo(32 + (500 - 64 - 100) / 2, 5);
  });
});
