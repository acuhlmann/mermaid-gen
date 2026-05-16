import { Fragment, useEffect, useRef, useState } from 'react';
import InsightsEmbeddedDiagram from './InsightsEmbeddedDiagram.jsx';
import { splitEmbeddedDiagramDsl } from '../utils/insightsEmbeddedDiagramSplit.js';
import { partitionDiagramToolJsonBlocks, stripInsightStreamDelimiters } from '../utils/insightThinkingEnrich.js';
import { partKindLabel } from '../utils/partKindLabel.js';
import AgentProposalCard from './AgentProposalCard.jsx';
import AgentBadge from './AgentBadge.jsx';
import CritiqueA2uiSurface from './CritiqueA2uiSurface.jsx';
import { buildCritiqueActionableA2uiMessages } from '@archislop/shared';
import { canRetryInsightEntry, showRetryWithQualityForEntry } from '../utils/insightRetryDescriptor.js';
import SlopitectStatusBoard from './SlopitectStatusBoard.jsx';
import { phaseCeremonyLabel, tipForIndex, VARIANT_TAGLINES } from '../utils/slopitectCopy.js';

const SLOPITECT_VARIANT_CLASS = {
  refine: 'is-variant-refine',
  innovate: 'is-variant-innovate',
  goMad: 'is-variant-go-mad',
  critique: 'is-variant-critique',
  explain: 'is-variant-explain'
};

const TIP_ROTATION_MS = 7000;

/** Streaming UI for agent runs: extend `applyAgentStreamInsightEvent` + `InsightsPane` entries for new phases; add A2UI via shared builders + `createLegacyA2uiStreamEvent` (see `critiqueA2uiMessages.js`). */

const BOTTOM_SNAP_THRESHOLD_PX = 72;

function TopicChip({ topic }) {
  if (!topic?.partKind) return null;
  return (
    <span className="insights-topic-chip" aria-label={`Topic ${partKindLabel(topic.partKind)} ${topic.partName || ''}`}>
      <span className="insights-topic-chip-type">{partKindLabel(topic.partKind)}</span>
      {topic.partName ? <span className="insights-topic-chip-name">{topic.partName}</span> : null}
    </span>
  );
}

const PHASE_ID_LABELS = {
  analyze: 'Analyze',
  analyze_stream: 'Stream',
  intent: 'Apply',
  agent_run: 'Tools',
  transform: 'Transform',
  run_started: 'Start',
  planning: 'Plan',
  syntax_fixer: 'Syntax',
  syntax_repair: 'Repair',
  patch_retry: 'Retry',
  invoke: 'Generate',
  invoke_fallback: 'Finalize',
  repair_1: 'Repair',
  repair_2: 'Repair'
};

function IconThinking() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 10 21 11 21z"
      />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="m11 6.5 1.43 3.24L15.77 11l-3.34 1.26L11 15.5 9.57 12.26 6.23 11l3.34-1.26L11 6.5zm7-2 1 2.25L21.25 8 19 10.25 18 8l-2.25-1.75L18 4.75l1-2.25zm0 11 1 2.25L21.25 19 19 21.25 18 19l-2.25-1.75L18 15.75l1-2.25zM6 16l.85 1.92L8.77 19l-1.92.92L6 21.84l-.85-1.92L3.23 19l1.92-.92L6 16z"
      />
    </svg>
  );
}

function IconCritique() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 21c-.55 0-1-.45-1-1v-1H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-6l-3 3v-3H9v1zm1-7h8V7H7v10h2v2l2-2h1zm2.5-4h-5v1.5h5V10zm3 3h-8V11.5h8V13z"
      />
    </svg>
  );
}

function IconExplain() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
      />
    </svg>
  );
}

function IconRefine() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1-.9 10.1 1 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"
      />
    </svg>
  );
}

function IconInnovate() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85-.6V16h-4v-4.5l-.85.6C7.68 13.28 7 12.18 7 11c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.18-.68 2.28-1.15 3.1z"
      />
    </svg>
  );
}

function IconStopped() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="currentColor" d="M6 6h12v12H6V6z" />
    </svg>
  );
}

function IconGoMad() {
  return (
    <svg className="insights-svg-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm10 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm-8.31 4.39C9.22 17.84 8.46 17 7.5 17h-3c-.55 0-1-.45-1-1s.45-1 1-1h2.57c.39-.61 1.07-1 1.82-1h6.22c.75 0 1.43.39 1.82 1h2.57c.55 0 1 .45 1 1s-.45 1-1 1h-3c-.96 0-1.72-.84-1.19-1.61-.42-.26-.91-.39-1.41-.39h-4c-.5 0-.99.13-1.41.39zM4.5 9h2c.28 0 .5-.22.5-.5S6.78 8 6.5 8h-2c-.28 0-.5.22-.5.5S4.22 9 4.5 9zm15 0h-2c-.28 0-.5-.22-.5-.5s.22-.5.5-.5h2c.28 0 .5.22.5.5s-.22.5-.5.5zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-.29.02-.58.05-.86 2.36-1.05 4.91-1.64 7.95-1.64s5.59.59 7.95 1.64c.03.28.05.57.05.86 0 4.41-3.59 8-8 8z"
      />
    </svg>
  );
}

function isAccentuatedInsightVariant(variant) {
  return (
    variant === 'critique' ||
    variant === 'explain' ||
    variant === 'refine' ||
    variant === 'innovate' ||
    variant === 'goMad'
  );
}

function IconAlert({ small }) {
  const cls = small ? 'insights-svg-icon insights-svg-icon-sm' : 'insights-svg-icon';
  const dim = small ? 13 : 16;
  return (
    <svg className={cls} viewBox="0 0 24 24" width={dim} height={dim} aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
      />
    </svg>
  );
}

function IconPhaseCheck() {
  return (
    <svg className="insights-phase-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  );
}

function IconPhasePulse() {
  return <span className="insights-phase-glyph insights-phase-pulse-dot" aria-hidden="true" />;
}

function IconPhaseAnalyze() {
  return (
    <svg className="insights-phase-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C10.01 14 8 11.99 8 9.5S10.01 5 12.5 5 17 7.01 17 9.5 14.99 14 12.5 14z"
      />
    </svg>
  );
}

function IconPhaseStream() {
  return (
    <svg className="insights-phase-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M4 18h12v2H4v-2zm0-6h18v2H4v-2zm0-6h14v2H4V6zm14 8v3l4-4-4-4v3H8v2h10z" />
    </svg>
  );
}

function IconPhaseGeneric() {
  return (
    <svg className="insights-phase-glyph" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function EntryStatusIcon({ status, variant }) {
  if (status === 'cancelled') return <IconStopped />;
  if (status === 'failed') return <IconAlert />;
  if (status === 'done') {
    if (variant === 'critique') return <IconCritique />;
    if (variant === 'explain') return <IconExplain />;
    if (variant === 'refine') return <IconRefine />;
    if (variant === 'innovate') return <IconInnovate />;
    if (variant === 'goMad') return <IconGoMad />;
    return <IconSparkles />;
  }
  return <IconThinking />;
}

const CONTENT_TYPE_META = {
  mermaid: { label: 'Mermaid', emoji: '🧜‍♀️' },
  infographic: { label: 'Infographic', emoji: '📊' }
};

const MODEL_PROFILE_META = {
  fast: { label: 'Fast', emoji: '⚡' },
  quality: { label: 'Quality', emoji: '🧠' }
};

function formatEntryTime(timestamp) {
  if (!Number.isFinite(timestamp)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
      new Date(timestamp)
    );
  } catch {
    return '';
  }
}

function EntryRunMeta({ entry }) {
  const contentMeta = entry?.contentType ? CONTENT_TYPE_META[entry.contentType] : null;
  const brainMeta = entry?.modelProfile ? MODEL_PROFILE_META[entry.modelProfile] : null;
  const timeLabel = formatEntryTime(entry?.startedAt);
  if (!contentMeta && !brainMeta && !timeLabel) return null;
  return (
    <div className="insights-entry-meta" aria-label="Run details">
      {contentMeta ? (
        <span className="insights-entry-meta-chip is-mode" title={`${contentMeta.label} mode`}>
          <span className="insights-entry-meta-emoji" aria-hidden="true">
            {contentMeta.emoji}
          </span>
          <span>{contentMeta.label}</span>
        </span>
      ) : null}
      {brainMeta ? (
        <span className="insights-entry-meta-chip is-brain" title={`${brainMeta.label} brain`}>
          <span className="insights-entry-meta-emoji" aria-hidden="true">
            {brainMeta.emoji}
          </span>
          <span>{brainMeta.label}</span>
        </span>
      ) : null}
      {timeLabel ? (
        <time
          className="insights-entry-meta-chip is-time"
          dateTime={new Date(entry.startedAt).toISOString()}
        >
          {timeLabel}
        </time>
      ) : null}
    </div>
  );
}

function parseInline(text) {
  const fragments = [];
  let rest = text;
  let keyIndex = 0;
  const tokenPattern = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`)/;
  while (rest.length > 0) {
    const match = rest.match(tokenPattern);
    if (!match || match.index == null) {
      fragments.push(rest);
      break;
    }
    if (match.index > 0) fragments.push(rest.slice(0, match.index));
    const token = match[0];
    if (token.startsWith('**')) {
      fragments.push(<strong key={`s-${keyIndex++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('_')) {
      fragments.push(<em key={`e-${keyIndex++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`')) {
      fragments.push(
        <code key={`c-${keyIndex++}`} className="insights-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    rest = rest.slice(match.index + token.length);
  }
  return fragments;
}

/** Merge lone bullet markers with the following non-empty line (streaming artifacts). */
function preprocessBulletArtifacts(content) {
  const lines = content.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '•' || trimmed === '-' || trimmed === '*' || trimmed === '·') {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j += 1;
      if (j < lines.length) {
        out.push(`- ${lines[j].trim()}`);
        i = j;
        continue;
      }
    }
    out.push(raw);
  }
  return out.join('\n');
}

function explainHeadingToneClass(headingText) {
  const h = headingText.toLowerCase();
  if (h.includes('takeaway') || h.includes('conclusion') || h.includes('insight')) {
    return 'insights-tone-explain-takeaways';
  }
  if (h.includes('entit') || h.includes('key nodes') || h.includes('key components')) {
    return 'insights-tone-explain-entities';
  }
  if (h.includes('flow') || h.includes('relationship')) {
    return 'insights-tone-explain-flows';
  }
  if (h.includes('explanation') || h.includes('overview') || h.includes('summary')) {
    return 'insights-tone-explain-overview';
  }
  return 'insights-tone-explain-neutral';
}

function innovateHeadingToneClass(headingText) {
  const h = headingText.toLowerCase();
  if (h.includes('idea') || h.includes('concept') || h.includes('proposal')) return 'insights-tone-innovate-spark';
  if (h.includes('alternative') || h.includes('option') || h.includes('stretch')) return 'insights-tone-innovate-alt';
  if (h.includes('experiment') || h.includes('wildcard') || h.includes('wild card')) return 'insights-tone-innovate-play';
  if (h.includes('risk') || h.includes('tradeoff') || h.includes('trade-off')) return 'insights-tone-innovate-tradeoff';
  return 'insights-tone-innovate-neutral';
}

function headingToneClass(headingText, variant = 'general') {
  if (variant === 'explain') return explainHeadingToneClass(headingText);
  if (variant === 'innovate') return innovateHeadingToneClass(headingText);
  const h = headingText.toLowerCase();
  if (h.includes('strength')) return 'insights-tone-strengths';
  if (h.includes('weakness') || h.includes('limit')) return 'insights-tone-weaknesses';
  if (h.includes('diagram type') || h.includes('type fit')) return 'insights-tone-diagram-type';
  if (h.includes('visual') || h.includes('style')) return 'insights-tone-visual';
  if (h.includes('action')) return 'insights-tone-actionable';
  return 'insights-tone-neutral';
}

const GO_MAD_SECTION_TONES = [
  'insights-tone-gomad-a',
  'insights-tone-gomad-b',
  'insights-tone-gomad-c',
  'insights-tone-gomad-d'
];

function sectionHeadingIconClass(toneClass) {
  if (toneClass === 'insights-tone-strengths') return 'insights-section-icon is-strengths';
  if (toneClass === 'insights-tone-weaknesses') return 'insights-section-icon is-weaknesses';
  if (toneClass === 'insights-tone-diagram-type') return 'insights-section-icon is-diagram-type';
  if (toneClass === 'insights-tone-visual') return 'insights-section-icon is-visual';
  if (toneClass === 'insights-tone-actionable') return 'insights-section-icon is-actionable';
  if (toneClass === 'insights-tone-explain-overview') return 'insights-section-icon is-explain-overview';
  if (toneClass === 'insights-tone-explain-flows') return 'insights-section-icon is-explain-flows';
  if (toneClass === 'insights-tone-explain-entities') return 'insights-section-icon is-explain-entities';
  if (toneClass === 'insights-tone-explain-takeaways') return 'insights-section-icon is-explain-takeaways';
  if (toneClass === 'insights-tone-explain-neutral') return 'insights-section-icon is-explain-neutral';
  if (toneClass === 'insights-tone-innovate-spark') return 'insights-section-icon is-innovate-spark';
  if (toneClass === 'insights-tone-innovate-alt') return 'insights-section-icon is-innovate-alt';
  if (toneClass === 'insights-tone-innovate-play') return 'insights-section-icon is-innovate-play';
  if (toneClass === 'insights-tone-innovate-tradeoff') return 'insights-section-icon is-innovate-tradeoff';
  if (toneClass === 'insights-tone-innovate-neutral') return 'insights-section-icon is-innovate-neutral';
  if (toneClass === 'insights-tone-gomad-a') return 'insights-section-icon is-gomad-a';
  if (toneClass === 'insights-tone-gomad-b') return 'insights-section-icon is-gomad-b';
  if (toneClass === 'insights-tone-gomad-c') return 'insights-section-icon is-gomad-c';
  if (toneClass === 'insights-tone-gomad-d') return 'insights-section-icon is-gomad-d';
  return 'insights-section-icon is-neutral';
}

/** Split on ## headings; returns [{ type:'lead'|'section', heading?, body }]. */
function splitMarkdownSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let buf = [];

  function flushLead() {
    if (!buf.length) return;
    sections.push({ type: 'lead', body: buf.join('\n') });
    buf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('## ') && !trimmed.startsWith('###')) {
      flushLead();
      sections.push({ type: 'section', heading: trimmed.slice(3).trim(), bodyLines: [] });
      continue;
    }
    const active = sections.length && sections[sections.length - 1].type === 'section';
    if (active) {
      sections[sections.length - 1].bodyLines.push(lines[i]);
    } else {
      buf.push(lines[i]);
    }
  }
  flushLead();
  return sections.map((s) =>
    s.type === 'section' ? { type: 'section', heading: s.heading, body: s.bodyLines.join('\n') } : s
  );
}

function renderBodyLines(body, keyPrefix, useSectionTypography) {
  const lines = body.split('\n');
  const out = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(<div key={`${keyPrefix}-gap-${index}`} className="insights-content-gap" />);
      return;
    }
    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      out.push(
        <p key={`${keyPrefix}-ol-${index}`} className="insights-content-ordered">
          <span className="insights-ordered-marker" aria-hidden="true">
            {olMatch[1]}.
          </span>
          {parseInline(olMatch[2])}
        </p>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      out.push(
        <h4 key={`${keyPrefix}-h3-${index}`} className="insights-content-heading">
          {parseInline(trimmed.slice(4))}
        </h4>
      );
      return;
    }
    if (trimmed.startsWith('# ') && !trimmed.startsWith('##')) {
      out.push(
        <h3 key={`${keyPrefix}-h1-${index}`} className="insights-content-heading-xl">
          {parseInline(trimmed.slice(2))}
        </h3>
      );
      return;
    }
    const bullet =
      trimmed.startsWith('- ') ||
      trimmed.startsWith('• ') ||
      (trimmed.startsWith('•') && trimmed.length > 1 && /\s/.test(trimmed[1]));
    if (bullet) {
      const inner = trimmed.startsWith('- ')
        ? trimmed.slice(2)
        : trimmed.startsWith('• ')
          ? trimmed.slice(2)
          : trimmed.replace(/^•\s*/, '');
      out.push(
        <p key={`${keyPrefix}-b-${index}`} className="insights-content-bullet">
          <span className="insights-bullet-icon" aria-hidden="true" />
          <span className="insights-bullet-text">{parseInline(inner)}</span>
        </p>
      );
      return;
    }
    const paraClass = useSectionTypography ? 'insights-content-line insights-content-line-in-section' : 'insights-content-line';
    out.push(
      <p key={`${keyPrefix}-p-${index}`} className={paraClass}>
        {parseInline(line)}
      </p>
    );
  });

  return out;
}

function leadOpenerExtraClass(variant, accentuateSections, openerUsedRef) {
  if (!accentuateSections || openerUsedRef.current) return '';
  const map = {
    explain: 'insights-explain-opener',
    refine: 'insights-refine-opener',
    innovate: 'insights-innovate-opener',
    goMad: 'insights-gomad-opener'
  };
  const extra = map[variant];
  if (!extra) return '';
  openerUsedRef.current = true;
  return extra;
}

function EmbeddedDiagramBlock({
  idPrefix,
  source,
  kind,
  streamingPreview,
  highlight,
  showRestore,
  restoreDisabled,
  onRestoreDiagramSnapshot
}) {
  return (
    <div className="insights-embedded-diagram-block">
      <InsightsEmbeddedDiagram
        idPrefix={idPrefix}
        source={source}
        kind={kind}
        streamingPreview={streamingPreview}
        highlight={highlight}
      />
      {showRestore && onRestoreDiagramSnapshot ? (
        <div className="insights-embedded-diagram-restore-row">
          <button
            type="button"
            className="insights-entry-undo-btn"
            disabled={restoreDisabled}
            title="Load this diagram onto the canvas."
            onClick={() => onRestoreDiagramSnapshot({ diagramSource: source, contentType: kind })}
          >
            Restore
          </button>
        </div>
      ) : null}
    </div>
  );
}

function renderTextWithEmbeddedDsl(text, richOpts, embedOpts) {
  if (!text.trim()) return null;
  const split = splitEmbeddedDiagramDsl(text);
  if (!split) {
    return renderRichContent(text, richOpts);
  }
  // When the entry already shows a "Resulting diagram" preview at the bottom, drop the
  // mid-prose DSL preview to avoid duplicating the same diagram twice in one entry.
  const proseOnly = embedOpts.suppressEmbedded
    ? split.prose
    : null;
  if (embedOpts.suppressEmbedded) {
    return proseOnly?.trim() ? renderRichContent(proseOnly, richOpts) : null;
  }
  const showRestore =
    embedOpts.showEmbeddedRestore && !embedOpts.streamingPreview && Boolean(split.dsl?.trim());
  return (
    <>
      {split.prose.trim() ? renderRichContent(split.prose, richOpts) : null}
      <EmbeddedDiagramBlock
        idPrefix={`${embedOpts.idPrefix}-dsl`}
        source={split.dsl}
        kind={split.kind}
        streamingPreview={embedOpts.streamingPreview}
        showRestore={showRestore}
        restoreDisabled={embedOpts.restoreDisabled}
        onRestoreDiagramSnapshot={embedOpts.onRestoreDiagramSnapshot}
      />
    </>
  );
}

function renderEmbeddedAwareRich(content, richOpts, embedOpts) {
  const working = stripInsightStreamDelimiters(preprocessBulletArtifacts(content));
  const segments = partitionDiagramToolJsonBlocks(working);

  if (segments.length === 1 && segments[0].type === 'text') {
    return renderTextWithEmbeddedDsl(segments[0].value, richOpts, embedOpts);
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'text') {
          const inner = renderTextWithEmbeddedDsl(seg.value, richOpts, {
            ...embedOpts,
            idPrefix: `${embedOpts.idPrefix}-s${i}`
          });
          return inner ? <Fragment key={`seg-${i}`}>{inner}</Fragment> : null;
        }
        // Same dedup as DSL: hide mid-prose JSON tool-call previews when the bottom
        // "Resulting diagram" section will already show the same final source.
        if (embedOpts.suppressEmbedded) return null;
        const showPatchRestore =
          embedOpts.showEmbeddedRestore &&
          !embedOpts.streamingPreview &&
          Boolean(seg.source?.trim());
        return (
          <div
            key={`patch-${i}`}
            className="insights-diagram-patch-callout"
            role="region"
            aria-label="Diagram patch from agent tool"
          >
            <div className="insights-diagram-patch-callout-head">
              <span className="insights-diagram-patch-callout-title">Patch preview</span>
              {seg.reason?.trim() ? (
                <span className="insights-diagram-patch-callout-reason" title={seg.reason}>
                  {seg.reason.length > 140 ? `${seg.reason.slice(0, 137)}…` : seg.reason}
                </span>
              ) : null}
            </div>
            <EmbeddedDiagramBlock
              idPrefix={`${embedOpts.idPrefix}-json-${i}`}
              source={seg.source}
              kind={seg.kind}
              streamingPreview={embedOpts.streamingPreview}
              showRestore={showPatchRestore}
              restoreDisabled={embedOpts.restoreDisabled}
              onRestoreDiagramSnapshot={embedOpts.onRestoreDiagramSnapshot}
            />
          </div>
        );
      })}
    </>
  );
}

function renderRichContent(content, { accentuateSections, idPrefix = 'ins', variant = 'general' }) {
  const cleaned = preprocessBulletArtifacts(content);
  const chunks = splitMarkdownSections(cleaned);
  const hasSections = chunks.some((c) => c.type === 'section');

  if (!hasSections) {
    return renderBodyLines(cleaned, 'flat', false);
  }

  let sectionAnimIndex = 0;
  let goMadSectionIx = 0;
  const openerUsedRef = { current: false };
  return chunks.flatMap((chunk, chunkIdx) => {
    if (chunk.type === 'lead') {
      if (!chunk.body.trim()) return [];
      const openerExtra = leadOpenerExtraClass(variant, accentuateSections, openerUsedRef);
      const leadClass = openerExtra ? `insights-prose-lead ${openerExtra}` : 'insights-prose-lead';
      return [
        <div key={`lead-${chunkIdx}`} className={leadClass}>
          {renderBodyLines(chunk.body, `lead-${chunkIdx}`, false)}
        </div>
      ];
    }
    let tone = 'insights-tone-neutral';
    if (accentuateSections) {
      if (variant === 'goMad') {
        tone = GO_MAD_SECTION_TONES[goMadSectionIx % GO_MAD_SECTION_TONES.length];
        goMadSectionIx += 1;
      } else {
        tone = headingToneClass(chunk.heading, variant);
      }
    }
    const iconCls = sectionHeadingIconClass(tone);
    const delayMs = accentuateSections ? Math.min(sectionAnimIndex++, 12) * 55 : 0;
    return [
      <section
        key={`sec-${chunkIdx}-${chunk.heading.slice(0, 24)}`}
        className={`insights-prose-section ${accentuateSections ? tone : ''}`}
        aria-labelledby={`${idPrefix}-h2-${chunkIdx}`}
        style={
          accentuateSections
            ? {
                animationDelay: `${delayMs}ms`
              }
            : undefined
        }
      >
        <h3 id={`${idPrefix}-h2-${chunkIdx}`} className="insights-md-h2">
          <span className={iconCls} aria-hidden="true" />
          <span className="insights-md-h2-text">{parseInline(chunk.heading)}</span>
        </h3>
        <div className="insights-prose-section-body">{renderBodyLines(chunk.body, `sec-${chunkIdx}`, true)}</div>
      </section>
    ];
  });
}

function statusLabel(entry) {
  if (entry.status === 'failed') return 'Issue';
  if (entry.status === 'cancelled') return 'Stopped';
  if (entry.status === 'done') return 'Done';
  return 'Working';
}

function contentUpdatesTitle(variant) {
  if (variant === 'critique') return 'Analysis';
  if (variant === 'explain') return 'Explanation';
  if (variant === 'refine') return 'Refinement';
  if (variant === 'innovate') return 'Innovation';
  if (variant === 'goMad') return 'Mad mode';
  return 'Content updates';
}

function hidePhaseIds(variant, streamDebugEnabled) {
  if (streamDebugEnabled) return false;
  return (
    variant === 'critique' ||
    variant === 'explain' ||
    variant === 'refine' ||
    variant === 'innovate' ||
    variant === 'goMad'
  );
}

function accentContentLaneClass(variant) {
  if (variant === 'explain') return 'is-explain-content-lane';
  if (variant === 'refine') return 'is-refine-content-lane';
  if (variant === 'innovate') return 'is-innovate-content-lane';
  if (variant === 'goMad') return 'is-gomad-content-lane';
  return '';
}

function accentSectionTitleClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain';
  if (variant === 'refine') return 'insights-section-title-refine';
  if (variant === 'innovate') return 'insights-section-title-innovate';
  if (variant === 'goMad') return 'insights-section-title-gomad';
  return '';
}

function accentSectionTitleIconWrapClass(variant) {
  if (variant === 'explain') return 'insights-section-title-explain-icon';
  if (variant === 'refine') return 'insights-section-title-refine-icon';
  if (variant === 'innovate') return 'insights-section-title-innovate-icon';
  if (variant === 'goMad') return 'insights-section-title-gomad-icon';
  return '';
}

function AccentSectionTitleIcon({ variant }) {
  if (variant === 'explain') return <IconExplain />;
  if (variant === 'refine') return <IconRefine />;
  if (variant === 'innovate') return <IconInnovate />;
  if (variant === 'goMad') return <IconGoMad />;
  return null;
}

function phaseRowGlyph(phaseId, phaseComplete, phaseActive, phaseFailedLast, phaseStoppedLast) {
  if (phaseComplete) return <IconPhaseCheck />;
  if (phaseFailedLast) return <IconAlert small />;
  if (phaseStoppedLast) return <IconPhaseGeneric />;
  if (phaseActive) {
    if (phaseId === 'analyze') return <IconPhaseAnalyze />;
    if (phaseId === 'analyze_stream') return <IconPhaseStream />;
    return <IconPhasePulse />;
  }
  return <IconPhaseGeneric />;
}

export default function InsightsPane({
  entries,
  soundEnabled,
  onSoundEnabledChange,
  celebratingEntryId,
  streamDebugEnabled = false,
  critiqueActionableUi = null,
  diagramUndoDisabled = false,
  onRestoreToEntry,
  onRestoreDiagramSnapshot,
  onOpenProposalFullPreview,
  entryDiagramDiffById = {},
  diagramChangeHighlightEntryId = null,
  diagramChangeHighlightSummary = null,
  diagramChangeHighlightDisabled = false,
  onToggleDiagramChangeHighlight,
  onStopStreamingAgent,
  onRetryInsightEntry,
  onRetryInsightEntryWithQuality,
  retryActionsDisabled = false,
  onDismiss,
  onAcceptProposal,
  onRejectProposal,
  agentReactions = [],
  closing = false
}) {
  const bodyRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const hasLiveAgent = entries.some((e) => (e.status ?? 'running') === 'running');

  function buildEmbedOpts(base, { showEmbeddedRestore = false } = {}) {
    return {
      ...base,
      showEmbeddedRestore,
      restoreDisabled: diagramUndoDisabled,
      onRestoreDiagramSnapshot
    };
  }
  const headlineTopic = (() => {
    const liveWithTopic = [...entries].reverse().find((e) => (e.status ?? 'running') === 'running' && e.topic?.partKind);
    if (liveWithTopic) return liveWithTopic.topic;
    const latestWithTopic = [...entries].reverse().find((e) => e.topic?.partKind);
    return latestWithTopic?.topic ?? null;
  })();
  const activeVariant = (() => {
    const liveEntry = [...entries].reverse().find((e) => (e.status ?? 'running') === 'running' && e.variant);
    if (liveEntry) return liveEntry.variant;
    const latestWithVariant = [...entries].reverse().find((e) => e.variant);
    return latestWithVariant?.variant ?? null;
  })();
  const slopitectVariantClass =
    activeVariant && SLOPITECT_VARIANT_CLASS[activeVariant] ? SLOPITECT_VARIANT_CLASS[activeVariant] : '';
  const slopitectTagline = activeVariant ? VARIANT_TAGLINES[activeVariant] : null;

  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    if (entries.length > 0) return undefined;
    const handle = setInterval(() => setTipIndex((n) => n + 1), TIP_ROTATION_MS);
    return () => clearInterval(handle);
  }, [entries.length]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  function handleBodyScroll(event) {
    const el = event.currentTarget;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    stickToBottomRef.current = distanceFromBottom <= BOTTOM_SNAP_THRESHOLD_PX;
  }

  return (
    <aside
      className={`insights-pane ${slopitectVariantClass} ${closing ? 'is-closing' : ''}`.trim()}
      aria-label="Thoughts and analysis"
      data-variant={activeVariant || undefined}
    >
      <header className={`insights-pane-header ${hasLiveAgent ? 'is-live' : ''}`}>
        <div className="insights-pane-title-row">
          <span className="insights-pane-title">
            {headlineTopic ? 'Thinking' : 'Thinking & notes'}
          </span>
          {headlineTopic ? <TopicChip topic={headlineTopic} /> : null}
          {hasLiveAgent ? (
            <span className="insights-live-badge" aria-live="polite">
              <span className="insights-live-dot" aria-hidden="true" />
              Live
            </span>
          ) : null}
        </div>
        {slopitectTagline ? (
          <span className="insights-pane-tagline" data-testid="insights-tagline">
            {slopitectTagline}
          </span>
        ) : null}
        <div className="insights-pane-controls">
          {typeof onDismiss === 'function' ? (
            <button
              type="button"
              className="insights-pane-dismiss overlay-button compact-button"
              onClick={onDismiss}
              aria-label="Close thinking panel"
            >
              Hide
            </button>
          ) : null}
          {typeof onStopStreamingAgent === 'function' ? (
            <button
              type="button"
              className="insights-stop-stream-btn"
              onClick={onStopStreamingAgent}
            >
              Stop request
            </button>
          ) : null}
          <label className="insights-sound-toggle">
            <input
              type="checkbox"
              checked={Boolean(soundEnabled)}
              onChange={(event) => onSoundEnabledChange?.(event.target.checked)}
            />
            <span>{soundEnabled ? 'Sound on' : 'Sound off'}</span>
          </label>
        </div>
      </header>
      <div ref={bodyRef} className="insights-pane-body" onScroll={handleBodyScroll}>
        {entries.length === 0 ? (
          <>
            <p className="insights-pane-empty">Agent thoughts and critique responses appear here.</p>
            <aside className="insights-tip-of-the-day" data-testid="slopitect-tip-of-the-day">
              <span className="insights-tip-of-the-day-label">Slopitect Tip™</span>
              {tipForIndex(tipIndex)}
            </aside>
          </>
        ) : (
          entries.map((entry) => {
            if (entry.kind === 'proposal') {
              return (
                <div key={entry.id} className="insights-entry insights-entry-proposal">
                  <AgentProposalCard
                    proposal={entry.proposal}
                    status={entry.proposalStatus ?? 'pending'}
                    onAccept={() => onAcceptProposal?.(entry.proposal?.proposalId)}
                    onReject={() => onRejectProposal?.(entry.proposal?.proposalId)}
                    onOpenFullPreview={onOpenProposalFullPreview}
                    openFullPreviewDisabled={diagramUndoDisabled}
                  />
                </div>
              );
            }
            if (entry.kind === 'attributed-note') {
              const noteReactions = agentReactions.filter(
                (r) => r.target?.kind === 'insight' && r.target?.insightId === entry.id
              );
              const noteVariant = entry.variant ?? 'general';
              const noteAccentuate = isAccentuatedInsightVariant(noteVariant);
              return (
                <div
                  key={entry.id}
                  className={`insights-entry insights-entry-attributed-note insights-entry-variant-${noteVariant}`}
                >
                  <header className="insights-entry-note-head">
                    <AgentBadge origin={entry.origin} size="sm" />
                    <span className="insights-entry-note-variant">
                      {noteVariant === 'critique'
                        ? 'Critique'
                        : noteVariant === 'suggestion'
                          ? 'Suggestion'
                          : 'Note'}
                    </span>
                  </header>
                  <div
                    className={`insights-entry-note-body insights-rich-content ${
                      noteAccentuate ? 'is-accentuated' : ''
                    }`}
                  >
                    {renderEmbeddedAwareRich(
                      entry.content ?? '',
                      {
                        accentuateSections: noteAccentuate,
                        idPrefix: `${entry.id}-note`,
                        variant: noteVariant
                      },
                      buildEmbedOpts(
                        { idPrefix: `${entry.id}-note`, streamingPreview: false, suppressEmbedded: false },
                        { showEmbeddedRestore: true }
                      )
                    )}
                  </div>
                  {noteReactions.length > 0 ? (
                    <div className="insights-entry-note-reactions">
                      {noteReactions.map((r) => (
                        <span key={r.reactionId} className="agent-reaction-inline" title={r.origin?.agentName}>
                          {r.emoji}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
            const rawStatus = entry.status ?? 'running';
            const variant = entry.variant ?? 'general';
            const isRunning = rawStatus === 'running';
            const isStreaming = isRunning && Boolean(entry.content?.trim());
            const statusStrip =
              entry.statusText &&
              (rawStatus === 'running' || rawStatus === 'failed' || rawStatus === 'cancelled') &&
              entry.statusText.trim();
            const accentuateSections = isAccentuatedInsightVariant(variant);
            const collapseTech =
              isAccentuatedInsightVariant(variant) && (entry.technicalActions?.length ?? 0) > 0;
            const phaseIdsHidden = hidePhaseIds(variant, streamDebugEnabled);
            const matchesLatestActionable =
              critiqueActionableUi &&
              variant === 'critique' &&
              rawStatus === 'done' &&
              entry.content?.trim() === critiqueActionableUi.critiqueText.trim();

            const afterSource =
              typeof entry.diagramAfterSource === 'string' ? entry.diagramAfterSource : '';
            const afterKind = entry.diagramAfterContentType;
            const hasAfterPreview =
              entry.diagramRevisionApplied &&
              afterSource.trim().length > 0 &&
              (afterKind === 'mermaid' || afterKind === 'infographic');
            const afterDiff = hasAfterPreview ? entryDiagramDiffById?.[entry.id] ?? null : null;
            const afterRemovedIds = afterDiff?.removedIds ?? [];
            // Restore is a per-version bookmark: click to jump the canvas back to this entry's
            // resulting state. Always available on entries that produced a snapshot.
            const showDiagramRestore = hasAfterPreview && rawStatus === 'done';

            // Once the run is done and we have a final "Resulting diagram" preview, hide the
            // mid-prose previews to avoid showing the same diagram twice in the same entry.
            const suppressEmbedded = !isRunning && hasAfterPreview;
            const showEmbeddedRestore = rawStatus === 'done' && !suppressEmbedded;

            let analysisBody = null;
            if (entry.content) {
              if (matchesLatestActionable && critiqueActionableUi.items.length > 0) {
                const { prefix, suffix } = critiqueActionableUi;
                analysisBody = (
                  <>
                    {prefix.trim() ? (
                      <div className="insights-analysis-chunk">
                        {renderEmbeddedAwareRich(
                          prefix,
                          {
                            accentuateSections,
                            idPrefix: `${entry.id}-pre`,
                            variant
                          },
                          buildEmbedOpts(
                            { idPrefix: `${entry.id}-pre`, streamingPreview: isRunning, suppressEmbedded },
                            { showEmbeddedRestore }
                          )
                        )}
                      </div>
                    ) : null}
                    <CritiqueA2uiSurface
                      messages={
                        critiqueActionableUi.a2uiMessages ??
                        buildCritiqueActionableA2uiMessages(critiqueActionableUi.critiqueText)
                      }
                      busy={critiqueActionableUi.busy}
                      onFixAll={critiqueActionableUi.onFixAll}
                      onFixSelected={(mask) => critiqueActionableUi.onFixSelected?.(mask)}
                    />
                    {suffix.trim() ? (
                      <div className="insights-analysis-chunk">
                        {renderEmbeddedAwareRich(
                          suffix,
                          {
                            accentuateSections,
                            idPrefix: `${entry.id}-post`,
                            variant
                          },
                          buildEmbedOpts(
                            { idPrefix: `${entry.id}-post`, streamingPreview: isRunning, suppressEmbedded },
                            { showEmbeddedRestore }
                          )
                        )}
                      </div>
                    ) : null}
                  </>
                );
              } else {
                analysisBody = renderEmbeddedAwareRich(
                  entry.content,
                  {
                    accentuateSections,
                    idPrefix: entry.id,
                    variant
                  },
                  buildEmbedOpts(
                    { idPrefix: entry.id, streamingPreview: isRunning, suppressEmbedded },
                    { showEmbeddedRestore }
                  )
                );
              }
            }

            return (
              <article
                key={entry.id}
                data-variant={variant}
                className={[
                  'insights-entry',
                  entry.id === celebratingEntryId ? 'is-celebrating' : '',
                  isRunning ? 'is-running' : '',
                  isStreaming ? 'is-streaming' : '',
                  rawStatus === 'done' ? 'is-complete' : '',
                  rawStatus === 'failed' ? 'is-failed' : '',
                  rawStatus === 'cancelled' ? 'is-cancelled' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="insights-entry-top">
                  <h3 className="insights-entry-title">
                    <span className="insights-entry-icon" aria-hidden="true">
                      <EntryStatusIcon status={rawStatus} variant={variant} />
                    </span>
                    <span className="insights-entry-title-text" title={entry.title}>
                      {entry.title}
                    </span>
                  </h3>
                  <span className={`insights-status-chip is-${rawStatus}`}>
                    {rawStatus === 'running' ? <span className="insights-working-dot" aria-hidden="true" /> : null}
                    {statusLabel(entry)}
                  </span>
                </div>

                <EntryRunMeta entry={entry} />

                {statusStrip ? (
                  <p
                    className={`insights-status-strip is-${rawStatus}`}
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <span className="insights-status-strip-pulse" aria-hidden="true" />
                    <span className="insights-status-strip-label">Now</span>
                    <span className="insights-status-strip-text">{entry.statusText}</span>
                    {entry.failureDetail ? (
                      <span className="insights-status-strip-detail" title={entry.failureDetail}>
                        {entry.failureDetail}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {canRetryInsightEntry(entry) ? (
                  <div className="insights-entry-retry-row">
                    <div className="insights-entry-retry-actions">
                      <button
                        type="button"
                        className="insights-entry-retry-btn"
                        disabled={retryActionsDisabled}
                        onClick={() => onRetryInsightEntry?.(entry.id)}
                      >
                        Retry
                      </button>
                      {showRetryWithQualityForEntry(entry) ? (
                        <button
                          type="button"
                          className="insights-entry-retry-btn is-quality"
                          disabled={retryActionsDisabled}
                          onClick={() => onRetryInsightEntryWithQuality?.(entry.id)}
                        >
                          Retry with Quality
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {isRunning && entry.phases?.length ? (
                  <SlopitectStatusBoard variant={variant} phases={entry.phases} />
                ) : null}

                {entry.phases?.length ? (
                  <section className="insights-section is-phase-lane" aria-label="Agent phases">
                    <h4 className="insights-section-title">Agent phases</h4>
                    <ol className="insights-phase-list">
                      {entry.phases.map((phase, idx) => {
                        const phases = entry.phases;
                        const isLast = idx === phases.length - 1;
                        const isFailed = rawStatus === 'failed';
                        const isCancelled = rawStatus === 'cancelled';
                        const phaseComplete =
                          rawStatus === 'done' || (!isLast && (isRunning || isFailed || isCancelled));
                        const phaseActive = isRunning && isLast && !isFailed && !isCancelled;
                        const phaseFailedLast = isFailed && isLast;
                        const phaseStoppedLast = isCancelled && isLast;
                        const friendlyId = PHASE_ID_LABELS[phase.id] ?? phase.id;
                        const slopitectLabel = phaseCeremonyLabel(variant, phase.id, phase.label);
                        return (
                          <li
                            key={`${entry.id}-phase-${phase.id}-${idx}`}
                            className={`insights-phase-item ${phaseActive ? 'is-active' : ''} ${phaseComplete ? 'is-complete' : ''} ${phaseFailedLast ? 'is-failed-at' : ''} ${phaseStoppedLast ? 'is-stopped-at' : ''}`}
                          >
                            <span className="insights-phase-glyph-wrap" aria-hidden="true">
                              {phaseRowGlyph(
                                phase.id,
                                phaseComplete,
                                phaseActive,
                                phaseFailedLast,
                                phaseStoppedLast
                              )}
                            </span>
                            <span className="insights-phase-step">{idx + 1}</span>
                            <span className="insights-phase-label">{slopitectLabel}</span>
                            {phaseIdsHidden ? (
                              <>
                                <span className="insights-visually-hidden">{phase.id}</span>
                                <span className="insights-phase-chip" aria-hidden="true">
                                  {friendlyId}
                                </span>
                              </>
                            ) : (
                              <code className="insights-phase-id" title={friendlyId}>
                                {phase.id}
                              </code>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                ) : null}

                {entry.artifacts?.some((a) => a.kind === 'patch_summary') ? (
                  <section className="insights-section is-artifacts" aria-label="Patch summary">
                    <h4 className="insights-section-title">Diagram patch</h4>
                    <ul className="insights-artifact-list">
                      {entry.artifacts
                        .filter((a) => a.kind === 'patch_summary')
                        .map((a, idx) => (
                          <li key={`${entry.id}-patch-${a.revisionId}-${idx}`} className="insights-patch-summary">
                            <span>
                              Revision <strong>{a.revisionId}</strong>
                            </span>
                            <span className="insights-patch-stats">
                              +{a.linesAdded ?? 0} / −{a.linesRemoved ?? 0} lines
                            </span>
                          </li>
                        ))}
                    </ul>
                  </section>
                ) : null}

                <section className={`insights-section ${accentContentLaneClass(variant)}`}>
                  <h4
                    className={['insights-section-title', accentSectionTitleClass(variant)].filter(Boolean).join(' ')}
                  >
                    {accentSectionTitleClass(variant) ? (
                      <>
                        <span className={accentSectionTitleIconWrapClass(variant)} aria-hidden="true">
                          <AccentSectionTitleIcon variant={variant} />
                        </span>
                        <span>{contentUpdatesTitle(variant)}</span>
                      </>
                    ) : (
                      contentUpdatesTitle(variant)
                    )}
                  </h4>
                  {entry.content ? (
                    <div className="insights-entry-rich-text-wrap">
                      <div
                        className={[
                          'insights-entry-rich-text',
                          accentuateSections ? 'is-analyze-prose' : '',
                          variant === 'explain' && accentuateSections ? 'is-explain-prose' : '',
                          variant === 'refine' && accentuateSections ? 'is-refine-prose' : '',
                          variant === 'innovate' && accentuateSections ? 'is-innovate-prose' : '',
                          variant === 'goMad' && accentuateSections ? 'is-gomad-prose' : ''
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {analysisBody}
                      </div>
                      {isRunning && entry.content.trim() ? (
                        <span
                          className={[
                            'insights-stream-caret',
                            variant === 'goMad' ? 'is-gomad-caret' : '',
                            variant === 'refine' ? 'is-refine-caret' : '',
                            variant === 'innovate' ? 'is-innovate-caret' : '',
                            variant === 'critique' ? 'is-critique-caret' : '',
                            variant === 'explain' ? 'is-explain-caret' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  ) : isRunning ? (
                    <p className="insights-waiting-text">Working on your request...</p>
                  ) : null}
                </section>

                {collapseTech ? (
                  <details className="insights-tech-details">
                    <summary className="insights-tech-summary">Tool trace</summary>
                    <div className="insights-tech-details-inner">
                      <ul className="insights-tech-list">
                        {entry.technicalActions.map((action) => (
                          <li key={action.id} className={`insights-tech-item is-${action.status}`}>
                            <span className="insights-tech-icon" aria-hidden="true">
                              {action.status === 'done' ? '✓' : '…'}
                            </span>
                            <span>{action.label}</span>
                            <code>{action.name}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ) : (
                  <section className="insights-section is-tech">
                    <h4 className="insights-section-title">Technical actions</h4>
                    {entry.technicalActions?.length ? (
                      <ul className="insights-tech-list">
                        {entry.technicalActions.map((action) => (
                          <li key={action.id} className={`insights-tech-item is-${action.status}`}>
                            <span className="insights-tech-icon" aria-hidden="true">
                              {action.status === 'done' ? '✓' : '…'}
                            </span>
                            <span>{action.label}</span>
                            <code>{action.name}</code>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="insights-tech-empty">No technical actions yet.</p>
                    )}
                  </section>
                )}

                {hasAfterPreview ? (
                  <section
                    className="insights-section insights-entry-after-section"
                    aria-label={afterKind === 'infographic' ? 'Resulting infographic' : 'Resulting diagram'}
                  >
                    <h4 className="insights-section-title">
                      {afterKind === 'infographic' ? 'Resulting infographic' : 'Resulting diagram'}
                    </h4>
                    {afterDiff &&
                    (afterDiff.addedIds.length || afterDiff.modifiedIds.length || afterDiff.removedIds.length) ? (
                      <p className="insights-after-section-meta" aria-label="Changes since previous version">
                        {afterDiff.addedIds.length ? (
                          <span className="insights-after-meta-chip is-added">
                            +{afterDiff.addedIds.length} added
                          </span>
                        ) : null}
                        {afterDiff.modifiedIds.length ? (
                          <span className="insights-after-meta-chip is-modified">
                            ~{afterDiff.modifiedIds.length} changed
                          </span>
                        ) : null}
                        {afterDiff.removedIds.length ? (
                          <span className="insights-after-meta-chip is-removed">
                            −{afterDiff.removedIds.length} removed
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <InsightsEmbeddedDiagram
                      idPrefix={`${entry.id}-after`}
                      source={afterSource}
                      kind={afterKind}
                      streamingPreview={false}
                      highlight={afterDiff}
                    />
                    {afterRemovedIds.length > 0 ? (
                      <p className="insights-after-removed-note">
                        Removed: {afterRemovedIds.join(', ')}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                {showDiagramRestore ? (
                  <div className="insights-entry-undo-row">
                    <div className="insights-entry-undo-actions">
                      <button
                        type="button"
                        className="insights-entry-highlight-btn"
                        disabled={diagramChangeHighlightDisabled}
                        aria-pressed={entry.id === diagramChangeHighlightEntryId}
                        onClick={() => onToggleDiagramChangeHighlight?.(entry.id)}
                      >
                        {entry.id === diagramChangeHighlightEntryId
                          ? 'Clear canvas highlights'
                          : 'Highlight on canvas'}
                      </button>
                      <button
                        type="button"
                        className="insights-entry-undo-btn"
                        disabled={diagramUndoDisabled}
                        title="Jump the canvas back to this version of the diagram."
                        onClick={() => onRestoreToEntry?.(entry.id)}
                      >
                        Restore
                      </button>
                    </div>
                    {entry.id === diagramChangeHighlightEntryId &&
                    diagramChangeHighlightSummary?.removedIds?.length ? (
                      <p className="insights-change-highlight-note insights-change-highlight-removed">
                        Removed from diagram: {diagramChangeHighlightSummary.removedIds.join(', ')}
                      </p>
                    ) : null}
                    {entry.id === diagramChangeHighlightEntryId &&
                    diagramChangeHighlightSummary?.isStructuralEmpty ? (
                      <p className="insights-change-highlight-note insights-change-highlight-empty" aria-live="polite">
                        No structural changes detected between this version and the diagram before this step.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {streamDebugEnabled && entry.streamDebugLog?.length ? (
                  <details className="insights-stream-debug">
                    <summary>Raw stream events ({entry.streamDebugLog.length})</summary>
                    <pre className="insights-stream-debug-pre">
                      {entry.streamDebugLog.map((row) => JSON.stringify(row)).join('\n')}
                    </pre>
                  </details>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </aside>
  );
}
