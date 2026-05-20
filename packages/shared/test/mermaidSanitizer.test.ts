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
