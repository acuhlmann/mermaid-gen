import { useCallback, useEffect, useRef, useState } from 'react';
import { collapseConsecutiveApplyPatchActions } from '../../utils/collapsePatchTechnicalActions.js';
import { formatToolLabel } from '../../utils/appToolLabels.js';
import {
  coercePatchApplyDisplayStats,
  formatPatchApplyDetail
} from '../../utils/formatTechnicalActionDetail.js';
import { readStreamDebugEnabled, snapshotStreamEventForDebug } from '../../utils/appStreamDebug.js';

/**
 * Thinking-pane insight entry ledger: list state plus append/patch/technical-action helpers.
 *
 * @param {{
 *   initialEntries?: object[];
 *   workingStatusText: string;
 * }} options
 */
export function useInsightsLedger({ initialEntries = [], workingStatusText }) {
  const [insightsEntries, setInsightsEntries] = useState(() =>
    Array.isArray(initialEntries) ? initialEntries : []
  );

  const insightsEntriesRef = useRef(insightsEntries);
  useEffect(() => {
    insightsEntriesRef.current = insightsEntries;
  }, [insightsEntries]);

  const patchInsightEntry = useCallback((id, patcher) => {
    setInsightsEntries((prev) => prev.map((entry) => (entry.id === id ? patcher(entry) : entry)));
  }, []);

  const appendInsightEntry = useCallback(
    (title, variant = 'general', options = {}) => {
      const { diagramUndoBaseline, topic, retryDescriptor, contentType, modelProfile } = options;
      const id = globalThis.crypto?.randomUUID?.() ?? `ins-${Date.now()}`;
      setInsightsEntries((prev) => [
        ...prev,
        {
          id,
          title,
          variant,
          topic: topic ?? null,
          content: '',
          statusText: workingStatusText,
          status: 'running',
          technicalActions: [],
          phases: [],
          planBeats: [],
          artifacts: [],
          streamDebugLog: [],
          startedAt: Date.now(),
          completedAt: null,
          contentType: contentType ?? null,
          modelProfile: modelProfile ?? null,
          ...(retryDescriptor ? { retryDescriptor } : {}),
          ...(diagramUndoBaseline
            ? {
                diagramUndoBaseline: { ...diagramUndoBaseline },
                diagramRevisionApplied: false,
                diagramUndoConsumed: false,
                diagramAfterSource: null,
                diagramAfterContentType: null,
                diagramAfterRevisionId: null
              }
            : {})
        }
      ]);
      return id;
    },
    [workingStatusText]
  );

  const appendToInsight = useCallback(
    (id, text) => {
      patchInsightEntry(id, (entry) => ({ ...entry, content: entry.content + text }));
    },
    [patchInsightEntry]
  );

  const setInsightStatus = useCallback(
    (id, statusText) => {
      patchInsightEntry(id, (entry) => ({ ...entry, statusText }));
    },
    [patchInsightEntry]
  );

  const appendTechnicalAction = useCallback(
    (id, name, status, opts = {}) => {
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        if (status === 'done') {
          const toolCallId = opts.toolCallId;
          const actionIndex = [...current].reverse().findIndex((action) => {
            if (toolCallId && action.toolCallId === toolCallId) {
              return action.status === 'running';
            }
            if (!name) return action.status === 'running';
            return action.name === name && action.status === 'running';
          });
          if (actionIndex >= 0) {
            const realIndex = current.length - 1 - actionIndex;
            const runningAction = current[realIndex];
            const startedAt = Number.isFinite(runningAction.startedAt)
              ? runningAction.startedAt
              : Date.now();
            const durationMs = Math.max(0, Date.now() - startedAt);
            const nextActions = current.map((action, idx) =>
              idx === realIndex ? { ...action, status: 'done', durationMs } : action
            );
            return {
              ...entry,
              technicalActions: collapseConsecutiveApplyPatchActions(nextActions, formatToolLabel)
            };
          }
        }
        const actionId = globalThis.crypto?.randomUUID?.() ?? `act-${Date.now()}-${current.length}`;
        return {
          ...entry,
          technicalActions: [
            ...current,
            {
              id: actionId,
              name,
              label: formatToolLabel(name),
              status,
              startedAt: status === 'running' ? Date.now() : undefined,
              ...(opts.toolCallId ? { toolCallId: opts.toolCallId } : {}),
              ...(opts.contextNote ? { contextNote: opts.contextNote } : {}),
              ...(opts.modelName ? { modelName: opts.modelName } : {})
            }
          ]
        };
      });
    },
    [patchInsightEntry]
  );

  const enrichTechnicalActionDetail = useCallback(
    (id, name, { toolCallId, patchStats, outcomeDetail } = {}) => {
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return true;
          return action.name === name;
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const action = current[realIndex];
        const mergedStats = {
          ...(action.patchStats && typeof action.patchStats === 'object' ? action.patchStats : {}),
          ...(patchStats && typeof patchStats === 'object' ? patchStats : {})
        };
        const detail =
          (typeof outcomeDetail === 'string' && outcomeDetail.trim()) ||
          formatPatchApplyDetail(coercePatchApplyDisplayStats(mergedStats, action.durationMs));
        const nextActions = current.map((item, idx) =>
          idx === realIndex
            ? {
                ...item,
                ...(Object.keys(mergedStats).length > 0 ? { patchStats: mergedStats } : {}),
                ...(detail ? { outcomeDetail: detail } : {})
              }
            : item
        );
        return { ...entry, technicalActions: nextActions };
      });
    },
    [patchInsightEntry]
  );

  const finalizeTechnicalActionResult = useCallback(
    (id, name, { status = 'done', validationError, outcomeDetail, toolCallId } = {}) => {
      const errorText = typeof validationError === 'string' ? validationError.trim() : '';
      const detailText = typeof outcomeDetail === 'string' ? outcomeDetail.trim() : '';
      if (!errorText && !detailText && status === 'done') {
        patchInsightEntry(id, (entry) => {
          const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
          const actionIndex = [...current].reverse().findIndex((action) => {
            if (toolCallId && action.toolCallId === toolCallId) return action.status === 'running';
            return action.name === name && action.status === 'running';
          });
          if (actionIndex < 0) return entry;
          const realIndex = current.length - 1 - actionIndex;
          const nextActions = current.map((action, idx) =>
            idx === realIndex
              ? {
                  ...action,
                  status: 'done',
                  ...(Number.isFinite(action.startedAt)
                    ? { durationMs: Math.max(0, Date.now() - action.startedAt) }
                    : {})
                }
              : action
          );
          return { ...entry, technicalActions: nextActions };
        });
        return;
      }
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return action.status === 'running';
          return action.name === name && action.status === 'running';
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const nextActions = current.map((action, idx) =>
          idx === realIndex
            ? {
                ...action,
                status: status === 'rejected' ? 'rejected' : 'done',
                ...(Number.isFinite(action.startedAt)
                  ? { durationMs: Math.max(0, Date.now() - action.startedAt) }
                  : {}),
                ...(errorText ? { validationError: errorText } : {}),
                ...(detailText ? { outcomeDetail: detailText } : {})
              }
            : action
        );
        return { ...entry, technicalActions: nextActions };
      });
    },
    [patchInsightEntry]
  );

  const annotateTechnicalActionResult = useCallback(
    (id, name, { validationError, toolCallId } = {}) => {
      const errorText = typeof validationError === 'string' ? validationError.trim() : '';
      if (!errorText) return;
      patchInsightEntry(id, (entry) => {
        const current = Array.isArray(entry.technicalActions) ? entry.technicalActions : [];
        const actionIndex = [...current].reverse().findIndex((action) => {
          if (toolCallId && action.toolCallId === toolCallId) return true;
          return action.name === name;
        });
        if (actionIndex < 0) return entry;
        const realIndex = current.length - 1 - actionIndex;
        const nextActions = current.map((action, idx) =>
          idx === realIndex ? { ...action, status: 'rejected', validationError: errorText } : action
        );
        return { ...entry, technicalActions: nextActions };
      });
    },
    [patchInsightEntry]
  );

  const appendStreamDebugLog = useCallback(
    (id, evt) => {
      if (!readStreamDebugEnabled()) return;
      patchInsightEntry(id, (entry) => {
        const log = Array.isArray(entry.streamDebugLog) ? entry.streamDebugLog : [];
        const next = [...log, { ...snapshotStreamEventForDebug(evt), _ts: Date.now() }];
        return { ...entry, streamDebugLog: next.slice(-50) };
      });
    },
    [patchInsightEntry]
  );

  return {
    insightsEntries,
    setInsightsEntries,
    insightsEntriesRef,
    appendInsightEntry,
    patchInsightEntry,
    appendToInsight,
    setInsightStatus,
    appendTechnicalAction,
    enrichTechnicalActionDetail,
    finalizeTechnicalActionResult,
    annotateTechnicalActionResult,
    appendStreamDebugLog
  };
}
