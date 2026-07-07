import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnythingAnalyzeUserContent,
  buildAnythingTransformUserContent
} from '../src/agents/anythingLangChainAgent.js';

const HTML = '<!doctype html><html><head></head><body><h1>Launch Plan</h1></body></html>';

test('buildAnythingTransformUserContent includes advisor prompt', () => {
  const body = buildAnythingTransformUserContent({
    mode: 'refine',
    currentHtml: HTML,
    advisorPrompt: 'Make Start button more obvious'
  });
  assert.match(body, /Stakeholder suggestion/);
  assert.match(body, /Start button/);
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
