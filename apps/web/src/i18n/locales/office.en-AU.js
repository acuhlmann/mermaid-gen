/**
 * Aussie slang overrides for the office-parody copy (docs/office-parody.md).
 * Template arrays replace the English bank wholesale (deepMergeLocale), so
 * ids, colleagueIds, and `{label}` / `{userTitle}` slots must stay aligned
 * with officeCast.js — the seen-template memory is shared across locales.
 */
export const OFFICE_EN_AU = {
  OFFICE_COLLEAGUES: {
    intern: { blurb: 'Replies-all. Asks naive questions that are accidentally profound.' },
    scrumMaster: {
      blurb: 'Everything is a ceremony. Will time-box your smoko. Runs every meeting.'
    },
    helpdesk: { blurb: 'Closes tickets as duplicates of themselves. Works on his machine.' },
    facilities: {
      blurb: 'Sends ALL-CAPS fridge cleanouts. Runs the thermostat with an iron fist.'
    },
    hr: {
      blurb: 'Weaponised cheerfulness. Your training is 847 days overdue. Sign Craig’s card.'
    },
    greybeard: {
      blurb: '“We tried that in 2009.” Maintains the mainframe. Unsettlingly good advice.'
    }
  },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: 'Welcome aboard, {userTitle}! 🎉 (badge photo: pending)',
    body: 'Welcome to the floor! Stoked to have you. A few names before your mandatory orientation (rescheduled, TBD):\n\n📅 Pam (Agile Coach) runs the meetings. All of them.\n🧃 Chad (our intern) will IM you shortly. He means well.\n🖥️ Ticket Bot Dave is IT. Do not reply, do not call, do not.\n🧹 Gary owns the fridge and the thermostat. Respect both.\n🧓 Ulrich has seen your architecture before. In 2009.\n\nAnd I’m Linda — People Ops! Your compliance training is already overdue, which is honestly a record. The inbox 📥, Focus Time, and Office noise toggles live in the corner whenever you need us quieter.\n\nWarmly,\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: 'hey!! you must be the new {userTitle} — welcome!! the coffee machine has fourteen buttons and twelve are decorative. also gary WILL email you about the fridge. it’s not personal (it is)'
  },
  OFFICE_EMAIL_TEMPLATES: [
    {
      id: 'email-fridge-cleanout',
      colleagueId: 'facilities',
      subject: 'REMINDER: Fridge cleanout FRIDAY',
      body: 'The fridge gets cleaned Friday at 3 PM sharp. Anything unlabelled becomes property of Facilities. That includes containers, condiments, and architecture diagrams.\n\nCheers in advance,\nGary'
    },
    {
      id: 'email-thermostat',
      colleagueId: 'facilities',
      subject: 'RE: RE: RE: Thermostat',
      body: 'The thermostat is set to a scientifically optimal 20.5°C and now lives in a locked box. Quit taping ice packs to the sensor. I know it was the third floor.\n\nGary'
    },
    {
      id: 'email-room-booking',
      colleagueId: 'facilities',
      subject: 'Your booking of "War Room 4" is confirmed',
      body: "Heads up that War Room 4 got turned into a wellness pod in 2023, and before that it didn't exist. Your booking's still confirmed though.\n\nGary"
    },
    {
      id: 'email-password-expiry',
      colleagueId: 'helpdesk',
      subject: '[Ticket #48291] Your password expires in 14 days',
      body: "To reset your password, log in with your expired password and follow the link we'll flick to the email account you're locked out of.\n\nThis ticket has been closed as RESOLVED.\n\n— Helpdesk (do not reply, do not call, do not)"
    },
    {
      id: 'email-ticket-duplicate',
      colleagueId: 'helpdesk',
      subject: '[Ticket #48292] Closed as duplicate of #48292',
      body: 'Your ticket about "{label}" has been closed as a duplicate of itself. If the issue persists, it\'s a feature.\n\nWorks on my machine,\nDave'
    },
    {
      id: 'email-vpn-maintenance',
      colleagueId: 'helpdesk',
      subject: 'PLANNED OUTAGE: VPN maintenance window',
      body: 'The VPN will be down Saturday 02:00–02:15 and, going off historical data, also Monday through Thursday.\n\nTried turning the diagram off and on again?\n\n— Dave'
    },
    {
      id: 'email-compliance-training',
      colleagueId: 'hr',
      subject: 'Friendly nudge! Training overdue 😊',
      body: 'G\'day! Just a friendly nudge that your "Working Safely With Diagrams" compliance training is 847 days overdue! It only takes 4 hours and features 11 unskippable modules.\n\nWarmly,\nLinda — People Ops'
    },
    {
      id: 'email-birthday-card',
      colleagueId: 'hr',
      subject: 'Card for Craig — sign by EOD!',
      body: "Craig's birthday card is doing the rounds! Please add a warm personal message for Craig. If you don't know Craig, a warm generic message is fine. Craig knows who you are.\n\nLinda"
    },
    {
      id: 'email-mandatory-fun',
      colleagueId: 'hr',
      subject: "You're invited: Mandatory Team Fun Hour 🎉",
      body: 'Attendance at Thursday\'s optional team-building is mandatory. This quarter\'s theme: "Trust Falls & Org Charts". Please review {label} beforehand so the fun stays aligned. BYO enthusiasm.\n\nLinda'
    },
    {
      id: 'email-storypoints',
      colleagueId: 'scrumMaster',
      subject: 'Action required: story-point your diagram',
      body: 'Great energy this sprint! Reminder that every diagram box needs story-pointing by tomorrow\'s refinement. "{label}" looks like a 13 — let\'s decompose it in the parking lot.\n\nPam',
      actionPrompt: 'Split the most complex node into two smaller steps'
    },
    {
      id: 'email-intern-replyall',
      colleagueId: 'intern',
      subject: 'RE: RE: FW: RE: quick question',
      body: 'sorry for the reply-all again!! but does anyone know if "{label}" is meant to connect to the other thing? also where do we keep the stapler? unrelated.\n\nchad (intern)'
    },
    {
      id: 'email-greybeard-migration',
      colleagueId: 'greybeard',
      subject: 'you have reinvented the batch job',
      body: "Saw your diagram on the shared drive. We built this in 2009. Ran on a cron job and fear. Took down prod for a week in 2011.\n\nAsk me how. Or don't. It knows.\n\nUlrich"
    }
  ],
  OFFICE_IM_TEMPLATES: [
    {
      id: 'im-intern-boxes',
      colleagueId: 'intern',
      body: 'quick q — is {label} meant to have that many arrows? asking for my onboarding doc'
    },
    {
      id: 'im-intern-lunch',
      colleagueId: 'intern',
      body: 'anyone else cop the fridge email?? gary means business'
    },
    {
      id: 'im-scrum-standup',
      colleagueId: 'scrumMaster',
      body: "Friendly ping! You've been heads-down for a while — should we time-box this, mate? 🙂"
    },
    {
      id: 'im-scrum-retro',
      colleagueId: 'scrumMaster',
      body: 'Chucking "{label}" on the retro board as a discussion topic. Great energy!'
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
      body: "Whoever's watering the fake plant near the lifts — give it a rest. It's thriving and I don't like it."
    },
    {
      id: 'im-hr-survey',
      colleagueId: 'hr',
      body: "Only 2 minutes left to knock over the anonymous wellness survey! (We can see you haven't started, {userTitle}.)"
    },
    {
      id: 'im-greybeard-look',
      colleagueId: 'greybeard',
      body: "Had a squiz at {label}. We tried that in 2009. It's fine. Probably."
    },
    {
      id: 'im-greybeard-mainframe',
      colleagueId: 'greybeard',
      body: 'The mainframe asked about you. Told it you were flat out diagramming. It understood.'
    }
  ],
  OFFICE_WALKBY_FALLBACKS: [
    {
      id: 'walkby-scrum',
      colleagueId: 'scrumMaster',
      body: "Ooh, is that {label}? Wasn't on the sprint board — I've added it retroactively as a spike."
    },
    {
      id: 'walkby-intern',
      colleagueId: 'intern',
      body: 'whoa, {label} looks heaps official. did you make that with the AI? can I chuck it in my portfolio?'
    },
    {
      id: 'walkby-greybeard',
      colleagueId: 'greybeard',
      body: "{label}, eh. We had one of those in 2009. It's still running. Nobody knows where."
    },
    {
      id: 'walkby-facilities',
      colleagueId: 'facilities',
      body: 'Nice diagram. Is {label} why the third floor smells like burnt popcorn? Be honest.'
    },
    {
      id: 'walkby-hr',
      colleagueId: 'hr',
      body: 'Love the energy around {label}! Reckon you could present it at Mandatory Fun Hour? 😊'
    }
  ],
  OFFICE_COFFEE_SCENES: [
    {
      id: 'coffee-machine-politics',
      lines: [
        {
          speakerId: 'facilities',
          text: "New coffee machine's got fourteen buttons. Twelve are decorative."
        },
        { speakerId: 'greybeard', text: 'The old one had one button and a smell. Better days.' }
      ]
    },
    {
      id: 'coffee-standup',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: 'Dreamt we did standup sitting down. Woke up in a cold sweat.'
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
          text: "Signed Craig's card yet? Everyone keeps asking who Craig is. That's not the point of a card."
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
        {
          speakerId: 'facilities',
          text: "That printer is load-bearing. Don't touch the printer."
        }
      ]
    },
    {
      id: 'coffee-vision',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: 'They\'ve renamed the roadmap to "north-star journey atlas". The roadmap itself is unchanged since 2022.'
        },
        { speakerId: 'greybeard', text: "In 2009 we called it a list. It also didn't change." }
      ]
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: 'WG: Diagram Alignment Sync (recurring)',
    inviteFallbackBody:
      'We need to sync on the current diagram. Agenda: alignment, next steps, alignment on next steps. Snacks: nah.',
    joiningLine: 'Waiting for the organiser to let you in…',
    cancelledSubject: 'CANCELLED: Diagram Alignment Sync',
    cancelledBody:
      "Meeting's off — the organiser is double-booked. Rescheduled to: never. Action items remain your problem.\n\nPam",
    proposeNewTimeGag: 'New time proposed. The organiser has knocked back your proposed time.',
    minutesTitle: 'Meeting minutes',
    raiseHandPlaceholder: 'Say something to the room…',
    leaveLabel: 'Shoot through',
    interjectCapLine: 'Pam: "Great point — let\'s parking-lot it. We\'re at time."'
  },
  OFFICE_IM_QUICK_REPLIES: ['👍', 'in a meeting', 'circling back arvo'],
  OFFICE_CHROME_COPY: {
    doIt: 'Have a go',
    directory: {
      title: 'Welcome to the office',
      tagline: 'Your diagram has a workplace — and the floor has opinions.',
      tourHint: 'Meet them one at a time. Mute anytime with Focus Time.',
      rosterTagline: 'The cast that emails, IMs, and walks by while you work:',
      expandLabel: '🏢 Meet the office',
      expandTitle: 'Who keeps interrupting me?',
      startLabel: 'Meet the floor →',
      nextLabel: 'Next →',
      backLabel: '← Back',
      skipLabel: 'Skip',
      progressLabel: '{current} of {total}',
      dismissLabel: 'Clock on',
      closeAria: 'Close the office directory'
    },
    inbox: {
      mailAnnounce: 'You’ve got mail, mate!',
      mailAnnounceLang: 'en-AU',
      soundscapeLabel: 'Office noise',
      soundscapeTitle:
        'Ambient office racket — keyboards, paper, the printer, the phone, the coffee machine',
      emptyLine: "Inbox zero. HR reckons that's suss. Enjoy it while it lasts.",
      callMeetingDisabledTitle: 'Draw something first — even this meeting needs an agenda, mate'
    },
    coffee: {
      inviteLine: 'Coffee break? {name} is holding court at the machine.',
      accept: 'Smoko',
      decline: 'Flat out',
      sceneAria: 'Coffee break',
      sceneTitle: 'The Watercooler',
      done: 'Back to it'
    },
    meetingInvite: {
      organizerLabel: 'Organiser:',
      attendeesLabel: 'Attendees:',
      accept: 'Accept',
      decline: 'Decline',
      proposeNewTime: 'Propose new time'
    }
  }
};
