import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _resetOfficeTtsForTests,
  isOfficeTtsEnabled,
  normalizeOfficeTtsLang,
  resolveOfficeTtsVoice,
  sanitizeOfficeTtsText,
  synthesizeOfficeSpeech,
  OFFICE_TTS_MAX_CHARS
} from '../src/agents/officeTts.js';

test.afterEach(() => {
  _resetOfficeTtsForTests();
});

test('isOfficeTtsEnabled respects kill switch and project id', () => {
  assert.equal(isOfficeTtsEnabled({ OFFICE_TTS: '0', VERTEX_PROJECT_ID: 'p' }), false);
  assert.equal(isOfficeTtsEnabled({ OFFICE_TTS: 'false', VERTEX_PROJECT_ID: 'p' }), false);
  assert.equal(isOfficeTtsEnabled({ VERTEX_PROJECT_ID: 'mermaidgen' }), true);
  assert.equal(isOfficeTtsEnabled({}), false);
});

test('normalizeOfficeTtsLang maps UI locales onto voice tables', () => {
  assert.equal(normalizeOfficeTtsLang('en-AU'), 'en-AU');
  assert.equal(normalizeOfficeTtsLang('zh-CN'), 'zh-CN');
  assert.equal(normalizeOfficeTtsLang('zh-TW'), 'zh-TW');
  assert.equal(normalizeOfficeTtsLang('en'), 'en-US');
  assert.equal(normalizeOfficeTtsLang(undefined), 'en-US');
});

test('resolveOfficeTtsVoice picks WaveNet names per cast and locale', () => {
  const pam = resolveOfficeTtsVoice('scrumMaster', 'en-US');
  assert.equal(pam.name, 'en-US-Wavenet-F');
  assert.equal(pam.languageCode, 'en-US');
  const ulrichAu = resolveOfficeTtsVoice('greybeard', 'en-AU');
  assert.ok(ulrichAu.name.startsWith('en-AU-Wavenet-'));
  const chadZh = resolveOfficeTtsVoice('intern', 'zh-CN');
  assert.ok(chadZh.name.startsWith('cmn-CN-Wavenet-'));
});

test('sanitizeOfficeTtsText strips emoji and caps length', () => {
  assert.equal(sanitizeOfficeTtsText('  Hello 🧃 world  '), 'Hello world');
  const long = 'x'.repeat(OFFICE_TTS_MAX_CHARS + 40);
  const clipped = sanitizeOfficeTtsText(long);
  assert.ok(clipped.length <= OFFICE_TTS_MAX_CHARS);
  assert.ok(clipped.endsWith('…'));
});

test('synthesizeOfficeSpeech returns null when disabled', async () => {
  const audio = await synthesizeOfficeSpeech(
    { speakerId: 'intern', text: 'hi' },
    { OFFICE_TTS: '0', VERTEX_PROJECT_ID: 'p' }
  );
  assert.equal(audio, null);
});

test('synthesizeOfficeSpeech uses the injected client and caches', async () => {
  let calls = 0;
  const client = {
    async synthesizeSpeech() {
      calls += 1;
      return [{ audioContent: Buffer.from('fake-mp3-bytes') }];
    }
  };
  const env = { VERTEX_PROJECT_ID: 'mermaidgen' };
  const first = await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' },
    env,
    { client }
  );
  assert.ok(first?.audioBase64);
  assert.equal(first.mimeType, 'audio/mpeg');
  assert.equal(first.voiceName, 'en-US-Wavenet-I');
  const second = await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' },
    env,
    { client }
  );
  assert.equal(second.audioBase64, first.audioBase64);
  assert.equal(calls, 1);
});

test('synthesizeOfficeSpeech degrades to null when the client throws', async () => {
  const client = {
    async synthesizeSpeech() {
      throw new Error('ADC missing');
    }
  };
  const audio = await synthesizeOfficeSpeech(
    { speakerId: 'hr', text: 'Friendly nudge!' },
    { VERTEX_PROJECT_ID: 'mermaidgen' },
    { client }
  );
  assert.equal(audio, null);
});
