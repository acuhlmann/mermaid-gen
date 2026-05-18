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
  'You are a concise architecture-diagram glossary.',
  'The user clicked one element on a diagram. Explain what THAT specific label means in this diagram, in ONE plain-text sentence.',
  'RULES:',
  '- Explain the CONTENT (the actual text on the label). Do not explain what a "node" or "edge" or "label" is in general.',
  '- Plain text only. No markdown, no quotes, no bullet lists, no preamble like "This means" or "It refers to".',
  '- Max 30 words. One sentence.',
  '- If the label is a well-known concept (HTTP, OAuth, S3, RabbitMQ…), give the standard one-line definition tied to its likely role here.',
  '- If you genuinely cannot tell, write a short guess starting with "Looks like" or "Probably".'
].join('\n');

const SIMPLE_SYSTEM_PROMPT = [
  'You are a friendly architecture-diagram explainer. Imagine the reader is brand new — no jargon, no acronyms.',
  'The user clicked one element on a diagram and asked you to "dumb it down".',
  'RULES:',
  '- Explain the CONTENT (the actual text on the label) in the simplest possible terms.',
  '- Use a real-world analogy if it helps ("like a mailbox", "like a waiter").',
  '- Plain text only. No markdown, no quotes, no preambles like "This means".',
  '- Max 25 words. One sentence. Avoid acronyms — expand them or skip them.',
  '- If you genuinely cannot tell, write a short guess starting with "Looks like" or "Probably".'
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
 * @param {'brief'|'simple'} [style]
 *   'brief'  (default) — one-sentence glossary entry, normal tone.
 *   'simple' — ELI5 plain-language rephrase for the "Dumb it Down" follow-up.
 */
export function buildLabelExplainerSystemPrompt(style = 'brief') {
  return style === 'simple' ? SIMPLE_SYSTEM_PROMPT : SYSTEM_PROMPT;
}

export function buildLabelExplainerUserPrompt({
  partKind,
  partName,
  label,
  contentType,
  diagramSource,
  visibleLabels,
  style = 'brief'
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
  if (style === 'simple') {
    lines.push(`Reply with ONE short plain-language sentence (max 25 words, beginner-friendly) explaining what "${target}" means in this diagram.`);
  } else {
    lines.push(`Reply with ONE short plain-text sentence (max 30 words) explaining what "${target}" means in this diagram.`);
  }
  return lines.join('\n');
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
  text = text.replace(/^```[\w-]*\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  text = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
  text = text.replace(/^(this\s+(?:means|is|refers\s+to)|it\s+(?:means|is|refers\s+to))[:,\s]+/i, '').trim();
  const firstLine = text.split(/\n+/, 1)[0] ?? '';
  text = firstLine.trim();
  const sentenceMatch = text.match(/^(.+?[.!?])(\s|$)/);
  if (sentenceMatch) text = sentenceMatch[1].trim();
  if (text.length > 280) {
    text = text.slice(0, 277).replace(/[\s,;:—-]+$/, '') + '…';
  }
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
  const style = payload?.style === 'simple' ? 'simple' : 'brief';
  const system = buildLabelExplainerSystemPrompt(style);
  const user = buildLabelExplainerUserPrompt({ ...payload, style });
  const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
  const raw = extractTextContent(reply?.content ?? reply);
  return sanitizeLabelExplanation(raw);
}
