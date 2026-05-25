import type { ContentType, FocusNode, IntentPeerContext, LegacyPlanBeatEvent } from '@archislop/shared';
import { inferDiagramType } from './inferDiagramType.js';

const REQUEST_SNIPPET_MAX = 140;

function trimSnippet(text: unknown, max = REQUEST_SNIPPET_MAX): string {
  const t = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function extractUserRequestFromMessages(messages: unknown[]): string {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i] as {
      role?: string;
      kwargs?: { role?: string; content?: string };
      content?: string;
    };
    const role = m?.role ?? m?.kwargs?.role;
    if (role !== 'user' && role !== 'human') continue;
    const content = m?.content ?? m?.kwargs?.content;
    if (typeof content === 'string' && content.trim()) {
      const raw = content.trim();
      const userRequestIdx = raw.lastIndexOf('User request:');
      if (userRequestIdx >= 0) {
        return trimSnippet(raw.slice(userRequestIdx + 'User request:'.length));
      }
      if (raw.includes('Transform mode:')) continue;
      if (raw.includes('Repair instructions:') || raw.includes('Your previous patch failed')) continue;
      return trimSnippet(raw);
    }
  }
  return '';
}

function focusPlanBeat(focusNode: FocusNode | null | undefined): string | null {
  if (!focusNode?.id) return null;
  if (focusNode.selectionKind === 'edge' && focusNode.edgeFrom && focusNode.edgeTo) {
    const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
    return `Scoping the update to the link ${focusNode.edgeFrom} → ${focusNode.edgeTo}${label}.`;
  }
  if (focusNode.selectionKind === 'infographic-item') {
    const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
    return `Scoping the update to the selected infographic element${label}.`;
  }
  if (focusNode.selectionKind === 'metaphor-item') {
    const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
    return `Scoping the update to the selected metaphor item${label}.`;
  }
  const role = focusNode.selectionKind === 'cluster' ? 'subgraph' : 'node';
  const label = focusNode.label ? ` (“${focusNode.label}”)` : '';
  return `Scoping the update to ${role} ${focusNode.id}${label}.`;
}

type StateStoreLike = {
  getSlot?: (slot: 'mermaid') => { diagramSource?: string } | undefined;
};

function syntaxGuidancePlanBeat(stateStore: StateStoreLike | undefined, mode: string | null): string | null {
  const source = stateStore?.getSlot?.('mermaid')?.diagramSource ?? '';
  const detected = inferDiagramType(source);
  if (!detected) return null;
  if (mode === 'goMad') {
    return `Current diagram reads as ${detected} — may pivot to another type for this run.`;
  }
  if (mode === 'innovate') {
    return `Starting from a ${detected} diagram; may restructure or switch type if it clarifies the idea.`;
  }
  return `Keeping the ${detected} form and applying your request within that syntax.`;
}

function modeIntentPlanBeat(mode: string | null, requestSnippet: string): string | null {
  if (mode === 'goMad') return null;
  const req = requestSnippet ? ` — ${requestSnippet}` : '';
  switch (mode) {
    case 'refine':
      return `Polishing the diagram for clarity and structure${req}.`;
    case 'innovate':
      return `Restructuring the diagram with a bolder layout${req}.`;
    case 'exec':
      return `Simplifying to an executive-level view${req}.`;
    case 'style':
      return `Updating visual theme and styling without changing structure${req}.`;
    case 'go':
    case 'intent':
    case 'invoke':
      return requestSnippet ? `Extending the diagram: ${requestSnippet}` : 'Applying your diagram request.';
    default:
      return requestSnippet ? `Working on: ${requestSnippet}` : null;
  }
}

function peerContextPlanBeat(peerContext: IntentPeerContext | null | undefined): string | null {
  if (!peerContext?.contentType || typeof peerContext.diagramSource !== 'string') {
    return null;
  }
  const peerType = peerContext.contentType;
  if (peerType === 'infographic') {
    const lines = peerContext.diagramSource.split('\n').filter((l) => l.trim()).length;
    if (lines < 2) return 'Using the infographic slot as context for this Mermaid update.';
    return 'Cross-checking the infographic view so the Mermaid update stays aligned.';
  }
  if (peerType === 'mermaid') {
    return 'Using the Mermaid diagram as subject context for this view.';
  }
  if (peerType === 'metaphor3d') {
    return 'Using the 3D metaphor as subject context — surfacing a fresh spatial insight.';
  }
  if (peerType === 'chart') {
    return 'Using the chart as subject context — pulling the data story into this view.';
  }
  return null;
}

/** Emit early server-authored plan beats (diagram why, not tool how). */
export function emitServerMutationPlanBeats({
  emit,
  stateStore,
  mode = null,
  messages = [],
  focusNode = null,
  peerContext = null,
  contentType = 'mermaid'
}: {
  emit?: (evt: LegacyPlanBeatEvent) => void;
  stateStore: StateStoreLike;
  mode?: string | null;
  messages?: unknown[];
  focusNode?: FocusNode | null;
  peerContext?: IntentPeerContext | null;
  contentType?: ContentType;
}): void {
  if (typeof emit !== 'function') return;
  const seen = new Set<string>();
  const push = (text: string) => {
    const t = String(text ?? '').trim();
    if (!t || t.length < 8) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    emit({ type: 'plan_beat', text: t, source: 'server' });
  };

  const requestSnippet = extractUserRequestFromMessages(messages);
  const focus = focusPlanBeat(focusNode);
  if (focus) push(focus);

  if (contentType === 'mermaid') {
    const syntax = syntaxGuidancePlanBeat(stateStore, mode);
    if (syntax) push(syntax);
  }

  const peer = peerContextPlanBeat(peerContext);
  if (peer) push(peer);

  const intent = modeIntentPlanBeat(mode, requestSnippet);
  if (intent) push(intent);
}

export function emitPlanBeat(
  emit: ((evt: LegacyPlanBeatEvent) => void) | undefined,
  text: string,
  source: 'server' | 'agent' = 'server'
): void {
  if (typeof emit !== 'function') return;
  const t = String(text ?? '').trim();
  if (!t) return;
  emit({ type: 'plan_beat', text: t, source: source === 'agent' ? 'agent' : 'server' });
}
