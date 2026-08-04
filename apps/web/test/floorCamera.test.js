import { describe, expect, it } from 'vitest';
import {
  CAMERA_BOOSTS,
  CAMERA_MAX_SCALE,
  MEETING_CAMERA_BIAS,
  autoPanPresenceFor,
  cameraFocusFor,
  cameraScaleFor,
  isPhysicalFloorMeeting
} from '../src/components/officeFloor/floorCamera.js';
import { COFFEE_TILES, HUDDLE_TILES } from '../src/utils/officeFloorPlan.js';

const MEETING = { id: 'sync-1', state: 'playing', attendees: ['gilfoyle'] };
const COFFEE = { id: 'coffee-1', lines: [{ speakerId: 'chad', text: 'Up for coffee?' }] };
const BATTLE = { id: 'battle-1', lines: [{ speakerId: 'gilfoyle', text: 'Tabs.' }] };
const HUDDLE = { id: 'huddle-1', attendees: ['gilfoyle', 'dinesh'] };
const TALK_PRESENCE = {
  from: { x: 7, y: 7 },
  to: { x: 4, y: 5 },
  phase: 'walking',
  key: 3,
  intent: { kind: 'talk', colleagueId: 'chad' },
  homeward: false
};

describe('the priority ladder', () => {
  it('is idle when nothing is happening', () => {
    expect(cameraFocusFor({})).toBeNull();
    expect(
      cameraFocusFor({
        meeting: null,
        huddle: null,
        coffee: null,
        battle: null,
        presence: null
      })
    ).toBeNull();
  });

  it('frames the glass room for a physical meeting, and nobody else', () => {
    const focus = cameraFocusFor({
      meeting: MEETING,
      huddle: HUDDLE,
      coffee: COFFEE,
      battle: BATTLE,
      presence: TALK_PRESENCE
    });
    expect(focus.key).toBe('meeting:sync-1');
    expect(focus.boost).toBe(CAMERA_BOOSTS.meeting);
    expect(focus.bias).toBe(MEETING_CAMERA_BIAS);
  });

  it('ignores remote headset syncs — there is no room to frame', () => {
    expect(
      cameraFocusFor({ meeting: { ...MEETING, modality: 'remote' }, coffee: COFFEE }).key
    ).toBe('scene:coffee:coffee-1:0');
    expect(
      cameraFocusFor({ meeting: { ...MEETING, modality: 'remote' }, presence: TALK_PRESENCE }).key
    ).toBe('social:talk:chad');
  });

  it('ignores cancelled meetings', () => {
    expect(cameraFocusFor({ meeting: { ...MEETING, state: 'cancelled' } })).toBeNull();
  });

  it('frames the ring when the team crowds your desk', () => {
    const focus = cameraFocusFor({ huddle: HUDDLE, coffee: COFFEE, presence: TALK_PRESENCE });
    expect(focus.key).toBe('huddle:huddle-1');
    expect(focus.boost).toBe(CAMERA_BOOSTS.huddle);
    const cx = HUDDLE_TILES.reduce((sum, tile) => sum + tile.x, 0) / HUDDLE_TILES.length;
    const cy = HUDDLE_TILES.reduce((sum, tile) => sum + tile.y, 0) / HUDDLE_TILES.length;
    expect(focus.tile.x).toBeCloseTo(cx);
    expect(focus.tile.y).toBeCloseTo(cy);
  });

  it('frames a set piece from the invite onward', () => {
    const invite = cameraFocusFor({ coffee: COFFEE });
    expect(invite.key).toBe('scene:coffee:coffee-1:0');
    expect(invite.tile.x).toBe((COFFEE_TILES[0].x + COFFEE_TILES[1].x) / 2);
    expect(invite.tile.y).toBe((COFFEE_TILES[0].y + COFFEE_TILES[1].y) / 2);

    // Accepting is a new beat at the same location — a key change, so an
    // override made at the invite does not stick once the break starts.
    expect(cameraFocusFor({ coffee: { ...COFFEE, accepted: true } }).key).toBe(
      'scene:coffee:coffee-1:1'
    );
    expect(cameraFocusFor({ battle: { ...BATTLE, accepted: true } }).key).toBe(
      'scene:battle:battle-1:1'
    );
  });

  it('prefers coffee over battle when both somehow run', () => {
    expect(cameraFocusFor({ coffee: COFFEE, battle: BATTLE }).key).toBe('scene:coffee:coffee-1:0');
  });

  it('frames your own walk-with-reason from the first step', () => {
    const walking = cameraFocusFor({ presence: TALK_PRESENCE });
    expect(walking.key).toBe('social:talk:chad');
    expect(walking.tile).toEqual(TALK_PRESENCE.to);
    expect(walking.boost).toBe(CAMERA_BOOSTS.social);
    expect(walking.bias).toBe(0);

    const peek = cameraFocusFor({
      presence: { ...TALK_PRESENCE, intent: { kind: 'peek', colleagueId: 'pam' } }
    });
    expect(peek.key).toBe('social:peek:pam');

    const prop = cameraFocusFor({
      presence: { ...TALK_PRESENCE, intent: { kind: 'use', propKind: 'coffeeMachine' } }
    });
    expect(prop.key).toBe('social:use:coffeeMachine');
  });

  it('stays wide for free roaming and the walk home', () => {
    expect(cameraFocusFor({ presence: { ...TALK_PRESENCE, intent: null } })).toBeNull();
    expect(
      cameraFocusFor({
        presence: {
          ...TALK_PRESENCE,
          intent: { kind: 'talk', colleagueId: 'chad' },
          homeward: true
        }
      })
    ).toBeNull();
  });

  it('scene outranks your own conversation when both are on', () => {
    expect(cameraFocusFor({ coffee: COFFEE, presence: TALK_PRESENCE }).key).toBe(
      'scene:coffee:coffee-1:0'
    );
  });
});

describe('isPhysicalFloorMeeting', () => {
  it('keeps the modality semantics the floor was written against', () => {
    expect(isPhysicalFloorMeeting(MEETING)).toBe(true);
    expect(isPhysicalFloorMeeting({ ...MEETING, modality: 'remote' })).toBe(false);
    expect(isPhysicalFloorMeeting({ ...MEETING, modality: 'physical' })).toBe(true);
    expect(isPhysicalFloorMeeting({ ...MEETING, state: 'cancelled' })).toBe(false);
    expect(isPhysicalFloorMeeting(null)).toBe(false);
  });
});

describe('cameraScaleFor', () => {
  it('is the fit scale when nothing is framed', () => {
    expect(cameraScaleFor(0.9, null)).toBe(0.9);
  });

  it('never shrinks below the fit scale', () => {
    // A boost under 1 would be a camera zooming out on a moment — never.
    expect(cameraScaleFor(0.9, 0.5)).toBe(0.9);
    // And at MAX_SCALE the fit is already the ceiling.
    expect(cameraScaleFor(CAMERA_MAX_SCALE, CAMERA_BOOSTS.meeting)).toBe(CAMERA_MAX_SCALE);
  });

  it('multiplies and clamps at the ceiling', () => {
    expect(cameraScaleFor(1, CAMERA_BOOSTS.meeting)).toBeCloseTo(1.38);
    expect(cameraScaleFor(1.3, CAMERA_BOOSTS.meeting)).toBe(CAMERA_MAX_SCALE);
  });
});

describe('autoPanPresenceFor hands the pan to the camera or the fallback', () => {
  it('yields the presence to the phone-overflow auto-pan only when idle', () => {
    expect(autoPanPresenceFor(null, TALK_PRESENCE)).toBe(TALK_PRESENCE);
    expect(autoPanPresenceFor(cameraFocusFor({ coffee: COFFEE }), TALK_PRESENCE)).toBeNull();
  });
});

describe('the boost table is the one tuning place', () => {
  it('keeps scenes tightest of the crowd moments and meetings widest', () => {
    expect(CAMERA_BOOSTS.meeting).toBeGreaterThanOrEqual(CAMERA_BOOSTS.scene);
    expect(CAMERA_BOOSTS.scene).toBeGreaterThan(CAMERA_BOOSTS.huddle);
    expect(CAMERA_BOOSTS.huddle).toBeGreaterThan(1);
    expect(CAMERA_BOOSTS.social).toBeGreaterThan(1);
  });

  it('keeps every boost inside the ceiling', () => {
    for (const boost of Object.values(CAMERA_BOOSTS)) {
      expect(cameraScaleFor(1.1, boost)).toBeLessThanOrEqual(CAMERA_MAX_SCALE);
    }
  });
});
