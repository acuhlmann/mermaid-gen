/**
 * Day One, staged on the floor (docs/office-isometric-mode.md § 5 slice 3).
 *
 * First run *begins* isometric: you stand at reception, check in, then walk the
 * floor — Linda welcomes you at People Ops, each teammate introduces themselves
 * at their desk (camera zoomed in and following), and a distinct Linda handoff
 * plays while you automatically walk to your own desk and sit down into the
 * desktop wizard.
 *
 * Content parity with the card tour is deliberate: same roster
 * (`DAY_ONE_INTRO_IDS` / walk subset), same `introLine`s, same narrator. Only
 * the staging changes (ADR-0011). `OfficeDirectory` stays mounted for replays.
 *
 * Spoken copy stays voice-first (docs/office-parody.md): captions / CC default
 * off so the floor is not buried under balloons; turn CC on to read along, and
 * a silent TTS beat always falls back to the bubble so the line is never lost.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import FloorDeskSpeech from './FloorDeskSpeech.jsx';
import FloorLiveRegion from './FloorLiveRegion.jsx';
import FloorPlayer from './FloorPlayer.jsx';
import FloorStage from './FloorStage.jsx';
import { floorArrivalAnnouncement } from './floorArrivalAnnouncement.js';
import { useFloorArrivalFocus } from './useFloorArrivalFocus.js';
import IntroTranscriptButton from '../IntroTranscriptButton.jsx';
import NameTag from '../NameTag.jsx';
import { useIntroNarrator } from '../../hooks/useIntroNarrator.js';
import { useStageScale } from '../../hooks/useStageScale.js';
import { officeChromeCopy } from '../../utils/officeCast.js';
import {
  arrivalSpeechBeats,
  DAY_ONE_WALK_IDS,
  introHomeTile,
  introVisitTileFor
} from '../../utils/officeFloorIntro.js';
import { shouldShowSpokenText } from '../../utils/officeCaptions.js';
import { OFFICE_NARRATION_GAP_MS } from '../../utils/officeNarration.js';
import { writeOfficeDirectorySeen } from '../../utils/officeAmbienceStorage.js';
import { primeOfficeAudio } from '../../utils/officeAudioPrime.js';
import { RECEPTION_TILE, YOU_SEAT_ID } from '../../utils/officeFloorPlan.js';
import { getOfficeSnapshot, setOfficeCaptions, subscribe } from '../../state/officeMomentStore.js';
import { useUiCopy } from '../../i18n/useUiLocale.js';

/** When TTS is offline, give the user time to read the line before advancing. */
const SILENT_BEAT_MS = 2_400;

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

function tilesEqual(a, b) {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

/**
 * @param {{
 *   onComplete?: (options?: {startDeskTour?: boolean, skipDeskTour?: boolean}) => void,
 *   onSkipToBuild?: () => void,
 *   getSessionId?: () => string,
 *   playChime?: (playFn: (ref: object) => void) => boolean | void,
 *   audioContextRef?: { current: AudioContext | null },
 *   hasInteractedRef?: import('react').MutableRefObject<boolean>,
 *   soundEnabled?: boolean
 * }} props
 */
export default function FloorArrival({
  onComplete,
  onSkipToBuild,
  getSessionId,
  playChime: _playChime,
  audioContextRef,
  hasInteractedRef,
  soundEnabled: _soundEnabled = true
}) {
  useUiCopy();
  const chrome = officeChromeCopy();
  const copy = chrome.floor;
  const arrival = copy.arrival;
  const directory = chrome.directory;

  const viewportRef = useRef(null);
  const fitScale = useStageScale(viewportRef);
  const { play, stop } = useIntroNarrator({ getSessionId });
  const captions = useSyncExternalStore(
    subscribe,
    () => getOfficeSnapshot().captions,
    () => getOfficeSnapshot().captions
  );

  /**
   * reception → touring (walk + speak stops) → walking-home (closing + desk).
   * Beat index walks `arrivalSpeechBeats()`; the last beat is the closing.
   */
  const [phase, setPhase] = useState('reception');
  const [beatIndex, setBeatIndex] = useState(-1);
  const [leg, setLeg] = useState({
    from: RECEPTION_TILE,
    to: RECEPTION_TILE,
    walking: false,
    key: 'you:reception'
  });
  const [atTile, setAtTile] = useState(RECEPTION_TILE);
  /** True while the current beat is actually being spoken aloud. */
  const [voiceActive, setVoiceActive] = useState(false);
  /** Speak only after the walk to that stop has settled. */
  const [arrivedForBeat, setArrivedForBeat] = useState(false);
  const runRef = useRef(0);
  const homeStartedRef = useRef(false);

  const beats = useMemo(
    () => arrivalSpeechBeats(),
    [directory?.welcomeVoiceLine, directory?.welcomeClosingLine, directory?.welcomeVoiceSpeakerId]
  );
  const currentBeat = beatIndex >= 0 ? beats[beatIndex] : null;
  const focusActive = phase === 'touring' || phase === 'walking-home';
  const focusTile =
    phase === 'walking-home' || leg.walking ? leg.to : currentBeat ? atTile : RECEPTION_TILE;
  const scale = useFloorArrivalFocus(viewportRef, focusTile, fitScale, focusActive);

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

  const startWalk = useCallback(
    (to, key) => {
      setLeg((current) => ({
        from: current.walking ? current.to : atTile,
        to,
        walking: true,
        key
      }));
      setArrivedForBeat(false);
    },
    [atTile]
  );

  const handleArrive = useCallback(() => {
    setAtTile(leg.to);
    setLeg((current) => ({ ...current, from: current.to, walking: false }));
    setArrivedForBeat(true);
  }, [leg.to]);

  // Checking in unlocks speech and starts the walk to Linda.
  const handleCheckIn = useCallback(() => {
    if (audioContextRef && hasInteractedRef) {
      primeOfficeAudio(audioContextRef, hasInteractedRef);
    }
    const lindaTile = introVisitTileFor('hr', RECEPTION_TILE) ?? RECEPTION_TILE;
    setPhase('touring');
    setBeatIndex(0);
    setArrivedForBeat(false);
    setLeg({
      from: RECEPTION_TILE,
      to: lindaTile,
      walking: !tilesEqual(RECEPTION_TILE, lindaTile),
      key: 'you:to-linda'
    });
    if (tilesEqual(RECEPTION_TILE, lindaTile)) {
      setAtTile(lindaTile);
      setArrivedForBeat(true);
    }
  }, [audioContextRef, hasInteractedRef]);

  const beginWalkHome = useCallback(() => {
    if (homeStartedRef.current) return;
    homeStartedRef.current = true;
    const home = introHomeTile();
    setPhase('walking-home');
    startWalk(home, 'you:to-desk');
  }, [startWalk]);

  const handleClockInEarly = useCallback(() => {
    runRef.current += 1;
    stop();
    setVoiceActive(false);
    beginWalkHome();
  }, [beginWalkHome, stop]);

  // After each walk settles, speak the beat; then walk to the next stop (or home).
  useEffect(() => {
    if (phase !== 'touring') return undefined;
    if (!arrivedForBeat || !currentBeat) return undefined;
    if (currentBeat.kind === 'closing') {
      // Closing speaks on the walk home — handled below.
      beginWalkHome();
      return undefined;
    }

    const generation = ++runRef.current;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      setVoiceActive(true);
      const result = await play(`${currentBeat.kind}:${currentBeat.id}`, {
        speakerId: currentBeat.id,
        text: currentBeat.line
      });
      if (cancelled || generation !== runRef.current) return;
      if (result?.cancelled) return;
      setVoiceActive(Boolean(result?.spoken));
      await sleep(result?.spoken ? OFFICE_NARRATION_GAP_MS : SILENT_BEAT_MS, controller.signal);
      if (cancelled || generation !== runRef.current) return;

      const nextIndex = beatIndex + 1;
      const next = beats[nextIndex];
      if (!next) {
        beginWalkHome();
        return;
      }
      if (next.kind === 'closing') {
        setBeatIndex(nextIndex);
        beginWalkHome();
        return;
      }
      const visit = introVisitTileFor(next.id, atTile) ?? atTile;
      setBeatIndex(nextIndex);
      if (tilesEqual(visit, atTile)) {
        setArrivedForBeat(true);
      } else {
        startWalk(visit, `you:to-${next.id}:${nextIndex}`);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      setVoiceActive(false);
    };
  }, [
    phase,
    arrivedForBeat,
    currentBeat,
    beatIndex,
    beats,
    play,
    atTile,
    startWalk,
    beginWalkHome
  ]);

  // Linda's closing handoff plays while you walk to your desk — not a second
  // self-intro at her cubicle.
  useEffect(() => {
    if (phase !== 'walking-home') return undefined;
    const closing = beats.find((beat) => beat.kind === 'closing');
    if (!closing?.line) return undefined;
    const generation = ++runRef.current;
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      setVoiceActive(true);
      const result = await play('closing', { speakerId: closing.id, text: closing.line });
      if (cancelled || generation !== runRef.current) return;
      if (result?.cancelled) return;
      setVoiceActive(Boolean(result?.spoken));
      await sleep(result?.spoken ? OFFICE_NARRATION_GAP_MS : SILENT_BEAT_MS, controller.signal);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      setVoiceActive(false);
    };
  }, [phase, beats, play]);

  const speakingId =
    phase === 'touring' && arrivedForBeat && currentBeat && currentBeat.kind !== 'closing'
      ? currentBeat.id
      : phase === 'walking-home'
        ? (beats.find((beat) => beat.kind === 'closing')?.id ?? null)
        : null;
  const speakingLine =
    phase === 'touring' && arrivedForBeat && currentBeat && currentBeat.kind !== 'closing'
      ? currentBeat.line
      : phase === 'walking-home'
        ? (beats.find((beat) => beat.kind === 'closing')?.line ?? '')
        : '';
  const showBubble =
    Boolean(speakingId && speakingLine) && shouldShowSpokenText({ captions, voiceActive });

  const said = floorArrivalAnnouncement({
    copy,
    phase,
    colleagueIndex: Math.max(0, beatIndex - 1),
    speakingId,
    walkingToId:
      leg.walking && phase === 'touring' && currentBeat && currentBeat.kind === 'intro'
        ? currentBeat.id
        : phase === 'touring' && leg.walking && beatIndex === 0
          ? 'hr'
          : null,
    atId: !leg.walking && phase === 'touring' && currentBeat ? currentBeat.id : null
  });

  const onPlayerArrive =
    phase === 'walking-home' ? () => finish({ startDeskTour: true }) : handleArrive;

  return (
    <div
      className={`office-floor office-floor--arrival${focusActive ? ' is-arrival-focused' : ''}`}
      data-testid="office-floor-arrival"
    >
      <FloorLiveRegion message={said.text} eventKey={said.key} />
      <header className="office-floor-bar">
        <div className="office-floor-bar-copy">
          <span className="office-floor-eyebrow">{arrival.eyebrow}</span>
          <h2 className="office-floor-title">{arrival.title}</h2>
          <p className="office-floor-subtitle">{arrival.subtitle}</p>
        </div>
        <div className="office-floor-bar-actions">
          <IntroTranscriptButton
            enabled={captions}
            label={directory.transcriptLabel}
            enabledLabel={directory.transcriptOnLabel}
            title={directory.transcriptTitle}
            onToggle={() => setOfficeCaptions(!captions)}
          />
          <button
            type="button"
            className="office-floor-sit"
            data-testid="office-floor-arrival-skip"
            onClick={handleSkip}
          >
            {arrival.skip}
          </button>
        </div>
      </header>

      <div
        className="office-floor-viewport"
        ref={viewportRef}
        data-testid="office-floor-arrival-viewport"
      >
        <FloorStage
          scale={scale}
          copy={copy}
          selectedId={null}
          onSelect={() => {}}
          vacantIds={[YOU_SEAT_ID]}
          interactive={false}
          speakingId={speakingId}
        >
          <FloorPlayer
            from={leg.from}
            to={leg.to}
            walking={leg.walking}
            walkKey={leg.key}
            onArrive={leg.walking ? onPlayerArrive : undefined}
            testId="office-floor-arrival-player"
          >
            {showBubble && phase === 'walking-home' ? (
              <FloorDeskSpeech castId={speakingId} line={speakingLine} scale={scale} />
            ) : null}
          </FloorPlayer>
          {showBubble && phase !== 'walking-home' ? (
            <FloorDeskSpeech castId={speakingId} line={speakingLine} scale={scale} />
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
      ) : phase === 'touring' ? (
        <div className="office-floor-arrival-actions">
          <button type="button" className="office-floor-card-action" onClick={handleClockInEarly}>
            {arrival.clockInEarly}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Re-export walk roster for tests / directory parity.
export { DAY_ONE_WALK_IDS };
