import test from 'node:test';
import assert from 'node:assert/strict';
import { escalateSyntaxFixerRepair } from '../src/agents/syntaxFixerEscalation.js';

test('escalateSyntaxFixerRepair uses modelOverride without climbing', async () => {
  let calls = 0;
  const result = await escalateSyntaxFixerRepair({
    env: { GOOGLE_CLOUD_PROJECT: 'p', DEEPSEEK_API_KEY: 'k' },
    modelOverride: { id: 'pinned' },
    brokenSource: 'broken',
    repairOnce: async (model) => {
      calls += 1;
      assert.equal(model.id, 'pinned');
      return { accepted: true, diagramSource: 'fixed' };
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.accepted, true);
  assert.equal(result.diagramSource, 'fixed');
});

test('escalateSyntaxFixerRepair climbs until a rung accepts', async () => {
  const seen = [];
  const result = await escalateSyntaxFixerRepair({
    env: {
      GOOGLE_CLOUD_PROJECT: 'p',
      DEEPSEEK_API_KEY: 'k',
      // Avoid constructing real SDK clients — repairOnce never invokes the model.
      SYNTAX_FIXER_ESCALATION: '1'
    },
    brokenSource: 'flowchart TD\n  A[bad (x)]',
    repairOnce: async (_model, _prior, target) => {
      seen.push(target?.tier);
      if (target?.tier !== 'quality') {
        return { accepted: false, error: `${target.tier} failed`, attemptedSource: 'still bad' };
      }
      return { accepted: true, diagramSource: 'flowchart TD\n  A["bad (x)"]' };
    }
  });
  // createSyntaxFixerModelForTarget will try to build real models — skip if that throws.
  // Instead stub via model construction failure... Actually createChatModelForBackend will
  // succeed constructing Vertex/DeepSeek clients without network. So this should work.
  assert.deepEqual(seen, ['lite', 'flash', 'quality']);
  assert.equal(result.accepted, true);
  assert.equal(result.metadata?.fixerTier, 'quality');
  assert.equal(result.metadata?.fixerRung, 3);
});

test('escalateSyntaxFixerRepair reports exhausted ladder', async () => {
  const result = await escalateSyntaxFixerRepair({
    env: { DEEPSEEK_API_KEY: 'k' },
    brokenSource: 'x',
    repairOnce: async () => ({ accepted: false, error: 'still broken' })
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /exhausted \d+-rung fixer ladder/);
});

test('escalateSyntaxFixerRepair returns not configured when no backends exist', async () => {
  const result = await escalateSyntaxFixerRepair({
    env: {},
    brokenSource: 'x',
    repairOnce: async () => ({ accepted: true, diagramSource: 'y' })
  });
  assert.equal(result.accepted, false);
  assert.match(String(result.error), /not configured/);
});
