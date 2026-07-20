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
import { useUiCopy } from '../i18n/useUiLocale.js';
import { OFFICE_NARRATION_GAP_MS } from '../utils/officeNarration.js';
import { PersonaFace } from './personaFaces/index.jsx';
import IntroLocaleToggle from './IntroLocaleToggle.jsx';
import IntroTranscriptButton from './IntroTranscriptButton.jsx';
import IntroVoiceButton from './IntroVoiceButton.jsx';
import NameTag from './NameTag.jsx';
import TopicStarters from './TopicStarters.jsx';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

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

function DirectoryHead({ copy, onClose, eyebrow, toolbar }) {
  return (
    <div className="office-directory-head">
      <div className="office-directory-head-copy">
        {eyebrow ? <span className="office-directory-eyebrow">{eyebrow}</span> : null}
        <span className="office-directory-title">🏢 {copy.title}</span>
      </div>
      <div className="office-directory-head-actions">
        {toolbar}
        <button
          type="button"
          className="office-directory-close"
          aria-label={copy.closeAria}
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>
  );
}

/** One colleague on the single-page onboarding roster — no duplicate blurb + intro. */
function OnboardingColleagueCard({
  colleague,
  colleagueId,
  isSpeaking,
  showTranscript,
  speakingId,
  onHear,
  copy
}) {
  const voiceLine = colleagueVoiceLine(colleague);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!isSpeaking) return;
    cardRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [isSpeaking]);

  return (
    <li
      ref={cardRef}
      className={`office-directory-onboarding-card${isSpeaking ? ' is-speaking' : ''}`}
      data-testid="office-directory-colleague-card"
      data-colleague-id={colleagueId}
    >
      <div
        className="office-directory-hero-ring office-directory-hero-ring--compact"
        style={{ '--face-accent': colleague.accentColor }}
      >
        <PersonaFace
          id={colleagueId}
          size={44}
          className="office-directory-avatar office-directory-avatar--hero"
        />
      </div>
      <div className="office-directory-onboarding-card-copy">
        <span className="office-directory-name">{colleague.name}</span>
        <span className="office-directory-role">{colleague.title}</span>
        {showTranscript && voiceLine ? (
          <p className="office-directory-transcript-line" data-testid="office-directory-transcript">
            {voiceLine}
          </p>
        ) : null}
      </div>
      <IntroVoiceButton
        className="office-directory-card-hear"
        speaking={speakingId === colleagueId}
        idleLabel={copy.hearLabel}
        speakingLabel={copy.hearSpeakingLabel}
        title={copy.hearTitle}
        onClick={() => onHear(colleagueId, { speakerId: colleagueId, text: voiceLine })}
      />
    </li>
  );
}

/**
 * Single-page first-run orientation: name badge → colleague intros (voiced) →
 * desk + assignment chips — all on one scrollable surface.
 */
function OnboardingPage({
  copy,
  userName,
  userRole,
  speakingId,
  touring,
  tourIndex,
  autoPlaying,
  onHear,
  onDismiss,
  onSkip,
  onStartTour,
  showTranscript,
  onToggleTranscript,
  localeToolbar,
  isBoot,
  entryStarters,
  onStarterPick
}) {
  return (
    <div
      className={`office-directory office-directory--onboarding${
        touring ? ' office-directory--cinematic' : ''
      }${showTranscript ? ' is-transcript-on' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      data-testid="office-directory-tour"
    >
      <DirectoryHead
        copy={copy}
        onClose={onDismiss}
        eyebrow={copy.tourEyebrow}
        toolbar={
          <>
            {localeToolbar}
            <IntroTranscriptButton
              enabled={showTranscript}
              label={copy.transcriptLabel}
              enabledLabel={copy.transcriptOnLabel}
              title={copy.transcriptTitle}
              onToggle={onToggleTranscript}
            />
          </>
        }
      />

      <div className="office-directory-onboarding-scroll" data-testid="office-directory-welcome">
        <section className="office-directory-onboarding-intro">
          <NameTag copy={copy.nameTag} />
          {showTranscript ? (
            <>
              <p className="office-directory-greeting">
                {formatLocale(copy.greeting, { name: userName })}
              </p>
              {userRole ? <p className="office-directory-role-line">{userRole}</p> : null}
              <p className="office-directory-tagline">{copy.tagline}</p>
              {copy.greetingHint ? (
                <p className="office-directory-name-hint">{copy.greetingHint}</p>
              ) : null}
            </>
          ) : null}
          {!touring ? (
            <button
              type="button"
              className="office-directory-dismiss office-directory-start-tour"
              data-testid="office-directory-start-tour"
              onClick={onStartTour}
            >
              {copy.startLabel}
            </button>
          ) : autoPlaying ? (
            <p className="office-directory-autoplay-hint" data-testid="office-directory-autoplay">
              {copy.autoplayHint}
            </p>
          ) : null}
        </section>

        <section className="office-directory-onboarding-cast" aria-label={copy.title}>
          <ul className="office-directory-onboarding-roster">
            {COLLEAGUE_IDS.map((colleagueId) => {
              const colleague = officeSenderInfo(colleagueId);
              return (
                <OnboardingColleagueCard
                  key={colleagueId}
                  colleagueId={colleagueId}
                  colleague={colleague}
                  isSpeaking={
                    speakingId === colleagueId ||
                    (touring && tourIndex >= 0 && COLLEAGUE_IDS[tourIndex] === colleagueId)
                  }
                  showTranscript={showTranscript}
                  speakingId={speakingId}
                  onHear={onHear}
                  copy={copy}
                />
              );
            })}
          </ul>
        </section>

        {isBoot && entryStarters ? (
          <section className="office-directory-onboarding-desk" data-testid="office-directory-desk">
            <p className="office-directory-chapter">{copy.deskChapter}</p>
            <p className="office-directory-tagline">{copy.deskIntro}</p>
            <TopicStarters
              hint={entryStarters.hint}
              ariaLabel={entryStarters.ariaLabel}
              starters={entryStarters.starters}
              onPick={onStarterPick}
            />
          </section>
        ) : null}
      </div>

      <div className="office-directory-tour-actions">
        <button type="button" className="office-directory-dismiss" onClick={onDismiss}>
          {copy.dismissLabel}
        </button>
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
          const voiceLine = colleagueVoiceLine(colleague);
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
                onClick={() => onHear(id, { speakerId: id, text: voiceLine })}
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
 * Interactive office directory (docs/office-parody.md): single-page orientation
 * with name badge, voiced colleague intros, desk, and first assignments.
 * Afterwards: "Meet the Office" chip (and desk verb) reopen the roster.
 *
 * While open, the directory publishes pause state so ambience / welcome IMs /
 * advisor popups stay quiet. Voice starts only after "Meet the team" (gesture).
 */
export default function OfficeDirectory({
  onSkipToBuild,
  onBootComplete,
  getSessionId,
  showChip = true,
  placement = 'entry',
  /** When true, orientation owns the screen until Clock in — no backdrop dismiss. */
  isBoot = false,
  /** Assignment chips shown in the desk section during first-run boot. */
  entryStarters = null,
  /** Called when the user picks a starter during boot (after tour dismiss). */
  onStarterPick,
  /** Job title shown under the personalized greeting (default Architect). */
  userRole = 'Architect'
}) {
  const firstRunRef = useRef(!readOfficeDirectorySeen());
  const [open, setOpen] = useState(() => firstRunRef.current);
  /** `null` = full roster browse; `true` = single-page onboarding tour. */
  const [tourOpen, setTourOpen] = useState(() => firstRunRef.current);
  const [touring, setTouring] = useState(false);
  const [tourIndex, setTourIndex] = useState(-1);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);
  const { controls, locale, setLocale } = useUiCopy();
  const directoryUi = useSyncExternalStore(
    subscribeOfficeDirectoryUi,
    getOfficeDirectoryUi,
    getOfficeDirectoryUi
  );
  const handledOpenNonce = useRef(0);
  const autoGenRef = useRef(0);
  const { speakingId, play, stop } = useIntroNarrator({ getSessionId });
  const copy = officeChromeCopy().directory;

  useEffect(() => {
    setOfficeDirectoryOpen(open);
    return () => setOfficeDirectoryOpen(false);
  }, [open]);

  useEffect(() => {
    if (!isBoot) return;
    setOpen(true);
    setTourOpen((current) => (current === null ? true : current));
  }, [isBoot]);

  useEffect(() => {
    if (directoryUi.openNonce <= handledOpenNonce.current) return;
    handledOpenNonce.current = directoryUi.openNonce;
    stop();
    autoGenRef.current += 1;
    setTouring(false);
    setTourIndex(-1);
    setAutoPlaying(false);
    setShowTranscript(false);
    setOpen(true);
    setTourOpen(directoryUi.mode === 'tour');
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
    setTouring(false);
    setTourIndex(-1);
    setAutoPlaying(false);
    setShowTranscript(false);
    writeOfficeDirectorySeen();
    firstRunRef.current = false;
    setTourOpen(null);
    setOpen(false);
    if (wasFirstRun) onBootComplete?.();
  };

  const skipToBuild = () => {
    dismiss();
    onSkipToBuild?.();
  };

  const startTour = () => {
    autoGenRef.current += 1;
    stop();
    setTouring(true);
    setTourIndex(0);
  };

  const handleStarterPick = (prompt) => {
    dismiss();
    onStarterPick?.(prompt);
  };

  // Cinematic run: auto-speak each colleague in order on the single page.
  useEffect(() => {
    if (!open || !touring || tourIndex < 0 || tourIndex >= COLLEAGUE_IDS.length) return undefined;
    const colleagueId = COLLEAGUE_IDS[tourIndex];
    const colleague = officeSenderInfo(colleagueId);
    const gen = ++autoGenRef.current;
    let cancelled = false;
    const ac = new AbortController();
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
      if (tourIndex < COLLEAGUE_IDS.length - 1) {
        setTourIndex((index) => index + 1);
      }
    })();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [open, touring, tourIndex, play]);

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
            setTouring(false);
            setTourIndex(-1);
            setAutoPlaying(false);
            setTourOpen(null);
            setOpen(true);
          }}
        >
          {copy.expandLabel}
        </button>
      </div>
    );
  }

  return (
    <div
      className="office-directory-host office-directory-host--overlay is-open"
      data-placement={placement}
      data-testid="office-directory-modal"
    >
      <button
        type="button"
        className="office-directory-backdrop"
        aria-label={isBoot ? undefined : copy.closeAria}
        aria-hidden={isBoot ? 'true' : undefined}
        tabIndex={isBoot ? -1 : undefined}
        onClick={isBoot ? undefined : dismiss}
      />
      {tourOpen ? (
        <OnboardingPage
          copy={copy}
          userName={userName}
          userRole={userRole}
          speakingId={speakingId}
          touring={touring}
          tourIndex={tourIndex}
          autoPlaying={autoPlaying}
          onHear={hearBeat}
          onDismiss={dismiss}
          onSkip={skipToBuild}
          onStartTour={startTour}
          showTranscript={showTranscript}
          onToggleTranscript={() => setShowTranscript((value) => !value)}
          localeToolbar={
            <IntroLocaleToggle
              locale={locale}
              copy={controls.introLocale}
              onSelectLocale={setLocale}
            />
          }
          isBoot={isBoot}
          entryStarters={entryStarters}
          onStarterPick={handleStarterPick}
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
            setTouring(false);
            setTourIndex(-1);
            setAutoPlaying(false);
            setShowTranscript(false);
            setTourOpen(true);
          }}
        />
      )}
    </div>
  );
}
