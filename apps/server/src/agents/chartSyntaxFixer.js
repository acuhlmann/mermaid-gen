import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { resolveSyntaxFixerTarget } from './llmProvider.js';
import { escalateSyntaxFixerRepair } from './syntaxFixerEscalation.js';
import { validateChartStrict } from '../tools/chartDslTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { withLlmUsage } from './_lib/attachLlmUsage.js';
import { CHART_RULE_PACK, CHART_SELF_CHECK } from '../prompts/chartSyntaxGuard.js';
import {
  CHART_FLINT_SELF_CHECK,
  CHART_FLINT_SYSTEM_PROMPT
} from '../prompts/chartFlintSystemPrompt.js';
import { isFlintChartAuthoringEnabled } from '../tools/chartFlintAuthoring.js';

const SYSTEM_PROMPT = `You are a Chart DSL JSON syntax repair function. Given broken JSON (an archislop chart wrapper containing a Vega-Lite spec) and a validation error, output the smallest fix that yields a valid wrapper + spec for the same intent.

CRITICAL output rules:
- Output ONLY the corrected JSON between a single \`\`\`json fenced block. No prose before or after.
- Preserve the user's mark choice, data values, and encodings wherever possible.
- The wrapper has exactly: "archislopVersion": 1, "theme", "spec".
- Themes: "whiteboard", "noir", "arcade", "blueprint".
- Inside spec, keep "$schema" at "https://vega.github.io/schema/vega-lite/v5.json".
- Every encoding must have both "field" and "type" ("quantitative" | "ordinal" | "nominal" | "temporal").
- Never call tools; never wrap output in a JSON envelope; never explain.`;

const FLINT_SYSTEM_PROMPT = `You are a Chart DSL JSON syntax repair function. Given broken JSON (an archislop chart wrapper containing a Flint chart spec under "flint") and a validation error, output the smallest fix that yields a valid Flint wrapper for the same intent.

CRITICAL output rules:
- Output ONLY the corrected JSON between a single \`\`\`json fenced block. No prose before or after.
- Keep the wrapper in Flint form: "archislopVersion": 1, "theme", "flint" — do not convert it to Vega-Lite.
- Preserve the chart type, data values, and encodings wherever possible.
- Never call tools; never wrap output in a JSON envelope; never explain.`;

/** Under the Flint trial a broken Flint wrapper is repaired as Flint, so the trial's arms stay apart. */
function resolveFixerRules(brokenSource, env) {
  if (isFlintChartAuthoringEnabled(env) && /"flint"\s*:/.test(brokenSource)) {
    return {
      systemPrompt: FLINT_SYSTEM_PROMPT,
      rulePack: CHART_FLINT_SYSTEM_PROMPT,
      selfCheck: CHART_FLINT_SELF_CHECK
    };
  }
  return { systemPrompt: SYSTEM_PROMPT, rulePack: CHART_RULE_PACK, selfCheck: CHART_SELF_CHECK };
}

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
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, model: unknown, abortSignal?: AbortSignal | null, env?: NodeJS.ProcessEnv }} args
 */
async function repairChartOnce({
  brokenSource,
  parseError,
  originalRequest,
  model,
  abortSignal,
  env
}) {
  if (!model) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  const errorText = (parseError ?? '').toString().trim() || 'Chart DSL did not pass validation.';

  const rules = resolveFixerRules(brokenSource, env);
  const userContent = `${rules.rulePack}

${rules.selfCheck}

Validation error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken Chart DSL:
\`\`\`json
${brokenSource.trim()}
\`\`\`

Output the corrected JSON between a single \`\`\`json fenced block. No prose.`;

  let response;
  try {
    response = await model.invoke(
      [new SystemMessage(rules.systemPrompt), new HumanMessage(userContent)],
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
    return withLlmUsage(
      { accepted: false, error: 'Syntax fixer returned empty output.' },
      response
    );
  }

  const validation = validateChartStrict(candidate, env);
  if (!validation.valid) {
    return withLlmUsage(
      {
        accepted: false,
        error: validation.error ?? 'Fixer output failed validation.',
        attemptedSource: candidate
      },
      response
    );
  }

  return withLlmUsage(
    {
      accepted: true,
      diagramSource: validation.diagramSource,
      metadata: {
        validator: 'chart-syntax-fixer',
        theme: validation.theme
      }
    },
    response
  );
}

/**
 * Chart DSL repair with latency→quality fixer escalation (lite → flash → DeepSeek).
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown, abortSignal?: AbortSignal | null, onModelCall?: Function }} args
 */
export async function repairChartWithFixer({
  brokenSource,
  parseError,
  originalRequest,
  env,
  modelOverride,
  abortSignal,
  onModelCall
} = {}) {
  if (typeof brokenSource !== 'string' || !brokenSource.trim()) {
    return { accepted: false, error: 'No broken source provided.' };
  }

  return escalateSyntaxFixerRepair({
    env: env ?? process.env,
    modelOverride,
    brokenSource,
    onModelCall,
    repairOnce: (model) =>
      repairChartOnce({
        brokenSource,
        parseError,
        originalRequest,
        model,
        abortSignal,
        env: env ?? process.env
      })
  });
}

export function isChartSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
