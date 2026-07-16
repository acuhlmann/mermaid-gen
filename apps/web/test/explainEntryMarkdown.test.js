import { describe, expect, it } from 'vitest';
import { explainEntryMarkdown } from '../src/utils/explainEntryMarkdown.js';

describe('explainEntryMarkdown', () => {
  it('prefers explainSections when structured sections are shown', () => {
    expect(
      explainEntryMarkdown({
        content: '## Explanation\n\nStale partial content.',
        explainSections: {
          preamble: 'Lead-in.',
          sections: [
            { heading: 'Explanation', body: 'Overview.' },
            { heading: 'Takeaways', body: 'Remember.' }
          ]
        }
      })
    ).toMatch(/Lead-in/);
    expect(
      explainEntryMarkdown({
        content: '## Explanation\n\nStale partial content.',
        explainSections: {
          preamble: 'Lead-in.',
          sections: [
            { heading: 'Explanation', body: 'Overview.' },
            { heading: 'Takeaways', body: 'Remember.' }
          ]
        }
      })
    ).toMatch(/## Takeaways/);
    expect(
      explainEntryMarkdown({
        content: '## Explanation\n\nStale partial content.',
        explainSections: {
          preamble: 'Lead-in.',
          sections: [
            { heading: 'Explanation', body: 'Overview.' },
            { heading: 'Takeaways', body: 'Remember.' }
          ]
        }
      })
    ).not.toMatch(/Stale partial/);
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
