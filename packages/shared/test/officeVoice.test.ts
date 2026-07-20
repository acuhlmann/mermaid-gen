import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICE_TTS_CHUNK_MAX_CHARS,
  OFFICE_TTS_RATE_SCALE,
  chunkOfficeNarrationText,
  scaleSpeakingRate,
  CLOUD_TTS_RATE_RANGE
} from '../src/officeVoice.js';

test('OFFICE_TTS_RATE_SCALE lifts the cast above real-time', () => {
  assert.ok(OFFICE_TTS_RATE_SCALE > 1);
});

test('chunkOfficeNarrationText keeps short lines intact', () => {
  assert.deepEqual(chunkOfficeNarrationText('Hello world.'), ['Hello world.']);
});

test('chunkOfficeNarrationText splits on sentence boundaries', () => {
  const text = 'First sentence is here. Second sentence follows. Third wraps up the thought.';
  const chunks = chunkOfficeNarrationText(text, 40);
  assert.equal(chunks.length, 3);
  assert.equal(chunks.join(' '), text);
});

test('chunkOfficeNarrationText hard-splits overlong sentences', () => {
  const long = 'a'.repeat(OFFICE_TTS_CHUNK_MAX_CHARS + 120);
  const chunks = chunkOfficeNarrationText(long, OFFICE_TTS_CHUNK_MAX_CHARS);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.length <= OFFICE_TTS_CHUNK_MAX_CHARS));
  assert.equal(chunks.join(''), long);
});

test('scaleSpeakingRate applies the global multiplier', () => {
  const scaled = scaleSpeakingRate(0.95, CLOUD_TTS_RATE_RANGE);
  assert.ok(Math.abs(scaled - 0.95 * OFFICE_TTS_RATE_SCALE) < 1e-9);
});
