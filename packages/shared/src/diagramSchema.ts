import { z } from 'zod';
import { DEFAULT_DIAGRAM_STYLE, DiagramStyleSchema, parseMermaidStyleConfig } from './mermaidStyle.js';

export const ContentTypeSchema = z.enum(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']);

/**
 * Coerce an unknown value to a known ContentType, defaulting to 'mermaid'. Use this in
 * defensive ternaries that previously assumed a two-value union (mermaid|infographic);
 * adding a third type without this helper silently routed the new type to mermaid.
 */
export function normalizeContentType(
  value: unknown
): 'mermaid' | 'infographic' | 'metaphor3d' | 'chart' | 'anything' {
  if (value === 'infographic') return 'infographic';
  if (value === 'metaphor3d') return 'metaphor3d';
  if (value === 'chart') return 'chart';
  if (value === 'anything') return 'anything';
  return 'mermaid';
}

/**
 * Identifies who contributed a patch / insight / reaction / presence update.
 * Defaults are `host-agent` when an internal LangChain agent applies a patch,
 * `external-agent` for MCP-connected agents, and `user` for manual edits.
 */
export const OriginSchema = z.object({
  kind: z.enum(['user', 'host-agent', 'external-agent']).default('host-agent'),
  agentId: z.string().max(64).optional(),
  agentName: z.string().max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  emoji: z.string().max(8).optional()
});

/** Optional sibling-slot source for mode-switch conversion (intent only). */
export const IntentPeerContextSchema = z.object({
  contentType: ContentTypeSchema,
  diagramSource: z.string().max(200_000)
});

export const DiagramPatchSchema = z.object({
  previousRevisionId: z.number().int().nonnegative(),
  nextRevisionId: z.number().int().positive(),
  diagramSource: z.string().min(1),
  styleConfig: DiagramStyleSchema.nullable().default(DEFAULT_DIAGRAM_STYLE),
  reason: z.string().min(1).default('Agent update'),
  contentType: ContentTypeSchema.default('mermaid'),
  origin: OriginSchema.optional()
});

export const DiagramStateSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  /** Empty canvas is valid before the first agent or manual edit. */
  diagramSource: z.string(),
  styleConfig: DiagramStyleSchema.nullable().default(DEFAULT_DIAGRAM_STYLE),
  contentType: ContentTypeSchema.default('mermaid'),
  updatedAt: z.string(),
  history: z.array(DiagramPatchSchema),
  lastUserPrompt: z.string().max(4000).nullable().optional().default(null)
});

export const SessionDiagramStateSchema = z.object({
  activeContentType: ContentTypeSchema.default('mermaid'),
  mermaid: DiagramStateSchema,
  infographic: DiagramStateSchema,
  metaphor3d: DiagramStateSchema,
  chart: DiagramStateSchema,
  anything: DiagramStateSchema
});

export const FocusNodeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().optional(),
    /** When omitted, servers treat the focus as a flowchart vertex (legacy behavior). */
    selectionKind: z
      .enum([
        'node',
        'cluster',
        'edge',
        'infographic-item',
        'infographic-region',
        'metaphor-item',
        'chart-mark'
      ])
      .optional(),
    edgeFrom: z.string().min(1).optional(),
    edgeTo: z.string().min(1).optional(),
    dataId: z.string().optional(),
    /** Text the user tapped (e.g. one line of a multi-line node label), when distinct from aggregate `label`. */
    clickedLabel: z.string().max(240).optional(),
    /** AntV `data-indexes` path for an infographic item selection (e.g. "0", "1,2"). */
    indexes: z.string().max(64).optional(),
    /** AntV `data-element-type` for the clicked sub-element (e.g. "item-label", "item-value"). */
    elementType: z.string().max(64).optional(),
    /** Vega mark type when selectionKind is chart-mark (e.g. "bar", "line"). */
    markType: z.string().max(64).optional()
  })
  .superRefine((val, ctx) => {
    if (val.selectionKind === 'edge') {
      if (!val.edgeFrom?.trim() || !val.edgeTo?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'edge focus requires edgeFrom and edgeTo',
          path: ['edgeFrom']
        });
      }
    }
  });

/** Server resolves this to an OpenRouter model id via env (OPENROUTER_MODEL_FAST / OPENROUTER_MODEL_QUALITY). */
export const ModelProfileSchema = z.enum(['fast', 'quality']);

export const IntentSettingsSchema = z
  .object({
    temperature: z.number().min(0).max(3).default(0.7),
    topP: z.number().min(0).max(1).default(1),
    maxNodes: z.number().int().min(1).max(200).default(25),
    styleGuide: z.enum(['concise', 'balanced', 'bold']).default('balanced'),
    persona: z.string().min(1).max(120).default('creative architect')
  })
  // Each field has its own default; `.default({})` tells Zod to fill them in when
  // the whole object is missing. Zod v4's TS types reject the bare `{}` literal —
  // wrap as `() => ({})` so it accepts.
  .default(() => ({}) as never);

export const TransformModeSchema = z.enum(['refine', 'innovate', 'goMad', 'exec']);

/** When set (refine|innovate|goMad|exec), intent edits follow stakeholder transform constraints. */
export const TransformPersonaSchema = TransformModeSchema;

export const DiagramIntentSchema = z
  .object({
    prompt: z.string().min(1),
    revisionId: z.number().int().nonnegative(),
    /** Empty string is allowed when starting from a cleared canvas; agent applies a full diagram patch. */
    diagramSource: z.string(),
    contentType: ContentTypeSchema.default('mermaid'),
    settings: IntentSettingsSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional(),
    peerContext: IntentPeerContextSchema.optional(),
    transformPersona: TransformPersonaSchema.optional()
  })
  .superRefine((val, ctx) => {
    if (!val.peerContext) return;
    if (val.peerContext.contentType === val.contentType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'peerContext.contentType must differ from intent contentType',
        path: ['peerContext', 'contentType']
      });
    }
  });

/** Escalation tier for repeated Go Mad transforms (1 = first click). Ignored unless mode is goMad. */
export const GoMadDepthSchema = z.number().int().min(1).max(12).optional();

export const DiagramTransformIntentSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  contentType: ContentTypeSchema.default('mermaid'),
  mode: TransformModeSchema,
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional(),
  goMadDepth: GoMadDepthSchema,
  /** Stakeholder bubble text when transform is triggered from advisor "Do it". */
  advisorPrompt: z.string().max(400).optional()
});

export const DiagramAnalyzeSchema = z.object({
  revisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  contentType: ContentTypeSchema.default('mermaid'),
  kind: z.enum(['critique', 'explain']),
  focusNode: FocusNodeSchema.optional(),
  modelProfile: ModelProfileSchema.optional(),
  /** Stakeholder bubble text when analyze is triggered from advisor accept or Drill Deeper. */
  advisorPrompt: z.string().max(400).optional()
});

/**
 * Strips invalid `transformPersona` values from intent stream payloads so a UI bug
 * cannot turn into HTTP 400 before the agent runs.
 * @param {unknown} payload
 * @returns {typeof payload}
 */
export function sanitizeAgentStreamPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as Record<string, unknown>;
  if (obj.operation !== 'intent') return payload;
  if (obj.transformPersona == null) return payload;
  const parsed = TransformPersonaSchema.safeParse(obj.transformPersona);
  if (parsed.success) return payload;
  const { transformPersona: _removed, ...rest } = obj;
  return rest;
}

export const AgentStreamPayloadSchema = z.discriminatedUnion('operation', [
  z
    .object({
      operation: z.literal('intent'),
      prompt: z.string().min(1),
      revisionId: z.number().int().nonnegative(),
      diagramSource: z.string(),
      contentType: ContentTypeSchema.default('mermaid'),
      settings: IntentSettingsSchema,
      focusNode: FocusNodeSchema.optional(),
      modelProfile: ModelProfileSchema.optional(),
      peerContext: IntentPeerContextSchema.optional(),
      transformPersona: TransformPersonaSchema.optional()
    })
    .superRefine((val, ctx) => {
      if (!val.peerContext) return;
      if (val.peerContext.contentType === val.contentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'peerContext.contentType must differ from intent contentType',
          path: ['peerContext', 'contentType']
        });
      }
    }),
  z.object({
    operation: z.literal('transform'),
    revisionId: z.number().int().nonnegative(),
    diagramSource: z.string().min(1),
    contentType: ContentTypeSchema.default('mermaid'),
    mode: TransformModeSchema,
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional(),
    goMadDepth: GoMadDepthSchema,
    advisorPrompt: z.string().max(400).optional()
  }),
  z.object({
    operation: z.literal('analyze'),
    revisionId: z.number().int().nonnegative(),
    diagramSource: z.string().min(1),
    contentType: ContentTypeSchema.default('mermaid'),
    kind: z.enum(['critique', 'explain']),
    focusNode: FocusNodeSchema.optional(),
    modelProfile: ModelProfileSchema.optional(),
    advisorPrompt: z.string().max(400).optional()
  })
]);

/** Style intents are supported by Mermaid and Chart slots. The route handler should reject
 *  contentType not in ('mermaid', 'chart'). */
export const StyleIntentSchema = DiagramIntentSchema.extend({
  stylePrompt: z.string().min(1).optional()
});

export function createInitialDiagramState(contentType = 'mermaid'): DiagramState {
  const now = new Date().toISOString();

  if (
    contentType === 'infographic' ||
    contentType === 'metaphor3d' ||
    contentType === 'chart' ||
    contentType === 'anything'
  ) {
    return {
      revisionId: 0,
      diagramSource: '',
      styleConfig: null,
      contentType,
      updatedAt: now,
      history: [],
      lastUserPrompt: null
    };
  }

  return {
    revisionId: 0,
    diagramSource: '',
    styleConfig: DEFAULT_DIAGRAM_STYLE,
    contentType: 'mermaid',
    updatedAt: now,
    history: [],
    lastUserPrompt: null
  };
}

export function createInitialSessionState() {
  return {
    activeContentType: 'mermaid',
    mermaid: createInitialDiagramState('mermaid'),
    infographic: createInitialDiagramState('infographic'),
    metaphor3d: createInitialDiagramState('metaphor3d'),
    chart: createInitialDiagramState('chart'),
    anything: createInitialDiagramState('anything')
  };
}

export function applyPatch(
  state: DiagramState,
  patch: Record<string, unknown>
): { accepted: false; error: string } | { accepted: true; state: DiagramState } {
  const parsedPatch = DiagramPatchSchema.parse(patch);

  if (parsedPatch.previousRevisionId !== state.revisionId) {
    return {
      accepted: false,
      error: `Revision mismatch. Expected ${state.revisionId}, got ${parsedPatch.previousRevisionId}.`
    };
  }

  if (parsedPatch.contentType !== state.contentType) {
    return {
      accepted: false,
      error: `Content type mismatch. Slot is ${state.contentType}, patch is ${parsedPatch.contentType}.`
    };
  }

  const nextState = {
    ...state,
    revisionId: parsedPatch.nextRevisionId,
    diagramSource: parsedPatch.diagramSource,
    styleConfig: parsedPatch.styleConfig,
    contentType: parsedPatch.contentType,
    updatedAt: new Date().toISOString(),
    history: [...state.history, parsedPatch]
  };

  return {
    accepted: true,
    state: DiagramStateSchema.parse(nextState)
  };
}

export function deriveStyleConfigFromSource(mermaidSource: string | null | undefined) {
  return parseMermaidStyleConfig(mermaidSource);
}

/** External agent's pending edit. Lives in agentProposalStore until the user accepts or rejects. */
export const AgentProposalSchema = z.object({
  proposalId: z.string().min(1),
  sessionId: z.string().min(1),
  origin: OriginSchema,
  contentType: ContentTypeSchema,
  baseRevisionId: z.number().int().nonnegative(),
  diagramSource: z.string().min(1),
  reason: z.string().min(1).max(2000),
  createdAt: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected', 'stale']).default('pending'),
  /** Optional metadata from validateAndPreparePatch (linesAdded/Removed, sanitizerApplied, …). */
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const AgentHandshakeRequestSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  proposedName: z.string().min(1).max(64),
  proposedColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  proposedEmoji: z.string().max(8).optional(),
  clientInfo: z.string().max(200).optional(),
  createdAt: z.string(),
  status: z.enum(['pending', 'approved', 'denied', 'expired']).default('pending')
});

export const AgentPresenceSchema = z.object({
  agentId: z.string().min(1),
  agentName: z.string().min(1).max(64),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  emoji: z.string().max(8).optional(),
  lastSeenAt: z.string(),
  focus: z
    .object({
      contentType: ContentTypeSchema,
      nodeId: z.string().optional(),
      label: z.string().optional()
    })
    .nullable()
    .optional()
});

export const AgentReactionSchema = z.object({
  reactionId: z.string().min(1),
  origin: OriginSchema,
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('revision'),
      contentType: ContentTypeSchema,
      revisionId: z.number().int().nonnegative()
    }),
    z.object({
      kind: z.literal('insight'),
      insightId: z.string().min(1)
    }),
    z.object({
      kind: z.literal('node'),
      contentType: ContentTypeSchema,
      nodeId: z.string().min(1)
    })
  ]),
  emoji: z.string().min(1).max(8),
  createdAt: z.string()
});

/** Attributed prose insight dropped into the InsightsPane by an external agent. */
export const AgentInsightSchema = z.object({
  insightId: z.string().min(1),
  origin: OriginSchema,
  variant: z.enum(['note', 'critique', 'suggestion']).default('note'),
  text: z.string().min(1).max(8000),
  createdAt: z.string()
});

export type ContentType = z.infer<typeof ContentTypeSchema>;
export type Origin = z.infer<typeof OriginSchema>;
export type IntentPeerContext = z.infer<typeof IntentPeerContextSchema>;
export type DiagramPatch = z.infer<typeof DiagramPatchSchema>;
export type DiagramState = z.infer<typeof DiagramStateSchema>;
export type SessionDiagramState = z.infer<typeof SessionDiagramStateSchema>;
export type FocusNode = z.infer<typeof FocusNodeSchema>;
export type ModelProfile = z.infer<typeof ModelProfileSchema>;
export type IntentSettings = z.infer<typeof IntentSettingsSchema>;
export type TransformMode = z.infer<typeof TransformModeSchema>;
export type TransformPersona = z.infer<typeof TransformPersonaSchema>;
export type DiagramIntent = z.infer<typeof DiagramIntentSchema>;
export type GoMadDepth = z.infer<typeof GoMadDepthSchema>;
export type DiagramTransformIntent = z.infer<typeof DiagramTransformIntentSchema>;
export type DiagramAnalyze = z.infer<typeof DiagramAnalyzeSchema>;
export type AgentStreamPayload = z.infer<typeof AgentStreamPayloadSchema>;
export type StyleIntent = z.infer<typeof StyleIntentSchema>;
export type AgentProposal = z.infer<typeof AgentProposalSchema>;
export type AgentHandshakeRequest = z.infer<typeof AgentHandshakeRequestSchema>;
export type AgentPresence = z.infer<typeof AgentPresenceSchema>;
export type AgentReaction = z.infer<typeof AgentReactionSchema>;
export type AgentInsight = z.infer<typeof AgentInsightSchema>;

/**
 * Envelope that LLM-tool handlers (`apply_mermaid_patch`, `apply_infographic_patch`)
 * stringify and return to the agent. Validating with this schema before serializing
 * (in `diagramTools.js`) catches drift between the state store's return shape and
 * what the agent / repair flow expects. Validating again on the consumer side
 * (`mermaidLangChainAgent.extractToolFailureError`) replaces ad-hoc JSON sniffing.
 *
 * The schema is intentionally permissive on success-side extras (`state`, `patch`,
 * `metadata`): we want to lock the `accepted` discriminator and the `error` text,
 * not freeze every nested field today.
 */
export const ToolApplyResultSchema = z.discriminatedUnion('accepted', [
  z
    .object({
      accepted: z.literal(true),
      state: z
        .object({
          revisionId: z.number().int().nonnegative()
        })
        .passthrough()
    })
    .passthrough(),
  z.object({
    accepted: z.literal(false),
    error: z.string().min(1)
  })
]);

export type ToolApplyResult = z.infer<typeof ToolApplyResultSchema>;
