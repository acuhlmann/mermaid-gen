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
