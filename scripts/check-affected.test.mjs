import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyChangedFiles, summarizeAffectedFlags } from './check-affected-lib.mjs';

test('classifyChangedFiles marks shared package edits', () => {
  const flags = classifyChangedFiles(['packages/shared/src/diagramSchema.ts']);
  assert.equal(flags.shared, true);
  assert.equal(flags.lintShared, true);
  assert.equal(flags.wire, true);
});

test('classifyChangedFiles marks server agent routes as wire', () => {
  const flags = classifyChangedFiles(['apps/server/src/agents/mermaidLangChainAgent.js']);
  assert.equal(flags.server, true);
  assert.equal(flags.wire, true);
  assert.equal(flags.lintServer, true);
});

test('classifyChangedFiles marks web state and agUi translator as wire', () => {
  const flags = classifyChangedFiles(['apps/web/src/state/agUiTranslator.ts']);
  assert.equal(flags.web, true);
  assert.equal(flags.wire, true);
  assert.equal(flags.lintWeb, true);
});

test('classifyChangedFiles marks doc-only edits without workspace lint', () => {
  const flags = classifyChangedFiles(['docs/guide/coding-agents.md']);
  assert.equal(flags.docs, true);
  assert.equal(flags.shared, false);
  assert.equal(flags.lintShared, false);
});

test('classifyChangedFiles marks lockfile edits as deps', () => {
  const flags = classifyChangedFiles(['package-lock.json']);
  assert.equal(flags.deps, true);
  assert.equal(flags.root, false);
});

test('classifyChangedFiles marks package.json as deps and root', () => {
  const flags = classifyChangedFiles(['package.json']);
  assert.equal(flags.deps, true);
  assert.equal(flags.root, true);
});

test('classifyChangedFiles marks scripts/ as root tooling', () => {
  const flags = classifyChangedFiles(['scripts/check-affected.mjs']);
  assert.equal(flags.root, true);
});

test('classifyChangedFiles does not lint doc files inside a workspace tree', () => {
  const flags = classifyChangedFiles(['apps/web/README.md']);
  assert.equal(flags.web, true);
  assert.equal(flags.lintWeb, false);
});

test('summarizeAffectedFlags lists active buckets', () => {
  const summary = summarizeAffectedFlags(
    classifyChangedFiles([
      'packages/shared/src/mermaidSanitizer.ts',
      'apps/server/src/routes/copilot.ts'
    ])
  );
  assert.match(summary, /shared/);
  assert.match(summary, /server/);
  assert.match(summary, /wire/);
});
