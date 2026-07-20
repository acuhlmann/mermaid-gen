/** Render a forms-mode field value for the next-form prompt (booleans, arrays, blanks). */
export function formatFormAnswer(value) {
  if (value == null || value === '') return '(left blank)';
  if (typeof value === 'boolean') return value ? 'checked' : 'unchecked';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none selected)';
  return `"${String(value).slice(0, 120)}"`;
}
