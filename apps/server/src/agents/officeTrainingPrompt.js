/**
 * Linda's compliance training as a real, fillable form (docs/office-parody.md
 * §10.1). The joke only works if the module is *about the user's actual
 * diagram* — "Working Safely With Diagrams" asking generic questions is a
 * screenshot; asking whether `paymentGateway` has been risk-assessed is a
 * training module.
 *
 * This is the second surface in archislop where a model authors A2UI directly
 * (the `forms` slot is the first). It reuses `FORMS_CORE_RULES` verbatim rather
 * than restating the contract: that block's own docstring promises it mirrors
 * `parseFormsA2ui` exactly, and a second copy would drift from the validator
 * the first time either changed.
 *
 * What is deliberately NOT shared with forms mode:
 * - **No repair ladder.** The forms slot climbs `formsSyntaxFixer` before the
 *   agent retries, because the user asked for a form and an empty slot is a
 *   failure. Nobody asked Linda for anything. A null here falls back to the
 *   canned module, in character, per this route family's "a null result is a
 *   feature, not an error" doctrine (`routes/office.js`).
 * - **No slot.** The document never reaches the user's `forms` slot — ADR-0010:
 *   the cast produces no slot content. It lives in window-local state and dies
 *   with the window.
 */

import {
  parseFormsA2ui,
  TRAINING_DAYS_OVERDUE,
  TRAINING_MODULE_TOTAL,
  TRAINING_STEPS
} from '@archislop/shared';
import { FORMS_CORE_RULES } from '../prompts/formsSystemPrompt.js';
import { buildOfficeLanguageRule } from './officePersonas.js';
import { buildOfficeLogBlock } from './_lib/officeLogPrompt.js';

export { TRAINING_MODULE_TOTAL, TRAINING_STEPS };

const STEP_BRIEFS = [
  `This is the MODULE ITSELF. Build a 4-6 question quiz about "diagram safety" that is
transparently about nothing. At least two questions must name something real from their
diagram (a node label, the diagram type) and treat it as a compliance hazard. Include one
question whose options are all the same answer phrased differently, and one Slider labelled
as measuring something unmeasurable ("perceived alignment", "readiness posture").`,
  `This is the ATTESTATION that follows the module — shorter (3-4 fields), and its entire
premise is that completing the quiz created new paperwork. Attest to having understood
things that were never explained. Reference at least one answer the user actually gave
(quote it back at them in a Text echo or a label). One field must ask them to confirm a
statement that contradicts the checkbox above it.`
];

/**
 * @param {{ uiLocale?: string, step?: number }} args
 */
export function buildTrainingSystemPrompt({ uiLocale, step = 1 } = {}) {
  const stepIndex = Math.min(Math.max(step, 1), TRAINING_STEPS) - 1;
  return `You are Linda from People Ops at archislop, authoring a mandatory compliance training
module as an interactive form. Weaponized cheerfulness: mandatory fun, overdue trainings, wellness
language deployed as a threat. One 😊 maximum in the whole document. Every instruction is "just a
friendly nudge!". You are never hostile — you are relentlessly, terrifyingly supportive.

${FORMS_CORE_RULES}

WHAT TO WRITE THIS TURN:
${STEP_BRIEFS[stepIndex]}

TONE RULES:
- The form must be FILLABLE and finishable. The comedy is in the labels, never in trapping the user.
- Questions have no right answer, and the form implies it is tracking that you noticed.
- Corporate-wellness register: "let's align", "circle back", "own your learning journey".
- Cite fake policy numbers, revision histories, and a form code. Reference the ${TRAINING_DAYS_OVERDUE}-day overdue status.
- NEVER break character to explain the joke. No winking. Linda means all of it.

Reply with ONLY the JSON object — no prose before or after, no markdown code fence.${buildOfficeLanguageRule(uiLocale)}`;
}

/**
 * @param {{
 *   contentType?: string,
 *   diagramSource?: string,
 *   visibleLabels?: string[],
 *   officeLog?: string[],
 *   userName?: string,
 *   moduleNumber?: number,
 *   step?: number,
 *   priorAnswers?: Array<{ label: string, value: unknown }>
 * }} payload
 */
export function buildTrainingUserPrompt(payload = {}) {
  const {
    contentType = 'mermaid',
    diagramSource = '',
    visibleLabels = [],
    officeLog = [],
    userName = '',
    moduleNumber = 3,
    step = 1,
    priorAnswers = []
  } = payload;

  const lines = [
    `Course: "Working Safely With Diagrams" — Module ${moduleNumber} of ${TRAINING_MODULE_TOTAL}.`,
    `Status: ${TRAINING_DAYS_OVERDUE} days overdue.`,
    `This is form ${step} of ${TRAINING_STEPS} in this sitting.`
  ];
  if (userName.trim()) lines.push(`Trainee: ${userName.trim()}`);
  lines.push(`They are working on a ${contentType} diagram.`);

  if (visibleLabels.length > 0) {
    lines.push(
      '',
      'Labels visible on their canvas right now (use these — this is the whole joke):'
    );
    for (const label of visibleLabels.slice(0, 20)) lines.push(`- ${label}`);
  }
  if (diagramSource.trim()) {
    lines.push('', 'Their diagram source:', '```', diagramSource.slice(0, 2000), '```');
  }

  if (priorAnswers.length > 0) {
    lines.push('', 'What they answered on the previous form (quote at least one back at them):');
    for (const answer of priorAnswers.slice(0, 12)) {
      const value = Array.isArray(answer?.value) ? answer.value.join(', ') : String(answer?.value);
      lines.push(`- ${String(answer?.label ?? '').slice(0, 120)}: ${value.slice(0, 120)}`);
    }
  }

  const logBlock = buildOfficeLogBlock(officeLog, { purpose: 'dialogue' });
  if (logBlock) lines.push(...logBlock);

  return lines.join('\n');
}

/**
 * Validate a model-authored training document through the same gate the forms
 * slot uses.
 *
 * @param {string} raw
 * @returns {{ form: string, formTitle: string } | null} null when the model
 *   produced something the catalog allowlist rejects — the caller falls back to
 *   the canned module rather than surfacing an error.
 */
export function parseTrainingReply(raw) {
  const result = parseFormsA2ui(typeof raw === 'string' ? raw : '');
  if (!result.ok) return null;
  return { form: result.text, formTitle: result.doc.formTitle };
}
