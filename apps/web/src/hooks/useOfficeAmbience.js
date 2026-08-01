import { useEffect, useRef } from 'react';
import { pickNextMoment } from '../utils/officeCadence.js';
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

export const OFFICE_TICK_MS = 5_000;
const FAILURE_BACKOFF_MS = 30_000;

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * The office ambience director (docs/office-parody.md). A client-side ticker —
 * same architecture as useAdvisorOrchestrator — that asks the pure cadence
 * brain when to fire and hands the chosen kind to the shared delivery module
 * (`officeMomentDelivery.js`, also used by the user-driven desk verbs), which
 * pushes results into officeMomentStore for the OfficeLayer chrome to render.
 *
 * This hook owns cadence and the session caps; it does not own content.
 *
 * Never interrupts: paused while an agent run streams (`pause` / `agentBusy`),
 * while the advisor bubble is up (`advisorBusy`), during a meeting or huddle,
 * while you are on the isometric floor, while any office surface is already on
 * screen, when the tab is hidden, and
 * during Focus Time.
 * LLM failures back off and fall back to canned content.
 *
 * @param {{
 *   pause: boolean,
 *   advisorBusy: boolean,
 *   agentBusy?: boolean,
 *   meetingActive: boolean,
 *   floorActive?: boolean,
 *   getDiagramSource: () => string,
 *   getContentType: () => string,
 *   getSessionId: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   getUserTitle?: () => string,
 *   onUsage?: (usage: { inputTokens: number, outputTokens: number, model: string | null }) => void,
 *   random?: () => number
 * }} params
 */
export function useOfficeAmbience(params) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let abortController = null;
    let failureUntil = 0;
    const sessionStartedAt = Date.now();
    const counters = {
      momentCount: 0,
      llmMomentCount: 0,
      meetingInviteCount: 0,
      battleCount: 0,
      seniorEmailCount: 0,
      allHandsCount: 0
    };
    const memory = readOfficeCadenceMemory();
    /** @type {string[]} */
    const recentMoments = [];

    const random = () => (paramsRef.current.random ?? Math.random)();

    const rememberMoment = (text) => {
      recentMoments.push(String(text).slice(0, 200));
      if (recentMoments.length > RECENT_MOMENTS_CAP) recentMoments.shift();
    };

    /** Ambient moments spend the session cap; desk verbs deliberately do not. */
    const countAmbientMoment = () => {
      counters.momentCount += 1;
    };

    const deliveryOptions = (extra = {}) => ({
      memory,
      random,
      onRemember: rememberMoment,
      onFired: countAmbientMoment,
      ...extra
    });

    const shouldHoldFire = () => {
      const p = paramsRef.current;
      if (p.pause || p.advisorBusy || p.agentBusy || p.meetingActive) return true;
      if (p.floorActive) return true;
      if (isHidden()) return true;
      if (getOfficeSnapshot().focusTime) return true;
      if (shouldHoldAmbientOfficeMoments()) return true;
      if (Date.now() < failureUntil) return true;
      return false;
    };

    const tick = async () => {
      if (!alive || inFlight || shouldHoldFire()) return;
      const p = paramsRef.current;
      const diagramSource = p.getDiagramSource?.() ?? '';
      const moment = pickNextMoment({
        now: Date.now(),
        sessionStartedAt,
        lastFiredAt: memory.lastFiredAt,
        momentCount: counters.momentCount,
        llmMomentCount: counters.llmMomentCount,
        meetingInviteCount: counters.meetingInviteCount,
        battleCount: counters.battleCount,
        seniorEmailCount: counters.seniorEmailCount,
        allHandsCount: counters.allHandsCount,
        hasDiagram: Boolean(diagramSource.trim()),
        random
      });
      if (!moment) return;
      inFlight = true;
      try {
        const ctx = readSlotContext(paramsRef.current, random);
        if (moment.useLlm) {
          const delivered = await deliverLlmMoment(
            moment.kind,
            ctx,
            deliveryOptions({
              sessionId: paramsRef.current.getSessionId?.() ?? '',
              recentMoments,
              onUsage: (usage) => paramsRef.current.onUsage?.(usage),
              onLlmSpent: () => {
                counters.llmMomentCount += 1;
              },
              isAlive: () => alive,
              registerAbort: (controller) => {
                abortController = controller;
              }
            })
          );
          if (!alive) return;
          if (!delivered) {
            failureUntil = Date.now() + FAILURE_BACKOFF_MS;
            deliverCannedMoment(moment.kind, ctx, deliveryOptions());
          }
        } else {
          const senior = moment.senior === true;
          const delivered = deliverCannedMoment(moment.kind, ctx, deliveryOptions({ senior }));
          if (delivered && senior) counters.seniorEmailCount += 1;
          if (delivered && moment.kind === 'battle') counters.battleCount += 1;
          if (delivered && moment.kind === 'meeting-invite') counters.meetingInviteCount += 1;
          if (delivered && moment.kind === 'all-hands') counters.allHandsCount += 1;
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, OFFICE_TICK_MS);

    return () => {
      alive = false;
      clearInterval(interval);
      abortController?.abort();
      writeOfficeCadenceMemory(memory);
    };
  }, []);
}
