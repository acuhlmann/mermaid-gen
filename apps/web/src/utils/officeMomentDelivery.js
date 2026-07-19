/**
 * Shared moment delivery for the office layer (docs/office-parody.md).
 *
 * Two producers push office moments into `officeMomentStore`: the ambience
 * director (`useOfficeAmbience`, timer-driven) and the desk verbs
 * (`useDeskActions`, user-driven). Both resolve content the same way — canned
 * bank first, one cheap LLM call for diagram-aware moments — so the logic
 * lives here rather than in either hook.
 *
 * The caller owns cadence, caps, and gating; this module owns "given a kind
 * and a context, put something on screen". Everything is passed in (memory,
 * random, counters) so it stays unit-testable with plain values.
 */

import { API_BASE_URL, SESSION_HEADER } from '../state/diagramSession.js';
import { getAdvisorVisibleLabels } from './advisorVisibleLabels.js';
import { writeOfficeCadenceMemory } from './officeAmbienceStorage.js';
import {
  fillOfficeSlots,
  MEETING_FACILITATOR,
  OFFICE_EMAIL_LLM_CAST,
  OFFICE_IM_LLM_CAST,
  OFFICE_WALKBY_LLM_CAST,
  officeBattleScenes,
  officeCoffeeScenes,
  officeDialogueLocale,
  officeEmailTemplates,
  officeImTemplates,
  officeMeetingCopy,
  officeWalkbyFallbacks,
  pickMeetingAttendees,
  pickRandomFrom,
  pickUnseenTemplate,
  seniorEmailTemplates
} from './officeCast.js';
import {
  pushOfficeBattleInvite,
  pushOfficeCoffeeInvite,
  pushOfficeEmail,
  pushOfficeImPing,
  pushOfficeMeetingInvite,
  pushOfficeWalkBy
} from '../state/officeMomentStore.js';

export const MOMENT_TIMEOUT_MS = 12_000;
export const RECENT_MOMENTS_CAP = 5;

/**
 * Read the live diagram context for slot fills and LLM prompts.
 *
 * @param {{
 *   getContentType?: () => string,
 *   getDiagramSource?: () => string,
 *   getSvgRoot?: () => ParentNode | null | undefined,
 *   getUserTitle?: () => string,
 *   getUserName?: () => string
 * }} params
 * @param {() => number} random
 */
export function readSlotContext(params, random = Math.random) {
  const contentType = params.getContentType?.() ?? 'mermaid';
  const diagramSource = params.getDiagramSource?.() ?? '';
  const svgRoot = params.getSvgRoot?.() ?? null;
  const host = svgRoot ?? (typeof document !== 'undefined' ? document : null);
  const { labels } = getAdvisorVisibleLabels({ contentType, host, diagramSource });
  return {
    contentType,
    diagramSource,
    labels,
    label: pickRandomFrom(labels, random),
    userTitle: params.getUserTitle?.() ?? '',
    userName: params.getUserName?.() ?? ''
  };
}

/**
 * Track a fired moment: bump the caller's counter, stamp the shared
 * last-fired time (so the ambient scheduler backs off after a desk verb), and
 * remember the template so it does not repeat.
 */
function markFired(memory, templateId, onFired) {
  memory.lastFiredAt = Date.now();
  if (templateId && !memory.seenTemplateIds.includes(templateId)) {
    memory.seenTemplateIds.push(templateId);
  }
  writeOfficeCadenceMemory(memory);
  onFired?.(templateId);
}

/**
 * Push a canned moment from the local banks. Zero network, works offline.
 *
 * @param {'email'|'im'|'walkby'|'coffee'|'battle'|'meeting-invite'} kind
 * @param {ReturnType<typeof readSlotContext>} ctx
 * @param {{
 *   memory: { lastFiredAt: number, seenTemplateIds: string[] },
 *   random?: () => number,
 *   senior?: boolean,
 *   autoAccept?: boolean,
 *   onRemember?: (text: string) => void,
 *   onFired?: (templateId: string | null) => void
 * }} options
 * @returns {boolean} True when something reached the screen.
 */
export function deliverCannedMoment(kind, ctx, options) {
  const { memory, random = Math.random, senior = false, onRemember, onFired } = options;
  const slots = { label: ctx.label, userTitle: ctx.userTitle, userName: ctx.userName };
  const remember = (text) => onRemember?.(String(text ?? ''));

  if (kind === 'email') {
    const bank = senior ? seniorEmailTemplates() : officeEmailTemplates();
    const template = pickUnseenTemplate(bank, memory.seenTemplateIds, random);
    if (!template) return false;
    pushOfficeEmail({
      colleagueId: template.colleagueId,
      subject: fillOfficeSlots(template.subject, slots),
      body: fillOfficeSlots(template.body, slots),
      ...(template.actionPrompt ? { actionPrompt: template.actionPrompt } : {})
    });
    remember(template.subject);
    markFired(memory, template.id, onFired);
    return true;
  }

  if (kind === 'im') {
    const template = pickUnseenTemplate(officeImTemplates(), memory.seenTemplateIds, random);
    if (!template) return false;
    pushOfficeImPing({
      colleagueId: template.colleagueId,
      body: fillOfficeSlots(template.body, slots)
    });
    remember(template.body);
    markFired(memory, template.id, onFired);
    return true;
  }

  if (kind === 'walkby') {
    const template = pickUnseenTemplate(officeWalkbyFallbacks(), memory.seenTemplateIds, random);
    if (!template) return false;
    pushOfficeWalkBy({
      colleagueId: template.colleagueId,
      body: fillOfficeSlots(template.body, slots)
    });
    remember(template.body);
    markFired(memory, template.id, onFired);
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
    remember(scene.lines[0]?.text ?? 'coffee');
    markFired(memory, scene.id, onFired);
    return true;
  }

  if (kind === 'battle') {
    const scene = pickUnseenTemplate(officeBattleScenes(), memory.seenTemplateIds, random);
    if (!scene) return false;
    const battleId = pushOfficeBattleInvite({
      topic: fillOfficeSlots(scene.topic, slots),
      lines: scene.lines.map((line) => ({
        speakerId: line.speakerId,
        text: fillOfficeSlots(line.text, slots)
      })),
      verdicts: Object.fromEntries(
        Object.entries(scene.verdicts ?? {}).map(([sideId, text]) => [
          sideId,
          fillOfficeSlots(text, slots)
        ])
      )
    });
    if (!battleId) return false;
    remember(scene.topic);
    markFired(memory, scene.id, onFired);
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
    remember(copy.inviteFallbackTitle);
    markFired(memory, null, onFired);
    return true;
  }

  return false;
}

/** Who can deliver an LLM-personalized moment of each kind (team + office only). */
export function llmColleagueFor(kind, random = Math.random) {
  if (kind === 'walkby') return pickRandomFrom(OFFICE_WALKBY_LLM_CAST, random);
  if (kind === 'email') return pickRandomFrom(OFFICE_EMAIL_LLM_CAST, random);
  return pickRandomFrom(OFFICE_IM_LLM_CAST, random);
}

/**
 * Ask the server for a diagram-aware moment and push it. Returns false on any
 * failure (timeout, non-OK, unusable payload) so the caller can fall back to
 * the canned bank — a null result is a feature, not an error.
 *
 * @returns {Promise<boolean>}
 */
export async function deliverLlmMoment(kind, ctx, options) {
  const {
    memory,
    random = Math.random,
    colleagueId = llmColleagueFor(kind, random),
    sessionId = '',
    recentMoments = [],
    onUsage,
    onRemember,
    onFired,
    onLlmSpent,
    isAlive = () => true,
    registerAbort
  } = options;
  if (!colleagueId) return false;

  const controller = new AbortController();
  registerAbort?.(controller);
  const timeoutId = setTimeout(() => controller.abort(), MOMENT_TIMEOUT_MS);
  try {
    const headers = { 'content-type': 'application/json' };
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
        recentMoments: [...recentMoments],
        uiLocale: officeDialogueLocale()
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    // A moment that lands after teardown is not a failure — don't fall back.
    if (!isAlive()) return true;
    if (!response.ok) return false;

    const payload = await response.json();
    const usage = payload?.usage;
    if (usage && typeof usage === 'object') {
      onUsage?.({
        inputTokens: Number.isFinite(Number(usage.inputTokens)) ? Number(usage.inputTokens) : 0,
        outputTokens: Number.isFinite(Number(usage.outputTokens)) ? Number(usage.outputTokens) : 0,
        model: typeof payload.model === 'string' ? payload.model : null
      });
    }
    const moment = payload?.moment;
    if (!moment || typeof moment.body !== 'string' || !moment.body.trim()) return false;

    onLlmSpent?.();
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
    onRemember?.(moment.body);
    markFired(memory, null, onFired);
    return true;
  } catch {
    clearTimeout(timeoutId);
    return false;
  } finally {
    registerAbort?.(null);
  }
}
