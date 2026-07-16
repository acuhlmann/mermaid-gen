/**
 * Serialize a thinking-panel explain entry back to markdown for dumb-down requests.
 * Prefer structured explainSections when present — that is what the UI renders.
 *
 * @param {{ content?: string, explainSections?: { preamble?: string, sections?: { heading: string, body?: string }[] } }} entry
 */
export function explainEntryMarkdown(entry) {
  const es = entry?.explainSections;
  const sections = Array.isArray(es?.sections) ? es.sections : [];
  if (sections.length > 0) {
    const lines = [];
    if (typeof es?.preamble === 'string' && es.preamble.trim()) {
      lines.push(es.preamble.trim(), '');
    }
    for (const section of sections) {
      const heading = typeof section?.heading === 'string' ? section.heading.trim() : '';
      if (!heading) continue;
      lines.push(`## ${heading}`, '');
      const body = typeof section?.body === 'string' ? section.body.trim() : '';
      if (body) lines.push(body, '');
    }
    const structured = lines.join('\n').trim();
    if (structured) return structured;
  }

  const fromContent = typeof entry?.content === 'string' ? entry.content.trim() : '';
  return fromContent;
}
