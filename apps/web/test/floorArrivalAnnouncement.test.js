import { describe, expect, it } from 'vitest';
import { floorArrivalAnnouncement } from '../src/components/officeFloor/floorArrivalAnnouncement.js';
import { officeChromeCopy } from '../src/utils/officeCast.js';

const copy = officeChromeCopy().floor;

describe('floorArrivalAnnouncement', () => {
  it('names where bodies are, not what they said', () => {
    const reception = floorArrivalAnnouncement({
      copy,
      phase: 'reception',
      colleagueIndex: -1,
      speakingId: null
    });
    expect(reception.text).toMatch(/At reception/);
    expect(reception.text).not.toMatch(/Linda/);

    const colleague = floorArrivalAnnouncement({
      copy,
      phase: 'colleagues',
      colleagueIndex: 0,
      speakingId: 'intern'
    });
    expect(colleague.text).toMatch(/at their desk/);
    expect(colleague.text).toContain('Chad');
    expect(colleague.text).not.toMatch(/forty tabs/);
  });

  it('gives each colleague beat its own key', () => {
    const first = floorArrivalAnnouncement({
      copy,
      phase: 'colleagues',
      colleagueIndex: 0,
      speakingId: 'refine'
    });
    const second = floorArrivalAnnouncement({
      copy,
      phase: 'colleagues',
      colleagueIndex: 1,
      speakingId: 'innovate'
    });
    expect(first.key).not.toBe(second.key);
  });
});
