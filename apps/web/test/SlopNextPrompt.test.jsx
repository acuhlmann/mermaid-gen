// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SlopNextPrompt from '../src/components/SlopNextPrompt.jsx';

function renderPrompt(overrides = {}) {
  const onMicToggleClick = vi.fn();
  const onClose = vi.fn();
  const props = {
    layout: 'chrome',
    prompt: '',
    busy: false,
    voiceSupported: true,
    voiceListening: false,
    narrowLayout: true,
    MicIcon: () => <span>M</span>,
    MicActiveIcon: () => <span>M*</span>,
    ButtonIcon: ({ children }) => <span>{children}</span>,
    onPromptChange: vi.fn(),
    onSubmit: vi.fn(),
    onClose,
    onMicToggleClick,
    onMicPointerDown: vi.fn(),
    onMicPointerUp: vi.fn(),
    onMicLostPointerCapture: vi.fn(),
    ...overrides
  };
  const view = render(<SlopNextPrompt {...props} />);
  return { ...view, onMicToggleClick, onClose, props };
}

describe('SlopNextPrompt mobile chrome', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the close button visible on narrow chrome layout', () => {
    renderPrompt({ layout: 'chrome', narrowLayout: true });
    expect(screen.getByRole('button', { name: 'Close prompt' })).toBeTruthy();
  });

  it('shows the title on narrow radial layout', () => {
    renderPrompt({ layout: 'radial', narrowLayout: true });
    expect(screen.getByText('What should we slop next?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close prompt' })).toBeTruthy();
  });

  it('uses pointerup toggle for the mic on narrow layouts', () => {
    const { onMicToggleClick, props } = renderPrompt({ narrowLayout: true });
    const mic = screen.getByRole('button', { name: 'Tap to dictate' });
    fireEvent.pointerUp(mic);
    expect(onMicToggleClick).toHaveBeenCalledTimes(1);
    fireEvent.click(mic);
    expect(onMicToggleClick).toHaveBeenCalledTimes(1);
    expect(props.onMicPointerDown).not.toHaveBeenCalled();
  });

  it('uses hold-to-speak pointer handlers on wide layouts', () => {
    const { props } = renderPrompt({ narrowLayout: false });
    const mic = screen.getByRole('button', { name: 'Hold to speak' });
    fireEvent.pointerDown(mic);
    fireEvent.pointerUp(mic);
    expect(props.onMicPointerDown).toHaveBeenCalledTimes(1);
    expect(props.onMicPointerUp).toHaveBeenCalledTimes(1);
    expect(props.onMicToggleClick).not.toHaveBeenCalled();
  });

  it('does not scroll the page when the desk input is focused', () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const inputProto = HTMLInputElement.prototype;
    const originalScrollIntoView = inputProto.scrollIntoView;
    const originalFocus = inputProto.focus;
    inputProto.scrollIntoView = scrollIntoView;
    inputProto.focus = focus;

    renderPrompt({ layout: 'desk', narrowLayout: false });
    const input = screen.getByLabelText(/Work order/i);
    fireEvent.focus(input);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    inputProto.scrollIntoView = originalScrollIntoView;
    inputProto.focus = originalFocus;
  });
});
