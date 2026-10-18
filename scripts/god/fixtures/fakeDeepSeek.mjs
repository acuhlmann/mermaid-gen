/**
 * A local stand-in for the DeepSeek API, for the God runner's tests. Speaks the Anthropic Messages
 * shape (`/anthropic/v1/messages`) and the OpenAI chat shape (`/chat/completions`), streamed or
 * not, reports configurable usage, and records every request it receives.
 *
 * It also answers the gateway wire — the same Anthropic shape at `/messages`, and `usage.cost` in
 * USD when `cost` is set — because that is what a meter proxy has to survive: two wallets, one
 * client, and a price the wallet states for itself.
 *
 * With `script`, each Anthropic request is answered by the next step — `{ text }` or
 * `{ tool, input }` (a `tool_use` block) — so a real harness can be driven through tool calls
 * without a model. Past the end of the script it answers `done`.
 */
import http from 'node:http';

export const FAKE_USAGE = Object.freeze({ input: 1000, cacheRead: 600, output: 200 });

/** The Anthropic Messages endpoint on the first-party wallet, and on a gateway. */
const ANTHROPIC_PATHS = new Set(['/anthropic/v1/messages', '/messages']);

function sse(res, events) {
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  for (const event of events) {
    res.write(`event: ${event.type ?? 'message'}\ndata: ${JSON.stringify(event)}\n\n`);
  }
  res.end();
}

function contentBlockEvents(step, toolId) {
  if (step.tool) {
    return [
      {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: toolId, name: step.tool, input: {} }
      },
      {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: JSON.stringify(step.input ?? {}) }
      },
      { type: 'content_block_stop', index: 0 }
    ];
  }
  return [
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: step.text } },
    { type: 'content_block_stop', index: 0 }
  ];
}

function anthropic(body, usage, step, toolId, cost) {
  const fullUsage = {
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_input_tokens: usage.cacheRead,
    ...(cost == null ? {} : { cost })
  };
  const stopReason = step.tool ? 'tool_use' : 'end_turn';
  if (!body.stream) {
    const block = step.tool
      ? { type: 'tool_use', id: toolId, name: step.tool, input: step.input ?? {} }
      : { type: 'text', text: step.text };
    return {
      json: {
        id: 'msg_fake',
        type: 'message',
        role: 'assistant',
        model: body.model,
        content: [block],
        stop_reason: stopReason,
        usage: fullUsage
      }
    };
  }
  return {
    events: [
      {
        type: 'message_start',
        message: {
          id: 'msg_fake',
          model: body.model,
          usage: { ...fullUsage, output_tokens: 1 }
        }
      },
      ...contentBlockEvents(step, toolId),
      {
        type: 'message_delta',
        delta: { stop_reason: stopReason },
        usage: { output_tokens: usage.output }
      },
      { type: 'message_stop' }
    ]
  };
}

function openai(body, usage, cost) {
  const fullUsage = {
    prompt_tokens: usage.input,
    completion_tokens: usage.output,
    prompt_cache_hit_tokens: usage.cacheRead,
    prompt_cache_miss_tokens: usage.input - usage.cacheRead,
    ...(cost == null ? {} : { cost })
  };
  if (!body.stream) {
    return {
      json: {
        id: 'chatcmpl_fake',
        model: body.model,
        choices: [{ index: 0, message: { role: 'assistant', content: 'ok' } }],
        usage: fullUsage
      }
    };
  }
  const chunks = [{ id: 'c', choices: [{ index: 0, delta: { content: 'ok' } }] }];
  if (body.stream_options?.include_usage) chunks.push({ id: 'c', choices: [], usage: fullUsage });
  return { events: chunks };
}

/**
 * @param {{
 *   usage?: { input: number, cacheRead: number, output: number },
 *   status?: number,
 *   cost?: number | null,
 *   script?: ReadonlyArray<{ text?: string, tool?: string, input?: Record<string, unknown> }>
 * }} [options]
 */
export async function startFakeDeepSeek(options = {}) {
  const requests = [];
  const settings = {
    usage: options.usage ?? FAKE_USAGE,
    status: options.status ?? 200,
    cost: options.cost ?? null
  };
  const script = [...(options.script ?? [])];
  let anthropicCalls = 0;
  const nextStep = () => {
    anthropicCalls += 1;
    return script.shift() ?? { text: anthropicCalls === 1 ? 'ok' : 'done' };
  };
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: req.method, path: req.url, headers: req.headers, body });
    if (settings.status !== 200) {
      res.writeHead(settings.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Insufficient Balance' } }));
      return;
    }
    const reply = ANTHROPIC_PATHS.has(req.url)
      ? anthropic(body, settings.usage, nextStep(), `toolu_${anthropicCalls}`, settings.cost)
      : req.url === '/chat/completions' || req.url === '/v1/chat/completions'
        ? openai(body, settings.usage, settings.cost)
        : { json: { object: 'list', data: [] } };
    if (reply.events) {
      sse(res, reply.events);
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(reply.json));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    requests,
    settings,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      })
  };
}
