/**
 * Progressive "Dumb it Down" for full Explain analyze output in the Thinking panel.
 * Same audience ladder as the radial "?" explainer (labelExplainDumbLevels).
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import {
  buildExplainSectionsArtifact,
  fallbackLabelGibberish,
  getLabelExplainDumbLevel,
  appendProseLanguageInstruction,
  MATCH_USER_LANGUAGE_RULE
} from '@archislop/shared';
import { extractTextContent } from '../utils/extractTextContent.js';
import {
  createLlmChatModel,
  isLlmConfigured,
  resolveDecorativeBackend,
  resolveDecorativeModelId
} from './llmProvider.js';
import { llmUsageFromReply } from './_lib/llmUsageFromReply.js';

const GIBBERISH_SYSTEM_PROMPT = [
  'You are a baby who cannot speak yet, "explaining" an architecture write-up.',
  'The user has dumbed down explanations until real words failed.',
  'RULES:',
  '- Keep the SAME Markdown ## section headings from the previous explanation (do not rename them).',
  '- Under each heading, output ONLY nonsense baby babble: repeated syllables (goo ga, bwah, nya), raspberries, squeals.',
  '- NO real English words except maybe mangling 1–2 letters from a label into babble.',
  '- No bullet lists of real concepts. Short bursts per section (max 14 tokens each).',
  '- Wholesome and silly, never offensive. End sections with !!! when excited.'
].join('\n');

/** Per-section brevity budget by dumb-down level (1–6). */
const SECTION_BUDGET_BY_LEVEL = Object.freeze({
  1: { maxBullets: 4, maxWordsPerBullet: 28 },
  2: { maxBullets: 3, maxWordsPerBullet: 24 },
  3: { maxBullets: 3, maxWordsPerBullet: 20 },
  4: { maxBullets: 2, maxWordsPerBullet: 18 },
  5: { maxBullets: 2, maxWordsPerBullet: 15 },
  6: { maxBullets: 1, maxWordsPerBullet: 12 }
});

function resolveExplainerModelId(env, backend) {
  return resolveDecorativeModelId(env, backend);
}

const explainDumbModelCache = new Map();

function createExplainDumbDownChatModel(env = process.env) {
  if (!isLlmConfigured(env)) return null;
  const backend = resolveDecorativeBackend(env);
  if (!backend) return null;
  const modelId = resolveExplainerModelId(env, backend);
  const key = `${backend}:${modelId}:explain-dumb`;
  const cached = explainDumbModelCache.get(key);
  if (cached) return cached;
  const model = createLlmChatModel(env, {
    model: modelId,
    backend,
    temperature: 0.35,
    maxOutputTokens: 1800
  });
  explainDumbModelCache.set(key, model);
  return model;
}

/**
 * @param {number} simpleLevel 1–6
 */
export function buildExplainDumbDownSystemPrompt(simpleLevel = 1) {
  const level = Math.min(6, Math.max(1, Number(simpleLevel) || 1));
  const meta = getLabelExplainDumbLevel(level);
  const audience = meta?.audience ?? 'a beginner';
  const voice = meta?.voice ?? 'a friendly explainer';
  const budget = SECTION_BUDGET_BY_LEVEL[level] ?? SECTION_BUDGET_BY_LEVEL[1];
  const extra =
    level >= 5
      ? '- Wholesome silliness is welcome (onomatopoeia, toy analogies) but stay on-topic.'
      : level >= 3
        ? '- Prefer concrete everyday analogies over technical metaphors.'
        : '- Use real-world analogies when they help ("like a mailbox", "like a waiter").';
  return [
    `You are ${voice}, simplifying an architecture explanation for ${audience}.`,
    'The user clicked "Dumb it Down" on a Thinking-panel Explain entry — each click should feel easier than the last.',
    'RULES:',
    '- Rephrase the quoted PREVIOUS EXPLANATION — same topics and section scope, simpler words.',
    '- Keep the SAME Markdown ## section headings (and preamble paragraph if present). Do not add or remove sections.',
    '- Do NOT repeat the previous text verbatim. Do NOT introduce new named patterns, laws, principles, or jargon.',
    '- BANNED at this level: ivory-tower tangents, "## Aside" rabbit holes, eponyms, Latin/Greek flexes.',
    level <= 2
      ? '- BANNED: the words "pattern", "principle", "paradigm", "axiom", "topology", "ontology", "epistemology".'
      : '- No jargon — replace big words with what this audience would say.',
    extra,
    `- Per section: at most ${budget.maxBullets} bullet(s), each max ${budget.maxWordsPerBullet} words.`,
    '- Plain Markdown only — no code fences around the whole answer.',
    '- Read-only: do not edit or output diagram source.',
    `- ${MATCH_USER_LANGUAGE_RULE}`
  ].join('\n');
}

export function buildExplainDumbDownUserPrompt({
  previousExplain,
  contentType,
  style = 'simple',
  simpleLevel = 1
}) {
  const prev = typeof previousExplain === 'string' ? previousExplain.trim().slice(0, 12_000) : '';
  if (!prev) return 'Reply with an empty string.';

  if (style === 'gibberish') {
    return [
      'PREVIOUS EXPLANATION (replace every section body with baby babble — keep ## headings):',
      '---',
      prev,
      '---',
      '',
      'Reply with Markdown using the same ## headings. Bodies must be pre-verbal babble only.'
    ].join('\n');
  }

  const level = Math.min(6, Math.max(1, Number(simpleLevel) || 1));
  const meta = getLabelExplainDumbLevel(level);
  const audience = meta?.audience ?? 'a beginner';
  const budget = SECTION_BUDGET_BY_LEVEL[level] ?? SECTION_BUDGET_BY_LEVEL[1];

  return appendProseLanguageInstruction(
    [
      `Diagram type: ${contentType || 'mermaid'}`,
      '',
      'PREVIOUS EXPLANATION (translate this simpler — same structure, easier words):',
      '---',
      prev,
      '---',
      '',
      `Rephrase for ${audience}. Keep the same ## headings and preamble (if any).`,
      `Max ${budget.maxBullets} bullet(s) per section, ${budget.maxWordsPerBullet} words each.`,
      'Reply with Markdown only.'
    ].join('\n'),
    prev
  );
}

export function sanitizeExplainDumbDownMarkdown(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return '';
  text = text
    .replace(/^```(?:markdown|md)?\s*\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
  return text.slice(0, 14_000);
}

function fallbackGibberishExplain(previousExplain, contentType) {
  const { preamble, sections } = parseFallbackSections(previousExplain, contentType);
  const babble = fallbackLabelGibberish('explain');
  const body = `${babble} ${babble}!!!`;
  if (sections.length === 0) {
    return body;
  }
  const lines = [];
  if (preamble) lines.push(body, '');
  for (const section of sections) {
    lines.push(`## ${section.heading}`, '', body, '');
  }
  return lines.join('\n').trim();
}

function parseFallbackSections(markdown, contentType) {
  const ct = contentType === 'infographic' ? 'infographic' : 'mermaid';
  const artifact = buildExplainSectionsArtifact(markdown, ct);
  if (artifact) {
    return { preamble: artifact.preamble ?? '', sections: artifact.sections ?? [] };
  }
  return { preamble: markdown.trim(), sections: [] };
}

/**
 * @param {object} args
 * @param {NodeJS.ProcessEnv} [args.env]
 * @param {object} args.payload
 * @returns {Promise<{ markdown: string, explainSections: object | null }>}
 */
export async function explainDumbDownOnce({ env = process.env, payload }) {
  const previousExplain =
    typeof payload?.previousExplain === 'string' ? payload.previousExplain.trim() : '';
  if (!previousExplain) {
    return { markdown: '', explainSections: null, usage: null, model: null };
  }

  const style = payload?.style === 'gibberish' ? 'gibberish' : 'simple';
  const simpleLevel =
    style === 'simple' ? Math.min(6, Math.max(1, Number(payload?.simpleLevel) || 1)) : 1;
  const contentType = payload?.contentType === 'infographic' ? 'infographic' : 'mermaid';

  const model = createExplainDumbDownChatModel(env);
  if (!model) {
    return { markdown: '', explainSections: null, usage: null, model: null };
  }

  const backend = resolveDecorativeBackend(env);
  const modelId = resolveExplainerModelId(env, backend);

  const system =
    style === 'gibberish' ? GIBBERISH_SYSTEM_PROMPT : buildExplainDumbDownSystemPrompt(simpleLevel);
  const user = buildExplainDumbDownUserPrompt({
    previousExplain,
    contentType,
    style,
    simpleLevel
  });

  const reply = await model.invoke([new SystemMessage(system), new HumanMessage(user)]);
  const raw = extractTextContent(reply?.content ?? reply);
  let markdown = sanitizeExplainDumbDownMarkdown(raw);

  if (!markdown && style === 'gibberish') {
    markdown = fallbackGibberishExplain(previousExplain, contentType);
  }
  if (!markdown) {
    return { markdown: '', explainSections: null, usage: null, model: modelId };
  }

  const explainSections = buildExplainSectionsArtifact(markdown, contentType);
  const usage = llmUsageFromReply(reply);
  return { markdown, explainSections, usage, model: modelId };
}
