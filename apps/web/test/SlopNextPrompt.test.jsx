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

  it('shows the scoped title on narrow radial layout', () => {
    renderPrompt({ layout: 'radial', narrowLayout: true });
    expect(screen.getByText('Edit this selection')).toBeTruthy();
    expect(screen.getByText(/Only this part changes/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Close prompt' })).toBeTruthy();
  });

  it('names the selected part in the radial title when provided', () => {
    renderPrompt({ layout: 'radial', narrowLayout: true, selectionName: 'Auth Service' });
    expect(screen.getByText('Edit “Auth Service”')).toBeTruthy();
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

  it('shows the mic on desk even when the work order is empty and unfocused', () => {
    renderPrompt({ layout: 'desk', narrowLayout: true, prompt: '' });
    const panel = screen.getByTestId('slop-prompt-panel-desk');
    expect(panel.className).toContain('is-desk-idle');
    expect(screen.getByRole('button', { name: 'Tap to dictate' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '>' })).toBeNull();
  });

  it('shows the microphone when the empty work order is focused on mobile', () => {
    renderPrompt({ layout: 'desk', narrowLayout: true, prompt: '' });
    const input = screen.getByLabelText(/Work order/i);
    fireEvent.focus(input);
    const panel = screen.getByTestId('slop-prompt-panel-desk');
    expect(panel.className).not.toContain('is-desk-idle');
    expect(screen.getByRole('button', { name: 'Tap to dictate' })).toBeTruthy();
    // Save space for the placeholder — no eyebrow or primary until there is text.
    expect(panel.querySelector('.slop-prompt-panel-eyebrow--desk')).toBeNull();
    expect(screen.queryByRole('button', { name: /Do it/i })).toBeNull();
  });

  it('shows eyebrow and primary once the user starts typing on mobile', () => {
    renderPrompt({
      layout: 'desk',
      narrowLayout: true,
      prompt: 'OAuth flow',
      PromptIcon: () => <span>P</span>
    });
    const panel = screen.getByTestId('slop-prompt-panel-desk');
    expect(panel.className).not.toContain('is-desk-idle');
    expect(panel.querySelector('.slop-prompt-panel-eyebrow--desk')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tap to dictate' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
  });

  it('shows desk chrome on wide layouts when the empty work order is focused', () => {
    renderPrompt({
      layout: 'desk',
      narrowLayout: false,
      prompt: '',
      PromptIcon: () => <span>P</span>
    });
    fireEvent.focus(screen.getByLabelText(/Work order/i));
    const panel = screen.getByTestId('slop-prompt-panel-desk');
    expect(panel.querySelector('.slop-prompt-panel-eyebrow--desk')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hold to speak' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Do it/i })).toBeTruthy();
  });

  it('enables mobile keyboard suggestions on the desk work order input', () => {
    renderPrompt({ layout: 'desk', narrowLayout: true, prompt: 'OAuth flow' });
    const input = screen.getByLabelText(/Work order/i);
    expect(input.getAttribute('autocomplete')).toBe('on');
    expect(input.getAttribute('autocorrect')).toBe('on');
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.getAttribute('spellcheck')).not.toBe('false');
    expect(input.getAttribute('name')).toBe('work-order');
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
