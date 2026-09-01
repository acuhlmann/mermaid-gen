import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyUserDiagramEdit } from '../../state/diagramStore.js';
import { pushError } from '../../state/errorToastStore.js';
import { graphEditAdapterFor, graphEditIdFromDescriptor } from '../../utils/canvasGraphEdit.js';
import {
  parseFlowchartEdgeDataId,
  parseSequenceMessageDataId
} from '../../utils/diagramSvgSelection.js';

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function selectionKind(descriptor) {
  if (!descriptor) return null;
  if (descriptor.kind === 'cluster') return 'cluster';
  if (descriptor.kind === 'edge') return 'edge';
  return 'node';
}

function nodeLogicalId(descriptor) {
  if (!descriptor || selectionKind(descriptor) !== 'node') return null;
  return graphEditIdFromDescriptor(descriptor);
}

function flowchartEdgeDisambiguation(descriptor) {
  if (!descriptor || descriptor.kind !== 'edge') return {};
  const flowParsed = descriptor.id ? parseFlowchartEdgeDataId(descriptor.id) : null;
  const sequenceParsed = descriptor.id ? parseSequenceMessageDataId(descriptor.id) : null;
  return {
    edgeLabel: descriptor.label,
    edgeIndex: flowParsed?.index,
    messageId: sequenceParsed?.messageId
  };
}

function nextSelection(adapter, result) {
  if (adapter.contentType === 'infographic') {
    return {
      kind: 'infographic-item',
      dataId: result.newId,
      indexes: result.newId,
      partName: result.newLabel || result.newId,
      partKind: 'item',
      label: result.newLabel || result.newId
    };
  }
  if (adapter.contentType === 'metaphor3d') {
    let metaphor = 'tree';
    if (typeof result.metaphorKind === 'string') {
      metaphor = result.metaphorKind;
    } else {
      try {
        metaphor = JSON.parse(result.source)?.metaphor ?? 'tree';
      } catch {
        /* keep default */
      }
    }
    return {
      kind: 'metaphor-item',
      id: `metaphor3d-${result.newId}`,
      dataId: result.newId,
      partName: result.newLabel || result.newId,
      label: result.newLabel || result.newId,
      metaphor
    };
  }
  if (adapter.contentType === 'chart') {
    return {
      kind: 'chart-mark',
      indexes: result.newId,
      elementType: 'mark',
      label: result.newLabel || result.newId,
      partName: result.newLabel || result.newId,
      partKind: 'mark'
    };
  }
  return {
    dataId: result.newId,
    partName: result.newLabel || result.newId,
    partKind: 'node'
  };
}

/**
 * Canvas Connect / Delete / Rename. Flowchart mermaid plus infographic tree/relation.
 */
export function useFlowchartGraphEdit({
  activeSessionId,
  busy,
  closeRadialMenu,
  contentMode,
  controls,
  selectedNode,
  setSelectedNode,
  setState,
  stateRef,
  toolbarAnchor
}) {
  const [connectFrom, setConnectFrom] = useState(null);
  const [labelSession, setLabelSession] = useState(null);
  const [undoToast, setUndoToast] = useState(null);
  const undoRef = useRef(null);
  const toastTimerRef = useRef(null);
  const copy = controls.graphEdit;
  const source = stateRef.current?.diagramSource;
  const adapter = graphEditAdapterFor(contentMode, source);
  const enabled = Boolean(adapter);
  const kind = selectionKind(selectedNode);

  const graphEdit = useMemo(() => {
    const hasTarget = kind === 'edge' || Boolean(graphEditIdFromDescriptor(selectedNode));
    return {
      enabled: enabled && kind !== 'cluster' && hasTarget,
      kind,
      busy: Boolean(busy),
      canLink: Boolean(adapter?.canLink)
    };
  }, [adapter, busy, enabled, kind, selectedNode]);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const showUndoToast = useCallback(
    (message) => {
      clearToastTimer();
      setUndoToast({ message });
      toastTimerRef.current = window.setTimeout(() => {
        toastTimerRef.current = null;
        setUndoToast(null);
      }, 6000);
    },
    [clearToastTimer]
  );

  const cancelConnect = useCallback(() => {
    setConnectFrom(null);
  }, []);

  const cancelLabel = useCallback(() => {
    setLabelSession(null);
  }, []);

  const commitSource = useCallback(
    async (nextSource, reason, { toast, captureUndo = true } = {}) => {
      const previous = stateRef.current;
      try {
        const payload = await applyUserDiagramEdit({
          contentType: adapter?.contentType ?? contentMode ?? 'mermaid',
          diagramSource: nextSource,
          previousRevisionId: previous.revisionId,
          reason,
          sessionId: activeSessionId
        });
        const nextState = payload.state;
        setState(nextState);
        stateRef.current = nextState;
        if (captureUndo) {
          undoRef.current = { source: previous.diagramSource };
        }
        if (toast) showUndoToast(toast);
        return nextState;
      } catch (err) {
        if (err?.code === 'stale_revision') {
          pushError(copy.stale);
        } else {
          pushError(copy.failed);
        }
        return null;
      }
    },
    [
      activeSessionId,
      adapter,
      contentMode,
      copy.failed,
      copy.stale,
      setState,
      showUndoToast,
      stateRef
    ]
  );

  const undoLast = useCallback(async () => {
    const snapshot = undoRef.current;
    if (!snapshot?.source) return;
    undoRef.current = null;
    clearToastTimer();
    setUndoToast(null);
    await commitSource(snapshot.source, 'Undo', { captureUndo: false });
  }, [clearToastTimer, commitSource]);

  const openRename = useCallback(
    (descriptor, extra = {}) => {
      const kindNow = selectionKind(descriptor);
      if (kindNow === 'edge') {
        const { edgeIndex, messageId } = flowchartEdgeDisambiguation(descriptor);
        setLabelSession({
          kind: 'edge',
          fromId: descriptor.edgeFrom,
          toId: descriptor.edgeTo,
          draft: descriptor.label || '',
          edgeLabel: descriptor.label || '',
          ...(descriptor.id ? { id: descriptor.id } : {}),
          ...(edgeIndex != null ? { edgeIndex } : {}),
          ...(messageId != null ? { messageId } : {}),
          x: extra.x ?? toolbarAnchor?.left ?? 0,
          y: extra.y ?? toolbarAnchor?.nodeTop ?? 0
        });
        return;
      }
      const logicalId = extra.logicalId || nodeLogicalId(descriptor);
      if (!logicalId) return;
      setLabelSession({
        kind: 'node',
        logicalId,
        draft: extra.draft ?? descriptor.partName ?? descriptor.label ?? logicalId,
        x: extra.x ?? toolbarAnchor?.left ?? 0,
        y: extra.y ?? toolbarAnchor?.nodeTop ?? 0
      });
    },
    [toolbarAnchor]
  );

  const birthLinkedNode = useCallback(
    (fromId) => {
      if (!adapter) return;
      const current = stateRef.current.diagramSource;
      const result = adapter.addLinked(current, fromId);
      if (!result.ok) {
        pushError(copy.failed);
        return;
      }
      void commitSource(result.source, 'Connect node', { toast: copy.linked }).then((applied) => {
        if (!applied) return;
        setSelectedNode?.(nextSelection(adapter, result));
        setLabelSession({
          kind: 'node',
          logicalId: result.newId,
          draft: result.newLabel || result.newId,
          created: true
        });
      });
    },
    [adapter, commitSource, copy.failed, copy.linked, setSelectedNode, stateRef]
  );

  const handleGraphEditAction = useCallback(
    (action, descriptor) => {
      if (busy || !enabled) return;
      const target = descriptor || selectedNode;
      if (!target) return;
      if (action.id === 'connect' || action.id === 'link') {
        const logicalId = nodeLogicalId(target);
        if (!logicalId) return;
        closeRadialMenu?.();
        const linkMode = (action.id === 'link' || action.linkMode) && adapter?.canLink;
        if (linkMode) {
          if (connectFrom && nodeLogicalId(connectFrom) === logicalId) {
            cancelConnect();
            return;
          }
          setConnectFrom(target);
          return;
        }
        birthLinkedNode(logicalId);
        return;
      }
      if (action.id === 'delete') {
        closeRadialMenu?.();
        const current = stateRef.current.diagramSource;
        const { edgeLabel, edgeIndex, messageId } = flowchartEdgeDisambiguation(target);
        const result =
          selectionKind(target) === 'edge'
            ? adapter.deleteEdge(
                current,
                target.edgeFrom,
                target.edgeTo,
                edgeLabel,
                edgeIndex ?? messageId
              )
            : adapter.deleteNode(current, nodeLogicalId(target));
        if (!result.ok) {
          if (result.reason !== 'duplicate' && result.reason !== 'self') {
            pushError(copy.failed);
          }
          return;
        }
        void commitSource(result.source, 'Delete', { toast: copy.deleted }).then((applied) => {
          if (applied) setSelectedNode(null);
        });
        return;
      }
      if (action.id === 'rename') {
        closeRadialMenu?.();
        openRename(target);
      }
    },
    [
      birthLinkedNode,
      busy,
      cancelConnect,
      closeRadialMenu,
      commitSource,
      connectFrom,
      copy.deleted,
      copy.failed,
      enabled,
      openRename,
      selectedNode,
      setSelectedNode,
      stateRef,
      adapter
    ]
  );

  const handleConnectTarget = useCallback(
    (target) => {
      if (!connectFrom || busy || !adapter) return;
      const fromId = nodeLogicalId(connectFrom);
      if (!fromId) {
        cancelConnect();
        return;
      }
      if (target?.type === 'source') {
        cancelConnect();
        return;
      }
      const current = stateRef.current.diagramSource;
      if (target?.type === 'node') {
        const toId = target.logicalId || nodeLogicalId(target.descriptor);
        if (!toId || toId === fromId) {
          cancelConnect();
          return;
        }
        const result = adapter.connect(current, fromId, toId);
        cancelConnect();
        if (!result.ok) {
          if (
            result.reason !== 'duplicate' &&
            result.reason !== 'self' &&
            result.reason !== 'no-link'
          ) {
            pushError(copy.failed);
          }
          return;
        }
        void commitSource(result.source, 'Connect node', { toast: copy.linked });
        return;
      }
      if (target?.type === 'empty') {
        cancelConnect();
        birthLinkedNode(fromId);
      }
    },
    [
      birthLinkedNode,
      busy,
      cancelConnect,
      commitSource,
      connectFrom,
      copy.failed,
      copy.linked,
      stateRef,
      adapter
    ]
  );

  const handleLabelCommit = useCallback(
    (nextDraft) => {
      const session = labelSession;
      setLabelSession(null);
      if (!session) return;
      if (!adapter) return;
      const current = stateRef.current.diagramSource;
      const label = String(nextDraft ?? '').trim();
      if (session.created && !label) return;
      const result =
        session.kind === 'edge'
          ? adapter.renameEdge(current, session.fromId, session.toId, label, {
              edgeLabel: session.edgeLabel,
              edgeIndex: session.edgeIndex,
              messageLabel: session.edgeLabel,
              messageId: session.messageId ?? session.edgeIndex
            })
          : adapter.renameNode(current, session.logicalId, label);
      if (!result.ok) {
        pushError(copy.failed);
        return;
      }
      if (result.source === current) return;
      // Rename is a discrete apply but must not recapture undo — Cmd/Z and the
      // Connect/Delete toast still revert the last structural edit.
      void commitSource(result.source, 'Rename', { captureUndo: false });
    },
    [adapter, commitSource, copy.failed, labelSession, stateRef]
  );

  useEffect(() => {
    if (busy) {
      setConnectFrom(null);
      setLabelSession(null);
    }
  }, [busy]);

  useEffect(() => {
    function onKey(event) {
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target)) {
        return;
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === 'z' || event.key === 'Z') &&
        !event.shiftKey
      ) {
        if (!undoRef.current?.source) return;
        event.preventDefault();
        void undoLast();
        return;
      }
      if (event.key === 'Escape') {
        if (labelSession) {
          event.preventDefault();
          cancelLabel();
          return;
        }
        if (connectFrom) {
          event.preventDefault();
          cancelConnect();
        }
        return;
      }
      if (busy || !enabled) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNode) {
        if (kind !== 'node' && kind !== 'edge') return;
        event.preventDefault();
        handleGraphEditAction({ id: 'delete' }, selectedNode);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    busy,
    cancelConnect,
    connectFrom,
    cancelLabel,
    labelSession,
    enabled,
    handleGraphEditAction,
    kind,
    selectedNode,
    undoLast
  ]);

  useEffect(() => () => clearToastTimer(), [clearToastTimer]);

  return {
    graphEdit,
    connectSourceId: connectFrom ? nodeLogicalId(connectFrom) : null,
    connectHint: connectFrom ? copy.connectHint : null,
    handleConnectTarget,
    handleGraphEditAction,
    labelSession,
    handleLabelCommit,
    cancelLabel,
    undoToast,
    undoLast,
    dismissUndoToast: () => {
      clearToastTimer();
      setUndoToast(null);
    }
  };
}
