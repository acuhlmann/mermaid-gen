import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_SPEAKER_IDS, OFFICE_TTS_RATE_SCALE } from '@archislop/shared';
import {
  _resetOfficeTtsForTests,
  _VOICES_BY_LANG,
  isOfficeTtsEnabled,
  normalizeOfficeTtsLang,
  resolveOfficeTtsRateScale,
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

test('every locale table covers exactly the canonical speaker ids', () => {
  for (const [locale, table] of Object.entries(_VOICES_BY_LANG)) {
    assert.deepEqual(
      Object.keys(table).sort(),
      [...OFFICE_SPEAKER_IDS].sort(),
      `${locale} voice table drifted from OFFICE_SPEAKER_IDS`
    );
  }
});

test('resolveOfficeTtsVoice applies the global rate scale', () => {
  const env = {};
  for (const locale of Object.keys(_VOICES_BY_LANG)) {
    for (const id of OFFICE_SPEAKER_IDS) {
      const authored = _VOICES_BY_LANG[locale][id].speakingRate;
      const resolved = resolveOfficeTtsVoice(id, locale, env);
      assert.ok(
        Math.abs(resolved.speakingRate - authored * OFFICE_TTS_RATE_SCALE) < 1e-9,
        `${locale}/${id} rate not scaled`
      );
      // Pitch is a separate fingerprint and must pass through untouched.
      assert.equal(resolved.pitch, _VOICES_BY_LANG[locale][id].pitch);
    }
  }
});

test('scaling preserves relative character fingerprints', () => {
  for (const locale of Object.keys(_VOICES_BY_LANG)) {
    const rate = (id) => resolveOfficeTtsVoice(id, locale, {}).speakingRate;
    assert.ok(rate('greybeard') < rate('refine'), `${locale}: greybeard should stay slowest`);
    assert.ok(rate('refine') < rate('goMad'), `${locale}: goMad should stay fastest`);
    // The whole cast should now sit in a plausible real-time band.
    for (const id of OFFICE_SPEAKER_IDS) {
      assert.ok(rate(id) > 0.85 && rate(id) < 1.35, `${locale}/${id} rate out of band`);
    }
  }
});

test('resolveOfficeTtsRateScale honours a valid env override only', () => {
  assert.equal(resolveOfficeTtsRateScale({}), OFFICE_TTS_RATE_SCALE);
  assert.equal(resolveOfficeTtsRateScale({ OFFICE_TTS_RATE_SCALE: '1.3' }), 1.3);
  assert.equal(resolveOfficeTtsRateScale({ OFFICE_TTS_RATE_SCALE: ' 0.9 ' }), 0.9);
  // Malformed / nonsensical values fall back rather than poisoning audioConfig.
  assert.equal(resolveOfficeTtsRateScale({ OFFICE_TTS_RATE_SCALE: 'fast' }), OFFICE_TTS_RATE_SCALE);
  assert.equal(resolveOfficeTtsRateScale({ OFFICE_TTS_RATE_SCALE: '0' }), OFFICE_TTS_RATE_SCALE);
  assert.equal(resolveOfficeTtsRateScale({ OFFICE_TTS_RATE_SCALE: '-2' }), OFFICE_TTS_RATE_SCALE);
});

test('synthesizeOfficeSpeech sends the scaled rate in audioConfig', async () => {
  /** @type {any} */
  let request = null;
  const client = {
    async synthesizeSpeech(req) {
      request = req;
      return [{ audioContent: Buffer.from('fake-mp3-bytes') }];
    }
  };
  await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' },
    { VERTEX_PROJECT_ID: 'mermaidgen', OFFICE_TTS_RATE_SCALE: '1.25' },
    { client }
  );
  const authored = _VOICES_BY_LANG['en-US'].greybeard;
  assert.equal(request.audioConfig.audioEncoding, 'MP3');
  assert.ok(Math.abs(request.audioConfig.speakingRate - authored.speakingRate * 1.25) < 1e-9);
  assert.equal(request.audioConfig.pitch, authored.pitch);
  assert.equal(request.voice.name, 'en-US-Wavenet-I');
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
