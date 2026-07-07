import {
  splitEmbeddedDiagramDsl,
  stripEmbeddedDslFromThinkingText,
  tryExtractDiagramPreviewFromText
} from './insightsEmbeddedDiagramSplit.js';

const NOW_STATUS_MAX = 140;

const CODE_LINE =
  /^(?:```|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|infographic\s|C4Context|%%\{|<!DOCTYPE|<html\b|<div\b|<section\b|\{|\[)/i;

function normalizeInline(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripFencedBlocks(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]+`/g, ' ')
    .trim();
}

function looksLikeCode(text) {
  const t = normalizeInline(text);
  if (!t) return true;
  if (CODE_LINE.test(t)) return true;
  if (t.includes('"archislopVersion"') || t.includes('"metaphor"')) return true;
  if (tryExtractDiagramPreviewFromText(t)) return true;
  return Boolean(splitEmbeddedDiagramDsl(t)?.dsl);
}

function firstProseSentence(text) {
  const cleaned = normalizeInline(text);
  if (!cleaned) return '';
  const sentence = cleaned.match(/^[^.!?]+[.!?]?/)?.[0]?.trim();
  return sentence || cleaned;
}

function truncateStatus(text, max = NOW_STATUS_MAX) {
  const t = normalizeInline(text);
  if (!t || t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function fallbackNowStatus(entry = {}) {
  const raw = String(entry.statusText ?? '');
  if (/repair/i.test(raw)) return 'Repairing diagram syntax…';
  if (/still working/i.test(raw)) return 'Still working…';
  if (/thinking/i.test(raw)) return 'Thinking…';

  const phases = Array.isArray(entry.phases) ? entry.phases : [];
  const lastPhase = phases.length > 0 ? phases[phases.length - 1] : null;
  const phaseId = lastPhase?.id;

  if (phaseId === 'repair') return 'Repairing diagram syntax…';
  if (phaseId === 'agent_run') return 'Applying diagram patch…';
  if (phaseId === 'invoke' || phaseId === 'intent') return 'Planning the update…';

  const variant = entry.variant;
  if (variant === 'refine') return 'Polishing the diagram…';
  if (variant === 'innovate') return 'Restructuring the diagram…';
  if (variant === 'critique') return 'Reviewing the diagram…';
  if (variant === 'explain') return 'Explaining the diagram…';
  if (variant === 'goMad') return 'Going off-script…';
  if (variant === 'style') return 'Updating visual style…';
  if (variant === 'exec') return 'Simplifying for executives…';

  return 'Working on the diagram…';
}

/**
 * Compact copy for the Thinking pane "Now" strip — strips code/DSL previews and
 * keeps a short action-oriented status line.
 *
 * @param {string | undefined | null} statusText
 * @param {Record<string, unknown>} [entry]
 * @returns {string}
 */
export function summarizeInsightNowStatus(statusText, entry = {}) {
  const raw = String(statusText ?? '').trim();
  if (!raw) return '';

  const isCuratedShort =
    raw.length <= 96 &&
    !raw.includes('```') &&
    !looksLikeCode(raw) &&
    !tryExtractDiagramPreviewFromText(raw);
  if (isCuratedShort) return raw;

  let prose = stripEmbeddedDslFromThinkingText(raw, null);
  prose = stripFencedBlocks(prose);
  prose = firstProseSentence(prose);

  if (!prose || looksLikeCode(prose)) {
    return fallbackNowStatus({ ...entry, statusText: raw });
  }

  return truncateStatus(prose);
}
