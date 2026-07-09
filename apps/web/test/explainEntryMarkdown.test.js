import { describe, expect, it } from 'vitest';
import { explainEntryMarkdown } from '../src/utils/explainEntryMarkdown.js';

describe('explainEntryMarkdown', () => {
  it('prefers entry.content when present', () => {
    expect(
      explainEntryMarkdown({
        content: '## Explanation\n\nFrom content.',
        explainSections: { sections: [{ heading: 'Explanation', body: 'Artifact.' }] }
      })
    ).toBe('## Explanation\n\nFrom content.');
  });

  it('reconstructs markdown from explainSections when content is empty', () => {
    const md = explainEntryMarkdown({
      content: '',
      explainSections: {
        preamble: 'Lead-in.',
        sections: [
          { heading: 'Explanation', body: 'Overview.' },
          { heading: 'Takeaways', body: 'Remember.' }
        ]
      }
    });
    expect(md).toMatch(/Lead-in/);
    expect(md).toMatch(/## Explanation/);
    expect(md).toMatch(/Overview/);
    expect(md).toMatch(/## Takeaways/);
  });
});
