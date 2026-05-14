import {
  applyPatch,
  createInitialSessionState,
  applyMermaidStyleDirective,
  parseMermaidStyleConfig
} from '@archislop/shared';
import { redactSecrets } from '../utils/redactSecrets.js';
import { validateAndPreparePatch } from '../tools/mermaidDiffTool.js';
import { validateAndPrepareInfographicPatch } from '../tools/infographicDslTool.js';
import { validateMermaidStrict } from '../agents/mermaidReliabilitySkill.js';

const VALID_CONTENT_TYPES = new Set(['mermaid', 'infographic']);

function assertContentType(contentType) {
  if (!VALID_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unknown contentType: ${contentType}`);
  }
}

export function createDiagramStateStore(initialSession = createInitialSessionState()) {
  let session = initialSession;

  function getSlot(contentType) {
    assertContentType(contentType);
    return session[contentType];
  }

  function replaceSlot(contentType, nextSlot) {
    session = { ...session, [contentType]: nextSlot };
  }

  async function syncMermaidSlot({ diagramSource, styleConfig }) {
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

  async function syncInfographicSlot({ diagramSource }) {
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
      diagramSource: prepared.patch.diagramSource,
      styleConfig: null,
      updatedAt: new Date().toISOString()
    };
    replaceSlot('infographic', next);
    return { accepted: true, state: next };
  }

  async function applyToMermaidSlot({ diagramSource, reason }) {
    const slot = session.mermaid;
    const prepared = await validateAndPreparePatch({
      currentState: slot,
      proposedMermaidSource: diagramSource,
      reason
    });

    if (!prepared.accepted) {
      return prepared;
    }

    const applied = applyPatch(slot, prepared.patch);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('mermaid', applied.state);

    return {
      accepted: true,
      patch: prepared.patch,
      state: applied.state,
      metadata: prepared.metadata
    };
  }

  async function applyToInfographicSlot({ diagramSource, reason }) {
    const slot = session.infographic;
    const prepared = await validateAndPrepareInfographicPatch({
      currentState: slot,
      proposedDiagramSource: diagramSource,
      reason
    });
    if (!prepared.accepted) {
      return prepared;
    }

    const applied = applyPatch(slot, prepared.patch);
    if (!applied.accepted) {
      return applied;
    }
    replaceSlot('infographic', applied.state);

    return {
      accepted: true,
      patch: prepared.patch,
      state: applied.state,
      metadata: prepared.metadata
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

    setActiveContentType(contentType) {
      assertContentType(contentType);
      if (session.activeContentType === contentType) {
        return session[contentType];
      }
      session = { ...session, activeContentType: contentType };
      return session[contentType];
    },

    getSlot(contentType) {
      return getSlot(contentType);
    },

    async syncClientDiagramSource({ contentType, diagramSource, styleConfig }) {
      assertContentType(contentType);
      if (contentType === 'mermaid') {
        return syncMermaidSlot({ diagramSource, styleConfig });
      }
      return syncInfographicSlot({ diagramSource });
    },

    async applyDiagramSource({ contentType, diagramSource, reason }) {
      assertContentType(contentType);
      if (contentType === 'mermaid') {
        return applyToMermaidSlot({ diagramSource, reason });
      }
      return applyToInfographicSlot({ diagramSource, reason });
    },

    /**
     * Persist the user's most recent intent prompt for a slot so mode-switch can carry
     * the topic across. Blank/whitespace inputs are ignored (we don't want to clobber
     * a real topic with an empty submit).
     */
    setLastUserPrompt({ contentType, prompt }) {
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
    }
  };
}
