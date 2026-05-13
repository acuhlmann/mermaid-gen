import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createSyntaxFixerModel, resolveSyntaxFixerTarget } from './llmProvider.js';
import { inferDiagramType } from './inferDiagramType.js';
import { getRulePack } from '../prompts/mermaidSyntaxGuard.js';
import { sanitizeMermaid } from './mermaidSanitizer.js';
import { validateMermaidStrict } from './mermaidReliabilitySkill.js';
import { extractTextContent } from '../utils/extractTextContent.js';

const SYSTEM_PROMPT = `You are a Mermaid syntax repair function. Given a broken Mermaid diagram and a parser error, output the smallest set of changes that yield valid Mermaid for the same intent.

CRITICAL output rules:
- Output ONLY the corrected Mermaid source between a single \`\`\`mermaid fenced block. No prose before or after.
- Preserve the user's original intent and node/edge identifiers wherever possible.
- Do not change the diagram type unless the parser error directly requires it.
- Never wrap the entire output in a JSON object; never call tools; never explain.`;

function extractMermaidFromResponse(text) {
  if (typeof text !== 'string') return '';
  const fenced = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1].trim();
  return text.trim();
}

/**
 * Single-shot, tool-less Mermaid syntax repair using a dedicated fast model. Independent
 * of the LangChain react-agent loop so it doesn't pay tool plumbing / system-prompt overhead.
 *
 * Returns `{ accepted: true, diagramSource }` when a corrected diagram passes
 * `validateMermaidStrict`, otherwise `{ accepted: false, error }`.
 *
 * @param {{ brokenSource: string, parseError?: string | null, originalRequest?: string | null, env?: NodeJS.ProcessEnv, modelOverride?: unknown }} args
 */
export async function repairMermaidWithFixer({ brokenSource, parseError, originalRequest, env, modelOverride } = {}) {
  if (typeof brokenSource !== 'string' || !brokenSource.trim()) {
    return { accepted: false, error: 'No broken source provided.' };
  }
  const model = modelOverride ?? createSyntaxFixerModel(env ?? process.env);
  if (!model) {
    return { accepted: false, error: 'Syntax fixer model is not configured.' };
  }

  const diagramType = inferDiagramType(brokenSource);
  const rulePack = getRulePack(diagramType);
  const errorText = (parseError ?? '').toString().trim() || 'Mermaid parser rejected the source.';

  const userContent = `${rulePack}
Parser error:
${errorText}

${originalRequest ? `Original user request (for intent only — do not echo):\n${originalRequest}\n\n` : ''}Broken Mermaid source:
\`\`\`mermaid
${brokenSource.trim()}
\`\`\`

Output the corrected Mermaid source between a single \`\`\`mermaid fenced block. No prose.`;

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
  const initial = extractMermaidFromResponse(text);
  if (!initial) {
    return { accepted: false, error: 'Syntax fixer returned empty output.' };
  }

  // Pass the fixer's output through the same sanitizer + validator the agent's patches use,
  // so any residual mechanical issues are still caught before declaring victory.
  const sanitized = sanitizeMermaid(initial);
  const candidate = sanitized.sanitized;

  const validation = await validateMermaidStrict(candidate);
  if (!validation.valid) {
    return { accepted: false, error: validation.error ?? 'Fixer output failed validation.' };
  }

  return {
    accepted: true,
    diagramSource: candidate,
    metadata: {
      validator: 'syntax-fixer',
      diagramType,
      sanitizerApplied: sanitized.applied
    }
  };
}

/** Returns true when a syntax-fixer model can be instantiated for the current environment. */
export function isSyntaxFixerAvailable(env = process.env) {
  return resolveSyntaxFixerTarget(env) != null;
}
