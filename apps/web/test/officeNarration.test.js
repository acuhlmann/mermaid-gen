// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelOfficeNarration,
  isOfficeNarrationAvailable,
  OFFICE_VOICE_PROFILES,
  officeVoiceProfile,
  pickOfficeNarrationVoice,
  sanitizeOfficeNarrationText,
  speakOfficeLine
} from '../src/utils/officeNarration.js';
import {
  OFFICE_NARRATION_STORAGE_KEY,
  readOfficeNarrationEnabled,
  writeOfficeNarrationEnabled
} from '../src/utils/officeAmbienceStorage.js';

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
});

afterEach(() => {
  cancelOfficeNarration();
  window.localStorage.clear();
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
});

describe('officeVoiceProfile', () => {
  it('gives each colleague a distinct pitch/rate fingerprint', () => {
    expect(officeVoiceProfile('intern').pitch).toBeGreaterThan(
      officeVoiceProfile('greybeard').pitch
    );
    expect(officeVoiceProfile('goMad').rate).toBeGreaterThan(officeVoiceProfile('helpdesk').rate);
    expect(OFFICE_VOICE_PROFILES.scrumMaster).toBeTruthy();
    expect(officeVoiceProfile('unknown-speaker')).toEqual({ pitch: 1, rate: 1, volume: 0.8 });
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
    expect(result).toEqual({ spoken: true });
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(spoken[0].text).toBe('We tried that in 2009.');
    expect(spoken[0].pitch).toBe(OFFICE_VOICE_PROFILES.greybeard.pitch);
    expect(spoken[0].rate).toBe(OFFICE_VOICE_PROFILES.greybeard.rate);
    expect(spoken[0].lang).toBe('en-US');
  });

  it('resolves spoken:false when synthesis is unavailable', async () => {
    expect(isOfficeNarrationAvailable()).toBe(false);
    await expect(speakOfficeLine({ speakerId: 'intern', text: 'hi' })).resolves.toEqual({
      spoken: false
    });
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
  it('defaults ON and only persists the opt-out', () => {
    expect(readOfficeNarrationEnabled()).toBe(true);
    writeOfficeNarrationEnabled(false);
    expect(readOfficeNarrationEnabled()).toBe(false);
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBe('0');
    writeOfficeNarrationEnabled(true);
    expect(readOfficeNarrationEnabled()).toBe(true);
    expect(window.localStorage.getItem(OFFICE_NARRATION_STORAGE_KEY)).toBeNull();
  });
});
