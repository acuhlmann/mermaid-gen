// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  extractAnythingAdvisorLabels,
  extractChartAdvisorLabels
} from '../src/utils/advisorVisibleLabels.js';

describe('advisorVisibleLabels', () => {
  it('extracts labels from chart title, encodings, and data values', () => {
    const chart = JSON.stringify({
      archislopVersion: 1,
      theme: 'whiteboard',
      spec: {
        title: 'Revenue by quarter',
        data: { values: [{ quarter: 'Q1', revenue: 120 }, { quarter: 'Q2', revenue: 180 }] },
        mark: 'bar',
        encoding: {
          x: { field: 'quarter', type: 'ordinal', title: 'Quarter' },
          y: { field: 'revenue', type: 'quantitative', title: 'Revenue' }
        }
      }
    });

    const result = extractChartAdvisorLabels(chart);
    expect(result.labels).toEqual(expect.arrayContaining(['Revenue by quarter', 'Quarter', 'quarter', 'Q1']));
    expect(result.ids).toEqual(result.labels);
  });

  it('extracts labels from Anything headings and controls without script text', () => {
    const html = `<!doctype html><html><head><script>const hidden = 'Do not include';</script></head>
      <body><h1>Launch Plan</h1><button>Start simulation</button></body></html>`;

    const result = extractAnythingAdvisorLabels(html);
    expect(result.labels).toEqual(expect.arrayContaining(['Launch Plan', 'Start simulation']));
    expect(result.labels).not.toContain('Do not include');
  });
});
