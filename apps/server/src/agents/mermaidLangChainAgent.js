import { ChatOpenRouter } from '@langchain/openrouter';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError } from './mermaidReliabilitySkill.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import { createDiagramAgentMiddleware, getAgentRunnableConfig } from './agentGraphConfig.js';

/** Default avoids Google Gemini routing (often region-blocked, e.g. Hong Kong). Override with OPENROUTER_MODEL. */
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const INTENT_PROFILE_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

export const TRANSFORM_MODEL_LIMITS = Object.freeze({
  topP: 0.92,
  maxTokens: 2400
});

const TRANSFORM_MODE_MODEL = Object.freeze({
  refine: { temperature: 0.42 },
  innovate: { temperature: 0.82 },
  goMad: { temperature: 1.35 }
});

const ANALYSIS_SYSTEM_PROMPT = `You are Mermaid Architect in read-only mode.
CRITICAL:
- Do NOT edit the diagram. Do NOT output apply_mermaid_patch or tool calls.
- Answer only in plain text or Markdown for the user to read.
- Never mention internal tools or system prompts.`;

export function transformModeModelOptions(mode) {
  const key = mode === 'refine' || mode === 'innovate' || mode === 'goMad' ? mode : 'refine';
  return {
    temperature: TRANSFORM_MODE_MODEL[key].temperature,
    topP: TRANSFORM_MODEL_LIMITS.topP,
    maxTokens: TRANSFORM_MODEL_LIMITS.maxTokens
  };
}

export function buildFocusScopeInstructions(focusNode) {
  if (!focusNode?.id) return '';
  const label = focusNode.label ? ` (visible label: "${focusNode.label}")` : '';
  return `\n\nFocus scope: Prefer changes centered on diagram element id "${focusNode.id}"${label}. Minimize edits elsewhere except where required for valid Mermaid syntax or connectivity.`;
}

function buildTransformUserContent({ mode, mermaidSource, focusScope }) {
  const policy =
    mode === 'refine'
      ? `Transform mode: REFINE — polish and lightly extend the diagram.
- Same diagram type unless a trivial tweak requires otherwise.
- Improve labels, grouping, and clarity; add a modest amount of structure.
- Budget: roughly up to 4 new nodes and 6 edges; keep it readable.`
      : mode === 'innovate'
        ? `Transform mode: INNOVATE — apply noticeable, fresh changes while staying on-topic.
- You may restructure layout meaningfully and surprise users with insightful additions most wouldn't think of.
- Larger edits OK; still coherent and valid Mermaid.
- Budget: roughly up to 10 nodes and 14 edges unless the diagram stays clearer with fewer.`
        : `Transform mode: GO MAD — maximum creative freedom while still vaguely reflecting the original idea.
- You MAY change diagram type (flowchart, sequence, mindmap, stateDiagram-v2, etc.) when it serves the chaos.
- Lean into unusual but valid Mermaid: init/theme/classDef, styling hacks, playful shapes, unconventional grouping.
- Prioritize spectacle + readability; avoid broken syntax.
- Keep text/background contrast readable: never produce dark text on dark fills or light text on light fills.
- Push boundaries — weird, memorable, still renders in standard Mermaid.`;

  return `${policy}

Hard requirements:
- Call get_diagram_state at most once unless a patch failed and you need fresh state.
- Apply exactly one successful transformative update: call apply_mermaid_patch once with complete Mermaid source, then answer in prose only (no further tool calls after acceptance).
- Do not return only text; apply the patch.
- Keep node IDs simple ASCII identifiers where possible; keep labels concise.
${focusScope}

Current committed diagram:
\`\`\`mermaid
${mermaidSource}
\`\`\`

Output goal:
Apply one transformative update via apply_mermaid_patch matching the mode above.`;
}

const SYSTEM_PROMPT = `You are Mermaid Architect, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Prefer the injected current diagram context; call get_diagram_state at most once if you truly need to confirm revision or state.
- Produce complete Mermaid source, not a partial diff.
- For a satisfied request: call apply_mermaid_patch once with the full updated diagram, then briefly summarize what changed in prose only — do not call tools again after an accepted patch (unless the tool returned accepted:false and you must repair).
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- The user cannot call tools. Never ask the user to call get_diagram_state or apply_mermaid_patch.
- Do not mention internal tool names in user-facing replies.
- Short requests like "simplify it", "make it clearer", or "current diagram" refer to the current diagram.

When the user asks a general question, answer concisely.`;

const INTERNAL_TOOL_NAME_PATTERN = /\b(?:get_diagram_state|apply_mermaid_patch)\b/;
const REPAIR_ERROR_PATTERN = /not valid mermaid|validation failed|parser rejected|missing known diagram type|mcp/i;

export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      'OpenRouter is not configured. For local dev set OPENROUTER_API_KEY in .env; on Cloud Run use Secret Manager secret openrouter-api-key (see docs/deploy/gcp.md).'
    );
    this.name = 'LlmNotConfiguredError';
    this.statusCode = 503;
  }
}

export function isLlmConfigured(env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function createOpenRouterModel(env = process.env, overrides = {}) {
  if (!isLlmConfigured(env)) {
    throw new LlmNotConfiguredError();
  }

  const { temperature, ...rest } = overrides;
  const fields = {
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
    siteName: env.OPENROUTER_SITE_NAME || 'Mermaid Architect',
    siteUrl: env.OPENROUTER_SITE_URL || 'http://localhost:5173',
    ...rest
  };
  if (temperature !== undefined) {
    fields.temperature = temperature;
  }

  return new ChatOpenRouter(fields);
}

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

function createCurrentDiagramContextMessage(stateStore) {
  const state = stateStore.getState();

  return {
    role: 'system',
    content: `Current diagram context:
- revisionId: ${state.revisionId}
- styleConfig: ${JSON.stringify(state.styleConfig)}
- mermaidSource:
\`\`\`mermaid
${state.mermaidSource}
\`\`\`

Use this as the current diagram when the user's request is short or refers to "it".`
  };
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part?.type === 'text') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  return content == null ? '' : String(content);
}

export function extractFinalMessage(result) {
  const messages = result?.messages ?? [];
  const lastAssistant = messages
    .toReversed()
    .find((message) => message?._getType?.() === 'ai' || message?.role === 'assistant' || message?.type === 'ai');

  return extractTextContent(lastAssistant?.content).trim() || 'Done.';
}

function extractToolFailureError(result) {
  const messages = result?.messages ?? [];
  for (let idx = messages.length - 1; idx >= 0; idx -= 1) {
    const content = extractTextContent(messages[idx]?.content).trim();
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      if (parsed?.accepted === false && typeof parsed?.error === 'string') {
        return parsed.error;
      }
    } catch {
      // Ignore non-JSON messages.
    }
  }
  return null;
}

export function normalizeAgentStreamEvent(event) {
  const ev = event?.event ?? '';
  const data = event?.data ?? {};

  if (/stream/i.test(ev) && data.chunk !== undefined) {
    const text = tokenFromLangChainChunk(data.chunk);
    if (text) return { type: 'token', text };
  }

  if (ev.includes('tool_start') || ev === 'on_tool_start') {
    return { type: 'tool_start', name: String(data.name ?? event?.name ?? '') };
  }
  if (ev.includes('tool_end') || ev === 'on_tool_end') {
    return { type: 'tool_end', name: String(data.name ?? event?.name ?? '') };
  }

  return null;
}

function tokenFromLangChainChunk(chunk) {
  if (!chunk) return '';
  if (typeof chunk.content === 'string') return chunk.content;
  if (Array.isArray(chunk.content)) {
    return chunk.content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join('');
  }
  return '';
}

export function shouldAttemptSyntaxRepair(errorMessage) {
  if (!errorMessage) return false;
  return REPAIR_ERROR_PATTERN.test(errorMessage) || isSyntaxValidationError(errorMessage);
}

export function buildSyntaxRepairInstruction({ messages, errorMessage }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  return {
    role: 'user',
    content: `Your previous patch failed validation.\n\nValidator error:\n${errorMessage}\n\nRepair instructions:\n- Return valid Mermaid syntax.\n- Keep the user's requested intent.\n- Call apply_mermaid_patch with complete Mermaid source.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

export function buildPatchRequiredInstruction({ messages }) {
  const originalRequest = toLangChainMessages(messages)
    .filter((message) => message.role === 'user')
    .map((message) => message.content)
    .join('\n\n')
    .trim();

  return {
    role: 'user',
    content: `Your previous response did not apply a diagram patch.\n\nRepair instructions:\n- You MUST call apply_mermaid_patch now once with complete, valid Mermaid source, then summarize in prose only (no further tool calls after acceptance).\n- Keep the update smaller if needed so it remains valid.\n- Do not return prose only.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

function formatAgentInvokeFailure(error, env = process.env) {
  const detail = redactSecrets(error instanceof Error ? error.message : String(error));
  const regionHint = /region|not available in your country|unsupported_country/i.test(detail)
    ? '\n\nIf this is a **region / model availability** issue, set `OPENROUTER_MODEL` in your server `.env` to a model that works where you are (for example `openai/gpt-4o-mini` or `anthropic/claude-3.5-haiku`), then restart the API server.\n'
    : '';
  const modelId = env?.OPENROUTER_MODEL ?? '';
  const toolsHint =
    /tool|tools|function[_ ]?call|parallel_tool|gemini|unsupported/i.test(detail) ||
    /gemini/i.test(modelId)
      ? '\n\nIf failures mention tools or function calling, pick an OpenRouter model that reliably supports tool use (for example `openai/gpt-4o-mini`). Some Gemini routes through OpenRouter do not play well with LangChain tool agents.\n'
      : '';
  return {
    message: `**Model request failed**\n\n${detail}${regionHint}${toolsHint}`,
    raw: null
  };
}

function captureMessagesFromStreamEvent(event, prev) {
  const data = event?.data ?? {};
  const msgs = data.output?.messages;
  if (Array.isArray(msgs) && msgs.length > 0) return msgs;
  return prev;
}

async function streamReactAgentEvents(agent, inputMessages, emit, env) {
  const runnableConfig = getAgentRunnableConfig(env);
  let latestMessages = [];
  try {
    const stream = await agent.streamEvents({ messages: inputMessages }, { version: 'v2', ...runnableConfig });
    for await (const ev of stream) {
      latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
      const normalized = normalizeAgentStreamEvent(ev);
      if (normalized) {
        emit(normalized);
      }
    }
  } catch (error) {
    emit({
      type: 'error',
      message: redactSecrets(error instanceof Error ? error.message : String(error))
    });
  }
  return { messages: latestMessages };
}

async function invokeWithRepair(
  agent,
  messages,
  { requirePatch = false, emit } = {},
  stateStore,
  env
) {
  const baseMessages = [createCurrentDiagramContextMessage(stateStore), ...toLangChainMessages(messages)];
  const beforeRevision = stateStore.getState().revisionId;

  const runnableConfig = getAgentRunnableConfig(env);
  let firstResult;
  try {
    if (typeof emit === 'function') {
      firstResult = await streamReactAgentEvents(agent, baseMessages, emit, env);
      if (!firstResult.messages?.length) {
        emit({ type: 'status', text: 'Running agent…' });
        firstResult = await agent.invoke({ messages: baseMessages }, runnableConfig);
      }
    } else {
      firstResult = await agent.invoke({ messages: baseMessages }, runnableConfig);
    }
  } catch (error) {
    return formatAgentInvokeFailure(error, env);
  }

  const firstMessage = extractFinalMessage(firstResult);
  const afterFirstRevision = stateStore.getState().revisionId;
  const firstError = extractToolFailureError(firstResult);

  if (afterFirstRevision !== beforeRevision) {
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  if (requirePatch && !firstError) {
    try {
      if (typeof emit === 'function') {
        emit({ type: 'status', text: 'Retrying: diagram patch required…' });
      }
      const patchRetryResult = await agent.invoke(
        {
          messages: [...baseMessages, buildPatchRequiredInstruction({ messages })]
        },
        runnableConfig
      );
      if (stateStore.getState().revisionId !== beforeRevision) {
        return {
          message: extractFinalMessage(patchRetryResult),
          raw: patchRetryResult
        };
      }
      return {
        message: extractFinalMessage(patchRetryResult),
        raw: patchRetryResult
      };
    } catch (error) {
      return formatAgentInvokeFailure(error, env);
    }
  }

  if (!shouldAttemptSyntaxRepair(firstError)) {
    return {
      message: firstMessage,
      raw: firstResult
    };
  }

  const parsedRepairAttempts = Number.parseInt(process.env.MERMAID_REPAIR_MAX_ATTEMPTS ?? '1', 10);
  const maxRepairAttempts = Number.isFinite(parsedRepairAttempts) ? Math.max(0, parsedRepairAttempts) : 1;
  let latestError = firstError;
  let latestResult = firstResult;

  for (let attempt = 1; attempt <= maxRepairAttempts; attempt += 1) {
    let retryResult;
    try {
      if (typeof emit === 'function') {
        emit({ type: 'status', text: `Repairing Mermaid syntax (attempt ${attempt})…` });
      }
      retryResult = await agent.invoke(
        {
          messages: [...baseMessages, buildSyntaxRepairInstruction({ messages, errorMessage: latestError })]
        },
        runnableConfig
      );
    } catch (error) {
      return formatAgentInvokeFailure(error, env);
    }
    latestResult = retryResult;

    const currentRevision = stateStore.getState().revisionId;
    if (currentRevision !== beforeRevision) {
      return {
        message: extractFinalMessage(retryResult),
        raw: retryResult
      };
    }

    const retryError = extractToolFailureError(retryResult);
    if (!shouldAttemptSyntaxRepair(retryError)) {
      break;
    }
    latestError = retryError;
  }

  return {
    message: extractFinalMessage(latestResult),
    raw: latestResult
  };
}

export function createMermaidLangChainAgent({
  stateStore,
  model = createOpenRouterModel(),
  env = process.env,
  createTransformChatModel = (options) => createOpenRouterModel(env, options),
  createAgentImpl = createAgent
}) {
  const tools = createDiagramTools({ stateStore });
  const agentMiddleware = createDiagramAgentMiddleware(env);
  const agentExtras = agentMiddleware.length > 0 ? { middleware: agentMiddleware } : {};
  const agentCache = new Map();

  function getDefaultAgent() {
    const key = 'default';
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model,
          tools,
          systemPrompt: SYSTEM_PROMPT,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  function getTransformAgent(mode) {
    const m = mode === 'refine' || mode === 'innovate' || mode === 'goMad' ? mode : 'refine';
    const key = `transform:${m}`;
    if (!agentCache.has(key)) {
      const tm = createTransformChatModel(transformModeModelOptions(m));
      agentCache.set(
        key,
        createAgentImpl({
          model: tm,
          tools,
          systemPrompt: SYSTEM_PROMPT,
          ...agentExtras
        })
      );
    }
    return agentCache.get(key);
  }

  async function invokeMutation(agent, userMessages, opts, emit) {
    return invokeWithRepair(agent, userMessages, { ...opts, emit }, stateStore, env);
  }

  const defaultAgent = getDefaultAgent();

  return {
    async invoke({ messages }) {
      return invokeWithRepair(defaultAgent, messages, {}, stateStore, env);
    },

    async applyIntent({ prompt, settings, focusNode, emit }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const focusScope = buildFocusScopeInstructions(focusNode);

      const userContent = `Interpret and apply the user's requested diagram change strictly according to their wording.

Settings (response shaping only):
- temperature: ${resolvedSettings.temperature}
- topP: ${resolvedSettings.topP}
- maxNodes: ${resolvedSettings.maxNodes}
- styleGuide: ${resolvedSettings.styleGuide}
- persona: ${resolvedSettings.persona}

User request:
${prompt}${focusScope}`;

      return invokeMutation(
        defaultAgent,
        [{ role: 'user', content: userContent }],
        { requirePatch: true },
        emit
      );
    },

    async applyTransformIntent({ mode, focusNode, emit }) {
      const currentState = stateStore.getState();
      const transformAgent = getTransformAgent(mode);
      const focusScope = buildFocusScopeInstructions(focusNode);

      return invokeMutation(
        transformAgent,
        [
          {
            role: 'user',
            content: buildTransformUserContent({
              mode,
              mermaidSource: currentState.mermaidSource,
              focusScope
            })
          }
        ],
        { requirePatch: true },
        emit
      );
    },

    async applyStyleIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };
      const currentState = stateStore.getState();

      return invokeWithRepair(
        defaultAgent,
        [
          {
            role: 'user',
            content: `Apply a visual styling update to the current Mermaid diagram.\n\nHard requirements:\n- Preserve the diagram structure and all semantic nodes and edges unless the user explicitly asks to change them.\n- You MUST keep or add a top Mermaid init directive in this exact supported form: %%{init: {...}}%%.\n- Use valid JSON inside the init directive.\n- You may update theme, look, themeVariables, themeCSS, and flowchart.curve.\n- You may add Mermaid classDef and class lines only for visual styling.\n- You MUST call apply_mermaid_patch with the full Mermaid source.\n- Do not return only text; apply the style patch.\n\nCurrent committed diagram:\n\`\`\`mermaid\n${currentState.mermaidSource}\n\`\`\`\n\nCurrent style config:\n${JSON.stringify(currentState.styleConfig)}\n\nRespect these settings for response style only:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser style request:\n${prompt}`
          }
        ],
        { requirePatch: true },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, emit }) {
      const state = stateStore.getState();
      const focusScope = buildFocusScopeInstructions(focusNode);
      const diagramBlock = `\`\`\`mermaid\n${state.mermaidSource}\n\`\`\``;

      const task =
        kind === 'critique'
          ? `Critique this diagram for clarity, structure, and usefulness. Note strengths, weaknesses, ambiguities, and concrete improvements — without rewriting the diagram yourself.${focusScope}`
          : `Explain what this diagram communicates to someone unfamiliar with it: main flows, key entities, and takeaways. Stay descriptive — do not rewrite the diagram.${focusScope}`;

      const analysisModel = createOpenRouterModel(env, {
        temperature: kind === 'critique' ? 0.52 : 0.42,
        maxTokens: 1800
      });

      const messages = [new SystemMessage(ANALYSIS_SYSTEM_PROMPT), new HumanMessage(`${task}\n\n${diagramBlock}`)];

      if (typeof emit === 'function') {
        let fullText = '';
        try {
          const stream = await analysisModel.stream(messages);
          for await (const chunk of stream) {
            const piece =
              extractTextContent(chunk?.content) ||
              extractTextContent(chunk?.kwargs?.content) ||
              (typeof chunk?.text === 'string' ? chunk.text : '');
            if (piece) {
              fullText += piece;
              emit({ type: 'token', text: piece });
            }
          }
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          const fallback = await analysisModel.invoke(messages).catch(() => null);
          const text = fallback ? extractTextContent(fallback.content) : '';
          return { message: text || 'Analysis failed.', raw: null };
        }
        return { message: fullText.trim() || 'Done.', raw: null };
      }

      const response = await analysisModel.invoke(messages);
      return {
        message: extractTextContent(response.content).trim() || 'Done.',
        raw: response
      };
    }
  };
}

export function createLazyMermaidAgentService({ stateStore, env = process.env }) {
  let agentService;

  function getAgentService() {
    if (!isLlmConfigured(env)) {
      throw new LlmNotConfiguredError();
    }

    agentService ??= createMermaidLangChainAgent({
      stateStore,
      model: createOpenRouterModel(env),
      env
    });

    return agentService;
  }

  return {
    async invoke(input) {
      return getAgentService().invoke(input);
    },

    async applyIntent(input) {
      return getAgentService().applyIntent(input);
    },

    async applyTransformIntent(input) {
      return getAgentService().applyTransformIntent(input);
    },

    async applyAnalyzeIntent(input) {
      return getAgentService().applyAnalyzeIntent(input);
    },

    async applyStyleIntent(input) {
      return getAgentService().applyStyleIntent(input);
    },

    async runAgentStream(operation, payload, emit) {
      const agent = getAgentService();

      if (operation === 'analyze') {
        const result = await agent.applyAnalyzeIntent({
          kind: payload.kind,
          focusNode: payload.focusNode,
          emit
        });
        emit({ type: 'final', revisionChanged: false, analyzeText: result.message });
        return result;
      }

      let agentResult;
      if (operation === 'intent') {
        agentResult = await agent.applyIntent({
          prompt: payload.prompt,
          settings: payload.settings ?? {},
          focusNode: payload.focusNode,
          emit
        });
      } else {
        agentResult = await agent.applyTransformIntent({
          mode: payload.mode,
          focusNode: payload.focusNode,
          emit
        });
      }

      const before = payload._revisionBefore;
      const afterState = stateStore.getState();
      const revisionChanged = typeof before === 'number' ? afterState.revisionId !== before : true;

      emit({
        type: 'final',
        revisionChanged,
        message: agentResult?.message ?? '',
        state: revisionChanged ? afterState : undefined
      });

      return agentResult;
    }
  };
}

export { DEFAULT_OPENROUTER_MODEL };
export { INTENT_PROFILE_DEFAULTS };
