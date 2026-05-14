import { DiagramPatchSchema } from '@archislop/shared';
import { parseSyntax } from '@antv/infographic';
import {
  INFOGRAPHIC_TEMPLATE_WHITELIST,
  inferInfographicTemplate
} from '../prompts/infographicSyntaxGuard.js';

const SMART_QUOTE_REGEX = /[‘’“”]/;
const TEMPLATE_WHITELIST_SET = new Set(INFOGRAPHIC_TEMPLATE_WHITELIST);

function formatParseError(error) {
  const path = error.path ? ` at ${error.path}` : '';
  const line = typeof error.line === 'number' ? ` (line ${error.line})` : '';
  return `${error.message}${path}${line}`;
}

function summarizeParseErrors(errors, maxShown = 5) {
  const head = errors.slice(0, maxShown).map(formatParseError);
  if (errors.length > maxShown) {
    head.push(`…and ${errors.length - maxShown} more.`);
  }
  return head.join('\n');
}

/**
 * Strip the most common LLM dressing — fenced blocks, leading commentary, smart quotes, tabs —
 * before strict validation. Tracks which fixes ran so the agent can see what happened.
 */
function sanitizeInfographicDsl(raw) {
  const applied = [];
  let text = String(raw ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');

  // Strip enclosing code fences (```infographic / ```text / ``` etc.). Trim outer whitespace lines first.
  const trimmed = text.replace(/^\s+|\s+$/g, '');
  const fencedFull = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
  if (fencedFull) {
    text = fencedFull[1];
    applied.push('strip-code-fence');
  } else {
    // Drop a stray opening fence line and a stray closing fence line if present.
    const lines = trimmed.split('\n');
    let changed = false;
    if (lines[0]?.match(/^```/)) {
      lines.shift();
      changed = true;
    }
    if (lines.length && lines[lines.length - 1]?.match(/^```/)) {
      lines.pop();
      changed = true;
    }
    if (changed) {
      text = lines.join('\n');
      applied.push('strip-stray-fence');
    }
  }

  // Replace tabs with two spaces (DSL is indentation-driven; tabs are ambiguous).
  if (/\t/.test(text)) {
    text = text.replace(/\t/g, '  ');
    applied.push('tabs-to-spaces');
  }

  // Normalize smart quotes to ASCII (the strict check would otherwise reject the DSL).
  if (SMART_QUOTE_REGEX.test(text)) {
    text = text
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"');
    applied.push('smart-quotes-to-ascii');
  }

  // Drop leading prose lines before the `infographic <template>` header, if any.
  const lines = text.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^infographic\s+[a-z0-9-]+\s*$/i.test(lines[i].trim()) && !/^\s/.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx > 0) {
    text = lines.slice(headerIdx).join('\n');
    applied.push('strip-leading-prose');
  }

  return { text, applied };
}

/**
 * Validation for AntV Infographic DSL.
 *
 * Layer 1 — cheap textual lint (smart quotes, tabs, header shape, template whitelist).
 * Layer 2 — AntV's own `parseSyntax`, which catches structural errors (unknown keys,
 * missing parents, malformed list items) per-template.
 *
 * Returns a `DiagramPatchSchema`-compatible patch on success.
 */
export async function validateAndPrepareInfographicPatch({
  currentState,
  proposedDiagramSource,
  reason
}) {
  if (typeof proposedDiagramSource !== 'string') {
    return { accepted: false, error: 'Infographic DSL must be a string.' };
  }

  const sanitized = sanitizeInfographicDsl(proposedDiagramSource);
  const normalized = sanitized.text;
  const sanitizerApplied = sanitized.applied;
  const trimmed = normalized.trim();

  if (!trimmed) {
    return { accepted: false, error: 'Infographic DSL is empty.' };
  }

  if (SMART_QUOTE_REGEX.test(trimmed)) {
    return {
      accepted: false,
      error: 'Smart quotes (“ ” ‘ ’) are not allowed. Use straight ASCII quotes instead.'
    };
  }

  if (/\t/.test(trimmed)) {
    return {
      accepted: false,
      error: 'Tabs are not allowed. Indent strictly with 2-space steps.'
    };
  }

  const lines = normalized.split('\n');
  const firstLineIdx = lines.findIndex((line) => line.trim().length > 0);
  if (firstLineIdx === -1) {
    return { accepted: false, error: 'Infographic DSL is empty.' };
  }

  const headerLine = lines[firstLineIdx];
  const headerMatch = headerLine.match(/^infographic\s+([a-z0-9-]+)\s*$/i);
  if (!headerMatch) {
    return {
      accepted: false,
      error:
        'First non-blank line must be: `infographic <template-name>` (lowercase, hyphens). Got: ' +
        JSON.stringify(headerLine.trim())
    };
  }

  if (/^\s/.test(headerLine)) {
    return { accepted: false, error: 'Template header must not be indented.' };
  }

  const templateName = headerMatch[1];
  if (TEMPLATE_WHITELIST_SET.size > 0 && !TEMPLATE_WHITELIST_SET.has(templateName)) {
    // Suggest the closest few templates by prefix to make repair easier.
    const family = templateName.split('-')[0];
    const familyMatches = INFOGRAPHIC_TEMPLATE_WHITELIST.filter((t) => t.startsWith(family + '-')).slice(0, 8);
    const suggestion = familyMatches.length > 0
      ? ` Did you mean one of: ${familyMatches.join(', ')}?`
      : '';
    return {
      accepted: false,
      error: `Unknown template "${templateName}".${suggestion}`
    };
  }

  // AntV's own parser handles the structural validation (per-template data shapes,
  // indentation, list-item nesting). It does not throw on bad input — it returns
  // `{ result, errors }` with structured error objects.
  const parsed = parseSyntax(normalized);
  if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
    return {
      accepted: false,
      error: `AntV Infographic parser rejected the DSL:\n${summarizeParseErrors(parsed.errors)}`
    };
  }

  const diagramSource = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized;

  const patch = DiagramPatchSchema.parse({
    previousRevisionId: currentState.revisionId,
    nextRevisionId: currentState.revisionId + 1,
    diagramSource,
    styleConfig: null,
    contentType: 'infographic',
    reason: reason || 'Agent update'
  });

  return {
    accepted: true,
    patch,
    metadata: {
      validator: 'infographic-parseSyntax',
      template: templateName,
      warnings: [],
      sanitizerApplied
    }
  };
}

export { inferInfographicTemplate };
