import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';
import { officeMeetingCopy, MEETING_FACILITATOR } from '../utils/officeCast.js';

export const MEETING_FETCH_TIMEOUT_MS = 25_000;
export const MEETING_INTERJECTION_CAP = 2;
/** The user's speakerId in the transcript (never sent to the server as a seat). */
export const MEETING_USER_SPEAKER = 'you';

const BEAT_BASE_DELAY_MS = { procedural: 2200, smalltalk: 2600, substantive: 4600, offRails: 3200 };
const BEAT_PER_CHAR_MS = 18;
const BEAT_MAX_DELAY_MS = 7000;

export function beatDelayMs(beat) {
  const base = BEAT_BASE_DELAY_MS[beat?.kind] ?? 2600;
  const length = typeof beat?.text === 'string' ? beat.text.length : 0;
  return Math.min(BEAT_MAX_DELAY_MS, base + length * BEAT_PER_CHAR_MS);
}

function reportUsage(onUsage, payload) {
  const usage = payload?.usage;
  if (!usage || typeof usage !== 'object') return;
  onUsage?.({
    inputTokens: Number.isFinite(Number(usage.inputTokens)) ? Number(usage.inputTokens) : 0,
    outputTokens: Number.isFinite(Number(usage.outputTokens)) ? Number(usage.outputTokens) : 0,
    model: typeof payload.model === 'string' ? payload.model : null
  });
}

/**
 * WG meeting playback state machine (docs/office-parody.md).
 *
 * `POST /api/office/meeting` returns the entire beat script in one cheap LLM
 * call; this hook paces it beat-by-beat client-side so it *feels* live (the
 * join latency hides behind an in-fiction "waiting to be admitted" gag).
 * "Raise hand" interjections re-fetch only the remaining beats. Deliberately
 * no SSE in v1 — the script exists before the first byte is useful, and local
 * timers are trivially testable (scriptVersion in the response leaves room
 * for a per-turn v2).
 *
 * Optional `narrateBeat(beat) → Promise<{spoken?: boolean}>` speaks each
 * non-user line (walk-bys/meetings are the spoken surfaces — emails stay
 * silent). When synthesis actually speaks, pacing follows the voice; when it
 * returns spoken:false (muted / unavailable), the reading-pace timer is used.
 *
 * States: null → 'joining' → 'playing' → 'ended' (completed or left early),
 * or 'cancelled' when the script fetch fails (OfficeLayer converts that into
 * a canned cancellation email).
 */
export function useMeetingPlayback({
  getSessionId,
  getContentType,
  getDiagramSource,
  getSvgRoot,
  onUsage,
  narrateBeat,
  narrationGapMs,
  onCancelNarration
}) {
  const [meeting, setMeeting] = useState(null);
  const paramsRef = useRef({
    getSessionId,
    getContentType,
    getDiagramSource,
    getSvgRoot,
    onUsage,
    narrateBeat,
    narrationGapMs,
    onCancelNarration
  });
  useEffect(() => {
    paramsRef.current = {
      getSessionId,
      getContentType,
      getDiagramSource,
      getSvgRoot,
      onUsage,
      narrateBeat,
      narrationGapMs,
      onCancelNarration
    };
  });

  const pendingBeatsRef = useRef([]);
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const generationRef = useRef(0);
  // Ref-backed state: transitions read meetingRef synchronously (React state
  // updaters are async), then mirror into useState for rendering.
  const meetingRef = useRef(null);
  const applyMeeting = useCallback((next) => {
    meetingRef.current = typeof next === 'function' ? next(meetingRef.current) : next;
    setMeeting(meetingRef.current);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      clearTimer();
      abortRef.current?.abort();
      paramsRef.current.onCancelNarration?.();
    },
    [clearTimer]
  );

  const diagramContext = useCallback(() => {
    const p = paramsRef.current;
    const contentType = p.getContentType?.() ?? 'mermaid';
    const diagramSource = p.getDiagramSource?.() ?? '';
    const svgRoot = p.getSvgRoot?.() ?? null;
    const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
    const { labels } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
    return { contentType, diagramSource, visibleLabels: labels };
  }, []);

  const postJson = useCallback(async (path, body) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), MEETING_FETCH_TIMEOUT_MS);
    try {
      const headers = { 'content-type': 'application/json' };
      const sessionId = paramsRef.current.getSessionId?.() ?? '';
      if (sessionId) headers[SESSION_HEADER] = sessionId;
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const scheduleNextBeat = useCallback(
    (generation) => {
      clearTimer();
      const nextBeat = pendingBeatsRef.current[0];
      if (!nextBeat) {
        applyMeeting((prev) =>
          prev && prev.state === 'playing' ? { ...prev, state: 'ended', completed: true } : prev
        );
        return;
      }

      const narrate = paramsRef.current.narrateBeat;
      const useNarration =
        typeof narrate === 'function' && nextBeat.speakerId !== MEETING_USER_SPEAKER;

      if (useNarration) {
        // Reveal the line immediately so the seat highlight matches the voice,
        // speak it, then advance — falls back to the reading-pace delay when
        // synthesis is muted/unavailable (narrateBeat returns spoken:false).
        pendingBeatsRef.current = pendingBeatsRef.current.slice(1);
        applyMeeting((prev) => {
          if (!prev || prev.state !== 'playing') return prev;
          return { ...prev, transcript: [...prev.transcript, nextBeat] };
        });
        void (async () => {
          let spoken = false;
          try {
            const result = await narrate(nextBeat);
            spoken = Boolean(result?.spoken);
          } catch {
            spoken = false;
          }
          if (generation !== generationRef.current) return;
          const waitMs = spoken ? (paramsRef.current.narrationGapMs ?? 400) : beatDelayMs(nextBeat);
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            if (generation !== generationRef.current) return;
            scheduleNextBeat(generation);
          }, waitMs);
        })();
        return;
      }

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (generation !== generationRef.current) return;
        pendingBeatsRef.current = pendingBeatsRef.current.slice(1);
        applyMeeting((prev) => {
          if (!prev || prev.state !== 'playing') return prev;
          return { ...prev, transcript: [...prev.transcript, nextBeat] };
        });
        scheduleNextBeat(generation);
      }, beatDelayMs(nextBeat));
    },
    [clearTimer, applyMeeting]
  );

  const startMeeting = useCallback(
    async ({ attendees, topic } = {}) => {
      const generation = ++generationRef.current;
      const seats = Array.isArray(attendees) && attendees.length > 0 ? attendees : null;
      if (!seats) return;
      clearTimer();
      pendingBeatsRef.current = [];
      applyMeeting({
        state: 'joining',
        title: officeMeetingCopy().inviteFallbackTitle,
        attendees: seats,
        facilitatorId: seats.includes(MEETING_FACILITATOR) ? MEETING_FACILITATOR : seats[0],
        transcript: [],
        completed: false,
        interjectionsLeft: MEETING_INTERJECTION_CAP
      });
      const payload = await postJson('/api/office/meeting', {
        ...diagramContext(),
        attendees: seats,
        ...(topic ? { topic } : {})
      });
      if (generation !== generationRef.current) return;
      reportUsage(paramsRef.current.onUsage, payload);
      const script = payload?.script;
      if (!script || !Array.isArray(script.beats) || script.beats.length === 0) {
        applyMeeting((prev) => (prev ? { ...prev, state: 'cancelled' } : prev));
        return;
      }
      pendingBeatsRef.current = script.beats;
      applyMeeting((prev) =>
        prev ? { ...prev, state: 'playing', title: script.title || prev.title } : prev
      );
      scheduleNextBeat(generation);
    },
    [clearTimer, diagramContext, postJson, scheduleNextBeat, applyMeeting]
  );

  const interject = useCallback(
    async (text) => {
      const line = String(text ?? '').trim();
      if (!line) return;
      const generation = generationRef.current;
      const snapshot = meetingRef.current;
      if (!snapshot || snapshot.state !== 'playing' || snapshot.interjectionsLeft <= 0) return;
      applyMeeting({
        ...snapshot,
        interjectionsLeft: snapshot.interjectionsLeft - 1,
        transcript: [
          ...snapshot.transcript,
          { speakerId: MEETING_USER_SPEAKER, kind: 'user', text: line }
        ]
      });
      clearTimer();
      paramsRef.current.onCancelNarration?.();
      const remainingBeats = pendingBeatsRef.current;
      const payload = await postJson('/api/office/meeting/interject', {
        ...diagramContext(),
        attendees: snapshot.attendees,
        transcriptSoFar: [
          ...snapshot.transcript.map((b) => `${b.speakerId}: ${b.text}`),
          `you: ${line}`
        ].slice(-20),
        interjection: line
      });
      if (generation !== generationRef.current) return;
      reportUsage(paramsRef.current.onUsage, payload);
      const revised =
        Array.isArray(payload?.beats) && payload.beats.length > 0 ? payload.beats : null;
      if (revised) {
        pendingBeatsRef.current = revised;
      } else {
        // Offline / parse failure: the facilitator parks the point, meeting rolls on.
        pendingBeatsRef.current = [
          {
            speakerId: snapshot.facilitatorId,
            kind: 'procedural',
            text: officeMeetingCopy()
              .interjectCapLine.replace(/^[^:]+:\s*/, '')
              .replace(/^"|"$/g, '')
          },
          ...remainingBeats
        ];
      }
      scheduleNextBeat(generation);
    },
    [clearTimer, diagramContext, postJson, scheduleNextBeat, applyMeeting]
  );

  const leaveMeeting = useCallback(() => {
    generationRef.current += 1;
    clearTimer();
    abortRef.current?.abort();
    pendingBeatsRef.current = [];
    paramsRef.current.onCancelNarration?.();
    applyMeeting((prev) =>
      prev && (prev.state === 'playing' || prev.state === 'joining')
        ? { ...prev, state: 'ended', completed: false }
        : prev
    );
  }, [clearTimer, applyMeeting]);

  const closeMeeting = useCallback(() => {
    generationRef.current += 1;
    clearTimer();
    abortRef.current?.abort();
    pendingBeatsRef.current = [];
    paramsRef.current.onCancelNarration?.();
    applyMeeting(null);
  }, [clearTimer, applyMeeting]);

  return { meeting, startMeeting, interject, leaveMeeting, closeMeeting };
}

/** Substantive transcript beats become the actionable meeting minutes. */
export function meetingMinutes(meeting) {
  if (!meeting) return [];
  return meeting.transcript.filter((beat) => beat.kind === 'substantive');
}
