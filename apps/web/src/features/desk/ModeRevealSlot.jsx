import ModeRevealSpotlight from '../../components/ModeRevealSpotlight.jsx';

/**
 * First-run mode reveal overlay (post-first-diagram).
 *
 * @param {{
 *   active: boolean;
 *   copy: object;
 *   modes: Array<object>;
 *   currentMode: string;
 *   onPickMode: (mode: string) => void;
 *   onDismiss: () => void;
 * }} props
 */
export function ModeRevealSlot({ active, copy, modes, currentMode, onPickMode, onDismiss }) {
  if (!active) return null;

  return (
    <ModeRevealSpotlight
      eyebrow={copy.eyebrow}
      body={copy.body}
      modes={modes}
      currentMode={currentMode}
      onPickMode={onPickMode}
      pickPrefix={copy.pickPrefix}
      dismissLabel={copy.dismiss}
      ariaLabel={copy.aria}
      onDismiss={onDismiss}
    />
  );
}
