/**
 * A scripted stand-in for a coding harness (ADR-0019): same interface as `harness/dsh.mjs`, same
 * dsh-shaped events, but in-process and deterministic. Model calls go through the real meter
 * proxy, so tests and `run.mjs --harness mock` dry runs exercise metering, budget stops and the
 * live-event pipeline without spending anything.
 *
 * Script steps:
 *   { call: 'anthropic' | 'openai', stream?: boolean }   one model request via the proxy
 *   { write: 'relative/path', content: '…' }            a workspace edit (tool_call + tool_result)
 *   { sleep: ms }                                       wait (interruptible by kill)
 *   { text: '…' }                                       assistant narration
 *   { final: '…' }                                      the closing answer
 *   { exit: code }                                      stop with this exit code
 */
import fs from 'node:fs';
import path from 'node:path';

export const MOCK_VERSION = '1.0.0';

export const DEFAULT_MOCK_SCRIPT = Object.freeze([
  { call: 'anthropic' },
  { text: 'Read the brief; nothing clears the evidence bar this run.' },
  { call: 'anthropic', stream: true },
  { final: 'No change proposed.' }
]);

function anthropicRequest(baseUrl, apiKey, model, stream) {
  return fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({
      model,
      max_tokens: 64,
      stream,
      messages: [{ role: 'user', content: 'mock' }]
    })
  });
}

function openaiRequest(baseUrl, apiKey, model, stream) {
  const origin = baseUrl.replace(/\/anthropic$/, '');
  return fetch(`${origin}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream, messages: [{ role: 'user', content: 'mock' }] })
  });
}

/**
 * @param {{
 *   cwd: string,
 *   baseUrl: string,
 *   apiKey: string,
 *   model: string,
 *   onEvent: (raw: Record<string, unknown>) => void,
 *   script?: ReadonlyArray<Record<string, unknown>>
 * }} options
 */
export function startMock({ cwd, baseUrl, apiKey, model, onEvent, script = DEFAULT_MOCK_SCRIPT }) {
  const abort = new AbortController();
  let sawFinal = false;
  let callSeq = 0;

  const sleep = (ms) =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      abort.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });

  const run = async () => {
    onEvent({ type: 'session', sessionId: 'mock-session', cwd });
    for (const step of script) {
      if (abort.signal.aborted) return { code: null, signal: 'SIGTERM' };
      if (step.call) {
        const request = step.call === 'openai' ? openaiRequest : anthropicRequest;
        const res = await request(baseUrl, apiKey, model, step.stream === true);
        await res.text();
        if (!res.ok) {
          onEvent({ type: 'error', message: `model request failed with HTTP ${res.status}` });
          return { code: 1, signal: null };
        }
      } else if (typeof step.write === 'string') {
        const callId = `call-${(callSeq += 1)}`;
        onEvent({ type: 'tool_call', callId, tool: 'write_file', input: { path: step.write } });
        fs.mkdirSync(path.dirname(path.join(cwd, step.write)), { recursive: true });
        fs.writeFileSync(path.join(cwd, step.write), String(step.content ?? ''));
        onEvent({ type: 'tool_result', callId, status: 'completed', result: 'secret file body' });
      } else if (typeof step.sleep === 'number') {
        await sleep(step.sleep);
      } else if (typeof step.text === 'string') {
        onEvent({ type: 'text', text: step.text });
      } else if (typeof step.final === 'string') {
        sawFinal = true;
        onEvent({ type: 'status', phase: 'turn_end', turn: 1, reason: 'completed' });
        onEvent({ type: 'final', text: step.final });
      } else if (typeof step.exit === 'number') {
        return { code: step.exit, signal: null };
      }
    }
    return { code: 0, signal: null };
  };

  const exit = run()
    .catch((error) => {
      onEvent({ type: 'error', message: String(error?.message ?? error) });
      return { code: 1, signal: null };
    })
    .then((result) => ({
      ...result,
      code: abort.signal.aborted ? null : result.code,
      signal: abort.signal.aborted ? 'SIGTERM' : result.signal,
      turnEndReason: sawFinal ? 'completed' : null,
      sawFinal,
      stderrTail: '',
      skippedLines: 0
    }));

  return {
    pid: null,
    exit,
    kill() {
      abort.abort();
    }
  };
}
