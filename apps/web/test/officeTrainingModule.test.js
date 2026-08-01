import { describe, expect, it } from 'vitest';
import { parseFormsA2ui, TRAINING_MODULE_TOTAL, TRAINING_STEPS } from '@archislop/shared';
import {
  TRAINING_SUBMIT_EVENT,
  buildCannedTrainingForm
} from '../src/utils/officeTrainingModule.js';

/**
 * The canned module is the fallback for a spent LLM budget. Its whole job is to
 * be *valid* — an invalid fallback degrades into the error state it exists to
 * prevent, and it would do so only on the unhappy path, where nobody looks.
 * So every step is parsed through the real gate rather than eyeballed.
 */

const allComponents = (doc) =>
  doc.messages.flatMap((message) => message?.updateComponents?.components ?? []);

describe('buildCannedTrainingForm', () => {
  it('produces a document that passes the real forms validator at every step', () => {
    for (let step = 1; step <= TRAINING_STEPS; step += 1) {
      const result = parseFormsA2ui(buildCannedTrainingForm({ step }));
      expect(result.ok, `step ${step}: ${result.ok ? '' : result.error}`).toBe(true);
      // At least one input and one button is what makes a form finishable —
      // the validator enforces it, and this pins that we did not lean on a
      // future relaxation of that rule.
      expect(result.meta.inputCount).toBeGreaterThan(0);
      expect(result.meta.buttonCount).toBeGreaterThan(0);
    }
  });

  it('hangs the module questions on a real canvas label', () => {
    const form = buildCannedTrainingForm({ step: 1, labels: ['paymentGateway', 'authService'] });
    expect(form).toContain('paymentGateway');
    expect(form).toContain('authService');
  });

  it('falls back to generic copy on an empty canvas rather than an empty quote', () => {
    const result = parseFormsA2ui(buildCannedTrainingForm({ step: 1, labels: [] }));
    expect(result.ok).toBe(true);
    const labels = allComponents(result.doc)
      .map((component) => component.label)
      .filter((label) => typeof label === 'string');
    expect(labels.some((label) => label.includes('your diagram'))).toBe(true);
    // A label quoting an empty subject ("") reads as a bug rather than a joke.
    // Checked on labels, not the raw JSON — the seeded data model is *supposed*
    // to hold empty strings for the unfilled fields.
    expect(labels.every((label) => !label.includes('""'))).toBe(true);
  });

  it('quotes a prior answer back on the attestation step', () => {
    const form = buildCannedTrainingForm({
      step: 2,
      priorAnswers: [
        { label: 'First action', value: '' },
        { label: 'Accountable party', value: 'Craig' }
      ]
    });
    // The empty answer is skipped — quoting "" back reads as a bug, not a joke.
    expect(form).toContain('Craig');
  });

  it('survives a prior answer that is an array or entirely empty', () => {
    const arrayAnswer = buildCannedTrainingForm({
      step: 2,
      priorAnswers: [{ label: 'Channels', value: ['slack', 'email'] }]
    });
    expect(parseFormsA2ui(arrayAnswer).ok).toBe(true);
    expect(arrayAnswer).toContain('slack, email');

    const noAnswers = buildCannedTrainingForm({ step: 2, priorAnswers: [] });
    expect(parseFormsA2ui(noAnswers).ok).toBe(true);
    expect(noAnswers).toContain('nothing at all');
  });

  it('names the course the same way Linda does', () => {
    const form = buildCannedTrainingForm({ step: 1, moduleNumber: 3 });
    expect(form).toContain(`Module 3 of ${TRAINING_MODULE_TOTAL}`);
    expect(form).toContain('847');
  });

  it('routes every button through the single submit capability', () => {
    for (let step = 1; step <= TRAINING_STEPS; step += 1) {
      const result = parseFormsA2ui(buildCannedTrainingForm({ step }));
      const buttons = allComponents(result.doc).filter((c) => c.component === 'Button');
      expect(buttons.length).toBeGreaterThan(0);
      for (const button of buttons) {
        expect(button.action.event.name).toBe(TRAINING_SUBMIT_EVENT);
        // A check on a Button disables it and traps the user mid-gauntlet.
        expect(button.checks).toBeUndefined();
      }
    }
  });
});
