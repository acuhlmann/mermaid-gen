import express from 'express';
import { z } from 'zod';
import {
  ContentTypeSchema,
  MEETING_MAX_ATTENDEES,
  ModelProfileSchema,
  OfficeMomentKindSchema,
  OFFICE_DIAGRAM_SOURCE_MAX_CHARS
} from '@archislop/shared';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { extractTextContent } from '../utils/extractTextContent.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';
import {
  buildHuddleSystemPrompt,
  buildHuddleUserPrompt,
  buildInterjectSystemPrompt,
  buildInterjectUserPrompt,
  buildMeetingSystemPrompt,
  buildMeetingUserPrompt,
  buildMomentSystemPrompt,
  buildMomentUserPrompt,
  buildPairSystemPrompt,
  createOfficeChatModel,
  isOfficeSpeaker,
  MEETING_VENUES,
  normalizeAttendees,
  officeUsageFromReply,
  parseHuddleScript,
  parseInterjectReply,
  parseMeetingScript,
  parseMomentReply,
  parsePairScript,
  resolveOfficeModelId
} from '../agents/officePersonas.js';
import {
  buildTrainingSystemPrompt,
  buildTrainingUserPrompt,
  parseTrainingReply,
  TRAINING_MODULE_TOTAL,
  TRAINING_STEPS
} from '../agents/officeTrainingPrompt.js';
import { isOfficeTtsEnabled, synthesizeOfficeSpeech } from '../agents/officeTts.js';

/**
 * The chrome locale the office cast should speak. Unlike diagram agents (which
 * infer language from the diagram's own script via promptLanguage.ts), the
 * office layer follows the UI — see buildOfficeLanguageRule.
 */
const UiLocaleField = z.string().max(16).optional();

/** Truncate oversized slot sources instead of 400ing — anything/forms exceed 20k. */
const DiagramSourceField = z.preprocess(
  (value) => (typeof value === 'string' ? value.slice(0, OFFICE_DIAGRAM_SOURCE_MAX_CHARS) : value),
  z.string().max(OFFICE_DIAGRAM_SOURCE_MAX_CHARS).default('')
);

const OfficeThreadLineSchema = z.object({
  from: z.enum(['user', 'colleague']),
  body: z.string().max(300)
});

/**
 * The office log — what the cast remembers happened today, built client-side
 * by `officeLogDigest.js` and already capped there. Re-stated rather than
 * trusted: the caps must match on both sides, or a client that drifts turns
 * into a 400 the user experiences as "the office went quiet".
 *
 * Optional with an empty default, so a client that has never heard of the log
 * (or a session with nothing in it yet) is a normal request rather than a
 * degraded one.
 */
const OfficeLogField = z.array(z.string().max(200)).max(12).default([]);

const ModelProfileField = ModelProfileSchema.optional();

const OfficeMomentRequestSchema = z.object({
  kind: OfficeMomentKindSchema,
  colleagueId: z.string().refine(isOfficeSpeaker, { message: 'unknown colleague' }),
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: DiagramSourceField,
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  recentMoments: z.array(z.string().max(400)).max(5).default([]),
  officeLog: OfficeLogField,
  uiLocale: UiLocaleField,
  userName: z.string().max(80).optional(),
  userMessage: z.string().max(400).optional(),
  threadTranscript: z.array(OfficeThreadLineSchema).max(12).optional(),
  modelProfile: ModelProfileField
});

/**
 * The all-hands audience (docs/office-parody.md §10.4) — everyone present who
 * will *not* speak.
 *
 * This exists because `attendees` has always meant two things at once: who is
 * in the room, and who may be scripted. At every other roster size those are
 * the same list. An all-hands is where they come apart — sixteen attend, three
 * speak — and conflating them would mean either raising
 * `MEETING_MAX_ATTENDEES` (letting *every* meeting seat sixteen, and asking the
 * model to give sixteen people lines inside a fourteen-beat cap) or inventing a
 * parallel meeting endpoint. Splitting the two is cheaper than both and leaves
 * the shared schema alone.
 *
 * The cap is a ceiling, not a contract: the client sends the cast (16) and the
 * server simply refuses absurdity. Unlike `TRAINING_STEPS`, the two sides do
 * not have to agree on a number, so this stays route-local.
 */
const MEETING_MAX_AUDIENCE = 24;

const OfficeMeetingRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: DiagramSourceField,
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  attendees: z.array(z.string().max(40)).min(1).max(MEETING_MAX_ATTENDEES),
  audience: z.array(z.string().max(40)).max(MEETING_MAX_AUDIENCE).default([]),
  /**
   * The escalation ladder rung (docs/office-parody.md §10.10): the venue the
   * room is playing as. Defaults to a plain working group; the client raises
   * it to `steering` then `cab` as a meeting is escalated at its end. The
   * shared array keeps the wire contract in lockstep with the prompt rules.
   */
  venue: z.enum(MEETING_VENUES).default('workingGroup'),
  topic: z.string().max(200).optional(),
  contextSource: z.enum(['email', 'chat']).optional(),
  contextDetail: z.string().max(1200).optional(),
  officeLog: OfficeLogField,
  uiLocale: UiLocaleField,
  modelProfile: ModelProfileField
});

/**
 * A huddle is your own team crowding your screen, so the seat count is bounded
 * by the team tier (six) rather than the meeting room's eight.
 */
const HUDDLE_MAX_ATTENDEES = 6;

const OfficeHuddlePriorBeatSchema = z.object({
  speakerId: z.string().max(40),
  text: z.string().max(300)
});

/**
 * `mob` is the whole team crowding your screen; `pair` is one teammate in the
 * chair next to you. They share this endpoint because they share the client's
 * huddle slice (ADR-0011 rule 1) — but almost nothing downstream of the mode
 * check is shared, because a scene for one person is not a scene for six.
 */
const HuddleModeSchema = z.enum(['mob', 'pair']).default('mob');

const OfficeHuddleRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: DiagramSourceField,
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  mode: HuddleModeSchema,
  // Floor of 1 here; the per-mode seat count is enforced below where the mode
  // is known, so a one-seat "mob" fails as a mode error, not a schema error.
  attendees: z.array(z.string().max(40)).min(1).max(HUDDLE_MAX_ATTENDEES),
  priorBeats: z.array(OfficeHuddlePriorBeatSchema).max(HUDDLE_MAX_ATTENDEES).optional(),
  officeLog: OfficeLogField,
  uiLocale: UiLocaleField,
  modelProfile: ModelProfileField
});

const OfficeInterjectRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: DiagramSourceField,
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  attendees: z.array(z.string().max(40)).min(1).max(MEETING_MAX_ATTENDEES),
  transcriptSoFar: z.array(z.string().max(300)).max(20).default([]),
  interjection: z.string().min(1).max(400),
  officeLog: OfficeLogField,
  uiLocale: UiLocaleField,
  modelProfile: ModelProfileField
});

const OfficeSpeakRequestSchema = z.object({
  speakerId: z.string().refine(isOfficeSpeaker, { message: 'unknown speaker' }),
  text: z.string().min(1).max(800),
  lang: z.string().max(16).optional()
});

/**
 * One answer the user gave on the previous training form, echoed back so the
 * next one can quote it. A2UI data-model values are primitives or string
 * arrays (ChoicePicker's multi-select), so the union is the whole domain.
 */
const TrainingAnswerValueSchema = z.union([
  z.string().max(300),
  z.number(),
  z.boolean(),
  z.array(z.string().max(120)).max(12)
]);

const OfficeTrainingRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: DiagramSourceField,
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  officeLog: OfficeLogField,
  uiLocale: UiLocaleField,
  userName: z.string().max(80).optional(),
  moduleNumber: z.number().int().min(1).max(TRAINING_MODULE_TOTAL).default(3),
  step: z.number().int().min(1).max(TRAINING_STEPS).default(1),
  priorAnswers: z
    .array(z.object({ label: z.string().max(160), value: TrainingAnswerValueSchema }))
    .max(12)
    .default([]),
  modelProfile: ModelProfileField
});

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

function pickFacilitator(attendees) {
  return attendees.includes('scrumMaster') ? 'scrumMaster' : attendees[0];
}

/**
 * Seat count is the one validation that cannot live in the schema: it depends
 * on the mode. A one-seat mob and a two-seat pair are both nonsense, and saying
 * so here (rather than with a `min`) keeps the failure legible as "wrong roster
 * for this act" instead of "malformed request".
 *
 * @returns {string[] | null} normalized attendees, or null when the roster does
 *   not fit the mode.
 */
function huddleAttendeesForMode(payload) {
  const attendees = normalizeAttendees(payload.attendees, { minAttendees: 1 });
  if (!attendees || attendees.length > HUDDLE_MAX_ATTENDEES) return null;
  if (payload.mode === 'pair') return attendees.length === 1 ? attendees : null;
  return attendees.length >= 2 ? attendees : null;
}

/**
 * What to ask for this turn and how to read it back. The two modes diverge
 * completely here — different prompt, different parser. `priorBeats` is a mob
 * concern only: it names who has already spoken so a mid-scene re-script does
 * not rewrite remarks the user already heard. A pair is scripted once (see
 * `buildPairSystemPrompt`), so it ignores the field rather than pretending to
 * support a refresh the client never asks for.
 *
 * @returns {{system: string, parse: (raw: string) => object | null} | null}
 *   null when the ring has nothing left to say, so the caller can answer with
 *   an empty script instead of spending a call.
 */
function planHuddleTurn(payload, attendees, priorBeats) {
  if (payload.mode === 'pair') {
    const attendee = attendees[0];
    return {
      system: buildPairSystemPrompt({ attendee, uiLocale: payload.uiLocale }),
      parse: (raw) => parsePairScript(raw, { attendee })
    };
  }
  const spokenIds = new Set(priorBeats.map((b) => b.speakerId));
  const remaining =
    priorBeats.length > 0 ? attendees.filter((id) => !spokenIds.has(id)) : attendees;
  if (priorBeats.length > 0 && remaining.length === 0) return null;
  return {
    system: buildHuddleSystemPrompt({ attendees, uiLocale: payload.uiLocale, priorBeats }),
    parse: (raw) => parseHuddleScript(raw, { attendees: remaining })
  };
}

/**
 * The face-to-face counterpart to /meeting: no facilitator, no beat grammar.
 * `mode: 'mob'` is one remark per teammate in the order the client seated them;
 * `mode: 'pair'` is several remarks from the one person in the chair.
 *
 * Lives outside createOfficeRouter (unlike its siblings) because that factory
 * is already over the max-lines-per-function budget — new handlers extract.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('express').RequestHandler}
 */
export function createHuddleHandler(env) {
  return async (req, res) => {
    const parsed = OfficeHuddleRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid huddle payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const attendees = huddleAttendeesForMode(payload);
    if (!attendees) {
      res.status(400).json({ error: 'Invalid attendee list' });
      return;
    }

    let model;
    try {
      model = createOfficeChatModel(env, {
        purpose: 'meeting',
        live: true,
        modelProfile: payload.modelProfile
      });
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Office LLM is not configured on this server.' });
      return;
    }

    const priorBeats = Array.isArray(payload.priorBeats) ? payload.priorBeats : [];
    const turn = planHuddleTurn(payload, attendees, priorBeats);
    if (!turn) {
      res.status(200).json({ script: { beats: [] } });
      return;
    }
    const user = buildHuddleUserPrompt({ ...payload, priorBeats });
    const officeModel = resolveOfficeModelId(env, {
      purpose: 'meeting',
      live: true,
      modelProfile: payload.modelProfile
    });
    try {
      const reply = await model.invoke([new SystemMessage(turn.system), new HumanMessage(user)]);
      const usage = officeUsageFromReply(reply);
      const raw = extractTextContent(reply?.content ?? reply);
      res.status(200).json({
        script: turn.parse(raw),
        ...(usage ? { usage, model: officeModel } : {})
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  };
}

/**
 * Linda's compliance training (docs/office-parody.md §10.1) — the one office
 * endpoint that returns a document rather than dialogue.
 *
 * Two things make it unlike its siblings and both are deliberate:
 *
 * 1. **It validates through `parseFormsA2ui`, the same gate the `forms` slot
 *    uses**, and returns the canonical serialization. The client renders it
 *    with the interactive `FormsRenderer` in window-local state — it is never
 *    written to the user's `forms` slot (ADR-0010: the cast produces no slot
 *    content).
 * 2. **A rejected document answers 200 with `form: null`**, not 502. The client
 *    holds a canned module for exactly this, so a model that cannot hold the
 *    A2UI contract costs the user a slightly less personalized joke rather than
 *    an error toast.
 *
 * Lives outside createOfficeRouter for the same reason as createHuddleHandler:
 * that factory is already over the max-lines-per-function budget.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {import('express').RequestHandler}
 */
export function createTrainingHandler(env) {
  return async (req, res) => {
    const parsed = OfficeTrainingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid training payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;

    let model;
    try {
      model = createOfficeChatModel(env, {
        purpose: 'training',
        modelProfile: payload.modelProfile
      });
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Office LLM is not configured on this server.' });
      return;
    }

    const system = buildTrainingSystemPrompt({ uiLocale: payload.uiLocale, step: payload.step });
    const user = buildTrainingUserPrompt(payload);
    const officeModel = resolveOfficeModelId(env, {
      purpose: 'training',
      modelProfile: payload.modelProfile
    });
    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const usage = officeUsageFromReply(reply);
      const raw = extractTextContent(reply?.content ?? reply);
      const training = parseTrainingReply(raw);
      res.status(200).json({
        form: training?.form ?? null,
        formTitle: training?.formTitle ?? null,
        ...(usage ? { usage, model: officeModel } : {})
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  };
}

/**
 * Office-parody content endpoints (docs/office-parody.md). Quality-lane surfaces
 * (email, IM, meeting scripts, training) prefer DeepSeek; latency-lane surfaces
 * (walk-bys, huddles, live interjections) stay on decorative flash-lite. Strict
 * JSON replies, and the client always has a canned fallback — a null result
 * here is a feature, not an error.
 */
/**
 * @param {{ env?: NodeJS.ProcessEnv }} [opts]
 */
export function createOfficeRouter({ env = process.env } = {}) {
  const router = express.Router();
  router.use(createApiRateLimitMiddleware('llm'));

  router.post('/moment', async (req, res) => {
    const parsed = OfficeMomentRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid office payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    // Walk-bys exist to comment on the diagram — nothing to look at, no walk-by.
    if (payload.kind === 'walkby' && !payload.diagramSource.trim()) {
      res.status(200).json({ moment: null });
      return;
    }

    let model;
    try {
      model = createOfficeChatModel(env, {
        purpose: 'moment',
        kind: payload.kind,
        modelProfile: payload.modelProfile
      });
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Office LLM is not configured on this server.' });
      return;
    }

    const system = buildMomentSystemPrompt({
      kind: payload.kind,
      colleagueId: payload.colleagueId,
      uiLocale: payload.uiLocale,
      isReply: Boolean(payload.userMessage?.trim())
    });
    const user = buildMomentUserPrompt(payload);
    const officeModel = resolveOfficeModelId(env, {
      kind: payload.kind,
      modelProfile: payload.modelProfile
    });
    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const usage = officeUsageFromReply(reply);
      const raw = extractTextContent(reply?.content ?? reply);
      const moment = parseMomentReply(raw, {
        colleagueId: payload.colleagueId,
        kind: payload.kind
      });
      res.status(200).json({
        moment,
        ...(usage ? { usage, model: officeModel } : {})
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  });

  router.post('/meeting', async (req, res) => {
    const parsed = OfficeMeetingRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid meeting payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const attendees = normalizeAttendees(payload.attendees);
    if (!attendees) {
      res.status(400).json({ error: 'Invalid attendee list' });
      return;
    }

    let model;
    try {
      model = createOfficeChatModel(env, {
        purpose: 'meeting',
        modelProfile: payload.modelProfile
      });
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Office LLM is not configured on this server.' });
      return;
    }

    const facilitatorId = pickFacilitator(attendees);
    const system = buildMeetingSystemPrompt({
      attendees,
      facilitatorId,
      uiLocale: payload.uiLocale,
      contextSource: payload.contextSource,
      venue: payload.venue,
      // Silent by construction: the audience is named so the room feels full,
      // and explicitly forbidden a speakerId so it stays silent.
      audience: payload.audience.filter((id) => !attendees.includes(id))
    });
    const user = buildMeetingUserPrompt(payload);
    const officeModel = resolveOfficeModelId(env, {
      purpose: 'meeting',
      modelProfile: payload.modelProfile
    });
    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const usage = officeUsageFromReply(reply);
      const raw = extractTextContent(reply?.content ?? reply);
      const script = parseMeetingScript(raw, { attendees });
      res.status(200).json({
        script,
        ...(usage ? { usage, model: officeModel } : {})
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  });

  router.post('/huddle', createHuddleHandler(env));

  router.post('/training', createTrainingHandler(env));

  // Cloud TTS (Neural2 default, WaveNet switchback) or Web Speech fallback on
  // the client. No LLM — decorative audio
  // only. Returns { audio: null } when TTS is off / unconfigured / failed so
  // the client can degrade without an error toast.
  router.post('/speak', async (req, res) => {
    const parsed = OfficeSpeakRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid speak payload', details: parsed.error.flatten() });
      return;
    }
    if (!isOfficeTtsEnabled(env)) {
      res.status(200).json({ audio: null, reason: 'disabled' });
      return;
    }
    try {
      const audio = await synthesizeOfficeSpeech(parsed.data);
      res.status(200).json({ audio });
    } catch (error) {
      console.warn('office speak failed:', safeErrorMessage(error));
      res.status(200).json({ audio: null, reason: 'unavailable' });
    }
  });

  router.post('/meeting/interject', async (req, res) => {
    const parsed = OfficeInterjectRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid interject payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const attendees = normalizeAttendees(payload.attendees);
    if (!attendees) {
      res.status(400).json({ error: 'Invalid attendee list' });
      return;
    }

    let model;
    try {
      model = createOfficeChatModel(env, {
        purpose: 'meeting',
        live: true,
        modelProfile: payload.modelProfile
      });
    } catch (error) {
      res.status(503).json({ error: safeErrorMessage(error) });
      return;
    }
    if (!model) {
      res.status(503).json({ error: 'Office LLM is not configured on this server.' });
      return;
    }

    const facilitatorId = pickFacilitator(attendees);
    const system = buildInterjectSystemPrompt({
      attendees,
      facilitatorId,
      uiLocale: payload.uiLocale
    });
    const user = buildInterjectUserPrompt(payload);
    const officeModel = resolveOfficeModelId(env, {
      purpose: 'meeting',
      live: true,
      modelProfile: payload.modelProfile
    });
    try {
      const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
      const usage = officeUsageFromReply(reply);
      const raw = extractTextContent(reply?.content ?? reply);
      const beats = parseInterjectReply(raw, { attendees });
      res.status(200).json({
        beats,
        ...(usage ? { usage, model: officeModel } : {})
      });
    } catch (error) {
      res.status(502).json({ error: safeErrorMessage(error) });
    }
  });

  return router;
}
