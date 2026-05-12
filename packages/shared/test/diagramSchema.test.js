import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentStreamPayloadSchema,
  DEFAULT_DIAGRAM_STYLE,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramTransformIntentSchema,
  FocusNodeSchema,
  applyMermaidStyleDirective,
  applyPatch,
  createInitialDiagramState,
  extractMermaidInitDirective,
  parseMermaidStyleConfig,
  stripMermaidInitDirective
} from '../src/index.js';

test('applyPatch accepts valid patch and increments revision', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 0,
    nextRevisionId: 1,
    mermaidSource: 'flowchart TD\n  A --> B',
    reason: 'test patch'
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.revisionId, 1);
  assert.match(result.state.mermaidSource, /A --> B/);
  assert.equal(result.state.styleConfig.theme, 'base');
  assert.equal(result.state.styleConfig.look, 'neo');
  assert.equal(result.state.styleConfig.flowchart.curve, 'rounded');
});

test('applyPatch rejects stale revisions', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 9,
    nextRevisionId: 10,
    mermaidSource: 'flowchart TD\n  A --> B',
    reason: 'stale patch'
  });

  assert.equal(result.accepted, false);
  assert.match(result.error, /Revision mismatch/);
});

test('createInitialDiagramState includes a managed Mermaid init directive', () => {
  const initial = createInitialDiagramState();

  assert.match(initial.mermaidSource, /^%%\{init:/);
  assert.deepEqual(initial.styleConfig, DEFAULT_DIAGRAM_STYLE);
  assert.equal(initial.styleConfig.themeVariables.primaryColor, '#d7ffb8');
  assert.equal(initial.styleConfig.themeVariables.primaryBorderColor, '#58cc02');
  assert.equal(initial.styleConfig.themeVariables.mainBkg, '#d7ffb8');
});

test('parseMermaidStyleConfig reads supported init fields', () => {
  const result = parseMermaidStyleConfig(
    '%%{init: {"theme":"dark","look":"neo","themeVariables":{"primaryColor":"#123456"},"flowchart":{"curve":"linear"}}}%%\nflowchart TD\n  A --> B'
  );

  assert.equal(result.accepted, true);
  assert.equal(result.styleConfig.theme, 'dark');
  assert.equal(result.styleConfig.look, 'neo');
  assert.equal(result.styleConfig.themeVariables.primaryColor, '#123456');
  assert.equal(result.styleConfig.flowchart.curve, 'linear');
});

test('applyMermaidStyleDirective replaces existing directive and preserves body', () => {
  const result = applyMermaidStyleDirective({
    mermaidSource: '%%{init: {"theme":"dark"}}%%\nflowchart TD\n  A --> B',
    styleConfig: {
      theme: 'forest',
      look: 'classic',
      themeVariables: {},
      themeCSS: '',
      flowchart: { curve: 'rounded' }
    }
  });

  assert.match(result.mermaidSource, /^%%\{init: \{"theme":"forest"/);
  assert.equal(stripMermaidInitDirective(result.mermaidSource), 'flowchart TD\n  A --> B');
});

test('extractMermaidInitDirective reports no directive without changing body', () => {
  const source = 'flowchart TD\n  A --> B';
  const result = extractMermaidInitDirective(source);

  assert.equal(result.hasDirective, false);
  assert.equal(result.body, source);
});

test('parseMermaidStyleConfig rejects invalid JSON and unsupported values', () => {
  const invalidJson = parseMermaidStyleConfig('%%{init: {"theme": } }%%\nflowchart TD\n  A --> B');
  const invalidTheme = parseMermaidStyleConfig('%%{init: {"theme":"unsupported"}}%%\nflowchart TD\n  A --> B');

  assert.equal(invalidJson.accepted, false);
  assert.match(invalidJson.error, /Invalid Mermaid init JSON/);
  assert.equal(invalidTheme.accepted, false);
  assert.match(invalidTheme.error, /Invalid Mermaid style config/);
});

test('intent payloads accept empty mermaidSource for cleared canvas', () => {
  const intent = {
    prompt: 'Create a simple login flow',
    revisionId: 1,
    mermaidSource: '',
    settings: {}
  };

  assert.equal(DiagramIntentSchema.safeParse(intent).success, true);
  assert.equal(
    AgentStreamPayloadSchema.safeParse({
      operation: 'intent',
      ...intent
    }).success,
    true
  );
});

test('modelProfile is optional and accepts fast or quality', () => {
  const baseIntent = {
    prompt: 'x',
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  A --> B',
    settings: {}
  };

  const withQuality = DiagramIntentSchema.safeParse({ ...baseIntent, modelProfile: 'quality' });
  assert.equal(withQuality.success, true);
  assert.equal(withQuality.data.modelProfile, 'quality');

  const streamTransform = AgentStreamPayloadSchema.safeParse({
    operation: 'transform',
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  A --> B',
    mode: 'refine',
    modelProfile: 'fast'
  });
  assert.equal(streamTransform.success, true);
  assert.equal(streamTransform.data.modelProfile, 'fast');

  const analyze = DiagramAnalyzeSchema.safeParse({
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  A --> B',
    kind: 'explain',
    modelProfile: 'quality'
  });
  assert.equal(analyze.success, true);

  assert.equal(
    DiagramIntentSchema.safeParse({ ...baseIntent, modelProfile: 'invalid' }).success,
    false
  );
});

test('FocusNodeSchema accepts optional clickedLabel', () => {
  const ok = FocusNodeSchema.safeParse({
    id: 'flowchart-v2-N-0',
    selectionKind: 'node',
    label: 'Full title',
    clickedLabel: 'Subtitle'
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.clickedLabel, 'Subtitle');
});

test('FocusNodeSchema requires edgeFrom and edgeTo when selectionKind is edge', () => {
  assert.equal(
    FocusNodeSchema.safeParse({
      id: 'L_A_B_0',
      selectionKind: 'edge'
    }).success,
    false
  );

  const ok = FocusNodeSchema.safeParse({
    id: 'L_A_B_0',
    selectionKind: 'edge',
    edgeFrom: 'A',
    edgeTo: 'B',
    label: 'feeds'
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.edgeFrom, 'A');
});

test('analyze payload accepts extended focusNode for edges', () => {
  const parsed = DiagramAnalyzeSchema.safeParse({
    revisionId: 0,
    mermaidSource: 'flowchart LR\n  A --> B',
    kind: 'explain',
    focusNode: {
      id: 'L_A_B_0',
      selectionKind: 'edge',
      edgeFrom: 'A',
      edgeTo: 'B'
    }
  });
  assert.equal(parsed.success, true);
});

test('transform payloads accept optional goMadDepth in valid range', () => {
  const base = {
    revisionId: 0,
    mermaidSource: 'flowchart TD\n  A --> B',
    mode: 'goMad'
  };

  const rest = DiagramTransformIntentSchema.safeParse(base);
  assert.equal(rest.success, true);
  assert.equal(rest.data.goMadDepth, undefined);

  const depthOk = DiagramTransformIntentSchema.safeParse({ ...base, goMadDepth: 7 });
  assert.equal(depthOk.success, true);
  assert.equal(depthOk.data.goMadDepth, 7);

  const stream = AgentStreamPayloadSchema.safeParse({
    operation: 'transform',
    ...base,
    goMadDepth: 2
  });
  assert.equal(stream.success, true);
  assert.equal(stream.data.goMadDepth, 2);

  assert.equal(DiagramTransformIntentSchema.safeParse({ ...base, goMadDepth: 13 }).success, false);
  assert.equal(DiagramTransformIntentSchema.safeParse({ ...base, goMadDepth: 0 }).success, false);
});
