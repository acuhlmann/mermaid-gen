// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { injectInfographicShapeTitleLabels } from '../src/utils/injectInfographicShapeLabels.js';

function makeElement(tag, attrs = {}, text = '') {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  if (text) el.textContent = text;
  return el;
}

describe('injectInfographicShapeTitleLabels', () => {
  it('adds a visible item-label text node for dagre circle shapes', () => {
    const container = document.createElement('div');
    const svg = makeElement('svg');
    container.appendChild(svg);
    const group = makeElement('g');
    svg.appendChild(group);
    const ellipse = makeElement('ellipse', {
      'data-element-type': 'shape',
      cx: '40',
      cy: '30',
      rx: '24',
      ry: '24'
    });
    const title = makeElement('title', {}, 'Trend Analysis');
    ellipse.appendChild(title);
    group.appendChild(ellipse);

    injectInfographicShapeTitleLabels(container);

    const label = group.querySelector(
      '[data-element-type="item-label"][data-shape-label-injected="true"]'
    );
    expect(label).toBeTruthy();
    expect(label.textContent).toBe('Trend Analysis');
  });
});
