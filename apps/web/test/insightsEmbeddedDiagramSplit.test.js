import { describe, expect, it } from 'vitest';
import {
  classifyDiagramStartLine,
  mermaidDslStartIndex,
  splitEmbeddedDiagramDsl
} from '../src/utils/insightsEmbeddedDiagramSplit.js';

describe('splitEmbeddedDiagramDsl', () => {
  it('splits prose then infographic DSL', () => {
    const text = `Added ritual steps.

infographic sequence-circular-simple

data

title "T"

sequences

label "A"

icon cloud-sad

theme

palette #ff00ff
`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('infographic');
    expect(r.prose.trim()).toBe('Added ritual steps.');
    expect(r.dsl).toContain('infographic sequence-circular-simple');
    expect(r.dsl).toContain('palette #ff00ff');
  });

  it('splits flowchart mermaid after commentary', () => {
    const text = `Here is the diagram.

flowchart LR
  A --> B
  B --> C
`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('mermaid');
    expect(r.prose.trim()).toBe('Here is the diagram.');
    expect(r.dsl).toContain('flowchart LR');
  });

  it('returns null for ordinary prose mentioning graph', () => {
    const text = `The dependency graph is confusing.
We should simplify.`;
    expect(splitEmbeddedDiagramDsl(text)).toBeNull();
  });

  it('returns null for bare graph line without flowchart body', () => {
    const text = `graph TD`;
    expect(splitEmbeddedDiagramDsl(text)).toBeNull();
  });

  it('splits prose then fenced chart JSON DSL', () => {
    const chart = {
      archislopVersion: 1,
      theme: 'blueprint',
      spec: {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        title: 'Blockchain Core Concepts: Significance',
        data: {
          values: [
            { concept: 'Decentralization', score: 9 },
            { concept: 'Immutability', score: 8 }
          ]
        },
        mark: 'bar',
        encoding: {
          x: { field: 'concept', type: 'nominal' },
          y: { field: 'score', type: 'quantitative' }
        }
      }
    };
    const text = `Building the chart now.

\`\`\`json
${JSON.stringify(chart, null, 2)}
\`\`\``;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('chart');
    expect(r.prose.trim()).toBe('Building the chart now.');
    expect(r.dsl).toContain('"archislopVersion"');
    expect(r.dsl).toContain('Blockchain Core Concepts');
  });

  it('splits bare chart JSON after prose', () => {
    const chart = {
      archislopVersion: 1,
      theme: 'whiteboard',
      spec: {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: [{ q: 'Q1', rev: 12 }] },
        mark: 'bar',
        encoding: {
          x: { field: 'q', type: 'ordinal' },
          y: { field: 'rev', type: 'quantitative' }
        }
      }
    };
    const text = `Applied patch.\n\n${JSON.stringify(chart, null, 2)}`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('chart');
    expect(r.prose.trim()).toBe('Applied patch.');
  });

  it('includes leading %%{init}%% directive in mermaid dsl', () => {
    const init = '%%{init: {"theme":"base","flowchart":{"curve":"rounded"}}}%%';
    const text = `${init}
flowchart TB
  A --> B
  B --> C
`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('mermaid');
    expect(r.dsl.startsWith('%%{init:')).toBe(true);
    expect(r.dsl).toContain('flowchart TB');
    expect(r.dsl).toContain('A --> B');
  });
});

describe('mermaidDslStartIndex', () => {
  it('walks back over init directives', () => {
    const lines = [
      '%%{init: {"theme":"dark"}}%%',
      '',
      'flowchart LR',
      '  A --> B'
    ];
    expect(mermaidDslStartIndex(lines, 2)).toBe(0);
  });
});

describe('classifyDiagramStartLine', () => {
  it('recognizes infographic template line', () => {
    expect(classifyDiagramStartLine('infographic list-row-simple')).toBe('infographic');
  });

  it('recognizes sequenceDiagram', () => {
    expect(classifyDiagramStartLine('sequenceDiagram')).toBe('mermaid');
  });
});
