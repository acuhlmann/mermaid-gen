// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  detectNumericColumnIndices,
  extractMarkdownTableBlock,
  isMarkdownTableSeparatorRow,
  parseMarkdownTableRow,
  parseNumericTableCell,
  ThinkingMarkdownTable
} from '../src/utils/thinkingMarkdownTable';

const SAMPLE_TABLE = `Intro prose about market data.

| Category | Market Size |
|---|---|
| Enterprise Software | $320B |
| Cloud Services | $290B |
| Cybersecurity | $200B |

Follow-up sentence.`;

describe('parseMarkdownTableRow', () => {
  it('parses pipe-delimited rows', () => {
    expect(parseMarkdownTableRow('| A | B |')).toEqual(['A', 'B']);
  });

  it('returns null for non-table lines', () => {
    expect(parseMarkdownTableRow('plain text')).toBeNull();
    expect(parseMarkdownTableRow('| only one')).toBeNull();
  });
});

describe('isMarkdownTableSeparatorRow', () => {
  it('detects GFM separator rows', () => {
    expect(isMarkdownTableSeparatorRow(['---', '---'])).toBe(true);
    expect(isMarkdownTableSeparatorRow([':---', '---:'])).toBe(true);
    expect(isMarkdownTableSeparatorRow(['Category', 'Size'])).toBe(false);
  });
});

describe('extractMarkdownTableBlock', () => {
  it('extracts headers, rows, and next index', () => {
    const lines = SAMPLE_TABLE.split('\n');
    const tableStart = lines.findIndex((l) => l.startsWith('| Category'));
    const block = extractMarkdownTableBlock(lines, tableStart);
    expect(block?.headers).toEqual(['Category', 'Market Size']);
    expect(block?.rows.length).toBe(3);
    expect(block?.rows[0]).toEqual(['Enterprise Software', '$320B']);
    expect(lines[block?.nextIndex ?? -1]).toBe('');
  });

  it('returns null when separator row is missing', () => {
    const lines = ['| A | B |', '| 1 | 2 |'];
    expect(extractMarkdownTableBlock(lines, 0)).toBeNull();
  });
});

describe('parseNumericTableCell', () => {
  it('parses currency magnitudes', () => {
    expect(parseNumericTableCell('$320B')).toBe(320e9);
    expect(parseNumericTableCell('45%')).toBe(45);
    expect(parseNumericTableCell('n/a')).toBeNull();
  });
});

describe('detectNumericColumnIndices', () => {
  it('flags mostly-numeric columns', () => {
    const headers = ['Category', 'Market Size'];
    const rows = [
      ['Enterprise Software', '$320B'],
      ['Cloud Services', '$290B']
    ];
    expect(detectNumericColumnIndices(headers, rows)).toEqual(new Set([1]));
  });
});

describe('ThinkingMarkdownTable', () => {
  it('renders an HTML table with bar viz for numeric cells', () => {
    render(
      <ThinkingMarkdownTable
        headers={['Category', 'Market Size']}
        rows={[
          ['Enterprise Software', '$320B'],
          ['Cloud Services', '$290B']
        ]}
      />
    );
    const table = screen.getByTestId('thinking-markdown-table');
    expect(table.querySelector('table')).toBeTruthy();
    expect(within(table).getByText('Enterprise Software')).toBeTruthy();
    expect(within(table).getByText('$320B')).toBeTruthy();
    expect(within(table).getAllByTestId('thinking-table-numeric-cell').length).toBe(2);
    const fills = table.querySelectorAll('.insights-table-bar-fill');
    expect(fills.length).toBe(2);
    expect((fills[0] as HTMLElement).style.width).toBe('100%');
    expect((fills[1] as HTMLElement).style.width).not.toBe('100%');
  });
});
