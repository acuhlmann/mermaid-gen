import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { OFFICE_DIAGRAM_SOURCE_MAX_CHARS } from '@archislop/shared';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';
import { officeDialogueLocale } from '../utils/officeCast.js';
import { officeWireModelProfile } from '../utils/officeMomentDelivery.js';
import { getOfficeLogDigest } from '../state/officeLogStore.js';
import {
  beginOfficeHuddleTurn,
  endOfficeHuddle,
  getOfficeSnapshot,
  PAIR_TURNS_MAX,
  pauseOfficeHuddleForWatching,
  recordOfficePairTurn,
  refreshOfficeHuddleBeats,
  resumeOfficeHuddleSpeaking,
  setOfficeHuddleAwaitingReply,
  setOfficeHuddleBeats,
  startOfficeHuddle,
  subscribe,
  upsertOfficeHuddleBeat
} from '../state/officeMomentStore.js';
import { usePairInitiative } from './usePairInitiative.js';

export const HUDDLE_FETCH_TIMEOUT_MS = 20_000;
export const HUDDLE_SUGGEST_TIMEOUT_MS = 18_000;
/** A reply turn asks for one short line, so it gets a tighter budget than an opening script. */
export const HUDDLE_REPLY_TIMEOUT_MS = 14_000;
/** Debounce canvas edits before re-scripting unspoken huddle remarks. */
export const HUDDLE_DIAGRAM_REFRESH_DEBOUNCE_MS = 700;

/** Cap on what your own line contributes to the next prompt. */
const PAIR_REPLY_MAX_CHARS = 400;

/** Stable fingerprint for diagram refresh — content type + trimmed source. */
export function huddleDiagramFingerprint(contentType, diagramSource) {
  const source = typeof diagramSource === 'string' ? diagramSource.trim() : '';
  return `${contentType || 'mermaid'}::${source}`;
}

/**
 * Fold a landed script into the pairing transcript.
 *
 * Only the pair keeps one: the model has to see what it said before it can
 * answer what you said next. A mob's beats are one remark per person with no
 * follow-up to write, so its transcript would only ever grow.
 */
function recordPartnerTurns(mode, beats) {
  if (mode !== 'pair' || !Array.isArray(beats)) return;
  for (const beat of beats) {
    if (typeof beat?.text === 'string' && beat.text.trim()) {
      recordOfficePairTurn(null, 'partner', beat.text);
    }
  }
}

/** What you said, trimmed and clamped; '' when there is nothing to send. */
function trimmedPairReply(text) {
  return typeof text === 'string' ? text.trim().slice(0, PAIR_REPLY_MAX_CHARS) : '';
}

/**
 * The pair that can be answered right now, or null.
 *
 * `awaitingReply` is the gate that keeps a second question from queueing on top
 * of the first: one turn at a time, because the answer to the first has not
 * arrived yet and two in flight would race for the same transcript.
 */
function answerablePair() {
  const huddle = getOfficeSnapshot().huddle;
  if (!huddle || huddle.mode !== 'pair' || huddle.awaitingReply) return null;
  return huddle;
}

/**
 * Ask for the next line, carrying the transcript and the canvas as it is NOW.
 *
 * Reading the canvas at reply time is what replaces the mob's mid-scene
 * re-script: a pair that has been sitting through your edits is not still
 * talking about the diagram you both stopped looking at, and no already-spoken
 * line is ever rewritten to get there.
 *
 * `userTurn` (what you said, or the edit you made) rides on the request but is
 * NOT yet in the store's transcript — see `applyPairReplyTurn`, which commits
 * it only once an answer lands. A lull has no user turn at all: nobody said
 * anything, which is the point of it.
 */
async function fetchPairReplyTurn({ params, controller, cue, userTurn }) {
  const live = getOfficeSnapshot().huddle;
  const ctx = huddleContext(params, live?.attendees ?? [], 'pair');
  const turns = [...(live?.turns ?? []), ...(userTurn ? [userTurn] : [])].slice(-PAIR_TURNS_MAX);
  const payload = await fetchHuddleScript(
    { ...ctx, turns, cue },
    params.getSessionId?.() ?? '',
    controller,
    HUDDLE_REPLY_TIMEOUT_MS
  );
  return { ctx, payload };
}

/**
 * Land one answered turn.
 *
 * The new beat REPLACES the queue rather than joining it — see
 * `beginOfficeHuddleTurn` for why that is the whole trick. An empty answer is
 * not a dismissal: the flag comes back off so the strip accepts another try,
 * and the pair stays seated.
 *
 * Both halves of the exchange are written here and nowhere earlier. Recording
 * your line before the request is what makes a retry say it twice: the failure
 * path leaves it in `turns`, the strip invites another go, and the model gets
 * two user lines with no partner line between them — and keeps getting them,
 * because each failure pushes an older partner line out of the 12-turn window.
 *
 * @returns {object | null} the beat that landed
 */
function applyPairReplyTurn(huddleId, beats, { fingerprint, userTurn }) {
  if (!Array.isArray(beats) || beats.length === 0) {
    setOfficeHuddleAwaitingReply(huddleId, false);
    return null;
  }
  if (userTurn) recordOfficePairTurn(huddleId, userTurn.role, userTurn.text);
  beginOfficeHuddleTurn(huddleId, beats, { diagramFingerprint: fingerprint });
  recordPartnerTurns('pair', beats);
  return beats[0];
}

/** What the scene is looking at, read once so every caller agrees on it. */
function readSceneCanvas(params) {
  const contentType = params.getContentType?.() ?? 'mermaid';
  const rawSource = params.getDiagramSource?.() ?? '';
  const diagramSource =
    typeof rawSource === 'string' ? rawSource.slice(0, OFFICE_DIAGRAM_SOURCE_MAX_CHARS) : '';
  const svgRoot = params.getSvgRoot?.() ?? null;
  const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
  const { labels, ids } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
  return { contentType, diagramSource, labels, ids };
}

/**
 * The ids a beat is allowed to point at.
 *
 * Mermaid only: every other extractor returns the labels themselves as `ids`,
 * and only a rendered `g.node` has an id the canvas can resolve and put a hand
 * on. Sending label-copies as ids would ask the model to point at things it
 * cannot point at.
 */
function pointableIdsFor(contentType, ids) {
  if (contentType !== 'mermaid' || !Array.isArray(ids)) return [];
  return ids;
}

/** Everything the server needs to know about what the scene is looking at. */
function huddleContext(params, attendees, mode = 'mob') {
  const canvas = readSceneCanvas(params);
  return {
    contentType: canvas.contentType,
    diagramSource: canvas.diagramSource,
    visibleLabels: canvas.labels,
    visibleIds: pointableIdsFor(canvas.contentType, canvas.ids),
    attendees,
    mode,
    // Your own team, crowded around your screen — the surface with the most
    // standing to say "wasn't that the thing from this morning".
    officeLog: getOfficeLogDigest(),
    uiLocale: officeDialogueLocale(),
    modelProfile: officeWireModelProfile(params.getModelProfile?.())
  };
}

/**
 * One call, one remark each. Returns null on any failure — an empty huddle is a
 * feature (everyone wanders off), never an error toast. Same doctrine as
 * /api/office/meeting.
 */
async function fetchHuddleScript(body, sessionId, controller, timeoutMs = HUDDLE_FETCH_TIMEOUT_MS) {
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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
function applyHuddleResponse(
  huddleId,
  payload,
  onUsage,
  { mergeFromIndex = null, fingerprint = '' } = {}
) {
  reportUsage(onUsage, payload);
  const beats = payload?.script?.beats;
  if (!Array.isArray(beats) || beats.length === 0) {
    if (mergeFromIndex == null) endOfficeHuddle(huddleId);
    return;
  }
  if (mergeFromIndex != null) {
    refreshOfficeHuddleBeats(huddleId, mergeFromIndex, beats, fingerprint);
    return;
  }
  setOfficeHuddleBeats(huddleId, beats, { diagramFingerprint: fingerprint });
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
 *   getDiagramWatchKey?: () => string,
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
  const refreshAbortRef = useRef(/** @type {AbortController | null} */ (null));
  const suggestAbortRef = useRef(/** @type {AbortController | null} */ (null));
  const replyAbortRef = useRef(/** @type {AbortController | null} */ (null));
  const generationRef = useRef(0);
  const refreshGenerationRef = useRef(0);
  const suggestGenerationRef = useRef(0);
  const replyGenerationRef = useRef(0);
  const diagramFingerprintRef = useRef('');
  const [diagramWatchKey, setDiagramWatchKey] = useState('');

  // Poll the canvas fingerprint while a huddle is live — diagram state lives
  // outside officeMomentStore, so a store subscription alone cannot see edits.
  useEffect(() => {
    if (!snapshot.huddle) {
      setDiagramWatchKey('');
      return undefined;
    }
    const read = () => {
      const p = paramsRef.current;
      const key =
        typeof p.getDiagramWatchKey === 'function'
          ? p.getDiagramWatchKey()
          : huddleDiagramFingerprint(
              p.getContentType?.() ?? 'mermaid',
              p.getDiagramSource?.() ?? ''
            );
      setDiagramWatchKey(key);
    };
    read();
    const id = setInterval(read, 350);
    return () => clearInterval(id);
  }, [snapshot.huddle?.id]);

  const endHuddle = useCallback(() => {
    generationRef.current += 1;
    refreshGenerationRef.current += 1;
    suggestGenerationRef.current += 1;
    replyGenerationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = null;
    suggestAbortRef.current?.abort();
    suggestAbortRef.current = null;
    replyAbortRef.current?.abort();
    replyAbortRef.current = null;
    paramsRef.current.onCancelNarration?.();
    endOfficeHuddle();
  }, []);

  useEffect(
    () => () => {
      generationRef.current += 1;
      refreshGenerationRef.current += 1;
      suggestGenerationRef.current += 1;
      replyGenerationRef.current += 1;
      abortRef.current?.abort();
      refreshAbortRef.current?.abort();
      suggestAbortRef.current?.abort();
      replyAbortRef.current?.abort();
      paramsRef.current.onCancelNarration?.();
    },
    []
  );

  const refreshHuddleForDiagram = useCallback(async (huddleId, mergeFromIndex, priorBeats) => {
    const generation = ++refreshGenerationRef.current;
    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    const p = paramsRef.current;
    const ctx = huddleContext(p, getOfficeSnapshot().huddle?.attendees ?? []);
    const fingerprint = huddleDiagramFingerprint(ctx.contentType, ctx.diagramSource);
    const payload = await fetchHuddleScript(
      { ...ctx, attendees: getOfficeSnapshot().huddle?.attendees ?? [], priorBeats },
      p.getSessionId?.() ?? '',
      controller
    );
    if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
    if (generation !== refreshGenerationRef.current) return;
    const current = getOfficeSnapshot().huddle;
    if (!current || current.id !== huddleId) return;
    applyHuddleResponse(huddleId, payload, paramsRef.current.onUsage, {
      mergeFromIndex,
      fingerprint
    });
    diagramFingerprintRef.current = fingerprint;
  }, []);

  /**
   * @param {string[]} attendees
   * @param {{ mode?: 'mob' | 'pair' }} [opts] `pair` seats exactly one person
   *   and asks for a script written for a single voice.
   */
  const startHuddle = useCallback(async (attendees, { mode = 'mob' } = {}) => {
    const seats = (Array.isArray(attendees) ? attendees : []).filter(Boolean);
    const generation = ++generationRef.current;
    abortRef.current?.abort();
    suggestAbortRef.current?.abort();

    const huddleId = startOfficeHuddle(seats, { mode });
    if (!huddleId) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const p = paramsRef.current;
    const ctx = huddleContext(p, seats, mode);
    const fingerprint = huddleDiagramFingerprint(ctx.contentType, ctx.diagramSource);
    const payload = await fetchHuddleScript(ctx, p.getSessionId?.() ?? '', controller);
    if (abortRef.current === controller) abortRef.current = null;
    if (generation !== generationRef.current) return;

    applyHuddleResponse(huddleId, payload, paramsRef.current.onUsage, { fingerprint });
    diagramFingerprintRef.current = fingerprint;
    recordPartnerTurns(mode, getOfficeSnapshot().huddle?.beats);
  }, []);

  /**
   * The person in the chair says their next line — one call, one beat, its
   * own turn — for one of three reasons (`cue`): you answered them (`reply`),
   * you just changed the canvas while they watched (`edit`), or you have been
   * quietly working for a while (`lull`).
   *
   * The transcript goes up with the canvas as it is *now*, so a pair that has
   * been sitting through your edits is not still talking about the diagram you
   * both stopped looking at; that is what replaces the mob's mid-scene
   * re-script, without ever rewriting a line the user already heard.
   *
   * A failure leaves the pair seated and in `listening` rather than ending the
   * scene: they are still next to you, they just did not answer, and the reply
   * strip is still there to try again.
   *
   * @param {{ cue: 'reply' | 'edit' | 'lull', userTurn?: { role: 'you' | 'edit', text: string } | null }} ask
   * @returns {Promise<object | null>} the beat, or null when nothing came back
   */
  const askPartner = useCallback(async ({ cue, userTurn = null }) => {
    const current = answerablePair();
    if (!current) return null;

    // Your line goes up with the request but is not written to the transcript
    // yet — see `applyPairReplyTurn`. A failure that recorded it first would
    // leave the pair remembering a question you are about to ask again.
    setOfficeHuddleAwaitingReply(current.id, true);

    const generation = ++replyGenerationRef.current;
    replyAbortRef.current?.abort();
    const controller = new AbortController();
    replyAbortRef.current = controller;

    const params = paramsRef.current;
    try {
      const { ctx, payload } = await fetchPairReplyTurn({ params, controller, cue, userTurn });
      // Both guards run before anything is written: a late answer must not land
      // on a scene that was ended or replaced while it was in flight.
      if (generation !== replyGenerationRef.current) return null;
      if (getOfficeSnapshot().huddle?.id !== current.id) return null;

      reportUsage(params.onUsage, payload);
      const fingerprint = huddleDiagramFingerprint(ctx.contentType, ctx.diagramSource);
      const beat = applyPairReplyTurn(current.id, payload?.script?.beats, {
        fingerprint,
        userTurn
      });
      if (beat) diagramFingerprintRef.current = fingerprint;
      return beat;
    } finally {
      if (replyAbortRef.current === controller) replyAbortRef.current = null;
    }
  }, []);

  /**
   * You answered the person in the chair — get their next line.
   *
   * @param {string} text what you said
   * @returns {Promise<object | null>} the beat, or null when nothing came back
   */
  const continuePairing = useCallback(
    async (text) => {
      const reply = trimmedPairReply(text);
      if (!reply) return null;
      return askPartner({ cue: 'reply', userTurn: { role: 'you', text: reply } });
    },
    [askPartner]
  );

  // They also speak without being spoken to: a reaction to an edit you just
  // made, and now and then a remark after you have gone quiet.
  usePairInitiative({
    huddle: snapshot.huddle,
    diagramWatchKey,
    readCanvas: () => readSceneCanvas(paramsRef.current),
    askPartner
  });

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
        lastSuggestions,
        officeLog: ctx.officeLog
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

  /*
   * When the canvas changes mid-mob, re-script remarks nobody has spoken yet.
   *
   * Mob only, and not as a simplification: the replacement is exactly one beat
   * per teammate who has not spoken, so the total line count is unchanged and
   * `useScenePacing` keeps its place. A pair has no such invariant — one voice's
   * script can come back longer or shorter, which restarts the pacing loop and
   * re-speaks lines the user already heard. Pairing instead stays scripted from
   * when they sat down; clicking the seat is how you ask them again.
   */
  useEffect(() => {
    const huddle = snapshot.huddle;
    if (!huddle) {
      diagramFingerprintRef.current = '';
      return undefined;
    }
    if (huddle.mode === 'pair') return undefined;
    if (huddle.phase !== 'speaking' && huddle.phase !== 'watching') return undefined;
    if (!huddle.beats?.length) return undefined;
    if (!diagramWatchKey) return undefined;

    const stored = huddle.diagramFingerprint || diagramFingerprintRef.current;
    if (!stored || diagramWatchKey === stored) return undefined;

    const timer = setTimeout(() => {
      const current = getOfficeSnapshot().huddle;
      if (!current || current.id !== huddle.id) return;
      if (current.phase !== 'speaking' && current.phase !== 'watching') return;
      const latestKey =
        typeof paramsRef.current.getDiagramWatchKey === 'function'
          ? paramsRef.current.getDiagramWatchKey()
          : diagramWatchKey;
      if (latestKey === (current.diagramFingerprint || diagramFingerprintRef.current)) {
        return;
      }
      const mergeFromIndex = Math.max(0, current.activeLineIndex ?? 0);
      const priorBeats = (current.beats ?? []).slice(0, mergeFromIndex);
      if (mergeFromIndex >= (current.beats?.length ?? 0)) return;
      void refreshHuddleForDiagram(current.id, mergeFromIndex, priorBeats);
    }, HUDDLE_DIAGRAM_REFRESH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    snapshot.huddle?.id,
    snapshot.huddle?.mode,
    snapshot.huddle?.phase,
    snapshot.huddle?.beats,
    snapshot.huddle?.diagramFingerprint,
    snapshot.huddle?.activeLineIndex,
    diagramWatchKey,
    refreshHuddleForDiagram
  ]);

  return {
    huddle: snapshot.huddle,
    startHuddle,
    endHuddle,
    requestSpeakerSuggestion,
    continuePairing,
    pauseForWatching,
    resumeSpeaking
  };
}
