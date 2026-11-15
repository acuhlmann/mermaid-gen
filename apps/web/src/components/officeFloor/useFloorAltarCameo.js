/**
 * Office floor reactions to ArchiSlop God Altar judgments (lightning/glow +
 * sequential Gilfoyle & Dinesh sarcastic cameo lines).
 *
 * Strictly reactive to user-initiated prayers in `godAltarStore`: never runs
 * on an ambient timer, never opens or triggers LLM calls on its own (ADR-0010),
 * and sequences Gilfoyle -> Dinesh one at a time so adjacent pod desks (6,4)
 * and (7,4) never collide two speech balloons on screen.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { getGodAltarEvent, subscribeGodAltar } from '../../features/god/godAltarStore.js';

export const ALTAR_FLASH_MS = 1_800;
export const ALTAR_BEAT_MS = 3_200;

function cameoPairFor(kind, copy) {
  const bank = copy?.altar?.cameos ?? {};
  const bucket = bank[kind] ?? bank.pray ?? {};
  return {
    gilfoyle:
      bucket.gilfoyle ?? 'Another prayer to the CI gods. Have you tried writing tests instead?',
    dinesh: bucket.dinesh ?? 'Wait—did God just roast my commit? I am literally sitting right here.'
  };
}

/**
 * @param {{
 *   copy: Record<string, any>,
 *   suspended?: boolean,
 *   suppressed?: boolean
 * }} options
 * @returns {{ divineFlash: string | null, cameo: { speakerId: string, text: string } | null }}
 */
export function useFloorAltarCameo({ copy, suspended = false, suppressed = false }) {
  const event = useSyncExternalStore(subscribeGodAltar, getGodAltarEvent, getGodAltarEvent);
  const handledSeqRef = useRef(event?.seq ?? 0);
  const [divineFlash, setDivineFlash] = useState(/** @type {string | null} */ (null));
  const [cameo, setCameo] = useState(
    /** @type {{ speakerId: string, text: string } | null} */ (null)
  );
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
  });

  useEffect(() => {
    if (!event || event.seq <= handledSeqRef.current) return undefined;
    handledSeqRef.current = event.seq;
    if (suspended) return undefined;

    const pair = cameoPairFor(event.kind, copyRef.current);
    const flashKind = event.kind || 'pray';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: transient visual flash + 2-beat cameo driven by an external store event seq)
    setDivineFlash(flashKind);
    setCameo({ speakerId: 'gilfoyle', text: pair.gilfoyle });

    const flashTimer = setTimeout(() => setDivineFlash(null), ALTAR_FLASH_MS);
    const dineshTimer = setTimeout(
      () => setCameo({ speakerId: 'dinesh', text: pair.dinesh }),
      ALTAR_BEAT_MS
    );
    const clearTimer = setTimeout(() => setCameo(null), ALTAR_BEAT_MS * 2);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(dineshTimer);
      clearTimeout(clearTimer);
    };
  }, [event, suspended]);

  if (suspended) {
    return { divineFlash: null, cameo: null };
  }
  return {
    divineFlash,
    cameo: suppressed ? null : cameo
  };
}

export default useFloorAltarCameo;
