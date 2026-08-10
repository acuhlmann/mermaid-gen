/**
 * Wire shapes for the office-parody ambience layer (see docs/office-parody.md).
 *
 * An office "moment" is one interruption from a fictional colleague — an email,
 * an IM ping, an over-the-shoulder walk-by, a coffee-break line, or a meeting
 * invite. A meeting "script" is the pre-generated beat list a WG meeting plays
 * back client-side. The server validates model output against these schemas;
 * the client safe-parses the HTTP responses with the same shapes.
 */

import { z } from 'zod';

export const OFFICE_MOMENT_KINDS = ['email', 'im', 'walkby', 'coffee', 'meeting-invite'] as const;

export const OfficeMomentKindSchema = z.enum(OFFICE_MOMENT_KINDS);

export type OfficeMomentKind = z.infer<typeof OfficeMomentKindSchema>;

export const OFFICE_EMAIL_SUBJECT_MAX_CHARS = 120;
export const OFFICE_MOMENT_BODY_MAX_CHARS = 600;
export const OFFICE_ACTION_PROMPT_MAX_CHARS = 300;

/**
 * *Why* a colleague is speaking, when the answer is something the room did
 * rather than something the user typed.
 *
 * `kind` has always said what shape a moment takes and `userMessage` has said
 * what it is answering, but between them sat a blind spot: a moment the user
 * physically **caused** without addressing anybody. The prompt's default
 * framing is a cold open — "MUST SURPRISE", pick an angle nobody used yet —
 * which is exactly right for a moment a timer decided to fire and exactly
 * wrong for one the user walked across the room to trigger. The model was
 * being asked to open a conversation it was in fact continuing, so the line
 * came back as a non-sequitur: correct voice, correct diagram, no connection
 * to the thing that had just happened.
 *
 * A **closed set**, not free text, for two reasons. Client-supplied prose
 * interpolated into a system prompt is an injection surface for no benefit —
 * the server already knows how each circumstance should read, and phrasing it
 * here keeps tone and locale beside the rest of the voice (`officePersonas.js`)
 * instead of scattering it across call sites. And the situations are genuinely
 * few: this is the register `office-parody.md` § 11 calls **reactive**, which
 * is self-limiting by construction, because the user has to do something to
 * cause one.
 *
 * Absent is the honest default and means "nobody caused this" — every ambient,
 * timer-driven moment omits the field and keeps the cold-open framing it was
 * written for.
 */
export const OFFICE_MOMENT_SITUATIONS = ['dwell', 'run'] as const;

export const OfficeMomentSituationSchema = z.enum(OFFICE_MOMENT_SITUATIONS);

export type OfficeMomentSituation = z.infer<typeof OfficeMomentSituationSchema>;

/** One office moment as returned by `POST /api/office/moment`. */
export const OfficeMomentResponseSchema = z.object({
  colleagueId: z.string().min(1).max(40),
  kind: OfficeMomentKindSchema,
  /** Email subject line — only meaningful for kind "email". */
  subject: z.string().max(OFFICE_EMAIL_SUBJECT_MAX_CHARS).optional(),
  body: z.string().min(1).max(OFFICE_MOMENT_BODY_MAX_CHARS),
  /**
   * When present, the moment is actionable: a concrete diagram change the user
   * can adopt with one click (fed into the normal intent prompt path).
   */
  actionPrompt: z.string().max(OFFICE_ACTION_PROMPT_MAX_CHARS).optional()
});

export type OfficeMomentResponse = z.infer<typeof OfficeMomentResponseSchema>;

export const MEETING_BEAT_KINDS = ['procedural', 'smalltalk', 'substantive', 'offRails'] as const;

export const MeetingBeatKindSchema = z.enum(MEETING_BEAT_KINDS);

export type MeetingBeatKind = z.infer<typeof MeetingBeatKindSchema>;

export const MEETING_BEAT_TEXT_MAX_CHARS = 280;
export const MEETING_MIN_BEATS = 6;
/** A 1:1 headset sync only has one scripted colleague — fewer beats still land. */
export const MEETING_MIN_BEATS_DYAD = 4;
export const MEETING_MAX_BEATS = 14;
/** Floor for a 1:1 headset sync or a pulled-together pair. */
export const MEETING_MIN_ATTENDEES = 1;
/** Ceiling for a pulled-together group (route + client roster share this). */
export const MEETING_MAX_ATTENDEES = 8;
/**
 * Ceiling for `diagramSource` on office LLM routes (meeting / moment / huddle).
 * Slot content (especially anything / forms) can be far larger; callers must
 * truncate rather than 400 the request — a failed meeting becomes Pam's
 * CANCELLED email on the client.
 */
export const OFFICE_DIAGRAM_SOURCE_MAX_CHARS = 20_000;

/** One utterance in a WG meeting. */
export const MeetingBeatSchema = z.object({
  speakerId: z.string().min(1).max(40),
  kind: MeetingBeatKindSchema,
  text: z.string().min(1).max(MEETING_BEAT_TEXT_MAX_CHARS),
  /** Only meaningful on "substantive" beats — becomes a "Do it" action item. */
  actionPrompt: z.string().max(OFFICE_ACTION_PROMPT_MAX_CHARS).optional()
});

export type MeetingBeat = z.infer<typeof MeetingBeatSchema>;

/**
 * The full meeting script as returned by `POST /api/office/meeting`. Parsing is
 * deliberately looser than the content policy (beats min 3) — use
 * `normalizeMeetingScript` afterwards to enforce speaker allowlist, beat caps,
 * and the "at least one substantive beat" rule.
 */
export const MeetingScriptSchema = z.object({
  scriptVersion: z.literal(1),
  title: z.string().min(1).max(140),
  beats: z.array(MeetingBeatSchema).min(3).max(30)
});

export type MeetingScript = z.infer<typeof MeetingScriptSchema>;

/**
 * Enforce the meeting content policy on a parsed script:
 * - drop beats from speakers outside the attendee list (model hallucinating guests);
 * - cap at MEETING_MAX_BEATS;
 * - strip actionPrompt from non-substantive beats;
 * - require at least one substantive beat and MEETING_MIN_BEATS total afterwards.
 *
 * Returns the normalized script, or null when the script is unusable.
 */
export function normalizeMeetingScript(
  script: MeetingScript,
  attendees: readonly string[],
  { minBeats = MEETING_MIN_BEATS }: { minBeats?: number } = {}
): MeetingScript | null {
  const allowed = new Set(attendees);
  const beats = script.beats
    .filter((beat) => allowed.has(beat.speakerId))
    .slice(0, MEETING_MAX_BEATS)
    .map((beat) =>
      beat.kind === 'substantive' || beat.actionPrompt === undefined
        ? beat
        : { ...beat, actionPrompt: undefined }
    );
  if (beats.length < minBeats) return null;
  if (!beats.some((beat) => beat.kind === 'substantive')) return null;
  return { ...script, beats };
}
