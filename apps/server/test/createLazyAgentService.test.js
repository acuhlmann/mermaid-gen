import test from 'node:test';
import assert from 'node:assert/strict';
import { createLazyAgentService } from '../src/agents/_lib/createLazyAgentService.js';

const ENV = { DEEPSEEK_API_KEY: 'test-key' };

function makeStateStore() {
  return {
    getSlot: () => ({ revisionId: 1 }),
    setLastUserPrompt: () => {},
    mirrorLastUserPromptToSibling: () => {}
  };
}

function baseConfig(overrides = {}) {
  return {
    contentType: 'mermaid',
    stateStore: makeStateStore(),
    env: ENV,
    buildService: overrides.buildService ?? (() => ({})),
    streamLabels: { analyze: 'Analyzing', intent: 'Intent', transform: 'Transform' },
    ...overrides
  };
}

test('createLazyAgentService defers buildService until first use', async () => {
  let built = 0;
  const service = createLazyAgentService(
    baseConfig({
      buildService: () => {
        built += 1;
        return {
          async applyIntent() {
            return { message: 'ok' };
          }
        };
      }
    })
  );

  assert.equal(built, 0);
  await service.applyIntent({ prompt: 'go' });
  assert.equal(built, 1);
  await service.applyIntent({ prompt: 'again' });
  assert.equal(built, 1);
});

test('runAgentStream intent forwards uiLocale and common fields', async () => {
  let captured;
  const service = createLazyAgentService(
    baseConfig({
      intentExtraFields: ['peerContext'],
      buildService: () => ({
        async applyIntent(input) {
          captured = input;
          return { message: 'patched' };
        }
      })
    })
  );

  const events = [];
  await service.runAgentStream(
    'intent',
    {
      prompt: 'draw login',
      settings: { theme: 'dark' },
      focusNode: 'A',
      modelProfile: 'quality',
      uiLocale: 'en-AU',
      peerContext: [{ role: 'peer' }],
      abortSignal: new AbortController().signal,
      _revisionBefore: 0,
      contentType: 'mermaid'
    },
    (ev) => events.push(ev)
  );

  assert.equal(captured.uiLocale, 'en-AU');
  assert.equal(captured.modelProfile, 'quality');
  assert.equal(captured.prompt, 'draw login');
  assert.deepEqual(captured.settings, { theme: 'dark' });
  assert.equal(captured.focusNode, 'A');
  assert.deepEqual(captured.peerContext, [{ role: 'peer' }]);
  assert.equal(
    events.some((ev) => ev.type === 'phase' && ev.id === 'intent'),
    true
  );
});

test('runAgentStream analyze emits phase and forwards uiLocale', async () => {
  let captured;
  const service = createLazyAgentService(
    baseConfig({
      analyzeExtraFields: ['diagramSource'],
      buildService: () => ({
        async applyAnalyzeIntent(input) {
          captured = input;
          return { message: 'Looks fine.' };
        }
      })
    })
  );

  const events = [];
  const result = await service.runAgentStream(
    'analyze',
    {
      kind: 'critique',
      focusNode: 'B',
      uiLocale: 'en',
      diagramSource: 'flowchart TD',
      contentType: 'mermaid'
    },
    (ev) => events.push(ev)
  );

  assert.equal(result.message, 'Looks fine.');
  assert.equal(captured.uiLocale, 'en');
  assert.equal(captured.kind, 'critique');
  assert.equal(captured.diagramSource, 'flowchart TD');
  assert.equal(
    events.some((ev) => ev.type === 'phase' && ev.id === 'analyze'),
    true
  );
  assert.equal(
    events.some((ev) => ev.type === 'final'),
    true
  );
});

test('optional invoke and applyStyleIntent are wired only when configured', async () => {
  const withBoth = createLazyAgentService(
    baseConfig({
      supportsInvoke: true,
      supportsStyleIntent: true,
      buildService: () => ({
        async invoke(input) {
          return { message: `invoke:${input.prompt}` };
        },
        async applyStyleIntent(input) {
          return { message: `style:${input.prompt}` };
        }
      })
    })
  );

  assert.equal(typeof withBoth.invoke, 'function');
  assert.equal(typeof withBoth.applyStyleIntent, 'function');
  assert.equal((await withBoth.invoke({ prompt: 'x' })).message, 'invoke:x');
  assert.equal((await withBoth.applyStyleIntent({ prompt: 'dark' })).message, 'style:dark');

  const without = createLazyAgentService(baseConfig({ buildService: () => ({}) }));
  assert.equal(without.invoke, undefined);
  assert.equal(without.applyStyleIntent, undefined);
});
