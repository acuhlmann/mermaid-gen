import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiagramAgentDispatcher } from '../src/agents/diagramAgentDispatcher.js';
import { createLabeledAgentStub } from './helpers/mockAgentService.js';

function stubDispatcherServices(dispatcher) {
  for (const [slot, service] of Object.entries(dispatcher._services)) {
    const stub = createLabeledAgentStub(slot);
    service.applyIntent = stub.applyIntent;
    service.applyTransformIntent = stub.applyTransformIntent;
    service.applyAnalyzeIntent = stub.applyAnalyzeIntent;
    service.applyStyleIntent = stub.applyStyleIntent;
    service.runAgentStream = stub.runAgentStream;
  }
}

test('createDiagramAgentDispatcher routes applyIntent by contentType', async () => {
  const dispatcher = createDiagramAgentDispatcher({ stateStore: {}, env: {} });
  stubDispatcherServices(dispatcher);

  const cases = [
    ['mermaid', 'mermaid'],
    ['infographic', 'infographic'],
    ['metaphor3d', 'metaphor3d'],
    ['chart', 'chart'],
    ['anything', 'anything'],
    ['forms', 'forms'],
    [undefined, 'mermaid']
  ];

  for (const [contentType, expectedLabel] of cases) {
    const result = await dispatcher.applyIntent({ contentType, prompt: 'go' });
    assert.equal(result.message, `${expectedLabel}:intent`, `contentType=${contentType}`);
    assert.equal(result.contentType, contentType);
  }
});

test('applyStyleIntent routes chart to chart service and everything else to mermaid', async () => {
  const dispatcher = createDiagramAgentDispatcher({ stateStore: {}, env: {} });
  stubDispatcherServices(dispatcher);

  const chart = await dispatcher.applyStyleIntent({ contentType: 'chart', prompt: 'dark' });
  assert.equal(chart.message, 'chart:style');

  const mermaid = await dispatcher.applyStyleIntent({ contentType: 'infographic', prompt: 'dark' });
  assert.equal(mermaid.message, 'mermaid:style');
});

test('runAgentStream forwards to the slot service', async () => {
  const dispatcher = createDiagramAgentDispatcher({ stateStore: {}, env: {} });
  stubDispatcherServices(dispatcher);

  const events = [];
  const result = await dispatcher.runAgentStream(
    'jared',
    { contentType: 'forms', prompt: 'review' },
    (ev) => events.push(ev)
  );

  assert.equal(result.message, 'forms:stream');
  assert.deepEqual(events, [{ type: 'status', message: 'forms:jared' }]);
});
