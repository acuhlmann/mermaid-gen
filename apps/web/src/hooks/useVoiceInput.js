import { useCallback, useRef, useState } from 'react';
import {
  extractSpeechResultSnapshot,
  sliceInterimBeyondFinals,
  sliceNewSpeechText
} from '../utils/voiceInputCommit.js';
import { SpeechRecognitionCtor } from '../utils/appConstants.js';

/**
 * Hold-to-speak and tap-to-toggle voice dictation for prompt fields.
 *
 * @param {{
 *   voiceSupported: boolean;
 *   controls: { loading: { micDenied: string, voiceFailed: string, voiceUnavailable: string } };
 *   loadingRef: import('react').MutableRefObject<boolean>;
 *   streamingPreviewRef: import('react').MutableRefObject<boolean>;
 *   slopPromptExpandedRef: import('react').MutableRefObject<boolean>;
 *   hasCanvasContentRef: import('react').MutableRefObject<boolean>;
 *   setSlopNextPrompt: (value: string | ((prev: string) => string)) => void;
 *   setDeskPrompt: (value: string | ((prev: string) => string)) => void;
 *   setPrompt: (value: string | ((prev: string) => string)) => void;
 *   promptRef: import('react').MutableRefObject<string>;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 * }} deps
 */
export function useVoiceInput({
  voiceSupported,
  controls,
  loadingRef,
  streamingPreviewRef,
  slopPromptExpandedRef,
  hasCanvasContentRef,
  setSlopNextPrompt,
  setDeskPrompt,
  setPrompt,
  promptRef,
  hasInteractedRef
}) {
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');

  const recognitionRef = useRef(null);
  const voicePressedRef = useRef(false);
  const lastSpeechInterimRef = useRef('');
  const voiceStopTimerRef = useRef(null);
  const voiceCapturedAnyRef = useRef(false);
  const voiceAccumulatedRef = useRef('');
  const voiceFinalsTextRef = useRef('');
  const voiceFinalsCommittedLengthRef = useRef(0);
  const micSessionRef = useRef(0);

  const appendActivePromptText = useCallback(
    (text) => {
      if (!text) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      if (slopPromptExpandedRef.current) {
        setSlopNextPrompt((current) => (current ? `${current.trimEnd()} ${trimmed}` : trimmed));
        return;
      }
      if (hasCanvasContentRef.current) {
        setDeskPrompt((current) => (current ? `${current.trimEnd()} ${trimmed}` : trimmed));
        return;
      }
      setPrompt((current) => {
        const next = current ? `${current.trimEnd()} ${trimmed}` : trimmed;
        promptRef.current = next;
        return next;
      });
    },
    [
      hasCanvasContentRef,
      promptRef,
      setDeskPrompt,
      setPrompt,
      setSlopNextPrompt,
      slopPromptExpandedRef
    ]
  );

  const commitVoiceSessionDelta = useCallback(
    ({ finalsText, interim }) => {
      const delta = sliceNewSpeechText(finalsText, voiceFinalsCommittedLengthRef.current);
      if (delta) {
        voiceCapturedAnyRef.current = true;
        voiceAccumulatedRef.current = voiceAccumulatedRef.current
          ? `${voiceAccumulatedRef.current.trimEnd()} ${delta}`
          : delta;
        appendActivePromptText(delta);
        voiceFinalsCommittedLengthRef.current = finalsText.length;
      }
      voiceFinalsTextRef.current = finalsText;
      lastSpeechInterimRef.current = interim;
    },
    [appendActivePromptText]
  );

  const flushVoiceInterim = useCallback(() => {
    const delta = sliceInterimBeyondFinals(
      voiceFinalsTextRef.current,
      lastSpeechInterimRef.current
    );
    lastSpeechInterimRef.current = '';
    if (!delta) return;
    voiceCapturedAnyRef.current = true;
    voiceAccumulatedRef.current = voiceAccumulatedRef.current
      ? `${voiceAccumulatedRef.current.trimEnd()} ${delta}`
      : delta;
    appendActivePromptText(delta);
  }, [appendActivePromptText]);

  const stopVoiceInput = useCallback(
    (options = {}) => {
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
        lastSpeechInterimRef.current = '';
        voiceFinalsTextRef.current = '';
        voiceFinalsCommittedLengthRef.current = 0;
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
          flushVoiceInterim();
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
      }, 220);
    },
    [flushVoiceInterim]
  );

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
    voiceFinalsTextRef.current = '';
    voiceFinalsCommittedLengthRef.current = 0;

    hasInteractedRef.current = true;
    setVoiceError('');
    voicePressedRef.current = true;
    lastSpeechInterimRef.current = '';
    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const snapshot = extractSpeechResultSnapshot(event.results);
        if (snapshot.finalsText || snapshot.interim?.trim()) {
          voiceCapturedAnyRef.current = true;
        }
        commitVoiceSessionDelta(snapshot);
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

        flushVoiceInterim();

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
    commitVoiceSessionDelta,
    controls.loading,
    flushVoiceInterim,
    hasInteractedRef,
    loadingRef,
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
        stopVoiceInput({ immediate: true });
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
