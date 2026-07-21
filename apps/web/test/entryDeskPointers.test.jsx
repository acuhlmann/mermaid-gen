// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntryDeskPointers from '../src/components/EntryDeskPointers.jsx';

const POINTERS = [
  { id: 'work-order', label: 'Work order', text: 'Pitch your topic here.' },
  { id: 'desk', label: 'Your desk', text: 'Mail, export, settings.' },
  { id: 'format', label: 'Deliverable format', text: 'Pick a slot first.' }
];

describe('EntryDeskPointers', () => {
  afterEach(() => cleanup());

  it('renders the pointer callouts', () => {
    render(<EntryDeskPointers pointers={POINTERS} onDismiss={vi.fn()} />);
    expect(screen.getByTestId('entry-desk-pointers')).toBeTruthy();
    expect(screen.getByText('Pitch your topic here.')).toBeTruthy();
    expect(screen.getByText('Mail, export, settings.')).toBeTruthy();
    expect(screen.getByText('Pick a slot first.')).toBeTruthy();
  });

  it('dismisses on first pointer interaction', () => {
    const onDismiss = vi.fn();
    render(<EntryDeskPointers pointers={POINTERS} onDismiss={onDismiss} autoDismissMs={0} />);
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when pointers are empty', () => {
    const { container } = render(<EntryDeskPointers pointers={[]} onDismiss={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
