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
    avatarEmoji: '🧓',
    accentColor: '#57534e',
    emailFrom: 'ulrich@mainframe.archislop.corp',
    imHandle: '@ulrich',
    canJoinMeetings: true
  }
};

export function isOfficeColleagueId(value) {
  return (
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(OFFICE_COLLEAGUES, value)
  );
}

/**
 * Display info for anyone who can appear in office chrome: colleagues (native)
 * or stakeholders (mapped from VARIANT_PERSONAS). Returns
 * `{ id, name, title, avatarEmoji, accentColor }` — accentColor is always a
 * usable CSS color (stakeholder `--vars` are wrapped in var()).
 */
export function officeSenderInfo(id) {
  const colleague = OFFICE_COLLEAGUES[id];
  if (colleague) {
    const localized = office()?.OFFICE_COLLEAGUES?.[id];
    return localized ? { ...colleague, ...localized } : colleague;
  }
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

/** Default WG meeting seat pool: facilitator + a rotating mix of both casts. */
export const MEETING_CAST_POOL = ['exec', 'critique', 'goMad', 'intern', 'greybeard'];
export const MEETING_FACILITATOR = 'scrumMaster';

/** Who can deliver an LLM-personalized moment of each kind (both casts). */
export const OFFICE_WALKBY_LLM_CAST = [
  'scrumMaster',
  'intern',
  'greybeard',
  'facilities',
  'hr',
  'critique',
  'exec',
  'explain'
];
export const OFFICE_EMAIL_LLM_CAST = [
  'critique',
  'exec',
  'scrumMaster',
  'greybeard',
  'hr',
  'intern'
];
export const OFFICE_IM_LLM_CAST = ['intern', 'greybeard', 'scrumMaster', 'goMad'];

export function pickRandomFrom(list, random = Math.random) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(random() * list.length)] ?? null;
}

/** Pick 3–4 seats: the facilitator plus 2–3 randoms from the pool. */
export function pickMeetingAttendees(random = Math.random) {
  const pool = [...MEETING_CAST_POOL];
  const seats = [MEETING_FACILITATOR];
  const extra = 2 + (random() < 0.5 ? 1 : 0);
  for (let i = 0; i < extra && pool.length > 0; i += 1) {
    const index = Math.floor(random() * pool.length);
    seats.push(pool.splice(index, 1)[0]);
  }
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
  }
];

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
  }
];

/** In-fiction copy for meeting chrome (invites, joining gag, failure gag). */
export const OFFICE_MEETING_COPY = {
  inviteFallbackTitle: 'WG: Diagram Alignment Sync (recurring)',
  inviteFallbackBody:
    'We need to sync on the current diagram. Agenda: alignment, next steps, alignment on next steps. Snacks: no.',
  joiningLine: 'Waiting for the organizer to admit you…',
  cancelledSubject: 'CANCELLED: Diagram Alignment Sync',
  cancelledBody:
    'Meeting cancelled — the organizer is double-booked. Rescheduled to: never. Action items remain your problem.\n\nPam',
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
  inbox: {
    buttonTitle: 'Corporate inbox',
    unreadAria: 'Inbox — {count} unread emails',
    noUnreadAria: 'Inbox — no unread email',
    title: '📥 Inbox',
    focusTimeLabel: 'Focus Time',
    focusTimeTitle: 'Colleagues (mostly) respect Focus Time',
    soundscapeLabel: 'Soundscape',
    soundscapeTitle: 'Ambient office noise — keyboards, the printer, the espresso machine',
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

export function officeImTemplates() {
  return office()?.OFFICE_IM_TEMPLATES ?? OFFICE_IM_TEMPLATES;
}

export function officeWalkbyFallbacks() {
  return office()?.OFFICE_WALKBY_FALLBACKS ?? OFFICE_WALKBY_FALLBACKS;
}

export function officeCoffeeScenes() {
  return office()?.OFFICE_COFFEE_SCENES ?? OFFICE_COFFEE_SCENES;
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
