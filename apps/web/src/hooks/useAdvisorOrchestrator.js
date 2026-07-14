import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fallbackLabelGibberish,
  isLabelExplainGiveUpLevel,
  LABEL_EXPLAIN_GIBBERISH_LEVEL,
  MAX_LABEL_EXPLAIN_DUMB_LEVEL
} from '@archislop/shared';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { writeAdvisorMuted } from '../utils/advisorMuteStorage.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';

const ADVISOR_ORDER = ['refine', 'innovate', 'goMad', 'critique', 'explain', 'exec'];
export const ADVISOR_IDLE_PAUSE_MS = 10 * 60 * 1000;
const ACTIVITY_THROTTLE_MS = 1000;
const SHOW_MS = 10_000;
const GAP_MS = 2200;
const FAILURE_BACKOFF_MS = 30_000;
const DISMISS_BACKOFF_THRESHOLD = 3;
const DISMISS_BACKOFF_MS = 60_000;
const LAST_SUGGESTIONS_CAP = 5;
/** Max proactive suggestions kept for back/forward navigation in the dock bubble. */
export const PROPOSAL_HISTORY_CAP = 15;
const SUGGEST_TIMEOUT_MS = 12_000;
const HOVER_FOCUS_DEBOUNCE_MS = 600;
const SELECT_FOCUS_DEBOUNCE_MS = 60;
/** Keep a freshly surfaced bubble visible through post-render focus churn. */
const FOCUS_CLEAR_GRACE_MS = 3000;
/** Ignore brief loading/streaming flicker so the chip is not wiped mid-proposal. */
const PAUSE_CLEAR_DEBOUNCE_MS = 450;
/** Minimum time the "is polishing…" chip stays up before an external clear may run. */
export const THINKING_MIN_DWELL_MS = 600;

/** @param {string | null | undefined} focusKey */
function focusNodeId(focusKey) {
  if (!focusKey || typeof focusKey !== 'string') return null;
  const idx = focusKey.indexOf(':');
  return idx >= 0 ? focusKey.slice(idx + 1) : focusKey;
}

/**
 * Discard an in-flight or completed reply only when an existing explicit
 * selection moves to a different target — not for hover→selected on the same
 * node, hover flicker, or the first click that engages the diagram.
 *
 * @param {string | null | undefined} previousFocusKey
 * @param {string | null | undefined} nextFocusKey
 */
export function shouldDiscardForFocusChange(previousFocusKey, nextFocusKey) {
  if (previousFocusKey === nextFocusKey) return false;
  const prevId = focusNodeId(previousFocusKey);
  const nextId = focusNodeId(nextFocusKey);
  if (prevId && nextId && prevId === nextId) return false;
  const prevSelected = String(previousFocusKey ?? '').startsWith('selected:');
  const nextSelected = String(nextFocusKey ?? '').startsWith('selected:');
  if (prevSelected && nextSelected && prevId !== nextId) return true;
  if (prevSelected && !nextSelected) return true;
  return false;
}

function pickNextPersona(previous) {
  const pool = previous ? ADVISOR_ORDER.filter((p) => p !== previous) : ADVISOR_ORDER;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? ADVISOR_ORDER[0];
}

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/** @typedef {{ persona: string, suggestion: string, suggestionKind: string, highlightIds: string[] }} ProposalHistoryEntry */

/**
 * @param {{ entries: ProposalHistoryEntry[], index: number }} prev
 * @param {ProposalHistoryEntry} entry
 * @param {{ atLiveEnd: boolean }} opts
 */
export function pushProposalHistory(prev, entry, opts) {
  const { atLiveEnd } = opts;
  let { entries, index } = prev;
  if (entries.length === 0) {
    entries = [entry];
    return { entries, index: 0 };
  }
  if (atLiveEnd) {
    entries = [...entries, entry];
  } else {
    entries = [...entries.slice(0, index + 1), entry];
  }
  if (entries.length > PROPOSAL_HISTORY_CAP) {
    const overflow = entries.length - PROPOSAL_HISTORY_CAP;
    entries = entries.slice(overflow);
    index = Math.max(0, index - overflow);
  }
  if (atLiveEnd) {
    index = entries.length - 1;
  }
  return { entries, index };
}

/** @param {ProposalHistoryEntry[]} entries */
export function lastSuggestionTexts(entries) {
  return entries
    .map((e) => e.suggestion)
    .filter(Boolean)
    .slice(-LAST_SUGGESTIONS_CAP)
    .reverse();
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
 *   getContentType: () => 'mermaid'|'infographic'|'metaphor3d'|'chart'|'anything',
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
  const thinkingPersonaRef = useRef(null);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionKind, setSuggestionKind] = useState('suggestion');
  const [highlightIds, setHighlightIds] = useState([]);
  const [error, setError] = useState(null);
  const [isDumbingDown, setIsDumbingDown] = useState(false);
  /** 0 = ivory-tower brief; 1–6 = younger audiences; 7 = babble / give-up. */
  const [architectDumbLevel, setArchitectDumbLevel] = useState(0);
  const [proposalHistory, setProposalHistory] = useState(
    /** @type {{ entries: ProposalHistoryEntry[], index: number }} */ ({ entries: [], index: -1 })
  );

  const paramsRef = useRef(params);
  const proposalHistoryRef = useRef(proposalHistory);
  const mutedRef = useRef(initialMuted);
  const pauseRef = useRef(pause);
  const pinnedRef = useRef(false);
  const onAcceptRef = useRef(onAccept);
  const lastActivityAtRef = useRef(Date.now());
  const idlePausedRef = useRef(false);
  const focusKeyRef = useRef(focusKey);
  const suggestionRef = useRef(suggestion);
  const activePersonaRef = useRef(activePersona);
  /** Focus key the live bubble was fetched for — used to skip stale focus restarts. */
  const suggestionFocusKeyRef = useRef(/** @type {string | null} */ (null));
  const suggestionShownAtRef = useRef(0);
  const thinkingStartedAtRef = useRef(0);
  /** True from the first thinking frame until the bubble lands or the cycle hard-fails. */
  const proposalInFlightRef = useRef(false);
  const pauseClearTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  // Imperative loop API, populated by the setup effect.
  const scheduleNextRef = useRef(() => {});
  const cancelLoopRef = useRef(() => {});
  const cancelPendingRef = useRef(() => {});
  const pauseTimerRef = useRef(() => {});
  const resumeTimerRef = useRef(() => {});
  const setProposalHistoryRef = useRef(setProposalHistory);
  const forcedPersonaRef = useRef(/** @type {string | null} */ (null));
  const promptNextRef = useRef(/** @type {(opts?: { persona?: string }) => void} */ (() => {}));
  const clearAdvisorSurfaceRef = useRef(
    /** @type {(opts?: { clearPersona?: boolean }) => void} */ (() => {})
  );

  const clearAdvisorSurface = useCallback(({ clearPersona = true, force = false } = {}) => {
    if (
      !force &&
      proposalInFlightRef.current &&
      thinkingPersonaRef.current &&
      Date.now() - thinkingStartedAtRef.current < THINKING_MIN_DWELL_MS
    ) {
      return;
    }
    pauseTimerRef.current?.();
    setSuggestion(null);
    suggestionRef.current = null;
    suggestionFocusKeyRef.current = null;
    setSuggestionKind('suggestion');
    setHighlightIds([]);
    setArchitectDumbLevel(0);
    proposalInFlightRef.current = false;
    if (clearPersona) {
      setActivePersona(null);
      activePersonaRef.current = null;
    }
    setThinkingPersona(null);
    thinkingPersonaRef.current = null;
  }, []);

  useEffect(() => {
    clearAdvisorSurfaceRef.current = clearAdvisorSurface;
  }, [clearAdvisorSurface]);

  const applyHistoryEntry = useCallback((entry) => {
    if (!entry) return;
    setActivePersona(entry.persona);
    activePersonaRef.current = entry.persona;
    setSuggestion(entry.suggestion);
    suggestionRef.current = entry.suggestion;
    setSuggestionKind(entry.suggestionKind);
    setHighlightIds(entry.highlightIds ?? []);
    setArchitectDumbLevel(0);
    setThinkingPersona(null);
    thinkingPersonaRef.current = null;
    suggestionFocusKeyRef.current = null;
  }, []);

  const syncDismissTimerForHistory = useCallback((index, entriesLen) => {
    if (index < entriesLen - 1) {
      pauseTimerRef.current?.();
    } else if (!pinnedRef.current) {
      resumeTimerRef.current?.();
    }
  }, []);

  useEffect(() => {
    setProposalHistoryRef.current = setProposalHistory;
  });

  useEffect(() => {
    paramsRef.current = params;
  });
  useEffect(() => {
    proposalHistoryRef.current = proposalHistory;
  }, [proposalHistory]);
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);
  useEffect(() => {
    pinnedRef.current = isPinned;
  }, [isPinned]);
  useEffect(() => {
    onAcceptRef.current = onAccept;
  }, [onAccept]);
  useEffect(() => {
    focusKeyRef.current = focusKey;
  }, [focusKey]);
  useEffect(() => {
    suggestionRef.current = suggestion;
  }, [suggestion]);
  useEffect(() => {
    activePersonaRef.current = activePersona;
  }, [activePersona]);

  useEffect(() => {
    let phaseTimer = null;
    let abortController = null;
    let generation = 0;
    let failureUntil = 0;
    let dismissBackoffUntil = 0;
    let dismissStreak = 0;
    let previousPersona = null;
    let alive = true;
    /** @type {'timeout' | 'superseded' | null} */
    let lastAbortReason = null;

    const clearPhaseTimer = () => {
      if (phaseTimer != null) {
        clearTimeout(phaseTimer);
        phaseTimer = null;
      }
    };

    /** @param {'timeout' | 'superseded'} [reason] */
    const cancelInFlight = (reason = 'superseded') => {
      if (abortController) {
        lastAbortReason = reason;
        abortController.abort();
        abortController = null;
      }
    };

    const applyIdlePauseIfNeeded = () => {
      if (isHidden()) return;
      if (Date.now() - lastActivityAtRef.current <= ADVISOR_IDLE_PAUSE_MS) return;
      if (idlePausedRef.current) return;
      idlePausedRef.current = true;
      clearPhaseTimer();
      cancelInFlight();
      clearAdvisorSurfaceRef.current?.({ clearPersona: true, force: true });
    };

    const shouldPauseNow = () => {
      applyIdlePauseIfNeeded();
      if (mutedRef.current) return true;
      if (pauseRef.current) return true;
      if (isHidden()) return true;
      if (idlePausedRef.current) return true;
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
        clearAdvisorSurfaceRef.current?.({ clearPersona: true, force: true });
        scheduleNext(GAP_MS);
      }, SHOW_MS);
    }

    /** @param {string | null} persona */
    const setThinking = (persona) => {
      thinkingPersonaRef.current = persona;
      if (persona) {
        thinkingStartedAtRef.current = Date.now();
        proposalInFlightRef.current = true;
      }
      setThinkingPersona(persona);
    };

    /** @param {number} gen */
    const abandonTick = (gen) => {
      if (!alive) {
        setThinking(null);
        return true;
      }
      if (gen !== generation) return true;
      return false;
    };

    const tick = async () => {
      clearPhaseTimer();
      const gen = ++generation;
      const focusKeyAtTick = focusKeyRef.current;
      const persona = forcedPersonaRef.current ?? pickNextPersona(previousPersona);
      forcedPersonaRef.current = null;
      const svgRoot = paramsRef.current.getSvgRoot?.() ?? null;
      const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
      const contentType = paramsRef.current.getContentType?.() ?? 'mermaid';
      const diagramSource = paramsRef.current.getDiagramSource?.() ?? '';
      const { labels, ids: visibleIds } = getAdvisorVisibleLabels({
        contentType,
        host,
        diagramSource
      });
      const sessionId = paramsRef.current.getSessionId?.() ?? '';
      const focusDescriptor = paramsRef.current.getFocusDescriptor?.() ?? null;

      cancelInFlight('superseded');
      const controller = new AbortController();
      abortController = controller;
      lastAbortReason = null;
      const timeoutId = setTimeout(() => cancelInFlight('timeout'), SUGGEST_TIMEOUT_MS);
      // Visually announce who is about to speak — the UI shows "<persona> is
      // thinking…" until the fetch resolves and the real bubble takes over.
      setThinking(persona);

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
            lastSuggestions: lastSuggestionTexts(proposalHistoryRef.current.entries)
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (abandonTick(gen)) return;
        if (!response.ok) {
          setThinking(null);
          proposalInFlightRef.current = false;
          failureUntil = Date.now() + FAILURE_BACKOFF_MS;
          setError(`advisor ${response.status}`);
          scheduleNext(GAP_MS);
          return;
        }
        const payload = await response.json();
        if (abandonTick(gen)) return;
        const text = typeof payload?.suggestion === 'string' ? payload.suggestion.trim() : '';
        const replyIds = Array.isArray(payload?.highlightIds) ? payload.highlightIds : [];
        const rawKind = typeof payload?.kind === 'string' ? payload.kind.toLowerCase() : '';
        // Belt-and-suspenders: even if the model leaked a "suggestion" for explain,
        // we never want the Wise Architect's bubble to show a Do-it button.
        const kind = persona === 'explain' || rawKind === 'comment' ? 'comment' : 'suggestion';
        const focusId = focusDescriptor?.id ? String(focusDescriptor.id) : null;
        if (!text) {
          setThinking(null);
          proposalInFlightRef.current = false;
          setActivePersona(null);
          scheduleNext(GAP_MS);
          return;
        }
        if (pinnedRef.current) {
          // Fetch finished after pin — keep the pinned bubble, skip rotation.
          setThinking(null);
          proposalInFlightRef.current = false;
          return;
        }
        // Surface even when pause flipped true mid-flight (loading/streaming flicker).
        // Dropping the reply here left only the brief "is polishing…" chip — the speech
        // bubble never landed. Pause still blocks *new* ticks via shouldPauseNow.
        if (shouldDiscardForFocusChange(focusKeyAtTick, focusKeyRef.current)) {
          // Selection moved to a different node mid-flight — re-tick without blanking the chip.
          scheduleNext(0);
          return;
        }
        const highlight =
          replyIds.length > 0 ? replyIds : focusId ? [focusId] : visibleIds.slice(0, 4);
        const historyEntry = {
          persona,
          suggestion: text,
          suggestionKind: kind,
          highlightIds: highlight
        };
        const hist = proposalHistoryRef.current;
        const atLiveEnd = hist.entries.length === 0 || hist.index === hist.entries.length - 1;
        const nextHistory = pushProposalHistory(hist, historyEntry, { atLiveEnd });
        proposalHistoryRef.current = nextHistory;
        setProposalHistoryRef.current?.(nextHistory);
        previousPersona = persona;
        setError(null);
        if (!atLiveEnd) {
          // User is browsing older proposals — queue the new one without swapping the bubble.
          setThinking(null);
          const currentEntry = nextHistory.entries[nextHistory.index];
          if (currentEntry) {
            applyHistoryEntry(currentEntry);
            suggestionFocusKeyRef.current = focusKeyRef.current;
          }
          return;
        }
        // New suggestion clears any prior pin — each persona gets a fresh window.
        setIsPinned(false);
        pinnedRef.current = false;
        // Set persona + suggestion BEFORE clearing thinking so the mascot never
        // paints a blank gap between the thinking indicator and the speech bubble.
        setActivePersona(persona);
        activePersonaRef.current = persona;
        setArchitectDumbLevel(0);
        setSuggestion(text);
        suggestionRef.current = text;
        suggestionFocusKeyRef.current = focusKeyRef.current;
        suggestionShownAtRef.current = Date.now();
        setSuggestionKind(kind);
        setHighlightIds(highlight);
        setThinking(null);
        proposalInFlightRef.current = false;
        startDismissTimer();
      } catch (err) {
        clearTimeout(timeoutId);
        if (err?.name === 'AbortError') {
          // Superseded aborts (persona switch, focus change, new tick) must not
          // trigger the failure backoff — only the 12s safety timeout should.
          const reason = lastAbortReason;
          lastAbortReason = null;
          if (reason === 'timeout' && gen === generation) {
            setThinking(null);
            proposalInFlightRef.current = false;
            failureUntil = Date.now() + FAILURE_BACKOFF_MS;
            setError('advisor timeout');
            scheduleNext(GAP_MS);
          }
          return;
        }
        if (gen === generation) {
          setThinking(null);
          proposalInFlightRef.current = false;
        }
        failureUntil = Date.now() + FAILURE_BACKOFF_MS;
        setError(err?.message || 'advisor error');
        scheduleNext(GAP_MS);
      } finally {
        if (abortController === controller) abortController = null;
      }
    };

    function scheduleNext(delay) {
      clearPhaseTimer();
      phaseTimer = setTimeout(
        () => {
          phaseTimer = null;
          if (!alive) return;
          if (pinnedRef.current) return; // pinned — hold current bubble until unpin
          if (shouldPauseNow()) {
            scheduleNext(GAP_MS);
            return;
          }
          void tick();
        },
        Math.max(0, delay)
      );
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
    cancelPendingRef.current = () => {
      cancelInFlight();
      clearPhaseTimer();
    };
    pauseTimerRef.current = () => clearPhaseTimer();
    resumeTimerRef.current = () => {
      if (pinnedRef.current) return;
      startDismissTimer();
    };

    promptNextRef.current = ({ persona: forced } = {}) => {
      cancelInFlight();
      clearPhaseTimer();
      setIsPinned(false);
      pinnedRef.current = false;
      clearAdvisorSurfaceRef.current?.({ clearPersona: true, force: true });
      setProposalHistory((prev) => {
        if (prev.entries.length === 0) return prev;
        const index = prev.entries.length - 1;
        const next = { ...prev, index };
        proposalHistoryRef.current = next;
        return next;
      });
      forcedPersonaRef.current = forced ?? null;
      scheduleNext(0);
    };

    scheduleNext(GAP_MS);

    const handleVisibility = () => {
      if (shouldPauseNow()) {
        clearPhaseTimer();
        cancelInFlight();
        clearAdvisorSurfaceRef.current?.({ clearPersona: true, force: true });
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
    if (typeof window === 'undefined') return undefined;
    let throttleUntil = 0;
    const onActivity = () => {
      const now = Date.now();
      const wakingFromIdle = idlePausedRef.current;
      if (!wakingFromIdle && now < throttleUntil) return;
      throttleUntil = now + ACTIVITY_THROTTLE_MS;
      lastActivityAtRef.current = now;
      if (wakingFromIdle && !mutedRef.current && !pauseRef.current) {
        idlePausedRef.current = false;
        scheduleNextRef.current?.(0);
      }
    };
    const events = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    for (const type of events) {
      window.addEventListener(type, onActivity, { passive: true });
    }
    return () => {
      for (const type of events) {
        window.removeEventListener(type, onActivity);
      }
    };
  }, []);

  useEffect(() => {
    if (pauseClearTimerRef.current != null) {
      clearTimeout(pauseClearTimerRef.current);
      pauseClearTimerRef.current = null;
    }

    if (isMuted) {
      clearAdvisorSurface({ clearPersona: true, force: true });
      setIsPinned(false);
      pinnedRef.current = false;
      cancelLoopRef.current?.({ resetStreak: false });
      return undefined;
    }

    if (!pause) {
      scheduleNextRef.current?.(GAP_MS);
      return undefined;
    }

    // Loading/streaming can flicker for a frame or two after a patch lands — debounce
    // the wipe so a freshly surfaced "is polishing…" chip is not eaten instantly.
    // Once a speech bubble has landed, leave it up: pause only blocks new ticks.
    // Clearing landed proposals here made the chip flash during think then vanish
    // when the reply arrived while loading/streaming was still true.
    pauseClearTimerRef.current = setTimeout(() => {
      pauseClearTimerRef.current = null;
      if (!pauseRef.current || mutedRef.current) return;
      if (proposalInFlightRef.current) return;
      if (suggestionRef.current) return;
      clearAdvisorSurface({ clearPersona: true, force: true });
      setIsPinned(false);
      pinnedRef.current = false;
      cancelLoopRef.current?.({ resetStreak: false });
    }, PAUSE_CLEAR_DEBOUNCE_MS);

    return () => {
      if (pauseClearTimerRef.current != null) {
        clearTimeout(pauseClearTimerRef.current);
        pauseClearTimerRef.current = null;
      }
    };
  }, [pause, isMuted, clearAdvisorSurface]);

  // Focus-change watcher: when the user clicks (selected) or hovers (hover) a
  // new part of the diagram, cancel any active bubble and trigger a fresh tick
  // targeting that focus. Hover debounces (avoid spam during rapid pointer
  // travel); click is near-instant (explicit intent).
  //
  // Hover must NOT cancel an in-flight think or a freshly shown bubble — pointer
  // travel over the canvas would otherwise eat the speech bubble right after
  // "is polishing…" resolves. Only explicit selection retargets aggressively.
  useEffect(() => {
    if (!focusKey) return undefined;
    if (mutedRef.current || pauseRef.current) return undefined;
    const debounce = focusSource === 'hover' ? HOVER_FOCUS_DEBOUNCE_MS : SELECT_FOCUS_DEBOUNCE_MS;
    const scheduledFocusKey = focusKey;
    const scheduledFocusSource = focusSource;
    const id = setTimeout(() => {
      if (pinnedRef.current) return;
      // Never abort an in-flight "is polishing…" chip — pointer/selection churn
      // used to flash thinking away before the speech bubble could land.
      if (thinkingPersonaRef.current) return;
      // Hover→selected on the same node is a stronger signal, not a new target.
      if (
        focusNodeId(scheduledFocusKey) &&
        focusNodeId(scheduledFocusKey) === focusNodeId(focusKeyRef.current)
      ) {
        return;
      }
      // If the in-flight fetch already landed for this same focus while we were
      // debouncing, do not wipe the bubble — a common regression path for the
      // Wise Architect "is musing…" → vanished comment transition.
      if (
        scheduledFocusKey === focusKeyRef.current &&
        scheduledFocusKey === suggestionFocusKeyRef.current &&
        suggestionRef.current &&
        activePersonaRef.current
      ) {
        return;
      }
      // Fresh suggestions need a short grace window so diagram highlights/selection
      // churn right after the first render does not flash the bubble away.
      if (
        suggestionRef.current &&
        activePersonaRef.current &&
        Date.now() - suggestionShownAtRef.current < FOCUS_CLEAR_GRACE_MS
      ) {
        return;
      }
      // Hover retarget: if a suggestion is already on screen (past grace), leave
      // it alone — only seed a tick when idle.
      if (scheduledFocusSource === 'hover') {
        if (suggestionRef.current && activePersonaRef.current) return;
      }
      if (suggestionRef.current || activePersonaRef.current) {
        clearAdvisorSurface({ clearPersona: true, force: true });
        setIsPinned(false);
        pinnedRef.current = false;
      }
      scheduleNextRef.current?.(0);
    }, debounce);
    return () => clearTimeout(id);
  }, [focusKey, focusSource, clearAdvisorSurface]);

  const dismiss = useCallback(() => {
    clearAdvisorSurface({ clearPersona: true, force: true });
    setIsPinned(false);
    pinnedRef.current = false;
    cancelLoopRef.current?.({ userDismissed: true });
  }, [clearAdvisorSurface]);

  const accept = useCallback(() => {
    if (!suggestion || !activePersona) return;
    // Comments are pure flavor and have no action — guard so a stray Do-it click
    // (e.g. via keyboard) on a comment-kind bubble doesn't accidentally fire a prompt.
    if (suggestionKind === 'comment') return;
    const text = suggestion;
    const persona = activePersona;
    clearAdvisorSurface({ clearPersona: true, force: true });
    setIsPinned(false);
    pinnedRef.current = false;
    try {
      onAcceptRef.current?.(text, persona);
    } finally {
      cancelLoopRef.current?.({ resetStreak: true });
    }
  }, [suggestion, suggestionKind, activePersona, clearAdvisorSurface]);

  const promptNext = useCallback((opts) => {
    promptNextRef.current?.(opts);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      writeAdvisorMuted(next);
      return next;
    });
  }, []);

  /**
   * Re-fetch the Wise Architect's current observation at the next dumb-down level.
   * Same progressive ladder as the radial "?" explainer (levels 1–6, then babble,
   * then "I give up" dismisses). Only meaningful for `activePersona === 'explain'`.
   */
  const dumbDown = useCallback(async () => {
    const persona = activePersona;
    const previous = suggestion;
    if (persona !== 'explain' || !previous) return;
    if (isDumbingDown) return;

    if (isLabelExplainGiveUpLevel(architectDumbLevel)) {
      dismiss();
      return;
    }

    const nextLevel =
      architectDumbLevel >= MAX_LABEL_EXPLAIN_DUMB_LEVEL
        ? LABEL_EXPLAIN_GIBBERISH_LEVEL
        : architectDumbLevel <= 0
          ? 1
          : architectDumbLevel + 1;
    const isGibberish = nextLevel === LABEL_EXPLAIN_GIBBERISH_LEVEL;

    setArchitectDumbLevel(nextLevel);
    setIsDumbingDown(true);
    // Pin while we fetch so the auto-dismiss can't snatch the bubble mid-request.
    if (!pinnedRef.current) {
      setIsPinned(true);
      pinnedRef.current = true;
      pauseTimerRef.current?.();
      cancelPendingRef.current?.();
    }

    try {
      const params = paramsRef.current;
      const sessionId = params.getSessionId?.() ?? '';
      const contentType = params.getContentType?.() ?? 'mermaid';
      const diagramSource = params.getDiagramSource?.() ?? '';
      const focusDescriptor = params.getFocusDescriptor?.() ?? null;
      const svgRoot = params.getSvgRoot?.() ?? null;
      const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
      const { labels } = getAdvisorVisibleLabels({
        contentType,
        host,
        diagramSource
      });

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
          mode: 'dumb',
          previousSuggestion: previous,
          ...(isGibberish ? { style: 'gibberish' } : { simpleLevel: nextLevel })
        })
      });
      if (!response.ok) {
        setError(`advisor ${response.status}`);
        setArchitectDumbLevel(architectDumbLevel);
        return;
      }
      const payload = await response.json();
      let text = typeof payload?.suggestion === 'string' ? payload.suggestion.trim() : '';
      if (!text && isGibberish) {
        text = fallbackLabelGibberish(focusDescriptor?.label || labels?.[0] || previous);
      }
      if (!text) {
        setArchitectDumbLevel(architectDumbLevel);
        return;
      }
      const replyIds = Array.isArray(payload?.highlightIds) ? payload.highlightIds : [];
      setSuggestion(text);
      setSuggestionKind('comment');
      if (replyIds.length > 0) setHighlightIds(replyIds);
      setProposalHistory((prev) => {
        if (prev.index < 0 || !prev.entries[prev.index]) return prev;
        const entries = prev.entries.map((e, i) =>
          i === prev.index
            ? {
                ...e,
                suggestion: text,
                suggestionKind: 'comment',
                highlightIds: replyIds.length > 0 ? replyIds : e.highlightIds
              }
            : e
        );
        const next = { ...prev, entries };
        proposalHistoryRef.current = next;
        return next;
      });
      setError(null);
    } catch (err) {
      setArchitectDumbLevel(architectDumbLevel);
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'advisor error');
      }
    } finally {
      setIsDumbingDown(false);
    }
  }, [activePersona, suggestion, isDumbingDown, architectDumbLevel, dismiss]);

  const togglePin = useCallback(() => {
    setIsPinned((prev) => {
      const next = !prev;
      pinnedRef.current = next;
      if (next) {
        pauseTimerRef.current?.();
        cancelPendingRef.current?.();
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

  const canGoBack = proposalHistory.index > 0;
  const canGoForward =
    proposalHistory.index >= 0 && proposalHistory.index < proposalHistory.entries.length - 1;
  const showHistoryNav = proposalHistory.entries.length > 1;
  const historyPositionLabel =
    proposalHistory.entries.length > 0
      ? `${proposalHistory.index + 1} of ${proposalHistory.entries.length}`
      : '';

  const goBack = useCallback(() => {
    setProposalHistory((prev) => {
      if (prev.index <= 0) return prev;
      const index = prev.index - 1;
      applyHistoryEntry(prev.entries[index]);
      const next = { ...prev, index };
      proposalHistoryRef.current = next;
      syncDismissTimerForHistory(index, prev.entries.length);
      return next;
    });
  }, [applyHistoryEntry, syncDismissTimerForHistory]);

  /** @deprecated UI uses promptNext; kept for tests that walk queued history. */
  const goForward = useCallback(() => {
    setProposalHistory((prev) => {
      if (prev.index < 0 || prev.index >= prev.entries.length - 1) return prev;
      const index = prev.index + 1;
      applyHistoryEntry(prev.entries[index]);
      const next = { ...prev, index };
      proposalHistoryRef.current = next;
      syncDismissTimerForHistory(index, prev.entries.length);
      return next;
    });
  }, [applyHistoryEntry, syncDismissTimerForHistory]);

  const diagramHasText = Boolean((paramsRef.current.getDiagramSource?.() ?? '').trim());
  const canPromptNext = !thinkingPersona && !pause && !isMuted && diagramHasText;

  return {
    activePersona,
    thinkingPersona,
    suggestion,
    suggestionKind,
    highlightIds,
    isMuted,
    isPinned,
    isDumbingDown,
    architectDumbLevel,
    error,
    toggleMute,
    togglePin,
    pauseTimer,
    resumeTimer,
    dismiss,
    accept,
    dumbDown,
    canGoBack,
    canGoForward,
    showHistoryNav,
    historyPositionLabel,
    goBack,
    goForward,
    promptNext,
    canPromptNext
  };
}
