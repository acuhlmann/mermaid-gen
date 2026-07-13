// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { buildFormsSeedDoc } from '@archislop/shared';
import FormsRenderer from '../src/components/FormsRenderer.jsx';

describe('FormsRenderer', () => {
  afterEach(() => cleanup());

  it('renders nothing when the slot is empty', () => {
    const { container } = render(<FormsRenderer diagramSource="" onFormSubmit={vi.fn()} />);
    expect(container.querySelector('.forms-a2ui-surface-root')).toBeNull();
    expect(container.querySelector('.forms-error-state')).toBeNull();
  });

  it('fires onFormSubmit with the form title and answers when a button is clicked', async () => {
    const onFormSubmit = vi.fn();
    render(<FormsRenderer diagramSource={buildFormsSeedDoc()} onFormSubmit={onFormSubmit} />);

    const submit = await screen.findByRole('button', { name: /Submit & Proceed/i });
    fireEvent.click(submit);

    await waitFor(() => expect(onFormSubmit).toHaveBeenCalledTimes(1));
    const payload = onFormSubmit.mock.calls[0][0];
    expect(payload.formTitle).toMatch(/Pre-Intake Eligibility/i);
    expect(payload.buttonLabel).toMatch(/Submit & Proceed/i);
    expect(Array.isArray(payload.answers)).toBe(true);
    // Answers carry the human field labels, not raw data-model keys.
    expect(payload.answers.some((a) => /legal name/i.test(a.label))).toBe(true);
  });

  it('does not fire onFormSubmit while busy', async () => {
    const onFormSubmit = vi.fn();
    render(<FormsRenderer diagramSource={buildFormsSeedDoc()} busy onFormSubmit={onFormSubmit} />);
    const submit = await screen.findByRole('button', { name: /Submit & Proceed/i });
    fireEvent.click(submit);
    // Give the async action handler a tick to (not) run.
    await new Promise((r) => setTimeout(r, 20));
    expect(onFormSubmit).not.toHaveBeenCalled();
  });

  it('shows an error state for an invalid document', async () => {
    const { container } = render(
      <FormsRenderer diagramSource="{not valid json" onFormSubmit={vi.fn()} />
    );
    await waitFor(() => expect(container.querySelector('.forms-error-state')).toBeTruthy());
  });

  it('keeps the last good form during streamingPreview of incomplete JSON', async () => {
    const good = buildFormsSeedDoc();
    const { rerender, container } = render(
      <FormsRenderer diagramSource={good} onFormSubmit={vi.fn()} />
    );
    expect(await screen.findByRole('button', { name: /Submit & Proceed/i })).toBeTruthy();

    rerender(
      <FormsRenderer
        diagramSource='{"archislopFormsVersion":1,"formTitle":"Partial'
        streamingPreview
        onFormSubmit={vi.fn()}
      />
    );

    // Incomplete JSON must not flash the error state while streaming.
    expect(container.querySelector('.forms-error-state')).toBeNull();
    expect(screen.getByRole('button', { name: /Submit & Proceed/i })).toBeTruthy();
  });
});
