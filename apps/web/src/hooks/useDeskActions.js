import { useCallback, useMemo, useRef } from 'react';
import {
  readOfficeCadenceMemory,
  writeOfficeCadenceMemory
} from '../utils/officeAmbienceStorage.js';
import {
  deliverCannedMoment,
  deliverLlmMoment,
  readSlotContext
} from '../utils/officeMomentDelivery.js';
import { pickRandomFrom } from '../utils/officeCast.js';
import {
  acceptOfficeCoffee,
  canOfferOfficeBattle,
  getOfficeSnapshot,
  hasActiveOfficeSurface
} from '../state/officeMomentStore.js';

/**
 * Budget for verb-triggered LLM calls. Separate from the ambient
 * OFFICE_LLM_MOMENT_CAP: asking for something yourself should not consume the
 * office's background allowance (or vice versa).
 */
export const DESK_LLM_CAP = 3;

/** Cast you can DM. Senior stakeholders are excluded — you don't cold-DM the CFO. */
export const DESK_IM_CAST = [
  'intern',
  'scrumMaster',
  'helpdesk',
  'facilities',
  'hr',
  'greybeard',
  'refine',
  'critique',
  'explain'
];

/**
 * Player-initiated office actions — the "ego perspective" verbs
 * (docs/office-parody.md § Desk verbs). Where `useOfficeAmbience` decides when
 * the office interrupts you, this is you deciding to get up from your desk.
 *
 * Gating differs from the ambient director on purpose: verbs **bypass Focus
 * Time** (it mutes interruptions, not your own initiative) and skip the random
 * scheduler entirely, but still respect one-surface-at-a-time, an open
 * meeting, and a streaming agent run. They stamp `lastFiredAt` so the ambient
 * director backs off afterwards, but never spend its session caps.
 *
 * @param {{
 *   pause?: boolean,
 *   meetingActive?: boolean,
 *   getDiagramSource?: () => string,
 *   getContentType?: () => string,
 *   getSessionId?: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   getUserTitle?: () => string,
 *   onUsage?: (usage: { inputTokens: number, outputTokens: number, model: string | null }) => void,
 *   onOfficeEvent?: (kind: string) => void,
 *   onCallMeeting?: () => void,
 *   onCheckInbox?: () => void,
 *   onTalkToTeam?: () => void,
 *   random?: () => number
 * }} params
 */
export function useDeskActions(params) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const memoryRef = useRef(null);
  const deskLlmCountRef = useRef(0);
  const busyRef = useRef(false);

  const random = useCallback(() => (paramsRef.current.random ?? Math.random)(), []);

  const memory = useCallback(() => {
    if (!memoryRef.current) memoryRef.current = readOfficeCadenceMemory();
    return memoryRef.current;
  }, []);

  /**
   * Why a verb is unavailable right now, or null when it can run. Focus Time
   * is deliberately absent — muting the office does not ground you.
   */
  const blockedReason = useCallback(() => {
    const p = paramsRef.current;
    if (p.pause) return 'busy';
    if (p.meetingActive) return 'meeting';
    if (hasActiveOfficeSurface()) return 'surface';
    return null;
  }, []);

  const deliveryOptions = useCallback(
    (extra = {}) => ({
      memory: memory(),
      random,
      ...extra
    }),
    [memory, random]
  );

  const runVerb = useCallback(
    async (fn) => {
      if (busyRef.current || blockedReason()) return false;
      busyRef.current = true;
      try {
        return await fn();
      } finally {
        busyRef.current = false;
        if (memoryRef.current) writeOfficeCadenceMemory(memoryRef.current);
      }
    },
    [blockedReason]
  );

  /** Walk to the machine yourself — no invite pill, you're already standing there. */
  const getCoffee = useCallback(
    () =>
      runVerb(() => {
        const ctx = readSlotContext(paramsRef.current, random);
        const delivered = deliverCannedMoment('coffee', ctx, deliveryOptions());
        if (delivered) acceptOfficeCoffee();
        return delivered;
      }),
    [deliveryOptions, random, runVerb]
  );

  /**
   * Wander the floor. With a diagram up someone comments on it (LLM within the
   * desk budget, canned fallback); with a blank canvas you just overhear the
   * watercooler instead.
   */
  const walkTheFloor = useCallback(
    () =>
      runVerb(async () => {
        const p = paramsRef.current;
        const ctx = readSlotContext(p, random);
        const hasDiagram = Boolean((p.getDiagramSource?.() ?? '').trim());
        if (!hasDiagram) {
          const scene = random() < 0.5 || !canOfferOfficeBattle() ? 'coffee' : 'battle';
          const delivered = deliverCannedMoment(scene, ctx, deliveryOptions());
          if (delivered) p.onOfficeEvent?.('walkedFloor');
          return delivered;
        }
        let delivered = false;
        if (deskLlmCountRef.current < DESK_LLM_CAP) {
          delivered = await deliverLlmMoment(
            'walkby',
            ctx,
            deliveryOptions({
              sessionId: p.getSessionId?.() ?? '',
              onUsage: (usage) => paramsRef.current.onUsage?.(usage),
              onLlmSpent: () => {
                deskLlmCountRef.current += 1;
              }
            })
          );
        }
        if (!delivered) delivered = deliverCannedMoment('walkby', ctx, deliveryOptions());
        if (delivered) paramsRef.current.onOfficeEvent?.('walkedFloor');
        return delivered;
      }),
    [deliveryOptions, random, runVerb]
  );

  /**
   * Message someone directly. Their reply comes from the LLM when the desk
   * budget allows, otherwise from the canned IM bank. Pass `userMessage` (and
   * optional `threadTranscript`) when replying in Slop Chat™ so the colleague
   * responds to what the user actually said.
   */
  const imSomeone = useCallback(
    (colleagueId, replyContext) =>
      runVerb(async () => {
        const p = paramsRef.current;
        const ctx = readSlotContext(p, random);
        const target = colleagueId ?? pickRandomFrom(DESK_IM_CAST, random);
        const userMessage =
          typeof replyContext?.userMessage === 'string' ? replyContext.userMessage.trim() : '';
        const threadTranscript = Array.isArray(replyContext?.threadTranscript)
          ? replyContext.threadTranscript
          : [];
        const replyOpts = userMessage
          ? { replyContext: { colleagueId: target, userMessage, threadTranscript } }
          : {};
        let delivered = false;
        if (target && deskLlmCountRef.current < DESK_LLM_CAP) {
          delivered = await deliverLlmMoment(
            'im',
            ctx,
            deliveryOptions({
              colleagueId: target,
              sessionId: p.getSessionId?.() ?? '',
              onUsage: (usage) => paramsRef.current.onUsage?.(usage),
              onLlmSpent: () => {
                deskLlmCountRef.current += 1;
              },
              ...replyOpts
            })
          );
        }
        if (!delivered) {
          delivered = deliverCannedMoment(
            'im',
            ctx,
            deliveryOptions({ colleagueId: target, ...replyOpts })
          );
        }
        return delivered;
      }),
    [deliveryOptions, random, runVerb]
  );

  const checkInbox = useCallback(() => {
    paramsRef.current.onCheckInbox?.();
    return true;
  }, []);

  const callMeeting = useCallback(() => {
    if (paramsRef.current.meetingActive) return false;
    paramsRef.current.onCallMeeting?.();
    return true;
  }, []);

  const talkToTeam = useCallback(() => {
    if (paramsRef.current.pause) return false;
    paramsRef.current.onTalkToTeam?.();
    return true;
  }, []);

  const snapshot = getOfficeSnapshot();
  return useMemo(
    () => ({
      getCoffee,
      walkTheFloor,
      imSomeone,
      checkInbox,
      callMeeting,
      talkToTeam,
      blockedReason: blockedReason(),
      unreadCount: snapshot.unreadCount
    }),
    [
      blockedReason,
      callMeeting,
      checkInbox,
      getCoffee,
      imSomeone,
      talkToTeam,
      walkTheFloor,
      snapshot.unreadCount
    ]
  );
}
