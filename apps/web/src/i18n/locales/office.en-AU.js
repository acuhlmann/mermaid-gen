/**
 * Aussie slang overrides for the office-parody copy (docs/office-parody.md).
 * Template arrays replace the English bank wholesale (deepMergeLocale), so
 * ids, colleagueIds, and `{label}` / `{userTitle}` slots must stay aligned
 * with officeCast.js — the seen-template memory is shared across locales.
 */
export const OFFICE_EN_AU = {
  OFFICE_COLLEAGUES: {
    intern: {
      blurb:
        'Reply-alls the apology for the reply-all. Equity in vibes. Accidentally asks the only good question.',
      introLine:
        "Hey!! I'm Chad — unpaid, strategic, and statistically likely to reply-all about the stapler, then reply-all apologising for the reply-all. Quick question about your diagram that might accidentally be the smartest thing anyone says today. Also: where is the stapler. Asking for my onboarding doc / also my soul."
    },
    scrumMaster: {
      blurb:
        'Everything is a ceremony. Will time-box your smoko. Facilitates your existential dread with great energy.',
      introLine:
        "G'day!! I'm Pam — CSM, CSPO, SAFe 6.0, and emotionally fluent in parking lots. This introduction is time-boxed for forty-five seconds of synergy. Amazing energy already. Love that for us. Let's circle back — and thank you so much for being here!!"
    },
    helpdesk: {
      blurb: 'Closes tickets as duplicates of themselves. Works on his machine. DNS was involved.',
      introLine:
        'Ticket Bot Dave. Tier 1 of 1. I close tickets as duplicates of themselves. Have you tried turning it off and on again. That was not a question. Works on my machine.'
    },
    facilities: {
      blurb: 'ALL-CAPS fridge cleanouts. Thermostat locked at 20.5°C. Architecture is perishable.',
      introLine:
        'I AM GARY. I OWN THE FRIDGE. I OWN THE THERMOSTAT. Unlabelled containers — and unlabelled architecture diagrams — become FACILITIES PROPERTY. You have been warned.'
    },
    hr: {
      blurb:
        'Weaponised cheerfulness. Training overdue since onboarding. Please sign Craig’s card.',
      introLine:
        "I'm Linda, People Ops. Badge photos, overdue trainings, and Craig's birthday card — that last one is somehow your problem too."
    },
    greybeard: {
      blurb:
        '“We tried that in ’79.” Maintains the mainframe. The mainframe maintains him. Darker punchlines, same calm.',
      introLine:
        'Ulrich. Staff Engineer Emeritus. We tried that in 1979. It ran on JCL and fear. Took prod down for a week. Still running. I maintain the mainframe nobody admits exists. The mainframe asked about you. I told it you were diagramming. It sighed.'
    },
    ciso: {
      blurb: "Everything's an attack surface — especially the arrows. Trust is a vulnerability.",
      introLine:
        'Sasha. CISO. Department of No. Everything is an attack surface — especially you, the arrows, and that temporary admin password from 2017. Noted in your file.'
    }
  },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: 'Welcome aboard, {userTitle}! 🎉 (badge photo: pending)',
    body: 'Welcome to the floor, {userName}! Stoked to have you. A few faces from Your Team before orientation (rescheduled, TBD):\n\n🙋 Dinesh will catch the bug nobody else saw, then remind you he caught it.\n🕶 Erlich will ask if the diagram is courageous. Answer carefully.\n📋 Jared has already filed a finding about your onboarding handoff. Softly. Firmly.\n🤓 Richard thinks this office has a named pattern. He is probably right.\n🧘 Jack Barker is thrilled — and has taken the liberty of simplifying your first week for the board.\n\nGilfoyle and Russ are also on the floor. They will find you. They do not need an introduction.\n\nAnd I’m Linda — People Ops! Your compliance training is already overdue, which is honestly a record. Need quieter? Your desk menu has Focus, Noise, and Voice — and you can always stand up and wander over to the coffee machine.\n\nHR forever,\nLinda'
  },
  OFFICE_WELCOME_IM: {
    id: 'welcome-im-intern',
    colleagueId: 'intern',
    body: 'hey {userName}!! you must be the new {userTitle} — welcome!! the coffee machine has fourteen buttons and twelve are decorative. also gary WILL email you about the fridge. it’s not personal (it is)'
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
      training: 3,
      subject: 'Friendly nudge! Training overdue 😊',
      body: 'G\'day! Just a friendly nudge that your "Working Safely With Diagrams" compliance training is 847 days overdue! It only takes 4 hours and features 11 unskippable modules.\n\nHR forever,\nLinda — People Ops'
    },
    {
      id: 'email-birthday-card',
      colleagueId: 'hr',
      subject: 'Card for Craig — sign by EOD!',
      body: "Craig's birthday card is doing the rounds! Please add a personal message for Craig. If you don't know Craig, a generic message is fine. Craig knows who you are.\n\nLinda"
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
      body: "Saw your diagram on the shared drive. We built this in 1979. Ran on a batch job and fear. Took down prod for a week in 1981.\n\nAsk me how. Or don't. It knows.\n\nUlrich"
    },
    {
      id: 'email-helpdesk-printer-firmware',
      colleagueId: 'helpdesk',
      subject: '[Ticket #48313] Printer firmware update complete',
      body: 'The third-floor printer is now on firmware 9.0.1. New features: knocking back PDFs, a louder noise, and printing one (1) page reading "soon" whenever it fancies. This is expected behaviour.\n\nDo not open a ticket. It will be closed as a duplicate of the printer.\n\n— Dave'
    },
    {
      id: 'email-greybeard-cloud',
      colleagueId: 'greybeard',
      subject: 'RE: cloud migration kickoff',
      body: "The cloud is the mainframe with better marketing. I migrated us once — 1984, to 'the grid'. We migrated back in 1985. Quietly. At night.\n\nYour {label} will run fine either way. Things mostly do, until they don't.\n\nUlrich"
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
      body: 'Join us Wednesday for a guided session on breathing between boxes and letting go of arrows that no longer serve you. We close with a gratitude circle for {label}.\n\nAttendance is anonymous and tracked.\n\nNamaste-ish,\nLinda — People Ops'
    },
    {
      id: 'email-facilities-microwave',
      colleagueId: 'facilities',
      subject: 'INCIDENT REPORT: The Microwave',
      body: 'At 12:47 someone microwaved fish. The building has feelings about this, and so do I. The microwave is now under new management (mine). A sign-up sheet is on the door: NAME, DISH, INTENTIONS.\n\nCheers in advance,\nGary'
    },
    {
      id: 'email-intern-first-ship',
      colleagueId: 'intern',
      subject: 'i shipped something!!! (small question)',
      body: "you guys!! my first change is LIVE. it's the {label} one. quick question though — if everything's on fire but in a small way, who do i tell? asking hypothetically. the fire is hypothetical. mostly.\n\nchad (intern)"
    },
    {
      id: 'email-intern-pitch-deck',
      colleagueId: 'intern',
      subject: 'quick q: can a diagram be a pitch deck',
      body: 'hey {userName}!! random but is "{label}" basically a pitch deck with arrows?? asking because someone said "deck" in standup and i nodded for 12 minutes.\n\nalso i put "disrupting the whiteboard space" on me linkedin. is that too much\n\nchad (intern)'
    },
    {
      id: 'email-helpdesk-slack-outage',
      colleagueId: 'helpdesk',
      subject: '[Ticket #48340] Slop Chat™ is fine (update)',
      body: 'Slop Chat™ briefly entered a quantum state where messages both sent and did not send. Root cause: DNS, vibes, and a deploy nobody claimed.\\n\\nStatus: RESOLVED. Status of the resolution: also RESOLVED. If you still cannot send, that is a different ticket, which is already closed.\\n\\n— Dave'
    },
    {
      id: 'email-facilities-hotdesk',
      colleagueId: 'facilities',
      subject: 'Hot-desking: your desk is a suggestion',
      body: 'Effective Monday, desks are "fluid collaboration nodes". Your monitor settings, snacks, and emotional support plant will be redistributed by Facilities. Name tags are for closers.\\n\\nIf you find someone at YOUR desk, congratulate them. Synergy has seated itself.\\n\\nGary'
    },
    {
      id: 'email-scrum-definition-done',
      colleagueId: 'scrumMaster',
      subject: 'Updated Definition of Done (v14, living doc)',
      body: 'DoD now includes: tests (vibes OK), docs (emoji OK), and a parking-lot sticky that "{label}" has been socially processed.\\n\\nItems not Done remain Done-adjacent. Celebrate the adjacency!!\\n\\nPam'
    },
    {
      id: 'email-greybeard-kubernetes',
      colleagueId: 'greybeard',
      subject: 'you rediscovered init scripts',
      body: "Your '{label}' cluster YAML is three init scripts in a trench coat. We ran those from cron in 1988. The mainframe still has the receipts.\\n\\nOrchestration is a mood. Fear is a runtime.\\n\\nUlrich"
    },
    {
      id: 'email-hr-anonymous-feedback',
      colleagueId: 'hr',
      subject: 'Anonymous feedback window is OPEN 😊',
      body: 'Share how you really feel about the culture! Responses are anonymous, optional, and attached to your employee ID for "theme analysis".\\n\\nThemes so far: fridge, thermostat, Craig.\\n\\nHR forever,\\nLinda — People Ops'
    },
    {
      id: 'email-helpdesk-2fa',
      colleagueId: 'helpdesk',
      subject: '[Ticket #48355] MFA enrolment (please ignore carefully)',
      body: 'You must enrol in MFA by Friday using the app that requires MFA to download. Backup codes were emailed to the account you cannot access.\\n\\nThis ticket anticipates your confusion and has closed itself.\\n\\n— Dave'
    },
    {
      id: 'email-intern-standup-confession',
      colleagueId: 'intern',
      subject: 're: blockers (mine)',
      body: "hey {userName} — my blocker is that i don't know what a blocker is. also {label} looks scary in a Series A way. also i told standup i was 'heads down' while writing this email. am i doing product\\n\\nchad (intern)"
    },
    {
      id: 'email-facilities-bike-room',
      colleagueId: 'facilities',
      subject: 'Bike room policy (FINAL, with feelings)',
      body: 'The bike room is not a closet, not a meeting room, and not a place to store ambition. Helmets unlabelled for 48h become Facilities property. Same rule as the fridge. Same energy. Different smell.\\n\\nGary'
    }
  ],
  SENIOR_EMAIL_TEMPLATES: [
    {
      id: 'email-ciso-phishing',
      colleagueId: 'ciso',
      subject: 'You did NOT click. We noticed. (Phishing Simulation Report)',
      body: 'Courtesy notice: you failed to click last week\'s simulated phishing email ("FREE ARCHITECTURE REVIEW — CLICK NOW"). Statistically, everyone clicks. Not clicking is suss behaviour and has been noted in your file.\n\nWe\'ll keep testing until you do.\n\nTrust nothing,\nSasha — The Department of No'
    },
    {
      id: 'email-ciso-phishing-bait',
      colleagueId: 'ciso',
      phishing: true,
      subject: 'URGENT: Your diagram access will be revoked in 24 hours',
      body: 'Dear Valued Colleauge,\n\nOur system have detected unusual activity on your diagram "{label}". To avoid permanent deletion of all your work, please re-verify your credentials within 24 hours using the secure link below.\n\nThis is a official communication from the Security Team. Do not reply to this email.\n\nRegards,\nThe Security Team (Internal)'
    },
    {
      id: 'email-ciso-password',
      colleagueId: 'ciso',
      subject: 'Password policy update (effective yesterday)',
      body: 'Passwords must now contain 16 characters, one emoji, one prime number, and the ghost of a deprecated protocol. Passwords may not contain: words, numbers, or characters.\n\nYour current password fails 11 of the 4 checks. Impressive, in a way.\n\nSasha'
    },
    {
      id: 'email-cfo-cloud-spend',
      colleagueId: 'cfo',
      subject: 'FLAGGED: unexplained line item ("{label}")',
      body: 'Finance flagged a resource called "{label}". Please confirm it is (a) essential, and (b) free. If it can\'t be both, see (b).\n\nThe budget is a no,\nDiane'
    },
    {
      id: 'email-barker-reorg',
      colleagueId: 'barker',
      subject: 'Organisational Update: the Conjoined Triangles of Success',
      body: 'Team,\n\nEffective immediately we are flattening the org by adding a layer. Engineering and Sales now sit at the bases of two conjoined triangles whose shared vertex is Compromise. Nobody reports to anybody twice, except where they do.\n\nYour work on "{label}" is unaffected — structurally, culturally, and in terms of who signs off on it, it is affected.\n\nConquest is a mindset,\nJack Barker',
      actionPrompt:
        'Draw the new org chart: two conjoined triangles sharing a vertex labelled Compromise, with Engineering and Sales at the bases and my current work reporting into both'
    },
    {
      id: 'email-belson-world',
      colleagueId: 'belson',
      subject: 'I do not want to live in a world where {label} stays this small',
      body: '{userName} — I have been sitting with {label}. Softly. Carefully. And then less softly. I do not want to live in a world where this remains a fucking diagram instead of a platform for human flourishing. Jack will take the liberty of a working group; I am clarifying the altitude. Enlarge the vision. Keep the logo. Or explain to me why we fund hobbies.\n\nGavin Belson',
      actionPrompt:
        "Enlarge the diagram's vision — headline-level platform framing, not implementation detail"
    },
    {
      id: 'email-belson-undersized',
      colleagueId: 'belson',
      subject: 'What the fuck is this altitude on {label}',
      body: '{userName} — I reviewed {label}. Briefly. Then again, because I could not believe the first pass. This is undersized. Small thinking dressed as shipping. I do not raise my voice for sport — I raise it when the world we are supposed to make better looks like a weekend sketch. Enlarge it. Now. Jack already knows.\n\nGavin Belson',
      actionPrompt:
        'Raise the diagram to keynote altitude — fewer hobby details, more platform destiny'
    },
    {
      id: 'email-barker-liberty',
      colleagueId: 'barker',
      subject: "I've taken the liberty (terrific news)",
      body: "{userName} — I spent some time with {label} this morning, and I am excited. Not just about what it is, but about the story we can tell about it. So I've taken the liberty of setting up a little working group around it — nothing formal, just a recurring sync, a steering committee, and a one-pager. That's what families do.\n\nConquest is a mindset,\nJack Barker",
      actionPrompt: 'Add a node named "Board-Ready Outcome" and connect it to the final step'
    },
    {
      id: 'email-barker-excited',
      colleagueId: 'barker',
      subject: "I don't know about you, but I am excited",
      body: "{userName} — {label} is coming along beautifully, and I say that as someone who has seen many, many diagrams. Remember: a diagram that can't impress a board is a hobby, and we're not a hobby company. Keep the story simple, the value obvious, and the synergy visible.\n\nWe're a family here.\n\nJack Barker"
    }
  ],
  OFFICE_IM_TEMPLATES: [
    {
      id: 'im-intern-boxes',
      colleagueId: 'intern',
      body: 'hey {userName}, quick q — is {label} meant to have that many arrows? asking for my onboarding doc'
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
      body: "Had a squiz at {label}. We tried that in 1979. It's fine. Probably."
    },
    {
      id: 'im-greybeard-mainframe',
      colleagueId: 'greybeard',
      body: 'The mainframe asked about you. Told it you were flat out diagramming. It understood.'
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
      body: "Velocity check! You're averaging 4.2 boxes an hour — ripper! Let's not tell finance we measure this. 🙂"
    },
    {
      id: 'im-facilities-elevator',
      colleagueId: 'facilities',
      body: 'The lift is making the noise again. Take the stairs. The stairs also make a noise, but a different one.'
    },
    {
      id: 'im-intern-jira',
      colleagueId: 'intern',
      body: 'created a jira for "{label}"!! then created a jira about creating the jira. then closed both as duplicates of each other. dave would be proud. or mad. unclear'
    },
    {
      id: 'im-scrum-async',
      colleagueId: 'scrumMaster',
      body: "Async standup in the channel!! Please post yesterday / today / blockers / feelings / feelings about blockers. I'll synthesise into a deck nobody opens 🙂"
    },
    {
      id: 'im-helpdesk-cache',
      colleagueId: 'helpdesk',
      body: 'Have you tried clearing the cache. Have you tried clearing the other cache. Have you tried clearing the cache of clearing the cache. Ticket closed as educational.'
    },
    {
      id: 'im-facilities-lights',
      colleagueId: 'facilities',
      body: 'Motion lights on 3 are haunted. They turn off while you are still moving. Architecture is perishable. So is dignity.'
    },
    {
      id: 'im-hr-badge',
      colleagueId: 'hr',
      body: 'Reminder: smile for the badge reprint! Last batch looked "legally distressed". We can see who. Anonymously.'
    },
    {
      id: 'im-greybeard-cobol',
      colleagueId: 'greybeard',
      body: 'Someone said cloud-native near {label}. I translated it to COBOL in my head. It still ran. The mainframe smirked.'
    },
    {
      id: 'im-intern-meeting-hell',
      colleagueId: 'intern',
      body: 'i have 7 meetings about meetings. is that a funnel?? asking for my calendar / also my will to live / also i already reply-all’d the invite chain sorry'
    },
    {
      id: 'im-scrum-capacity',
      colleagueId: 'scrumMaster',
      body: "Capacity check!! We're at 112% committed and 40% emotionally available. Perfect sprint shape. Thank you!!"
    },
    {
      id: 'im-helpdesk-reboot-loop',
      colleagueId: 'helpdesk',
      body: 'Laptop stuck on update 2 of 2 for 14 hours. Working as designed. Product calls it "journey". Do not open a ticket. The ticket opened itself and quit.'
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
      body: 'whoa {userName}, {label} looks heaps official. did you make that with the AI? can I chuck it in my portfolio?'
    },
    {
      id: 'walkby-greybeard',
      colleagueId: 'greybeard',
      body: "{label}, eh. We had one of those in 1979. It's still running. Nobody knows where."
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
    },
    {
      id: 'walkby-helpdesk',
      colleagueId: 'helpdesk',
      body: "That {label} box? I had an open ticket about it. Had. It's a known issue now. Good on ya."
    },
    {
      id: 'walkby-greybeard-orchestrator',
      colleagueId: 'greybeard',
      body: "Careful with {label}. The last one of those became self-aware around 2011. We don't say 'orchestrator' out loud anymore."
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
        { speakerId: 'greybeard', text: "In 1979 we called it a list. It also didn't change." }
      ]
    },
    {
      id: 'coffee-dns',
      lines: [
        {
          speakerId: 'helpdesk',
          text: "Postmortem's out. Root cause: DNS. Root cause of the root cause: also DNS."
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
          text: 'In 1979 the server lived under my desk. Free. Warm. Loud. Better days.'
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
          text: 'We tried that. 1987. The slogan took down prod. The mainframe still quotes it.'
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
    },
    {
      id: 'coffee-badge-photo',
      lines: [
        {
          speakerId: 'hr',
          text: 'Badge reprints are in. Yours looks like a hostage negotiation went well. Growth!'
        },
        {
          speakerId: 'intern',
          text: 'mine looks like i discovered equity in vibes mid-blink. is that a brand or a cry for help'
        }
      ]
    },
    {
      id: 'coffee-wifi-name',
      lines: [
        {
          speakerId: 'helpdesk',
          text: 'Guest Wi-Fi is still named "DefinitelyNotAHoneypot". Engagement is up. Security is… also up. In a sense.'
        },
        {
          speakerId: 'ciso',
          text: 'It is a honeypot. The name is the only honest thing on this floor. Noted.'
        }
      ]
    },
    {
      id: 'coffee-okrs',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: 'Q3 OKRs are "ship value", "feel value", and "retro the value". Measurable!!'
        },
        {
          speakerId: 'greybeard',
          text: 'In 1979 the objective was "keep it running". Key result: it ran. We slept.'
        }
      ]
    },
    {
      id: 'coffee-pingpong',
      lines: [
        {
          speakerId: 'facilities',
          text: 'The ping-pong table is a meeting room now. Book it. Bring paddles or a deck. Prefer a deck.'
        },
        {
          speakerId: 'intern',
          text: 'i booked it for "alignment" and someone brought actual balls. chaos. series a chaos'
        }
      ]
    },
    {
      id: 'coffee-reorg-rumor',
      lines: [
        {
          speakerId: 'hr',
          text: "There's a re-org rumour. There is always a re-org rumour. This one has a slide."
        },
        {
          speakerId: 'helpdesk',
          text: 'I opened a ticket: "org chart, unexpected behaviour". Closed as duplicate of capitalism.'
        }
      ]
    },
    {
      id: 'coffee-dark-mode',
      lines: [
        {
          speakerId: 'intern',
          text: 'why is everything in dark mode except the fridge policy email. that one is blinding. on purpose?'
        },
        {
          speakerId: 'facilities',
          text: 'Yes. Fear should be well-lit. Architecture too. Label your leftovers.'
        }
      ]
    }
  ],
  OFFICE_BATTLE_SCENES: [
    {
      id: 'battle-commit-credit',
      topic: 'Whose name goes on the fix',
      lines: [
        {
          speakerId: 'dinesh',
          text: "I found it, I fixed it, and the commit message says 'misc'. Misc. I am not a misc."
        },
        {
          speakerId: 'gilfoyle',
          text: 'The bug is closed. Nobody is going to read the message. Nobody read the ticket either.'
        },
        {
          speakerId: 'dinesh',
          text: "Someone will. In six months somebody opens the history, sees 'misc', and reckons it was you."
        },
        {
          speakerId: 'gilfoyle',
          text: 'That would require somebody to care who wrote it. I have never once wondered.'
        }
      ],
      verdicts: {
        dinesh:
          'Amended, with my name on it. The history is accurate now. That is genuinely all I wanted.',
        gilfoyle: "Message stays 'misc'. The bug is still closed. The universe remains indifferent."
      }
    },
    {
      id: 'battle-tabs-spaces',
      topic: 'Tabs vs. spaces',
      lines: [
        {
          speakerId: 'greybeard',
          text: 'Tabs. One keystroke, one character, configurable width. We settled this in 1979.'
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
        greybeard:
          'Tabs it is. The linter has been reconfigured. The intern will recover, in time.',
        intern:
          'two spaces win!! ulrich reckons the industry is cactus, but he reckons that every day anyway'
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
        ciso: 'Deploy moved to Monday. The weekend remains legally uneventful. No wuckas.'
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
          '20.5°C STANDS. A jumper drive has been organised. Morale is now a fabric problem.',
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
          text: 'It was my firewall rule, and my firewall rule was CORRECT. It blocked something suss: all traffic.'
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
        ciso: 'Ruling: the firewall was right. Availability is a rumour started by sales.'
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
    },
    {
      id: 'battle-mvp',
      topic: 'What does MVP actually mean',
      lines: [
        {
          speakerId: 'intern',
          text: 'ok but MVP means Minimum Viable Product right?? i put it on me linkedin three times'
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
    },
    {
      id: 'battle-remote-office',
      topic: 'Remote vs. "back in the office"',
      lines: [
        {
          speakerId: 'hr',
          text: 'Culture happens in the building! Presence is a wellness metric. Cameras on is a love language.'
        },
        {
          speakerId: 'greybeard',
          text: 'I was remote in 1979. The mainframe was under my desk. Latency was honesty. Commutes were optional myths.'
        },
        {
          speakerId: 'hr',
          text: "We've booked mandatory Fun Fridays on-site! Attendance is tracked anonymously and by badge swipe."
        },
        {
          speakerId: 'greybeard',
          text: 'Fun tracked is not fun. It is a ticket. Dave will close it as a duplicate of joy.'
        }
      ],
      verdicts: {
        hr: 'Hybrid it is! Hybrid means in-office with Wi-Fi anxiety. Badge printers rejoice.',
        greybeard:
          "Remote stands. The building can keep its Fun Fridays. The mainframe never RSVP'd."
      }
    },
    {
      id: 'battle-jira-notion',
      topic: 'Jira vs. Notion (the second brain war)',
      lines: [
        {
          speakerId: 'scrumMaster',
          text: 'If it is not in Jira, it is not real!! Tickets are truth. Backlog is destiny. Great energy!'
        },
        {
          speakerId: 'intern',
          text: 'but notion is where the vibes live?? i nested twelve databases and lost my internship inside one'
        },
        {
          speakerId: 'scrumMaster',
          text: "We'll sync Notion into Jira via a ceremony and a Zap nobody owns. Alignment!!"
        },
        {
          speakerId: 'intern',
          text: 'i already made a notion page about the zap. it has a roadmap emoji. we are so back'
        }
      ],
      verdicts: {
        scrumMaster:
          'Jira wins. Notion becomes a mirror that lies optimistically. Pam has story-pointed the lying.',
        intern:
          'notion wins!! jira is now a "system of record" which means nobody opens it. equity in vibes.'
      }
    },
    {
      id: 'battle-emoji-reacts',
      topic: 'Whether 👍 counts as a decision',
      lines: [
        {
          speakerId: 'helpdesk',
          text: 'A thumbs-up is ACK. ACK is closure. Closure is peace. I have closed wars with an emoji.'
        },
        {
          speakerId: 'ciso',
          text: 'A thumbs-up is not consent, not a change advisory, and not a security review. Noted in the channel. Forever.'
        },
        {
          speakerId: 'helpdesk',
          text: 'Then stop reacting with 🔥 to outages. That is also not a runbook. It is vibes with severity.'
        },
        {
          speakerId: 'ciso',
          text: '🔥 means I see you. Seeing you is not approving you. Learn the difference before prod learns it.'
        }
      ],
      verdicts: {
        helpdesk:
          'Emoji decisions stand. CAB now accepts 👍 as a quorum. Efficiency is a yellow heart.',
        ciso: 'Emoji are not approvals. The CAB remains a meeting. Your file remains a file.'
      }
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: 'Working group sync',
    steeringInviteTitle: 'Architecture Review Board (steering)',
    quickSyncTitle: 'Quick sync',
    quickSyncTitleRemote: 'Headset sync',
    defaultSyncTitle: 'Working group sync',
    defaultRemoteTitle: 'Headset sync',
    inviteFallbackBody:
      'The big bosses want a squiz at the current diagram. Agenda: the headline, the cost, the risk. Your team presents; the seniors have questions. Snacks: nah.',
    allHandsInviteTitle: 'All-Hands: Alignment, Altitude & The Path Forward',
    allHandsInviteBody:
      "Gavin's hosting a company-wide all-hands. Everyone attends. Agenda: the vision, the altitude, and where we go from here. There'll be time for questions, and there won't be answers. Cameras on.",
    joiningLine: 'Waiting for the organiser to let you in…',
    cancelledSubject: 'CANCELLED: Working group sync',
    cancelledBody:
      "Meeting's off — leadership is double-booked. Rescheduled to: never. Action items remain your problem.\n\nPam",
    proposeNewTimeGag: 'New time proposed. The organiser has knocked back your proposed time.',
    minutesTitle: 'Meeting minutes',
    actionItemsLabel: 'Action items',
    actionItemsCount: '{count} to do',
    minutesActionLede:
      'Tick items and tap Do selected, or Do the lot to ship every action item to the canvas.',
    minutesEmptyLede: 'No action items — a perfect meeting, by corporate standards.',
    discussionNotesLabel: 'Discussion notes',
    speakPlaceholder: 'Say something to the room…',
    leaveLabel: 'Shoot through',
    escalateLede: "This room's had a good run. Take it up a level.",
    escalateToSteering: 'Escalate to steering committee',
    escalateToCab: 'Escalate to CAB hearing',
    interjectCapLine: 'Pam: "Great point — let\'s parking-lot it. We\'re at time."'
  },
  OFFICE_IM_QUICK_REPLIES: [
    '👍',
    'per my last email',
    'parking lot',
    'pls advise',
    'circling back',
    'noted in your file',
    'works on my machine',
    'synergy?'
  ],
  OFFICE_CHROME_COPY: {
    doIt: 'Have a go',
    doSelected: 'Do selected',
    doItAll: 'Do the lot',
    desk: {
      hrProgress: 'Check me HR progression',
      hrProgressTitle: 'People Ops scorecard — levels, XP, and whatever Linda reckons of ya',
      pairAction: 'Pair up',
      pairActionTitle: 'They pull up a chair and stay til ya send em packin',
      outbox: 'Take it to the mailroom',
      codeDrawer: 'Spaghetti',
      codeDrawerShort: 'Spaghetti',
      codeDrawerClose: 'Close spaghetti',
      codeDrawerCloseShort: 'Close',
      codeDrawerTitle: 'Peek at the spaghetti code behind the drywall',
      onboardContractor: 'Onboard a contractor',
      onboardContractorTitle: 'Invite an external agent over MCP',
      standUp: 'Stand up and have a squiz',
      standUpShort: 'Stand up',
      standUpRole: 'Floor',
      standUpTitle: 'Leave ya screen for the floor — see the office you keep hearin',
      officeViewShortcut: 'Shift+O',
      sitDown: 'Back to ya screen',
      sitDownShort: 'Sit down',
      sitDownTitle: 'Sit down and get back to the deliverable',
      thinking: 'Open ya notebook',
      thinkingClose: 'Close ya notebook',
      thinkingLiveWorking: 'Still scribblin…',
      thinkingLiveTitle: 'Still scribblin under the lid · {status} — open ya notebook',
      thinkingLiveAria: 'Notebook still writin: {status}. Open to watch the run.',
      sectionSeat: 'Ya seat',
      sectionGetUp: 'Get up',
      sectionUnderDesk: 'Under the desk',
      ambienceAria: 'Office sound & focus',
      headphonesLabel: 'Headphones',
      headphonesOffTitle:
        'Headphones off — you hear the office. Voices out loud, room tone on, no subtitles.',
      headphonesOnTitle:
        'Headphones on — you read the office. Everyone goes quiet and their lines turn up as text.',
      focusTimeLabel: 'Focus',
      focusTimeTitle: 'Focus Time — nobody comes over at all, and the mob stops chiming in'
    },
    directory: {
      title: 'Meet the team',
      tourEyebrow: 'NEW HIRE ORIENTATION™',
      rosterEyebrow: 'CAST DIRECTORY',
      welcomeChapter: 'PEOPLE OPS',
      colleagueChapter: 'COLLEAGUE {current} OF {total}',
      unlockedLabel: '✨ CHARACTER UNLOCKED',
      tagline:
        "You're the newest architect on the floor. Linda will speed-run the cast — then dump you at your desk. Gilfoyle and Russ will find you later.",
      autoplayHint: 'Speaking…',
      rosterTagline:
        'Your Team (minus the ones who skip orientation) — tap ▶ if you actually want a full self-intro:',
      greeting: 'Welcome aboard, {name}.',
      greetingRole: 'Architect',
      expandLabel: '🏢 Meet the Team',
      expandTitle: 'Day One orientation — Linda from People Ops, Your Team, then the desk wizard.',
      startLabel: 'Meet the team →',
      beginLabel: 'Begin Day One',
      skipToBuildLabel: 'Skip to canvas →',
      skipToBuildTitle:
        'Close orientation and drop me on the canvas. No offence taken. (Some taken. Noted in your file.)',
      dismissLabel: 'Done',
      replayTourLabel: '↻ Replay intro',
      closeAria: 'Close Meet the Team',
      hearLabel: '▶ Hear intro',
      hearSpeakingLabel: 'Shh… they’re talking',
      hearTitle: 'Play this line in their actual voice — Google Cloud text-to-speech',
      transcriptLabel: 'Transcript',
      transcriptOnLabel: 'Hide text',
      transcriptTitle: 'Show spoken dialogue as text — for when you cannot listen',
      welcomeVoiceSpeakerId: 'hr',
      welcomeVoiceLine:
        "Welcome to the floor. I'm Linda, People Ops — badge photos, overdue trainings, and the smile that documents your sins. Speed round, because nobody survives five sequential self-intros: Dinesh will catch the bug and make damn sure you thank him. Erlich will ask if the diagram is courageous — say yes or he'll incubate your soul. Jared already filed a finding on your onboarding; he's sorry. Richard is quietly naming a pattern, bless him. Jack Barker is thrilled and has simplified this for the board. Gilfoyle and Russ skipped on purpose — they'll find you, and they will not be gentle. Keep moving.",
      welcomeClosingLine:
        "That's Day One. Your desk is that way — sit down, survive the little onboarding wizard, and pitch a deliverable before someone books a sync about syncing. Compliance is somehow already overdue, Craig's birthday card is still on the fridge, and if you reply-all about the stapler I will end you.",
      nameTag: {
        hello: 'HELLO',
        subtitle: 'my name is',
        placeholder: 'Newbie',
        editTitle: 'Type your name — the whole office will start using it',
        inputAria: 'Your name for the office'
      }
    },
    inbox: {
      mailAnnounce: 'You’ve got mail, mate!',
      mailAnnounceLang: 'en-AU',
      emptyLine: "Inbox zero. HR reckons that's suss. Enjoy it while it lasts.",
      selectEmailAria: 'Select email from {name} for a meeting',
      callMeeting: '📅 Hop on a call',
      callMeetingWithCount: '📅 Hop on a call ({count})',
      callMeetingTitle: 'Open a headset meeting about this mail — add or drop people first',
      callMeetingFromSelectionTitle: 'Headset call about the selected thread — pick who joins',
      callMeetingSelectTitle: 'Select emails for a topic, or open the roster cold',
      callMeetingDisabledTitle: 'Already in a meeting — leave that one first, mate',
      callMeetingAboutEmail: '📅 Hop on a call about this'
    },
    meetingPicker: {
      title: '📅 Have a meeting',
      titleHuddle: '📅 Pull someone in',
      topicPlaceholder: 'Optional agenda (they will ignore it either way)',
      topicAria: 'Meeting topic',
      modalityAria: 'Where this meeting happens',
      modalityPhysical: 'Room',
      modalityPhysicalTitle:
        'Stand everyone up and walk them into the meeting room — including you',
      modalityRemote: 'Headsets',
      modalityRemoteTitle: 'Everyone stays at their desk on a call — headsets visible on the floor',
      groupsAria: 'Quick groups',
      groupTeam: 'Your team',
      groupTeamTitle: 'Pull in the day-to-day collaborators',
      groupSteering: 'Steering',
      groupSteeringTitle: 'Pam + seniors + someone to present the diagram',
      groupFloor: 'The floor',
      groupFloorTitle: 'Yell across the open plan',
      groupSeniors: 'Leadership',
      groupSeniorsTitle: 'Book the people who ask what it costs',
      directoryAria: 'Who to invite',
      tierTeam: 'Your team',
      tierSenior: 'Leadership',
      tierOffice: 'The floor',
      facilitatorBadge: 'Facilitates',
      selectedCount: '{count} invited',
      selectedCountOne: '1 invited',
      maxHint: 'Room holds {max} — drop someone before adding more.',
      start: 'Start meeting',
      startPhysical: 'Book it',
      startRemote: 'Dial in',
      startHuddle: 'Start',
      cancel: 'Never mind',
      closeAria: 'Close meeting picker'
    },
    huddle: {
      sceneAria: 'Team huddle around your diagram',
      gathering: 'Everyone is wandering over…',
      speakingLabel: '{name} is talking',
      hardStop: 'Hard stop',
      hardStopTitle: 'Sorry — hard stop on the hour. Break it up.'
    },
    coffee: {
      kindLabel: 'Coffee run',
      inviteLine: 'Up for a coffee?',
      declineAria: 'No worries, {name}',
      accept: 'Smoko',
      decline: 'Flat out',
      sceneAria: 'Coffee break at the watercooler',
      sceneTitle: 'The watercooler',
      speakingLabel: '{name}…',
      done: "I've got a deploy"
    },
    battle: {
      inviteLine: '🥊 {a} and {b} are having a barney — "{topic}". The floor is watching.',
      inviteTagline: 'The floor is watching.',
      declineAria: 'Not my circus — walk away',
      dismissAria: 'Walk away from the holy war',
      accept: 'Grab popcorn',
      decline: 'Not my circus',
      sceneAria: 'Holy war on the floor',
      sceneTitle: 'Holy War',
      versus: 'vs',
      speakingLabel: '{name}…',
      getOut: 'Walk away from the holy war',
      settleLine: "You've heard both sides. Someone has to be wrong:",
      sideLabel: 'Back {name}',
      walkAway: 'Escalate to HR (shoot through)',
      verdictHead: 'The floor has ruled',
      done: 'Back to work'
    },
    meetingInvite: {
      organizerLabel: 'Organiser:',
      attendeesLabel: 'Attendees:',
      accept: 'Accept',
      decline: "Can't — I'm shipping",
      proposeNewTime: 'Propose new time'
    },
    floor: {
      eyebrow: 'ARCHISLOP CORP. · FLOOR 3',
      title: 'The floor, mate',
      subtitle: 'Open plan. They took the walls away for collaboration and kept all the meetings.',
      stageAria: 'Isometric view of the office floor',
      back: '🪑 Back to ya screen',
      backTitle: 'Sit down and get back to the deliverable',
      hint: 'Click the floor to walk. Click somebody to meet them, or double-click a colleague to walk over and have a word. Escape sits you back down.',
      narration: {
        atDesk: 'At ya own desk.',
        inMeeting: 'In the glass meeting room.',
        walkingTo: 'Walking over to {name}.',
        standingWith: 'Standing with {name}.',
        walkingToDesk: "Walking over to {name}'s desk.",
        standingAtDesk: "Standing at {name}'s desk.",
        walkingToProp: 'Walking over to {prop}.',
        standingAtProp: 'Standing at {prop}.',
        walkingHome: 'Walking back to ya desk.',
        walkingFloor: 'Walking across the floor.',
        standingFloor: 'Standing on the floor. Arrow keys step; Escape walks you back.',
        arriving: '{name} is walking over to ya desk.',
        leaving: '{name} is walking back to their desk.',
        inHuddle: 'Ya team is huddled around ya desk.',
        overhearing: '{name} and {partner} are having a chat nearby. You can join in.'
      },
      arrival: {
        eyebrow: 'ARCHISLOP CORP. · YA FIRST DAY',
        title: 'Welcome to the floor',
        subtitle: 'Somebody will be with you shortly. They will not.',
        skip: 'Skip the ceremony →',
        receptionEyebrow: 'RECEPTION',
        receptionBody:
          'Sign in, grab a lanyard, and try to look like you have done this before. Linda will speed-run the cast — then park you at ya desk for the onboarding wizard.',
        checkIn: 'Check in →',
        clockIn: '🪑 Clock in — take ya desk',
        clockInEarly: '🪑 Take my desk (I get the idea)',
        narration: {
          atReception: 'At reception. Sign in to begin.',
          welcome: 'Linda is welcoming you.',
          walkingToColleague: 'Walking over to {name}.',
          standingWithColleague: 'Standing with {name}.',
          colleagueIntroducing: '{name} at their desk.',
          walkingToDesk: 'Walking to ya desk.'
        }
      },
      close: 'Close',
      youName: 'You',
      youTitle: 'Architect — New Hire',
      youBlurb:
        'Ya desk. Ya deliverable. Ya monitor, which is the only one on this floor doing any work.',
      sitHere: '🪑 Sit down here',
      message: '💬 Message',
      messageTitle: 'Open Slop Chat™ with them',
      seniorNote: 'Not without a calendar invite.',
      teamNote: 'On ya team — brief them from the canvas.',
      away: {
        atLabel: '{who}, {prop}',
        atProp: 'Away from their desk: {prop}.',
        elsewhere: 'Away from their desk.'
      },
      talk: {
        eyebrow: 'HAVING A WORD',
        action: '💬 Go and talk',
        actionTitle: 'Walk over and say something — or double-click them',
        walking: 'Walking over. Rehearse the opener.',
        thinking: 'They are thinking of something to say…',
        placeholder: 'Say something…',
        send: 'Say it',
        youLabel: 'You',
        leave: '🪑 Back to my desk',
        leaveTitle: 'End the yarn and walk back to ya screen'
      },
      peek: {
        eyebrow: 'OVER THEIR SHOULDER',
        action: '👀 Their screen',
        actionTitle: 'Walk over and see what they are working on',
        walking: 'Walking over. Try to look like you need something.',
        back: '🪑 Back to my desk',
        backTitle: 'Walk back to ya own screen',
        looks: {
          terminal: 'A terminal. Green on black, scrollback to the horizon.',
          tabs: 'Forty tabs. One of them is the work.',
          spreadsheet: 'A spreadsheet. The tab is called FINAL_v7_actual.',
          slides: 'Slides. Slide four is titled “Slide 4”.',
          tickets: 'A ticket queue, sorted by how long it has been ignored.',
          calendar: 'A calendar. Solid colour, wall to wall.'
        }
      },
      props: {
        eyebrow: 'HANDS ON',
        walking: 'Heading over.',
        working: 'One moment…',
        blocked: 'Not right now — something else has ya attention.',
        back: '🪑 Back to my desk',
        backTitle: 'Walk back to ya own screen',
        look: '🔍 Look closer',
        lookTitle: 'Have a proper squiz',
        items: {
          coffeeMachine: {
            glyph: '☕',
            name: 'the coffee machine',
            note: 'Kitchen · descaled never',
            useLabel: 'Coffee machine — make one',
            useTitle: 'Walk over and make one',
            line: 'It grinds, it hisses, it produces something brown. Somebody will be along shortly to talk to you.',
            blocked: 'It is already making one for somebody. Wait ya turn.',
            details: [
              'A laminated sign: DESCALE ROTA. The last initial belongs to someone who left.',
              'Six mugs on the drainer. One says WORLD’S OKAYEST. It is everyone’s.',
              'The "clean me" light has been covered with a little square of gaffer tape.',
              'Gary’s label on the bean tin: PROPERTY OF FACILITIES. NOT A PERK.'
            ]
          },
          printer: {
            glyph: '🖨️',
            name: 'the printer',
            note: 'Reception · MFP-3 "SLOPMASTER"',
            useLabel: 'Printer — have a squiz',
            useTitle: 'Walk over and look at it',
            line: 'PC LOAD LETTER. Nobody on this floor has ever loaded letter. The queue says 41 jobs, all from 2023.',
            details: [
              'Taped to the lid: "OUT OF ORDER — Dave". Under it, older tape: "OUT OF ORDER — Dave".',
              'Top sheet in the output tray is a 60-page deck. Page one says DRAFT — DO NOT CIRCULATE.',
              'Someone has written the wifi password on the paper drawer. It is wrong, and it has been corrected twice.',
              'A sticky note: "if it beeps twice, walk away". It is beeping once.'
            ]
          },
          whiteboard: {
            glyph: '📋',
            name: 'the whiteboard',
            note: 'By the pod · DO NOT ERASE',
            useLabel: 'Whiteboard — read what is on it',
            useTitle: 'Walk over and read it',
            line: 'An architecture from two re-orgs ago, in permanent marker. Three boxes, one arrow, and the word SYNERGY underlined twice.',
            details: [
              'Bottom right, small: "this is the temporary one". Dated four years ago.',
              'A fourth box has been half-erased. You can still read the word BILLING.',
              'Someone has drawn a very good horse in the corner. Nobody has ever mentioned it.',
              'Under DO NOT ERASE, in different handwriting: "why". Under that: "ask Ulrich".'
            ],
            // Slice 16 — see the note on the default bundle. `line` above stays
            // the empty state.
            lineYours:
              'Somebody has wiped the old architecture. Yours is up there instead — {count} boxes in marker, already smudged where a sleeve went past.',
            detailsYours: [
              'The boxes read: {labels}. One of them has been starred. Nobody knows who did it, or which one they meant.',
              'An arrow has turned up that was not on ya version. It leaves a box and comes back to the same box.',
              'Underneath, in different handwriting: "who owns this". No arrow to say which one.',
              'SYNERGY has survived in the corner, underlined twice. It always does.'
            ]
          }
        }
      },
      interrupt: {
        gotIt: [
          'All yours.',
          'Was just off anyway.',
          'Done with {prop} — go for it.',
          'Yeah, go ahead.'
        ],
        gaveUp: [
          'Oh — you go.',
          'Didn’t need {prop} that bad.',
          'I’ll come back.',
          'You first. It’s fine. It’s all good.'
        ]
      },
      shopTalk: {
        coffeeMachine: [
          [
            'Is it s’posed to make that noise?',
            'It’s made that noise since March. Logged it twice. It’s load-bearing now.'
          ],
          [
            'We’re out of oat milk again.',
            'We had oat milk once. That was the trial. The trial didn’t get up.'
          ],
          ['Someone’s left a mug in the sink.', 'I know whose it is. I’m letting it develop.']
        ],
        printer: [
          [
            'It reckons PC LOAD LETTER. What’s that mean?',
            'Ticket #48314 raised. Category: printer. Status: awaiting user. Have you tried the other tray.'
          ],
          [
            'It’s printing everything sideways.',
            'That’s by design. Closed as WONTFIX. Please rate this interaction: 🔥'
          ],
          [
            'Did my thing come out?',
            'Your thing’s in the queue. The queue’s 212 documents. Most of them are the same document.'
          ]
        ],
        whiteboard: [
          [
            'Is anyone actually using this board?',
            'Don’t rub it out. Do NOT rub it out. Half of that’s still in prod.'
          ],
          [
            'What’s this arrow meant to mean?',
            'That arrow was here before me. Gave up asking in week two.'
          ],
          [
            'Should we just redo this properly?',
            'We already redid it properly. March. This is the properly one.'
          ]
        ]
      },
      join: {
        eyebrow: 'WITHIN EARSHOT',
        body: '{name} is over at {prop} with {partner}. Neither of them has clocked you.',
        action: '💬 Get amongst it',
        actionTitle: 'Wander over and say something — they won’t include you on their own'
      },
      meeting: {
        eyebrow: 'GLASS ROOM',
        eyebrowRemote: 'HEADSET SYNC',
        leave: '🚪 Leave',
        leaveTitle: 'Walk out mid-sentence. Pam will note it in the minutes.',
        sitOut: '🪑 My screen',
        sitOutTitle: 'Sit back down — the meeting keeps going without you in the room',
        endedLine: "That's a wrap. The minutes are on ya screen.",
        readMinutes: '🪑 Read the minutes',
        readMinutesTitle: 'Sit back down — the meeting hands the minutes to ya screen'
      },
      huddle: {
        eyebrow: 'TEAM HUDDLE',
        heading: 'Ya team, around ya desk',
        pairEyebrow: 'PAIRING',
        pairHeading: '{name}, in the chair next to ya'
      },
      zones: {
        reception: 'Reception',
        leadership: 'Leadership',
        kitchen: 'Kitchen',
        meeting: 'Meeting room',
        pod: 'Ya pod',
        hrCorner: 'People Ops'
      }
    },
    talk: {
      kindLabel: 'At your desk',
      placeholder: 'Sing out…',
      placeholderNamed: 'Have a word with {name}…',
      aria: 'Sing out — whoever is across from you answers',
      ariaNamed: 'Have a word with {name}',
      roomTitle: 'To the room — whoever is across from you picks it up',
      send: 'Sing out',
      sendTitle: 'Sing out. Nobody touches the canvas',
      sending: '…',
      pending: 'Somebody looks up…',
      pendingNamed: '{name} looks up…',
      dismissAria: 'Back to it',
      adopt: 'Do it',
      openThread: 'Open the thread',
      clearTargetTitle: 'Sing it out to the room instead',
      clearTargetAria: 'Stop having a word with {name}'
    },
    osTray: {
      aria: 'Open workstation windows',
      taskbarAria: 'Workstation taskbar',
      trayAria: 'Status tray',
      brand: 'ArchiSlop OS',
      tidy: 'Chuck it back',
      restore: 'Bring it back',
      tidyTitle: 'Shove every window back where it opened',
      presence: {
        aria: '{status}. Get up and have a look.',
        ariaChat: '{status}. Open Slop Chat.',
        ariaStay: '{status}.',
        title: 'Get up and have a look',
        titleChat: 'Open Slop Chat',
        titleStay: 'Already on your screen',
        overflow: '+{count}',
        pair: 'Pairing with {name}',
        mob: '{count} round your screen',
        walkby: '{name} is at your desk',
        battle: '{name} vs {other}',
        coffee: 'Cuppa break',
        meeting: '{name} is rounding everyone up',
        talk: '{name} is waiting on you',
        talkMany: '{count} waiting on you',
        quiet: 'Floor is dead quiet'
      }
    }
  }
};
