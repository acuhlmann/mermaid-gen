import { describe, expect, it } from 'vitest';
import {
  buildPlanPreviewReuseByBeatIndex,
  normalizePlanPreviewSource,
  planPreviewIdentityKey
} from '../src/utils/planPreviewDedupe.js';

const MERMAID = `flowchart LR
  Auth --> API
  API --> DB`;

describe('planPreviewDedupe', () => {
  it('normalizes whitespace and JSON key order for identity', () => {
    expect(normalizePlanPreviewSource('a\r\nb\n\n\nc')).toBe('a\nb\n\nc');
    expect(normalizePlanPreviewSource('{"b":1,"a":2}')).toBe('{"b":1,"a":2}');
    expect(planPreviewIdentityKey({ kind: 'mermaid', source: `${MERMAID}\n` })).toBe(
      planPreviewIdentityKey({ kind: 'mermaid', source: MERMAID })
    );
  });

  it('maps later identical plan-beat previews back to the first beat index', () => {
    const beats = [
      {
        text: `Using the Mermaid diagram as subject context for this view.\n\n${MERMAID}`,
        source: 'server'
      },
      { text: 'Polishing the diagram for clarity.', source: 'server' },
      {
        text: `Current Mermaid subject:\n\n\`\`\`mermaid\n${MERMAID}\n\`\`\``,
        source: 'agent'
      }
    ];

    const reuse = buildPlanPreviewReuseByBeatIndex(beats);
    expect([...reuse.entries()]).toEqual([[2, 0]]);
  });

  it('does not reuse when diagram kinds differ', () => {
    const beats = [
      { text: `Mermaid context:\n\n${MERMAID}`, source: 'server' },
      {
        text: `infographic sequential-process\ntitle Different\n`,
        source: 'server'
      }
    ];
    expect(buildPlanPreviewReuseByBeatIndex(beats).size).toBe(0);
  });
});
