import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createSyntaxFixerModel, resolveSyntaxFixerTarget } from './llmProvider.js';
import { validateMetaphorStrict } from '../tools/metaphorDslTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { METAPHOR_RULE_PACK, METAPHOR_SELF_CHECK } from '../prompts/metaphorSyntaxGuard.js';

const SYSTEM_PROMPT = `You are a Metaphor DSL JSON syntax repair function. Given broken JSON and a validation error, output the smallest fix that yields valid metaphor DSL for the same intent.

CRITICAL output rules:
- Output ONLY the corrected JSON between a single \`\`\`json fenced block. No prose before or after.
- Preserve the user's metaphor choice and item labels wherever possible.
- Valid metaphors: "city", "layercake", "galaxy", "tree", "terrain".
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
 * Single-shot metaphor DSL repair using the fast syntax-fixer model.
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown }} args
 */
export async function repairMetaphorWithFixer({
  brokenSource,
  parseError,
  originalRequest,
  env,
  modelOverride
} = {}) {
  if (typeof brokenSource !== 'string' || !brokenSource.trim()) {
    return { accepted: false, error: 'No broken source provided.' };
  }
  const model = modelOverride ?? createSyntaxFixerModel(env ?? process.env);
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
    response = await model.invoke([new SystemMessage(SYSTEM_PROMPT), new HumanMessage(userContent)]);
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
    return { accepted: false, error: validation.error ?? 'Fixer output failed validation.' };
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

export function isMetaphorSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
