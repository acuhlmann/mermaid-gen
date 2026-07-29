import { useEffect, useRef } from 'react';
import {
  readOfficeCadenceMemory,
  writeOfficeCadenceMemory
} from '../utils/officeAmbienceStorage.js';
import {
  deliverCannedMoment,
  deliverLlmMoment,
  readSlotContext,
  RECENT_MOMENTS_CAP
} from '../utils/officeMomentDelivery.js';
import { getOfficeSnapshot, shouldHoldAmbientOfficeMoments } from '../state/officeMomentStore.js';

/** Let the completion delight (confetti/sound) and the fresh render settle first. */
export const RUN_REACTION_DELAY_MS = 2_200;
/** Minimum gap between two run reactions — the floor never pig-piles a fast editor. */
export const RUN_REACTION_COOLDOWN_MS = 40_000;
/** After any office moment (ambient, welcome, or prior reaction), stay quiet awhile. */
export const RUN_REACTION_AFTER_MOMENT_MS = 30_000;
/** Hard cap of reactions per session — kept small so it stays a garnish, not noise. */
export const RUN_REACTION_SESSION_CAP = 5;
/** Of those, at most this many spend an LLM call; the rest are canned IM. */
export const RUN_REACTION_LLM_CAP = 2;
/** Not every run earns a reaction — most land quietly. */
export const RUN_REACTION_CHANCE = 0.55;
/** Share of the earned reactions that try the (diagram-aware) LLM path. */
export const RUN_REACTION_LLM_SHARE = 0.6;

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * The hard gates a run reaction shares with the ambient director: never talk
 * over a streaming run, a meeting, the advisor bubble, another office surface,
 * a hidden tab, or Focus Time.
 *
 * @param {{
 *   pause?: boolean,
 *   advisorBusy?: boolean,
 *   agentBusy?: boolean,
 *   meetingActive?: boolean,
 *   floorActive?: boolean
 * }} p
 * @returns {boolean}
 */
function reactionBlocked(p) {
  if (p.pause || p.advisorBusy || p.agentBusy || p.meetingActive) return true;
  if (p.floorActive) return true;
  if (isHidden() || shouldHoldAmbientOfficeMoments()) return true;
  if (getOfficeSnapshot().focusTime) return true;
  return false;
}

/**
 * Pure cadence brain for run reactions — the caps/cooldown/chance decision,
 * with no side effects, so it unit-tests on plain values (mirrors
 * officeCadence.js for the ambient director).
 *
 * @param {{
 *   now: number,
 *   lastReactionAt: number,
 *   lastAmbientFiredAt?: number,
 *   reactionCount: number,
 *   llmCount: number,
 *   hasDiagram: boolean,
 *   random?: () => number
 * }} state
 * @returns {{ kind: 'im', useLlm: boolean } | null} The moment to deliver, or null to stay quiet.
 */
export function planRunReaction({
  now,
  lastReactionAt,
  lastAmbientFiredAt = 0,
  reactionCount,
  llmCount,
  hasDiagram,
  random = Math.random
}) {
  // The office is reacting to *your response* — with a blank canvas there is
  // nothing to react to, so stay silent.
  if (!hasDiagram) return null;
  if (reactionCount >= RUN_REACTION_SESSION_CAP) return null;
  if (now - lastReactionAt < RUN_REACTION_COOLDOWN_MS) return null;
  if (lastAmbientFiredAt > 0 && now - lastAmbientFiredAt < RUN_REACTION_AFTER_MOMENT_MS) {
    return null;
  }
  if (random() > RUN_REACTION_CHANCE) return null;
  const useLlm = llmCount < RUN_REACTION_LLM_CAP && random() < RUN_REACTION_LLM_SHARE;
  return { kind: 'im', useLlm };
}

/**
 * Office colleagues reacting to *your* work (docs/office-parody.md § Moment
 * catalog). Where `useOfficeAmbience` interrupts you on a timer and the desk
 * verbs are you getting up, this closes the third loop: when an agent run lands
 * a fresh diagram, a colleague pings you about the thing you just made. Content
 * flows through the same canned/LLM IM ladder as every other moment.
 *
 * The reaction is deliberately an **IM** (low interruption, non-modal, silent —
 * nobody reads your chat out loud) and is capped hard so it reads as the floor
 * noticing your work, not spam. It stamps the shared cadence memory so the
 * ambient director backs off afterwards, and it holds its fire while a run
 * streams, a meeting or advisor bubble is up, another office surface is on
 * screen, the tab is hidden, or Focus Time is on.
 *
 * @param {{
 *   runSignal?: { id: number, variant?: string } | null,
 *   pause?: boolean,
 *   advisorBusy?: boolean,
 *   agentBusy?: boolean,
 *   meetingActive?: boolean,
 *   floorActive?: boolean,
 *   getDiagramSource?: () => string,
 *   getContentType?: () => string,
 *   getSessionId?: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   getUserTitle?: () => string,
 *   onUsage?: (usage: { inputTokens: number, outputTokens: number, model: string | null }) => void,
 *   random?: () => number
 * }} params
 */
export function useOfficeRunReactions(params) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const stateRef = useRef({ lastReactionAt: 0, reactionCount: 0, llmCount: 0 });
  const lastHandledIdRef = useRef(null);
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const inFlightRef = useRef(false);
  const recentRef = useRef(/** @type {string[]} */ ([]));

  useEffect(() => {
    const signal = params.runSignal;
    const id = signal?.id ?? null;
    if (id == null || id === lastHandledIdRef.current) return undefined;
    lastHandledIdRef.current = id;

    const random = () => (paramsRef.current.random ?? Math.random)();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void fire();
    }, RUN_REACTION_DELAY_MS);

    const rememberMoment = (text) => {
      recentRef.current.push(String(text).slice(0, 200));
      if (recentRef.current.length > RECENT_MOMENTS_CAP) recentRef.current.shift();
    };

    /** Deliver the planned IM (LLM first when opted in, canned fallback). */
    async function deliver(plan, ctx, memory) {
      const p = paramsRef.current;
      if (plan.useLlm) {
        const viaLlm = await deliverLlmMoment('im', ctx, {
          memory,
          random,
          sessionId: p.getSessionId?.() ?? '',
          recentMoments: recentRef.current,
          onUsage: (usage) => paramsRef.current.onUsage?.(usage),
          onRemember: rememberMoment,
          onLlmSpent: () => {
            stateRef.current.llmCount += 1;
          }
        });
        if (viaLlm) return true;
      }
      return deliverCannedMoment('im', ctx, { memory, random, onRemember: rememberMoment });
    }

    async function fire() {
      const p = paramsRef.current;
      if (inFlightRef.current || reactionBlocked(p)) return;

      const ctx = readSlotContext(p, random);
      const plan = planRunReaction({
        now: Date.now(),
        lastReactionAt: stateRef.current.lastReactionAt,
        lastAmbientFiredAt: memory.lastFiredAt,
        reactionCount: stateRef.current.reactionCount,
        llmCount: stateRef.current.llmCount,
        hasDiagram: Boolean((ctx.diagramSource ?? '').trim()),
        random
      });
      if (!plan) return;

      inFlightRef.current = true;
      const memory = readOfficeCadenceMemory();
      try {
        if (await deliver(plan, ctx, memory)) {
          stateRef.current.reactionCount += 1;
          stateRef.current.lastReactionAt = Date.now();
        }
      } finally {
        inFlightRef.current = false;
        writeOfficeCadenceMemory(memory);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [params.runSignal]);
}
