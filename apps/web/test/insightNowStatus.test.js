import { describe, expect, it } from 'vitest';
import { getUiLocaleBundle } from '../src/i18n/getUiLocaleBundle.js';
import { summarizeInsightNowStatus } from '../src/utils/insightNowStatus.js';

describe('summarizeInsightNowStatus', () => {
  it('keeps short curated statuses verbatim', () => {
    expect(summarizeInsightNowStatus('Working on your request...')).toBe(
      'Working on your request...'
    );
    expect(summarizeInsightNowStatus('Still working…')).toBe('Still working…');
    expect(summarizeInsightNowStatus('Polishing the diagram…')).toBe('Polishing the diagram…');
  });

  it('strips embedded chart JSON and keeps prose', () => {
    const status = `Building the chart now.

\`\`\`json
{
  "archislopVersion": 1,
  "spec": { "mark": "bar", "data": { "values": [{ "a": 1 }] } }
}
\`\`\``;

    expect(summarizeInsightNowStatus(status)).toBe('Building the chart now.');
  });

  it('strips embedded mermaid and keeps prose', () => {
    const status = `Adding an auth gate.

flowchart TD
  User --> Auth
  Auth --> API`;

    expect(summarizeInsightNowStatus(status)).toBe('Adding an auth gate.');
  });

  it('falls back to a phase-aware label when only code remains', () => {
    const status = `{
  "archislopVersion": 1,
  "spec": { "mark": "bar" }
}`;

    expect(
      summarizeInsightNowStatus(status, {
        variant: 'refine',
        phases: [{ id: 'agent_run', label: 'Tools' }]
      })
    ).toBe('Applying diagram patch…');
  });

  it('truncates long prose to a compact status line', () => {
    const long = `Extending the diagram: ${'Describe the full enterprise platform architecture with every service, queue, database, and integration point in exhaustive detail '.repeat(4)}`;
    const out = summarizeInsightNowStatus(long);
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.endsWith('…')).toBe(true);
  });

  it('localizes known English status strings for zh-CN', () => {
    const bundle = getUiLocaleBundle('zh-CN');
    expect(summarizeInsightNowStatus('Still working…', {}, bundle.controls.insights)).toBe(
      '仍在处理…'
    );
    expect(summarizeInsightNowStatus('Thinking…', {}, bundle.controls.insights)).toBe('思考中…');
    expect(
      summarizeInsightNowStatus(
        '{ "archislopVersion": 1 }',
        { variant: 'refine', phases: [{ id: 'agent_run' }] },
        bundle.controls.insights
      )
    ).toBe('正在应用图表补丁…');
  });
});
