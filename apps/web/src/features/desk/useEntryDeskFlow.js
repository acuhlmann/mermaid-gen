import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { readModeRevealSeen, writeModeRevealSeen } from '../../utils/modeRevealStorage.js';

const FULL_DESK_REVEAL = {
  workOrder: true,
  desk: true,
  team: true,
  notebook: true
};

/** Tour steps after the welcome beat on the empty canvas. */
export const ENTRY_DESK_TOUR_STEPS = ['work-order', 'desk', 'notebook', 'team', 'format'];

/** Auto-advance past the welcome card so newcomers land on the work-order tip. */
export const ENTRY_WELCOME_AUTO_MS = 3_200;

/**
 * The `format` step no longer reveals a piece of the bottom row — Deliverable
 * format is a menu-bar item now, so the last beat points *up* while the desk row
 * stays fully revealed behind it.
 */
function revealForTourStep(step) {
  if (!step || step === 'welcome') return FULL_DESK_REVEAL;
  return {
    workOrder: true,
    desk: ['desk', 'notebook', 'team', 'format'].includes(step),
    notebook: ['notebook', 'team', 'format'].includes(step),
    team: ['team', 'format'].includes(step)
  };
}

/**
 * Post-first-diagram mode reveal spotlight plus the first-run desk-control tour
 * that starts after Meet the Office dismisses onto the real empty-canvas desk.
 *
 * @param {{
 *   hasDiagramText: boolean;
 *   insightsOpen: boolean;
 *   stakeholderIntroProps: object | null;
 *   editorOpen: boolean;
 *   hasInteractedRef: import('react').MutableRefObject<boolean>;
 *   handleSelectContentMode: (mode: string) => void;
 *   deskTourPending?: boolean;
 *   onDeskTourComplete?: () => void;
 *   entryPointers?: Array<{ id?: string; label?: string; text?: string }>;
 * }} deps
 */
export function useEntryDeskFlow({
  hasDiagramText,
  insightsOpen,
  stakeholderIntroProps,
  editorOpen,
  handleSelectContentMode,
  deskTourPending = false,
  onDeskTourComplete,
  entryPointers = []
}) {
  const modeRevealSeenRef = useRef(readModeRevealSeen());
  const [modeRevealActive, setModeRevealActive] = useState(false);
  const modeRevealTimerRef = useRef(null);
  const [entryTourStep, setEntryTourStep] = useState(null);
  const deskTourStartedRef = useRef(false);

  const pointerSteps = useMemo(
    () =>
      (Array.isArray(entryPointers) ? entryPointers : [])
        .map((pointer) => pointer?.id)
        .filter((id) => typeof id === 'string' && id.length > 0),
    [entryPointers]
  );

  const showDeskChrome = true;
  const entryTourActive = entryTourStep != null;
  const showEntryDeskIntro = entryTourStep === 'welcome';

  useEffect(() => {
    if (!deskTourPending || deskTourStartedRef.current) return;
    deskTourStartedRef.current = true;
    setEntryTourStep('welcome');
  }, [deskTourPending]);

  // Smooth handoff from the floor: leave the welcome card briefly, then put the
  // spotlight on the work order — the actual "what to do next".
  useEffect(() => {
    if (entryTourStep !== 'welcome') return undefined;
    const timer = setTimeout(() => {
      setEntryTourStep((current) => {
        if (current !== 'welcome') return current;
        return pointerSteps[0] ?? null;
      });
    }, ENTRY_WELCOME_AUTO_MS);
    return () => clearTimeout(timer);
  }, [entryTourStep, pointerSteps]);

  const dismissEntryDeskTour = useCallback(() => {
    setEntryTourStep(null);
    onDeskTourComplete?.();
  }, [onDeskTourComplete]);

  const advanceEntryTour = useCallback(() => {
    setEntryTourStep((current) => {
      if (current == null) return current;
      if (current === 'welcome') {
        return pointerSteps[0] ?? null;
      }
      const index = pointerSteps.indexOf(current);
      if (index < 0 || index >= pointerSteps.length - 1) {
        onDeskTourComplete?.();
        return null;
      }
      return pointerSteps[index + 1];
    });
  }, [onDeskTourComplete, pointerSteps]);

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

  const entryReveal = entryTourActive ? revealForTourStep(entryTourStep) : FULL_DESK_REVEAL;
  const tourHighlight = entryTourActive && entryTourStep !== 'welcome' ? entryTourStep : null;
  const entryTourProgress =
    entryTourStep && entryTourStep !== 'welcome'
      ? {
          index: Math.max(0, pointerSteps.indexOf(entryTourStep)),
          total: pointerSteps.length
        }
      : null;

  return {
    showDeskChrome,
    entryReveal,
    entryTourActive,
    entryTourStep,
    entryTourProgress,
    showEntryDeskIntro,
    tourHighlight,
    advanceEntryTour,
    dismissEntryDeskTour,
    modeRevealActive,
    dismissModeReveal,
    handleModeRevealPick
  };
}
