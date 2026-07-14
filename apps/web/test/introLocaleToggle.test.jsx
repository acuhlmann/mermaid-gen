// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IntroLocaleToggle from '../src/components/IntroLocaleToggle.jsx';

const COPY = {
  aria: 'Interface language',
  en: 'English',
  zhCn: 'Simplified Chinese',
  zhTw: 'Traditional Chinese'
};

describe('IntroLocaleToggle', () => {
  afterEach(() => cleanup());

  it('renders compact EN / 简 / 繁 options and marks the active locale', () => {
    render(<IntroLocaleToggle locale="zh-CN" copy={COPY} onSelectLocale={vi.fn()} />);
    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' }).textContent).toBe('EN');
    expect(screen.getByRole('button', { name: 'Simplified Chinese' }).textContent).toBe('简');
    expect(screen.getByRole('button', { name: 'Traditional Chinese' }).textContent).toBe('繁');
    expect(screen.getByRole('button', { name: 'Simplified Chinese' }).className).toContain(
      'is-selected'
    );
  });

  it('fires onSelectLocale when a different option is picked', () => {
    const onSelectLocale = vi.fn();
    render(<IntroLocaleToggle locale="en" copy={COPY} onSelectLocale={onSelectLocale} />);
    fireEvent.click(screen.getByRole('button', { name: 'Traditional Chinese' }));
    expect(onSelectLocale).toHaveBeenCalledWith('zh-TW');
  });
});
