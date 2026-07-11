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
    closePrompt: 'Close prompt'
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
    rephrasePlain: 'Rephrase in plain language — click again for even simpler'
  }
};
