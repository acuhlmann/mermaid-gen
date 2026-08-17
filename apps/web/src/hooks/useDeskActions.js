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
import {
  pickRandomFrom,
  listMeetingDirectory,
  OFFICE_WALKBY_LLM_CAST
} from '../utils/officeCast.js';
import {
  acceptOfficeCoffee,
  canOfferOfficeBattle,
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeImReply
} from '../state/officeMomentStore.js';
import { threadTranscriptFor } from '../utils/officeImThreads.js';
import {
  OFFICE_DESK_LLM_CAP,
  OFFICE_DWELL_LLM_CAP,
  OFFICE_TALK_LLM_CAP,
  pickTalkAnswer
} from '../utils/officeCadence.js';

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

/**
 * Somebody breaking the silence because you have been stood next to them
 * (isometric slice 19). Its own budget rather than a share of `TALK_LLM_CAP`
 * for the reason the tiers exist at all: talking is you asking a question, and
 * this is somebody answering a question nobody asked. Re-exported from
 * `officeCadence.js` like its siblings so the office's appetite stays readable
 * in one table.
 */
export const DWELL_LLM_CAP = OFFICE_DWELL_LLM_CAP;

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

/**
 * How long the room takes to answer something you said out loud, per shape.
 *
 * The talk channel is exempt from the IM pause above — a live conversation is
 * not a message somebody has to notice — and a shout keeps that exemption, so
 * these two are the exceptions to the exception, and both are physical rather
 * than social. **Somebody has to stand up and cross the floor**, so a walk-over
 * that lands instantly is a teleport; the isometric renderer animates the walk,
 * and this is the desk renderer paying the same fare. **Silence takes a beat to
 * become silence** — "nobody answered" is only legible after the moment in which
 * they might have, so a zero-delay version reads as the send button failing.
 *
 * Both are short enough to stay under the user's own next keystroke.
 */
const TALK_WALKOVER_DELAY_MIN_MS = 1100;
const TALK_WALKOVER_DELAY_JITTER_MS = 1300;
const TALK_SILENCE_DELAY_MIN_MS = 900;
const TALK_SILENCE_DELAY_JITTER_MS = 700;

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
  const dwellLlmCountRef = useRef(0);
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

  /**
   * The other two pauses, keyed by talk shape rather than by channel. Shares
   * `params.replyDelayMs` so a test still has one seam for "make the office
   * instant" — it is handed `'walkover'` / `'ignored'` where the IM path hands
   * it `'im'` / `'email'`.
   *
   * `shout` is deliberately absent: it is the one that keeps the talk channel's
   * exemption, because answering across a room is not something you have to
   * notice first.
   */
  const talkDelayMs = useCallback(
    (shape) => {
      const override = paramsRef.current.replyDelayMs;
      if (typeof override === 'function') return override(shape);
      if (shape === 'walkover') {
        return TALK_WALKOVER_DELAY_MIN_MS + random() * TALK_WALKOVER_DELAY_JITTER_MS;
      }
      return TALK_SILENCE_DELAY_MIN_MS + random() * TALK_SILENCE_DELAY_JITTER_MS;
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
   * `situation` is the third axis and only applies to the LLM rung: it says why
   * the colleague is speaking when the user has not typed at them. The canned
   * bank ignores it by construction — a bank line was written for a situation
   * already, and picking a per-situation bank is what template ids are for.
   *
   * `kind` is the fourth axis and the one that changes where the answer *lands*:
   * `'im'` puts it in `imHistory` (desk speech, floor balloon), `'walkby'` puts
   * the speaker at your shoulder instead. Same ladder either way, which is what
   * makes a walk-over an outcome of this verb rather than a second one.
   *
   * @param {{ target: string, replyContext?: object, counterRef: { current: number },
   *   cap: number, channel?: string, situation?: string, kind?: 'im' | 'walkby',
   *   voice?: string }} args
   */
  const deliverImReply = useCallback(
    async ({ target, replyContext, counterRef, cap, channel, situation, kind = 'im', voice }) => {
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
      const voiceOpts = voice ? { voice } : {};
      let delivered = false;
      if (target && counterRef.current < cap) {
        delivered = await deliverLlmMoment(
          kind,
          ctx,
          deliveryOptions({
            colleagueId: target,
            sessionId: p.getSessionId?.() ?? '',
            onUsage: (usage) => paramsRef.current.onUsage?.(usage),
            onLlmSpent: () => {
              counterRef.current += 1;
            },
            ...(situation ? { situation } : {}),
            ...channelOpts,
            ...voiceOpts,
            ...replyOpts
          })
        );
      }
      if (!delivered) {
        delivered = deliverCannedMoment(
          kind,
          ctx,
          deliveryOptions({ colleagueId: target, ...channelOpts, ...voiceOpts, ...replyOpts })
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
   * way; the user's own line is recorded first, so the exchange reads as a
   * conversation rather than an unprompted reply.
   *
   * **The room now answers in one of four ways, and three of them are new.**
   * Until this, saying something to an open-plan office produced exactly one
   * outcome — a reply card at your desk, every single time, from somebody who
   * had apparently been waiting for you to speak. That is a chat window wearing
   * a costume. `pickTalkAnswer` (officeCadence.js) rolls the other two, and
   * being addressed by name is the fourth:
   *
   * | Shape      | Who | What happens                                            |
   * | ---------- | --- | ------------------------------------------------------- |
   * | `turnedTo` | you named them | they answer from the next desk (never rolled — you asked them) |
   * | `shout`    | the room | somebody answers from their chair, marked `voice: 'across'` |
   * | `walkover` | the room | somebody gets up and comes over — delivered as a **walk-by** |
   * | `ignored`  | the room | nobody looks up. Your line still happened |
   *
   * `walkover` is the whole reason this fans out rather than branching on a
   * flag: it is a `walkby` moment, so it inherits the two renderers the
   * over-the-shoulder moment already owns (`OfficeWalkBy` at the desk,
   * `FloorWalker` on the floor, who actually walks). Nothing new draws a person.
   *
   * Gated only by an open meeting. Unlike the ambient verbs it deliberately
   * ignores `pause` and one-surface-at-a-time: talking while a run streams is
   * exactly when you would, and being unable to speak because an IM toast is up
   * would be absurd.
   *
   * ADR-0010: this never produces slot content. Whatever comes back is a remark,
   * and only *you* can turn a remark into a run — including the walk-over, which
   * carries a pitch exactly as an ambient walk-by does.
   *
   * @param {string | null} colleagueId
   * @param {{ userMessage: string, threadTranscript?: Array<object> }} said
   * @returns {Promise<{
   *   ok: boolean,
   *   colleagueId: string | null,
   *   shape: 'turnedTo' | 'shout' | 'walkover' | 'ignored' | null
   * }>} who picked it up, and how
   */
  const talkOutLoud = useCallback(
    async (colleagueId, said) => {
      if (paramsRef.current.meetingActive) return { ok: false, colleagueId: null, shape: null };
      const body = typeof said?.userMessage === 'string' ? said.userMessage.trim() : '';
      if (!body) return { ok: false, colleagueId: null, shape: null };
      /* Naming somebody is not a gamble — they are looking at you. Only the
         undirected act rolls, because only it asked nobody in particular. */
      const hasDiagram = Boolean((paramsRef.current.getDiagramSource?.() ?? '').trim());
      const shape = colleagueId ? 'turnedTo' : pickTalkAnswer({ hasDiagram, random });

      /* The shape decides the pool, which is why it is rolled first. A voice can
         come from anywhere in the directory, but a **body** has to be able to
         get here: the senior tier sits inside the sealed glass room, and
         `walkPathFrom` would route one of them out through the wall. That is the
         same reason the ambient director draws walk-bys from this list — a
         walk-over is a walk-by, so it inherits the constraint along with the
         renderer. */
      const pool = shape === 'walkover' ? OFFICE_WALKBY_LLM_CAST : DESK_IM_CAST;
      const target = colleagueId ?? pickRandomFrom(pool, random);
      if (!target) return { ok: false, colleagueId: null, shape: null };

      // Your line lands before theirs, attributed to whoever answers — shared
      // history for desk speech + floor balloons; Slop Chat stays typed-IM only.
      // Recorded even when nobody answers: you said it, and the next thing that
      // colleague says should know you did.
      pushOfficeImReply({ colleagueId: target, body, channel: 'talk' });
      paramsRef.current.onOfficeEvent?.('talked');

      if (shape === 'ignored') {
        // The pause is what makes this legible as silence rather than as a
        // broken send button — see TALK_SILENCE_DELAY_MIN_MS.
        await sleep(talkDelayMs('ignored'));
        return { ok: false, colleagueId: null, shape };
      }

      const threadTranscript = threadTranscriptFor(getOfficeSnapshot().imHistory, target);
      // They have to cross the floor first. The isometric renderer animates it;
      // this is the desk renderer paying the same fare.
      if (shape === 'walkover') await sleep(talkDelayMs('walkover'));

      const ok = await deliverImReply({
        target,
        replyContext: { userMessage: body, threadTranscript },
        counterRef: talkLlmCountRef,
        cap: TALK_LLM_CAP,
        channel: 'talk',
        kind: shape === 'walkover' ? 'walkby' : 'im',
        /* The wire's spoken situations, one per shape. They stand the typed
           "the user just sent you a chat message" framing down on the server —
           see `isSpokenMomentSituation` — which is what stops a remark said
           across a room coming back written like Slack. */
        situation: shape === 'walkover' ? 'walkover' : shape === 'shout' ? 'outLoud' : 'turnedTo',
        ...(shape === 'shout' ? { voice: 'across' } : {})
      });
      return { ok, colleagueId: target, shape };
    },
    [deliverImReply, random, talkDelayMs]
  );

  /**
   * Somebody looks up because you have been standing next to them (isometric
   * slice 19).
   *
   * The same delivery ladder as every other line they could say, with three
   * things set deliberately. **No `replyContext`**, because you did not say
   * anything — this is them speaking first, which is the one conversational
   * move the office had no verb for. And **`channel: 'talk'`**, which is not
   * decoration: `pushOfficeImPing` skips the desk arrival toast for talk lines
   * and keeps them out of Slop Chat™ scrollback, so the line lands over their
   * head on the floor and nowhere else. Speech in a room is not a notification
   * and it is not a message you can scroll back to.
   *
   * The third is **`situation: 'dwell'`**, and it is the missing half of the
   * first: sending no `replyContext` told the *server* there was nothing to
   * answer, but it told the *model* nothing at all, so a line the user crossed
   * the room to trigger was written under the cold-open framing an ambient
   * moment gets. Correct voice, correct diagram, no idea anybody was standing
   * there — which reads as a non-sequitur precisely when the user is paying
   * the most attention. The circumstance is the joke; it has to reach the
   * prompt.
   *
   * Not wrapped in `runVerb`, matching `talkOutLoud` rather than `imSomeone`:
   * being unable to hear somebody because a toast is up would be absurd, and
   * you are stood in front of them.
   *
   * @param {string} colleagueId
   * @returns {Promise<boolean>}
   */
  const remarkTo = useCallback(
    async (colleagueId) => {
      if (!colleagueId || paramsRef.current.meetingActive) return false;
      return deliverImReply({
        target: colleagueId,
        counterRef: dwellLlmCountRef,
        cap: DWELL_LLM_CAP,
        channel: 'talk',
        situation: 'dwell'
      });
    },
    [deliverImReply]
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
      remarkTo,
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
      remarkTo,
      talkOutLoud,
      talkToTeam,
      walkTheFloor,
      snapshot.unreadCount
    ]
  );
}
