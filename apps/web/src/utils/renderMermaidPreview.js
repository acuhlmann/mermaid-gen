import { prepareMermaidForRender, sanitizeMermaid, sanitizeSvgMarkup } from '@archislop/shared';
import mermaid from 'mermaid';
import {
  isMermaidInfrastructureError,
  reloadOnceForStaleViteMermaidDeps
} from './mermaidRenderErrors.js';
import { ARCHISLOP_MERMAID_PREVIEW_INIT } from './mermaidRenderInit.js';

/** @deprecated Use ARCHISLOP_MERMAID_PREVIEW_INIT */
export const MERMAID_PREVIEW_INIT = ARCHISLOP_MERMAID_PREVIEW_INIT;

/**
 * Render Mermaid to SVG. Tries the prepared source first; on parse failure runs the
 * deterministic source sanitizer once and retries (same behavior for canvas + previews).
 *
 * @param {string} diagramId
 * @param {string} source
 * @param {Record<string, unknown>} mermaidInit
 * @returns {Promise<{ svg: string, sanitizerApplied: string[] }>}
 */
export async function renderMermaidSvg(diagramId, source, mermaidInit) {
  const dsl = prepareMermaidForRender((source ?? '').trim());
  if (!dsl) {
    throw new Error('Empty diagram source');
  }

  mermaid.initialize({ ...mermaidInit });

  try {
    const { svg } = await mermaid.render(diagramId, dsl);
    return { svg: sanitizeSvgMarkup(svg), sanitizerApplied: [] };
  } catch (firstError) {
    if (isMermaidInfrastructureError(firstError) && reloadOnceForStaleViteMermaidDeps()) {
      return new Promise(() => {});
    }
    const parseError =
      firstError instanceof Error ? firstError.message : typeof firstError === 'string' ? firstError : '';
    const { sanitized, applied } = sanitizeMermaid(dsl, { parseError });
    if (!applied.length || sanitized === dsl) {
      throw firstError;
    }
    mermaid.initialize({ ...mermaidInit });
    const { svg } = await mermaid.render(diagramId, sanitized);
    return { svg: sanitizeSvgMarkup(svg), sanitizerApplied: applied };
  }
}

/**
 * Render Mermaid to SVG for embedded previews (Insights pane, proposal cards).
 */
export async function renderMermaidPreviewSvg(diagramId, source) {
  return renderMermaidSvg(diagramId, source, ARCHISLOP_MERMAID_PREVIEW_INIT);
}
