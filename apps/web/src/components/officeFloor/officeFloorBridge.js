/**
 * Integration contract between renderer #1 (`OfficeLayer`) and renderer #2
 * (`OfficeFloor`). One object at the boundary keeps the coupling surface
 * explicit and easier to evolve than a growing prop list (ADR-0011).
 */

/**
 * @typedef {object} OfficeFloorSceneHandlers
 * @property {((line: { speakerId?: string, text?: string }) => Promise<{ spoken?: boolean }> | { spoken?: boolean }) | undefined} narrateLine
 * @property {((line: { speakerId?: string, text?: string }) => void) | undefined} prefetchLine
 * @property {(() => void) | undefined} onAcceptCoffee
 * @property {(() => void) | undefined} onDeclineCoffee
 * @property {(() => void) | undefined} onCoffeeDone
 * @property {(() => void) | undefined} onAcceptBattle
 * @property {(() => void) | undefined} onDeclineBattle
 * @property {((colleagueId: string) => void) | undefined} onVoteBattle
 * @property {(() => void) | undefined} onBattleDone
 */

/**
 * @typedef {object} OfficeFloorMeetingHandlers
 * @property {(() => void) | undefined} onInterject
 * @property {(() => void) | undefined} onLeave
 */

/**
 * @typedef {object} OfficeFloorBridge
 * @property {Array<{ colleagueId: string, body: string, outbound?: boolean }>} imHistory
 * @property {{ id: string, colleagueId: string, body: string, actionPrompt?: string } | null} walkBy
 * @property {((colleagueId: string) => void) | undefined} onMessage
 * @property {((colleagueId: string) => Promise<void> | void) | undefined} onTalkGreet
 * @property {((colleagueId: string, body: string) => Promise<void> | void) | undefined} onTalkReply
 * @property {((colleagueId: string) => Promise<unknown> | unknown) | undefined} onDwellRemark
 *   Somebody looks up because you have been stood next to them (§ 5 slice 19).
 *
 *   Named for the *event*, not for the verb behind it, the same way `onPropCue`
 *   and `onFloorCue` are: the floor reports that you loitered, and renderer #1
 *   decides that this costs an LLM call from a capped budget and lands as a
 *   `talk`-channel line. Moving that decision across the boundary would put the
 *   office's appetite in two places (ADR-0011 — one wiring point).
 * @property {((colleagueId: string | null) => void) | undefined} onTalkingChange
 * @property {(() => Promise<boolean> | boolean) | undefined} onGetCoffee
 * @property {((propKind: string) => void) | undefined} onPropCue
 * @property {((cue: 'step' | 'jam' | 'door', options?: { near?: boolean, pan?: number, surface?: 'carpet' | 'hard' }) => void) | undefined} onFloorCue
 *   Floor events that are not a prop. Sibling of `onPropCue` and deliberately
 *   the same shape of contract: the floor names *what happened*, never which
 *   sample to play, so the sound layer stays on `OfficeLayer`'s side of the
 *   boundary along with the other event cues (ADR-0011 — one wiring point).
 * @property {((prompt: string, colleagueId: string) => void) | undefined} onAdoptPrompt
 * @property {((id: string) => void) | undefined} onDismissWalkBy
 * @property {unknown} coffee
 * @property {unknown} battle
 * @property {OfficeFloorSceneHandlers} sceneHandlers
 * @property {unknown} meeting
 * @property {OfficeFloorMeetingHandlers} meetingHandlers
 * @property {unknown} huddle
 * @property {{
 *   onHardStop?: () => void,
 *   onAdoptPrompt?: (prompt: string, colleagueId: string) => void,
 *   onRequestSuggestion?: (speakerId: string) => Promise<any>,
 *   narrateLine?: (line: any) => Promise<{ spoken?: boolean }>,
 *   prefetchLine?: (line: any) => void,
 *   onCancelNarration?: () => void
 * }} huddleHandlers
 * @property {import('../../hooks/useHuddleRingControls.js').default | ReturnType<import('../../hooks/useHuddleRingControls.js').useHuddleRingControls>} [huddleRing]
 * @property {{ coffeeVisibleLines?: number, coffeeLineSpoken?: boolean, battleVisibleLines?: number, battleLineSpoken?: boolean, battleLinesDone?: boolean }} [scenePacing]
 * @property {import('../../utils/officeFloorBoard.js').BoardState | null} [board]
 *   What *you* are working on, for the surfaces that can show it (§ 5 slice 16).
 *
 *   A **sample**, not a subscription, and that is the whole design. `OfficeLayer`
 *   receives the diagram as getters precisely so the office does not re-render
 *   while you type; putting a live diagram subscription behind this field would
 *   repaint sixteen animated figures per keystroke. It is refreshed on the edges
 *   that mean "the work changed" — a completed run, standing up, a meeting
 *   opening — which is also the truer fiction: a whiteboard shows what was
 *   *drawn* on it.
 */

/** Empty bridge for tests and mount points that only need defaults. */
export const EMPTY_OFFICE_FLOOR_BRIDGE = /** @type {OfficeFloorBridge} */ ({
  imHistory: [],
  walkBy: null,
  coffee: null,
  battle: null,
  sceneHandlers: {},
  meeting: null,
  meetingHandlers: {},
  huddle: null,
  huddleHandlers: {},
  huddleRing: null,
  scenePacing: {},
  board: null
});

/**
 * Merge partial overrides onto the empty bridge. Tests pass only the fields
 * they care about; `OfficeLayer` builds the full object from live state.
 *
 * @param {Partial<OfficeFloorBridge>} partial
 * @returns {OfficeFloorBridge}
 */
export function createOfficeFloorBridge(partial = {}) {
  return { ...EMPTY_OFFICE_FLOOR_BRIDGE, ...partial };
}

export default createOfficeFloorBridge;
