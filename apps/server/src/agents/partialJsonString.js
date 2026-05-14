// Extracts the (possibly incomplete) string value of a top-level JSON property
// from a partial JSON args buffer streamed via LangChain tool_call_chunks.
// Designed for the apply_infographic_patch / apply_mermaid_patch case where
// the schema is `{ "diagramSource": "..." }` (single string field).
//
// Returns the unescaped prefix decoded so far. Returns '' until the opening
// quote of the value is present. Stops cleanly on dangling escapes so partial
// chunks don't throw.

export function extractJsonStringPrefix(buffer, key) {
  const needle = `"${key}"`;
  const start = buffer.indexOf(needle);
  if (start < 0) return '';
  let i = start + needle.length;
  while (i < buffer.length && (buffer[i] === ' ' || buffer[i] === '\t' || buffer[i] === '\n' || buffer[i] === ':')) {
    i += 1;
  }
  if (buffer[i] !== '"') return '';
  i += 1;
  let out = '';
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === '"') break;
    if (ch !== '\\') {
      out += ch;
      i += 1;
      continue;
    }
    if (i + 1 >= buffer.length) break; // dangling escape; stop here
    const esc = buffer[i + 1];
    switch (esc) {
      case 'n': out += '\n'; i += 2; break;
      case 't': out += '\t'; i += 2; break;
      case 'r': out += '\r'; i += 2; break;
      case '"': out += '"'; i += 2; break;
      case '\\': out += '\\'; i += 2; break;
      case '/': out += '/'; i += 2; break;
      case 'b': out += '\b'; i += 2; break;
      case 'f': out += '\f'; i += 2; break;
      case 'u': {
        if (i + 5 >= buffer.length) return out; // incomplete unicode
        const hex = buffer.slice(i + 2, i + 6);
        const code = parseInt(hex, 16);
        if (Number.isFinite(code)) out += String.fromCharCode(code);
        i += 6;
        break;
      }
      default:
        out += esc;
        i += 2;
    }
  }
  return out;
}
