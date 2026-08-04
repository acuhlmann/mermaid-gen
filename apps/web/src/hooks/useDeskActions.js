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
import { pickRandomFrom, listMeetingDirectory } from '../utils/officeCast.js';
import {
  acceptOfficeCoffee,
  canOfferOfficeBattle,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeImReply
} from '../state/officeMomentStore.js';
import { threadTranscriptFor } from '../utils/officeImThreads.js';
import { OFFICE_DESK_LLM_CAP, OFFICE_TALK_LLM_CAP } from '../utils/officeCadence.js';

/**
 * Budget for verb-triggered LLM calls. Separate from the ambient
 * OFFICE_LLM_MOMENT_CAP: asking for something yourself should not consume the
 * office's background allowance (or vice versa).
 */
export const DESK_LLM_CAP = OFFICE_DESK_LLM_CAP;

/**
 * Budget for the talk channel — saying something out loud, or turning to the
 * person next to you (docs/office-parody.md § Desk verbs).
 *
 * Deliberately its own, and deliberately much larger than `DESK_LLM_CAP`. That
 * cap governs *ambient* verbs, where three is plenty because the office is
 * interrupting you; a conversation exhausts three in three sentences and then
 * answers from the canned bank, which reads as broken rather than in-character.
 * ADR-0010 puts reactive spend in the generous, self-limiting class: you only
 * spend it by typing, so the ceiling is a backstop, not a rationing device.
 */
export const TALK_LLM_CAP = OFFICE_TALK_LLM_CAP;

/** Cast you can DM or email — anyone in the meeting directory. */
export const DESK_IM_CAST = listMeetingDirectory().map((row) => row.id);

/**
 * A colleague doesn't see and answer your IM/email the instant you send it —
 * without a pause, a push that lands the moment you hit send reads as the
 * office replying before you finished typing (worse for the LLM path, which
 * is supposedly still thinking). `talk` (composer speech) is exempt: that
 * channel is a live conversation, not a message someone has to notice.
 * Email gets a further stretch on top of the IM pause — inbox mail is
 * inherently slower than chat, even in a parody office.
 */
const IM_REPLY_DELAY_MIN_MS = 500;
const IM_REPLY_DELAY_JITTER_MS = 700;
const EMAIL_REPLY_EXTRA_DELAY_MIN_MS = 700;
const EMAIL_REPLY_EXTRA_DELAY_JITTER_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Player-initiated office actions — the "ego perspective" verbs
 * (docs/office-parody.md § Desk verbs). Where `useOfficeAmbience` decides when
 * the office interrupts you, this is you deciding to get up from your desk.
 *
 * Gating differs from the ambient director on purpose: verbs **bypass Focus
 * Time** (it mutes interruptions, not your own initiative) and skip the random
 * scheduler entirely. Coffee bypasses a streaming agent run — you can step
 * away from deliverables (colleagues may still lean over your shoulder on
 * their own schedule). Other verbs still respect one-surface-at-a-time, an
 * open meeting, and a streaming agent run.
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
 *   getModelProfile?: () => string,
 *   replyDelayMs?: (channel: string) => number,
 *   random?: () => number
 * }} params
 */
export function useDeskActions(params) {
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const memoryRef = useRef(null);
  const deskLlmCountRef = useRef(0);
  const talkLlmCountRef = useRef(0);
  const busyRef = useRef(false);

  const random = useCallback(() => (paramsRef.current.random ?? Math.random)(), []);

  /**
   * How long to wait before an IM/email reply lands. Overridable via
   * `params.replyDelayMs` (tests pass a zero-cost stub); production gets a
   * jittered pause, longer for email than IM.
   */
  const replyDelayMs = useCallback(
    (channel) => {
      const override = paramsRef.current.replyDelayMs;
      if (typeof override === 'function') return override(channel);
      const base = IM_REPLY_DELAY_MIN_MS + random() * IM_REPLY_DELAY_JITTER_MS;
      if (channel !== 'email') return base;
      return base + EMAIL_REPLY_EXTRA_DELAY_MIN_MS + random() * EMAIL_REPLY_EXTRA_DELAY_JITTER_MS;
    },
    [random]
  );

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

  /**
   * Gating for ambient desk verbs (coffee, walk) that are independent of canvas
   * deliverables — you can step away while a run streams; colleagues may comment.
   */
  const ambientBlockedReason = useCallback(() => {
    const p = paramsRef.current;
    if (p.meetingActive) return 'meeting';
    if (hasActiveOfficeSurface()) return 'surface';
    return null;
  }, []);

  const deliveryOptions = useCallback(
    (extra = {}) => ({
      memory: memory(),
      random,
      modelProfile: paramsRef.current.getModelProfile?.() ?? 'fast',
      ...extra
    }),
    [memory, random]
  );

  const runVerb = useCallback(
    async (fn, { bypassPause = false } = {}) => {
      if (busyRef.current) return false;
      const reason = bypassPause ? ambientBlockedReason() : blockedReason();
      if (reason) return false;
      busyRef.current = true;
      try {
        return await fn();
      } finally {
        busyRef.current = false;
        if (memoryRef.current) writeOfficeCadenceMemory(memoryRef.current);
      }
    },
    [ambientBlockedReason, blockedReason]
  );

  /** Walk to the machine yourself — no invite pill, you're already standing there. */
  const getCoffee = useCallback(
    () =>
      runVerb(
        () => {
          const ctx = readSlotContext(paramsRef.current, random);
          const delivered = deliverCannedMoment('coffee', ctx, deliveryOptions());
          if (delivered) acceptOfficeCoffee();
          return delivered;
        },
        { bypassPause: true }
      ),
    [deliveryOptions, random, runVerb]
  );

  /**
   * Wander the floor — kept for tests and any diegetic floor affordance that
   * still wants an on-demand walk-by. The desk menu no longer exposes this:
   * over-the-shoulder moments arrive only when the ambience director fires them.
   */
  const walkTheFloor = useCallback(
    () =>
      runVerb(
        async () => {
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
        },
        { bypassPause: true }
      ),
    [deliveryOptions, random, runVerb]
  );

  /**
   * The shared half of "a colleague answers you in character". `imSomeone` and
   * `talkOutLoud` differ only in which budget they spend and what channel the
   * reply is tagged with — the delivery ladder (LLM first, canned bank as the
   * graceful floor) is identical, which is the point: the talk channel is not a
   * second conversation engine.
   *
   * @param {{ target: string, replyContext?: object, counterRef: { current: number },
   *   cap: number, channel?: string }} args
   */
  const deliverImReply = useCallback(
    async ({ target, replyContext, counterRef, cap, channel }) => {
      if (channel !== 'talk') {
        await sleep(replyDelayMs(channel ?? 'im'));
      }
      const p = paramsRef.current;
      const ctx = readSlotContext(p, random);
      const userMessage =
        typeof replyContext?.userMessage === 'string' ? replyContext.userMessage.trim() : '';
      const threadTranscript = Array.isArray(replyContext?.threadTranscript)
        ? replyContext.threadTranscript
        : [];
      const replyOpts = userMessage
        ? { replyContext: { colleagueId: target, userMessage, threadTranscript } }
        : {};
      const channelOpts = channel ? { channel } : {};
      let delivered = false;
      if (target && counterRef.current < cap) {
        delivered = await deliverLlmMoment(
          'im',
          ctx,
          deliveryOptions({
            colleagueId: target,
            sessionId: p.getSessionId?.() ?? '',
            onUsage: (usage) => paramsRef.current.onUsage?.(usage),
            onLlmSpent: () => {
              counterRef.current += 1;
            },
            ...channelOpts,
            ...replyOpts
          })
        );
      }
      if (!delivered) {
        delivered = deliverCannedMoment(
          'im',
          ctx,
          deliveryOptions({ colleagueId: target, ...channelOpts, ...replyOpts })
        );
      }
      return delivered;
    },
    [deliveryOptions, random, replyDelayMs]
  );

  /**
   * Message someone directly. Their reply comes from the LLM when the desk
   * budget allows, otherwise from the canned IM bank. Pass `userMessage` (and
   * optional `threadTranscript`) when replying in Slop Chat™ so the colleague
   * responds to what the user actually said.
   */
  const imSomeone = useCallback(
    (colleagueId, replyContext) =>
      runVerb(() =>
        deliverImReply({
          target: colleagueId ?? pickRandomFrom(DESK_IM_CAST, random),
          replyContext,
          counterRef: deskLlmCountRef,
          cap: DESK_LLM_CAP
        })
      ),
    [deliverImReply, random, runVerb]
  );

  /**
   * Say something from your chair. `colleagueId` null means **out loud** — you
   * said it to the room and whoever is apt picks it up; an id means you turned
   * to that person. Same verb, and `imSomeone` has always resolved null the same
   * way; what is new is that the user's own line is recorded first, so the
   * exchange reads as a conversation rather than an unprompted reply.
   *
   * Gated only by an open meeting. Unlike the ambient verbs it deliberately
   * ignores `pause` and one-surface-at-a-time: talking while a run streams is
   * exactly when you would, and being unable to speak because an IM toast is up
   * would be absurd.
   *
   * ADR-0010: this never produces slot content. Whatever comes back is a remark,
   * and only *you* can turn a remark into a run.
   *
   * @param {string | null} colleagueId
   * @param {{ userMessage: string, threadTranscript?: Array<object> }} said
   * @returns {Promise<{ ok: boolean, colleagueId: string | null }>} who picked it up
   */
  const talkOutLoud = useCallback(
    async (colleagueId, said) => {
      if (paramsRef.current.meetingActive) return { ok: false, colleagueId: null };
      const body = typeof said?.userMessage === 'string' ? said.userMessage.trim() : '';
      if (!body) return { ok: false, colleagueId: null };
      const target = colleagueId ?? pickRandomFrom(DESK_IM_CAST, random);
      if (!target) return { ok: false, colleagueId: null };
      // Your line lands before theirs, attributed to whoever answers — shared
      // history for desk speech + floor balloons; Slop Chat stays typed-IM only.
      pushOfficeImReply({ colleagueId: target, body, channel: 'talk' });
      paramsRef.current.onOfficeEvent?.('talked');
      const threadTranscript = threadTranscriptFor(getOfficeSnapshot().imHistory, target);
      const ok = await deliverImReply({
        target,
        replyContext: { userMessage: body, threadTranscript },
        counterRef: talkLlmCountRef,
        cap: TALK_LLM_CAP,
        channel: 'talk'
      });
      return { ok, colleagueId: target };
    },
    [deliverImReply, random]
  );

  /**
   * Email someone directly — their reply lands in your inbox. Pass subject/body
   * so the LLM (or canned bank) can respond in character.
   */
  const emailSomeone = useCallback(
    (colleagueId, { subject = '', body = '' } = {}) =>
      runVerb(async () => {
        await sleep(replyDelayMs('email'));
        const p = paramsRef.current;
        const ctx = readSlotContext(p, random);
        const target = colleagueId ?? pickRandomFrom(DESK_IM_CAST, random);
        if (!target) return false;
        const userMessage = [String(subject ?? '').trim(), String(body ?? '').trim()]
          .filter(Boolean)
          .join('\n\n');
        const replyOpts = userMessage
          ? { replyContext: { colleagueId: target, userMessage, threadTranscript: [] } }
          : {};
        let delivered = false;
        if (deskLlmCountRef.current < DESK_LLM_CAP) {
          delivered = await deliverLlmMoment(
            'email',
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
            'email',
            ctx,
            deliveryOptions({ colleagueId: target, ...replyOpts })
          );
        }
        return delivered;
      }),
    [deliveryOptions, random, replyDelayMs, runVerb]
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
      talkOutLoud,
      emailSomeone,
      checkInbox,
      callMeeting,
      talkToTeam,
      blockedReason: blockedReason(),
      ambientBlockedReason: ambientBlockedReason(),
      unreadCount: snapshot.unreadCount
    }),
    [
      ambientBlockedReason,
      blockedReason,
      callMeeting,
      checkInbox,
      emailSomeone,
      getCoffee,
      imSomeone,
      talkOutLoud,
      talkToTeam,
      walkTheFloor,
      snapshot.unreadCount
    ]
  );
}
