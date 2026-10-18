import { useCallback, useEffect, useState } from 'react';
import {
  readOfficeDirectorySeen,
  readPreferredViewMode,
  writeDayOneBadgeSeen,
  writeEntryDeskIntroSeen,
  writePreferredViewMode
} from '../../utils/officeAmbienceStorage.js';
import { OFFICE_CANVAS_GRACE_MS } from '../../utils/officeCanvasGrace.js';

/**
 * Prompt-studio gate, then the optional Meet-the-Office ceremony.
 *
 * Visits open on the simple prompt (`studioActive`) unless Office was the
 * last saved choice and orientation is complete. Picking Office or Simple
 * saves that preference for later visits.
 * The floor ceremony starts only from `enterOfficeLife`, and only for people
 * who have not finished orientation; everyone else goes straight to the desk.
 *
 * @param {{ hasCanvasContent: boolean }} deps
 */
export function useOfficeBoot({ hasCanvasContent }) {
  const [studioActive, setStudioActive] = useState(
    () => readPreferredViewMode() !== 'office' || !readOfficeDirectorySeen()
  );
  const [officeBootPending, setOfficeBootPending] = useState(false);
  const [officeCanvasGrace, setOfficeCanvasGrace] = useState(false);
  const [deskTourPending, setDeskTourPending] = useState(false);

  /** Save the Office preference and open orientation if it is unfinished. */
  const enterOfficeLife = useCallback(() => {
    writePreferredViewMode('office');
    setStudioActive(false);
    if (!readOfficeDirectorySeen()) setOfficeBootPending(true);
  }, []);

  /** Save the Simple preference and return to the one-prompt screen. State
   * (diagram, session) lives above this hook, so nothing is lost in either
   * direction. */
  const enterSimpleStudio = useCallback(() => {
    writePreferredViewMode('simple');
    setOfficeBootPending(false);
    setStudioActive(true);
  }, []);

  const handleOfficeBootComplete = useCallback((options = {}) => {
    setStudioActive(false);
    setOfficeBootPending(false);
    writeDayOneBadgeSeen();
    if (options.skipDeskTour) {
      writeEntryDeskIntroSeen();
      setDeskTourPending(false);
    } else if (options.startDeskTour) {
      setDeskTourPending(true);
    } else {
      writeEntryDeskIntroSeen();
      setDeskTourPending(false);
    }
    setOfficeCanvasGrace(true);
  }, []);

  const completeDeskTour = useCallback(() => {
    writeEntryDeskIntroSeen();
    setDeskTourPending(false);
  }, []);

  useEffect(() => {
    if (!officeCanvasGrace) return undefined;
    if (hasCanvasContent) {
      setOfficeCanvasGrace(false);
      return undefined;
    }
    const timer = setTimeout(() => setOfficeCanvasGrace(false), OFFICE_CANVAS_GRACE_MS);
    return () => clearTimeout(timer);
  }, [officeCanvasGrace, hasCanvasContent]);

  return {
    studioActive,
    enterOfficeLife,
    enterSimpleStudio,
    officeBootPending,
    officeCanvasGrace,
    deskTourPending,
    handleOfficeBootComplete,
    completeDeskTour
  };
}
