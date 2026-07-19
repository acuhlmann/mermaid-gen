import { useRef, useState, useSyncExternalStore } from 'react';
import {
  readOfficeDirectorySeen,
  writeOfficeDirectorySeen
} from '../utils/officeAmbienceStorage.js';
import { OFFICE_COLLEAGUES, officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { resolveUserName, subscribe as subscribeUserName } from '../state/userIdentityStore.js';
import { useIntroNarrator } from '../hooks/useIntroNarrator.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import IntroVoiceButton from './IntroVoiceButton.jsx';
import NameTag from './NameTag.jsx';

const COLLEAGUE_IDS = Object.keys(OFFICE_COLLEAGUES);

/** The line a colleague speaks on ▶: they introduce themselves, then their bit. */
function colleagueVoiceLine(colleague) {
  return `${colleague.name}. ${colleague.blurb ?? ''}`.trim();
}

function DirectoryHead({ copy, onClose }) {
  return (
    <div className="office-directory-head">
      <span className="office-directory-title">🏢 {copy.title}</span>
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

function ColleagueSpotlight({ colleague, colleagueId, progressLabel }) {
  return (
    <div
      className="office-directory-spotlight"
      key={colleagueId}
      data-testid="office-directory-spotlight"
    >
      <p className="office-directory-progress">{progressLabel}</p>
      <PersonaFace
        id={colleagueId}
        size={56}
        className="office-directory-avatar office-directory-avatar--hero"
      />
      <span className="office-directory-name">{colleague.name}</span>
      <span className="office-directory-role">{colleague.title}</span>
      {colleague.blurb ? <p className="office-directory-blurb">{colleague.blurb}</p> : null}
    </div>
  );
}

/** The welcome step: greeting, editable name badge, and Linda's voiced intro. */
function TourWelcome({ copy, userName, speakingId, onHear }) {
  return (
    <div className="office-directory-welcome" data-testid="office-directory-welcome">
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
function TourColleague({ copy, colleagueId, step, speakingId, onHear }) {
  const colleague = officeSenderInfo(colleagueId);
  return (
    <div className="office-directory-spotlight-wrap">
      <ColleagueSpotlight
        colleague={colleague}
        colleagueId={colleagueId}
        progressLabel={formatLocale(copy.progressLabel, {
          current: String(step),
          total: String(COLLEAGUE_IDS.length)
        })}
      />
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

/** The stepped first-run orientation: welcome → each colleague → Clock in. */
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
  const atLastStep = step >= COLLEAGUE_IDS.length;
  return (
    <div
      className="office-directory office-directory--tour"
      role="dialog"
      aria-label={copy.title}
      data-testid="office-directory-tour"
    >
      <DirectoryHead copy={copy} onClose={onDismiss} />

      {step === 0 ? (
        <TourWelcome copy={copy} userName={userName} speakingId={speakingId} onHear={onHear} />
      ) : (
        <TourColleague
          copy={copy}
          colleagueId={COLLEAGUE_IDS[step - 1]}
          step={step}
          speakingId={speakingId}
          onHear={onHear}
        />
      )}

      <div className="office-directory-tour-actions">
        {step > 0 ? (
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
            {step === 0 ? copy.startLabel : copy.nextLabel}
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
function DirectoryRoster({ copy, speakingId, onHear, onDismiss }) {
  return (
    <div
      className="office-directory office-directory--roster"
      role="region"
      aria-label={copy.title}
      data-testid="office-directory-roster"
    >
      <DirectoryHead copy={copy} onClose={onDismiss} />
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
      <button type="button" className="office-directory-dismiss" onClick={onDismiss}>
        {copy.dismissLabel}
      </button>
    </div>
  );
}

/**
 * The office directory (docs/office-parody.md): entry-screen "meet the floor"
 * orientation. First run walks the cast one person at a time (welcome → each
 * colleague → Clock in) so the story lands incrementally; afterwards it lives
 * as a "Meet the floor" chip that reopens the full roster.
 *
 * Two things make it more than a static list: every beat has a ▶ that plays the
 * line in that colleague's real Cloud-TTS voice (synthesized only on the click,
 * never autoplayed — so preview bots can't burn the free tier), and the welcome
 * step carries the editable name badge plus a "skip the ceremony" escape hatch
 * for anyone who just wants the canvas.
 *
 * Self-contained: owns open/seen/step state; App only supplies the skip target
 * and the session id for the voice endpoint.
 */
export default function OfficeDirectory({ onSkipToBuild, getSessionId }) {
  const firstRunRef = useRef(!readOfficeDirectorySeen());
  const [open, setOpen] = useState(() => firstRunRef.current);
  /** `null` = full roster browse; `0` = welcome; `1..n` = colleague spotlight. */
  const [step, setStep] = useState(() => (firstRunRef.current ? 0 : null));
  const userName = useSyncExternalStore(subscribeUserName, resolveUserName, resolveUserName);
  const { speakingId, play, stop } = useIntroNarrator({ getSessionId });
  const copy = officeChromeCopy().directory;

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

  if (!open) {
    return (
      <button
        type="button"
        className="office-directory-chip"
        title={copy.expandTitle}
        onClick={() => {
          setStep(null);
          setOpen(true);
        }}
      >
        {copy.expandLabel}
      </button>
    );
  }

  if (step !== null) {
    return (
      <DirectoryTour
        copy={copy}
        step={step}
        userName={userName}
        speakingId={speakingId}
        onHear={hearBeat}
        onBack={() => {
          stop();
          setStep((s) => Math.max(0, s - 1));
        }}
        onNext={() => {
          stop();
          setStep((s) => s + 1);
        }}
        onDismiss={dismiss}
        onSkip={skipToBuild}
      />
    );
  }

  return (
    <DirectoryRoster copy={copy} speakingId={speakingId} onHear={hearBeat} onDismiss={dismiss} />
  );
}
