// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildFormsSeedDoc } from '@archislop/shared';
import { formatFormsA2uiForEditor } from '../src/utils/formatFormsA2ui.js';

describe('formatFormsA2uiForEditor', () => {
  it('pretty-prints a minified forms document', () => {
    const raw = buildFormsSeedDoc().replace(/\s+/g, ' ').trim();
    // Force compact input (seed is already pretty; minify then reformat).
    const minified = JSON.stringify(JSON.parse(raw));
    const formatted = formatFormsA2uiForEditor(minified);
    expect(formatted).toContain('\n');
    expect(formatted).toContain('"archislopFormsVersion": 1');
    expect(formatted).toContain('"formTitle"');
  });

  it('returns the original source when JSON is invalid', () => {
    const raw = '{not-a-form';
    expect(formatFormsA2uiForEditor(raw)).toBe(raw);
  });
});
