/**
 * The elevator's card, in the floor's card slot (`features/building/`).
 *
 * Four states, read straight off the building store, so the card can never
 * disagree with the doors on the wall:
 *
 * - walking to the elevator — a way to change your mind;
 * - doors open — the panel: one button per floor, top floor first;
 * - riding — the floor you are going to;
 * - standing in the Machine Room with the doors shut — what this floor is, and
 *   the call button (the basement's equivalent of the open plan's hint line).
 *
 * The panel's leadership button is locked by HR level and, once unlocked, is
 * still being fitted out. Your level is read from the progress the HR panel
 * already persists; nothing here awards or spends XP.
 */

import { useSyncExternalStore } from 'react';
import { BUILDING_COPY } from '../../features/building/buildingCopy.js';
import { elevatorButtonsFor, floorButtonLabel } from '../../features/building/officeBuilding.js';
import {
  callElevator,
  closeElevatorDoors,
  getBuildingSnapshot,
  isElevatorCardShown,
  rideElevatorTo,
  setBuildingReading,
  subscribeBuilding
} from '../../features/building/officeBuildingStore.js';
import { nightShiftCards } from '../../features/nightShift/nightShiftBoard.js';
import { getNightShiftManifest } from '../../features/nightShift/nightShiftManifest.js';
import { PropReadout, RackReadout } from './MachineRoomReadout.jsx';
import { levelForXp, readFromStorage } from '../../state/runGamificationStore.js';

/** Your HR level, as the level-up panel last saved it. Level 1 when unknown. */
function playerLevel() {
  try {
    const saved = readFromStorage(typeof window === 'undefined' ? null : window.localStorage);
    return levelForXp(saved?.xp ?? 0).level;
  } catch {
    return 1;
  }
}

/** @param {{ building: import('../../features/building/officeBuildingStore.js').BuildingSnapshot }} props */
function ElevatorPanel({ building }) {
  const buttons = elevatorButtonsFor({ current: building.floor, level: playerLevel() });
  return (
    <ul className="office-floor-elevator-panel" aria-label={BUILDING_COPY.elevatorTitle}>
      {buttons.map((entry) => {
        const name = BUILDING_COPY.floors[entry.id] ?? entry.id;
        const note = BUILDING_COPY.buttonNote(entry);
        return (
          <li key={entry.id}>
            <button
              type="button"
              className={`office-floor-elevator-button is-${entry.state}`}
              data-testid={`office-floor-elevator-go-${entry.id}`}
              data-state={entry.state}
              aria-label={BUILDING_COPY.buttonAria({ ...entry, name })}
              disabled={entry.state !== 'go'}
              onClick={() => rideElevatorTo(entry.id)}
            >
              <span className="office-floor-elevator-button-key" aria-hidden="true">
                {entry.button}
              </span>
              <span className="office-floor-elevator-button-name">
                <strong>{name}</strong>
                {note ? <span>{note}</span> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function cardBody(building) {
  if (building.ride) return BUILDING_COPY.riding(floorButtonLabel(building.ride.to));
  if (building.doorsOpen) return BUILDING_COPY.elevatorPick;
  if (building.call) return BUILDING_COPY.elevatorWaiting;
  return BUILDING_COPY.basementBody;
}

/**
 * The card's heading: the Machine Room's own while you are just stood in it,
 * the elevator's while it is doing something for you.
 *
 * @param {boolean} inBasementIdle
 */
function cardHead(inBasementIdle) {
  return inBasementIdle
    ? { eyebrow: BUILDING_COPY.basementEyebrow, glyph: '🗄️', title: BUILDING_COPY.basementTitle }
    : { eyebrow: BUILDING_COPY.elevatorEyebrow, glyph: '🛗', title: BUILDING_COPY.elevatorTitle };
}

/** @param {{ inBasementIdle: boolean, waiting: boolean }} props */
function ElevatorActions({ inBasementIdle, waiting }) {
  return (
    <div className="office-floor-card-actions">
      {inBasementIdle ? (
        <button
          type="button"
          className="office-floor-card-action office-floor-card-action--primary"
          data-testid="office-floor-elevator-call-card"
          onClick={() => callElevator()}
        >
          {BUILDING_COPY.basementLeave}
        </button>
      ) : null}
      {waiting ? (
        <button
          type="button"
          className="office-floor-card-action"
          data-testid="office-floor-elevator-close"
          onClick={() => closeElevatorDoors()}
        >
          {BUILDING_COPY.closeDoors}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The thing you walked up to in the Machine Room, in place of the floor's
 * introduction.
 *
 * @param {{ reading: { kind: 'rack' | 'prop', id: string } }} props
 */
function BasementReadout({ reading }) {
  const close = () => setBuildingReading(null);
  if (reading.kind === 'prop') return <PropReadout kind={reading.id} onClose={close} />;
  const manifest = getNightShiftManifest();
  const card = nightShiftCards(manifest).find((entry) => entry.id === reading.id);
  if (!card) return null;
  return <RackReadout card={card} shiftDate={manifest.shiftDate} onClose={close} />;
}

/**
 * @param {{ testId?: string }} props
 */
export function FloorElevatorCard({ testId = 'office-floor-elevator-card' }) {
  const building = useSyncExternalStore(
    subscribeBuilding,
    getBuildingSnapshot,
    getBuildingSnapshot
  );
  if (!isElevatorCardShown(building)) return null;
  if (building.reading && building.floor !== 'office') {
    return (
      <aside className="office-floor-card office-floor-card--elevator" data-testid={testId}>
        <BasementReadout reading={building.reading} />
      </aside>
    );
  }
  const waiting = Boolean(building.call || building.doorsOpen);
  const inBasementIdle = building.floor === 'basement' && !waiting && !building.ride;
  const head = cardHead(inBasementIdle);

  return (
    <aside className="office-floor-card office-floor-card--elevator" data-testid={testId}>
      <span className="office-floor-eyebrow">{head.eyebrow}</span>
      <div className="office-floor-card-head">
        <span className="office-floor-prop-glyph" aria-hidden="true">
          {head.glyph}
        </span>
        <div className="office-floor-card-id">
          <strong>{head.title}</strong>
        </div>
      </div>
      <p className="office-floor-card-blurb">{cardBody(building)}</p>
      {building.doorsOpen ? <ElevatorPanel building={building} /> : null}
      <ElevatorActions inBasementIdle={inBasementIdle} waiting={waiting} />
    </aside>
  );
}

export default FloorElevatorCard;
