/**
 * Cold-open desk visit lines when a walk-by moment fires and the LLM is
 * unavailable. These are ambient — nobody asked a question — so they must not
 * read like Slop Chat replies (`re:` cadence lives in `officeImReplyFallbacks.js`).
 * Provoked walk-overs reuse the talk reply bank in `officeMomentDelivery.js`.
 */

export const OFFICE_WALKBY_FALLBACKS = [
  {
    id: 'walkby-scrum',
    colleagueId: 'scrumMaster',
    body: "Ooh, is that {label}?! This wasn't on the sprint board — I've added it retroactively as a spike. Amazing energy. Parking lot pending. Thank you so much for the visibility!!"
  },
  {
    id: 'walkby-intern',
    colleagueId: 'intern',
    body: 'whoa {userName}, {label} looks so Series A. did you make that with the AI? can I put it in my portfolio / pitch deck / both? also i may have reply-all’d a screenshot of it already sorry'
  },
  {
    id: 'walkby-greybeard',
    colleagueId: 'greybeard',
    body: "{label}, huh. We had one of those in 1979. It's still running. Nobody knows where. The mainframe does. It judges."
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
    body: "Careful with {label}. The last one of those became self-aware around 2011. We don't say 'orchestrator' out loud anymore. Or 'synergy'. Mostly. The mainframe preferred 'cron'."
  },
  {
    id: 'walkby-scrum-points',
    colleagueId: 'scrumMaster',
    body: "Love the energy on {label}!! I've story-pointed it as a 21 and then decomposed my feelings into three 8s. Math checks. Culture checks. Thank you!!"
  },
  {
    id: 'walkby-intern-ship',
    colleagueId: 'intern',
    body: 'wait {label} is LIVE?? i thought live meant "in the doc". is prod the same as the canvas. asking for my resume / also my survival'
  },
  {
    id: 'walkby-ciso-surface',
    colleagueId: 'ciso',
    body: '{label} is an attack surface with branding. Cute. I have already filed three findings and one compliment disguised as a finding.'
  },
  {
    id: 'walkby-helpdesk-known',
    colleagueId: 'helpdesk',
    body: "Oh, {label}. That's a known issue. Known since Tuesday. Known as a feature since Wednesday. Closed Thursday. You're welcome."
  }
];

export function officeWalkbyFallbacks() {
  return OFFICE_WALKBY_FALLBACKS;
}

export default officeWalkbyFallbacks;
