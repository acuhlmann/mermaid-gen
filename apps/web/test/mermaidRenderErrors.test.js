import { describe, expect, it } from 'vitest';
import {
  isMermaidInfrastructureError,
  reloadOnceForStaleViteMermaidDeps
} from '../src/utils/mermaidRenderErrors.js';

describe('isMermaidInfrastructureError', () => {
  it('detects Vite outdated optimize dep failures', () => {
    expect(
      isMermaidInfrastructureError(
        new Error(
          'Failed to fetch dynamically imported module: http://localhost:5173/node_modules/.vite/deps/flowDiagram-I6XJVG4X-BQNydReS.js?v=4a5b92e4'
        )
      )
    ).toBe(true);
  });

  it('ignores ordinary Mermaid parse errors', () => {
    expect(isMermaidInfrastructureError(new Error('Parse error on line 2'))).toBe(false);
  });
});

describe('reloadOnceForStaleViteMermaidDeps', () => {
  it('returns false outside dev', () => {
    expect(reloadOnceForStaleViteMermaidDeps()).toBe(false);
  });
});
