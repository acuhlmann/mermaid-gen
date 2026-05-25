import { ToolApplyResultSchema } from '@archislop/shared';
import { extractTextContent } from '../../utils/extractTextContent.js';

/**
 * Shared helpers used by both Mermaid and Infographic diagram agents. Pure
 * functions — no state, no I/O — so they're safe to share across agent
 * implementations.
 *
 * Lives in `_lib` so that neither agent has to cross-import from the other
 * (the `infographic` agent used to import 10+ helpers from `mermaid`, which
 * made `mermaid` an implicit base class).
 */

/**
 * Matches any internal tool name across all diagram types so we can scrub
 * them from user-visible assistant messages. The pattern is content-type
 * agnostic on purpose — every diagram type's tool names are listed here.
 */
const INTERNAL_TOOL_NAME_PATTERN =
  /\b(?:get_diagram_state|apply_mermaid_patch|get_infographic_dsl|apply_infographic_patch|get_metaphor_dsl|apply_metaphor_patch|get_chart_dsl|apply_chart_patch)\b/;

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return content == null ? '' : String(content);
}

/**
 * Convert wire-format messages (role/content) into the shape LangChain expects.
 * Drops assistant messages that would leak internal tool names to the user.
 */
export function toLangChainMessages(messages) {
  return messages
    .map((message) => {
      const content = normalizeMessageContent(message.content);
      if (!content) return null;

      if (message.role === 'assistant') {
        if (INTERNAL_TOOL_NAME_PATTERN.test(content)) return null;
        return { role: 'assistant', content };
      }

      if (message.role === 'system') {
        return { role: 'system', content };
      }

      return { role: 'user', content };
    })
    .filter(Boolean);
}

export function extractFinalMessage(result) {
  const messages = result?.messages ?? [];
  const lastAssistant = messages
    .toReversed()
    .find(
      (message) =>
        message?._getType?.() === 'ai' || message?.role === 'assistant' || message?.type === 'ai'
    );

  return extractTextContent(lastAssistant?.content).trim() || 'Done.';
}

function tokenFromLangChainChunk(chunk) {
  if (!chunk) return '';
  if (typeof chunk.content === 'string') return chunk.content;
  if (Array.isArray(chunk.content)) {
    return chunk.content.map((p) => (typeof p === 'string' ? p : (p?.text ?? ''))).join('');
  }
  return '';
}

/**
 * Translate a LangChain v2 stream event into the small `{type, text, name}`
 * envelope the SSE layer emits to the client. Returns null for events the
 * client doesn't care about.
 */
export function normalizeAgentStreamEvent(event) {
  const ev = event?.event ?? '';
  const data = event?.data ?? {};

  if (/stream/i.test(ev) && data.chunk !== undefined) {
    const text = tokenFromLangChainChunk(data.chunk);
    if (text) return { type: 'token', text };
  }

  if (ev.includes('tool_start') || ev === 'on_tool_start') {
    const name =
      data.name ??
      data.toolName ??
      (data.input && typeof data.input === 'object' ? data.input.name : undefined) ??
      event?.name ??
      '';
    return { type: 'tool_start', name: String(name) };
  }
  if (ev.includes('tool_end') || ev === 'on_tool_end') {
    const name =
      data.name ??
      data.toolName ??
      (data.output && typeof data.output === 'object' ? data.output.name : undefined) ??
      event?.name ??
      '';
    return { type: 'tool_end', name: String(name) };
  }

  return null;
}

/**
 * Pull the latest assembled `messages` array out of a stream event, falling
 * back to the previous snapshot when the event doesn't carry one.
 */
export function captureMessagesFromStreamEvent(event, prev) {
  const data = event?.data ?? {};
  const msgs = data.output?.messages;
  if (Array.isArray(msgs) && msgs.length > 0) return msgs;
  return prev;
}

/**
 * Scan the agent result for the most recent tool failure result and return
 * its error string. Reads the JSON-stringified `{accepted, error}` payload
 * produced by `apply_*_patch` tools.
 *
 * Replaces the previously-divergent `extractToolFailureError` (mermaid) and
 * `extractToolFailureMessage` (infographic) — they were doing the same job
 * with slightly different walks.
 */
export function extractToolFailureError(result) {
  const messages = result?.messages ?? [];
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const content = extractTextContent(
      messages[idx]?.content ?? messages[idx]?.kwargs?.content ?? ''
    ).trim();
    if (!content) continue;
    let raw;
    try {
      raw = JSON.parse(content);
    } catch {
      continue;
    }
    const parsed = ToolApplyResultSchema.safeParse(raw);
    if (parsed.success && !parsed.data.accepted) {
      return parsed.data.error;
    }
    // Fallback for tool result envelopes that don't pass the strict schema
    // (e.g. legacy shapes during migrations).
    if (raw && raw.accepted === false && typeof raw.error === 'string') {
      return raw.error;
    }
  }
  return null;
}

/**
 * Walk the message history backwards looking for the last `apply_*_patch`
 * tool call and return the `diagramSource` argument it carried. Used by the
 * syntax fixer and the repair-instruction builder so the next turn can see
 * exactly what the previous turn tried.
 *
 * Parameterized over the tool name so both diagram agents share one walker.
 */
export function extractLastAttemptedToolSource(result, toolName) {
  const messages = result?.messages ?? [];
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const msg = messages[idx];
    const calls =
      (Array.isArray(msg?.tool_calls) && msg.tool_calls) ||
      (Array.isArray(msg?.toolCalls) && msg.toolCalls) ||
      (Array.isArray(msg?.kwargs?.tool_calls) && msg.kwargs.tool_calls) ||
      [];
    for (let j = calls.length - 1; j >= 0; j -= 1) {
      const c = calls[j];
      const name = c?.name ?? c?.function?.name ?? '';
      if (name !== toolName) continue;
      const argsRaw = c?.args ?? c?.arguments ?? c?.function?.arguments;
      if (argsRaw == null) continue;
      let args = argsRaw;
      if (typeof argsRaw === 'string') {
        try {
          args = JSON.parse(argsRaw);
        } catch {
          continue;
        }
      }
      if (args && typeof args.diagramSource === 'string' && args.diagramSource.trim()) {
        return args.diagramSource;
      }
    }
  }
  return null;
}

/** Re-exported so callers don't need a second import for the common case. */
export { extractTextContent };
