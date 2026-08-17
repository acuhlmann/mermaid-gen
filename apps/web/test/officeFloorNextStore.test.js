import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetOfficeFloorActionForTests,
  getOfficeFloorAction,
  requestFloorSceneJoin,
  requestFloorShopJoin
} from '../src/state/officeFloorActionStore.js';
import {
  _resetOfficeFloorNextForTests,
  clearOfficeFloorNext,
  getOfficeFloorNext,
  setOfficeFloorNext
} from '../src/state/officeFloorNextStore.js';

afterEach(() => {
  _resetOfficeFloorNextForTests();
  _resetOfficeFloorActionForTests();
});

describe('officeFloorNextStore', () => {
  it('publishes shop and scene join offers for the strip', () => {
    setOfficeFloorNext({
      shopJoin: {
        colleagueId: 'chad',
        partnerId: 'intern',
        mark: { x: 2, y: 3 }
      },
      sceneJoin: {
        colleagueId: 'gilfoyle',
        participants: ['gilfoyle', 'dinesh'],
        kind: 'coffee'
      }
    });
    expect(getOfficeFloorNext().shopJoin?.colleagueId).toBe('chad');
    expect(getOfficeFloorNext().sceneJoin?.kind).toBe('coffee');
  });

  it('clears on unmount', () => {
    setOfficeFloorNext({
      shopJoin: {
        colleagueId: 'chad',
        partnerId: 'intern',
        mark: { x: 2, y: 3 }
      }
    });
    clearOfficeFloorNext();
    expect(getOfficeFloorNext()).toEqual({ shopJoin: null, sceneJoin: null });
  });
});

describe('officeFloorActionStore', () => {
  it('bumps a shop-join request with a mark', () => {
    requestFloorShopJoin('chad', { x: 4, y: 5 });
    expect(getOfficeFloorAction()).toEqual({
      actionNonce: 1,
      request: { type: 'floorTalk', colleagueId: 'chad', mark: { x: 4, y: 5 } }
    });
  });

  it('bumps a scene-join request by kind', () => {
    requestFloorSceneJoin('battle');
    expect(getOfficeFloorAction().request).toEqual({
      type: 'floorSceneJoin',
      kind: 'battle'
    });
  });
});
