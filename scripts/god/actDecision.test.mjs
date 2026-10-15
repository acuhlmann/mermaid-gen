import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decideAct,
  lastNarrationText,
  parseObserveNarration,
  readBriefFlags,
  writeActDecisionOutputs
} from './actDecision.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIEF = path.join(HERE, 'fixtures', 'brief.sample.json');

const LIVE = {
  gateGo: true,
  tier: 'observe',
  briefSource: 'live',
  sufficient: true,
  briefOk: true
};

test('a live sufficient observe tick starts the harness', () => {
  const decision = decideAct(LIVE);
  assert.equal(decision.act, true);
  assert.equal(decision.skipVerdict, null);
  assert.equal(decision.reason, 'go');
});

test('a fixture brief never spends, even when it is sufficient and the owner forced the run', () => {
  const decision = decideAct({ ...LIVE, briefSource: 'fixture', force: true });
  assert.equal(decision.act, false);
  assert.equal(decision.skipVerdict, 'noop');
  assert.equal(decision.reason, 'brief_not_live');
});

test('propose starts the harness; ship stays blocked', () => {
  const propose = decideAct({ ...LIVE, tier: 'propose' });
  assert.equal(propose.act, true);
  assert.equal(propose.reason, 'go');
  const ship = decideAct({ ...LIVE, tier: 'ship' });
  assert.equal(ship.act, false);
  assert.equal(ship.skipVerdict, 'blocked');
  assert.equal(ship.reason, 'tier_not_wired');
});

test('force skips the signal floor and still requires a live brief', () => {
  const thin = decideAct({ ...LIVE, sufficient: false, force: true });
  assert.equal(thin.act, true);
  assert.equal(thin.reason, 'go');
  const quiet = decideAct({ ...LIVE, sufficient: false, force: false });
  assert.equal(quiet.act, false);
  assert.equal(quiet.reason, 'insufficient');
});

test('a closed gate and an invalid brief do not act', () => {
  assert.equal(decideAct({ ...LIVE, gateGo: false }).reason, 'gate');
  assert.equal(decideAct({ ...LIVE, gateGo: 'false' }).reason, 'gate');
  const invalid = decideAct({ ...LIVE, briefOk: false, force: true });
  assert.equal(invalid.act, false);
  assert.equal(invalid.reason, 'brief_invalid');
});

test('github string flags parse the same as booleans', () => {
  const decision = decideAct({
    gateGo: 'true',
    tier: 'observe',
    briefSource: 'live\n',
    sufficient: 'true',
    briefOk: 'true'
  });
  assert.equal(decision.act, true);
});

test('parseObserveNarration keeps a finding sentence and drops everything else', () => {
  const finding = parseObserveNarration(
    'finding:mermaid.accept_rate Accept rate fell five points.'
  );
  assert.equal(finding.findingId, 'mermaid.accept_rate');
  assert.equal(finding.hypothesis, 'Accept rate fell five points.');
  assert.equal(finding.waiting, false);

  const waiting = parseObserveNarration('waiting');
  assert.equal(waiting.waiting, true);
  assert.equal(waiting.findingId, null);
  assert.equal(waiting.hypothesis, null);

  for (const text of [
    'waiting for more',
    'Done.',
    'finding:Not A Slug nope',
    'finding:mermaid.accept_rate'
  ]) {
    const dropped = parseObserveNarration(text);
    assert.equal(dropped.findingId, null);
    assert.equal(dropped.hypothesis, null);
    assert.equal(dropped.waiting, false);
  }
});

test('parseObserveNarration clips a sentence to 280 characters', () => {
  const sentence = 'a'.repeat(400);
  const parsed = parseObserveNarration(`finding:ux.retry_rate ${sentence}`);
  assert.equal(parsed.hypothesis?.length, 280);
  assert.equal(parsed.hypothesis?.endsWith('…'), true);
});

test('lastNarrationText prefers the last text line over a later final trailer', () => {
  const ndjson = [
    JSON.stringify({
      type: 'text',
      text: 'finding:chart.failure_rate Compile failures clustered.'
    }),
    JSON.stringify({ type: 'final', text: 'Done.' }),
    ''
  ].join('\n');
  assert.equal(lastNarrationText(ndjson), 'finding:chart.failure_rate Compile failures clustered.');
  assert.equal(
    lastNarrationText(
      `${JSON.stringify({ type: 'final', text: 'finding:forms.retry_rate Buttons failed.' })}\n`
    ),
    'finding:forms.retry_rate Buttons failed.'
  );
});

test('readBriefFlags trusts the schema and writeActDecisionOutputs is a flat env file', () => {
  assert.equal(readBriefFlags(BRIEF).sufficient, true);
  assert.equal(readBriefFlags(BRIEF).briefOk, true);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'god-act-'));
  const outputPath = path.join(dir, 'out');
  writeActDecisionOutputs(decideAct({ ...LIVE, briefSource: 'fixture' }), { outputPath });
  const out = fs.readFileSync(outputPath, 'utf8');
  assert.match(out, /^act=false$/m);
  assert.match(out, /^skip_verdict=noop$/m);
  assert.match(out, /^skip_reason=brief_not_live$/m);
});
