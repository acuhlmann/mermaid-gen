import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnythingAnalyzeUserContent,
  buildAnythingTransformUserContent
} from '../src/agents/anythingLangChainAgent.js';

const HTML = '<!doctype html><html><head></head><body><h1>Launch Plan</h1></body></html>';

test('buildAnythingTransformUserContent includes advisor prompt', () => {
  const body = buildAnythingTransformUserContent({
    mode: 'gilfoyle',
    currentHtml: HTML,
    advisorPrompt: 'Make Start button more obvious'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Start button/);
});

test('buildAnythingTransformUserContent prefers targeted edits for gilfoyle and barker', () => {
  for (const mode of ['gilfoyle', 'barker']) {
    const body = buildAnythingTransformUserContent({ mode, currentHtml: HTML });
    assert.match(body, /apply_anything_edit/, `${mode} should prefer apply_anything_edit`);
    assert.match(body, /Fall back to apply_anything_patch/);
  }
});

test('buildAnythingTransformUserContent keeps full rewrites for erlich and goMad', () => {
  for (const mode of ['erlich', 'goMad']) {
    const body = buildAnythingTransformUserContent({ mode, currentHtml: HTML });
    assert.match(body, /Call apply_anything_patch with the full HTML document\./);
    assert.doesNotMatch(body, /Prefer apply_anything_edit/);
  }
});

test('buildAnythingAnalyzeUserContent includes advisor prompt', () => {
  const body = buildAnythingAnalyzeUserContent({
    kind: 'critique',
    currentHtml: HTML,
    advisorPrompt: 'Check interaction discoverability'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /discoverability/);
});
