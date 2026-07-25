// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IntroLocaleToggle from '../src/components/IntroLocaleToggle.jsx';

const COPY = {
  aria: 'Interface language',
  en: 'English',
  enAu: 'Aussie Slang',
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
    expect(screen.queryByRole('option', { name: 'Aussie Slang' })).toBeNull();
  });

  it('expands alternate locales and fires onSelectLocale', () => {
    const onSelectLocale = vi.fn();
    render(<IntroLocaleToggle locale="en" copy={COPY} onSelectLocale={onSelectLocale} />);
    fireEvent.click(screen.getByRole('button', { name: 'Interface language' }));
    fireEvent.click(screen.getByRole('option', { name: 'Traditional Chinese' }));
    expect(onSelectLocale).toHaveBeenCalledWith('zh-TW');
    expect(screen.queryByRole('option', { name: 'Traditional Chinese' })).toBeNull();
  });

  it('offers Aussie Slang as a clear intro option', () => {
    const onSelectLocale = vi.fn();
    render(<IntroLocaleToggle locale="en" copy={COPY} onSelectLocale={onSelectLocale} />);
    fireEvent.click(screen.getByRole('button', { name: 'Interface language' }));
    const aussie = screen.getByRole('option', { name: 'Aussie Slang' });
    expect(aussie.textContent).toMatch(/Aussie/);
    expect(aussie.textContent).toMatch(/Aussie Slang/);
    fireEvent.click(aussie);
    expect(onSelectLocale).toHaveBeenCalledWith('en-AU');
  });

  it('lays out all locales inline without a popup menu', () => {
    const onSelectLocale = vi.fn();
    render(
      <IntroLocaleToggle variant="inline" locale="en" copy={COPY} onSelectLocale={onSelectLocale} />
    );
    expect(screen.getByRole('radiogroup', { name: 'Interface language' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'English' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Simplified Chinese' }));
    expect(onSelectLocale).toHaveBeenCalledWith('zh-CN');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
