import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMermaidForRender, sanitizeMermaid, __internal } from '../src/mermaidSanitizer.js';

test('expandCommaSeparatedStyleLines leaves single-node style rows unchanged', () => {
  const src = 'flowchart TD\n  A --> B\n  style A fill:#d7ffb8,stroke:#58cc02,stroke-width:2px';
  assert.equal(__internal.expandCommaSeparatedStyleLines(src), null);
});

test('expandCommaSeparatedStyleLines expands comma-separated node lists', () => {
  const src = 'flowchart TD\n  style B,C,D fill:#efffe5,stroke:#89e219';
  const out = __internal.expandCommaSeparatedStyleLines(src);
  assert.ok(out);
  assert.match(out, /style B fill:#efffe5/);
  assert.match(out, /style C fill:#efffe5/);
  assert.match(out, /style D fill:#efffe5/);
});

test('sanitizeMermaid applies expandCommaSeparatedStyleLines', () => {
  const src = 'flowchart TD\n  A --> B\n  style X,Y fill:#fff';
  const { sanitized, applied } = sanitizeMermaid(src);
  assert.ok(applied.includes('expandCommaSeparatedStyleLines'));
  assert.match(sanitized, /style X fill:#fff/);
  assert.match(sanitized, /style Y fill:#fff/);
});

test('prepareMermaidForRender applies style expansion', () => {
  const src = 'flowchart TD\n  style P,Q fill:#abc';
  const out = prepareMermaidForRender(src);
  assert.match(out, /style P fill:#abc/);
  assert.match(out, /style Q fill:#abc/);
});

test('stripUnsupportedStyleDirectives removes classDef from a mindmap (the "only one root" failure)', () => {
  const src =
    'mindmap\n  root((Chaos))\n    Ideas\n    Plans\nclassDef bling fill:#ff1493,color:#fff,border-color:#000';
  const out = __internal.stripUnsupportedStyleDirectives(src);
  assert.ok(out);
  assert.doesNotMatch(out, /classDef/);
  assert.match(out, /mindmap/);
  assert.match(out, /root\(\(Chaos\)\)/);
});

test('stripUnsupportedStyleDirectives strips class/style/linkStyle from styling-free types', () => {
  for (const header of ['pie showData', 'journey', 'timeline', 'gitGraph', 'sankey-beta']) {
    const src = `${header}\n  title T\nclassDef a fill:#000\nclass N a\nstyle N fill:#111\nlinkStyle 0 stroke:#222`;
    const out = __internal.stripUnsupportedStyleDirectives(src);
    assert.ok(out, `expected a rewrite for ${header}`);
    assert.doesNotMatch(out, /classDef|^class |^style |linkStyle/m);
  }
});

test('stripUnsupportedStyleDirectives leaves styling-capable types untouched', () => {
  for (const src of [
    'flowchart TD\n  A --> B\n  classDef hot fill:#f00\n  class A hot\n  style B fill:#0f0\n  linkStyle 0 stroke:#00f',
    'stateDiagram-v2\n  [*] --> S\n  classDef hot fill:#f00\n  class S hot',
    'classDiagram\n  class Animal\n  classDef hot fill:#f00',
    // block-beta / quadrantChart DO support styling — must not be stripped even when failing
    'block-beta\n  columns 1\n  A\n  style A fill:#f00',
    'quadrantChart\n  title T\n  classDef hot fill:#f00'
  ]) {
    assert.equal(__internal.stripUnsupportedStyleDirectives(src), null);
  }
});

test('sanitizeMermaid rescues a mindmap-with-classDef via stripUnsupportedStyleDirectives', () => {
  const src = 'mindmap\n  root((X))\n    A\nclassDef bling fill:#ff1493';
  const { sanitized, applied } = sanitizeMermaid(src, {
    parseError: 'There can be only one root'
  });
  assert.ok(applied.includes('stripUnsupportedStyleDirectives'));
  assert.doesNotMatch(sanitized, /classDef/);
});

test('detectDiagramType skips comments and frontmatter', () => {
  assert.equal(
    __internal.detectDiagramType('%% a comment\n%%{init: {}}%%\nmindmap\n  root'),
    'mindmap'
  );
  assert.equal(__internal.detectDiagramType('---\ntitle: T\n---\npie\n  "A" : 1'), 'pie');
  assert.equal(__internal.detectDiagramType('flowchart TD\n  A --> B'), 'flowchart');
});

// Mermaid 12 ships agentflow-beta and usecase-beta, where `-beta` is part of the keyword:
// a model writing the natural `agentflow` produces something that parses under nothing.
test('normalizeDiagramHeader promotes Mermaid 12 beta headers', () => {
  assert.equal(
    __internal.normalizeDiagramHeader('agentflow TD\n  A --> B'),
    'agentflow-beta TD\n  A --> B'
  );
  assert.equal(
    __internal.normalizeDiagramHeader('usecase\n  actor User'),
    'usecase-beta\n  actor User'
  );
  assert.equal(
    __internal.normalizeDiagramHeader('Agentflow TB\n  A --> B'),
    'agentflow-beta TB\n  A --> B'
  );
});

test('normalizeDiagramHeader leaves an already-correct beta header alone', () => {
  for (const src of ['agentflow-beta TB\n  A --> B', 'usecase-beta\n  actor User']) {
    assert.equal(__internal.normalizeDiagramHeader(src), null);
  }
});

test('normalizeDiagramHeader does not promote a keyword that only starts with the beta name', () => {
  assert.equal(__internal.normalizeDiagramHeader('agentflow-betaish TD\n  A --> B'), null);
});

test('detectDiagramType recognises the Mermaid 12 beta headers', () => {
  assert.equal(
    __internal.detectDiagramType('agentflow-beta TB\n  a["A"]@{ shape: task }'),
    'agentflow-beta'
  );
  assert.equal(__internal.detectDiagramType('usecase-beta\n  actor User'), 'usecase-beta');
});

// Both new types accept classDef/class/style, so the blunt strip-all fixer must not fire on
// them — that would delete legitimate styling and mask the real (per-directive) gaps.
test('stripUnsupportedStyleDirectives leaves the Mermaid 12 beta types untouched', () => {
  for (const src of [
    'agentflow-beta TB\n  a["A"] --> b["B"]\n  classDef hot fill:#f00\n  class b hot',
    'usecase-beta\n  actor User\n  User --> Login\n  classDef hot fill:#f00'
  ]) {
    assert.equal(__internal.stripUnsupportedStyleDirectives(src), null);
  }
});

test('sanitizeMermaid rescues a bare agentflow header', () => {
  const src = 'agentflow TD\n  a["Start"] --> b["Finish"]';
  const { sanitized, applied } = sanitizeMermaid(src, {
    parseError: 'No diagram type detected matching given configuration for text: agentflow TD'
  });
  assert.ok(applied.includes('normalizeDiagramHeader'));
  assert.match(sanitized, /^agentflow-beta TD/);
});
