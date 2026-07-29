import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';
import { officeDialogueLocale } from '../utils/officeCast.js';
import {
  endOfficeHuddle,
  getOfficeSnapshot,
  pauseOfficeHuddleForWatching,
  resumeOfficeHuddleSpeaking,
  setOfficeHuddleBeats,
  startOfficeHuddle,
  subscribe,
  upsertOfficeHuddleBeat
} from '../state/officeMomentStore.js';

export const HUDDLE_FETCH_TIMEOUT_MS = 20_000;
export const HUDDLE_SUGGEST_TIMEOUT_MS = 18_000;

/** Everything the server needs to know about what the huddle is looking at. */
function huddleContext(params, attendees) {
  const contentType = params.getContentType?.() ?? 'mermaid';
  const diagramSource = params.getDiagramSource?.() ?? '';
  const svgRoot = params.getSvgRoot?.() ?? null;
  const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
  const { labels } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
  return {
    contentType,
    diagramSource,
    visibleLabels: labels,
    attendees,
    uiLocale: officeDialogueLocale()
  };
}

/**
 * One call, one remark each. Returns null on any failure — an empty huddle is a
 * feature (everyone wanders off), never an error toast. Same doctrine as
 * /api/office/meeting.
 */
async function fetchHuddleScript(body, sessionId, controller) {
  const timeoutId = setTimeout(() => controller.abort(), HUDDLE_FETCH_TIMEOUT_MS);
  try {
    const headers = { 'content-type': 'application/json' };
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    const response = await fetch(`${API_BASE_URL}/api/office/huddle`, {
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
  }
}

/**
 * On-spot suggestion for a teammate you clicked before (or after) their turn.
 * Reuses /api/advisor/suggest so the voice matches the proactive roundtable that
 * the huddle replaced — one remark, optional Do-it when the kind is actionable.
 */
async function fetchSpeakerSuggestion(body, sessionId, controller) {
  const timeoutId = setTimeout(() => controller.abort(), HUDDLE_SUGGEST_TIMEOUT_MS);
  try {
    const headers = { 'content-type': 'application/json' };
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    const response = await fetch(`${API_BASE_URL}/api/advisor/suggest`, {
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
  }
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

/** Hand the ring its lines, or dissolve it when nobody had anything to say. */
function applyHuddleResponse(huddleId, payload, onUsage) {
  reportUsage(onUsage, payload);
  const beats = payload?.script?.beats;
  if (!Array.isArray(beats) || beats.length === 0) {
    endOfficeHuddle(huddleId);
    return;
  }
  setOfficeHuddleBeats(huddleId, beats);
}

/**
 * Team huddle playback (docs/office-parody.md).
 *
 * The face-to-face counterpart to `useMeetingPlayback`, and deliberately much
 * smaller than it: no beat grammar, no facilitator, no interjections, and no
 * pacing of its own. `POST /api/office/huddle` returns one remark per teammate
 * in one call; the ring is seated *before* the call so the crowd arriving is
 * the feedback that the click landed, and `HuddleOverlay` walks the remarks
 * through the shared `useScenePacing`.
 *
 * State lives in `officeMomentStore` rather than here so a future isometric
 * renderer can draw the same huddle without forking it (ADR-0011 rule 1).
 *
 * Cancellation is a monotonic `generationRef`, same as the meeting hook: a Hard
 * stop mid-flight must not let a late response re-seat a huddle the user closed.
 *
 * @param {{
 *   getSessionId?: () => string,
 *   getContentType?: () => string,
 *   getDiagramSource?: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   onUsage?: (usage: { inputTokens: number, outputTokens: number, model: string | null }) => void,
 *   onCancelNarration?: () => void
 * }} params
 */
export function useHuddlePlayback(params) {
  const snapshot = useSyncExternalStore(subscribe, getOfficeSnapshot, getOfficeSnapshot);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const abortRef = useRef(/** @type {AbortController | null} */ (null));
  const suggestAbortRef = useRef(/** @type {AbortController | null} */ (null));
  const generationRef = useRef(0);
  const suggestGenerationRef = useRef(0);

  const endHuddle = useCallback(() => {
    generationRef.current += 1;
    suggestGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    suggestAbortRef.current?.abort();
    suggestAbortRef.current = null;
    paramsRef.current.onCancelNarration?.();
    endOfficeHuddle();
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      suggestGenerationRef.current += 1;
      abortRef.current?.abort();
      suggestAbortRef.current?.abort();
      paramsRef.current.onCancelNarration?.();
    },
    []
  );

  const startHuddle = useCallback(async (attendees) => {
    const seats = (Array.isArray(attendees) ? attendees : []).filter(Boolean);
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    suggestAbortRef.current?.abort();

    const huddleId = startOfficeHuddle(seats);
    if (!huddleId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const p = paramsRef.current;
    const payload = await fetchHuddleScript(
      huddleContext(p, seats),
      p.getSessionId?.() ?? '',
      controller
    );
    if (abortRef.current === controller) abortRef.current = null;
    if (generation !== generationRef.current) return;

    applyHuddleResponse(huddleId, payload, paramsRef.current.onUsage);
  }, []);

  /**
   * Click a head that has not spoken yet → pull one on-spot suggestion and pin
   * it into the beat list so Do-it / history work the same as scripted remarks.
   */
  const requestSpeakerSuggestion = useCallback(async (speakerId) => {
    const id = typeof speakerId === 'string' ? speakerId.trim() : '';
    if (!id) return null;
    const current = getOfficeSnapshot().huddle;
    if (!current) return null;
    if (!current.attendees.includes(id)) return null;

    const existing =
      (current.beats ?? []).find((b) => b.speakerId === id) ?? current.suggestions?.[id] ?? null;
    if (existing?.text) return existing;

    const generation = ++suggestGenerationRef.current;
    suggestAbortRef.current?.abort();
    const controller = new AbortController();
    suggestAbortRef.current = controller;
    const p = paramsRef.current;
    const ctx = huddleContext(p, current.attendees);
    const lastSuggestions = (current.beats ?? [])
      .map((b) => b.text)
      .filter(Boolean)
      .slice(-8);
    const payload = await fetchSpeakerSuggestion(
      {
        persona: id,
        contentType: ctx.contentType,
        diagramSource: ctx.diagramSource,
        visibleLabels: ctx.visibleLabels,
        lastSuggestions
      },
      p.getSessionId?.() ?? '',
      controller
    );
    if (suggestAbortRef.current === controller) suggestAbortRef.current = null;
    if (generation !== suggestGenerationRef.current) return null;
    if (!getOfficeSnapshot().huddle || getOfficeSnapshot().huddle.id !== current.id) return null;

    reportUsage(paramsRef.current.onUsage, payload);
    const text = typeof payload?.suggestion === 'string' ? payload.suggestion.trim() : '';
    if (!text) return null;
    const rawKind = typeof payload?.kind === 'string' ? payload.kind.toLowerCase() : '';
    // Richard is comment-only; everyone else gets a Do-it that delegates the ask.
    const actionable = id !== 'richard' && rawKind !== 'comment';
    const beat = {
      speakerId: id,
      text,
      ...(actionable ? { actionPrompt: text } : {})
    };
    // Record beside the scripted beats so pinning works across renderers, but do
    // not grow the spoken queue mid-scene (that would restart useScenePacing).
    upsertOfficeHuddleBeat(current.id, beat, { pacing: false });
    return beat;
  }, []);

  const pauseForWatching = useCallback(() => {
    const current = getOfficeSnapshot().huddle;
    if (!current) return;
    paramsRef.current.onCancelNarration?.();
    pauseOfficeHuddleForWatching(current.id);
  }, []);

  const resumeSpeaking = useCallback(() => {
    const current = getOfficeSnapshot().huddle;
    if (!current) return;
    resumeOfficeHuddleSpeaking(current.id);
  }, []);

  return {
    huddle: snapshot.huddle,
    startHuddle,
    endHuddle,
    requestSpeakerSuggestion,
    pauseForWatching,
    resumeSpeaking
  };
}
