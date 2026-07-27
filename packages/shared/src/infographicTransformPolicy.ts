import { parseInfographicTree } from './infographicDiff.js';

const TRANSFORM_MODES = new Set(['gilfoyle', 'erlich', 'goMad', 'barker']);

/** @param {string | null | undefined} template */
export function templateFamilyFromTemplate(template: string | null | undefined) {
  return (template || '').split('-')[0] || '';
}

type TreeCountNode = { children?: TreeCountNode[] };
function countTreeItems(items: TreeCountNode[] | undefined): number {
  let n = 0;
  for (const item of items ?? []) {
    n += 1;
    if (item.children?.length) n += countTreeItems(item.children);
  }
  return n;
}

/**
 * Validate an infographic patch against stakeholder transform semantics.
 *
 * @param {{
 *   transformMode?: string | null,
 *   goMadDepth?: number | null,
 *   beforeSource?: string,
 *   afterSource?: string
 * }} opts
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateInfographicTransformConstraint(opts: {
  transformMode?: string | null;
  goMadDepth?: number | null;
  beforeSource?: string;
  afterSource?: string;
}): { ok: true } | { ok: false; error: string } {
  const mode = opts.transformMode;
  if (!mode || !TRANSFORM_MODES.has(mode)) return { ok: true };

  const before = parseInfographicTree(opts.beforeSource ?? '');
  const after = parseInfographicTree(opts.afterSource ?? '');
  const beforeTemplate = before.template;
  const afterTemplate = after.template;
  const beforeFamily = templateFamilyFromTemplate(beforeTemplate);
  const afterFamily = templateFamilyFromTemplate(afterTemplate);
  const beforeCount = countTreeItems(before.items);
  const afterCount = countTreeItems(after.items);
  const depth = Math.min(12, Math.max(1, Math.trunc(Number(opts.goMadDepth) || 1)));

  if (mode === 'gilfoyle') {
    if (beforeTemplate && afterTemplate && beforeTemplate !== afterTemplate) {
      return {
        ok: false,
        error: `Refine must keep template "${beforeTemplate}" (got "${afterTemplate}"). Polish labels and add at most 2 items in the same data field.`
      };
    }
    if (before.topField && after.topField && before.topField !== after.topField) {
      return {
        ok: false,
        error: `Refine must keep the main data field "${before.topField}" (got "${after.topField}").`
      };
    }
    if (afterCount > beforeCount + 2) {
      return {
        ok: false,
        error: `Refine may add at most 2 items (had ${beforeCount}, now ${afterCount}).`
      };
    }
    return { ok: true };
  }

  if (mode === 'barker') {
    if (beforeTemplate && afterTemplate && beforeTemplate !== afterTemplate) {
      return {
        ok: false,
        error: `Executive simplify must keep template "${beforeTemplate}" (got "${afterTemplate}").`
      };
    }
    if (before.topField && after.topField && before.topField !== after.topField) {
      return {
        ok: false,
        error: `Executive simplify must keep data field "${before.topField}".`
      };
    }
    if (afterCount > 5) {
      return { ok: false, error: `Executive simplify targets 3–5 items (got ${afterCount}).` };
    }
    if (afterCount > beforeCount) {
      return {
        ok: false,
        error: `Executive simplify is subtractive only (had ${beforeCount} items, now ${afterCount}).`
      };
    }
    return { ok: true };
  }

  if (mode === 'erlich') {
    if (afterCount > beforeCount + 4) {
      return {
        ok: false,
        error: `Erlich may add at most 4 items (had ${beforeCount}, now ${afterCount}). Prefer reshaping within the current template first.`
      };
    }
    return { ok: true };
  }

  if (mode === 'goMad') {
    if (depth <= 2) {
      if (beforeTemplate && afterTemplate && beforeTemplate !== afterTemplate) {
        return {
          ok: false,
          error: `Go Mad tier ${depth}: keep template "${beforeTemplate}" — wild labels, icons, and palette only.`
        };
      }
      return { ok: true };
    }
    if (beforeFamily && afterFamily && beforeFamily === afterFamily) {
      return {
        ok: false,
        error: `Go Mad tier ${depth}: switch template family (was "${beforeFamily}", still "${afterFamily}").`
      };
    }
    return { ok: true };
  }

  return { ok: true };
}
