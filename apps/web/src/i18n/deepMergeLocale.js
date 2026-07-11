/**
 * Deep-merge locale overrides onto the English base bundle.
 * Arrays and primitives from `override` replace the base value.
 */
export function deepMergeLocale(base, override) {
  if (!override) return base;
  if (override === null || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const baseVal = base?.[key];
    const bothObjects =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal);
    out[key] = bothObjects ? deepMergeLocale(baseVal, value) : value;
  }
  return out;
}
