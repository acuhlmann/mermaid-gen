/**
 * What you read when you walk up to something in the Machine Room — shown in
 * the floor's card slot (`FloorElevatorCard`), not over the rack: the back row
 * stands against the far wall, and a panel lifted above it ran off the top of
 * the stage on every viewport.
 */

import { BUILDING_COPY } from '../../features/building/buildingCopy.js';
import { openNightShiftBoard } from '../../features/nightShift/nightShiftStore.js';
import { nightShiftPrUrl } from '../../utils/nightShiftLedger.js';

/**
 * The card over a rack you walked up to: who it is, what they did, the PRs
 * they merged, and the way to the full board.
 *
 * @param {{ card: import('../../features/nightShift/nightShiftBoard.js').NightShiftCard, onClose: () => void, shiftDate: string | null }} props
 */
export function RackReadout({ card, onClose, shiftDate }) {
  const lines = card.tonight.slice(0, 2);
  return (
    <div className="machine-room-readout" data-testid="machine-room-readout" data-crew={card.id}>
      <div className="machine-room-readout-head">
        <span aria-hidden="true">{card.emoji}</span>
        <div>
          <strong>{card.name}</strong>
          <span>{card.dept}</span>
        </div>
      </div>
      <p className={`machine-room-readout-status is-${card.column}`}>
        {BUILDING_COPY.rackColumn[card.column]}
      </p>
      {lines.length ? (
        <ul className="machine-room-readout-lines">
          {lines.map((entry, index) => (
            <li key={`${entry.date}-${index}`}>{entry.summary}</li>
          ))}
        </ul>
      ) : (
        <p className="machine-room-readout-lines">{BUILDING_COPY.rackNothing}</p>
      )}
      {card.prs.length ? (
        <p className="machine-room-readout-prs">
          {card.prs.slice(0, 4).map((pr) => (
            <a key={pr} href={nightShiftPrUrl(pr)} target="_blank" rel="noopener noreferrer">
              #{pr}
            </a>
          ))}
        </p>
      ) : null}
      <div className="machine-room-readout-actions">
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          onClick={() => openNightShiftBoard(shiftDate)}
        >
          {BUILDING_COPY.rackOpenBoard}
        </button>
        <button type="button" className="office-floor-card-action" onClick={onClose}>
          {BUILDING_COPY.rackClose}
        </button>
      </div>
    </div>
  );
}

/**
 * The line a piece of furniture has to say for itself.
 *
 * @param {{ kind: string, onClose: () => void }} props
 */
export function PropReadout({ kind, onClose }) {
  return (
    <div className="machine-room-readout" data-testid="machine-room-readout" data-prop={kind}>
      <p className="machine-room-readout-lines">{BUILDING_COPY.props[kind]}</p>
      <div className="machine-room-readout-actions">
        <button type="button" className="office-floor-card-action" onClick={onClose}>
          {BUILDING_COPY.rackClose}
        </button>
      </div>
    </div>
  );
}
