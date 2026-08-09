import { describe, expect, it } from 'vitest';
import {
  BOARD_MAX_LABELS,
  BOARD_MAX_MINI_NODES,
  boardFrom
} from '../src/utils/officeFloorBoard.js';

const FLOWCHART = `flowchart LR
  client[Client] --> gw[API Gateway]
  gw --> auth[Auth Service]
  gw --> orders[Orders]
`;

describe('boardFrom — the empty board', () => {
  it('is null for an empty slot, so the room keeps its own furniture', () => {
    expect(boardFrom({ contentType: 'mermaid', diagramSource: '' })).toBeNull();
    expect(boardFrom({ contentType: 'mermaid', diagramSource: '   \n  ' })).toBeNull();
    expect(boardFrom()).toBeNull();
  });

  it('is null — not an empty-but-truthy board — for a header with no nodes', () => {
    expect(boardFrom({ contentType: 'mermaid', diagramSource: 'flowchart LR\n' })).toBeNull();
  });

  it('is null for a content type the room has no shape for', () => {
    expect(boardFrom({ contentType: 'nonsense', diagramSource: 'anything at all' })).toBeNull();
  });
});

describe('boardFrom — mermaid', () => {
  it('counts nodes and distinct edges, and reads labels out of the shape brackets', () => {
    const board = boardFrom({ contentType: 'mermaid', diagramSource: FLOWCHART });
    expect(board).not.toBeNull();
    expect(board.shape).toBe('graph');
    expect(board.nodes).toBe(4);
    // Three edge *lines*, each filed under both endpoints — counted once.
    expect(board.edges).toBe(3);
    expect(board.labels).toEqual(['Client', 'API Gateway', 'Auth Service', 'Orders']);
  });

  it('labels nodes defined mid-line, which is where most of them are defined', () => {
    // The collectors this module counts with anchor their definition regex to
    // the start of a line, so `gw` here has no `explicitDef` at all.
    const board = boardFrom({
      contentType: 'mermaid',
      diagramSource: 'flowchart LR\n  client[Client] --> gw[API Gateway]'
    });
    expect(board.labels).toEqual(['Client', 'API Gateway']);
  });

  it('balances brackets, so a label may contain the other kind', () => {
    const board = boardFrom({
      contentType: 'mermaid',
      diagramSource: 'flowchart TD\n  a[Auth (v2)] --> b((Round))\n  b --> c{Decision?}'
    });
    expect(board.labels).toEqual(['Auth (v2)', 'Round', 'Decision?']);
  });

  it('does not mistake an arrow for a shape opener', () => {
    const board = boardFrom({
      contentType: 'mermaid',
      diagramSource: 'flowchart LR\n  a -->|yes| b\n  a -.-> c'
    });
    expect(board.labels).toEqual(['a', 'b', 'c']);
  });

  it('falls back to the id when a node was never given a label', () => {
    const board = boardFrom({ contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B\n' });
    expect(board.labels).toEqual(['A', 'B']);
    expect(board.nodes).toBe(2);
  });

  it('reads a sequence diagram through the `as` alias', () => {
    const board = boardFrom({
      contentType: 'mermaid',
      diagramSource: [
        'sequenceDiagram',
        '  participant a as Alice',
        '  participant b as Bob',
        '  a->>b: hello'
      ].join('\n')
    });
    expect(board.labels).toEqual(['Alice', 'Bob']);
    expect(board.edges).toBe(1);
  });

  it('reads a state diagram label from `state "..." as id`', () => {
    const board = boardFrom({
      contentType: 'mermaid',
      diagramSource: [
        'stateDiagram-v2',
        '  state "Waiting for approval" as waiting',
        '  waiting --> done'
      ].join('\n')
    });
    expect(board.labels).toContain('Waiting for approval');
  });

  it('caps labels but not the node count — the count is what the art scales on', () => {
    const lines = ['flowchart TD'];
    for (let i = 0; i < 20; i += 1) lines.push(`  n${i}[Node ${i}] --> n${i + 1}[Node ${i + 1}]`);
    const board = boardFrom({ contentType: 'mermaid', diagramSource: lines.join('\n') });
    expect(board.labels).toHaveLength(BOARD_MAX_LABELS);
    expect(board.nodes).toBeGreaterThan(BOARD_MAX_LABELS);
  });
});

describe('boardFrom — the other slots', () => {
  it('reads infographic labels straight out of the DSL text', () => {
    const board = boardFrom({
      contentType: 'infographic',
      diagramSource: [
        'infographic list-row-simple-horizontal-arrow',
        'data',
        '  items',
        '    - label Discover',
        '      icon mingcute/search-line',
        '    - label Build',
        '    - label Ship'
      ].join('\n')
    });
    expect(board.shape).toBe('list');
    expect(board.labels).toEqual(['Discover', 'Build', 'Ship']);
    expect(board.nodes).toBe(3);
    expect(board.edges).toBe(0);
  });

  it('reads a chart through the advisor extractor it shares with the office prompts', () => {
    const board = boardFrom({
      contentType: 'chart',
      diagramSource: JSON.stringify({
        archislopVersion: 1,
        theme: 'whiteboard',
        spec: {
          title: 'Latency by region',
          data: { values: [{ region: 'emea', ms: 12 }] },
          mark: 'bar',
          encoding: { x: { field: 'region' }, y: { field: 'ms' } }
        }
      })
    });
    expect(board.shape).toBe('list');
    expect(board.labels).toContain('Latency by region');
  });

  it('is null when a slot has source but nothing readable in it', () => {
    expect(boardFrom({ contentType: 'chart', diagramSource: 'not json' })).toBeNull();
    expect(
      boardFrom({ contentType: 'infographic', diagramSource: 'infographic thing\ndata\n' })
    ).toBeNull();
  });
});

describe('boardFrom — what the art gets', () => {
  it('emits SCREEN_LOOKS-shaped bars, all inside the screen face', () => {
    const board = boardFrom({ contentType: 'mermaid', diagramSource: FLOWCHART });
    expect(board.bars.length).toBeGreaterThan(0);
    for (const bar of board.bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.w).toBeLessThanOrEqual(1);
      expect(bar.y + bar.h).toBeLessThanOrEqual(1);
      expect(bar.c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('keeps the whiteboard miniature inside the panel and under its cap', () => {
    const lines = ['flowchart TD'];
    for (let i = 0; i < 12; i += 1) lines.push(`  n${i} --> n${i + 1}`);
    const board = boardFrom({ contentType: 'mermaid', diagramSource: lines.join('\n') });
    expect(board.mini.nodes.length).toBeLessThanOrEqual(BOARD_MAX_MINI_NODES);
    for (const box of board.mini.nodes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.w).toBeLessThanOrEqual(1);
      expect(box.y + box.h).toBeLessThanOrEqual(1);
      expect(box.w).toBeGreaterThan(0);
      expect(box.h).toBeGreaterThan(0);
    }
    for (const [from, to] of board.mini.edges) {
      expect(board.mini.nodes[from]).toBeDefined();
      expect(board.mini.nodes[to]).toBeDefined();
    }
  });

  it('draws no connectors for a shape that has no topology', () => {
    const board = boardFrom({
      contentType: 'infographic',
      diagramSource: 'infographic x\ndata\n  items\n    - label One\n    - label Two'
    });
    expect(board.mini.edges).toEqual([]);
  });

  it('grows the drawing as the diagram grows', () => {
    const small = boardFrom({ contentType: 'mermaid', diagramSource: 'flowchart TD\n  A --> B' });
    const big = boardFrom({ contentType: 'mermaid', diagramSource: FLOWCHART });
    expect(big.mini.nodes.length).toBeGreaterThan(small.mini.nodes.length);
    expect(big.bars.length).toBeGreaterThanOrEqual(small.bars.length);
  });
});
