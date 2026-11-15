import test from 'node:test';
import assert from 'node:assert/strict';
import {
  _resetGodTtsForTests,
  isGodTtsEnabled,
  normalizeGodMood,
  resolveGodTtsVoice,
  resolveGodTtsVoiceCandidates,
  resolveGodTtsVoiceTier,
  sanitizeGodTtsText,
  synthesizeGodSpeech,
  GOD_TTS_MAX_CHARS
} from '../src/agents/godTts.js';

test.afterEach(() => {
  _resetGodTtsForTests();
});

const ENV = { VERTEX_PROJECT_ID: 'mermaidgen' };

test('isGodTtsEnabled follows the GCP project plus GOD_TTS / OFFICE_TTS kill switches', () => {
  assert.equal(isGodTtsEnabled(ENV), true);
  assert.equal(isGodTtsEnabled({}), false);
  assert.equal(isGodTtsEnabled({ ...ENV, GOD_TTS: '0' }), false);
  assert.equal(isGodTtsEnabled({ ...ENV, OFFICE_TTS: 'off' }), false);
  assert.equal(isGodTtsEnabled({ ...ENV, GOD_TTS: '1' }), true);
});

test('god speaks as Chirp3-HD Charon by default, slowest when wrathful', () => {
  const voice = resolveGodTtsVoice('amused', ENV);
  assert.equal(voice.name, 'en-US-Chirp3-HD-Charon');
  assert.equal(voice.engine, 'chirp3');
  assert.ok(resolveGodTtsVoice('wrathful', ENV).speakingRate < voice.speakingRate);
  assert.ok(resolveGodTtsVoice('smitten', ENV).speakingRate > voice.speakingRate);
  assert.equal(normalizeGodMood('bogus'), 'amused');
  assert.equal(normalizeGodMood(undefined), 'amused');
});

test('voice ladder is Chirp3-HD Charon → Neural2-J → WaveNet-J, pitch only below Chirp', async () => {
  const candidates = resolveGodTtsVoiceCandidates('wrathful', ENV);
  assert.deepEqual(
    candidates.map((v) => v.name),
    ['en-US-Chirp3-HD-Charon', 'en-US-Neural2-J', 'en-US-Wavenet-J']
  );

  let request = null;
  const client = {
    async synthesizeSpeech(req) {
      request = req;
      return [{ audioContent: Buffer.from('fake-mp3') }];
    }
  };
  await synthesizeGodSpeech({ text: 'BEHOLD.', mood: 'wrathful' }, ENV, { client });
  assert.equal(request.voice.name, 'en-US-Chirp3-HD-Charon');
  assert.equal(Object.prototype.hasOwnProperty.call(request.audioConfig, 'pitch'), false);
  assert.equal(request.audioConfig.speakingRate, candidates[0].speakingRate);
});

test('tier pins: GOD_TTS_VOICE_TIER wins over the office tier', () => {
  assert.equal(resolveGodTtsVoiceTier(ENV), 'chirp3');
  assert.equal(resolveGodTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'wavenet' }), 'wavenet');
  assert.equal(
    resolveGodTtsVoiceTier({ OFFICE_TTS_VOICE_TIER: 'wavenet', GOD_TTS_VOICE_TIER: 'neural2' }),
    'neural2'
  );
  assert.equal(
    resolveGodTtsVoice('amused', { GOD_TTS_VOICE_TIER: 'wavenet' }).name,
    'en-US-Wavenet-J'
  );
});

test('synthesizeGodSpeech falls back down the ladder and caches by voice+rate', async () => {
  const names = [];
  const client = {
    async synthesizeSpeech(req) {
      names.push(req.voice.name);
      if (req.voice.name.includes('Chirp3-HD')) throw new Error('chirp unavailable');
      return [{ audioContent: Buffer.from('fake-mp3') }];
    }
  };
  const first = await synthesizeGodSpeech({ text: 'THY TESTS PASS.', mood: 'amused' }, ENV, {
    client
  });
  assert.equal(first?.voiceName, 'en-US-Neural2-J');
  assert.deepEqual(names, ['en-US-Chirp3-HD-Charon', 'en-US-Neural2-J']);

  const second = await synthesizeGodSpeech({ text: 'THY TESTS PASS.', mood: 'amused' }, ENV, {
    client
  });
  assert.equal(second?.audioBase64, first?.audioBase64);
  assert.equal(names.length, 2, 'cached decree must not re-bill the API');
});

test('synthesizeGodSpeech returns null when disabled, empty, or every rung fails', async () => {
  assert.equal(await synthesizeGodSpeech({ text: 'HI' }, { GOD_TTS: '0', ...ENV }), null);
  assert.equal(await synthesizeGodSpeech({ text: '   ' }, ENV), null);
  const failing = {
    async synthesizeSpeech() {
      throw new Error('ADC missing');
    }
  };
  assert.equal(await synthesizeGodSpeech({ text: 'HI' }, ENV, { client: failing }), null);
});

test('sanitizeGodTtsText strips markup/emoji and caps length', () => {
  assert.equal(sanitizeGodTtsText('  **BEHOLD** 🧃 mortal  '), 'BEHOLD mortal');
  const clipped = sanitizeGodTtsText('x'.repeat(GOD_TTS_MAX_CHARS + 50));
  assert.ok(clipped.length <= GOD_TTS_MAX_CHARS);
  assert.ok(clipped.endsWith('…'));
});
