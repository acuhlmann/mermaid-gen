// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdvisorSpeechBubble from '../src/components/AdvisorSpeechBubble.jsx';

describe('AdvisorSpeechBubble', () => {
  afterEach(() => cleanup());

  const baseProps = {
    persona: 'exec',
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
    // The dismiss button is still present so the user can close a comment.
    expect(screen.getByRole('button', { name: /Dismiss comment/i })).toBeTruthy();
  });

  it('fires onGo only when Do it is present and clicked', () => {
    const onGo = vi.fn();
    const onDismiss = vi.fn();
    render(<AdvisorSpeechBubble {...baseProps} kind="suggestion" onGo={onGo} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Do it'));
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders nothing when persona or suggestion missing', () => {
    const { container: a } = render(<AdvisorSpeechBubble suggestion="hi" />);
    expect(a.querySelector('.advisor-speech-bubble')).toBeNull();
    const { container: b } = render(<AdvisorSpeechBubble persona="exec" />);
    expect(b.querySelector('.advisor-speech-bubble')).toBeNull();
  });

  it('exposes data-kind for styling and assertions', () => {
    const { rerender } = render(<AdvisorSpeechBubble {...baseProps} kind="suggestion" />);
    expect(screen.getByTestId('advisor-speech-bubble').getAttribute('data-kind')).toBe('suggestion');
    rerender(<AdvisorSpeechBubble {...baseProps} kind="comment" />);
    expect(screen.getByTestId('advisor-speech-bubble').getAttribute('data-kind')).toBe('comment');
  });
});
