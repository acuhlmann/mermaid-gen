import { useEffect, useState } from 'react';
import OfficeMomentShell from './OfficeMomentShell.jsx';
import { PersonaFace } from './personaFaces/index.jsx';
import { useSpokenLineVoice } from '../hooks/useSpokenLineVoice.js';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { cancelOfficeNarration } from '../utils/officeNarration.js';

/** How long "nobody looks up" stays up. Short — it is a beat, not a notice. */
const IGNORED_TTL_MS = 4200;

/**
 * The card with nobody in it: one headed shell, one line of muted italic text,
 * no speaker and nothing to dismiss.
 *
 * Two of the talk channel's states are this shape — waiting for an answer, and
 * finding out there isn't one — and they are the two halves of the same beat,
 * which is why they share a component rather than each spelling out the same
 * five elements. Extracted for the reason § 8 records about the floor modules:
 * small guards like these are what push a component over the complexity
 * threshold, and the shell is identical either way.
 */
function DeskSpeechBeat({ beat }) {
  return (
    <div className="office-desk-speech-stack" role="status" aria-live="polite">
      <OfficeMomentShell
        className={`office-moment-shell--desk-speech ${beat.modifier}`}
        kindClass="office-moment-kind--talk"
        kindLabel={beat.kindLabel}
      >
        <p className={beat.bodyClass} data-testid={beat.testId}>
          {beat.text}
        </p>
      </OfficeMomentShell>
    </div>
  );
}

/**
 * Which beat is showing, if any — a decision, kept out of the component's body
 * because the copy fallbacks it needs are what push that body's complexity up
 * without adding a single branch worth reading.
 *
 * Order is load-bearing. **Silence outranks the last line**: what you last heard
 * from somebody else is not an answer to what you just said, and leaving the old
 * card up under it would read as exactly that.
 *
 * @returns {{modifier: string, kindLabel: string, bodyClass: string,
 *   testId?: string, text: string} | null}
 */
function deskSpeechBeatOf({ copy, pending, pendingColleagueId, ignoredShown }) {
  const room = copy.kindLabelRoom ?? 'To the room';
  if (pending) {
    /* Undirected: nobody has picked it up yet, and one of the outcomes is that
       nobody will — so this heading is *your* half of the exchange, the same one
       the silence beat wears. Heading it "At your desk" would promise somebody
       standing there before the roll, then contradict itself when the room
       ignored you. */
    const named = Boolean(pendingColleagueId);
    return {
      modifier: 'is-pending',
      kindLabel: named ? (copy.kindLabel ?? 'At your desk') : room,
      bodyClass: 'office-desk-speech-pending',
      text: named
        ? formatLocale(copy.pendingNamed ?? '{name} looks up…', {
            name: officeSenderInfo(pendingColleagueId).name
          })
        : (copy.pending ?? 'Somebody looks up…')
    };
  }
  if (ignoredShown) {
    return {
      modifier: 'is-ignored',
      kindLabel: room,
      bodyClass: 'office-desk-speech-ignored',
      testId: 'desk-speech-ignored',
      text: copy.ignored ?? 'Nobody looks up.'
    };
  }
  return null;
}

/**
 * Somebody answering you at your desk (docs/office-parody.md § Desk verbs).
 *
 * This is the desk renderer of the **talk channel** — you said something out
 * loud, or turned to the person next to you, and they said something back. The
 * floor renders the same line as a bubble over their head (`FloorTalk`), from
 * the same `imHistory`. Slop Chat is a different medium (typed IM); talk-channel
 * lines stay out of the messenger window even though they share storage.
 *
 * Not the same thing as `OfficeDeskArrival`, and deliberately so: an arrival
 * announces *that* somebody messaged you and makes you go and read it. This one
 * is the line itself, because you are standing in the conversation — announcing
 * a reply to something you just said would be absurd. `pushOfficeImPing` skips
 * the arrival toast entirely for `channel: 'talk'` so the two never double up.
 *
 * Voice-first like walk-bys and floor talk: narration on + CC off hides the
 * remark while you hear it; actions (Do it) stay visible.
 *
 * ADR-0010: what comes back is a remark. It never touches a slot; if it carries
 * a pitch, only you can pull the trigger (slice 4 broadens that to every cast
 * member, which is why `actionPrompt` is read here rather than assumed absent).
 *
 * **Two of the four answer shapes never reach this component**, which is worth
 * knowing before adding a branch for them. A walk-over is a `walkby` moment and
 * renders as `OfficeWalkBy` (or `FloorWalker` standing up); this card draws the
 * two that answer without moving, told apart by `line.voice` — `'across'` is
 * shouted from their own desk, unmarked is somebody an arm's length away. The
 * fourth, silence, has no line at all and is `ignoredSeq` below.
 *
 * @param {{
 *   line: {
 *     id: string, colleagueId: string, body: string,
 *     voice?: string, actionPrompt?: string
 *   } | null,
 *   pending?: boolean,
 *   pendingColleagueId?: string | null,
 *   ignoredSeq?: number,
 *   captions?: boolean,
 *   narration?: boolean,
 *   narrateLine?: (line: { speakerId: string, text: string }) =>
 *     Promise<{ spoken?: boolean } | void>,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void
 * }} props
 */
export default function OfficeDeskSpeech({
  line = null,
  pending = false,
  pendingColleagueId = null,
  ignoredSeq = 0,
  captions = false,
  narration = false,
  narrateLine,
  onAdoptPrompt
}) {
  const copy = officeChromeCopy().talk ?? {};
  /**
   * Dismissal is presentation, not office state: it means "I have read this
   * card", and the floor has no card to close. Keeping it local is what stops
   * a desk-only flag leaking into the store (ADR-0011 rule 1).
   */
  const [dismissedId, setDismissedId] = useState(/** @type {string | null} */ (null));

  /**
   * The silence clears itself. Every other card here is dismissed because you
   * read it; there is nothing to read in this one, so leaving it up until it is
   * clicked would turn "nobody answered" into a piece of paperwork about nobody
   * answering. Keyed on the seq so a second unanswered remark restarts it.
   */
  const [ignoredShown, setIgnoredShown] = useState(0);
  useEffect(() => {
    if (!ignoredSeq) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (reason: mirroring a bumped signal prop into local presentation state; there is no render-time signal that the room just declined to answer)
    setIgnoredShown(ignoredSeq);
    const timer = setTimeout(() => setIgnoredShown(0), IGNORED_TTL_MS);
    return () => clearTimeout(timer);
  }, [ignoredSeq]);

  const { showSpokenText } = useSpokenLineVoice({
    captions,
    narration,
    narrateLine,
    speakerId: line?.colleagueId ?? '',
    text: line?.body ?? '',
    lineKey: line?.id ?? null
  });

  // Waiting for an answer, or finding out there isn't one — both outrank the
  // last line for the reason `deskSpeechBeatOf` records about its ordering.
  const beat = deskSpeechBeatOf({ copy, pending, pendingColleagueId, ignoredShown });
  if (beat) return <DeskSpeechBeat beat={beat} />;

  if (!line || line.id === dismissedId) return null;

  const speaker = officeSenderInfo(line.colleagueId);
  // Where the voice came from. Only `'across'` is ever marked; see
  // `pushOfficeImPing`.
  const kindLabel =
    line.voice === 'across'
      ? (copy.kindLabelAcross ?? 'From across the room')
      : (copy.kindLabel ?? 'At your desk');

  return (
    <div className="office-desk-speech-stack" role="status" aria-live="polite">
      <OfficeMomentShell
        className={`office-moment-shell--desk-speech${line.voice === 'across' ? ' is-across' : ''}`}
        kindClass="office-moment-kind--talk"
        kindLabel={kindLabel}
        headExtra={
          <button
            type="button"
            className="office-desk-speech-dismiss office-moment-shell-dismiss"
            aria-label={formatLocale(copy.dismissAria ?? 'Get back to work', {
              name: speaker.name
            })}
            onClick={() => {
              cancelOfficeNarration();
              setDismissedId(line.id);
            }}
          >
            ×
          </button>
        }
      >
        <div className="office-desk-speech" style={{ borderColor: speaker.accentColor }}>
          <PersonaFace id={line.colleagueId} size={30} className="office-desk-speech-avatar" />
          <div className="office-desk-speech-content">
            <span className="office-desk-speech-speaker">
              {speaker.name}
              {speaker.title ? (
                <span className="office-desk-speech-title"> · {speaker.title}</span>
              ) : null}
            </span>
            {showSpokenText ? <p className="office-desk-speech-body">{line.body}</p> : null}
            <div className="office-desk-speech-actions">
              {line.actionPrompt && typeof onAdoptPrompt === 'function' ? (
                <button
                  type="button"
                  className="office-desk-speech-adopt"
                  data-testid="desk-speech-adopt"
                  onClick={() => onAdoptPrompt(line.actionPrompt, line.colleagueId)}
                >
                  {copy.adopt ?? 'Do it'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </OfficeMomentShell>
    </div>
  );
}
