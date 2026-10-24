/**
 * Canned email replies when the user composes mail and the LLM is unavailable.
 * These are provoked — the user handed somebody a subject and body — so they quote
 * `{snippet}` and read as a reply, not as a cold-open inbox pitch from the ambient
 * director (`officeEmailTemplates()` in `officeCast.js`).
 */

export const OFFICE_EMAIL_REPLY_TEMPLATES = [
  {
    id: 'email-reply-intern',
    colleagueId: 'intern',
    subject: 'Re: your note',
    body: 're: "{snippet}" — lol ok. also is {label} on your canvas supposed to look that official??'
  },
  {
    id: 'email-reply-scrum',
    colleagueId: 'scrumMaster',
    subject: 'Re: following up',
    body: 'Re: "{snippet}" — love the energy. I glanced at {label} on the canvas and put it on the board as a spike, which is how we track the things nobody scoped. That isn’t criticism, it’s the board. 🙂'
  },
  {
    id: 'email-reply-greybeard',
    colleagueId: 'greybeard',
    subject: 'Re: your message',
    body: 'Re: "{snippet}" — {label} reminds me of 1984. We had one of those. It\'s fine. Probably.'
  },
  {
    id: 'email-reply-hr',
    colleagueId: 'hr',
    subject: 'Re: thanks for reaching out',
    body: 'Thanks for "{snippet}", {userName}! I peeked at {label} on the canvas and filed it under Wellness Wins 😊 That is a real folder. It sits inside the folder called Evidence, and both are due Friday.'
  },
  {
    id: 'email-reply-helpdesk',
    colleagueId: 'helpdesk',
    subject: 'Re: ticket update',
    body: 'User wrote: "{snippet}". I see {label} on the diagram. Status: ACKNOWLEDGED. Have you tried turning it off and on?'
  },
  {
    id: 'email-reply-generic',
    subject: 'Re: your note',
    body: 'Re: "{snippet}" — noted. {label} on the canvas looks busy; circling back after standup.'
  },
  {
    id: 'email-reply-facilities',
    colleagueId: 'facilities',
    subject: 'Re: facilities matter',
    body: 'Re: "{snippet}". Copy. Also label your leftovers. Also label {label} if it is perishable. Everything is perishable.'
  },
  {
    id: 'email-reply-ciso',
    colleagueId: 'ciso',
    subject: 'Re: noted',
    body: 'Re: "{snippet}". I read it. I logged it. {label} remains an attack surface. Do not thank me.'
  }
];

export function officeEmailReplyFallbacks() {
  return OFFICE_EMAIL_REPLY_TEMPLATES;
}

export default officeEmailReplyFallbacks;
