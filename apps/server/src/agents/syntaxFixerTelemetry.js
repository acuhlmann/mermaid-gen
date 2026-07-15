import { emitPlanBeat } from './planBeatMessages.js';

const PHASE_BY_CONTENT_TYPE = {
  mermaid: { id: 'syntax_fixer', label: 'Mermaid syntax fixer…' },
  chart: { id: 'chart_syntax_fixer', label: 'Chart syntax fixer…' },
  infographic: { id: 'syntax_fixer', label: 'Infographic syntax fixer…' },
  metaphor3d: { id: 'metaphor_syntax_fixer', label: 'Metaphor syntax fixer…' },
  anything: { id: 'anything_syntax_fixer', label: 'Page syntax fixer…' },
  forms: { id: 'forms_syntax_fixer', label: 'Forms syntax fixer…' }
};

const PLAN_BEAT_BY_CONTENT_TYPE = {
  mermaid:
    'Previous patch failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before asking the agent again.',
  chart:
    'Chart DSL failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before retrying.',
  infographic:
    'Infographic DSL failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before retrying.',
  metaphor3d:
    'Metaphor DSL failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before retrying.',
  anything:
    'Page failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before retrying.',
  forms:
    'Forms document failed validation — climbing the syntax-fixer ladder (lite → flash → quality) before retrying.'
};

function resolvePhase(contentType) {
  return PHASE_BY_CONTENT_TYPE[contentType] ?? { id: 'syntax_fixer', label: 'Syntax fixer…' };
}

/** Emit plan beat, phase, and tool-trace start for a syntax fixer ladder pass. */
export function emitSyntaxFixerStart(emit, { contentType, triggerError }) {
  if (typeof emit !== 'function') return;
  const phase = resolvePhase(contentType);
  const planBeat = PLAN_BEAT_BY_CONTENT_TYPE[contentType] ?? PLAN_BEAT_BY_CONTENT_TYPE.chart;
  emitPlanBeat(emit, planBeat, 'server');
  emit({
    type: 'phase',
    id: phase.id,
    label: phase.label.replace('…', ' ladder…')
  });
  emit({
    type: 'syntax_fixer_start',
    contentType,
    triggerError: typeof triggerError === 'string' ? triggerError : ''
  });
}

/**
 * Emit tool-trace outcome after the fixer finishes.
 *
 * @param {'repaired' | 'fixer_failed' | 'store_rejected'} outcome
 */
export function emitSyntaxFixerResult(emit, { contentType, outcome, error = '', detail = '' }) {
  if (typeof emit !== 'function') return;
  emit({
    type: 'syntax_fixer_result',
    contentType,
    outcome,
    error: typeof error === 'string' ? error : '',
    detail: typeof detail === 'string' ? detail : ''
  });
}
