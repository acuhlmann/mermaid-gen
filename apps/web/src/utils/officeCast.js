/**
 * The office-parody cast and canned content bank (docs/office-parody.md).
 *
 * Colleagues live ONLY in the ambience layer — they never appear in the radial
 * action menu (that is the stakeholders' turf, see VARIANT_PERSONAS in
 * slopitectCopy.js). Stakeholders may still send office moments and take
 * meeting seats; `officeSenderInfo` resolves display info for both casts.
 *
 * Canned templates keep the office alive with zero LLM cost (and offline).
 * `{label}` is replaced with a visible diagram label, `{userTitle}` with the
 * user's current gamification level title. Keep voices aligned with the server
 * prompts in apps/server/src/agents/officePersonas.js.
 */

import { getVariantPersona } from './slopitectCopy.js';

let activeOfficeBundle = null;

/**
 * Locale override hook — mirrors setActiveSlopitectBundle. UiLocaleContext
 * feeds the merged `office` bundle from getUiLocaleBundle here; every accessor
 * below falls back to the English constants in this file.
 */
export function setActiveOfficeBundle(bundle) {
  activeOfficeBundle = bundle;
}

function office() {
  return activeOfficeBundle;
}

export const OFFICE_COLLEAGUES = {
  intern: {
    id: 'intern',
    name: 'Chad',
    title: 'The Intern (Unpaid, Strategic)',
    blurb: 'Replies-all. Asks naive questions that are accidentally profound.',
    avatarEmoji: '🧃',
    accentColor: '#65a30d',
    emailFrom: 'chad.intern@archislop.corp',
    imHandle: '@chad',
    canJoinMeetings: true
  },
  scrumMaster: {
    id: 'scrumMaster',
    name: 'Pam',
    title: 'Agile Coach — CSM, CSPO, SAFe 6.0',
    blurb: 'Everything is a ceremony. Will time-box your lunch. Runs every meeting.',
    avatarEmoji: '📅',
    accentColor: '#0ea5e9',
    emailFrom: 'pam.agile@archislop.corp',
    imHandle: '@pam',
    canJoinMeetings: true
  },
  helpdesk: {
    id: 'helpdesk',
    name: 'Ticket Bot Dave',
    title: 'IT Helpdesk — Tier 1 (of 1)',
    blurb: 'Closes tickets as duplicates of themselves. Works on his machine.',
    avatarEmoji: '🖥️',
    accentColor: '#64748b',
    emailFrom: 'no-reply@helpdesk.archislop.corp',
    imHandle: '@dave',
    canJoinMeetings: false
  },
  facilities: {
    id: 'facilities',
    name: 'Gary',
    title: 'Facilities & Fridge Czar',
    blurb: 'Sends ALL-CAPS fridge cleanouts. Controls the thermostat with an iron fist.',
    avatarEmoji: '🧹',
    accentColor: '#b45309',
    emailFrom: 'facilities@archislop.corp',
    imHandle: '@gary',
    canJoinMeetings: false
  },
  hr: {
    id: 'hr',
    name: 'Linda',
    title: 'People Ops Business Partner',
    blurb: 'Weaponized cheerfulness. Your training is 847 days overdue. Sign Craig’s card.',
    avatarEmoji: '📎',
    accentColor: '#db2777',
    emailFrom: 'people-ops@archislop.corp',
    imHandle: '@linda',
    canJoinMeetings: false
  },
  greybeard: {
    id: 'greybeard',
    name: 'Ulrich',
    title: 'Staff Engineer Emeritus',
    blurb: '“We tried that in 2009.” Maintains the mainframe. Unsettlingly good advice.',
    avatarEmoji: '🧓',
    accentColor: '#57534e',
    emailFrom: 'ulrich@mainframe.archislop.corp',
    imHandle: '@ulrich',
    canJoinMeetings: true
  },
  ciso: {
    id: 'ciso',
    name: 'Sasha',
    title: 'CISO — The Department of No',
    blurb:
      'Everything is an attack surface, especially the arrows. Runs the phishing tests. Trusts nothing.',
    avatarEmoji: '🔐',
    accentColor: '#dc2626',
    emailFrom: 'secops@archislop.corp',
    imHandle: '@sasha',
    canJoinMeetings: true
  }
};

export function isOfficeColleagueId(value) {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(OFFICE_COLLEAGUES, value)
  );
}

/**
 * The invented senior-stakeholder executives (castTiers.js `senior` tier).
 * `exec` (The VP) and `ciso` (Sasha) are promoted members whose display data
 * already lives in VARIANT_PERSONAS / OFFICE_COLLEAGUES; only the new execs
 * are defined here. Keep voices aligned with SENIOR_MEETING_VOICES in
 * apps/server/src/agents/officePersonas.js.
 */
export const SENIOR_STAKEHOLDERS = {
  cto: {
    id: 'cto',
    name: 'Marcus',
    title: 'CTO — Ships Keynotes, Not Code',
    blurb: 'Vision at scale. Quotes his own conference talk. Last opened an IDE in 2016.',
    avatarEmoji: '🚀',
    accentColor: '#7c3aed'
  },
  cfo: {
    id: 'cfo',
    name: 'Diane',
    title: 'CFO — The Budget Is a No',
    blurb: 'Every box is a cost center. Asks what the diagram costs per month. Approves nothing.',
    avatarEmoji: '🧮',
    accentColor: '#065f46'
  }
};

function stakeholderSenderInfo(id) {
  const persona = getVariantPersona(id);
  const accent = persona?.accentColorVar ?? '--accent';
  return {
    id,
    name: persona?.name ?? 'A Colleague',
    title: persona?.title ?? '',
    avatarEmoji: persona?.avatarEmoji ?? '👤',
    accentColor: accent.startsWith('--') ? `var(${accent})` : accent
  };
}

/**
 * Display info for anyone who can appear in office chrome: colleagues (native),
 * senior executives, or stakeholders (mapped from VARIANT_PERSONAS). Returns
 * `{ id, name, title, avatarEmoji, accentColor }` — accentColor is always a
 * usable CSS color (stakeholder `--vars` are wrapped in var()).
 */
export function officeSenderInfo(id) {
  const colleague = OFFICE_COLLEAGUES[id];
  if (colleague) {
    const localized = office()?.OFFICE_COLLEAGUES?.[id];
    return localized ? { ...colleague, ...localized } : colleague;
  }
  const senior = SENIOR_STAKEHOLDERS[id];
  if (senior) {
    const localized = office()?.SENIOR_STAKEHOLDERS?.[id];
    return localized ? { ...senior, ...localized } : senior;
  }
  return stakeholderSenderInfo(id);
}

/** Steering-meeting seats: senior stakeholders the team presents to. */
export const MEETING_SENIOR_POOL = ['exec', 'ciso', 'cto', 'cfo'];
/** Team members who can be sent upstairs to defend the diagram. */
export const MEETING_PRESENTER_POOL = ['refine', 'critique', 'explain'];
export const MEETING_FACILITATOR = 'scrumMaster';

/**
 * Who can deliver an LLM-personalized moment of each kind. Team + office only —
 * the senior tier never pings you day-to-day (castTiers.js); their one outlet
 * is SENIOR_EMAIL_TEMPLATES and the steering meeting.
 */
export const OFFICE_WALKBY_LLM_CAST = [
  'scrumMaster',
  'intern',
  'greybeard',
  'facilities',
  'hr',
  'critique',
  'explain'
];
export const OFFICE_EMAIL_LLM_CAST = ['critique', 'scrumMaster', 'greybeard', 'hr', 'intern'];
export const OFFICE_IM_LLM_CAST = ['intern', 'greybeard', 'scrumMaster', 'goMad'];

export function pickRandomFrom(list, random = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(random() * list.length)] ?? null;
}

/**
 * Pick 3–4 steering seats: Pam facilitates, 1–2 senior stakeholders outrank
 * the room, and one team member presents (the poor soul walking the deck
 * upstairs).
 */
export function pickMeetingAttendees(random = Math.random) {
  const seniors = [...MEETING_SENIOR_POOL];
  const seats = [MEETING_FACILITATOR];
  const seniorCount = 1 + (random() < 0.5 ? 1 : 0);
  for (let i = 0; i < seniorCount && seniors.length > 0; i += 1) {
    const index = Math.floor(random() * seniors.length);
    seats.push(seniors.splice(index, 1)[0]);
  }
  const presenter = pickRandomFrom(MEETING_PRESENTER_POOL, random) ?? 'refine';
  seats.push(presenter);
  return seats;
}

/** Localized safe defaults for empty `{label}` / `{userTitle}` slot fills. */
export const OFFICE_SLOT_FALLBACKS = {
  label: 'the diagram',
  userTitle: 'Intern Architect'
};

/** Replace `{label}` / `{userTitle}` slots; drops in safe defaults when missing. */
export function fillOfficeSlots(text, { label, userTitle } = {}) {
  const fallbacks = office()?.OFFICE_SLOT_FALLBACKS ?? OFFICE_SLOT_FALLBACKS;
  return String(text ?? '')
    .replaceAll('{label}', label && String(label).trim() ? String(label).trim() : fallbacks.label)
    .replaceAll(
      '{userTitle}',
      userTitle && String(userTitle).trim() ? String(userTitle).trim() : fallbacks.userTitle
    );
}

/**
 * Canned emails — pure office noise (no LLM). Roughly a third get personalized
 * by the LLM instead; these are the offline/failure backbone.
 */
export const OFFICE_EMAIL_TEMPLATES = [
  {
    id: 'email-fridge-cleanout',
    colleagueId: 'facilities',
    subject: 'REMINDER: Fridge cleanout FRIDAY',
    body: 'The refrigerator will be cleaned Friday at 3 PM. Anything unlabelled becomes property of Facilities. This includes containers, condiments, and architecture diagrams.\n\nThanks in advance,\nGary'
  },
  {
    id: 'email-thermostat',
    colleagueId: 'facilities',
    subject: 'RE: RE: RE: Thermostat',
    body: 'The thermostat is set to a scientifically optimal 20.5°C and is now in a locked enclosure. Please stop taping ice packs to the sensor. I know it was the third floor.\n\nGary'
  },
  {
    id: 'email-room-booking',
    colleagueId: 'facilities',
    subject: 'Your booking of "War Room 4" is confirmed',
    body: 'Please note War Room 4 was converted to a wellness pod in 2023, and prior to that did not exist. Your booking remains confirmed.\n\nGary'
  },
  {
    id: 'email-password-expiry',
    colleagueId: 'helpdesk',
    subject: '[Ticket #48291] Your password expires in 14 days',
    body: 'To reset your password, please log in with your expired password and follow the link we will send to the email account you are locked out of.\n\nThis ticket has been closed as RESOLVED.\n\n— Helpdesk (do not reply, do not call, do not)'
  },
  {
    id: 'email-ticket-duplicate',
    colleagueId: 'helpdesk',
    subject: '[Ticket #48292] Closed as duplicate of #48292',
    body: 'Your ticket regarding "{label}" has been closed as a duplicate of itself. If the issue persists, it is a feature.\n\nWorks on my machine,\nDave'
  },
  {
    id: 'email-vpn-maintenance',
    colleagueId: 'helpdesk',
    subject: 'PLANNED OUTAGE: VPN maintenance window',
    body: 'The VPN will be unavailable Saturday 02:00–02:15 and, based on historical data, also Monday through Thursday.\n\nHave you tried turning the diagram off and on again?\n\n— Dave'
  },
  {
    id: 'email-compliance-training',
    colleagueId: 'hr',
    subject: 'Friendly nudge! Training overdue 😊',
    body: 'Just a friendly nudge that your "Working Safely With Diagrams" compliance training is 847 days overdue! Completing it takes only 4 hours and features 11 unskippable modules.\n\nWarmly,\nLinda — People Ops'
  },
  {
    id: 'email-birthday-card',
    colleagueId: 'hr',
    subject: 'Card for Craig — sign by EOD!',
    body: "Craig's birthday card is circulating! Please add a warm personal message for Craig. If you do not know Craig, a warm generic message is fine. Craig knows who you are.\n\nLinda"
  },
  {
    id: 'email-mandatory-fun',
    colleagueId: 'hr',
    subject: "You're invited: Mandatory Team Fun Hour 🎉",
    body: 'Attendance at Thursday\'s optional team-building is mandatory. This quarter\'s theme: "Trust Falls & Org Charts". Please review {label} beforehand so the fun stays aligned.\n\nLinda'
  },
  {
    id: 'email-storypoints',
    colleagueId: 'scrumMaster',
    subject: 'Action required: story-point your diagram',
    body: 'Great energy this sprint! Reminder that all diagram boxes must be story-pointed by tomorrow\'s refinement. "{label}" looks like a 13 — let\'s decompose it in the parking lot.\n\nPam',
    actionPrompt: 'Split the most complex node into two smaller steps'
  },
  {
    id: 'email-intern-replyall',
    colleagueId: 'intern',
    subject: 'RE: RE: FW: RE: quick question',
    body: 'sorry for the reply-all again!! but does anyone know if "{label}" is supposed to connect to the other thing? also where do we keep the stapler? unrelated.\n\nchad (intern)'
  },
  {
    id: 'email-greybeard-migration',
    colleagueId: 'greybeard',
    subject: 'you have reinvented the batch job',
    body: "Saw your diagram on the shared drive. We built this in 2009. It ran on a cron job and fear. Took down prod for a week in 2011.\n\nAsk me how. Or don't. It knows.\n\nUlrich"
  },
  {
    id: 'email-helpdesk-printer-firmware',
    colleagueId: 'helpdesk',
    subject: '[Ticket #48313] Printer firmware update complete',
    body: 'The third-floor printer is now on firmware 9.0.1. New features: refusing PDFs, a louder noise, and printing one (1) page reading "soon" at unscheduled intervals. This is expected behavior.\n\nDo not open a ticket. It will be closed as a duplicate of the printer.\n\n— Dave'
  },
  {
    id: 'email-greybeard-cloud',
    colleagueId: 'greybeard',
    subject: 'RE: cloud migration kickoff',
    body: "The cloud is the mainframe with better marketing. I migrated us once — 2009, to 'the grid'. We migrated back in 2010. Quietly. At night.\n\nYour {label} will run fine either way. Things mostly do, until they don't.\n\nUlrich"
  },
  {
    id: 'email-scrum-retro-retro',
    colleagueId: 'scrumMaster',
    subject: 'Invite: Retro on the Retro (mandatory, fun)',
    body: "Team! Our retro scored 4.2/5 on energy but only 2.9 on actionability, so we're holding a retro on the retro. Please bring one Glad, one Sad, one Mad, and a backup Mad.\n\nAction items from the previous retro carry over untouched, as tradition demands.\n\nPam"
  },
  {
    id: 'email-hr-wellness-webinar',
    colleagueId: 'hr',
    subject: "Wellness Wednesday: 'Mindful Diagramming' 🧘",
    body: 'Join us Wednesday for a guided session on breathing between boxes and letting go of arrows that no longer serve you. We will close with a gratitude circle for {label}.\n\nAttendance is anonymous and tracked.\n\nNamaste-ish,\nLinda — People Ops'
  },
  {
    id: 'email-facilities-microwave',
    colleagueId: 'facilities',
    subject: 'INCIDENT REPORT: The Microwave',
    body: 'At 12:47 someone microwaved fish. The building has feelings about this, and so do I. The microwave is now under new management (mine). A sign-up sheet is on the door: NAME, DISH, INTENTIONS.\n\nThanks in advance,\nGary'
  },
  {
    id: 'email-intern-first-ship',
    colleagueId: 'intern',
    subject: 'i shipped something!!! (small question)',
    body: "you guys!! my first change is LIVE. it's the {label} one. quick question though — if everything is on fire but in a small way, who do i tell? asking hypothetically. the fire is hypothetical. mostly.\n\nchad (intern)"
  }
];

/**
 * Rare high-stakes emails from the senior tier (castTiers.js) — the one
 * ambient outlet executives get. Hard-capped at 1 per session by the cadence
 * brain (officeCadence.js `seniorEmailCount`); the day-to-day banks above
 * stay team + office only.
 */
export const SENIOR_EMAIL_TEMPLATES = [
  {
    id: 'email-ciso-phishing',
    colleagueId: 'ciso',
    subject: 'You did NOT click. We noticed. (Phishing Simulation Report)',
    body: 'Courtesy notice: you failed to click last week\'s simulated phishing email ("FREE ARCHITECTURE REVIEW — CLICK NOW"). Statistically, everyone clicks. Not clicking is suspicious behavior and has been noted in your file.\n\nWe will keep testing until you do.\n\nTrust nothing,\nSasha — The Department of No'
  },
  {
    id: 'email-ciso-password',
    colleagueId: 'ciso',
    subject: 'Password policy update (effective yesterday)',
    body: 'Passwords must now contain 16 characters, one emoji, one prime number, and the ghost of a deprecated protocol. Passwords may not contain: words, numbers, or characters.\n\nYour current password fails 11 of the 4 checks. Impressive, in a way.\n\nSasha'
  },
  {
    id: 'email-exec-board-preread',
    colleagueId: 'exec',
    subject: 'Pre-read needed: the board will ask about {label}',
    body: "Team — the board offsite is Thursday and I need a one-pager on {label}. One page. One. If it can't fit on one page it isn't a strategy, it's a hobby.\n\nHard stop in four minutes,\nThe VP",
    actionPrompt: 'Simplify the diagram to its three most essential elements'
  },
  {
    id: 'email-cfo-cloud-spend',
    colleagueId: 'cfo',
    subject: 'FLAGGED: unexplained line item ("{label}")',
    body: 'Finance flagged a resource called "{label}". Please confirm it is (a) essential, and (b) free. If it cannot be both, see (b).\n\nThe budget is a no,\nDiane'
  },
  {
    id: 'email-cto-conference',
    colleagueId: 'cto',
    subject: 'Saw this exact thing at a keynote (thoughts?)',
    body: 'Just got back from VisionaryConf. There was a slide almost identical to your {label} — except theirs pulsed and had an AI halo. Can ours pulse? Loop in whoever owns pulsing.\n\nOnwards,\nMarcus',
    actionPrompt: 'Add a bold visionary element that makes the diagram feel futuristic'
  }
];

/**
 * First-run onboarding beats (docs/office-parody.md): a welcome email from
 * People Ops that introduces the floor, then an IM from the intern. Pushed
 * once ever by useOfficeWelcome — never part of the random template banks.
 */
export const OFFICE_WELCOME_EMAIL = {
  id: 'welcome-email-hr',
  colleagueId: 'hr',
  subject: 'Welcome aboard, {userTitle}! 🎉 (badge photo: pending)',
  body: 'Welcome to the floor! So thrilled to have you. Your role: deliver. Diagrams, charts, 3D — whatever the floor needs, you architect it. A few names before your mandatory orientation (rescheduled, TBD):\n\n📅 Pam (Agile Coach) runs the meetings. All of them.\n🧃 Chad (our intern) will IM you shortly. He means well.\n🖥️ Ticket Bot Dave is IT. Do not reply, do not call, do not.\n🧹 Gary owns the fridge and the thermostat. Respect both.\n🧓 Ulrich has seen your architecture before. In 2009.\n🔐 Sasha (our CISO) is already suspicious of you. It’s a compliment.\n\nAnd I’m Linda — People Ops! Your compliance training is already overdue, which is honestly a record. The inbox 📥, Focus Time, and Soundscape toggles live in the corner whenever you need us quieter.\n\nWarmly,\nLinda'
};

export const OFFICE_WELCOME_IM = {
  id: 'welcome-im-intern',
  colleagueId: 'intern',
  body: 'hey!! you must be the new {userTitle} — welcome!! the coffee machine has fourteen buttons and twelve are decorative. also gary WILL email you about the fridge. it’s not personal (it is)'
};

/** Canned IM pings — short chat noise with slot fills. */
export const OFFICE_IM_TEMPLATES = [
  {
    id: 'im-intern-boxes',
    colleagueId: 'intern',
    body: 'quick q — is {label} supposed to have that many arrows? asking for my onboarding doc'
  },
  {
    id: 'im-intern-lunch',
    colleagueId: 'intern',
    body: 'anyone else see the fridge email?? gary means business'
  },
  {
    id: 'im-scrum-standup',
    colleagueId: 'scrumMaster',
    body: "Friendly ping! You've been heads-down for a while — should we time-box this? 🙂"
  },
  {
    id: 'im-scrum-retro',
    colleagueId: 'scrumMaster',
    body: 'Adding "{label}" to the retro board as a discussion topic. Great energy!'
  },
  {
    id: 'im-helpdesk-restart',
    colleagueId: 'helpdesk',
    body: 'Scheduled maintenance tonight. Save your work. This is not related to the smoke.'
  },
  {
    id: 'im-helpdesk-printer',
    colleagueId: 'helpdesk',
    body: 'Ticket #48311 (printer, 3rd floor) closed as WONTFIX. The printer has tenure.'
  },
  {
    id: 'im-facilities-plant',
    colleagueId: 'facilities',
    body: 'Whoever is watering the fake plant near the elevators — please stop. It is thriving and I do not like it.'
  },
  {
    id: 'im-hr-survey',
    colleagueId: 'hr',
    body: "Only 2 minutes left to complete the anonymous wellness survey! (We can see you haven't started, {userTitle}.)"
  },
  {
    id: 'im-greybeard-look',
    colleagueId: 'greybeard',
    body: "Looked at {label}. We tried that in 2009. It's fine. Probably."
  },
  {
    id: 'im-greybeard-mainframe',
    colleagueId: 'greybeard',
    body: 'The mainframe asked about you. I told it you were busy diagramming. It understood.'
  },
  {
    id: 'im-helpdesk-dns',
    colleagueId: 'helpdesk',
    body: "Network slow? It's DNS. It's not DNS. It was DNS. Ticket closed."
  },
  {
    id: 'im-greybeard-gitblame',
    colleagueId: 'greybeard',
    body: 'Ran git blame on the outage. It says you. 2019. The mainframe forgives, but it logs.'
  },
  {
    id: 'im-intern-regex',
    colleagueId: 'intern',
    body: 'wrote my first regex!! it matches everything. is that bad? it feels powerful'
  },
  {
    id: 'im-scrum-velocity',
    colleagueId: 'scrumMaster',
    body: "Velocity check! You're averaging 4.2 boxes per hour — amazing! Let's not tell finance we measure this. 🙂"
  },
  {
    id: 'im-facilities-elevator',
    colleagueId: 'facilities',
    body: 'The elevator is making the noise again. Take the stairs. The stairs also make a noise, but a different one.'
  }
];

/** Walk-by fallbacks when the LLM is unavailable — must still name a label. */
export const OFFICE_WALKBY_FALLBACKS = [
  {
    id: 'walkby-scrum',
    colleagueId: 'scrumMaster',
    body: "Ooh, is that {label}? This wasn't on the sprint board — I've added it retroactively as a spike."
  },
  {
    id: 'walkby-intern',
    colleagueId: 'intern',
    body: 'whoa, {label} looks so official. did you make that with the AI? can I put it in my portfolio?'
  },
  {
    id: 'walkby-greybeard',
    colleagueId: 'greybeard',
    body: "{label}, huh. We had one of those in 2009. It's still running. Nobody knows where."
  },
  {
    id: 'walkby-facilities',
    colleagueId: 'facilities',
    body: 'Nice diagram. Is {label} why the third floor smells like burnt popcorn? Be honest.'
  },
  {
    id: 'walkby-hr',
    colleagueId: 'hr',
    body: 'Love the energy around {label}! Have you considered presenting it at Mandatory Fun Hour? 😊'
  },
  {
    id: 'walkby-helpdesk',
    colleagueId: 'helpdesk',
    body: "That {label} box? I have an open ticket about it. Had. It's a known issue now. Congratulations."
  },
  {
    id: 'walkby-greybeard-orchestrator',
    colleagueId: 'greybeard',
    body: "Careful with {label}. The last one of those became self-aware around 2011. We don't say 'orchestrator' out loud anymore."
  }
];

/**
 * Coffee-break scenes: two colleagues at the watercooler, 2–3 lines, mostly
 * smalltalk with the occasional accidental insight.
 */
export const OFFICE_COFFEE_SCENES = [
  {
    id: 'coffee-machine-politics',
    lines: [
      {
        speakerId: 'facilities',
        text: 'New coffee machine has fourteen buttons. Twelve are decorative.'
      },
      { speakerId: 'greybeard', text: 'The old one had one button and a smell. Better days.' }
    ]
  },
  {
    id: 'coffee-standup',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'I dreamed we did standup sitting down. Woke up in a cold sweat.'
      },
      {
        speakerId: 'intern',
        text: "wait, we're allowed to dream about work? is that in the handbook?"
      }
    ]
  },
  {
    id: 'coffee-diagram-glance',
    lines: [
      {
        speakerId: 'greybeard',
        text: "Saw your {label} thing. One box too many. You'll see which one."
      },
      {
        speakerId: 'intern',
        text: 'he does this. last week he told me my badge photo had "too much optimism".'
      }
    ]
  },
  {
    id: 'coffee-craig',
    lines: [
      {
        speakerId: 'hr',
        text: "Did you sign Craig's card? Everyone keeps asking who Craig is. That's not the point of a card."
      },
      { speakerId: 'helpdesk', text: 'Craig is ticket #31337. Closed as "cannot reproduce".' }
    ]
  },
  {
    id: 'coffee-printer',
    lines: [
      {
        speakerId: 'helpdesk',
        text: 'The third-floor printer printed something nobody sent again. One page. Just the word "soon".'
      },
      { speakerId: 'facilities', text: 'That printer is load-bearing. Do not touch the printer.' }
    ]
  },
  {
    id: 'coffee-vision',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'They renamed the roadmap to "north-star journey atlas". The roadmap itself is unchanged since 2022.'
      },
      { speakerId: 'greybeard', text: "In 2009 we called it a list. It also didn't change." }
    ]
  },
  {
    id: 'coffee-dns',
    lines: [
      {
        speakerId: 'helpdesk',
        text: "Postmortem's published. Root cause: DNS. Root cause of the root cause: also DNS."
      },
      {
        speakerId: 'ciso',
        text: "It's always DNS. Except when it's someone testing in prod."
      },
      { speakerId: 'helpdesk', text: 'That resolved through DNS. Officially it was DNS.' }
    ]
  },
  {
    id: 'coffee-cloud-bill',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: "Finance flagged the cloud bill again. I've scheduled a cost-alignment ceremony."
      },
      {
        speakerId: 'greybeard',
        text: 'In 2009 the server lived under my desk. Free. Warm. Loud. Better days.'
      }
    ]
  },
  {
    id: 'coffee-standing-desk',
    lines: [
      {
        speakerId: 'hr',
        text: 'The standing desks arrived! Wellness data says we now sit 94% of the time, but taller.'
      },
      {
        speakerId: 'facilities',
        text: "They rise on their own at night. The desks. I've said too much."
      }
    ]
  },
  {
    id: 'coffee-ai-half',
    lines: [
      {
        speakerId: 'intern',
        text: 'the AI wrote half my code today!! so cool. which half? unclear'
      },
      {
        speakerId: 'ciso',
        text: 'Find out which half. One of them is going in the audit.'
      }
    ]
  }
];

/**
 * Cubicle battles (docs/office-parody.md): two colleagues locked in a holy
 * war — tabs vs spaces, the Friday deploy, the thermostat. The user spectates
 * (lines pace in one by one), then settles it by picking a winner; each side
 * has a `verdicts` closing zinger delivered only when they win. Pure canned
 * theater — zero LLM, works offline, never mean.
 */
export const OFFICE_BATTLE_SCENES = [
  {
    id: 'battle-tabs-spaces',
    topic: 'Tabs vs. spaces',
    lines: [
      {
        speakerId: 'greybeard',
        text: 'Tabs. One keystroke, one character, configurable width. We settled this in 2009.'
      },
      {
        speakerId: 'intern',
        text: 'the style guide says two spaces!! i read the whole thing. it took my weekend'
      },
      {
        speakerId: 'greybeard',
        text: 'The style guide was written by a committee that has never opened a terminal.'
      },
      {
        speakerId: 'intern',
        text: 'the linter agrees with me!!! i have never once beaten the linter'
      }
    ],
    verdicts: {
      greybeard: 'Tabs it is. The linter has been reconfigured. The intern will recover, in time.',
      intern:
        'two spaces win!! ulrich says the industry is doomed, but he says that every day anyway'
    }
  },
  {
    id: 'battle-friday-deploy',
    topic: 'The Friday deploy',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: "The sprint ends Friday, so we deploy Friday. That's just math! Great energy, everyone."
      },
      {
        speakerId: 'ciso',
        text: "Nothing ships on Friday. Incidents don't respect weekends, and neither does my phone."
      },
      {
        speakerId: 'scrumMaster',
        text: "We'll add a Monday 'deploy retro' to process any feelings. And outages."
      },
      {
        speakerId: 'ciso',
        text: "I'll be processing mine from the incident bridge. Bring your feelings and a laptop."
      }
    ],
    verdicts: {
      scrumMaster:
        'Motion carries — we ship Friday! Sasha has pre-declared the incident, to save time.',
      ciso: 'Deploy moved to Monday. The weekend remains legally uneventful. You are welcome.'
    }
  },
  {
    id: 'battle-thermostat',
    topic: 'The thermostat (20.5°C, allegedly)',
    lines: [
      {
        speakerId: 'facilities',
        text: 'The thermostat is set to 20.5°C. That number came from SCIENCE and it is FINAL.'
      },
      {
        speakerId: 'hr',
        text: "Gary, three people are wearing gloves indoors. I'm getting wellness tickets."
      },
      {
        speakerId: 'facilities',
        text: 'Gloves are PERSONAL GROWTH. The sensor stays locked. I know about the ice packs.'
      },
      {
        speakerId: 'hr',
        text: 'Morale rises with temperature! There are studies. I printed one. It was cold to the touch.'
      }
    ],
    verdicts: {
      facilities:
        '20.5°C STANDS. A jumper drive has been organized. Morale is now a fabric problem.',
      hr: "We're trialling 21°C! Gary calls it 'the tropics' and has filed a formal protest."
    }
  },
  {
    id: 'battle-monolith',
    topic: 'One box or fourteen (the monolith question)',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'Splitting {label} into microservices gives every team its own backlog! Autonomy! Ceremonies!'
      },
      {
        speakerId: 'greybeard',
        text: "You'd turn one problem into a distributed system of problems, with worse logging."
      },
      { speakerId: 'scrumMaster', text: "We'd get a service mesh! There's a webinar!" },
      {
        speakerId: 'greybeard',
        text: 'I attended a webinar once. 2011. The mainframe and I still talk about it.'
      }
    ],
    verdicts: {
      scrumMaster:
        "Microservices it is! I've booked a recurring sync for each of the fourteen new repos.",
      greybeard:
        "The monolith stays. In ten years you'll call it 'majestic' and claim it was your idea."
    }
  },
  {
    id: 'battle-dns-postmortem',
    topic: 'The outage postmortem',
    lines: [
      {
        speakerId: 'helpdesk',
        text: "Root cause: DNS. Closing the postmortem. It's always DNS."
      },
      {
        speakerId: 'ciso',
        text: 'It was my firewall rule, and my firewall rule was CORRECT. It blocked something suspicious: all traffic.'
      },
      { speakerId: 'helpdesk', text: 'Which it resolved via DNS. The ticket stands.' },
      {
        speakerId: 'ciso',
        text: 'Blocking everything is the only architecture with zero CVEs. Look it up.'
      }
    ],
    verdicts: {
      helpdesk:
        "'DNS' is accepted as root cause, and pre-approved as root cause for all future incidents. Efficiency.",
      ciso: 'Ruling: the firewall was right. Availability is a rumor started by sales.'
    }
  },
  {
    id: 'battle-tupperware',
    topic: 'The unlabeled tupperware',
    lines: [
      {
        speakerId: 'facilities',
        text: 'An UNLABELED container has been in the fridge since Q2. This is now a FACILITIES matter.'
      },
      {
        speakerId: 'helpdesk',
        text: "I did label it. Ticket #48317: 'container, contents unknown, do not reboot'."
      },
      {
        speakerId: 'facilities',
        text: 'A ticket number is NOT a label. Labels have NAMES and DATES. I provide them. Willingly.'
      },
      {
        speakerId: 'helpdesk',
        text: 'The contents have 94 days of uptime. Longest-running service on this floor. Do not disturb.'
      }
    ],
    verdicts: {
      facilities:
        'The container is GONE. Do not ask where. The fridge is at peace. The label maker won.',
      helpdesk:
        'The container stays. It has been promoted to production. Gary must now file a change request.'
    }
  }
];

/** In-fiction copy for meeting chrome (invites, joining gag, failure gag). */
export const OFFICE_MEETING_COPY = {
  inviteFallbackTitle: 'Architecture Review Board (steering)',
  inviteFallbackBody:
    'Leadership would like a look at the current diagram. Agenda: the headline, the cost, the risk. Your team presents; the seniors have questions. Snacks: no.',
  joiningLine: 'Waiting for the organizer to admit you…',
  cancelledSubject: 'CANCELLED: Architecture Review Board',
  cancelledBody:
    'Meeting cancelled — leadership is double-booked. Rescheduled to: never. Action items remain your problem.\n\nPam',
  proposeNewTimeGag: 'New time proposed. The organizer has declined your proposed time.',
  minutesTitle: 'Meeting minutes',
  raiseHandPlaceholder: 'Say something to the room…',
  leaveLabel: 'Leave meeting',
  interjectCapLine: 'Pam: "Great point — let\'s parking-lot it. We\'re at time."'
};

/** Quick canned replies offered under an IM ping (pure local flavor + tiny XP). */
export const OFFICE_IM_QUICK_REPLIES = ['👍', 'in a meeting', 'circling back'];

/**
 * Static chrome strings for the office surfaces (inbox dock, IM stack,
 * walk-bys, coffee breaks, meeting room). Templated strings use `{name}` /
 * `{count}` slots — render with formatLocale.
 */
export const OFFICE_CHROME_COPY = {
  doIt: 'Do it',
  directory: {
    title: 'Day one at ArchiSlop Corp.',
    tagline: 'Your new floor. Your new colleagues. Their opinions are included at no extra cost.',
    tourHint: 'Meet them one at a time. Mute anytime with Focus Time.',
    rosterTagline: 'The cast that emails, IMs, and walks by while you work:',
    expandLabel: '🏢 Meet the floor',
    expandTitle: 'Who keeps interrupting me?',
    startLabel: 'Meet the floor →',
    nextLabel: 'Next →',
    backLabel: '← Back',
    skipLabel: 'Skip',
    progressLabel: '{current} of {total}',
    dismissLabel: 'Clock in',
    closeAria: 'Close the office directory'
  },
  // Player-initiated desk verbs — the ego-perspective counterpart to the
  // ambience director. `blocked.*` keys are keyed by useDeskActions reasons.
  desk: {
    buttonLabel: 'Your desk',
    buttonAria: 'Your desk — things you can do',
    buttonTitle: 'Get up, wander, bother someone',
    menuAria: 'Desk actions',
    menuHeading: 'What are you doing?',
    coffee: 'Get a coffee',
    walk: 'Walk the floor',
    im: 'Message someone',
    inbox: 'Check your mail',
    meeting: 'Call a meeting',
    team: 'Talk to your team',
    blocked: {
      busy: 'Deploy in progress — nobody leaves their desk.',
      meeting: "You're in a meeting. Look engaged.",
      surface: 'One thing at a time. You are already busy being interrupted.',
      noAgenda: 'Draw something first — even this meeting needs an agenda'
    }
  },
  inbox: {
    buttonTitle: 'Corporate inbox',
    unreadAria: 'Inbox — {count} unread emails',
    noUnreadAria: 'Inbox — no unread email',
    title: '📥 Inbox',
    mailAnnounce: 'You’ve got mail!',
    mailAnnounceLang: 'en-US',
    togglesAria: 'Inbox ambience controls',
    focusTimeLabel: 'Focus Time',
    focusTimeTitle: 'Colleagues (mostly) respect Focus Time',
    soundscapeLabel: 'Soundscape',
    soundscapeTitle:
      'Ambient office noise — keyboards, mouse clicks, paper, chair squeaks, the printer, the desk phone, the watercooler, the espresso machine, the vending machine, the elevator',
    narrationLabel: 'Narration',
    narrationTitle:
      'Speak walk-bys, meetings, cubicle battles, and coffee chat aloud — emails and IMs stay silent',
    closeAria: 'Close inbox',
    back: '← Back',
    emptyLine: 'Inbox zero. HR finds this suspicious. Enjoy it while it lasts.',
    markAllRead: 'Mark all read',
    callMeeting: '📅 Call a meeting',
    callMeetingTitle: 'Summon a working-group meeting about the current diagram',
    callMeetingDisabledTitle: 'Draw something first — even this meeting needs an agenda'
  },
  im: {
    regionAria: 'Instant messages',
    dismissAria: 'Dismiss message from {name}'
  },
  walkby: {
    dismissAria: 'Wave off {name}'
  },
  coffee: {
    inviteLine: 'Coffee break? {name} is holding court at the machine.',
    accept: 'Take 5',
    decline: 'Deadline',
    sceneAria: 'Coffee break',
    sceneTitle: 'The Watercooler',
    done: 'Back to it'
  },
  battle: {
    inviteLine: '🥊 {a} and {b} are at it again — "{topic}". The floor is watching.',
    accept: 'Grab popcorn',
    decline: 'Not my circus',
    sceneAria: 'Cubicle battle',
    sceneTitle: 'Cubicle Battle',
    versus: 'vs',
    settleLine: "You've heard both sides. Someone has to be wrong:",
    sideLabel: 'Side with {name}',
    walkAway: 'Escalate to HR (leave)',
    verdictHead: 'The floor has ruled',
    done: 'Back to work'
  },
  meetingInvite: {
    organizerLabel: 'Organizer:',
    attendeesLabel: 'Attendees:',
    accept: 'Accept',
    decline: 'Decline',
    proposeNewTime: 'Propose new time'
  },
  meeting: {
    youName: 'You',
    close: 'Close',
    noMinutes: 'No action items. A perfect meeting, by corporate standards.',
    raiseHandAria: 'Raise hand',
    raiseHand: '✋ Raise hand ({count})',
    atTime: '✋ At time'
  }
};

export function officeEmailTemplates() {
  return office()?.OFFICE_EMAIL_TEMPLATES ?? OFFICE_EMAIL_TEMPLATES;
}

export function officeWelcomeEmail() {
  return office()?.OFFICE_WELCOME_EMAIL ?? OFFICE_WELCOME_EMAIL;
}

export function officeWelcomeIm() {
  return office()?.OFFICE_WELCOME_IM ?? OFFICE_WELCOME_IM;
}

export function officeImTemplates() {
  return office()?.OFFICE_IM_TEMPLATES ?? OFFICE_IM_TEMPLATES;
}

export function seniorEmailTemplates() {
  return office()?.SENIOR_EMAIL_TEMPLATES ?? SENIOR_EMAIL_TEMPLATES;
}

export function officeWalkbyFallbacks() {
  return office()?.OFFICE_WALKBY_FALLBACKS ?? OFFICE_WALKBY_FALLBACKS;
}

export function officeCoffeeScenes() {
  return office()?.OFFICE_COFFEE_SCENES ?? OFFICE_COFFEE_SCENES;
}

export function officeBattleScenes() {
  return office()?.OFFICE_BATTLE_SCENES ?? OFFICE_BATTLE_SCENES;
}

export function officeMeetingCopy() {
  return office()?.OFFICE_MEETING_COPY ?? OFFICE_MEETING_COPY;
}

export function officeImQuickReplies() {
  return office()?.OFFICE_IM_QUICK_REPLIES ?? OFFICE_IM_QUICK_REPLIES;
}

export function officeChromeCopy() {
  return office()?.OFFICE_CHROME_COPY ?? OFFICE_CHROME_COPY;
}

/**
 * Pick a canned template the user hasn't seen (falls back to any when all are
 * seen). `seenIds` is persisted across sessions so Gary's fridge email lands
 * once, not weekly.
 */
export function pickUnseenTemplate(templates, seenIds, random = Math.random) {
  if (!Array.isArray(templates) || templates.length === 0) return null;
  const unseen = templates.filter((t) => !seenIds?.includes(t.id));
  const pool = unseen.length > 0 ? unseen : templates;
  return pool[Math.floor(random() * pool.length)] ?? null;
}
