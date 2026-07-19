import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  readOfficeDirectorySeen,
  writeOfficeDirectorySeen
} from '../utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import {
  getOfficeDirectoryUi,
  subscribeOfficeDirectoryUi
} from '../state/officeDirectoryUiStore.js';
import { useIntroNarrator } from '../hooks/useIntroNarrator.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import IntroVoiceButton from './IntroVoiceButton.jsx';
import NameTag from './NameTag.jsx';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

/** Title splash → welcome badge → each colleague. */
const STEP_TITLE = 0;
const STEP_WELCOME = 1;
const STEP_FIRST_COLLEAGUE = 2;

/** The line a colleague speaks on ▶: full self-intro when available. */
function colleagueVoiceLine(colleague) {
  if (colleague.introLine) return colleague.introLine;
  return `${colleague.name}. ${colleague.blurb ?? ''}`.trim();
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

/** Cinematic boot screen — interactive game intro title card. */
function TourTitle({ copy, onPressStart }) {
  return (
    <div className="office-directory-title-card" data-testid="office-directory-title">
      <p className="office-directory-boot-eyebrow">{copy.bootEyebrow}</p>
      <h2 className="office-directory-boot-title">{copy.bootTitle}</h2>
      <p className="office-directory-boot-tagline">{copy.bootTagline}</p>
      <ul className="office-directory-boot-bullets" aria-hidden="true">
        {(copy.bootBullets ?? []).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <button
        type="button"
        className="office-directory-press-start"
        data-testid="office-directory-press-start"
        onClick={onPressStart}
      >
        {copy.pressStartLabel}
      </button>
      <p className="office-directory-boot-footnote">{copy.bootFootnote}</p>
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
function TourWelcome({ copy, userName, speakingId, onHear }) {
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
          speaking={speakingId === 'welcome'}
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
    </div>
  );
}

/** One colleague spotlight step with its own click-to-hear voice control. */
function TourColleague({ copy, colleagueId, stepIndex, speakingId, onHear }) {
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

/** The stepped first-run orientation: title → welcome → each colleague → Clock in. */
function DirectoryTour({
  copy,
  step,
  userName,
  speakingId,
  onHear,
  onBack,
  onNext,
  onDismiss,
  onSkip
}) {
  const lastColleagueStep = STEP_FIRST_COLLEAGUE + COLLEAGUE_IDS.length - 1;
  const atLastStep = step >= lastColleagueStep;
  const colleagueIndex = step - STEP_FIRST_COLLEAGUE;

  return (
    <div
      className={`office-directory office-directory--tour${
        step === STEP_TITLE ? ' office-directory--boot' : ''
      }`}
      role="dialog"
      aria-label={copy.title}
      data-testid="office-directory-tour"
    >
      <DirectoryHead
        copy={copy}
        onClose={onDismiss}
        eyebrow={step === STEP_TITLE ? null : copy.tourEyebrow}
      />

      {step === STEP_TITLE ? <TourTitle copy={copy} onPressStart={onNext} /> : null}
      {step === STEP_WELCOME ? (
        <TourWelcome copy={copy} userName={userName} speakingId={speakingId} onHear={onHear} />
      ) : null}
      {step >= STEP_FIRST_COLLEAGUE ? (
        <TourColleague
          copy={copy}
          colleagueId={COLLEAGUE_IDS[colleagueIndex]}
          stepIndex={colleagueIndex + 1}
          speakingId={speakingId}
          onHear={onHear}
        />
      ) : null}

      {step !== STEP_TITLE ? (
        <div className="office-directory-tour-actions">
          {step > STEP_TITLE ? (
            <button type="button" className="office-directory-secondary" onClick={onBack}>
              {copy.backLabel}
            </button>
          ) : null}
          {atLastStep ? (
            <button type="button" className="office-directory-dismiss" onClick={onDismiss}>
              {copy.dismissLabel}
            </button>
          ) : (
            <button type="button" className="office-directory-dismiss" onClick={onNext}>
              {step === STEP_WELCOME ? copy.startLabel : copy.nextLabel}
            </button>
          )}
        </div>
      ) : null}

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
 * Interactive game-style office directory (docs/office-parody.md): cinematic
 * title card → name badge → one-colleague-at-a-time intros with ▶ voice, then
 * Clock in. Afterwards: "Meet the Office" chip (and desk verb) reopen the roster
 * so everybody can introduce themselves again.
 *
 * Voice is click-only Cloud TTS — never autoplayed.
 */
export default function OfficeDirectory({
  onSkipToBuild,
  getSessionId,
  showChip = true,
  placement = 'entry'
}) {
  const firstRunRef = useRef(!readOfficeDirectorySeen());
  const [open, setOpen] = useState(() => firstRunRef.current);
  /** `null` = full roster browse; `0` = title; `1` = welcome; `2..` = colleagues. */
  const [step, setStep] = useState(() => (firstRunRef.current ? STEP_TITLE : null));
  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);
  const directoryUi = useSyncExternalStore(
    subscribeOfficeDirectoryUi,
    getOfficeDirectoryUi,
    getOfficeDirectoryUi
  );
  const handledOpenNonce = useRef(0);
  const { speakingId, play, stop } = useIntroNarrator({ getSessionId });
  const copy = officeChromeCopy().directory;

  useEffect(() => {
    if (directoryUi.openNonce <= handledOpenNonce.current) return;
    handledOpenNonce.current = directoryUi.openNonce;
    stop();
    setOpen(true);
    setStep(directoryUi.mode === 'tour' ? STEP_TITLE : null);
  }, [directoryUi.openNonce, directoryUi.mode, stop]);

  const hearBeat = (id, line) => (speakingId === id ? stop() : play(id, line));

  const dismiss = () => {
    stop();
    writeOfficeDirectorySeen();
    firstRunRef.current = false;
    setStep(null);
    setOpen(false);
  };

  const skipToBuild = () => {
    dismiss();
    onSkipToBuild?.();
  };

  const rootClass =
    placement === 'overlay'
      ? 'office-directory-host office-directory-host--overlay'
      : 'office-directory-host';

  if (!open) {
    if (!showChip) return null;
    return (
      <div className={rootClass}>
        <button
          type="button"
          className="office-directory-chip"
          title={copy.expandTitle}
          data-testid="office-directory-chip"
          onClick={() => {
            setStep(null);
            setOpen(true);
          }}
        >
          {copy.expandLabel}
        </button>
      </div>
    );
  }

  return (
    <div className={`${rootClass}${open ? ' is-open' : ''}`}>
      {placement === 'overlay' ? (
        <button
          type="button"
          className="office-directory-backdrop"
          aria-label={copy.closeAria}
          onClick={dismiss}
        />
      ) : null}
      {step !== null ? (
        <DirectoryTour
          copy={copy}
          step={step}
          userName={userName}
          speakingId={speakingId}
          onHear={hearBeat}
          onBack={() => {
            stop();
            setStep((s) => Math.max(STEP_TITLE, s - 1));
          }}
          onNext={() => {
            stop();
            setStep((s) => s + 1);
          }}
          onDismiss={dismiss}
          onSkip={skipToBuild}
        />
      ) : (
        <DirectoryRoster
          copy={copy}
          speakingId={speakingId}
          onHear={hearBeat}
          onDismiss={dismiss}
          onReplayTour={() => {
            stop();
            setStep(STEP_TITLE);
          }}
        />
      )}
    </div>
  );
}
