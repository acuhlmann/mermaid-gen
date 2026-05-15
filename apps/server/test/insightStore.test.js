import test from 'node:test';
import assert from 'node:assert/strict';
import { createInsightStore } from '../src/state/insightStore.js';

test('insightStore append and list newest first', () => {
  const store = createInsightStore({ maxItems: 3 });
  store.append({ insightId: 'a', variant: 'note', text: 'one' });
  store.append({ insightId: 'b', variant: 'critique', text: 'two' });
  const listed = store.list({ limit: 10 });
  assert.equal(listed.length, 2);
  assert.equal(listed[0].insightId, 'b');
  assert.equal(listed[1].insightId, 'a');
});

test('insightStore rings buffer at maxItems', () => {
  const store = createInsightStore({ maxItems: 2 });
  store.append({ insightId: '1', variant: 'note', text: '1' });
  store.append({ insightId: '2', variant: 'note', text: '2' });
  store.append({ insightId: '3', variant: 'note', text: '3' });
  const listed = store.list();
  assert.equal(listed.length, 2);
  assert.equal(listed[0].insightId, '3');
  assert.equal(listed[1].insightId, '2');
});

test('insightStore filters by variant', () => {
  const store = createInsightStore();
  store.append({ insightId: 'a', variant: 'note', text: 'n' });
  store.append({ insightId: 'b', variant: 'critique', text: 'c' });
  const critiques = store.list({ variant: 'critique' });
  assert.equal(critiques.length, 1);
  assert.equal(critiques[0].insightId, 'b');
});
