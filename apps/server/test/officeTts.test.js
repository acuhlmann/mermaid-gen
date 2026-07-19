import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_SPEAKER_IDS, OFFICE_TTS_RATE_SCALE } from '@archislop/shared';
import {
  _resetOfficeTtsForTests,
  _VOICES_BY_LANG,
  _NEURAL2_VOICE_NAMES,
  _CHIRP3_VOICE_ROSTER,
  isOfficeTtsEnabled,
  normalizeOfficeTtsLang,
  resolveOfficeTtsRateScale,
  resolveOfficeTtsVoiceTier,
  resolveOfficeTtsVoice,
  resolveOfficeTtsVoiceCandidates,
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

test('resolveOfficeTtsVoice defaults to Chirp3-HD names for every locale', () => {
  const pam = resolveOfficeTtsVoice('scrumMaster', 'en-US');
  assert.equal(pam.name, 'en-US-Chirp3-HD-Kore');
  assert.equal(pam.languageCode, 'en-US');
  assert.equal(pam.engine, 'chirp3');
  assert.equal(resolveOfficeTtsVoice('greybeard', 'en-AU').name, 'en-AU-Chirp3-HD-Orus');
  // Unknown speakers fall back to the refine persona, still on Chirp3-HD.
  assert.equal(resolveOfficeTtsVoice('nobody', 'en-US').name, 'en-US-Chirp3-HD-Puck');
});

test('Chinese finally resolves to Chirp3-HD (the whole point of the migration)', () => {
  // Neural2 ships no cmn-* voices; Chirp3-HD does, so zh is no longer stuck on
  // WaveNet under the default tier — it gets the newest voices like en does.
  const cn = resolveOfficeTtsVoice('intern', 'zh-CN');
  assert.equal(cn.name, 'cmn-CN-Chirp3-HD-Puck');
  assert.equal(cn.languageCode, 'cmn-CN');
  assert.equal(cn.engine, 'chirp3');
  assert.equal(resolveOfficeTtsVoice('intern', 'zh-TW').name, 'cmn-TW-Chirp3-HD-Puck');
});

test('OFFICE_TTS_VOICE_TIER=neural2 pins the Neural2 top of the ladder', () => {
  const env = { OFFICE_TTS_VOICE_TIER: 'neural2' };
  assert.equal(resolveOfficeTtsVoice('scrumMaster', 'en-US', env).name, 'en-US-Neural2-F');
  assert.equal(resolveOfficeTtsVoice('greybeard', 'en-AU', env).name, 'en-AU-Neural2-B');
  // zh has no Neural2 — under the neural2 tier it falls straight to WaveNet.
  assert.ok(resolveOfficeTtsVoice('intern', 'zh-CN', env).name.startsWith('cmn-CN-Wavenet-'));
});

test('OFFICE_TTS_VOICE_TIER=wavenet restores the WaveNet cast everywhere', () => {
  const env = { OFFICE_TTS_VOICE_TIER: 'wavenet' };
  assert.equal(resolveOfficeTtsVoice('scrumMaster', 'en-US', env).name, 'en-US-Wavenet-F');
  assert.ok(resolveOfficeTtsVoice('greybeard', 'en-AU', env).name.startsWith('en-AU-Wavenet-'));
  assert.ok(resolveOfficeTtsVoice('intern', 'zh-CN', env).name.startsWith('cmn-CN-Wavenet-'));
});

test('resolveOfficeTtsVoiceCandidates walks Chirp3 → Neural2 → WaveNet', () => {
  const en = resolveOfficeTtsVoiceCandidates('greybeard', 'en-US');
  assert.deepEqual(
    en.map((v) => v.engine),
    ['chirp3', 'neural2', 'wavenet']
  );
  assert.equal(en[0].name, 'en-US-Chirp3-HD-Orus');
  assert.equal(en[1].name, 'en-US-Neural2-I');
  assert.equal(en[2].name, 'en-US-Wavenet-I');
  // zh drops the Neural2 rung it has no voice for.
  const cn = resolveOfficeTtsVoiceCandidates('greybeard', 'zh-CN');
  assert.deepEqual(
    cn.map((v) => v.engine),
    ['chirp3', 'wavenet']
  );
  // Pinning wavenet collapses the ladder to a single rung.
  const pinned = resolveOfficeTtsVoiceCandidates('greybeard', 'en-US', {
    OFFICE_TTS_VOICE_TIER: 'wavenet'
  });
  assert.deepEqual(
    pinned.map((v) => v.engine),
    ['wavenet']
  );
});

test('resolveOfficeTtsVoiceTier honours explicit values only', () => {
  assert.equal(resolveOfficeTtsVoiceTier({}), OFFICE_TTS_DEFAULT_TIER);
  assert.equal(OFFICE_TTS_DEFAULT_TIER, 'chirp3');
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'wavenet' }), 'wavenet');
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: ' Neural2 ' }), 'neural2');
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'chirp3' }), 'chirp3');
  // Bare `chirp` is accepted as an alias for chirp3.
  assert.equal(resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'CHIRP' }), 'chirp3');
  // Anything else falls back to the default.
  assert.equal(
    resolveOfficeTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'bogus' }),
    OFFICE_TTS_DEFAULT_TIER
  );
});

test('the Chirp3-HD roster covers exactly the canonical speaker ids', () => {
  assert.deepEqual(
    Object.keys(_CHIRP3_VOICE_ROSTER).sort(),
    [...OFFICE_SPEAKER_IDS].sort(),
    'Chirp3-HD roster drifted from OFFICE_SPEAKER_IDS'
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

test('synthesizeOfficeSpeech sends the scaled rate (and pitch) under the neural2 tier', async () => {
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
    {
      VERTEX_PROJECT_ID: 'mermaidgen',
      OFFICE_TTS_RATE_SCALE: '1.25',
      OFFICE_TTS_VOICE_TIER: 'neural2'
    },
    { client }
  );
  const authored = _VOICES_BY_LANG['en-US'].greybeard;
  assert.equal(request.audioConfig.audioEncoding, 'MP3');
  assert.ok(Math.abs(request.audioConfig.speakingRate - authored.speakingRate * 1.25) < 1e-9);
  assert.equal(request.audioConfig.pitch, authored.pitch);
  assert.equal(request.voice.name, 'en-US-Neural2-I');
});

test('synthesizeOfficeSpeech defaults to Chirp3-HD and drops pitch (unsupported)', async () => {
  /** @type {any} */
  let request = null;
  const client = {
    async synthesizeSpeech(req) {
      request = req;
      return [{ audioContent: Buffer.from('fake-mp3-bytes') }];
    }
  };
  const result = await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' },
    { VERTEX_PROJECT_ID: 'mermaidgen', OFFICE_TTS_RATE_SCALE: '1.25' },
    { client }
  );
  const authored = _VOICES_BY_LANG['en-US'].greybeard;
  assert.equal(request.voice.name, 'en-US-Chirp3-HD-Orus');
  assert.equal(request.audioConfig.audioEncoding, 'MP3');
  assert.ok(Math.abs(request.audioConfig.speakingRate - authored.speakingRate * 1.25) < 1e-9);
  // Chirp3-HD rejects pitch, so it must never be sent for the Chirp tier.
  assert.equal(Object.prototype.hasOwnProperty.call(request.audioConfig, 'pitch'), false);
  assert.equal(result?.voiceName, 'en-US-Chirp3-HD-Orus');
});

test('synthesizeOfficeSpeech falls back down the ladder when a tier fails', async () => {
  /** @type {any[]} */
  const requests = [];
  const client = {
    async synthesizeSpeech(req) {
      requests.push(req);
      // Chirp3-HD (the first rung) fails; Neural2 answers.
      if (req.voice.name.includes('Chirp3-HD')) throw new Error('chirp unavailable');
      return [{ audioContent: Buffer.from('fake-mp3-bytes') }];
    }
  };
  const result = await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 2009.', lang: 'en-US' },
    { VERTEX_PROJECT_ID: 'mermaidgen' },
    { client }
  );
  assert.equal(requests.length, 2);
  assert.equal(requests[0].voice.name, 'en-US-Chirp3-HD-Orus');
  assert.equal(requests[1].voice.name, 'en-US-Neural2-I');
  // The result records whichever engine actually answered.
  assert.equal(result?.voiceName, 'en-US-Neural2-I');
  // Neural2 kept its pitch fingerprint on the successful rung.
  assert.equal(requests[1].audioConfig.pitch, _VOICES_BY_LANG['en-US'].greybeard.pitch);
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
  const chirp = await synthesizeOfficeSpeech(args, baseEnv, { client });
  const wave = await synthesizeOfficeSpeech(
    args,
    { ...baseEnv, OFFICE_TTS_VOICE_TIER: 'wavenet' },
    { client }
  );
  assert.equal(chirp?.voiceName, 'en-US-Chirp3-HD-Orus');
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
  assert.equal(first.voiceName, 'en-US-Chirp3-HD-Orus');
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
