import { Fragment, useEffect, useRef, useState } from 'react';
import InsightsEmbeddedDiagram from './InsightsEmbeddedDiagram.jsx';
import {
  splitEmbeddedDiagramDsl,
  stripEmbeddedDslFromThinkingText,
  tryExtractDiagramPreviewFromText
} from '../utils/insightsEmbeddedDiagramSplit.js';
import {
  partitionDiagramToolJsonBlocks,
  stripInsightStreamDelimiters
} from '../utils/insightThinkingEnrich.js';
import { PersonaFace } from './personaFaces/index.jsx';
import { enrichInline, isVisualStepLine } from '../utils/thinkingProseEnrich';
import { extractFencedCodeBlock } from '../utils/thinkingFencedBlock';
import { extractMarkdownTableBlock, ThinkingMarkdownTable } from '../utils/thinkingMarkdownTable';
import { ThinkingSyntaxCodeBlock } from '../utils/thinkingSyntaxCode';
import AgentProposalCard from './AgentProposalCard.jsx';
import AgentBadge from './AgentBadge.jsx';
import CritiqueActionablePanel from './CritiqueActionablePanel.jsx';
import ExplainSectionsPanel from './ExplainSectionsPanel';
import ExplainDumbDownControls from './ExplainDumbDownControls.jsx';
import RunTimeline from './RunTimeline';
import StyleEditsPanel, { stripStyleEditLinesFromContent } from './StyleEditsPanel';
import { normalizeCritiqueMarkdownForMatch, isLabelExplainGibberishLevel } from '@archislop/shared';
import { summarizeInsightNowStatus } from '../utils/insightNowStatus.js';
import {
  canRetryInsightEntry,
  showRetryWithQualityForEntry
} from '../utils/insightRetryDescriptor.js';
import {
  getVariantPersona,
  phaseCeremonyLabel,
  quoteForRotation,
  tipForIndex,
  getVariantTagline
} from '../utils/slopitectCopy.js';
import {
  accentContentLaneClass,
  accentSectionTitleClass,
  accentSectionTitleIconWrapClass,
  contentUpdatesTitle,
  hidePhaseIds,
  statusLabel
} from './insightsPaneEntryUi.js';
import { ThinkingPanelIcon } from './AppIcons.jsx';
import ConcentrationControl from './ConcentrationControl.jsx';
import { officeChromeCopy } from '../utils/officeCast.js';
import { AntVModeIcon, ThreeJsModeIcon, VegaLiteModeIcon } from './ContentModeIcons.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { formatLocale } from '../i18n/formatLocale.js';

const SLOPITECT_VARIANT_CLASS = {
  refine: 'is-variant-refine',
  innovate: 'is-variant-innovate',
  goMad: 'is-variant-go-mad',
  critique: 'is-variant-critique',
  explain: 'is-variant-explain',
  exec: 'is-variant-exec'
};

const TIP_ROTATION_MS = 7000;
const PERSONA_QUOTE_ROTATION_MS = 3200;

/** Streaming UI for agent runs: extend `applyAgentStreamInsightEvent` + `InsightsPane` entries for new phases; add A2UI via shared builders + `createLegacyA2uiStreamEvent` (see `critiqueA2uiMessages.js`). */

const BOTTOM_SNAP_THRESHOLD_PX = 72;

function IconThinking() {
  return <ThinkingPanelIcon />;
}

function IconSparkles() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="m11 6.5 1.43 3.24L15.77 11l-3.34 1.26L11 15.5 9.57 12.26 6.23 11l3.34-1.26L11 6.5zm7-2 1 2.25L21.25 8 19 10.25 18 8l-2.25-1.75L18 4.75l1-2.25zm0 11 1 2.25L21.25 19 19 21.25 18 19l-2.25-1.75L18 15.75l1-2.25zM6 16l.85 1.92L8.77 19l-1.92.92L6 21.84l-.85-1.92L3.23 19l1.92-.92L6 16z"
      />
    </svg>
  );
}

function IconCritique() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M9 21c-.55 0-1-.45-1-1v-1H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-6l-3 3v-3H9v1zm1-7h8V7H7v10h2v2l2-2h1zm2.5-4h-5v1.5h5V10zm3 3h-8V11.5h8V13z"
      />
    </svg>
  );
}

function IconExplain() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"
      />
    </svg>
  );
}

function IconRefine() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1-.9 10.1 1 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"
      />
    </svg>
  );
}

function IconInnovate() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1-.85-.6V16h-4v-4.5l-.85.6C7.68 13.28 7 12.18 7 11c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.18-.68 2.28-1.15 3.1z"
      />
    </svg>
  );
}

function IconStopped() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path fill="currentColor" d="M6 6h12v12H6V6z" />
    </svg>
  );
}

function IconGoMad() {
  return (
    <svg
      className="insights-svg-icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
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
    variant === 'goMad' ||
    variant === 'exec'
  );
}

function personaBannerClass(variant) {
  const mapped = SLOPITECT_VARIANT_CLASS[variant];
  return mapped ? `insights-entry-persona ${mapped}` : 'insights-entry-persona';
}

/** Live-run chips in the pane header (replaces top-right LiveRunHud when Thinking is open). */
function InsightsPaneLiveRunMeta({
  variant,
  phases,
  startedAt,
  streak = 0,
  actionLabels = {},
  insightsCopy = {}
}) {
  const now = useElapsedNow(true);
  const started = Number.isFinite(startedAt) ? startedAt : null;
  const elapsedLabel = started != null ? formatElapsedDuration(now - started) : '';
  const latestPhase = Array.isArray(phases) && phases.length > 0 ? phases[phases.length - 1] : null;
  const ceremonyLabel =
    latestPhase?.id != null ? phaseCeremonyLabel(variant, latestPhase.id, latestPhase.label) : null;
  const actionLabel = actionLabels[variant] || null;
  const phaseStep = phases?.length ? phases.length : 0;
  const streakName = actionLabel || variant;

  if (!actionLabel && !ceremonyLabel && !elapsedLabel && streak < 2) return null;

  return (
    <div
      className={`insights-pane-live-meta ${SLOPITECT_VARIANT_CLASS[variant] || ''}`.trim()}
      role="status"
      aria-live="polite"
      data-testid="insights-pane-live-meta"
    >
      {actionLabel ? (
        <span className="insights-pane-live-chip is-action">{actionLabel}</span>
      ) : null}
      {ceremonyLabel ? (
        <span className="insights-pane-live-chip is-phase" title={ceremonyLabel}>
          {ceremonyLabel}
        </span>
      ) : null}
      {phaseStep > 0 ? (
        <span className="insights-pane-live-chip is-step" aria-hidden={!phaseStep}>
          {formatLocale(insightsCopy.phaseStep ?? 'Phase {step}', { step: phaseStep })}
        </span>
      ) : null}
      {elapsedLabel ? (
        <span className="insights-pane-live-chip is-clock">{elapsedLabel}</span>
      ) : null}
      {streak >= 2 ? (
        <span
          className="insights-pane-live-chip is-streak"
          title={formatLocale(insightsCopy.streakTitle ?? '{name} streak', { name: streakName })}
        >
          🔥 ×{streak}
        </span>
      ) : null}
    </div>
  );
}

function findInsightStatusEntry(entries) {
  return (
    [...entries].reverse().find((e) => {
      if (e.kind === 'proposal' || e.kind === 'attributed-note') return false;
      const status = e.status ?? 'running';
      return status === 'running' || status === 'failed' || status === 'cancelled';
    }) ?? null
  );
}

function buildInsightNowStatusStrip(entry, insightsCopy) {
  if (!entry) return null;
  const rawStatus = entry.status ?? 'running';
  const nowStatusCopy =
    entry.statusText && summarizeInsightNowStatus(entry.statusText, entry, insightsCopy);
  if (
    !nowStatusCopy ||
    !(rawStatus === 'running' || rawStatus === 'failed' || rawStatus === 'cancelled') ||
    !nowStatusCopy.trim()
  ) {
    return null;
  }
  return { rawStatus, nowStatusCopy, failureDetail: entry.failureDetail };
}

/** Pinned "Now" summary — stays visible while scrolling the thinking body. */
function InsightsPaneNowStatusStrip({ entry, insightsCopy }) {
  const strip = buildInsightNowStatusStrip(entry, insightsCopy);
  if (!strip) return null;
  const { rawStatus, nowStatusCopy, failureDetail } = strip;
  return (
    <p
      className={`insights-status-strip insights-pane-header-status is-${rawStatus}`}
      aria-live="polite"
      aria-atomic="true"
      data-testid="insights-pane-now-status"
    >
      <span className="insights-status-strip-pulse" aria-hidden="true" />
      <span className="insights-status-strip-label">
        {rawStatus === 'failed' ? insightsCopy.nowIssue : insightsCopy.now}
      </span>
      <span className="insights-status-strip-copy">
        <span className="insights-status-strip-text">{nowStatusCopy}</span>
        {failureDetail ? (
          <span className="insights-status-strip-detail" title={failureDetail}>
            {failureDetail}
          </span>
        ) : null}
      </span>
    </p>
  );
}

/** Who is driving this run — emoji, name, and role title. */
function InsightEntryPersonaBanner({ variant, size = 'entry' }) {
  if (!variant || variant === 'general') return null;
  const persona = getVariantPersona(variant);
  if (!persona?.name) return null;
  return (
    <div
      className={`${personaBannerClass(variant)} is-size-${size}`}
      data-testid={size === 'pane' ? 'insights-pane-persona' : 'insights-entry-persona'}
      aria-label={`${persona.name}, ${persona.title}`}
    >
      <span className="insights-entry-persona-emoji" aria-hidden="true">
        <PersonaFace id={variant} size={size === 'pane' ? 30 : 24} />
      </span>
      <span className="insights-entry-persona-text">
        <span className="insights-entry-persona-name">{persona.name}</span>
        <span className="insights-entry-persona-title">{persona.title}</span>
      </span>
    </div>
  );
}

/** Rotating persona one-liner — same copy the run mascot bubble cycles through. */
function InsightsPanePersonaQuote({ variant, streaming = false }) {
  const [rotationIndex, setRotationIndex] = useState(0);

  useEffect(() => {
    if (!streaming || !variant) return undefined;
    const handle = setInterval(() => setRotationIndex((n) => n + 1), PERSONA_QUOTE_ROTATION_MS);
    return () => clearInterval(handle);
  }, [streaming, variant]);

  if (!variant || variant === 'general') return null;
  const persona = getVariantPersona(variant);
  const quote =
    quoteForRotation(variant, rotationIndex) ||
    persona.entryLine ||
    persona.tagline ||
    getVariantTagline(variant) ||
    '';
  if (!quote) return null;

  return (
    <p
      className="insights-pane-persona-quote"
      data-testid="insights-pane-persona-quote"
      aria-live="polite"
    >
      {quote}
    </p>
  );
}

function IconAlert({ small }) {
  const cls = small ? 'insights-svg-icon insights-svg-icon-sm' : 'insights-svg-icon';
  const dim = small ? 13 : 16;
  return (
    <svg className={cls} viewBox="0 0 24 24" width={dim} height={dim} aria-hidden="true">
      <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
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

function contentTypeMeta(controls) {
  const m = controls.contentModes;
  return {
    mermaid: { label: m.mermaidShort, emoji: '🧜‍♀️' },
    infographic: { label: m.infographicShort, Icon: AntVModeIcon },
    metaphor3d: { label: m.metaphor3dShort, Icon: ThreeJsModeIcon },
    chart: { label: m.chartShort, Icon: VegaLiteModeIcon },
    anything: { label: m.anythingShort, emoji: '🪄' }
  };
}

function modelProfileMeta(controls) {
  const s = controls.settings;
  return {
    fast: { label: s.fast, emoji: '⚡' },
    quality: { label: s.quality, emoji: '🧠' }
  };
}

function formatElapsedDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

function useElapsedNow(running) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  return now;
}

function EntryRunMeta({ entry }) {
  const { controls } = useUiCopy();
  const modeMeta = contentTypeMeta(controls);
  const brainMetaMap = modelProfileMeta(controls);
  const contentMeta = entry?.contentType ? modeMeta[entry.contentType] : null;
  const brainMeta = entry?.modelProfile ? brainMetaMap[entry.modelProfile] : null;
  const startedAt = Number.isFinite(entry?.startedAt) ? entry.startedAt : null;
  const completedAt = Number.isFinite(entry?.completedAt) ? entry.completedAt : null;
  const isRunning = startedAt != null && completedAt == null;
  const now = useElapsedNow(isRunning);
  const elapsedMs = startedAt == null ? null : (completedAt ?? now) - startedAt;
  const elapsedLabel = elapsedMs != null ? formatElapsedDuration(elapsedMs) : '';
  if (!contentMeta && !brainMeta && !elapsedLabel) return null;
  return (
    <div className="insights-entry-meta" aria-label={controls.insights.runDetails}>
      {contentMeta ? (
        <span
          className="insights-entry-meta-chip is-mode"
          title={`${contentMeta.label} ${controls.insights.modeSuffix}`}
        >
          <span className="insights-entry-meta-emoji" aria-hidden="true">
            {contentMeta.Icon ? <contentMeta.Icon /> : contentMeta.emoji}
          </span>
          <span>{contentMeta.label}</span>
        </span>
      ) : null}
      {brainMeta ? (
        <span
          className="insights-entry-meta-chip is-brain"
          title={`${brainMeta.label} ${controls.insights.brainSuffix}`}
        >
          <span className="insights-entry-meta-emoji" aria-hidden="true">
            {brainMeta.emoji}
          </span>
          <span>{brainMeta.label}</span>
        </span>
      ) : null}
      {elapsedLabel ? (
        <time
          className={`insights-entry-meta-chip is-time${isRunning ? ' is-running' : ''}`}
          dateTime={startedAt != null ? new Date(startedAt).toISOString() : undefined}
          title={isRunning ? controls.insights.elapsedTime : controls.insights.totalTime}
        >
          <span className="insights-entry-meta-emoji" aria-hidden="true">
            ⏱️
          </span>
          <span>{elapsedLabel}</span>
        </time>
      ) : null}
    </div>
  );
}

/** Inline prose with generative micro-viz (hex swatches, ramps, icons, theme vars). */
function parseInline(text, keyPrefix = 'inl') {
  return enrichInline(text, keyPrefix);
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
  if (h.includes('idea') || h.includes('concept') || h.includes('proposal'))
    return 'insights-tone-innovate-spark';
  if (h.includes('alternative') || h.includes('option') || h.includes('stretch'))
    return 'insights-tone-innovate-alt';
  if (h.includes('experiment') || h.includes('wildcard') || h.includes('wild card'))
    return 'insights-tone-innovate-play';
  if (h.includes('risk') || h.includes('tradeoff') || h.includes('trade-off'))
    return 'insights-tone-innovate-tradeoff';
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
  if (toneClass === 'insights-tone-explain-overview')
    return 'insights-section-icon is-explain-overview';
  if (toneClass === 'insights-tone-explain-flows') return 'insights-section-icon is-explain-flows';
  if (toneClass === 'insights-tone-explain-entities')
    return 'insights-section-icon is-explain-entities';
  if (toneClass === 'insights-tone-explain-takeaways')
    return 'insights-section-icon is-explain-takeaways';
  if (toneClass === 'insights-tone-explain-neutral')
    return 'insights-section-icon is-explain-neutral';
  if (toneClass === 'insights-tone-innovate-spark')
    return 'insights-section-icon is-innovate-spark';
  if (toneClass === 'insights-tone-innovate-alt') return 'insights-section-icon is-innovate-alt';
  if (toneClass === 'insights-tone-innovate-play') return 'insights-section-icon is-innovate-play';
  if (toneClass === 'insights-tone-innovate-tradeoff')
    return 'insights-section-icon is-innovate-tradeoff';
  if (toneClass === 'insights-tone-innovate-neutral')
    return 'insights-section-icon is-innovate-neutral';
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

function renderFencedOrDiagramBlock(code, language, keyPrefix, embedOpts) {
  const preview = tryExtractDiagramPreviewFromText(code, {
    expectedKind: embedOpts?.expectedPreviewKind ?? null
  });
  if (preview) {
    if (embedOpts?.suppressEmbedded) return null;
    return (
      <EmbeddedDiagramBlock
        idPrefix={`${keyPrefix}-fence`}
        source={preview.source}
        kind={preview.kind}
        streamingPreview={embedOpts?.streamingPreview}
        showRestore={embedOpts?.showEmbeddedRestore && !embedOpts?.streamingPreview}
        restoreDisabled={embedOpts?.restoreDisabled}
        onRestoreDiagramSnapshot={embedOpts?.onRestoreDiagramSnapshot}
        targetContentType={embedOpts?.targetPreviewKind ?? null}
      />
    );
  }
  return (
    <ThinkingSyntaxCodeBlock code={code} language={language} keyPrefix={`${keyPrefix}-fence`} />
  );
}

/** Detect embedded diagram DSL in a body chunk before line-by-line shredding. */
function renderEmbeddedBodyContent(body, keyPrefix, useSectionTypography, embedOpts) {
  if (!body?.trim()) return null;
  const split = splitEmbeddedDiagramDsl(body, embedOpts?.expectedPreviewKind ?? null);
  if (split?.dsl) {
    if (embedOpts?.suppressEmbedded) {
      return split.prose.trim()
        ? renderBodyLines(split.prose, keyPrefix, useSectionTypography, embedOpts)
        : null;
    }
    const showRestore =
      embedOpts?.showEmbeddedRestore && !embedOpts?.streamingPreview && Boolean(split.dsl?.trim());
    return (
      <>
        {split.prose.trim()
          ? renderBodyLines(split.prose, keyPrefix, useSectionTypography, embedOpts)
          : null}
        <EmbeddedDiagramBlock
          idPrefix={`${keyPrefix}-body-dsl`}
          source={split.dsl}
          kind={split.kind}
          streamingPreview={embedOpts?.streamingPreview}
          showRestore={showRestore}
          restoreDisabled={embedOpts?.restoreDisabled}
          onRestoreDiagramSnapshot={embedOpts?.onRestoreDiagramSnapshot}
          targetContentType={embedOpts?.targetPreviewKind ?? null}
        />
      </>
    );
  }
  return renderBodyLines(body, keyPrefix, useSectionTypography, embedOpts);
}

function renderBodyLines(body, keyPrefix, useSectionTypography, embedOpts = null) {
  const lines = body.split('\n');
  const out = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(<div key={`${keyPrefix}-gap-${index}`} className="insights-content-gap" />);
      index += 1;
      continue;
    }

    const fencedBlock = extractFencedCodeBlock(lines, index);
    if (fencedBlock) {
      const block = renderFencedOrDiagramBlock(
        fencedBlock.code,
        fencedBlock.language,
        `${keyPrefix}-fence-${index}`,
        embedOpts
      );
      if (block) {
        out.push(
          <div key={`${keyPrefix}-fence-wrap-${index}`} className="insights-fenced-block">
            {block}
          </div>
        );
      }
      index = fencedBlock.nextIndex;
      continue;
    }

    const tableBlock = extractMarkdownTableBlock(lines, index);
    if (tableBlock) {
      out.push(
        <ThinkingMarkdownTable
          key={`${keyPrefix}-tbl-${index}`}
          headers={tableBlock.headers}
          rows={tableBlock.rows}
          keyPrefix={`${keyPrefix}-tbl-${index}`}
        />
      );
      index = tableBlock.nextIndex;
      continue;
    }

    const olMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const stepBody = olMatch[2];
      const stepPreview = tryExtractDiagramPreviewFromText(stepBody, {
        expectedKind: embedOpts?.expectedPreviewKind ?? null
      });
      const stepClass = [
        'insights-content-ordered',
        stepPreview ? 'is-diagram-preview' : '',
        isVisualStepLine(stepBody) ? 'insights-step-card' : ''
      ]
        .filter(Boolean)
        .join(' ');
      out.push(
        <div key={`${keyPrefix}-ol-${index}`} className={stepClass}>
          <p className="insights-content-ordered-head">
            <span className="insights-ordered-marker" aria-hidden="true">
              {olMatch[1]}.
            </span>
            {stepPreview?.prose ? (
              <span className="insights-step-card-body">
                {parseInline(stepPreview.prose, `${keyPrefix}-ol-${index}-prose`)}
              </span>
            ) : !stepPreview ? (
              <span className="insights-step-card-body">
                {parseInline(stepBody, `${keyPrefix}-ol-${index}`)}
              </span>
            ) : null}
          </p>
          {stepPreview && !embedOpts?.suppressEmbedded ? (
            <EmbeddedDiagramBlock
              idPrefix={`${keyPrefix}-ol-${index}-preview`}
              source={stepPreview.source}
              kind={stepPreview.kind}
              streamingPreview={embedOpts?.streamingPreview}
              showRestore={embedOpts?.showEmbeddedRestore && !embedOpts?.streamingPreview}
              restoreDisabled={embedOpts?.restoreDisabled}
              onRestoreDiagramSnapshot={embedOpts?.onRestoreDiagramSnapshot}
              targetContentType={embedOpts?.targetPreviewKind ?? null}
            />
          ) : null}
        </div>
      );
      index += 1;
      continue;
    }
    if (trimmed.startsWith('### ')) {
      out.push(
        <h4 key={`${keyPrefix}-h3-${index}`} className="insights-content-heading">
          {parseInline(trimmed.slice(4))}
        </h4>
      );
      index += 1;
      continue;
    }
    if (trimmed.startsWith('# ') && !trimmed.startsWith('##')) {
      out.push(
        <h3 key={`${keyPrefix}-h1-${index}`} className="insights-content-heading-xl">
          {parseInline(trimmed.slice(2))}
        </h3>
      );
      index += 1;
      continue;
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
      index += 1;
      continue;
    }
    const paraClass = useSectionTypography
      ? 'insights-content-line insights-content-line-in-section'
      : 'insights-content-line';
    out.push(
      <p key={`${keyPrefix}-p-${index}`} className={paraClass}>
        {parseInline(line)}
      </p>
    );
    index += 1;
  }

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

function resultingPreviewLabel(afterKind, insightsCopy) {
  if (afterKind === 'infographic') return insightsCopy.resultingInfographic;
  if (afterKind === 'chart') return insightsCopy.resultingChart;
  if (afterKind === 'metaphor3d') return insightsCopy.resulting3d;
  if (afterKind === 'anything') return insightsCopy.resultingPage;
  if (afterKind === 'forms') return insightsCopy.resultingForm;
  return insightsCopy.resultingDiagram;
}

function DiagramDiffLegend({ diff, ariaLabel, insightsCopy }) {
  if (!diff || (!diff.addedIds?.length && !diff.modifiedIds?.length && !diff.removedIds?.length)) {
    return null;
  }
  const copy = insightsCopy ?? {};
  return (
    <p className="insights-after-section-meta" aria-label={ariaLabel}>
      {diff.addedIds?.length ? (
        <span className="insights-after-meta-chip is-added">
          {formatLocale(copy.diffAdded ?? '+{count} added', { count: diff.addedIds.length })}
        </span>
      ) : null}
      {diff.modifiedIds?.length ? (
        <span className="insights-after-meta-chip is-modified">
          {formatLocale(copy.diffChanged ?? '~{count} changed', { count: diff.modifiedIds.length })}
        </span>
      ) : null}
      {diff.removedIds?.length ? (
        <span className="insights-after-meta-chip is-removed">
          {formatLocale(copy.diffRemoved ?? '−{count} removed', { count: diff.removedIds.length })}
        </span>
      ) : null}
    </p>
  );
}

function EmbeddedDiagramBlock({
  idPrefix,
  source,
  kind,
  streamingPreview,
  highlight,
  showRestore,
  restoreDisabled,
  onRestoreDiagramSnapshot,
  targetContentType = null
}) {
  const { controls } = useUiCopy();
  const isSourceContext = Boolean(targetContentType && kind && kind !== targetContentType);
  return (
    <div className="insights-embedded-diagram-block">
      {isSourceContext ? (
        <span
          className="insights-plan-source-context-badge"
          data-testid="insights-source-context-badge"
        >
          {controls.insights.sourceContext}
        </span>
      ) : null}
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
            title={controls.insights.loadOntoCanvas}
            onClick={() => onRestoreDiagramSnapshot({ diagramSource: source, contentType: kind })}
          >
            {controls.insights.restore}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function renderTextWithEmbeddedDsl(text, richOpts, embedOpts) {
  if (!text.trim()) return null;
  const split = splitEmbeddedDiagramDsl(text, embedOpts.expectedPreviewKind ?? null);
  if (!split) {
    return renderRichContent(text, { ...richOpts, embedOpts });
  }
  // When the entry already shows a "Resulting diagram" preview at the bottom, drop the
  // mid-prose DSL preview to avoid duplicating the same diagram twice in one entry.
  const proseOnly = embedOpts.suppressEmbedded ? split.prose : null;
  if (embedOpts.suppressEmbedded) {
    return proseOnly?.trim() ? renderRichContent(proseOnly, { ...richOpts, embedOpts }) : null;
  }
  const showRestore =
    embedOpts.showEmbeddedRestore && !embedOpts.streamingPreview && Boolean(split.dsl?.trim());
  return (
    <>
      {split.prose.trim() ? renderRichContent(split.prose, { ...richOpts, embedOpts }) : null}
      <EmbeddedDiagramBlock
        idPrefix={`${embedOpts.idPrefix}-dsl`}
        source={split.dsl}
        kind={split.kind}
        streamingPreview={embedOpts.streamingPreview}
        showRestore={showRestore}
        restoreDisabled={embedOpts.restoreDisabled}
        onRestoreDiagramSnapshot={embedOpts.onRestoreDiagramSnapshot}
        targetContentType={embedOpts.targetPreviewKind ?? null}
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
        if (embedOpts.expectedPreviewKind && seg.kind !== embedOpts.expectedPreviewKind) {
          return null;
        }
        const showPatchRestore =
          embedOpts.showEmbeddedRestore &&
          !embedOpts.streamingPreview &&
          Boolean(seg.source?.trim());
        return (
          <div
            key={`patch-${i}`}
            className="insights-diagram-patch-callout"
            role="region"
            aria-label={embedOpts.patchCalloutAria ?? 'Diagram patch from agent tool'}
          >
            <div className="insights-diagram-patch-callout-head">
              <span className="insights-diagram-patch-callout-title">
                {embedOpts.patchPreviewLabel ?? 'Patch preview'}
              </span>
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

function renderRichContent(
  content,
  { accentuateSections, idPrefix = 'ins', variant = 'general', embedOpts = null }
) {
  const cleaned = preprocessBulletArtifacts(content);
  const chunks = splitMarkdownSections(cleaned);
  const hasSections = chunks.some((c) => c.type === 'section');

  if (!hasSections) {
    return renderEmbeddedBodyContent(cleaned, 'flat', false, embedOpts);
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
          {renderEmbeddedBodyContent(chunk.body, `lead-${chunkIdx}`, false, embedOpts)}
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
        <div className="insights-prose-section-body">
          {renderEmbeddedBodyContent(chunk.body, `sec-${chunkIdx}`, true, embedOpts)}
        </div>
      </section>
    ];
  });
}

function AccentSectionTitleIcon({ variant }) {
  if (variant === 'explain') return <IconExplain />;
  if (variant === 'refine') return <IconRefine />;
  if (variant === 'innovate') return <IconInnovate />;
  if (variant === 'goMad') return <IconGoMad />;
  return null;
}

export default function InsightsPane({
  ceremonySlot = null,
  entries,
  streakByVariant = null,
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
  onApplyStyleEdits,
  styleEditsApplyBusy = false,
  closing = false,
  liveDraftSource = '',
  liveDraftContentType = null,
  activeContentType = 'mermaid',
  explainDumbLevelByEntryId = null,
  explainDumbLoadingEntryId = null,
  explainDumbSurrenderedEntryIds = null,
  onExplainDumbDown,
  modelProfile = 'fast',
  onSelectModelProfile = null,
  editorOpen = false,
  onToggleEditor = null,
  canToggleEditor = false,
  deskSlotRef = null
}) {
  const { controls } = useUiCopy();
  const insightsCopy = controls.insights;
  const deskCopy = officeChromeCopy().desk;
  const bodyRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const hasLiveAgent = entries.some((e) => (e.status ?? 'running') === 'running');

  function buildEmbedOpts(base, { showEmbeddedRestore = false, expectedPreviewKind = null } = {}) {
    return {
      ...base,
      showEmbeddedRestore,
      expectedPreviewKind,
      targetPreviewKind: expectedPreviewKind,
      restoreDisabled: diagramUndoDisabled,
      onRestoreDiagramSnapshot,
      patchCalloutAria: insightsCopy.patchFromTool,
      patchPreviewLabel: insightsCopy.patchPreview
    };
  }
  const liveEntry =
    [...entries].reverse().find((e) => (e.status ?? 'running') === 'running') ?? null;
  const statusEntry = findInsightStatusEntry(entries);
  const activeVariant = (() => {
    if (liveEntry?.variant) return liveEntry.variant;
    const latestWithVariant = [...entries].reverse().find((e) => e.variant);
    return latestWithVariant?.variant ?? null;
  })();
  const liveStreak =
    activeVariant && streakByVariant && typeof streakByVariant === 'object'
      ? (streakByVariant[activeVariant] ?? 0)
      : 0;
  const slopitectVariantClass =
    activeVariant && SLOPITECT_VARIANT_CLASS[activeVariant]
      ? SLOPITECT_VARIANT_CLASS[activeVariant]
      : '';

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
      aria-label={insightsCopy.paneLabel}
      data-variant={activeVariant || undefined}
    >
      {ceremonySlot}
      <header className={`insights-pane-header ${hasLiveAgent ? 'is-live' : ''}`}>
        <div className="insights-pane-header-top" data-testid="insights-pane-header-tools">
          <span className="insights-pane-title">{insightsCopy.title}</span>
          {hasLiveAgent ? (
            <span className="insights-live-badge" aria-live="polite">
              <span className="insights-live-dot" aria-hidden="true" />
              {insightsCopy.live}
            </span>
          ) : null}
          {typeof deskSlotRef === 'function' ? (
            <div
              id="office-desk-bottom-slot"
              ref={deskSlotRef}
              className="insights-pane-desk-slot desk-chrome-tool"
            />
          ) : null}
          <ConcentrationControl
            variant="header"
            compact
            modelProfile={modelProfile}
            onSelectModelProfile={onSelectModelProfile}
          />
          {typeof onToggleEditor === 'function' ? (
            <button
              type="button"
              className={`insights-pane-tool-btn${editorOpen ? ' is-active' : ''}`}
              aria-pressed={editorOpen}
              disabled={!canToggleEditor}
              title={
                canToggleEditor
                  ? editorOpen
                    ? deskCopy.codeDrawerClose
                    : deskCopy.codeDrawerTitle
                  : deskCopy.blocked?.noCode
              }
              data-testid="insights-code-drawer-toggle"
              onClick={() => onToggleEditor()}
            >
              <span className="insights-pane-tool-emoji" aria-hidden="true">
                {'</>'}
              </span>
              <span className="insights-pane-tool-label">
                {editorOpen ? deskCopy.codeDrawerClose : deskCopy.codeDrawer}
              </span>
            </button>
          ) : null}
        </div>
        {hasLiveAgent && liveEntry?.variant ? (
          <div className="insights-pane-header-meta">
            <InsightEntryPersonaBanner variant={liveEntry.variant} size="pane" />
            <InsightsPaneLiveRunMeta
              variant={liveEntry.variant}
              phases={liveEntry.phases}
              startedAt={liveEntry.startedAt}
              streak={liveStreak}
              actionLabels={controls.actions}
              insightsCopy={insightsCopy}
            />
            <InsightsPanePersonaQuote variant={liveEntry.variant} streaming />
          </div>
        ) : null}
        <InsightsPaneNowStatusStrip entry={statusEntry} insightsCopy={insightsCopy} />
      </header>
      <div ref={bodyRef} className="insights-pane-body" onScroll={handleBodyScroll}>
        {entries.length === 0 ? (
          <>
            <p className="insights-pane-empty">{insightsCopy.empty}</p>
            <aside className="insights-tip-of-the-day" data-testid="slopitect-tip-of-the-day">
              <span className="insights-tip-of-the-day-label">{insightsCopy.tipLabel}</span>
              {tipForIndex(tipIndex)}
            </aside>
          </>
        ) : (
          entries.map((entry) => {
            const entryPreviewKind =
              typeof entry.contentType === 'string' && entry.contentType.trim()
                ? entry.contentType
                : (entry.status ?? 'running') === 'running'
                  ? activeContentType
                  : null;
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
                    {noteAccentuate ? (
                      <InsightEntryPersonaBanner variant={noteVariant} size="note" />
                    ) : (
                      <>
                        <AgentBadge origin={entry.origin} size="sm" />
                        <span className="insights-entry-note-variant">
                          {noteVariant === 'critique'
                            ? controls.insights.critique
                            : noteVariant === 'suggestion'
                              ? controls.insights.suggestion
                              : controls.insights.note}
                        </span>
                      </>
                    )}
                    {entry.origin?.agentName ? (
                      <span className="insights-entry-note-agent" title={entry.origin.agentName}>
                        {controls.insights.via} {entry.origin.agentName}
                      </span>
                    ) : null}
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
                        {
                          idPrefix: `${entry.id}-note`,
                          streamingPreview: false,
                          suppressEmbedded: false
                        },
                        { showEmbeddedRestore: true, expectedPreviewKind: entryPreviewKind }
                      )
                    )}
                  </div>
                  {noteReactions.length > 0 ? (
                    <div className="insights-entry-note-reactions">
                      {noteReactions.map((r) => (
                        <span
                          key={r.reactionId}
                          className="agent-reaction-inline"
                          title={r.origin?.agentName}
                        >
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
            const accentuateSections = isAccentuatedInsightVariant(variant);
            const phaseIdsHidden = hidePhaseIds(variant, streamDebugEnabled);
            const matchesLatestActionable =
              critiqueActionableUi &&
              variant === 'critique' &&
              rawStatus === 'done' &&
              (entry.id === critiqueActionableUi.insightEntryId ||
                normalizeCritiqueMarkdownForMatch(entry.content) ===
                  normalizeCritiqueMarkdownForMatch(critiqueActionableUi.critiqueText));

            const afterSource =
              typeof entry.diagramAfterSource === 'string' ? entry.diagramAfterSource : '';
            const afterKind = entry.diagramAfterContentType;
            const hasAfterPreview =
              entry.diagramRevisionApplied &&
              afterSource.trim().length > 0 &&
              (afterKind === 'mermaid' ||
                afterKind === 'infographic' ||
                afterKind === 'chart' ||
                afterKind === 'metaphor3d' ||
                afterKind === 'anything' ||
                afterKind === 'forms');
            const afterDiff = hasAfterPreview ? (entryDiagramDiffById?.[entry.id] ?? null) : null;
            const afterRemovedIds = afterDiff?.removedIds ?? [];
            // Restore is a per-version bookmark: click to jump the canvas back to this entry's
            // resulting state. Always available on entries that produced a snapshot.
            const showDiagramRestore = hasAfterPreview && rawStatus === 'done';

            // Once the run is done and we have a final "Resulting diagram" preview, hide the
            // mid-prose previews to avoid showing the same diagram twice in the same entry.
            const suppressEmbedded = !isRunning && hasAfterPreview;
            const showEmbeddedRestore = rawStatus === 'done' && !suppressEmbedded;
            const hasStyleEdits =
              Array.isArray(entry.styleEdits) && entry.styleEdits.length > 0 && !isRunning;
            let displayContent = hasStyleEdits
              ? stripStyleEditLinesFromContent(entry.content ?? '', entry.styleEdits)
              : entry.content;
            const showLiveDraftPreview =
              isRunning &&
              entry.id === liveEntry?.id &&
              Boolean(liveDraftSource?.trim()) &&
              liveDraftContentType === activeContentType &&
              (liveDraftContentType === 'chart' ||
                liveDraftContentType === 'metaphor3d' ||
                liveDraftContentType === 'anything');
            if (showLiveDraftPreview && displayContent) {
              displayContent = stripEmbeddedDslFromThinkingText(
                displayContent,
                liveDraftContentType
              );
            }

            let analysisBody = null;
            const explainStructured =
              variant === 'explain' && entry.explainSections?.sections?.length > 0 && !isRunning;
            const explainDumbLevel = explainDumbLevelByEntryId?.[entry.id] ?? 0;
            const explainDumbLoading = explainDumbLoadingEntryId === entry.id;
            const explainDumbSurrendered = Boolean(explainDumbSurrenderedEntryIds?.[entry.id]);
            const showExplainDumbDown =
              variant === 'explain' &&
              rawStatus === 'done' &&
              (Boolean(displayContent?.trim()) || explainStructured) &&
              typeof onExplainDumbDown === 'function';
            const explainProseGibberish = isLabelExplainGibberishLevel(explainDumbLevel);
            if (explainStructured) {
              const renderExplainChunk = (text) =>
                renderEmbeddedAwareRich(
                  text,
                  { accentuateSections, idPrefix: `${entry.id}-explain`, variant },
                  buildEmbedOpts(
                    { idPrefix: `${entry.id}-explain`, streamingPreview: false, suppressEmbedded },
                    { showEmbeddedRestore, expectedPreviewKind: entryPreviewKind }
                  )
                );
              analysisBody = (
                <ExplainSectionsPanel
                  explainSections={entry.explainSections}
                  renderBody={renderExplainChunk}
                />
              );
            } else if (displayContent) {
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
                            {
                              idPrefix: `${entry.id}-pre`,
                              streamingPreview: isRunning,
                              suppressEmbedded
                            },
                            { showEmbeddedRestore, expectedPreviewKind: entryPreviewKind }
                          )
                        )}
                      </div>
                    ) : null}
                    <CritiqueActionablePanel
                      headingText={critiqueActionableUi.headingText}
                      items={critiqueActionableUi.items}
                      critiqueText={critiqueActionableUi.critiqueText}
                      a2uiMessages={critiqueActionableUi.a2uiMessages}
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
                            {
                              idPrefix: `${entry.id}-post`,
                              streamingPreview: isRunning,
                              suppressEmbedded
                            },
                            { showEmbeddedRestore, expectedPreviewKind: entryPreviewKind }
                          )
                        )}
                      </div>
                    ) : null}
                  </>
                );
              } else {
                analysisBody = renderEmbeddedAwareRich(
                  displayContent,
                  {
                    accentuateSections,
                    idPrefix: entry.id,
                    variant
                  },
                  buildEmbedOpts(
                    { idPrefix: entry.id, streamingPreview: isRunning, suppressEmbedded },
                    { showEmbeddedRestore, expectedPreviewKind: entryPreviewKind }
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
                <InsightEntryPersonaBanner variant={variant} />
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
                    {rawStatus === 'running' ? (
                      <span className="insights-working-dot" aria-hidden="true" />
                    ) : null}
                    {statusLabel(entry, insightsCopy)}
                  </span>
                </div>

                <EntryRunMeta entry={entry} />

                {canRetryInsightEntry(entry) ? (
                  <div className="insights-entry-retry-row">
                    <div className="insights-entry-retry-actions">
                      <button
                        type="button"
                        className="insights-entry-retry-btn"
                        disabled={retryActionsDisabled}
                        onClick={() => onRetryInsightEntry?.(entry.id)}
                      >
                        {insightsCopy.retry}
                      </button>
                      {showRetryWithQualityForEntry(entry) ? (
                        <button
                          type="button"
                          className="insights-entry-retry-btn is-quality"
                          disabled={retryActionsDisabled}
                          onClick={() => onRetryInsightEntryWithQuality?.(entry.id)}
                        >
                          {insightsCopy.retryQuality}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <RunTimeline
                  entry={entry}
                  variant={variant}
                  showRawPhaseIds={!phaseIdsHidden}
                  responseTitle={contentUpdatesTitle(variant, insightsCopy)}
                  responseHead={
                    <h4
                      className={['insights-section-title', accentSectionTitleClass(variant)]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {accentSectionTitleClass(variant) ? (
                        <>
                          <span
                            className={accentSectionTitleIconWrapClass(variant)}
                            aria-hidden="true"
                          >
                            <AccentSectionTitleIcon variant={variant} />
                          </span>
                          <span>{contentUpdatesTitle(variant, insightsCopy)}</span>
                        </>
                      ) : (
                        contentUpdatesTitle(variant, insightsCopy)
                      )}
                    </h4>
                  }
                  hasResponse={Boolean(displayContent || explainStructured || showLiveDraftPreview)}
                  responseActive={isRunning && (isStreaming || showLiveDraftPreview)}
                >
                  <div
                    className={`insights-entry-rich-text-wrap ${accentContentLaneClass(variant)}`.trim()}
                  >
                    <div
                      className={[
                        'insights-entry-rich-text',
                        accentuateSections ? 'is-analyze-prose' : '',
                        variant === 'explain' && accentuateSections ? 'is-explain-prose' : '',
                        explainProseGibberish ? 'is-gibberish' : '',
                        variant === 'refine' && accentuateSections ? 'is-refine-prose' : '',
                        variant === 'innovate' && accentuateSections ? 'is-innovate-prose' : '',
                        variant === 'goMad' && accentuateSections ? 'is-gomad-prose' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {showLiveDraftPreview ? (
                        <EmbeddedDiagramBlock
                          idPrefix={`${entry.id}-live-draft`}
                          source={liveDraftSource}
                          kind={liveDraftContentType}
                          streamingPreview
                        />
                      ) : null}
                      {analysisBody}
                    </div>
                    {showExplainDumbDown ? (
                      <ExplainDumbDownControls
                        dumbLevel={explainDumbLevel}
                        loading={explainDumbLoading}
                        surrendered={explainDumbSurrendered}
                        onDumbDown={() => onExplainDumbDown?.(entry.id)}
                      />
                    ) : null}
                    {isRunning && (entry.content ?? '').trim() ? (
                      <span
                        className={[
                          'insights-stream-caret',
                          'is-shimmer',
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
                </RunTimeline>

                {hasStyleEdits ? (
                  <StyleEditsPanel
                    styleEdits={entry.styleEdits}
                    busy={styleEditsApplyBusy}
                    onApply={onApplyStyleEdits ? () => onApplyStyleEdits(entry) : undefined}
                  />
                ) : null}

                {hasAfterPreview ? (
                  <section
                    className="insights-section insights-entry-after-section"
                    aria-label={resultingPreviewLabel(afterKind, insightsCopy)}
                  >
                    <h4 className="insights-section-title">
                      {resultingPreviewLabel(afterKind, insightsCopy)}
                    </h4>
                    <DiagramDiffLegend
                      diff={afterDiff}
                      ariaLabel={insightsCopy.changesSincePrevious}
                      insightsCopy={insightsCopy}
                    />
                    <InsightsEmbeddedDiagram
                      idPrefix={`${entry.id}-after`}
                      source={afterSource}
                      kind={afterKind}
                      streamingPreview={false}
                      highlight={afterDiff}
                    />
                    {afterRemovedIds.length > 0 ? (
                      <p className="insights-after-removed-note">
                        {formatLocale(insightsCopy.removedFromDiagram, {
                          ids: afterRemovedIds.join(', ')
                        })}
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
                          ? insightsCopy.clearHighlights
                          : insightsCopy.highlightOnCanvas}
                      </button>
                      <button
                        type="button"
                        className="insights-entry-undo-btn"
                        disabled={diagramUndoDisabled}
                        title={insightsCopy.jumpToVersion}
                        onClick={() => onRestoreToEntry?.(entry.id)}
                      >
                        {insightsCopy.restore}
                      </button>
                    </div>
                    {entry.id === diagramChangeHighlightEntryId ? (
                      <DiagramDiffLegend
                        diff={diagramChangeHighlightSummary}
                        ariaLabel={insightsCopy.highlightedChanges}
                        insightsCopy={insightsCopy}
                      />
                    ) : null}
                    {entry.id === diagramChangeHighlightEntryId &&
                    diagramChangeHighlightSummary?.removedIds?.length ? (
                      <p className="insights-change-highlight-note insights-change-highlight-removed">
                        {formatLocale(insightsCopy.removedFromDiagram, {
                          ids: diagramChangeHighlightSummary.removedIds.join(', ')
                        })}
                      </p>
                    ) : null}
                    {entry.id === diagramChangeHighlightEntryId &&
                    diagramChangeHighlightSummary?.isStructuralEmpty ? (
                      <p
                        className="insights-change-highlight-note insights-change-highlight-empty"
                        aria-live="polite"
                      >
                        {insightsCopy.noStructuralChanges}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {streamDebugEnabled && entry.streamDebugLog?.length ? (
                  <details className="insights-stream-debug">
                    <summary>
                      {formatLocale(insightsCopy.rawStreamEvents, {
                        count: entry.streamDebugLog.length
                      })}
                    </summary>
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
      {typeof onStopStreamingAgent === 'function' ? (
        <button type="button" className="insights-stop-stream-btn" onClick={onStopStreamingAgent}>
          {insightsCopy.stopRequest}
        </button>
      ) : null}
      {typeof onDismiss === 'function' ? (
        <button
          type="button"
          className="insights-pane-dismiss overlay-button compact-button"
          onClick={onDismiss}
          aria-label={insightsCopy.closeThinking}
        >
          {insightsCopy.hide}
        </button>
      ) : null}
    </aside>
  );
}
