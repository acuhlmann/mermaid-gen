// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyChartHighlight } from '../src/utils/applyChartHighlight.js';

describe('applyChartHighlight', () => {
  it('tags Vega mark elements with data-diff-state by row index', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <svg>
        <g aria-roledescription="mark"><rect /></g>
        <g aria-roledescription="mark"><rect /></g>
      </svg>
    `;

    applyChartHighlight(root, { addedIds: ['0'], modifiedIds: ['1'] });
    const marks = root.querySelectorAll('[aria-roledescription="mark"]');
    expect(marks[0].getAttribute('data-diff-state')).toBe('added');
    expect(marks[1].getAttribute('data-diff-state')).toBe('modified');
  });
});
