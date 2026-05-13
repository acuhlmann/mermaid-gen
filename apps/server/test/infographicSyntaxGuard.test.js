import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT,
  INFOGRAPHIC_CRITIQUE_TASK,
  INFOGRAPHIC_EXPLAIN_TASK,
  INFOGRAPHIC_SYSTEM_PROMPT,
  INFOGRAPHIC_TEMPLATE_WHITELIST,
  buildInfographicRepairInstruction,
  getInfographicRulePack,
  inferInfographicTemplate
} from '../src/prompts/infographicSyntaxGuard.js';

test('template whitelist is populated from @antv/infographic at load time', () => {
  assert.ok(INFOGRAPHIC_TEMPLATE_WHITELIST.length > 50);
  assert.ok(INFOGRAPHIC_TEMPLATE_WHITELIST.includes('list-row-simple-horizontal-arrow'));
  assert.ok(INFOGRAPHIC_TEMPLATE_WHITELIST.includes('compare-swot'));
});

test('system prompt advertises one concrete template from each major family', () => {
  for (const family of ['list-', 'sequence-', 'compare-', 'chart-', 'hierarchy-', 'relation-']) {
    assert.match(
      INFOGRAPHIC_SYSTEM_PROMPT,
      new RegExp(family),
      `expected ${family}* template family in system prompt`
    );
  }
  assert.match(INFOGRAPHIC_SYSTEM_PROMPT, /apply_infographic_patch/);
  assert.match(INFOGRAPHIC_SYSTEM_PROMPT, /^.*data\n.*lists\n.*- label Step 1/s);
});

test('analysis system prompt does not allow mutation', () => {
  assert.match(INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT, /read-only/i);
});

test('critique task requires the canonical section headers', () => {
  for (const heading of [
    '## Strengths',
    '## Weaknesses and limits',
    '## Template fit',
    '## Visual and information density',
    '## Actionable improvements'
  ]) {
    assert.ok(INFOGRAPHIC_CRITIQUE_TASK.includes(heading), `expected ${heading}`);
  }
});

test('explain task requires the canonical section headers', () => {
  for (const heading of ['## Explanation', '## Main message', '## Key data points', '## Takeaways']) {
    assert.ok(INFOGRAPHIC_EXPLAIN_TASK.includes(heading), `expected ${heading}`);
  }
});

test('getInfographicRulePack returns family-specific rules', () => {
  const listRow = getInfographicRulePack('list-row-simple-horizontal-arrow');
  assert.match(listRow, /list-\*/);
  assert.match(listRow, /sequence-/);
  assert.match(listRow, /lists/);

  const chart = getInfographicRulePack('chart-bar-plain-text');
  assert.match(chart, /chart-/);
  assert.match(chart, /value/);

  const hierarchy = getInfographicRulePack('hierarchy-structure');
  assert.match(hierarchy, /root/);
  assert.match(hierarchy, /children/);

  const swot = getInfographicRulePack('compare-swot');
  assert.match(swot, /compare-/);
});

test('getInfographicRulePack falls back to COMMON for unknown family', () => {
  const fallback = getInfographicRulePack('totallybogus-nope');
  assert.match(fallback, /Universal AntV Infographic DSL rules/);
});

test('inferInfographicTemplate reads the template from the first line', () => {
  assert.equal(
    inferInfographicTemplate('infographic list-grid-simple\ndata\n  lists'),
    'list-grid-simple'
  );
  assert.equal(inferInfographicTemplate('not even close'), null);
  assert.equal(inferInfographicTemplate(''), null);
});

test('buildInfographicRepairInstruction injects rule pack and error', () => {
  const instr = buildInfographicRepairInstruction({
    errorMessage: 'Unknown template "broken"',
    brokenSource: 'infographic list-row-simple-horizontal-arrow\n  data'
  });
  assert.match(instr, /Unknown template "broken"/);
  assert.match(instr, /apply_infographic_patch/);
  assert.match(instr, /RULES/);
});
