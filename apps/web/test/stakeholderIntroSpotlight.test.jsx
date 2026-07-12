// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StakeholderIntroSpotlight from '../src/components/StakeholderIntroSpotlight.jsx';
import {
  readStakeholderIntroSeen,
  writeStakeholderIntroSeen,
  STAKEHOLDER_INTRO_SEEN_KEY
} from '../src/utils/stakeholderIntroStorage.js';

describe('StakeholderIntroSpotlight', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders eyebrow, body, and dismiss; fires onDismiss', () => {
    const onDismiss = vi.fn();
    render(
      <StakeholderIntroSpotlight
        eyebrow="👥 The roundtable has convened"
        body="A stakeholder is weighing in."
        dismissLabel="Got it"
        ariaLabel="Meet the stakeholders"
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByText('👥 The roundtable has convened')).toBeTruthy();
    expect(screen.getByText('A stakeholder is weighing in.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('stakeholderIntroStorage', () => {
  afterEach(() => window.localStorage.clear());

  it('defaults to not-seen, then persists seen', () => {
    expect(readStakeholderIntroSeen()).toBe(false);
    writeStakeholderIntroSeen();
    expect(window.localStorage.getItem(STAKEHOLDER_INTRO_SEEN_KEY)).toBe('1');
    expect(readStakeholderIntroSeen()).toBe(true);
  });
});
