import { useCallback, useEffect, useRef, useState } from 'react';

const SLOPITECT_TIP_TTL_MS = 7000;

/**
 * Slopitect Tip™ chip: manual brand-click surfacing + idle scheduler with jitter.
 *
 * @param {{ idleTips: string[] }} params
 */
export function useSlopitectTips({ idleTips }) {
  const [slopitectTip, setSlopitectTip] = useState(null);
  const tipSeqRef = useRef(0);
  const tipDismissTimerRef = useRef(null);
  const slopitectTipRef = useRef(null);

  const showSlopitectTip = useCallback(() => {
    const tips = idleTips ?? [];
    const tip = tips[Math.floor(Math.random() * tips.length)] || '';
    if (!tip) return;
    const seq = tipSeqRef.current + 1;
    tipSeqRef.current = seq;
    const next = {
      id: `tip-${Date.now()}-${seq}`,
      text: tip
    };
    setSlopitectTip(next);
    if (tipDismissTimerRef.current) clearTimeout(tipDismissTimerRef.current);
    tipDismissTimerRef.current = setTimeout(() => {
      setSlopitectTip((current) => (current?.id === next.id ? null : current));
      tipDismissTimerRef.current = null;
    }, SLOPITECT_TIP_TTL_MS);
  }, [idleTips]);

  const handleBrandClick = useCallback(() => {
    showSlopitectTip();
  }, [showSlopitectTip]);

  const dismissSlopitectTip = useCallback(() => {
    if (tipDismissTimerRef.current) {
      clearTimeout(tipDismissTimerRef.current);
      tipDismissTimerRef.current = null;
    }
    setSlopitectTip(null);
  }, []);

  useEffect(() => {
    if (!slopitectTip) return undefined;
    const onDocPointer = (event) => {
      if (slopitectTipRef.current?.contains(event.target)) return;
      if (event.target?.closest?.('.brand-control')) return;
      dismissSlopitectTip();
    };
    document.addEventListener('pointerdown', onDocPointer);
    return () => document.removeEventListener('pointerdown', onDocPointer);
  }, [slopitectTip, dismissSlopitectTip]);

  // Auto-show a Slopitect Tip™ roughly every other minute, with jitter so it
  // doesn't feel metronome-y. Range: ~60s–180s between tips.
  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    function scheduleNext() {
      if (cancelled) return;
      const jitterMs = 60_000 + Math.random() * 120_000;
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        showSlopitectTip();
        scheduleNext();
      }, jitterMs);
    }
    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [showSlopitectTip]);

  /** "Skip the ceremony" escape hatch: focus the desk work-order input. */
  const focusTopicInput = useCallback(() => {
    if (typeof document === 'undefined') return;
    const el =
      document.getElementById('slop-prompt-desk-input') ??
      document.getElementById('diagram-change-prompt');
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, []);

  return {
    slopitectTip,
    slopitectTipRef,
    handleBrandClick,
    dismissSlopitectTip,
    focusTopicInput
  };
}
