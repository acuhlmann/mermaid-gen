import { useCallback, useEffect, useState } from 'react';
import {
  readOfficeDirectorySeen,
  writeDayOneBadgeSeen
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

  const handleOfficeBootComplete = useCallback(() => {
    setOfficeBootPending(false);
    writeDayOneBadgeSeen();
    setOfficeCanvasGrace(true);
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
    handleOfficeBootComplete
  };
}
