/**
 * Visual plan-beat card for the Thinking pane Plan lane.
 */

import InsightsEmbeddedDiagram from './InsightsEmbeddedDiagram.jsx';
import { tryExtractDiagramPreviewFromText } from '../utils/insightsEmbeddedDiagramSplit.js';
import { enrichInline, isVisualStepLine } from '../utils/thinkingProseEnrich';

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

function splitPlanSteps(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

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
    const parts = trimmed.split(/;\s+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }

  return [trimmed];
}

function PlanStepBody({
  step,
  cardIndex,
  stepIndex
}: {
  step: string;
  cardIndex: number;
  stepIndex: number;
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
        <InsightsEmbeddedDiagram
          idPrefix={keyBase}
          source={preview.source}
          kind={preview.kind}
        />
      </div>
    );
  }

  return <>{enrichInline(step, keyBase)}</>;
}

export default function PlanBeatCard({
  beat,
  variant = 'general',
  index = 0
}: {
  beat?: PlanBeat;
  variant?: string;
  index?: number;
}) {
  const source = beat?.source === 'agent' ? 'agent' : 'server';
  const text = String(beat?.text ?? '').trim();
  if (!text) return null;

  const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.general;

  // Detect an embedded diagram DSL across the whole beat before splitting it into
  // steps: multi-line DSL (metaphor/chart JSON, HTML, Mermaid) would otherwise be
  // shredded into one "step" per line and shown as raw code instead of a preview.
  const wholePreview = tryExtractDiagramPreviewFromText(text);
  const steps = wholePreview ? splitPlanSteps(wholePreview.prose ?? '') : splitPlanSteps(text);
  const multiStep = steps.length > 1;

  return (
    <li
      className={`insights-plan-card is-${source}${multiStep ? ' is-multi-step' : ''}${wholePreview ? ' has-diagram-preview' : ''}`}
      data-testid="plan-beat-card"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <span className="insights-plan-card-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="insights-plan-card-body">
        <span className={`insights-plan-card-badge is-${source}`}>
          {source === 'agent' ? 'Agent' : 'Plan'}
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
            <InsightsEmbeddedDiagram
              idPrefix={`plan-${index}`}
              source={wholePreview.source}
              kind={wholePreview.kind}
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
                    <PlanStepBody step={step} cardIndex={index} stepIndex={stepIndex} />
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="insights-plan-card-text">{enrichInline(text, `plan-${index}`)}</p>
        )}
      </div>
    </li>
  );
}
