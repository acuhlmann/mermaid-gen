import type {
  ContentType,
  DiagramAnalyze,
  DiagramState,
  DiagramTransformIntent,
  FocusNode,
  GoMadDepth,
  IntentPeerContext,
  IntentSettings,
  ModelProfile,
  TransformPersona
} from './diagramSchema.js';

/**
 * Shared contract for diagram agents (Mermaid, Infographic, and any future
 * content type). Both server-side agent implementations satisfy this
 * interface — declaring it here means consumers depend on the shape, not
 * on the specific implementations.
 *
 * Lives in `packages/shared` so the route layer and any future
 * cross-implementation tooling (dispatcher, test harness, profile-driven
 * engine) can program against one type.
 *
 * Style intent is intentionally optional: today only the mermaid agent
 * supports it, and that's a product invariant worth surfacing in types
 * instead of hiding behind a runtime carve-out in the dispatcher.
 */

/** Token / phase / status / tool / error / final / artifact event emitted to SSE consumers. */
export type AgentStreamEmit = (event: unknown) => void;

export interface AgentResult {
  message: string;
  raw?: unknown;
  metadata?: Record<string, unknown> | null;
}

export interface InvokeInput {
  messages: Array<{ role: string; content: unknown }>;
  modelProfile?: ModelProfile;
}

export interface ApplyIntentInput {
  prompt: string;
  settings?: Partial<IntentSettings>;
  focusNode?: FocusNode | null;
  modelProfile?: ModelProfile;
  emit?: AgentStreamEmit;
  peerContext?: IntentPeerContext | null;
  abortSignal?: AbortSignal;
  /** Infographic-only — mapped to a persona instruction block. Ignored by mermaid. */
  transformPersona?: TransformPersona | null;
}

export interface ApplyTransformIntentInput {
  mode: DiagramTransformIntent['mode'];
  focusNode?: FocusNode | null;
  modelProfile?: ModelProfile;
  emit?: AgentStreamEmit;
  goMadDepth?: GoMadDepth;
  abortSignal?: AbortSignal;
  /** Infographic-only — free-form prompt threaded into transform user content. */
  advisorPrompt?: string | null;
}

export interface ApplyAnalyzeIntentInput {
  kind: DiagramAnalyze['kind'];
  focusNode?: FocusNode | null;
  modelProfile?: ModelProfile;
  emit?: AgentStreamEmit;
  /** Stakeholder suggestion text — scoped analysis, not a whole-diagram pass. */
  advisorPrompt?: string | null;
}

export interface ApplyStyleIntentInput {
  prompt: string;
  settings?: Partial<IntentSettings>;
  /** Set by the route/dispatcher so per-slot agents can disambiguate. Optional for legacy callers. */
  contentType?: ContentType;
  modelProfile?: ModelProfile;
  emit?: AgentStreamEmit;
  /** Aborts the run when the REST client disconnects, so an abandoned run stops burning budget. */
  abortSignal?: AbortSignal;
}

export type AgentStreamOperation = 'intent' | 'transform' | 'analyze';

/**
 * Server-internal SSE payload threaded from the route handler to
 * `runAgentStream`. Wider than the wire-level `AgentStreamPayloadSchema`
 * (in `diagramSchema`) because it also carries server-side bookkeeping
 * like `_revisionBefore` and an `AbortSignal`.
 */
export interface DiagramAgentStreamPayload {
  contentType: ContentType;
  modelProfile?: ModelProfile;
  prompt?: string;
  settings?: Partial<IntentSettings>;
  focusNode?: FocusNode | null;
  peerContext?: IntentPeerContext | null;
  mode?: DiagramTransformIntent['mode'];
  goMadDepth?: GoMadDepth;
  kind?: DiagramAnalyze['kind'];
  transformPersona?: TransformPersona | null;
  /** Transform or analyze — stakeholder bubble text for scoped work. */
  advisorPrompt?: string | null;
  abortSignal?: AbortSignal;
  /** Server-side checkpoint of revisionId before the run started. */
  _revisionBefore?: number;
}

/**
 * Surface of a per-content-type diagram agent service. Implementations:
 *  - `createLazyMermaidAgentService` (apps/server/src/agents/mermaidLangChainAgent.js)
 *  - `createLazyInfographicAgentService` (apps/server/src/agents/infographicLangChainAgent.js)
 *
 * The dispatcher (`diagramAgentDispatcher.js`) routes by content type to one
 * of these and forwards each method through.
 */
export interface DiagramAgentService {
  /**
   * Generic single-shot invoke for chat-style interactions. Not all agents
   * implement this — the dispatcher only exposes it on mermaid today.
   */
  invoke?(input: InvokeInput): Promise<AgentResult>;

  /** Prompt-bar Go / Fix-from-critique. Always requires a patch. */
  applyIntent(input: ApplyIntentInput): Promise<AgentResult>;

  /** Refine / Erlich / Go Mad / Align / Barker. Always requires a patch. */
  applyTransformIntent(input: ApplyTransformIntentInput): Promise<AgentResult>;

  /** Critique / Explain. Read-only — never mutates a slot. */
  applyAnalyzeIntent(input: ApplyAnalyzeIntentInput): Promise<AgentResult>;

  /** Mermaid and Chart only. Style-config update via apply_mermaid_patch or apply_chart_patch. */
  applyStyleIntent?(input: ApplyStyleIntentInput): Promise<AgentResult>;

  /**
   * SSE-driven streaming entry point. Wraps applyIntent / applyTransformIntent
   * / applyAnalyzeIntent and emits final/error events through `emit`.
   */
  runAgentStream(
    operation: AgentStreamOperation,
    payload: DiagramAgentStreamPayload,
    emit: AgentStreamEmit
  ): Promise<AgentResult>;
}

/** Optional read-only snapshot accessor used by tests and the dispatcher. */
export interface DiagramAgentServiceWithSlot extends DiagramAgentService {
  getSlot?(contentType: ContentType): DiagramState;
}
