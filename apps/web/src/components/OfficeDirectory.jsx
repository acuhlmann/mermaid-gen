import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  readOfficeDirectorySeen,
  writeOfficeDirectorySeen
} from '../utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import {
  getOfficeDirectoryUi,
  setOfficeDirectoryOpen,
  subscribeOfficeDirectoryUi
} from '../state/officeDirectoryUiStore.js';
import { useIntroNarrator } from '../hooks/useIntroNarrator.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';
import { PersonaFace } from './personaFaces/index.jsx';
import IntroVoiceButton from './IntroVoiceButton.jsx';
import NameTag from './NameTag.jsx';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

/** Reception check-in → each colleague. */
const STEP_WELCOME = 0;
const STEP_FIRST_COLLEAGUE = 1;

/** When TTS is offline, give the user time to read the quote before advancing. */
const SILENT_BEAT_MS = 2_400;

/** The line a colleague speaks: full self-intro when available. */
function colleagueVoiceLine(colleague) {
  if (colleague.introLine) return colleague.introLine;
  return `${colleague.name}. ${colleague.blurb ?? ''}`.trim();
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
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

function DirectoryHead({ copy, onClose, eyebrow }) {
  return (
    <div className="office-directory-head">
      <div className="office-directory-head-copy">
        {eyebrow ? <span className="office-directory-eyebrow">{eyebrow}</span> : null}
        <span className="office-directory-title">🏢 {copy.title}</span>
      </div>
      <button
        type="button"
        className="office-directory-close"
        aria-label={copy.closeAria}
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

function ColleagueSpotlight({
  colleague,
  colleagueId,
  progressLabel,
  chapterLabel,
  unlockedLabel
}) {
  return (
    <div
      className="office-directory-spotlight"
      key={colleagueId}
      data-testid="office-directory-spotlight"
    >
      <p className="office-directory-chapter">{chapterLabel}</p>
      <p className="office-directory-progress">{progressLabel}</p>
      {unlockedLabel ? <p className="office-directory-unlocked">{unlockedLabel}</p> : null}
      <div
        className="office-directory-hero-ring"
        style={{ '--face-accent': colleague.accentColor }}
      >
        <PersonaFace
          id={colleagueId}
          size={64}
          className="office-directory-avatar office-directory-avatar--hero"
        />
      </div>
      <span className="office-directory-name">{colleague.name}</span>
      <span className="office-directory-role">{colleague.title}</span>
      {colleague.blurb ? <p className="office-directory-blurb">{colleague.blurb}</p> : null}
      {colleague.introLine ? (
        <blockquote className="office-directory-quote">“{colleague.introLine}”</blockquote>
      ) : null}
    </div>
  );
}

/** The welcome step: greeting, editable name badge, and Linda's voiced intro. */
function TourWelcome({ copy, userName, speakingId, onHear, autoPlaying }) {
  return (
    <div className="office-directory-welcome" data-testid="office-directory-welcome">
      <p className="office-directory-chapter">{copy.welcomeChapter}</p>
      <p className="office-directory-greeting">{formatLocale(copy.greeting, { name: userName })}</p>
      <p className="office-directory-tagline">{copy.tagline}</p>
      <NameTag copy={copy.nameTag} />
      {copy.greetingHint ? <p className="office-directory-name-hint">{copy.greetingHint}</p> : null}
      <p className="office-directory-tour-hint">{copy.tourHint}</p>
      {copy.welcomeVoiceLine ? (
        <IntroVoiceButton
          className="office-directory-hear office-directory-hear--welcome"
          speaking={speakingId === 'welcome' || Boolean(autoPlaying && speakingId === 'welcome')}
          idleLabel={copy.hearWelcomeLabel}
          speakingLabel={copy.hearSpeakingLabel}
          title={copy.hearTitle}
          onClick={() =>
            onHear('welcome', {
              speakerId: copy.welcomeVoiceSpeakerId,
              text: copy.welcomeVoiceLine
            })
          }
        />
      ) : null}
      {autoPlaying && speakingId === 'welcome' ? (
        <p className="office-directory-autoplay-hint" data-testid="office-directory-autoplay">
          {copy.autoplayHint}
        </p>
      ) : null}
    </div>
  );
}

/** One colleague spotlight step — cinematic auto-voice, with ▶ to replay/stop. */
function TourColleague({ copy, colleagueId, stepIndex, speakingId, onHear, autoPlaying }) {
  const colleague = officeSenderInfo(colleagueId);
  return (
    <div className="office-directory-spotlight-wrap">
      <ColleagueSpotlight
        colleague={colleague}
        colleagueId={colleagueId}
        unlockedLabel={copy.unlockedLabel}
        chapterLabel={formatLocale(copy.colleagueChapter, {
          current: String(stepIndex),
          total: String(COLLEAGUE_IDS.length)
        })}
        progressLabel={formatLocale(copy.progressLabel, {
          current: String(stepIndex),
          total: String(COLLEAGUE_IDS.length)
        })}
      />
      <div className="office-directory-progress-dots" aria-hidden="true">
        {COLLEAGUE_IDS.map((id, i) => (
          <span
            key={id}
            className={`office-directory-dot${i < stepIndex ? ' is-done' : ''}${
              i === stepIndex - 1 ? ' is-current' : ''
            }`}
          />
        ))}
      </div>
      {autoPlaying ? (
        <p className="office-directory-autoplay-hint" data-testid="office-directory-autoplay">
          {copy.autoplayHint}
        </p>
      ) : null}
      <IntroVoiceButton
        className="office-directory-hear"
        speaking={speakingId === colleagueId}
        idleLabel={copy.hearLabel}
        speakingLabel={copy.hearSpeakingLabel}
        title={copy.hearTitle}
        onClick={() =>
          onHear(colleagueId, { speakerId: colleagueId, text: colleagueVoiceLine(colleague) })
        }
      />
    </div>
  );
}

/** The stepped first-run orientation: reception → each colleague → Clock in. */
function DirectoryTour({
  copy,
  step,
  userName,
  speakingId,
  onHear,
  onBack,
  onNext,
  onCheckIn,
  onDismiss,
  onSkip,
  autoPlaying,
  cinematic,
  voiceUnlocked
}) {
  const lastColleagueStep = STEP_FIRST_COLLEAGUE + COLLEAGUE_IDS.length - 1;
  const atLastStep = step >= lastColleagueStep;
  const colleagueIndex = step - STEP_FIRST_COLLEAGUE;

  return (
    <div
      className={`office-directory office-directory--tour${
        step === STEP_WELCOME ? ' office-directory--boot' : ''
      }${cinematic ? ' office-directory--cinematic' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      data-testid="office-directory-tour"
    >
      <DirectoryHead copy={copy} onClose={onDismiss} eyebrow={copy.tourEyebrow} />

      {step === STEP_WELCOME ? (
        <TourWelcome
          copy={copy}
          userName={userName}
          speakingId={speakingId}
          onHear={onHear}
          autoPlaying={autoPlaying}
        />
      ) : null}
      {step >= STEP_FIRST_COLLEAGUE ? (
        <TourColleague
          copy={copy}
          colleagueId={COLLEAGUE_IDS[colleagueIndex]}
          stepIndex={colleagueIndex + 1}
          speakingId={speakingId}
          onHear={onHear}
          autoPlaying={autoPlaying}
        />
      ) : null}

      <div className="office-directory-tour-actions">
        {step > STEP_WELCOME ? (
          <button type="button" className="office-directory-secondary" onClick={onBack}>
            {copy.backLabel}
          </button>
        ) : null}
        {atLastStep ? (
          <button type="button" className="office-directory-dismiss" onClick={onDismiss}>
            {copy.dismissLabel}
          </button>
        ) : step === STEP_WELCOME && !voiceUnlocked ? (
          <button
            type="button"
            className="office-directory-dismiss"
            data-testid="office-directory-check-in"
            onClick={onCheckIn}
          >
            {copy.checkInLabel}
          </button>
        ) : (
          <button type="button" className="office-directory-dismiss" onClick={onNext}>
            {step === STEP_WELCOME
              ? copy.startLabel
              : cinematic
                ? (copy.skipBeatLabel ?? copy.nextLabel)
                : copy.nextLabel}
          </button>
        )}
      </div>

      <button
        type="button"
        className="office-directory-skip-build"
        title={copy.skipToBuildTitle}
        data-testid="office-directory-skip-build"
        onClick={onSkip}
      >
        {copy.skipToBuildLabel}
      </button>
    </div>
  );
}

/** The returning-user view: the whole roster, each card voiced on ▶. */
function DirectoryRoster({ copy, speakingId, onHear, onDismiss, onReplayTour }) {
  return (
    <div
      className="office-directory office-directory--roster"
      role="region"
      aria-label={copy.title}
      data-testid="office-directory-roster"
    >
      <DirectoryHead copy={copy} onClose={onDismiss} eyebrow={copy.rosterEyebrow} />
      <p className="office-directory-tagline">{copy.rosterTagline}</p>
      <ul className="office-directory-roster">
        {COLLEAGUE_IDS.map((id) => {
          const colleague = officeSenderInfo(id);
          return (
            <li key={id} className="office-directory-card">
              <PersonaFace id={id} size={38} className="office-directory-avatar" />
              <span className="office-directory-meta">
                <span className="office-directory-name">{colleague.name}</span>
                <span className="office-directory-role">{colleague.title}</span>
                {colleague.blurb ? (
                  <span className="office-directory-blurb">{colleague.blurb}</span>
                ) : null}
              </span>
              <IntroVoiceButton
                className="office-directory-card-hear"
                speaking={speakingId === id}
                idleLabel={copy.hearLabel}
                speakingLabel={copy.hearSpeakingLabel}
                title={copy.hearTitle}
                onClick={() => onHear(id, { speakerId: id, text: colleagueVoiceLine(colleague) })}
              />
            </li>
          );
        })}
      </ul>
      <div className="office-directory-roster-actions">
        {onReplayTour ? (
          <button type="button" className="office-directory-secondary" onClick={onReplayTour}>
            {copy.replayTourLabel}
          </button>
        ) : null}
        <button type="button" className="office-directory-dismiss" onClick={onDismiss}>
          {copy.dismissLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Interactive office directory (docs/office-parody.md): reception check-in →
 * name badge → Linda's welcome → auto-voiced colleague intros → Clock in.
 * Afterwards: "Meet the Office" chip (and desk verb) reopen the roster.
 *
 * While open, the directory publishes pause state so ambience / welcome IMs /
 * advisor popups stay quiet. Voice never fires on cold mount — only after
 * Check in / Meet the team (user gesture unlocks the cinematic sequence).
 */
export default function OfficeDirectory({
  onSkipToBuild,
  onBootComplete,
  getSessionId,
  showChip = true,
  placement = 'entry'
}) {
  const firstRunRef = useRef(!readOfficeDirectorySeen());
  const [open, setOpen] = useState(() => firstRunRef.current);
  /** `null` = full roster browse; `0` = reception; `1..` = colleagues. */
  const [step, setStep] = useState(() => (firstRunRef.current ? STEP_WELCOME : null));
  /** Check-in at reception unlocks Linda's welcome voice (browser TTS gesture). */
  const [voiceUnlocked, setVoiceUnlocked] = useState(false);
  /** After "Meet the team", colleagues auto-speak and advance. */
  const [cinematic, setCinematic] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);
  const directoryUi = useSyncExternalStore(
    subscribeOfficeDirectoryUi,
    getOfficeDirectoryUi,
    getOfficeDirectoryUi
  );
  const handledOpenNonce = useRef(0);
  const autoGenRef = useRef(0);
  const { speakingId, play, stop } = useIntroNarrator({ getSessionId });
  const copy = officeChromeCopy().directory;

  // Publish open state so App / OfficeLayer can pause competing popups.
  useEffect(() => {
    setOfficeDirectoryOpen(open);
    return () => setOfficeDirectoryOpen(false);
  }, [open]);

  useEffect(() => {
    if (directoryUi.openNonce <= handledOpenNonce.current) return;
    handledOpenNonce.current = directoryUi.openNonce;
    stop();
    autoGenRef.current += 1;
    setCinematic(false);
    setAutoPlaying(false);
    setVoiceUnlocked(false);
    setOpen(true);
    setStep(directoryUi.mode === 'tour' ? STEP_WELCOME : null);
  }, [directoryUi.openNonce, directoryUi.mode, stop]);

  const hearBeat = (id, line) => {
    if (speakingId === id) {
      stop();
      return Promise.resolve({ spoken: false, cancelled: true });
    }
    return play(id, line);
  };

  const dismiss = () => {
    const wasFirstRun = !readOfficeDirectorySeen();
    autoGenRef.current += 1;
    stop();
    setCinematic(false);
    setAutoPlaying(false);
    setVoiceUnlocked(false);
    writeOfficeDirectorySeen();
    firstRunRef.current = false;
    setStep(null);
    setOpen(false);
    if (wasFirstRun) onBootComplete?.();
  };

  const skipToBuild = () => {
    dismiss();
    onSkipToBuild?.();
  };

  const goBack = () => {
    autoGenRef.current += 1;
    stop();
    setAutoPlaying(false);
    setCinematic(false);
    setStep((s) => Math.max(STEP_WELCOME, s - 1));
  };

  const checkIn = () => {
    setVoiceUnlocked(true);
  };

  const goNext = () => {
    autoGenRef.current += 1;
    stop();
    setAutoPlaying(false);
    const leavingWelcome = step === STEP_WELCOME;
    if (leavingWelcome) setCinematic(true);
    setStep((s) => s + 1);
  };

  // After reception check-in: auto-play Linda's welcome (gesture unlocked TTS).
  useEffect(() => {
    if (!open || step !== STEP_WELCOME || !voiceUnlocked || !copy.welcomeVoiceLine)
      return undefined;
    const gen = ++autoGenRef.current;
    let cancelled = false;
    const ac = new AbortController();
    setAutoPlaying(true);
    void (async () => {
      const result = await play('welcome', {
        speakerId: copy.welcomeVoiceSpeakerId,
        text: copy.welcomeVoiceLine
      });
      if (cancelled || gen !== autoGenRef.current) return;
      if (!result?.spoken && !result?.cancelled) await sleep(SILENT_BEAT_MS, ac.signal);
      else if (result?.spoken) await sleep(OFFICE_NARRATION_GAP_MS, ac.signal);
      if (!cancelled && gen === autoGenRef.current) setAutoPlaying(false);
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, step, voiceUnlocked, copy.welcomeVoiceLine, copy.welcomeVoiceSpeakerId, play]);

  // Cinematic colleague run: auto-speak each intro, then advance.
  useEffect(() => {
    if (!open || !cinematic || step == null || step < STEP_FIRST_COLLEAGUE) return undefined;
    const colleagueIndex = step - STEP_FIRST_COLLEAGUE;
    const colleagueId = COLLEAGUE_IDS[colleagueIndex];
    if (!colleagueId) return undefined;
    const colleague = officeSenderInfo(colleagueId);
    const gen = ++autoGenRef.current;
    let cancelled = false;
    const ac = new AbortController();
    const lastColleagueStep = STEP_FIRST_COLLEAGUE + COLLEAGUE_IDS.length - 1;
    setAutoPlaying(true);
    void (async () => {
      const result = await play(colleagueId, {
        speakerId: colleagueId,
        text: colleagueVoiceLine(colleague)
      });
      if (cancelled || gen !== autoGenRef.current) return;
      if (result?.cancelled) {
        setAutoPlaying(false);
        return;
      }
      if (!result?.spoken) await sleep(SILENT_BEAT_MS, ac.signal);
      else await sleep(OFFICE_NARRATION_GAP_MS, ac.signal);
      if (cancelled || gen !== autoGenRef.current) return;
      setAutoPlaying(false);
      if (step < lastColleagueStep) {
        setStep((s) => s + 1);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, cinematic, step, play]);

  if (!open) {
    if (!showChip) return null;
    return (
      <div className="office-directory-host" data-placement={placement}>
        <button
          type="button"
          className="office-directory-chip"
          title={copy.expandTitle}
          data-testid="office-directory-chip"
          onClick={() => {
            setCinematic(false);
            setAutoPlaying(false);
            setVoiceUnlocked(false);
            setStep(null);
            setOpen(true);
          }}
        >
          {copy.expandLabel}
        </button>
      </div>
    );
  }

  // Open directory always mounts as a modal overlay so Day One / starters /
  // ambience chrome stay dimmed and non-interactive behind it.
  return (
    <div
      className="office-directory-host office-directory-host--overlay is-open"
      data-placement={placement}
      data-testid="office-directory-modal"
    >
      <button
        type="button"
        className="office-directory-backdrop"
        aria-label={copy.closeAria}
        onClick={dismiss}
      />
      {step !== null ? (
        <DirectoryTour
          copy={copy}
          step={step}
          userName={userName}
          speakingId={speakingId}
          onHear={hearBeat}
          onBack={goBack}
          onNext={goNext}
          onCheckIn={checkIn}
          onDismiss={dismiss}
          onSkip={skipToBuild}
          autoPlaying={autoPlaying}
          cinematic={cinematic}
          voiceUnlocked={voiceUnlocked}
        />
      ) : (
        <DirectoryRoster
          copy={copy}
          speakingId={speakingId}
          onHear={hearBeat}
          onDismiss={dismiss}
          onReplayTour={() => {
            autoGenRef.current += 1;
            stop();
            setCinematic(false);
            setAutoPlaying(false);
            setVoiceUnlocked(false);
            setStep(STEP_WELCOME);
          }}
        />
      )}
    </div>
  );
}
