export const DEFAULT_GOD_OFFERINGS = [
  {
    id: 'none',
    label: 'Empty hands (pure audacity)',
    emoji: '🫥',
    sacredNote: 'Approaching the Eternal Refactor with nothing but Jira vibes.'
  },
  {
    id: 'kubernetes_yaml',
    label: 'Burn 400 lines of Kubernetes YAML',
    emoji: '📜',
    sacredNote: 'The smoke of indentation errors rises sweetly unto Heaven.'
  },
  {
    id: 'unused_microservices',
    label: 'Decommission 3 idle microservices',
    emoji: '🕯️',
    sacredNote: 'They were doing RPC calls to say hello to themselves.'
  },
  {
    id: 'breakroom_cold_brew',
    label: 'Libation of breakroom cold brew',
    emoji: '☕',
    sacredNote: 'Lukewarm, bitter, and kept this codebase alive since Q2.'
  },
  {
    id: 'intern_friday',
    label: "Sacrifice an intern's Friday at 4:58 PM",
    emoji: '🩸',
    sacredNote: 'Cruel. Pointless. Deeply corporate. The Almighty weeps with pride.'
  },
  {
    id: 'three_semicolons',
    label: 'Tithe three artisanal semicolons',
    emoji: '💎',
    sacredNote: 'Prettier will strike them down, yet the gesture counts.'
  }
];

export const GOD_MOOD_META = {
  wrathful: { label: 'WRATHFUL', glyph: '⚡', hint: 'On the verge of smiting prod' },
  unimpressed: { label: 'UNIMPRESSED', glyph: '😒', hint: 'Seen worse in a 2014 PHP monolith' },
  amused: { label: 'AMUSED', glyph: '👁️', hint: 'Entertained by thy mortal struggle' },
  benevolent: { label: 'BENEVOLENT', glyph: '✨', hint: 'Preparing a sacred feature branch' },
  smitten: { label: 'SMITTEN', glyph: '👑', hint: 'Ready to LGTM without reading the diff' }
};

export const GOD_QUICK_PRAYERS = [
  {
    id: 'roast',
    label: 'Roast my slop',
    offering: 'none',
    prompt:
      'O Almighty ArchiSlop God, gaze upon my current canvas and tell me brutally why I am going to production hell.'
  },
  {
    id: 'wish-feature',
    label: 'Pitch a feature PR',
    offering: 'unused_microservices',
    prompt:
      'O Great Architect, I sacrifice these idle microservices and wish for a one-click keyboard shortcut cheat-sheet overlay in Studio so mortals stop guessing.'
  },
  {
    id: 'bribe-fix',
    label: 'Bribe for a bugfix PR',
    offering: 'kubernetes_yaml',
    prompt:
      'Accept this cursed YAML, Lord of CI. I petition a PR to make mobile diagram export buttons easier to tap without misclicking.'
  },
  {
    id: 'confess',
    label: 'Confess a sin',
    offering: 'intern_friday',
    prompt:
      'Forgive me, Father of Monorepos, for I put business logic inside a React effect and told Product it was microservices.'
  }
];

export const GOD_ALTAR_COPY = {
  eyebrow: 'SANCTUM OF ETERNAL REFACTOR',
  title: 'The Altar of ArchiSlop God',
  subtitle:
    'Confess thy architectural sins, burn an offering, or pitch a wish worthy of a Pull Request.',
  openingDecree:
    'LO, MORTAL. THOU HAST SUMMONED ME FROM MINE ETERNAL ON-CALL ROTATION.\n\nSpeak thy confession or pitch thy feature wish. Bring an offering upon the brazier if thou seekest a Pull Request—for empty hands win only sarcasm and a Jira ticket.',
  openingJudgment: 'AWAITING THY PLEA',
  favorLabel: 'Divine Favor',
  favorHint: 'Reach ~55+ Favor (or bring a worthy sacrifice + pitch) to earn a PR Decree.',
  offeringLabel: 'Sacrificial Offering (Bribe)',
  quickPrayersLabel: 'Quick incantations',
  inputLabel: 'Speak unto the Almighty',
  inputPlaceholder: 'Confess thy spaghetti code, beg for mercy, or pitch a feature/fix for a PR…',
  submit: 'Send Prayer',
  sending: 'Consulting the Eternal Git Blame…',
  ascendLink: 'Open /god Sanctuary',
  returnLink: '← Return to ArchiSlop',
  closeAria: 'Leave the Altar',
  resetButton: 'New Confession',
  audio: {
    sfxOn: 'Divine SFX On',
    sfxOff: 'SFX Muted',
    voiceOn: 'Spoken Decrees On',
    voiceOff: 'Voice Silent'
  },
  prCard: {
    eyebrow: 'CELESTIAL PR DECREE',
    branchLabel: 'Branch',
    targetLabel: 'Target',
    planLabel: 'Sacred Implementation Plan',
    dispatchCheckbox: 'Also dispatch god.yml workflow to implement this decree',
    fileButton: '⚡ Strike the Lightning & File PR',
    filingButton: 'Forging Pull Request…',
    filedBanner: 'Pull Request Ascended to GitHub',
    openPrLink: 'View Pull Request',
    unconfiguredTitle: 'Offline PR Scroll (No GitHub Write Token on Server)',
    copyGhLabel: 'Copy gh / git decree',
    copiedGhLabel: 'Decree copied!',
    dispatchDispatched: 'Workflow Dispatched (god.yml)',
    dispatchFallback: 'Manual Workflow Fallback',
    dispatchButton: 'Dispatch god.yml',
    dispatchingButton: 'Dispatching god.yml…',
    openWorkflowLink: 'View god.yml Runs',
    copyWorkflowLabel: 'Copy gh workflow command',
    copiedWorkflowLabel: 'Workflow command copied!'
  },
  oracleBadge: 'Stone-Tablet Oracle (No LLM key set — still judgmental)',
  llmBadge: 'Live Celestial LLM Connected',
  githubReadyBadge: 'GitHub PR Forge Armed',
  githubLocalBadge: 'GitHub PR Forge: Local Scroll Mode'
};
