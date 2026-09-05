import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useNarrowLayout } from '../hooks/useAppLayoutMedia.js';
import { useDelayedUnmount } from '../utils/useDelayedUnmount.js';
import {
  findMermaidSourceRangeForDiagramSelection,
  findSequenceMessageRange,
  logicalIdFromDiagramSelection
} from '../utils/mermaidSourceLocate.js';
import { applyDiagramHighlightToSvg } from '../utils/applyDiagramHighlightToSvg.js';
import {
  diagramDomAnchor,
  diagramSelectedWrap,
  findFlowchartNodeWrapByLogicalId,
  findInfographicConnectSource,
  findMindmapConnectSource,
  findSequenceParticipantByLogicalId,
  resolveDiagramNodeWrap
} from '../utils/diagramGraphEditNodeResolve.js';
import { applyChartHighlight } from '../utils/applyChartHighlight.js';
import { applyInfographicHighlight } from '@archislop/shared';
import { graphEditIdFromDescriptor } from '../utils/canvasGraphEdit.js';
import {
  flowchartEdgeLabelText,
  nodeTitleFromElement,
  parseFlowchartEdgeDataId,
  resolveFlowchartEdgeInteractionRoot,
  resolveSequenceActorInteractionRoot,
  resolveSequenceMessageInteractionRoot,
  resolveTimelineNodeInteractionRoot
} from '../utils/diagramSvgSelection.js';
import {
  findInfographicTapTarget,
  INFOGRAPHIC_NATIVE_TEXT_SELECTION_TYPES
} from '../utils/infographicHitTest.js';
import { buildChartDescriptorFromDomHit, findChartTapTarget } from '../utils/chartHitTest.js';
import { formatChartDslForEditor } from '../utils/formatChartDsl.js';
import { formatFormsA2uiForEditor } from '../utils/formatFormsA2ui.js';
import InfographicRenderer from './InfographicRenderer.jsx';
import MetaphorRenderer from './MetaphorRenderer.jsx';
import ChartRenderer from './ChartRenderer.jsx';
import AnythingRenderer from './AnythingRenderer.jsx';
import FormsRenderer from './FormsRenderer.jsx';
import DiagramRunFx from './DiagramRunFx.jsx';
import { measureViewportForDiagram } from '../utils/diagramViewportFit.js';
import { computeViewportFocusForChangeHighlight } from '../utils/focusDiagramHighlightIds.js';
import { ARCHISLOP_MERMAID_CANVAS_INIT } from '../utils/mermaidRenderInit.js';
import { isMermaidInfrastructureError } from '../utils/mermaidRenderErrors.js';
import { renderMermaidSvg } from '../utils/renderMermaidPreview.js';
import { switchMetaphorKind } from '../utils/switchMetaphorKind.js';
import { useUiCopy } from '../i18n/useUiLocale.js';

const MonacoCodeEditor = lazy(() => import('./MonacoCodeEditor.jsx'));

const TAP_MOVE_THRESHOLD_PX = 14;
/** Debounce before clearing diagram hover when the pointer leaves a node hit area. */
const DIAGRAM_HOVER_CLOSE_MS = 120;

const INFOGRAPHIC_PART_KINDS = {
  title: 'title',
  desc: 'description',
  'item-desc': 'description',
  'item-value': 'value',
  'item-icon': 'icon',
  'item-icon-group': 'icon'
};

function extractErrorMessage(error) {
  if (!error) return 'Unknown Mermaid error';
  if (typeof error === 'string') {
    return isMermaidInfrastructureError(error)
      ? 'Dev server module cache is stale — reload the page (or restart `npm run dev`).'
      : error;
  }
  if (error.message) {
    return isMermaidInfrastructureError(error)
      ? 'Dev server module cache is stale — reload the page (or restart `npm run dev`).'
      : error.message;
  }
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
    <svg
      className="streaming-wave-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M3 16h2v-8H3v8zm4 8h2V8H7v16zm4-12h2V4h-2v8zm4 8h2v-4h-2v4zm4-6v10h2V10h-2z"
      />
    </svg>
  );
}

function hashStringStable(input) {
  let hash = 0;
  const str = String(input ?? '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function resolveEditorLanguage(contentType) {
  if (contentType === 'mermaid') return 'mermaid';
  if (contentType === 'metaphor3d') return 'json';
  if (contentType === 'chart') return 'json';
  if (contentType === 'anything') return 'html';
  if (contentType === 'forms') return 'json';
  return 'infographic';
}

function resolveEditorPanelLabel(contentType) {
  if (contentType === 'mermaid') return 'Mermaid code editor';
  if (contentType === 'metaphor3d') return '3D DSL editor';
  if (contentType === 'chart') return 'Chart DSL editor';
  if (contentType === 'anything') return 'HTML editor';
  if (contentType === 'forms') return 'Forms A2UI editor';
  return 'Infographic DSL editor';
}

function resolveEditorPanelShortTitle(contentType) {
  if (contentType === 'mermaid') return 'Mermaid code';
  if (contentType === 'metaphor3d') return '3D DSL';
  if (contentType === 'chart') return 'Chart DSL';
  if (contentType === 'anything') return 'HTML';
  if (contentType === 'forms') return 'Forms A2UI';
  return 'Infographic DSL';
}

function formatEditorSource(source, contentType) {
  if (contentType === 'chart') return formatChartDslForEditor(source);
  if (contentType === 'forms') return formatFormsA2uiForEditor(source);
  return source ?? '';
}

/** Anything-iframe runtime errors later than this after load are treated as interaction-time. */
const ANYTHING_LOAD_PHASE_ERROR_MS = 5000;

export default function DiagramCanvas({
  revisionId = 0,
  diagramSource,
  contentType = 'mermaid',
  onManualEdit,
  onValidationChange,
  streamingPreview = false,
  agentThinking = false,
  editorOpen = false,
  insightsOpen = false,
  insightsSlot = null,
  ceremonySlot = null,
  selectedNode = null,
  hoverDescriptor = null,
  onSelectedNodeChange,
  onHoverTargetChange,
  onPanGestureStart,
  onNodeToolbarAnchor,
  onEditorClose = null,
  changeHighlight = null,
  changeHighlightContentType = null,
  onDiagramSvgRendered = null,
  runFx = null,
  /** Incremented by App on each mode switch so the infographic renderer fully remounts. */
  rendererRefreshKey = 0,
  /** Ref to `.diagram-output` for fullscreen (button lives in App top-corner controls). */
  diagramSurfaceRef = null,
  /** True while the surface is in native fullscreen — gates the metaphor3d title/legend overlays. */
  isFullscreen = false,
  /** Forms mode: fired when the user submits a form; App turns it into the next-form intent. */
  onFormSubmit = null,
  /** Flowchart Connect targeting: logical id of the source node, or null. */
  connectSourceId = null,
  onConnectTarget = null
}) {
  const { controls } = useUiCopy();
  const { mounted: editorMounted, closing: editorClosing } = useDelayedUnmount(editorOpen, 240);
  const [editorSource, setEditorSource] = useState(() =>
    formatEditorSource(diagramSource, contentType)
  );
  const [svgMarkup, setSvgMarkup] = useState('');
  const [renderError, setRenderError] = useState('');
  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  const revisionBootRef = useRef(true);
  const lastRevisionRef = useRef(revisionId);
  const prevStreamingRef = useRef(streamingPreview);
  const pulseTimeoutRef = useRef(null);
  const [revisionTransition, setRevisionTransition] = useState(false);
  const lastAppliedSourceRef = useRef(diagramSource);
  const lastReportedValidationRef = useRef({ source: null, error: null });
  const pointersRef = useRef(new Map());
  const gestureRef = useRef({ centroid: null, distance: null });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef(null);
  const zoomLayerRef = useRef(null);
  const pendingViewportFitRef = useRef(true);
  const diagramSurfaceRefLocal = useRef(null);
  const lastToolbarAnchorReportRef = useRef(null);
  const tapCandidateRef = useRef(null);
  const backgroundTapRef = useRef(null);
  const lastHoverKeyRef = useRef(null);
  const diagramHoverCloseTimerRef = useRef(null);
  const panGestureNotifiedRef = useRef(false);
  const panGestureStartRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const syncDecoIdsRef = useRef([]);
  const lastDiagramSyncKeyRef = useRef('');
  const diagramSyncRafRef = useRef(0);
  const lastSvgRenderedReportRef = useRef('');
  const [monacoBind, setMonacoBind] = useState(null);
  const narrowLayout = useNarrowLayout();
  const bindDiagramSurfaceRef = useCallback(
    (node) => {
      diagramSurfaceRefLocal.current = node;
      if (diagramSurfaceRef) {
        diagramSurfaceRef.current = node;
      }
    },
    [diagramSurfaceRef]
  );
  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoBind({ editor, monaco });
    if (monaco?.KeyMod?.CtrlCmd != null && monaco?.KeyCode?.KeyA != null) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyA, () => {
        editor.trigger('keyboard', 'editor.action.selectAll', null);
      });
    }
  }, []);

  const handleSelectAllEditor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.trigger('keyboard', 'editor.action.selectAll', null);
    editor.focus();
  }, []);

  const handleCopyEditor = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = editor.getValue();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      editor.focus();
    } catch {
      // Clipboard denied — user can still use Select all + system copy.
    }
  }, []);

  const monacoLoadingLabel = controls.diagramCanvas.loadingEditor;

  const monacoEditorOptions = useMemo(
    () => ({
      minimap: { enabled: false },
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: streamingPreview,
      fontSize: 13,
      lineNumbers: narrowLayout ? 'off' : 'on',
      wrappingIndent: 'none',
      ...(narrowLayout
        ? {
            glyphMargin: false,
            folding: false,
            contextmenu: false,
            quickSuggestions: false,
            parameterHints: { enabled: false },
            suggestOnTriggerCharacters: false,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'hidden',
              useShadows: false
            },
            padding: { top: 8, bottom: 16 }
          }
        : {})
    }),
    [narrowLayout, streamingPreview]
  );

  const editorLanguage = useMemo(() => resolveEditorLanguage(contentType), [contentType]);
  const editorPanelLabel = useMemo(() => resolveEditorPanelLabel(contentType), [contentType]);
  const editorPanelShortTitle = useMemo(
    () => resolveEditorPanelShortTitle(contentType),
    [contentType]
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

  // Load-phase runtime errors relayed from the sandboxed Anything iframe flow
  // into the same validation plumbing as Mermaid render errors (status line +
  // auto-fix). Errors thrown long after load — during user interaction — stay
  // banner-only in the renderer: rewriting the page mid-interaction over a
  // single handler bug would be more disruptive than the bug.
  const handleAnythingRuntimeError = useCallback(
    (entry) => {
      if (!entry?.message) return;
      if (entry.sinceLoadMs != null && entry.sinceLoadMs > ANYTHING_LOAD_PHASE_ERROR_MS) return;
      reportValidation(editorSource, `Page runtime error: ${entry.message}`);
    },
    [editorSource, reportValidation]
  );

  useEffect(() => {
    if (diagramSource === lastAppliedSourceRef.current) {
      return;
    }

    lastAppliedSourceRef.current = diagramSource;
    setEditorSource(formatEditorSource(diagramSource, contentType));
    pendingViewportFitRef.current = true;
  }, [diagramSource, contentType]);

  useEffect(() => {
    pendingViewportFitRef.current = true;
  }, [revisionId, contentType]);

  const applyViewportFit = useCallback((preferFit = true) => {
    const viewportEl = viewportRef.current;
    if (!viewportEl?.querySelector('svg')) return;
    setViewport(measureViewportForDiagram(viewportEl, { preferFit }));
  }, []);

  useLayoutEffect(() => {
    if (!pendingViewportFitRef.current || streamingPreview) return;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;
    if (contentType === 'mermaid' && !svgMarkup) return;
    if (!viewportEl.querySelector('svg')) return;
    pendingViewportFitRef.current = false;
    applyViewportFit(true);
  }, [applyViewportFit, contentType, editorSource, revisionId, streamingPreview, svgMarkup]);

  // Infographic + chart SVGs are rendered asynchronously; refit when they land in the DOM.
  useEffect(() => {
    if ((contentType !== 'infographic' && contentType !== 'chart') || streamingPreview)
      return undefined;
    const root = viewportRef.current;
    if (!root) return undefined;
    const tryFit = () => {
      if (!pendingViewportFitRef.current) return;
      if (!root.querySelector('svg')) return;
      pendingViewportFitRef.current = false;
      queueMicrotask(() => {
        requestAnimationFrame(() => {
          applyViewportFit(true);
        });
      });
    };
    tryFit();
    const observer = new MutationObserver(tryFit);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [applyViewportFit, contentType, editorSource, revisionId, streamingPreview]);

  useEffect(() => {
    if (!changeHighlight || !changeHighlightContentType || streamingPreview) return undefined;
    const viewportEl = viewportRef.current;
    if (!viewportEl) return undefined;

    let applied = false;
    const tryApply = () => {
      if (applied) return;
      if (!viewportEl.querySelector('svg')) return;
      const next = computeViewportFocusForChangeHighlight(
        viewportEl,
        changeHighlight,
        changeHighlightContentType
      );
      if (!next) return;
      applied = true;
      setViewport(next);
    };

    tryApply();
    if (applied) return undefined;

    const observer = new MutationObserver(() => {
      requestAnimationFrame(tryApply);
    });
    observer.observe(viewportEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [
    changeHighlight,
    changeHighlightContentType,
    revisionId,
    streamingPreview,
    svgMarkup,
    editorSource
  ]);

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

    if (contentType !== 'mermaid') {
      // InfographicRenderer owns its own render path.
      setSvgMarkup('');
      setRenderError('');
      reportValidation(editorSource, null);
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

    const debounceMs = streamingPreview ? 120 : 200;

    debounceRef.current = setTimeout(() => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      async function runRender() {
        try {
          const diagramId = `diagram-${requestId}`;
          const { svg } = await renderMermaidSvg(
            diagramId,
            editorSource,
            ARCHISLOP_MERMAID_CANVAS_INIT
          );
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
          if (streamingPreview) {
            return;
          }
          const message = extractErrorMessage(error);
          setRenderError(message);
          reportValidation(editorSource, message);
        }
      }

      runRender();
    }, debounceMs);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [contentType, editorSource, reportValidation, revisionId, streamingPreview]);

  useLayoutEffect(() => {
    if (contentType !== 'mermaid') return;
    if (streamingPreview || !svgMarkup || typeof onDiagramSvgRendered !== 'function') return;
    const reportKey = `${revisionId}:${editorSource}:${svgMarkup.length}`;
    if (reportKey === lastSvgRenderedReportRef.current) return;
    lastSvgRenderedReportRef.current = reportKey;
    onDiagramSvgRendered({ source: editorSource, revisionId });
  }, [contentType, editorSource, onDiagramSvgRendered, revisionId, streamingPreview, svgMarkup]);

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

    if (contentType !== 'mermaid' || !editorOpen || streamingPreview || !editor || !monaco) {
      return undefined;
    }

    if (selectedNode?.kind === 'edge') {
      const rangePlain =
        selectedNode.edgeFrom && selectedNode.edgeTo
          ? findSequenceMessageRange(editorSource, {
              from: selectedNode.edgeFrom,
              to: selectedNode.edgeTo,
              label: selectedNode.label
            })
          : null;
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
    contentType,
    editorOpen,
    streamingPreview,
    selectedNode,
    editorSource,
    monacoBind?.editor,
    monacoBind?.monaco
  ]);

  useLayoutEffect(() => {
    if (contentType === 'mermaid') {
      applyDiagramHighlightToSvg(viewportRef.current, changeHighlight);
    }
  }, [contentType, svgMarkup, changeHighlight]);

  // Infographic canvas is rendered async by AntV; observe DOM mutations and re-apply.
  useEffect(() => {
    if (contentType !== 'infographic') return undefined;
    const root = viewportRef.current;
    if (!root) return undefined;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyInfographicHighlight(root, changeHighlight));
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [contentType, editorSource, changeHighlight]);

  // Chart canvas is rendered async by Vega; observe DOM mutations and re-apply.
  useEffect(() => {
    if (contentType !== 'chart') return undefined;
    const root = viewportRef.current;
    if (!root) return undefined;
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => applyChartHighlight(root, changeHighlight));
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [contentType, editorSource, changeHighlight]);

  // Stagger node fade-in after each Mermaid SVG render. Pure DOM annotation —
  // the CSS keyframe `diagram-node-pop-in` lives in App.css.
  //
  // We skip this during streaming: each token re-renders the SVG, and replaying
  // the pop-in animation per tick made the diagram strobe. The fade is only
  // meaningful on the final settled SVG, so we wait for streaming to end.
  useEffect(() => {
    if (!svgMarkup) return;
    if (streamingPreview) return;
    const root = viewportRef.current;
    if (!root) return;
    const reduceMotion =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const nodes = root.querySelectorAll('g.node, g.timeline-node, g.cluster');
    nodes.forEach((node, i) => {
      node.setAttribute('data-node-fade', '1');
      node.style.animationDelay = `${Math.min(i * 35, 700)}ms`;
    });
  }, [svgMarkup, streamingPreview]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    root
      .querySelectorAll('path.is-diagram-edge-selected')
      .forEach((el) => el.classList.remove('is-diagram-edge-selected'));
    root
      .querySelectorAll('g.node.is-diagram-selected')
      .forEach((el) => el.classList.remove('is-diagram-selected'));
    root
      .querySelectorAll('g.timeline-node.is-diagram-selected')
      .forEach((el) => el.classList.remove('is-diagram-selected'));
    root
      .querySelectorAll('g.cluster.is-diagram-selected')
      .forEach((el) => el.classList.remove('is-diagram-selected'));
    root
      .querySelectorAll('[data-et="participant"].is-diagram-selected')
      .forEach((el) => el.classList.remove('is-diagram-selected'));
    if (!selectedNode?.id && !selectedNode?.dataId) return;
    if (selectedNode.kind === 'edge') {
      try {
        const pathEl =
          root.querySelector(`path[data-id="${CSS.escape(selectedNode.id)}"]`) ??
          root.querySelector(`line[data-id="${CSS.escape(selectedNode.id)}"]`) ??
          root.querySelector(`[data-et="message"][data-id="${CSS.escape(selectedNode.id)}"]`);
        pathEl?.classList?.add('is-diagram-edge-selected');
      } catch {
        // ignore invalid ids for selector
      }
      return;
    }
    const wrap = resolveDiagramNodeWrap(root, selectedNode);
    wrap?.classList?.add('is-diagram-selected');
  }, [svgMarkup, selectedNode]);

  useLayoutEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    root
      .querySelectorAll(
        'g.node.is-connect-source, g.timeline-node.is-connect-source, .is-connect-source'
      )
      .forEach((el) => el.classList.remove('is-connect-source'));
    if (!connectSourceId) return;
    const sourceWrap =
      findFlowchartNodeWrapByLogicalId(root, connectSourceId) ||
      findSequenceParticipantByLogicalId(root, connectSourceId) ||
      findInfographicConnectSource(root, connectSourceId) ||
      findMindmapConnectSource(root, connectSourceId);
    sourceWrap?.classList?.add('is-connect-source');
  }, [svgMarkup, connectSourceId, viewport]);

  useEffect(() => {
    const root = viewportRef.current;
    if (!root) return;
    root
      .querySelectorAll('.is-diagram-hover')
      .forEach((el) => el.classList.remove('is-diagram-hover'));
    if (!hoverDescriptor?.id) return;
    if (hoverDescriptor.kind === 'edge') {
      try {
        const pathEl =
          root.querySelector(`path[data-id="${CSS.escape(hoverDescriptor.id)}"]`) ??
          root.querySelector(`line[data-id="${CSS.escape(hoverDescriptor.id)}"]`) ??
          root.querySelector(`[data-et="message"][data-id="${CSS.escape(hoverDescriptor.id)}"]`);
        pathEl?.classList?.add('is-diagram-hover');
      } catch {
        // ignore invalid ids for selector
      }
      return;
    }
    if (hoverDescriptor.kind === 'infographic-item') {
      const candidate = hoverDescriptor.anchorEl || hoverDescriptor.domNode;
      if (candidate && root.contains(candidate)) {
        candidate.classList.add('is-diagram-hover');
      }
      return;
    }
    if (hoverDescriptor.kind === 'chart-mark') {
      const candidate = hoverDescriptor.anchorEl || hoverDescriptor.domNode;
      if (candidate && root.contains(candidate)) {
        candidate.classList.add('is-diagram-hover');
      }
      return;
    }
    const wrap = diagramSelectedWrap(root, hoverDescriptor.id);
    wrap?.classList?.add('is-diagram-hover');
  }, [svgMarkup, hoverDescriptor]);

  useLayoutEffect(() => {
    if (!onNodeToolbarAnchor) return;
    if (contentType === 'metaphor3d') return;
    const root = viewportRef.current;

    function clearToolbarAnchor() {
      if (lastToolbarAnchorReportRef.current !== null) {
        lastToolbarAnchorReportRef.current = null;
        onNodeToolbarAnchor(null);
      }
    }

    const target = selectedNode;
    if ((!target?.id && !target?.dataId) || !root) {
      clearToolbarAnchor();
      return;
    }
    try {
      let el = null;
      if (target.kind === 'edge') {
        try {
          el =
            root.querySelector(`path[data-id="${CSS.escape(target.id)}"]`) ??
            root.querySelector(`line[data-id="${CSS.escape(target.id)}"]`) ??
            root.querySelector(`[data-et="message"][data-id="${CSS.escape(target.id)}"]`);
        } catch {
          el = null;
        }
      } else if (target.kind === 'infographic-item' || target.kind === 'infographic-region') {
        const candidate = target.anchorEl || target.domNode;
        el = candidate && root.contains(candidate) ? candidate : null;
      } else if (target.kind === 'chart-mark') {
        const candidate = target.anchorEl || target.domNode;
        el = candidate && root.contains(candidate) ? candidate : null;
      } else {
        el = resolveDiagramNodeWrap(root, target);
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
      const nodeLeft = rect.left;
      const nodeRight = rect.right;
      const centerY = rect.top + rect.height / 2;
      const prev = lastToolbarAnchorReportRef.current;
      const nodeKey = target.id || target.dataId;
      if (
        prev &&
        prev.nodeId === nodeKey &&
        Math.abs(prev.left - left) < 0.5 &&
        Math.abs(prev.top - top) < 0.5 &&
        Math.abs(prev.nodeTop - nodeTop) < 0.5 &&
        Math.abs(prev.nodeBottom - nodeBottom) < 0.5 &&
        Math.abs((prev.nodeLeft ?? 0) - nodeLeft) < 0.5 &&
        Math.abs((prev.nodeRight ?? 0) - nodeRight) < 0.5
      ) {
        return;
      }
      lastToolbarAnchorReportRef.current = {
        nodeId: nodeKey,
        left,
        top,
        nodeTop,
        nodeBottom,
        nodeLeft,
        nodeRight,
        centerY
      };
      onNodeToolbarAnchor({ left, top, nodeTop, nodeBottom, nodeLeft, nodeRight, centerY });
    } catch {
      clearToolbarAnchor();
    }
  }, [selectedNode, onNodeToolbarAnchor, svgMarkup, viewport]);

  function notifyPanGestureStart() {
    if (panGestureNotifiedRef.current) return;
    panGestureNotifiedRef.current = true;
    onPanGestureStart?.();
  }

  function checkPanGestureThreshold(clientX, clientY) {
    const start = panGestureStartRef.current;
    if (!start || panGestureNotifiedRef.current) return;
    const moved = Math.hypot(clientX - start.x, clientY - start.y);
    if (moved > TAP_MOVE_THRESHOLD_PX) {
      notifyPanGestureStart();
    }
  }

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

  const handleMetaphorKindChange = useCallback(
    (nextKind) => {
      if (streamingPreview || contentType !== 'metaphor3d') return;
      const result = switchMetaphorKind(editorSource, nextKind);
      if (!result.ok) return;
      const nextValue = result.text;
      setEditorSource((prev) => (prev === nextValue ? prev : nextValue));
      lastAppliedSourceRef.current = nextValue;
      onManualEdit?.(nextValue);
    },
    [contentType, editorSource, onManualEdit, streamingPreview]
  );

  const displayedRenderError = streamingPreview ? '' : renderError;

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
      if (contentType === 'metaphor3d' || contentType === 'anything' || contentType === 'forms')
        return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);
      zoomAtPoint(pointerX, pointerY, zoomFactor);
    },
    [contentType, zoomAtPoint]
  );

  useEffect(() => {
    const el = diagramSurfaceRefLocal.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  function resolveTargetUnder(target) {
    let nodeEl = null;
    let clusterEl = null;
    let actorHit = null;
    let edgeHit = null;
    let sequenceMessageHit = null;
    let infographicHit = null;
    let chartHit = null;
    let textHitEl = null;

    if (contentType === 'mermaid') {
      nodeEl = target?.closest?.('g.node') ?? target?.closest?.('g.timeline-node') ?? null;
      clusterEl = nodeEl ? null : (target?.closest?.('g.cluster') ?? null);
      actorHit = !nodeEl && !clusterEl ? resolveSequenceActorInteractionRoot(target) : null;
      sequenceMessageHit =
        !nodeEl && !clusterEl && !actorHit ? resolveSequenceMessageInteractionRoot(target) : null;
      edgeHit =
        !nodeEl && !clusterEl && !actorHit && !sequenceMessageHit
          ? resolveFlowchartEdgeInteractionRoot(target)
          : null;
      const container = nodeEl || clusterEl || actorHit?.groupEl;
      if (container) {
        const hitText = target?.closest?.('text');
        textHitEl = hitText && container.contains(hitText) ? hitText : null;
      }
    } else if (contentType === 'infographic') {
      const boundary = viewportRef.current;
      if (boundary && boundary.contains(target)) {
        infographicHit = findInfographicTapTarget(target, boundary);
      }
    } else if (contentType === 'chart') {
      const boundary = viewportRef.current;
      if (boundary && boundary.contains(target)) {
        chartHit = findChartTapTarget(target, boundary);
      }
    }
    return {
      nodeEl,
      clusterEl,
      actorHit,
      edgeHit,
      sequenceMessageHit,
      infographicHit,
      chartHit,
      textHitEl
    };
  }

  function buildDescriptorFromHit({
    nodeEl,
    clusterEl,
    actorHit,
    edgeHit,
    sequenceMessageHit,
    infographicHit,
    chartHit,
    textHitEl
  }) {
    if (actorHit) {
      const container = actorHit.groupEl;
      const anchor = diagramDomAnchor(container);
      const dataId = actorHit.dataId;
      const label = nodeTitleFromElement(container) || dataId;
      let clickedLabel;
      if (textHitEl) {
        const raw = textHitEl.textContent?.replace(/\s+/g, ' ')?.trim() ?? '';
        const clipped = raw.slice(0, 240);
        if (clipped && clipped !== label) clickedLabel = clipped;
      }
      const partKind = textHitEl ? 'label' : 'participant';
      const partName = clickedLabel || label;
      return {
        id: anchor?.id || dataId,
        label,
        dataId,
        ...(clickedLabel ? { clickedLabel } : {}),
        partKind,
        partName,
        anchorEl: container
      };
    }
    if (nodeEl || clusterEl) {
      const container = nodeEl || clusterEl;
      const anchor = diagramDomAnchor(container);
      if (!anchor?.id) return null;
      const label = nodeTitleFromElement(container);
      let clickedLabel;
      if (textHitEl) {
        const raw = textHitEl.textContent?.replace(/\s+/g, ' ')?.trim() ?? '';
        const clipped = raw.slice(0, 240);
        if (clipped && clipped !== label) clickedLabel = clipped;
      }
      const partKind = textHitEl
        ? 'label'
        : nodeEl?.classList?.contains?.('timeline-node')
          ? 'timeline'
          : nodeEl
            ? 'node'
            : 'cluster';
      const partName = clickedLabel || label;
      return {
        id: anchor.id,
        label,
        ...(clusterEl && !nodeEl ? { kind: 'cluster' } : {}),
        dataId: anchor.getAttribute?.('data-id') ?? undefined,
        ...(clickedLabel ? { clickedLabel } : {}),
        partKind,
        partName,
        anchorEl: container
      };
    }
    if (sequenceMessageHit) {
      const { lineEl, dataId, from, to, label } = sequenceMessageHit;
      return {
        kind: 'edge',
        id: dataId,
        edgeFrom: from,
        edgeTo: to,
        ...(label ? { label } : {}),
        partKind: 'edge',
        partName: label || `${from} → ${to}`,
        anchorEl: lineEl
      };
    }
    if (edgeHit) {
      const pathEl = edgeHit.pathEl;
      if (!pathEl || pathEl.tagName !== 'path') return null;
      const dataId = pathEl.getAttribute('data-id');
      const parsed = parseFlowchartEdgeDataId(dataId);
      if (!parsed) return null;
      const labelText = flowchartEdgeLabelText(pathEl, dataId);
      return {
        kind: 'edge',
        id: dataId,
        edgeFrom: parsed.from,
        edgeTo: parsed.to,
        ...(labelText ? { label: labelText } : {}),
        partKind: 'edge',
        partName: `${parsed.from} → ${parsed.to}`,
        anchorEl: pathEl
      };
    }
    if (infographicHit) {
      const label = infographicHit.label || '';
      const elementType = infographicHit.elementType || '';
      const indexes = infographicHit.indexes || '';
      if (!(label || elementType)) return null;
      const idCore = indexes ? `${elementType}:${indexes}` : elementType || hashStringStable(label);
      const partKind = INFOGRAPHIC_PART_KINDS[elementType] || 'item';
      const partName = infographicHit.clickedLabel || label;
      return {
        kind: 'infographic-item',
        id: `infographic:${idCore}`,
        label,
        ...(infographicHit.clickedLabel && infographicHit.clickedLabel !== label
          ? { clickedLabel: infographicHit.clickedLabel }
          : {}),
        indexes,
        elementType,
        domNode: infographicHit.node,
        partKind,
        partName,
        anchorEl: infographicHit.node
      };
    }
    if (chartHit) {
      return buildChartDescriptorFromDomHit(chartHit, viewportRef.current);
    }
    return null;
  }

  function descriptorFromTap(tap) {
    if (!tap?.targetEl) return null;
    if (tap.kind === 'edge') {
      if (tap.sequenceMessage) {
        return buildDescriptorFromHit({ sequenceMessageHit: tap.sequenceMessage });
      }
      return buildDescriptorFromHit({ edgeHit: { pathEl: tap.targetEl } });
    }
    if (tap.kind === 'infographic-item') {
      return buildDescriptorFromHit({
        infographicHit: {
          node: tap.targetEl,
          label: tap.label,
          clickedLabel: tap.clickedLabel,
          indexes: tap.indexes,
          elementType: tap.elementType
        }
      });
    }
    if (tap.kind === 'chart-mark') {
      return buildDescriptorFromHit({
        chartHit: {
          node: tap.targetEl,
          label: tap.label,
          roleDesc: tap.roleDesc,
          className: tap.className
        }
      });
    }
    if (tap.kind === 'cluster') {
      return buildDescriptorFromHit({ clusterEl: tap.targetEl, textHitEl: tap.textHitEl });
    }
    if (tap.kind === 'participant') {
      return buildDescriptorFromHit({
        actorHit: { groupEl: tap.targetEl, dataId: tap.dataId },
        textHitEl: tap.textHitEl
      });
    }
    return buildDescriptorFromHit({ nodeEl: tap.targetEl, textHitEl: tap.textHitEl });
  }

  function descriptorKey(descriptor) {
    if (!descriptor) return null;
    return `${descriptor.kind || 'node'}|${descriptor.id || ''}|${descriptor.partKind || ''}|${descriptor.partName || ''}`;
  }

  function clearDiagramHoverCloseTimer() {
    if (diagramHoverCloseTimerRef.current != null) {
      window.clearTimeout(diagramHoverCloseTimerRef.current);
      diagramHoverCloseTimerRef.current = null;
    }
  }

  function emitHoverDescriptor(descriptor) {
    clearDiagramHoverCloseTimer();
    const key = descriptorKey(descriptor);
    if (key === lastHoverKeyRef.current) return;
    lastHoverKeyRef.current = key;
    onHoverTargetChange?.(descriptor);
  }

  function scheduleHoverClose() {
    if (lastHoverKeyRef.current === null) return;
    clearDiagramHoverCloseTimer();
    diagramHoverCloseTimerRef.current = window.setTimeout(() => {
      diagramHoverCloseTimerRef.current = null;
      lastHoverKeyRef.current = null;
      onHoverTargetChange?.(null);
    }, DIAGRAM_HOVER_CLOSE_MS);
  }

  function handlePointerDown(event) {
    if (contentType === 'metaphor3d' || contentType === 'anything' || contentType === 'forms')
      return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    const {
      nodeEl,
      clusterEl,
      actorHit,
      edgeHit,
      sequenceMessageHit,
      infographicHit,
      chartHit,
      textHitEl
    } = resolveTargetUnder(event.target);

    const prevPointers = getPointers(pointersRef.current);
    const passiveInfographicText =
      contentType === 'infographic' &&
      infographicHit &&
      INFOGRAPHIC_NATIVE_TEXT_SELECTION_TYPES.has(infographicHit.elementType);
    const passiveChartMark = contentType === 'chart' && chartHit && event.pointerType === 'touch';
    const passiveGesture = passiveInfographicText || passiveChartMark;

    if (!passiveGesture) {
      event.preventDefault();
      pointersRef.current.set(event.pointerId, {
        x: localX,
        y: localY
      });
    }

    const pointers = getPointers(pointersRef.current);
    if (!passiveGesture) {
      gestureRef.current = {
        centroid: getCentroid(pointers),
        distance: pointers.length >= 2 ? getDistance(pointers[0], pointers[1]) : null
      };
    }

    if ((nodeEl || clusterEl) && prevPointers.length === 0) {
      const container = nodeEl || clusterEl;
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: container,
        kind: nodeEl ? 'node' : 'cluster',
        textHitEl
      };
    } else if (edgeHit && prevPointers.length === 0) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: edgeHit.pathEl,
        kind: 'edge'
      };
    } else if (sequenceMessageHit && prevPointers.length === 0) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: sequenceMessageHit.lineEl,
        kind: 'edge',
        sequenceMessage: sequenceMessageHit
      };
    } else if (actorHit && prevPointers.length === 0) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: actorHit.groupEl,
        dataId: actorHit.dataId,
        kind: 'participant',
        textHitEl
      };
    } else if (infographicHit && prevPointers.length === 0) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: infographicHit.node,
        kind: 'infographic-item',
        label: infographicHit.label,
        clickedLabel: infographicHit.clickedLabel,
        indexes: infographicHit.indexes,
        elementType: infographicHit.elementType,
        passiveNativeText: passiveInfographicText
      };
    } else if (chartHit && prevPointers.length === 0) {
      tapCandidateRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        targetEl: chartHit.node,
        kind: 'chart-mark',
        label: chartHit.label,
        roleDesc: chartHit.roleDesc,
        className: chartHit.className,
        passiveChartMark
      };
    } else {
      tapCandidateRef.current = null;
    }

    const noTap =
      !nodeEl &&
      !clusterEl &&
      !actorHit &&
      !edgeHit &&
      !sequenceMessageHit &&
      !infographicHit &&
      !chartHit;
    if (pointers.length === 1 && noTap && !passiveGesture) {
      backgroundTapRef.current = {
        pointerId: event.pointerId,
        sx: event.clientX,
        sy: event.clientY
      };
    } else {
      backgroundTapRef.current = null;
    }

    if (!passiveGesture) {
      panGestureNotifiedRef.current = false;
      panGestureStartRef.current = { x: event.clientX, y: event.clientY };
      setIsPanning(true);
      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  }

  function handlePointerMove(event) {
    if (contentType === 'metaphor3d' || contentType === 'anything' || contentType === 'forms')
      return;
    const tap = tapCandidateRef.current;
    if (tap && tap.pointerId === event.pointerId) {
      if (!tap.passiveNativeText && !tap.passiveChartMark) {
        event.preventDefault();
      }
      const moved = Math.hypot(event.clientX - tap.startClientX, event.clientY - tap.startClientY);
      if (moved <= TAP_MOVE_THRESHOLD_PX) {
        return;
      }
      tapCandidateRef.current = null;
      notifyPanGestureStart();
    }

    if (!pointersRef.current.has(event.pointerId)) {
      if (event.pointerType === 'mouse' && onHoverTargetChange) {
        const resolved = resolveTargetUnder(event.target);
        const descriptor = buildDescriptorFromHit(resolved);
        if (descriptor) {
          emitHoverDescriptor(descriptor);
        } else {
          scheduleHoverClose();
        }
      }
      return;
    }
    event.preventDefault();
    checkPanGestureThreshold(event.clientX, event.clientY);

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
      if (!tap.passiveNativeText && !tap.passiveChartMark) {
        event.preventDefault();
      }
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
      if (moved <= TAP_MOVE_THRESHOLD_PX) {
        const descriptor = descriptorFromTap(tap);
        if (connectSourceId) {
          if (!descriptor || descriptor.kind === 'edge' || descriptor.kind === 'cluster') {
            return;
          }
          const logicalId = graphEditIdFromDescriptor(descriptor);
          if (!logicalId || logicalId === connectSourceId) {
            onConnectTarget?.({ type: 'source' });
            return;
          }
          onConnectTarget?.({ type: 'node', descriptor, logicalId });
          return;
        }
        if (descriptor) {
          onSelectedNodeChange?.(descriptor);
        }
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
      panGestureStartRef.current = null;

      const bgTap = backgroundTapRef.current;
      if (bgTap && bgTap.pointerId === event.pointerId) {
        let stillBackground = true;
        if (contentType === 'mermaid') {
          stillBackground =
            !event.target?.closest?.('g.node') &&
            !event.target?.closest?.('g.timeline-node') &&
            !event.target?.closest?.('g.cluster') &&
            !resolveSequenceActorInteractionRoot(event.target) &&
            !resolveSequenceMessageInteractionRoot(event.target) &&
            !resolveFlowchartEdgeInteractionRoot(event.target) &&
            !resolveTimelineNodeInteractionRoot(event.target);
        } else if (contentType === 'infographic') {
          const boundary = viewportRef.current;
          stillBackground = !(boundary && findInfographicTapTarget(event.target, boundary));
        } else if (contentType === 'chart') {
          const boundary = viewportRef.current;
          stillBackground = !(boundary && findChartTapTarget(event.target, boundary));
        }
        if (stillBackground) {
          const movedBg = Math.hypot(event.clientX - bgTap.sx, event.clientY - bgTap.sy);
          if (movedBg <= TAP_MOVE_THRESHOLD_PX) {
            if (connectSourceId) {
              onConnectTarget?.({
                type: 'empty',
                clientX: event.clientX,
                clientY: event.clientY
              });
            } else {
              onSelectedNodeChange?.(null);
              scheduleHoverClose();
            }
          }
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
    editorMounted ? 'is-editor-open' : '',
    insightsOpen && insightsSlot ? 'is-insights-open' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const stackEditorInNotebook = Boolean(insightsOpen && insightsSlot && editorMounted);

  const editorPanel = editorMounted ? (
    <aside
      className={`diagram-editor-panel ${editorClosing ? 'is-closing' : ''}`.trim()}
      aria-label={editorPanelLabel}
    >
      {streamingPreview ? (
        <p className="streaming-note" role="status">
          <span className="streaming-note-inner">
            <StreamingWaveIcon />
            <span>{controls.diagramCanvas.streamingSource}</span>
          </span>
        </p>
      ) : null}
      {narrowLayout ? (
        <div className="mobile-code-editor-wrap">
          <div className="mobile-code-editor-toolbar">
            <span className="mobile-code-editor-title">{editorPanelShortTitle}</span>
            <div className="mobile-code-editor-actions">
              <button
                type="button"
                className="overlay-button compact-button"
                onClick={handleCopyEditor}
              >
                {controls.diagramCanvas.copy}
              </button>
              <button
                type="button"
                className="overlay-button compact-button"
                onClick={handleSelectAllEditor}
              >
                {controls.diagramCanvas.selectAll}
              </button>
              {onEditorClose ? (
                <button
                  type="button"
                  className="overlay-button compact-button primary-button"
                  onClick={onEditorClose}
                  aria-label={controls.editor?.closeEditor ?? controls.diagramCanvas.done}
                  title={controls.editor?.closeEditor ?? controls.diagramCanvas.done}
                  data-testid="diagram-editor-close"
                >
                  {controls.diagramCanvas.done}
                </button>
              ) : null}
            </div>
          </div>
          <div className="diagram-monaco-wrap mobile-monaco-wrap">
            <Suspense
              fallback={
                <div className="monaco-editor-loading" role="status">
                  {monacoLoadingLabel}
                </div>
              }
            >
              <MonacoCodeEditor
                language={editorLanguage}
                value={editorSource}
                onMount={handleEditorMount}
                onChange={handleEditorChange}
                options={monacoEditorOptions}
                loadingLabel={monacoLoadingLabel}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="diagram-monaco-wrap">
          <div className="diagram-editor-toolbar">
            <button
              type="button"
              className="overlay-button compact-button"
              onClick={handleCopyEditor}
            >
              {controls.diagramCanvas.copy}
            </button>
            <button
              type="button"
              className="overlay-button compact-button"
              onClick={handleSelectAllEditor}
            >
              {controls.diagramCanvas.selectAll}
            </button>
            {onEditorClose ? (
              <button
                type="button"
                className="overlay-button compact-button primary-button"
                onClick={onEditorClose}
                aria-label={controls.editor?.closeEditor ?? controls.diagramCanvas.done}
                title={controls.editor?.closeEditor ?? controls.diagramCanvas.done}
                data-testid="diagram-editor-close"
              >
                {controls.diagramCanvas.done}
              </button>
            ) : null}
          </div>
          <Suspense
            fallback={
              <div className="monaco-editor-loading" role="status">
                {monacoLoadingLabel}
              </div>
            }
          >
            <MonacoCodeEditor
              language={editorLanguage}
              value={editorSource}
              onMount={handleEditorMount}
              onChange={handleEditorChange}
              options={monacoEditorOptions}
              loadingLabel={monacoLoadingLabel}
            />
          </Suspense>
        </div>
      )}
    </aside>
  ) : null;

  const aria =
    contentType === 'metaphor3d'
      ? '3D renderer. Drag to orbit. Scroll or pinch to zoom. Tap an item to inspect what it encodes; tap empty space or press Escape to dismiss.'
      : contentType === 'chart'
        ? 'Vega-Lite chart renderer. Drag to pan from anywhere. Pinch or wheel to zoom. Tap a mark, axis, legend, or title to select. Press question mark for keyboard shortcuts.'
        : contentType === 'anything'
          ? 'Sandboxed page renderer. Interact with the page directly.'
          : contentType === 'forms'
            ? 'Interactive form renderer. Fill in the controls and submit to receive the next form.'
            : contentType === 'infographic'
              ? 'AntV Infographic renderer. Drag to pan from anywhere. Pinch or wheel to zoom. Tap an element to select. Press question mark for keyboard shortcuts.'
              : 'Mermaid renderer. Drag to pan from anywhere including nodes, edges, and subgraphs. Pinch or wheel to zoom. Tap a node, edge, or subgraph to select. Press question mark for keyboard shortcuts.';
  const streamingLabel =
    contentType === 'infographic'
      ? 'Updating infographic…'
      : contentType === 'metaphor3d'
        ? 'Updating 3D scene…'
        : contentType === 'chart'
          ? 'Updating chart…'
          : contentType === 'anything'
            ? 'Updating page…'
            : contentType === 'forms'
              ? 'Issuing next form…'
              : 'Updating diagram…';
  const zoomLayerStyle = {
    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`
  };

  return (
    <section className={shellClass}>
      <div className="diagram-main-column">
        {ceremonySlot}
        <div
          ref={bindDiagramSurfaceRef}
          className={`diagram-output${contentType === 'metaphor3d' ? ' is-metaphor3d' : ''}${contentType === 'chart' ? ' is-chart' : ''}${contentType === 'anything' ? ' is-anything' : ''}${contentType === 'forms' ? ' is-forms' : ''}${isPanning ? ' is-panning' : ''}${agentThinking ? ' is-agent-thinking' : ''}${connectSourceId ? ' is-connect-mode' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointerGesture}
          onPointerCancel={endPointerGesture}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') scheduleHoverClose();
          }}
          aria-label={aria}
          role="application"
          tabIndex={0}
          data-run-variant={runFx?.streaming && runFx?.variant ? runFx.variant : undefined}
          data-run-intensity={runFx?.streaming ? runFx.intensity || 'normal' : undefined}
        >
          {streamingPreview ? (
            <p className="streaming-note" role="status">
              <span className="streaming-note-inner">
                <StreamingWaveIcon />
                <span>{streamingLabel}</span>
              </span>
            </p>
          ) : null}
          {displayedRenderError ? <p className="diagram-error">{displayedRenderError}</p> : null}
          <div
            ref={viewportRef}
            className={`diagram-viewport${revisionTransition ? ' is-revision-transition' : ''}${contentType === 'metaphor3d' ? ' is-metaphor3d' : ''}${contentType === 'chart' ? ' is-chart' : ''}${contentType === 'anything' ? ' is-anything' : ''}${contentType === 'forms' ? ' is-forms' : ''}`}
          >
            {contentType === 'metaphor3d' ? (
              <>
                <MetaphorRenderer
                  key={`metaphor3d-${rendererRefreshKey}`}
                  diagramSource={editorSource}
                  streamingPreview={streamingPreview}
                  changeHighlight={changeHighlight}
                  isFullscreen={isFullscreen}
                  onMetaphorKindChange={handleMetaphorKindChange}
                  metaphorKindSwitchDisabled={streamingPreview}
                  selectedNode={selectedNode}
                  onSelectedNodeChange={onSelectedNodeChange}
                  onNodeToolbarAnchor={onNodeToolbarAnchor}
                />
              </>
            ) : contentType === 'anything' ? (
              // The sandboxed iframe owns its own scrolling/interaction — no
              // pan/zoom transform layer (which would also swallow pointer events).
              <AnythingRenderer
                key={`anything-${rendererRefreshKey}`}
                diagramSource={editorSource}
                streamingPreview={streamingPreview}
                onRuntimeError={handleAnythingRuntimeError}
              />
            ) : contentType === 'forms' ? (
              // The A2UI surface renders native form controls and owns its own
              // scrolling — no pan/zoom transform layer over interactive inputs.
              <FormsRenderer
                key={`forms-${rendererRefreshKey}`}
                diagramSource={editorSource}
                streamingPreview={streamingPreview}
                busy={Boolean(streamingPreview || agentThinking)}
                onFormSubmit={onFormSubmit}
              />
            ) : (
              <div ref={zoomLayerRef} className="diagram-zoom-layer" style={zoomLayerStyle}>
                {contentType === 'infographic' ? (
                  <InfographicRenderer
                    key={`infographic-${rendererRefreshKey}`}
                    diagramSource={editorSource}
                    selectedNode={selectedNode}
                    streamingPreview={streamingPreview}
                  />
                ) : contentType === 'chart' ? (
                  <ChartRenderer
                    key={`chart-${rendererRefreshKey}`}
                    diagramSource={editorSource}
                    selectedNode={selectedNode}
                  />
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: svgMarkup }} />
                )}
              </div>
            )}
          </div>
          <DiagramRunFx
            variant={runFx?.variant}
            streaming={Boolean(runFx?.streaming)}
            intensity={runFx?.intensity || 'normal'}
          />
        </div>
      </div>

      {stackEditorInNotebook ? (
        <div className="diagram-side-stack" data-testid="diagram-side-stack">
          {insightsSlot}
          {editorPanel}
        </div>
      ) : (
        <>
          {insightsSlot}
          {editorPanel}
        </>
      )}
    </section>
  );
}
