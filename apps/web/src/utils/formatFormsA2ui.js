import { parseFormsA2ui } from '@archislop/shared';

/** Pretty-print a forms A2UI JSON document for the Monaco editor. */
export function formatFormsA2uiForEditor(source) {
  if (typeof source !== 'string' || !source.trim()) return source ?? '';
  const parsed = parseFormsA2ui(source);
  if (!parsed.ok) return source;
  return parsed.text;
}
