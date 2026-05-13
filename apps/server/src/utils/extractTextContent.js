/**
 * Normalize LangChain message content (string | array of parts) into a flat string.
 * Used to read AI/Human/Tool message bodies regardless of whether the provider returned
 * a single string or an array of `{type: 'text', text: '…'}` parts.
 */
export function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  return content == null ? '' : String(content);
}
