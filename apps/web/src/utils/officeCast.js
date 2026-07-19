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
    blurb: 'Replies-all. Equity in vibes. Accidentally asks the only good question in the room.',
    introLine:
      "Hey!! I'm Chad — unpaid, strategic, and statistically likely to reply-all about the stapler. Quick question about your diagram that might accidentally be the smartest thing anyone says today. Also: where is the stapler.",
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
    blurb:
      'Everything is a ceremony. Will time-box your lunch. Facilitates your existential dread.',
    introLine:
      "Hi! I'm Pam — CSM, CSPO, SAFe 6.0, and emotionally fluent in parking lots. This introduction is time-boxed for forty-five seconds of synergy. Great energy. Let's circle back.",
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
    blurb: 'Closes tickets as duplicates of themselves. Works on his machine. DNS was involved.',
    introLine:
      'Ticket Bot Dave. Tier 1 of 1. I close tickets as duplicates of themselves. Have you tried turning it off and on again. That was not a question. Works on my machine.',
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
    blurb: 'ALL-CAPS fridge cleanouts. Thermostat locked at 20.5°C. Architecture is perishable.',
    introLine:
      'I AM GARY. I OWN THE FRIDGE. I OWN THE THERMOSTAT. Unlabeled containers — and unlabeled architecture diagrams — become FACILITIES PROPERTY. You have been warned. Warmly.',
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
    blurb: 'Weaponized cheerfulness. Training overdue since onboarding. Please sign Craig’s card.',
    introLine:
      "I'm Linda, People Ops. Your badge photo is processing, your compliance training is somehow already overdue, and Craig's birthday card still needs a warm generic message. You are going to fit in beautifully.",
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
    blurb: '“We tried that in 2009.” Maintains the mainframe. The mainframe maintains him.',
    introLine:
      'Ulrich. Staff Engineer Emeritus. We tried that in 2009. It ran on cron and fear. I maintain the mainframe nobody admits exists. The mainframe asked about you. I told it you were diagramming.',
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
    blurb: 'Everything is an attack surface — especially the arrows. Trust is a vulnerability.',
    introLine:
      'Sasha. CISO. Department of No. Everything is an attack surface — especially you, the arrows, and that temporary admin password from 2017. Noted in your file. I mean it warmly.',
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

/** Localized safe defaults for empty `{label}` / `{userTitle}` / `{userName}` slot fills. */
export const OFFICE_SLOT_FALLBACKS = {
  label: 'the diagram',
  userTitle: 'Intern Architect',
  userName: 'Newbie'
};

/** Replace `{label}` / `{userTitle}` / `{userName}` slots; drops in safe defaults when missing. */
export function fillOfficeSlots(text, { label, userTitle, userName, snippet } = {}) {
  const fallbacks = office()?.OFFICE_SLOT_FALLBACKS ?? OFFICE_SLOT_FALLBACKS;
  const safeSnippet =
    snippet && String(snippet).trim()
      ? String(snippet).trim().slice(0, 48)
      : (fallbacks.snippet ?? 'that');
  return String(text ?? '')
    .replaceAll('{label}', label && String(label).trim() ? String(label).trim() : fallbacks.label)
    .replaceAll(
      '{userTitle}',
      userTitle && String(userTitle).trim() ? String(userTitle).trim() : fallbacks.userTitle
    )
    .replaceAll(
      '{userName}',
      userName && String(userName).trim()
        ? String(userName).trim()
        : (fallbacks.userName ?? OFFICE_SLOT_FALLBACKS.userName)
    )
    .replaceAll('{snippet}', safeSnippet);
}

/**
 * Canned emails — pure office noise (no LLM). Roughly a third get personalized
 * by the LLM instead; these are the offline/failure backbone.
 */
export const OFFICE_EMAIL_TEMPLATES = [
  {
    id: 'email-fridge-cleanout',
    colleagueId: 'facilities',
    subject: 'REMINDER: Fridge cleanout FRIDAY (Series B energy)',
    body: 'The refrigerator will be cleaned Friday at 3 PM. Anything unlabelled becomes property of Facilities. This includes containers, condiments, and architecture diagrams left "for later".\n\nIf your leftovers have equity, label them.\n\nThanks in advance,\nGary'
  },
  {
    id: 'email-thermostat',
    colleagueId: 'facilities',
    subject: 'RE: RE: RE: Thermostat (FINAL, scientifically)',
    body: 'The thermostat is set to a scientifically optimal 20.5°C and is now in a locked enclosure. Please stop taping ice packs to the sensor. I know it was the third floor. The third floor knows I know.\n\nClimate change starts with you. Specifically: stop touching it.\n\nGary'
  },
  {
    id: 'email-room-booking',
    colleagueId: 'facilities',
    subject: 'Your booking of "War Room 4" is confirmed',
    body: 'Please note War Room 4 was converted to a wellness pod in 2023, and prior to that did not exist. Your booking remains confirmed. Synergy is location-independent.\n\nGary'
  },
  {
    id: 'email-password-expiry',
    colleagueId: 'helpdesk',
    subject: '[Ticket #48291] Your password expires in 14 days',
    body: 'To reset your password, please log in with your expired password and follow the link we will send to the email account you are locked out of.\n\nNew password must contain: one uppercase, one lowercase, one number, one special character, one childhood trauma, and the ghost of a deprecated protocol.\n\nThis ticket has been closed as RESOLVED.\n\n— Helpdesk (do not reply, do not call, do not)'
  },
  {
    id: 'email-ticket-duplicate',
    colleagueId: 'helpdesk',
    subject: '[Ticket #48292] Closed as duplicate of #48292',
    body: 'Your ticket regarding "{label}" has been closed as a duplicate of itself. If the issue persists, it is a feature. If the feature persists, it is a roadmap item.\n\nWorks on my machine,\nDave'
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
    body: 'Just a friendly nudge that your "Working Safely With Diagrams" compliance training is 847 days overdue! Completing it takes only 4 hours and features 11 unskippable modules, a quiz you cannot fail (we track attempts), and a certificate nobody will ask for until an audit.\n\nWarmly,\nLinda — People Ops'
  },
  {
    id: 'email-birthday-card',
    colleagueId: 'hr',
    subject: 'Card for Craig — sign by EOD!',
    body: "Craig's birthday card is circulating! Please add a warm personal message for Craig. If you do not know Craig, a warm generic message is fine. Craig knows who you are. Craig has always known.\n\nLinda"
  },
  {
    id: 'email-mandatory-fun',
    colleagueId: 'hr',
    subject: "You're invited: Mandatory Team Fun Hour 🎉",
    body: 'Attendance at Thursday\'s optional team-building is mandatory. This quarter\'s theme: "Trust Falls & Org Charts". Please review {label} beforehand so the fun stays aligned with Q3 OKRs.\n\nFun will be measured.\n\nLinda'
  },
  {
    id: 'email-storypoints',
    colleagueId: 'scrumMaster',
    subject: 'Action required: story-point your diagram',
    body: 'Great energy this sprint! Reminder that all diagram boxes must be story-pointed by tomorrow\'s refinement. "{label}" looks like a 13 — let\'s decompose it in the parking lot until it becomes three 5s and a vibe.\n\nPam',
    actionPrompt: 'Split the most complex node into two smaller steps'
  },
  {
    id: 'email-intern-replyall',
    colleagueId: 'intern',
    subject: 'RE: RE: FW: RE: quick question',
    body: 'sorry for the reply-all again!! but does anyone know if "{label}" is supposed to connect to the other thing? also where do we keep the stapler? unrelated. also is equity in vibes still a thing or was that a joke\n\nchad (intern)'
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
    body: 'The third-floor printer is now on firmware 9.0.1. New features: refusing PDFs, a louder noise, and printing one (1) page reading "soon" at unscheduled intervals. This is expected behavior. Product calls it "event-driven."\n\nDo not open a ticket. It will be closed as a duplicate of the printer.\n\n— Dave'
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
    body: "Team! Our retro scored 4.2/5 on energy but only 2.9 on actionability, so we're holding a retro on the retro. Please bring one Glad, one Sad, one Mad, and a backup Mad.\n\nAction items from the previous retro carry over untouched, as tradition demands. Culture!\n\nPam"
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
    body: 'At 12:47 someone microwaved fish. The building has feelings about this, and so do I. The microwave is now under new management (mine). A sign-up sheet is on the door: NAME, DISH, INTENTIONS.\n\nFish is a P0.\n\nThanks in advance,\nGary'
  },
  {
    id: 'email-intern-first-ship',
    colleagueId: 'intern',
    subject: 'i shipped something!!! (small question)',
    body: "you guys!! my first change is LIVE. it's the {label} one. quick question though — if everything is on fire but in a small way, who do i tell? asking hypothetically. the fire is hypothetical. mostly. the metrics are up AND down which feels like product-market fit??\n\nchad (intern)"
  },
  {
    id: 'email-intern-pitch-deck',
    colleagueId: 'intern',
    subject: 'quick q: can a diagram be a pitch deck',
    body: 'hey {userName}!! random but is "{label}" basically a pitch deck with arrows?? asking because someone said "deck" in standup and i nodded for 12 minutes.\n\nalso i put "disrupting the whiteboard space" on my linkedin. is that too much\n\nchad (intern)'
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
  subject: 'Welcome aboard, {userTitle}! 🎉 (badge photo: “still processing,” forever)',
  body: 'Welcome to the floor, {userName}! Officially thrilled. Legally obligated to say so. Emotionally buffering.\n\nYour mandate is refreshingly simple: ship deliverables. Diagrams, charts, 3D flythroughs of the org chart — you architect it, we align on the credit at the all-hands.\n\nA few faces before your orientation (rescheduled to a date that does not technically exist on any calendar product):\n\n📅 Pam (Agile Coach) runs the meetings. All of them. This email is, itself, a ceremony.\n🧃 Chad (our intern) will IM you in roughly eight seconds. He is “heads-down.” He is also reply-all.\n🖥️ Ticket Bot Dave is IT. Do not reply, do not call, do not make eye contact. DNS was involved.\n🧹 Gary owns the fridge and the thermostat. Both are load-bearing. Neither negotiates.\n🧓 Ulrich has seen your architecture before. In 2009. He’ll mention it. Softly. Forever.\n🔐 Sasha (our CISO) has already flagged you as an attack surface. She means it warmly.\n\nI’m Linda — People Ops. Your compliance training is already overdue, which is, genuinely, a company record. The inbox 📥, Focus Time, and Soundscape toggles live in the corner for when we become “a lot.”\n\nSynergistically yours,\nLinda\n\nP.S. Please sign Craig’s card. Craig knows who you are.'
};

export const OFFICE_WELCOME_IM = {
  id: 'welcome-im-intern',
  colleagueId: 'intern',
  body: 'hey {userName}!! you must be the new {userTitle} — welcome to the sloppiest team in tech!! 🎉 heads up: the coffee machine has fourteen buttons and twelve are purely decorative (i pressed all of them). also gary WILL email you about the fridge, it’s not personal (it is). lmk if you need anything, tho fair warning i also don’t know how most things work yet. equity in vibes though!!'
};

/** Canned IM pings — short chat noise with slot fills. */
export const OFFICE_IM_TEMPLATES = [
  {
    id: 'im-intern-boxes',
    colleagueId: 'intern',
    body: 'hey {userName}, quick q — is {label} supposed to have that many arrows? asking for my onboarding doc / also my soul'
  },
  {
    id: 'im-intern-lunch',
    colleagueId: 'intern',
    body: 'anyone else see the fridge email?? gary means business. like Series B business'
  },
  {
    id: 'im-scrum-standup',
    colleagueId: 'scrumMaster',
    body: "Friendly ping! You've been heads-down for a while — should we time-box this into a smaller existential crisis? 🙂"
  },
  {
    id: 'im-scrum-retro',
    colleagueId: 'scrumMaster',
    body: 'Adding "{label}" to the retro board as a discussion topic. Great energy! Parking-lotting the feelings.'
  },
  {
    id: 'im-helpdesk-restart',
    colleagueId: 'helpdesk',
    body: 'Scheduled maintenance tonight. Save your work. This is not related to the smoke. (It is related to the smoke.)'
  },
  {
    id: 'im-helpdesk-printer',
    colleagueId: 'helpdesk',
    body: 'Ticket #48311 (printer, 3rd floor) closed as WONTFIX. The printer has tenure. HR agrees.'
  },
  {
    id: 'im-facilities-plant',
    colleagueId: 'facilities',
    body: 'Whoever is watering the fake plant near the elevators — please stop. It is thriving and I do not like what that implies about our culture.'
  },
  {
    id: 'im-hr-survey',
    colleagueId: 'hr',
    body: "Only 2 minutes left to complete the anonymous wellness survey! (We can see you haven't started, {userTitle}. Anonymously.)"
  },
  {
    id: 'im-greybeard-look',
    colleagueId: 'greybeard',
    body: "Looked at {label}. We tried that in 2009. It's fine. Probably. The mainframe shrugged."
  },
  {
    id: 'im-greybeard-mainframe',
    colleagueId: 'greybeard',
    body: 'The mainframe asked about you. I told it you were busy diagramming. It understood. It always understands.'
  },
  {
    id: 'im-helpdesk-dns',
    colleagueId: 'helpdesk',
    body: "Network slow? It's DNS. It's not DNS. It was DNS. Ticket closed. Please rate this interaction: 🔥"
  },
  {
    id: 'im-greybeard-gitblame',
    colleagueId: 'greybeard',
    body: 'Ran git blame on the outage. It says you. 2019. The mainframe forgives, but it logs. Forever.'
  },
  {
    id: 'im-intern-regex',
    colleagueId: 'intern',
    body: 'wrote my first regex!! it matches everything. is that bad? it feels like a Series A'
  },
  {
    id: 'im-scrum-velocity',
    colleagueId: 'scrumMaster',
    body: "Velocity check! You're averaging 4.2 boxes per hour — amazing! Let's not tell finance we measure this. Or sales. Or you. 🙂"
  },
  {
    id: 'im-facilities-elevator',
    colleagueId: 'facilities',
    body: 'The elevator is making the noise again. Take the stairs. The stairs also make a noise, but a different, more honest one.'
  }
];

/** Canned IM replies when the user messages a colleague and the LLM is unavailable. */
export const OFFICE_IM_REPLY_TEMPLATES = [
  {
    id: 'im-reply-intern-ack',
    colleagueId: 'intern',
    body: 're: "{snippet}" — lol ok. anyway is {label} supposed to look that official??'
  },
  {
    id: 'im-reply-intern-meeting',
    colleagueId: 'intern',
    body: 'got ur "{snippet}" — im in standup rn but saving this for my onboarding doc'
  },
  {
    id: 'im-reply-scrum-ack',
    colleagueId: 'scrumMaster',
    body: 'Noted on "{snippet}" — love the energy! Let\'s time-box a follow-up after standup 🙂'
  },
  {
    id: 'im-reply-greybeard-ack',
    colleagueId: 'greybeard',
    body: 'Re: "{snippet}" — we tried that in 2009. It\'s fine. Probably.'
  },
  {
    id: 'im-reply-helpdesk-ack',
    colleagueId: 'helpdesk',
    body: 'Ticket updated: user said "{snippet}". Status: ACKNOWLEDGED. Have you tried turning it off and on?'
  },
  {
    id: 'im-reply-facilities-ack',
    colleagueId: 'facilities',
    body: 'Re: "{snippet}" — copy. Also the third-floor printer is still haunted.'
  },
  {
    id: 'im-reply-hr-ack',
    colleagueId: 'hr',
    body: 'Thanks for "{snippet}", {userName}! Logging this as a wellness win 😊'
  },
  {
    id: 'im-reply-generic-ack',
    body: 're: "{snippet}" — fair. circling back after I finish this diagram'
  },
  {
    id: 'im-reply-generic-busy',
    body: 'saw "{snippet}" — in the zone on {label} rn, ping u after'
  }
];

/** Walk-by fallbacks when the LLM is unavailable — must still name a label. */
export const OFFICE_WALKBY_FALLBACKS = [
  {
    id: 'walkby-scrum',
    colleagueId: 'scrumMaster',
    body: "Ooh, is that {label}? This wasn't on the sprint board — I've added it retroactively as a spike. Great energy. Parking lot pending."
  },
  {
    id: 'walkby-intern',
    colleagueId: 'intern',
    body: 'whoa {userName}, {label} looks so Series A. did you make that with the AI? can I put it in my portfolio / pitch deck / both?'
  },
  {
    id: 'walkby-greybeard',
    colleagueId: 'greybeard',
    body: "{label}, huh. We had one of those in 2009. It's still running. Nobody knows where. The mainframe does."
  },
  {
    id: 'walkby-facilities',
    colleagueId: 'facilities',
    body: 'Nice diagram. Is {label} why the third floor smells like burnt popcorn? Be honest. Facilities has a nose for architecture.'
  },
  {
    id: 'walkby-hr',
    colleagueId: 'hr',
    body: 'Love the energy around {label}! Have you considered presenting it at Mandatory Fun Hour? 😊 Attendance is optional and mandatory.'
  },
  {
    id: 'walkby-helpdesk',
    colleagueId: 'helpdesk',
    body: "That {label} box? I have an open ticket about it. Had. It's a known issue now. Congratulations — you've been productized."
  },
  {
    id: 'walkby-greybeard-orchestrator',
    colleagueId: 'greybeard',
    body: "Careful with {label}. The last one of those became self-aware around 2011. We don't say 'orchestrator' out loud anymore. Or 'synergy'. Mostly."
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
        text: 'New coffee machine has fourteen buttons. Twelve are decorative. Two are lies.'
      },
      {
        speakerId: 'greybeard',
        text: 'The old one had one button and a smell. Free. Honest. Better days.'
      }
    ]
  },
  {
    id: 'coffee-standup',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'I dreamed we did standup sitting down. Woke up in a cold sweat. Booked a ceremony about it.'
      },
      {
        speakerId: 'intern',
        text: "wait, we're allowed to dream about work? is that in the handbook? asking for my equity in vibes"
      }
    ]
  },
  {
    id: 'coffee-diagram-glance',
    lines: [
      {
        speakerId: 'greybeard',
        text: "Saw your {label} thing. One box too many. You'll see which one. Eventually. Or in 2009."
      },
      {
        speakerId: 'intern',
        text: 'he does this. last week he told me my badge photo had "too much optimism". which is literally my brand'
      }
    ]
  },
  {
    id: 'coffee-craig',
    lines: [
      {
        speakerId: 'hr',
        text: "Did you sign Craig's card? Everyone keeps asking who Craig is. That's not the point of a card. Craig is the point."
      },
      {
        speakerId: 'helpdesk',
        text: 'Craig is ticket #31337. Closed as "cannot reproduce". Still birthdaying.'
      }
    ]
  },
  {
    id: 'coffee-printer',
    lines: [
      {
        speakerId: 'helpdesk',
        text: 'The third-floor printer printed something nobody sent again. One page. Just the word "soon". Product calls it predictive.'
      },
      {
        speakerId: 'facilities',
        text: 'That printer is load-bearing. Do not touch the printer. Do not fund the printer.'
      }
    ]
  },
  {
    id: 'coffee-vision',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'They renamed the roadmap to "north-star journey atlas". The roadmap itself is unchanged since 2022. Pivot!'
      },
      {
        speakerId: 'greybeard',
        text: "In 2009 we called it a list. It also didn't change. We were honest about it."
      }
    ]
  },
  {
    id: 'coffee-dns',
    lines: [
      {
        speakerId: 'helpdesk',
        text: "Postmortem's published. Root cause: DNS. Root cause of the root cause: also DNS. Slide 1 is just the word DNS."
      },
      {
        speakerId: 'ciso',
        text: "It's always DNS. Except when it's someone testing in prod. Which also resolved through DNS."
      },
      { speakerId: 'helpdesk', text: 'Officially it was DNS. Unofficially it was DNS. Consensus.' }
    ]
  },
  {
    id: 'coffee-cloud-bill',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: "Finance flagged the cloud bill again. I've scheduled a cost-alignment ceremony. Bring feelings and a spreadsheet."
      },
      {
        speakerId: 'greybeard',
        text: 'In 2009 the server lived under my desk. Free. Warm. Loud. Better days. Worse latency. Same politics.'
      }
    ]
  },
  {
    id: 'coffee-standing-desk',
    lines: [
      {
        speakerId: 'hr',
        text: 'The standing desks arrived! Wellness data says we now sit 94% of the time, but taller. Growth!'
      },
      {
        speakerId: 'facilities',
        text: "They rise on their own at night. The desks. I've said too much. Label your intentions."
      }
    ]
  },
  {
    id: 'coffee-ai-half',
    lines: [
      {
        speakerId: 'intern',
        text: 'the AI wrote half my code today!! so cool. which half? unclear. feels like a Series A'
      },
      {
        speakerId: 'ciso',
        text: 'Find out which half. One of them is going in the audit. The other is also going in the audit.'
      }
    ]
  },
  {
    id: 'coffee-compression',
    lines: [
      {
        speakerId: 'intern',
        text: 'if we compress the architecture enough does it become a slogan?? asking for a pitch'
      },
      {
        speakerId: 'greybeard',
        text: 'We tried that. 2009. The slogan took down prod. The mainframe still quotes it.'
      }
    ]
  },
  {
    id: 'coffee-parking-lot',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: "We're parking-lotting the parking lot. Meta-ceremony. I've invited everyone who has feelings."
      },
      {
        speakerId: 'hr',
        text: "I brought Craig's card. Craig has feelings about parking lots. Allegedly."
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
        text: 'Tabs. One keystroke, one character, configurable width. We settled this in 2009. The industry forgot. On purpose.'
      },
      {
        speakerId: 'intern',
        text: 'the style guide says two spaces!! i read the whole thing. it took my weekend. my equity in vibes went down'
      },
      {
        speakerId: 'greybeard',
        text: 'The style guide was written by a committee that has never opened a terminal. Or a can of worms.'
      },
      {
        speakerId: 'intern',
        text: 'the linter agrees with me!!! i have never once beaten the linter. it feels like product-market fit'
      }
    ],
    verdicts: {
      greybeard:
        'Tabs it is. The linter has been reconfigured. The intern will recover, in time. Or pivot.',
      intern:
        'two spaces win!! ulrich says the industry is doomed, but he says that every day anyway. culture!'
    }
  },
  {
    id: 'battle-friday-deploy',
    topic: 'The Friday deploy',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: "The sprint ends Friday, so we deploy Friday. That's just math! Great energy, everyone. Bring snacks and incident severity levels."
      },
      {
        speakerId: 'ciso',
        text: "Nothing ships on Friday. Incidents don't respect weekends, and neither does my phone. Noted in your file."
      },
      {
        speakerId: 'scrumMaster',
        text: "We'll add a Monday 'deploy retro' to process any feelings. And outages. And feelings about outages."
      },
      {
        speakerId: 'ciso',
        text: "I'll be processing mine from the incident bridge. Bring your feelings and a laptop. Leave the optimism."
      }
    ],
    verdicts: {
      scrumMaster:
        'Motion carries — we ship Friday! Sasha has pre-declared the incident, to save time. Efficiency!',
      ciso: 'Deploy moved to Monday. The weekend remains legally uneventful. You are welcome. Warmly.'
    }
  },
  {
    id: 'battle-thermostat',
    topic: 'The thermostat (20.5°C, allegedly)',
    lines: [
      {
        speakerId: 'facilities',
        text: 'The thermostat is set to 20.5°C. That number came from SCIENCE and it is FINAL. Series B does not change physics.'
      },
      {
        speakerId: 'hr',
        text: "Gary, three people are wearing gloves indoors. I'm getting wellness tickets. Anonymously. We can see who."
      },
      {
        speakerId: 'facilities',
        text: 'Gloves are PERSONAL GROWTH. The sensor stays locked. I know about the ice packs. The ice packs know about me.'
      },
      {
        speakerId: 'hr',
        text: 'Morale rises with temperature! There are studies. I printed one. It was cold to the touch. Like this culture.'
      }
    ],
    verdicts: {
      facilities:
        '20.5°C STANDS. A jumper drive has been organized. Morale is now a fabric problem.',
      hr: "We're trialling 21°C! Gary calls it 'the tropics' and has filed a formal protest. Growth mindset!"
    }
  },
  {
    id: 'battle-monolith',
    topic: 'One box or fourteen (the monolith question)',
    lines: [
      {
        speakerId: 'scrumMaster',
        text: 'Splitting {label} into microservices gives every team its own backlog! Autonomy! Ceremonies! A webinar!'
      },
      {
        speakerId: 'greybeard',
        text: "You'd turn one problem into a distributed system of problems, with worse logging and better slides."
      },
      {
        speakerId: 'scrumMaster',
        text: "We'd get a service mesh! There's a webinar! I've already story-pointed the webinar!"
      },
      {
        speakerId: 'greybeard',
        text: 'I attended a webinar once. 2011. The mainframe and I still talk about it. Softly. With fear.'
      }
    ],
    verdicts: {
      scrumMaster:
        "Microservices it is! I've booked a recurring sync for each of the fourteen new repos. Great energy!",
      greybeard:
        "The monolith stays. In ten years you'll call it 'majestic' and claim it was your idea. Again."
    }
  },
  {
    id: 'battle-dns-postmortem',
    topic: 'The outage postmortem',
    lines: [
      {
        speakerId: 'helpdesk',
        text: "Root cause: DNS. Closing the postmortem. It's always DNS. Efficiency is naming it early."
      },
      {
        speakerId: 'ciso',
        text: 'It was my firewall rule, and my firewall rule was CORRECT. It blocked something suspicious: all traffic.'
      },
      {
        speakerId: 'helpdesk',
        text: 'Which it resolved via DNS. The ticket stands. The ticket has tenure.'
      },
      {
        speakerId: 'ciso',
        text: 'Blocking everything is the only architecture with zero CVEs. Look it up. Or don’t. Noted either way.'
      }
    ],
    verdicts: {
      helpdesk:
        "'DNS' is accepted as root cause, and pre-approved as root cause for all future incidents. Efficiency.",
      ciso: 'Ruling: the firewall was right. Availability is a rumor started by sales. Warmly.'
    }
  },
  {
    id: 'battle-tupperware',
    topic: 'The unlabeled tupperware',
    lines: [
      {
        speakerId: 'facilities',
        text: 'An UNLABELED container has been in the fridge since Q2. This is now a FACILITIES matter. Also a culture matter.'
      },
      {
        speakerId: 'helpdesk',
        text: "I did label it. Ticket #48317: 'container, contents unknown, do not reboot'. Works on my machine."
      },
      {
        speakerId: 'facilities',
        text: 'A ticket number is NOT a label. Labels have NAMES and DATES. I provide them. Willingly. With menace.'
      },
      {
        speakerId: 'helpdesk',
        text: 'The contents have 94 days of uptime. Longest-running service on this floor. Do not disturb. Do not fundraise.'
      }
    ],
    verdicts: {
      facilities:
        'The container is GONE. Do not ask where. The fridge is at peace. The label maker won.',
      helpdesk:
        'The container stays. It has been promoted to production. Gary must now file a change request.'
    }
  },
  {
    id: 'battle-mvp',
    topic: 'What does MVP actually mean',
    lines: [
      {
        speakerId: 'intern',
        text: 'ok but MVP means Minimum Viable Product right?? i put it on my linkedin three times'
      },
      {
        speakerId: 'scrumMaster',
        text: 'MVP means Maximum Viable PowerPoint. We ship the deck. The product is a stretch goal. Great energy!'
      },
      {
        speakerId: 'intern',
        text: 'that feels illegal but also like fundraising'
      },
      {
        speakerId: 'scrumMaster',
        text: "I've parking-lotted legality. Let's time-box the feelings and story-point the slogan."
      }
    ],
    verdicts: {
      intern: 'MVP means the thing that works. Chad has updated LinkedIn. The deck is jealous.',
      scrumMaster:
        'MVP means the deck. The product will follow in a future ceremony. Invite already sent.'
    }
  }
];

/** In-fiction copy for meeting chrome (invites, joining gag, failure gag). */
export const OFFICE_MEETING_COPY = {
  inviteFallbackTitle: 'Architecture Review Board (steering)',
  inviteFallbackBody:
    'Leadership would like a look at the current diagram. Agenda: the headline, the cost, the risk, and whether it pulses. Your team presents; the seniors have questions. Snacks: no. Optimism: optional.',
  joiningLine: 'Waiting for the organizer to admit you… (they can see you)',
  cancelledSubject: 'CANCELLED: Architecture Review Board',
  cancelledBody:
    'Meeting cancelled — leadership is double-booked. Rescheduled to: never. Action items remain your problem. Synergy remains theoretical.\n\nPam',
  proposeNewTimeGag:
    'New time proposed. The organizer has declined your proposed time. And your backup time. And time.',
  minutesTitle: 'Meeting minutes',
  raiseHandPlaceholder: 'Say something to the room… (keep it one-pager)',
  leaveLabel: 'Leave meeting',
  interjectCapLine: 'Pam: "Great point — let\'s parking-lot it. We\'re at time. Amazing energy."'
};

/** Quick canned replies offered under an IM ping (pure local flavor + tiny XP). */
export const OFFICE_IM_QUICK_REPLIES = [
  '👍',
  'in a meeting',
  'circling back',
  'parking lot it',
  'noted in my file'
];

/**
 * Static chrome strings for the office surfaces (inbox dock, IM stack,
 * walk-bys, coffee breaks, meeting room). Templated strings use `{name}` /
 * `{count}` slots — render with formatLocale.
 */
export const OFFICE_CHROME_COPY = {
  doIt: 'Do it',
  directory: {
    title: 'Day one at ArchiSlop Corp.',
    tourEyebrow: 'NEW HIRE ORIENTATION™',
    rosterEyebrow: 'CAST DIRECTORY',
    // Reception-first orientation — name badge, Linda's welcome, then the floor.
    welcomeChapter: 'RECEPTION DESK',
    checkInLabel: 'Check in at reception →',
    colleagueChapter: 'COLLEAGUE {current} OF {total}',
    unlockedLabel: '✨ CHARACTER UNLOCKED',
    tagline:
      "You're the newest architect on the floor. The whiteboard is your deliverable. The interruptions are free.",
    tourHint:
      'Pick up your badge, check in with Linda, then meet the team on the floor. Mute the whole building anytime with Focus Time.',
    autoplayHint: 'Speaking…',
    skipBeatLabel: 'Skip →',
    rosterTagline:
      'The cast that emails, IMs, and walks by while you work — tap ▶ and let them introduce themselves:',
    // {name} is filled from the user's badge (resolveUserName) at render time.
    greeting: 'Welcome aboard, {name}.',
    greetingHint:
      'The office will call you that in emails, IMs, and awkward walk-bys. Change it anytime. They will notice.',
    expandLabel: '🏢 Meet the Office',
    expandTitle: 'Who keeps interrupting me? (Spoiler: all of them.)',
    startLabel: 'Meet the team →',
    nextLabel: 'Next colleague →',
    backLabel: '← Back',
    skipLabel: 'Skip',
    skipToBuildLabel: 'Skip the ceremony — just let me ship →',
    skipToBuildTitle:
      'Close orientation and drop me on the canvas. No offense taken. (Some taken. Noted in your file.)',
    progressLabel: '{current} of {total}',
    dismissLabel: 'Clock in — begin Day One',
    replayTourLabel: '↻ Replay intro',
    closeAria: 'Close Meet the Office',
    // Voice showcase — synthesized only on an explicit ▶ click, never autoplayed,
    // so preview bots and scrapers can't quietly burn the Cloud TTS free tier.
    hearLabel: '▶ Hear intro',
    hearWelcomeLabel: '▶ Hear Linda’s welcome',
    hearSpeakingLabel: 'Shh… they’re talking',
    hearTitle: 'Play this line in their actual voice — Google Cloud text-to-speech',
    // Linda's spoken orientation line (Cloud TTS strips emoji before speaking).
    welcomeVoiceSpeakerId: 'hr',
    welcomeVoiceLine:
      "Welcome to the floor. I'm Linda, from People Ops. Your badge photo is processing, your compliance training is somehow already overdue, and every single colleague here has strong opinions about your diagrams. You are going to fit in beautifully. Let's go meet the team.",
    nameTag: {
      hello: 'HELLO',
      subtitle: 'my name is',
      placeholder: 'Newbie',
      editTitle: 'Type your name — the whole office will start using it',
      inputAria: 'Your name for the office'
    }
  },
  // Player-initiated desk verbs — the ego-perspective counterpart to the
  // ambience director. `blocked.*` keys are keyed by useDeskActions reasons.
  desk: {
    buttonLabel: 'Your desk',
    buttonAria: 'Your desk — things you can do',
    buttonTitle: 'Get up, wander, bother someone',
    menuAria: 'Desk actions',
    menuHeading: 'What are you doing?',
    meetOffice: 'Meet the Office',
    meetOfficeTitle: 'Replay the cast — tap ▶ and let everybody introduce themselves',
    hrProgress: 'Check my HR progression',
    hrProgressTitle: 'People Ops scorecard — levels, XP, and whatever Linda thinks of you',
    coffee: 'Get a coffee',
    walk: 'Walk the floor',
    im: 'Message someone',
    slopChat: 'Open Slop Chat',
    slopChatTitle: 'Slop Chat™ — read past messages',
    inbox: 'Check your mail',
    meeting: 'Call a meeting',
    team: 'Talk to your team',
    blocked: {
      busy: 'Deploy in progress — nobody leaves their desk.',
      meeting: "You're in a meeting. Look engaged.",
      surface: 'One thing at a time. You are already busy being interrupted.',
      noAgenda: 'Draw something first — even this meeting needs an agenda',
      noTeam: 'Put something on the canvas — the team has nothing to react to yet'
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
    dismissAria: 'Dismiss message from {name}',
    openHistoryAria: 'Open Slop Chat ({count} unread)',
    openHistoryTitle: 'Slop Chat™ — read past messages'
  },
  messenger: {
    title: '💬 Slop Chat™',
    tagline: 'Now with 40% more presence indicators',
    closeAria: 'Close Slop Chat',
    threadsAria: 'Conversations',
    emptyThreads: 'No messages yet. Enjoy it while it lasts.',
    emptyThread: 'Pick a colleague. They are all "available".',
    composerPlaceholder: 'Type a message…',
    composerAria: 'Message {name}',
    send: 'Send',
    sending: 'Sending…',
    typing: '{name} is typing…',
    unreadDot: 'Unread',
    you: 'You',
    statusOnline: 'Available',
    statusBusy: 'In a meeting'
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
    atTime: '✋ At time',
    // Docking the meeting = glancing at your own screen while the room talks.
    dock: '🗕 Look at my screen',
    dockTitle: 'Shrink the meeting to a corner so you can work on the diagram',
    undock: '🗖 Back to the room',
    undockTitle: 'Bring the meeting back to the centre of the screen'
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

export function officeImReplyTemplates() {
  return office()?.OFFICE_IM_REPLY_TEMPLATES ?? OFFICE_IM_REPLY_TEMPLATES;
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
 * The BCP-47 tag the office cast should speak and be synthesized in
 * ('en-US' | 'en-AU' | 'zh-CN' | 'zh-TW').
 *
 * Sent to /api/office/* as `uiLocale` so the personas *write* in this language
 * (buildOfficeLanguageRule on the server), and passed to speakOfficeLine as
 * `lang` so WaveNet / Web Speech *reads* it with a matching voice. Those two
 * must agree — a cmn-CN voice handed English text reads it phonetically.
 */
export function officeDialogueLocale() {
  return officeChromeCopy().inbox.mailAnnounceLang ?? 'en-US';
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
