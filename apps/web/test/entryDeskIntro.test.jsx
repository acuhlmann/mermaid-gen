// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntryDeskIntro from '../src/components/EntryDeskIntro.jsx';

const COPY = {
  greeting: 'Welcome, {name}',
  role: 'Architect',
  body: 'Your desk is command central on the floor.'
};

describe('EntryDeskIntro', () => {
  afterEach(() => cleanup());

  it('renders personalized greeting, role, and body copy', () => {
    render(<EntryDeskIntro copy={COPY} userName="Gavin" role="Architect" />);
    expect(screen.getByTestId('entry-desk-intro')).toBeTruthy();
    expect(screen.getByText(/Welcome, Gavin/)).toBeTruthy();
    expect(screen.getByText(/Architect/)).toBeTruthy();
    expect(screen.getByText(COPY.body)).toBeTruthy();
  });

  it('triggers onOpenGod from the Altar link on the empty desk intro', () => {
    const onOpenGod = vi.fn();
    render(<EntryDeskIntro copy={COPY} userName="Gavin" role="Architect" onOpenGod={onOpenGod} />);
    fireEvent.click(screen.getByTestId('entry-desk-god-trigger'));
    expect(onOpenGod).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when copy is missing', () => {
    const { container } = render(<EntryDeskIntro copy={null} userName="Gavin" />);
    expect(container.firstChild).toBeNull();
  });
});
