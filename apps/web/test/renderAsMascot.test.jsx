// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RenderAsMascot from '../src/components/RenderAsMascot.jsx';
import { buildContentModeOptions } from '../src/utils/renderModeAction.js';
import { CONTROLS_EN } from '../src/i18n/locales/controls.en.js';

const MODES = buildContentModeOptions(CONTROLS_EN);

describe('RenderAsMascot', () => {
  afterEach(() => cleanup());

  it('lists all content modes in the radial-style menu when expanded (test mode)', () => {
    render(
      <RenderAsMascot modes={MODES} currentMode="mermaid" onPickMode={vi.fn()} />
    );
    expect(screen.getByRole('dialog', { name: 'Render this as...' })).toBeTruthy();
    expect(screen.getByRole('menu', { name: 'Target render mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as Infographic/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as 3D metaphor/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as Chart/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as Forms/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as Anything page/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Render selected item as Auto/i })).toBeTruthy();
  });

  it('invokes onPickMode and collapses when a different mode is chosen', () => {
    const onPickMode = vi.fn();
    render(
      <RenderAsMascot modes={MODES} currentMode="mermaid" onPickMode={onPickMode} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Render selected item as Chart/i }));
    expect(onPickMode).toHaveBeenCalledWith('chart');
    expect(screen.queryByRole('menu', { name: 'Target render mode' })).toBeNull();
  });

  it('disables the current mode row', () => {
    render(
      <RenderAsMascot modes={MODES} currentMode="chart" onPickMode={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /Chart is the current mode/i }).disabled).toBe(true);
  });

  it('returns null when no modes are provided', () => {
    const { container } = render(
      <RenderAsMascot modes={[]} currentMode="mermaid" onPickMode={vi.fn()} />
    );
    expect(container.querySelector('.render-as-mascot-wrap')).toBeNull();
  });
});
