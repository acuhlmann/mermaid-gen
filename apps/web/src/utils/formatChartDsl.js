import { parseChartDsl } from '@archislop/shared';

/** Pretty-print a chart DSL JSON wrapper for the Monaco editor. */
export function formatChartDslForEditor(source) {
  if (typeof source !== 'string' || !source.trim()) return source ?? '';
  const parsed = parseChartDsl(source);
  if (!parsed.ok) return source;
  try {
    return `${JSON.stringify(parsed.dsl, null, 2)}\n`;
  } catch {
    return source;
  }
}
