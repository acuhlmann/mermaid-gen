import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createSyntaxFixerModel, resolveSyntaxFixerTarget } from './llmProvider.js';
import {
  getInfographicRulePack,
  inferInfographicTemplate
} from '../prompts/infographicSyntaxGuard.js';
import { validateInfographicStrict } from '../tools/infographicDslTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';

const SYSTEM_PROMPT = `You are an AntV Infographic DSL syntax repair function. Given a broken DSL and a parser error, output the smallest set of changes that yield a valid DSL for the same intent.

CRITICAL output rules:
- Output ONLY the corrected DSL between a single \`\`\` fenced block. No prose before or after.
- Emit EXACTLY ONE \`infographic <template>\` header. Do NOT concatenate multiple drafts.
- Preserve the user's original intent and labels wherever possible. Keep the same language.
- Do not change the template unless the parser error directly requires it.
- ASCII quotes only. Tabs are forbidden. Indent strictly with 2 spaces per level.
- Object-array items begin with \`- \` (hyphen + space). Their children indent 2 more.
- Never call tools; never wrap output in a JSON object; never explain.`;

function extractDslFromResponse(text) {
  if (typeof text !== 'string') return '';
  const fenced = text.match(/```(?:[a-z0-9-]+)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  return text.trim();
}

/**
 * Single-shot, tool-less Infographic DSL repair using a dedicated fast model. Mirrors
 * `repairMermaidWithFixer` so it sits BEFORE the full agent retry loop and skips the
 * tool-plumbing / system-prompt overhead that often costs us a successful first attempt
 * after a tool rejection.
 *
 * Returns `{ accepted: true, diagramSource, metadata }` when the corrected DSL passes
 * `validateInfographicStrict`, otherwise `{ accepted: false, error }`.
 *
 * The fixer uses the same env config as Mermaid (`MERMAID_REPAIR_BACKEND` / `MERMAID_REPAIR_MODEL`)
 * because both fixers want the same kind of model — a fast, cheap, deterministic-ish
 * model that's good at following narrow syntactic instructions.
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown, abortSignal?: AbortSignal | null }} args
 */
export async function repairInfographicWithFixer({
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
  const model = modelOverride ?? createSyntaxFixerModel(env ?? process.env);
  if (!model) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  const templateName = inferInfographicTemplate(brokenSource);
  const rulePack = getInfographicRulePack(templateName);
  const errorText =
    (parseError ?? '').toString().trim() || 'AntV Infographic parser rejected the source.';

  const userContent = `${rulePack}
Parser error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken Infographic DSL:
\`\`\`
${brokenSource.trim()}
\`\`\`

Output the corrected DSL between a single \`\`\` fenced block. No prose.`;

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
  const candidate = extractDslFromResponse(text);
  if (!candidate) {
    return { accepted: false, error: 'Syntax fixer returned empty output.' };
  }

  // `validateInfographicStrict` runs sanitize + lint + parseSyntax, so it catches any
  // residual fence/quote/tab/template issues the fixer may have introduced.
  const validation = validateInfographicStrict(candidate);
  if (!validation.valid) {
    return { accepted: false, error: validation.error ?? 'Fixer output failed validation.' };
  }

  return {
    accepted: true,
    diagramSource: validation.diagramSource,
    metadata: {
      validator: 'infographic-syntax-fixer',
      template: validation.template ?? templateName
    }
  };
}

/** Returns true when a syntax-fixer model can be instantiated for the current environment. */
export function isInfographicSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
