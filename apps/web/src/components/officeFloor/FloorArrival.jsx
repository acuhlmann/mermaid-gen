/**
 * Day One, staged on the floor (docs/office-isometric-mode.md § 5 slice 3).
 *
 * First run *begins* isometric: you are standing at reception, not sitting at a
 * desk you have not been given yet. Linda welcomes you, the floor introduces
 * itself one colleague at a time — each spotlit at their own desk, in their own
 * voice — and then you walk to your desk and sit down, which is the transition
 * into desktop screen mode.
 *
 * Content parity with the card tour is deliberate: same roster
 * (`OFFICE_COLLEAGUES`), same `introLine`s, same narrator, same pacing. Only
 * the staging changes, so this is a second *renderer* of the orientation rather
 * than a second orientation (ADR-0011). `OfficeDirectory` stays mounted for
 * replays from the level panel, and stays the fallback for anyone who skips.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import FloorBubble from './FloorBubble.jsx';
import FloorFigure from './FloorFigure.jsx';
import FloorStage from './FloorStage.jsx';
import { useWalkAnimation } from './useWalkAnimation.js';
import NameTag from '../NameTag.jsx';
import { useIntroNarrator } from '../../hooks/useIntroNarrator.js';
import { useStageScale } from '../../hooks/useStageScale.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../../utils/officeCast.js';
import { OFFICE_NARRATION_GAP_MS } from '../../utils/officeNarration.js';
import { writeOfficeDirectorySeen } from '../../utils/officeAmbienceStorage.js';
import {
  RECEPTION_TILE,
  YOU_SEAT_ID,
  depthOf,
  projectIso,
  seatFor,
  walkPathBetween
} from '../../utils/officeFloorPlan.js';
import { useUiCopy } from '../../i18n/useUiLocale.js';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

/** When TTS is offline, give the user time to read the line before advancing. */
const SILENT_BEAT_MS = 2_400;

/** The line a colleague speaks: their full self-intro when they have one. */
function colleagueVoiceLine(colleague) {
  if (colleague?.introLine) return colleague.introLine;
  return `${colleague?.name ?? ''}. ${colleague?.blurb ?? ''}`.trim();
}

/**
 * Who is talking right now, and what they are saying. Derived from the phase so
 * the spotlight, the bubble and the voice can never disagree about the speaker.
 *
 * @returns {{ id: string | null, line: string }}
 */
function resolveSpeaker(phase, index, directory) {
  if (phase === 'welcome') {
    return {
      id: directory?.welcomeVoiceSpeakerId ?? 'hr',
      line: directory?.welcomeVoiceLine ?? ''
    };
  }
  if (phase !== 'colleagues') return { id: null, line: '' };
  const castId = COLLEAGUE_IDS[index];
  if (!castId) return { id: null, line: '' };
  return { id: castId, line: colleagueVoiceLine(officeSenderInfo(castId)) };
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

/** You, on the floor: at reception, then walking to your desk. */
function ArrivalPlayer({ walking, onSeated }) {
  const ref = useRef(null);
  const desk = seatFor(YOU_SEAT_ID) ?? RECEPTION_TILE;
  const path = walking
    ? walkPathBetween(RECEPTION_TILE, { x: desk.x, y: desk.y }, YOU_SEAT_ID)
    : [RECEPTION_TILE];

  const { tile } = useWalkAnimation(ref, path, {
    walkKey: walking ? 'you:to-desk' : 'you:reception',
    onArrive: walking ? onSeated : undefined
  });

  return (
    <div
      ref={ref}
      className="office-floor-walker"
      data-testid="office-floor-arrival-player"
      style={{ zIndex: depthOf(tile.x, tile.y) + 6 }}
    >
      <div className="office-floor-walker-anchor">
        <FloorFigure id={YOU_SEAT_ID} accent="var(--accent)" isYou walking={walking} />
      </div>
    </div>
  );
}

/** Their intro line, above their own desk. */
function ArrivalSpeaker({ castId, line, scale }) {
  const seat = seatFor(castId);
  if (!seat) return null;
  const sender = officeSenderInfo(castId);
  const { left, top } = projectIso(seat.x, seat.y);
  return (
    <div className="office-floor-walker" style={{ left, top, zIndex: 9600 }}>
      <div className="office-floor-walker-anchor office-floor-walker-anchor--seated">
        <FloorBubble name={sender?.name ?? castId} title={sender?.title} scale={scale}>
          {line}
        </FloorBubble>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   onComplete?: (options?: {startDeskTour?: boolean, skipDeskTour?: boolean}) => void,
 *   onSkipToBuild?: () => void,
 *   getSessionId?: () => string
 * }} props
 */
export default function FloorArrival({ onComplete, onSkipToBuild, getSessionId }) {
  useUiCopy();
  const chrome = officeChromeCopy();
  const copy = chrome.floor;
  const arrival = copy.arrival;

  const viewportRef = useRef(null);
  const scale = useStageScale(viewportRef);
  const { play, stop } = useIntroNarrator({ getSessionId });

  /** 'reception' → 'welcome' → 'colleagues' → 'walking' */
  const [phase, setPhase] = useState('reception');
  const [index, setIndex] = useState(-1);
  const runRef = useRef(0);

  const finish = useCallback(
    (options) => {
      runRef.current += 1;
      stop();
      writeOfficeDirectorySeen();
      onComplete?.(options);
    },
    [onComplete, stop]
  );

  const handleSkip = useCallback(() => {
    finish({ skipDeskTour: true });
    onSkipToBuild?.();
  }, [finish, onSkipToBuild]);

  // Checking in is the user gesture that unlocks speech — nothing speaks on a
  // cold mount, so a crawler can never burn the TTS budget.
  const handleCheckIn = useCallback(() => setPhase('welcome'), []);

  const handleClockIn = useCallback(() => {
    runRef.current += 1;
    stop();
    setPhase('walking');
  }, [stop]);

  // Linda's welcome, then each colleague in turn, auto-advancing on the voice.
  useEffect(() => {
    if (phase !== 'welcome' && phase !== 'colleagues') return undefined;
    const generation = ++runRef.current;
    const controller = new AbortController();
    let cancelled = false;

    const speak = async (id, speakerId, text) => {
      const result = await play(id, { speakerId, text });
      if (cancelled || generation !== runRef.current) return false;
      if (result?.cancelled) return false;
      await sleep(result?.spoken ? OFFICE_NARRATION_GAP_MS : SILENT_BEAT_MS, controller.signal);
      return !cancelled && generation === runRef.current;
    };

    void (async () => {
      if (phase === 'welcome') {
        const ok = await speak(
          'welcome',
          chrome.directory?.welcomeVoiceSpeakerId ?? 'hr',
          chrome.directory?.welcomeVoiceLine ?? ''
        );
        if (!ok) return;
        setPhase('colleagues');
        setIndex(0);
        return;
      }
      const castId = COLLEAGUE_IDS[index];
      if (!castId) return;
      const ok = await speak(castId, castId, colleagueVoiceLine(officeSenderInfo(castId)));
      if (!ok) return;
      if (index < COLLEAGUE_IDS.length - 1) setIndex((current) => current + 1);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [phase, index, play, chrome.directory]);

  const { id: speakingId, line: speakingLine } = resolveSpeaker(phase, index, chrome.directory);
  const lastColleague = phase === 'colleagues' && index >= COLLEAGUE_IDS.length - 1;

  return (
    <div className="office-floor office-floor--arrival" data-testid="office-floor-arrival">
      <header className="office-floor-bar">
        <div className="office-floor-bar-copy">
          <span className="office-floor-eyebrow">{arrival.eyebrow}</span>
          <h2 className="office-floor-title">{arrival.title}</h2>
          <p className="office-floor-subtitle">{arrival.subtitle}</p>
        </div>
        <button
          type="button"
          className="office-floor-sit"
          data-testid="office-floor-arrival-skip"
          onClick={handleSkip}
        >
          {arrival.skip}
        </button>
      </header>

      <div className="office-floor-viewport" ref={viewportRef}>
        <FloorStage
          scale={scale}
          copy={copy}
          selectedId={null}
          onSelect={() => {}}
          vacantIds={[YOU_SEAT_ID]}
          interactive={false}
          speakingId={speakingId}
        >
          <ArrivalPlayer
            walking={phase === 'walking'}
            onSeated={() => finish({ startDeskTour: true })}
          />
          {speakingId && speakingLine ? (
            <ArrivalSpeaker castId={speakingId} line={speakingLine} scale={scale} />
          ) : null}
        </FloorStage>
      </div>

      {phase === 'reception' ? (
        <aside className="office-floor-card office-floor-card--reception">
          <span className="office-floor-eyebrow">{arrival.receptionEyebrow}</span>
          <p className="office-floor-card-blurb">{arrival.receptionBody}</p>
          <NameTag copy={chrome.directory?.nameTag} />
          <div className="office-floor-card-actions">
            <button
              type="button"
              className="office-floor-card-action office-floor-card-action--primary"
              onClick={handleCheckIn}
            >
              {arrival.checkIn}
            </button>
          </div>
        </aside>
      ) : phase !== 'walking' ? (
        <div className="office-floor-arrival-actions">
          <button type="button" className="office-floor-card-action" onClick={handleClockIn}>
            {lastColleague ? arrival.clockIn : arrival.clockInEarly}
          </button>
        </div>
      ) : null}
    </div>
  );
}
