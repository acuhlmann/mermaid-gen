import { useCallback, useMemo } from 'react';
import { useCoarsePointer } from '../../hooks/useAppLayoutMedia.js';
import { useDiagramHotkeys } from '../../hooks/useDiagramHotkeys.js';
import { buildRadialActions } from '../../components/buildRadialActions.jsx';
import {
  playJaredBoot,
  playDineshBoot,
  playErlichBoot,
  playRichardBoot,
  playRussBoot,
  playGilfoyleBoot
} from '../../utils/agentChimes.js';

/**
 * Radial menu action dispatch, hotkey wiring, and action list derivation.
 *
 * @param {{
 *   busy: boolean;
 *   canFixFromCritique: boolean;
 *   closeRadialMenu: () => void;
 *   contentMode: string;
 *   contentModeOptions: Array<object>;
 *   controls: object;
 *   russStreak: number;
 *   handleFixFromCritique: (scope: string) => void;
 *   openRadialSlopPrompt: () => void;
 *   radialMenuVisible: boolean;
 *   renderSelectionInMode: (mode: string, descriptor: object) => void;
 *   runAnalyze: (mode: string, opts?: object) => void;
 *   runTransform: (mode: string, opts?: object) => void;
 *   selectedNode: object | null;
 *   setBootSeq: import('react').Dispatch<import('react').SetStateAction<object>>;
 *   setHotkeyOverlayOpen: import('react').Dispatch<import('react').SetStateAction<boolean>>;
 *   setSelectedNode: (node: object | null) => void;
 *   slopitect: object;
 *   tryAgentSound: (playFn: (ctx: unknown) => void) => void;
 *   graphEdit?: { enabled?: boolean, kind?: string | null, busy?: boolean } | null;
 *   onGraphEditAction?: (action: { id: string }, descriptor: object) => void;
 * }} deps
 */
export function useRadialActionHandler({
  busy,
  canFixFromCritique,
  closeRadialMenu,
  contentMode,
  contentModeOptions,
  controls,
  russStreak,
  handleFixFromCritique,
  openRadialSlopPrompt,
  radialMenuVisible,
  renderSelectionInMode,
  runAnalyze,
  runTransform,
  selectedNode,
  setBootSeq,
  setHotkeyOverlayOpen,
  setSelectedNode,
  slopitect,
  tryAgentSound,
  graphEdit = null,
  onGraphEditAction = null
}) {
  const touchGraphEdit = useCoarsePointer();

  const handleRadialAction = useCallback(
    (action, descriptor) => {
      if (!descriptor) return;
      setSelectedNode(descriptor);
      if (action.id === 'prompt') {
        openRadialSlopPrompt();
        return;
      }
      if (
        action.id === 'connect' ||
        action.id === 'link' ||
        action.id === 'delete' ||
        action.id === 'rename'
      ) {
        onGraphEditAction?.(action, descriptor);
        return;
      }
      if (action.id === 'renderMode') {
        renderSelectionInMode(action.targetMode, descriptor);
        return;
      }
      closeRadialMenu();
      const runOpts = { focusTarget: descriptor };
      const variantForBoot =
        action.id === 'gilfoyle' ||
        action.id === 'dinesh' ||
        action.id === 'erlich' ||
        action.id === 'russ' ||
        action.id === 'jared' ||
        action.id === 'richard' ||
        action.id === 'barker'
          ? action.id
          : null;
      if (variantForBoot) {
        setBootSeq((prev) => ({ trigger: prev.trigger + 1, variant: variantForBoot }));
        if (variantForBoot === 'gilfoyle') tryAgentSound(playGilfoyleBoot);
        else if (variantForBoot === 'dinesh') tryAgentSound(playDineshBoot);
        else if (variantForBoot === 'erlich') tryAgentSound(playErlichBoot);
        else if (variantForBoot === 'russ') tryAgentSound(playRussBoot);
        else if (variantForBoot === 'jared') tryAgentSound(playJaredBoot);
        else if (variantForBoot === 'richard') tryAgentSound(playRichardBoot);
      }
      if (action.id === 'gilfoyle') runTransform('gilfoyle', runOpts);
      else if (action.id === 'dinesh') runTransform('dinesh', runOpts);
      else if (action.id === 'erlich') runTransform('erlich', runOpts);
      else if (action.id === 'russ') runTransform('russ', runOpts);
      else if (action.id === 'barker') runTransform('barker', runOpts);
      else if (action.id === 'jared') runAnalyze('jared', runOpts);
      else if (action.id === 'richard') runAnalyze('richard', runOpts);
      else if (action.id === 'fix') handleFixFromCritique('all');
    },
    [
      closeRadialMenu,
      handleFixFromCritique,
      onGraphEditAction,
      openRadialSlopPrompt,
      renderSelectionInMode,
      runAnalyze,
      runTransform,
      setBootSeq,
      setSelectedNode,
      tryAgentSound
    ]
  );

  useDiagramHotkeys({
    enabled: Boolean(radialMenuVisible && selectedNode && !busy),
    descriptor: selectedNode,
    onAction: handleRadialAction,
    onToggleHelp: () => setHotkeyOverlayOpen((v) => !v)
  });

  const radialActions = useMemo(
    () =>
      buildRadialActions({
        controls,
        slopitect,
        russStreak,
        contentMode,
        contentModeOptions,
        canFixFromCritique,
        graphEdit,
        touchGraphEdit
      }),
    [
      canFixFromCritique,
      contentMode,
      contentModeOptions,
      controls,
      graphEdit,
      russStreak,
      slopitect,
      touchGraphEdit
    ]
  );

  return { handleRadialAction, radialActions };
}
