import { describe, expect, it } from 'vitest';
import { formatChartDslForEditor } from '../src/utils/formatChartDsl.js';

describe('formatChartDslForEditor', () => {
  it('pretty-prints valid chart DSL', () => {
    const raw =
      '{"archislopVersion":1,"theme":"whiteboard","spec":{"mark":"bar","data":{"values":[{"a":"A","b":1}]}}}';
    const formatted = formatChartDslForEditor(raw);
    expect(formatted).toMatch(/^\{\n  "archislopVersion": 1,/);
    expect(formatted).toMatch(/\n  "theme": "whiteboard",/);
    expect(formatted).toMatch(/\n  "spec": \{/);
  });

  it('returns invalid source unchanged', () => {
    const raw = '{not json';
    expect(formatChartDslForEditor(raw)).toBe(raw);
  });
});
