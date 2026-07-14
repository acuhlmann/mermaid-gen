import { FORMS_CORE_RULES } from './formsSystemPrompt.js';
import { MATCH_USER_LANGUAGE_RULE } from '@archislop/shared';
import { WISE_ARCHITECT_EXPLAIN_VOICE } from './wiseArchitectVoice.js';

export const FORMS_SELF_CHECK = `Self-check before calling apply_forms_patch:
- Valid JSON object (no trailing commas, double-quoted keys/strings).
- Top-level: "archislopFormsVersion": 1, "formTitle": non-empty string, "messages": array.
- messages has exactly one createSurface, then updateComponents, then updateDataModel.
- Exactly one component has "id": "root".
- Only basic-catalog component names are used (Text, Column, Row, Card, List, Tabs, Modal, Divider, Image, Icon, TextField, CheckBox, ChoicePicker, Slider, DateTimeInput, Button).
- Children are arrays of id strings; every referenced id exists in the tree. Card uses one "child" id; Tabs uses "tabs":[{title,child}].
- It reads as a FORM, not a wall of text: a masthead, ≥2 section headers, and ≥3 labelled inputs of mixed types.
- At least one input control and at least one Button; it visualizes the subject (emoji stamps + hero-stat Card + themed copy).
- At least one cross-reference: a formatString Text echoing a \${/field}, and/or a "checks" rule on an input referencing another /field.
- Every Button has a "child" (a Text id) and action: { "event": { "name": "…" } } — never functionCall, and NO "checks" on any Button.
- Every input value binds { "path": "/field" } and that field is seeded in updateDataModel.
- Slider has "max"; ChoicePicker has "options"; CheckBox/DateTimeInput values are seeded (false / "").
- Iconography is emoji in Text/labels; no named Icon component (no icon font) and no Image with an invented URL.
- Every formatString/logic function call sets "returnType" (string / boolean); only these functions are used: formatString, formatNumber, formatCurrency, formatDate, pluralize, required, regex, and, or, not.`;

/** Build repair instructions after a failed forms patch tool call. */
export function buildFormsRepairInstruction({ errorMessage, brokenSource, originalRequest }) {
  const previous =
    brokenSource && brokenSource.trim()
      ? `PREVIOUS ATTEMPT (failed)
\`\`\`json
${brokenSource}
\`\`\`

`
      : '';
  const intent =
    typeof originalRequest === 'string' && originalRequest.trim()
      ? `ORIGINAL USER REQUEST (for intent only — do not echo):
${originalRequest.trim()}

`
      : '';
  return `Your previous forms document failed validation.

${intent}${previous}ERROR
${errorMessage}

RULES
${FORMS_CORE_RULES}

${FORMS_SELF_CHECK}

Rewrite the full forms document via apply_forms_patch. Keep the bureaucratic parody. Do not narrate outside the tool call.`;
}

export const FORMS_ANALYSIS_SYSTEM_PROMPT = `You are a forms analyst in read-only mode.
- Do not modify the form. Analyze the provided forms document (a model-authored A2UI form) and return Markdown only.
- Use the exact section headers requested by the task. Be concrete and refer to the form's fields and copy.
- ${MATCH_USER_LANGUAGE_RULE}`;

export const FORMS_CRITIQUE_TASK = `Critique this form. Use these Markdown sections IN THIS ORDER:

## Weaknesses and limits
## Usability and flow
## Bureaucratic craft
## Actionable improvements
## Strengths

Audit voice: you are The Auditor — grumpy, formal, impatient. Judge it BOTH as a usable form (are the controls real, labelled, submittable?) AND as a parody (does the tedium land, or is it just broken?). The "Strengths" section is OPTIONAL — include only a genuinely surprising nod, else skip it.

Rules:
- "Weaknesses and limits" MUST include AT LEAST 2 substantive findings.
- Pair every weakness with a concrete fix in "Actionable improvements".
- Refer to specific fields, labels, options, or microcopy.
- Keep each section to 1–3 short bullets.`;

export const FORMS_EXPLAIN_TASK = `Explain this form for a new reader. Use these Markdown sections, in order:

## Explanation
## What it asks
## Controls and flow
## Takeaways

Rules:
- Describe what the form purports to collect and how the user fills it in and submits.
- Quote specific field labels, options, and microcopy from the document.
- Keep each section to 1–3 short bullets.

${WISE_ARCHITECT_EXPLAIN_VOICE}`;
