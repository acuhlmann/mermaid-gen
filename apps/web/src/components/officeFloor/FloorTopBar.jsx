/**
 * The floor's title bar and its two ways out of the room.
 *
 * Binding rule 2 in miniature: wandering is diegetic, but getting back to your
 * chair and back to your screen are both *labelled controls*. The Escape ladder
 * does the same job for a keyboard, and a phone has no Escape key at all —
 * which is the reason "back to my desk" is here rather than only on the card.
 *
 * The peek card carries its own way back, so this one stands in for every other
 * reason you are on your feet.
 */

import { sitDown } from '../../state/officeViewModeStore.js';

/**
 * @param {{
 *   copy: Record<string, any>,
 *   standing: boolean,
 *   onGoHome: () => void
 * }} props `copy` is `officeChromeCopy().floor`.
 */
export function FloorTopBar({ copy, standing, onGoHome }) {
  return (
    <header className="office-floor-bar">
      <div className="office-floor-bar-copy">
        <span className="office-floor-eyebrow">{copy.eyebrow}</span>
        <h2 className="office-floor-title">{copy.title}</h2>
        <p className="office-floor-subtitle">{copy.subtitle}</p>
      </div>
      <div className="office-floor-bar-actions">
        {standing ? (
          <button
            type="button"
            className="office-floor-sit office-floor-sit--home"
            onClick={onGoHome}
            title={copy.peek.backTitle}
          >
            {copy.peek.back}
          </button>
        ) : null}
        <button
          type="button"
          className="office-floor-sit"
          onClick={() => sitDown()}
          title={copy.backTitle}
        >
          {copy.back}
        </button>
      </div>
    </header>
  );
}

export default FloorTopBar;
