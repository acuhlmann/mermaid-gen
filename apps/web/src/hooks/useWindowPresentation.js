import { useNarrowLayout, usePhoneLayout } from './useAppLayoutMedia.js';

/**
 * How a `FloatingWindow` is placed. The window's *identity* (open, focused,
 * minimized, title, kind) is presentation-agnostic and lives in `overlayStack`;
 * this is only where it goes on screen — the same split ADR-0011 rule 1 makes
 * for the office floor.
 *
 * @typedef {'floating' | 'docked' | 'sheet'} WindowPresentation
 */

/**
 * Resolve the placement mode for the current viewport.
 *
 * - `sheet` (≤639px) — bottom sheet with snap points. No free position, so no
 *   arithmetic can put a window off-screen; this is what fixes the clipping
 *   structurally rather than by tuning the clamp (docs/office-window-manager.md §5A).
 * - `docked` (640–1024px) — a fixed panel above the bottom chrome. Also catches
 *   landscape phones, where a bottom sheet has no vertical room to give.
 * - `floating` (≥1025px) — free dragging, unchanged. There was never a
 *   complaint about it, and dragging is the parody-OS diegesis working.
 *
 * No new breakpoints: both queries come from `layoutBreakpoints.js`.
 *
 * @returns {WindowPresentation}
 */
export function useWindowPresentation() {
  const phone = usePhoneLayout();
  const narrow = useNarrowLayout();
  if (phone) return 'sheet';
  if (narrow) return 'docked';
  return 'floating';
}
