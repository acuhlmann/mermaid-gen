/**
 * Office floor reactions to ArchiSlop God Altar judgments (lightning/glow +
 * sequential Gilfoyle & Dinesh sarcastic cameo lines).
 *
 * Strictly reactive to user-initiated prayers in `godAltarStore`: never runs
 * on an ambient timer, never opens or triggers LLM calls on its own (ADR-0010),
 * and sequences Gilfoyle -> Dinesh one at a time so adjacent pod desks (6,4)
 * and (7,4) never collide two speech balloons on screen.
 *
 * Silence & cooldown rules:
 * - While the Altar modal is open (`altarOpen === true`), cameos never speak or
 *   pop over God; the latest major moment (`blessed`, `smote`, `pr_filed`)
 *   queues until the Altar closes.
 * - Ordinary prayers (`pray`) do not trigger floor cameos; only major moments
 *   do, subject to `ALTAR_CAMEO_COOLDOWN_MS` (30s) so back-to-back decrees
 *   never spam the pod.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getGodAltarEvent,
  getGodAltarOpen,
  subscribeGodAltar
} from '../../features/god/godAltarStore.js';

export const ALTAR_FLASH_MS = 1_800;
export const ALTAR_BEAT_MS = 3_200;
export const ALTAR_CAMEO_COOLDOWN_MS = 30_000;

function isMajorAltarEvent(event) {
  if (!event) return false;
  if (typeof event.major === 'boolean') return event.major;
  return event.kind === 'bless' || event.kind === 'smite';
}

function cameoPairFor(kind, copy) {
  const bank = copy?.altar?.cameos ?? {};
  const bucket = bank[kind] ?? bank.pray ?? {};
  return {
    gilfoyle:
      bucket.gilfoyle ?? 'Another prayer to the CI gods. Have you tried writing tests instead?',
    dinesh: bucket.dinesh ?? 'Wait—did God just roast my commit? I am literally sitting right here.'
  };
}

function clearTimerSet(timers) {
  if (timers.flash) clearTimeout(timers.flash);
  if (timers.dinesh) clearTimeout(timers.dinesh);
  if (timers.clear) clearTimeout(timers.clear);
  timers.flash = null;
  timers.dinesh = null;
  timers.clear = null;
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
  const altarOpen = useSyncExternalStore(subscribeGodAltar, getGodAltarOpen, getGodAltarOpen);
  const handledSeqRef = useRef(event?.seq ?? 0);
  const pendingMajorRef = useRef(null);
  const lastCameoAtRef = useRef(-Infinity);
  const timersRef = useRef({ flash: null, dinesh: null, clear: null });
  const [divineFlash, setDivineFlash] = useState(/** @type {string | null} */ (null));
  const [cameo, setCameo] = useState(
    /** @type {{ speakerId: string, text: string } | null} */ (null)
  );
  const copyRef = useRef(copy);
  useEffect(() => {
    copyRef.current = copy;
  });

  useEffect(() => () => clearTimerSet(timersRef.current), []);

  useEffect(() => {
    if (suspended) {
      pendingMajorRef.current = null;
      clearTimerSet(timersRef.current);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: clearing active flash/cameo when suspended by a meeting)
      setDivineFlash(null);
      setCameo(null);
      return;
    }

    const hasNewEvent = Boolean(event && event.seq > handledSeqRef.current);
    if (hasNewEvent) {
      handledSeqRef.current = event.seq;
      if (isMajorAltarEvent(event)) {
        pendingMajorRef.current = event;
      }
    }

    if (altarOpen) {
      clearTimerSet(timersRef.current);
      setDivineFlash(null);
      setCameo(null);
      return;
    }

    const candidate = pendingMajorRef.current;
    if (!candidate) return;
    pendingMajorRef.current = null;

    const flashKind = candidate.kind || 'bless';
    if (timersRef.current.flash) clearTimeout(timersRef.current.flash);
    setDivineFlash(flashKind);
    timersRef.current.flash = setTimeout(() => {
      setDivineFlash(null);
      timersRef.current.flash = null;
    }, ALTAR_FLASH_MS);

    const now = Date.now();
    if (now - lastCameoAtRef.current < ALTAR_CAMEO_COOLDOWN_MS) return;
    lastCameoAtRef.current = now;

    if (timersRef.current.dinesh) clearTimeout(timersRef.current.dinesh);
    if (timersRef.current.clear) clearTimeout(timersRef.current.clear);
    const pair = cameoPairFor(candidate.kind, copyRef.current);
    setCameo({ speakerId: 'gilfoyle', text: pair.gilfoyle });
    timersRef.current.dinesh = setTimeout(() => {
      setCameo({ speakerId: 'dinesh', text: pair.dinesh });
      timersRef.current.dinesh = null;
    }, ALTAR_BEAT_MS);
    timersRef.current.clear = setTimeout(() => {
      setCameo(null);
      timersRef.current.clear = null;
    }, ALTAR_BEAT_MS * 2);
  }, [event, altarOpen, suspended]);

  if (suspended || altarOpen) {
    return { divineFlash: null, cameo: null };
  }
  return {
    divineFlash,
    cameo: suppressed ? null : cameo
  };
}

export default useFloorAltarCameo;
