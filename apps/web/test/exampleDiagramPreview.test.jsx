// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/renderMermaidPreview.js', () => ({
  renderMermaidPreviewSvg: vi.fn(async () => ({ svg: '<svg><text>demo</text></svg>' }))
}));

import ExampleDiagramPreview from '../src/components/ExampleDiagramPreview.jsx';
import { renderMermaidPreviewSvg } from '../src/utils/renderMermaidPreview.js';

const SOURCE = 'flowchart TD\n  A-->B';

describe('ExampleDiagramPreview', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders purpose copy, matching topic, and sample SVG when active', async () => {
    render(
      <ExampleDiagramPreview
        source={SOURCE}
        eyebrow="What is this?"
        headline="Turn any topic into a living visualization"
        body="AI drafts a diagram you can refine."
        topicLabel="OAuth 2.0 authorization code flow"
        ariaLabel="Example visualization"
        active
      />
    );

    await waitFor(() => expect(screen.getByTestId('entry-example')).toBeTruthy());
    expect(screen.getByText('What is this?')).toBeTruthy();
    expect(screen.getByText('Turn any topic into a living visualization')).toBeTruthy();
    expect(screen.getByText('OAuth 2.0 authorization code flow')).toBeTruthy();
    expect(renderMermaidPreviewSvg).toHaveBeenCalledWith('entry-example', SOURCE);
  });

  it('renders nothing when inactive', () => {
    const { container } = render(
      <ExampleDiagramPreview source={SOURCE} headline="Hidden" active={false} />
    );
    expect(container.querySelector('[data-testid="entry-example"]')).toBeNull();
    expect(renderMermaidPreviewSvg).not.toHaveBeenCalled();
  });

  it('still shows purpose copy when Mermaid render rejects', async () => {
    renderMermaidPreviewSvg.mockRejectedValueOnce(new Error('boom'));
    render(
      <ExampleDiagramPreview
        source={SOURCE}
        headline="Turn any topic into a living visualization"
        ctaLabel="Generate this →"
        onTry={vi.fn()}
        active
      />
    );
    await waitFor(() => expect(screen.getByTestId('entry-example')).toBeTruthy());
    expect(screen.getByText('Turn any topic into a living visualization')).toBeTruthy();
    expect(screen.getByTestId('entry-example-try')).toBeTruthy();
    expect(screen.queryByText('demo')).toBeNull();
  });

  it('renders the generate CTA and fires onTry when tapped', async () => {
    const onTry = vi.fn();
    render(
      <ExampleDiagramPreview
        source={SOURCE}
        headline="Turn any topic into a living visualization"
        topicLabel="OAuth 2.0 authorization code flow"
        ctaLabel="Generate this →"
        onTry={onTry}
        active
      />
    );
    await waitFor(() => expect(screen.getByTestId('entry-example-try')).toBeTruthy());
    fireEvent.click(screen.getByTestId('entry-example-try'));
    expect(onTry).toHaveBeenCalledTimes(1);
  });

  it('omits the CTA when onTry is not supplied', async () => {
    render(
      <ExampleDiagramPreview
        source={SOURCE}
        headline="Turn any topic into a living visualization"
        ctaLabel="Generate this →"
        active
      />
    );
    await waitFor(() => expect(screen.getByTestId('entry-example')).toBeTruthy());
    expect(screen.queryByTestId('entry-example-try')).toBeNull();
  });
});
