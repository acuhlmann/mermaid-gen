// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildCritiqueActionableA2uiMessages } from '@archislop/shared';
import CritiqueA2uiSurface from '../src/components/CritiqueA2uiSurface.jsx';

describe('CritiqueA2uiSurface', () => {
  it('renders checkboxes and pill-styled fix controls', async () => {
    const critiqueText = `## Summary\n\nNote.\n\n## Actionable improvements\n\n- First fix\n- Second fix\n`;
    const messages = buildCritiqueActionableA2uiMessages(critiqueText);

    const { container } = render(
      <CritiqueA2uiSurface
        messages={messages}
        busy={false}
        onFixAll={vi.fn()}
        onFixSelected={vi.fn()}
      />
    );

    expect(await screen.findByRole('checkbox', { name: /First fix/i })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /Second fix/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix selected' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fix all' })).toBeTruthy();
    expect(container.querySelector('.insights-a2ui-surface-root')).toBeTruthy();
  });

  it('disables Fix selected until at least one checkbox is checked', async () => {
    const critiqueText = `## Summary\n\nNote.\n\n## Actionable improvements\n\n- First fix\n`;
    const messages = buildCritiqueActionableA2uiMessages(critiqueText);

    const { container } = render(
      <CritiqueA2uiSurface
        messages={messages}
        busy={false}
        onFixAll={vi.fn()}
        onFixSelected={vi.fn()}
      />
    );

    const root = container.querySelector('.insights-a2ui-surface-root');
    const scope = within(root);
    const fixSelected = () => scope.getByRole('button', { name: 'Fix selected' });

    await waitFor(() => {
      expect(fixSelected().disabled).toBe(true);
    });

    fireEvent.click(scope.getByRole('checkbox', { name: /First fix/i }));
    await waitFor(() => {
      expect(fixSelected().disabled).toBe(false);
    });

    fireEvent.click(scope.getByRole('checkbox', { name: /First fix/i }));
    await waitFor(() => {
      expect(fixSelected().disabled).toBe(true);
    });
  });

  it('returns null when messages are empty', () => {
    const onUnavailable = vi.fn();
    const { container } = render(
      <CritiqueA2uiSurface
        messages={[]}
        busy={false}
        onFixAll={vi.fn()}
        onFixSelected={vi.fn()}
        onUnavailable={onUnavailable}
      />
    );
    expect(container.firstChild).toBeNull();
    expect(onUnavailable).toHaveBeenCalled();
  });
});
