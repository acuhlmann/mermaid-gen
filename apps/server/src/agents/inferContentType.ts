/**
 * LLM classifier for Auto mode: pick the best diagram slot for a user prompt.
 * Fast, low-temp, tiny output — not rule-based keyword matching.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { AUTO_CONTENT_TYPE, ContentTypeSchema, type ContentType } from '@archislop/shared';
import {
  createLlmChatModel,
  isLlmConfigured,
  resolveDecorativeBackend,
  resolveDecorativeModelId
} from './llmProvider.js';
import { extractTextContent } from '../utils/extractTextContent.js';
import { withLlmUsage } from './_lib/attachLlmUsage.js';

const SYSTEM_PROMPT = [
  'You choose which ArchiSlop content mode best fits a user topic or question.',
  'Reply with ONLY compact JSON: {"contentType":"<one>","reason":"<≤12 words>"}.',
  'Allowed contentType values (exactly one):',
  '- mermaid — architecture, flowcharts, sequences, ER, state, C4, process graphs, relationships between systems/steps',
  '- infographic — narrative visual summary, KPI tiles, hero numbers, multi-block storytelling layouts (AntV)',
  '- metaphor3d — spatial 3D metaphor (city, galaxy, tree, terrain, garden, etc.) when the ask is about place/space/hierarchy as a scene',
  '- chart — data-driven viz: bar/line/scatter/pie/trends/compare numbers (Vega-Lite). Prefer chart for "show me the numbers"',
  '- forms — interactive intake / questionnaire / multi-step form UX parody (A2UI forms)',
  '- anything — freeform interactive HTML/CSS/JS: games, simulations, custom widgets that do not fit structured modes',
  'Boundaries:',
  '- chart = data marks/encodings; infographic = narrative composition with titles/KPIs/story blocks',
  '- When unsure between mermaid and infographic, prefer mermaid for structure/process and infographic for summary storytelling',
  '- When unsure between chart and infographic, prefer chart for explicit numeric comparison asks',
  '- Default to mermaid if the ask is generic ("diagram this", "architecture of X") with no stronger signal',
  'No markdown fences. No extra keys.'
].join('\n');

function resolveClassifierModelId(
  env: NodeJS.ProcessEnv,
  backend: 'vertex' | 'openrouter' | 'deepseek' | null
): string {
  return resolveDecorativeModelId(env, backend);
}

const classifierModelCache = new Map<string, ReturnType<typeof createLlmChatModel>>();

/**
 * Cached fast chat model for Auto mode classification.
 * @param {NodeJS.ProcessEnv} [env]
 */
export function createContentTypeClassifierModel(env: NodeJS.ProcessEnv = process.env) {
  if (!isLlmConfigured(env)) return null;
  const backend = resolveDecorativeBackend(env);
  if (!backend) return null;
  const modelId = resolveClassifierModelId(env, backend);
  const key = `${backend}:${modelId}`;
  const cached = classifierModelCache.get(key);
  if (cached) return cached;
  const model = createLlmChatModel(env, {
    model: modelId,
    backend,
    temperature: 0,
    maxOutputTokens: 64
  });
  classifierModelCache.set(key, model);
  return model;
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * Parse model output into a concrete ContentType + short reason.
 * Falls back to mermaid when the reply is unusable.
 */
export function parseContentTypeClassification(raw: string): {
  contentType: ContentType;
  reason: string;
} {
  const text = stripJsonFence(String(raw ?? ''));
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as {
        contentType?: unknown;
        reason?: unknown;
      };
      const ct = ContentTypeSchema.safeParse(parsed.contentType);
      if (ct.success) {
        const reason = typeof parsed.reason === 'string' ? parsed.reason.trim().slice(0, 120) : '';
        return {
          contentType: ct.data,
          reason: reason || `Selected ${ct.data} mode`
        };
      }
    }
  } catch {
    // fall through
  }
  const lower = text.toLowerCase();
  for (const candidate of ContentTypeSchema.options) {
    if (lower.includes(`"${candidate}"`) || lower.includes(`'${candidate}'`)) {
      return { contentType: candidate, reason: `Selected ${candidate} mode` };
    }
  }
  return { contentType: 'mermaid', reason: 'Defaulted to diagram mode' };
}

export type InferContentTypeResult = {
  contentType: ContentType;
  reason: string;
  /** True when the model was invoked (vs skipped because already concrete). */
  classified: boolean;
  /** Token usage when the classifier ran and the provider reported it. */
  usage?: { inputTokens?: number; outputTokens?: number } | null;
  /** Decorative model id used for classification (for cost estimates). */
  model?: string | null;
};

/**
 * Resolve Auto → concrete slot via a fast LLM. Concrete types pass through unchanged.
 */
export async function inferContentTypeFromPrompt({
  prompt,
  contentType,
  env = process.env,
  abortSignal,
  modelOverride
}: {
  prompt: string;
  contentType: string | null | undefined;
  env?: NodeJS.ProcessEnv;
  abortSignal?: AbortSignal;
  modelOverride?: { invoke: (...args: unknown[]) => Promise<unknown> } | null;
}): Promise<InferContentTypeResult> {
  if (contentType !== AUTO_CONTENT_TYPE) {
    const parsed = ContentTypeSchema.safeParse(contentType);
    return {
      contentType: parsed.success ? parsed.data : 'mermaid',
      reason: '',
      classified: false
    };
  }

  const model = modelOverride ?? createContentTypeClassifierModel(env);
  if (!model) {
    return {
      contentType: 'mermaid',
      reason: 'LLM unavailable — defaulted to diagram',
      classified: true,
      usage: null,
      model: null
    };
  }

  const modelId = resolveClassifierModelId(env, resolveDecorativeBackend(env));
  const user = [
    'Pick the best contentType for this user request:',
    '---',
    String(prompt ?? '')
      .trim()
      .slice(0, 2000),
    '---'
  ].join('\n');

  try {
    const response = await model.invoke(
      [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(user)],
      abortSignal ? { signal: abortSignal } : undefined
    );
    const raw = extractTextContent((response as { content?: unknown })?.content ?? response);
    const parsed = parseContentTypeClassification(raw);
    return withLlmUsage(
      { ...parsed, classified: true as const, model: modelId },
      response
    ) as InferContentTypeResult;
  } catch (error) {
    if (abortSignal?.aborted) throw error;
    return {
      contentType: 'mermaid',
      reason: 'Classifier failed — defaulted to diagram',
      classified: true,
      usage: null,
      model: modelId
    };
  }
}
