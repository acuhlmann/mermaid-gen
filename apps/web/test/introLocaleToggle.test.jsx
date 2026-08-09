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

  // Reception is the one screen a user may not be able to read yet, so every
  // option must be visible without expanding anything, and labelled with its own
  // endonym rather than a name written in the language they are trying to leave.
  it('offers every locale up front, labelled in its own language', () => {
    const onSelectLocale = vi.fn();
    const zhCopy = {
      aria: '界面语言',
      en: '英语',
      enAu: '澳式俚语',
      zhCn: '简体中文',
      zhTw: '繁体中文'
    };
    render(
      <IntroLocaleToggle
        variant="intro"
        locale="zh-CN"
        copy={zhCopy}
        onSelectLocale={onSelectLocale}
      />
    );
    const group = screen.getByRole('radiogroup', { name: '界面语言' });
    expect(group.textContent).toContain('English');
    expect(group.textContent).toContain('繁體中文');
    expect(screen.getByRole('radio', { name: '简体中文' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: '英语' }));
    expect(onSelectLocale).toHaveBeenCalledWith('en');
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
