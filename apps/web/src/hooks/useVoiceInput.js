import { useCallback, useRef, useState } from 'react';
import {
  buildSessionTranscript,
  combinePromptWithVoiceSession,
  speechRecognitionLangForUiLocale
} from '../utils/voiceInputCommit.js';
import { SpeechRecognitionCtor } from '../utils/appConstants.js';

/** Grace period after release so Chrome can finalize the last utterance. */
const VOICE_STOP_GRACE_MS = 320;

/**
 * Hold-to-speak and tap-to-toggle voice dictation for prompt fields.
 *
 * Rebuilds the full session transcript on every SpeechRecognition result and
 * replaces the voice contribution on the active prompt (instead of appending
 * deltas). That avoids Chrome's continuous-mode word-boundary repeats.
 *
 * @param {{
 *   voiceSupported: boolean;
 *   controls: { loading: { micDenied: string, voiceFailed: string, voiceUnavailable: string } };
 *   uiLocale?: string;
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   slopPromptExpandedRef: import('react').MutableRefObject<boolean>;
 *   hasCanvasContentRef: import('react').MutableRefObject<boolean>;
 *   setSlopNextPrompt: (value: string | ((prev: string) => string)) => void;
 *   setDeskPrompt: (value: string | ((prev: string) => string)) => void;
 *   setPrompt: (value: string | ((prev: string) => string)) => void;
 *   promptRef: import('react').MutableRefObject<string>;
 *   deskPromptRef?: import('react').MutableRefObject<string>;
 *   slopNextPromptRef?: import('react').MutableRefObject<string>;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 * }} deps
 */
export function useVoiceInput({
  voiceSupported,
  controls,
  uiLocale = 'en',
  loadingRef,
  streamingPreviewRef,
  slopPromptExpandedRef,
  hasCanvasContentRef,
  setSlopNextPrompt,
  setDeskPrompt,
  setPrompt,
  promptRef,
  deskPromptRef,
  slopNextPromptRef,
  hasInteractedRef
}) {
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const recognitionRef = useRef(null);
  const voicePressedRef = useRef(false);
  const voiceStopTimerRef = useRef(null);
  const voiceCapturedAnyRef = useRef(false);
  const voiceAccumulatedRef = useRef('');
  const voiceBasePromptRef = useRef('');
  const voiceTargetRef = useRef('prompt');
  const micSessionRef = useRef(0);
  const uiLocaleRef = useRef(uiLocale);
  uiLocaleRef.current = uiLocale;

  const readActivePromptBase = useCallback(() => {
    if (slopPromptExpandedRef.current) {
      voiceTargetRef.current = 'slop';
      return slopNextPromptRef?.current ?? '';
    }
    // Desk Work Order is the primary field on both empty canvas and content mode.
    voiceTargetRef.current = 'desk';
    return deskPromptRef?.current ?? '';
  }, [deskPromptRef, slopNextPromptRef, slopPromptExpandedRef]);

  const writeActivePrompt = useCallback(
    (next) => {
      const target = voiceTargetRef.current;
      if (target === 'slop') {
        setSlopNextPrompt(next);
        if (slopNextPromptRef) slopNextPromptRef.current = next;
        return;
      }
      if (target === 'desk') {
        setDeskPrompt(next);
        if (deskPromptRef) deskPromptRef.current = next;
        return;
      }
      promptRef.current = next;
      setPrompt(next);
    },
    [deskPromptRef, promptRef, setDeskPrompt, setPrompt, setSlopNextPrompt, slopNextPromptRef]
  );

  const applyVoiceSessionText = useCallback(
    (sessionText) => {
      const next = combinePromptWithVoiceSession(voiceBasePromptRef.current, sessionText);
      voiceAccumulatedRef.current = String(sessionText ?? '').trim();
      if (voiceAccumulatedRef.current) voiceCapturedAnyRef.current = true;
      writeActivePrompt(next);
    },
    [writeActivePrompt]
  );

  const stopVoiceInput = useCallback((options = {}) => {
    const immediate = Boolean(options.immediate);
    voicePressedRef.current = false;
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
      try {
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
      } catch {
        // ignore
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
        try {
          recInstance.onresult = null;
          recInstance.onerror = null;
          recInstance.onend = null;
        } catch {
          // ignore
        }
        if (recognitionRef.current === recInstance) recognitionRef.current = null;
        setVoiceListening(false);
      }
    }, VOICE_STOP_GRACE_MS);
  }, []);

  const startVoiceInput = useCallback(() => {
    if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
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
      stale.onresult = null;
      stale.onerror = null;
      stale.onend = null;
      recognitionRef.current = null;
    }

    micSessionRef.current += 1;
    const sessionAtStart = micSessionRef.current;
    voiceCapturedAnyRef.current = false;
    voiceAccumulatedRef.current = '';
    voiceBasePromptRef.current = readActivePromptBase();

    hasInteractedRef.current = true;
    setVoiceError('');
    voicePressedRef.current = true;
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = speechRecognitionLangForUiLocale(uiLocaleRef.current);
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const snapshot = buildSessionTranscript(event.results, { includeInterim: true });
        if (snapshot.sessionText) voiceCapturedAnyRef.current = true;
        applyVoiceSessionText(snapshot.sessionText);
      };
      recognition.onerror = (event) => {
        if (event?.error === 'no-speech' || event?.error === 'aborted') return;
        if (event?.error === 'not-allowed') {
          setVoiceError(controls.loading.micDenied);
          return;
        }
        setVoiceError(controls.loading.voiceFailed);
      };
      recognition.onend = () => {
        if (sessionAtStart !== micSessionRef.current) return;

        // Prefer finals-only on settle so a stale interim hypothesis does not stick.
        const recognitionResults = recognition.results;
        if (recognitionResults?.length) {
          const finalsOnly = buildSessionTranscript(recognitionResults, {
            includeInterim: false
          });
          applyVoiceSessionText(finalsOnly.sessionText || voiceAccumulatedRef.current);
        }

        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
        } catch {
          // ignore
        }
        if (recognitionRef.current === recognition) recognitionRef.current = null;

        setVoiceListening(false);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setVoiceListening(true);
    } catch {
      micSessionRef.current += 1;
      setVoiceError(controls.loading.voiceUnavailable);
      voicePressedRef.current = false;
    }
  }, [
    applyVoiceSessionText,
    controls.loading,
    hasInteractedRef,
    loadingRef,
    readActivePromptBase,
    streamingPreviewRef,
    voiceSupported
  ]);

  const handleMicPointerDown = useCallback(
    (event) => {
      if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers reject capture on unsupported targets.
      }
      startVoiceInput();
    },
    [loadingRef, startVoiceInput, streamingPreviewRef, voiceSupported]
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
      if (!voiceSupported || loadingRef.current || streamingPreviewRef.current) return;
      if (voiceListening) {
        // Graceful stop (not abort) so the last utterance can finalize.
        stopVoiceInput();
        return;
      }
      startVoiceInput();
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        active.blur();
      }
    },
    [
      loadingRef,
      startVoiceInput,
      stopVoiceInput,
      streamingPreviewRef,
      voiceListening,
      voiceSupported
    ]
  );

  const cleanupVoiceInput = useCallback(() => {
    if (voiceStopTimerRef.current) {
      clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.onend = null;
      recognitionRef.current = null;
    }
  }, []);

  const clearVoiceError = useCallback(() => {
    setVoiceError('');
  }, []);

  return {
    voiceListening,
    voiceError,
    stopVoiceInput,
    startVoiceInput,
    handleMicPointerDown,
    handleMicPointerUp,
    handleMicToggleClick,
    cleanupVoiceInput,
    clearVoiceError
  };
}
