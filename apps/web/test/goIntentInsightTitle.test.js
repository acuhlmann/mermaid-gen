import { describe, expect, it } from 'vitest';
import { goIntentInsightTitle, selectionFocusFragment } from '../src/utils/goIntentInsightTitle.js';

describe('goIntentInsightTitle', () => {
  it('quotes the prompt for diagram-wide Go', () => {
    expect(goIntentInsightTitle('add auth service', null)).toBe("Go 'add auth service'");
  });

  it('truncates very long prompts', () => {
    const long = 'a'.repeat(80);
    const title = goIntentInsightTitle(long, null);
    expect(title.startsWith("Go '")).toBe(true);
    expect(title.endsWith("…'")).toBe(true);
    expect(title.length).toBeLessThan(90);
  });

  it('appends focus suffix when a node is selected', () => {
    expect(
      goIntentInsightTitle('rename gateway', {
        kind: 'node',
        id: 'n1',
        label: 'API Gateway'
      })
    ).toBe("Go 'rename gateway' · node “API Gateway”");
  });

  it('falls back to diagram label when prompt is empty', () => {
    expect(goIntentInsightTitle('', null)).toBe('Go — diagram');
    expect(goIntentInsightTitle('  ', null)).toBe('Go — diagram');
  });

  it('prefixes delegate name for office Do-it titles', () => {
    expect(
      goIntentInsightTitle('Merge Discovery and Research nodes', null, null, {
        delegateName: 'Gilfoyle'
      })
    ).toBe("Gilfoyle · Go 'Merge Discovery and Research nodes'");
  });
});

describe('selectionFocusFragment', () => {
  it('formats edges', () => {
    expect(
      selectionFocusFragment({
        kind: 'edge',
        edgeFrom: 'A',
        edgeTo: 'B'
      })
    ).toBe('edge A → B');
  });
});
