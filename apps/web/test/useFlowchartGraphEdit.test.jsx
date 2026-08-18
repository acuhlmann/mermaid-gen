// @vitest-environment jsdom
import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';
import { useFlowchartGraphEdit } from '../src/features/canvas/useFlowchartGraphEdit.js';

const applyUserDiagramEdit = vi.fn();
const pushError = vi.fn();

vi.mock('../src/state/diagramStore.js', () => ({
  applyUserDiagramEdit: (...args) => applyUserDiagramEdit(...args)
}));

vi.mock('../src/state/errorToastStore.js', () => ({
  pushError: (...args) => pushError(...args)
}));

const FLOW = `flowchart TD
  A[Start] --> B[End]
`;

/** @type {Array<{ unmount: () => void }>} */
const mounted = [];

function mount(overrides = {}) {
  const stateRef = {
    current: {
      diagramSource: overrides.diagramSource ?? FLOW,
      revisionId: overrides.revisionId ?? 3
    }
  };
  const setState = vi.fn((next) => {
    stateRef.current = next;
  });
  const setSelectedNode = vi.fn();
  const closeRadialMenu = vi.fn();
  let revision = stateRef.current.revisionId;
  applyUserDiagramEdit.mockImplementation(async ({ diagramSource }) => {
    revision += 1;
    return { state: { diagramSource, revisionId: revision } };
  });

  const hook = renderHook(
    ({ busy, selectedNode, contentMode }) =>
      useFlowchartGraphEdit({
        activeSessionId: 'sess-1',
        busy,
        closeRadialMenu,
        contentMode,
        controls: CONTROLS_EN,
        selectedNode,
        setSelectedNode,
        setState,
        stateRef,
        toolbarAnchor: { left: 12, nodeTop: 24 }
      }),
    {
      initialProps: {
        busy: false,
        contentMode: 'mermaid',
        selectedNode: { dataId: 'A', partName: 'Start' },
        ...overrides.props
      }
    }
  );
  mounted.push(hook);
  return { ...hook, stateRef, setState, setSelectedNode, closeRadialMenu };
}

describe('useFlowchartGraphEdit', () => {
  beforeEach(() => {
    applyUserDiagramEdit.mockReset();
    pushError.mockReset();
  });

  afterEach(() => {
    while (mounted.length) mounted.pop().unmount();
    cleanup();
  });

  it('adds a linked node immediately from Connect on a canvas descriptor that only has an SVG id', async () => {
    const { result } = mount({
      props: { selectedNode: { id: 'diagram-1-flowchart-A-0', partName: 'Start' } }
    });
    await act(async () => {
      result.current.handleGraphEditAction({ id: 'connect' });
    });
    expect(result.current.connectSourceId).toBeNull();
    expect(result.current.labelSession).toMatchObject({
      kind: 'node',
      logicalId: 'n1',
      created: true
    });
  });

  it('arms link mode when Connect is picked with Shift', () => {
    const { result } = mount({
      props: { selectedNode: { id: 'diagram-1-flowchart-A-0', partName: 'Start' } }
    });
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    expect(result.current.connectSourceId).toBe('A');
  });

  it('arms link mode from the touch Link action', () => {
    const { result } = mount({
      props: { selectedNode: { id: 'diagram-1-flowchart-A-0', partName: 'Start' } }
    });
    act(() => {
      result.current.handleGraphEditAction({ id: 'link' });
    });
    expect(result.current.connectSourceId).toBe('A');
  });

  it('links an existing node and offers Undo', async () => {
    const { result } = mount({
      props: { selectedNode: { dataId: 'B', partName: 'End' } }
    });
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    expect(result.current.connectSourceId).toBe('B');

    await act(async () => {
      result.current.handleConnectTarget({ type: 'node', logicalId: 'A' });
    });

    expect(applyUserDiagramEdit).toHaveBeenCalledTimes(1);
    expect(applyUserDiagramEdit.mock.calls[0][0].reason).toBe('Connect node');
    expect(applyUserDiagramEdit.mock.calls[0][0].diagramSource).toMatch(/B --> A/);
    expect(result.current.connectSourceId).toBeNull();
    expect(result.current.undoToast?.message).toBe(CONTROLS_EN.graphEdit.linked);
  });

  it('treats a duplicate edge as a silent no-op', async () => {
    const { result } = mount();
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    await act(async () => {
      result.current.handleConnectTarget({
        type: 'node',
        logicalId: 'B',
        descriptor: { dataId: 'B' }
      });
    });
    // FLOW already has A --> B; connecting A to B is a duplicate.
    expect(applyUserDiagramEdit).not.toHaveBeenCalled();
    expect(pushError).not.toHaveBeenCalled();
  });

  it('cancels Connect on the source node, Escape, or a second Connect pick', () => {
    const { result } = mount();
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    act(() => {
      result.current.handleConnectTarget({ type: 'source' });
    });
    expect(result.current.connectSourceId).toBeNull();

    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(result.current.connectSourceId).toBeNull();

    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    expect(result.current.connectSourceId).toBeNull();
    expect(applyUserDiagramEdit).not.toHaveBeenCalled();
  });

  it('births a sibling node on empty canvas while in link mode and focuses the label field', async () => {
    const { result } = mount();
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    await act(async () => {
      result.current.handleConnectTarget({ type: 'empty', clientX: 80, clientY: 40 });
    });
    expect(applyUserDiagramEdit).toHaveBeenCalledTimes(1);
    expect(result.current.labelSession).toMatchObject({
      kind: 'node',
      logicalId: 'n1',
      created: true
    });
  });

  it('does not let Rename recapture undo after Connect', async () => {
    const { result, stateRef } = mount();
    const original = stateRef.current.diagramSource;
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect' });
    });
    await act(async () => {
      result.current.handleConnectTarget({ type: 'empty', clientX: 8, clientY: 8 });
    });
    expect(result.current.labelSession?.logicalId).toBe('n1');
    await act(async () => {
      result.current.handleLabelCommit('Review');
    });
    expect(stateRef.current.diagramSource).toMatch(/n1\[Review\]/);
    await act(async () => {
      await result.current.undoLast();
    });
    expect(stateRef.current.diagramSource).toBe(original);
    const callsAfterUndo = applyUserDiagramEdit.mock.calls.length;
    await act(async () => {
      await result.current.undoLast();
    });
    expect(applyUserDiagramEdit.mock.calls.length).toBe(callsAfterUndo);
  });

  it('deletes from the Delete key and restores on Cmd/Z without recapturing', async () => {
    const { result, stateRef } = mount({
      props: { selectedNode: { dataId: 'B', partName: 'End' } }
    });
    const original = stateRef.current.diagramSource;
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Delete' });
    });
    expect(applyUserDiagramEdit).toHaveBeenCalledTimes(1);
    expect(applyUserDiagramEdit.mock.calls[0][0].reason).toBe('Delete');
    expect(stateRef.current.diagramSource).not.toMatch(/B\[End\]/);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true });
    });
    expect(stateRef.current.diagramSource).toBe(original);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'z', metaKey: true });
    });
    expect(applyUserDiagramEdit).toHaveBeenCalledTimes(2);
  });

  it('does not delete while the label field is focused', async () => {
    const { result } = mount();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Delete' });
    });
    expect(applyUserDiagramEdit).not.toHaveBeenCalled();
    expect(result.current.connectSourceId).toBeNull();
    input.remove();
  });

  it('stays off for sequence diagrams', () => {
    const { result } = mount({
      diagramSource: 'sequenceDiagram\n  Alice->>Bob: hi'
    });
    expect(result.current.graphEdit.enabled).toBe(false);
  });

  it('clears Connect when a run starts', () => {
    const { result, rerender } = mount();
    act(() => {
      result.current.handleGraphEditAction({ id: 'connect', linkMode: true });
    });
    expect(result.current.connectSourceId).toBe('A');
    act(() => {
      rerender({
        busy: true,
        contentMode: 'mermaid',
        selectedNode: { dataId: 'A', partName: 'Start' }
      });
    });
    expect(result.current.connectSourceId).toBeNull();
  });

  it('toasts stale_revision without applying', async () => {
    const { result } = mount();
    applyUserDiagramEdit.mockRejectedValueOnce(
      Object.assign(new Error('Diagram changed'), { code: 'stale_revision' })
    );
    await act(async () => {
      result.current.handleGraphEditAction({ id: 'delete' }, { dataId: 'A', partName: 'Start' });
    });
    expect(pushError).toHaveBeenCalledWith(CONTROLS_EN.graphEdit.stale);
  });

  it('adds a child on an infographic hierarchy tree', async () => {
    const tree = `infographic hierarchy-tree-curved-line-rounded-rect-node
data
  root
    label Company
    children
      - label Engineering
`;
    const { result } = mount({
      diagramSource: tree,
      props: {
        contentMode: 'infographic',
        selectedNode: {
          kind: 'infographic-item',
          indexes: '0,0',
          label: 'Engineering',
          partName: 'Engineering'
        }
      }
    });
    expect(result.current.graphEdit.enabled).toBe(true);
    expect(result.current.graphEdit.canLink).toBe(false);
    await act(async () => {
      result.current.handleGraphEditAction({ id: 'connect' });
    });
    expect(applyUserDiagramEdit).toHaveBeenCalledTimes(1);
    expect(applyUserDiagramEdit.mock.calls[0][0].contentType).toBe('infographic');
    expect(applyUserDiagramEdit.mock.calls[0][0].diagramSource).toMatch(/- label Item 1/);
    expect(result.current.labelSession).toMatchObject({
      kind: 'node',
      logicalId: '0,0,0',
      created: true
    });
  });

  it('adds a sibling on an infographic list', async () => {
    const list = `infographic list-row-simple-horizontal-arrow
data
  lists
    - label Acquire
    - label Convert
`;
    const { result } = mount({
      diagramSource: list,
      props: {
        contentMode: 'infographic',
        selectedNode: {
          kind: 'infographic-item',
          indexes: '0',
          label: 'Acquire',
          partName: 'Acquire'
        }
      }
    });
    expect(result.current.graphEdit.enabled).toBe(true);
    expect(result.current.graphEdit.canLink).toBe(false);
    await act(async () => {
      result.current.handleGraphEditAction({ id: 'connect' });
    });
    expect(applyUserDiagramEdit.mock.calls[0][0].contentType).toBe('infographic');
    expect(applyUserDiagramEdit.mock.calls[0][0].diagramSource).toMatch(
      /- label Acquire[\s\S]*- label Item 1/
    );
    expect(result.current.labelSession).toMatchObject({
      kind: 'node',
      logicalId: '1',
      created: true
    });
  });
});
