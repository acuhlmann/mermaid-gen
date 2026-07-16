import { useEffect, useRef } from 'react';
import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from '../utils/advisorVisibleLabels.js';
import { pickNextMoment } from '../utils/officeCadence.js';
import {
  readOfficeCadenceMemory,
  writeOfficeCadenceMemory
} from '../utils/officeAmbienceStorage.js';
import {
  fillOfficeSlots,
  MEETING_FACILITATOR,
  OFFICE_EMAIL_LLM_CAST,
  OFFICE_IM_LLM_CAST,
  OFFICE_WALKBY_LLM_CAST,
  officeCoffeeScenes,
  officeEmailTemplates,
  officeImTemplates,
  officeMeetingCopy,
  officeWalkbyFallbacks,
  pickMeetingAttendees,
  pickRandomFrom,
  pickUnseenTemplate
} from '../utils/officeCast.js';
import {
  getOfficeSnapshot,
  hasActiveOfficeSurface,
  pushOfficeCoffeeInvite,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeMeetingInvite,
  pushOfficeWalkBy
} from '../state/officeMomentStore.js';

export const OFFICE_TICK_MS = 15_000;
const MOMENT_TIMEOUT_MS = 12_000;
const FAILURE_BACKOFF_MS = 30_000;
const RECENT_MOMENTS_CAP = 5;

function isHidden() {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * The office ambience director (docs/office-parody.md). A client-side ticker —
 * same architecture as useAdvisorOrchestrator — that asks the pure cadence
 * brain when to fire, resolves moment content (canned bank, or one cheap LLM
 * call for diagram-aware moments), and pushes results into officeMomentStore
 * for the OfficeLayer chrome to render.
 *
 * Never interrupts: paused while an agent run streams (`pause`), while the
 * stakeholder advisor bubble is up (`advisorBusy`), during a meeting, while
 * any office surface is already on screen, when the tab is hidden, and during
 * Focus Time. LLM failures back off and fall back to canned content.
 *
 * @param {{
 *   pause: boolean,
 *   advisorBusy: boolean,
 *   meetingActive: boolean,
 *   getDiagramSource: () => string,
 *   getContentType: () => string,
 *   getSessionId: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   getUserTitle?: () => string,
 *   onUsage?: (usage: { inputTokens: number, outputTokens: number, model: string | null }) => void,
 *   random?: () => number
 * }} params
 */
export function useOfficeAmbience(params) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let abortController = null;
    let failureUntil = 0;
    const sessionStartedAt = Date.now();
    const counters = { momentCount: 0, llmMomentCount: 0, meetingInviteCount: 0 };
    const memory = readOfficeCadenceMemory();
    /** @type {string[]} */
    const recentMoments = [];

    const random = () => (paramsRef.current.random ?? Math.random)();

    const rememberMoment = (text) => {
      recentMoments.push(String(text).slice(0, 200));
      if (recentMoments.length > RECENT_MOMENTS_CAP) recentMoments.shift();
    };

    const markFired = (templateId) => {
      counters.momentCount += 1;
      memory.lastFiredAt = Date.now();
      if (templateId && !memory.seenTemplateIds.includes(templateId)) {
        memory.seenTemplateIds.push(templateId);
      }
      writeOfficeCadenceMemory(memory);
    };

    const slotContext = () => {
      const p = paramsRef.current;
      const contentType = p.getContentType?.() ?? 'mermaid';
      const diagramSource = p.getDiagramSource?.() ?? '';
      const svgRoot = p.getSvgRoot?.() ?? null;
      const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
      const { labels } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
      return {
        contentType,
        diagramSource,
        labels,
        label: pickRandomFrom(labels, random),
        userTitle: p.getUserTitle?.() ?? ''
      };
    };

    const deliverCanned = (kind, ctx) => {
      const slots = { label: ctx.label, userTitle: ctx.userTitle };
      if (kind === 'email') {
        const template = pickUnseenTemplate(officeEmailTemplates(), memory.seenTemplateIds, random);
        if (!template) return false;
        pushOfficeEmail({
          colleagueId: template.colleagueId,
          subject: fillOfficeSlots(template.subject, slots),
          body: fillOfficeSlots(template.body, slots),
          ...(template.actionPrompt ? { actionPrompt: template.actionPrompt } : {})
        });
        rememberMoment(template.subject);
        markFired(template.id);
        return true;
      }
      if (kind === 'im') {
        const template = pickUnseenTemplate(officeImTemplates(), memory.seenTemplateIds, random);
        if (!template) return false;
        pushOfficeImPing({
          colleagueId: template.colleagueId,
          body: fillOfficeSlots(template.body, slots)
        });
        rememberMoment(template.body);
        markFired(template.id);
        return true;
      }
      if (kind === 'walkby') {
        const template = pickUnseenTemplate(
          officeWalkbyFallbacks(),
          memory.seenTemplateIds,
          random
        );
        if (!template) return false;
        pushOfficeWalkBy({
          colleagueId: template.colleagueId,
          body: fillOfficeSlots(template.body, slots)
        });
        rememberMoment(template.body);
        markFired(template.id);
        return true;
      }
      if (kind === 'coffee') {
        const scene = pickUnseenTemplate(officeCoffeeScenes(), memory.seenTemplateIds, random);
        if (!scene) return false;
        pushOfficeCoffeeInvite({
          lines: scene.lines.map((line) => ({
            speakerId: line.speakerId,
            text: fillOfficeSlots(line.text, slots)
          }))
        });
        rememberMoment(scene.lines[0]?.text ?? 'coffee');
        markFired(scene.id);
        return true;
      }
      if (kind === 'meeting-invite') {
        const copy = officeMeetingCopy();
        pushOfficeMeetingInvite({
          colleagueId: MEETING_FACILITATOR,
          title: copy.inviteFallbackTitle,
          body: copy.inviteFallbackBody,
          attendees: pickMeetingAttendees(random)
        });
        rememberMoment(copy.inviteFallbackTitle);
        counters.meetingInviteCount += 1;
        markFired(null);
        return true;
      }
      return false;
    };

    const llmColleagueFor = (kind) => {
      if (kind === 'walkby') return pickRandomFrom(OFFICE_WALKBY_LLM_CAST, random);
      if (kind === 'email') return pickRandomFrom(OFFICE_EMAIL_LLM_CAST, random);
      return pickRandomFrom(OFFICE_IM_LLM_CAST, random);
    };

    const deliverLlm = async (kind, ctx) => {
      const p = paramsRef.current;
      const colleagueId = llmColleagueFor(kind);
      if (!colleagueId) return false;
      const controller = new AbortController();
      abortController = controller;
      const timeoutId = setTimeout(() => controller.abort(), MOMENT_TIMEOUT_MS);
      try {
        const headers = { 'content-type': 'application/json' };
        const sessionId = p.getSessionId?.() ?? '';
        if (sessionId) headers[SESSION_HEADER] = sessionId;
        const response = await fetch(`${API_BASE_URL}/api/office/moment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            kind,
            colleagueId,
            contentType: ctx.contentType,
            diagramSource: ctx.diagramSource,
            visibleLabels: ctx.labels,
            recentMoments: [...recentMoments]
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!alive) return true;
        if (!response.ok) return false;
        const payload = await response.json();
        const usage = payload?.usage;
        if (usage && typeof usage === 'object') {
          p.onUsage?.({
            inputTokens: Number.isFinite(Number(usage.inputTokens)) ? Number(usage.inputTokens) : 0,
            outputTokens: Number.isFinite(Number(usage.outputTokens))
              ? Number(usage.outputTokens)
              : 0,
            model: typeof payload.model === 'string' ? payload.model : null
          });
        }
        const moment = payload?.moment;
        if (!moment || typeof moment.body !== 'string' || !moment.body.trim()) return false;
        counters.llmMomentCount += 1;
        if (kind === 'email') {
          pushOfficeEmail({
            colleagueId,
            subject: moment.subject || '(no subject)',
            body: moment.body,
            ...(moment.actionPrompt ? { actionPrompt: moment.actionPrompt } : {})
          });
        } else if (kind === 'walkby') {
          pushOfficeWalkBy({
            colleagueId,
            body: moment.body,
            ...(moment.actionPrompt ? { actionPrompt: moment.actionPrompt } : {})
          });
        } else {
          pushOfficeImPing({ colleagueId, body: moment.body });
        }
        rememberMoment(moment.body);
        markFired(null);
        return true;
      } catch {
        clearTimeout(timeoutId);
        return false;
      } finally {
        if (abortController === controller) abortController = null;
      }
    };

    const shouldHoldFire = () => {
      const p = paramsRef.current;
      if (p.pause || p.advisorBusy || p.meetingActive) return true;
      if (isHidden()) return true;
      if (getOfficeSnapshot().focusTime) return true;
      if (hasActiveOfficeSurface()) return true;
      if (Date.now() < failureUntil) return true;
      return false;
    };

    const tick = async () => {
      if (!alive || inFlight || shouldHoldFire()) return;
      const diagramSource = paramsRef.current.getDiagramSource?.() ?? '';
      const moment = pickNextMoment({
        now: Date.now(),
        sessionStartedAt,
        lastFiredAt: memory.lastFiredAt,
        momentCount: counters.momentCount,
        llmMomentCount: counters.llmMomentCount,
        meetingInviteCount: counters.meetingInviteCount,
        hasDiagram: Boolean(diagramSource.trim()),
        random
      });
      if (!moment) return;
      inFlight = true;
      try {
        const ctx = slotContext();
        if (moment.useLlm) {
          const delivered = await deliverLlm(moment.kind, ctx);
          if (!alive) return;
          if (!delivered) {
            failureUntil = Date.now() + FAILURE_BACKOFF_MS;
            deliverCanned(moment.kind, ctx);
          }
        } else {
          deliverCanned(moment.kind, ctx);
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, OFFICE_TICK_MS);

    return () => {
      alive = false;
      clearInterval(interval);
      abortController?.abort();
    };
  }, []);
}
