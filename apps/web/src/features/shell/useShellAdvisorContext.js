import { useRef, useSyncExternalStore } from 'react';
import { useDiagramFullscreen } from '../../hooks/useDiagramFullscreen.js';
import {
  getOfficeDirectoryUi,
  subscribeOfficeDirectoryUi
} from '../../state/officeDirectoryUiStore.js';
import { subscribe as subscribeUserName, resolveUserName } from '../../state/userIdentityStore.js';
import { useAdvisorPause } from '../advisor/useAdvisorPause.js';
import { useAdvisorShell } from '../advisor/useAdvisorShell.js';
import { useEntryDeskFlow } from '../desk/useEntryDeskFlow.js';
import { useOfficeBoot } from '../desk/useOfficeBoot.js';

/**
 * Canvas viewport, office boot, advisor shell, and entry-desk flow wiring.
 */
export function useShellAdvisorContext({
  activeSessionId,
  clearConfirmOpen,
  contentMode,
  controls,
  editorOpen,
  handleSelectContentMode,
  hoverDescriptor,
  insightsEntries,
  insightsOpen,
  liveDraftContentType,
  liveDraftSource,
  loading,
  narrowLayout,
  reportAdvisorUsage,
  runAnalyze,
  runTransform,
  selectedNode,
  sessionHasPeerContent,
  slopPromptExpanded,
  state,
  stateRef,
  streamingPreview,
  submitIntentWithPrompt,
  voiceListening
}) {
  const diagramSurfaceRef = useRef(null);
  const { fullscreenSupported, isFullscreen, toggleFullscreen } =
    useDiagramFullscreen(diagramSurfaceRef);

  const officeDirectoryUi = useSyncExternalStore(
    subscribeOfficeDirectoryUi,
    getOfficeDirectoryUi,
    getOfficeDirectoryUi
  );

  const hasDiagramText = Boolean(state.diagramSource?.trim());
  const hasCanvasContent = hasDiagramText || sessionHasPeerContent;

  const {
    officeBootPending,
    officeCanvasGrace,
    deskTourPending,
    handleOfficeBootComplete,
    completeDeskTour
  } = useOfficeBoot({
    hasCanvasContent
  });

  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);

  const { advisorPause, officeDistractionsPaused } = useAdvisorPause({
    clearConfirmOpen,
    contentMode,
    editorOpen,
    insightsEntries,
    insightsOpen,
    isFullscreen,
    liveDraftContentType,
    liveDraftSource,
    loading,
    narrowLayout,
    officeCanvasGrace,
    officeDirectoryOpen: officeDirectoryUi.open,
    slopPromptExpanded,
    streamingPreview,
    voiceListening
  });

  const { advisor, advisorBubbleProps, stakeholderIntroProps } = useAdvisorShell({
    selectedNode,
    hoverDescriptor,
    stateRef,
    contentMode,
    activeSessionId,
    advisorPause,
    controls,
    diagramRevisionId: state.revisionId,
    diagramSource: state.diagramSource,
    runTransform,
    runAnalyze,
    submitIntentWithPrompt,
    reportAdvisorUsage
  });

  const {
    showDeskChrome,
    entryReveal,
    entryTourActive,
    entryTourStep,
    entryTourProgress,
    showEntryDeskIntro,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick,
    advanceEntryTour,
    dismissEntryDeskTour
  } = useEntryDeskFlow({
    hasDiagramText,
    insightsOpen,
    stakeholderIntroProps,
    editorOpen,
    handleSelectContentMode,
    deskTourPending,
    onDeskTourComplete: completeDeskTour,
    entryPointers: controls.prompt.entryPointers ?? []
  });

  const showEmptyCanvas =
    !hasCanvasContent &&
    !insightsOpen &&
    !editorOpen &&
    !officeBootPending &&
    !modeRevealActive &&
    !isFullscreen &&
    !loading;

  const entryTourCopy = {
    ...(controls.prompt.entryTour ?? {}),
    deskEyebrow: controls.prompt.entryIntro?.deskEyebrow ?? 'Your desk'
  };

  return {
    diagramSurfaceRef,
    fullscreenSupported,
    isFullscreen,
    toggleFullscreen,
    hasDiagramText,
    hasCanvasContent,
    officeBootPending,
    officeCanvasGrace,
    handleOfficeBootComplete,
    userName,
    advisorPause,
    officeDistractionsPaused,
    advisor,
    advisorBubbleProps,
    stakeholderIntroProps,
    showDeskChrome,
    entryReveal,
    entryTourActive,
    entryTourStep,
    entryTourProgress,
    showEntryDeskIntro,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick,
    advanceEntryTour,
    dismissEntryDeskTour,
    showEmptyCanvas,
    entryTourCopy
  };
}
