// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StakeholderCastStrip from '../src/components/StakeholderCastStrip.jsx';

const CAST = ['refine', 'innovate', 'goMad', 'exec', 'critique', 'explain'];

describe('StakeholderCastStrip', () => {
  afterEach(() => cleanup());

  it('renders stakeholders tag and cast avatars when cast has multiple personas', () => {
    render(<StakeholderCastStrip variants={CAST} activeVariant="exec" />);
    expect(screen.getByText('Stakeholders')).toBeTruthy();
    expect(screen.getByLabelText(/The VP is one of 6 stakeholders/i)).toBeTruthy();
    expect(screen.getByTitle('THE Engineer')).toBeTruthy();
    expect(screen.getByTitle('Chief Innovation Officer')).toBeTruthy();
  });

  it('renders nothing for a single-persona cast', () => {
    const { container } = render(
      <StakeholderCastStrip variants={['exec']} activeVariant="exec" />
    );
    expect(container.querySelector('.stakeholder-cast-strip')).toBeNull();
  });

  it('calls onSelectVariant when an inactive avatar is clicked', () => {
    const onSelectVariant = vi.fn();
    render(
      <StakeholderCastStrip
        variants={CAST}
        activeVariant="exec"
        onSelectVariant={onSelectVariant}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Ask THE Engineer for commentary/i }));
    expect(onSelectVariant).toHaveBeenCalledWith('refine');
  });
});
