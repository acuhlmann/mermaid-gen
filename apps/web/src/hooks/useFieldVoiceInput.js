import { useCallback, useRef, useState } from 'react';
import {
  buildSessionTranscript,
  combinePromptWithVoiceSession,
  speechRecognitionLangForUiLocale
} from '../utils/voiceInputCommit.js';
import { SpeechRecognitionCtor } from '../utils/appConstants.js';

const VOICE_STOP_GRACE_MS = 320;

/**
 * Hold-to-speak / tap-to-toggle dictation for a single text field (meeting
 * raise-hand, Slop Chat composer, etc.).
 */
export function useFieldVoiceInput({
  value = '',
  onChange,
  disabled = false,
  uiLocale = 'en',
  voiceSupported = Boolean(SpeechRecognitionCtor)
} = {}) {
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef(null);
  const voiceStopTimerRef = useRef(null);
  const voiceAccumulatedRef = useRef('');
  const voiceBaseRef = useRef('');
  const micSessionRef = useRef(0);
  const uiLocaleRef = useRef(uiLocale);
  uiLocaleRef.current = uiLocale;
  const valueRef = useRef(value);
  valueRef.current = value;

  const applySessionText = useCallback(
    (sessionText) => {
      const next = combinePromptWithVoiceSession(voiceBaseRef.current, sessionText);
      voiceAccumulatedRef.current = String(sessionText ?? '').trim();
      onChange?.(next);
    },
    [onChange]
  );

  const stopVoiceInput = useCallback((options = {}) => {
    const immediate = Boolean(options.immediate);
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (!recognition) {
      setVoiceListening(false);
      return;
    }
    if (immediate) {
      micSessionRef.current += 1;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
      recognitionRef.current = null;
      setVoiceListening(false);
      return;
    }
    const recInstance = recognition;
    voiceStopTimerRef.current = globalThis.setTimeout(() => {
      voiceStopTimerRef.current = null;
      if (recognitionRef.current !== recInstance) return;
      try {
        recInstance.stop();
      } catch {
        micSessionRef.current += 1;
        recognitionRef.current = null;
        setVoiceListening(false);
      }
    }, VOICE_STOP_GRACE_MS);
  }, []);

  const startVoiceInput = useCallback(() => {
    if (!voiceSupported || disabled) return;
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
    const stale = recognitionRef.current;
    if (stale) {
      micSessionRef.current += 1;
      try {
        stale.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    micSessionRef.current += 1;
    const sessionAtStart = micSessionRef.current;
    voiceAccumulatedRef.current = '';
    voiceBaseRef.current = valueRef.current ?? '';
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechRecognitionLangForUiLocale(uiLocaleRef.current);
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const snapshot = buildSessionTranscript(event.results, { includeInterim: true });
        applySessionText(snapshot.sessionText);
      };
      recognition.onerror = (event) => {
        if (event?.error === 'no-speech' || event?.error === 'aborted') return;
      };
      recognition.onend = () => {
        if (sessionAtStart !== micSessionRef.current) return;
        const recognitionResults = recognition.results;
        if (recognitionResults?.length) {
          const finalsOnly = buildSessionTranscript(recognitionResults, { includeInterim: false });
          applySessionText(finalsOnly.sessionText || voiceAccumulatedRef.current);
        }
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        setVoiceListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      micSessionRef.current += 1;
      setVoiceListening(false);
    }
  }, [applySessionText, disabled, voiceSupported]);

  const handleMicPointerDown = useCallback(
    (event) => {
      if (!voiceSupported || disabled) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      startVoiceInput();
    },
    [disabled, startVoiceInput, voiceSupported]
  );

  const handleMicPointerUp = useCallback(
    (event) => {
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // ignore
      }
      stopVoiceInput();
    },
    [stopVoiceInput]
  );

  const handleMicToggleClick = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      if (!voiceSupported || disabled) return;
      if (voiceListening) {
        stopVoiceInput();
        return;
      }
      startVoiceInput();
    },
    [disabled, startVoiceInput, stopVoiceInput, voiceListening, voiceSupported]
  );

  return {
    voiceListening,
    voiceSupported,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicToggleClick,
    stopVoiceInput
  };
}
