import DiagramFullscreenOverlay from '../../components/DiagramFullscreenOverlay.jsx';
import RadialActionMenu from '../../components/RadialActionMenu.jsx';
import SlopNextPrompt from '../../components/SlopNextPrompt.jsx';
import { playRichardBoot } from '../../utils/agentChimes.js';

/**
 * Fullscreen radial menu overlay with optional inline slop-next prompt.
 */
export function RadialMenuSlot({
  isFullscreen,
  diagramSurfaceRef,
  toggleFullscreen,
  radialMenuSession,
  radialActions,
  busy,
  diagramSource,
  contentType,
  sessionId,
  slopPromptExpanded,
  slopPromptSource,
  slopNextPrompt,
  voiceSupported,
  voiceListening,
  narrowLayout,
  speechRecognitionCtor,
  PromptIcon,
  MicIcon,
  MicActiveIcon,
  ButtonIcon,
  promptCopy,
  onSlopPromptClose,
  onPromptChange,
  onSlopPromptSubmit,
  onMicToggleClick,
  onMicPointerDown,
  onMicPointerUp,
  onMicLostPointerCapture,
  onActionPick,
  onDrillDeeper,
  setSelectedNode,
  closeRadialMenu,
  setBootSeq,
  tryAgentSound,
  runAnalyze,
  cancelMenuClose,
  scheduleMenuClose,
  dismissRadialMenu,
  onAdvisorUsage
}) {
  return (
    <DiagramFullscreenOverlay
      isFullscreen={isFullscreen}
      host={diagramSurfaceRef.current}
      onExit={toggleFullscreen}
    >
      <RadialActionMenu
        key={radialMenuSession?.descriptor?.id ?? 'radial-closed'}
        descriptor={radialMenuSession?.descriptor ?? null}
        anchor={radialMenuSession?.anchor ?? null}
        actions={radialActions}
        busy={busy}
        diagramSource={diagramSource}
        contentType={contentType}
        sessionId={sessionId}
        slopPromptOpen={slopPromptExpanded && slopPromptSource === 'radial'}
        onSlopPromptClose={onSlopPromptClose}
        slopPrompt={
          slopPromptExpanded && slopPromptSource === 'radial' ? (
            <SlopNextPrompt
              layout="radial"
              prompt={slopNextPrompt}
              busy={busy}
              voiceSupported={voiceSupported}
              voiceListening={voiceListening}
              narrowLayout={narrowLayout}
              speechRecognitionCtor={speechRecognitionCtor}
              PromptIcon={PromptIcon}
              MicIcon={MicIcon}
              MicActiveIcon={MicActiveIcon}
              ButtonIcon={ButtonIcon}
              copy={promptCopy}
              selectionName={
                radialMenuSession?.descriptor?.partName ||
                radialMenuSession?.descriptor?.label ||
                radialMenuSession?.descriptor?.clickedLabel ||
                ''
              }
              onPromptChange={onPromptChange}
              onSubmit={onSlopPromptSubmit}
              onClose={onSlopPromptClose}
              onMicToggleClick={onMicToggleClick}
              onMicPointerDown={onMicPointerDown}
              onMicPointerUp={onMicPointerUp}
              onMicLostPointerCapture={onMicLostPointerCapture}
            />
          ) : null
        }
        onActionPick={onActionPick}
        onDrillDeeper={(descriptor) => {
          if (!descriptor) return;
          setSelectedNode(descriptor);
          closeRadialMenu();
          setBootSeq((prev) => ({ trigger: prev.trigger + 1, variant: 'richard' }));
          tryAgentSound(playRichardBoot);
          runAnalyze('richard', { focusTarget: descriptor });
        }}
        onHoverHold={cancelMenuClose}
        onHoverRelease={scheduleMenuClose}
        onBackdropPointerDown={() => {
          if (slopPromptExpanded && slopPromptSource === 'radial') {
            onSlopPromptClose();
            return;
          }
          dismissRadialMenu();
        }}
        onClose={closeRadialMenu}
        onAdvisorUsage={onAdvisorUsage}
      />
    </DiagramFullscreenOverlay>
  );
}
