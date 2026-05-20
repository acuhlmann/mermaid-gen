import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createAgentStreamEmitter } from '../src/agentStreamEmitter.js';
import {
  AGUI_CUSTOM_NAME_A2UI,
  AGUI_CUSTOM_NAME_ARTIFACT,
  AGUI_CUSTOM_NAME_PLAN_BEAT,
  AGUI_STATE_PATH_LAST_PATCH_SUMMARY,
  LEGACY_STREAM_TYPE_A2UI,
  LEGACY_STREAM_TYPE_PLAN_BEAT
} from '../src/agUiWireConstants.js';
import { isLegacyStreamEvent, type LegacyStreamEvent } from '../src/legacyStreamEvents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/wire/legacy-events.json'), 'utf8')
) as Record<string, LegacyStreamEvent>;

function fixture(name: string): LegacyStreamEvent {
  const evt = FIXTURES[name];
  assert.ok(evt, `missing fixture ${name}`);
  return evt;
}

function emitLegacyToWire(legacy: LegacyStreamEvent, contentType = 'mermaid') {
  const wire: Array<Record<string, unknown>> = [];
  const emit = createAgentStreamEmitter({
    rawEmit: (e) => wire.push(e as Record<string, unknown>),
    threadId: 'thr_fixture',
    runId: 'run_fixture',
    contentType
  });
  emit(legacy);
  return wire;
}

test('wire fixtures: golden legacy events are well-formed', () => {
  for (const [name, evt] of Object.entries(FIXTURES)) {
    assert.ok(isLegacyStreamEvent(evt), `fixture ${name} should be a legacy stream event`);
  }
});

test('wire round-trip: plan_beat legacy → CUSTOM → legacy shape', () => {
  for (const key of ['plan_beat_server', 'plan_beat_agent'] as const) {
    const legacy = fixture(key);
    if (legacy.type !== LEGACY_STREAM_TYPE_PLAN_BEAT) throw new Error('fixture type');
    const wire = emitLegacyToWire(legacy);
    assert.equal(wire.length, 1);
    assert.equal(wire[0].type, 'CUSTOM');
    assert.equal(wire[0].name, AGUI_CUSTOM_NAME_PLAN_BEAT);
    const value = wire[0].value as { text: string; source: string };
    assert.equal(value.text, legacy.text);
    assert.equal(value.source, legacy.source === 'agent' ? 'agent' : 'server');
  }
});

test('wire round-trip: patch_summary legacy → STATE_DELTA path', () => {
  const legacy = FIXTURES.patch_summary;
  if (legacy.type !== 'artifact' || legacy.kind !== 'patch_summary') throw new Error('fixture kind');
  const wire = emitLegacyToWire(legacy);
  assert.equal(wire.length, 1);
  assert.equal(wire[0].type, 'STATE_DELTA');
  const delta = wire[0].delta as Array<{ path: string; value?: unknown }>;
  const summary = delta.find((op) => op.path === AGUI_STATE_PATH_LAST_PATCH_SUMMARY);
  assert.ok(summary?.value);
  const v = summary!.value as { revisionId: number; linesAdded: number; linesRemoved: number };
  assert.equal(v.revisionId, legacy.revisionId);
  assert.equal(v.linesAdded, legacy.linesAdded);
  assert.equal(v.linesRemoved, legacy.linesRemoved);
});

test('wire round-trip: a2ui legacy → CUSTOM a2ui', () => {
  const legacy = fixture('a2ui_critique_minimal');
  if (legacy.type !== LEGACY_STREAM_TYPE_A2UI) throw new Error('fixture type');
  const wire = emitLegacyToWire(legacy);
  assert.equal(wire.length, 1);
  assert.equal(wire[0].type, 'CUSTOM');
  assert.equal(wire[0].name, AGUI_CUSTOM_NAME_A2UI);
  assert.deepEqual((wire[0].value as { messages: unknown[] }).messages, legacy.messages);
});

test('wire round-trip: explain_sections and style_edits artifact CUSTOM payloads', () => {
  for (const key of ['explain_sections', 'style_edits'] as const) {
    const legacy = fixture(key);
    if (legacy.type !== 'artifact') throw new Error('fixture type');
    const wire = emitLegacyToWire(legacy);
    assert.equal(wire.length, 1);
    assert.equal(wire[0].type, 'CUSTOM');
    assert.equal(wire[0].name, AGUI_CUSTOM_NAME_ARTIFACT);
    const value = wire[0].value as { kind: string };
    assert.equal(value.kind, legacy.kind);
  }
});
