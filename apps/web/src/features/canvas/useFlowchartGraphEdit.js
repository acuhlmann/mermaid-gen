import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyUserDiagramEdit } from '../../state/diagramStore.js';
import { pushError } from '../../state/errorToastStore.js';
import { logicalIdFromDiagramSelection } from '../../utils/mermaidSourceLocate.js';
import {
  addLinkedFlowchartNode,
  connectFlowchartNodes,
  deleteFlowchartEdge,
  deleteFlowchartNode,
  isFlowchartFamilySource,
  renameFlowchartEdge,
  renameFlowchartNode
} from '../../utils/mermaidFlowchartEdit.js';

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
  return logicalIdFromDiagramSelection(descriptor);
}

/**
 * Flowchart Connect / Delete / Rename on the mermaid canvas.
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

  const enabled =
    contentMode === 'mermaid' && isFlowchartFamilySource(stateRef.current?.diagramSource);
  const kind = selectionKind(selectedNode);

  const graphEdit = useMemo(
    () => ({
      enabled: enabled && kind !== 'cluster',
      kind,
      busy: Boolean(busy)
    }),
    [busy, enabled, kind]
  );

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
          contentType: 'mermaid',
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
    [activeSessionId, copy.failed, copy.stale, setState, showUndoToast, stateRef]
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
        setLabelSession({
          kind: 'edge',
          fromId: descriptor.edgeFrom,
          toId: descriptor.edgeTo,
          draft: descriptor.label || '',
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
      const source = stateRef.current.diagramSource;
      const result = addLinkedFlowchartNode(source, fromId);
      if (!result.ok) {
        pushError(copy.failed);
        return;
      }
      void commitSource(result.source, 'Connect node', { toast: copy.linked }).then((applied) => {
        if (!applied) return;
        setSelectedNode?.({
          dataId: result.newId,
          partName: result.newId,
          partKind: 'node'
        });
        setLabelSession({
          kind: 'node',
          logicalId: result.newId,
          draft: result.newId,
          created: true
        });
      });
    },
    [commitSource, copy.failed, copy.linked, setSelectedNode, stateRef]
  );

  const handleGraphEditAction = useCallback(
    (action, descriptor) => {
      if (busy || !enabled) return;
      const target = descriptor || selectedNode;
      if (!target) return;
      if (action.id === 'connect') {
        const logicalId = nodeLogicalId(target);
        if (!logicalId) return;
        closeRadialMenu?.();
        if (action.linkMode) {
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
        const source = stateRef.current.diagramSource;
        const result =
          selectionKind(target) === 'edge'
            ? deleteFlowchartEdge(source, target.edgeFrom, target.edgeTo)
            : deleteFlowchartNode(source, nodeLogicalId(target));
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
      stateRef
    ]
  );

  const handleConnectTarget = useCallback(
    (target) => {
      if (!connectFrom || busy) return;
      const fromId = nodeLogicalId(connectFrom);
      if (!fromId) {
        cancelConnect();
        return;
      }
      if (target?.type === 'source') {
        cancelConnect();
        return;
      }
      const source = stateRef.current.diagramSource;
      if (target?.type === 'node') {
        const toId = target.logicalId || nodeLogicalId(target.descriptor);
        if (!toId || toId === fromId) {
          cancelConnect();
          return;
        }
        const result = connectFlowchartNodes(source, fromId, toId);
        cancelConnect();
        if (!result.ok) {
          if (result.reason !== 'duplicate' && result.reason !== 'self') {
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
      stateRef
    ]
  );

  const handleLabelCommit = useCallback(
    (nextDraft) => {
      const session = labelSession;
      setLabelSession(null);
      if (!session) return;
      const source = stateRef.current.diagramSource;
      const label = String(nextDraft ?? '').trim();
      if (session.created && !label) return;
      const result =
        session.kind === 'edge'
          ? renameFlowchartEdge(source, session.fromId, session.toId, label)
          : renameFlowchartNode(source, session.logicalId, label);
      if (!result.ok) {
        pushError(copy.failed);
        return;
      }
      if (result.source === source) return;
      // Rename is a discrete apply but must not recapture undo — Cmd/Z and the
      // Connect/Delete toast still revert the last structural edit.
      void commitSource(result.source, 'Rename', { captureUndo: false });
    },
    [commitSource, copy.failed, labelSession, stateRef]
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
