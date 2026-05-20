/**
 * Server-built explain analyze sections (AG-UI CUSTOM artifact `explain_sections`).
 * LLM outputs Markdown ## headings; we parse deterministically — no model-authored UI JSON.
 */

export type ExplainContentType = 'mermaid' | 'infographic';

export type ExplainSection = {
  id: string;
  heading: string;
  body: string;
};

const MERMAID_HEADING_TO_ID: [RegExp, string][] = [
  [/^explanation$/i, 'explanation'],
  [/^main\s+flows?$/i, 'main_flows'],
  [/^key\s+entities$/i, 'key_entities'],
  [/^takeaways?$/i, 'takeaways']
];

const INFOGRAPHIC_HEADING_TO_ID: [RegExp, string][] = [
  [/^explanation$/i, 'explanation'],
  [/^main\s+message$/i, 'main_message'],
  [/^key\s+data\s+points?$/i, 'key_data_points'],
  [/^takeaways?$/i, 'takeaways']
];

function normalizeHeading(line: string): string {
  return line.replace(/^##\s+/, '').trim();
}

function headingToId(heading: string, contentType: ExplainContentType): string {
  const table = contentType === 'infographic' ? INFOGRAPHIC_HEADING_TO_ID : MERMAID_HEADING_TO_ID;
  for (const [re, id] of table) {
    if (re.test(heading)) return id;
  }
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48) || 'section';
}

/**
 * Split analyze markdown into level-2 sections (## only).
 */
export function parseExplainMarkdownSections(
  markdown: string,
  contentType: ExplainContentType = 'mermaid'
): { preamble: string; sections: ExplainSection[] } {
  if (markdown == null || typeof markdown !== 'string') {
    return { preamble: '', sections: [] };
  }

  const lines = markdown.split('\n');
  let firstH2 = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (/^##\s+/.test(t) && !/^###/.test(raw)) {
      firstH2 = i;
      break;
    }
  }

  if (firstH2 < 0) {
    return { preamble: markdown.trim(), sections: [] };
  }

  const preamble = lines.slice(0, firstH2).join('\n').trim();
  const sections: ExplainSection[] = [];
  let i = firstH2;

  while (i < lines.length) {
    const raw = lines[i];
    const t = raw.trim();
    if (!/^##\s+/.test(t) || /^###/.test(raw)) {
      i += 1;
      continue;
    }

    const heading = normalizeHeading(t);
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j];
      const nt = next.trim();
      if (/^##\s+/.test(nt) && !/^###/.test(next)) {
        end = j;
        break;
      }
    }

    const body = lines
      .slice(i + 1, end)
      .join('\n')
      .trim();
    sections.push({
      id: headingToId(heading, contentType),
      heading,
      body
    });
    i = end;
  }

  return { preamble, sections };
}

export type ExplainSectionsArtifact = {
  type: 'artifact';
  kind: 'explain_sections';
  contentType: ExplainContentType;
  preamble: string;
  sections: ExplainSection[];
};

/**
 * Build a stream artifact when explain analyze has at least two ## sections.
 */
export function buildExplainSectionsArtifact(
  analyzeText: string,
  contentType: ExplainContentType = 'mermaid'
): ExplainSectionsArtifact | null {
  const text = typeof analyzeText === 'string' ? analyzeText.trim() : '';
  if (!text) return null;
  const { preamble, sections } = parseExplainMarkdownSections(text, contentType);
  if (sections.length < 2) return null;
  return {
    type: 'artifact',
    kind: 'explain_sections',
    contentType,
    preamble,
    sections
  };
}
