import { useCallback, useEffect, useMemo, useState } from 'react';

function getActiveFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
}

function isFullscreenApiAvailable() {
  if (typeof document === 'undefined') return false;
  const proto = Element.prototype;
  return Boolean(proto.requestFullscreen || proto.webkitRequestFullscreen);
}

/** Fullscreen API for the diagram canvas surface (`diagram-output` ref). */
export function useDiagramFullscreen(surfaceRef) {
  const fullscreenSupported = useMemo(() => isFullscreenApiAvailable(), []);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreenSupported) return undefined;
    const syncFullscreen = () => {
      const active = getActiveFullscreenElement();
      setIsFullscreen(active === surfaceRef?.current);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreen);
      document.removeEventListener('webkitfullscreenchange', syncFullscreen);
    };
  }, [fullscreenSupported, surfaceRef]);

  const toggleFullscreen = useCallback(async () => {
    const surface = surfaceRef?.current;
    if (!surface || !fullscreenSupported) return;
    try {
      if (getActiveFullscreenElement() === surface) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
      } else if (surface.requestFullscreen) {
        await surface.requestFullscreen();
      } else if (surface.webkitRequestFullscreen) {
        surface.webkitRequestFullscreen();
      }
    } catch {
      // Gesture denied or unsupported — fullscreenchange still syncs when applicable.
    }
  }, [fullscreenSupported, surfaceRef]);

  return { fullscreenSupported, isFullscreen, toggleFullscreen };
}
