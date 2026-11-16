import { useCallback, useEffect, useState } from 'react';
import { emitGodAltarEvent } from './godAltarStore.js';
import {
  dispatchGodWorkflow,
  fetchGodWorkflowStatus,
  fileGodPetitionPr
} from './godPetitionClient.js';

const MAX_PRAYER_SUMMARY_CHARS = 1000;
const WORKFLOW_INITIAL_POLL_MS = 800;
const WORKFLOW_POLL_INTERVAL_MS = 6_000;

function isTerminalRunStatus(runStatus) {
  const status = runStatus?.status;
  return status === 'completed' || status === 'unconfigured' || status === 'error';
}

export function useGodPetitionFiling({
  proposal,
  messages,
  favor,
  userName,
  dispatchWorkflow,
  mountedRef,
  petitionEpochRef,
  audio,
  setError,
  setThunderSeq
}) {
  const [filing, setFiling] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [prOutcome, setPrOutcome] = useState(null);
  const [runStatus, setRunStatus] = useState(null);

  const pollRunStatus = useCallback(
    async (dispatchInfo, epoch) => {
      if (!dispatchInfo?.dispatched || !dispatchInfo.ref) return null;
      setCheckingStatus(true);
      const status = await fetchGodWorkflowStatus({
        ref: dispatchInfo.ref,
        since: dispatchInfo.dispatchedAt
      });
      if (!mountedRef.current || epoch !== petitionEpochRef.current) return null;
      setCheckingStatus(false);
      if (status) setRunStatus(status);
      return status;
    },
    [mountedRef, petitionEpochRef]
  );

  const dispatchedRef = prOutcome?.workflowDispatch?.dispatched
    ? prOutcome.workflowDispatch.ref
    : '';
  const dispatchedAt = prOutcome?.workflowDispatch?.dispatchedAt ?? '';
  const terminalStatus = isTerminalRunStatus(runStatus);

  useEffect(() => {
    if (!dispatchedRef || terminalStatus) return undefined;
    const epoch = petitionEpochRef.current;
    const info = { dispatched: true, ref: dispatchedRef, dispatchedAt };
    const initialTimer = setTimeout(() => {
      void pollRunStatus(info, epoch);
    }, WORKFLOW_INITIAL_POLL_MS);
    const interval = setInterval(() => {
      void pollRunStatus(info, epoch);
    }, WORKFLOW_POLL_INTERVAL_MS);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [dispatchedRef, dispatchedAt, terminalStatus, petitionEpochRef, pollRunStatus]);

  const handleFilePr = async () => {
    const currentProposal = proposal;
    if (!currentProposal || filing) return;
    const petitionEpoch = petitionEpochRef.current;
    const lastPrayer = (
      [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    ).slice(0, MAX_PRAYER_SUMMARY_CHARS);
    const capturedFavor = favor;
    const capturedDispatch = dispatchWorkflow;

    setFiling(true);
    setError(null);
    setRunStatus(null);
    const res = await fileGodPetitionPr({
      proposal: currentProposal,
      prayerSummary: lastPrayer,
      favor: capturedFavor,
      userName,
      dispatchWorkflow: capturedDispatch
    });
    if (!mountedRef.current || petitionEpoch !== petitionEpochRef.current) return;
    setFiling(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setThunderSeq((n) => n + 1);
    setPrOutcome(res.data);
    emitGodAltarEvent('pr_filed', 'smitten');
    audio.playCue({
      kind: 'file-pr',
      mood: 'smitten',
      hasProposal: true,
      text: res.data.divineMessage
    });
  };

  const handleManualDispatch = async () => {
    const currentOutcome = prOutcome;
    const currentProposal = proposal;
    if (!currentOutcome || dispatching) return;
    const petitionEpoch = petitionEpochRef.current;
    const targetBranch = currentOutcome.branch;
    const targetFocus = currentOutcome.workflowDispatch?.focus;

    setDispatching(true);
    setRunStatus(null);
    const res = await dispatchGodWorkflow({
      ref: targetBranch,
      focus: targetFocus,
      proposal: currentProposal
    });
    if (!mountedRef.current || petitionEpoch !== petitionEpochRef.current) return;
    setDispatching(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPrOutcome((prev) =>
      prev && prev.branch === targetBranch ? { ...prev, workflowDispatch: res.data } : prev
    );
  };

  const handleRefreshStatus = () => {
    if (!prOutcome?.workflowDispatch?.dispatched || checkingStatus) return;
    void pollRunStatus(prOutcome.workflowDispatch, petitionEpochRef.current);
  };

  const resetFiling = () => {
    setFiling(false);
    setDispatching(false);
    setCheckingStatus(false);
    setPrOutcome(null);
    setRunStatus(null);
  };

  return {
    filing,
    dispatching,
    checkingStatus,
    prOutcome,
    runStatus,
    handleFilePr,
    handleManualDispatch,
    handleRefreshStatus,
    resetFiling
  };
}
