// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AgentProposalCard from '../src/components/AgentProposalCard.jsx';

vi.mock('../src/components/InsightsEmbeddedDiagram.jsx', () => ({
  default: () => <div data-testid="embedded-diagram-mock" />
}));

describe('AgentProposalCard', () => {
  afterEach(() => cleanup());

  const proposal = {
    proposalId: 'prop-1',
    contentType: 'mermaid',
    diagramSource: 'flowchart TD\n  A --> B',
    reason: 'Improve layout',
    createdAt: new Date().toISOString(),
    origin: { kind: 'external-agent', agentName: 'Cursor', color: '#f97316' }
  };

  it('calls onOpenFullPreview without accepting', () => {
    const onOpenFullPreview = vi.fn();
    render(
      <AgentProposalCard
        proposal={proposal}
        status="pending"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenFullPreview={onOpenFullPreview}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open full preview' }));
    expect(onOpenFullPreview).toHaveBeenCalledWith({
      diagramSource: proposal.diagramSource,
      contentType: 'mermaid'
    });
  });

  it('calls onOpenFullPreview for chart proposals', () => {
    const onOpenFullPreview = vi.fn();
    const chartProposal = {
      ...proposal,
      contentType: 'chart',
      diagramSource: JSON.stringify({
        archislopVersion: 1,
        theme: 'whiteboard',
        spec: { mark: 'bar', data: { values: [{ x: 1 }] } }
      })
    };
    render(
      <AgentProposalCard
        proposal={chartProposal}
        status="pending"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenFullPreview={onOpenFullPreview}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open full preview' }));
    expect(onOpenFullPreview).toHaveBeenCalledWith({
      diagramSource: chartProposal.diagramSource,
      contentType: 'chart'
    });
  });

  it('shows an error when accept fails', async () => {
    const onAccept = vi.fn().mockRejectedValue(new Error('409 Proposal is stale'));
    render(
      <AgentProposalCard
        proposal={proposal}
        status="pending"
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Accept & apply' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('409 Proposal is stale');
  });

  it('disables Open full preview when openFullPreviewDisabled', () => {
    render(
      <AgentProposalCard
        proposal={proposal}
        status="pending"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onOpenFullPreview={vi.fn()}
        openFullPreviewDisabled
      />
    );
    expect(screen.getByRole('button', { name: 'Open full preview' }).disabled).toBe(true);
  });
});
