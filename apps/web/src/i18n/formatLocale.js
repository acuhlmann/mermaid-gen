/** Replace `{key}` placeholders in localized UI strings. */
export function formatLocale(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}
