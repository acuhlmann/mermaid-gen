// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatJsonForDisplay, ThinkingSyntaxCodeBlock } from '../src/utils/thinkingSyntaxCode';

afterEach(() => {
  cleanup();
});

describe('formatJsonForDisplay', () => {
  it('pretty-prints valid JSON', () => {
    const formatted = formatJsonForDisplay('{"a":1,"b":[2,3]}');
    expect(formatted).toContain('"a": 1');
    expect(formatted).toContain('"b": [');
  });
});

describe('ThinkingSyntaxCodeBlock', () => {
  it('renders highlighted JSON with formatted indentation', () => {
    const { container } = render(
      <ThinkingSyntaxCodeBlock code='{"name":"archislop","count":2}' language="json" />
    );
    expect(screen.getByTestId('thinking-syntax-code')).toBeTruthy();
    expect(container.querySelector('.insights-code-token-key')).toBeTruthy();
    expect(container.querySelector('.insights-code-token-string')).toBeTruthy();
    expect(container.querySelector('.insights-code-token-number')).toBeTruthy();
  });
});
