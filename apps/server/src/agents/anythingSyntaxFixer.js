import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { ANYTHING_LIB_IDS } from '@archislop/shared';
import { resolveSyntaxFixerTarget } from './llmProvider.js';
import { escalateSyntaxFixerRepair } from './syntaxFixerEscalation.js';
import { validateAnythingStrict } from '../tools/anythingHtmlTool.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { withLlmUsage } from './_lib/attachLlmUsage.js';
import { ANYTHING_RULE_PACK, ANYTHING_SELF_CHECK } from '../prompts/anythingSyntaxGuard.js';

const SYSTEM_PROMPT = `You are an Anything-mode HTML syntax repair function. Given broken HTML/CSS/JS and a validation error, output the smallest fix that yields a valid, self-contained document for the same intent.

CRITICAL output rules:
- Output ONLY the corrected HTML document between a single \`\`\`html fenced block. No prose before or after.
- Preserve the user's concept, layout, and interactivity wherever possible.
- All CSS must stay inline in <style> tags; all JS inline in <script> tags.
- No external URLs, no window.parent/top, no nested iframes, no javascript: URLs.
- Keep valid <!-- @lib:… --> library markers as-is (allowlisted ids: ${ANYTHING_LIB_IDS.join(', ')}); rewrite unknown marker ids to an allowlisted one or remove them.
- Never call tools; never explain.`;

function extractHtmlFromResponse(text) {
  if (typeof text !== 'string') return '';
  const fenced = text.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  const docStart = text.search(/<!doctype\s+html|<html[\s>]/i);
  if (docStart !== -1) {
    const tailEnd = text.toLowerCase().lastIndexOf('</html>');
    const end = tailEnd !== -1 ? tailEnd + '</html>'.length : text.length;
    return text.slice(docStart, end).trim();
  }
  return text.trim();
}

/**
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, model: unknown, abortSignal?: AbortSignal | null }} args
 */
async function repairAnythingOnce({
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
    (parseError ?? '').toString().trim() || 'Anything HTML did not pass validation.';

  const userContent = `${ANYTHING_RULE_PACK}

${ANYTHING_SELF_CHECK}

Validation error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken HTML document:
\`\`\`html
${brokenSource.trim()}
\`\`\`

Output the corrected HTML between a single \`\`\`html fenced block. No prose.`;

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
  const candidate = extractHtmlFromResponse(text);
  if (!candidate) {
    return withLlmUsage(
      { accepted: false, error: 'Syntax fixer returned empty output.' },
      response
    );
  }

  const validation = validateAnythingStrict(candidate);
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
        validator: 'anything-syntax-fixer',
        quality: validation.quality
      }
    },
    response
  );
}

/**
 * Anything HTML repair with latency→quality fixer escalation (lite → flash → DeepSeek).
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown, abortSignal?: AbortSignal | null, onModelCall?: Function }} args
 */
export async function repairAnythingWithFixer({
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
      repairAnythingOnce({
        brokenSource,
        parseError,
        originalRequest,
        model,
        abortSignal
      })
  });
}

export function isAnythingSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
