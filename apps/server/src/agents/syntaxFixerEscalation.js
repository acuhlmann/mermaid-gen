import {
  createSyntaxFixerModelForTarget,
  resolveSyntaxFixerEscalationLadder
} from './llmProvider.js';

/**
 * Run a syntax-fixer repair across the latency→quality ladder until one rung accepts.
 *
 * `repairOnce(model, previousAttempts, target)` must perform a single model call and return
 * `{ accepted, error?, diagramSource?, attemptedSource?, metadata? }` — the same shape each
 * `repair*WithFixer` already uses. When `modelOverride` is provided (tests), only that model
 * runs (no ladder).
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   previousAttempts?: Array<{ source: string, error: string }>,
 *   modelOverride?: unknown,
 *   brokenSource?: string,
 *   repairOnce: (
 *     model: unknown,
 *     previousAttempts: Array<{ source: string, error: string }>,
 *     target: { backend: string, modelId: string, tier: string } | null
 *   ) => Promise<{
 *     accepted: boolean,
 *     error?: string,
 *     diagramSource?: string,
 *     attemptedSource?: string,
 *     metadata?: Record<string, unknown>
 *   }>,
 *   onRung?: (
 *     target: { backend: string, modelId: string, tier: string },
 *     index: number,
 *     ladderSize: number
 *   ) => void,
 *   maxOutputTokens?: number
 * }} args
 */
export async function escalateSyntaxFixerRepair({
  env = process.env,
  previousAttempts,
  modelOverride = undefined,
  brokenSource = '',
  repairOnce,
  onRung,
  maxOutputTokens
} = {}) {
  if (typeof repairOnce !== 'function') {
    return { accepted: false, error: 'Syntax fixer repairOnce callback is required.' };
  }

  if (modelOverride != null) {
    return repairOnce(modelOverride, Array.isArray(previousAttempts) ? previousAttempts : [], null);
  }

  const ladder = resolveSyntaxFixerEscalationLadder(env);
  if (ladder.length === 0) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  /** @type {Array<{ source: string, error: string }>} */
  const prior = Array.isArray(previousAttempts) ? [...previousAttempts] : [];
  let last = {
    accepted: false,
    error: 'Syntax fixer could not repair the source.'
  };

  const modelOptions =
    Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? { maxOutputTokens } : {};

  for (let i = 0; i < ladder.length; i += 1) {
    const target = ladder[i];
    const model = createSyntaxFixerModelForTarget(env, target, modelOptions);
    if (!model) continue;
    if (typeof onRung === 'function') onRung(target, i, ladder.length);

    last = await repairOnce(model, prior, target);
    if (last?.accepted) {
      return {
        ...last,
        metadata: {
          ...(last.metadata && typeof last.metadata === 'object' ? last.metadata : {}),
          fixerTier: target.tier,
          fixerModel: `${target.backend}:${target.modelId}`,
          fixerRung: i + 1,
          fixerLadderSize: ladder.length
        }
      };
    }

    const failedSource =
      (typeof last?.attemptedSource === 'string' && last.attemptedSource.trim()) ||
      (typeof brokenSource === 'string' && brokenSource.trim()) ||
      '';
    if (failedSource) {
      prior.push({
        source: failedSource,
        error: `[${target.tier}:${target.modelId}] ${last?.error ?? 'fixer rejected'}`
      });
    }
  }

  const detail = last?.error
    ? `${last.error} (exhausted ${ladder.length}-rung fixer ladder)`
    : `Syntax fixer exhausted ${ladder.length}-rung ladder.`;
  return { ...last, accepted: false, error: detail };
}
