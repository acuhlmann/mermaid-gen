// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RunCeremonyOverlays from '../src/components/RunCeremonyOverlays.jsx';

describe('RunCeremonyOverlays', () => {
  it('hides persona ceremony chrome over Thinking when the notebook is open', () => {
    const { rerender } = render(
      <RunCeremonyOverlays
        anchor="insights"
        bootSeq={{ trigger: 1, variant: 'jared' }}
        liveVariant="jared"
        liveStreaming
        insightsOpen
      />
    );

    expect(screen.queryByTestId('boot-sequence')).toBeNull();
    expect(screen.queryByTestId('slopitect-companion')).toBeNull();

    rerender(
      <RunCeremonyOverlays
        anchor="insights"
        bootSeq={{ trigger: 2, variant: 'russ' }}
        liveVariant="russ"
        liveStreaming
        insightsOpen
      />
    );

    expect(screen.queryByTestId('boot-sequence')).toBeNull();
    expect(screen.queryByTestId('slopitect-companion')).toBeNull();
  });
});
