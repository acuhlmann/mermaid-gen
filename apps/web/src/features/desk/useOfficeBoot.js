import { useCallback, useEffect, useState } from 'react';
import {
  readOfficeDirectorySeen,
  writeDayOneBadgeSeen,
  writeEntryDeskIntroSeen
} from '../../utils/officeAmbienceStorage.js';
import { OFFICE_CANVAS_GRACE_MS } from '../../utils/officeCanvasGrace.js';

/**
 * Meet-the-Office boot gate and post-orientation canvas grace period.
 *
 * @param {{ hasCanvasContent: boolean }} deps
 */
export function useOfficeBoot({ hasCanvasContent }) {
  const [officeBootPending, setOfficeBootPending] = useState(() => !readOfficeDirectorySeen());
  const [officeCanvasGrace, setOfficeCanvasGrace] = useState(false);
  const [deskTourPending, setDeskTourPending] = useState(false);

  const handleOfficeBootComplete = useCallback((options = {}) => {
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
    officeBootPending,
    officeCanvasGrace,
    deskTourPending,
    handleOfficeBootComplete,
    completeDeskTour
  };
}
