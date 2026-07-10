import { describe, expect, it } from 'vitest';
import {
  classifyDiagramStartLine,
  mermaidDslStartIndex,
  splitEmbeddedDiagramDsl,
  stripEmbeddedDslFromThinkingText,
  tryExtractDiagramPreviewFromText
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

  it('splits prose then fenced metaphor 3D JSON DSL (untagged fence)', () => {
    const metaphor = {
      metaphor: 'terrain',
      scene: { theme: 'whiteboard', camera: 'cinematic', title: 'Mushroom Scores' },
      items: [
        { id: 'porcini', label: 'Porcini', elevation: 9, intensity: 4 },
        { id: 'morel', label: 'Morel', elevation: 7, intensity: 3 }
      ],
      links: []
    };
    const text = `Sculpting the terrain now.

\`\`\`
${JSON.stringify(metaphor, null, 2)}
\`\`\``;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('metaphor3d');
    expect(r.prose.trim()).toBe('Sculpting the terrain now.');
    expect(r.dsl).toContain('"metaphor": "terrain"');
    expect(r.dsl).toContain('Mushroom Scores');
  });

  it('splits bare metaphor 3D JSON after prose', () => {
    const metaphor = {
      metaphor: 'city',
      scene: { theme: 'noir', camera: 'orbit' },
      items: [
        { id: 'auth-service', label: 'Auth Service', height: 12, footprint: 3 },
        { id: 'billing', label: 'Billing', height: 8, footprint: 2 }
      ],
      links: [{ from: 'auth-service', to: 'billing' }]
    };
    const text = `Applied patch.\n\n${JSON.stringify(metaphor, null, 2)}`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('metaphor3d');
    expect(r.prose.trim()).toBe('Applied patch.');
    expect(r.dsl).toContain('"metaphor": "city"');
  });

  it('returns null for prose mentioning "metaphor" without JSON', () => {
    const text = 'The "metaphor" we chose is a terrain of scores.\nNothing to render.';
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

  it('splits prose then fenced anything HTML', () => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Photosynthesis</title></head>
<body>
  <h1>Photosynthesis</h1>
  <p>Light reactions convert sunlight into chemical energy.</p>
</body>
</html>`;
    const text = `Building the interactive page.\n\n\`\`\`html\n${html}\n\`\`\``;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('anything');
    expect(r.prose.trim()).toBe('Building the interactive page.');
    expect(r.dsl).toContain('<!DOCTYPE html>');
    expect(r.dsl).toContain('Photosynthesis');
  });

  it('splits bare HTML document after prose', () => {
    const html = `<!DOCTYPE html>
<html><body><main><h1>Calculator</h1><button>Go</button></main></body></html>`;
    const text = `Applied patch.\n\n${html}`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('anything');
    expect(r.prose.trim()).toBe('Applied patch.');
  });

  it('splits a short streaming HTML stub after prose', () => {
    const html = `<!DOCTYPE html>
<html>`;
    const text = `Current HTML document:\n\n\`\`\`html\n${html}`;
    const r = splitEmbeddedDiagramDsl(text);
    expect(r).not.toBeNull();
    expect(r.kind).toBe('anything');
    expect(r.prose.trim()).toBe('Current HTML document:');
    expect(r.dsl).toContain('<!DOCTYPE html>');
  });
});

describe('tryExtractDiagramPreviewFromText', () => {
  it('returns chart preview metadata for bare chart JSON in a plan step', () => {
    const chart = {
      archislopVersion: 1,
      theme: 'blueprint',
      spec: {
        $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
        data: { values: [{ year: 2018, adoptionrate: 10 }] },
        mark: 'bar',
        encoding: {
          x: { field: 'year', type: 'ordinal' },
          y: { field: 'adoptionrate', type: 'quantitative' }
        }
      }
    };
    const preview = tryExtractDiagramPreviewFromText(JSON.stringify(chart));
    expect(preview).not.toBeNull();
    expect(preview.kind).toBe('chart');
    expect(preview.source).toContain('"archislopVersion"');
  });

  it('returns null for plain prose steps', () => {
    expect(
      tryExtractDiagramPreviewFromText('Add a session boundary before the API tier.')
    ).toBeNull();
  });

  it('returns metaphor3d preview metadata for bare metaphor JSON in a plan step', () => {
    const metaphor = {
      metaphor: 'galaxy',
      scene: { theme: 'arcade', camera: 'orbit' },
      items: [{ id: 'core', label: 'Core', magnitude: 8 }]
    };
    const preview = tryExtractDiagramPreviewFromText(JSON.stringify(metaphor));
    expect(preview).not.toBeNull();
    expect(preview.kind).toBe('metaphor3d');
    expect(preview.source).toContain('"metaphor": "galaxy"');
  });

  it('returns anything preview metadata for a short HTML stub in a plan step', () => {
    const preview = tryExtractDiagramPreviewFromText('<!DOCTYPE html>\n<html>');
    expect(preview).not.toBeNull();
    expect(preview.kind).toBe('anything');
    expect(preview.source).toContain('<!DOCTYPE html>');
  });
});

describe('mermaidDslStartIndex', () => {
  it('walks back over init directives', () => {
    const lines = ['%%{init: {"theme":"dark"}}%%', '', 'flowchart LR', '  A --> B'];
    expect(mermaidDslStartIndex(lines, 2)).toBe(0);
  });
});

describe('stripEmbeddedDslFromThinkingText', () => {
  it('removes fenced chart JSON when a live draft preview is shown', () => {
    const chart = {
      archislopVersion: 1,
      theme: 'blueprint',
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
    const text = `Building the chart.\n\n\`\`\`json\n${JSON.stringify(chart, null, 2)}\n\`\`\``;
    const stripped = stripEmbeddedDslFromThinkingText(text, 'chart');
    expect(stripped).toBe('Building the chart.');
  });

  it('removes fenced html when a live draft preview is shown', () => {
    const html = `<!DOCTYPE html><html><body><h1>Hello</h1><p>World</p></body></html>`;
    const text = `Drafting page.\n\n\`\`\`html\n${html}\n\`\`\``;
    const stripped = stripEmbeddedDslFromThinkingText(text, 'anything');
    expect(stripped).toBe('Drafting page.');
  });

  it('removes fenced metaphor JSON when a live draft preview is shown', () => {
    const metaphor = {
      metaphor: 'tree',
      scene: { theme: 'whiteboard', camera: 'orbit' },
      items: [{ id: 'root', label: 'Root', weight: 5 }]
    };
    const text = `Growing the tree.\n\n\`\`\`json\n${JSON.stringify(metaphor, null, 2)}\n\`\`\``;
    const stripped = stripEmbeddedDslFromThinkingText(text, 'metaphor3d');
    expect(stripped).toBe('Growing the tree.');
  });

  it('removes bare metaphor JSON when a live draft preview is shown', () => {
    const metaphor = {
      metaphor: 'layercake',
      scene: { theme: 'blueprint', camera: 'isometric' },
      items: [{ id: 'ui', label: 'UI', thickness: 2 }]
    };
    const text = `Stacking layers.\n\n${JSON.stringify(metaphor)}`;
    const stripped = stripEmbeddedDslFromThinkingText(text, 'metaphor3d');
    expect(stripped).toBe('Stacking layers.');
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
