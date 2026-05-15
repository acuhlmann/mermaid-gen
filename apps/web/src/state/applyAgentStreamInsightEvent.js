/**
 * Reduces post-translator legacy stream events into insights/draft/sound updates.
 * Pair with `createAgUiTranslator` + server `createAgUiEmit` when adding new wire types.
 */

import { resolveAgentStreamFailureStatus } from '../utils/agentStreamFailureStatus.js';

const AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS = 10000;
const AUTO_DIAGRAM_HIGHLIGHT_VARIANTS = new Set(['intent', 'refine', 'innovate', 'goMad']);

function normalizeInsightTextForDedup(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Token streaming already appends assistant prose; `final.message` repeats it. Skip the closing echo when redundant.
 */
function shouldAppendFinalInsightEcho(streamedText, finalMessage) {
  const msg = (finalMessage ?? '').trim();
  if (!msg) return false;
  const stream = (streamedText ?? '').trim();
  if (!stream) return true;

  const nMsg = normalizeInsightTextForDedup(msg);
  const nStream = normalizeInsightTextForDedup(stream);
  if (!nMsg) return false;
  if (nStream === nMsg) return false;
  const minSuffixLen = 64;
  if (nMsg.length >= minSuffixLen && nStream.endsWith(nMsg)) return false;
  return true;
}

/**
 * @param {{ text: string }} streamAcc Mutable `{ text }` updated on token events (for final echo dedup).
 * @param {object} ctx
 * @param {unknown} evt Legacy stream event from `createAgUiTranslator` / pass-through.
 */
export function applyAgentStreamInsightEvent(streamAcc, ctx, evt) {
  if (!evt || typeof evt !== 'object') return;

  const {
    sectionId,
    operation,
    variant,
    diagramUndoBaseline,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    lastTokenSoundAtRef,
    goMadTokenTickIndexRef,
    lastDraftTickAtRef,
    tryAgentSound,
    playGoMadTokenTick,
    playTokenTickChime,
    playToolStartChime,
    playToolEndChime,
    playDraftTick,
    playFailureChime,
    playPhaseChangePluck,
    playRefineTokenTick,
    playInnovateTokenTick,
    playCritiqueTokenTick,
    playExplainTokenTick,
    playRefinePolishLoop,
    playInnovateSynthLoop,
    playGoMadKlaxonLoop,
    playGoMadAirhornBlast,
    playCritiqueScribbleLoop,
    playCritiquePenStab,
    playExplainPageFlipLoop,
    setLiveDraftSource,
    setLiveDraftContentType,
    setGoMadStreak,
    sessionTopicRef,
    crossModeSyncRef,
    modeSwitchSync,
    modeSwitchPeerRevisionId,
    animateAcceptedSource,
    pendingAutoDiagramHighlightRef,
    pendingAutoDiagramHighlightTimeoutRef,
    triggerCompletionDelight,
    onFinal
  } = ctx;

  if (evt.type === 'phase' && evt.id && evt.label) {
    patchInsightEntry(sectionId, (entry) => {
      const previous = Array.isArray(entry.phases) ? entry.phases : [];
      return {
        ...entry,
        phases: [...previous, { id: evt.id, label: evt.label }],
        lastPhaseChangedAt: Date.now()
      };
    });
    // Skip the very first phase — feels like a redundant pluck on top of the boot stinger.
    if (typeof playPhaseChangePluck === 'function') {
      tryAgentSound(playPhaseChangePluck);
    }
    // Variant-specific phase flavor on top of the generic pluck. Some are deterministic
    // (Critique = stab on every phase, for "auditor pen tap" feel); Go Mad airhorn is
    // probability-gated to avoid audio fatigue.
    if (variant === 'critique' && typeof playCritiquePenStab === 'function') {
      tryAgentSound(playCritiquePenStab);
    } else if (variant === 'goMad') {
      if (Math.random() < 0.18 && typeof playGoMadAirhornBlast === 'function') {
        tryAgentSound(playGoMadAirhornBlast);
      } else if (typeof playGoMadKlaxonLoop === 'function') {
        tryAgentSound(playGoMadKlaxonLoop);
      }
    } else if (variant === 'innovate' && typeof playInnovateSynthLoop === 'function') {
      if (Math.random() < 0.5) tryAgentSound(playInnovateSynthLoop);
    } else if (variant === 'refine' && typeof playRefinePolishLoop === 'function') {
      if (Math.random() < 0.45) tryAgentSound(playRefinePolishLoop);
    } else if (variant === 'explain' && typeof playExplainPageFlipLoop === 'function') {
      if (Math.random() < 0.45) tryAgentSound(playExplainPageFlipLoop);
    } else if (variant === 'critique' && typeof playCritiqueScribbleLoop === 'function') {
      if (Math.random() < 0.4) tryAgentSound(playCritiqueScribbleLoop);
    }
  } else if (evt.type === 'artifact' && evt.kind === 'patch_summary') {
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      artifacts: [
        ...(Array.isArray(entry.artifacts) ? entry.artifacts : []),
        {
          kind: evt.kind,
          revisionId: evt.revisionId,
          linesAdded: evt.linesAdded,
          linesRemoved: evt.linesRemoved
        }
      ]
    }));
  } else if (evt.type === 'token' && evt.text) {
    streamAcc.text += evt.text;
    appendToInsight(sectionId, evt.text);
    const now = Date.now();
    const reduceMotion =
      typeof globalThis.matchMedia === 'function' &&
      globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const goMadDense = variant === 'goMad' && !reduceMotion;
    const minGapMs = goMadDense ? 140 : 210;
    if (now - lastTokenSoundAtRef.current >= minGapMs) {
      lastTokenSoundAtRef.current = now;
      if (goMadDense) {
        const idx = goMadTokenTickIndexRef.current;
        goMadTokenTickIndexRef.current = idx + 1;
        tryAgentSound((audioCtx) => playGoMadTokenTick(audioCtx, idx));
      } else if (variant === 'refine' && typeof playRefineTokenTick === 'function') {
        tryAgentSound(playRefineTokenTick);
      } else if (variant === 'innovate' && typeof playInnovateTokenTick === 'function') {
        const idx = goMadTokenTickIndexRef.current;
        goMadTokenTickIndexRef.current = idx + 1;
        tryAgentSound((audioCtx) => playInnovateTokenTick(audioCtx, idx));
      } else if (variant === 'critique' && typeof playCritiqueTokenTick === 'function') {
        tryAgentSound(playCritiqueTokenTick);
      } else if (variant === 'explain' && typeof playExplainTokenTick === 'function') {
        tryAgentSound(playExplainTokenTick);
      } else {
        tryAgentSound(playTokenTickChime);
      }
    }
  } else if (evt.type === 'status' && evt.text) {
    setInsightStatus(sectionId, evt.text);
  } else if (evt.type === 'tool_start' && evt.name) {
    appendTechnicalAction(sectionId, evt.name, 'running');
    tryAgentSound(playToolStartChime);
  } else if (evt.type === 'tool_end' && evt.name) {
    appendTechnicalAction(sectionId, evt.name, 'done');
    tryAgentSound(playToolEndChime);
  } else if (evt.type === 'draftPreview') {
    if (evt.contentType === 'infographic' && typeof evt.source === 'string' && evt.source) {
      setLiveDraftSource(evt.source);
      setLiveDraftContentType('infographic');
      const tickNow = Date.now();
      if (tickNow - lastDraftTickAtRef.current >= 110) {
        lastDraftTickAtRef.current = tickNow;
        tryAgentSound(playDraftTick);
      }
    }
  } else if (evt.type === 'error' && evt.message) {
    appendToInsight(sectionId, `\n\n**Error:** ${evt.message}\n\n`);
    if (evt.code !== 'no_mutation_revision') tryAgentSound(playFailureChime);
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    const failure = resolveAgentStreamFailureStatus({
      operation,
      code: evt.code,
      message: evt.message
    });
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      status: 'failed',
      statusText: failure.statusText,
      failureClass: failure.failureClass,
      failureDetail: failure.detail,
      completedAt: Date.now()
    }));
  } else if (evt.type === 'final') {
    setLiveDraftSource('');
    setLiveDraftContentType(null);
    const mutationBlocked =
      (operation === 'transform' || operation === 'intent') && evt.revisionChanged === false;
    if (variant === 'goMad' && evt.revisionChanged) {
      setGoMadStreak((s) => s + 1);
    }
    if (evt.revisionChanged && evt.state?.lastUserPrompt) {
      sessionTopicRef.current = evt.state.lastUserPrompt;
    }
    if (evt.revisionChanged && evt.state && crossModeSyncRef) {
      if (modeSwitchSync && modeSwitchPeerRevisionId != null) {
        const contentType = evt.state.contentType === 'infographic' ? 'infographic' : 'mermaid';
        const peerMode = contentType === 'mermaid' ? 'infographic' : 'mermaid';
        crossModeSyncRef.current = {
          ...crossModeSyncRef.current,
          [contentType]: {
            peerMode,
            peerRevisionId: modeSwitchPeerRevisionId,
            targetRevisionId: evt.state.revisionId ?? 0
          }
        };
      } else if (!modeSwitchSync) {
        crossModeSyncRef.current = { mermaid: null, infographic: null };
      }
    }
    if (evt.revisionChanged && evt.state) {
      const shouldAutoHighlight =
        Boolean(diagramUndoBaseline) && AUTO_DIAGRAM_HIGHLIGHT_VARIANTS.has(variant);
      animateAcceptedSource(
        evt.state,
        shouldAutoHighlight
          ? () => {
              pendingAutoDiagramHighlightRef.current = {
                entryId: sectionId,
                revisionId: evt.state.revisionId
              };
              if (typeof globalThis.window !== 'undefined') {
                if (pendingAutoDiagramHighlightTimeoutRef.current != null) {
                  globalThis.window.clearTimeout(pendingAutoDiagramHighlightTimeoutRef.current);
                }
                pendingAutoDiagramHighlightTimeoutRef.current = globalThis.window.setTimeout(() => {
                  pendingAutoDiagramHighlightTimeoutRef.current = null;
                  const stillPending = pendingAutoDiagramHighlightRef.current;
                  if (!stillPending || stillPending.entryId !== sectionId) return;
                  pendingAutoDiagramHighlightRef.current = null;
                }, AUTO_DIAGRAM_CHANGE_HIGHLIGHT_PENDING_TIMEOUT_MS);
              }
            }
          : undefined,
        { denseSteps: variant === 'goMad' }
      );
    }
    if (evt.message && operation !== 'analyze' && shouldAppendFinalInsightEcho(streamAcc.text, evt.message)) {
      appendToInsight(sectionId, `\n\n— _${evt.message}_`);
    }
    const failureStatus = mutationBlocked
      ? resolveAgentStreamFailureStatus({
          operation,
          code: 'no_mutation_revision',
          message: evt.message
        })
      : null;
    patchInsightEntry(sectionId, (entry) => ({
      ...entry,
      status: mutationBlocked ? 'failed' : 'done',
      statusText: mutationBlocked ? failureStatus.statusText : 'Done',
      ...(mutationBlocked
        ? {
            failureClass: failureStatus.failureClass,
            failureDetail: failureStatus.detail
          }
        : {}),
      completedAt: Date.now(),
      ...(evt.revisionChanged && evt.state && entry.diagramUndoBaseline
        ? {
            diagramRevisionApplied: true,
            diagramAfterSource:
              typeof evt.state.diagramSource === 'string' ? evt.state.diagramSource : null,
            diagramAfterContentType: evt.state.contentType ?? null,
            diagramAfterRevisionId: evt.state.revisionId ?? null
          }
        : {})
    }));
    if (!mutationBlocked) {
      triggerCompletionDelight(sectionId, variant);
    } else {
      tryAgentSound(playFailureChime);
    }
    if (typeof onFinal === 'function') {
      const finalText =
        streamAcc.text.trim() || (typeof evt.analyzeText === 'string' ? evt.analyzeText.trim() : '');
      if (operation === 'analyze' && variant === 'critique' && finalText) {
        patchInsightEntry(sectionId, (entry) => ({ ...entry, content: finalText }));
      }
      onFinal({ evt, finalText });
    }
  }
}
