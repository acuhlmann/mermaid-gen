/**
 * Split critique markdown around an "## Actionable …" section and extract bullet / numbered items.
 * Heading must be a level-2 markdown heading (`##`), not `###`.
 */
export function splitCritiqueActionableSections(markdown) {
  if (markdown == null || typeof markdown !== 'string') {
    return { prefix: '', items: [], suffix: '', hasSection: false, headingText: '' };
  }

  const lines = markdown.split('\n');
  let actionableStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (/^##\s+/.test(t) && !/^###/.test(raw) && /actionable|improvement/i.test(t)) {
      actionableStart = i;
      break;
    }
  }

  if (actionableStart < 0) {
    return { prefix: markdown, items: [], suffix: '', hasSection: false, headingText: '' };
  }

  let end = lines.length;
  for (let j = actionableStart + 1; j < lines.length; j++) {
    const raw = lines[j];
    const t = raw.trim();
    if (/^##\s+/.test(t) && !/^###/.test(raw)) {
      end = j;
      break;
    }
  }

  const prefix = lines.slice(0, actionableStart).join('\n');
  const sectionLines = lines.slice(actionableStart + 1, end);
  const items = [];

  for (const rawLine of sectionLines) {
    const t = rawLine.trim();
    if (!t) continue;

    const ordered = t.match(/^(\d+)\.\s+(.+)$/);
    if (ordered) {
      items.push(ordered[2].trim());
      continue;
    }

    const bullet =
      t.startsWith('- ') ||
      t.startsWith('• ') ||
      (t.startsWith('•') && t.length > 1 && /\s/.test(t[1]));
    if (bullet) {
      const inner = t.startsWith('- ')
        ? t.slice(2)
        : t.startsWith('• ')
          ? t.slice(2)
          : t.replace(/^•\s*/, '');
      items.push(inner.trim());
    }
  }

  const suffix = lines.slice(end).join('\n');
  const headingText = lines[actionableStart].trim().replace(/^##\s+/, '');

  return {
    prefix,
    items,
    suffix,
    hasSection: true,
    headingText
  };
}
