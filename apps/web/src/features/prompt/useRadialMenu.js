import { useCallback, useEffect, useRef, useState } from 'react';
import { RADIAL_MENU_CLOSE_GRACE_MS } from '../../utils/appConstants.js';

/**
 * Radial action menu session: visibility, hover grace, selection sync, slop prompt open.
 *
 * @param {{
 *   selectedNode: object | null;
 *   setSelectedNode: (value: object | null) => void;
 *   toolbarAnchor: object | null;
 *   setToolbarAnchor: (value: object | null) => void;
 *   setHoverDescriptor: (value: object | null) => void;
 *   setSlopNextPrompt: (value: string) => void;
 *   setSlopPromptSource: (value: string | null) => void;
 *   setSlopPromptExpanded: (value: boolean) => void;
 *   slopPromptExpandedRef: import('react').MutableRefObject<boolean>;
 *   slopPromptSourceRef: import('react').MutableRefObject<string | null>;
 *   closeRadialMenuRef: import('react').MutableRefObject<(() => void) | null>;
 * }} deps
 */
export function useRadialMenu({
  selectedNode,
  setSelectedNode,
  toolbarAnchor,
  setToolbarAnchor,
  setHoverDescriptor,
  setSlopNextPrompt,
  setSlopPromptSource,
  setSlopPromptExpanded,
  slopPromptExpandedRef,
  slopPromptSourceRef,
  closeRadialMenuRef
}) {
  const [radialMenuSession, setRadialMenuSession] = useState(null);
  const [radialMenuVisible, setRadialMenuVisible] = useState(false);
  const hoverCloseTimerRef = useRef(null);
  const prevSelectedNodeIdRef = useRef(null);

  const clearHoverCloseTimer = useCallback(() => {
    if (hoverCloseTimerRef.current != null) {
      window.clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  }, []);

  const openRadialSlopPrompt = useCallback(() => {
    setSlopNextPrompt('');
    setSlopPromptSource('radial');
    setSlopPromptExpanded(true);
  }, [setSlopNextPrompt, setSlopPromptExpanded, setSlopPromptSource]);

  useEffect(() => {
    const id = selectedNode?.id ?? null;
    if (id && id !== prevSelectedNodeIdRef.current) {
      setRadialMenuVisible(true);
    } else if (!id) {
      setRadialMenuVisible(false);
    }
    prevSelectedNodeIdRef.current = id;
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!radialMenuVisible || !selectedNode?.id || !toolbarAnchor) {
      setRadialMenuSession(null);
      return;
    }
    setRadialMenuSession({ descriptor: selectedNode, anchor: toolbarAnchor });
  }, [radialMenuVisible, selectedNode, toolbarAnchor]);

  const handleHoverTargetChange = useCallback(
    (descriptor) => {
      if (descriptor) {
        clearHoverCloseTimer();
        setHoverDescriptor(descriptor);
        return;
      }
      clearHoverCloseTimer();
      hoverCloseTimerRef.current = window.setTimeout(() => {
        hoverCloseTimerRef.current = null;
        setHoverDescriptor(null);
      }, 120);
    },
    [clearHoverCloseTimer, setHoverDescriptor]
  );

  const dismissRadialMenu = useCallback(() => {
    clearHoverCloseTimer();
    setRadialMenuVisible(false);
  }, [clearHoverCloseTimer]);

  const handleSelectedNodeChange = useCallback(
    (next) => {
      if (next?.id && radialMenuVisible && selectedNode?.id && next.id === selectedNode.id) {
        dismissRadialMenu();
        return;
      }
      if (next?.id && selectedNode?.id && next.id === selectedNode.id) {
        setRadialMenuSession(null);
        setRadialMenuVisible(true);
        setSelectedNode(next);
        return;
      }
      if (next?.id && selectedNode?.id && next.id !== selectedNode.id) {
        setRadialMenuSession(null);
        setRadialMenuVisible(true);
      }
      setSelectedNode(next);
      if (!next) setToolbarAnchor(null);
    },
    [dismissRadialMenu, radialMenuVisible, selectedNode, setSelectedNode, setToolbarAnchor]
  );

  const cancelMenuClose = useCallback(() => {
    clearHoverCloseTimer();
  }, [clearHoverCloseTimer]);

  const scheduleMenuClose = useCallback(() => {
    if (slopPromptExpandedRef.current && slopPromptSourceRef.current === 'radial') {
      return;
    }
    clearHoverCloseTimer();
    hoverCloseTimerRef.current = window.setTimeout(() => {
      hoverCloseTimerRef.current = null;
      setRadialMenuVisible(false);
    }, RADIAL_MENU_CLOSE_GRACE_MS);
  }, [clearHoverCloseTimer, slopPromptExpandedRef, slopPromptSourceRef]);

  const closeRadialMenu = useCallback(() => {
    clearHoverCloseTimer();
    setRadialMenuVisible(false);
    setHoverDescriptor(null);
  }, [clearHoverCloseTimer, setHoverDescriptor]);

  const resetRadialChrome = useCallback(() => {
    clearHoverCloseTimer();
    setRadialMenuVisible(false);
    setRadialMenuSession(null);
    setSelectedNode(null);
    setHoverDescriptor(null);
    setToolbarAnchor(null);
  }, [clearHoverCloseTimer, setHoverDescriptor, setSelectedNode, setToolbarAnchor]);

  useEffect(() => {
    closeRadialMenuRef.current = closeRadialMenu;
  });

  useEffect(
    () => () => {
      if (hoverCloseTimerRef.current != null) {
        window.clearTimeout(hoverCloseTimerRef.current);
        hoverCloseTimerRef.current = null;
      }
    },
    []
  );

  return {
    radialMenuSession,
    radialMenuVisible,
    openRadialSlopPrompt,
    handleHoverTargetChange,
    handleSelectedNodeChange,
    dismissRadialMenu,
    cancelMenuClose,
    scheduleMenuClose,
    closeRadialMenu,
    resetRadialChrome,
    clearHoverCloseTimer
  };
}
