// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntryDeskPointers from '../src/components/EntryDeskPointers.jsx';

const POINTERS = [
  { id: 'work-order', label: 'Work order', text: 'Pitch your topic here.' },
  { id: 'desk', label: 'Your desk', text: 'Mail, export, settings.' },
  { id: 'team', label: 'Your Team', text: 'Colleagues live here.' },
  { id: 'format', label: 'Desk tray', text: 'Pick a slot in the tray.' }
];

describe('EntryDeskPointers', () => {
  afterEach(() => cleanup());

  it('renders only the active tour tip', () => {
    render(
      <EntryDeskPointers
        pointers={POINTERS}
        activeId="desk"
        onDismiss={vi.fn()}
        onAdvance={vi.fn()}
      />
    );
    expect(screen.getByTestId('entry-desk-pointers')).toBeTruthy();
    expect(screen.getByText('Mail, export, settings.')).toBeTruthy();
    expect(screen.queryByText('Pitch your topic here.')).toBeNull();
    expect(screen.queryByText('Pick a slot in the tray.')).toBeNull();
  });

  it('advances and dismisses from the tip actions', () => {
    const onDismiss = vi.fn();
    const onAdvance = vi.fn();
    render(
      <EntryDeskPointers
        pointers={POINTERS}
        activeId="work-order"
        eyebrow="Your desk"
        progress={{ index: 0, total: 4 }}
        onDismiss={onDismiss}
        onAdvance={onAdvance}
        nextLabel="Next"
        doneLabel="Start working"
        skipLabel="Skip tour"
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onAdvance).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing without an active tip', () => {
    const { container } = render(
      <EntryDeskPointers pointers={POINTERS} activeId={null} onDismiss={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
