/**
 * Markdown table parsing + generative table UI for Thinking pane prose.
 */

import type { ReactNode } from 'react';
import { enrichInline } from './thinkingProseEnrich';

const TABLE_SEPARATOR_CELL = /^:?-{3,}:?$/;

/** @returns cell strings or null when the line is not a pipe table row */
export function parseMarkdownTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const parts = trimmed.split('|').map((cell) => cell.trim());
  if (parts[0] === '') parts.shift();
  if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  if (parts.length < 2) return null;
  return parts;
}

export function isMarkdownTableSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => TABLE_SEPARATOR_CELL.test(cell));
}

export type MarkdownTableBlock = {
  headers: string[];
  rows: string[][];
  nextIndex: number;
};

/**
 * When `lines[startIndex]` begins a GFM pipe table, return headers/rows and the next line index.
 */
export function extractMarkdownTableBlock(lines: string[], startIndex: number): MarkdownTableBlock | null {
  const headerCells = parseMarkdownTableRow(lines[startIndex] ?? '');
  if (!headerCells || headerCells.length < 2) return null;

  const separatorCells = parseMarkdownTableRow(lines[startIndex + 1] ?? '');
  if (!separatorCells || !isMarkdownTableSeparatorRow(separatorCells)) return null;
  if (separatorCells.length !== headerCells.length) return null;

  const rows: string[][] = [];
  let cursor = startIndex + 2;
  while (cursor < lines.length) {
    const rowCells = parseMarkdownTableRow(lines[cursor] ?? '');
    if (!rowCells || rowCells.length < 2) break;
    rows.push(rowCells);
    cursor += 1;
  }

  if (!rows.length) return null;
  return { headers: headerCells, rows, nextIndex: cursor };
}

const NUMERIC_VALUE_RE =
  /^\s*(?:[$€£¥]\s*)?(-?\d[\d,]*(?:\.\d+)?)\s*([kKmMbBtT%])?\s*(?:USD|usd|billion|million)?\s*$/i;

/** Parse currency / magnitude tokens like `$320B` or `45%` for bar width. */
export function parseNumericTableCell(value: string): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = raw.match(NUMERIC_VALUE_RE);
  if (!m) return null;
  const base = Number(String(m[1]).replace(/,/g, ''));
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] ?? '').toLowerCase();
  const mult =
    suffix === 'k'
      ? 1e3
      : suffix === 'm'
        ? 1e6
        : suffix === 'b' || suffix === 't'
          ? 1e9
          : suffix === '%'
            ? 1
            : 1;
  return base * mult;
}

export function detectNumericColumnIndices(headers: string[], rows: string[][]): Set<number> {
  const colCount = headers.length;
  const numeric = new Set<number>();
  for (let col = 0; col < colCount; col += 1) {
    const values = rows.map((row) => row[col] ?? '');
    const parsed = values.map((v) => parseNumericTableCell(v));
    const hits = parsed.filter((n) => n != null).length;
    if (hits >= Math.max(2, Math.ceil(values.length * 0.5))) {
      numeric.add(col);
    }
  }
  return numeric;
}

function columnMaxima(rows: string[][], numericCols: Set<number>): Map<number, number> {
  const maxima = new Map<number, number>();
  for (const col of numericCols) {
    let max = 0;
    for (const row of rows) {
      const n = parseNumericTableCell(row[col] ?? '');
      if (n != null && n > max) max = n;
    }
    if (max > 0) maxima.set(col, max);
  }
  return maxima;
}

function renderCellContent(text: string, keyPrefix: string): ReactNode {
  return enrichInline(text, keyPrefix);
}

export function ThinkingMarkdownTable({
  headers,
  rows,
  keyPrefix = 'tbl'
}: {
  headers: string[];
  rows: string[][];
  keyPrefix?: string;
}) {
  const numericCols = detectNumericColumnIndices(headers, rows);
  const maxima = columnMaxima(rows, numericCols);

  return (
    <div className="insights-markdown-table-wrap" data-testid="thinking-markdown-table">
      <table className="insights-markdown-table">
        <thead>
          <tr>
            {headers.map((header, colIdx) => (
              <th key={`${keyPrefix}-h-${colIdx}`} scope="col">
                {renderCellContent(header, `${keyPrefix}-h-${colIdx}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={`${keyPrefix}-r-${rowIdx}`}>
              {headers.map((_, colIdx) => {
                const cell = row[colIdx] ?? '';
                const isNumeric = numericCols.has(colIdx);
                const parsed = isNumeric ? parseNumericTableCell(cell) : null;
                const max = maxima.get(colIdx);
                const barPct = parsed != null && max ? Math.max(6, (parsed / max) * 100) : null;
                return (
                  <td
                    key={`${keyPrefix}-c-${rowIdx}-${colIdx}`}
                    className={isNumeric ? 'is-numeric' : undefined}
                    data-testid={isNumeric ? 'thinking-table-numeric-cell' : undefined}
                  >
                    {barPct != null ? (
                      <span className="insights-table-bar-cell">
                        <span
                          className="insights-table-bar-fill"
                          style={{ width: `${barPct}%` }}
                          aria-hidden="true"
                        />
                        <span className="insights-table-bar-label">
                          {renderCellContent(cell, `${keyPrefix}-c-${rowIdx}-${colIdx}`)}
                        </span>
                      </span>
                    ) : (
                      renderCellContent(cell, `${keyPrefix}-c-${rowIdx}-${colIdx}`)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
