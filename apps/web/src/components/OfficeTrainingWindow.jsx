import { useState } from 'react';
import { TRAINING_STEPS } from '@archislop/shared';
import { officeChromeCopy } from '../utils/officeCast.js';
import { formatLocale } from '../i18n/formatLocale.js';
import { PersonaFace } from './personaFaces/index.jsx';
import FormsRenderer from './FormsRenderer.jsx';
import FloatingWindow, { FloatingWindowDragHandle } from './FloatingWindow.jsx';
import {
  FloatingWindowCloseButton,
  FloatingWindowMinimizeButton
} from './FloatingWindowChrome.jsx';

/**
 * Linda's compliance training as a real, fillable form (docs/office-parody.md
 * §10.1) — a fifth office window kind alongside inbox / messenger / meeting /
 * meeting-picker.
 *
 * Two things here are easy to get wrong and both are pinned by tests:
 *
 * - **`preview` is NOT passed.** The thinking-pane mirror uses it to render a
 *   form read-only, and it early-returns out of the action handler
 *   (`FormsRenderer.jsx`). A preview training module would render perfectly and
 *   silently refuse to submit.
 * - **`exportable={false}` IS passed.** The PNG exporter registry is keyed by
 *   content type, so a second live forms renderer would hijack the `forms`
 *   slot's Export-PNG and fail to hand it back on unmount.
 *
 * Pure props — the gauntlet's state lives in `useOfficeTraining`, and the
 * document never touches a diagram slot (ADR-0010).
 */
export default function OfficeTrainingWindow({ training, onClose, onSubmit }) {
  const [minimized, setMinimized] = useState(false);
  const copy = officeChromeCopy();
  const t = copy.training ?? {};

  if (!training) return null;

  const stepLabel = formatLocale(t.stepLabel ?? 'Form {step} of {total}', {
    step: training.step,
    total: TRAINING_STEPS
  });

  return (
    <FloatingWindow
      id="office-training"
      open
      group="officeModal"
      kind="training"
      className={`office-training-window${minimized ? ' is-minimized' : ''}`}
      title={t.title ?? 'Compliance Training'}
      defaultCorner="center"
      defaultOffsetX={0}
      defaultOffsetY={0}
      cascade={0}
      role="dialog"
      aria-label={t.title ?? 'Compliance Training'}
    >
      <FloatingWindowDragHandle
        className="office-training-header"
        title={t.dragHint ?? 'Drag to move'}
      >
        <div className="office-training-header-row">
          <PersonaFace id="hr" size={26} className="office-training-avatar" />
          <div className="office-training-heading">
            <span className="office-training-title">{t.title ?? 'Compliance Training'}</span>
            <span className="office-training-step">{stepLabel}</span>
          </div>
          <div className="office-training-header-actions">
            <FloatingWindowMinimizeButton
              minimized={minimized}
              minimizeLabel={copy.windowMinimize}
              restoreLabel={copy.windowRestore}
              minimizeTitle={copy.windowMinimizeTitle}
              restoreTitle={copy.windowRestoreTitle}
              onToggle={() => setMinimized((prev) => !prev)}
              className="office-training-minimize"
            />
            {/* Abandoning the module is allowed and discards it — see
                useOfficeTraining. Linda will simply raise it again. */}
            <FloatingWindowCloseButton
              label={t.closeAria ?? 'Close training'}
              onClose={onClose}
              className="office-training-close"
            />
          </div>
        </div>
      </FloatingWindowDragHandle>
      {minimized ? null : (
        <div className="office-training-body">
          {training.busy || !training.form ? (
            <p className="office-training-loading" role="status">
              {t.loading ?? 'Loading your module…'}
            </p>
          ) : (
            <FormsRenderer
              diagramSource={training.form}
              exportable={false}
              onFormSubmit={onSubmit}
            />
          )}
        </div>
      )}
    </FloatingWindow>
  );
}
