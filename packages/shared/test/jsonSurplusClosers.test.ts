import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonTrimmingSurplusClosers,
  trimSurplusJsonClosers
} from '../src/jsonSurplusClosers.js';
import { parseChartDsl } from '../src/chartSchema.js';

test('trimSurplusJsonClosers drops surplus trailing closers', () => {
  assert.equal(trimSurplusJsonClosers('{"a":{"b":1}}}'), '{"a":{"b":1}}');
  assert.equal(trimSurplusJsonClosers('{"a":[1]}]}\n }'), '{"a":[1]}');
});

test('trimSurplusJsonClosers drops a surplus closer that ended the root early', () => {
  assert.equal(
    trimSurplusJsonClosers('{"flint":{"chart_spec":{"x":1}}},"vegaConfig":{"a":1}}'),
    '{"flint":{"chart_spec":{"x":1}},"vegaConfig":{"a":1}}'
  );
  // Two surplus closers, one early and one trailing.
  assert.equal(trimSurplusJsonClosers('{"a":{"b":1}},"c":2}}'), '{"a":{"b":1},"c":2}');
  // A lone `}` before the comma is not a run — nothing safe to drop.
  assert.equal(trimSurplusJsonClosers('{"a":1},"c":2}'), null);
});

test('trimSurplusJsonClosers ignores braces inside strings', () => {
  assert.equal(trimSurplusJsonClosers('{"a":"}}{"}}'), '{"a":"}}{"}');
  assert.equal(trimSurplusJsonClosers('{"a":"say \\"}\\""}}'), '{"a":"say \\"}\\""}');
});

test('trimSurplusJsonClosers leaves every other failure alone', () => {
  assert.equal(trimSurplusJsonClosers('{"a":1}'), null); // nothing to trim
  assert.equal(trimSurplusJsonClosers('{"a":1} trailing prose'), null);
  assert.equal(trimSurplusJsonClosers('{"a":1}{"b":2}'), null);
  assert.equal(trimSurplusJsonClosers('{"a":1,}}'), null); // still invalid once trimmed
  assert.equal(trimSurplusJsonClosers('{"a":{"b":1}'), null); // missing closer, not surplus
  assert.equal(trimSurplusJsonClosers('not json'), null);
});

test('parseJsonTrimmingSurplusClosers keeps the original error when it cannot rescue', () => {
  assert.deepEqual(parseJsonTrimmingSurplusClosers('{"a":1}}'), { a: 1 });
  assert.throws(() => parseJsonTrimmingSurplusClosers('{"a":1} x'), SyntaxError);
});

test('parseChartDsl accepts a wrapper with one surplus closing brace', () => {
  const spec = { mark: 'bar', encoding: { x: { field: 'q', type: 'nominal' } } };
  const result = parseChartDsl(`${JSON.stringify({ theme: 'whiteboard', spec })}}`);
  assert.equal(result.ok, true);
});
