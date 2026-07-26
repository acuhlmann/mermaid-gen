// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdvisorSpeechBubble from '../src/components/AdvisorSpeechBubble.jsx';

describe('AdvisorSpeechBubble', () => {
  afterEach(() => cleanup());

  const baseProps = {
    persona: 'barker',
    suggestion: 'Boil this down for the board.'
  };

  it('renders the Do-it button for suggestion-kind bubbles', () => {
    render(<AdvisorSpeechBubble {...baseProps} kind="suggestion" />);
    expect(screen.getByRole('button', { name: /Apply suggestion/i })).toBeTruthy();
    expect(screen.getByText('Do it')).toBeTruthy();
  });

  it('omits the Do-it button entirely for comment-kind bubbles', () => {
    render(<AdvisorSpeechBubble {...baseProps} kind="comment" />);
    expect(screen.queryByText('Do it')).toBeNull();
    expect(screen.getByRole('button', { name: /Dismiss comment/i })).toBeTruthy();
  });

  it('fires onGo only when Do it is present and clicked', () => {
    const onGo = vi.fn();
    const onDismiss = vi.fn();
    render(
      <AdvisorSpeechBubble {...baseProps} kind="suggestion" onGo={onGo} onDismiss={onDismiss} />
    );
    fireEvent.click(screen.getByText('Do it'));
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders nothing when persona or suggestion missing', () => {
    const { container: a } = render(<AdvisorSpeechBubble suggestion="hi" />);
    expect(a.querySelector('.advisor-speech-bubble')).toBeNull();
    const { container: b } = render(<AdvisorSpeechBubble persona="barker" />);
    expect(b.querySelector('.advisor-speech-bubble')).toBeNull();
  });

  it('renders history back and prompt-next controls', () => {
    const onHistoryBack = vi.fn();
    const onPromptNext = vi.fn();
    render(
      <AdvisorSpeechBubble
        {...baseProps}
        kind="suggestion"
        showHistoryNav
        historyPositionLabel="2 of 3"
        canGoBack
        canPromptNext
        onHistoryBack={onHistoryBack}
        onPromptNext={onPromptNext}
      />
    );
    const back = screen.getByRole('button', { name: /Older suggestion/i });
    const next = screen.getByRole('button', { name: /Next teammate comment/i });
    fireEvent.click(back);
    expect(onHistoryBack).toHaveBeenCalledTimes(1);
    fireEvent.click(next);
    expect(onPromptNext).toHaveBeenCalledTimes(1);
  });

  it('disables prompt-next when canPromptNext is false', () => {
    render(<AdvisorSpeechBubble {...baseProps} canPromptNext={false} onPromptNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Next teammate comment/i }).disabled).toBe(true);
  });

  it('exposes data-kind for styling and assertions', () => {
    const { rerender } = render(<AdvisorSpeechBubble {...baseProps} kind="suggestion" />);
    expect(screen.getByTestId('advisor-speech-bubble').getAttribute('data-kind')).toBe(
      'suggestion'
    );
    rerender(<AdvisorSpeechBubble {...baseProps} kind="comment" />);
    expect(screen.getByTestId('advisor-speech-bubble').getAttribute('data-kind')).toBe('comment');
  });

  it('shows progressive Dumb it Down label for the Wise Architect', () => {
    render(
      <AdvisorSpeechBubble
        persona="explain"
        suggestion="Conway's Law in miniature."
        kind="comment"
        architectDumbLevel={2}
        onDumbDown={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Kid mode/i })).toBeTruthy();
    expect(screen.getByText(/curious 16-year-old/i)).toBeTruthy();
  });

  it('shows cast strip when multiple stakeholders are in the cast', () => {
    render(
      <AdvisorSpeechBubble
        {...baseProps}
        castVariants={['refine', 'erlich', 'barker', 'critique', 'explain', 'goMad']}
      />
    );
    expect(screen.getByText('Your Team')).toBeTruthy();
  });
});
