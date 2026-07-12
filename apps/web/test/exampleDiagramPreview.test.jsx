// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

  it('renders the seeded SVG with eyebrow and caption when active', async () => {
    render(
      <ExampleDiagramPreview
        source={SOURCE}
        eyebrow="Live example"
        caption="This is what archislop does"
        ariaLabel="Example diagram"
        active
      />
    );

    await waitFor(() => expect(screen.getByTestId('entry-example')).toBeTruthy());
    expect(screen.getByText('Live example')).toBeTruthy();
    expect(screen.getByText('This is what archislop does')).toBeTruthy();
    expect(renderMermaidPreviewSvg).toHaveBeenCalledWith('entry-example', SOURCE);
  });

  it('renders nothing (and does no render work) when inactive', () => {
    const { container } = render(<ExampleDiagramPreview source={SOURCE} active={false} />);
    expect(container.querySelector('[data-testid="entry-example"]')).toBeNull();
    expect(renderMermaidPreviewSvg).not.toHaveBeenCalled();
  });

  it('fails silent — renders nothing when the Mermaid render rejects', async () => {
    renderMermaidPreviewSvg.mockRejectedValueOnce(new Error('boom'));
    const { container } = render(<ExampleDiagramPreview source={SOURCE} active />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-testid="entry-example"]')).toBeNull();
  });
});
