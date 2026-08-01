import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Completion chimes are dispatched by string variant → unbound play* fn.
 * A missing import surfaces as a Subscriber ReferenceError mid-stream (the
 * Dinesh refine path), so pin the binding at the source rather than waiting
 * for an AudioContext mock.
 */
const source = readFileSync(
  fileURLToPath(new URL('../src/features/ceremony/useRunCeremony.js', import.meta.url)),
  'utf8'
);

// `[^}]+` (not `[\s\S]*?`) so an earlier `import { … } from 'react'` cannot
// swallow the agentChimes block and leave the first chime name mangled.
const importBlock = source.match(/import \{([^}]+)\} from ['"][^'"]*agentChimes\.js['"]/);
const imported = new Set(
  (importBlock?.[1] ?? '')
    .split(',')
    .map((part) =>
      part
        .trim()
        .split(/\s+as\s+/)[0]
        .trim()
    )
    .filter(Boolean)
);

describe('useRunCeremony agentChimes bindings', () => {
  it('imports every play* fn passed to tryAgentSound', () => {
    const used = [...source.matchAll(/tryAgentSound\((\w+)\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      // playCompletionChime is imported as playCompletionChimeTone
      const binding = name === 'playCompletionChimeTone' ? 'playCompletionChime' : name;
      expect(imported.has(binding), `${name} used but not imported from agentChimes`).toBe(true);
    }
  });
});
