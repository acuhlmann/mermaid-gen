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
