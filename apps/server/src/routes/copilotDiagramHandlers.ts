/**
 * Blocking REST handlers for diagram intent/transform/analyze/style and client state sync.
 * Split out of copilot.ts (ADR-0005 / balanced-coupling-priorities §5 "copilot.ts → route modules by concern").
 */
import { z } from 'zod';
import {
  ContentTypeSchema,
  DiagramAnalyzeSchema,
  DiagramIntentSchema,
  DiagramStyleSchema,
  DiagramTransformIntentSchema,
  StyleIntentSchema
} from '@archislop/shared';
import { LlmNotConfiguredError } from '../agents/mermaidLangChainAgent.js';
import { resolveAutoIntentContentType } from './resolveAutoContentType.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import type { DiagramStateStore } from '../state/diagramStateStore.js';
import type {
  CopilotAgentService,
  DiagramAnalyzeBody,
  DiagramIntentBody,
  DiagramTransformIntentBody,
  JsonRouteResult,
  StyleIntentBody
} from './copilotRouteTypes.js';

type SyncStoreResult =
  | { accepted: true; state: import('@archislop/shared').DiagramState }
  | { accepted: false; error?: string; styleConfig?: unknown };

type IntentHandlerDeps = {
  body: DiagramIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
  /** Aborts the agent run if the REST client disconnects mid-flight. */
  abortSignal?: AbortSignal;
};

type TransformHandlerDeps = {
  body: DiagramTransformIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
  /** Aborts the agent run if the REST client disconnects mid-flight. */
  abortSignal?: AbortSignal;
};

type AnalyzeHandlerDeps = {
  body: DiagramAnalyzeBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
};

type StyleHandlerDeps = {
  body: StyleIntentBody;
  stateStore: DiagramStateStore;
  agentService: CopilotAgentService;
  /** Aborts the agent run if the REST client disconnects mid-flight. */
  abortSignal?: AbortSignal;
};

type SyncHandlerDeps = {
  body: unknown;
  stateStore: DiagramStateStore;
};

function safeErrorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : String(error));
}

export async function handleDiagramIntent({
  body,
  stateStore,
  agentService,
  abortSignal
}: IntentHandlerDeps): Promise<JsonRouteResult> {
  const parsedIntent = DiagramIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid intent payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  let intent;
  try {
    intent = await resolveAutoIntentContentType({
      payload: parsedIntent.data,
      getSlot: (contentType) => stateStore.getSlot(contentType),
      abortSignal
    });
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }
    return {
      status: 500,
      body: {
        error: 'Failed to resolve content mode',
        details: safeErrorMessage(error)
      }
    };
  }

  const state = stateStore.getSlot(intent.contentType);
  // Auto adopts the server slot revision above; for concrete types enforce client freshness.
  if (parsedIntent.data.contentType !== 'auto' && intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyIntent({
      contentType: intent.contentType,
      prompt: intent.prompt,
      settings: intent.settings,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile,
      peerContext: intent.peerContext,
      transformPersona: intent.transformPersona,
      uiLocale: intent.uiLocale,
      abortSignal
    });
    const nextState = stateStore.getSlot(intent.contentType);
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Agent did not apply a diagram patch.',
          message: agentResult.message,
          state: nextState
        }
      };
    }

    const stateWithPrompt = stateStore.setLastUserPrompt({
      contentType: intent.contentType,
      prompt: intent.prompt
    });
    stateStore.mirrorLastUserPromptToSibling({
      contentType: intent.contentType,
      prompt: intent.prompt
    });

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Patch accepted',
        patch,
        state: stateWithPrompt ?? nextState,
        metadata: {
          llm: true,
          agent: 'intent',
          contentType: intent.contentType,
          ...(parsedIntent.data.contentType === 'auto' ? { resolvedFromAuto: true } : {})
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Agent request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleDiagramTransformIntent({
  body,
  stateStore,
  agentService,
  abortSignal
}: TransformHandlerDeps): Promise<JsonRouteResult> {
  const parsedIntent = DiagramTransformIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid transform payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyTransformIntent({
      contentType: intent.contentType,
      mode: intent.mode,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile,
      russDepth: intent.russDepth,
      advisorPrompt: intent.advisorPrompt,
      uiLocale: intent.uiLocale,
      abortSignal
    });
    const nextState = stateStore.getSlot(intent.contentType);
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Transform did not apply a diagram patch.',
          message:
            'The transform returned text instead of a valid diagram update. Please try again or simplify the diagram.',
          state: nextState
        }
      };
    }

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Transform patch accepted',
        patch,
        state: nextState,
        metadata: {
          llm: true,
          agent: `transform:${intent.mode}`,
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Transform request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleDiagramAnalyze({
  body,
  stateStore,
  agentService
}: AnalyzeHandlerDeps): Promise<JsonRouteResult> {
  const parsed = DiagramAnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid analyze payload',
        details: parsed.error.flatten()
      }
    };
  }

  const intent = parsed.data;
  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyAnalyzeIntent({
      contentType: intent.contentType,
      kind: intent.kind,
      focusNode: intent.focusNode,
      modelProfile: intent.modelProfile,
      advisorPrompt: intent.advisorPrompt,
      uiLocale: intent.uiLocale
    });

    return {
      status: 200,
      body: {
        text: agentResult.message || '',
        metadata: {
          llm: true,
          agent: `analyze:${intent.kind}`,
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Analyze request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

export async function handleStyleIntent({
  body,
  stateStore,
  agentService,
  abortSignal
}: StyleHandlerDeps): Promise<JsonRouteResult> {
  const parsedIntent = StyleIntentSchema.safeParse(body);
  if (!parsedIntent.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid style payload',
        details: parsedIntent.error.flatten()
      }
    };
  }

  const intent = parsedIntent.data;
  if (intent.contentType !== 'mermaid' && intent.contentType !== 'chart') {
    return {
      status: 400,
      body: {
        error: 'Style intent is only supported for Mermaid diagrams and Vega-Lite charts.'
      }
    };
  }

  const state = stateStore.getSlot(intent.contentType);
  if (intent.revisionId !== state.revisionId) {
    return {
      status: 409,
      body: {
        error: 'State revision is stale. Refresh state and retry.',
        state
      }
    };
  }

  try {
    const agentResult = await agentService.applyStyleIntent({
      prompt: intent.stylePrompt || intent.prompt,
      settings: intent.settings,
      contentType: intent.contentType,
      uiLocale: intent.uiLocale,
      abortSignal
    });
    const nextState = stateStore.getSlot(intent.contentType);
    const patch = nextState.history.at(-1);

    if (nextState.revisionId === state.revisionId || !patch) {
      return {
        status: 422,
        body: {
          error: 'Style agent did not apply a diagram patch.',
          message: agentResult.message,
          state: nextState
        }
      };
    }

    return {
      status: 200,
      body: {
        message: agentResult.message || 'Style patch accepted',
        patch,
        state: nextState,
        metadata: {
          llm: true,
          agent: 'style',
          contentType: intent.contentType
        }
      }
    };
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return {
        status: error.statusCode,
        body: { error: safeErrorMessage(error) }
      };
    }

    return {
      status: 500,
      body: {
        error: 'Style request failed',
        details: safeErrorMessage(error)
      }
    };
  }
}

const SyncClientStateSchema = z.object({
  contentType: ContentTypeSchema.default('mermaid'),
  diagramSource: z.string(),
  styleConfig: DiagramStyleSchema.optional()
});

export async function handleClientStateSync({
  body,
  stateStore
}: SyncHandlerDeps): Promise<JsonRouteResult> {
  const parsed = SyncClientStateSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Invalid state sync payload',
        details: parsed.error.flatten()
      }
    };
  }

  const synced = await stateStore.syncClientDiagramSource({
    contentType: parsed.data.contentType,
    diagramSource: parsed.data.diagramSource,
    styleConfig: parsed.data.styleConfig
  });

  if (!synced.accepted) {
    const rejected = synced as Extract<SyncStoreResult, { accepted: false }>;
    return {
      status: 422,
      body: {
        error: rejected.error ?? 'State sync rejected'
      }
    };
  }

  const accepted = synced as Extract<SyncStoreResult, { accepted: true }>;
  return {
    status: 200,
    body: accepted.state as unknown as Record<string, unknown>
  };
}

export type { CopilotAgentService };
