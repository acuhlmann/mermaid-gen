// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import {
  ColorRamp,
  ColorSwatch,
  enrichInline,
  IconReplaceRow,
  isVisualStepLine,
  normalizeHex,
  ThemeVarPill,
  tokenizeThinkingProse
} from '../src/utils/thinkingProseEnrich';

describe('normalizeHex', () => {
  it('expands 3-digit hex', () => {
    expect(normalizeHex('#4b3')).toBe('#44bb33');
  });

  it('normalizes 6-digit hex', () => {
    expect(normalizeHex('#4b3b00')).toBe('#4b3b00');
  });
});

describe('isVisualStepLine', () => {
  it('detects Earth Impacts style lines', () => {
    expect(isVisualStepLine('5. Replace ::icon(fa fa-fire) with 🔥')).toBe(true);
    expect(isVisualStepLine('6. Darken tertiary text from #4b3b00 to something like #3a2a00')).toBe(
      true
    );
    expect(isVisualStepLine('Plain paragraph.')).toBe(false);
  });
});

describe('micro-viz components', () => {
  it('renders color swatch with hex label', () => {
    render(<ColorSwatch hex="#4b3b00" />);
    expect(screen.getByTestId('thinking-color-swatch')).toBeTruthy();
    expect(screen.getByText('#4b3b00')).toBeTruthy();
  });

  it('renders color ramp between two hex values', () => {
    render(<ColorRamp fromHex="#4b3b00" toHex="#3a2a00" />);
    const ramp = screen.getByTestId('thinking-color-ramp');
    expect(ramp).toBeTruthy();
    expect(within(ramp).getAllByTestId('thinking-color-swatch').length).toBe(2);
  });

  it('renders theme variable pill with default swatch', () => {
    render(<ThemeVarPill name="tertiaryTextColor" />);
    expect(screen.getByTestId('thinking-theme-var')).toBeTruthy();
    expect(screen.getByText('tertiaryTextColor')).toBeTruthy();
  });

  it('renders icon replace row', () => {
    render(<IconReplaceRow fromFa="fa fa-fire" toEmoji="🔥" />);
    expect(screen.getByTestId('thinking-icon-replace')).toBeTruthy();
    expect(screen.getByText('🔥')).toBeTruthy();
  });
});

describe('enrichInline', () => {
  it('renders hex swatch in prose', () => {
    const { container } = render(<span>{enrichInline('Use color #4b3b00 here')}</span>);
    expect(container.querySelector('[data-testid="thinking-color-swatch"]')).toBeTruthy();
  });

  it('renders color ramp for from/to hex clause', () => {
    const { container } = render(
      <span>{enrichInline('Darken tertiary text from #4b3b00 to something like #3a2a00')}</span>
    );
    expect(container.querySelector('[data-testid="thinking-color-ramp"]')).toBeTruthy();
  });

  it('renders icon replace for sloppy Replace::icon line', () => {
    const { container } = render(<span>{enrichInline('Replace::icon(fa fa-fire)with 🔥')}</span>);
    expect(container.querySelector('[data-testid="thinking-icon-replace"]')).toBeTruthy();
  });

  it('renders theme variable pill', () => {
    const { container } = render(
      <span>{enrichInline('Adjust tertiaryTextColor for contrast')}</span>
    );
    expect(container.querySelector('[data-testid="thinking-theme-var"]')).toBeTruthy();
  });

  it('preserves markdown bold', () => {
    const { container } = render(<span>{enrichInline('**Bold** text')}</span>);
    expect(container.querySelector('strong')).toBeTruthy();
  });
});

describe('tokenizeThinkingProse', () => {
  it('returns strings and elements', () => {
    const parts = tokenizeThinkingProse('hello #ff0000 world');
    expect(parts.some((p) => typeof p === 'string')).toBe(true);
  });

  it('prefers earlier theme enum over later diagram type without throwing', () => {
    expect(() => enrichInline('Switch to default flowchart TB')).not.toThrow();
    const { container } = render(<span>{enrichInline('Switch to default flowchart TB')}</span>);
    expect(container.querySelector('[data-testid="thinking-style-enum"]')).toBeTruthy();
  });
});
