import express from 'express';
import { z } from 'zod';
import { ContentTypeSchema, OfficeMomentKindSchema } from '@archislop/shared';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { extractTextContent } from '../utils/extractTextContent.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';
import {
  buildInterjectSystemPrompt,
  buildInterjectUserPrompt,
  buildMeetingSystemPrompt,
  buildMeetingUserPrompt,
  buildMomentSystemPrompt,
  buildMomentUserPrompt,
  createOfficeChatModel,
  isOfficeSpeaker,
  normalizeAttendees,
  officeUsageFromReply,
  parseInterjectReply,
  parseMeetingScript,
  parseMomentReply,
  resolveOfficeModelId
} from '../agents/officePersonas.js';
import { isOfficeTtsEnabled, synthesizeOfficeSpeech } from '../agents/officeTts.js';

/**
 * The chrome locale the office cast should speak. Unlike diagram agents (which
 * infer language from the diagram's own script via promptLanguage.ts), the
 * office layer follows the UI — see buildOfficeLanguageRule.
 */
const UiLocaleField = z.string().max(16).optional();

const OfficeThreadLineSchema = z.object({
  from: z.enum(['user', 'colleague']),
  body: z.string().max(300)
});

const OfficeMomentRequestSchema = z.object({
  kind: OfficeMomentKindSchema,
  colleagueId: z.string().refine(isOfficeSpeaker, { message: 'unknown colleague' }),
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  recentMoments: z.array(z.string().max(400)).max(5).default([]),
  uiLocale: UiLocaleField,
  userName: z.string().max(80).optional(),
  userMessage: z.string().max(400).optional(),
  threadTranscript: z.array(OfficeThreadLineSchema).max(12).optional()
});

const OfficeMeetingRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  attendees: z.array(z.string().max(40)).min(1).max(8),
  topic: z.string().max(200).optional(),
  uiLocale: UiLocaleField
});

const OfficeInterjectRequestSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string().max(20_000).default(''),
  visibleLabels: z.array(z.string().max(200)).max(60).default([]),
  attendees: z.array(z.string().max(40)).min(1).max(8),
  transcriptSoFar: z.array(z.string().max(300)).max(20).default([]),
  interjection: z.string().min(1).max(400),
  uiLocale: UiLocaleField
});

const OfficeSpeakRequestSchema = z.object({
  speakerId: z.string().refine(isOfficeSpeaker, { message: 'unknown speaker' }),
  text: z.string().min(1).max(800),
  lang: z.string().max(16).optional()
});

function safeErrorMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

function pickFacilitator(attendees) {
  return attendees.includes('scrumMaster') ? 'scrumMaster' : attendees[0];
}

/**
 * Office-parody content endpoints (docs/office-parody.md). All decorative:
 * cheap fast-tier model, strict-JSON replies, and the client always has a
 * canned fallback — a null result here is a feature, not an error.
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
      model = createOfficeChatModel(env, { purpose: 'moment' });
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
    const officeModel = resolveOfficeModelId(env);
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
      model = createOfficeChatModel(env, { purpose: 'meeting' });
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
      uiLocale: payload.uiLocale
    });
    const user = buildMeetingUserPrompt(payload);
    const officeModel = resolveOfficeModelId(env);
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
      model = createOfficeChatModel(env, { purpose: 'meeting' });
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
    const officeModel = resolveOfficeModelId(env);
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
