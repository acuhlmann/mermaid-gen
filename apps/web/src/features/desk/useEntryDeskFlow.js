import { useCallback, useEffect, useRef, useState } from 'react';
import { readModeRevealSeen, writeModeRevealSeen } from '../../utils/modeRevealStorage.js';
import {
  readEntryDeskIntroSeen,
  writeEntryDeskIntroSeen
} from '../../utils/officeAmbienceStorage.js';

/**
 * Entry-desk onboarding: first-run intro/pointers and post-first-diagram mode reveal.
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
  hasCanvasContent,
  hasDiagramText,
  insightsOpen,
  stakeholderIntroProps,
  editorOpen,
  hasInteractedRef,
  handleSelectContentMode
}) {
  const [entryDeskIntroSeen, setEntryDeskIntroSeen] = useState(() => readEntryDeskIntroSeen());
  const [entryDeskPointersActive, setEntryDeskPointersActive] = useState(
    () => !readEntryDeskIntroSeen()
  );

  const modeRevealSeenRef = useRef(readModeRevealSeen());
  const [modeRevealActive, setModeRevealActive] = useState(false);
  const modeRevealTimerRef = useRef(null);

  const showEntryDeskIntro = !hasCanvasContent && !insightsOpen && !entryDeskIntroSeen;
  const showEntryDeskPointers = showEntryDeskIntro && entryDeskPointersActive;
  const showDeskChrome = hasCanvasContent || showEntryDeskIntro;

  const markEntryDeskIntroSeen = useCallback(() => {
    if (entryDeskIntroSeen) return;
    writeEntryDeskIntroSeen();
    setEntryDeskIntroSeen(true);
    setEntryDeskPointersActive(false);
  }, [entryDeskIntroSeen]);

  const dismissEntryDeskPointers = useCallback(() => {
    setEntryDeskPointersActive(false);
  }, []);

  useEffect(() => {
    if (!hasCanvasContent || !hasInteractedRef.current) return;
    markEntryDeskIntroSeen();
  }, [hasCanvasContent, hasInteractedRef, markEntryDeskIntroSeen]);

  const handleEntryRenderAsPick = useCallback(
    (nextMode) => {
      handleSelectContentMode(nextMode);
      if (!modeRevealSeenRef.current) {
        modeRevealSeenRef.current = true;
        writeModeRevealSeen();
      }
    },
    [handleSelectContentMode]
  );

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
    showEntryDeskIntro,
    showEntryDeskPointers,
    showDeskChrome,
    dismissEntryDeskPointers,
    handleEntryRenderAsPick,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick
  };
}
