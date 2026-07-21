import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAdvisorOrchestrator } from '../../hooks/useAdvisorOrchestrator.js';
import { readAdvisorMuted } from '../../utils/advisorMuteStorage.js';
import { focusPayload } from '../../utils/appInsightHelpers.js';
import { applyDiagramHighlightToSvg } from '../../utils/applyDiagramHighlightToSvg.js';
import { buildAdvisorIntentPrompt } from '../../utils/advisorActionContext.js';
import { resolveAdvisorAcceptOperation } from '../../utils/advisorAcceptRouting.js';
import { getVariantPersona } from '../../utils/slopitectCopy.js';
import {
  readStakeholderIntroSeen,
  writeStakeholderIntroSeen
} from '../../utils/stakeholderIntroStorage.js';

/**
 * Advisor orchestrator + shell wiring: focus descriptor, bubble props, diagram
 * highlights, and first-run stakeholder intro.
 *
 * @param {{
 *   selectedNode: object | null;
 *   hoverDescriptor: object | null;
 *   stateRef: import('react').MutableRefObject<object>;
 *   contentMode: string;
 *   activeSessionId: string;
 *   advisorPause: boolean;
 *   controls: object;
 *   diagramRevisionId: number;
 *   diagramSource: string;
 *   runTransform: (variant: string, opts?: object) => void | Promise<void>;
 *   runAnalyze: (variant: string, opts?: object) => void | Promise<void>;
 *   submitIntentWithPrompt: (prompt: string, opts?: object) => void | Promise<void>;
 *   reportAdvisorUsage: (payload: object) => void;
 * }} deps
 */
export function useAdvisorShell({
  selectedNode,
  hoverDescriptor,
  stateRef,
  contentMode,
  activeSessionId,
  advisorPause,
  controls,
  diagramRevisionId,
  diagramSource,
  runTransform,
  runAnalyze,
  submitIntentWithPrompt,
  reportAdvisorUsage
}) {
  const advisorFocusDescriptor = selectedNode
    ? { ...focusPayload(selectedNode), source: 'selected' }
    : hoverDescriptor?.id
      ? { ...focusPayload(hoverDescriptor), source: 'hover' }
      : null;
  const advisorFocusKey = advisorFocusDescriptor
    ? `${advisorFocusDescriptor.source}:${advisorFocusDescriptor.id}`
    : null;

  const advisor = useAdvisorOrchestrator({
    getDiagramSource: () => stateRef.current?.diagramSource ?? '',
    getContentType: () => contentMode,
    getSessionId: () => activeSessionId,
    getFocusDescriptor: () => advisorFocusDescriptor,
    focusKey: advisorFocusKey,
    focusSource: advisorFocusDescriptor?.source ?? null,
    getSvgRoot: () => (typeof document !== 'undefined' ? document : null),
    pause: advisorPause,
    initialMuted: readAdvisorMuted(),
    onAccept: (text, persona) => {
      const hasDiagram = Boolean((stateRef.current?.diagramSource ?? '').trim());
      const operation = resolveAdvisorAcceptOperation(persona, hasDiagram);
      const advisorCtx = {
        advisorPrompt: text,
        advisorFocusDescriptor
      };
      if (operation === 'transform') {
        void runTransform(persona, { ...advisorCtx, variantOverride: persona });
        return;
      }
      if (operation === 'analyze') {
        void runAnalyze(persona, advisorCtx);
        return;
      }
      void submitIntentWithPrompt(buildAdvisorIntentPrompt(text), {
        variantOverride: persona,
        transformPersona: persona,
        ...advisorCtx
      });
    },
    onUsage: reportAdvisorUsage
  });

  const stakeholderIntroSeenRef = useRef(readStakeholderIntroSeen());
  const [stakeholderIntroActive, setStakeholderIntroActive] = useState(false);
  const stakeholderIntroTimerRef = useRef(null);

  const dismissStakeholderIntro = useCallback(() => {
    if (stakeholderIntroTimerRef.current) {
      clearTimeout(stakeholderIntroTimerRef.current);
      stakeholderIntroTimerRef.current = null;
    }
    setStakeholderIntroActive(false);
  }, []);

  useEffect(() => {
    if (stakeholderIntroSeenRef.current) return;
    if (advisor.isMuted) return;
    if (!advisor.thinkingPersona && !advisor.suggestion) return;
    stakeholderIntroSeenRef.current = true;
    writeStakeholderIntroSeen();
    setStakeholderIntroActive(true);
    stakeholderIntroTimerRef.current = setTimeout(() => {
      stakeholderIntroTimerRef.current = null;
      setStakeholderIntroActive(false);
    }, 14_000);
  }, [advisor.thinkingPersona, advisor.suggestion, advisor.isMuted]);

  useEffect(() => {
    if (advisor.isMuted && stakeholderIntroActive) dismissStakeholderIntro();
  }, [advisor.isMuted, stakeholderIntroActive, dismissStakeholderIntro]);

  useEffect(
    () => () => {
      if (stakeholderIntroTimerRef.current) clearTimeout(stakeholderIntroTimerRef.current);
    },
    []
  );

  const stakeholderIntroProps = stakeholderIntroActive
    ? {
        eyebrow: controls.stakeholders.introEyebrow,
        body: controls.stakeholders.introBody,
        dismissLabel: controls.stakeholders.introDismiss,
        ariaLabel: controls.stakeholders.introAria,
        onDismiss: dismissStakeholderIntro
      }
    : null;

  const advisorBubbleProps = useMemo(() => {
    if (!advisor.suggestion) return null;
    return {
      persona: advisor.activePersona ?? advisor.thinkingPersona,
      suggestion: advisor.suggestion,
      kind: advisor.suggestionKind,
      isPinned: advisor.isPinned,
      isDumbingDown: advisor.isDumbingDown,
      architectDumbLevel: advisor.architectDumbLevel,
      onGo: advisor.accept,
      onDismiss: advisor.dismiss,
      onTogglePin: advisor.togglePin,
      onPauseTimer: advisor.pauseTimer,
      onResumeTimer: advisor.resumeTimer,
      onDumbDown: advisor.dumbDown,
      onDrillDeeper: () => {
        const suggestion = advisor.suggestion;
        advisor.dismiss();
        void runAnalyze('explain', {
          advisorPrompt: suggestion ?? '',
          advisorFocusDescriptor
        });
      },
      showHistoryNav: advisor.showHistoryNav,
      canGoBack: advisor.canGoBack,
      canPromptNext: advisor.canPromptNext,
      historyPositionLabel: advisor.historyPositionLabel,
      onHistoryBack: advisor.goBack,
      onPromptNext: () => advisor.promptNext(),
      onSelectVariant: (variant) => advisor.promptNext({ persona: variant }),
      castDisabled: false
    };
  }, [advisor, advisorFocusDescriptor, runAnalyze]);

  const advisorDiagramHighlight = useMemo(() => {
    const ids = advisor.highlightIds ?? [];
    const active =
      ids.length > 0 && Boolean(advisor.suggestion || advisor.isPinned || advisor.thinkingPersona);
    return active ? { addedIds: ids } : null;
  }, [advisor.highlightIds, advisor.isPinned, advisor.suggestion, advisor.thinkingPersona]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.querySelector('.diagram-zoom-layer') ?? document;
    const diagramOutput = document.querySelector('.diagram-output');
    const accentPersona = advisor.activePersona ?? advisor.thinkingPersona;
    const accentMeta = accentPersona ? getVariantPersona(accentPersona) : null;
    const accentVar = accentMeta?.accentColorVar;
    if (diagramOutput) {
      if (advisorDiagramHighlight && accentVar) {
        const resolved = accentVar.startsWith('--') ? `var(${accentVar})` : accentVar;
        diagramOutput.style.setProperty('--advisor-highlight-accent', resolved);
        diagramOutput.classList.toggle('has-advisor-highlight', true);
        diagramOutput.classList.toggle('has-advisor-highlight-pinned', advisor.isPinned);
      } else {
        diagramOutput.style.removeProperty('--advisor-highlight-accent');
        diagramOutput.classList.remove('has-advisor-highlight', 'has-advisor-highlight-pinned');
      }
    }
    applyDiagramHighlightToSvg(root, advisorDiagramHighlight, {
      addedClass: 'is-advisor-pointing',
      modifiedClass: 'is-advisor-pointing'
    });
    return () => {
      applyDiagramHighlightToSvg(root, null, {
        addedClass: 'is-advisor-pointing',
        modifiedClass: 'is-advisor-pointing'
      });
      if (diagramOutput) {
        diagramOutput.style.removeProperty('--advisor-highlight-accent');
        diagramOutput.classList.remove('has-advisor-highlight', 'has-advisor-highlight-pinned');
      }
    };
  }, [
    advisor.activePersona,
    advisor.isPinned,
    advisor.thinkingPersona,
    advisorDiagramHighlight,
    diagramRevisionId,
    diagramSource
  ]);

  return {
    advisor,
    advisorFocusDescriptor,
    advisorBubbleProps,
    advisorDiagramHighlight,
    stakeholderIntroProps
  };
}
