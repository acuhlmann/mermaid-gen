import {
  applyPatch,
  createInitialSessionState,
  applyMermaidStyleDirective,
  parseMermaidStyleConfig,
  type ContentType,
  type DiagramState,
  type SessionDiagramState
} from '@archislop/shared';
import { redactSecrets } from '../utils/redactSecrets.js';
import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';
import { validateAndPrepareInfographicPatch } from '../tools/infographicDslTool.js';
import { validateAndPrepareMetaphorPatch } from '../tools/metaphorDslTool.js';
import { validateAndPrepareChartPatch } from '../tools/chartDslTool.js';
import { validateAndPrepareAnythingPatch } from '../tools/anythingHtmlTool.js';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';

const VALID_CONTENT_TYPES = new Set(['mermaid', 'infographic', 'metaphor3d', 'chart', 'anything']);

function assertContentType(contentType: string): asserts contentType is ContentType {
  if (!VALID_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unknown contentType: ${contentType}`);
  }
}


export type DiagramStateStore = ReturnType<typeof createDiagramStateStore>;

export function createDiagramStateStore(
  initialSession: SessionDiagramState = createInitialSessionState() as SessionDiagramState
) {
  let session = initialSession;
  let transformContext: { mode: string; goMadDepth?: number } | null = null;

  function replaceSlot(contentType: ContentType, nextSlot: DiagramState) {
    session = { ...session, [contentType]: nextSlot };
  }

  async function syncMermaidSlot({
    diagramSource,
    styleConfig
  }: {
    diagramSource: string;
    styleConfig?: NonNullable<DiagramState['styleConfig']>;
  }) {
    const slot = session.mermaid;
    const candidate = diagramSource?.trim();
    if (!candidate) {
      if (slot.diagramSource === '') {
        return { accepted: true, state: slot };
      }
      const next = {
        ...slot,
        revisionId: slot.revisionId + 1,
        diagramSource: '',
        updatedAt: new Date().toISOString()
      };
      replaceSlot('mermaid', next);
      return { accepted: true, state: next };
    }

    // Short-circuit: if the client is syncing the exact source we already hold (and no new
    // styleConfig is requested), skip strict JSDOM validation entirely.
    if (!styleConfig && slot.diagramSource && candidate === slot.diagramSource.trim()) {
      return { accepted: true, state: slot };
    }

    const parsedStyle = styleConfig ? { accepted: true, styleConfig } : parseMermaidStyleConfig(candidate);
    if (!parsedStyle.accepted) {
      return parsedStyle;
    }

    let styled;
    try {
      styled = applyMermaidStyleDirective({
        mermaidSource: candidate,
        styleConfig: parsedStyle.styleConfig
      });
    } catch (error) {
      return {
        accepted: false,
        error: redactSecrets(error instanceof Error ? error.message : String(error))
      };
    }

    const validation = await validateMermaidStrict(styled.mermaidSource);
    if (!validation.valid) {
      return { accepted: false, error: validation.error };
    }

    const next = {
      ...slot,
      revisionId: slot.revisionId + 1,
      diagramSource: styled.mermaidSource,
      styleConfig: styled.styleConfig,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('mermaid', next);
    return { accepted: true, state: next };
  }

  function getSlot(contentType: ContentType): DiagramState {
    assertContentType(contentType);
    return session[contentType];
  }

  async function syncInfographicSlot({ diagramSource }: { diagramSource: string }) {
    const slot = session.infographic;
    const candidate = diagramSource ?? '';
    if (!candidate.trim()) {
      if (slot.diagramSource === '') {
        return { accepted: true, state: slot };
      }
      const next = {
        ...slot,
        revisionId: slot.revisionId + 1,
        diagramSource: '',
        updatedAt: new Date().toISOString()
      };
      replaceSlot('infographic', next);
      return { accepted: true, state: next };
    }

    if (candidate === slot.diagramSource) {
      return { accepted: true, state: slot };
    }

    const prepared = await validateAndPrepareInfographicPatch({
      currentState: slot,
      proposedDiagramSource: candidate,
      reason: 'client sync'
    });
    if (!prepared.accepted) {
      return prepared;
    }

    const next = {
      ...slot,
      revisionId: slot.revisionId + 1,
      diagramSource: prepared.patch!.diagramSource,
      styleConfig: null,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('infographic', next);
    return { accepted: true, state: next };
  }

  async function applyToMermaidSlot({
    diagramSource,
    reason,
    origin
  }: {
    diagramSource: string;
    reason: string;
    origin?: DiagramState['history'][number]['origin'];
  }) {
    const slot = session.mermaid;
    const ctx = transformContext;
    const prepared = await validateAndPreparePatch({
      currentState: slot,
      proposedMermaidSource: diagramSource,
      reason,
      transformMode: ctx?.mode ?? null,
      goMadDepth: ctx?.goMadDepth ?? null
    } as Parameters<typeof validateAndPreparePatch>[0]);

    if (!prepared.accepted) {
      return prepared;
    }
    const ok = prepared as { accepted: true; patch: Parameters<typeof applyPatch>[1]; metadata?: unknown };

    const patchWithOrigin = origin ? { ...ok.patch, origin } : ok.patch;
    const applied = applyPatch(slot, patchWithOrigin);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('mermaid', applied.state!);

    return {
      accepted: true,
      patch: patchWithOrigin,
      state: applied.state,
      metadata: ok.metadata
    };
  }

  async function applyToInfographicSlot({
    diagramSource,
    reason,
    origin
  }: {
    diagramSource: string;
    reason: string;
    origin?: DiagramState['history'][number]['origin'];
  }) {
    const slot = session.infographic;
    const ctx = transformContext;
    const prepared = await validateAndPrepareInfographicPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason,
      transformMode: ctx?.mode ?? null,
      goMadDepth: ctx?.goMadDepth ?? null
    } as Parameters<typeof validateAndPrepareInfographicPatch>[0]);
    if (!prepared.accepted) {
      return prepared;
    }
    const ok = prepared as { accepted: true; patch: Parameters<typeof applyPatch>[1]; metadata?: unknown };

    const patchWithOrigin = origin ? { ...ok.patch, origin } : ok.patch;
    const applied = applyPatch(slot, patchWithOrigin);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('infographic', applied.state!);

    return {
      accepted: true,
      patch: patchWithOrigin,
      state: applied.state,
      metadata: ok.metadata
    };
  }

  async function syncMetaphorSlot({ diagramSource }: { diagramSource: string }) {
    const slot = session.metaphor3d;
    const candidate = diagramSource ?? '';
    if (!candidate.trim()) {
      if (slot.diagramSource === '') {
        return { accepted: true, state: slot };
      }
      const next = {
        ...slot,
        revisionId: slot.revisionId + 1,
        diagramSource: '',
        updatedAt: new Date().toISOString()
      };
      replaceSlot('metaphor3d', next);
      return { accepted: true, state: next };
    }

    if (candidate === slot.diagramSource) {
      return { accepted: true, state: slot };
    }

    const prepared = await validateAndPrepareMetaphorPatch({
      currentState: slot,
      proposedDiagramSource: candidate,
      reason: 'client sync'
    });
    if (!prepared.accepted) {
      return prepared;
    }

    const next = {
      ...slot,
      revisionId: slot.revisionId + 1,
      diagramSource: prepared.patch!.diagramSource,
      styleConfig: null,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('metaphor3d', next);
    return { accepted: true, state: next };
  }

  async function applyToMetaphorSlot({
    diagramSource,
    reason,
    origin
  }: {
    diagramSource: string;
    reason: string;
    origin?: DiagramState['history'][number]['origin'];
  }) {
    const slot = session.metaphor3d;
    const prepared = await validateAndPrepareMetaphorPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
    if (!prepared.accepted) {
      return prepared;
    }
    const ok = prepared as { accepted: true; patch: Parameters<typeof applyPatch>[1]; metadata?: unknown };

    const patchWithOrigin = origin ? { ...ok.patch, origin } : ok.patch;
    const applied = applyPatch(slot, patchWithOrigin);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('metaphor3d', applied.state!);

    return {
      accepted: true,
      patch: patchWithOrigin,
      state: applied.state,
      metadata: ok.metadata
    };
  }

  async function syncChartSlot({ diagramSource }: { diagramSource: string }) {
    const slot = session.chart;
    const candidate = diagramSource ?? '';
    if (!candidate.trim()) {
      if (slot.diagramSource === '') {
        return { accepted: true, state: slot };
      }
      const next = {
        ...slot,
        revisionId: slot.revisionId + 1,
        diagramSource: '',
        updatedAt: new Date().toISOString()
      };
      replaceSlot('chart', next);
      return { accepted: true, state: next };
    }

    if (candidate === slot.diagramSource) {
      return { accepted: true, state: slot };
    }

    const prepared = await validateAndPrepareChartPatch({
      currentState: slot,
      proposedDiagramSource: candidate,
      reason: 'client sync'
    });
    if (!prepared.accepted) {
      return prepared;
    }

    const next = {
      ...slot,
      revisionId: slot.revisionId + 1,
      diagramSource: prepared.patch!.diagramSource,
      styleConfig: null,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('chart', next);
    return { accepted: true, state: next };
  }

  async function applyToChartSlot({
    diagramSource,
    reason,
    origin
  }: {
    diagramSource: string;
    reason: string;
    origin?: DiagramState['history'][number]['origin'];
  }) {
    const slot = session.chart;
    const prepared = await validateAndPrepareChartPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
    if (!prepared.accepted) {
      return prepared;
    }
    const ok = prepared as { accepted: true; patch: Parameters<typeof applyPatch>[1]; metadata?: unknown };

    const patchWithOrigin = origin ? { ...ok.patch, origin } : ok.patch;
    const applied = applyPatch(slot, patchWithOrigin);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('chart', applied.state!);

    return {
      accepted: true,
      patch: patchWithOrigin,
      state: applied.state,
      metadata: ok.metadata
    };
  }

  async function syncAnythingSlot({ diagramSource }: { diagramSource: string }) {
    const slot = session.anything;
    const candidate = diagramSource ?? '';
    if (!candidate.trim()) {
      if (slot.diagramSource === '') {
        return { accepted: true, state: slot };
      }
      const next = {
        ...slot,
        revisionId: slot.revisionId + 1,
        diagramSource: '',
        updatedAt: new Date().toISOString()
      };
      replaceSlot('anything', next);
      return { accepted: true, state: next };
    }

    if (candidate === slot.diagramSource) {
      return { accepted: true, state: slot };
    }

    const prepared = await validateAndPrepareAnythingPatch({
      currentState: slot,
      proposedDiagramSource: candidate,
      reason: 'client sync',
      // The user is looking at the live document; a runtime bug in their
      // in-progress edit (or in broken source being synced for an auto-fix)
      // must not block the sync. Static shape/policy/quality checks still run.
      runtimeCheck: false
    });
    if (!prepared.accepted) {
      return prepared;
    }

    const next = {
      ...slot,
      revisionId: slot.revisionId + 1,
      diagramSource: prepared.patch!.diagramSource,
      styleConfig: null,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('anything', next);
    return { accepted: true, state: next };
  }

  async function applyToAnythingSlot({
    diagramSource,
    reason,
    origin
  }: {
    diagramSource: string;
    reason: string;
    origin?: DiagramState['history'][number]['origin'];
  }) {
    const slot = session.anything;
    const prepared = await validateAndPrepareAnythingPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
    if (!prepared.accepted) {
      return prepared;
    }
    const ok = prepared as { accepted: true; patch: Parameters<typeof applyPatch>[1]; metadata?: unknown };

    const patchWithOrigin = origin ? { ...ok.patch, origin } : ok.patch;
    const applied = applyPatch(slot, patchWithOrigin);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('anything', applied.state!);

    return {
      accepted: true,
      patch: patchWithOrigin,
      state: applied.state,
      metadata: ok.metadata
    };
  }

  return {
    /** Whole session (both slots + active pointer). */
    getSessionState() {
      return session;
    },

    /** Returns the slot matching the active content type. Convenient for handlers that already know which mode they're on. */
    getActiveSlot() {
      return session[session.activeContentType];
    },

    /** Back-compat: returns the active slot. */
    getState() {
      return session[session.activeContentType];
    },

    getActiveContentType() {
      return session.activeContentType;
    },

    setActiveContentType(contentType: ContentType) {
      assertContentType(contentType);
      if (session.activeContentType === contentType) {
        return session[contentType];
      }
      session = { ...session, activeContentType: contentType };
      return session[contentType];
    },

    getSlot(contentType: ContentType) {
      return getSlot(contentType);
    },

    setTransformContext(context: { mode: string; goMadDepth?: number } | null) {
      transformContext = context ?? null;
    },

    getTransformContext() {
      return transformContext;
    },

    clearTransformContext() {
      transformContext = null;
    },

    /** @deprecated use setTransformContext */
    setInfographicTransformContext(context: { mode: string; goMadDepth?: number } | null) {
      transformContext = context ?? null;
    },

    /** @deprecated use clearTransformContext */
    clearInfographicTransformContext() {
      transformContext = null;
    },

    async syncClientDiagramSource({
      contentType,
      diagramSource,
      styleConfig
    }: {
      contentType: ContentType;
      diagramSource: string;
      styleConfig?: NonNullable<DiagramState['styleConfig']>;
    }) {
      assertContentType(contentType);
      if (contentType === 'mermaid') {
        return syncMermaidSlot({ diagramSource, styleConfig });
      }
      if (contentType === 'metaphor3d') {
        return syncMetaphorSlot({ diagramSource });
      }
      if (contentType === 'chart') {
        return syncChartSlot({ diagramSource });
      }
      if (contentType === 'anything') {
        return syncAnythingSlot({ diagramSource });
      }
      return syncInfographicSlot({ diagramSource });
    },

    async applyDiagramSource({
      contentType,
      diagramSource,
      reason,
      origin
    }: {
      contentType: ContentType;
      diagramSource: string;
      reason: string;
      origin?: DiagramState['history'][number]['origin'];
    }) {
      assertContentType(contentType);
      if (contentType === 'mermaid') {
        return applyToMermaidSlot({ diagramSource, reason, origin });
      }
      if (contentType === 'metaphor3d') {
        return applyToMetaphorSlot({ diagramSource, reason, origin });
      }
      if (contentType === 'chart') {
        return applyToChartSlot({ diagramSource, reason, origin });
      }
      if (contentType === 'anything') {
        return applyToAnythingSlot({ diagramSource, reason, origin });
      }
      return applyToInfographicSlot({ diagramSource, reason, origin });
    },

    /**
     * Persist the user's most recent intent prompt for a slot so mode-switch can carry
     * the topic across. Blank/whitespace inputs are ignored (we don't want to clobber
     * a real topic with an empty submit).
     */
    setLastUserPrompt({ contentType, prompt }: { contentType: ContentType; prompt: string }) {
      assertContentType(contentType);
      const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
      if (!trimmed) return session[contentType];
      const slot = session[contentType];
      const next = {
        ...slot,
        lastUserPrompt: trimmed.slice(0, 4000)
      };
      replaceSlot(contentType, next);
      return next;
    },

    /**
     * Copy `lastUserPrompt` to every sibling slot (metadata only) so mode-switch topic carry-over
     * and peer-context matching work before the user visits another mode.
     */
    mirrorLastUserPromptToSibling({ contentType, prompt }: { contentType: ContentType; prompt: string }) {
      assertContentType(contentType);
      const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
      if (!trimmed) return session[contentType];
      const value = trimmed.slice(0, 4000);
      const allSlots = ['mermaid', 'infographic', 'metaphor3d'] as const;
      for (const slotKey of allSlots) {
        if (slotKey === contentType) continue;
        const siblingSlot = session[slotKey];
        replaceSlot(slotKey, { ...siblingSlot, lastUserPrompt: value });
      }
      return session[contentType];
    }
  };
}
