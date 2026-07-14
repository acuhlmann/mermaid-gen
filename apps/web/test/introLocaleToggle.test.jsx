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

  it('shows only the active locale until expanded', () => {
    render(<IntroLocaleToggle locale="zh-CN" copy={COPY} onSelectLocale={vi.fn()} />);
    expect(screen.getByTestId('intro-locale-toggle')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Interface language' }).textContent).toContain('简');
    expect(screen.queryByRole('option', { name: 'English' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'Traditional Chinese' })).toBeNull();
  });

  it('expands alternate locales and fires onSelectLocale', () => {
    const onSelectLocale = vi.fn();
    render(<IntroLocaleToggle locale="en" copy={COPY} onSelectLocale={onSelectLocale} />);
    fireEvent.click(screen.getByRole('button', { name: 'Interface language' }));
    fireEvent.click(screen.getByRole('option', { name: 'Traditional Chinese' }));
    expect(onSelectLocale).toHaveBeenCalledWith('zh-TW');
    expect(screen.queryByRole('option', { name: 'Traditional Chinese' })).toBeNull();
  });
});
