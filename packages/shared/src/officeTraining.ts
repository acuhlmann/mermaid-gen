/**
 * Shape of Linda's compliance training (docs/office-parody.md §10.1).
 *
 * These two numbers live in shared rather than on either side because both
 * sides enforce them independently: the server Zod-caps the incoming `step`,
 * and the client drives the counter that produces it. Duplicated, a drift
 * would surface as a 400 on the *last* form of the gauntlet only — the most
 * expensive place to find it.
 *
 * The training document itself is validated by `parseFormsA2ui`, the same gate
 * the `forms` slot uses. Nothing about the training is a diagram slot: it is
 * window-local state that dies with the window (ADR-0010 — the cast produces
 * no slot content).
 */

/** Modules in the course, per Linda's own overdue-training email. */
export const TRAINING_MODULE_TOTAL = 11;

/**
 * Forms in one sitting before the certificate. Two, not eleven: the office LLM
 * budget buys two calls, and the eleven-module joke lands better as a closing
 * threat ("Module 4 is now due") than as an eleven-form slog the user abandons
 * at three.
 */
export const TRAINING_STEPS = 2;

/** How many days overdue the course is. Quoted in copy on both sides. */
export const TRAINING_DAYS_OVERDUE = 847;
