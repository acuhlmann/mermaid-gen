// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import AnythingRenderer from '../src/components/AnythingRenderer.jsx';

const HELLO_DOC = `<!DOCTYPE html>
<html><body><h1>Hello</h1><script>document.title = 'hi';</script></body></html>`;

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
});
