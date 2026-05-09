import { ChatOpenRouter } from '@langchain/openrouter';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';
const INTENT_PROFILE_DEFAULTS = {
  temperature: 0.7,
  topP: 1,
  maxNodes: 25,
  styleGuide: 'balanced',
  persona: 'creative architect'
};
const COAUTHOR_PROFILE_DEFAULTS = {
  temperature: 1.1,
  topP: 1,
  maxNodes: 40,
  styleGuide: 'bold',
  persona: 'playful co-author'
};

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

export class LlmNotConfiguredError extends Error {
  constructor() {
    super('OpenRouter is not configured. Set OPENROUTER_API_KEY in .env to enable LLM-backed agents.');
    this.name = 'LlmNotConfiguredError';
    this.statusCode = 503;
  }
}

export function isLlmConfigured(env = process.env) {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function createOpenRouterModel(env = process.env) {
  if (!isLlmConfigured(env)) {
    throw new LlmNotConfiguredError();
  }

  return new ChatOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    model: env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL,
    siteName: env.OPENROUTER_SITE_NAME || 'Mermaid Architect',
    siteUrl: env.OPENROUTER_SITE_URL || 'http://localhost:5173'
  });
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

export function createMermaidLangChainAgent({ stateStore, model = createOpenRouterModel() }) {
  const agent = createAgent({
    model,
    tools: createDiagramTools({ stateStore }),
    systemPrompt: SYSTEM_PROMPT
  });

  return {
    async invoke({ messages }) {
      const result = await agent.invoke({
        messages: [createCurrentDiagramContextMessage(stateStore), ...toLangChainMessages(messages)]
      });

      return {
        message: extractFinalMessage(result),
        raw: result
      };
    },

    async applyIntent({ prompt, settings }) {
      const resolvedSettings = { ...INTENT_PROFILE_DEFAULTS, ...settings };

      return this.invoke({
        messages: [
          {
            role: 'user',
            content: `Interpret and apply the user's requested diagram change.\n\nSettings:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nUser request:\n${prompt}`
          }
        ]
      });
    },

    async applyCoAuthorIntent({ prompt, settings }) {
      const resolvedSettings = { ...COAUTHOR_PROFILE_DEFAULTS, ...settings };
      const currentState = stateStore.getState();

      return this.invoke({
        messages: [
          {
            role: 'user',
            content: `You are in co-author surprise mode. Read the current diagram and extend it into a bigger graph.\n\nHard requirements:\n- You MUST preserve the full existing diagram content and extend from it.\n- You MUST call get_diagram_state first.\n- You MUST call apply_mermaid_patch with full Mermaid source.\n- Add at least 2 new nodes and 2 new edges connected to existing nodes.\n- Do not return only text; apply the patch.\n\nCurrent committed diagram:\n\`\`\`mermaid\n${currentState.mermaidSource}\n\`\`\`\n\nRespect these settings:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nHuman intent to build upon:\n${prompt}\n\nOutput goal:\n- Produce a creative yet relevant extension that keeps existing concepts and grows the architecture.`
          }
        ]
      });
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
      model: createOpenRouterModel(env)
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
    }
  };
}

export { DEFAULT_OPENROUTER_MODEL };
export { COAUTHOR_PROFILE_DEFAULTS, INTENT_PROFILE_DEFAULTS };
