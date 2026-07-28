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
  gilfoyle: {
    name: 'Bertram Gilfoyle',
    title: 'Systems Architect, Unimpressed',
    tagline: 'The correct change. Stated once.',
    avatarEmoji: '🦇',
    entryLine: 'Someone left this unfinished.',
    exitLine: 'Fixed. It was wrong. 🦇',
    accentColorVar: '--accent',
    xpAward: 25,
    xpStreakBonus: 5
  },
  dinesh: {
    name: 'Dinesh Chugtai',
    title: 'Engineer, Uncredited',
    tagline: 'The right fix. Please acknowledge it.',
    avatarEmoji: '🙋',
    entryLine: 'Okay, so nobody else was going to say this.',
    exitLine: 'Fixed. That was me 🙋',
    accentColorVar: '#7c3aed',
    xpAward: 25,
    xpStreakBonus: 5
  },
  erlich: {
    name: 'Erlich Bachman',
    title: 'Founder, Hacker Hostel',
    tagline: 'Courageous pivots, graciously elevated.',
    avatarEmoji: '🕶',
    entryLine: 'Let me ask you this…',
    exitLine: 'Elevated. You’re welcome 🕶',
    accentColorVar: '#ea580c',
    xpAward: 30,
    xpStreakBonus: 6
  },
  russ: {
    name: 'Russ Hanneman',
    title: 'Tres Commas Investor',
    tagline: 'This guy SHIPS.',
    avatarEmoji: '🍾',
    entryLine: 'TRES COMMAS ENERGY — LET’S GO',
    exitLine: 'THIS GUY SHIPS 🍾',
    accentColorVar: '#ec4899',
    xpAward: 40,
    xpStreakBonus: 15
  },
  jared: {
    name: 'Jared Dunn',
    title: 'Head of Business Development',
    tagline: 'One finding, raised with care.',
    avatarEmoji: '📋',
    entryLine: 'Sorry — I just wanted to flag one thing.',
    exitLine: 'Raised. Someone should own it 📋',
    accentColorVar: '#b91c1c',
    xpAward: 25,
    xpStreakBonus: 5
  },
  richard: {
    name: 'Richard Hendricks',
    title: 'Founder — Pattern Namer',
    tagline: 'I think this shape has a name…',
    avatarEmoji: '🤓',
    entryLine: 'Okay — so if I’m reading this right…',
    exitLine: 'Named it. Sorry if that was a lot 🤓',
    accentColorVar: '#0d9488',
    xpAward: 25,
    xpStreakBonus: 5
  },
  barker: {
    name: 'Jack Barker',
    title: 'CEO — Success Theater',
    tagline: 'Thrilled to boil this down for the board.',
    avatarEmoji: '🧘',
    entryLine: 'I don’t know about you, but I am excited…',
    exitLine: 'Boiled down. The triangles align 🧘',
    accentColorVar: '#ca8a04',
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
  gilfoyle: [
    'That dependency exists. It was never written down.',
    'One box is doing two jobs. Someone noticed. Me.',
    'A step is missing between these two. Obviously.',
    'Nobody named that edge. Cowardice.',
    'The vague box is the load-bearing one. It always is.',
    'I have opinions about this. They are correct.',
    'I fixed it. You are welcome to not thank me.',
    'This is fine. It is not fine.',
    'The darkness is fine with this diagram. I am not.'
  ],
  dinesh: [
    'I found it. I would like that written down.',
    'Nobody else read this. I read all of it.',
    'That was going to break. I said so first.',
    'I am not being defensive. I am being accurate.',
    'Okay, so — one thing. Actually four things.',
    'You’re welcome, by the way. In advance.',
    'Gilfoyle has not looked at this once.',
    'Yes, I checked the other branches. All of them.',
    'A correct fix should get a reaction. Any reaction.',
    'Someone opens this in six months and blames me.',
    'This is fine. I made it fine. Noting that.',
    'I will be raising this again later. For the record.'
  ],
  erlich: [
    'I practically invented this diagram.',
    'Let me ask you this.',
    'This is how you change the world.',
    'There’s a bolder shape here. There always is. For me.',
    'Consider this graciously elevated.',
    'Vision is a full-time job. Mine.',
    'Big swings only. I do not bunt.',
    'The pivot was obvious. To me.',
    'You’re welcome, in advance.',
    'History will cite this meeting.',
    'I mentored everyone who ever mattered.',
    'Disrupt or be disrupted — I choose disrupt. Obviously.'
  ],
  russ: [
    'Tres commas or bust.',
    'This guy SHIPS.',
    'What if there were twelve of this thing?',
    'Synergy is a two-comma word.',
    'Tequila first. Then we escalate.',
    'Rotate everything 90° and call it insight.',
    'Give each box a rival that does the opposite.',
    'Radio Silence taught me that — once.',
    'I am the valuation now.',
    'Keep it small? That’s how you stay at two commas.',
    'Make it louder. On the subject.',
    'VIP lane. Obviously.'
  ],
  jared: [
    'I just wanted to flag one thing, if that’s alright.',
    'Nobody owns that step, and that worries me.',
    'There’s no fallback if it fails. I had to say it.',
    'The handoff isn’t named anywhere. That’s on us.',
    'I’m not comfortable shipping with this open.',
    'What are the exit criteria? I couldn’t find any.',
    'Sorry to be the one raising this again.',
    'It’s happy-path only, and I have to note that.',
    'If someone is on call for this, I’d love to know who.',
    'I’d feel much better with an owner on that box.'
  ],
  richard: [
    'Okay — so if I’m reading this right…',
    'I think this shape has a name.',
    'Sorry — one more thing about that box.',
    'It’s a feedback loop, not a pipeline. I think.',
    'In a perfect world you’d never draw it like this.',
    'Did you know: every diagram is a small theory of the world.',
    'I started explaining and I should stop. One more clause.',
    'The path of least confusion is forward — if that helps.',
    'Fun fact nobody asked for, incoming. Sorry.',
    'Supposedly this pattern is older than the software.',
    'I’m not proposing a change. I’m naming what it already is.',
    'If that makes sense. It does. I think it does.',
    'Beautiful in theory, awkward in practice — my favorite kind.',
    'Wait — the label is doing two jobs. That matters.',
    'Legend has it this has a name. It does.'
  ],
  barker: [
    'I’ve taken the liberty.',
    'I don’t know about you, but I am excited.',
    'We’re a family here.',
    'The Conjoined Triangles of Success.',
    'Synergy is not a word. It’s a belief system.',
    'A diagram that can’t impress a board is a hobby.',
    'What story does this tell investors?',
    'Optics beat substance. Warmly.',
    'I’m thrilled. You’re thrilled. We’re all thrilled.',
    'Three boxes. That’s the slide.',
    'Boil it down — the board reads three.',
    'Success is a theater. Perform it.',
    'Every box is a value proposition waiting to align.'
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
    gilfoyle: 'Reading what you left me…',
    dinesh: 'Reading all of it. Unlike some people…',
    erlich: 'Spotting the bolder shape…',
    russ: 'Eyeballing the valuation…',
    jared: 'Reading it through carefully…',
    richard: 'Naming the pattern…',
    barker: 'Admiring the story…'
  },
  analyze_stream: {
    gilfoyle: 'Locating the defect…',
    dinesh: 'Finding the thing nobody found…',
    erlich: 'Keynoting the pivot…',
    russ: 'Calling it a keynote…',
    jared: 'Writing up the finding…',
    richard: 'Over-explaining on purpose…',
    barker: 'Boiling it down for the board…'
  },
  intent: {
    gilfoyle: 'Parsing what you meant…',
    dinesh: 'Working out what you meant…',
    erlich: 'Aligning the vision…',
    russ: 'Skipping straight to tres commas…',
    jared: 'Making sure I understood you…',
    richard: 'Checking I understood…',
    barker: 'Aligning the triangles…'
  },
  agent_run: {
    gilfoyle: 'Making the correct change…',
    dinesh: 'Making the change. Mine…',
    erlich: 'Graciously elevating it…',
    russ: 'ESCALATING YOUR TOPIC 🍾',
    jared: 'Raising it properly…',
    richard: 'Annotating what it already is…',
    barker: 'Taking the liberty…'
  },
  transform: {
    gilfoyle: 'Drawing what was already true…',
    dinesh: 'Fixing the part everyone skipped…',
    erlich: 'Elevating the layout…',
    russ: 'Making it louder — on subject 🍾',
    jared: 'Noting the process gap…',
    richard: 'Still not changing it — naming it…',
    barker: 'Killing the darlings, warmly…'
  },
  run_started: {
    gilfoyle: 'Fine.',
    dinesh: 'Okay, so…',
    erlich: 'Let me ask you this…',
    russ: 'OK NOW HOLD ON 🍾',
    jared: 'Sorry — one moment…',
    richard: 'Okay — so…',
    barker: 'I don’t know about you, but I am excited…'
  },
  planning: {
    gilfoyle: 'Enumerating what is wrong…',
    dinesh: 'Listing what is wrong. It is a list…',
    erlich: 'Drafting the keynote…',
    russ: 'Pricing the diagram in commas…',
    jared: 'Outlining what needs an owner…',
    richard: 'Outlining the insight…',
    barker: 'Drafting the one-pager…'
  },
  syntax_fixer: {
    gilfoyle: 'Fixing syntax nobody checked…',
    dinesh: 'Fixing syntax. Again. Me…',
    erlich: 'Mending syntax, brilliantly…',
    russ: 'Taping it with tequila money…',
    jared: 'Correcting it before anyone sees…',
    richard: 'Smoothing one rough clause…',
    barker: 'Tightening the deck…'
  },
  syntax_repair: {
    gilfoyle: 'Fixing it again. Obviously…',
    dinesh: 'Fixing it again, and I will mention this…',
    erlich: 'Re-mending syntax, again brilliantly…',
    russ: 'More tequila money…',
    jared: 'Correcting it again, apologies…',
    richard: 'Revising the footnote…',
    barker: 'Re-drafting the deck…'
  },
  style: {
    gilfoyle: 'Tuning the palette. Darker…',
    dinesh: 'Recolouring it. Nobody will notice…',
    erlich: 'Restyling for the keynote…',
    russ: 'LOUDER PALETTE. OBVIOUSLY 🍾',
    jared: 'Flagging what will not read…',
    richard: 'Noticing the hue has a history…',
    barker: 'One brand color only.'
  },
  patch_retry: {
    gilfoyle: 'Waiting on process. Predictable…',
    dinesh: 'Waiting. Nobody is waiting on me…',
    erlich: 'Awaiting the board’s approval…',
    russ: 'Buying the CAB a round…',
    jared: 'Waiting, and worrying a little…',
    richard: 'Taking another anxious pass…',
    barker: 'Asking the board for a redraft…'
  },
  invoke: {
    gilfoyle: 'Patching prod 🦇',
    dinesh: 'Doing the actual work 🙋',
    erlich: 'Elevating it 🕶',
    russ: 'Shipping it loud 🍾',
    jared: 'Doing it properly…',
    richard: 'Narrating, not mutating…',
    barker: 'Taking the liberty 🧘'
  },
  invoke_fallback: {
    gilfoyle: 'Falling back. Noted…',
    dinesh: 'Falling back. Not my fault…',
    erlich: 'Pivot in flight…',
    russ: 'WE ESCALATE',
    jared: 'Falling back — noting it anyway…',
    richard: 'Stopping before I spiral…',
    barker: 'Rerouting the one-pager…'
  },
  repair_1: {
    gilfoyle: 'Repairing it. Again…',
    dinesh: 'Repairing it. Still me…',
    erlich: 'Vision repair in flight…',
    russ: 'More commas! 🍾🍾',
    jared: 'This one is on me. Fixing it…',
    richard: 'Rewinding one clause…',
    barker: 'Sliding the timeline, warmly 🗓️'
  },
  repair_2: {
    gilfoyle: 'Second repair. My objection is documented…',
    dinesh: 'Second repair. Noting this for later…',
    erlich: 'Second vision repair in flight…',
    russ: 'TRES COMMAS ENERGY 🍾🍾🍾',
    jared: 'Still on me. Fixing it again…',
    richard: 'Still naming it, not changing it…',
    barker: 'Forming a committee about it 🗓️🗓️'
  }
};

/**
 * @param {string} variant - one of gilfoyle/dinesh/erlich/russ/jared/richard/barker (or anything else → fallback).
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
  gilfoyle: 'Slopitect: Gilfoyle fixes what is wrong',
  dinesh: 'Slopitect: Dinesh fixes it and wants the credit',
  erlich: 'Slopitect: Erlich Bachman pitches the bold move',
  russ: 'Slopitect: Russ Hanneman escalates it',
  jared: 'Slopitect: Jared Dunn raises one finding',
  richard: 'Slopitect: Richard is naming the pattern',
  barker: 'Slopitect: Success Theater mode',
  fix: 'Slopitect: site foreman fixing the slop'
};

export const VARIANT_BOOT_HEADLINES = {
  gilfoyle: 'Gilfoyle found the defect…',
  dinesh: 'Dinesh already found it…',
  erlich: 'Erlich Bachman is graciously elevating…',
  russ: 'Tres commas just walked in…',
  jared: 'Jared has one thing to flag…',
  richard: 'Richard is about to over-explain…',
  barker: 'Jack Barker is taking the liberty…'
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
  'Jack Barker has taken the liberty of Co-Designing your roadmap. Warmly.',
  'Slopitect Tip™: "It works on my machine" is not a deployment strategy. It is a lifestyle.',
  'Pivot means we kept the logo and replaced the product. Again.',
  'If your compression algorithm also compresses morale, call it culture.',
  'Series A is when the fridge gets a name. Series B is when Gary locks the thermostat.',
  'Minimum viable product means maximum viable PowerPoint.',
  'The best middleware is the one nobody admits still runs in production.',
  'Six slots, one canvas: Mermaid for boxes, Chart for numbers, Anything for chaos.',
  'Slop Chat™ colleagues remember what you said — try not to panic.'
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
  gilfoyle: {
    id: 'stackOwner',
    title: '🦇 THE STACK IS MINE',
    subtitle: '10 correct changes. Nobody thanked you. Fine.'
  },
  dinesh: {
    id: 'creditWhereDue',
    title: '🙋 CREDIT WHERE DUE',
    subtitle: '10 correct fixes. Somebody finally noticed.'
  },
  erlich: {
    id: 'tenPercentLegend',
    title: '🕶 TEN PERCENT LEGEND',
    subtitle: '10 bold pivots graciously elevated. The incubator approves.'
  },
  russ: {
    id: 'tresCommas',
    title: '🍾 TRES COMMAS CLUB',
    subtitle: '10 escalations. The commas approve.'
  },
  jared: {
    id: 'carefulFinding',
    title: '📋 SOMEONE HAD TO SAY IT',
    subtitle: '10 findings raised. Every one of them had an owner.'
  },
  richard: {
    id: 'namedThePattern',
    title: '🤓 NAMED THE PATTERN',
    subtitle: '10 insights named. Nobody asked him to stop.'
  },
  barker: {
    id: 'conjoinedTriangles',
    title: '🧘 CONJOINED TRIANGLES',
    subtitle: '10 board-ready simplifications. The family approves.'
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
    subtitle: 'All six personas in one session. Synergy and Co-Design maximised.'
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
  {
    match: /\bco[- ]?design/i,
    toast: '🧘 Synergy and Co-Design detected. Jack Barker is thrilled.'
  },
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
