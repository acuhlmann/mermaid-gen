import { useRef, useState } from 'react';
import { fallbackState, readDiagramCache } from '../../state/diagramStore.js';
import { getCachedAgentCostEstimates } from '../../state/agentCostEstimates';
import {
  createInitialState as createInitialGamificationState,
  readFromStorage as readGamificationFromStorage
} from '../../state/runGamificationStore.js';
import { ensureUrlBackedSession, readStoredModelProfile } from '../../utils/appSessionLocation.js';
import { SpeechRecognitionCtor } from '../../utils/appConstants.js';
import { useInsightsLedger } from '../insights/useInsightsLedger.js';

/**
 * Session bootstrap, core React state, and shared refs for the app shell.
 */
export function useArchiSlopSessionState({ controls }) {
  const initialSessionIdRef = useRef(null);
  const freshlyMintedSessionIdsRef = useRef(new Set());
  const sessionIdFromUrlRef = useRef(false);
  if (initialSessionIdRef.current == null) {
    const { sessionId: bootId, fromUrl } = ensureUrlBackedSession();
    initialSessionIdRef.current = bootId;
    sessionIdFromUrlRef.current = fromUrl;
    if (!fromUrl) freshlyMintedSessionIdsRef.current.add(bootId);
  }

  const [activeSessionId, setActiveSessionId] = useState(initialSessionIdRef.current);
  const cacheRef = useRef(
    sessionIdFromUrlRef.current ? null : readDiagramCache(initialSessionIdRef.current)
  );
  const [state, setState] = useState(fallbackState);
  const [prompt, setPrompt] = useState('');
  const [slopNextPrompt, setSlopNextPrompt] = useState('');
  const [deskPrompt, setDeskPrompt] = useState('');
  const deskPromptRef = useRef('');
  const slopNextPromptRef = useRef('');
  const [loading, setLoading] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [error, setError] = useState('');
  const [streamingPreview, setStreamingPreview] = useState(false);
  const [liveDraftSource, setLiveDraftSource] = useState('');
  const [liveDraftContentType, setLiveDraftContentType] = useState(null);
  const [editorOpen, setEditorOpen] = useState(Boolean(cacheRef.current?.editorOpen));
  const [insightsOpen, setInsightsOpen] = useState(Boolean(cacheRef.current?.insightsOpen));
  const {
    insightsEntries,
    setInsightsEntries,
    insightsEntriesRef,
    appendInsightEntry,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    enrichTechnicalActionDetail,
    finalizeTechnicalActionResult,
    annotateTechnicalActionResult,
    appendStreamDebugLog
  } = useInsightsLedger({
    initialEntries: Array.isArray(cacheRef.current?.insightsEntries)
      ? cacheRef.current.insightsEntries
      : [],
    workingStatusText: controls.loading.working
  });

  const [soundEnabled, setSoundEnabled] = useState(cacheRef.current?.soundEnabled ?? true);
  const [modelProfile, setModelProfile] = useState(() => readStoredModelProfile());
  const [officeRunSignal, setOfficeRunSignal] = useState(null);
  const [latestCritique, setLatestCritique] = useState(() => {
    const cachedCritique = cacheRef.current?.latestCritique;
    return cachedCritique?.text ? cachedCritique : null;
  });
  const [critiqueActionableSelected, setCritiqueActionableSelected] = useState([]);
  const [russStreak, setRussStreak] = useState(0);
  const [gamification, setGamification] = useState(() => {
    if (typeof window === 'undefined') return createInitialGamificationState();
    return readGamificationFromStorage(window.localStorage) ?? createInitialGamificationState();
  });
  const [xpBarMobileOpen, setXpBarMobileOpen] = useState(false);
  const [xpInfoPanelOpen, setXpInfoPanelOpen] = useState(false);
  const [settingsOpenSignal, setSettingsOpenSignal] = useState(0);
  const [callMeetingSignal, setCallMeetingSignal] = useState(0);
  const [huddleSignal, setHuddleSignal] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hotkeyOverlayOpen, setHotkeyOverlayOpen] = useState(false);
  const [hoverDescriptor, setHoverDescriptor] = useState(null);
  const [toolbarAnchor, setToolbarAnchor] = useState(null);
  const [voiceSupported] = useState(() =>
    Boolean(
      SpeechRecognitionCtor &&
      (typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : true)
    )
  );
  const [slopPromptExpanded, setSlopPromptExpanded] = useState(false);
  const [slopPromptSource, setSlopPromptSource] = useState(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const syncTimerRef = useRef(null);
  const streamTimerRef = useRef(null);
  const streamAgentAbortRef = useRef(null);
  const agentCostEstimatesRef = useRef(getCachedAgentCostEstimates());
  const autoCloseActiveEntryIdRef = useRef(null);
  const stateRef = useRef(state);
  const loadingRef = useRef(false);
  const submitIntentWithPromptRef = useRef(null);
  const closeRadialMenuRef = useRef(null);
  const streamingPreviewRef = useRef(false);
  const lastDraftTickAtRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const audioContextRef = useRef(null);
  const celebrationTimerRef = useRef(null);
  const promptRef = useRef('');
  const hasCanvasContentRef = useRef(false);
  const slopPromptExpandedRef = useRef(false);
  const slopPromptSourceRef = useRef(null);
  const lastTokenSoundAtRef = useRef(0);
  const russTokenTickIndexRef = useRef(0);
  const sessionTopicRef = useRef(null);
  const [sessionHasPeerContent, setSessionHasPeerContent] = useState(false);
  const syncDiagramOrThrowRef = useRef(async () => {
    throw new Error('syncDiagramOrThrow not ready');
  });
  const tryAgentSoundRef = useRef(null);

  return {
    activeSessionId,
    setActiveSessionId,
    cacheRef,
    state,
    setState,
    prompt,
    setPrompt,
    slopNextPrompt,
    setSlopNextPrompt,
    deskPrompt,
    setDeskPrompt,
    deskPromptRef,
    slopNextPromptRef,
    loading,
    setLoading,
    activeRequest,
    setActiveRequest,
    error,
    setError,
    streamingPreview,
    setStreamingPreview,
    liveDraftSource,
    setLiveDraftSource,
    liveDraftContentType,
    setLiveDraftContentType,
    editorOpen,
    setEditorOpen,
    insightsOpen,
    setInsightsOpen,
    insightsEntries,
    setInsightsEntries,
    insightsEntriesRef,
    appendInsightEntry,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    enrichTechnicalActionDetail,
    finalizeTechnicalActionResult,
    annotateTechnicalActionResult,
    appendStreamDebugLog,
    soundEnabled,
    setSoundEnabled,
    modelProfile,
    setModelProfile,
    officeRunSignal,
    setOfficeRunSignal,
    latestCritique,
    setLatestCritique,
    critiqueActionableSelected,
    setCritiqueActionableSelected,
    russStreak,
    setRussStreak,
    gamification,
    setGamification,
    xpBarMobileOpen,
    setXpBarMobileOpen,
    xpInfoPanelOpen,
    setXpInfoPanelOpen,
    settingsOpenSignal,
    setSettingsOpenSignal,
    callMeetingSignal,
    huddleSignal,
    setCallMeetingSignal,
    setHuddleSignal,
    selectedNode,
    setSelectedNode,
    hotkeyOverlayOpen,
    setHotkeyOverlayOpen,
    hoverDescriptor,
    setHoverDescriptor,
    toolbarAnchor,
    setToolbarAnchor,
    voiceSupported,
    slopPromptExpanded,
    setSlopPromptExpanded,
    slopPromptSource,
    setSlopPromptSource,
    clearConfirmOpen,
    setClearConfirmOpen,
    syncTimerRef,
    streamTimerRef,
    streamAgentAbortRef,
    agentCostEstimatesRef,
    autoCloseActiveEntryIdRef,
    stateRef,
    loadingRef,
    submitIntentWithPromptRef,
    closeRadialMenuRef,
    streamingPreviewRef,
    lastDraftTickAtRef,
    hasInteractedRef,
    audioContextRef,
    celebrationTimerRef,
    promptRef,
    hasCanvasContentRef,
    slopPromptExpandedRef,
    slopPromptSourceRef,
    lastTokenSoundAtRef,
    russTokenTickIndexRef,
    sessionTopicRef,
    sessionHasPeerContent,
    setSessionHasPeerContent,
    syncDiagramOrThrowRef,
    tryAgentSoundRef,
    freshlyMintedSessionIdsRef,
    sessionIdFromUrlRef
  };
}
