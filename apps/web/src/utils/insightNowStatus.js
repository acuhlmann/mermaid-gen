import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';
import { localizeInsightNowStatusText, INSIGHT_NOW_STATUS_ALIASES } from './insightStatusLocale.js';
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

function insightsNowCopy(copy) {
  return copy?.nowStatus ?? getActiveControlsCopy().insights?.nowStatus ?? {};
}

function fallbackNowStatus(entry = {}, copy) {
  const nowStatus = insightsNowCopy(copy);
  const raw = String(entry.statusText ?? '');
  if (/repair/i.test(raw)) return nowStatus.repairingSyntax ?? 'Repairing diagram syntax…';
  if (/still working/i.test(raw)) return nowStatus.stillWorking ?? 'Still working…';
  if (/thinking/i.test(raw)) return nowStatus.thinking ?? 'Thinking…';

  const phases = Array.isArray(entry.phases) ? entry.phases : [];
  const lastPhase = phases.length > 0 ? phases[phases.length - 1] : null;
  const phaseId = lastPhase?.id;

  if (phaseId === 'repair') return nowStatus.repairingSyntax ?? 'Repairing diagram syntax…';
  if (phaseId === 'agent_run') return nowStatus.applyingPatch ?? 'Applying diagram patch…';
  if (phaseId === 'invoke' || phaseId === 'intent') {
    return nowStatus.planningUpdate ?? 'Planning the update…';
  }

  const variant = entry.variant;
  if (variant === 'gilfoyle') return nowStatus.polishing ?? 'Fixing what is wrong…';
  if (variant === 'dinesh') return nowStatus.fixingDinesh ?? 'Fixing what nobody else caught…';
  if (variant === 'erlich') return nowStatus.restructuring ?? 'Restructuring the diagram…';
  if (variant === 'jared') return nowStatus.reviewing ?? 'Reviewing the diagram…';
  if (variant === 'explain') return nowStatus.explaining ?? 'Explaining the diagram…';
  if (variant === 'russ') return nowStatus.goingOffScript ?? 'Going off-script…';
  if (variant === 'style') return nowStatus.updatingStyle ?? 'Updating visual style…';
  if (variant === 'barker') return nowStatus.simplifyingBarker ?? 'Simplifying for the board…';

  return nowStatus.workingOnDiagram ?? 'Working on the diagram…';
}

/**
 * Compact copy for the Thinking pane "Now" strip — strips code/DSL previews and
 * keeps a short action-oriented status line.
 *
 * @param {string | undefined | null} statusText
 * @param {Record<string, unknown>} [entry]
 * @param {import('../i18n/locales/controls.en.js').CONTROLS_EN['insights']} [copy]
 * @returns {string}
 */
export function summarizeInsightNowStatus(statusText, entry = {}, copy) {
  const insightsCopy = copy ?? getActiveControlsCopy().insights;
  const nowStatus = insightsCopy?.nowStatus ?? {};
  const raw = String(statusText ?? '').trim();
  if (!raw) return '';

  const localizedRaw = localizeInsightNowStatusText(raw, nowStatus);
  if (localizedRaw !== raw) return localizedRaw;

  const isCuratedShort =
    raw.length <= 96 &&
    !raw.includes('```') &&
    !looksLikeCode(raw) &&
    !tryExtractDiagramPreviewFromText(raw);
  if (isCuratedShort) {
    const aliasKey = INSIGHT_NOW_STATUS_ALIASES[raw];
    if (aliasKey && nowStatus[aliasKey]) return nowStatus[aliasKey];
    return raw;
  }

  let prose = stripEmbeddedDslFromThinkingText(raw, null);
  prose = stripFencedBlocks(prose);
  prose = firstProseSentence(prose);

  if (!prose || looksLikeCode(prose)) {
    return fallbackNowStatus({ ...entry, statusText: raw }, insightsCopy);
  }

  return truncateStatus(localizeInsightNowStatusText(prose, nowStatus));
}
