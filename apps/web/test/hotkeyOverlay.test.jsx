// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HotkeyOverlay from '../src/components/HotkeyOverlay.jsx';

describe('HotkeyOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<HotkeyOverlay open={false} onClose={vi.fn()} />);
    expect(container.querySelector('.hotkey-overlay')).toBeNull();
  });

  it('renders the shortcut list when open', () => {
    render(<HotkeyOverlay open onClose={vi.fn()} />);
    expect(screen.getByTestId('hotkey-overlay')).toBeTruthy();
    expect(screen.getByText('Keyboard shortcuts')).toBeTruthy();
    expect(screen.getByText(/Refine/i)).toBeTruthy();
    expect(screen.getByText(/Go Mad/i)).toBeTruthy();
  });

  it('Escape dismisses the overlay', () => {
    const onClose = vi.fn();
    render(<HotkeyOverlay open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop dismisses the overlay', () => {
    const onClose = vi.fn();
    render(<HotkeyOverlay open onClose={onClose} />);
    fireEvent.click(screen.getByTestId('hotkey-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the card does NOT dismiss', () => {
    const onClose = vi.fn();
    render(<HotkeyOverlay open onClose={onClose} />);
    fireEvent.click(screen.getByText('Keyboard shortcuts'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('close button dismisses', () => {
    const onClose = vi.fn();
    render(<HotkeyOverlay open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close keyboard shortcuts' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
