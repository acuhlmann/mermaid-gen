import { A2UI_BASIC_CATALOG_ID } from './critiqueA2uiMessages.js';

/**
 * Forms mode: **model-authored** A2UI v0.9 documents.
 *
 * This is the deliberate counterpart to the critique checklist. In critique the
 * LLM writes Markdown and the server builds A2UI deterministically
 * (`buildCritiqueActionableA2uiMessages`) — the model never touches UI JSON. In
 * forms mode the model authors the A2UI messages directly (the "how it's meant
 * to be used" path). Safety therefore comes from validation here, not from a
 * deterministic builder:
 *
 * 1. JSON parse (with code-fence tolerance).
 * 2. Wrapper shape ({@link FORMS_A2UI_VERSION}, title, messages array).
 * 3. Allowlisted catalog id ({@link A2UI_BASIC_CATALOG_ID}) — no inline catalog.
 * 4. Allowlisted component names ({@link ALLOWED_FORMS_COMPONENTS}) — anything
 *    the basic catalog can't render is rejected.
 * 5. Allowlisted actions — every Button `action` must be an `event` (a server
 *    dispatch name), never a client-side `functionCall`. Every event name is
 *    collapsed by the client to the SAME single capability: "submit this form,
 *    generate the next one." A form can therefore never route to a diagram edit,
 *    a navigation, or any other host behaviour.
 * 6. Size + count caps.
 *
 * The surfaceId on every message is normalized to {@link FORMS_A2UI_SURFACE_ID}
 * so the renderer always knows which surface to read, regardless of what the
 * model named it.
 *
 * A2UI text labels are still untrusted model output — the renderer treats them
 * like any rendered markdown (CSP + sanitization), same trust model as critique.
 */

export { A2UI_BASIC_CATALOG_ID };

/** Wrapper version for the forms document stored in the `forms` slot. */
export const FORMS_A2UI_VERSION = 1;

/** Fixed surface id the renderer reads. Model-chosen ids are normalized to this. */
export const FORMS_A2UI_SURFACE_ID = 'archislop-form';

/**
 * Components the A2UI basic catalog can render. The model may only use these;
 * an unknown `component` value fails validation so the repair loop can fix it.
 */
export const ALLOWED_FORMS_COMPONENTS = new Set([
  'Text',
  'Image',
  'Icon',
  'Row',
  'Column',
  'List',
  'Card',
  'Tabs',
  'Modal',
  'Divider',
  'Button',
  'TextField',
  'CheckBox',
  'ChoicePicker',
  'Slider',
  'DateTimeInput'
]);

/** Interactive controls — a form must contain at least one so it can be filled in. */
export const FORMS_INPUT_COMPONENTS = new Set([
  'TextField',
  'CheckBox',
  'ChoicePicker',
  'Slider',
  'DateTimeInput'
]);

/** Byte cap on the serialized forms document. */
export const FORMS_A2UI_MAX_LENGTH = 60_000;

/** Cap on rendered components across all `updateComponents` messages. */
export const MAX_FORM_COMPONENTS = 200;

/** Cap on the number of A2UI messages in one document. */
export const MAX_FORM_MESSAGES = 60;

export interface FormsA2uiDoc {
  archislopFormsVersion: typeof FORMS_A2UI_VERSION;
  formTitle: string;
  formCode?: string;
  agencyName?: string;
  messages: Array<Record<string, unknown>>;
}

export interface ParseFormsA2uiSuccess {
  ok: true;
  doc: FormsA2uiDoc;
  /** Canonical serialization stored as the slot's diagramSource. */
  text: string;
  meta: {
    componentCount: number;
    buttonCount: number;
    inputCount: number;
  };
}

export interface ParseFormsA2uiFailure {
  ok: false;
  error: string;
}

export type ParseFormsA2uiResult = ParseFormsA2uiSuccess | ParseFormsA2uiFailure;

function stripJsonCodeFence(raw: string): string {
  const trimmed = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function fail(error: string): ParseFormsA2uiFailure {
  return { ok: false, error };
}

/** The three server→client message kinds forms may carry (no DeleteSurface). */
const MESSAGE_KINDS = ['createSurface', 'updateComponents', 'updateDataModel'] as const;

function messageKind(message: Record<string, unknown>): (typeof MESSAGE_KINDS)[number] | null {
  const present = MESSAGE_KINDS.filter((k) => message[k] != null);
  return present.length === 1 ? present[0] : null;
}

/**
 * Parse + validate a model-authored forms A2UI document. Returns the normalized
 * doc (surfaceIds and catalogId forced to the fixed values) and a canonical
 * serialization for the slot. Pure — no A2UI runtime, so it lives in shared and
 * runs the same on server (state-store apply) and web (preview/tests).
 */
export function parseFormsA2ui(source: unknown): ParseFormsA2uiResult {
  if (typeof source !== 'string') {
    return fail('Forms document must be a JSON string.');
  }
  const text = stripJsonCodeFence(source);
  if (!text) return fail('Forms document was empty.');
  if (text.length > FORMS_A2UI_MAX_LENGTH) {
    return fail(
      `Forms document is too large (${text.length} chars, limit ${FORMS_A2UI_MAX_LENGTH}). Make the form shorter.`
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return fail(
      `Forms document is not valid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(
      'Forms document must be a JSON object: {"archislopFormsVersion":1,"formTitle":"…","messages":[…]}.'
    );
  }

  const obj = raw as Record<string, unknown>;
  const version = obj.archislopFormsVersion;
  if (version !== undefined && version !== FORMS_A2UI_VERSION) {
    return fail(`Unsupported archislopFormsVersion — expected ${FORMS_A2UI_VERSION}.`);
  }
  const formTitle = typeof obj.formTitle === 'string' ? obj.formTitle.trim() : '';
  if (!formTitle) {
    return fail('Forms document needs a non-empty "formTitle" string.');
  }
  if (formTitle.length > 200) {
    return fail('"formTitle" must be at most 200 characters.');
  }
  const messages = obj.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return fail('Forms document needs a non-empty "messages" array of A2UI v0.9 messages.');
  }
  if (messages.length > MAX_FORM_MESSAGES) {
    return fail(`Too many messages (${messages.length}, limit ${MAX_FORM_MESSAGES}).`);
  }

  const normalizedMessages: Array<Record<string, unknown>> = [];
  let createSurfaceCount = 0;
  let componentCount = 0;
  let buttonCount = 0;
  let inputCount = 0;
  let hasRoot = false;

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      return fail(`messages[${i}] must be an object.`);
    }
    const msg = { ...(message as Record<string, unknown>) };
    const kind = messageKind(msg);
    if (!kind) {
      return fail(
        `messages[${i}] must have exactly one of createSurface, updateComponents, updateDataModel.`
      );
    }
    msg.version = 'v0.9';

    if (kind === 'createSurface') {
      createSurfaceCount += 1;
      msg.createSurface = {
        ...(msg.createSurface as Record<string, unknown>),
        surfaceId: FORMS_A2UI_SURFACE_ID,
        catalogId: A2UI_BASIC_CATALOG_ID
      };
    } else if (kind === 'updateComponents') {
      const uc = { ...(msg.updateComponents as Record<string, unknown>) };
      uc.surfaceId = FORMS_A2UI_SURFACE_ID;
      const components = uc.components;
      if (!Array.isArray(components) || components.length === 0) {
        return fail(`messages[${i}].updateComponents.components must be a non-empty array.`);
      }
      for (const component of components) {
        if (!component || typeof component !== 'object') {
          return fail(`messages[${i}] has a non-object component.`);
        }
        const c = component as Record<string, unknown>;
        const id = c.id;
        const name = c.component;
        if (typeof id !== 'string' || !id) {
          return fail(`Every component needs a string "id" (messages[${i}]).`);
        }
        if (typeof name !== 'string' || !ALLOWED_FORMS_COMPONENTS.has(name)) {
          return fail(
            `Component "${String(name)}" (id ${id}) is not in the allowed basic catalog. Allowed: ${[
              ...ALLOWED_FORMS_COMPONENTS
            ].join(', ')}.`
          );
        }
        if (id === 'root') hasRoot = true;
        componentCount += 1;
        if (FORMS_INPUT_COMPONENTS.has(name)) inputCount += 1;
        if (name === 'Button') {
          // A2UI disables a Button whose own checks fail. Every forms Button is the
          // "submit → next form" escape hatch, so a failing check would soft-lock the
          // gauntlet. Keep validation on inputs (where it renders as an inline message
          // and never blocks submission); forbid it on Buttons.
          if (Array.isArray(c.checks) && c.checks.length > 0) {
            return fail(
              `Button "${id}" must not carry "checks" — a failing check disables the button and traps the user. Put validation on the input fields instead.`
            );
          }
          const actionError = validateButtonAction(c.action, id);
          if (actionError) return fail(actionError);
          buttonCount += 1;
        }
      }
      msg.updateComponents = uc;
    } else {
      msg.updateDataModel = {
        ...(msg.updateDataModel as Record<string, unknown>),
        surfaceId: FORMS_A2UI_SURFACE_ID
      };
    }

    normalizedMessages.push(msg);
  }

  if (createSurfaceCount !== 1) {
    return fail(
      `Forms document needs exactly one createSurface message (found ${createSurfaceCount}).`
    );
  }
  if (!hasRoot) {
    return fail('One component must have id "root" as the tree root.');
  }
  if (componentCount > MAX_FORM_COMPONENTS) {
    return fail(`Too many components (${componentCount}, limit ${MAX_FORM_COMPONENTS}).`);
  }
  if (buttonCount === 0) {
    return fail(
      'A form must have at least one Button so the user can submit it and advance to the next form.'
    );
  }
  if (inputCount === 0) {
    return fail(
      'A form must have at least one input control (TextField, CheckBox, ChoicePicker, Slider, or DateTimeInput).'
    );
  }

  const doc: FormsA2uiDoc = {
    archislopFormsVersion: FORMS_A2UI_VERSION,
    formTitle,
    messages: normalizedMessages
  };
  if (typeof obj.formCode === 'string' && obj.formCode.trim()) {
    doc.formCode = obj.formCode.trim().slice(0, 60);
  }
  if (typeof obj.agencyName === 'string' && obj.agencyName.trim()) {
    doc.agencyName = obj.agencyName.trim().slice(0, 120);
  }

  const pretty = `${JSON.stringify(doc, null, 2)}\n`;
  // Prefer readable A2UI in the slot/editor; fall back to compact only if pretty
  // would exceed the byte cap (round-trip safety).
  const serialized = pretty.length <= FORMS_A2UI_MAX_LENGTH ? pretty : JSON.stringify(doc);

  return {
    ok: true,
    doc,
    text: serialized,
    meta: { componentCount, buttonCount, inputCount }
  };
}

function validateButtonAction(action: unknown, id: string): string | null {
  if (!action || typeof action !== 'object') {
    return `Button "${id}" needs an action: { "event": { "name": "…" } }.`;
  }
  const a = action as Record<string, unknown>;
  if (a.functionCall != null) {
    return `Button "${id}" uses a client-side functionCall, which forms mode does not allow. Use { "event": { "name": "…" } } instead.`;
  }
  const event = a.event;
  if (!event || typeof event !== 'object') {
    return `Button "${id}" needs an action: { "event": { "name": "…" } }.`;
  }
  const name = (event as Record<string, unknown>).name;
  if (typeof name !== 'string' || !name.trim()) {
    return `Button "${id}" action.event.name must be a non-empty string.`;
  }
  return null;
}

/**
 * Canonical intro form document — the reference shape every generated form should
 * resemble, used by tests and offline fixtures. The live UI no longer auto-renders
 * this on an empty slot (users start from the same empty canvas as other modes),
 * but it demonstrates the three things a good archislop form does beyond "valid
 * A2UI": it (1) reads as a real form (masthead, sections, labelled inputs, submit
 * row), (2) visualizes its subject (emoji stamps + a hero stat tile — emoji, not
 * the basic catalog's named `Icon`s, which need a Material font the app does not
 * load and would render as raw text), and (3) makes its fields talk to each other —
 * a live `formatString` echo of `/applicantName` and a self-cancelling `checks`
 * rule that cross-references `/consent`. Both cross-refs are safe: the echo is
 * display-only, and the check renders as an inline message on an input (never on
 * the submit Button), so it can never block the gauntlet.
 */
export function buildFormsSeedDoc(): string {
  const doc: FormsA2uiDoc = {
    archislopFormsVersion: FORMS_A2UI_VERSION,
    formTitle: 'Form 0-A/pre — Pre-Intake Eligibility Self-Assessment (Provisional)',
    formCode: 'INTK-0000-PRE',
    agencyName: 'Office of Forms, Sub-Forms & Ancillary Documentation',
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: FORMS_A2UI_SURFACE_ID, catalogId: A2UI_BASIC_CATALOG_ID }
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: FORMS_A2UI_SURFACE_ID,
          components: [
            {
              id: 'root',
              component: 'Column',
              children: [
                'masthead',
                'hero_card',
                'blurb',
                'div0',
                'sec1_hdr',
                'q_name',
                'echo_name',
                'q_reason',
                'q_urgency',
                'urgency_note',
                'div1',
                'sec2_hdr',
                'q_consent',
                'q_ack',
                'div2',
                'submit_row'
              ]
            },
            {
              id: 'masthead',
              component: 'Row',
              justify: 'start',
              align: 'center',
              children: ['mast_icon', 'mast_col']
            },
            { id: 'mast_icon', component: 'Text', text: '🗂️', variant: 'h2' },
            {
              id: 'mast_col',
              component: 'Column',
              children: ['agency_txt', 'title_txt', 'code_txt']
            },
            {
              id: 'agency_txt',
              component: 'Text',
              text: 'Office of Forms, Sub-Forms & Ancillary Documentation',
              variant: 'caption'
            },
            {
              id: 'title_txt',
              component: 'Text',
              text: 'Form 0-A/pre — Pre-Intake Eligibility Self-Assessment',
              variant: 'h3'
            },
            {
              id: 'code_txt',
              component: 'Text',
              text: 'Form code INTK-0000-PRE · rev. 3 · supersedes nothing',
              variant: 'caption'
            },
            { id: 'hero_card', component: 'Card', child: 'hero_col' },
            {
              id: 'hero_col',
              component: 'Column',
              align: 'center',
              children: ['hero_num', 'hero_cap']
            },
            { id: 'hero_num', component: 'Text', text: '0042', variant: 'h1' },
            {
              id: 'hero_cap',
              component: 'Text',
              text: 'forms ahead of you in the queue (approximate; steadily increasing)',
              variant: 'caption'
            },
            {
              id: 'blurb',
              component: 'Text',
              text: 'Before you may request a form, please complete this form requesting permission to request a form. Fields marked (required) are required; fields not so marked are also required.',
              variant: 'body'
            },
            { id: 'div0', component: 'Divider' },
            {
              id: 'sec1_hdr',
              component: 'Text',
              text: '🪪 Section 1 — Identity (provisional)',
              variant: 'h5'
            },
            {
              id: 'q_name',
              component: 'TextField',
              label: 'Full legal name, as it appears on a document you do not yet have (required)',
              value: { path: '/applicantName' }
            },
            {
              id: 'echo_name',
              component: 'Text',
              variant: 'caption',
              text: {
                call: 'formatString',
                args: {
                  value:
                    'Noted. We will address you as “${/applicantName}” in all future correspondence, none of which will be sent.'
                },
                returnType: 'string'
              }
            },
            {
              id: 'q_reason',
              component: 'ChoicePicker',
              label: 'Primary reason for seeking pre-eligibility (select exactly one; none apply)',
              variant: 'mutuallyExclusive',
              options: [
                { label: 'I was told to by another form', value: 'referred' },
                { label: 'I am pre-emptively complying', value: 'compliance' },
                {
                  label: 'Other (please specify on Form 0-B, which does not exist)',
                  value: 'other'
                }
              ],
              value: { path: '/reason' }
            },
            {
              id: 'q_urgency',
              component: 'Slider',
              label: 'Perceived urgency (non-binding; will be ignored)',
              min: 0,
              max: 5,
              value: { path: '/urgency' }
            },
            {
              id: 'urgency_note',
              component: 'Text',
              variant: 'caption',
              text: {
                call: 'formatString',
                args: {
                  value:
                    'Urgency logged at ${/urgency} of 5. This value has been recorded and disregarded.'
                },
                returnType: 'string'
              }
            },
            { id: 'div1', component: 'Divider' },
            {
              id: 'sec2_hdr',
              component: 'Text',
              text: '✒️ Section 2 — Attestations',
              variant: 'h5'
            },
            {
              id: 'q_consent',
              component: 'CheckBox',
              label:
                'I acknowledge that acknowledging this does not constitute acknowledgement (required)',
              value: { path: '/consent' }
            },
            {
              id: 'q_ack',
              component: 'CheckBox',
              label: 'I have NOT read the guidelines (mandatory)',
              value: { path: '/guidelinesUnread' },
              checks: [
                {
                  condition: {
                    call: 'not',
                    args: { value: { path: '/consent' } },
                    returnType: 'boolean'
                  },
                  message:
                    'This attestation is only valid while the box above remains unchecked. Please reconcile with the box above, then this box, then the box above.'
                }
              ]
            },
            { id: 'div2', component: 'Divider' },
            {
              id: 'submit_row',
              component: 'Row',
              justify: 'spaceBetween',
              align: 'center',
              children: ['submit_note', 'submit_btn']
            },
            {
              id: 'submit_note',
              component: 'Text',
              text: 'Processing time: 4–6 forms.',
              variant: 'caption'
            },
            {
              id: 'submit_btn_txt',
              component: 'Text',
              text: 'Submit & Proceed to Intake',
              variant: 'body'
            },
            {
              id: 'submit_btn',
              component: 'Button',
              variant: 'primary',
              child: 'submit_btn_txt',
              action: { event: { name: 'archislop_submitForm', context: {} } }
            }
          ]
        }
      },
      {
        version: 'v0.9',
        updateDataModel: {
          surfaceId: FORMS_A2UI_SURFACE_ID,
          path: '/',
          value: {
            applicantName: '',
            reason: '',
            urgency: 0,
            consent: false,
            guidelinesUnread: false
          }
        }
      }
    ]
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}
