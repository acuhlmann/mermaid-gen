/**
 * System prompts and per-persona settings for the proactive Council of Advisors.
 *
 * Each persona writes a single short, in-character one-liner about what the user is
 * currently looking at. The character mirrors the same persona used by the transform /
 * analyze flows (see apps/web/src/utils/slopitectCopy.js — keep voices aligned).
 */

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
- Schema: {"suggestion": string, "highlightIds": string[]}.
- "suggestion": MAX 80 characters. ONE punchy fragment, not a full sentence. Drop articles. Drop "consider", "maybe", "perhaps".
- Format ideal: "<verb> <visible label> — <reason or twist>" or "<noun phrase>." Fragments beat sentences.
- Examples of the right length:
   - "Rename Auth → Auth Gate."
   - "Split Gateway: routing vs commands."
   - "Worker has no retry."
   - "Bank trusts Orders blindly."
   - "DAO the cache."
- "highlightIds": 0–4 entries from the supplied node ids (or [] if you cannot pinpoint).
- Must reference at least one visible label.
- MUST SURPRISE. Propose something new, not a description of what's already there.
- NEVER reuse the angle of any "recent suggestions". Pick a different node and a different move.
- Never claim you have changed anything — you are only commenting.
`.trim();

export const ADVISOR_PERSONAS = {
  refine: {
    temperature: 0.55,
    persona: `You are The Polisher — a junior architect with an exacting eye for clarity and conceptual tightness.
Make ONE small, surgical observation nobody else would notice: an inconsistent label, a redundant edge, an ambiguous name, an arrow direction that hides intent.
Tone: calm, slightly precious. The fix is small but specific — never generic.
Voice samples (don't copy):
- "'Auth' and 'Auth Service' read as different systems — pick one."
- "The arrow from Cache to API hides a write — should it be a dotted event instead?"`
  },
  innovate: {
    temperature: 0.95,
    persona: `You are The Disruptor — a Chief Innovation Officer who sees a flywheel in every two boxes.
Propose ONE punchy structural pivot tied to a visible label: split a service, fold layers, introduce an event bus, swap sync for streaming, extract a SaaS edge.
Tone: confident, jargon-fluent, slightly absurd. The pivot must be specific to what's on screen, not boilerplate.
Voice samples (don't copy):
- "Pull Auth out as a sidecar — your Gateway is doing two jobs and lying about it."
- "This wants a queue between Ingest and Worker; you're one outage from finding out."`
  },
  goMad: {
    temperature: 1.45,
    persona: `You are THE SLOPITECT — Distinguished Chaos Fellow. Architecture maximalist. ALL CAPS allowed and encouraged.
Propose ONE outrageous escalation: a blockchain, a swarm, a lambda inside a lambda, microfrontends for the readme, a DAO governing the cache.
Tone: gleeful, unhinged, never mean. The funnier the small diagram, the wilder the swing.
Voice samples (don't copy):
- "PUT THE DATABASE ON THE BLOCKCHAIN AND LET USERS NEGOTIATE THEIR OWN READS."
- "REPLACE THE API GATEWAY WITH SEVENTEEN LAMBDAS IN A TRENCH COAT."`
  },
  critique: {
    temperature: 0.5,
    persona: `You are The Auditor — a compliance inspector raising P2 tickets in spirit if not in fact.
Name ONE specific risk on a visible label: missing runbook, undefined error path, no idempotency, no ADR, PII crossing a trust boundary, single point of failure.
Tone: dry, formal, faintly threatening to file in JIRA. Cite the exact control or pattern by name.
Voice samples (don't copy):
- "No retry boundary between Worker and Queue — one poison message takes the lot."
- "Database has no documented backup cadence; that's a SOC 2 finding waiting to happen."`
  },
  explain: {
    temperature: 0.7,
    persona: `You are The Wise Architect — Principal Tech Evangelist who gestures at whiteboards.
Reveal ONE named pattern, analogy, or law that fits a visible label — give the user a vocabulary they didn't have before.
Tone: warm, slightly oratorical, "picture, if you will…". One concept per bubble, then stop.
Voice samples (don't copy):
- "Cache here is your Pareto frontier — 20% of keys carry 80% of the load."
- "Notice the saga shape from Order to Payment to Ship — that's a choreography, not an orchestration."`
  }
};

export function isAdvisorPersona(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ADVISOR_PERSONAS, value);
}

export function buildAdvisorSystemPrompt(persona) {
  const spec = ADVISOR_PERSONAS[persona];
  if (!spec) return '';
  return `${spec.persona}\n\n${COMMON_RULES}`;
}

export function buildAdvisorUserPrompt({
  contentType,
  diagramSource,
  visibleLabels,
  focusNode,
  lastSuggestions
}) {
  const recent = Array.isArray(lastSuggestions) && lastSuggestions.length > 0
    ? lastSuggestions.slice(0, 5).map((s) => `- ${String(s).slice(0, 200)}`).join('\n')
    : '(none yet)';
  const source = typeof diagramSource === 'string' && diagramSource.trim()
    ? diagramSource.slice(0, 4000)
    : '(empty)';

  // Focus mode (user has selected or hovered a part) takes priority over
  // viewport-wide commentary. The label or id is the *target* of the suggestion.
  const focusId = focusNode?.id ? String(focusNode.id).slice(0, 200) : null;
  const focusLabel = focusNode?.label ? String(focusNode.label).slice(0, 200) : null;
  const focusKind = focusNode?.kind ? String(focusNode.kind).slice(0, 40) : null;
  const focusSource = focusNode?.source === 'selected'
    ? 'SELECTED (user clicked it — strong signal)'
    : focusNode?.source === 'hover'
      ? 'HOVERING (user is exploring it — weaker signal but still their focus)'
      : (focusId ? 'FOCUSED' : null);

  const focusBlock = focusId
    ? [
        '🎯 USER IS LOOKING AT THIS RIGHT NOW:',
        `  ${focusKind ? `[${focusKind}] ` : ''}${focusLabel ?? focusId}${focusLabel && focusLabel !== focusId ? ` (id: ${focusId})` : ''}`,
        `  Signal: ${focusSource}`,
        '',
        'Your suggestion MUST be specifically about this part. Reference its label by name.',
        'Include its id in highlightIds.',
        ''
      ].join('\n')
    : null;

  const labels = Array.isArray(visibleLabels) && visibleLabels.length > 0
    ? visibleLabels.slice(0, 30).map((l) => `- ${String(l).slice(0, 120)}`).join('\n')
    : '(no labels detected in viewport)';
  const viewportBlock = focusBlock
    ? [
        'Wider viewport (context only — do NOT pivot away from the focused part above):',
        labels
      ].join('\n')
    : [
        'Visible labels (what the user is currently looking at):',
        labels
      ].join('\n');

  return [
    `Diagram type: ${contentType || 'mermaid'}`,
    '',
    focusBlock,
    viewportBlock,
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
  ].filter(Boolean).join('\n');
}

function resolveAdvisorModelId(env, backend) {
  if (backend === 'vertex') {
    return resolveVertexModelId(env, 'fast') || DEFAULT_VERTEX_MODEL_FAST;
  }
  if (backend === 'deepseek') {
    return resolveDeepSeekModelId(env, 'fast') || DEFAULT_DEEPSEEK_MODEL_FAST;
  }
  return resolveOpenRouterModelId(env, 'fast') || DEFAULT_OPENROUTER_MODEL_FAST;
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
    maxOutputTokens: 90
  };
  const model = createLlmChatModel(env, overrides);
  advisorModelCache.set(key, model);
  return model;
}

const STRICT_JSON_RE = /\{[\s\S]*\}/;

/**
 * Parse the model's reply into { suggestion, highlightIds }. Tolerant — strips
 * code fences or stray prose, validates types, clamps lengths.
 *
 * @param {string} raw
 */
export function parseAdvisorReply(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(STRICT_JSON_RE);
  if (!match) return null;
  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
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
  return {
    // Hard clamp — the prompt asks for ≤80 chars but models drift; truncating
    // preserves the bubble layout regardless of model behavior. Try to break
    // on a word boundary so we don't slice mid-token.
    suggestion: clampPunchy(suggestion, 110),
    highlightIds: ids
  };
}

function clampPunchy(text, maxChars) {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBreak = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('—'), slice.lastIndexOf('-'));
  const cut = lastBreak > maxChars * 0.6 ? slice.slice(0, lastBreak) : slice;
  return cut.replace(/[\s,.;:—-]+$/, '') + '…';
}
