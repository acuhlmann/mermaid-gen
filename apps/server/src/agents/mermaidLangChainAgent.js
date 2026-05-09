import { ChatOpenRouter } from '@langchain/openrouter';
import { createAgent } from 'langchain';
import { createDiagramTools } from './diagramTools.js';

const DEFAULT_OPENROUTER_MODEL = 'google/gemini-2.5-flash-lite';

const SYSTEM_PROMPT = `You are Mermaid Architect, an agent that helps edit Mermaid diagrams.

When the user asks for a diagram change:
- Read the current diagram with get_diagram_state.
- Produce complete Mermaid source, not a partial diff.
- Apply the update with apply_mermaid_patch.
- Keep valid Mermaid syntax and preserve useful existing nodes unless the user asks to replace them.
- After applying, briefly summarize what changed.

When the user asks a general question, answer concisely.`;

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

function toLangChainMessages(messages) {
  return messages
    .map((message) => {
      const content = normalizeMessageContent(message.content);
      if (!content) return null;

      if (message.role === 'assistant') {
        return { role: 'assistant', content };
      }

      if (message.role === 'system') {
        return { role: 'system', content };
      }

      return { role: 'user', content };
    })
    .filter(Boolean);
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
        messages: toLangChainMessages(messages)
      });

      return {
        message: extractFinalMessage(result),
        raw: result
      };
    },

    async applyIntent({ prompt, temperature }) {
      return this.invoke({
        messages: [
          {
            role: 'user',
            content: `Apply this requested diagram change. Temperature hint: ${temperature}.\n\n${prompt}`
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
    }
  };
}

export { DEFAULT_OPENROUTER_MODEL };
