import { compile } from 'vega-lite';
import { DiagramPatchSchema, parseChartDsl } from '@archislop/shared';
import { compileFlintChartWrapper, isFlintChartAuthoringEnabled } from './chartFlintAuthoring.js';

function describeCompileError(err) {
  if (!err) return 'Vega-Lite compile() rejected the spec.';
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Run vega-lite/compile() against the inner spec to confirm it is renderable.
 * Returns null on success or a human-readable error string on failure.
 */
function compileSpec(spec) {
  try {
    compile(spec);
    return null;
  } catch (err) {
    return describeCompileError(err);
  }
}

/**
 * Under `CHART_AUTHORING=flint`, compile a Flint-authored wrapper to a Vega-Lite one before
 * the usual ladder runs. Anything that is not a Flint wrapper passes through unchanged.
 */
function resolveAuthoredSource(source, env) {
  if (!isFlintChartAuthoringEnabled(env)) return { ok: true, source, flint: null };
  const flint = compileFlintChartWrapper(source);
  if (!flint.handled) return { ok: true, source, flint: null };
  if (!flint.ok) return { ok: false, error: flint.error };
  return { ok: true, source: flint.text, flint };
}

export async function validateAndPrepareChartPatch({
  currentState,
  proposedDiagramSource,
  reason,
  env = process.env
}) {
  if (typeof proposedDiagramSource !== 'string') {
    return { accepted: false, error: 'Chart DSL must be a string of JSON.' };
  }

  const authored = resolveAuthoredSource(proposedDiagramSource, env);
  if (!authored.ok) {
    return { accepted: false, error: authored.error };
  }

  const parsed = parseChartDsl(authored.source);
  if (!parsed.ok) {
    return { accepted: false, error: parsed.error };
  }

  const compileError = compileSpec(parsed.dsl.spec);
  if (compileError) {
    return {
      accepted: false,
      error: `Vega-Lite compile() rejected the spec: ${compileError}`
    };
  }

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource: parsed.text,
    styleConfig: null,
    contentType: 'chart',
    reason: reason || 'Agent update'
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: authored.flint ? 'chart-flint-vega-lite-compile' : 'chart-vega-lite-compile',
      theme: parsed.dsl.theme,
      warnings: authored.flint?.warnings ?? [],
      ...(authored.flint ? { authoring: 'flint', flintChartType: authored.flint.chartType } : {})
    }
  };
}

export function validateChartStrict(source, env = process.env) {
  if (typeof source !== 'string') {
    return { valid: false, error: 'Chart DSL must be a string.', validator: 'chart-type' };
  }
  const authored = resolveAuthoredSource(source, env);
  if (!authored.ok) {
    return { valid: false, error: authored.error, validator: 'chart-flint' };
  }
  const parsed = parseChartDsl(authored.source);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error, validator: 'chart-zod' };
  }
  const compileError = compileSpec(parsed.dsl.spec);
  if (compileError) {
    return {
      valid: false,
      error: `Vega-Lite compile() rejected the spec: ${compileError}`,
      validator: 'chart-vega-lite-compile'
    };
  }
  return {
    valid: true,
    diagramSource: parsed.text,
    theme: parsed.dsl.theme,
    validator: 'chart-vega-lite-compile'
  };
}
