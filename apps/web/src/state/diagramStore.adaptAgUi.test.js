import { describe, it, expect } from 'vitest';
import { createAgUiTranslator } from './diagramStore.js';

function runThrough(events) {
  const translate = createAgUiTranslator();
  return events.map((e) => translate(e));
}

describe('createAgUiTranslator', () => {
  it('translates STEP_STARTED into a legacy phase event', () => {
    const [out] = runThrough([{ type: 'STEP_STARTED', stepName: 'planning' }]);
    expect(out).toEqual({ type: 'phase', id: 'planning', label: 'planning' });
  });

  it('translates TEXT_MESSAGE_CONTENT into a legacy token event and drops start/end', () => {
    const out = runThrough([
      { type: 'TEXT_MESSAGE_START', messageId: 'm1', role: 'assistant' },
      { type: 'TEXT_MESSAGE_CONTENT', messageId: 'm1', delta: 'hello' },
      { type: 'TEXT_MESSAGE_END', messageId: 'm1' }
    ]);
    expect(out[0]).toBeNull();
    expect(out[1]).toEqual({ type: 'token', text: 'hello' });
    expect(out[2]).toBeNull();
  });

  it('caches STATE_SNAPSHOT into the next RUN_FINISHED as a legacy final event', () => {
    const out = runThrough([
      { type: 'STATE_SNAPSHOT', snapshot: { revisionId: 9 } },
      {
        type: 'RUN_FINISHED',
        threadId: 't',
        runId: 'r',
        result: { revisionChanged: true, message: 'done' }
      }
    ]);
    expect(out[0]).toBeNull();
    expect(out[1]).toEqual({
      type: 'final',
      revisionChanged: true,
      message: 'done',
      state: { revisionId: 9 }
    });
  });

  it('translates STATE_DELTA into a patch_summary artifact when the summary op is present', () => {
    const [out] = runThrough([
      {
        type: 'STATE_DELTA',
        delta: [
          { op: 'replace', path: '/infographic/revisionId', value: 3 },
          {
            op: 'add',
            path: '/lastPatchSummary',
            value: { revisionId: 3, linesAdded: 4, linesRemoved: 2 }
          }
        ]
      }
    ]);
    expect(out).toEqual({
      type: 'artifact',
      kind: 'patch_summary',
      revisionId: 3,
      linesAdded: 4,
      linesRemoved: 2
    });
  });

  it('translates a STATE_DELTA replace on /<contentType>/draftSource into a draftPreview event', () => {
    const [out] = runThrough([
      {
        type: 'STATE_DELTA',
        delta: [{ op: 'replace', path: '/infographic/draftSource', value: '# Title' }]
      }
    ]);
    expect(out).toEqual({
      type: 'draftPreview',
      contentType: 'infographic',
      source: '# Title',
      delta: ''
    });
  });

  it('translates a STATE_DELTA remove on /<contentType>/draftSource into a clearing draftPreview event', () => {
    const [out] = runThrough([
      {
        type: 'STATE_DELTA',
        delta: [{ op: 'remove', path: '/mermaid/draftSource' }]
      }
    ]);
    expect(out).toEqual({
      type: 'draftPreview',
      contentType: 'mermaid',
      source: '',
      delta: ''
    });
  });

  it('translates RUN_ERROR into a legacy error event', () => {
    const [out] = runThrough([{ type: 'RUN_ERROR', message: 'boom' }]);
    expect(out).toEqual({ type: 'error', message: 'boom' });
  });

  it('CUSTOM(status) becomes legacy status', () => {
    const [out] = runThrough([{ type: 'CUSTOM', name: 'status', value: { text: 'Still working…' } }]);
    expect(out).toEqual({ type: 'status', text: 'Still working…' });
  });

  it('TOOL_CALL_START/END translate to legacy tool_start/tool_end', () => {
    const out = runThrough([
      { type: 'TOOL_CALL_START', toolCallId: 't1', toolCallName: 'apply_infographic_patch' },
      { type: 'TOOL_CALL_END', toolCallId: 't1' }
    ]);
    expect(out[0]).toEqual({ type: 'tool_start', name: 'apply_infographic_patch' });
    expect(out[1]).toEqual({ type: 'tool_end', name: '' });
  });

  it('passes legacy events through unchanged (mixed-protocol streams)', () => {
    const [out] = runThrough([{ type: 'phase', id: 'analyze', label: 'Analyzing…' }]);
    expect(out).toEqual({ type: 'phase', id: 'analyze', label: 'Analyzing…' });
  });

  it('RUN_STARTED emits a synthetic phase so the UI shows immediate activity', () => {
    const [out] = runThrough([{ type: 'RUN_STARTED', threadId: 't', runId: 'r' }]);
    expect(out?.type).toBe('phase');
    expect(out?.id).toBe('run_started');
  });
});
