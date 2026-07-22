import { useCallback, useEffect, useRef, useState } from 'react';
import { readModeRevealSeen, writeModeRevealSeen } from '../../utils/modeRevealStorage.js';

const FULL_DESK_REVEAL = {
  workOrder: true,
  desk: true,
  team: true,
  notebook: true,
  drawer: true
};

/**
 * Post-first-diagram mode reveal spotlight. Desk-control onboarding now lives in
 * Meet the Office (OfficeDirectory) instead of a separate empty-canvas tour.
 *
 * @param {{
 *   hasCanvasContent: boolean;
 *   hasDiagramText: boolean;
 *   insightsOpen: boolean;
 *   stakeholderIntroProps: object | null;
 *   editorOpen: boolean;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   handleSelectContentMode: (mode: string) => void;
 * }} deps
 */
export function useEntryDeskFlow({
  hasDiagramText,
  insightsOpen,
  stakeholderIntroProps,
  editorOpen,
  handleSelectContentMode
}) {
  const modeRevealSeenRef = useRef(readModeRevealSeen());
  const [modeRevealActive, setModeRevealActive] = useState(false);
  const modeRevealTimerRef = useRef(null);

  const showDeskChrome = true;

  const dismissModeReveal = useCallback(() => {
    if (modeRevealTimerRef.current) {
      clearTimeout(modeRevealTimerRef.current);
      modeRevealTimerRef.current = null;
    }
    setModeRevealActive(false);
  }, []);

  useEffect(() => {
    if (modeRevealSeenRef.current) return;
    if (!hasDiagramText) return;
    if (stakeholderIntroProps || editorOpen || insightsOpen) return;
    modeRevealSeenRef.current = true;
    writeModeRevealSeen();
    setModeRevealActive(true);
    modeRevealTimerRef.current = setTimeout(() => {
      modeRevealTimerRef.current = null;
      setModeRevealActive(false);
    }, 18_000);
  }, [hasDiagramText, stakeholderIntroProps, editorOpen, insightsOpen]);

  useEffect(
    () => () => {
      if (modeRevealTimerRef.current) clearTimeout(modeRevealTimerRef.current);
    },
    []
  );

  const handleModeRevealPick = useCallback(
    (nextMode) => {
      handleSelectContentMode(nextMode);
      dismissModeReveal();
    },
    [handleSelectContentMode, dismissModeReveal]
  );

  return {
    showDeskChrome,
    entryReveal: FULL_DESK_REVEAL,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick
  };
}
