// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TRAINING_STEPS } from '@archislop/shared';
import OfficeInboxDock from '../src/components/OfficeInboxDock.jsx';
import OfficeTrainingWindow from '../src/components/OfficeTrainingWindow.jsx';
import { buildCannedTrainingForm } from '../src/utils/officeTrainingModule.js';
import { isViewportPngExporterReady } from '../src/utils/viewportPngExport.js';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const readSource = (relative) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const trainingEmail = {
  id: 'email-training',
  colleagueId: 'hr',
  training: 3,
  subject: 'Friendly nudge! Training overdue 😊',
  body: 'Your compliance training is 847 days overdue!',
  createdAt: 1,
  read: false
};

const phishingEmail = {
  id: 'email-bait',
  colleagueId: 'ciso',
  phishing: true,
  subject: 'URGENT: Your diagram access will be revoked in 24 hours',
  body: 'Dear Valued Colleauge, please re-verify your credentials.',
  createdAt: 2,
  read: false
};

const openEmail = (subject) => fireEvent.click(screen.getByText(subject));

describe('training entry points in the inbox', () => {
  it('offers Linda’s module only on the email that carries the marker', () => {
    const onStartTraining = vi.fn();
    render(
      <OfficeInboxDock
        openSignal={1}
        emails={[trainingEmail, phishingEmail]}
        unreadCount={2}
        onStartTraining={onStartTraining}
        canCallMeeting={false}
      />
    );

    openEmail(phishingEmail.subject);
    expect(screen.queryByText(/Begin Module/i)).toBeNull();

    fireEvent.click(screen.getByText('← Back'));
    openEmail(trainingEmail.subject);
    fireEvent.click(screen.getByText(/Begin Module 3/i));
    expect(onStartTraining).toHaveBeenCalledWith(3);
  });

  it('offers both endings of the phishing test, and neither happens on its own', () => {
    const onPhishingClick = vi.fn();
    const onPhishingReport = vi.fn();
    render(
      <OfficeInboxDock
        openSignal={1}
        emails={[phishingEmail]}
        unreadCount={1}
        onPhishingClick={onPhishingClick}
        onPhishingReport={onPhishingReport}
        canCallMeeting={false}
      />
    );

    openEmail(phishingEmail.subject);
    // Rendering the bait must not fire anything — ADR-0010: an email is an
    // offer, and the human is the one who acts on it.
    expect(onPhishingClick).not.toHaveBeenCalled();
    expect(onPhishingReport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText(/Report phishing/i));
    expect(onPhishingReport).toHaveBeenCalledWith('email-bait', 'ciso');
    expect(onPhishingClick).not.toHaveBeenCalled();
  });
});

describe('OfficeTrainingWindow', () => {
  const training = {
    moduleNumber: 3,
    step: 1,
    busy: false,
    personalized: false,
    form: buildCannedTrainingForm({ step: 1, labels: ['paymentGateway'] })
  };

  it('renders nothing until a module is open', () => {
    const { container } = render(<OfficeTrainingWindow training={null} />);
    expect(container.querySelector('[data-window-kind="training"]')).toBeNull();
  });

  it('registers as its own window kind and shows the step counter', () => {
    render(<OfficeTrainingWindow training={training} />);
    expect(document.querySelector('[data-window-kind="training"]')).not.toBeNull();
    expect(screen.getByText(`Form 1 of ${TRAINING_STEPS}`)).toBeTruthy();
  });

  it('shows Linda’s wait state instead of an empty window while the module loads', () => {
    render(<OfficeTrainingWindow training={{ ...training, busy: true, form: null }} />);
    expect(screen.getByRole('status').textContent).toMatch(/Linda/);
  });

  /**
   * The exporter registry is a Map keyed by content type and unregistering is
   * identity-matched, so a second live FormsRenderer would hijack the `forms`
   * slot's Export-PNG and then fail to hand it back. The office window is not
   * the primary canvas and must stay out of the registry entirely.
   */
  it('never claims the forms PNG exporter', () => {
    expect(isViewportPngExporterReady('forms')).toBe(false);
    render(<OfficeTrainingWindow training={training} />);
    expect(isViewportPngExporterReady('forms')).toBe(false);
    cleanup();
    expect(isViewportPngExporterReady('forms')).toBe(false);
  });

  /**
   * ADR-0010 — the built-in cast produces no slot content. Asserted against the
   * source rather than by mocking the store, because the guarantee wanted is
   * "there is no path from here to a slot", not "this particular flow happened
   * not to take one". A future edit that imports a slot mutator fails here even
   * if it is never called.
   */
  it('has no import path from the training feature to a diagram slot', () => {
    const sources = {
      'OfficeTrainingWindow.jsx': readSource('../src/components/OfficeTrainingWindow.jsx'),
      'useOfficeTraining.js': readSource('../src/hooks/useOfficeTraining.js'),
      'officeTrainingModule.js': readSource('../src/utils/officeTrainingModule.js')
    };
    for (const [name, source] of Object.entries(sources)) {
      const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
      for (const specifier of imports) {
        expect(specifier, `${name} imports ${specifier}`).not.toMatch(
          /diagramStore|applyPatch|syncClientDiagramSource|diagramSlots/
        );
      }
      expect(source, name).not.toMatch(/setDiagramSource|applyPatch\(/);
    }
  });
});
