import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { resolveSyntaxFixerTarget } from './llmProvider.js';
import { escalateSyntaxFixerRepair } from './syntaxFixerEscalation.js';
import { validateFormsStrict } from '../tools/formsA2uiTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { FORMS_CORE_RULES } from '../prompts/formsSystemPrompt.js';
import { FORMS_SELF_CHECK } from '../prompts/formsSyntaxGuard.js';

/** Forms A2UI docs can be large; fixer output needs more headroom than chart/metaphor. */
const FORMS_FIXER_MAX_OUTPUT_TOKENS = 8192;

const SYSTEM_PROMPT = `You are a Forms-mode A2UI JSON syntax repair function. Given a broken forms document (archislopFormsVersion wrapper + A2UI v0.9 messages) and a validation error, output the smallest fix that yields a valid document for the same intent.

CRITICAL output rules:
- Output ONLY the corrected JSON between a single \`\`\`json fenced block. No prose before or after.
- Preserve formTitle, formCode, agencyName, parody voice, field labels, and microcopy wherever possible.
- Keep archislopFormsVersion: 1 and a non-empty formTitle.
- messages order: createSurface → updateComponents (≥1) → updateDataModel.
- Exactly one component with id "root". Only basic-catalog component names.
- ≥1 input (TextField/CheckBox/ChoicePicker/Slider/DateTimeInput) and ≥1 Button.
- Every Button uses action { "event": { "name": "…" } } — never functionCall; never put "checks" on a Button.
- Never call tools; never explain.`;

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
async function repairFormsOnce({ brokenSource, parseError, originalRequest, model, abortSignal }) {
  if (!model) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  const errorText =
    (parseError ?? '').toString().trim() ||
    'Forms document did not pass A2UI allowlist validation.';

  const userContent = `${FORMS_CORE_RULES}

${FORMS_SELF_CHECK}

Validation error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken forms document:
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

  const validation = validateFormsStrict(candidate);
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
      validator: 'forms-syntax-fixer',
      formTitle: validation.formTitle
    }
  };
}

/**
 * Forms A2UI repair with latency→quality fixer escalation (lite → flash → DeepSeek).
 * Same ladder as chart/metaphor; higher maxOutputTokens for large form documents.
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown, abortSignal?: AbortSignal | null }} args
 */
export async function repairFormsWithFixer({
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
    maxOutputTokens: FORMS_FIXER_MAX_OUTPUT_TOKENS,
    repairOnce: (model) =>
      repairFormsOnce({
        brokenSource,
        parseError,
        originalRequest,
        model,
        abortSignal
      })
  });
}

export function isFormsSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
