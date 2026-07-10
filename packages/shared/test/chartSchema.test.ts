import test from 'node:test';
import assert from 'node:assert/strict';
import { ChartDslSchema, parseChartDsl } from '../src/chartSchema.js';

const HELLO_BAR_SPEC = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: {
    values: [
      { q: 'Q1', rev: 12 },
      { q: 'Q2', rev: 18 },
      { q: 'Q3', rev: 9 }
    ]
  },
  mark: 'bar',
  encoding: {
    x: { field: 'q', type: 'ordinal' },
    y: { field: 'rev', type: 'quantitative' }
  }
};

test('ChartDslSchema accepts a minimal wrapper around a Vega-Lite spec', () => {
  const parsed = ChartDslSchema.parse({
    theme: 'whiteboard',
    spec: HELLO_BAR_SPEC
  });
  assert.equal(parsed.theme, 'whiteboard');
  assert.equal(parsed.archislopVersion, 1);
  assert.equal(parsed.spec.mark, 'bar');
});

test('ChartDslSchema defaults theme to whiteboard and archislopVersion to 1', () => {
  const parsed = ChartDslSchema.parse({ spec: HELLO_BAR_SPEC });
  assert.equal(parsed.theme, 'whiteboard');
  assert.equal(parsed.archislopVersion, 1);
});

test('ChartDslSchema rejects unknown theme values', () => {
  const result = ChartDslSchema.safeParse({ theme: 'galaxy', spec: HELLO_BAR_SPEC });
  assert.equal(result.success, false);
});

test('parseChartDsl strips a json code fence and parses inner JSON', () => {
  const source = `\`\`\`json
${JSON.stringify({ theme: 'whiteboard', spec: HELLO_BAR_SPEC }, null, 2)}
\`\`\``;
  const result = parseChartDsl(source);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.dsl.theme, 'whiteboard');
});

test('parseChartDsl reports invalid JSON with a clear error', () => {
  const result = parseChartDsl('{not json');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /not valid JSON/);
});

test('parseChartDsl rejects a wrapper with an empty spec object', () => {
  const result = parseChartDsl(JSON.stringify({ theme: 'whiteboard', spec: {} }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /non-empty Vega-Lite object/);
});

test('parseChartDsl rejects non-string input', () => {
  const result = parseChartDsl(42 as unknown);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /must be a JSON string/);
});

test('parseChartDsl returns canonical JSON text on success', () => {
  const result = parseChartDsl(JSON.stringify({ theme: 'whiteboard', spec: HELLO_BAR_SPEC }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(typeof result.text, 'string');
  // Round-trips to the same parsed value.
  const reparsed = JSON.parse(result.text);
  assert.equal(reparsed.theme, 'whiteboard');
  assert.equal(reparsed.archislopVersion, 1);
});
