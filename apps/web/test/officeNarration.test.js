// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelOfficeNarration,
  clearOfficeNarrationPrefetch,
  isOfficeNarrationAvailable,
  OFFICE_VOICE_PROFILES,
  officeVoiceProfile,
  pickOfficeNarrationVoice,
  prefetchOfficeLine,
  sanitizeOfficeNarrationText,
  speakOfficeLine
} from '../src/utils/officeNarration.js';
import { OFFICE_SPEAKER_IDS, OFFICE_TTS_RATE_SCALE } from '@archislop/shared';
import {
  OFFICE_CAPTIONS_STORAGE_KEY,
  OFFICE_NARRATION_STORAGE_KEY,
  readOfficeCaptionsEnabled,
  readOfficeNarrationEnabled,
  writeOfficeCaptionsEnabled,
  writeOfficeNarrationEnabled
} from '../src/utils/officeAmbienceStorage.js';

function clearNarrationStorage() {
  try {
    if (typeof window.localStorage?.removeItem === 'function') {
      window.localStorage.removeItem(OFFICE_NARRATION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quirks in some Node/jsdom builds.
  }
}

function installSpeechMock({
  voices = [{ lang: 'en-US', localService: true, default: true }]
} = {}) {
  const spoken = [];
  const synth = {
    speak: vi.fn((utterance) => {
      spoken.push(utterance);
      queueMicrotask(() => utterance.onend?.());
    }),
    cancel: vi.fn(),
    getVoices: () => voices
  };
  globalThis.speechSynthesis = synth;
  globalThis.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
    this.text = text;
    this.pitch = 1;
    this.rate = 1;
    this.volume = 1;
    this.lang = '';
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  };
  return { synth, spoken };
}

beforeEach(() => {
  cancelOfficeNarration();
  clearOfficeNarrationPrefetch();
  clearNarrationStorage();
});

afterEach(() => {
  cancelOfficeNarration();
  clearOfficeNarrationPrefetch();
  clearNarrationStorage();
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

describe('officeVoiceProfile', () => {
  it('gives each colleague a distinct pitch/rate fingerprint', () => {
    expect(officeVoiceProfile('intern').pitch).toBeGreaterThan(
      officeVoiceProfile('greybeard').pitch
    );
    expect(officeVoiceProfile('russ').rate).toBeGreaterThan(officeVoiceProfile('helpdesk').rate);
    expect(OFFICE_VOICE_PROFILES.scrumMaster).toBeTruthy();
    expect(officeVoiceProfile('unknown-speaker')).toEqual({
      pitch: 1,
      rate: OFFICE_TTS_RATE_SCALE,
      volume: 0.8
    });
  });

  it('applies the shared global rate scale on top of authored rates', () => {
    expect(officeVoiceProfile('greybeard').rate).toBeCloseTo(
      OFFICE_VOICE_PROFILES.greybeard.rate * OFFICE_TTS_RATE_SCALE,
      9
    );
  });

  // Drift guard: this map is a hand-maintained twin of the server's WaveNet
  // prosody table. Without this, adding a persona to one silently leaves the
  // other falling back to DEFAULT_PROFILE.
  it('covers exactly the canonical speaker ids', () => {
    expect(Object.keys(OFFICE_VOICE_PROFILES).sort()).toEqual([...OFFICE_SPEAKER_IDS].sort());
  });
});

describe('sanitizeOfficeNarrationText', () => {
  it('strips emoji and collapses whitespace', () => {
    expect(sanitizeOfficeNarrationText('  Hello  🧃  world  ')).toBe('Hello world');
  });
});

describe('pickOfficeNarrationVoice', () => {
  it('prefers an exact lang match, then a primary-subtag family', () => {
    const synth = {
      getVoices: () => [
        { lang: 'en-GB', localService: true },
        { lang: 'en-AU', localService: false },
        { lang: 'zh-CN', localService: true }
      ]
    };
    expect(pickOfficeNarrationVoice(synth, 'en-AU').lang).toBe('en-AU');
    expect(pickOfficeNarrationVoice(synth, 'en-US').lang).toBe('en-GB');
    expect(pickOfficeNarrationVoice(synth, 'zh-TW').lang).toBe('zh-CN');
  });
});

describe('speakOfficeLine', () => {
  it('applies the speaker profile and resolves when synthesis ends', async () => {
    const { synth, spoken } = installSpeechMock();
    const result = await speakOfficeLine({
      speakerId: 'greybeard',
      text: 'We tried that in 2009.',
      lang: 'en-US'
    });
    expect(result).toEqual({ spoken: true, source: 'webspeech' });
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe('We tried that in 2009.');
    expect(spoken[0].pitch).toBe(OFFICE_VOICE_PROFILES.greybeard.pitch);
    expect(spoken[0].rate).toBe(officeVoiceProfile('greybeard').rate);
    expect(spoken[0].lang).toBe('en-US');
  });

  it('resolves spoken:false when synthesis is unavailable', async () => {
    const empty = {};
    expect(isOfficeNarrationAvailable(empty)).toBe(false);
    await expect(
      speakOfficeLine({ speakerId: 'intern', text: 'hi', globalObj: empty })
    ).resolves.toEqual({
      spoken: false
    });
  });

  it('prefers cloud audio when fetchCloudAudio returns a payload', async () => {
    const fetchCloudAudio = vi.fn(async () => ({
      audioBase64: btoa('hi'),
      mimeType: 'audio/mpeg'
    }));
    const playCalls = [];
    function FakeAudio(src) {
      playCalls.push(src);
      this.src = src;
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      this.play = () => {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      };
      this.pause = () => {};
      this.removeAttribute = () => {};
      this.load = () => {};
    }
    const globalObj = {
      Audio: FakeAudio,
      speechSynthesis: { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] },
      SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {}
    };
    const result = await speakOfficeLine({
      speakerId: 'intern',
      text: 'sorry if this is dumb',
      lang: 'en-US',
      fetchCloudAudio,
      globalObj
    });
    expect(result).toEqual({ spoken: true, source: 'cloud' });
    expect(fetchCloudAudio).toHaveBeenCalledOnce();
    expect(playCalls[0]).toMatch(/^data:audio\/mpeg;base64,/);
  });

  it('chunks long lines across multiple cloud requests', async () => {
    const fetchCloudAudio = vi.fn(async () => ({
      audioBase64: btoa('hi'),
      mimeType: 'audio/mpeg'
    }));
    function FakeAudio() {
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      this.play = () => {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      };
      this.pause = () => {};
      this.removeAttribute = () => {};
      this.load = () => {};
    }
    const globalObj = {
      Audio: FakeAudio,
      speechSynthesis: { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] },
      SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {}
    };
    const long = `${'A'.repeat(700)}. ${'B'.repeat(700)}.`;
    const result = await speakOfficeLine({
      speakerId: 'intern',
      text: long,
      lang: 'en-US',
      fetchCloudAudio,
      globalObj
    });
    expect(result.spoken).toBe(true);
    expect(fetchCloudAudio.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('consumes prefetched cloud audio without a second fetch', async () => {
    const fetchCloudAudio = vi.fn(async () => ({
      audioBase64: btoa('hi'),
      mimeType: 'audio/mpeg'
    }));
    function FakeAudio() {
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      this.play = () => {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      };
      this.pause = () => {};
      this.removeAttribute = () => {};
      this.load = () => {};
    }
    const globalObj = {
      Audio: FakeAudio,
      speechSynthesis: { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] },
      SpeechSynthesisUtterance: function SpeechSynthesisUtterance() {}
    };
    prefetchOfficeLine({
      speakerId: 'intern',
      text: 'next up',
      lang: 'en-US',
      fetchCloudAudio
    });
    await Promise.resolve();
    const result = await speakOfficeLine({
      speakerId: 'intern',
      text: 'next up',
      lang: 'en-US',
      fetchCloudAudio,
      globalObj
    });
    expect(result).toEqual({ spoken: true, source: 'cloud' });
    expect(fetchCloudAudio).toHaveBeenCalledOnce();
  });

  it('falls back to Web Speech when cloud audio playback fails', async () => {
    const fetchCloudAudio = vi.fn(async () => ({
      audioBase64: btoa('hi'),
      mimeType: 'audio/mpeg'
    }));
    function FakeAudio(src) {
      this.src = src;
      this.volume = 1;
      this.onended = null;
      this.onerror = null;
      this.play = () => {
        queueMicrotask(() => this.onerror?.());
        return Promise.resolve();
      };
      this.pause = () => {};
      this.removeAttribute = () => {};
      this.load = () => {};
    }
    const { synth, spoken } = installSpeechMock();
    const globalObj = {
      Audio: FakeAudio,
      speechSynthesis: synth,
      SpeechSynthesisUtterance: globalThis.SpeechSynthesisUtterance
    };
    const result = await speakOfficeLine({
      speakerId: 'intern',
      text: 'sorry if this is dumb',
      lang: 'en-US',
      fetchCloudAudio,
      globalObj
    });
    expect(result).toEqual({ spoken: true, source: 'webspeech' });
    expect(fetchCloudAudio).toHaveBeenCalledOnce();
    expect(spoken).toHaveLength(1);
  });

  it('cancelOfficeNarration settles an in-flight waiter', async () => {
    const synth = {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => []
    };
    globalThis.speechSynthesis = synth;
    globalThis.SpeechSynthesisUtterance = function SpeechSynthesisUtterance(text) {
      this.text = text;
      this.onend = null;
      this.onerror = null;
    };
    const pending = speakOfficeLine({ speakerId: 'hr', text: 'Friendly nudge!' });
    cancelOfficeNarration();
    await expect(pending).resolves.toEqual({ spoken: false, cancelled: true });
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('office narration storage', () => {
  beforeEach(() => {
    const store = new Map();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => {
          store.set(key, String(value));
        },
        removeItem: (key) => {
          store.delete(key);
        },
        clear: () => store.clear()
      }
    });
  });

  it('defaults ON and only persists the opt-out', () => {
    expect(readOfficeNarrationEnabled()).toBe(true);
    writeOfficeNarrationEnabled(false);
    expect(readOfficeNarrationEnabled()).toBe(false);
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBe('0');
    writeOfficeNarrationEnabled(true);
    expect(readOfficeNarrationEnabled()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBeNull();
  });

  it('defaults captions OFF and only persists the opt-in', () => {
    expect(readOfficeCaptionsEnabled()).toBe(false);
    writeOfficeCaptionsEnabled(true);
    expect(readOfficeCaptionsEnabled()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_CAPTIONS_STORAGE_KEY)).toBe('1');
    writeOfficeCaptionsEnabled(false);
    expect(readOfficeCaptionsEnabled()).toBe(false);
    expect(window.localStorage.getItem(OFFICE_CAPTIONS_STORAGE_KEY)).toBeNull();
  });
});
