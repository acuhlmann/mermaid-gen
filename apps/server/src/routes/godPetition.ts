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
import { extractTextContent } from '../utils/extractTextContent.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  GOD_OFFERINGS,
  GodOfferingIdSchema,
  GodPrProposalSchema,
  buildGodPetitionSystemPrompt,
  buildGodPetitionUserPrompt,
  buildOfflineOracleReply,
  clampFavor,
  parseGodPetitionReply,
  type GodPetitionParsedReply
} from '../god/godPetitionPrompt.js';
import {
  filePetitionPr,
  resolvePetitionGitHubToken,
  resolvePetitionRepo,
  type FilePetitionPrOptions,
  type GodPrActionResult
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
  userName: z.string().max(80).optional()
});

export const GOD_PETITION_ROUTE_BASE = '/petition';

export type GodPetitionRouterOptions = {
  env?: Env;
  invokeModel?: (input: {
    system: string;
    user: string;
    modelProfile: 'fast' | 'quality';
  }) => Promise<string>;
  filePr?: (options: FilePetitionPrOptions) => Promise<GodPrActionResult>;
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
    diagramContext: payload.diagramContext
  });
  res.status(200).json({
    v: 1,
    mode: 'offline-oracle',
    llmConfigured: oracleReason === 'fallback',
    ...(warning ? { warning } : {}),
    ...result
  });
}

export function createGodPetitionRouter(options: GodPetitionRouterOptions = {}) {
  const env = options.env ?? process.env;
  const router = express.Router();
  router.use(createApiRateLimitMiddleware('llm'));

  router.get('/petition/capabilities', (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    res.status(200).json(buildCapabilitiesPayload(env));
  });

  router.post('/petition', async (req: Request, res: Response) => {
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
      diagramContext: payload.diagramContext
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

  router.post('/petition/file-pr', async (req: Request, res: Response) => {
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
        env,
        nowMs: options.nowMs
      });
      res.status(200).json({ v: 1, ...result });
    } catch (error) {
      res.status(502).json({ error: safeError(error) });
    }
  });

  return router;
}
