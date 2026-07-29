import { enrichProposalForReview, normalizeContentType } from '@archislop/shared';
import { getActiveControlsCopy } from '../i18n/activeControlsCopy.js';
import { officeSenderInfo } from './officeCast.js';
import { partKindLabel } from './partKindLabel.js';

/** Build an insight-pane entry from a freshly-received proposal. */
export function proposalToInsightEntry(proposal) {
  const insights = getActiveControlsCopy().insights;
  return {
    id: proposal.proposalId,
    kind: 'proposal',
    variant: 'general',
    status: 'running',
    statusText: insights?.awaitingDecision ?? 'Awaiting your decision.',
    createdAt: proposal.createdAt ?? new Date().toISOString(),
    proposal,
    proposalStatus: 'pending'
  };
}

/** Enrich a proposal with the current diagram source so the review surface can diff it. */
export function enrichProposalForInsight(proposal, session, sessionId) {
  const contentType = normalizeContentType(proposal.contentType);
  const currentDiagramSource = session?.[contentType]?.diagramSource ?? '';
  return enrichProposalForReview({
    proposal,
    currentDiagramSource,
    sessionId
  });
}

/** Build an insight-pane entry for an attributed insight posted by an external agent. */
export function attributedInsightToInsightEntry(insight) {
  const insights = getActiveControlsCopy().insights;
  return {
    id: insight.insightId,
    kind: 'attributed-note',
    variant: insight.variant === 'critique' ? 'critique' : 'general',
    status: 'done',
    statusText: insights?.attributedNoteStatus ?? 'Note',
    createdAt: insight.createdAt ?? new Date().toISOString(),
    content: insight.text ?? '',
    origin: insight.origin ?? null
  };
}

/**
 * Build an insight-pane entry from WG meeting minutes (office-parody layer).
 * Reuses the attributed-note rendering path — the "external agent" here is the
 * meeting itself, so InsightsPane needs no office-specific branch.
 */
export function officeMinutesToInsightEntry({ title, minutes, completed }) {
  const actionItems = (minutes ?? [])
    .filter((beat) => beat.actionPrompt)
    .map((beat) => {
      const speaker = officeSenderInfo(beat.speakerId);
      return {
        text: beat.actionPrompt,
        speakerId: beat.speakerId,
        speakerName: speaker.name,
        context: beat.text !== beat.actionPrompt ? beat.text : undefined
      };
    });
  const items = (minutes ?? []).map((beat) => {
    const speaker = officeSenderInfo(beat.speakerId);
    const action = beat.actionPrompt ? ` — _action item:_ ${beat.actionPrompt}` : '';
    return `- ${speaker.avatarEmoji} **${speaker.name}**: ${beat.text}${action}`;
  });
  const content = [
    `**${title}**${completed ? '' : ' _(left early)_'}`,
    '',
    items.length > 0
      ? items.join('\n')
      : '_No action items. A perfect meeting, by corporate standards._'
  ].join('\n');
  return {
    id: `office-minutes-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: 'attributed-note',
    variant: 'general',
    status: 'done',
    statusText: 'Meeting minutes',
    createdAt: new Date().toISOString(),
    content,
    actionItems,
    origin: {
      kind: 'external-agent',
      agentId: 'office-meeting',
      agentName: 'WG Meeting',
      color: '#0ea5e9',
      emoji: '📅'
    }
  };
}

/** Map a diagram canvas selection node to the `focus` payload accepted by API routes. */
export function focusPayload(node) {
  if (!node?.id) return undefined;
  if (node.kind === 'edge' && node.edgeFrom && node.edgeTo) {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'edge',
      edgeFrom: node.edgeFrom,
      edgeTo: node.edgeTo,
      ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
    };
  }
  if (node.kind === 'infographic-item') {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'infographic-item',
      ...(node.indexes ? { indexes: node.indexes } : {}),
      ...(node.elementType ? { elementType: node.elementType } : {}),
      ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
    };
  }
  if (node.kind === 'metaphor-item') {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'metaphor-item'
    };
  }
  if (node.kind === 'chart-mark') {
    return {
      id: node.id,
      label: node.label,
      selectionKind: 'chart-mark',
      ...(node.indexes ? { indexes: node.indexes } : {}),
      ...(node.elementType ? { elementType: node.elementType } : {}),
      ...(node.markType ? { markType: node.markType } : {}),
      ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
    };
  }
  return {
    id: node.id,
    label: node.label,
    ...(node.kind === 'cluster' ? { selectionKind: 'cluster' } : { selectionKind: 'node' }),
    ...(node.dataId ? { dataId: node.dataId } : {}),
    ...(node.clickedLabel ? { clickedLabel: node.clickedLabel } : {})
  };
}

/** Button label for repeated Russ (streak = completed Russ count since last reset). */
export function russShapeLabel(streak) {
  if (streak <= 0) return 'Go Mad';
  if (streak === 1) return 'This Guy Ships';
  if (streak === 2) return 'Tres Commas';
  return 'Radio Silence';
}

/** Title string for a per-selection action (canvas selection `kind` or API focus `selectionKind`). */
export function selectionActionTitle(selectionLike, verbLabel) {
  if (!selectionLike) return `${verbLabel} — diagram`;
  if (selectionLike.partKind && selectionLike.partName) {
    return `${verbLabel} · ${partKindLabel(selectionLike.partKind)} · ${selectionLike.partName}`;
  }
  const edgeLike =
    selectionLike.kind === 'edge' ||
    (selectionLike.selectionKind === 'edge' && selectionLike.edgeFrom && selectionLike.edgeTo);
  if (edgeLike) {
    return `${verbLabel} — edge ${selectionLike.edgeFrom} → ${selectionLike.edgeTo}`;
  }
  const infographicLike =
    selectionLike.kind === 'infographic-item' || selectionLike.selectionKind === 'infographic-item';
  if (infographicLike) {
    const labelText = selectionLike.label || selectionLike.clickedLabel || selectionLike.id;
    const elementType = selectionLike.elementType || '';
    const noun =
      elementType === 'title'
        ? 'title'
        : elementType === 'desc'
          ? 'description'
          : elementType === 'item-desc'
            ? 'item desc'
            : elementType === 'item-value'
              ? 'item value'
              : elementType === 'item-icon' || elementType === 'item-icon-group'
                ? 'item icon'
                : 'item';
    return `${verbLabel} — ${noun} “${labelText}”`;
  }
  const metaphorLike =
    selectionLike.kind === 'metaphor-item' || selectionLike.selectionKind === 'metaphor-item';
  if (metaphorLike) {
    const labelText = selectionLike.label || selectionLike.id;
    return `${verbLabel} — item “${labelText}”`;
  }
  const chartLike =
    selectionLike.kind === 'chart-mark' || selectionLike.selectionKind === 'chart-mark';
  if (chartLike) {
    const labelText = selectionLike.label || selectionLike.clickedLabel || selectionLike.id;
    const elementType = selectionLike.elementType || '';
    const noun =
      elementType === 'title'
        ? 'title'
        : elementType === 'legend' || elementType === 'legend-label'
          ? 'legend'
          : elementType.startsWith('axis')
            ? 'axis'
            : 'mark';
    return `${verbLabel} — ${noun} “${labelText}”`;
  }
  const clusterLike = selectionLike.kind === 'cluster' || selectionLike.selectionKind === 'cluster';
  if (clusterLike) {
    return `${verbLabel} — subgraph “${selectionLike.label || selectionLike.id}”`;
  }
  return `${verbLabel} — node “${selectionLike.label || selectionLike.id}”`;
}

/** Topic descriptor (partKind+partName) extracted from a click descriptor, or null. */
export function topicFromDescriptor(descriptor) {
  if (!descriptor) return null;
  if (descriptor.partKind && descriptor.partName) {
    return { partKind: descriptor.partKind, partName: descriptor.partName };
  }
  return null;
}
