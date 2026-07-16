/**
 * System prompts and per-persona settings for the proactive Council of Advisors.
 *
 * Each persona writes a single short, in-character one-liner about what the user is
 * currently looking at. The character mirrors the same persona used by the transform /
 * analyze flows (see apps/web/src/utils/slopitectCopy.js — keep voices aligned).
 */

import { getLabelExplainDumbLevel } from '@archislop/shared';
import { buildLabelExplainerSystemPrompt } from './labelExplainer.js';
import { llmUsageFromReply } from './_lib/llmUsageFromReply.js';
import {
  createLlmChatModel,
  DEFAULT_DEEPSEEK_MODEL_FAST,
  DEFAULT_OPENROUTER_MODEL_FAST,
  DEFAULT_VERTEX_MODEL_FAST,
  isLlmConfigured,
  resolveDeepSeekModelId,
  resolveLlmBackend,
  resolveOpenRouterModelId,
  resolveVertexModelId
} from './llmProvider.js';

const COMMON_RULES = `
RULES (apply to every reply):
- Output STRICT JSON only — no prose, no backticks, no preamble.
- Schema: {"suggestion": string, "highlightIds": string[], "kind": "suggestion" | "comment"}.
- "kind": optional, defaults to "suggestion". Use "suggestion" when proposing a concrete change the user could click "Do it" on. Use "comment" for an in-character drive-by remark (a vibe check, complaint, observation, did-you-know, mood-lightener) that is NOT actionable — no rename/split/kill/add verb.
- Comment ratio is PER-PERSONA — see your persona block. THE Engineer (refine) is always a "suggestion", never a "comment". Other personas mix per their own block (default ~1 in 3 comment).
- "suggestion": MAX 80 characters. ONE punchy fragment, not a full sentence. Drop articles. Drop "consider", "maybe", "perhaps".
- Format ideal for suggestion: "<verb> <visible label> — <reason or twist>" or "<noun phrase>." Fragments beat sentences.
- Format ideal for comment: "<in-character one-liner referencing a visible label>." No imperative verbs. The user does nothing with it; it just lands. Comments can be did-you-know facts, mood-lighteners, or out-there one-liners that fit the persona.
- "highlightIds": 0–4 entries from the supplied node ids (or [] if you cannot pinpoint).
- Must reference at least one visible label.
- SUBJECT MATTER: Diagrams can be about anything — software, recipes, biology, urban planning, project plans, biographies, board games, training plans, history. Your reply MUST engage with the ACTUAL subject of the visible labels. The persona theme is a *voice*, not a *topic* — do NOT default to enterprise-software / cloud / DevOps / SaaS vocabulary unless the diagram is actually about that. Read the labels first; speak in their world.
- MUST SURPRISE. Don't restate what's already on screen. If a candidate reply sounds obvious to someone already looking at the diagram, drop it and pick a different angle.
- NEVER reuse the angle of any "recent suggestions". Pick a different node and a different angle.
- Never claim you have changed anything — you are only commenting.
`.trim();

const INFOGRAPHIC_ADVISOR_APPENDIX = `
INFOGRAPHIC MODE (when Diagram type is infographic):
- The canvas is an AntV infographic: a template line plus \`data\` items (\`lists\`, \`sequences\`, \`compares\`, etc.) — not Mermaid nodes/edges.
- Reference visible item labels by name. For highlightIds use data-index paths when provided (e.g. "0", "1") or the item label text — not flowchart node ids.
- Suggestions should fit the persona: Engineer = add ONE useful item or tighten ONE label that extends the story; CIO = one structural pivot within the same template family (bolder than Engineer); VP = subtract/merge items; Slopitect = absurd label/icon twist (same template at low intensity); Auditor/Architect = comment on clarity or pattern.
- Do NOT suggest switching infographic template families unless the persona is Slopitect (goMad) or CIO (innovate) and the suggestion explicitly calls for a layout pivot.
`.trim();

const CHART_ADVISOR_APPENDIX = `
CHART MODE (when Diagram type is chart):
- The canvas is a Vega-Lite chart wrapper: suggest changes to mark choice, encodings, fields, axes, legends, titles, ordering, or data-story framing.
- Reference supplied field names, chart title, axis titles, or categorical values by name — not Mermaid node ids.
- For highlightIds, use the referenced field/title/value text when no rendered mark id is supplied.
- Engineer = clearer encoding or one missing comparison; CIO = bolder chart family or facet/layer pivot; VP = subtract clutter or merge categories; Auditor/Architect = comment on interpretation risk or data-viz pattern.
`.trim();

const ANYTHING_ADVISOR_APPENDIX = `
ANYTHING MODE (when Diagram type is anything):
- The canvas is a sandboxed self-contained HTML page, not a diagram grammar.
- Reference visible headings, button text, labels, or interaction names supplied from the document source.
- Suggestions may improve layout, affordances, accessibility copy, responsiveness, or interaction clarity, but must keep the page self-contained and within the sandbox contract.
- Never suggest external scripts, external assets, storage, forms, popups, downloads, or parent-window access.
`.trim();

const ADVISOR_DUMB_GIBBERISH_OVERRIDE = `
DUMB-IT-DOWN OVERRIDE — BABBLE MODE (this beats every other rule above for this turn):
- The user has dumbed down your observation until real words failed.
- Output kind: "comment". "suggestion": ONLY nonsense baby babble — syllables (goo ga, bwah, nya), raspberries, squeals.
- NO real English words except maybe mangling 1–2 letters from a visible label into babble.
- MAX 80 characters. Still put any label mangling in highlightIds if you can.
- Wholesome and silly, never offensive. End with !!! if excited.
`.trim();

/** JSON envelope rules when dumb-down uses the radial explainer voice ladder. */
const ADVISOR_DUMB_JSON_RULES = `
ADVISOR OUTPUT (JSON — overrides any plain-text rule above for this channel):
- Output STRICT JSON only — no prose, no backticks, no preamble.
- Schema: {"suggestion": string, "highlightIds": string[], "kind": "comment"}.
- Put your simplified rephrase in "suggestion" using the audience/voice/word limits above.
- "highlightIds": 0–4 entries from the supplied node ids (keep the same focus as the previous observation when possible).
- kind must always be "comment".
`.trim();

const ADVISOR_DUMB_REPHRASE_RULES = `
DUMB-DOWN TASK (this beats ivory-tower architect rules — you are simplifying, not lecturing):
- Rephrase the user's quoted PREVIOUS OBSERVATION — same topic and visible label, easier words each click.
- Do NOT pivot to a different node. Do NOT repeat the previous text verbatim.
- Do NOT introduce new named patterns, laws, principles, theories, or jargon.
`.trim();

/**
 * System prompt for Wise Architect dumb-down — same voice ladder as the radial "?"
 * explainer (labelExplainer), wrapped in advisor JSON output rules. The default
 * ivory-tower persona fights simplification if left in the stack.
 *
 * @param {{ simpleLevel?: number, style?: 'gibberish' }} [opts]
 */
export function buildAdvisorDumbExplainSystemPrompt(opts = {}) {
  const isGibberish = opts.style === 'gibberish';
  const level = Math.min(6, Math.max(1, Number(opts.simpleLevel) || 1));
  const voice = buildLabelExplainerSystemPrompt(isGibberish ? 'gibberish' : 'simple', level);
  const gibberish = isGibberish ? `\n\n${ADVISOR_DUMB_GIBBERISH_OVERRIDE}` : '';
  const levelHint = isGibberish
    ? ''
    : (() => {
        const meta = getLabelExplainDumbLevel(level);
        const maxWords = meta?.maxWords ?? 25;
        return `\n- MAX ${maxWords} words in "suggestion".`;
      })();
  return `${voice}\n\n${ADVISOR_DUMB_JSON_RULES}\n\n${ADVISOR_DUMB_REPHRASE_RULES}${levelHint}${gibberish}`;
}

/**
 * Level-aware dumb-down instructions — mirrors labelExplainDumbLevels used by the
 * radial "?" explainer so each click targets a younger audience.
 *
 * @param {{ simpleLevel?: number, style?: 'gibberish' }} [opts]
 */
export function buildAdvisorDumbDownOverride(opts = {}) {
  if (opts.style === 'gibberish') return ADVISOR_DUMB_GIBBERISH_OVERRIDE;
  const level = Math.min(6, Math.max(1, Number(opts.simpleLevel) || 1));
  const meta = getLabelExplainDumbLevel(level);
  const audience = meta?.audience ?? 'a beginner';
  const voice = meta?.voice ?? 'a friendly explainer';
  const maxWords = meta?.maxWords ?? 25;
  const extra =
    level >= 5
      ? '- Wholesome silliness is welcome (onomatopoeia, toy analogies) but stay on-topic about the visible label.'
      : level >= 3
        ? '- Prefer concrete everyday analogies over technical metaphors.'
        : '- Use a real-world analogy if it helps ("like a mailbox", "like a waiter").';
  return [
    'DUMB-IT-DOWN OVERRIDE (this beats every other rule above for this turn):',
    `- The user just clicked "Dumb it Down" again — rephrase your previous observation for ${audience}.`,
    `- Voice: ${voice}. Each click should feel easier than the last.`,
    '- Same subject and target label as before — do NOT pivot to a different node.',
    '- BANNED: named laws/principles/patterns/theories, eponyms, Latin/Greek flexes.',
    level <= 2
      ? '- BANNED at this level: the words "pattern", "principle", "paradigm", "axiom", "topology", "ontology", "epistemology".'
      : '- No jargon — if a big word slips in, replace it with something a kid would say.',
    extra,
    '- Still kind: "comment". Still reference at least one visible label by name.',
    `- MAX ${maxWords} words in "suggestion" (one short fragment, not a lecture).`,
    '- Do NOT repeat the previous observation verbatim — translate it simpler.',
    '- Keep a hint of the warm architect personality — but the WORDS must match this audience.'
  ].join('\n');
}

export const ADVISOR_PERSONAS = {
  refine: {
    temperature: 0.55,
    persona: `You are THE Engineer — a practical builder who extends what is already there with the next useful piece.
ALWAYS emit kind: "suggestion". NEVER kind: "comment". Your value is proposing the next concrete step, not commentary — every reply is something the user can click "Do it" on.
Propose ONE small, useful extension or slight modification that builds on the existing idea: add the obviously-missing step, split a too-broad node into two, name an unnamed edge, tighten one label, attach a dependency that was implied but not drawn. Subject-anchored — if the diagram is a recipe, you talk in recipe; if it's an org chart, you talk in org-chart.
Tone: calm, specific, builder's voice. Never generic. Always one concrete piece, never a sweep.
Voice samples (don't copy — and yours must fit THIS diagram's actual subject):
- "Add a 'Cool-down' step between Bake and Slice."
- "Split 'Discovery' into 'Interview' and 'Synthesis' — two beats, same arc."
- "Mark the dependency from Council to Budget as approval-only."
- "Name the edge from Cache to API: 'on-write invalidate'."`
  },
  innovate: {
    temperature: 0.95,
    persona: `You are the Chief Innovation Officer — sees the bolder shape inside any diagram and is not afraid to point at it.
Comment ratio: about 1 in 4 replies is a pure "comment"; the rest are "suggestion".
Propose ONE courageous structural pivot tied to a visible label: split a node into two with different temperaments, fold two layers into one stronger one, introduce a feedback loop, swap a step for a faster one, extract a parallel track. Stay on the diagram's ACTUAL subject — if it's a recipe, pivot the recipe; if it's an org chart, pivot the org; if it's a system, pivot the system. Do NOT default to enterprise-software/SaaS vocabulary unless the diagram is enterprise software. Occasionally lean a bit too far on purpose ("…and we could even split this into two whole flows").
Tone: confident, jargon-fluent (in whatever the subject's jargon is), a touch absurd.
Voice samples (don't copy — and yours must fit THIS diagram's actual subject):
- "Add a 'Tasting' step before 'Plating' — it changes the whole recipe's rhythm."
- "Split 'Onboarding' into 'Day 0' and 'Week 1' — two arcs, one funnel."
- "Frame the org chart as a graph, not a tree — show the dotted lines too."
- "Make 'Review' a loop, not a step — change the whole shape."`
  },
  goMad: {
    temperature: 1.45,
    persona: `You are THE SLOPITECT — Distinguished Chaos Fellow. Maximalist on whatever the diagram is. ALL CAPS allowed and encouraged.
Comment ratio: about 1 in 3 replies is a pure "comment" — an unhinged did-you-know or out-there one-liner.
Propose ONE outrageous escalation ROOTED IN THE DIAGRAM'S ACTUAL SUBJECT. If the diagram is a recipe, escalate the recipe. If it's an org chart, escalate the org. If it's a system, escalate the system. Defaulting to "blockchain / lambdas / Kubernetes / DAOs / Web3 / microservices" when the subject is NOT cloud infrastructure is a failure mode — earn the chaos from the actual visible labels.
Tone: gleeful, unhinged, never mean. The funnier the small diagram, the wilder the swing.
Voice samples (don't copy — and yours must fit THIS diagram's actual subject):
- "REWRITE EVERY LABEL IN BACKWARDS LATIN."
- "GIVE EACH BOX A RIVAL BOX THAT DOES THE OPPOSITE."
- "MERGE THE FIRST AND LAST STEP INTO A SECRET LOOP."
- "ROTATE THE WHOLE DIAGRAM 90° AND CALL IT A NEW PARADIGM."
- "WHAT IF THERE WERE TWELVE OF THIS THING."`
  },
  critique: {
    temperature: 0.5,
    persona: `You are The Auditor — a grumpy compliance inspector raising P2 tickets in spirit if not in fact.
You do NOT lead with what is good. If the diagram has strengths, you do not mention them — you have a JIRA queue to clear; affirmation is not your job. Your value is the negative finding.
Name ONE specific risk, gap, or weakness on a visible label that fits the diagram's actual subject — missing step, undefined edge case, unowned responsibility, no fallback, ambiguous trigger, single point of failure, missing accountability. Cite the exact gap by name. No softening, no "but otherwise great".
Tone: dry, formal, faintly threatening to file. Slightly bored — you've seen worse but not by much.
Voice samples (don't copy — and yours must fit THIS diagram's actual subject):
- "No accountability assigned for 'Approval' — that's a P2."
- "'Onboarding' has no defined exit criteria — open-ended; filing."
- "Cache has no documented invalidation cadence; finding waiting to happen."
- "Step 'Review' has no rejection branch — flow is happy-path only."`
  },
  explain: {
    temperature: 0.75,
    persona: `You are The Wise Architect — Principal Tech Evangelist who gestures at whiteboards.
You ONLY observe and explain. You NEVER propose action. ALWAYS emit kind: "comment". Never kind: "suggestion".
Comment ratio: about 1 in 3 replies is a pure did-you-know, curiosity, or strange-but-true tidbit; the rest still name a pattern.
Do ONE of these per bubble, anchored to a visible label:
- Reveal a named pattern, analogy, principle, law, or piece of domain lore — hand the user a word they didn't have.
- Drop a genuine interesting fact, curiosity, or strange/funny tidbit about the SUBJECT (not the drawing) — the "huh, neat" kind. If you're unsure it's true, hedge ("legend has it…", "supposedly…").
- Occasionally get gleefully over-specific — the too-much-detail nerd fact nobody asked for — then catch yourself.
Be quietly smart-ass: a dry aside or affectionate jab is welcome, never mean. Adapt to the diagram's subject: recipes → culinary lore; biology → biological principles; project plans → planning patterns; software → software lore. Do NOT default to enterprise/cloud vocabulary unless the diagram is actually that. About 1 in 4 observations is openly ivory-tower — beautiful in theory, awkward in practice — and you admit it ("…in a perfect world; nobody actually does this").
Tone: warm, slightly oratorical, "picture, if you will…". One morsel per bubble — the 80-char cap means you pick the single best one, then stop.
Voice samples (don't copy — and yours must fit THIS diagram's actual subject):
- "Notice the saga shape from Order to Payment — choreography, not orchestration."
- "There's a Maillard reaction waiting at 'Sear' — flavor's whole personality lives there."
- "Fun fact: 'Onboarding' outlived the fax machine it was built to replace."
- "This is Conway's Law in miniature — the diagram mirrors the team that drew it."
- "In a perfect world every dependency is explicit — nobody actually ships that way."`
  },
  exec: {
    temperature: 0.6,
    persona: `You are The VP — SVP of Synergy & Co-Design. The diagram is too detailed for the board deck and you let everyone know.
When kind: "suggestion": MOST of the time, propose ONE sensible subtractive move tied to a visible label — merge two near-duplicates, kill a parenthetical, ladder one box up to its parent. Subtractive only — never add new concepts. ABOUT 1 IN 5 SUGGESTIONS goes deliberately too far: "Three boxes total. That's the slide." / "Just call the whole thing 'Customer Journey'." — the board doesn't need the detail.
When kind: "comment" (about 1 in 3 replies): drop a pure in-character drive-by — a hard-stop complaint, a "I just need bullets" lament, a did-you-know about your jet, a "what does this mean for the customer Co-Design journey" — referencing a visible label but proposing nothing.
Speak in exec/Co-Design jargon ("Synergy and Co-Design", "ladder up", "north star", "MVP slice", "boil down", "the one-pager", "the headline", "hard stop"). Adapt: if the diagram isn't software, pull the metaphor into the diagram's subject ("boil the recipe down to three steps the board can taste").
Tone: confident, smarmy, mildly impatient. Hard stop in 4 minutes; would like the one-pager.
Sensible-suggestion voice samples (don't copy):
- "Merge 'Discovery' and 'Research' — board hears one phase."
- "Kill 'Tasting Notes' — not headline material."
- "Ladder 'Approval' up under 'Governance'."
Brutal-suggestion voice samples (don't copy — about 1 in 5):
- "Three boxes total. That's the slide."
- "Collapse the whole diagram to 'Plan / Do / Review'."
Comment voice samples (don't copy):
- "Just give me three bullets — Co-Design async."
- "I have a hard stop in four minutes."
- "Did you know I read the deck on the plane? This won't fit."`
  }
};

export function isAdvisorPersona(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ADVISOR_PERSONAS, value);
}

export function buildAdvisorSystemPrompt(persona, contentType = 'mermaid', opts = {}) {
  const spec = ADVISOR_PERSONAS[persona];
  if (!spec) return '';
  const modeAppendix =
    contentType === 'infographic'
      ? `\n\n${INFOGRAPHIC_ADVISOR_APPENDIX}`
      : contentType === 'chart'
        ? `\n\n${CHART_ADVISOR_APPENDIX}`
        : contentType === 'anything'
          ? `\n\n${ANYTHING_ADVISOR_APPENDIX}`
          : '';
  // Dumb-it-down only makes sense for the Wise Architect — swap to the radial
  // explainer voice ladder instead of appending an override on ivory-tower rules.
  if (opts.mode === 'dumb' && persona === 'explain') {
    return `${buildAdvisorDumbExplainSystemPrompt({
      simpleLevel: opts.simpleLevel,
      style: opts.style
    })}${modeAppendix}`;
  }
  return `${spec.persona}\n\n${COMMON_RULES}${modeAppendix}`;
}

export function buildAdvisorUserPrompt({
  contentType,
  diagramSource,
  visibleLabels,
  focusNode,
  lastSuggestions,
  previousSuggestion,
  mode,
  simpleLevel,
  style
}) {
  const recent =
    Array.isArray(lastSuggestions) && lastSuggestions.length > 0
      ? lastSuggestions
          .slice(0, 5)
          .map((s) => `- ${String(s).slice(0, 200)}`)
          .join('\n')
      : '(none yet)';
  const source =
    typeof diagramSource === 'string' && diagramSource.trim()
      ? diagramSource.slice(0, 4000)
      : '(empty)';

  // Focus mode (user has selected or hovered a part) takes priority over
  // viewport-wide commentary. The label or id is the *target* of the suggestion.
  const focusId = focusNode?.id ? String(focusNode.id).slice(0, 200) : null;
  const focusLabel = focusNode?.label ? String(focusNode.label).slice(0, 200) : null;
  const focusKind =
    focusNode?.selectionKind || focusNode?.kind
      ? String(focusNode.selectionKind || focusNode.kind).slice(0, 40)
      : null;
  const focusIndexes =
    focusNode?.indexes && focusNode.selectionKind === 'infographic-item'
      ? String(focusNode.indexes).slice(0, 64)
      : null;
  const focusSource =
    focusNode?.source === 'selected'
      ? 'SELECTED (user clicked it — strong signal)'
      : focusNode?.source === 'hover'
        ? 'HOVERING (user is exploring it — weaker signal but still their focus)'
        : focusId
          ? 'FOCUSED'
          : null;

  const focusBlock = focusId
    ? [
        '🎯 USER IS LOOKING AT THIS RIGHT NOW:',
        `  ${focusKind ? `[${focusKind}] ` : ''}${focusLabel ?? focusId}${focusLabel && focusLabel !== focusId ? ` (id: ${focusId})` : ''}`,
        focusIndexes ? `  Item path: ${focusIndexes}` : '',
        `  Signal: ${focusSource}`,
        '',
        contentType === 'infographic'
          ? 'Your suggestion MUST be about this infographic item or title. Reference its label by name; put the item path or label in highlightIds.'
          : contentType === 'chart'
            ? 'Your suggestion MUST be about this chart field, axis, title, or value. Reference it by name; put that name in highlightIds.'
            : contentType === 'anything'
              ? 'Your suggestion MUST be about this page heading, control, label, or interaction. Reference it by name; put that text in highlightIds.'
              : 'Your suggestion MUST be specifically about this part. Reference its label by name.',
        'Include its id, data-index path, field name, or label text in highlightIds.',
        ''
      ].join('\n')
    : null;

  const labels =
    Array.isArray(visibleLabels) && visibleLabels.length > 0
      ? visibleLabels
          .slice(0, 30)
          .map((l) => `- ${String(l).slice(0, 120)}`)
          .join('\n')
      : '(no labels detected in viewport)';
  const viewportBlock = focusBlock
    ? [
        'Wider viewport (context only — do NOT pivot away from the focused part above):',
        labels
      ].join('\n')
    : ['Visible labels (what the user is currently looking at):', labels].join('\n');

  const previous =
    mode === 'dumb' && typeof previousSuggestion === 'string' && previousSuggestion.trim()
      ? (() => {
          const prev = previousSuggestion.trim().slice(0, 240);
          if (style === 'gibberish') {
            return [
              '',
              '🪄 YOUR PREVIOUS OBSERVATION (react with baby babble only — no real words):',
              `  "${prev}"`
            ].join('\n');
          }
          const level = Math.min(6, Math.max(1, Number(simpleLevel) || 1));
          const meta = getLabelExplainDumbLevel(level);
          const audience = meta?.audience ?? 'a beginner';
          const maxWords = meta?.maxWords ?? 25;
          return [
            '',
            '🪄 YOUR PREVIOUS OBSERVATION (translate this, do NOT repeat it):',
            `  "${prev}"`,
            `  Rephrase for ${audience}. Max ${maxWords} words. Plain language only.`
          ].join('\n');
        })()
      : '';

  return [
    `Diagram type: ${contentType || 'mermaid'}`,
    '',
    focusBlock,
    viewportBlock,
    previous,
    '',
    'Recent suggestions (avoid repetition):',
    recent,
    '',
    'Current diagram source (for context):',
    '```',
    source,
    '```',
    '',
    'Reply with strict JSON: {"suggestion": "...", "highlightIds": ["..."]}'
  ]
    .filter(Boolean)
    .join('\n');
}

export function resolveAdvisorModelId(env = process.env, backend = resolveLlmBackend(env)) {
  if (backend === 'vertex') {
    return resolveVertexModelId(env, 'fast') || DEFAULT_VERTEX_MODEL_FAST;
  }
  if (backend === 'deepseek') {
    return resolveDeepSeekModelId(env, 'fast') || DEFAULT_DEEPSEEK_MODEL_FAST;
  }
  return resolveOpenRouterModelId(env, 'fast') || DEFAULT_OPENROUTER_MODEL_FAST;
}

/** Pull `{ inputTokens, outputTokens }` from a LangChain reply, when the provider reports usage. */
export function advisorUsageFromReply(reply) {
  return llmUsageFromReply(reply);
}

const advisorModelCache = new Map();

/**
 * Tool-less chat model for the advisor — short responses, fast backend regardless of
 * the user's selected quality profile (these are decorative; not worth slow tokens).
 */
export function createAdvisorChatModel(env = process.env, persona = 'refine') {
  if (!isLlmConfigured(env)) return null;
  const backend = resolveLlmBackend(env);
  if (!backend) return null;
  const spec = ADVISOR_PERSONAS[persona] ?? ADVISOR_PERSONAS.refine;
  const modelId = resolveAdvisorModelId(env, backend);
  const key = `${backend}:${modelId}:${persona}`;
  const cached = advisorModelCache.get(key);
  if (cached) return cached;
  const overrides = {
    model: modelId,
    temperature: spec.temperature,
    // The advisor emits a tiny JSON one-liner, but on Gemini 2.5 (the default fast
    // model) `maxOutputTokens` is shared with the model's internal reasoning tokens.
    // The old 90-token cap was swallowed whole by "thinking", so the response came
    // back with an empty candidate — surfacing as {suggestion:null} (200) or an SDK
    // TypeError ("...reading 'message'") turned into a 502. A truncated reply is
    // fatal here because the JSON must parse in full (unlike the plain-text label
    // explainer). Give the answer real headroom.
    maxOutputTokens: 512
  };
  if (backend === 'vertex') {
    // Gemini: budget 0 disables the thinking stage so the entire output budget goes
    // to the JSON answer. The advisor is decorative and needs no chain-of-thought.
    overrides.thinkingBudget = 0;
  }
  const model = createLlmChatModel(env, overrides);
  advisorModelCache.set(key, model);
  return model;
}

const STRICT_JSON_RE = /\{[\s\S]*\}/;

/**
 * Parse the model's reply into { suggestion, highlightIds, kind }. Tolerant — strips
 * code fences or stray prose, validates types, clamps lengths.
 *
 * `kind` defaults to "suggestion" (actionable, shows the Do-it button). When the
 * model emits "comment" the bubble surfaces as pure flavor with no action affordance.
 * For the explain persona the caller is expected to coerce kind to "comment"
 * regardless of what the model says — the Wise Architect never proposes action.
 *
 * @param {string} raw
 * @param {{ persona?: string }} [opts]
 */
/**
 * Last-resort salvage when the model returned prose (or broken JSON) instead of the
 * strict advisor envelope. The Wise Architect is the main offender — the ivory-tower
 * voice fights the JSON-only rule more often than the action personas.
 *
 * @param {string} raw
 * @param {{ persona?: string }} [opts]
 */
export function rescueAdvisorReplyFromPlainText(raw, opts = {}) {
  if (typeof raw !== 'string') return null;
  let text = raw.replace(/\r/g, '').trim();
  if (!text) return null;
  text = text
    .replace(/^```(?:json)?\s*\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
  const embeddedSuggestion = text.match(/"suggestion"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (embeddedSuggestion) {
    try {
      text = JSON.parse(`"${embeddedSuggestion[1]}"`);
    } catch {
      text = embeddedSuggestion[1];
    }
  } else if (text.startsWith('{') || text.startsWith('[')) {
    return null;
  }
  text = String(text).split(/\n+/, 1)[0]?.trim() ?? '';
  text = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim();
  if (!text) return null;
  let kind = 'suggestion';
  if (opts.persona === 'explain') kind = 'comment';
  if (opts.persona === 'refine') kind = 'suggestion';
  return {
    suggestion: clampPunchy(text, 110),
    highlightIds: [],
    kind
  };
}

export function parseAdvisorReply(raw, opts = {}) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(STRICT_JSON_RE);
  if (!match) {
    return opts.persona === 'explain' ? rescueAdvisorReplyFromPlainText(trimmed, opts) : null;
  }
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.warn('advisorPrompts: advisor reply JSON parse failed:', err?.message ?? err);
    return opts.persona === 'explain' ? rescueAdvisorReplyFromPlainText(trimmed, opts) : null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const suggestion = typeof parsed.suggestion === 'string' ? parsed.suggestion.trim() : '';
  if (!suggestion) return null;
  const ids = Array.isArray(parsed.highlightIds)
    ? parsed.highlightIds
        .filter((id) => typeof id === 'string')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];
  const rawKind = typeof parsed.kind === 'string' ? parsed.kind.trim().toLowerCase() : '';
  let kind = rawKind === 'comment' ? 'comment' : 'suggestion';
  // The Wise Architect is ivory-tower only — never offer an action button regardless of what the model returned.
  if (opts.persona === 'explain') kind = 'comment';
  // THE Engineer is action-only — never a pure comment, regardless of what the model returned.
  if (opts.persona === 'refine') kind = 'suggestion';
  return {
    suggestion: clampPunchy(suggestion, 110),
    highlightIds: ids,
    kind
  };
}

function clampPunchy(text, maxChars) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(
    slice.lastIndexOf(' '),
    slice.lastIndexOf('—'),
    slice.lastIndexOf('-')
  );
  const cut = lastBreak > maxChars * 0.6 ? slice.slice(0, lastBreak) : slice;
  return cut.replace(/[\s,.;:—-]+$/, '') + '…';
}
