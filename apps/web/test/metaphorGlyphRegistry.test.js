import { describe, expect, it } from 'vitest';
import { METAPHOR_GLYPH_KINDS } from '@archislop/shared';
import { GLYPH_REGISTRY } from '../src/components/metaphorGlyphs/registry.js';

describe('metaphor glyph registry', () => {
  it('registers exactly the glyph kinds defined in the DSL schema', () => {
    const schemaKinds = [...METAPHOR_GLYPH_KINDS].sort();
    const registeredKinds = Object.keys(GLYPH_REGISTRY).sort();
    expect(registeredKinds).toEqual(schemaKinds);
  });

  it('every registered entry is a renderable component', () => {
    for (const [kind, component] of Object.entries(GLYPH_REGISTRY)) {
      expect(typeof component, `glyph ${kind}`).toBe('function');
    }
  });
});
