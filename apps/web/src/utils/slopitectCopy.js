/**
 * Slopitect Cinematic Universe copy bank.
 *
 * - Phase ceremony labels per variant (enterprise-architecture parody).
 * - Variant personas, taglines, completion blurbs.
 * - Idle "tip of the day" rotation.
 * - Achievement copy + XP rewards.
 *
 * Keep all user-facing strings here so they can be tuned without touching components.
 * Locale overrides merge at runtime via `setActiveSlopitectBundle`.
 */

import { SLOPITECT_GAMIFICATION_EN } from '../i18n/locales/slopitectGamification.en.js';
import { resolvePhaseCeremonyRow } from './phaseLabelResolution.js';

let activeSlopitectBundle = null;

/** @param {Record<string, unknown> | null} bundle */
export function setActiveSlopitectBundle(bundle) {
  activeSlopitectBundle = bundle;
}

function slop() {
  return activeSlopitectBundle;
}

/** Localized short persona name override when set. */
export function slopitectShortName(variant) {
  return slop()?.ACTION_PERSONA_SHORT_NAMES?.[variant] ?? null;
}

export const VARIANT_PERSONAS = {
  refine: {
    name: 'THE Engineer',
    title: 'Builder of useful next steps',
    tagline: 'One careful, useful extension at a time.',
    avatarEmoji: '👷',
    entryLine: 'Engineering the next step…',
    exitLine: 'Shipped a useful bit 🧰',
    accentColorVar: '--accent',
    xpAward: 25,
    xpStreakBonus: 5
  },
  innovate: {
    name: 'Chief Innovation Officer',
    title: 'Disruptor at Large',
    tagline: 'Courageous moves on the subject at hand.',
    avatarEmoji: '⚡',
    entryLine: 'Pivot incoming…',
    exitLine: 'Disrupted 🚀',
    accentColorVar: '#9333ea',
    xpAward: 30,
    xpStreakBonus: 6
  },
  goMad: {
    name: 'THE SLOPITECT',
    title: 'Distinguished Chaos Fellow',
    tagline: 'GENIUS LOOSE 🚨',
    avatarEmoji: '🪖',
    entryLine: 'THE SLOPITECT HAS ENTERED THE BUILDING',
    exitLine: 'BUILT IT BACK BETTER 🛠',
    accentColorVar: '#ec4899',
    xpAward: 40,
    xpStreakBonus: 15
  },
  critique: {
    name: 'The Auditor',
    title: 'Compliance Inspector',
    tagline: 'Co-Design review in session.',
    avatarEmoji: '📋',
    entryLine: 'Audit commenced.',
    exitLine: 'Filed. Stamped. 🔴',
    accentColorVar: '#b91c1c',
    xpAward: 25,
    xpStreakBonus: 5
  },
  explain: {
    name: 'The Wise Architect',
    title: 'Principal Tech Evangelist',
    tagline: 'Co-Design story time — gather round.',
    avatarEmoji: '🧙',
    entryLine: 'Picture, if you will…',
    exitLine: 'Architecture explained 📜',
    accentColorVar: '#0d9488',
    xpAward: 25,
    xpStreakBonus: 5
  },
  exec: {
    name: 'The VP',
    title: 'SVP of Synergy & Co-Design',
    tagline: 'Synergy and Co-Design — boiled down for the board.',
    avatarEmoji: '👔',
    entryLine: 'Co-Designing the north star…',
    exitLine: 'Synergy Co-Designed ✅',
    accentColorVar: '#1e3a8a',
    xpAward: 30,
    xpStreakBonus: 6
  }
};

/** Chrome "weigh in" prompt — primary label vs funny role tag (avoids duplicate text on the button). */
export const PROMPT_ACTION_COPY = {
  label: 'Weigh In',
  roleTag: 'Just Say It',
  roleEmoji: '🗣️',
  title: 'Weigh In · Share your thoughts on the matter'
};

/** Mute / unmute stakeholders chrome action — role pill always names who you are silencing. */
export const STAKEHOLDERS_MUTE_COPY = {
  stakeholdersTag: 'Your Team',
  watchingEmoji: '👀',
  stakeholdersEmoji: '👥'
};

/**
 * Random one-liner barks the SlopitectCompanion speech bubble cycles through.
 * Pure flavor — enterprise-architecture parody.
 */
export const VARIANT_QUOTES = {
  refine: [
    'One useful next step at a time.',
    'Small piece, well-fitted.',
    'Extending the idea — gently.',
    'What belongs here that isn’t here yet?',
    'A step is missing between these two.',
    'Tightening the joint, not the whole frame.',
    'Build on what’s working.',
    'One more block. The right one.',
    'Adds up over time.'
  ],
  innovate: [
    'What if we extended this further?',
    'There’s a bolder shape hiding in here.',
    'Half a step too far — on purpose.',
    'New angle on the same subject.',
    'Reframe before you redraw.',
    'Two ideas, one canvas — try it.',
    'Push the edge case, see what falls out.',
    'Disrupt or be disrupted.',
    'A flywheel could fit here.',
    'It’s giving Series B.'
  ],
  goMad: [
    'WHAT IF THERE WERE TWELVE OF THIS THING',
    'ROTATE EVERYTHING 90° AND CALL IT INSIGHT',
    'GIVE EACH BOX A RIVAL THAT DOES THE OPPOSITE',
    'MERGE THE FIRST AND LAST STEP INTO A SECRET LOOP',
    'REWRITE EVERY LABEL IN BACKWARDS LATIN',
    'ADD A SECRET TUNNEL BETWEEN UNRELATED BOXES',
    'WHAT IF THE WHOLE DIAGRAM WAS A SONG',
    'EVERY ARROW IS NOW A QUESTION',
    'WHY IS THERE ONLY ONE DATABASE',
    'I AM THE ARCHITECTURE NOW',
    'THE DIAGRAM WAS THE FRIENDS WE MADE',
    'JUST WRAP IT IN A LAMBDA'
  ],
  critique: [
    'I’m raising a P2 about this.',
    'No accountability assigned.',
    'Where is the runbook?',
    'Risk is unowned. Filing it.',
    'Cite your sources.',
    'Two undefined edge cases, minimum.',
    'This will not survive contact with the user.',
    'Flagging in the next review.',
    'Did you know: most diagrams fail on the second viewer.',
    'Why is this not in Confluence?'
  ],
  explain: [
    'Picture, if you will…',
    'Notice the symmetry few people see.',
    'There is a named pattern here. There always is.',
    'Did you know: every diagram is a small theory of the world.',
    'A diagram is a frozen argument.',
    'In a perfect world, you’d never draw it like this.',
    'This is the shape of an idea, not the idea.',
    'Allow me to gesture vaguely.',
    'The path of least confusion is forward.',
    'Every box is a verb in disguise.',
    'Fun fact nobody asked for, incoming.',
    'Legend has it this has a name. It does.',
    'Let me over-explain exactly one detail…',
    'Beautiful in theory, awkward in practice — my favorite kind.',
    'Strange but true: this shape is older than the software.'
  ],
  exec: [
    'Boil this down for the board.',
    'Where’s the north star here?',
    'Just three bullets, please.',
    'Ladder it up to the OKR.',
    'Send me the one-pager.',
    'What does this mean for the customer journey?',
    'MVP slice only.',
    'Did you know I have a hard stop in four minutes?',
    'Synergize the redundancies.',
    'Circle back at the 30,000-foot view.',
    'Kill your darlings. Ship the headline.',
    'This box needs a workshop, not a diagram.',
    'Are we deciding or just drawing boxes?',
    'The board wants the headline, not the subgraph.',
    'Three boxes. That’s the slide.'
  ]
};

export function variantQuotes(variant) {
  const quotes = slop()?.VARIANT_QUOTES?.[variant] ?? VARIANT_QUOTES[variant];
  return Array.isArray(quotes) ? quotes : [];
}

/** Pick a quote by rotation index (stable, no random). */
export function quoteForRotation(variant, rotationIndex) {
  const quotes = variantQuotes(variant);
  if (!quotes.length) return '';
  const safe = Math.max(0, Number.isFinite(rotationIndex) ? Math.trunc(rotationIndex) : 0);
  return quotes[safe % quotes.length];
}

const FALLBACK_PERSONA = {
  name: 'Slopitect',
  title: 'Architect',
  tagline: 'Slopitect engine online.',
  accentColorVar: 'var(--accent)',
  xpAward: 15,
  xpStreakBonus: 4
};

export function getVariantPersona(variant) {
  return slop()?.VARIANT_PERSONAS?.[variant] ?? VARIANT_PERSONAS[variant] ?? FALLBACK_PERSONA;
}

export function getVariantTagline(variant) {
  return slop()?.VARIANT_TAGLINES?.[variant] ?? VARIANT_TAGLINES[variant] ?? '';
}

export function getVariantBootHeadline(variant) {
  return slop()?.VARIANT_BOOT_HEADLINES?.[variant] ?? VARIANT_BOOT_HEADLINES[variant] ?? '';
}

export function getAchievements() {
  return slop()?.ACHIEVEMENTS ?? ACHIEVEMENTS;
}

export function getVariantMasteryAchievements() {
  return slop()?.VARIANT_MASTERY_ACHIEVEMENTS ?? VARIANT_MASTERY_ACHIEVEMENTS;
}

export function getLevelUpBanner() {
  return slop()?.LEVEL_UP_BANNER ?? LEVEL_UP_BANNER;
}

export function getKonamiAchievement() {
  return slop()?.KONAMI_ACHIEVEMENT ?? KONAMI_ACHIEVEMENT;
}

export function getConsoleStampLines() {
  return slop()?.CONSOLE_STAMP_LINES ?? CONSOLE_STAMP_LINES;
}

export function getPromptEasterEggs() {
  return slop()?.PROMPT_EASTER_EGGS ?? PROMPT_EASTER_EGGS;
}

export function getLevels() {
  return slop()?.LEVELS ?? LEVELS;
}

export function getPrestigeTiers() {
  return slop()?.PRESTIGE_TIERS ?? PRESTIGE_TIERS;
}

export function getLevelPanelCopy() {
  return slop()?.LEVEL_PANEL ?? SLOPITECT_GAMIFICATION_EN.LEVEL_PANEL;
}

export function getPrestigePromotionCopy() {
  return slop()?.PRESTIGE_PROMOTION ?? SLOPITECT_GAMIFICATION_EN.PRESTIGE_PROMOTION;
}

/** Full persona line for roster row tooltips (name · title · tagline). */
export function stakeholderTooltip(variant) {
  const p = getVariantPersona(variant);
  return `${p.name} · ${p.title} · ${p.tagline}`;
}

/**
 * Maps real phase ids → ceremony labels per variant. When a variant entry is absent
 * the renderer should fall back to the canonical label from the SSE event itself.
 */
export const PHASE_CEREMONIES = {
  analyze: {
    refine: 'Reading the diagram…',
    innovate: 'Scoping the pivot…',
    goMad: 'Eyeballing the slop 👀',
    critique: 'Opening JIRA…',
    explain: 'Pondering the diagram…',
    exec: 'Skimming the deck…'
  },
  analyze_stream: {
    refine: 'Sketching the next step…',
    innovate: 'Storming the boardroom…',
    goMad: 'Yelling at it 📣',
    critique: 'Drafting findings…',
    explain: 'Composing the saga…',
    exec: 'Drafting the one-pager…'
  },
  intent: {
    refine: 'Aligning intent…',
    innovate: 'Aligning intent…',
    goMad: 'Skipping the meeting',
    critique: 'Citing the SOC 2 controls',
    explain: 'Aligning intent…',
    exec: 'Pointing at the north star…'
  },
  agent_run: {
    refine: 'Engineering the next piece…',
    innovate: 'Pitching the bold move…',
    goMad: 'GOING MAD ON YOUR TOPIC',
    critique: 'Filing tickets…',
    explain: 'Annotating the architecture…',
    exec: 'Boiling it down for the board…'
  },
  transform: {
    refine: 'Adding the useful bit…',
    innovate: 'Reshaping the layout…',
    goMad: 'Adding wonderfully strange things 🔥',
    critique: 'Red-penning the layout…',
    explain: 'Tracing the reshape…',
    exec: 'Killing the darlings…'
  },
  run_started: {
    refine: 'Kicking off…',
    innovate: 'Kicking off…',
    goMad: 'OK NOW HOLD ON 🪖',
    critique: 'Inspector inbound…',
    explain: 'Clearing the throat…',
    exec: 'Hard stop in four minutes…'
  },
  planning: {
    refine: 'Drafting deltas…',
    innovate: 'Drafting deltas…',
    goMad: 'Throwing darts at the diagram 🎯',
    critique: 'Building the findings outline…',
    explain: 'Drafting the chapter plan…',
    exec: 'Drafting the headline…'
  },
  syntax_fixer: {
    refine: 'Mending syntax…',
    innovate: 'Mending syntax…',
    goMad: 'Duct-taping it back together',
    critique: 'Fixing syntax — audit trail updated…',
    explain: 'Smoothing a rough passage…',
    exec: 'Tightening the deck…'
  },
  syntax_repair: {
    refine: 'Re-mending syntax…',
    innovate: 'Re-mending syntax…',
    goMad: 'More duct tape',
    critique: 'Re-opening the syntax finding…',
    explain: 'Revising the rough draft…',
    exec: 'Re-drafting the deck…'
  },
  style: {
    refine: 'Tuning the palette…',
    innovate: 'Restyling for impact…',
    goMad: 'CHAOTIC COLOR SCHEMES 🔥',
    critique: 'Flagging contrast violations…',
    explain: 'On the history of this hue…',
    exec: 'One brand color only.'
  },
  patch_retry: {
    refine: 'Awaiting CAB approval…',
    innovate: 'Awaiting CAB approval…',
    goMad: 'Bribing the CAB',
    critique: 'Awaiting re-review sign-off…',
    explain: 'Taking another pass…',
    exec: 'Asking the board for a redraft…'
  },
  invoke: {
    refine: 'Patching prod 🛠',
    innovate: 'Shipping it 🚀',
    goMad: 'Setting buildings on fire 🔥',
    critique: 'Logging the generation ticket…',
    explain: 'Narrating the draft…',
    exec: 'Boarding the jet 🛩️'
  },
  invoke_fallback: {
    refine: 'Hotfix in flight…',
    innovate: 'Hotfix in flight…',
    goMad: 'WE PIVOT',
    critique: 'Filing a fallback finding…',
    explain: 'Closing the chapter gracefully…',
    exec: 'Rerouting the one-pager…'
  },
  repair_1: {
    refine: 'Hotfix in flight…',
    innovate: 'Hotfix in flight…',
    goMad: 'More hard hats! 🪖🪖',
    critique: 'Escalating to P1 repair…',
    explain: 'Rewinding the parchment…',
    exec: 'Sliding the deadline 🗓️'
  },
  repair_2: {
    refine: 'Second hotfix in flight…',
    innovate: 'Second hotfix in flight…',
    goMad: 'EVEN MORE HARD HATS 🪖🪖🪖',
    critique: 'Second escalation — still non-compliant…',
    explain: 'Revising the footnotes…',
    exec: 'Sliding the deadline again 🗓️🗓️'
  }
};

/**
 * @param {string} variant - one of refine/innovate/goMad/critique/explain (or anything else → fallback).
 * @param {string} phaseId - canonical phase id from SSE.
 * @param {string} fallbackLabel - the literal label that the server sent; rendered as-is when no override.
 */
export function phaseCeremonyLabel(variant, phaseId, fallbackLabel) {
  if (!phaseId) return fallbackLabel || '';
  const ceremonies = slop()?.PHASE_CEREMONIES ?? PHASE_CEREMONIES;
  const row = resolvePhaseCeremonyRow(ceremonies, phaseId);
  if (!row) return fallbackLabel || '';
  return row[variant] || fallbackLabel || '';
}

export const VARIANT_TAGLINES = {
  refine: 'Slopitect: THE Engineer extends the build',
  innovate: 'Slopitect: CIO pitches the bold move',
  goMad: 'Slopitect: GENIUS LOOSE 🚨',
  critique: 'Slopitect: Co-Design compliance review',
  explain: 'Slopitect: Co-Design story time',
  exec: 'Slopitect: Synergy and Co-Design mode',
  fix: 'Slopitect: site foreman fixing the slop'
};

export const VARIANT_BOOT_HEADLINES = {
  refine: 'Engineering the next useful step…',
  innovate: 'CIO pitching the bold pivot…',
  goMad: 'BONK! THE SLOPITECT IS HERE',
  critique: 'CO-DESIGN REVIEW INCOMING',
  explain: 'Co-Design story time — gather round',
  exec: 'Synergy and Co-Design in progress…'
};

export const IDLE_TIPS = [
  'Always over-engineer. The microservices love a good Co-Design session.',
  'If in doubt, add another abstraction layer — then Co-Design it away.',
  'A diagram is just a Jira ticket with arrows and a Co-Design workshop.',
  'Compliance is synergy with paperwork and a mandatory Co-Design sign-off.',
  "A monolith is a microservice that hasn't lawyered up yet.",
  'Synergy is the second-strongest force in the enterprise. Co-Design is the third. Politics is the first.',
  'When the diagram gets confusing, schedule a Co-Design retro and add a Kafka.',
  'Slopitect Tip™: every box is a stakeholder waiting for Co-Design.',
  'If two teams agree on the architecture, one of them skipped Co-Design.',
  "A 9-box matrix solves any problem you can't pronounce — Co-Design the tenth box away.",
  'When the CTO asks "is it cloud-native?", the answer is yes — we Co-Designed it that way.',
  'Re-orgs are just architecture refactors with feelings and a synergy offsite.',
  'The VP runs on synergy, Co-Design, and a hard stop in four minutes.',
  'Slopitect Tip™: "It works on my machine" is not a deployment strategy. It is a lifestyle.',
  'Pivot means we kept the logo and replaced the product. Again.',
  'If your compression algorithm also compresses morale, call it culture.',
  'Series A is when the fridge gets a name. Series B is when Gary locks the thermostat.',
  'Minimum viable product means maximum viable PowerPoint.',
  'The best middleware is the one nobody admits still runs in production.'
];

/** Pick a tip for the given rotation index (stable, no random). */
export function tipForIndex(index) {
  const tips = slop()?.IDLE_TIPS ?? IDLE_TIPS;
  if (!tips.length) return '';
  const safe = Math.max(0, Number.isFinite(index) ? Math.trunc(index) : 0);
  return tips[safe % tips.length];
}

export const PRESTIGE_TIERS = [
  { threshold: 0, label: 'Slop Trainee', short: 'Trainee' },
  { threshold: 5, label: 'Junior Slopitect', short: 'Junior' },
  { threshold: 10, label: 'Senior Slopitect', short: 'Senior' },
  { threshold: 25, label: 'Principal Slopitect', short: 'Principal' },
  { threshold: 50, label: 'Distinguished Slopitect Fellow™', short: 'Fellow' }
];

export function prestigeForTotalRuns(totalRuns) {
  const tiers = slop()?.PRESTIGE_TIERS ?? PRESTIGE_TIERS;
  let best = tiers[0];
  for (const tier of tiers) {
    if (totalRuns >= tier.threshold) best = tier;
  }
  return best;
}

/**
 * Slopitect XP-based leveling ladder. Each entry defines the cumulative XP
 * required to *enter* the level. Level 1 starts at 0 XP. The cap is a soft
 * cap — anything past the final entry stays at the top level but still
 * accrues XP (used by the bar to keep flexing).
 *
 * Cadence: gentle at first to reward early activity, then a slow grind so
 * the bar always has somewhere to fill toward.
 */
export const LEVELS = [
  { level: 1, xp: 0, title: 'Intern Architect', short: 'Lvl 1', flair: '🪜' },
  { level: 2, xp: 50, title: 'Associate Slopitect', short: 'Lvl 2', flair: '📐' },
  { level: 3, xp: 120, title: 'Junior Slopitect', short: 'Lvl 3', flair: '✏️' },
  { level: 4, xp: 220, title: 'Mid-level Slopitect', short: 'Lvl 4', flair: '🪧' },
  { level: 5, xp: 360, title: 'Senior Slopitect', short: 'Lvl 5', flair: '🎯' },
  { level: 6, xp: 540, title: 'Staff Slopitect', short: 'Lvl 6', flair: '🛠️' },
  { level: 7, xp: 760, title: 'Principal Slopitect', short: 'Lvl 7', flair: '🏗️' },
  { level: 8, xp: 1020, title: 'Distinguished Slopitect', short: 'Lvl 8', flair: '🌟' },
  { level: 9, xp: 1320, title: 'Slopitect Fellow', short: 'Lvl 9', flair: '🪐' },
  { level: 10, xp: 1700, title: 'Chief Slopitect Officer', short: 'Lvl 10', flair: '👑' },
  { level: 11, xp: 2200, title: 'Mythic Slopitect', short: 'Lvl 11', flair: '🌈' },
  { level: 12, xp: 2900, title: 'Slopitect, Lord of Synergy', short: 'Lvl 12', flair: '🔮' }
];

/**
 * @typedef {{ level: number, title: string, short: string, flair: string,
 *  xpInto: number, xpForNext: number | null, totalXp: number, isMaxLevel: boolean,
 *  progressRatio: number, nextLevel: typeof LEVELS[number] | null }} LevelInfo
 */

/**
 * Resolve a level descriptor from a cumulative XP value. Returns the level,
 * the XP banked toward the next level, and the XP gap remaining. At the
 * soft cap `xpForNext` is null and `progressRatio` is 1.
 *
 * @param {number} totalXp
 * @returns {LevelInfo}
 */
export function levelForXp(totalXp) {
  const levels = slop()?.LEVELS ?? LEVELS;
  const safe = Math.max(0, Number.isFinite(totalXp) ? totalXp : 0);
  let current = levels[0];
  for (const tier of levels) {
    if (safe >= tier.xp) current = tier;
  }
  const idx = levels.indexOf(current);
  const next = idx + 1 < levels.length ? levels[idx + 1] : null;
  const xpInto = safe - current.xp;
  const xpForNext = next ? next.xp - current.xp : null;
  const isMaxLevel = !next;
  const progressRatio = isMaxLevel
    ? 1
    : Math.max(0, Math.min(1, xpForNext === 0 ? 1 : xpInto / xpForNext));
  return {
    level: current.level,
    title: current.title,
    short: current.short,
    flair: current.flair,
    xpInto,
    xpForNext,
    totalXp: safe,
    isMaxLevel,
    progressRatio,
    nextLevel: next
  };
}

/** Per-variant total-run milestones that unlock a "specialist" achievement. */
export const VARIANT_MASTERY_THRESHOLD = 10;
export const VARIANT_MASTERY_ACHIEVEMENTS = {
  refine: {
    id: 'masterPolisher',
    title: '👷 MASTER ENGINEER',
    subtitle: '10 useful extensions shipped. The site is yours.'
  },
  innovate: {
    id: 'serialDisruptor',
    title: '⚡ SERIAL INNOVATOR',
    subtitle: '10 bold pivots on-subject. C-suite material.'
  },
  goMad: {
    id: 'distinguishedChaos',
    title: '🪖 DISTINGUISHED CHAOS FELLOW',
    subtitle: '10 mad runs. Frame the helmet.'
  },
  critique: {
    id: 'auditTribunal',
    title: '📋 AUDIT TRIBUNAL',
    subtitle: '10 critiques filed. Compliance loves you.'
  },
  explain: {
    id: 'archivedStoryteller',
    title: '🧙 ARCHIVED STORYTELLER',
    subtitle: '10 explanations canonised in the architecture lore.'
  },
  exec: {
    id: 'serialAligner',
    title: '👔 SERIAL CO-DESIGNER',
    subtitle: '10 synergy Co-Designs shipped. The board approves.'
  }
};

export const ACHIEVEMENTS = {
  slopitectCertified: {
    id: 'slopitectCertified',
    title: '🏗️ SLOPITECT CERTIFIED',
    subtitle: 'You completed Max Madness. Frame the badge.'
  },
  perfectInspection: {
    id: 'perfectInspection',
    title: '🧐 PERFECT INSPECTION',
    subtitle: 'No weaknesses found. (Suspicious.)'
  },
  fullStackSlopitect: {
    id: 'fullStackSlopitect',
    title: '🥞 FULL-STACK SLOPITECT',
    subtitle: 'All five personas in one session. Synergy and Co-Design maximised.'
  },
  prestige: {
    id: 'prestige',
    title: 'PROMOTION',
    subtitle: 'You have ascended a prestige tier.'
  },
  firstSlop: {
    id: 'firstSlop',
    title: '🥚 FIRST SLOP',
    subtitle: 'Your first run! A piece of slop has been born.'
  },
  hatTrick: {
    id: 'hatTrick',
    title: '🎩 HAT TRICK',
    subtitle: 'Three different personas inside 30 seconds. Bravo.'
  },
  slopMarathon: {
    id: 'slopMarathon',
    title: '🏃 SLOP MARATHON',
    subtitle: 'Ten runs in one session. Hydrate.'
  },
  comboKing: {
    id: 'comboKing',
    title: '⚡ COMBO KING',
    subtitle: 'Five different personas chained in a row.'
  },
  inboxZero: {
    id: 'inboxZero',
    title: '📭 INBOX ZERO',
    subtitle: 'Every email read. HR finds this suspicious.'
  },
  survivedTheSync: {
    id: 'survivedTheSync',
    title: '📅 SURVIVED THE SYNC',
    subtitle: 'Attended a full working-group meeting. No action items were harmed.'
  },
  coffeeConnoisseur: {
    id: 'coffeeConnoisseur',
    title: '☕ THIRD SHIFT',
    subtitle: 'Three coffee breaks in one session. The machine knows your order.'
  },
  replyGuy: {
    id: 'replyGuy',
    title: '💬 REPLY GUY',
    subtitle: '"Circling back" five times in one session. It\'s a lifestyle.'
  },
  holyWarReferee: {
    id: 'holyWarReferee',
    title: '🥊 HOLY WAR REFEREE',
    subtitle: 'Settled three cubicle battles. Tabs, spaces, and the thermostat all fear you.'
  },
  ...VARIANT_MASTERY_ACHIEVEMENTS
};

/**
 * Level-up banner copy. Triggered when the player crosses any XP threshold.
 * The runtime appends the level number / new title.
 */
export const LEVEL_UP_BANNER = {
  title: '⬆️ LEVEL UP',
  subtitle: 'The Slopitect Stakeholders recognise your synergy and Co-Design.'
};

export const CONSOLE_STAMP_LINES = [
  '                ',
  '       ___      ',
  '   ___/   \\___  ',
  '  /             \\',
  ' |   🏗️ ARCHISLOP |',
  '  \\___________/ ',
  '       |||      ',
  '       |||      ',
  '   ArchiSlop v∞ · Slopitect Engine warmed up.',
  '   Powered by Synergy™ & Co-Design™ — please file a JIRA ticket.'
];

export const PROMPT_EASTER_EGGS = [
  { match: /\bblockchain\b/i, toast: '🔗 Slopitect approves.' },
  { match: /\bco[- ]?design/i, toast: '👔 Synergy and Co-Design detected. The VP nods.' },
  { match: /\bsynergy\b/i, toast: '🤝 Synergy detected. +1 Co-Design alignment.' },
  { match: /\bmicroservice/i, toast: '🛎️ One microservice added to the slop.' },
  { match: /\bkubernetes\b|\bk8s\b/i, toast: '☸️ The container has been deployed to your soul.' },
  { match: /\bAI\b|\bGPT\b|\bLLM\b/i, toast: '🧠 Bold of you to mention us.' },
  { match: /\bagile\b/i, toast: '📈 Story points are vibes.' },
  { match: /\bscrum\b/i, toast: '🧎 STAND UP.' },
  { match: /\bstakeholder/i, toast: '✅ Stakeholder Co-Designed and aligned.' },
  { match: /\bleverage\b/i, toast: '🤝 Synergised through Co-Design.' },
  { match: /\bdevops\b/i, toast: "👨‍🍳 *chef's kiss*" },
  { match: /\bcloud[- ]?native\b/i, toast: '☁️ Born in the cloud.' },
  { match: /\bSaaS\b/i, toast: '💸 SaaS-ified. Onwards.' },
  { match: /\benterprise\b/i, toast: '🏢 Enterprise readiness ×10.' },
  { match: /\brefactor/i, toast: '🛠 Architecture rotation initiated.' },
  { match: /\bsprint\b/i, toast: '🏃 +2 velocity.' },
  { match: /\bMVP\b/i, toast: '🚀 Minimum viable slop accepted.' }
];

/** Konami code achievement — Slopitect Awakened. */
export const KONAMI_ACHIEVEMENT = {
  id: 'slopitectAwakened',
  title: '🌈 SLOPITECT AWAKENED',
  subtitle: 'You speak the ancient cheat. Synergy and Co-Design now flow freely.'
};
