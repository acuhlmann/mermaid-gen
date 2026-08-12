// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficeFloor from '../src/components/OfficeFloor.jsx';
import { isSlopChatMessage, isSpokenLine } from '../src/utils/officeImThreads.js';
import { dwellLineFrom } from '../src/utils/officeFloorDwell.js';
import { _resetOfficeViewModeForTests, standUp } from '../src/state/officeViewModeStore.js';
import { setOfficeCaptions, setOfficeNarration } from '../src/state/officeMomentStore.js';

/**
 * The medium rule (`docs/office-parody.md` § 11).
 *
 * **Speech is spoken; writing is read.** A colleague standing in front of you
 * gets a voice; an email or a Slop Chat™ message does not, because you read
 * those yourself. The office has always intended this — `OfficeLayer`'s
 * narration callback says so in a comment — but the two media share one array
 * (`imHistory`, split only by `channel`), so the rule was one `continue` away
 * from being false and nothing checked it.
 *
 * It was in fact false on the floor. These tests exist so it cannot go quiet
 * again: the failure has no error, no warning and no visual tell except a
 * colleague saying something you typed.
 */

const CHAD = 'intern';

/** Exactly what a reload leaves behind: `persistImHistory` keeps Slop Chat only. */
function restoredIm(colleagueId, body) {
  return {
    id: `im-${colleagueId}`,
    colleagueId,
    body,
    createdAt: Date.now() - 86_400_000
  };
}

function spokenLine(colleagueId, body) {
  return {
    id: `talk-${colleagueId}`,
    colleagueId,
    body,
    channel: 'talk',
    createdAt: Date.now()
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  _resetOfficeViewModeForTests();
  setOfficeCaptions(false);
  setOfficeNarration(true);
});

describe('the two media are exact complements', () => {
  it('sorts every shape of message into exactly one medium', () => {
    const cases = [
      restoredIm(CHAD, 'typed'),
      { ...restoredIm(CHAD, 'typed'), channel: 'im' },
      spokenLine(CHAD, 'said')
    ];
    for (const msg of cases) {
      expect(isSpokenLine(msg), `${msg.channel ?? '(none)'} medium`).toBe(!isSlopChatMessage(msg));
    }
  });

  /*
   * The default is the trap. `pushOfficeImPing` omits `channel` entirely when it
   * is `'im'`, so a written message carries no marker at all — which means any
   * consumer that forgets the question silently treats writing as speech rather
   * than the other way round. Stated as a test because it is the reason this
   * bug was reachable.
   */
  it('treats an unmarked message as written, never as spoken', () => {
    const unmarked = restoredIm(CHAD, 'no channel field at all');
    expect(isSpokenLine(unmarked)).toBe(false);
    expect(isSlopChatMessage(unmarked)).toBe(true);
  });

  it('says nothing about a message that is not there', () => {
    expect(isSpokenLine(null)).toBe(false);
    expect(isSpokenLine(undefined)).toBe(false);
  });
});

describe('written media never reaches a voice', () => {
  /**
   * The regression, and it was at its worst on a **restored** session: only Slop
   * Chat lines survive a reload, so after a refresh every candidate the floor
   * could find was written. Walking up to anybody you had ever messaged made
   * them say it aloud in their own voice — a line from another day, delivered as
   * though they had just thought of it.
   */
  it('does not speak a restored Slop Chat message when you walk up to somebody', () => {
    setOfficeCaptions(true);
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: true }));
    standUp();
    render(
      <OfficeFloor
        imHistory={[restoredIm(CHAD, 'Quick one — is that the new architecture diagram?')]}
        onTalkGreet={vi.fn()}
        sceneHandlers={{ narrateLine }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    expect(screen.queryByTestId('office-floor-talk-line')).toBeNull();
    expect(narrateLine).not.toHaveBeenCalled();
  });

  /*
   * The companion claim, without which the one above passes for the wrong
   * reason — a floor that never speaks at all would satisfy it perfectly.
   */
  it('still speaks a line somebody actually said', () => {
    setOfficeCaptions(true);
    const narrateLine = vi.fn(() => Promise.resolve({ spoken: false }));
    standUp();
    render(
      <OfficeFloor
        imHistory={[spokenLine(CHAD, 'Is that the new architecture diagram?')]}
        onTalkGreet={vi.fn()}
        sceneHandlers={{ narrateLine }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Chad/ }));
    fireEvent.click(screen.getByRole('button', { name: /Go and talk/i }));

    expect(screen.getByTestId('office-floor-talk-line').textContent).toContain(
      'the new architecture diagram'
    );
  });

  /*
   * Slice 19's remark reads the same shared log. Its time bound already made
   * this unreachable in practice; the assertion is what stops the medium rule
   * depending on a *timestamp* to stay true.
   */
  it('will not let a dwell remark pick up a written message', () => {
    const spoke = { colleagueId: CHAD, at: Date.now() - 1_000 };
    const written = { ...restoredIm(CHAD, 'typed just now'), createdAt: Date.now() };
    expect(dwellLineFrom([written], spoke)).toBe('');
    expect(dwellLineFrom([spokenLine(CHAD, 'said just now')], spoke)).toBe('said just now');
  });
});
