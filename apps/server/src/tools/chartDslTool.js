import { compile } from 'vega-lite';
import { DiagramPatchSchema, parseChartDsl } from '@archislop/shared';
import { compileFlintChartWrapper } from './chartFlintAuthoring.js';

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
 * Compile a Flint-sourced wrapper (see chartFlintAuthoring.js) to the stored shape before
 * the Vega-Lite ladder runs. Anything that is not a Flint wrapper passes through unchanged.
 */
function resolveAuthoredSource(source, previousSource) {
  const flint = compileFlintChartWrapper(source, { previousSource });
  if (!flint.handled) return { ok: true, source, flint: null };
  if (!flint.ok) return { ok: false, error: flint.error };
  return { ok: true, source: flint.text, flint: flint.droppedFlint ? null : flint };
}

export async function validateAndPrepareChartPatch({
  currentState,
  proposedDiagramSource,
  reason
}) {
  if (typeof proposedDiagramSource !== 'string') {
    return { accepted: false, error: 'Chart DSL must be a string of JSON.' };
  }

  const authored = resolveAuthoredSource(proposedDiagramSource, currentState?.diagramSource);
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

export function validateChartStrict(source) {
  if (typeof source !== 'string') {
    return { valid: false, error: 'Chart DSL must be a string.', validator: 'chart-type' };
  }
  const authored = resolveAuthoredSource(source, null);
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
