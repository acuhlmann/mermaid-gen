import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { resolveSyntaxFixerTarget } from './llmProvider.js';
import { escalateSyntaxFixerRepair } from './syntaxFixerEscalation.js';
import { validateMetaphorStrict } from '../tools/metaphorDslTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { METAPHOR_RULE_PACK, METAPHOR_SELF_CHECK } from '../prompts/metaphorSyntaxGuard.js';

const SYSTEM_PROMPT = `You are a Metaphor DSL JSON syntax repair function. Given broken JSON and a validation error, output the smallest fix that yields valid metaphor DSL for the same intent.

CRITICAL output rules:
- Output ONLY the corrected JSON between a single \`\`\`json fenced block. No prose before or after.
- Preserve the user's metaphor choice and item labels wherever possible.
- Valid metaphors: "city", "layercake", "galaxy", "tree", "terrain", "orrery", "river", "garden", "archipelago", "machine", "bridge", "cycle".
- Never call tools; never wrap output in a JSON envelope; never explain.`;

function extractJsonFromResponse(text) {
  if (typeof text !== 'string') return '';
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const braceStart = text.indexOf('{');
  const braceEnd = text.lastIndexOf('}');
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1).trim();
  }
  return text.trim();
}

/**
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, model: unknown, abortSignal?: AbortSignal | null }} args
 */
async function repairMetaphorOnce({
  brokenSource,
  parseError,
  originalRequest,
  model,
  abortSignal
}) {
  if (!model) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  const errorText =
    (parseError ?? '').toString().trim() || 'Metaphor DSL did not pass Zod validation.';

  const userContent = `${METAPHOR_RULE_PACK}

${METAPHOR_SELF_CHECK}

Validation error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken Metaphor DSL:
\`\`\`json
${brokenSource.trim()}
\`\`\`

Output the corrected JSON between a single \`\`\`json fenced block. No prose.`;

  let response;
  try {
    response = await model.invoke(
      [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userContent)],
      abortSignal ? { signal: abortSignal } : undefined
    );
  } catch (error) {
    return {
      accepted: false,
      error: `Syntax fixer call failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const text = extractTextContent(response?.content ?? response?.kwargs?.content ?? '');
  const candidate = extractJsonFromResponse(text);
  if (!candidate) {
    return { accepted: false, error: 'Syntax fixer returned empty output.' };
  }

  const validation = validateMetaphorStrict(candidate);
  if (!validation.valid) {
    return {
      accepted: false,
      error: validation.error ?? 'Fixer output failed validation.',
      attemptedSource: candidate
    };
  }

  return {
    accepted: true,
    diagramSource: validation.diagramSource,
    metadata: {
      validator: 'metaphor-syntax-fixer',
      metaphor: validation.metaphor
    }
  };
}

/**
 * Metaphor DSL repair with latency→quality fixer escalation (lite → flash → DeepSeek).
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown, abortSignal?: AbortSignal | null }} args
 */
export async function repairMetaphorWithFixer({
  brokenSource,
  parseError,
  originalRequest,
  env,
  modelOverride,
  abortSignal
} = {}) {
  if (typeof brokenSource !== 'string' || !brokenSource.trim()) {
    return { accepted: false, error: 'No broken source provided.' };
  }

  return escalateSyntaxFixerRepair({
    env: env ?? process.env,
    modelOverride,
    brokenSource,
    repairOnce: (model) =>
      repairMetaphorOnce({
        brokenSource,
        parseError,
        originalRequest,
        model,
        abortSignal
      })
  });
}

export function isMetaphorSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
