/**
 * Quick "what does this label mean?" explainer for the canvas explain-it (?) chip.
 *
 * Unlike the persona-advisor, this is intentionally character-less: a fast model
 * returns ONE plain-text sentence about what the clicked label means in this
 * diagram — no kind, no highlightIds, no JSON envelope. The fewer hoops we
 * make the model jump through, the faster the popover lands.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
  fallbackLabelGibberish,
  getLabelExplainDumbLevel,
  appendProseLanguageInstruction,
  MATCH_USER_LANGUAGE_RULE
} from '@archislop/shared';
import {
  createLlmChatModel,
  DEFAULT_DEEPSEEK_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_FAST,
  isLlmConfigured,
  resolveDeepSeekModelId,
  resolveLlmBackend,
  resolveOpenRouterModelId,
  resolveVertexModelId
} from './llmProvider.js';
import { extractTextContent } from '../utils/extractTextContent.js';

const SYSTEM_PROMPT = [
  'You are a concise diagram-label glossary.',
  'The user clicked one element on a diagram. Explain what THAT specific label means in this diagram, in ONE plain-text sentence.',
  'RULES:',
  '- Explain the CONTENT (the actual text on the label). Do not explain what a "node" or "edge" or "label" is in general.',
  "- Subject-aware: the diagram could be about anything — software, recipes, biology, urban planning, project plans, board games, history. Speak in THAT subject's vocabulary. Do NOT default to enterprise-software / cloud / DevOps terms unless the diagram is actually about that — read the nearby labels first.",
  '- Plain text only. No markdown, no quotes, no bullet lists, no preamble like "This means" or "It refers to".',
  '- Max 30 words. One sentence.',
  '- If the label is a well-known concept in its subject (HTTP / OAuth in software; Maillard / mise en place in cooking; PERT / critical path in planning; etc.), give the standard one-line definition tied to its likely role here.',
  '- If you genuinely cannot tell, write a short guess starting with "Looks like" or "Probably".',
  `- ${MATCH_USER_LANGUAGE_RULE}`
].join('\n');

function buildSimpleSystemPrompt(simpleLevel = 1) {
  const meta = getLabelExplainDumbLevel(simpleLevel);
  const audience = meta?.audience ?? 'a beginner';
  const voice = meta?.voice ?? 'a friendly explainer';
  const maxWords = meta?.maxWords ?? 25;
  const extra =
    simpleLevel >= 5
      ? '- Wholesome silliness is welcome (onomatopoeia, toy analogies) but stay on-topic about the label.'
      : simpleLevel >= 3
        ? '- Prefer concrete everyday analogies over technical metaphors.'
        : '- Use a real-world analogy if it helps ("like a mailbox", "like a waiter").';
  return [
    `You are ${voice}, explaining a diagram label to ${audience}.`,
    'The user clicked one element on a diagram and asked you to "dumb it down" — each click should feel easier than the last.',
    'RULES:',
    '- Explain the CONTENT (the actual text on the label) in the simplest possible terms for this audience.',
    extra,
    '- Plain text only. No markdown, no quotes, no preambles like "This means".',
    `- Max ${maxWords} words. One sentence. Avoid acronyms — expand them or skip them.`,
    '- If you genuinely cannot tell, write a short guess starting with "Looks like" or "Probably".',
    `- ${MATCH_USER_LANGUAGE_RULE}`
  ].join('\n');
}

const GIBBERISH_SYSTEM_PROMPT = [
  'You are a baby who cannot speak yet, "explaining" a diagram label.',
  'The user has dumbed down explanations until real words failed.',
  'RULES:',
  '- Output ONLY nonsense baby babble: repeated syllables (goo ga, bwah, nya), raspberries, squeals.',
  '- NO real English words except maybe mangling 1–2 letters from the label into babble.',
  '- No markdown, no quotes, no definitions, no "this means".',
  '- One short burst, max 14 tokens. End with !!! if excited.',
  '- Wholesome and silly, never offensive.'
].join('\n');

function resolveExplainerModelId(env, backend) {
  if (backend === 'vertex') {
    return resolveVertexModelId(env, 'fast') || DEFAULT_VERTEX_MODEL_FAST;
  }
  if (backend === 'deepseek') {
    return resolveDeepSeekModelId(env, 'fast') || DEFAULT_DEEPSEEK_MODEL_FAST;
  }
  return resolveOpenRouterModelId(env, 'fast') || DEFAULT_OPENROUTER_MODEL_FAST;
}

const explainerModelCache = new Map();

/**
 * Cached fast chat model dedicated to the label-explainer popover. Cached per
 * (backend, modelId) so repeated clicks don't reconstruct the SDK client.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createLabelExplainerChatModel(env = process.env) {
  if (!isLlmConfigured(env)) return null;
  const backend = resolveLlmBackend(env);
  if (!backend) return null;
  const modelId = resolveExplainerModelId(env, backend);
  const key = `${backend}:${modelId}`;
  const cached = explainerModelCache.get(key);
  if (cached) return cached;
  const model = createLlmChatModel(env, {
    model: modelId,
    temperature: 0.3,
    maxOutputTokens: 120
  });
  explainerModelCache.set(key, model);
  return model;
}

/**
 * @param {'brief'|'simple'|'gibberish'} [style]
 * @param {number} [simpleLevel] 1–6 when style is 'simple'
 */
export function buildLabelExplainerSystemPrompt(style = 'brief', simpleLevel = 1) {
  if (style === 'gibberish') return GIBBERISH_SYSTEM_PROMPT;
  if (style !== 'simple') return SYSTEM_PROMPT;
  const level = Math.min(6, Math.max(1, Number(simpleLevel) || 1));
  return buildSimpleSystemPrompt(level);
}

export function buildLabelExplainerUserPrompt({
  partKind,
  partName,
  label,
  contentType,
  diagramSource,
  visibleLabels,
  style = 'brief',
  simpleLevel = 1
}) {
  const target = String(partName || label || '').slice(0, 240);
  const lines = [];
  lines.push(`Diagram type: ${contentType || 'mermaid'}`);
  if (partKind) lines.push(`Element type clicked: ${partKind}`);
  lines.push(`Label text clicked: "${target}"`);
  if (label && partName && label !== partName) {
    lines.push(`Containing element label: "${String(label).slice(0, 240)}"`);
  }
  if (Array.isArray(visibleLabels) && visibleLabels.length > 0) {
    const ctx = visibleLabels
      .slice(0, 24)
      .map((l) => `- ${String(l).slice(0, 120)}`)
      .join('\n');
    lines.push('Nearby labels (context only — do not explain these):', ctx);
  }
  const trimmedSource = typeof diagramSource === 'string' ? diagramSource.trim() : '';
  if (trimmedSource) {
    lines.push('Diagram source (context only):');
    lines.push('```');
    lines.push(trimmedSource.slice(0, 3000));
    lines.push('```');
  }
  lines.push('');
  if (style === 'gibberish') {
    lines.push(
      `Reply with ONE short burst of baby babble (no real words) reacting to the sounds of "${target}". Max 14 tokens.`
    );
  } else if (style === 'simple') {
    const level = Math.min(6, Math.max(1, Number(simpleLevel) || 1));
    const meta = getLabelExplainDumbLevel(level);
    const maxWords = meta?.maxWords ?? 25;
    const audience = meta?.audience ?? 'a beginner';
    lines.push(
      `Reply with ONE short plain-language sentence (max ${maxWords} words) explaining what "${target}" means in this diagram, pitched to ${audience}.`
    );
  } else {
    lines.push(
      `Reply with ONE short plain-text sentence (max 30 words) explaining what "${target}" means in this diagram.`
    );
  }
  const body = lines.join('\n');
  if (style === 'gibberish') return body;
  return appendProseLanguageInstruction(body, target, diagramSource);
}

/**
 * Strip the model's reply down to a single clean sentence. Removes code-fence
 * wrappers, leading/trailing quotes, generic preambles, and trims past the
 * first terminal punctuation so multi-sentence answers don't sneak through.
 */
export function sanitizeLabelExplanation(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return '';
  text = text
    .replace(/^```[\w-]*\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
  text = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
  text = text
    .replace(/^(this\s+(?:means|is|refers\s+to)|it\s+(?:means|is|refers\s+to))[:,\s]+/i, '')
    .trim();
  const firstLine = text.split(/\n+/, 1)[0] ?? '';
  text = firstLine.trim();
  const sentenceMatch = text.match(/^(.+?[.!?])(\s|$)/);
  if (sentenceMatch) text = sentenceMatch[1].trim();
  if (text.length > 280) {
    text = text.slice(0, 277).replace(/[\s,;:—-]+$/, '') + '…';
  }
  return text;
}

/** Keep baby-babble punctuation; strip only fences and obvious preambles. */
export function sanitizeLabelGibberish(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return '';
  text = text
    .replace(/^```[\w-]*\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
  text = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
  text = text.replace(/^(this\s+(?:means|is)|it\s+means)[:,\s]+/i, '').trim();
  text = (text.split(/\n+/, 1)[0] ?? '').trim();
  if (text.length > 120) text = text.slice(0, 117).trim() + '!!!';
  return text;
}

/**
 * Run the explainer model against a single label and return the cleaned sentence.
 * Centralized so the route handler and tests share the same plumbing.
 *
 * @param {object} args
 * @param {NodeJS.ProcessEnv} [args.env]
 * @param {object} args.payload  Validated request body (see route schema).
 * @returns {Promise<string>}    Empty string when the model returned nothing usable.
 */
export async function explainLabelOnce({ env = process.env, payload }) {
  const model = createLabelExplainerChatModel(env);
  if (!model) return '';
  const style =
    payload?.style === 'gibberish' ? 'gibberish' : payload?.style === 'simple' ? 'simple' : 'brief';
  const simpleLevel =
    style === 'simple' ? Math.min(6, Math.max(1, Number(payload?.simpleLevel) || 1)) : 1;
  const system = buildLabelExplainerSystemPrompt(style, simpleLevel);
  const user = buildLabelExplainerUserPrompt({ ...payload, style, simpleLevel });
  const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
  const raw = extractTextContent(reply?.content ?? reply);
  const cleaned =
    style === 'gibberish' ? sanitizeLabelGibberish(raw) : sanitizeLabelExplanation(raw);
  if (cleaned) return cleaned;
  if (style === 'gibberish') {
    return fallbackLabelGibberish(payload?.partName || payload?.label || '');
  }
  return '';
}
