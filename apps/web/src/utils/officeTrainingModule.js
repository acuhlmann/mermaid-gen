/**
 * The canned compliance-training module (docs/office-parody.md §10.1) — what
 * Linda serves when the LLM budget is spent, the server is unconfigured, or the
 * model authored something `parseFormsA2ui` rejects.
 *
 * Pure builders returning A2UI v0.9 document strings, so the fallback path is
 * unit-testable without a network or a renderer. The documents here are held to
 * exactly the same contract as model-authored ones — a test parses them through
 * `parseFormsA2ui`, because a fallback that fails validation is worse than no
 * fallback: it degrades into the error state the fallback exists to avoid.
 *
 * These forms are deliberately *less* personalized than the LLM ones (they get
 * canvas labels, not the diagram) — that gap is the whole reason the LLM path
 * exists, and it is the honest shape of "the office is cheaper today".
 */

import {
  A2UI_BASIC_CATALOG_ID,
  FORMS_A2UI_SURFACE_ID,
  FORMS_A2UI_VERSION,
  TRAINING_DAYS_OVERDUE,
  TRAINING_MODULE_TOTAL
} from '@archislop/shared';

/**
 * Event name on every training Button. Free-form flavour by the A2UI contract —
 * the renderer collapses every event to one capability — but naming it after
 * the act keeps the submitted payload readable in tests and logs.
 */
export const TRAINING_SUBMIT_EVENT = 'archislop_submitTraining';

const AGENCY = 'People Ops — Learning, Development, Compliance & Culture';

/** A canvas label to hang the joke on, with a fallback for an empty canvas. */
function pickSubject(labels) {
  const usable = (Array.isArray(labels) ? labels : [])
    .map((label) => (typeof label === 'string' ? label.trim() : ''))
    .filter((label) => label && label.length <= 60);
  return usable[0] ?? 'your diagram';
}

function secondSubject(labels, fallback) {
  const usable = (Array.isArray(labels) ? labels : [])
    .map((label) => (typeof label === 'string' ? label.trim() : ''))
    .filter((label) => label && label.length <= 60);
  return usable[1] ?? fallback;
}

/** Flatten one prior answer into something quotable in a label. */
function quoteAnswer(priorAnswers) {
  const first = (Array.isArray(priorAnswers) ? priorAnswers : []).find(
    (answer) => answer && answer.value !== '' && answer.value != null && answer.value !== false
  );
  if (!first) return 'nothing at all';
  const value = Array.isArray(first.value) ? first.value.join(', ') : String(first.value);
  return value.trim() ? value.slice(0, 60) : 'nothing at all';
}

function surfaceMessage() {
  return {
    version: 'v0.9',
    createSurface: { surfaceId: FORMS_A2UI_SURFACE_ID, catalogId: A2UI_BASIC_CATALOG_ID }
  };
}

function dataMessage(value) {
  return {
    version: 'v0.9',
    updateDataModel: { surfaceId: FORMS_A2UI_SURFACE_ID, path: '/', value }
  };
}

function componentsMessage(components) {
  return {
    version: 'v0.9',
    updateComponents: { surfaceId: FORMS_A2UI_SURFACE_ID, components }
  };
}

/** Masthead block shared by both steps — same letterhead, escalating form code. */
function masthead({ icon, title, code }) {
  return [
    {
      id: 'masthead',
      component: 'Row',
      justify: 'start',
      align: 'center',
      children: ['mast_icon', 'mast_col']
    },
    { id: 'mast_icon', component: 'Text', text: icon, variant: 'h2' },
    { id: 'mast_col', component: 'Column', children: ['agency_txt', 'title_txt', 'code_txt'] },
    { id: 'agency_txt', component: 'Text', text: AGENCY, variant: 'caption' },
    { id: 'title_txt', component: 'Text', text: title, variant: 'h3' },
    { id: 'code_txt', component: 'Text', text: code, variant: 'caption' }
  ];
}

function submitRow(note, label) {
  return [
    {
      id: 'submit_row',
      component: 'Row',
      justify: 'spaceBetween',
      align: 'center',
      children: ['submit_note', 'submit_btn']
    },
    { id: 'submit_note', component: 'Text', text: note, variant: 'caption' },
    { id: 'submit_btn_txt', component: 'Text', text: label, variant: 'body' },
    {
      id: 'submit_btn',
      component: 'Button',
      variant: 'primary',
      child: 'submit_btn_txt',
      action: { event: { name: TRAINING_SUBMIT_EVENT, context: {} } }
    }
  ];
}

function buildModuleForm({ moduleNumber, labels }) {
  const subject = pickSubject(labels);
  const other = secondSubject(labels, 'the arrow next to it');
  return {
    archislopFormsVersion: FORMS_A2UI_VERSION,
    formTitle: `Working Safely With Diagrams — Module ${moduleNumber} of ${TRAINING_MODULE_TOTAL}`,
    formCode: `WSWD-000${moduleNumber}-R7`,
    agencyName: AGENCY,
    messages: [
      surfaceMessage(),
      componentsMessage([
        {
          id: 'root',
          component: 'Column',
          children: [
            'masthead',
            'overdue_card',
            'blurb',
            'div0',
            'sec1_hdr',
            'q_hazard',
            'q_owner',
            'echo_owner',
            'q_alignment',
            'align_note',
            'div1',
            'sec2_hdr',
            'q_ack',
            'q_confirm',
            'div2',
            'submit_row'
          ]
        },
        ...masthead({
          icon: '🎓',
          title: `Module ${moduleNumber} — Diagram Hazard Awareness`,
          code: `Form WSWD-000${moduleNumber}-R7 · rev. 7 · supersedes rev. 7`
        }),
        { id: 'overdue_card', component: 'Card', child: 'overdue_col' },
        {
          id: 'overdue_col',
          component: 'Column',
          align: 'center',
          children: ['overdue_num', 'overdue_cap']
        },
        {
          id: 'overdue_num',
          component: 'Text',
          text: String(TRAINING_DAYS_OVERDUE),
          variant: 'h1'
        },
        {
          id: 'overdue_cap',
          component: 'Text',
          text: 'days overdue — but who is counting! (Learning & Development is counting.)',
          variant: 'caption'
        },
        {
          id: 'blurb',
          component: 'Text',
          text: 'Just a friendly nudge! 😊 This module takes four hours and cannot be paused, skipped, or completed. There are no wrong answers, and we do track which ones you pick.',
          variant: 'body'
        },
        { id: 'div0', component: 'Divider' },
        {
          id: 'sec1_hdr',
          component: 'Text',
          text: '⚠️ Section 1 — Hazard Identification',
          variant: 'h5'
        },
        {
          id: 'q_hazard',
          component: 'ChoicePicker',
          label: `You observe "${subject}" on a colleague's screen. What is your FIRST action? (select exactly one)`,
          variant: 'mutuallyExclusive',
          options: [
            { label: 'Escalate to the appropriate channel', value: 'escalate' },
            { label: 'Raise it through the correct escalation path', value: 'raise' },
            { label: 'Route it to the channel where escalations are raised', value: 'route' },
            { label: 'Do nothing, then document that you escalated', value: 'document' }
          ],
          value: { path: '/hazard' }
        },
        {
          id: 'q_owner',
          component: 'TextField',
          label: `Name the individual accountable for "${other}". If unowned, enter your own name.`,
          variant: 'shortText',
          value: { path: '/owner' }
        },
        {
          id: 'echo_owner',
          component: 'Text',
          variant: 'caption',
          text: {
            call: 'formatString',
            args: {
              value:
                'Thank you! ${/owner} has been recorded as the accountable party and notified in a system they do not have access to.'
            },
            returnType: 'string'
          }
        },
        {
          id: 'q_alignment',
          component: 'Slider',
          label: 'Rate your perceived alignment posture (0–5). This is not a test.',
          min: 0,
          max: 5,
          value: { path: '/alignment' }
        },
        {
          id: 'align_note',
          component: 'Text',
          variant: 'caption',
          text: {
            call: 'formatString',
            args: {
              value:
                'Alignment posture logged at ${/alignment} of 5. A posture below 5 will be revisited in Module ${/nextModule}.'
            },
            returnType: 'string'
          }
        },
        { id: 'div1', component: 'Divider' },
        { id: 'sec2_hdr', component: 'Text', text: '✒️ Section 2 — Attestations', variant: 'h5' },
        {
          id: 'q_ack',
          component: 'CheckBox',
          label: 'I have read the Diagram Safety Handbook (required — the handbook is forthcoming)',
          value: { path: '/ack' }
        },
        {
          id: 'q_confirm',
          component: 'CheckBox',
          label: 'I confirm I have NOT read the handbook (also required)',
          value: { path: '/confirm' },
          checks: [
            {
              condition: {
                call: 'not',
                args: { value: { path: '/ack' } },
                returnType: 'boolean'
              },
              message:
                'This attestation is valid only while the box above is unchecked. Please reconcile with the box above, then this box, then the box above.'
            }
          ]
        },
        { id: 'div2', component: 'Divider' },
        ...submitRow(
          'Estimated completion: 4 hours. Elapsed: irrelevant.',
          'Submit & Continue to Attestation'
        )
      ]),
      dataMessage({
        hazard: '',
        owner: '',
        alignment: 0,
        ack: false,
        confirm: false,
        nextModule: moduleNumber + 1
      })
    ]
  };
}

function buildAttestationForm({ moduleNumber, priorAnswers }) {
  const quoted = quoteAnswer(priorAnswers);
  return {
    archislopFormsVersion: FORMS_A2UI_VERSION,
    formTitle: `Post-Module Attestation ${moduleNumber}-A — Confirmation of Confirmation`,
    formCode: `WSWD-000${moduleNumber}-ATT`,
    agencyName: AGENCY,
    messages: [
      surfaceMessage(),
      componentsMessage([
        {
          id: 'root',
          component: 'Column',
          children: [
            'masthead',
            'blurb',
            'div0',
            'q_understood',
            'q_recall',
            'echo_recall',
            'q_contradiction',
            'div1',
            'submit_row'
          ]
        },
        ...masthead({
          icon: '🧾',
          title: `Attestation ${moduleNumber}-A — Confirmation of Confirmation`,
          code: `Form WSWD-000${moduleNumber}-ATT · generated by completing a form`
        }),
        {
          id: 'blurb',
          component: 'Text',
          text: `Wonderful work! Completing Module ${moduleNumber} has generated this attestation. Completing this attestation will generate the certificate. The certificate generates nothing, and is not accepted as proof of completion.`,
          variant: 'body'
        },
        { id: 'div0', component: 'Divider' },
        {
          id: 'q_understood',
          component: 'CheckBox',
          label: 'I understood the material (the material was not provided)',
          value: { path: '/understood' }
        },
        {
          id: 'q_recall',
          component: 'TextField',
          label: `You answered "${quoted}". In your own words, explain why.`,
          variant: 'longText',
          value: { path: '/recall' }
        },
        {
          id: 'echo_recall',
          component: 'Text',
          variant: 'caption',
          text: {
            call: 'formatString',
            args: {
              value:
                'Your reflection ("${/recall}") has been filed. Reflections are reviewed quarterly by a committee that was dissolved in 2019.'
            },
            returnType: 'string'
          }
        },
        {
          id: 'q_contradiction',
          component: 'CheckBox',
          label: 'I did not understand the material and wish to proceed (required)',
          value: { path: '/contradiction' },
          checks: [
            {
              condition: {
                call: 'not',
                args: { value: { path: '/understood' } },
                returnType: 'boolean'
              },
              message:
                'You have indicated both understanding and non-understanding. This is the expected outcome. No action is required, and you must act on it.'
            }
          ]
        },
        { id: 'div1', component: 'Divider' },
        ...submitRow(
          'One (1) certificate will be issued. It expires on issue.',
          'Submit & Receive Certificate'
        )
      ]),
      dataMessage({ understood: false, recall: '', contradiction: false })
    ]
  };
}

/**
 * Build the canned training document for a step.
 *
 * @param {{
 *   step?: number,
 *   moduleNumber?: number,
 *   labels?: string[],
 *   priorAnswers?: Array<{ label: string, value: unknown }>
 * }} [options]
 * @returns {string} A2UI v0.9 document JSON — valid by `parseFormsA2ui`.
 */
export function buildCannedTrainingForm({
  step = 1,
  moduleNumber = 3,
  labels = [],
  priorAnswers = []
} = {}) {
  const doc =
    step >= 2
      ? buildAttestationForm({ moduleNumber, priorAnswers })
      : buildModuleForm({ moduleNumber, labels });
  return `${JSON.stringify(doc, null, 2)}\n`;
}
