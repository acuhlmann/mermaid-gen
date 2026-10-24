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
    body: 'Noted on "{snippet}" — great energy. I\'ve time-boxed a follow-up for after standup, and story-pointed the follow-up itself so the conversation also counts as delivery 🙂'
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
    body: 'Just a friendly nudge! Logged "{snippet}" as a wellness win 😊 Your security training is 41 days overdue, but that is between you and the learning platform.'
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
    body: 'Capturing "{snippet}" in the parking lot!! It\'s in excellent company — six others from the last three re-orgs, all still parked, all still loved. Thank you!!'
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
    body: 'Oh — you asked "{snippet}"? I have no idea, honestly. But {label} looks incredible, so I am going to say yes with confidence and then go ask somebody older.'
  },
  {
    id: 'talk-reply-scrum',
    colleagueId: 'scrumMaster',
    body: 'Heard you on "{snippet}"!! {label} has great energy — I genuinely cannot tell if it is a vision or a blocker, so I logged it as both, which is what the board wants from me!!'
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
    body: 'Heard you on "{snippet}", {userName}! I peeked at {label} — that is wellness energy 😊 I am putting it in the Friday note. The Friday note goes to the whole building. Gary will reply to it.'
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
