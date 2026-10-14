/**
 * Reduce raw harness and proxy events to `GodLiveEvent`s (ADR-0019): the only shape that leaves the
 * runner, to the owner's God window and to the public run artifact. A tool's *output* never
 * survives this step — only its name, the file it touched, a clipped command line and an exit
 * status — and every candidate is validated against the shared schema, so anything that does not
 * fit is dropped rather than repaired.
 */
import path from 'node:path';
import { GodLiveEventSchema } from '@archislop/shared/godSchemas.js';
import { turnEndKind } from './harness/dsh.mjs';

const TOOL_NAME_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const REPO_PATH_RE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@/-]{1,200}$/;

/** Collapse control characters and clip to `max` characters. */
export function clipText(value, max) {
  if (typeof value !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex -- (reason: stripping control characters is the point)
  const flat = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  if (!flat) return undefined;
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** First line of a command, printable ASCII only, at most 160 characters. */
export function clipCommand(value) {
  if (typeof value !== 'string') return undefined;
  const firstLine = value.split('\n', 1)[0] ?? '';
  const ascii = firstLine.replace(/[^\x20-\x7e]/g, '?').trim();
  if (!ascii) return undefined;
  return ascii.length > 160 ? `${ascii.slice(0, 159)}…` : ascii;
}

/** Repo-relative POSIX path, or undefined when the path is outside `cwd` or oddly shaped. */
export function toRepoPath(value, cwd) {
  if (typeof value !== 'string' || !value) return undefined;
  const absolute = path.isAbsolute(value) ? value : path.join(cwd, value);
  const relative = path.relative(cwd, absolute).split(path.sep).join('/');
  return REPO_PATH_RE.test(relative) ? relative : undefined;
}

function pickPath(input) {
  if (!input || typeof input !== 'object') return undefined;
  for (const key of ['path', 'file_path', 'filePath', 'file', 'target']) {
    if (typeof input[key] === 'string') return input[key];
  }
  return undefined;
}

function pickCommand(input) {
  if (!input || typeof input !== 'object') return undefined;
  for (const key of ['command', 'cmd', 'script']) {
    if (typeof input[key] === 'string') return input[key];
  }
  return undefined;
}

/**
 * Map one raw event — a dsh `--json` line or a meter-proxy event — to a candidate live event
 * (without `seq`/`ts`), or null when nothing about it should leave the runner.
 *
 * @param {Record<string, unknown>} raw
 * @param {{ cwd: string, toolsByCallId?: Map<string, string> }} ctx
 */
export function describeRawEvent(raw, ctx) {
  if (!raw || typeof raw !== 'object') return null;
  const toolsByCallId = ctx.toolsByCallId ?? new Map();
  switch (raw.type) {
    case 'session':
      return { type: 'status', text: 'harness session started' };
    case 'status':
      if (raw.phase !== 'turn_end') return null;
      return { type: 'status', text: clipText(`turn ended: ${turnEndKind(raw.reason)}`, 280) };
    case 'text':
      return { type: 'text', text: clipText(raw.text, 280) };
    case 'tool_call': {
      const tool = TOOL_NAME_RE.test(String(raw.tool)) ? String(raw.tool) : 'tool';
      if (typeof raw.callId === 'string') toolsByCallId.set(raw.callId, tool);
      return {
        type: 'tool',
        tool,
        path: toRepoPath(pickPath(raw.input), ctx.cwd),
        command: clipCommand(pickCommand(raw.input))
      };
    }
    case 'tool_result':
      return {
        type: 'tool',
        tool: toolsByCallId.get(String(raw.callId)) ?? 'tool',
        exitCode: raw.status === 'error' ? 1 : 0
      };
    case 'final':
      return { type: 'final', text: clipText(raw.text, 280) };
    case 'error':
      return {
        type: 'error',
        text: clipText(String(raw.message ?? raw.error ?? 'harness error'), 280)
      };
    case 'model':
      return {
        type: 'model',
        inputTokens: raw.inputTokens,
        outputTokens: raw.outputTokens,
        cacheHitTokens: raw.cacheHitTokens,
        usd: raw.totalUsd
      };
    case 'blocked':
      return { type: 'status', text: clipCommand(`proxy refused ${raw.method} ${raw.path}`) };
    case 'budget':
      return { type: 'status', text: 'per-run budget reached', reason: 'budget' };
    case 'balance':
      return { type: 'status', text: 'DeepSeek balance exhausted', reason: 'balance' };
    case 'phase':
      return { type: 'phase', phase: raw.phase };
    default:
      return null;
  }
}

/**
 * Stamp and validate a candidate. Undefined optional fields are dropped first, so a candidate
 * only fails when something present is out of shape — and then the whole event is dropped.
 *
 * @returns {import('@archislop/shared/godSchemas.js').GodLiveEvent | null}
 */
export function toLiveEvent(candidate, seq, now = new Date()) {
  if (!candidate) return null;
  const event = { seq, ts: now.toISOString() };
  for (const [key, value] of Object.entries(candidate)) {
    if (value !== undefined) event[key] = value;
  }
  const parsed = GodLiveEventSchema.safeParse(event);
  return parsed.success ? parsed.data : null;
}

/** A sequencer that turns raw events into numbered, validated live events. */
export function createLiveEventStream({ cwd, now = () => new Date() }) {
  const toolsByCallId = new Map();
  let seq = 0;
  return {
    /** @returns {import('@archislop/shared/godSchemas.js').GodLiveEvent | null} */
    push(raw) {
      const event = toLiveEvent(describeRawEvent(raw, { cwd, toolsByCallId }), seq, now());
      if (event) seq += 1;
      return event;
    },
    count() {
      return seq;
    }
  };
}
