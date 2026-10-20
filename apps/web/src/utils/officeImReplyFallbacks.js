/**
 * Canned replies when the user provoked a colleague and the LLM is unavailable.
 * Typed Slop Chat™ keeps the "re:" cadence; spoken talk (`channel: 'talk'`) uses
 * the parallel bank so a line shouted across the room does not read like Slack.
 */

/** Slop Chat™ and desk IM when the user sent a message and the model did not answer. */
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
    body: 'Re: "{snippet}" — we tried that in 1984. It\'s fine. Probably.'
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
  },
  {
    id: 'im-reply-intern-panic',
    colleagueId: 'intern',
    body: 're: "{snippet}" — wait is this bad. it feels bad. also {label} is judging me from the canvas'
  },
  {
    id: 'im-reply-scrum-parking',
    colleagueId: 'scrumMaster',
    body: 'Capturing "{snippet}" in the parking lot!! We\'ll circle back with so much care. Thank you!!'
  },
  {
    id: 'im-reply-greybeard-sigh',
    colleagueId: 'greybeard',
    body: '"{snippet}" — noted. The mainframe also noted. It sighed louder than I did.'
  },
  {
    id: 'im-reply-ciso-file',
    colleagueId: 'ciso',
    body: 'Re: "{snippet}". Noted in your file. Also noted that you said it in writing. Brave.'
  }
];

/** Spoken talk — shout, turned-to, walk-over — when the ladder falls back to canned. */
export const OFFICE_TALK_REPLY_FALLBACKS = [
  {
    id: 'talk-reply-intern',
    colleagueId: 'intern',
    body: 'Oh — you asked "{snippet}"? {label} on your screen looks way too official for that question.'
  },
  {
    id: 'talk-reply-scrum',
    colleagueId: 'scrumMaster',
    body: 'Heard you on "{snippet}"!! {label} has great energy — let\'s time-box a follow-up after standup!!'
  },
  {
    id: 'talk-reply-greybeard',
    colleagueId: 'greybeard',
    body: 'You said "{snippet}". We tried that on {label} in 1984. Fine. Probably.'
  },
  {
    id: 'talk-reply-helpdesk',
    colleagueId: 'helpdesk',
    body: 'You asked "{snippet}". {label} is a known issue. Status: ACKNOWLEDGED. Have you tried turning it off and on?'
  },
  {
    id: 'talk-reply-facilities',
    colleagueId: 'facilities',
    body: 'Copy on "{snippet}". Also {label} is why the third floor smells like burnt popcorn. Be honest.'
  },
  {
    id: 'talk-reply-hr',
    colleagueId: 'hr',
    body: 'Thanks for "{snippet}", {userName}! I peeked at {label} — love the wellness energy 😊'
  },
  {
    id: 'talk-reply-jared',
    colleagueId: 'jared',
    body: 'Yeah — "{snippet}"? {label} looks intense from here. You good?'
  },
  {
    id: 'talk-reply-ciso',
    colleagueId: 'ciso',
    body: 'You said "{snippet}" out loud. {label} is an attack surface with branding. I logged both.'
  },
  {
    id: 'talk-reply-generic',
    body: 'Fair point on "{snippet}". Give me a minute on {label} and I\'ll circle back.'
  },
  {
    id: 'talk-reply-generic-busy',
    body: 'Heard "{snippet}" — deep in {label} right now. Ping you when I surface.'
  }
];

export function officeImReplyFallbacks() {
  return OFFICE_IM_REPLY_TEMPLATES;
}

export function officeTalkReplyFallbacks() {
  return OFFICE_TALK_REPLY_FALLBACKS;
}
