import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentHandshakeRequestSchema,
  AgentInsightSchema,
  AgentPresenceSchema,
  AgentProposalSchema,
  AgentReactionSchema,
  AgentStreamPayloadSchema,
  sanitizeAgentStreamPayload,
  ContentTypeSchema,
  DEFAULT_DIAGRAM_STYLE,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramPatchSchema,
  DiagramTransformIntentSchema,
  FocusNodeSchema,
  OriginSchema,
  SessionDiagramStateSchema,
  StyleIntentSchema,
  TransformModeSchema,
  ToolApplyResultSchema,
  UserDiagramEditSchema,
  applyMermaidStyleDirective,
  applyPatch,
  createInitialDiagramState,
  createInitialSessionState,
  extractMermaidInitDirective,
  parseMermaidStyleConfig,
  stripMermaidInitDirective
} from '../src/index.js';

test('applyPatch accepts valid patch and increments revision', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 0,
    nextRevisionId: 1,
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'test patch'
  });

  if (!result.accepted) throw new Error('expected accepted');
  assert.equal(result.state.revisionId, 1);
  assert.match(result.state.diagramSource, /A --> B/);
  assert.equal(result.state.contentType, 'mermaid');
  if (!result.state.styleConfig) throw new Error('expected styleConfig');
  assert.equal(result.state.styleConfig.theme, 'base');
  assert.equal(result.state.styleConfig.look, 'neo');
  assert.equal(result.state.styleConfig.flowchart.curve, 'rounded');
});

test('applyPatch rejects stale revisions', () => {
  const initial = createInitialDiagramState();
  const result = applyPatch(initial, {
    previousRevisionId: 9,
    nextRevisionId: 10,
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'stale patch'
  });

  if (result.accepted) throw new Error('expected rejected');
  assert.match(result.error, /Revision mismatch/);
});

test('applyPatch rejects contentType mismatch between slot and patch', () => {
  const slot = createInitialDiagramState('mermaid');
  const result = applyPatch(slot, {
    previousRevisionId: 0,
    nextRevisionId: 1,
    diagramSource:
      'infographic list-row-simple-horizontal-arrow\n  data\n    lists\n      - label A',
    contentType: 'infographic',
    reason: 'wrong slot'
  });

  if (result.accepted) throw new Error('expected rejected');
  assert.match(result.error, /Content type mismatch/);
});

test('createInitialDiagramState starts with an empty Mermaid canvas (style defaults only)', () => {
  const initial = createInitialDiagramState();

  assert.equal(initial.diagramSource, '');
  assert.equal(initial.contentType, 'mermaid');
  assert.deepEqual(initial.styleConfig, DEFAULT_DIAGRAM_STYLE);
  assert.equal(initial.styleConfig.themeVariables.primaryColor, '#d7ffb8');
});

test('createInitialDiagramState("infographic") returns empty DSL with null styleConfig', () => {
  const initial = createInitialDiagramState('infographic');

  assert.equal(initial.contentType, 'infographic');
  assert.equal(initial.styleConfig, null);
  assert.equal(initial.diagramSource, '');
});

test('createInitialSessionState builds independent slots for each content type', () => {
  const session = createInitialSessionState();
  const parsed = SessionDiagramStateSchema.parse(session);

  assert.equal(parsed.activeContentType, 'mermaid');
  assert.equal(parsed.mermaid.contentType, 'mermaid');
  assert.equal(parsed.infographic.contentType, 'infographic');
  assert.equal(parsed.metaphor3d.contentType, 'metaphor3d');
  assert.equal(parsed.chart.contentType, 'chart');
  assert.equal(parsed.anything.contentType, 'anything');
  assert.equal(parsed.mermaid.revisionId, 0);
  assert.equal(parsed.infographic.revisionId, 0);
  assert.equal(parsed.metaphor3d.revisionId, 0);
  assert.equal(parsed.chart.revisionId, 0);
  assert.equal(parsed.anything.revisionId, 0);
  assert.equal(parsed.mermaid.diagramSource, '');
  assert.equal(parsed.infographic.diagramSource, '');
  assert.equal(parsed.metaphor3d.diagramSource, '');
  assert.equal(parsed.chart.diagramSource, '');
  assert.equal(parsed.anything.diagramSource, '');
  assert.equal(parsed.metaphor3d.styleConfig, null);
  assert.equal(parsed.chart.styleConfig, null);
  assert.equal(parsed.anything.styleConfig, null);
});

test('parseMermaidStyleConfig reads supported init fields', () => {
  const result = parseMermaidStyleConfig(
    '%%{init: {"theme":"dark","look":"neo","themeVariables":{"primaryColor":"#123456"},"flowchart":{"curve":"linear"}}}%%\nflowchart TD\n  A --> B'
  );

  if (!result.accepted) throw new Error('expected accepted');
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
  const invalidTheme = parseMermaidStyleConfig(
    '%%{init: {"theme":"unsupported"}}%%\nflowchart TD\n  A --> B'
  );

  if (invalidJson.accepted) throw new Error('expected rejected');
  assert.match(invalidJson.error, /Invalid Mermaid init JSON/);
  if (invalidTheme.accepted) throw new Error('expected rejected');
  assert.match(invalidTheme.error, /Invalid Mermaid style config/);
});

test('intent payloads accept empty diagramSource for cleared canvas', () => {
  const intent = {
    prompt: 'Create a simple login flow',
    revisionId: 1,
    diagramSource: '',
    settings: {}
  };

  const parsed = DiagramIntentSchema.safeParse(intent);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.contentType, 'mermaid');
  assert.equal(
    AgentStreamPayloadSchema.safeParse({
      operation: 'intent',
      ...intent
    }).success,
    true
  );
});

test('intent payloads accept contentType auto for Go classification', () => {
  const intent = {
    prompt: 'Bar chart of quarterly revenue',
    revisionId: 0,
    diagramSource: '',
    contentType: 'auto',
    settings: {}
  };
  assert.equal(DiagramIntentSchema.safeParse(intent).success, true);
  assert.equal(
    AgentStreamPayloadSchema.safeParse({ operation: 'intent', ...intent }).success,
    true
  );
});

test('intent payloads reject peerContext when contentType is auto', () => {
  const intent = {
    prompt: 'x',
    revisionId: 0,
    diagramSource: '',
    contentType: 'auto',
    settings: {},
    peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' }
  };
  assert.equal(DiagramIntentSchema.safeParse(intent).success, false);
});

test('transform/analyze stream payloads reject contentType auto', () => {
  assert.equal(
    AgentStreamPayloadSchema.safeParse({
      operation: 'transform',
      mode: 'gilfoyle',
      revisionId: 0,
      diagramSource: 'flowchart TD\n  A',
      contentType: 'auto'
    }).success,
    false
  );
  assert.equal(
    AgentStreamPayloadSchema.safeParse({
      operation: 'analyze',
      kind: 'jared',
      revisionId: 0,
      diagramSource: 'flowchart TD\n  A',
      contentType: 'auto'
    }).success,
    false
  );
});

test('intent payloads reject peerContext when contentType matches intent slot', () => {
  const base = {
    prompt: 'x',
    revisionId: 0,
    diagramSource: '',
    contentType: 'mermaid',
    settings: {},
    peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' }
  };
  assert.equal(DiagramIntentSchema.safeParse(base).success, false);
  assert.equal(AgentStreamPayloadSchema.safeParse({ operation: 'intent', ...base }).success, false);
});

test('intent payloads accept valid peerContext for cross-format intent', () => {
  const intent = {
    prompt: 'Match the diagram',
    revisionId: 0,
    diagramSource: '',
    contentType: 'infographic',
    settings: {},
    peerContext: { contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' }
  };
  const parsed = DiagramIntentSchema.safeParse(intent);
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.peerContext?.contentType, 'mermaid');
  assert.equal(
    AgentStreamPayloadSchema.safeParse({
      operation: 'intent',
      ...intent
    }).success,
    true
  );
});

test('intent payloads accept contentType=infographic', () => {
  const parsed = DiagramIntentSchema.safeParse({
    prompt: 'Show three steps',
    revisionId: 0,
    diagramSource: '',
    contentType: 'infographic',
    settings: {}
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.contentType, 'infographic');
});

test('ContentTypeSchema accepts known slots and rejects unknown', () => {
  assert.equal(ContentTypeSchema.safeParse('mermaid').success, true);
  assert.equal(ContentTypeSchema.safeParse('infographic').success, true);
  assert.equal(ContentTypeSchema.safeParse('metaphor3d').success, true);
  assert.equal(ContentTypeSchema.safeParse('chart').success, true);
  assert.equal(ContentTypeSchema.safeParse('anything').success, true);
  assert.equal(ContentTypeSchema.safeParse('zigzag').success, false);
});

test('StyleIntentSchema accepts contentType "chart" (PR2 — Style is no longer mermaid-only)', () => {
  const result = StyleIntentSchema.safeParse({
    prompt: 'use the noir theme',
    stylePrompt: 'use the noir theme',
    revisionId: 0,
    diagramSource: '{"archislopVersion":1,"theme":"whiteboard","spec":{"mark":"bar"}}',
    contentType: 'chart',
    settings: {}
  });
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.contentType, 'chart');
});

test('modelProfile is optional and accepts fast or quality', () => {
  const baseIntent = {
    prompt: 'x',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  A --> B',
    settings: {}
  };

  const withQuality = DiagramIntentSchema.safeParse({ ...baseIntent, modelProfile: 'quality' });
  assert.equal(withQuality.success, true);
  assert.equal(withQuality.data.modelProfile, 'quality');

  const streamTransform = AgentStreamPayloadSchema.safeParse({
    operation: 'transform',
    revisionId: 0,
    diagramSource: 'flowchart TD\n  A --> B',
    mode: 'gilfoyle',
    modelProfile: 'fast'
  });
  assert.equal(streamTransform.success, true);
  assert.equal(streamTransform.data.modelProfile, 'fast');

  const analyze = DiagramAnalyzeSchema.safeParse({
    revisionId: 0,
    diagramSource: 'flowchart TD\n  A --> B',
    kind: 'richard',
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

test('FocusNodeSchema accepts infographic-region selectionKind', () => {
  const ok = FocusNodeSchema.safeParse({
    id: 'antv:abc123',
    selectionKind: 'infographic-region',
    label: 'Step 1',
    clickedLabel: 'Step 1'
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.selectionKind, 'infographic-region');
});

test('FocusNodeSchema accepts infographic-item selection with indexes/elementType', () => {
  const ok = FocusNodeSchema.safeParse({
    id: 'infographic:item-1-2',
    selectionKind: 'infographic-item',
    label: 'Corona',
    clickedLabel: 'Corona',
    indexes: '1,2',
    elementType: 'item-label'
  });
  assert.equal(ok.success, true);
  assert.equal(ok.data.indexes, '1,2');
  assert.equal(ok.data.elementType, 'item-label');
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

test('analyze payload accepts advisorPrompt for scoped stakeholder actions', () => {
  const parsed = DiagramAnalyzeSchema.safeParse({
    revisionId: 0,
    diagramSource: 'flowchart LR\n  A --> B',
    kind: 'richard',
    advisorPrompt: 'The cache box is doing too much work.'
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data?.advisorPrompt, 'The cache box is doing too much work.');
});

test('analyze payload accepts extended focusNode for edges', () => {
  const parsed = DiagramAnalyzeSchema.safeParse({
    revisionId: 0,
    diagramSource: 'flowchart LR\n  A --> B',
    kind: 'richard',
    focusNode: {
      id: 'L_A_B_0',
      selectionKind: 'edge',
      edgeFrom: 'A',
      edgeTo: 'B'
    }
  });
  assert.equal(parsed.success, true);
});

/*
 * PR #233 added this wire-contract guard; it was the one assertion not ported when
 * the rest landed in 6371723. Stale clients must not slip retired transform ids through.
 */
test('transform payloads accept erlich and reject retired wire ids', () => {
  const base = {
    revisionId: 0,
    diagramSource: 'flowchart TD\n  A --> B',
    mode: 'erlich'
  };
  assert.equal(DiagramTransformIntentSchema.safeParse(base).success, true);

  for (const retired of ['innovate', 'goMad', 'jared', 'explain', 'richard', 'style']) {
    assert.equal(
      DiagramTransformIntentSchema.safeParse({ ...base, mode: retired }).success,
      false,
      `retired transform mode ${retired}`
    );
  }
});

test('transform payloads accept optional russDepth in valid range', () => {
  const base = {
    revisionId: 0,
    diagramSource: 'flowchart TD\n  A --> B',
    mode: 'russ'
  };

  const rest = DiagramTransformIntentSchema.safeParse(base);
  assert.equal(rest.success, true);
  assert.equal(rest.data.russDepth, undefined);

  const depthOk = DiagramTransformIntentSchema.safeParse({ ...base, russDepth: 7 });
  assert.equal(depthOk.success, true);
  assert.equal(depthOk.data.russDepth, 7);

  const stream = AgentStreamPayloadSchema.safeParse({
    operation: 'transform',
    ...base,
    russDepth: 2
  });
  assert.equal(stream.success, true);
  // `stream.data` is the discriminated union; narrow before reading the
  // transform-only `russDepth` field.
  if (stream.success && stream.data.operation === 'transform') {
    assert.equal(stream.data.russDepth, 2);
  } else {
    assert.fail('expected transform variant');
  }

  assert.equal(DiagramTransformIntentSchema.safeParse({ ...base, russDepth: 13 }).success, false);
  assert.equal(DiagramTransformIntentSchema.safeParse({ ...base, russDepth: 0 }).success, false);
});

test('OriginSchema accepts external-agent shape', () => {
  const result = OriginSchema.safeParse({
    kind: 'external-agent',
    agentId: 'a1',
    agentName: 'Cursor',
    color: '#f97316',
    emoji: '🦊'
  });
  assert.equal(result.success, true);
});

test('OriginSchema rejects invalid color', () => {
  const result = OriginSchema.safeParse({ kind: 'external-agent', color: 'orange' });
  assert.equal(result.success, false);
});

test('DiagramPatchSchema accepts optional origin', () => {
  const patch = DiagramPatchSchema.parse({
    previousRevisionId: 0,
    nextRevisionId: 1,
    diagramSource: 'graph TD; A-->B;',
    contentType: 'mermaid',
    reason: 'external proposal accepted',
    origin: {
      kind: 'external-agent',
      agentId: 'a1',
      agentName: 'Cursor',
      color: '#f97316'
    }
  });
  if (!patch.origin) throw new Error('expected origin');
  assert.equal(patch.origin.agentName, 'Cursor');
});

test('AgentProposalSchema requires reason and diagramSource', () => {
  const ok = AgentProposalSchema.safeParse({
    proposalId: 'p1',
    sessionId: 's1',
    origin: { kind: 'external-agent', agentName: 'Cursor', color: '#f97316' },
    contentType: 'mermaid',
    baseRevisionId: 0,
    diagramSource: 'graph TD; A-->B;',
    reason: 'fix typo',
    createdAt: new Date().toISOString()
  });
  assert.equal(ok.success, true);
  const bad = AgentProposalSchema.safeParse({
    proposalId: 'p1',
    sessionId: 's1',
    origin: { kind: 'external-agent' },
    contentType: 'mermaid',
    baseRevisionId: 0,
    diagramSource: '',
    reason: '',
    createdAt: new Date().toISOString()
  });
  assert.equal(bad.success, false);
});

test('AgentHandshakeRequestSchema accepts minimal request', () => {
  const result = AgentHandshakeRequestSchema.safeParse({
    requestId: 'r1',
    sessionId: 's1',
    proposedName: 'Cursor',
    createdAt: new Date().toISOString()
  });
  assert.equal(result.success, true);
});

test('AgentPresenceSchema accepts presence with focus', () => {
  const result = AgentPresenceSchema.safeParse({
    agentId: 'a1',
    agentName: 'Cursor',
    color: '#f97316',
    lastSeenAt: new Date().toISOString(),
    focus: { contentType: 'mermaid', nodeId: 'A', label: 'Start' }
  });
  assert.equal(result.success, true);
});

test('AgentReactionSchema requires a recognized target kind', () => {
  const ok = AgentReactionSchema.safeParse({
    reactionId: 'r1',
    origin: { kind: 'external-agent', agentName: 'Cursor', color: '#f97316' },
    target: { kind: 'revision', contentType: 'mermaid', revisionId: 1 },
    emoji: '🎉',
    createdAt: new Date().toISOString()
  });
  assert.equal(ok.success, true);
  const bad = AgentReactionSchema.safeParse({
    reactionId: 'r1',
    origin: { kind: 'external-agent' },
    target: { kind: 'whatever' },
    emoji: '🎉',
    createdAt: new Date().toISOString()
  });
  assert.equal(bad.success, false);
});

test('AgentInsightSchema defaults variant to note', () => {
  const result = AgentInsightSchema.parse({
    insightId: 'i1',
    origin: { kind: 'external-agent', agentName: 'Cursor', color: '#f97316' },
    text: 'looks good',
    createdAt: new Date().toISOString()
  });
  assert.equal(result.variant, 'note');
});

test('sanitizeAgentStreamPayload drops invalid transformPersona on intent', () => {
  const payload = {
    operation: 'intent',
    prompt: 'hello',
    revisionId: 0,
    diagramSource: '',
    settings: {},
    transformPersona: 'jared'
  };
  const sanitized = sanitizeAgentStreamPayload(payload) as Record<string, unknown>;
  assert.equal(sanitized.transformPersona, undefined);
  assert.equal(sanitized.prompt, 'hello');
});

test('sanitizeAgentStreamPayload keeps valid transformPersona', () => {
  const payload = {
    operation: 'intent',
    prompt: 'hello',
    revisionId: 0,
    diagramSource: '',
    settings: {},
    transformPersona: 'gilfoyle'
  };
  const sanitized = sanitizeAgentStreamPayload(payload) as Record<string, unknown>;
  assert.equal(sanitized.transformPersona, 'gilfoyle');
});

test('TransformModeSchema seats both engineers and the rest of the wire modes', () => {
  // The wire enum is the contract both apps validate against; a new seat that
  // never lands here 400s before the agent runs.
  assert.deepEqual(TransformModeSchema.options, ['gilfoyle', 'dinesh', 'erlich', 'russ', 'barker']);
  assert.equal(
    DiagramTransformIntentSchema.safeParse({
      revisionId: 1,
      diagramSource: 'flowchart TD\n  A --> B',
      mode: 'dinesh'
    }).success,
    true
  );
  const intent = {
    operation: 'intent',
    prompt: 'hello',
    revisionId: 0,
    diagramSource: '',
    settings: {},
    transformPersona: 'dinesh'
  };
  const sanitized = sanitizeAgentStreamPayload(intent) as Record<string, unknown>;
  assert.equal(sanitized.transformPersona, 'dinesh');
});

test('ToolApplyResultSchema accepts a success envelope with state.revisionId', () => {
  const parsed = ToolApplyResultSchema.safeParse({
    accepted: true,
    state: { revisionId: 4, diagramSource: 'graph TD', updatedAt: '2024-01-01' },
    patch: { diagramSource: 'graph TD', reason: 'agent update' }
  });
  assert.equal(parsed.success, true);
  if (parsed.success && parsed.data.accepted) {
    assert.equal(parsed.data.state.revisionId, 4);
  }
});

test('ToolApplyResultSchema accepts a failure envelope with error string', () => {
  const parsed = ToolApplyResultSchema.safeParse({
    accepted: false,
    error: 'Mermaid syntax error: unexpected EOF'
  });
  assert.equal(parsed.success, true);
  if (parsed.success && !parsed.data.accepted) {
    assert.equal(parsed.data.error, 'Mermaid syntax error: unexpected EOF');
  }
});

test('ToolApplyResultSchema rejects success envelope missing revisionId', () => {
  const parsed = ToolApplyResultSchema.safeParse({
    accepted: true,
    state: { diagramSource: 'graph TD' }
  });
  assert.equal(parsed.success, false);
});

test('ToolApplyResultSchema rejects failure envelope with empty error', () => {
  const parsed = ToolApplyResultSchema.safeParse({
    accepted: false,
    error: ''
  });
  assert.equal(parsed.success, false);
});

test('ToolApplyResultSchema rejects envelope without accepted discriminator', () => {
  const parsed = ToolApplyResultSchema.safeParse({
    state: { revisionId: 1 }
  });
  assert.equal(parsed.success, false);
});

test('UserDiagramEditSchema requires source, revision, and reason', () => {
  assert.equal(
    UserDiagramEditSchema.safeParse({
      diagramSource: 'flowchart TD\n  A --> B',
      previousRevisionId: 0,
      reason: 'Connect node'
    }).success,
    true
  );
  assert.equal(
    UserDiagramEditSchema.safeParse({
      contentType: 'infographic',
      diagramSource:
        'infographic hierarchy-tree-curved-line-rounded-rect-node\ndata\n  root\n    label A\n',
      previousRevisionId: 0,
      reason: 'Connect node'
    }).success,
    true
  );
  assert.equal(
    UserDiagramEditSchema.safeParse({
      contentType: 'metaphor3d',
      diagramSource: '{"metaphor":"tree","items":[{"id":"root","label":"Root","weight":4}]}',
      previousRevisionId: 0,
      reason: 'Connect node'
    }).success,
    true
  );
  assert.equal(
    UserDiagramEditSchema.safeParse({
      contentType: 'chart',
      diagramSource:
        '{"archislopVersion":1,"theme":"whiteboard","spec":{"mark":"bar","data":{"values":[{"category":"A","amount":1}]}}}',
      previousRevisionId: 0,
      reason: 'Connect node'
    }).success,
    true
  );
  assert.equal(
    UserDiagramEditSchema.safeParse({
      diagramSource: 'flowchart TD\n  A --> B',
      previousRevisionId: 0
    }).success,
    false
  );
});
