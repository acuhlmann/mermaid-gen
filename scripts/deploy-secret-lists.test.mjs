// The Cloud Run secret list is written twice — once inline in .github/workflows/deploy-cloud-run.yml
// (the CI deployer, the one that actually runs on every merge) and once in scripts/deploy-cloud-run.sh
// (the manual `npm run deploy:cloud-run` path). `--set-secrets` REPLACES the whole list, so a pair that
// exists in one and not the other is a secret that a deploy silently removes from production.
//
// This is not hypothetical: GOD_WINDOW_TOKEN was added to the shell script only, and the CI deploy
// shipped the code without mounting it — a green deploy that left the owner's window closed. The prose
// comment saying "keep these in step" had already been written and had already failed. Hence a sensor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url).href.replace(/\/$/, '');
const PAIR_RE = /([A-Z][A-Z0-9_]*)=([a-z0-9][a-z0-9-]*):latest/g;

function pairsFrom(text) {
  const found = new Map();
  for (const [, envName, secretName] of text.matchAll(PAIR_RE)) found.set(envName, secretName);
  return found;
}

function read(rel) {
  return readFileSync(fileURLToPath(new URL(rel, `${root}/`)), 'utf8');
}

const workflow = pairsFrom(read('.github/workflows/deploy-cloud-run.yml'));
const shell = pairsFrom(read('scripts/deploy-cloud-run.sh'));

test('the CI deployer and the manual deploy script mount the same secrets', () => {
  assert.ok(workflow.size >= 4, 'expected the workflow to declare several secrets');
  const onlyWorkflow = [...workflow].filter(([k, v]) => shell.get(k) !== v);
  const onlyShell = [...shell].filter(([k, v]) => workflow.get(k) !== v);
  assert.deepEqual(onlyWorkflow, [], 'mounted by CI but not by npm run deploy:cloud-run');
  assert.deepEqual(onlyShell, [], 'mounted by the manual deploy but stripped by every CI deploy');
});

test('the owner God window token is mounted by both deployers', () => {
  // Losing this pair does not fail a build — it silently closes the window and answers 503.
  for (const [name, list] of [
    ['workflow', workflow],
    ['deploy-cloud-run.sh', shell]
  ]) {
    assert.equal(
      list.get('GOD_WINDOW_TOKEN'),
      'god-window-token',
      `${name} must mount GOD_WINDOW_TOKEN`
    );
  }
});

test('the door code and the owner token are separate mounts', () => {
  // The whole point of the new gate: the badge is a shared, inert-when-unset door code and cannot carry
  // spend figures. If anyone ever collapses them into one secret, this fails.
  assert.equal(workflow.get('VISITOR_BADGE_SECRETS'), 'visitor-badge-secrets');
  assert.equal(workflow.get('GOD_WINDOW_TOKEN'), 'god-window-token');
  assert.notEqual(workflow.get('VISITOR_BADGE_SECRETS'), workflow.get('GOD_WINDOW_TOKEN'));
});
