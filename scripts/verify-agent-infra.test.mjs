import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectRootPackageScripts,
  collectRoutineDocs,
  extractBlastRadiusTestPaths,
  extractNpmScriptNames,
  verifyAgentInfra
} from './verify-agent-infra.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('extractNpmScriptNames skips workspace-scoped invocations', () => {
  const names = extractNpmScriptNames(
    'Root `npm run build` vs workspace `npm run vendor:anything-libs -w packages/shared`.'
  );
  assert.deepEqual([...names].sort(), ['build']);
});

test('extractNpmScriptNames finds root scripts in agent docs', () => {
  const names = extractNpmScriptNames('Run `npm run check:affected` then `npm run check:full`.');
  assert.deepEqual([...names].sort(), ['check:affected', 'check:full']);
});

test('extractBlastRadiusTestPaths ignores prose after test file links', () => {
  const paths = extractBlastRadiusTestPaths(
    '| Tests | [`packages/shared/test/wireRoundTrip.test.ts`](../packages/shared/test/wireRoundTrip.test.ts), server agent tests |'
  );
  assert.deepEqual(paths, ['packages/shared/test/wireRoundTrip.test.ts']);
});

test('collectRootPackageScripts includes agent verify commands', () => {
  const scripts = collectRootPackageScripts(ROOT);
  assert.ok(scripts.has('check:affected'));
  assert.ok(scripts.has('precommit'));
  assert.ok(scripts.has('verify:doc-paths'));
});

test('verifyAgentInfra passes on the current repository', () => {
  const result = verifyAgentInfra(ROOT);
  assert.equal(
    result.ok,
    true,
    [
      ...result.missingScripts.map((m) => `missing script ${m.script} (cited in ${m.source})`),
      ...result.missingTests.map((m) => `missing test ${m.path} (cited in ${m.source})`)
    ].join('\n')
  );
  assert.ok(result.scriptCount > 10);
  assert.ok(result.testPathCount >= 5);
});

test('verifyAgentInfra reports a missing npm script cited in a temp doc', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-agent-infra-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: {} }));
  fs.writeFileSync(path.join(tmp, 'AGENTS.md'), 'Use `npm run missing-script`.\n');
  const result = verifyAgentInfra(tmp, ['AGENTS.md']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingScripts, [{ script: 'missing-script', source: 'AGENTS.md' }]);
});

test('verifyAgentInfra reports a missing blast-radius test path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-agent-infra-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), JSON.stringify({ scripts: {} }));
  const doc = path.join(tmp, 'docs', 'agent-blast-radius.md');
  fs.mkdirSync(path.dirname(doc), { recursive: true });
  fs.writeFileSync(
    doc,
    '| Tests | [`apps/server/test/__missing__.test.js`](../apps/server/test/__missing__.test.js) |\n'
  );
  const result = verifyAgentInfra(tmp, ['docs/agent-blast-radius.md']);
  assert.equal(result.ok, false);
  assert.deepEqual(result.missingTests, [
    { path: 'apps/server/test/__missing__.test.js', source: 'docs/agent-blast-radius.md' }
  ]);
});

test('collectRoutineDocs discovers playbooks without listing them', () => {
  const docs = collectRoutineDocs(ROOT);
  assert.ok(docs.includes('docs/routines/review.md'));
  assert.ok(docs.includes('docs/routines/improve.md'));
  assert.ok(
    !docs.includes('docs/routines/README.md'),
    'the contract is added separately, not as a playbook'
  );
});

test('routine playbooks are covered by the default scan', () => {
  const scripts = collectRootPackageScripts(ROOT);
  assert.ok(scripts.has('routine:guard'));
  assert.ok(scripts.has('verify:ratchet'));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-infra-'));
  fs.mkdirSync(path.join(dir, 'docs/routines/ledger'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ scripts: { check: 'x' } }));
  fs.writeFileSync(path.join(dir, 'docs/routines/README.md'), 'Run `npm run check`.\n');
  fs.writeFileSync(path.join(dir, 'docs/routines/ghost.md'), 'Run `npm run not-a-script`.\n');

  const result = verifyAgentInfra(dir);
  assert.equal(result.ok, false, 'a playbook naming a missing script must fail');
  assert.ok(
    result.missingScripts.some(
      (miss) => miss.source === 'docs/routines/ghost.md' && miss.script === 'not-a-script'
    ),
    `expected the playbook's bad script to be reported, got ${JSON.stringify(result.missingScripts)}`
  );
});
