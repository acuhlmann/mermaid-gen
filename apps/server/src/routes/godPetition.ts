/**
 * Conversational prayer & Wish-to-PR petition routes for ArchiSlop God.
 *
 * Mounted on `/api/god` *ahead* of `createGodWindowGate()` so ordinary Studio & Office users
 * (behind `createVisitorBadgeGate()` when enabled) can summon ArchiSlop God, receive judgment,
 * and petition a PR—while `/api/god/status` and `/api/god/live/:runId` stay owner-only behind
 * `GOD_WINDOW_TOKEN`.
 */
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  createLlmChatModel,
  isLlmConfigured,
  resolveLlmModelLabel
} from '../agents/llmProvider.js';
import { createApiRateLimitMiddleware } from '../middleware/apiRateLimit.js';
import { createIpRateLimiter, keyByRequestIp } from '../utils/ipRateLimit.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { isGodTtsEnabled, synthesizeGodSpeech } from '../agents/godTts.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  GOD_OFFERINGS,
  GOD_PETITION_MODES,
  GodOfferingIdSchema,
  GodMoodSchema,
  GodPrProposalSchema,
  GodSessionReceiptsSchema,
  buildGodPetitionSystemPrompt,
  buildGodPetitionUserPrompt,
  buildOfflineOracleReply,
  clampFavor,
  parseGodPetitionReply,
  type GodPetitionParsedReply
} from '../god/godPetitionPrompt.js';
import {
  GOD_WORKFLOW_FOCUSES,
  dispatchPetitionWorkflow,
  filePetitionPr,
  getPetitionWorkflowStatus,
  inferGodWorkflowFocus,
  resolvePetitionBaseBranch,
  resolvePetitionGitHubToken,
  resolvePetitionRepo,
  type DispatchPetitionWorkflowOptions,
  type FilePetitionPrOptions,
  type GodPrActionResult,
  type GodWorkflowDispatchResult,
  type GodWorkflowRunStatusResult
} from '../god/godPetitionPr.js';

type Env = Record<string, string | undefined>;

const DialogueMessageSchema = z.object({
  role: z.enum(['user', 'god']),
  content: z.string().trim().min(1).max(2_000)
});

const PetitionBodySchema = z.object({
  messages: z.array(DialogueMessageSchema).min(1).max(24),
  offering: GodOfferingIdSchema.default('none'),
  currentFavor: z.number().min(0).max(100).default(35),
  userName: z.string().max(80).optional(),
  modelProfile: z.enum(['fast', 'quality']).optional(),
  mode: z.enum(GOD_PETITION_MODES).optional().default('prayer'),
  sessionReceipts: GodSessionReceiptsSchema.optional(),
  diagramContext: z
    .object({
      contentType: z.string().max(40).optional(),
      diagramSource: z.string().max(8_000).optional()
    })
    .optional()
});

const FilePrBodySchema = z.object({
  proposal: GodPrProposalSchema,
  prayerSummary: z.string().max(1_000).optional(),
  favor: z.number().min(0).max(100).default(70),
  userName: z.string().max(80).optional(),
  dispatchWorkflow: z.boolean().default(true)
});

const SpeakBodySchema = z.object({
  text: z.string().min(1).max(800),
  mood: GodMoodSchema.optional().default('amused')
});

const DispatchWorkflowBodySchema = z.object({
  ref: z.string().trim().min(1).max(120).optional(),
  focus: z.enum(GOD_WORKFLOW_FOCUSES).optional(),
  proposal: GodPrProposalSchema.partial().optional()
});

const WorkflowStatusQuerySchema = z.object({
  ref: z.string().trim().min(1).max(120).optional(),
  since: z.string().trim().min(1).max(64).optional()
});

export const GOD_PETITION_ROUTE_BASE = '/petition';

export type GodPetitionRouterOptions = {
  env?: Env;
  synthesizeSpeech?: (input: {
    text: string;
    mood: string;
  }) => Promise<{ audioBase64: string; mimeType: string; voiceName: string; lang: string } | null>;
  invokeModel?: (input: {
    system: string;
    user: string;
    modelProfile: 'fast' | 'quality';
  }) => Promise<string>;
  filePr?: (options: FilePetitionPrOptions) => Promise<GodPrActionResult>;
  dispatchWorkflow?: (
    options: DispatchPetitionWorkflowOptions
  ) => Promise<GodWorkflowDispatchResult>;
  getWorkflowStatus?: (options: {
    ref?: string;
    since?: string;
    env?: Env;
  }) => Promise<GodWorkflowRunStatusResult>;
  nowMs?: () => number;
};

function safeError(error: unknown): string {
  if (error instanceof Error) return redactSecrets(error.message);
  if (typeof error === 'string') return redactSecrets(error);
  return 'The celestial relay encountered an unexpected fault.';
}

async function defaultInvokeModel(
  env: Env,
  input: { system: string; user: string; modelProfile: 'fast' | 'quality' }
): Promise<string> {
  const model = createLlmChatModel(env, {
    modelProfile: input.modelProfile,
    temperature: 0.9,
    maxOutputTokens: 1200
  });
  const reply = await model.invoke([new SystemMessage(input.system), new HumanMessage(input.user)]);
  return extractTextContent(reply?.content ?? reply);
}

function buildCapabilitiesPayload(env: Env) {
  return {
    v: 1,
    llmConfigured: isLlmConfigured(env),
    githubPrConfigured: Boolean(resolvePetitionGitHubToken(env)),
    godTtsConfigured: isGodTtsEnabled(env),
    repo: resolvePetitionRepo(env),
    offerings: GOD_OFFERINGS
  };
}

function isLlmMissingError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    (error as { name?: string }).name === 'LlmNotConfiguredError'
  );
}

function respondWithOracle(
  res: Response,
  payload: z.infer<typeof PetitionBodySchema>,
  oracleReason: 'unconfigured' | 'fallback',
  warning?: string
) {
  const result: GodPetitionParsedReply = buildOfflineOracleReply({
    messages: payload.messages,
    offering: payload.offering,
    currentFavor: clampFavor(payload.currentFavor),
    userName: payload.userName,
    diagramContext: payload.diagramContext,
    sessionReceipts: payload.sessionReceipts,
    mode: payload.mode
  });
  res.status(200).json({
    v: 1,
    mode: 'offline-oracle',
    llmConfigured: oracleReason === 'fallback',
    ...(warning ? { warning } : {}),
    ...result
  });
}

function createPetitionWriteRateLimit() {
  const writeLimiter = createIpRateLimiter({
    windowMs: 60_000,
    maxHits: 30,
    keyFn: keyByRequestIp
  });
  return (req: Request, res: Response, next: express.NextFunction) => {
    if (writeLimiter.isLimited(req)) {
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }
    writeLimiter.recordHit(req);
    next();
  };
}

export function createGodPetitionRouter(options: GodPetitionRouterOptions = {}) {
  const env = options.env ?? process.env;
  const router = express.Router();
  const llmRateLimit = createApiRateLimitMiddleware('llm');
  const writeRateLimit = createPetitionWriteRateLimit();

  router.get('/petition/capabilities', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json(buildCapabilitiesPayload(env));
  });

  // Cloud TTS for spoken decrees (Chirp3-HD Charon → Neural2 → WaveNet in
  // godTts.js) or { audio: null } so the client degrades to Web Speech.
  // No LLM — decorative audio only, so it shares the office TTS contract.
  router.post('/petition/speak', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const parsed = SpeakBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid speak payload', details: parsed.error.flatten() });
      return;
    }
    if (!options.synthesizeSpeech && !isGodTtsEnabled(env)) {
      res.status(200).json({ audio: null, reason: 'disabled' });
      return;
    }
    try {
      const audio = options.synthesizeSpeech
        ? await options.synthesizeSpeech(parsed.data)
        : await synthesizeGodSpeech(parsed.data, env);
      res.status(200).json({ audio });
    } catch (error) {
      console.warn('god speak failed:', safeError(error));
      res.status(200).json({ audio: null, reason: 'unavailable' });
    }
  });

  router.post('/petition', llmRateLimit, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const parsed = PetitionBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid prayer payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const currentFavor = clampFavor(payload.currentFavor);

    if (!options.invokeModel && !isLlmConfigured(env)) {
      respondWithOracle(res, payload, 'unconfigured');
      return;
    }

    const profile = payload.modelProfile ?? 'fast';
    const system = buildGodPetitionSystemPrompt();
    const user = buildGodPetitionUserPrompt({
      messages: payload.messages,
      offering: payload.offering,
      currentFavor,
      userName: payload.userName,
      diagramContext: payload.diagramContext,
      sessionReceipts: payload.sessionReceipts,
      mode: payload.mode
    });

    try {
      const raw = options.invokeModel
        ? await options.invokeModel({ system, user, modelProfile: profile })
        : await defaultInvokeModel(env, { system, user, modelProfile: profile });
      const judgment = parseGodPetitionReply(raw, currentFavor);
      res.status(200).json({
        v: 1,
        mode: 'llm',
        llmConfigured: true,
        model: resolveLlmModelLabel(env, profile) ?? 'custom',
        ...judgment
      });
    } catch (error) {
      if (isLlmMissingError(error)) {
        respondWithOracle(res, payload, 'unconfigured');
        return;
      }
      res.status(502).json({ error: safeError(error) });
    }
  });

  router.post('/petition/file-pr', writeRateLimit, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const parsed = FilePrBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid PR decree payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const runner = options.filePr ?? filePetitionPr;
    try {
      const result = await runner({
        proposal: payload.proposal,
        prayerSummary: payload.prayerSummary,
        favor: clampFavor(payload.favor),
        userName: payload.userName,
        dispatchWorkflow: payload.dispatchWorkflow,
        env,
        nowMs: options.nowMs
      });
      res.status(200).json({ v: 1, ...result });
    } catch (error) {
      res.status(502).json({ error: safeError(error) });
    }
  });

  router.post('/petition/dispatch', writeRateLimit, async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const parsed = DispatchWorkflowBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'Invalid workflow dispatch payload', details: parsed.error.flatten() });
      return;
    }
    const payload = parsed.data;
    const baseBranch = resolvePetitionBaseBranch(env);
    const focus = payload.focus ?? inferGodWorkflowFocus(payload.proposal ?? {});
    const runner = options.dispatchWorkflow ?? dispatchPetitionWorkflow;
    try {
      const result = await runner({
        ref: payload.ref ?? baseBranch,
        fallbackRef: baseBranch,
        focus,
        env
      });
      res.status(200).json({ v: 1, ...result });
    } catch (error) {
      res.status(502).json({ error: safeError(error) });
    }
  });

  router.get('/petition/workflow-status', async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    const parsed = WorkflowStatusQuerySchema.safeParse({
      ref: typeof req.query.ref === 'string' ? req.query.ref : undefined,
      since: typeof req.query.since === 'string' ? req.query.since : undefined
    });
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'Invalid workflow status query', details: parsed.error.flatten() });
      return;
    }
    const runner = options.getWorkflowStatus ?? getPetitionWorkflowStatus;
    try {
      const status = await runner({
        ref: parsed.data.ref,
        since: parsed.data.since,
        env
      });
      res.status(200).json({ v: 1, ...status });
    } catch (error) {
      res.status(502).json({ error: safeError(error) });
    }
  });

  return router;
}
