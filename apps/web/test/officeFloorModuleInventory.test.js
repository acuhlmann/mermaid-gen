import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Floor components agents should not delete or rename without updating tests.
 * Source: ADR-0011 + docs/office-isometric-mode.md §7 bench list.
 */
const EXPECTED_OFFICE_FLOOR_COMPONENTS = [
  'FloorActors.jsx',
  'FloorArrival.jsx',
  'FloorBubble.jsx',
  'FloorCardSlot.jsx',
  'FloorCommuters.jsx',
  'FloorDeskSpeech.jsx',
  'FloorErrand.jsx',
  'FloorFigure.jsx',
  'HeldItem.jsx',
  'FloorLiveRegion.jsx',
  'FloorHuddle.jsx',
  'FloorMeeting.jsx',
  'FloorPanel.jsx',
  'FloorPeek.jsx',
  'FloorPersonButton.jsx',
  'FloorPersonCard.jsx',
  'FloorPlayer.jsx',
  'FloorProps.jsx',
  'FloorRoam.jsx',
  'FloorRoom.jsx',
  'FloorScenes.jsx',
  'FloorSeat.jsx',
  'FloorStage.jsx',
  'FloorTalk.jsx',
  'FloorTopBar.jsx',
  'FloorWalker.jsx',
  'FloorWallClock.jsx',
  'FloorWanderer.jsx',
  'floorAnnouncement.js',
  'floorCamera.js',
  'isoArt.jsx',
  'useFloorActivity.js',
  'useFloorAutoPan.js',
  'useFloorAway.js',
  'useFloorCamera.js',
  'useFloorCommute.js',
  'useFloorDwell.js',
  'useFloorKeyboard.js',
  'useFloorPresence.js',
  'useFloorPropUse.js',
  'useFloorShopTalk.js',
  'useFloorTalk.js',
  'useFloorWander.js',
  'useFloorWalker.js',
  'useOfficeDayPhase.js',
  'useOfficeWallClock.js',
  'useWalkAnimation.js',
  'viewTransition.js'
];

const EXPECTED_FLOOR_UTILS = [
  'officeFloorPlan.js',
  'officeFloorMovement.js',
  'officeFloorWander.js',
  'officeFloorReach.js',
  'officeFloorInterrupt.js',
  'officeFloorDwell.js',
  'officeFloorShopTalk.js',
  'officeFloorProps.js',
  'officeDeskWork.js',
  'officeFloorActivity.js',
  'officeFloorBoard.js',
  'officeFloorCommute.js',
  'officeSceneCast.js',
  'officeFloorRunIdle.js'
];

const EXPECTED_FLOOR_TEST_FILES = [
  'officeFloor.test.jsx',
  'officeFloorAccess.test.jsx',
  'officeFloorActivity.test.jsx',
  'officeFloorArrival.test.jsx',
  'officeFloorCamera.test.jsx',
  'officeFloorContracts.test.js',
  'officeFloorHuddle.test.jsx',
  'officeFloorMeeting.test.jsx',
  'officeFloorMovement.test.js',
  'officeFloorModuleInventory.test.js',
  'officeFloorPeek.test.jsx',
  'officeFloorPlan.test.js',
  'officeFloorProps.test.jsx',
  'officeFloorShopTalk.test.jsx',
  'officeFloorBoard.test.js',
  'officeFloorCommute.test.js',
  'officeFloorCommuters.test.jsx',
  'officeFloorPropsTable.test.js',
  'officeFloorReach.test.js',
  'officeFloorInterrupt.test.js',
  'officeFloorDwell.test.jsx',
  'officeFloorRunIdle.test.js',
  'officeFloorRoam.test.jsx',
  'officeFloorScene.test.jsx',
  'officeFloorStyles.test.js',
  'officeFloorTalk.test.jsx',
  'officeFloorViewTransition.test.js',
  'officeFloorWallClock.test.jsx',
  'officeFloorWander.test.jsx',
  'useFloorArrivalFocus.test.jsx',
  'useFloorAway.test.jsx',
  'floorCamera.test.js',
  'officeLayerFloorRenderer.test.jsx',
  'officeDeskWork.test.js',
  'useOfficeDayPhase.test.jsx',
  'useWalkAnimation.test.jsx',
  'helpers/officeFloorTestUtils.jsx'
];

describe('isometric mode module inventory', () => {
  it('keeps every bench-listed officeFloor component', () => {
    const dir = path.join(ROOT, 'src/components/officeFloor');
    const onDisk = fs.readdirSync(dir);
    for (const name of EXPECTED_OFFICE_FLOOR_COMPONENTS) {
      expect(onDisk, `missing officeFloor/${name}`).toContain(name);
    }
  });

  it('keeps pure geometry and scene util modules', () => {
    const utilsDir = path.join(ROOT, 'src/utils');
    for (const name of EXPECTED_FLOOR_UTILS) {
      expect(fs.existsSync(path.join(utilsDir, name)), `missing utils/${name}`).toBe(true);
    }
  });

  it('keeps the documented floor test suite files', () => {
    const testDir = path.join(ROOT, 'test');
    for (const rel of EXPECTED_FLOOR_TEST_FILES) {
      expect(fs.existsSync(path.join(testDir, rel)), `missing test/${rel}`).toBe(true);
    }
  });

  it('mounts renderer #2 from OfficeLayer', () => {
    const layer = fs.readFileSync(path.join(ROOT, 'src/components/OfficeLayer.jsx'), 'utf8');
    expect(layer).toMatch(/OfficeFloor/);
    expect(layer).toMatch(/officeViewModeStore/);
  });
});
