// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StakeholderCastStrip from '../src/components/StakeholderCastStrip.jsx';

const CAST = ['gilfoyle', 'erlich', 'russ', 'barker', 'jared', 'richard'];

describe('StakeholderCastStrip', () => {
  afterEach(() => cleanup());

  it('renders the team tag and cast avatars when cast has multiple personas', () => {
    render(<StakeholderCastStrip variants={CAST} activeVariant="barker" />);
    expect(screen.getByText('Your Team')).toBeTruthy();
    expect(screen.getByLabelText(/Jack Barker is one of 6 teammates/i)).toBeTruthy();
    expect(screen.getByTitle('Bertram Gilfoyle')).toBeTruthy();
    expect(screen.getByTitle('Erlich Bachman')).toBeTruthy();
  });

  it('renders nothing for a single-persona cast', () => {
    const { container } = render(
      <StakeholderCastStrip variants={['barker']} activeVariant="barker" />
    );
    expect(container.querySelector('.stakeholder-cast-strip')).toBeNull();
  });

  it('calls onSelectVariant when an inactive avatar is clicked', () => {
    const onSelectVariant = vi.fn();
    render(
      <StakeholderCastStrip
        variants={CAST}
        activeVariant="barker"
        onSelectVariant={onSelectVariant}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ask Bertram Gilfoyle for commentary/i }));
    expect(onSelectVariant).toHaveBeenCalledWith('gilfoyle');
  });
});
