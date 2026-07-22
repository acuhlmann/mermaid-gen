import { useCallback, useEffect, useRef, useState } from 'react';
import { readModeRevealSeen, writeModeRevealSeen } from '../../utils/modeRevealStorage.js';
import {
  readEntryDeskIntroSeen,
  writeEntryDeskIntroSeen
} from '../../utils/officeAmbienceStorage.js';

/** First-run desk tour after Meet the Office — reveal real chrome, then walk Deliverable format via the desk tray. */
export const ENTRY_TOUR_STEPS = ['welcome', 'work-order', 'desk', 'team', 'format'];

const ENTRY_TOUR_STEP_MS = {
  welcome: 2_400,
  'work-order': 4_200,
  desk: 4_200,
  team: 4_200,
  format: 10_000
};

function stepIndex(step) {
  return ENTRY_TOUR_STEPS.indexOf(step);
}

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
  const [entryTourStep, setEntryTourStep] = useState(() =>
    readEntryDeskIntroSeen() ? null : 'welcome'
  );

  const modeRevealSeenRef = useRef(readModeRevealSeen());
  const [modeRevealActive, setModeRevealActive] = useState(false);
  const modeRevealTimerRef = useRef(null);

  const showEntryDeskIntro = !hasCanvasContent && !insightsOpen && !entryDeskIntroSeen;
  const showEntryDeskPointers = showEntryDeskIntro && entryTourStep != null;
  // Keep the desk helmet on the bottom row even when the notebook is open —
  // concentration lives in the Thinking header instead of relocating Your desk.
  const showDeskChrome = true;

  const revealedFrom = (step) => {
    if (!showEntryDeskIntro) return true;
    // Tour finished (skipped or timed out) — keep the full end-state chrome.
    if (entryTourStep == null) return true;
    return stepIndex(entryTourStep) >= stepIndex(step);
  };

  // After the welcome beat, mount the full end-state desk (Work order · Your desk ·
  // Your Team · Desk tray). Tips then walk the real controls; only the tray menu
  // auto-opens on the format step.
  const showFullDesk = revealedFrom('work-order');
  const entryReveal = {
    workOrder: showFullDesk,
    desk: showFullDesk,
    team: showFullDesk,
    notebook: showFullDesk,
    drawer: showFullDesk
  };

  const deskDrawerTourOpen = showEntryDeskIntro && entryTourStep === 'format';

  const markEntryDeskIntroSeen = useCallback(() => {
    if (entryDeskIntroSeen) return;
    writeEntryDeskIntroSeen();
    setEntryDeskIntroSeen(true);
    setEntryTourStep(null);
  }, [entryDeskIntroSeen]);

  const dismissEntryDeskPointers = useCallback(() => {
    setEntryTourStep(null);
  }, []);

  const advanceEntryTour = useCallback(() => {
    setEntryTourStep((current) => {
      if (current == null) return null;
      const i = stepIndex(current);
      if (i < 0 || i >= ENTRY_TOUR_STEPS.length - 1) return null;
      return ENTRY_TOUR_STEPS[i + 1];
    });
  }, []);

  useEffect(() => {
    if (!hasCanvasContent || !hasInteractedRef.current) return;
    markEntryDeskIntroSeen();
  }, [hasCanvasContent, hasInteractedRef, markEntryDeskIntroSeen]);

  useEffect(() => {
    if (!showEntryDeskIntro || entryTourStep == null) return undefined;
    const ms = ENTRY_TOUR_STEP_MS[entryTourStep] ?? 4_000;
    const timer = setTimeout(() => {
      setEntryTourStep((current) => {
        if (current !== entryTourStep) return current;
        const i = stepIndex(current);
        if (i < 0 || i >= ENTRY_TOUR_STEPS.length - 1) return null;
        return ENTRY_TOUR_STEPS[i + 1];
      });
    }, ms);
    return () => clearTimeout(timer);
  }, [showEntryDeskIntro, entryTourStep]);

  const handleEntryModePick = useCallback(
    (nextMode) => {
      handleSelectContentMode(nextMode);
      if (!modeRevealSeenRef.current) {
        modeRevealSeenRef.current = true;
        writeModeRevealSeen();
      }
      if (entryTourStep === 'format') {
        setEntryTourStep(null);
      }
    },
    [handleSelectContentMode, entryTourStep]
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
    entryTourStep,
    entryReveal,
    deskDrawerTourOpen,
    dismissEntryDeskPointers,
    advanceEntryTour,
    handleEntryModePick,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick
  };
}
