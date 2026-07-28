// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RunCeremonyOverlays from '../src/components/RunCeremonyOverlays.jsx';

describe('RunCeremonyOverlays', () => {
  it('hides persona ceremony chrome over Thinking unless goMad', () => {
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
        bootSeq={{ trigger: 2, variant: 'goMad' }}
        liveVariant="goMad"
        liveStreaming
        insightsOpen
      />
    );

    expect(screen.getByTestId('boot-sequence')).toBeTruthy();
    expect(screen.getByTestId('slopitect-companion')).toBeTruthy();
  });
});
