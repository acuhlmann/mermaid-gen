/**
 * Visual plan-beat card for the Thinking pane Plan lane.
 */

import InsightsEmbeddedDiagram from './InsightsEmbeddedDiagram.jsx';
import { tryExtractDiagramPreviewFromText } from '../utils/insightsEmbeddedDiagramSplit.js';
import { extractFirstFencedBlockFromText } from '../utils/thinkingFencedBlock';
import { enrichInline, isVisualStepLine } from '../utils/thinkingProseEnrich';
import { ThinkingSyntaxCodeBlock } from '../utils/thinkingSyntaxCode';
import { useUiCopy } from '../i18n/useUiLocale.js';
import type { ContentType } from '@archislop/shared';

const VARIANT_ICONS: Record<string, string> = {
  refine: '✨',
  innovate: '💡',
  goMad: '🎲',
  critique: '🔍',
  explain: '📖',
  exec: '📊',
  style: '🎨',
  intent: '➡️',
  general: '▸'
};

type PlanBeat = {
  text?: string;
  source?: 'agent' | 'server';
};

type DiagramPreviewMeta = NonNullable<ReturnType<typeof tryExtractDiagramPreviewFromText>>;

function splitPlanSteps(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Keep fenced diagram/HTML blocks intact — line splitting would show ```html and tags as plain text.
  if (/```/.test(trimmed)) {
    const preview = tryExtractDiagramPreviewFromText(trimmed);
    if (preview) {
      const prose = preview.prose?.trim();
      return prose ? splitPlanSteps(prose) : [];
    }
    const fenced = extractFirstFencedBlockFromText(trimmed);
    if (fenced?.prose?.trim()) return [fenced.prose.trim()];
    const proseOnly = trimmed.replace(/```[\s\S]*$/s, '').trim();
    return proseOnly ? [proseOnly] : [trimmed];
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1) {
    return lines.map((line) => line.replace(/^[-•*]\s+/, '').replace(/^\d+\.\s+/, ''));
  }

  const numbered = trimmed.match(/(?:^|\s)\d+\.\s+[^]+?(?=(?:\s\d+\.\s+)|$)/g);
  if (numbered && numbered.length > 1) {
    return numbered.map((part) => part.trim().replace(/^\d+\.\s+/, ''));
  }

  if (trimmed.includes('; ')) {
    const parts = trimmed
      .split(/;\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return [trimmed];
}

function PlanPreviewReuseNote() {
  const { controls } = useUiCopy();
  return (
    <p className="insights-plan-preview-reuse" data-testid="plan-preview-reuse">
      {controls.planBeat.samePreviewAbove}
    </p>
  );
}

function PlanDiagramPreview({
  preview,
  idPrefix,
  targetContentType = null,
  reusePreview = false
}: {
  preview: DiagramPreviewMeta;
  idPrefix: string;
  targetContentType?: ContentType | null;
  /** True when an earlier plan beat already showed this same diagram. */
  reusePreview?: boolean;
}) {
  const { controls } = useUiCopy();
  if (reusePreview) return <PlanPreviewReuseNote />;

  const isSourceContext = Boolean(
    targetContentType && preview.kind && preview.kind !== targetContentType
  );

  return (
    <div className="insights-plan-diagram-preview-wrap">
      {isSourceContext ? (
        <span
          className="insights-plan-source-context-badge"
          data-testid="plan-source-context-badge"
        >
          {controls.insights.sourceContext}
        </span>
      ) : null}
      <InsightsEmbeddedDiagram idPrefix={idPrefix} source={preview.source} kind={preview.kind} />
    </div>
  );
}

function PlanCodeBlock({
  code,
  language,
  keyPrefix
}: {
  code: string;
  language?: string;
  keyPrefix: string;
}) {
  return (
    <div className="insights-plan-code-block">
      <ThinkingSyntaxCodeBlock code={code} language={language ?? ''} keyPrefix={keyPrefix} />
    </div>
  );
}

function PlanStepBody({
  step,
  cardIndex,
  stepIndex,
  targetContentType = null,
  reusePreview = false
}: {
  step: string;
  cardIndex: number;
  stepIndex: number;
  targetContentType?: ContentType | null;
  reusePreview?: boolean;
}) {
  const preview = tryExtractDiagramPreviewFromText(step);
  const keyBase = `plan-${cardIndex}-${stepIndex}`;

  if (preview) {
    return (
      <div className="insights-plan-card-step-preview">
        {preview.prose ? (
          <p className="insights-plan-card-step-preview-prose">
            {enrichInline(preview.prose, `${keyBase}-prose`)}
          </p>
        ) : null}
        <PlanDiagramPreview
          preview={preview}
          idPrefix={keyBase}
          targetContentType={targetContentType}
          reusePreview={reusePreview}
        />
      </div>
    );
  }

  const fenced = extractFirstFencedBlockFromText(step);
  if (fenced?.code?.trim()) {
    return (
      <>
        {fenced.prose?.trim() ? enrichInline(fenced.prose, `${keyBase}-prose`) : null}
        <PlanCodeBlock
          code={fenced.code}
          language={fenced.language}
          keyPrefix={`${keyBase}-code`}
        />
      </>
    );
  }

  return <>{enrichInline(step, keyBase)}</>;
}

function PlanBeatFallbackBody({ text, index }: { text: string; index: number }) {
  const fenced = extractFirstFencedBlockFromText(text);
  if (!fenced?.code?.trim()) {
    return <p className="insights-plan-card-text">{enrichInline(text, `plan-${index}`)}</p>;
  }

  return (
    <div className="insights-plan-card-fenced">
      {fenced.prose?.trim() ? (
        <p className="insights-plan-card-text">
          {enrichInline(fenced.prose, `plan-${index}-prose`)}
        </p>
      ) : null}
      <PlanCodeBlock
        code={fenced.code}
        language={fenced.language}
        keyPrefix={`plan-${index}-fence`}
      />
    </div>
  );
}

export default function PlanBeatCard({
  beat,
  variant = 'general',
  index = 0,
  contentType = null,
  reusePreview = false
}: {
  beat?: PlanBeat;
  variant?: string;
  index?: number;
  /** Run target slot — used only to label cross-mode source-context previews. */
  contentType?: ContentType | null;
  /** When true, omit the embedded diagram and point at an earlier identical preview. */
  reusePreview?: boolean;
}) {
  const { controls } = useUiCopy();
  const source = beat?.source === 'agent' ? 'agent' : 'server';
  const text = String(beat?.text ?? '').trim();
  if (!text) return null;

  const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.general;

  // Detect an embedded diagram DSL across the whole beat before splitting it into
  // steps: multi-line DSL (metaphor/chart JSON, HTML, Mermaid) would otherwise be
  // shredded into one "step" per line and shown as raw code instead of a preview.
  // Plan beats may embed peer-slot source context during mode conversion — do not
  // filter previews by the run's target contentType here.
  const wholePreview = tryExtractDiagramPreviewFromText(text);
  const steps = wholePreview ? splitPlanSteps(wholePreview.prose ?? '') : splitPlanSteps(text);
  const multiStep = steps.length > 1;

  return (
    <li
      className={`insights-plan-card is-${source}${multiStep ? ' is-multi-step' : ''}${wholePreview ? ' has-diagram-preview' : ''}${reusePreview ? ' is-preview-reuse' : ''}`}
      data-testid="plan-beat-card"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <span className="insights-plan-card-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="insights-plan-card-body">
        <span className={`insights-plan-card-badge is-${source}`}>
          {source === 'agent' ? controls.planBeat.agent : controls.planBeat.plan}
        </span>
        {wholePreview ? (
          <div className="insights-plan-card-preview">
            {steps.length > 0 ? (
              multiStep ? (
                <ol className="insights-plan-card-steps">
                  {steps.map((step, stepIndex) => (
                    <li
                      key={`plan-${index}-step-${stepIndex}`}
                      className={[
                        'insights-plan-card-step',
                        isVisualStepLine(step) ? 'insights-step-card' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="insights-plan-card-step-marker" aria-hidden="true">
                        {stepIndex + 1}
                      </span>
                      <span className="insights-plan-card-step-text">
                        {enrichInline(step, `plan-${index}-${stepIndex}`)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="insights-plan-card-text">
                  {enrichInline(steps[0], `plan-${index}-prose`)}
                </p>
              )
            ) : null}
            <PlanDiagramPreview
              preview={wholePreview}
              idPrefix={`plan-${index}`}
              targetContentType={contentType}
              reusePreview={reusePreview}
            />
          </div>
        ) : multiStep ? (
          <ol className="insights-plan-card-steps">
            {steps.map((step, stepIndex) => {
              const preview = tryExtractDiagramPreviewFromText(step);
              return (
                <li
                  key={`plan-${index}-step-${stepIndex}`}
                  className={[
                    'insights-plan-card-step',
                    preview ? 'is-diagram-preview' : '',
                    isVisualStepLine(step) ? 'insights-step-card' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="insights-plan-card-step-marker" aria-hidden="true">
                    {stepIndex + 1}
                  </span>
                  <span className="insights-plan-card-step-text">
                    <PlanStepBody
                      step={step}
                      cardIndex={index}
                      stepIndex={stepIndex}
                      targetContentType={contentType}
                      reusePreview={reusePreview}
                    />
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <PlanBeatFallbackBody text={text} index={index} />
        )}
      </div>
    </li>
  );
}
