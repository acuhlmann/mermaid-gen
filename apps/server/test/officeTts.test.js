import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_SPEAKER_IDS, OFFICE_TTS_RATE_SCALE } from '@archislop/shared';
import {
  _resetOfficeTtsForTests,
  _VOICES_BY_LANG,
  _NEURAL2_VOICE_NAMES,
  isOfficeTtsEnabled,
  normalizeOfficeTtsLang,
  resolveOfficeTtsRateScale,
  resolveOfficeTtsVoiceTier,
  resolveOfficeTtsVoice,
  sanitizeOfficeTtsText,
  synthesizeOfficeSpeech,
  OFFICE_TTS_MAX_CHARS,
  OFFICE_TTS_DEFAULT_TIER
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

test('resolveOfficeTtsVoice defaults to Neural2 names for en locales', () => {
  const pam = resolveOfficeTtsVoice('scrumMaster', 'en-US');
  assert.equal(pam.name, 'en-US-Neural2-F');
  assert.equal(pam.languageCode, 'en-US');
  const ulrichAu = resolveOfficeTtsVoice('greybeard', 'en-AU');
  assert.equal(ulrichAu.name, 'en-AU-Neural2-B');
  // en-US has no Neural2-B: the two Wavenet-B personas remap to other males.
  assert.equal(resolveOfficeTtsVoice('helpdesk', 'en-US').name, 'en-US-Neural2-J');
  assert.equal(resolveOfficeTtsVoice('critique', 'en-US').name, 'en-US-Neural2-A');
  // Unknown speakers fall back to the refine persona, still on Neural2.
  assert.equal(resolveOfficeTtsVoice('nobody', 'en-US').name, 'en-US-Neural2-D');
});

test('OFFICE_TTS_VOICE_TIER=wavenet restores the WaveNet cast everywhere', () => {
  const env = { OFFICE_TTS_VOICE_TIER: 'wavenet' };
  assert.equal(resolveOfficeTtsVoice('scrumMaster', 'en-US', env).name, 'en-US-Wavenet-F');
  assert.ok(resolveOfficeTtsVoice('greybeard', 'en-AU', env).name.startsWith('en-AU-Wavenet-'));
  assert.ok(resolveOfficeTtsVoice('intern', 'zh-CN', env).name.startsWith('cmn-CN-Wavenet-'));
});

test('zh locales stay on WaveNet even under the neural2 tier', () => {
  // Google ships no Neural2 cmn-* voices; cmn-TW has nothing above WaveNet.
  assert.ok(resolveOfficeTtsVoice('intern', 'zh-CN').name.startsWith('cmn-CN-Wavenet-'));
  assert.ok(resolveOfficeTtsVoice('intern', 'zh-TW').name.startsWith('cmn-TW-Wavenet-'));
});

test('resolveOfficeTtsVoiceTier honours explicit values only', () => {
  assert.equal(resolveOfficeTtsVoiceTier({}), OFFICE_TTS_DEFAULT_TIER);
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'wavenet' }), 'wavenet');
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: ' Neural2 ' }), 'neural2');
  assert.equal(
    resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'chirp3' }),
    OFFICE_TTS_DEFAULT_TIER
  );
});

test('every Neural2 overlay locale covers exactly the canonical speaker ids', () => {
  for (const [locale, names] of Object.entries(_NEURAL2_VOICE_NAMES)) {
    assert.deepEqual(
      Object.keys(names).sort(),
      [...OFFICE_SPEAKER_IDS].sort(),
      `${locale} Neural2 overlay drifted from OFFICE_SPEAKER_IDS`
    );
    for (const [id, name] of Object.entries(names)) {
      assert.ok(
        name.startsWith(`${locale}-Neural2-`),
        `${locale}/${id} not a Neural2 name: ${name}`
      );
    }
  }
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
  assert.equal(request.voice.name, 'en-US-Neural2-I');
});

test('synthesizeOfficeSpeech sends the WaveNet name under the wavenet tier', async () => {
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
    { VERTEX_PROJECT_ID: 'mermaidgen', OFFICE_TTS_VOICE_TIER: 'wavenet' },
    { client }
  );
  assert.equal(request.voice.name, 'en-US-Wavenet-I');
});

test('tiers cache separately because the voice name is in the key', async () => {
  let calls = 0;
  const client = {
    async synthesizeSpeech() {
      calls += 1;
      return [{ audioContent: Buffer.from('fake-mp3-bytes') }];
    }
  };
  const baseEnv = { VERTEX_PROJECT_ID: 'mermaidgen' };
  const args = { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' };
  const neural = await synthesizeOfficeSpeech(args, baseEnv, { client });
  const wave = await synthesizeOfficeSpeech(
    args,
    { ...baseEnv, OFFICE_TTS_VOICE_TIER: 'wavenet' },
    { client }
  );
  assert.equal(neural?.voiceName, 'en-US-Neural2-I');
  assert.equal(wave?.voiceName, 'en-US-Wavenet-I');
  assert.equal(calls, 2);
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
  assert.equal(first.voiceName, 'en-US-Neural2-I');
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
