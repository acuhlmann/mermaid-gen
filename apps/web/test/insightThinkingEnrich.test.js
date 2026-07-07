import { describe, expect, it } from 'vitest';
import {
  findBalancedBraceEnd,
  parseDiagramPatchToolCall,
  partitionDiagramToolJsonBlocks,
  stripInsightStreamDelimiters
} from '../src/utils/insightThinkingEnrich.js';

describe('stripInsightStreamDelimiters', () => {
  it('removes whole-line _ALLCAPS delimiter noise', () => {
    const raw = 'Hello\n\n_BORDER\n\nWorld';
    expect(stripInsightStreamDelimiters(raw).trim()).toBe('Hello\n\nWorld');
  });

  it('keeps inline underscores', () => {
    expect(stripInsightStreamDelimiters('See _note_ here.')).toBe('See _note_ here.');
  });
});

describe('parseDiagramPatchToolCall', () => {
  it('parses applymermaidpatch-style names', () => {
    const j = JSON.stringify({
      name: 'applymermaidpatch',
      arguments: { diagramSource: 'flowchart TD\n  A --> B', reason: 'x' }
    });
    const p = parseDiagramPatchToolCall(j);
    expect(p?.kind).toBe('mermaid');
    expect(p?.source).toContain('flowchart');
  });

  it('parses snake_case apply_mermaid_patch', () => {
    const j = JSON.stringify({
      name: 'apply_mermaid_patch',
      arguments: { diagramSource: 'graph LR\n  X --> Y' }
    });
    expect(parseDiagramPatchToolCall(j)?.kind).toBe('mermaid');
  });

  it('parses apply_chart_patch', () => {
    const j = JSON.stringify({
      name: 'apply_chart_patch',
      arguments: {
        diagramSource: JSON.stringify({
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
        }),
        reason: 'initial chart'
      }
    });
    const p = parseDiagramPatchToolCall(j);
    expect(p?.kind).toBe('chart');
    expect(p?.source).toContain('"archislopVersion"');
  });

  it('parses apply_metaphor_patch as metaphor3d', () => {
    const j = JSON.stringify({
      name: 'apply_metaphor_patch',
      arguments: {
        diagramSource: JSON.stringify({
          metaphor: 'terrain',
          scene: { theme: 'whiteboard', camera: 'cinematic', title: 'Mushroom Scores' },
          items: [{ id: 'porcini', label: 'Porcini', elevation: 9, intensity: 4 }]
        }),
        reason: 'initial scene'
      }
    });
    const p = parseDiagramPatchToolCall(j);
    expect(p?.kind).toBe('metaphor3d');
    expect(p?.source).toContain('"metaphor"');
  });
});

describe('partitionDiagramToolJsonBlocks', () => {
  it('extracts diagram JSON into a segment and keeps surrounding prose', () => {
    const tool = {
      name: 'apply_mermaid_patch',
      arguments: { diagramSource: 'flowchart TD\n  A --> B', reason: 'go mad' }
    };
    const text = `Intro line\n\n${JSON.stringify(tool)}\n\nOutro`;
    const parts = partitionDiagramToolJsonBlocks(text);
    expect(parts.length).toBe(3);
    expect(parts[0].type).toBe('text');
    expect(parts[1].type).toBe('diagram_patch');
    expect(parts[1].source).toContain('flowchart');
    expect(parts[2].type).toBe('text');
    expect(parts[2].value).toContain('Outro');
  });
});

describe('findBalancedBraceEnd', () => {
  it('respects strings with braces', () => {
    const s = '{"a": "x{y}z", "b": 1}';
    const end = findBalancedBraceEnd(s, 0);
    expect(end).toBe(s.length);
  });
});
