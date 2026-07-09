// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE } from '@archislop/shared';
import AnythingRenderer from '../src/components/AnythingRenderer.jsx';

const HELLO_DOC = `<!DOCTYPE html>
<html><body><h1>Hello</h1><script>document.title = 'hi';</script></body></html>`;

const D3_MARKER_DOC = `<!DOCTYPE html>
<html><head><!-- @lib:d3 --></head><body><h1>Viz</h1><script>d3.select('h1');</script></body></html>`;

function dispatchRuntimeError(iframe, overrides = {}) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: iframe.contentWindow,
        data: {
          type: ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE,
          kind: 'error',
          message: 'ReferenceError: initWidget is not defined',
          detail: 'line 12:3',
          sinceLoadMs: 40,
          ...overrides
        }
      })
    );
  });
}

describe('AnythingRenderer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders agent HTML inside an iframe via srcDoc (never into the host DOM)', () => {
    const { container } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
    // The untrusted markup must never be mounted in the parent document.
    expect(container.querySelector('h1')).toBeNull();
  });

  it('locks the iframe sandbox to allow-scripts only — no same-origin escape hatch', () => {
    const { container } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');
    const sandbox = iframe.getAttribute('sandbox') ?? '';
    const tokens = sandbox.split(/\s+/).filter(Boolean);
    expect(tokens).toContain('allow-scripts');
    // allow-same-origin + allow-scripts would give the injected page full access
    // to the app origin (cookies, storage, parent DOM). This must never appear.
    expect(tokens).not.toContain('allow-same-origin');
    expect(tokens).not.toContain('allow-top-navigation');
    expect(tokens).not.toContain('allow-popups');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.hasAttribute('allow')).toBe(false);
  });

  it('applies iframe CSP and injects CSP meta into srcDoc', () => {
    const { container } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');
    expect(iframe.getAttribute('csp')).toMatch(/connect-src 'none'/);
    expect(iframe.getAttribute('srcdoc')).toMatch(/Content-Security-Policy/);
    expect(iframe.getAttribute('srcdoc')).toMatch(/connect-src 'none'/);
  });

  it('renders nothing for empty source and an error state for non-markup', () => {
    const empty = render(<AnythingRenderer diagramSource="" />);
    expect(empty.container.querySelector('iframe')).toBeNull();
    cleanup();

    const invalid = render(<AnythingRenderer diagramSource="plain prose, no tags" />);
    expect(invalid.container.querySelector('iframe')).toBeNull();
    expect(invalid.container.querySelector('.anything-error-state')).toBeTruthy();
  });

  it('strips a fenced html block before rendering', () => {
    const { container } = render(
      <AnythingRenderer diagramSource={`\`\`\`html\n${HELLO_DOC}\n\`\`\``} />
    );
    const iframe = container.querySelector('iframe.anything-frame');
    expect(iframe.getAttribute('srcdoc')).toContain('<h1>Hello</h1>');
    expect(iframe.getAttribute('srcdoc')).not.toContain('```');
  });

  it('injects the runtime-error bridge into srcDoc', () => {
    const { container } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');
    expect(iframe.getAttribute('srcdoc')).toContain(ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE);
  });

  it('surfaces bridge runtime errors as a banner and via onRuntimeError', () => {
    const onRuntimeError = vi.fn();
    const { container } = render(
      <AnythingRenderer diagramSource={HELLO_DOC} onRuntimeError={onRuntimeError} />
    );
    const iframe = container.querySelector('iframe.anything-frame');

    dispatchRuntimeError(iframe);

    const banner = container.querySelector('.anything-runtime-banner');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('ReferenceError: initWidget is not defined');
    expect(onRuntimeError).toHaveBeenCalledTimes(1);
    expect(onRuntimeError.mock.calls[0][0]).toMatchObject({
      kind: 'error',
      message: 'ReferenceError: initWidget is not defined',
      sinceLoadMs: 40
    });

    // Duplicate messages are collapsed, not re-reported into the banner.
    dispatchRuntimeError(iframe);
    expect(container.querySelectorAll('.anything-runtime-banner').length).toBe(1);
    expect(banner.textContent).not.toContain('more');
  });

  it('ignores messages that are not from its own iframe or have a foreign type', () => {
    const onRuntimeError = vi.fn();
    const { container } = render(
      <AnythingRenderer diagramSource={HELLO_DOC} onRuntimeError={onRuntimeError} />
    );
    const iframe = container.querySelector('iframe.anything-frame');

    // Wrong source (null → not the iframe's contentWindow).
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: ANYTHING_RUNTIME_ERROR_MESSAGE_TYPE, message: 'spoofed' }
        })
      );
    });
    // Right source, wrong type.
    dispatchRuntimeError(iframe, { type: 'someone-elses-message' });

    expect(container.querySelector('.anything-runtime-banner')).toBeNull();
    expect(onRuntimeError).not.toHaveBeenCalled();
  });

  it('suppresses runtime errors while streaming a draft preview', () => {
    const onRuntimeError = vi.fn();
    const { container } = render(
      <AnythingRenderer
        diagramSource={HELLO_DOC}
        streamingPreview={true}
        onRuntimeError={onRuntimeError}
      />
    );
    const iframe = container.querySelector('iframe.anything-frame');

    dispatchRuntimeError(iframe);

    expect(container.querySelector('.anything-runtime-banner')).toBeNull();
    expect(onRuntimeError).not.toHaveBeenCalled();
  });

  it('expands @lib markers into inline vendored scripts before srcDoc', async () => {
    const { container } = render(<AnythingRenderer diagramSource={D3_MARKER_DOC} />);

    // Expansion is async (the vendor chunk lazy-loads); the iframe appears
    // once the expanded document is ready.
    const iframe = await waitFor(() => {
      const found = container.querySelector('iframe.anything-frame');
      expect(found).toBeTruthy();
      return found;
    });

    const srcDoc = iframe.getAttribute('srcdoc');
    expect(srcDoc).toContain('data-archislop-lib="d3"');
    expect(srcDoc).toContain('d3js.org'); // vendored source, not a URL load
    expect(srcDoc).not.toContain('@lib:d3');
    // The lib injection must not loosen the sandbox.
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('csp')).toMatch(/connect-src 'none'/);
  });

  it('keeps the marker-free render path synchronous (no vendor chunk)', () => {
    const { container } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('srcdoc')).not.toContain('data-archislop-lib');
  });

  it('dismisses the banner and clears errors when the document changes', () => {
    const { container, rerender } = render(<AnythingRenderer diagramSource={HELLO_DOC} />);
    const iframe = container.querySelector('iframe.anything-frame');

    dispatchRuntimeError(iframe);
    expect(container.querySelector('.anything-runtime-banner')).toBeTruthy();

    // Dismiss button hides the banner.
    act(() => {
      container.querySelector('.anything-runtime-banner-dismiss').click();
    });
    expect(container.querySelector('.anything-runtime-banner')).toBeNull();

    // A new document resets the error state entirely.
    dispatchRuntimeError(iframe);
    rerender(<AnythingRenderer diagramSource={HELLO_DOC.replace('Hello', 'Hello v2')} />);
    expect(container.querySelector('.anything-runtime-banner')).toBeNull();
  });
});
