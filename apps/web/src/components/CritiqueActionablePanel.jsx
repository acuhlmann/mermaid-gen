import { useCallback, useMemo, useState } from 'react';
import { buildCritiqueActionableA2uiMessages } from '@archislop/shared';
import { useUiCopy } from '../i18n/useUiLocale.js';
import CritiqueA2uiSurface from './CritiqueA2uiSurface.jsx';
import CritiqueActionableChecklist from './CritiqueActionableChecklist.jsx';

/**
 * Renders critique fix controls via A2UI when possible; falls back to native HTML
 * so actionable items stay fixable when the surface fails to mount.
 */
export default function CritiqueActionablePanel({
  headingText,
  items,
  critiqueText,
  a2uiMessages,
  busy,
  onFixAll,
  onFixSelected
}) {
  const { controls } = useUiCopy();
  const [a2uiUnavailable, setA2uiUnavailable] = useState(false);
  const handleA2uiUnavailable = useCallback(() => setA2uiUnavailable(true), []);
  const messages = useMemo(
    () =>
      buildCritiqueActionableA2uiMessages(critiqueText, {
        heading: controls.insights.actionableImprovements,
        fixSelected: controls.checklist.fixSelected,
        fixAll: controls.checklist.fixAll
      }),
    [critiqueText, controls]
  );

  if (a2uiUnavailable || !messages.length) {
    return (
      <CritiqueActionableChecklist
        headingText={headingText}
        items={items}
        busy={busy}
        onFixAll={onFixAll}
        onFixSelected={onFixSelected}
      />
    );
  }

  return (
    <CritiqueA2uiSurface
      messages={messages}
      busy={busy}
      onFixAll={onFixAll}
      onFixSelected={onFixSelected}
      onUnavailable={handleA2uiUnavailable}
    />
  );
}
