/** English UI chrome — menus, controls, dialogs, settings. */
export const CONTROLS_EN = {
  actions: {
    definition: 'What is this?',
    definitionPersona: 'Quick Reference',
    definitionTitle: 'Quick Reference · What does this element mean?',
    // "Stakeholders" is the internal id; the fiction calls them your team (the
    // senior tier only shows up in meetings — see castTiers.js).
    stakeholders: 'Your Team',
    stakeholdersTitle: 'Your Team · Tap to huddle',
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
    facilities: 'Facilities',
    facilitiesTitle: 'Call Facilities · fix the slop',
    explain: 'Explain',
    clear: 'Clear',
    clearTitle: 'File a demolition permit · clear the desk and start fresh',
    demolish: 'Shredder',
    mute: 'Headphones',
    unmute: 'Headphones off',
    muteAria: 'Put headphones on — mute your team',
    unmuteAria: 'Take headphones off — unmute your team',
    muteTitle: 'Your team is hovering · put headphones on',
    unmuteTitle: 'Headphones on · team is muted · click to take them off',
    prepForVp: 'Prep for the VP',
    prepForVpTitle: 'Prep for the VP · Boil it down before it goes upstairs'
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
    slopNextPlaceholder: 'Prompt anything into reality…',
    slopNextLabel: 'New prompt',
    closePrompt: 'Close prompt',
    // The persistent Work Order at the centre of the desk (content mode).
    deskLabel: 'Work order — what should we change?',
    deskPlaceholder: 'Prompt anything into reality…',
    topicPlaceholder: 'Prompt anything into reality…',
    starterHint: 'Or pick up an assignment from the floor:',
    starterAria: 'Assignment requests from the floor',
    entryIntro: {
      greeting: 'Welcome, {name}',
      role: 'Architect',
      body: 'This is your desk — the same controls you will use every day. We will walk through them next.'
    },
    entryPointers: [
      {
        id: 'work-order',
        label: 'Work order',
        text: 'Pitch your topic here. This is the prompt that builds the deliverable.'
      },
      {
        id: 'desk',
        label: 'Your desk',
        text: 'Tap the helmet for mail, export, and more. The notebook icon beside the desk tray opens your thinking notes.'
      },
      {
        id: 'notebook',
        label: 'Notebook',
        text: 'Open your notebook for run history, critiques, and the code drawer.'
      },
      {
        id: 'team',
        label: 'Your Team',
        text: 'Colleagues live here. They weigh in once you have a diagram on the canvas.'
      },
      {
        id: 'format',
        label: 'Desk tray',
        text: 'Open the tray for Deliverable format — Diagram, Chart, Anything, and the rest. Pick one before you generate.'
      }
    ],
    entryTour: {
      next: 'Next',
      skip: 'Skip tour'
    },
    renderAsHint:
      'Pick a format from the Desk tray before you generate. Your desk helmet has export and mail; the notebook icon opens thinking notes and the code drawer.',
    // Starters double as in-fiction assignments: `fromId` names the requester
    // (any cast id officeSenderInfo can resolve) and `ask` is their one-line
    // justification. `label`/`prompt` stay the real generation inputs — locale
    // bundles may ship plain {label, prompt} entries and still render.
    starters: [
      {
        label: 'Coffee supply chain',
        prompt: 'Break down the global coffee supply chain',
        fromId: 'exec',
        ask: 'Needs it before the board offsite. Non-negotiable.'
      },
      {
        label: 'OAuth 2.0 flow',
        prompt: 'Explain how the OAuth 2.0 authorization code flow works',
        fromId: 'ciso',
        ask: 'Wants every arrow labeled and accountable.'
      },
      {
        label: 'CI/CD pipeline',
        prompt: 'Map a CI/CD pipeline from commit to production',
        fromId: 'scrumMaster',
        ask: 'For the sprint review. Great energy so far!'
      },
      {
        label: 'Microservices',
        prompt: 'Diagram a typical microservices architecture',
        fromId: 'greybeard',
        ask: 'So he can tell you it was tried in 2009.'
      }
    ],
    // Compact purpose card on the empty canvas: brand → one job → sample → CTA,
    // revealed beat-by-beat so newcomers aren't handed every mode at once.
    exampleEyebrow: 'ArchiSlop Corp. · IT Division',
    exampleHeadline: 'Welcome aboard, {name}',
    exampleRole: 'Architect',
    exampleBody: 'Turn any topic into a deliverable. Start with whatever you care about.',
    exampleTopic: 'Global coffee supply chain',
    exampleAria: 'Example of an archislop visualization you can generate',
    // CTA names the sample topic so it stays clear even when the preview is hidden.
    exampleCta: 'Try it: Coffee supply chain →',
    exampleDiagramSource: `flowchart TD
    A["Farm"] --> B["Roaster"]
    B --> C["Distributor"]
    C --> D["Cafe"]`,
    // Empty-state Render as strip — introduce modes before Settings.
    renderAsLabel: 'Deliverable format',
    renderAsAria: 'Choose how to render your topic'
  },
  // Day One badge — the new-hire framing card at the top of the entry cluster.
  // {userTitle} renders the current gamification level title.
  dayOne: {
    eyebrow: 'ArchiSlop Corp. · Employee Badge',
    rolePrefix: 'New Hire',
    hrLine:
      'Badge photo: still processing. Desk: this one. Equity: vibes. Compliance training: already overdue (a record).',
    pitchLine:
      "This canvas is your deliverable. Pitch any topic below — or take a colleague's assignment when you're feeling Series-A brave.",
    dismissAria: 'Put the badge away',
    // The editable "HELLO, my name is ___" lanyard. Name yourself once and the
    // whole office (Linda's welcome, Chad's IMs, the orientation) uses it live.
    nameTag: {
      hello: 'HELLO',
      subtitle: 'my name is',
      placeholder: 'Newbie',
      editTitle: 'Type your name — the whole office will start using it',
      inputAria: 'Your name for the office'
    }
  },
  introLocale: {
    aria: 'Interface language',
    en: 'English',
    enAu: 'Aussie Slang',
    zhCn: 'Simplified Chinese',
    zhTw: 'Traditional Chinese'
  },
  settings: {
    label: 'Settings',
    show: 'Show settings',
    hide: 'Hide settings',
    title: 'Workstation · contractors & code drawer',
    region: 'Session settings',
    // The Outbox — export/share promoted out of Settings into its own desk drawer.
    outboxLabel: 'Outbox',
    outboxShow: 'Open the outbox',
    outboxHide: 'Close the outbox',
    outboxTitle: 'Outbox · Ship this deliverable — save, copy, or share',
    outboxRegion: 'Outbox — export & share',
    externalAgents: 'External agents',
    waitingHandshake: 'Waiting for handshake:',
    externalAgentFallback: 'External agent',
    // Concentration lives on the Work Order footer and Thinking header.
    brain: 'Concentration',
    fast: 'Rush job',
    quality: 'Deep work',
    concentrationTitle: 'How hard you are thinking before the next deliverable',
    mode: 'Mode',
    thinking: 'Notebook',
    aiCluster: 'Workstation',
    export: 'Export',
    exportEmpty: 'Generate something first to export it.',
    exportWorking: 'Exporting…',
    exportFailed: 'Export failed',
    exportMermaidSource: 'Mermaid source (.mmd)',
    exportMermaidSvg: 'SVG image (.svg)',
    exportInfographicDsl: 'Infographic DSL (.txt)',
    exportInfographicPng: 'PNG image (.png)',
    exportMetaphorJson: 'Scene JSON (.json)',
    exportMetaphorPng: 'PNG screenshot (.png)',
    exportMetaphorUsda: 'USD scene (.usda)',
    exportChartCsv: 'Spreadsheet CSV (.csv)',
    exportChartJson: 'Chart JSON (.json)',
    exportChartPng: 'PNG image (.png)',
    exportChartVegaLite: 'Vega-Lite spec (.vl.json)',
    exportAnythingHtml: 'Standalone HTML (.html)',
    exportFormsJson: 'Forms JSON (.json)',
    exportFormsPng: 'PNG screenshot (.png)',
    exportMermaidPng: 'PNG image (.png)',
    exportSave: 'Save',
    exportCopy: 'Copy',
    exportShare: 'Share',
    exportSharePrimary: 'Share',
    exportSharePreparing: 'Preparing…',
    exportActionsFor: 'Actions for {label}',
    exportSaved: 'Saved to your device',
    exportShared: 'Shared',
    exportCopiedText: 'Copied to clipboard',
    exportCopiedImage: 'Copied image to clipboard',
    exportOpenPreview: 'Open preview',
    exportCopyAgain: 'Copy again',
    exportShareAgain: 'Share again',
    exportDismiss: 'Dismiss',
    exportDownloadHint: 'Check your notification shade or Files → Downloads.'
  },
  contentModes: {
    auto: 'Auto',
    autoShort: 'Auto',
    autoSubtitle: 'Pick the best mode for your topic',
    mermaid: 'Diagram',
    mermaidShort: 'Diagram',
    mermaidSubtitle: 'Mermaid architecture graph',
    mermaidTech: 'Mermaid',
    infographic: 'Infographic',
    infographicShort: 'Infographic',
    infographicSubtitle: 'AntV narrative layout',
    infographicTech: 'AntV',
    metaphor3d: '3D metaphor',
    metaphor3dShort: '3D',
    metaphor3dSubtitle: 'Three.js spatial scene',
    metaphor3dTech: 'Three.js',
    chart: 'Chart',
    chartShort: 'Chart',
    chartSubtitle: 'Vega-Lite data view',
    chartTech: 'Vega-Lite',
    anything: 'Anything page',
    anythingShort: 'Anything',
    anythingSubtitle: 'HTML/CSS/JS sandbox',
    anythingTech: 'HTML · CSS · JS',
    forms: 'Forms',
    formsShort: 'Forms',
    formsSubtitle: 'Endless A2UI intake forms',
    formsTech: 'A2UI',
    anotherMode: 'another mode',
    renderMenu: 'Deliverable format'
  },
  // First-run mode reveal — after the first result, reminds newcomers they can
  // switch forms from the Desk tray. Skipped if they already picked a format.
  modeReveal: {
    eyebrow: 'Same topic, another deliverable',
    body: 'Change format anytime from the Desk tray (🗄️) in the bottom bar — hand the same idea in as a 3D scene, chart, infographic, or freeform page.',
    pickPrefix: 'Hand it in as',
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
    stakeholdersForElement: 'Your team on this element',
    stakeholdersHeading: 'Your Team',
    stakeholdersWithName: 'Your Team · {name}',
    closeStakeholders: 'Close your team',
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
  renderAsDock: {
    openRenderAs: 'Open Deliverable format · {mode}',
    tapToHide: 'Tap to hide',
    tapToOpen: '{mode} · tap to change deliverable format',
    pickMode: 'Pick a format'
  },
  // The desk tray — work-surface tools (format, facilities, shredder) grouped
  // out of the way so the Work Order and Your Team stay the primary desk objects.
  deskDrawer: {
    label: 'Desk tray',
    close: 'Close the desk tray',
    title: 'Desk tray · Deliverable format, facilities & shredder',
    menuAria: 'Desk tray',
    roleTag: 'Work surface',
    formatHeading: 'Deliverable format',
    deskHeading: 'Work surface'
  },
  stakeholders: {
    theStakeholders: 'Your Team',
    hideActions: 'Hide team actions',
    openStakeholders: 'Open your team · {name}',
    tapToHide: 'Tap to hide',
    tapToOpen: '{name} · tap to open your team',
    pickPersona: 'Pick a teammate',
    personaMenu: 'Your team',
    castGroup: 'Your team',
    castLabel: 'Your Team',
    castOneOfMany: '{name} is one of {count} teammates',
    castSpeaking: '{name} is speaking',
    castAskCommentary: 'Ask {name} for commentary',
    align: 'Prep for the VP',
    seniorDivider: 'Upstairs',
    teamActionsHeading: 'Your team',
    teammatesDivider: 'Teammates',
    // One-time first-run spotlight framing the team mechanic.
    introEyebrow: '👥 Your team has opinions',
    introBody:
      'A teammate is weighing in on your diagram — they chime in as you work, whether you asked or not. It is literally their job. Open Your Team and put on Headphones anytime to shut them out.',
    introDismiss: 'Got it',
    introAria: 'Meet your team'
  },
  invite: {
    title: 'Onboard a contractor',
    subtitle: 'Bring another LLM onto the project. Procurement has been notified.',
    close: 'Close',
    explainer:
      "External agents join over MCP — they can see the diagram, propose changes, and weigh in alongside your team. Scan the QR or hit Connect now to pair an IDE-side agent in one tap; you'll still approve the handshake before anyone touches the slop. For a long-lived setup, use the stable URL under Advanced.",
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
    title: 'Notebook',
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
    resultingForm: 'Resulting form',
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
    sourceContext: 'Source context',
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
    rawStreamEvents: 'Raw stream events ({count})',
    via: 'via',
    modeSuffix: 'mode',
    brainSuffix: 'brain',
    phaseStep: 'Phase {step}',
    streakTitle: '{name} streak',
    diffAdded: '+{count} added',
    diffChanged: '~{count} changed',
    diffRemoved: '−{count} removed',
    changesSincePrevious: 'Changes since previous version',
    showThinking: 'Show {thinking}',
    hideThinking: 'Hide {thinking}',
    showThinkingPanel: 'Show {thinking} panel',
    hideThinkingPanel: 'Hide {thinking} panel',
    streamDone: 'Done',
    awaitingDecision: 'Awaiting your decision.',
    attributedNoteStatus: 'Note',
    errorPrefix: 'Error',
    nowStatus: {
      repairingSyntax: 'Repairing diagram syntax…',
      stillWorking: 'Still working…',
      thinking: 'Thinking…',
      applyingPatch: 'Applying diagram patch…',
      planningUpdate: 'Planning the update…',
      polishing: 'Polishing the diagram…',
      restructuring: 'Restructuring the diagram…',
      reviewing: 'Reviewing the diagram…',
      explaining: 'Explaining the diagram…',
      goingOffScript: 'Going off-script…',
      updatingStyle: 'Updating visual style…',
      simplifyingExec: 'Simplifying for executives…',
      workingOnDiagram: 'Working on the diagram…',
      workingOnRequest: 'Working on your request...'
    },
    goIntent: {
      go: 'Go',
      goDiagram: 'Go — diagram',
      goQuoted: "Go '{excerpt}'",
      edge: 'edge',
      node: 'node',
      subgraph: 'subgraph',
      item: 'item',
      title: 'title',
      description: 'description',
      itemDesc: 'item desc',
      itemValue: 'item value',
      itemIcon: 'item icon',
      mark: 'mark',
      axis: 'axis',
      legend: 'legend',
      element: 'Element'
    },
    streamFailures: {
      staleRevision: 'Diagram changed elsewhere — refresh and retry.',
      timeout: 'Run timed out — try Fast or retry.',
      network: 'Connection or stream timed out. Retry.',
      syntaxExhausted: "Couldn't apply a valid result.",
      noPatch: 'No diagram patch was applied. Retry or try Quality.',
      generic: 'Something failed. You can retry.'
    },
    syntaxFixer: {
      repaired: 'Repaired invalid DSL and applied the patch.',
      rejected: 'Syntax fixer output was rejected by validation.',
      failed: 'Syntax fixer could not repair the source.'
    },
    selectionKinds: {
      label: 'Label',
      node: 'Node',
      timeline: 'Timeline',
      participant: 'Participant',
      cluster: 'Subgraph',
      edge: 'Edge',
      title: 'Title',
      description: 'Description',
      value: 'Value',
      icon: 'Icon',
      item: 'Item',
      mark: 'Mark',
      axis: 'Axis',
      legend: 'Legend',
      element: 'Element'
    }
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
    pageFailed: 'Page could not render.',
    formFailed: 'This form could not be rendered.'
  },
  fullscreen: {
    enter: 'Enter fullscreen',
    exit: 'Exit fullscreen'
  },
  advisorThinking: {
    refine: 'is polishing',
    innovate: 'is disrupting',
    goMad: 'IS LOSING IT',
    critique: 'is auditing',
    explain: 'is musing',
    default: 'is thinking'
  },
  planBeat: {
    agent: 'Agent',
    plan: 'Plan',
    samePreviewAbove: 'Same diagram as above ↑'
  },
  gamificationHud: {
    bonus: 'bonus',
    streak: 'streak',
    combo: 'COMBO',
    levelUp: 'LEVEL UP',
    lvlPrefix: 'Lvl',
    max: 'MAX',
    xpLabel: 'XP',
    tapForDetails: ' — tap for details',
    levelAriaMax: 'Level {level}, max level, {totalXp} {xpLabel} total',
    levelAriaProgress: 'Level {level}, {xpInto} of {xpForNext} {xpLabel} to next level',
    levelFallbackTitle: 'Slopitect'
  },
  brand: {
    totalSlopRuns: '{count} total slop runs',
    tapToShowXp: 'tap to show XP',
    tapToHideXp: 'tap to hide XP'
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
    done: 'Done',
    loadingEditor: 'Loading code editor…',
    selectAll: 'Select all',
    copy: 'Copy'
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
    mermaid: 'Mermaid preview (read-only)',
    forms: 'Form preview (read-only)'
  },
  diagramSurface: {
    controls: 'Diagram surface controls'
  },
  runFx: {
    reviewing: 'REVIEWING'
  },
  advisor: {
    pinned: 'Pinned',
    suggestionNav: 'Team suggestion navigation',
    nextComment: 'Next teammate comment',
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
      archipelago: 'Archipelago',
      machine: 'Machine',
      composite: 'Composite'
    },
    compositeHintTitle: 'Composite mode',
    compositeHintBody:
      'The fused world is waiting for at least one semantic layer. Ask Go to complete the scene.'
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
    runCostEstimateLabel: 'Est. run cost',
    runCostTotalLabel: 'Run total',
    runCostEstimateTitle: 'Approximate LLM spend for this agent run (not a billed amount)',
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
      chart_invoke: 'Generate',
      metaphor_transform: 'Transform',
      metaphor_analyze: 'Analyze',
      metaphor_invoke: 'Generate',
      anything_transform: 'Transform',
      anything_analyze: 'Analyze',
      anything_invoke: 'Generate',
      forms_transform: 'Transform',
      forms_analyze: 'Analyze',
      forms_invoke: 'Generate',
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
    executionMode: {
      llm: 'LLM',
      code: 'Code'
    },
    kicker: {
      live: 'Live activity',
      issue: 'Run issue',
      stopped: 'Run stopped',
      activity: 'Run summary'
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
    },
    patchLines: '+{added} / −{removed} lines'
  }
};
