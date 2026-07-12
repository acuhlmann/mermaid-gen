/** English UI chrome — menus, controls, dialogs, settings. */
export const CONTROLS_EN = {
  actions: {
    definition: 'What is this?',
    definitionPersona: 'Quick Reference',
    definitionTitle: 'Quick Reference · What does this element mean?',
    stakeholders: 'Stakeholders',
    stakeholdersTitle: 'Stakeholders · Tap to summon the roundtable',
    renderMode: 'Render as...',
    renderModePersona: 'Mode Shifter',
    renderModeTitle: 'Mode Shifter · Re-render this selection in another mode',
    refine: 'Refine',
    innovate: 'Innovate',
    goMad: 'Go Mad',
    goMadder: 'Go Madder',
    goMaddest: 'Go Maddest',
    maxMadness: 'Max madness',
    coDesign: 'Co-Design',
    critique: 'Critique',
    fix: 'Fix',
    fixPersona: 'Site Foreman',
    fixTitle: 'Site Foreman · Fixing the slop',
    explain: 'Explain',
    clear: 'Clear',
    clearTitle: 'Clear · Demolish the slop and start fresh',
    demolish: 'Demolish',
    mute: 'Mute',
    unmute: 'Unmute',
    muteAria: 'Mute stakeholders',
    unmuteAria: 'Unmute stakeholders',
    muteTitle: 'Stakeholders watching · click to mute',
    unmuteTitle: 'Stakeholders muted · click to unmute'
  },
  prompt: {
    yourTopic: 'Your Topic',
    doIt: 'Do it',
    mic: 'Mic',
    holdToSpeak: 'Hold to speak',
    holdToDictate: 'Hold to dictate prompt',
    tapToDictate: 'Tap to dictate',
    tapToDictatePrompt: 'Tap to dictate prompt',
    tapToStop: 'Tap to stop dictation',
    voiceNeedsHttps: 'Voice input needs a secure connection (HTTPS), except on localhost',
    voiceUnsupported: 'Voice input not supported in this browser',
    slopNextTitle: 'What should we slop next?',
    slopNextPlaceholder: 'Tell the agent what to change…',
    slopNextLabel: 'New prompt',
    closePrompt: 'Close prompt',
    // First-run onboarding: verb-led placeholders cycle in the empty-state input
    // to show *what* you can type; the starter chips below let a newcomer begin
    // with one tap instead of a cold blank box.
    topicExamples: [
      'Explain how OAuth 2.0 works…',
      'Map our CI/CD deploy pipeline…',
      'Diagram a microservices architecture…',
      'Break down the coffee supply chain…',
      'Design a URL shortener…'
    ],
    starterHint: 'New here? Tap a topic to begin:',
    starterAria: 'Example topics to get started',
    starters: [
      {
        label: 'OAuth 2.0 flow',
        prompt: 'Explain how the OAuth 2.0 authorization code flow works'
      },
      { label: 'CI/CD pipeline', prompt: 'Map a CI/CD pipeline from commit to production' },
      { label: 'Microservices', prompt: 'Diagram a typical microservices architecture' },
      { label: 'Coffee supply chain', prompt: 'Break down the global coffee supply chain' }
    ],
    // Read-only demo shown on the empty canvas so newcomers see a finished
    // diagram (and grasp the point) before typing.
    exampleEyebrow: 'Live example',
    exampleCaption: 'This is what archislop does — start your own below.',
    exampleAria: 'Example diagram showing how archislop works',
    // "try this one" CTA on the empty-canvas example — seeds a real topic and
    // runs it so the newcomer's first result is a live diagram, not the meta demo.
    exampleCta: 'Try this one →'
  },
  settings: {
    label: 'Settings',
    show: 'Show settings',
    hide: 'Hide settings',
    title: 'Settings · invite agent, mode, brain',
    region: 'Session settings',
    externalAgents: 'External agents',
    waitingHandshake: 'Waiting for handshake:',
    externalAgentFallback: 'External agent',
    brain: 'Brain',
    fast: 'Fast',
    quality: 'Quality',
    mode: 'Mode',
    thinking: 'Thinking',
    aiCluster: 'AI model and thinking'
  },
  contentModes: {
    mermaid: 'Diagram',
    mermaidShort: 'Diagram',
    mermaidSubtitle: 'Mermaid architecture graph',
    infographic: 'Infographic',
    infographicShort: 'Infographic',
    infographicSubtitle: 'AntV narrative layout',
    metaphor3d: '3D metaphor',
    metaphor3dShort: '3D',
    metaphor3dSubtitle: 'Three.js spatial scene',
    chart: 'Chart',
    chartShort: 'Chart',
    chartSubtitle: 'Vega-Lite data view',
    anything: 'Anything page',
    anythingShort: 'Anything',
    anythingSubtitle: 'HTML/CSS/JS sandbox',
    anotherMode: 'another mode',
    renderMenu: 'Target render mode'
  },
  // First-run mode reveal — promotes the render modes out of Settings once the
  // newcomer has their first diagram. Fires once, ever.
  modeReveal: {
    eyebrow: 'One topic, many forms',
    body: "There's more than a diagram in here. Re-render the same topic as a 3D scene, a chart, an infographic, or a freeform page.",
    pickPrefix: 'Render as',
    dismiss: 'Got it',
    aria: 'Try rendering your topic in another mode'
  },
  hotkeys: {
    title: 'Keyboard shortcuts',
    close: 'Close keyboard shortcuts',
    hint: 'Single-letter hotkeys fire when a diagram element is selected. Hotkeys are ignored while typing.',
    refine: 'Refine — polish labels & structure',
    innovate: 'Innovate — bolder redesign',
    goMad: 'Go Mad — chaos transformation',
    exec: 'Exec — boil it down',
    critique: 'Critique — structured review',
    explain: 'Explain — what does this mean?',
    toggleHelp: 'Toggle this help',
    esc: 'Close menus / dialogs',
    arrows: 'Move focus across radial actions',
    activate: 'Activate focused action'
  },
  clearDialog: {
    prompts: [
      {
        title: '🚧 Demolition permit requested',
        body: 'Sure you want to bulldoze this masterpiece? The slop will live on only in our memories (and probably in three other Confluence pages).'
      },
      {
        title: '🏗️ Wrecking ball on standby',
        body: 'Are you sure? Once we tear this down, the stakeholders are going to want a post-mortem and at least one re-org.'
      },
      {
        title: '⛏️ Ready to grind it to gravel?',
        body: 'Demolishing the diagram resets everything — including our streak of brave architectural decisions.'
      },
      {
        title: '💣 Controlled demolition?',
        body: 'Architecture is forever, except when you click the button. Last chance to keep the slop.'
      }
    ],
    save: 'Save the slop',
    saveAria: 'Save the slop',
    demolish: 'Demolish it!',
    demolishAria: 'Demolish it'
  },
  explainDumb: {
    rephrasePlain: 'Rephrase in plain language — click again for even simpler',
    rephraseYounger: 'Make it even simpler for a younger audience',
    rephraseGibberish: 'One last try: pre-verbal babble',
    decommissionTitle: 'Decommission this explanation (OUT OF SCOPE)',
    decommissionAria: 'I give up — decommission this explanation',
    rephraseAriaSuffix: ' — rephrase for a simpler audience',
    surrenderCaption: "Moved to the architecture backlog. Won't fix. 🏳️",
    rephraseGroup: 'Rephrase options',
    gibberishActive: 'Gibberish simplification active'
  },
  radial: {
    selectionActions: 'Diagram selection actions',
    whatDoesMean: 'What does {target} mean?',
    whatDoesThisMean: 'What does this mean?',
    dragToReposition: 'Drag to reposition',
    decommissioning: 'Decommissioning',
    wiseArchitect: 'The Wise Architect',
    schedulingDeprecation: 'Scheduling deprecation for',
    wiseArchitectOn: 'The Wise Architect on',
    thisElement: 'this element',
    closeExplanation: 'Close explanation',
    drillDeeper: 'Drill Deeper',
    drillDeeperTitle: 'Spin up a full architecture deep-dive in the Thinking panel',
    explanationMissing: 'No explanation came back — try again in a moment.',
    explanationFailed: 'Could not fetch explanation.',
    stakeholdersForElement: 'Stakeholders for this element',
    stakeholdersHeading: 'Stakeholders',
    stakeholdersWithName: 'Stakeholders · {name}',
    closeStakeholders: 'Close stakeholders',
    renderSelectedInMode: 'Render selected item in another mode',
    renderAsHeading: 'Render this as...',
    renderNameAs: 'Render {name} as...',
    closeRenderPicker: 'Close render mode picker',
    currentMode: 'Current mode',
    currentModeIs: '{mode} is the current mode',
    currentModeActive: '{mode} is already active',
    renderAs: 'Render selected item as {mode}',
    renderSelectionAs: 'Render this selection as {mode}',
    outOfScope: 'OUT OF SCOPE',
    wontFix: "WON'T FIX",
    toBacklog: '→ BACKLOG',
    deprecated: 'DEPRECATED'
  },
  stakeholders: {
    theStakeholders: 'The Stakeholders',
    hideActions: 'Hide stakeholders actions',
    openStakeholders: 'Open the Stakeholders · {name}',
    tapToHide: 'Tap to hide',
    tapToOpen: '{name} · tap to open the Stakeholders',
    pickPersona: 'Pick a persona',
    personaMenu: 'Stakeholder personas',
    castGroup: 'Stakeholder cast',
    castLabel: 'Stakeholders',
    castOneOfMany: '{name} is one of {count} stakeholders',
    castSpeaking: '{name} is speaking',
    castAskCommentary: 'Ask {name} for commentary',
    align: 'Align',
    // One-time first-run spotlight framing the stakeholder mechanic.
    introEyebrow: '👥 The roundtable has convened',
    introBody:
      'A stakeholder is weighing in on your diagram — they chime in as you work, whether you asked or not. Mute them anytime with the button on the right.',
    introDismiss: 'Got it',
    introAria: 'Meet the stakeholders'
  },
  invite: {
    title: 'Onboard an external agent',
    subtitle: 'Bring another LLM into the Co-Design roundtable.',
    close: 'Close',
    explainer:
      "External agents join over MCP — they can see the diagram, propose changes, and weigh in alongside the Stakeholders. Scan the QR or hit Connect now to pair an IDE-side agent in one tap; you'll still approve the handshake before anyone touches the slop. For a long-lived setup, use the stable URL under Advanced.",
    loading: 'Loading invite…',
    loadFailed: 'Failed to load invite.',
    rotateFailed: 'Failed to rotate pairing code.',
    scanToConnect: 'Scan to connect',
    qrAlt: 'QR code for MCP pairing URL',
    connectNow: 'Connect now',
    connect: 'Connect',
    copy: 'Copy',
    copied: 'Copied!',
    copyCode: 'Copy code',
    rotateCode: 'Rotate code',
    rotating: 'Rotating…',
    advancedToggleShow: 'Show stable MCP URL & legacy options',
    advancedToggleHide: 'Hide stable MCP URL & legacy options',
    stableMcpUrl: 'Stable MCP URL (configure once)',
    addCursorStable: 'Add to Cursor (stable)',
    addToCursor: 'Add to Cursor',
    claudeCodeStable: 'Claude Code (stable URL)',
    sessionMcpLegacy: 'Session MCP URL (legacy)',
    pairingCode: 'Pairing code',
    pairingCodeAria: 'Pairing code'
  },
  insights: {
    paneLabel: 'Thoughts and analysis',
    title: 'Thinking',
    live: 'Live',
    empty: 'Agent thoughts and critique responses appear here.',
    tipLabel: 'Slopitect Tip™',
    statusIssue: 'Issue',
    statusStopped: 'Stopped',
    statusDone: 'Done',
    statusWorking: 'Working',
    nowIssue: 'Issue',
    now: 'Now',
    contentAnalysis: 'Analysis',
    contentExplanation: 'Explanation',
    contentRefinement: 'Refinement',
    contentInnovation: 'Innovation',
    contentMadMode: 'Mad mode',
    contentUpdates: 'Content updates',
    resultingInfographic: 'Resulting infographic',
    resultingChart: 'Resulting chart',
    resulting3d: 'Resulting 3D scene',
    resultingPage: 'Resulting page',
    resultingDiagram: 'Resulting diagram',
    loadOntoCanvas: 'Load this diagram onto the canvas.',
    patchFromTool: 'Diagram patch from agent tool',
    runDetails: 'Run details',
    elapsedTime: 'Elapsed time',
    totalTime: 'Total time',
    critique: 'Critique',
    suggestion: 'Suggestion',
    note: 'Note',
    levelLadder: 'Level ladder',
    earnXp: 'How to earn XP',
    trophyShelf: 'Trophy shelf',
    closeLevelDetails: 'Close level details',
    patchPreview: 'Patch preview',
    jumpToVersion: 'Jump the canvas back to this version of the diagram.',
    closeThinking: 'Close thinking panel',
    actionableImprovements: 'Actionable improvements',
    restore: 'Restore',
    retry: 'Retry',
    retryQuality: 'Retry with Quality',
    noStructuralChanges:
      'No structural changes detected between this version and the diagram before this step.',
    stopRequest: 'Stop request',
    hide: 'Hide',
    highlightOnCanvas: 'Highlight on canvas',
    clearHighlights: 'Clear canvas highlights',
    highlightedChanges: 'Highlighted changes on canvas',
    removedFromDiagram: 'Removed from diagram: {ids}',
    rawStreamEvents: 'Raw stream events ({count})'
  },
  editor: {
    doneEditing: 'Done editing',
    openEditor: 'Open code editor',
    closeEditor: 'Close code editor',
    codeTitle: 'Code · edit diagram source',
    code: 'Code',
    close: 'Close'
  },
  loading: {
    applyingChange: 'Applying diagram change.',
    transforming: 'Transforming diagram.',
    analyzing: 'Analyzing diagram.',
    applyingFixes: 'Applying critique fixes.',
    applyingStyle: 'Applying style tweaks.',
    resetting: 'Resetting diagram.',
    fixingPage: 'Fixing page runtime error.',
    fixingMermaid: 'Fixing Mermaid syntax.',
    hydrating: 'Loading shared session.',
    refreshing: 'Refreshing diagram.',
    working: 'Working on your request...',
    stopped: 'Stopped.',
    proposalApplied: 'Proposal applied.',
    proposalRejected: 'Proposal rejected.',
    proposalStale: 'Proposal stale.',
    proposalResolved: 'Proposal resolved.',
    invalidRoom: 'Invalid or expired room code.',
    simplifyFailed: 'Could not simplify explanation.',
    micDenied: 'Microphone permission denied for speech recognition.',
    voiceFailed: 'Voice input failed. Try again.',
    voiceUnavailable: 'Voice input is unavailable in this browser.'
  },
  errors: {
    notifications: 'Error notifications',
    dismiss: 'Dismiss error',
    details: 'Error details',
    chartFailed: 'Chart could not render.',
    pageFailed: 'Page could not render.'
  },
  fullscreen: {
    exit: 'Exit fullscreen'
  },
  presence: {
    connected: 'Connected external agents',
    invite: 'Invite agent',
    moreAgents: '{count} more agents',
    inviteTitle: 'Invite an external agent into the Co-Design session'
  },
  proposal: {
    loadPreviewTitle:
      'Load this proposal on the main canvas for a full-size preview. Does not accept the proposal.',
    openFullPreview: 'Open full preview',
    showSource: 'Show source',
    proposedAria: 'Proposed {type} edit from {name}',
    proposedEdit: 'proposed a {type} edit',
    reject: 'Reject',
    rejecting: 'Rejecting…',
    accept: 'Accept & apply',
    applying: 'Applying…',
    statusPrefix: 'Status:'
  },
  handshake: {
    title: 'An external agent wants to join your session',
    reportedClient: 'Reported client:',
    explainer:
      'If you allow this, the agent can read your diagram, propose edits (you approve each one), drop attributed notes, and react to revisions. It cannot apply edits directly.',
    deny: 'Deny',
    denying: 'Denying…',
    allow: 'Allow agent',
    allowing: 'Allowing…'
  },
  appError: {
    title: 'Something went wrong',
    body: 'The app hit an unexpected error and stopped rendering. Reload to recover.',
    reload: 'Reload app'
  },
  checklist: {
    fixSelected: 'Fix selected',
    fixAll: 'Fix all'
  },
  diagramCanvas: {
    streamingSource: 'Streaming validated source…',
    done: 'Done'
  },
  anythingCanvas: {
    canvas: 'Anything canvas (sandboxed)',
    dismissError: 'Dismiss runtime error'
  },
  embeddedPreview: {
    infographic: 'Infographic preview (read-only)',
    chart: 'Chart preview (read-only)',
    metaphor3d: '3D metaphor preview (read-only)',
    page: 'Page preview (read-only)',
    mermaid: 'Mermaid preview (read-only)'
  },
  diagramSurface: {
    controls: 'Diagram surface controls'
  },
  runFx: {
    reviewing: 'REVIEWING'
  },
  advisor: {
    pinned: 'Pinned',
    suggestionNav: 'Stakeholder suggestion navigation',
    nextComment: 'Next stakeholder comment',
    drillDeeperAria: 'Drill deeper — open the full architecture dissertation',
    drillDeeperTitle: 'Open the full architecture deep-dive in the Thinking panel',
    pinTitle: 'Pinned — click to unpin',
    unpinTitle: 'Click to pin this comment',
    olderSuggestion: 'Older suggestion',
    olderSuggestionAt: 'Older suggestion ({pos})',
    oldestSuggestion: 'Oldest suggestion',
    applySuggestion: 'Apply suggestion from {name}'
  },
  metaphor: {
    legend: 'Legend',
    type: 'Metaphor type',
    viewAs: 'View as',
    kinds: {
      city: 'City',
      layercake: 'Layer cake',
      galaxy: 'Galaxy',
      tree: 'Tree',
      terrain: 'Terrain',
      orrery: 'Orrery',
      river: 'River',
      garden: 'Garden',
      archipelago: 'Archipelago'
    }
  },
  styleEdits: {
    region: 'Style edits',
    title: 'Visual tweaks',
    iconReplace: 'Icon replace',
    colorShift: 'Color shift',
    apply: 'Apply style tweaks'
  },
  runTimeline: {
    summary: 'Run summary',
    activity: 'Run activity timeline',
    runActivity: 'Run activity',
    intent: 'Intent',
    triggeredBy: 'Triggered by',
    validationFeedback: 'Validation feedback',
    elapsedSoFar: 'Elapsed so far',
    stepDuration: 'Step duration',
    elapsedRunTime: 'Elapsed run time',
    totalRunTime: 'Total run time',
    timeInStepSoFar: 'Time in this step so far',
    timeSpentInStep: 'Time spent in this step',
    endedWithIssue: 'Ended with an issue',
    stopped: 'Stopped',
    done: 'Done',
    phases: {
      run_started: 'Start',
      planning: 'Plan',
      analyze: 'Analyze',
      analyze_stream: 'Stream',
      intent: 'Apply',
      agent_run: 'Tools',
      transform: 'Transform',
      syntax_fixer: 'Syntax',
      chart_syntax_fixer: 'Syntax',
      metaphor_syntax_fixer: 'Syntax',
      anything_syntax_fixer: 'Syntax',
      syntax_repair: 'Repair',
      patch_retry: 'Retry',
      invoke: 'Generate',
      invoke_fallback: 'Finalize',
      repair_1: 'Repair',
      repair_2: 'Repair',
      chart_transform: 'Transform',
      chart_style: 'Style',
      chart_analyze: 'Analyze',
      metaphor_transform: 'Transform',
      metaphor_analyze: 'Analyze',
      anything_transform: 'Transform',
      anything_analyze: 'Analyze',
      activity: 'Activity'
    },
    running: {
      model: 'Reasoning…',
      fixer: 'Repairing',
      patch: 'Validating',
      inspect: 'Reading context',
      tool: 'Working'
    },
    doneLabels: {
      model: 'Turn complete',
      fixer: 'Repair complete',
      patch: 'Update accepted',
      inspect: 'Context loaded',
      tool: 'Complete'
    },
    validationFailed: 'Validation failed',
    interrupted: 'Interrupted',
    queued: 'Queued',
    kicker: {
      live: 'Live activity',
      issue: 'Run issue',
      stopped: 'Run stopped',
      activity: 'Run activity'
    },
    headline: {
      working: 'Working…',
      stoppedOnIssue: 'Stopped on an issue',
      stoppedByYou: 'Stopped by you',
      recovered: 'Recovered and completed',
      allComplete: 'All steps complete'
    },
    units: {
      phase: 'phase',
      phases: 'phases',
      modelTurn: 'model turn',
      modelTurns: 'model turns',
      toolRun: 'tool run',
      toolRuns: 'tool runs',
      planBeat: 'plan beat',
      planBeats: 'plan beats',
      repair: 'repair',
      repairs: 'repairs',
      issue: 'issue',
      issues: 'issues',
      technicalStep: 'technical step',
      technicalSteps: 'technical steps'
    }
  }
};
