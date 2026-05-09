import { ChatOpenRouter } from '@langchain/openrouter';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';

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
      const resolvedSettings = {
        temperature: 0.7,
        topP: 1,
        maxNodes: 25,
        styleGuide: 'balanced',
        persona: 'creative architect',
        ...settings
      };

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
      const resolvedSettings = {
        temperature: 0.7,
        topP: 1,
        maxNodes: 25,
        styleGuide: 'balanced',
        persona: 'creative architect',
        ...settings
      };

      return this.invoke({
        messages: [
          {
            role: 'user',
            content: `Extend the current Mermaid diagram with a surprising but relevant co-author contribution.\n\nRespect these settings:\n- temperature: ${resolvedSettings.temperature}\n- topP: ${resolvedSettings.topP}\n- maxNodes: ${resolvedSettings.maxNodes}\n- styleGuide: ${resolvedSettings.styleGuide}\n- persona: ${resolvedSettings.persona}\n\nHuman intent to build upon:\n${prompt}\n\nPreserve existing structure, then add an extension.`
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
