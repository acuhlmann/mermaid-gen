import { ChatOpenRouter } from '@langchain/openrouter';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';
import { isSyntaxValidationError } from './mermaidReliabilitySkill.js';

/** Default avoids Google Gemini routing (often region-blocked, e.g. Hong Kong). Override with OPENROUTER_MODEL. */
const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-4o-mini';
const INTENT_PROFILE_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};

/** Maps UI surprise scale 1–5 to bounded LLM sampling temperature. */
export const SURPRISE_SCALE_TEMPERATURES = Object.freeze({
  1: 0.35,
  2: 0.55,
  3: 0.75,
  4: 0.95,
  5: 1.15
});

export const COAUTHOR_MODEL_LIMITS = Object.freeze({
  topP: 0.92,
  maxTokens: 2200
});

const SURPRISE_SCALE_BUDGETS = Object.freeze({
  1: 'Budget: add up to 2 nodes and 3 edges.',
  2: 'Budget: add up to 4 nodes and 5 edges.',
  3: 'Budget: add up to 6 nodes and 8 edges.',
  4: 'Budget: add up to 9 nodes and 12 edges.',
  5: 'Budget: add up to 12 nodes and 16 edges; keep labels short and readable.'
});

const SURPRISE_TIER_GUIDANCE = Object.freeze({
  1: 'Surprise scale 1 — Subtle: tiny additive tweaks only; keep the same diagram type and overall layout.',
  2: 'Surprise scale 2 — Mild: modest additions; prefer keeping the diagram type.',
  3: 'Surprise scale 3 — Balanced: noticeably richer diagram; mild restructuring is OK.',
  4: 'Surprise scale 4 — Bold: strong restructuring allowed; change diagram type only when it clearly improves validity and readability.',
  5: 'Surprise scale 5 — Wild but reliable: make an imaginative extension while preserving the diagram type unless a simple valid type switch is necessary.'
});

export function surpriseScaleToTemperature(scale) {
  const s = Number(scale);
  if (!Number.isInteger(s) || s < 1 || s > 5) {
    return SURPRISE_SCALE_TEMPERATURES[3];
  }
  return SURPRISE_SCALE_TEMPERATURES[s];
}

export function surpriseTierGuidance(scale) {
  const s = Number(scale);
  if (!Number.isInteger(s) || s < 1 || s > 5) {
    return SURPRISE_TIER_GUIDANCE[3];
  }
  return SURPRISE_TIER_GUIDANCE[s];
}

export function coAuthorModelOptionsForScale(scale) {
  return {
    temperature: surpriseScaleToTemperature(scale),
    topP: COAUTHOR_MODEL_LIMITS.topP,
    maxTokens: COAUTHOR_MODEL_LIMITS.maxTokens
  };
}

function buildCoAuthorUserContent({ prompt, surpriseScale, mermaidSource }) {
  const tierLine = surpriseTierGuidance(surpriseScale);
  const s = Number(surpriseScale);
  const budgetLine = SURPRISE_SCALE_BUDGETS[Number.isInteger(s) && s >= 1 && s <= 5 ? s : 3];

  return `You are in co-author surprise mode. Read the current diagram and produce a surprising extension.

Hard requirements:
- You MUST call get_diagram_state first.
- You MUST call apply_mermaid_patch with full Mermaid source.
- Do not return only text; apply the patch.
- Do not write explanatory prose until after the patch tool succeeds.
- If an ambitious idea risks invalid Mermaid syntax, choose a smaller valid patch.

General surprise policy:
- Preserve the core topic, but match the intensity described by your surprise scale below.
- Prefer a richer diagram than the current one when the scale allows.
- Keep node IDs simple ASCII identifiers and keep node labels concise.
- ${budgetLine}

Current committed diagram:
\`\`\`mermaid
${mermaidSource}
\`\`\`

Creative intensity (follow closely):
${tierLine}

Human intent to build upon:
${prompt}

Output goal:
Apply one creative, relevant update via apply_mermaid_patch that matches the surprise scale.`;
}

const SYSTEM_PROMPT = `You are Mermaid Architect, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Use the current diagram context or read the current diagram yourself with get_diagram_state.
- Produce complete Mermaid source, not a partial diff.
- Apply the update with apply_mermaid_patch.
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- After applying, briefly summarize what changed.
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

function extractFinalMessage(result) {
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
    content: `Your previous response did not apply a diagram patch.\n\nRepair instructions:\n- You MUST call apply_mermaid_patch now with complete, valid Mermaid source.\n- Keep the update smaller if needed so it remains valid.\n- Do not return prose only.\n- Do not mention tool names in your final user-facing summary.\n\nOriginal user request:\n${originalRequest || '(No explicit user request provided.)'}`
  };
}

function formatAgentInvokeFailure(error, env = process.env) {
  const detail = error instanceof Error ? error.message : String(error);
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

export function createMermaidLangChainAgent({
  stateStore,
  model = createOpenRouterModel(),
  env = process.env,
  createCoAuthorChatModel = (options) => createOpenRouterModel(env, options),
  createAgentImpl = createAgent
}) {
  const tools = createDiagramTools({ stateStore });
  const agentCache = new Map();

  function getDefaultAgent() {
    const key = 'default';
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model,
          tools,
          systemPrompt: SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

  function getCoAuthorAgentForScale(scale) {
    const surpriseScale = Number(scale);
    const clamped =
      Number.isInteger(surpriseScale) && surpriseScale >= 1 && surpriseScale <= 5 ? surpriseScale : 3;
    const key = `coauthor:${clamped}`;
    if (!agentCache.has(key)) {
      const coAuthorModel = createCoAuthorChatModel(coAuthorModelOptionsForScale(clamped));
      agentCache.set(
        key,
        createAgentImpl({
          model: coAuthorModel,
          tools,
          systemPrompt: SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

  async function invokeWithRepair(agent, messages, { requirePatch = false } = {}) {
    const baseMessages = [createCurrentDiagramContextMessage(stateStore), ...toLangChainMessages(messages)];
    const beforeRevision = stateStore.getState().revisionId;

    let firstResult;
    try {
      firstResult = await agent.invoke({ messages: baseMessages });
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
        const patchRetryResult = await agent.invoke({
          messages: [...baseMessages, buildPatchRequiredInstruction({ messages })]
        });
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
        retryResult = await agent.invoke({
          messages: [...baseMessages, buildSyntaxRepairInstruction({ messages, errorMessage: latestError })]
        });
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

  const defaultAgent = getDefaultAgent();

  return {
    async invoke({ messages }) {
      return invokeWithRepair(defaultAgent, messages);
    },

    async applyIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };

      return invokeWithRepair(
        defaultAgent,
        [
          {
            role: 'user',
            content: `Interpret and apply the user's requested diagram change.\n\nSettings:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser request:\n${prompt}`
          }
        ],
        { requirePatch: true }
      );
    },

    async applyCoAuthorIntent({ prompt, settings }) {
      const surpriseScale = settings?.surpriseScale ?? 3;
      const currentState = stateStore.getState();
      const coAuthorAgent = getCoAuthorAgentForScale(surpriseScale);

      return invokeWithRepair(
        coAuthorAgent,
        [
          {
            role: 'user',
            content: buildCoAuthorUserContent({
              prompt,
              surpriseScale,
              mermaidSource: currentState.mermaidSource
            })
          }
        ],
        { requirePatch: true }
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
        { requirePatch: true }
      );
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

    async applyCoAuthorIntent(input) {
      return getAgentService().applyCoAuthorIntent(input);
    },

    async applyStyleIntent(input) {
      return getAgentService().applyStyleIntent(input);
    }
  };
}

export { DEFAULT_OPENROUTER_MODEL };
export { INTENT_PROFILE_DEFAULTS };
