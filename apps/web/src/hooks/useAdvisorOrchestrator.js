import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramStore.js';
import { getVisibleDiagramLabels } from '../utils/visibleDiagramLabels.js';

const ADVISOR_ORDER = ['refine', 'innovate', 'goMad', 'critique', 'explain'];
const SHOW_MS = 10_000;
const GAP_MS = 2200;
const FAILURE_BACKOFF_MS = 30_000;
const DISMISS_BACKOFF_THRESHOLD = 3;
const DISMISS_BACKOFF_MS = 60_000;
const LAST_SUGGESTIONS_CAP = 5;
const SUGGEST_TIMEOUT_MS = 12_000;
const HOVER_FOCUS_DEBOUNCE_MS = 600;
const SELECT_FOCUS_DEBOUNCE_MS = 60;

function pickNextPersona(previous) {
  const pool = previous ? ADVISOR_ORDER.filter((p) => p !== previous) : ADVISOR_ORDER;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? ADVISOR_ORDER[0];
}

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * Proactive advisor orchestrator.
 *
 * Cycles through the five personas, each producing a single short in-character
 * suggestion about the visible diagram. All loop machinery (timers, fetches,
 * pause checks) lives inside a single setup effect so render-time only reads
 * refs; setState happens off the render path inside async callbacks.
 *
 * Pin / hover semantics:
 * - Hover the bubble → `pauseTimer()` cancels the active auto-dismiss timer.
 * - Leave the bubble → `resumeTimer()` starts a fresh SHOW_MS countdown, unless pinned.
 * - Click the bubble body → `togglePin()` flips a sticky flag; while pinned the
 *   auto-dismiss timer is cleared and the bubble stays until accept/dismiss.
 *
 * Focus priority: selected node (strong) > hovered node (debounced) > viewport.
 * When focus changes the loop cancels in flight and re-ticks targeting the new
 * focus; the model's prompt then demands the suggestion be about that exact part.
 *
 * @param {{
 *   getDiagramSource: () => string,
 *   getContentType: () => 'mermaid'|'infographic',
 *   getSessionId: () => string,
 *   getFocusDescriptor?: () => { id: string, label?: string, kind?: string, source?: 'selected'|'hover' } | null | undefined,
 *   focusKey?: string | null,
 *   focusSource?: 'selected' | 'hover' | null,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   pause: boolean,
 *   onAccept?: (suggestion: string, persona: string) => void,
 *   initialMuted?: boolean
 * }} params
 */
export function useAdvisorOrchestrator(params) {
  const { pause, onAccept, initialMuted = false, focusKey = null, focusSource = null } = params;

  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isPinned, setIsPinned] = useState(false);
  const [activePersona, setActivePersona] = useState(null);
  const [thinkingPersona, setThinkingPersona] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [highlightIds, setHighlightIds] = useState([]);
  const [error, setError] = useState(null);

  const paramsRef = useRef(params);
  const mutedRef = useRef(initialMuted);
  const pauseRef = useRef(pause);
  const pinnedRef = useRef(false);
  const onAcceptRef = useRef(onAccept);

  // Imperative loop API, populated by the setup effect.
  const scheduleNextRef = useRef(() => {});
  const cancelLoopRef = useRef(() => {});
  const pauseTimerRef = useRef(() => {});
  const resumeTimerRef = useRef(() => {});

  useEffect(() => { paramsRef.current = params; });
  useEffect(() => { mutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { pauseRef.current = pause; }, [pause]);
  useEffect(() => { pinnedRef.current = isPinned; }, [isPinned]);
  useEffect(() => { onAcceptRef.current = onAccept; }, [onAccept]);

  useEffect(() => {
    let phaseTimer = null;
    let abortController = null;
    let generation = 0;
    let failureUntil = 0;
    let dismissBackoffUntil = 0;
    let dismissStreak = 0;
    let previousPersona = null;
    const lastSuggestions = [];
    let alive = true;

    const clearPhaseTimer = () => {
      if (phaseTimer != null) {
        clearTimeout(phaseTimer);
        phaseTimer = null;
      }
    };

    const cancelInFlight = () => {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    };

    const shouldPauseNow = () => {
      if (mutedRef.current) return true;
      if (pauseRef.current) return true;
      if (isHidden()) return true;
      const src = paramsRef.current.getDiagramSource?.() ?? '';
      if (!src.trim()) return true;
      const now = Date.now();
      if (now < failureUntil) return true;
      if (now < dismissBackoffUntil) return true;
      return false;
    };

    function startDismissTimer() {
      clearPhaseTimer();
      phaseTimer = setTimeout(() => {
        phaseTimer = null;
        if (pinnedRef.current) return; // pinned during the countdown — leave bubble up
        setSuggestion(null);
        setHighlightIds([]);
        scheduleNext(GAP_MS);
      }, SHOW_MS);
    }

    const tick = async () => {
      const gen = ++generation;
      const persona = pickNextPersona(previousPersona);
      const svgRoot = paramsRef.current.getSvgRoot?.() ?? null;
      const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
      const { labels, ids: visibleIds } = getVisibleDiagramLabels(host);
      const diagramSource = paramsRef.current.getDiagramSource?.() ?? '';
      const contentType = paramsRef.current.getContentType?.() ?? 'mermaid';
      const sessionId = paramsRef.current.getSessionId?.() ?? '';
      const focusDescriptor = paramsRef.current.getFocusDescriptor?.() ?? null;

      cancelInFlight();
      const controller = new AbortController();
      abortController = controller;
      const timeoutId = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS);
      // Visually announce who is about to speak — the UI shows "<persona> is
      // thinking…" until the fetch resolves and the real bubble takes over.
      setThinkingPersona(persona);

      try {
        const headers = { 'content-type': 'application/json' };
        if (sessionId) headers[SESSION_HEADER] = sessionId;
        const response = await fetch(`${API_BASE_URL}/api/advisor/suggest`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            persona,
            contentType,
            diagramSource,
            visibleLabels: labels,
            ...(focusDescriptor?.id ? { focusNode: focusDescriptor } : {}),
            lastSuggestions: lastSuggestions.slice()
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!alive || gen !== generation) return;
        if (!response.ok) {
          if (gen === generation) setThinkingPersona(null);
          failureUntil = Date.now() + FAILURE_BACKOFF_MS;
          setError(`advisor ${response.status}`);
          scheduleNext(GAP_MS);
          return;
        }
        const payload = await response.json();
        if (!alive || gen !== generation) return;
        const text = typeof payload?.suggestion === 'string' ? payload.suggestion.trim() : '';
        const replyIds = Array.isArray(payload?.highlightIds) ? payload.highlightIds : [];
        if (!text) {
          setThinkingPersona(null);
          scheduleNext(GAP_MS);
          return;
        }
        lastSuggestions.unshift(text);
        if (lastSuggestions.length > LAST_SUGGESTIONS_CAP) {
          lastSuggestions.length = LAST_SUGGESTIONS_CAP;
        }
        previousPersona = persona;
        // New suggestion clears any prior pin — each persona gets a fresh window.
        setIsPinned(false);
        pinnedRef.current = false;
        setActivePersona(persona);
        setSuggestion(text);
        setHighlightIds(replyIds.length > 0 ? replyIds : visibleIds.slice(0, 4));
        setError(null);
        setThinkingPersona(null);
        startDismissTimer();
      } catch (err) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
          // Aborted by a fresh tick — the new tick will set its own thinkingPersona.
          return;
        }
        if (gen === generation) setThinkingPersona(null);
        failureUntil = Date.now() + FAILURE_BACKOFF_MS;
        setError(err?.message || 'advisor error');
        scheduleNext(GAP_MS);
      } finally {
        if (abortController === controller) abortController = null;
      }
    };

    function scheduleNext(delay) {
      clearPhaseTimer();
      phaseTimer = setTimeout(() => {
        phaseTimer = null;
        if (!alive) return;
        if (shouldPauseNow()) {
          scheduleNext(GAP_MS);
          return;
        }
        void tick();
      }, Math.max(0, delay));
    }

    function dismissCycle(opts) {
      if (opts?.userDismissed) {
        dismissStreak += 1;
        if (dismissStreak >= DISMISS_BACKOFF_THRESHOLD) {
          dismissBackoffUntil = Date.now() + DISMISS_BACKOFF_MS;
          dismissStreak = 0;
        }
      } else if (opts?.resetStreak) {
        dismissStreak = 0;
      }
      cancelInFlight();
      clearPhaseTimer();
      scheduleNext(GAP_MS);
    }

    scheduleNextRef.current = (delay) => scheduleNext(delay);
    cancelLoopRef.current = (opts) => dismissCycle(opts);
    pauseTimerRef.current = () => clearPhaseTimer();
    resumeTimerRef.current = () => {
      if (pinnedRef.current) return;
      startDismissTimer();
    };

    scheduleNext(GAP_MS);

    const handleVisibility = () => {
      if (shouldPauseNow()) {
        clearPhaseTimer();
        cancelInFlight();
        setSuggestion(null);
        setHighlightIds([]);
      } else if (phaseTimer == null && !abortController) {
        scheduleNext(GAP_MS);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      alive = false;
      clearPhaseTimer();
      cancelInFlight();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      if (mutedRef.current || pauseRef.current) {
        setSuggestion(null);
        setHighlightIds([]);
        setIsPinned(false);
        setThinkingPersona(null);
        pinnedRef.current = false;
        cancelLoopRef.current?.({ resetStreak: false });
      } else {
        scheduleNextRef.current?.(GAP_MS);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [pause, isMuted]);

  // Focus-change watcher: when the user clicks (selected) or hovers (hover) a
  // new part of the diagram, cancel any active bubble and trigger a fresh tick
  // targeting that focus. Hover debounces (avoid spam during rapid pointer
  // travel); click is near-instant (explicit intent).
  useEffect(() => {
    if (!focusKey) return undefined;
    if (mutedRef.current || pauseRef.current) return undefined;
    const debounce = focusSource === 'hover' ? HOVER_FOCUS_DEBOUNCE_MS : SELECT_FOCUS_DEBOUNCE_MS;
    const id = setTimeout(() => {
      setSuggestion(null);
      setHighlightIds([]);
      setIsPinned(false);
      pinnedRef.current = false;
      scheduleNextRef.current?.(0);
    }, debounce);
    return () => clearTimeout(id);
  }, [focusKey, focusSource]);

  const dismiss = useCallback(() => {
    setSuggestion(null);
    setHighlightIds([]);
    setIsPinned(false);
    setThinkingPersona(null);
    pinnedRef.current = false;
    cancelLoopRef.current?.({ userDismissed: true });
  }, []);

  const accept = useCallback(() => {
    if (!suggestion || !activePersona) return;
    const text = suggestion;
    const persona = activePersona;
    setSuggestion(null);
    setHighlightIds([]);
    setIsPinned(false);
    setThinkingPersona(null);
    pinnedRef.current = false;
    try {
      onAcceptRef.current?.(text, persona);
    } finally {
      cancelLoopRef.current?.({ resetStreak: true });
    }
  }, [suggestion, activePersona]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      pinnedRef.current = next;
      if (next) {
        pauseTimerRef.current?.();
      } else {
        resumeTimerRef.current?.();
      }
      return next;
    });
  }, []);

  const pauseTimer = useCallback(() => {
    pauseTimerRef.current?.();
  }, []);

  const resumeTimer = useCallback(() => {
    resumeTimerRef.current?.();
  }, []);

  return {
    activePersona,
    thinkingPersona,
    suggestion,
    highlightIds,
    isMuted,
    isPinned,
    error,
    toggleMute,
    togglePin,
    pauseTimer,
    resumeTimer,
    dismiss,
    accept
  };
}
