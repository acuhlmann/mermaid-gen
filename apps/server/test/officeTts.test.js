import test from 'node:test';
import assert from 'node:assert/strict';
import { OFFICE_SPEAKER_IDS, OFFICE_TTS_RATE_SCALE } from '@archislop/shared';
import {
  _resetOfficeTtsForTests,
  _VOICES_BY_LANG,
  _NEURAL2_VOICE_NAMES,
  _CHIRP3_VOICE_ROSTER,
  _CHIRP3_ACCENT_LANG,
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
  // Unknown speakers fall back to the gilfoyle persona, still on Chirp3-HD.
  assert.equal(resolveOfficeTtsVoice('nobody', 'en-US').name, 'en-US-Chirp3-HD-Schedar');
});

test('zh-CN resolves to Chirp3-HD (the whole point of the migration)', () => {
  // Neural2 ships no cmn-* voices; Chirp3-HD ships cmn-CN, so zh-CN is no longer
  // stuck on WaveNet under the default tier — it gets the newest voices like en.
  const cn = resolveOfficeTtsVoice('intern', 'zh-CN');
  assert.equal(cn.name, 'cmn-CN-Chirp3-HD-Puck');
  assert.equal(cn.languageCode, 'cmn-CN');
  assert.equal(cn.engine, 'chirp3');
});

test('zh-TW skips Chirp3-HD entirely — Google publishes no cmn-TW voices', () => {
  // Verified against listVoices: Chirp3-HD covers cmn-CN and yue-HK only, and
  // cmn-TW has nothing above WaveNet. Offering a Chirp rung here only bought a
  // guaranteed-to-fail request plus a warning log on every single line.
  const tw = resolveOfficeTtsVoice('intern', 'zh-TW');
  assert.equal(tw.engine, 'wavenet');
  assert.equal(tw.name, 'cmn-TW-Wavenet-B');
  assert.deepEqual(
    resolveOfficeTtsVoiceCandidates('intern', 'zh-TW').map((v) => v.engine),
    ['wavenet']
  );
});

test('a speaker accent override swaps the English locale, not the voice', () => {
  // Chirp3 voice names are locale-independent, so the same `Iapetus` under a
  // different English locale changes only the accent — the mechanism behind
  // Dinesh's South Asian accent.
  const us = resolveOfficeTtsVoice('dinesh', 'en-US');
  assert.equal(us.name, 'en-IN-Chirp3-HD-Iapetus');
  assert.equal(us.languageCode, 'en-IN');
  // Applies under every English locale — accent is a character trait, so it does
  // not follow the UI locale around.
  assert.equal(resolveOfficeTtsVoice('dinesh', 'en-AU').name, 'en-IN-Chirp3-HD-Iapetus');
  // Speakers without an override are untouched.
  assert.equal(resolveOfficeTtsVoice('jared', 'en-US').name, 'en-US-Chirp3-HD-Umbriel');
});

test('accent overrides never leak out of English', () => {
  // The whole point of the English guard: under zh-CN, Dinesh speaks Mandarin.
  // An en-IN voice here would make him speak accented English to a Chinese user.
  const cn = resolveOfficeTtsVoice('dinesh', 'zh-CN');
  assert.equal(cn.languageCode, 'cmn-CN');
  assert.equal(cn.name, 'cmn-CN-Chirp3-HD-Iapetus');
  // zh-TW has no Chirp rung at all, so it lands on WaveNet regardless.
  assert.equal(resolveOfficeTtsVoice('dinesh', 'zh-TW').engine, 'wavenet');
});

test('every accent override targets a real speaker and an English locale', () => {
  for (const [speaker, lang] of Object.entries(_CHIRP3_ACCENT_LANG)) {
    assert.ok(OFFICE_SPEAKER_IDS.includes(speaker), `${speaker} is not a canonical speaker id`);
    assert.ok(lang.startsWith('en-'), `${speaker} override ${lang} is not an English locale`);
  }
});

test('the cast no longer collapses onto a handful of shared voices', () => {
  // Regression guard for the collision that made characters indistinguishable.
  // Chirp3 drops `pitch`, so speakers sharing a voice differ only by rate — this
  // started at 8 voices for 16 speakers with `Charon` serving five of them.
  const counts = new Map();
  for (const voice of Object.values(_CHIRP3_VOICE_ROSTER)) {
    counts.set(voice, (counts.get(voice) ?? 0) + 1);
  }
  const worst = Math.max(...counts.values());
  assert.ok(worst <= 2, `a Chirp3 voice is shared by ${worst} speakers; 30 voices are available`);
  assert.ok(counts.size >= 12, `only ${counts.size} distinct voices across the cast`);
});

test('barker and belson share a voice but not a tempo', () => {
  // The one collision that is deliberate. Both were picked by ear onto
  // `Rasalgethi`, and with pitch unavailable on Chirp3 the rate gap is the ONLY
  // thing telling them apart — which matters because they are the two execs and
  // are drawn into the same steering meetings (MEETING_SENIOR_POOL), so they
  // routinely speak back to back.
  //
  // Scoped to this pair on purpose. Three older collisions predate this work and
  // are NOT yet separated — ciso/helpdesk (1.05x), cfo/scrumMaster (1.09x) and
  // erlich/facilities (1.13x) all share a voice at near-identical rates. They
  // need an audition round before a global guard can be asserted honestly.
  assert.equal(_CHIRP3_VOICE_ROSTER.barker, _CHIRP3_VOICE_ROSTER.belson);
  const barker = _VOICES_BY_LANG['en-US'].barker.speakingRate;
  const belson = _VOICES_BY_LANG['en-US'].belson.speakingRate;
  const spread = Math.max(barker, belson) / Math.min(barker, belson);
  assert.ok(spread >= 1.3, `barker/belson rate spread is only ${spread.toFixed(2)}x`);
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
    assert.ok(rate('greybeard') < rate('gilfoyle'), `${locale}: greybeard should stay slowest`);
    assert.ok(rate('gilfoyle') < rate('russ'), `${locale}: russ should stay fastest`);
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
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
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
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
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
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
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
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
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
  const args = { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' };
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
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
    env,
    { client }
  );
  assert.ok(first?.audioBase64);
  assert.equal(first.mimeType, 'audio/mpeg');
  assert.equal(first.voiceName, 'en-US-Chirp3-HD-Orus');
  const second = await synthesizeOfficeSpeech(
    { speakerId: 'greybeard', text: 'We tried that in 1979.', lang: 'en-US' },
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
