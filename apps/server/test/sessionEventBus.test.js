import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionEventBus } from '../src/state/sessionEventBus.js';

test('publish notifies only subscribers of the same sessionId', () => {
  const bus = createSessionEventBus();
  const received = [];
  bus.subscribe('A', (e) => received.push(['A', e]));
  bus.subscribe('B', (e) => received.push(['B', e]));
  bus.publish('A', { type: 'ping' });
  assert.equal(received.length, 1);
  assert.equal(received[0][0], 'A');
  assert.equal(received[0][1].type, 'ping');
  assert.ok(received[0][1].at, 'envelope stamped with at');
  assert.equal(received[0][1].seq, 1);
  assert.equal(received[0][1].eventId, '1');
});

test('unsubscribe stops further deliveries', () => {
  const bus = createSessionEventBus();
  const events = [];
  const off = bus.subscribe('S', (e) => events.push(e));
  bus.publish('S', { type: 'a' });
  off();
  bus.publish('S', { type: 'b' });
  assert.equal(events.length, 1);
});

test('listener errors do not poison sibling listeners or the publisher', () => {
  const bus = createSessionEventBus();
  bus.subscribe('X', () => {
    throw new Error('boom');
  });
  let secondCalled = false;
  bus.subscribe('X', () => {
    secondCalled = true;
  });
  bus.publish('X', { type: 'ok' });
  assert.equal(secondCalled, true);
});

test('getHistory returns events after sinceSeq and respects ring buffer cap', () => {
  const bus = createSessionEventBus({ maxHistoryPerSession: 3 });
  bus.publish('H', { type: 'e1' });
  bus.publish('H', { type: 'e2' });
  bus.publish('H', { type: 'e3' });
  bus.publish('H', { type: 'e4' });

  const all = bus.getHistory('H');
  assert.equal(all.length, 3);
  assert.equal(all[0].type, 'e2');
  assert.equal(all[2].type, 'e4');

  const tail = bus.getHistory('H', { sinceSeq: 3 });
  assert.deepEqual(
    tail.map((e) => e.type),
    ['e4']
  );
});

test('publish without subscribers still appends to history for replay', () => {
  const bus = createSessionEventBus();
  const envelope = bus.publish('solo', { type: 'queued' });
  assert.equal(envelope.seq, 1);
  const replay = bus.getHistory('solo', { sinceSeq: 0 });
  assert.equal(replay.length, 1);
  assert.equal(replay[0].type, 'queued');
});

test('getSessionMeta reports latestSeq and bufferedCount', () => {
  const bus = createSessionEventBus();
  assert.deepEqual(bus.getSessionMeta('empty'), {
    latestSeq: 0,
    bufferedCount: 0,
    oldestSeq: 0
  });
  bus.publish('M', { type: 'a' });
  bus.publish('M', { type: 'b' });
  assert.deepEqual(bus.getSessionMeta('M'), {
    latestSeq: 2,
    oldestSeq: 1,
    bufferedCount: 2
  });
});

test('parseSinceSeq accepts numbers and rejects invalid values', () => {
  const bus = createSessionEventBus();
  assert.equal(bus.parseSinceSeq('12'), 12);
  assert.equal(bus.parseSinceSeq(7), 7);
  assert.equal(bus.parseSinceSeq(''), 0);
  assert.equal(bus.parseSinceSeq('nope'), 0);
  assert.equal(bus.parseSinceSeq(-3), 0);
});
