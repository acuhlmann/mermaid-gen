// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InsightsPane from '../src/components/InsightsPane.jsx';
import { splitCritiqueActionableSections } from '@archislop/shared';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

describe('InsightsPane', () => {
  it('renders rich content and technical action lane', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-1',
            title: 'Go - diagram',
            status: 'running',
            statusText: 'Working on your request...',
            content: '### Recommended edits\n- **Rename** _Prototype Ideas_',
            technicalActions: [
              { id: 't1', name: 'get_diagram_state', label: 'Read diagram snapshot', status: 'done' }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Content updates')).toBeTruthy();
    expect(screen.getByText('Technical actions')).toBeTruthy();
    expect(screen.getByText('Read diagram snapshot')).toBeTruthy();
    expect(screen.getByText('Working')).toBeTruthy();
    expect(screen.getByText('Now')).toBeTruthy();
    expect(screen.getByText('Working on your request...')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('shows persona attribution for variant runs', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-persona',
            title: 'Refine - diagram',
            variant: 'refine',
            status: 'running',
            statusText: 'Working on your request...',
            content: '',
            technicalActions: [],
            phases: [{ id: 'invoke', label: 'Generate' }],
            startedAt: Date.now() - 65_000
          }
        ]}
        streakByVariant={{ refine: 3 }}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByTestId('insights-pane-persona')).toBeTruthy();
    const entryPersona = screen.getByTestId('insights-entry-persona');
    expect(within(entryPersona).getByText('THE Engineer')).toBeTruthy();
    expect(within(entryPersona).getByText(/Builder of useful next steps/)).toBeTruthy();
    const liveMeta = screen.getByTestId('insights-pane-live-meta');
    expect(within(liveMeta).getByText('Refine')).toBeTruthy();
    expect(within(liveMeta).getByText('🔥 ×3')).toBeTruthy();
    expect(within(liveMeta).getByText('Phase 1')).toBeTruthy();
  });

  it('shows the diagram mode, brain, and start time on each run entry', () => {
    const fixedTime = new Date('2024-04-05T09:07:00').getTime();
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-meta',
            title: 'Refine - diagram',
            variant: 'refine',
            status: 'running',
            statusText: 'Working on your request...',
            content: '',
            technicalActions: [],
            contentType: 'infographic',
            modelProfile: 'quality',
            startedAt: fixedTime
          },
          {
            id: 'entry-meta-3d',
            title: 'Go — 3D',
            variant: 'goMad',
            status: 'running',
            statusText: 'Working…',
            content: '',
            technicalActions: [],
            contentType: 'metaphor3d',
            modelProfile: 'fast',
            startedAt: fixedTime
          },
          {
            id: 'entry-meta-chart',
            title: 'Go — chart',
            variant: 'goMad',
            status: 'running',
            statusText: 'Working…',
            content: '',
            technicalActions: [],
            contentType: 'chart',
            modelProfile: 'fast',
            startedAt: fixedTime
          }
        ]}
        celebratingEntryId={null}
      />
    );

    const metas = screen.getAllByLabelText('Run details');
    expect(within(metas[0]).getByText('Infographic')).toBeTruthy();
    expect(within(metas[0]).getByText('Quality')).toBeTruthy();
    expect(within(metas[1]).getByText('3D')).toBeTruthy();
    expect(within(metas[2]).getByText('Chart')).toBeTruthy();
    const timeEl = metas[0].querySelector('time');
    expect(timeEl).toBeTruthy();
    expect(timeEl.dateTime).toBe(new Date(fixedTime).toISOString());
    expect(timeEl.textContent.trim().length).toBeGreaterThan(0);
  });

  it('shows done state in the thinking pane', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-1',
            title: 'Refine - diagram',
            variant: 'refine',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: []
          }
        ]}
        celebratingEntryId="entry-1"
      />
    );

    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByText('Thinking')).toBeTruthy();
    expect(screen.queryByTestId('insights-pane-persona')).toBeNull();
    expect(screen.queryByTestId('insights-tagline')).toBeNull();
  });

  it('shows Restore when entry has an after-snapshot and invokes handler', () => {
    const onRestoreToEntry = vi.fn();
    const baseline = { revisionId: 0, diagramSource: 'flowchart TD\n  A --> B' };

    render(
      <InsightsPane
        entries={[
          {
            id: 'e-undo',
            title: 'Refine — diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: [],
            diagramUndoBaseline: baseline,
            diagramRevisionApplied: true,
            diagramUndoConsumed: false,
            diagramAfterSource: 'flowchart TD\n  A --> C',
            diagramAfterContentType: 'mermaid'
          }
        ]}
        celebratingEntryId={null}
        onRestoreToEntry={onRestoreToEntry}
        diagramUndoDisabled={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Highlight on canvas' })).toBeTruthy();
    const restoreBtn = screen.getByRole('button', { name: 'Restore' });
    expect(restoreBtn.disabled).toBe(false);
    fireEvent.click(restoreBtn);
    expect(onRestoreToEntry).toHaveBeenCalledWith('e-undo');
  });

  it('invokes highlight toggle when Highlight on canvas is clicked', () => {
    const onToggleDiagramChangeHighlight = vi.fn();
    const baseline = { revisionId: 0, diagramSource: 'flowchart TD\n  A --> B' };

    render(
      <InsightsPane
        entries={[
          {
            id: 'e-hi',
            title: 'Refine — diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: [],
            diagramUndoBaseline: baseline,
            diagramRevisionApplied: true,
            diagramUndoConsumed: false,
            diagramAfterSource: 'flowchart TD\n  A --> C',
            diagramAfterContentType: 'mermaid'
          }
        ]}
        celebratingEntryId={null}
        onRestoreToEntry={vi.fn()}
        diagramUndoDisabled={false}
        onToggleDiagramChangeHighlight={onToggleDiagramChangeHighlight}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Highlight on canvas' }));
    expect(onToggleDiagramChangeHighlight).toHaveBeenCalledWith('e-hi');
  });

  it('shows Clear canvas highlights and empty-diff note when highlight is active for entry', () => {
    const baseline = { revisionId: 0, diagramSource: 'flowchart TD\n  A --> B' };

    render(
      <InsightsPane
        entries={[
          {
            id: 'e-act',
            title: 'Refine — diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: [],
            diagramUndoBaseline: baseline,
            diagramRevisionApplied: true,
            diagramUndoConsumed: false,
            diagramAfterSource: 'flowchart TD\n  A --> B',
            diagramAfterContentType: 'mermaid'
          }
        ]}
        celebratingEntryId={null}
        onRestoreToEntry={vi.fn()}
        diagramChangeHighlightEntryId="e-act"
        diagramChangeHighlightSummary={{ removedIds: [], isStructuralEmpty: true }}
        onToggleDiagramChangeHighlight={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Clear canvas highlights' })).toBeTruthy();
    expect(
      screen.getByText(/No structural changes detected between this version and the diagram before this step/i)
    ).toBeTruthy();
  });

  it('shows removed ids note when highlight is active and nodes were removed', () => {
    const baseline = { revisionId: 0, diagramSource: 'flowchart TD\n  A --> B' };

    render(
      <InsightsPane
        entries={[
          {
            id: 'e-rem',
            title: 'Refine — diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Applied.',
            technicalActions: [],
            diagramUndoBaseline: baseline,
            diagramRevisionApplied: true,
            diagramUndoConsumed: false,
            diagramAfterSource: 'flowchart TD\n  A',
            diagramAfterContentType: 'mermaid'
          }
        ]}
        celebratingEntryId={null}
        onRestoreToEntry={vi.fn()}
        diagramChangeHighlightEntryId="e-rem"
        diagramChangeHighlightSummary={{ removedIds: ['OldNode'], isStructuralEmpty: false }}
        onToggleDiagramChangeHighlight={vi.fn()}
      />
    );

    expect(screen.getByText(/Removed from diagram: OldNode/i)).toBeTruthy();
  });

  it('shows Restore on external attributed-note embedded mermaid preview', () => {
    const onRestoreDiagramSnapshot = vi.fn();
    const init = '%%{init: {"theme":"base"}}%%';
    const diagram = `${init}
flowchart TB
  A --> B
  B --> C`;

    render(
      <InsightsPane
        entries={[
          {
            id: 'ext-note-1',
            kind: 'attributed-note',
            variant: 'general',
            status: 'done',
            content: diagram,
            origin: { kind: 'external-agent', agentName: 'Cursor', color: '#f97316' }
          }
        ]}
        celebratingEntryId={null}
        onRestoreDiagramSnapshot={onRestoreDiagramSnapshot}
        diagramUndoDisabled={false}
      />
    );

    const restoreBtn = screen.getByRole('button', { name: 'Restore' });
    fireEvent.click(restoreBtn);
    expect(onRestoreDiagramSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'mermaid',
        diagramSource: expect.stringContaining('%%{init:')
      })
    );
  });

  it('hides Restore when there is no after-snapshot to bookmark', () => {
    const baseline = { revisionId: 0, diagramSource: 'x' };

    render(
      <InsightsPane
        entries={[
          {
            id: 'e1',
            title: 'Refine',
            status: 'done',
            content: '',
            technicalActions: [],
            diagramUndoBaseline: baseline,
            diagramRevisionApplied: false,
            diagramUndoConsumed: false
          }
        ]}
        celebratingEntryId={null}
      />
    );
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
  });

  it('disables Restore when diagramUndoDisabled', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-dis',
            title: 'Refine',
            status: 'done',
            content: '',
            technicalActions: [],
            diagramUndoBaseline: { diagramSource: 'a' },
            diagramRevisionApplied: true,
            diagramUndoConsumed: false,
            diagramAfterSource: 'flowchart TD\n  A --> B',
            diagramAfterContentType: 'mermaid'
          }
        ]}
        celebratingEntryId={null}
        diagramUndoDisabled
        onRestoreToEntry={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Restore' }).disabled).toBe(true);
  });

  it('shows Plan lane for diagram intent beats', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-plan',
            title: 'Refine',
            variant: 'refine',
            status: 'running',
            statusText: 'Polishing the diagram…',
            content: '',
            technicalActions: [],
            phases: [{ id: 'agent_run', label: 'Tools' }],
            planBeats: [
              { text: 'Scoping the update to node Auth.', source: 'server', at: 1 },
              { text: 'Adding a session boundary before the API tier.', source: 'agent', at: 2 }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );
    expect(screen.getByRole('region', { name: 'Diagram intent' })).toBeTruthy();
    expect(screen.getByText('Adding a session boundary before the API tier.')).toBeTruthy();
  });

  it('summarizes code-heavy Now status without showing diagram previews', () => {
    const statusText = `Drafting the chart.

\`\`\`json
{
  "archislopVersion": 1,
  "spec": { "mark": "bar", "data": { "values": [{ "category": "A", "value": 1 }] } }
}
\`\`\``;

    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-now',
            title: 'Go — chart',
            variant: 'goMad',
            status: 'running',
            statusText,
            content: '',
            technicalActions: [],
            phases: [{ id: 'agent_run', label: 'Tools' }],
            contentType: 'chart'
          }
        ]}
        celebratingEntryId={null}
      />
    );

    const strip = screen.getByText('Now').closest('.insights-status-strip');
    expect(strip).toBeTruthy();
    expect(within(strip).getByText('Drafting the chart.')).toBeTruthy();
    expect(within(strip).queryByText(/archislopVersion/)).toBeNull();
  });

  it('shows agent phases, patch summary, and optional stream debug', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-phases',
            title: 'Go — diagram',
            status: 'running',
            statusText: 'Working…',
            content: '',
            technicalActions: [],
            phases: [
              { id: 'intent', label: 'Applying your request…' },
              { id: 'agent_run', label: 'Planning and executing tools…' }
            ],
            artifacts: [
              { kind: 'patch_summary', revisionId: 7, linesAdded: 3, linesRemoved: 1 }
            ],
            streamDebugLog: [{ type: 'phase', id: 'intent', _ts: 1 }]
          }
        ]}
        celebratingEntryId={null}
        streamDebugEnabled
      />
    );

    expect(screen.getByRole('region', { name: 'Agent phases' })).toBeTruthy();
    expect(screen.getByText('Applying your request…')).toBeTruthy();
    expect(screen.getByText('Live')).toBeTruthy();
    expect(screen.getByText('Working…')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Patch summary' })).toBeTruthy();
    expect(screen.getByText('+3 / −1 lines')).toBeTruthy();
    expect(screen.getByText(/Raw stream events/i)).toBeTruthy();
  });

  it('renders ## critique sections with headings and Analysis label', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-crit',
            title: 'Critique — diagram',
            variant: 'critique',
            status: 'done',
            content: '## Strengths\n\n- Good flow.\n\n## Weaknesses\n\n- Thin labels.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Analysis')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Strengths/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Weaknesses/i })).toBeTruthy();
    expect(screen.getByText(/Good flow/i)).toBeTruthy();
  });

  it('merges orphaned bullet markers with the following line', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-bullet',
            title: 'Critique — diagram',
            variant: 'critique',
            status: 'done',
            content: '## Notes\n\n•\nMerged bullet sentence.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText(/Merged bullet sentence/i)).toBeTruthy();
  });

  it('hides raw phase ids for critique unless stream debug is on', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-phase',
            title: 'Critique — diagram',
            variant: 'critique',
            status: 'done',
            content: '',
            technicalActions: [],
            phases: [
              { id: 'analyze', label: 'Analyzing diagram…' },
              { id: 'analyze_stream', label: 'Streaming analysis…' }
            ]
          }
        ]}
        celebratingEntryId={null}
        streamDebugEnabled={false}
      />
    );

    expect(container.querySelector('code.insights-phase-id')).toBeNull();
    expect(screen.getByText('Analyze')).toBeTruthy();
    expect(screen.getByText('Stream')).toBeTruthy();
  });

  it('shows raw phase ids when stream debug is enabled', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-phase-dbg',
            title: 'Critique — diagram',
            variant: 'critique',
            status: 'done',
            content: '',
            technicalActions: [],
            phases: [{ id: 'analyze', label: 'Analyzing…' }]
          }
        ]}
        celebratingEntryId={null}
        streamDebugEnabled
      />
    );

    expect(container.querySelector('code.insights-phase-id')?.textContent).toBe('analyze');
  });

  it('collapses technical actions behind Tool trace for critique variant', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-tools',
            title: 'Critique — diagram',
            variant: 'critique',
            status: 'done',
            content: '## Summary\n\nDone.',
            technicalActions: [
              { id: 't1', name: 'get_diagram_state', label: 'Read snapshot', status: 'done' }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Tool trace')).toBeTruthy();
    expect(screen.queryByText('Technical actions')).toBeNull();
    expect(screen.getByText('Read snapshot')).toBeTruthy();
  });

  it('renders aggregated apply_mermaid_patch label in technical actions', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-agg',
            title: 'Fix — diagram',
            status: 'done',
            statusText: 'Done',
            content: 'Fixed.',
            technicalActions: [
              {
                id: 't1',
                name: 'apply_mermaid_patch',
                label: 'Apply diagram update (×2)',
                status: 'done',
                count: 2
              }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Apply diagram update (×2)')).toBeTruthy();
    expect(screen.getByText('Technical actions')).toBeTruthy();
  });

  it('uses Explanation label for explain variant', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-exp',
            title: 'Explain — diagram',
            variant: 'explain',
            status: 'done',
            content: 'Plain prose.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Explanation')).toBeTruthy();
  });

  it('renders explain ## sections with tone classes and opener lead', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-exp-rich',
            title: 'Explain — node',
            variant: 'explain',
            status: 'done',
            content:
              'Quick orientation before sections.\n\n## Explanation\nOverview text.\n\n## Main flows\nFlow bullet.\n\n## Key entities\nEntity note.\n\n## Takeaways\nRemember this.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(container.querySelector('.insights-explain-opener')).toBeTruthy();
    expect(screen.getByText(/Quick orientation/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /^Explanation$/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /Main flows/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /Key entities/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: /Takeaways/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: /Explanation/i })).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-explain-overview')).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-explain-flows')).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-explain-entities')).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-explain-takeaways')).toBeTruthy();
  });

  it('renders server-built explain_sections artifact panel when present', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-exp-artifact',
            title: 'Explain — diagram',
            variant: 'explain',
            status: 'done',
            content: '## Explanation\n\nFallback prose.',
            explainSections: {
              contentType: 'mermaid',
              preamble: 'Lead-in from server.',
              sections: [
                { id: 'explanation', heading: 'Explanation', body: 'Overview from artifact.' },
                { id: 'takeaways', heading: 'Takeaways', body: 'Remember artifact.' }
              ]
            },
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(container.querySelector('[data-testid="explain-sections-panel"]')).toBeTruthy();
    expect(screen.getByText(/Lead-in from server/i)).toBeTruthy();
    expect(screen.getByText(/Overview from artifact/i)).toBeTruthy();
    expect(screen.queryByText(/Fallback prose/i)).toBeNull();
  });

  it('collapses technical actions behind Tool trace for explain variant', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-exp-tools',
            title: 'Explain — diagram',
            variant: 'explain',
            status: 'done',
            content: '## Explanation\n\nDone.',
            technicalActions: [
              { id: 't1', name: 'get_diagram_state', label: 'Read snapshot', status: 'done' }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Tool trace')).toBeTruthy();
    expect(screen.queryByText('Technical actions')).toBeNull();
    expect(screen.getByText('Read snapshot')).toBeTruthy();
  });

  it('uses Refinement label, opener, and section cards for refine variant', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-ref',
            title: 'Refine — diagram',
            variant: 'refine',
            status: 'done',
            content: 'Opening paragraph.\n\n## Strengths\n\n- Polished.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Refinement')).toBeTruthy();
    expect(container.querySelector('.insights-refine-opener')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Strengths/i })).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-strengths')).toBeTruthy();
  });

  it('collapses technical actions behind Tool trace for refine variant', () => {
    render(
      <InsightsPane
        entries={[
          {
            id: 'e-ref-tools',
            title: 'Refine — diagram',
            variant: 'refine',
            status: 'done',
            content: '## Summary\n\nDone.',
            technicalActions: [
              { id: 't1', name: 'get_diagram_state', label: 'Read snapshot', status: 'done' }
            ]
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Tool trace')).toBeTruthy();
    expect(screen.queryByText('Technical actions')).toBeNull();
  });

  it('uses Innovation label, opener, and innovate tones for headings', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-inn',
            title: 'Innovate — diagram',
            variant: 'innovate',
            status: 'done',
            content: 'Lead.\n\n## Core ideas\n\n- Stretch.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Innovation')).toBeTruthy();
    expect(container.querySelector('.insights-innovate-opener')).toBeTruthy();
    expect(container.querySelector('.insights-prose-section.insights-tone-innovate-spark')).toBeTruthy();
  });

  it('uses Mad mode label, opener, and cycles goMad section tones', () => {
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'e-mad',
            title: 'Go Mad — diagram',
            variant: 'goMad',
            status: 'done',
            content: 'Wild intro.\n\n## Block one\n\nA.\n\n## Block two\n\nB.\n\n## Block three\n\nC.',
            technicalActions: []
          }
        ]}
        celebratingEntryId={null}
      />
    );

    expect(screen.getByText('Mad mode')).toBeTruthy();
    expect(container.querySelector('.insights-gomad-opener')).toBeTruthy();
    expect(container.querySelector('.insights-tone-gomad-a')).toBeTruthy();
    expect(container.querySelector('.insights-tone-gomad-b')).toBeTruthy();
    expect(container.querySelector('.insights-tone-gomad-c')).toBeTruthy();
  });

  it('renders actionable checkboxes and fix controls when critiqueActionableUi matches entry content', () => {
    const critiqueText = `## Summary\n\n- Note.\n\n## Actionable improvements\n\n- First improvement\n- Second improvement\n`;
    const split = splitCritiqueActionableSections(critiqueText);
    const onFixSelected = vi.fn();
    const onFixAll = vi.fn();

    render(
      <InsightsPane
        entries={[
          {
            id: 'ent-act',
            variant: 'critique',
            status: 'done',
            title: 'Critique — diagram',
            content: critiqueText,
            technicalActions: []
          }
        ]}
        critiqueActionableUi={{
          critiqueText,
          headingText: split.headingText,
          items: split.items,
          prefix: split.prefix,
          suffix: split.suffix,
          a2uiMessages: null,
          busy: false,
          onFixSelected,
          onFixAll
        }}
        celebratingEntryId={null}
      />
    );

    const actionableRegion = screen.getByRole('region', { name: /Actionable/i });
    const scope = within(actionableRegion);
    expect(scope.getAllByRole('checkbox')).toHaveLength(2);
    expect(scope.getByRole('button', { name: 'Fix selected' }).disabled).toBe(true);
    fireEvent.click(scope.getAllByRole('checkbox')[1]);
    fireEvent.click(scope.getByRole('button', { name: 'Fix selected' }));
    fireEvent.click(scope.getByRole('button', { name: 'Fix all' }));
    expect(onFixSelected).toHaveBeenCalledTimes(1);
    expect(onFixAll).toHaveBeenCalledTimes(1);
  });

  it('renders A2UI critique checklist by default', async () => {
    const critiqueText = `## Summary\n\n- Note.\n\n## Actionable improvements\n\n- First improvement\n`;
    const split = splitCritiqueActionableSections(critiqueText);
    const { container } = render(
      <InsightsPane
        entries={[
          {
            id: 'ent-a2ui',
            variant: 'critique',
            status: 'done',
            title: 'Critique — diagram',
            content: critiqueText,
            technicalActions: []
          }
        ]}
        critiqueActionableUi={{
          critiqueText,
          headingText: split.headingText,
          items: split.items,
          prefix: split.prefix,
          suffix: split.suffix,
          a2uiMessages: null,
          busy: false,
          onFixSelected: vi.fn(),
          onFixAll: vi.fn()
        }}
        celebratingEntryId={null}
      />
    );

    expect(container.querySelector('.insights-a2ui-block')).toBeTruthy();
    expect(await screen.findByRole('checkbox', { name: /First improvement/i })).toBeTruthy();
  });

  it('renders markdown tables in thinking content as UI tables', () => {
    const content = `Planning a horizontal bar chart.

| Category | Market Size |
|---|---|
| Enterprise Software | $320B |
| Cloud Services | $290B |

The chart uses the whiteboard theme.`;

    render(
      <InsightsPane
        entries={[
          {
            id: 'entry-table',
            title: 'Go — chart',
            variant: 'goMad',
            status: 'running',
            statusText: 'Working…',
            content,
            technicalActions: [],
            contentType: 'chart'
          }
        ]}
        celebratingEntryId={null}
      />
    );

    const table = screen.getByTestId('thinking-markdown-table');
    expect(within(table).getByText('Enterprise Software')).toBeTruthy();
    expect(within(table).getByText('$320B')).toBeTruthy();
    expect(screen.getByText('Planning a horizontal bar chart.')).toBeTruthy();
    expect(screen.getByText('The chart uses the whiteboard theme.')).toBeTruthy();
  });
});
