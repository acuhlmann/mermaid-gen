import { describe, expect, it } from 'vitest';
import { buildAutoFixPrompt } from '../src/utils/autoFixPrompt.js';

describe('buildAutoFixPrompt', () => {
  it('builds an Anything-mode runtime repair prompt without echoing the source', () => {
    const prompt = buildAutoFixPrompt({
      contentType: 'anything',
      errorMessage: 'ReferenceError: initWidget is not defined',
      brokenSource: '<!doctype html><html><body>huge document</body></html>'
    });
    expect(prompt).toContain('apply_anything_patch');
    expect(prompt).toContain('ReferenceError: initWidget is not defined');
    expect(prompt).not.toContain('huge document');
    expect(prompt).not.toContain('apply_mermaid_patch');
  });

  it('builds the Mermaid syntax repair prompt with the broken source inline', () => {
    const prompt = buildAutoFixPrompt({
      contentType: 'mermaid',
      errorMessage: 'Parse error on line 2',
      brokenSource: 'flowchart TD\nA-->'
    });
    expect(prompt).toContain('apply_mermaid_patch');
    expect(prompt).toContain('Parse error on line 2');
    expect(prompt).toContain('flowchart TD');
  });
});
