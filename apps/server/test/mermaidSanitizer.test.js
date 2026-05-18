import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeMermaid, prepareMermaidForRender, __internal } from '@archislop/shared';
import { validateAndPreparePatch } from '../src/tools/mermaidDiffTool.js';
import { createDiagramStateStore } from '../src/state/diagramStateStore.js';

test('sanitizeMermaid returns empty applied list for clean source', () => {
  const source = 'flowchart TD\n  A --> B';
  const { sanitized, applied } = sanitizeMermaid(source);
  assert.equal(sanitized, source);
  assert.deepEqual(applied, []);
});

test('sanitizeMermaid is idempotent', () => {
  const source = 'flowchart TD\n  A["with (parens)"] --> B';
  const first = sanitizeMermaid(source);
  const second = sanitizeMermaid(first.sanitized);
  assert.equal(second.sanitized, first.sanitized);
  assert.deepEqual(second.applied, []);
});

test('normalizeSmartQuotes converts curly quotes to straight', () => {
  const out = __internal.normalizeSmartQuotes('flowchart TD\n  A[“Hello”] --> B');
  assert.equal(out, 'flowchart TD\n  A["Hello"] --> B');
});

test('normalizeSmartQuotes returns null when no smart quotes present', () => {
  assert.equal(__internal.normalizeSmartQuotes('flowchart TD\n  A --> B'), null);
});

test('normalizeDiagramHeader fixes "flow chart" typo', () => {
  const out = __internal.normalizeDiagramHeader('flow chart TD\n  A --> B');
  assert.equal(out, 'flowchart TD\n  A --> B');
});

test('normalizeDiagramHeader fixes case-variant prefixes', () => {
  const out = __internal.normalizeDiagramHeader('FLOWCHART TD\n  A --> B');
  assert.equal(out, 'flowchart TD\n  A --> B');
});

test('normalizeDiagramHeader promotes stateDiagram to v2 when v2 syntax detected', () => {
  const out = __internal.normalizeDiagramHeader('stateDiagram\n  [*] --> Idle\n  Idle --> Running');
  assert.match(out, /^stateDiagram-v2/);
});

test('normalizeDiagramHeader leaves bare stateDiagram alone when no v2 syntax', () => {
  assert.equal(__internal.normalizeDiagramHeader('stateDiagram\n  state Idle'), null);
});

test('escapeReservedNodeIds renames `end` node and rewrites edges', () => {
  const out = __internal.escapeReservedNodeIds('flowchart TD\n  Start --> end[Done]\n  end --> Final');
  assert.match(out, /n_end\[Done\]/);
  assert.match(out, /n_end --> Final/);
  // Original keyword `end` at start of subgraph block must NOT be touched.
});

test('escapeReservedNodeIds leaves bare subgraph/end keyword lines alone', () => {
  const src = 'flowchart TD\n  subgraph Cluster\n    A --> B\n  end\n';
  assert.equal(__internal.escapeReservedNodeIds(src), null);
});

test('quoteLabelsWithSpecials wraps parens-bearing labels', () => {
  const out = __internal.quoteLabelsWithSpecials('flowchart TD\n  A[user (admin)] --> B');
  assert.match(out, /A\["user \(admin\)"\]/);
});

test('quoteLabelsWithSpecials wraps slash-bearing labels', () => {
  const out = __internal.quoteLabelsWithSpecials('flowchart TD\n  A[and/or] --> B');
  assert.match(out, /A\["and\/or"\]/);
});

test('quoteLabelsWithSpecials wraps edge pipe labels with specials', () => {
  const out = __internal.quoteLabelsWithSpecials('flowchart TD\n  A -->|key: value| B');
  assert.match(out, /\|"key: value"\|/);
});

test('quoteLabelsWithSpecials leaves already-quoted labels alone', () => {
  assert.equal(__internal.quoteLabelsWithSpecials('flowchart TD\n  A["already (quoted)"] --> B'), null);
});

test('quoteLabelsWithSpecials leaves plain alphanumeric labels alone', () => {
  assert.equal(__internal.quoteLabelsWithSpecials('flowchart TD\n  A[Plain Label] --> B'), null);
});

test('quoteLabelsWithSpecials does not mangle circle shape `id((label))`', () => {
  // Regression: the regex used to match `id(label)` greedily, capturing the inner `(`
  // of a circle node `ROOT((Key AI Domains))` and producing the invalid `ROOT("(Key AI Domains"))`.
  assert.equal(
    __internal.quoteLabelsWithSpecials('graph TD\n  ROOT((Key AI Domains)) --> ML'),
    null
  );
});

test('quoteLabelsWithSpecials does not mangle subroutine shape `id[[label]]`', () => {
  assert.equal(
    __internal.quoteLabelsWithSpecials('flowchart TD\n  SUB[[Sub routine]] --> X'),
    null
  );
});

test('stripInvalidSemicolons removes trailing ; outside flowchart', () => {
  const out = __internal.stripInvalidSemicolons('sequenceDiagram\n  Alice->>Bob: hi;\n  Bob->>Alice: ok;');
  assert.doesNotMatch(out, /;$/m);
});

test('stripInvalidSemicolons keeps semicolons in flowchart', () => {
  assert.equal(__internal.stripInvalidSemicolons('flowchart TD\n  A --> B;\n'), null);
});

test('closeUnbalancedSubgraphs appends missing end', () => {
  const src = 'flowchart TD\n  subgraph Cluster\n    A --> B\n';
  const out = __internal.closeUnbalancedSubgraphs(src);
  assert.match(out, /\nend\n$/);
});

test('closeUnbalancedSubgraphs leaves balanced source alone', () => {
  const src = 'flowchart TD\n  subgraph Cluster\n    A --> B\n  end\n';
  assert.equal(__internal.closeUnbalancedSubgraphs(src), null);
});

test('repairInitDirective fixes single-quoted JSON and hoists', () => {
  const src = "flowchart TD\n%%{init: {'theme':'dark'}}%%\nA --> B";
  const out = __internal.repairInitDirective(src);
  assert.match(out, /^%%\{init: \{"theme":"dark"\}\}%%/);
  assert.match(out, /flowchart TD/);
});

test('repairInitDirective handles trailing commas', () => {
  const src = '%%{init: {"theme":"dark",}}%%\nflowchart TD\n  A --> B';
  const out = __internal.repairInitDirective(src);
  assert.match(out, /\{"theme":"dark"\}/);
});

test('repairInitDirective returns null when init JSON is unrecoverable', () => {
  const src = '%%{init: this is not even close to json}%%\nflowchart TD\n  A --> B';
  assert.equal(__internal.repairInitDirective(src), null);
});

test('expandCommaSeparatedStyleLines splits multi-node style rows', () => {
  const src = `flowchart TD
  A --> B
  style B,C fill:#efffe5,stroke:#89e219
  style G,H,I fill:#fff4b8,stroke:#ffc800`;
  const out = __internal.expandCommaSeparatedStyleLines(src);
  assert.ok(out);
  assert.match(out, /style B fill:#efffe5,stroke:#89e219/);
  assert.match(out, /style C fill:#efffe5,stroke:#89e219/);
  assert.match(out, /style G fill:#fff4b8,stroke:#ffc800/);
  assert.match(out, /style I fill:#fff4b8,stroke:#ffc800/);
  assert.doesNotMatch(out, /style B,C/);
});

test('prepareMermaidForRender is idempotent on expanded style lines', () => {
  const src = 'flowchart TD\n  A --> B\n  style B,C fill:#eee';
  const once = prepareMermaidForRender(src);
  const twice = prepareMermaidForRender(once);
  assert.equal(once, twice);
  assert.match(once, /style B fill:#eee/);
  assert.match(once, /style C fill:#eee/);
});

test('validateAndPreparePatch expands comma-separated style lines in stored source', async () => {
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: `flowchart TD
  A --> B
  A --> C
  style B,C fill:#efffe5,stroke:#89e219`,
    reason: 'style expand'
  });
  assert.equal(result.accepted, true);
  assert.match(result.patch.diagramSource, /style B fill:#efffe5/);
  assert.match(result.patch.diagramSource, /style C fill:#efffe5/);
  assert.doesNotMatch(result.patch.diagramSource, /style B,C/);
});

test('sanitizeMermaid composes fixers — smart quotes + parens labels', () => {
  const src = 'flowchart TD\n  A[“user (admin)”] --> B';
  const { sanitized, applied } = sanitizeMermaid(src);
  assert.ok(applied.length >= 1);
  assert.match(sanitized, /A\["user \(admin\)"\]/);
  assert.doesNotMatch(sanitized, /[“”]/);
});

test('sanitizeMermaid quotes bracket labels containing embedded double quotes', () => {
  const src = 'flowchart TD\n  E --> F[MEME SKY\\n"I thirst"] --> G[Done]';
  const { sanitized, applied } = sanitizeMermaid(src);
  assert.ok(applied.includes('quoteBracketLabelsWithEmbeddedQuotes'), applied);
  assert.match(sanitized, /F\["MEME SKY/);
  assert.match(sanitized, /I thirst/);
  assert.doesNotMatch(sanitized, /F\[MEME SKY\\n"I/);
});

test('validateAndPreparePatch rescues a smart-quote + specials failure via sanitizer', async () => {
  // Smart quotes alone are tolerated by mermaid.parse; pair them with parens-in-label so the
  // source actually fails the parser. The rescue should fire both normalizeSmartQuotes and
  // quoteLabelsWithSpecials.
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: 'flowchart TD\n  A[“user (admin)”] --> B',
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.validator, 'sanitizer-rescue');
  assert.ok(result.metadata.sanitizerApplied.includes('normalizeSmartQuotes'));
});

test('validateAndPreparePatch rescues parens-in-label via sanitizer', async () => {
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: 'flowchart TD\n  A[user (admin)] --> B[guest (anon)]',
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.validator, 'sanitizer-rescue');
  assert.ok(result.metadata.sanitizerApplied.includes('quoteLabelsWithSpecials'));
});

test('validateAndPreparePatch rescues "flow chart" header typo', async () => {
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: 'flow chart TD\n  A --> B',
    reason: 'test'
  });
  assert.equal(result.accepted, true);
  assert.equal(result.metadata.validator, 'sanitizer-rescue');
  assert.ok(result.metadata.sanitizerApplied.includes('normalizeDiagramHeader'));
});

test('validateAndPreparePatch leaves valid source untouched (no sanitizer firing)', async () => {
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: 'flowchart TD\n  A --> B',
    reason: 'clean'
  });
  assert.equal(result.accepted, true);
  assert.notEqual(result.metadata.validator, 'sanitizer-rescue');
  assert.deepEqual(result.metadata.sanitizerApplied, []);
});

test('validateAndPreparePatch still rejects truly-broken source', async () => {
  const stateStore = createDiagramStateStore();
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: 'this is not a diagram at all',
    reason: 'bad'
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /missing known diagram type|parser rejected/);
});

test('validateAndPreparePatch rejects exec patches that only relabel a busy flowchart', async () => {
  const before =
    'flowchart TD\n' +
    '  A[Acquire] --> B[Build]\n' +
    '  B --> C[Test]\n' +
    '  C --> D[Ship]\n' +
    '  D --> E[Operate]\n' +
    '  E --> F[Retire]';
  const stateStore = createDiagramStateStore();
  await stateStore.applyDiagramSource({
    contentType: 'mermaid',
    diagramSource: before,
    reason: 'seed'
  });
  const result = await validateAndPreparePatch({
    currentState: stateStore.getState(),
    proposedMermaidSource: before.replace(/Acquire/g, 'Buy'),
    reason: 'exec',
    transformMode: 'exec'
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /remove nodes or edges/i);
});
