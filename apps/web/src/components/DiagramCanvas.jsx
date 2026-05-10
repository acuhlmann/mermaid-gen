import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import registerMermaidMonacoOnce from '../utils/registerMermaidMonacoOnce.js';
import {
  collectLogicalIdCandidates,
  findMermaidSourceRangeForDiagramSelection
} from '../utils/mermaidSourceLocate.js';
import {
  flowchartEdgeLabelText,
  parseFlowchartEdgeDataId,
  resolveFlowchartEdgeInteractionRoot
} from '../utils/diagramSvgSelection.js';

const MERMAID_INIT = {
  startOnLoad: false,
  deterministicIds: true,
  deterministicIDSeed: 'mermaid-architect'
};
mermaid.initialize({ ...MERMAID_INIT });

const TAP_MOVE_THRESHOLD_PX = 14;

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  return 'Mermaid render failed';
}

function getPointers(map) {
  return Array.from(map.values());
}

function getCentroid(pointers) {
  const total = pointers.reduce(
    (sum, pointer) => ({
      x: sum.x + pointer.x,
      y: sum.y + pointer.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: total.x / pointers.length,
    y: total.y / pointers.length
  };
}

function getDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function StreamingWaveIcon() {
  return (
    <svg className="streaming-wave-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 16h2v-8H3v8zm4 8h2V8H7v16zm4-12h2V4h-2v8zm4 8h2v-4h-2v4zm4-6v10h2V10h-2z"
      />
    </svg>
  );
}

function nodeTitleFromElement(nodeEl) {
  const parts = [];
  nodeEl.querySelectorAll('text').forEach((textEl) => {
    const t = textEl.textContent?.trim();
    if (t) parts.push(t);
  });
  const merged = parts.join(' · ');
  return merged.slice(0, 240);
}

/** Mermaid often sets `id` on a child shape; selection + CSS need a stable element with `id`. */
function diagramDomAnchor(group) {
  if (!group) return null;
  if (group.id) return group;
  const direct = group.querySelector?.(':scope > [id]');
  if (direct?.id) return direct;
  const nested = group.querySelector?.('[id]');
  if (nested?.id) return nested;
  return group;
}

/** Prefer outlining `g.node` / `g.cluster` even when the SVG `id` is on an inner shape. */
function diagramSelectedWrap(root, domId) {
  if (!root || !domId) return null;
  try {
    const hit = root.querySelector(`[id="${CSS.escape(domId)}"]`);
    return hit?.closest?.('g.node') ?? hit?.closest?.('g.cluster') ?? hit;
  } catch {
    return null;
  }
}

/** Match diff ids to SVG (handles flowchart-* suffixes, hyphen splits, case drift). */
function idMatchesHighlightSet(id, set) {
  if (!id || !set?.size) return false;
  if (set.has(id)) return true;
  const lower = id.toLowerCase();
  for (const x of set) {
    if (x.toLowerCase() === lower) return true;
  }
  return false;
}

function changeHighlightCategory(group, anchor, kind, added, modified) {
  const domId = anchor?.id;
  if (!domId) return null;
  const dataId = group.getAttribute?.('data-id') ?? anchor?.getAttribute?.('data-id');
  const candidates = collectLogicalIdCandidates({ elementId: domId, dataId, kind });
  for (const cand of candidates) {
    if (idMatchesHighlightSet(cand, added)) return 'added';
  }
  for (const cand of candidates) {
    if (idMatchesHighlightSet(cand, modified)) return 'modified';
  }
  return null;
}

export default function DiagramCanvas({
  revisionId = 0,
  mermaidSource,
  onManualEdit,
  onValidationChange,
  streamingPreview = false,
  agentThinking = false,
  editorOpen = false,
  insightsOpen = false,
  insightsSlot = null,
  selectedNode = null,
  onSelectedNodeChange,
  onNodeToolbarAnchor,
  changeHighlight = null,
  onDiagramSvgRendered = null
}) {
  const [editorSource, setEditorSource] = useState(mermaidSource);
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const revisionBootRef = useRef(true);
  const lastRevisionRef = useRef(revisionId);
  const prevStreamingRef = useRef(streamingPreview);
  const pulseTimeoutRef = useRef(null);
  const [revisionTransition, setRevisionTransition] = useState(false);
  const lastAppliedSourceRef = useRef(mermaidSource);
  const lastReportedValidationRef = useRef({ source: null, error: null });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ centroid: null, distance: null });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef(null);
  const diagramSurfaceRef = useRef(null);
  const lastToolbarAnchorReportRef = useRef(null);
  const tapCandidateRef = useRef(null);
  const backgroundTapRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const syncDecoIdsRef = useRef([]);
  const lastDiagramSyncKeyRef = useRef('');
  const diagramSyncRafRef = useRef(0);
  const lastSvgRenderedReportRef = useRef('');
  const [monacoBind, setMonacoBind] = useState(null);

  const handleEditorBeforeMount = useCallback((monaco) => {
    registerMermaidMonacoOnce(monaco);
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoBind({ editor, monaco });
  }, []);

  const monacoEditorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: streamingPreview,
      fontSize: 13
    }),
    [streamingPreview]
  );

  const reportValidation = useCallback(
    (source, error) => {
      if (!onValidationChange) return;
      const previous = lastReportedValidationRef.current;
      if (previous.source === source && previous.error === error) {
        return;
      }
      lastReportedValidationRef.current = { source, error };
      onValidationChange({ source, error });
    },
    [onValidationChange]
  );

  useEffect(() => {
    if (mermaidSource === lastAppliedSourceRef.current) {
      return;
    }

    lastAppliedSourceRef.current = mermaidSource;
    setEditorSource(mermaidSource);
  }, [mermaidSource]);

  const fireDiagramRevisionPulse = useCallback(() => {
    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
    }
    setRevisionTransition(true);
    pulseTimeoutRef.current = window.setTimeout(() => {
      pulseTimeoutRef.current = null;
      setRevisionTransition(false);
    }, 480);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (streamingPreview) {
      lastRevisionRef.current = revisionId;
      return undefined;
    }
    if (revisionBootRef.current) {
      revisionBootRef.current = false;
      lastRevisionRef.current = revisionId;
      return undefined;
    }
    if (lastRevisionRef.current === revisionId) {
      return undefined;
    }
    lastRevisionRef.current = revisionId;
    fireDiagramRevisionPulse();
    return undefined;
  }, [revisionId, streamingPreview, fireDiagramRevisionPulse]);

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current;
    prevStreamingRef.current = streamingPreview;
    if (wasStreaming && !streamingPreview) {
      fireDiagramRevisionPulse();
    }
  }, [streamingPreview, fireDiagramRevisionPulse]);

  useEffect(() => {
    let cancelled = false;

    if (streamingPreview) {
      return undefined;
    }

    if (!editorSource.trim()) {
      setSvgMarkup('');
      setRenderError('');
      reportValidation(editorSource, null);
      return undefined;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      async function runRender() {
        try {
          const diagramId = `diagram-${requestId}`;
          mermaid.initialize({ ...MERMAID_INIT });
          const { svg } = await mermaid.render(diagramId, editorSource);
          if (cancelled || requestRef.current !== requestId) {
            return;
          }

          setSvgMarkup(svg);
          setRenderError('');
          reportValidation(editorSource, null);
        } catch (error) {
          if (cancelled || requestRef.current !== requestId) {
            return;
          }
          const message = extractErrorMessage(error);
          setRenderError(message);
          reportValidation(editorSource, message);
        }
      }

      runRender();
    }, 200);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [editorSource, reportValidation, revisionId, streamingPreview]);

  useLayoutEffect(() => {
    if (streamingPreview || !svgMarkup || typeof onDiagramSvgRendered !== 'function') return;
    const reportKey = `${revisionId}:${editorSource}:${svgMarkup.length}`;
    if (reportKey === lastSvgRenderedReportRef.current) return;
    lastSvgRenderedReportRef.current = reportKey;
    onDiagramSvgRendered({ source: editorSource, revisionId });
  }, [editorSource, onDiagramSvgRendered, revisionId, streamingPreview, svgMarkup]);

  useEffect(() => {
    if (!editorOpen) {
      syncDecoIdsRef.current = [];
      editorRef.current = null;
      monacoRef.current = null;
      setMonacoBind(null);
      lastDiagramSyncKeyRef.current = '';
    }
  }, [editorOpen]);

  useLayoutEffect(() => {
    const editor = monacoBind?.editor;
    const monaco = monacoBind?.monaco;
    if (diagramSyncRafRef.current) {
      cancelAnimationFrame(diagramSyncRafRef.current);
      diagramSyncRafRef.current = 0;
    }

    if (!editorOpen || streamingPreview || !editor || !monaco) {
      return undefined;
    }

    if (selectedNode?.kind === 'edge') {
      syncDecoIdsRef.current = editor.deltaDecorations(syncDecoIdsRef.current, []);
      lastDiagramSyncKeyRef.current = '';
      return undefined;
    }

    if (!selectedNode?.id) {
      syncDecoIdsRef.current = editor.deltaDecorations(syncDecoIdsRef.current, []);
      lastDiagramSyncKeyRef.current = '';
      return undefined;
    }

    const kind = selectedNode.kind === 'cluster' ? 'cluster' : 'node';
    const rangePlain = findMermaidSourceRangeForDiagramSelection(editorSource, {
      elementId: selectedNode.id,
      dataId: selectedNode.dataId,
      kind
    });
    if (!rangePlain) {
      syncDecoIdsRef.current = editor.deltaDecorations(syncDecoIdsRef.current, []);
      lastDiagramSyncKeyRef.current = '';
      return undefined;
    }

    const range = new monaco.Range(
      rangePlain.startLineNumber,
      rangePlain.startColumn,
      rangePlain.endLineNumber,
      rangePlain.endColumn
    );

    const syncKey = `${selectedNode.id}:${rangePlain.startLineNumber}:${rangePlain.startColumn}:${rangePlain.endLineNumber}:${rangePlain.endColumn}:${editorSource.length}`;
    if (syncKey === lastDiagramSyncKeyRef.current) {
      return undefined;
    }
    lastDiagramSyncKeyRef.current = syncKey;

    diagramSyncRafRef.current = requestAnimationFrame(() => {
      diagramSyncRafRef.current = 0;
      const ed = editorRef.current;
      const mc = monacoRef.current;
      if (!ed || ed !== editor || !mc) return;
      ed.revealRangeInCenter(range);
      ed.setSelection(range);
      syncDecoIdsRef.current = ed.deltaDecorations(syncDecoIdsRef.current, [
        {
          range,
          options: {
            className: 'mermaid-diagram-sync-highlight'
          }
        }
      ]);
    });

    return () => {
      if (diagramSyncRafRef.current) {
        cancelAnimationFrame(diagramSyncRafRef.current);
        diagramSyncRafRef.current = 0;
      }
    };
  }, [
    editorOpen,
    streamingPreview,
    selectedNode,
    editorSource,
    monacoBind?.editor,
    monacoBind?.monaco
  ]);

  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    const changeClasses = ['is-diagram-change-added', 'is-diagram-change-modified'];
    root.querySelectorAll('g.node, g.cluster').forEach((group) => {
      group.classList.remove(...changeClasses);
    });
    if (!changeHighlight) return;
    const added = new Set(changeHighlight.addedIds ?? []);
    const modified = new Set(changeHighlight.modifiedIds ?? []);
    root.querySelectorAll('g.node, g.cluster').forEach((group) => {
      const anchor = diagramDomAnchor(group);
      if (!anchor?.id) return;
      const kind = group.classList.contains('cluster') ? 'cluster' : 'node';
      const cat = changeHighlightCategory(group, anchor, kind, added, modified);
      if (cat === 'added') {
        group.classList.add('is-diagram-change-added');
      } else if (cat === 'modified') {
        group.classList.add('is-diagram-change-modified');
      }
    });
  }, [svgMarkup, changeHighlight]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    root.querySelectorAll('path.is-diagram-edge-selected').forEach((el) => el.classList.remove('is-diagram-edge-selected'));
    root.querySelectorAll('g.node.is-diagram-selected').forEach((el) => el.classList.remove('is-diagram-selected'));
    root.querySelectorAll('g.cluster.is-diagram-selected').forEach((el) => el.classList.remove('is-diagram-selected'));
    if (!selectedNode?.id) return;
    if (selectedNode.kind === 'edge') {
      try {
        const pathEl = root.querySelector(`path[data-id="${CSS.escape(selectedNode.id)}"]`);
        pathEl?.classList?.add('is-diagram-edge-selected');
      } catch {
        // ignore invalid ids for selector
      }
      return;
    }
    const wrap = diagramSelectedWrap(root, selectedNode.id);
    wrap?.classList?.add('is-diagram-selected');
  }, [svgMarkup, selectedNode]);

  useLayoutEffect(() => {
    if (!onNodeToolbarAnchor) return;
    const root = viewportRef.current;

    function clearToolbarAnchor() {
      if (lastToolbarAnchorReportRef.current !== null) {
        lastToolbarAnchorReportRef.current = null;
        onNodeToolbarAnchor(null);
      }
    }

    if (!selectedNode?.id || !root) {
      clearToolbarAnchor();
      return;
    }
    try {
      let el = null;
      if (selectedNode.kind === 'edge') {
        try {
          el = root.querySelector(`path[data-id="${CSS.escape(selectedNode.id)}"]`);
        } catch {
          el = null;
        }
      } else {
        el = diagramSelectedWrap(root, selectedNode.id);
      }
      if (!el) {
        clearToolbarAnchor();
        return;
      }
      const rect = el.getBoundingClientRect();
      const left = rect.left + rect.width / 2;
      const top = rect.bottom + 10;
      const nodeTop = rect.top;
      const nodeBottom = rect.bottom;
      const prev = lastToolbarAnchorReportRef.current;
      if (
        prev &&
        prev.nodeId === selectedNode.id &&
        Math.abs(prev.left - left) < 0.5 &&
        Math.abs(prev.top - top) < 0.5 &&
        Math.abs(prev.nodeTop - nodeTop) < 0.5 &&
        Math.abs(prev.nodeBottom - nodeBottom) < 0.5
      ) {
        return;
      }
      lastToolbarAnchorReportRef.current = {
        nodeId: selectedNode.id,
        left,
        top,
        nodeTop,
        nodeBottom
      };
      onNodeToolbarAnchor({ left, top, nodeTop, nodeBottom });
    } catch {
      clearToolbarAnchor();
    }
  }, [selectedNode, onNodeToolbarAnchor, svgMarkup, viewport]);

  const displayedRenderError = streamingPreview ? '' : renderError;

  function handleEditorChange(value) {
    // Monaco can fire `onChange` synchronously while React commits a new `value`. During streaming,
    // touching editor state here nests updates under the parent's commit and triggers max-depth errors.
    if (streamingPreview) {
      return;
    }
    const nextValue = value ?? '';
    setEditorSource((prev) => (prev === nextValue ? prev : nextValue));
    lastAppliedSourceRef.current = nextValue;
    if (onManualEdit) {
      onManualEdit(nextValue);
    }
  }

  const zoomAtPoint = useCallback((pointX, pointY, scaleFactor) => {
    setViewport((current) => {
      const nextScale = Math.min(4, Math.max(0.2, current.scale * scaleFactor));
      if (nextScale === current.scale) {
        return current;
      }

      const worldX = (pointX - current.x) / current.scale;
      const worldY = (pointY - current.y) / current.scale;

      return {
        scale: nextScale,
        x: pointX - worldX * nextScale,
        y: pointY - worldY * nextScale
      };
    });
  }, []);

  const handleWheel = useCallback(
    (event) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      zoomAtPoint(pointerX, pointerY, zoomFactor);
    },
    [zoomAtPoint]
  );

  useEffect(() => {
    const el = diagramSurfaceRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const nodeEl = event.target?.closest?.('g.node');
    const clusterEl = nodeEl ? null : event.target?.closest?.('g.cluster');
    const edgeHit = !nodeEl && !clusterEl ? resolveFlowchartEdgeInteractionRoot(event.target) : null;

    event.preventDefault();

    pointersRef.current.set(event.pointerId, {
      x: localX,
      y: localY
    });

    const pointers = getPointers(pointersRef.current);
    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };

    if ((nodeEl || clusterEl) && pointers.length === 1) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: nodeEl || clusterEl,
        kind: nodeEl ? 'node' : 'cluster'
      };
    } else if (edgeHit && pointers.length === 1) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: edgeHit.pathEl,
        kind: 'edge'
      };
    } else {
      tapCandidateRef.current = null;
    }

    if (pointers.length === 1 && !nodeEl && !clusterEl && !edgeHit) {
      backgroundTapRef.current = {
        pointerId: event.pointerId,
        sx: event.clientX,
        sy: event.clientY
      };
    } else {
      backgroundTapRef.current = null;
    }

    setIsPanning(true);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event) {
    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      event.preventDefault();
      const moved = Math.hypot(event.clientX - tap.startClientX, event.clientY - tap.startClientY);
      if (moved <= TAP_MOVE_THRESHOLD_PX) {
        return;
      }
      tapCandidateRef.current = null;
    }

    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();

    const bgTap = backgroundTapRef.current;
    if (bgTap && bgTap.pointerId === event.pointerId) {
      const movedBg = Math.hypot(event.clientX - bgTap.sx, event.clientY - bgTap.sy);
      if (movedBg > TAP_MOVE_THRESHOLD_PX) {
        backgroundTapRef.current = null;
      }
    }

    const rect = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });

    const pointers = getPointers(pointersRef.current);
    const nextCentroid = getCentroid(pointers);
    const previousCentroid = gestureRef.current.centroid ?? nextCentroid;
    const dx = nextCentroid.x - previousCentroid.x;
    const dy = nextCentroid.y - previousCentroid.y;

    if (pointers.length >= 2) {
      const nextDistance = getDistance(pointers[0], pointers[1]);
      const previousDistance = gestureRef.current.distance ?? nextDistance;
      const zoomFactor = previousDistance > 0 ? nextDistance / previousDistance : 1;

      setViewport((current) => {
        const panned = {
          ...current,
          x: current.x + dx,
          y: current.y + dy
        };
        const nextScale = Math.min(4, Math.max(0.2, panned.scale * zoomFactor));
        const worldX = (nextCentroid.x - panned.x) / panned.scale;
        const worldY = (nextCentroid.y - panned.y) / panned.scale;

        return {
          scale: nextScale,
          x: nextCentroid.x - worldX * nextScale,
          y: nextCentroid.y - worldY * nextScale
        };
      });

      gestureRef.current = {
        centroid: nextCentroid,
        distance: nextDistance
      };
      return;
    }

    setViewport((current) => ({
      ...current,
      x: current.x + dx,
      y: current.y + dy
    }));

    gestureRef.current = {
      centroid: nextCentroid,
      distance: null
    };
  }

  function endPointerGesture(event) {
    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      event.preventDefault();
      const moved = Math.hypot(event.clientX - tap.startClientX, event.clientY - tap.startClientY);
      tapCandidateRef.current = null;
      pointersRef.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const remaining = getPointers(pointersRef.current);
      if (remaining.length === 0) {
        gestureRef.current = { centroid: null, distance: null };
        setIsPanning(false);
      } else {
        gestureRef.current = {
          centroid: getCentroid(remaining),
          distance: remaining.length >= 2 ? getDistance(remaining[0], remaining[1]) : null
        };
      }
      if (tap.kind === 'edge') {
        const pathEl = tap.targetEl;
        const pathOk =
          pathEl &&
          pathEl.namespaceURI === 'http://www.w3.org/2000/svg' &&
          pathEl.tagName === 'path';
        if (moved <= TAP_MOVE_THRESHOLD_PX && pathOk && onSelectedNodeChange) {
          const dataId = pathEl.getAttribute('data-id');
          const parsed = parseFlowchartEdgeDataId(dataId);
          if (parsed) {
            const labelText = flowchartEdgeLabelText(pathEl, dataId);
            onSelectedNodeChange({
              kind: 'edge',
              id: dataId,
              edgeFrom: parsed.from,
              edgeTo: parsed.to,
              ...(labelText ? { label: labelText } : {})
            });
          }
        }
        return;
      }

      const anchor = diagramDomAnchor(tap.targetEl);
      if (moved <= TAP_MOVE_THRESHOLD_PX && anchor?.id && onSelectedNodeChange) {
        const label = nodeTitleFromElement(tap.targetEl);
        onSelectedNodeChange({
          id: anchor.id,
          label,
          ...(tap.kind === 'cluster' ? { kind: 'cluster' } : {}),
          dataId: anchor.getAttribute?.('data-id') ?? undefined
        });
      }
      return;
    }

    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.delete(event.pointerId);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pointers = getPointers(pointersRef.current);
    if (pointers.length === 0) {
      gestureRef.current = { centroid: null, distance: null };
      setIsPanning(false);

      const bgTap = backgroundTapRef.current;
      if (
        bgTap &&
        bgTap.pointerId === event.pointerId &&
        onSelectedNodeChange &&
        !event.target?.closest?.('g.node') &&
        !event.target?.closest?.('g.cluster') &&
        !resolveFlowchartEdgeInteractionRoot(event.target)
      ) {
        const movedBg = Math.hypot(event.clientX - bgTap.sx, event.clientY - bgTap.sy);
        if (movedBg <= TAP_MOVE_THRESHOLD_PX) {
          onSelectedNodeChange(null);
        }
      }
      backgroundTapRef.current = null;

      return;
    }

    gestureRef.current = {
      centroid: getCentroid(pointers),
      distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
    };
  }

  const shellClass = [
    'diagram-canvas',
    editorOpen ? 'is-editor-open' : '',
    insightsOpen && insightsSlot ? 'is-insights-open' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={shellClass}>
      <div className="diagram-main-column">
        <div
          ref={diagramSurfaceRef}
          className={`diagram-output ${isPanning ? 'is-panning' : ''} ${agentThinking ? 'is-agent-thinking' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerGesture}
          onPointerCancel={endPointerGesture}
          aria-label="Mermaid renderer. Drag to pan from anywhere including nodes, edges, and subgraphs. Pinch or wheel to zoom. Tap a node, edge, or subgraph to select."
        >
          {streamingPreview ? (
            <p className="streaming-note" role="status">
              <span className="streaming-note-inner">
                <StreamingWaveIcon />
                <span>Updating diagram…</span>
              </span>
            </p>
          ) : null}
          {displayedRenderError ? <p className="diagram-error">{displayedRenderError}</p> : null}
          <div
            ref={viewportRef}
            className={`diagram-viewport${revisionTransition ? ' is-revision-transition' : ''}`}
            style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        </div>
      </div>

      {insightsSlot}

      {editorOpen ? (
        <aside className="diagram-editor-panel" aria-label="Mermaid code editor">
          {streamingPreview ? (
            <p className="streaming-note" role="status">
              <span className="streaming-note-inner">
                <StreamingWaveIcon />
                <span>Streaming validated source…</span>
              </span>
            </p>
          ) : null}
          <div className="diagram-monaco-wrap">
            <Editor
              height="100%"
              language="mermaid"
              theme="vs-dark"
              value={editorSource}
              beforeMount={handleEditorBeforeMount}
              onMount={handleEditorMount}
              onChange={handleEditorChange}
              options={monacoEditorOptions}
            />
          </div>
        </aside>
      ) : null}
    </section>
  );
}
