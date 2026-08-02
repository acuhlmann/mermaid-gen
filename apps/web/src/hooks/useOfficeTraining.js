import { useCallback, useRef, useState } from 'react';
import { OFFICE_DIAGRAM_SOURCE_MAX_CHARS, TRAINING_STEPS } from '@archislop/shared';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';
import { officeDialogueLocale } from '../utils/officeCast.js';
import { officeWireModelProfile } from '../utils/officeMomentDelivery.js';
import { getOfficeLogDigest } from '../state/officeLogStore.js';
import { OFFICE_TRAINING_LLM_CAP } from '../utils/officeCadence.js';
import { buildCannedTrainingForm } from '../utils/officeTrainingModule.js';

export const TRAINING_FETCH_TIMEOUT_MS = 30_000;

/**
 * Linda's compliance training (docs/office-parody.md §10.1).
 *
 * Three properties are load-bearing and each one is a rule from an ADR rather
 * than a preference:
 *
 * 1. **The document never reaches a diagram slot.** It lives in this hook's
 *    state and is handed to a `FormsRenderer` inside an office window. ADR-0010:
 *    the built-in cast produces no slot content. `officeTraining.test.jsx` pins
 *    it by asserting no slot mutator is ever called.
 * 2. **Nothing persists.** Closing the window discards the module — abandoning
 *    a compliance training halfway through is the single most realistic thing
 *    this feature can do, and it keeps the state model to one `useState`.
 * 3. **The LLM is optional.** A spent budget, an unconfigured server, or a
 *    document the A2UI allowlist rejects all fall through to the canned module.
 *    The user gets a less personalized joke, never an error.
 *
 * @param {{
 *   getSessionId?: () => string,
 *   getContentType?: () => string,
 *   getDiagramSource?: () => string,
 *   getSvgRoot?: () => Element | null,
 *   getUserName?: () => string,
 *   getModelProfile?: () => string,
 *   onUsage?: (usage: object) => void,
 *   onComplete?: (result: { moduleNumber: number, answers: Array<object> }) => void
 * }} params
 */
export function useOfficeTraining(params = {}) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [training, setTraining] = useState(null);
  const llmSpentRef = useRef(0);
  const abortRef = useRef(null);
  /** Bumped on open/close so a landing fetch from a closed window is dropped. */
  const generationRef = useRef(0);
  const answersRef = useRef([]);

  const trainingContext = useCallback(() => {
    const p = paramsRef.current;
    const contentType = p.getContentType?.() ?? 'mermaid';
    const rawSource = p.getDiagramSource?.() ?? '';
    const diagramSource =
      typeof rawSource === 'string' ? rawSource.slice(0, OFFICE_DIAGRAM_SOURCE_MAX_CHARS) : '';
    const svgRoot = p.getSvgRoot?.() ?? null;
    const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
    const { labels } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
    return {
      contentType,
      diagramSource,
      visibleLabels: labels,
      officeLog: getOfficeLogDigest(),
      uiLocale: officeDialogueLocale(),
      modelProfile: officeWireModelProfile(paramsRef.current.getModelProfile?.()),
      ...(p.getUserName?.() ? { userName: p.getUserName() } : {})
    };
  }, []);

  /**
   * Ask the server for a personalized form. Returns null for every failure mode
   * — including a 200 whose document the validator rejected — so the single
   * caller has one fallback path instead of four.
   */
  const fetchTrainingForm = useCallback(async (context, { step, moduleNumber, priorAnswers }) => {
    if (llmSpentRef.current >= OFFICE_TRAINING_LLM_CAP) return null;
    llmSpentRef.current += 1;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), TRAINING_FETCH_TIMEOUT_MS);
    try {
      const headers = { 'content-type': 'application/json' };
      const sessionId = paramsRef.current.getSessionId?.() ?? '';
      if (sessionId) headers[SESSION_HEADER] = sessionId;
      const response = await fetch(`${API_BASE_URL}/api/office/training`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...context, step, moduleNumber, priorAnswers }),
        signal: controller.signal
      });
      if (!response.ok) return null;
      const payload = await response.json();
      if (payload?.usage) {
        paramsRef.current.onUsage?.({
          inputTokens: Number(payload.usage.inputTokens) || 0,
          outputTokens: Number(payload.usage.outputTokens) || 0,
          model: typeof payload.model === 'string' ? payload.model : null
        });
      }
      return typeof payload?.form === 'string' && payload.form.trim() ? payload.form : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const loadStep = useCallback(
    async ({ step, moduleNumber, priorAnswers }) => {
      const generation = generationRef.current;
      const context = trainingContext();
      setTraining((prev) => (prev ? { ...prev, step, busy: true } : prev));
      const authored = await fetchTrainingForm(context, { step, moduleNumber, priorAnswers });
      if (generation !== generationRef.current) return;
      const form =
        authored ??
        buildCannedTrainingForm({
          step,
          moduleNumber,
          labels: context.visibleLabels,
          priorAnswers
        });
      setTraining((prev) =>
        prev ? { ...prev, step, form, busy: false, personalized: Boolean(authored) } : prev
      );
    },
    [fetchTrainingForm, trainingContext]
  );

  const openTraining = useCallback(
    ({ moduleNumber = 3 } = {}) => {
      generationRef.current += 1;
      answersRef.current = [];
      setTraining({ moduleNumber, step: 1, form: null, busy: true, personalized: false });
      void loadStep({ step: 1, moduleNumber, priorAnswers: [] });
    },
    [loadStep]
  );

  const closeTraining = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    answersRef.current = [];
    setTraining(null);
  }, []);

  /**
   * A Button fired. Every A2UI action collapses to this one capability, so the
   * submitted event name is flavour — the step counter decides what happens.
   */
  const submitTraining = useCallback(
    (submission) => {
      const current = training;
      if (!current || current.busy) return;
      const answers = Array.isArray(submission?.answers) ? submission.answers : [];
      answersRef.current = [...answersRef.current, ...answers];

      if (current.step >= TRAINING_STEPS) {
        const moduleNumber = current.moduleNumber;
        const collected = answersRef.current;
        generationRef.current += 1;
        abortRef.current?.abort();
        answersRef.current = [];
        setTraining(null);
        paramsRef.current.onComplete?.({ moduleNumber, answers: collected });
        return;
      }
      void loadStep({
        step: current.step + 1,
        moduleNumber: current.moduleNumber,
        priorAnswers: answers
      });
    },
    [loadStep, training]
  );

  return { training, openTraining, closeTraining, submitTraining };
}

export default useOfficeTraining;
