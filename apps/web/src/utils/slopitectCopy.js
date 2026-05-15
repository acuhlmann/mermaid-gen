/**
 * Slopitect Cinematic Universe copy bank.
 *
 * - Phase ceremony labels per variant (enterprise-architecture parody).
 * - Variant personas, taglines, completion blurbs.
 * - Idle "tip of the day" rotation.
 * - Achievement copy + XP rewards.
 *
 * Keep all user-facing strings here so they can be tuned without touching components.
 */

export const VARIANT_PERSONAS = {
  refine: {
    name: 'The Polisher',
    title: 'Junior Architect',
    tagline: 'Refining the slop.',
    avatarEmoji: '🪞',
    entryLine: 'Polishing in progress…',
    exitLine: 'Polished ✨',
    accentColorVar: '--accent',
    xpAward: 25,
    xpStreakBonus: 5
  },
  innovate: {
    name: 'The Disruptor',
    title: 'Chief Innovation Officer',
    tagline: 'Disrupting the synergy.',
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
    tagline: 'Inspection in session.',
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
    tagline: 'Story time, gather round.',
    avatarEmoji: '📜',
    entryLine: 'Picture, if you will…',
    exitLine: 'Architecture explained 📜',
    accentColorVar: '#0d9488',
    xpAward: 25,
    xpStreakBonus: 5
  }
};

/**
 * Random one-liner barks the SlopitectCompanion speech bubble cycles through.
 * Pure flavor — enterprise-architecture parody.
 */
export const VARIANT_QUOTES = {
  refine: [
    'Per-pixel kerning matters.',
    'Just a touch tighter…',
    'Subtle is strong.',
    'Crisper. Sharper. Calmer.',
    'A 1-pixel nudge is still a deliverable.',
    'Negative space is also stakeholder space.',
    'Ship the polish.',
    'Buff. Repeat. Buff.'
  ],
  innovate: [
    'What if blockchain?',
    'Pivot to micro-frontends.',
    'Cloud-native is just synergy with steps.',
    'Have we considered AI?',
    'Let’s 10x this.',
    'I see a flywheel.',
    'Disrupt or be disrupted.',
    'This needs a SaaS layer.',
    'Add a queue. Then another queue.',
    'It’s giving Series B.'
  ],
  goMad: [
    'WHAT IF EVERYTHING WAS A LAMBDA',
    'ADD A QUEUE. NO WAIT. TWO QUEUES.',
    'I JUST PUT IT ON THE BLOCKCHAIN',
    'WHY IS THERE ONLY ONE DATABASE',
    'MORE LAYERS. MORE.',
    'MICROFRONTENDS. MICROSERVICES. MICROBOXES.',
    'SOMEBODY GET ME A KAFKA',
    'THE CTO WILL LOVE IT 🔥',
    'JUST WRAP IT IN A LAMBDA',
    'MIGRATE TO RUST. NOW.',
    'OUTSOURCE THE OUTSOURCING',
    'I AM THE ARCHITECTURE NOW'
  ],
  critique: [
    'I’m raising a P2 about this.',
    'This needs an ADR.',
    'Where is the runbook?',
    'Has legal reviewed this?',
    'Cite your sources.',
    'I will be Slack-DMing about this.',
    'Diagram lacks a SOC 2 disclaimer.',
    'Flagging in the architecture review.',
    'Please attach the threat model.',
    'Why is this not in Confluence?'
  ],
  explain: [
    'Picture, if you will, an architecture…',
    'Notice the elegant decoupling.',
    'Behold: the request lifecycle.',
    'As Bezos said in the API memo…',
    'Imagine the data flowing like a river.',
    'This is a teaching moment.',
    'A diagram is just a frozen story.',
    'Allow me to gesture vaguely.',
    'The path of least confusion is forward.',
    'Every box is a verb in disguise.'
  ]
};

export function variantQuotes(variant) {
  return VARIANT_QUOTES[variant] || [];
}

/** Pick a quote by rotation index (stable, no random). */
export function quoteForRotation(variant, rotationIndex) {
  const quotes = VARIANT_QUOTES[variant];
  if (!quotes || quotes.length === 0) return '';
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
  return VARIANT_PERSONAS[variant] ?? FALLBACK_PERSONA;
}

/**
 * Maps real phase ids → ceremony labels per variant. When a variant entry is absent
 * the renderer should fall back to the canonical label from the SSE event itself.
 */
export const PHASE_CEREMONIES = {
  analyze: {
    refine: 'Reviewing for clarity…',
    innovate: 'Scoping the disruption…',
    goMad: 'Eyeballing the slop 👀',
    critique: 'Opening JIRA…',
    explain: 'Pondering the diagram…'
  },
  analyze_stream: {
    refine: 'Word-smithing…',
    innovate: 'Brainstorming…',
    goMad: 'Yelling at it 📣',
    critique: 'Drafting findings…',
    explain: 'Composing the saga…'
  },
  intent: {
    refine: 'Aligning intent…',
    innovate: 'Aligning intent…',
    goMad: 'Skipping the meeting',
    critique: 'Citing the SOC 2 controls',
    explain: 'Aligning intent…'
  },
  agent_run: {
    refine: 'Polishing the slop…',
    innovate: 'Ideating outside the box…',
    goMad: 'MIGRATING TO BLOCKCHAIN',
    critique: 'Filing tickets…',
    explain: 'Annotating the architecture…'
  },
  transform: {
    refine: 'Tightening the lines…',
    innovate: 'Restructuring the layout…',
    goMad: 'Adding more microservices 🔥'
  },
  run_started: {
    refine: 'Kicking off…',
    innovate: 'Kicking off…',
    goMad: 'OK NOW HOLD ON 🪖',
    critique: 'Inspector inbound…',
    explain: 'Clearing the throat…'
  },
  planning: {
    refine: 'Drafting deltas…',
    innovate: 'Drafting deltas…',
    goMad: 'Throwing darts at the diagram 🎯'
  },
  syntax_fixer: {
    refine: 'Mending syntax…',
    innovate: 'Mending syntax…',
    goMad: 'Duct-taping it back together'
  },
  syntax_repair: {
    refine: 'Re-mending syntax…',
    innovate: 'Re-mending syntax…',
    goMad: 'More duct tape'
  },
  patch_retry: {
    refine: 'Awaiting CAB approval…',
    innovate: 'Awaiting CAB approval…',
    goMad: 'Bribing the CAB'
  },
  invoke: {
    refine: 'Patching prod 🛠',
    innovate: 'Shipping it 🚀',
    goMad: 'Setting buildings on fire 🔥'
  },
  invoke_fallback: {
    refine: 'Hotfix in flight…',
    innovate: 'Hotfix in flight…',
    goMad: 'WE PIVOT'
  },
  repair_1: {
    refine: 'Hotfix in flight…',
    innovate: 'Hotfix in flight…',
    goMad: 'More hard hats! 🪖🪖'
  },
  repair_2: {
    refine: 'Second hotfix in flight…',
    innovate: 'Second hotfix in flight…',
    goMad: 'EVEN MORE HARD HATS 🪖🪖🪖'
  }
};

/**
 * @param {string} variant - one of refine/innovate/goMad/critique/explain (or anything else → fallback).
 * @param {string} phaseId - canonical phase id from SSE.
 * @param {string} fallbackLabel - the literal label that the server sent; rendered as-is when no override.
 */
export function phaseCeremonyLabel(variant, phaseId, fallbackLabel) {
  if (!phaseId) return fallbackLabel || '';
  const row = PHASE_CEREMONIES[phaseId];
  if (!row) return fallbackLabel || '';
  return row[variant] || fallbackLabel || '';
}

export const VARIANT_TAGLINES = {
  refine: 'Slopitect: refining the slop',
  innovate: 'Slopitect: disrupting the synergy',
  goMad: 'Slopitect: GENIUS LOOSE 🚨',
  critique: 'Slopitect: compliance inspection in session',
  explain: 'Slopitect: architecture story time',
  fix: 'Slopitect: site foreman fixing the slop'
};

export const VARIANT_BOOT_HEADLINES = {
  refine: 'Polishing the diagram…',
  innovate: 'Disrupting the synergy…',
  goMad: 'BONK! THE SLOPITECT IS HERE',
  critique: 'INSPECTION INCOMING',
  explain: 'Story time, gather round'
};

export const IDLE_TIPS = [
  'Always over-engineer. The microservices love it.',
  'If in doubt, add another abstraction layer.',
  'A diagram is just a Jira ticket with arrows.',
  'Compliance is just synergy with paperwork.',
  'A monolith is a microservice that hasn\'t lawyered up yet.',
  'Synergy is the second-strongest force in the enterprise. Politics is the first.',
  'When the diagram gets confusing, add a Kafka.',
  'Slopitect Tip™: every box is a stakeholder waiting to happen.',
  'If two teams agree on the architecture, one of them is wrong.',
  'A 9-box matrix solves any problem you can\'t pronounce.',
  'When the CTO asks "is it cloud-native?", the answer is yes.',
  'Re-orgs are just architecture refactors with feelings.'
];

/** Pick a tip for the given rotation index (stable, no random). */
export function tipForIndex(index) {
  if (!IDLE_TIPS.length) return '';
  const safe = Math.max(0, Number.isFinite(index) ? Math.trunc(index) : 0);
  return IDLE_TIPS[safe % IDLE_TIPS.length];
}

export const PRESTIGE_TIERS = [
  { threshold: 0, label: 'Slop Trainee', short: 'Trainee' },
  { threshold: 5, label: 'Junior Slopitect', short: 'Junior' },
  { threshold: 10, label: 'Senior Slopitect', short: 'Senior' },
  { threshold: 25, label: 'Principal Slopitect', short: 'Principal' },
  { threshold: 50, label: 'Distinguished Slopitect Fellow™', short: 'Fellow' }
];

export function prestigeForTotalRuns(totalRuns) {
  let best = PRESTIGE_TIERS[0];
  for (const tier of PRESTIGE_TIERS) {
    if (totalRuns >= tier.threshold) best = tier;
  }
  return best;
}

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
    subtitle: 'All five personas in one session. Synergy maximised.'
  },
  prestige: {
    id: 'prestige',
    title: 'PROMOTION',
    subtitle: 'You have ascended a prestige tier.'
  }
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
  '   Powered by Synergy™ — please file a JIRA ticket.'
];

export const PROMPT_EASTER_EGGS = [
  { match: /\bblockchain\b/i, toast: '🔗 Slopitect approves.' },
  { match: /\bsynergy\b/i, toast: '🤝 Synergy detected. +1 alignment.' },
  { match: /\bmicroservice/i, toast: '🛎️ One microservice added to the slop.' },
  { match: /\bkubernetes\b|\bk8s\b/i, toast: '☸️ The container has been deployed to your soul.' },
  { match: /\bAI\b|\bGPT\b|\bLLM\b/i, toast: '🧠 Bold of you to mention us.' },
  { match: /\bagile\b/i, toast: '📈 Story points are vibes.' },
  { match: /\bscrum\b/i, toast: '🧎 STAND UP.' },
  { match: /\bstakeholder/i, toast: '✅ Stakeholder aligned.' },
  { match: /\bleverage\b/i, toast: '🤝 Synergised.' },
  { match: /\bdevops\b/i, toast: '👨‍🍳 *chef\'s kiss*' },
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
  subtitle: 'You speak the ancient cheat. The synergy now flows freely.'
};
