import { useEffect, useRef } from 'react';
import { readOfficeWelcomeSeen, writeOfficeWelcomeSeen } from '../utils/officeAmbienceStorage.js';
import { fillOfficeSlots, officeWelcomeEmail, officeWelcomeIm } from '../utils/officeCast.js';
import {
  getOfficeSnapshot,
  pushOfficeEmail,
  pushOfficeImPing
} from '../state/officeMomentStore.js';

/** Fallback when the user never touches the page — deliver the email anyway. */
export const WELCOME_FALLBACK_MS = 15_000;
/** Delay after the first interaction, so the "You've got mail" cue can play
 * (the sound gate requires a user gesture) right as the user settles in. */
export const WELCOME_AFTER_INTERACTION_MS = 1_500;
/** Chad follows up a beat after Linda's email. */
export const WELCOME_IM_DELAY_MS = 8_000;

/**
 * First-run office onboarding (docs/office-parody.md): once ever, Linda's
 * welcome email introduces the floor, then Chad IMs a beat later. Timed off
 * the user's first pointer/key gesture so the mail chime (and the "You've got
 * mail!" announce) isn't swallowed by the autoplay gate; falls back to a plain
 * timer for users who only watch. Respects Focus Time and never re-fires —
 * the ambience cadence takes over from here.
 *
 * @param {{ getUserTitle?: () => string }} params
 */
export function useOfficeWelcome(params = {}) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    if (readOfficeWelcomeSeen()) return undefined;

    let delivered = false;
    const timers = new Set();
    const later = (fn, ms) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        fn();
      }, ms);
      timers.add(timer);
    };

    const deliver = () => {
      if (delivered) return;
      delivered = true;
      // Focus Time on a first run means the user restored a muted office —
      // honor it and skip onboarding entirely rather than nag later.
      writeOfficeWelcomeSeen();
      if (getOfficeSnapshot().focusTime) return;
      const slots = { userTitle: paramsRef.current.getUserTitle?.() ?? '' };
      const email = officeWelcomeEmail();
      pushOfficeEmail({
        colleagueId: email.colleagueId,
        subject: fillOfficeSlots(email.subject, slots),
        body: fillOfficeSlots(email.body, slots)
      });
      later(() => {
        if (getOfficeSnapshot().focusTime) return;
        const im = officeWelcomeIm();
        pushOfficeImPing({
          colleagueId: im.colleagueId,
          body: fillOfficeSlots(im.body, slots)
        });
      }, WELCOME_IM_DELAY_MS);
    };

    const onFirstInteraction = () => {
      removeListeners();
      later(deliver, WELCOME_AFTER_INTERACTION_MS);
    };
    const removeListeners = () => {
      if (typeof window === 'undefined') return;
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', onFirstInteraction);
      window.addEventListener('keydown', onFirstInteraction);
    }
    later(deliver, WELCOME_FALLBACK_MS);

    return () => {
      removeListeners();
      for (const timer of timers) clearTimeout(timer);
    };
  }, []);
}
