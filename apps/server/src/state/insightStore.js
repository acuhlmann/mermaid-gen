/**
 * Ring buffer of attributed insights per session (Thinking pane parity for MCP).
 */
export function createInsightStore({ maxItems = 100 } = {}) {
  /** @type {Array<Record<string, unknown>>} */
  const items = [];

  function append(insight) {
    const row = { ...insight };
    items.push(row);
    while (items.length > maxItems) {
      items.shift();
    }
    return row;
  }

  function list({ limit = 50, variant } = {}) {
    let out = [...items].reverse();
    if (variant) {
      out = out.filter((row) => row.variant === variant);
    }
    return out.slice(0, limit);
  }

  return { append, list };
}
