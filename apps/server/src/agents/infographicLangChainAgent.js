import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { createInfographicTools } from './diagramTools.js';
import { redactSecrets } from '../utils/redactSecrets.js';
import {
  INFOGRAPHIC_SYSTEM_PROMPT,
  INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT,
  INFOGRAPHIC_CRITIQUE_TASK,
  INFOGRAPHIC_EXPLAIN_TASK,
  buildInfographicRepairInstruction
} from '../prompts/infographicSyntaxGuard.js';
import {
  LlmNotConfiguredError,
  isLlmConfigured,
  createOpenRouterModel,
  createVertexChatModel,
  resolveLlmBackend,
  resolveVertexModelId
} from './llmProvider.js';
import {
  buildFocusScopeInstructions as buildMermaidFocusScopeInstructions,
  buildAnalyzeFocusInstructions as buildMermaidAnalyzeFocusInstructions,
  captureMessagesFromStreamEvent,
  clampGoMadDepth,
  emitIntentTransformStreamResult,
  extractFinalMessage,
  goMadTransformModelOptions,
  normalizeAgentStreamEvent,
  normalizeModelProfile,
  resolveOpenRouterModelId,
  toLangChainMessages,
  transformModeModelOptions
} from './mermaidLangChainAgent.js';
import {
  buildInfographicFocusScopeInstructions,
  buildInfographicAnalyzeFocusInstructions
} from './infographicFocusInstructions.js';

/**
 * Route a focus payload to the right vocabulary. `infographic-item` selections come from the
 * AntV renderer with `indexes` + `elementType`; everything else falls back to the Mermaid
 * builder (which produces generic "node id …" language that's harmless for unselected paths).
 */
function buildFocusScopeInstructions(focusNode) {
  if (focusNode?.selectionKind === 'infographic-item') {
    return buildInfographicFocusScopeInstructions(focusNode);
  }
  return buildMermaidFocusScopeInstructions(focusNode);
}

function buildAnalyzeFocusInstructions(focusNode, kind) {
  if (focusNode?.selectionKind === 'infographic-item') {
    return buildInfographicAnalyzeFocusInstructions(focusNode, kind);
  }
  return buildMermaidAnalyzeFocusInstructions(focusNode, kind);
}
import { extractJsonStringPrefix } from './partialJsonString.js';

const INFOGRAPHIC_PATCH_REQUIRED_INSTRUCTION = `Your previous response did not apply an infographic patch.
- You MUST call apply_infographic_patch now once with complete, valid AntV Infographic DSL, then briefly summarize in prose only.
- Do not return prose only.
- Do not mention tool names in your final user-facing summary.`;

const INFOGRAPHIC_TRANSFORM_INSTRUCTIONS = {
  refine: `Refine the existing infographic without changing its core message. Tighten labels, fix awkward phrasing, balance the visual.`,
  innovate: `Re-imagine the infographic with bolder visual choices. You may switch to a different template if it better fits the data.`,
  goMad: `Push the infographic toward something dramatic — denser, more vivid, or organized in a surprising way. Stay within the supported templates.`
};

const MAX_INFOGRAPHIC_REPAIR_ATTEMPTS = 2;

function defaultChatModelFactory(env, options) {
  const backend = resolveLlmBackend(env);
  if (backend === 'vertex') return createVertexChatModel(env, options);
  return createOpenRouterModel(env, options);
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((part) => extractTextContent(part)).join('');
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (typeof content.content === 'string') return content.content;
  }
  return '';
}

function buildIntentUserContent({ prompt, focusScope, currentDsl }) {
  return `Interpret and apply the user's requested infographic change strictly according to their wording.

Broad or short requests (for example a single topic name) still require a concrete infographic now: choose a sensible template and produce real content. Do not ask the user to clarify.

Current committed infographic DSL:
\`\`\`
${currentDsl || '(empty — produce a fresh infographic)'}
\`\`\`

User request:
${prompt}${focusScope}`;
}

function buildTransformUserContent({ mode, focusScope, currentDsl, goMadDepth }) {
  const directive = INFOGRAPHIC_TRANSFORM_INSTRUCTIONS[mode] ?? INFOGRAPHIC_TRANSFORM_INSTRUCTIONS.refine;
  const depthLine =
    mode === 'goMad' && goMadDepth ? `\nGo Mad depth: ${clampGoMadDepth(goMadDepth)} of 12.` : '';
  return `${directive}${depthLine}

Current committed infographic DSL:
\`\`\`
${currentDsl}
\`\`\`
${focusScope}

Apply one transformative update via apply_infographic_patch. Output the FULL DSL.`;
}

function buildAnalysisUserContent({ task, focusScope, currentDsl }) {
  const prefix = focusScope ? `${focusScope.trim()}\n\n` : '';
  return `${prefix}${task}

\`\`\`
${currentDsl}
\`\`\``;
}

async function emitTokens(stream, emit) {
  let full = '';
  for await (const chunk of stream) {
    const piece =
      extractTextContent(chunk?.content) ||
      extractTextContent(chunk?.kwargs?.content) ||
      (typeof chunk?.text === 'string' ? chunk.text : '');
    if (piece) {
      full += piece;
      if (typeof emit === 'function') emit({ type: 'token', text: piece });
    }
  }
  return full;
}

async function invokeWithRepair(agent, userMessages, opts, stateStore, env) {
  const { requirePatch = false, emit } = opts ?? {};
  const beforeRevision = stateStore.getSlot('infographic').revisionId;

  let messages = toLangChainMessages(userMessages);
  let lastResult = null;
  let lastError = null;
  let lastBrokenSource = null;

  for (let attempt = 0; attempt <= MAX_INFOGRAPHIC_REPAIR_ATTEMPTS; attempt += 1) {
    if (typeof emit === 'function') {
      emit({ type: 'phase', id: attempt === 0 ? 'invoke' : `repair_${attempt}`, label: attempt === 0 ? 'Generating infographic…' : 'Repairing infographic…' });
    }

    let result;
    try {
      if (typeof agent.streamEvents === 'function' && typeof emit === 'function') {
        const stream = await agent.streamEvents({ messages }, { version: 'v2' });
        // Per tool_call_id buffers so we can lazily decode the partial
        // diagramSource argument as the model streams it. The patch tool's
        // schema is a single string field, so a streaming prefix is a valid
        // draft for the InfographicRenderer to render incrementally.
        const toolCallBuffers = new Map();
        let latestMessages = [];
        for await (const ev of stream) {
          latestMessages = captureMessagesFromStreamEvent(ev, latestMessages);
          const normalized = normalizeAgentStreamEvent(ev);
          if (normalized) emit(normalized);

          if (ev?.event === 'on_chat_model_stream') {
            const chunks = ev.data?.chunk?.tool_call_chunks;
            if (Array.isArray(chunks) && chunks.length > 0) {
              for (const tcc of chunks) {
                const bufferKey = tcc.id || `idx_${tcc.index ?? 0}`;
                let entry = toolCallBuffers.get(bufferKey);
                if (!entry) {
                  entry = { name: '', argsBuffer: '', lastEmitted: 0 };
                  toolCallBuffers.set(bufferKey, entry);
                }
                if (tcc.name) entry.name = tcc.name;
                if (typeof tcc.args === 'string' && tcc.args) {
                  entry.argsBuffer += tcc.args;
                }
                if (entry.name === 'apply_infographic_patch' && entry.argsBuffer) {
                  const accumulated = extractJsonStringPrefix(entry.argsBuffer, 'diagramSource');
                  if (accumulated.length > entry.lastEmitted) {
                    const delta = accumulated.slice(entry.lastEmitted);
                    entry.lastEmitted = accumulated.length;
                    emit({
                      type: 'draftPreview',
                      contentType: 'infographic',
                      delta,
                      accumulated
                    });
                  }
                }
              }
            }
          }
        }
        // streamEvents doesn't return a single envelope object; reconstruct
        // the legacy shape so the post-loop revision/repair logic still works.
        result = latestMessages.length > 0 ? { messages: latestMessages } : null;
      } else {
        result = await agent.invoke({ messages });
      }
    } catch (error) {
      lastError = redactSecrets(error instanceof Error ? error.message : String(error));
      if (typeof emit === 'function') emit({ type: 'error', message: lastError });
      break;
    }

    lastResult = result;

    const currentRevision = stateStore.getSlot('infographic').revisionId;
    if (currentRevision !== beforeRevision) {
      // Patch landed — success.
      return {
        message: extractFinalMessage(result) || 'Infographic updated.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    if (!requirePatch) {
      // No patch needed (e.g. analyze) — return whatever the agent produced.
      return {
        message: extractFinalMessage(result) || 'Done.',
        raw: result,
        metadata: { agent: 'infographic' }
      };
    }

    // Patch was required but not produced. Build a repair turn.
    const failureError = extractToolFailureMessage(result);
    if (failureError) {
      lastError = failureError;
      lastBrokenSource = extractLastAttemptedDsl(result) || lastBrokenSource;
      messages = [
        ...messages,
        new SystemMessage(
          buildInfographicRepairInstruction({
            errorMessage: failureError,
            brokenSource: lastBrokenSource
          })
        )
      ];
    } else {
      messages = [...messages, new SystemMessage(INFOGRAPHIC_PATCH_REQUIRED_INSTRUCTION)];
    }
  }

  if (requirePatch) {
    const slot = stateStore.getSlot('infographic');
    console.warn('[infographic-agent] patch did not apply after repair attempts', {
      beforeRevision,
      afterRevision: slot.revisionId,
      lastError: lastError ?? null
    });
  }

  return {
    message: lastError ? `Infographic update failed: ${lastError}` : 'Infographic update did not apply.',
    raw: lastResult,
    metadata: { agent: 'infographic', error: lastError ?? null }
  };
}

function extractToolFailureMessage(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.tool_call_id || m?.kwargs?.tool_call_id) {
      const text = extractTextContent(m?.content ?? m?.kwargs?.content ?? '');
      if (!text) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.accepted === false && parsed.error) {
          return parsed.error;
        }
      } catch {
        // tool result wasn't JSON — fall through
      }
    }
  }
  return null;
}

function extractLastAttemptedDsl(result) {
  const messages = result?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    const toolCalls = m?.tool_calls ?? m?.kwargs?.tool_calls ?? [];
    for (const call of toolCalls) {
      const name = call?.name ?? call?.function?.name;
      if (name !== 'apply_infographic_patch') continue;
      const args =
        call?.args ?? (typeof call?.function?.arguments === 'string'
          ? safeParseJson(call.function.arguments)
          : call?.function?.arguments) ?? {};
      if (typeof args.diagramSource === 'string' && args.diagramSource.trim()) {
        return args.diagramSource;
      }
    }
  }
  return null;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createInfographicLangChainAgent({
  stateStore,
  env = process.env,
  createAgentImpl = createAgent,
  chatModelFactory = defaultChatModelFactory
}) {
  const tools = createInfographicTools({ stateStore });
  const agentCache = new Map();
  const analysisModelCache = new Map();

  function chatModelFor(profile, extraOptions = {}) {
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
    return chatModelFactory(env, { model: modelId, ...extraOptions });
  }

  function getDefaultAgent(profile = 'fast') {
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, p) : resolveOpenRouterModelId(env, p);
    const key = `default:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      agentCache.set(
        key,
        createAgentImpl({
          model: chatModelFor(p),
          tools,
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

  function getTransformAgent(mode, profile = 'fast', goMadDepth) {
    const m = mode === 'refine' || mode === 'innovate' || mode === 'goMad' ? mode : 'refine';
    const p = normalizeModelProfile(profile);
    const backend = resolveLlmBackend(env);
    const modelId =
      backend === 'vertex' ? resolveVertexModelId(env, p) : resolveOpenRouterModelId(env, p);
    const madDepth = m === 'goMad' ? clampGoMadDepth(goMadDepth) : null;
    const key =
      m === 'goMad' ? `transform:${m}:${backend}:${modelId}:d${madDepth}` : `transform:${m}:${backend}:${modelId}`;
    if (!agentCache.has(key)) {
      const tm = chatModelFor(p, transformModeModelOptions(m, madDepth ?? 1));
      agentCache.set(
        key,
        createAgentImpl({
          model: tm,
          tools,
          systemPrompt: INFOGRAPHIC_SYSTEM_PROMPT
        })
      );
    }
    return agentCache.get(key);
  }

  function getAnalysisModel(backend, modelId, kind) {
    const key = `analysis:${backend}:${modelId}:${kind}`;
    if (!analysisModelCache.has(key)) {
      analysisModelCache.set(
        key,
        chatModelFactory(env, {
          model: modelId,
          temperature: kind === 'critique' ? 0.52 : 0.42,
          maxTokens: 1800,
          maxOutputTokens: 1800
        })
      );
    }
    return analysisModelCache.get(key);
  }

  return {
    async applyIntent({ prompt, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildFocusScopeInstructions(focusNode);
      const agent = getDefaultAgent(modelProfile);
      return invokeWithRepair(
        agent,
        [
          {
            role: 'user',
            content: buildIntentUserContent({ prompt, focusScope, currentDsl: slot.diagramSource })
          }
        ],
        { requirePatch: true, emit },
        stateStore,
        env
      );
    },

    async applyTransformIntent({ mode, focusNode, modelProfile, emit, goMadDepth }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildFocusScopeInstructions(focusNode);
      const agent = getTransformAgent(mode, modelProfile, goMadDepth);
      return invokeWithRepair(
        agent,
        [
          {
            role: 'user',
            content: buildTransformUserContent({
              mode,
              focusScope,
              currentDsl: slot.diagramSource,
              goMadDepth
            })
          }
        ],
        { requirePatch: true, emit },
        stateStore,
        env
      );
    },

    async applyAnalyzeIntent({ kind, focusNode, modelProfile, emit }) {
      const slot = stateStore.getSlot('infographic');
      const focusScope = buildAnalyzeFocusInstructions(focusNode, kind);
      const task = kind === 'critique' ? INFOGRAPHIC_CRITIQUE_TASK : INFOGRAPHIC_EXPLAIN_TASK;

      const profile = normalizeModelProfile(modelProfile);
      const backend = resolveLlmBackend(env);
      const modelId =
        backend === 'vertex' ? resolveVertexModelId(env, profile) : resolveOpenRouterModelId(env, profile);
      const analysisModel = getAnalysisModel(backend, modelId, kind);

      const messages = [
        new SystemMessage(INFOGRAPHIC_ANALYSIS_SYSTEM_PROMPT),
        new HumanMessage(buildAnalysisUserContent({ task, focusScope, currentDsl: slot.diagramSource }))
      ];

      if (typeof emit === 'function') {
        emit({ type: 'phase', id: 'analyze_stream', label: 'Streaming analysis…' });
        try {
          const stream = await analysisModel.stream(messages);
          const full = await emitTokens(stream, emit);
          return { message: full.trim() || 'Done.', raw: null };
        } catch (error) {
          emit({
            type: 'error',
            message: redactSecrets(error instanceof Error ? error.message : String(error))
          });
          const fallback = await analysisModel.invoke(messages).catch(() => null);
          const text = fallback ? extractTextContent(fallback.content) : '';
          return { message: text || 'Analysis failed.', raw: null };
        }
      }

      const response = await analysisModel.invoke(messages);
      return {
        message: extractTextContent(response.content).trim() || 'Done.',
        raw: response
      };
    }
  };
}

export function createLazyInfographicAgentService({ stateStore, env = process.env }) {
  let agentService;

  function getAgentService() {
    if (!isLlmConfigured(env)) {
      throw new LlmNotConfiguredError();
    }
    agentService ??= createInfographicLangChainAgent({ stateStore, env });
    return agentService;
  }

  return {
    async applyIntent(input) {
      return getAgentService().applyIntent(input);
    },
    async applyTransformIntent(input) {
      return getAgentService().applyTransformIntent(input);
    },
    async applyAnalyzeIntent(input) {
      return getAgentService().applyAnalyzeIntent(input);
    },
    async runAgentStream(operation, payload, emit) {
      const agent = getAgentService();
      const modelProfile = payload.modelProfile;

      if (typeof emit === 'function') {
        if (operation === 'analyze') {
          emit({ type: 'phase', id: 'analyze', label: 'Analyzing infographic…' });
        } else if (operation === 'intent') {
          emit({ type: 'phase', id: 'intent', label: 'Applying your request…' });
        } else {
          emit({ type: 'phase', id: 'transform', label: 'Transforming infographic…' });
        }
      }

      if (operation === 'analyze') {
        const result = await agent.applyAnalyzeIntent({
          kind: payload.kind,
          focusNode: payload.focusNode,
          modelProfile,
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
          modelProfile,
          emit
        });
      } else {
        agentResult = await agent.applyTransformIntent({
          mode: payload.mode,
          focusNode: payload.focusNode,
          modelProfile,
          emit,
          goMadDepth: payload.goMadDepth
        });
      }

      const before = payload._revisionBefore;
      // Reuse Mermaid's emitter; it reads stateStore.getSlot('mermaid') for the patch summary,
      // so we emit a thin infographic equivalent here instead.
      const after = stateStore.getSlot('infographic');
      if (typeof emit === 'function') {
        emit({
          type: 'final',
          revisionChanged: after.revisionId !== before,
          message: agentResult.message,
          state: after
        });
      }
      // Suppress unused-var warning for the imported helper.
      void emitIntentTransformStreamResult;

      return agentResult;
    }
  };
}
