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
 * Visits open on the simple prompt (`studioActive`) — the office is a place
 * you choose, not one you land in. Picking Office with the switch is
 * remembered, so the next visit opens there; picking Simple puts it back.
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

  const enterOfficeLife = useCallback(() => {
    writePreferredViewMode('office');
    setStudioActive(false);
    if (!readOfficeDirectorySeen()) setOfficeBootPending(true);
  }, []);

  /** The way back: desk/floor chrome returns to the one-prompt screen. State
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
