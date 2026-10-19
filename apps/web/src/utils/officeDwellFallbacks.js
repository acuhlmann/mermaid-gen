/**
 * Canned lines when somebody looks up because you loitered (slice 19) and the
 * LLM is unavailable. These are provoked remarks — you crossed the floor and
 * stood there — not cold-open desk pings, so they live beside the IM reply
 * bank rather than in `OFFICE_IM_TEMPLATES`.
 */

export const OFFICE_DWELL_FALLBACKS = [
  {
    id: 'dwell-intern',
    colleagueId: 'intern',
    body: 'oh — hi {userName}. did you need something on {label}? i can pull it up if you want'
  },
  {
    id: 'dwell-scrum',
    colleagueId: 'scrumMaster',
    body: 'Love that you’re here!! Quick pulse on {label} — blocking anything I should capture??'
  },
  {
    id: 'dwell-greybeard',
    colleagueId: 'greybeard',
    body: 'You’ve been standing there since before this box was named {label}. Can I help, or are you auditing me?'
  },
  {
    id: 'dwell-helpdesk',
    colleagueId: 'helpdesk',
    body: 'Ticket: user loitering near {label}. Status: ACKNOWLEDGED. Do you need a keyboard or just moral support?'
  },
  {
    id: 'dwell-facilities',
    colleagueId: 'facilities',
    body: 'Everything okay by {label}? The motion lights on three think you live here now.'
  },
  {
    id: 'dwell-jared',
    colleagueId: 'jared',
    body: 'Hey — you good? {label} looks intense from over here.'
  },
  {
    id: 'dwell-generic',
    body: 'Can I help with {label}, or are you just thinking out loud?'
  }
];

export function officeDwellFallbacks() {
  return OFFICE_DWELL_FALLBACKS;
}

export default officeDwellFallbacks;
