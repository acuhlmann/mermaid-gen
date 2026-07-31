import { useState } from 'react';
import OfficeMomentShell from './OfficeMomentShell.jsx';
import { PersonaFace } from './personaFaces/index.jsx';
import { useSpokenLineVoice } from '../hooks/useSpokenLineVoice.js';
import { officeChromeCopy, officeSenderInfo } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';

/**
 * Somebody answering you at your desk (docs/office-parody.md § Desk verbs).
 *
 * This is the desk renderer of the **talk channel** — you said something out
 * loud, or turned to the person next to you, and they said something back. The
 * floor renders the same line as a bubble over their head (`FloorTalk`), from
 * the same `imHistory`; neither surface owns the conversation, which is why the
 * whole exchange is still in Slop Chat afterwards (ADR-0011 rule 1).
 *
 * Not the same thing as `OfficeDeskArrival`, and deliberately so: an arrival
 * announces *that* somebody messaged you and makes you go and read it. This one
 * is the line itself, because you are standing in the conversation — announcing
 * a reply to something you just said would be absurd. `pushOfficeImPing` skips
 * the arrival toast entirely for `channel: 'talk'` so the two never double up.
 *
 * Voice-first like walk-bys and floor talk: narration on + CC off hides the
 * remark while you hear it; actions (Do it / open thread) stay visible.
 *
 * ADR-0010: what comes back is a remark. It never touches a slot; if it carries
 * a pitch, only you can pull the trigger (slice 4 broadens that to every cast
 * member, which is why `actionPrompt` is read here rather than assumed absent).
 *
 * @param {{
 *   line: { id: string, colleagueId: string, body: string, actionPrompt?: string } | null,
 *   pending?: boolean,
 *   pendingColleagueId?: string | null,
 *   captions?: boolean,
 *   narration?: boolean,
 *   narrateLine?: (line: { speakerId: string, text: string }) =>
 *     Promise<{ spoken?: boolean } | void>,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onOpenThread?: (colleagueId: string) => void
 * }} props
 */
export default function OfficeDeskSpeech({
  line = null,
  pending = false,
  pendingColleagueId = null,
  captions = false,
  narration = false,
  narrateLine,
  onAdoptPrompt,
  onOpenThread
}) {
  const copy = officeChromeCopy().talk ?? {};
  /**
   * Dismissal is presentation, not office state: it means "I have read this
   * card", and the floor has no card to close. Keeping it local is what stops
   * a desk-only flag leaking into the store (ADR-0011 rule 1).
   */
  const [dismissedId, setDismissedId] = useState(/** @type {string | null} */ (null));

  const { showSpokenText } = useSpokenLineVoice({
    captions,
    narration,
    narrateLine,
    speakerId: line?.colleagueId ?? '',
    text: line?.body ?? '',
    lineKey: line?.id ?? null
  });

  if (pending) {
    const waiting = officeSenderInfo(pendingColleagueId);
    return (
      <div className="office-desk-speech-stack" role="status" aria-live="polite">
        <OfficeMomentShell
          className="office-moment-shell--desk-speech is-pending"
          kindClass="office-moment-kind--talk"
          kindLabel={copy.kindLabel ?? 'At your desk'}
        >
          <p className="office-desk-speech-pending">
            {pendingColleagueId
              ? formatLocale(copy.pendingNamed ?? '{name} looks up…', { name: waiting.name })
              : (copy.pending ?? 'Somebody looks up…')}
          </p>
        </OfficeMomentShell>
      </div>
    );
  }

  if (!line || line.id === dismissedId) return null;

  const speaker = officeSenderInfo(line.colleagueId);

  return (
    <div className="office-desk-speech-stack" role="status" aria-live="polite">
      <OfficeMomentShell
        className="office-moment-shell--desk-speech"
        kindClass="office-moment-kind--talk"
        kindLabel={copy.kindLabel ?? 'At your desk'}
        headExtra={
          <button
            type="button"
            className="office-desk-speech-dismiss office-moment-shell-dismiss"
            aria-label={formatLocale(copy.dismissAria ?? 'Get back to work', {
              name: speaker.name
            })}
            onClick={() => setDismissedId(line.id)}
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
              {typeof onOpenThread === 'function' ? (
                <button
                  type="button"
                  className="office-desk-speech-thread"
                  onClick={() => onOpenThread(line.colleagueId)}
                >
                  {copy.openThread ?? 'Open the thread'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </OfficeMomentShell>
    </div>
  );
}
