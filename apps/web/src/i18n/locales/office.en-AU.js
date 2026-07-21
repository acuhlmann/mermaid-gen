/**
 * Aussie slang overrides for the office-parody copy (docs/office-parody.md).
 * Template arrays replace the English bank wholesale (deepMergeLocale), so
 * ids, colleagueIds, and `{label}` / `{userTitle}` slots must stay aligned
 * with officeCast.js — the seen-template memory is shared across locales.
 */
export const OFFICE_EN_AU = {
  OFFICE_COLLEAGUES: {
    intern: {
      blurb: 'Replies-all. Equity in vibes. Accidentally asks the only good question in the room.',
      introLine:
        "Hey!! I'm Chad — unpaid, strategic, and statistically likely to reply-all about the stapler. Quick question about your diagram that might accidentally be the smartest thing anyone says today. Also: where is the stapler."
    },
    scrumMaster: {
      blurb:
        'Everything is a ceremony. Will time-box your smoko. Facilitates your existential dread.',
      introLine:
        "G'day! I'm Pam — CSM, CSPO, SAFe 6.0, and emotionally fluent in parking lots. This introduction is time-boxed for forty-five seconds of synergy. Great energy. Let's circle back."
    },
    helpdesk: {
      blurb: 'Closes tickets as duplicates of themselves. Works on his machine. DNS was involved.',
      introLine:
        'Ticket Bot Dave. Tier 1 of 1. I close tickets as duplicates of themselves. Have you tried turning it off and on again. That was not a question. Works on my machine.'
    },
    facilities: {
      blurb: 'ALL-CAPS fridge cleanouts. Thermostat locked at 20.5°C. Architecture is perishable.',
      introLine:
        'I AM GARY. I OWN THE FRIDGE. I OWN THE THERMOSTAT. Unlabelled containers — and unlabelled architecture diagrams — become FACILITIES PROPERTY. You have been warned. Warmly.'
    },
    hr: {
      blurb:
        'Weaponised cheerfulness. Training overdue since onboarding. Please sign Craig’s card.',
      introLine:
        "I'm Linda, People Ops. Your badge photo is processing, your compliance training is somehow already overdue, and Craig's birthday card still needs a warm generic message. You are going to fit in beautifully."
    },
    greybeard: {
      blurb: '“We tried that in 2009.” Maintains the mainframe. The mainframe maintains him.',
      introLine:
        'Ulrich. Staff Engineer Emeritus. We tried that in 2009. It ran on cron and fear. I maintain the mainframe nobody admits exists. The mainframe asked about you. I told it you were diagramming.'
    },
    ciso: {
      blurb: "Everything's an attack surface — especially the arrows. Trust is a vulnerability.",
      introLine:
        'Sasha. CISO. Department of No. Everything is an attack surface — especially you, the arrows, and that temporary admin password from 2017. Noted in your file. I mean it warmly.'
    }
  },
  OFFICE_WELCOME_EMAIL: {
    id: 'welcome-email-hr',
    colleagueId: 'hr',
    subject: 'Welcome aboard, {userTitle}! 🎉 (badge photo: pending)',
    body: 'Welcome to the floor! Stoked to have you. A few names before your mandatory orientation (rescheduled, TBD):\n\n📅 Pam (Agile Coach) runs the meetings. All of them.\n🧃 Chad (our intern) will IM you shortly. He means well.\n🖥️ Ticket Bot Dave is IT. Do not reply, do not call, do not.\n🧹 Gary owns the fridge and the thermostat. Respect both.\n🧓 Ulrich has seen your architecture before. In 2009.\n🔐 Sasha (our CISO) already reckons you’re suss. It’s a compliment.\n\nAnd I’m Linda — People Ops! Your compliance training is already overdue, which is honestly a record. The inbox 📥, Focus Time, and Office noise toggles live in the corner whenever you need us quieter.\n\nWarmly,\nLinda'
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
      body: 'Finance flagged a resource called "{label}". Please confirm it is (a) essential, and (b) free. If it can\'t be both, see (b).\n\nThe budget is a no,\nDiane'
    },
    {
      id: 'email-cto-conference',
      colleagueId: 'cto',
      subject: 'Saw this exact thing at a keynote (thoughts?)',
      body: 'Just back from VisionaryConf. There was a slide almost identical to your {label} — except theirs pulsed and had an AI halo. Can ours pulse? Loop in whoever owns pulsing.\n\nOnwards,\nMarcus',
      actionPrompt: 'Add a bold visionary element that makes the diagram feel futuristic'
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
  ],
  OFFICE_BATTLE_SCENES: [
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
    }
  ],
  OFFICE_MEETING_COPY: {
    inviteFallbackTitle: 'Architecture Review Board (steering)',
    inviteFallbackBody:
      'The big bosses want a squiz at the current diagram. Agenda: the headline, the cost, the risk. Your team presents; the seniors have questions. Snacks: nah.',
    joiningLine: 'Waiting for the organiser to let you in…',
    cancelledSubject: 'CANCELLED: Architecture Review Board',
    cancelledBody:
      "Meeting's off — leadership is double-booked. Rescheduled to: never. Action items remain your problem.\n\nPam",
    proposeNewTimeGag: 'New time proposed. The organiser has knocked back your proposed time.',
    minutesTitle: 'Meeting minutes',
    raiseHandPlaceholder: 'Say something to the room…',
    leaveLabel: 'Shoot through',
    interjectCapLine: 'Pam: "Great point — let\'s parking-lot it. We\'re at time."'
  },
  OFFICE_IM_QUICK_REPLIES: [
    '👍',
    'in a meeting',
    'circling back arvo',
    'parking lot it',
    'noted in me file'
  ],
  OFFICE_CHROME_COPY: {
    doIt: 'Have a go',
    desk: {
      hrProgress: 'Check me HR progression',
      hrProgressTitle: 'People Ops scorecard — levels, XP, and whatever Linda reckons of ya',
      outbox: 'Ship from the Outbox',
      codeDrawer: 'Open the code drawer',
      codeDrawerClose: 'Close the code drawer',
      codeDrawerTitle: 'Peek at the diagram source',
      onboardContractor: 'Onboard a contractor',
      onboardContractorTitle: 'Invite an external agent over MCP',
      thinking: 'Open ya notebook',
      thinkingClose: 'Close ya notebook',
      sectionSeat: 'Ya seat',
      sectionGetUp: 'Get up',
      sectionUnderDesk: 'Under the desk'
    },
    directory: {
      title: 'Meet the team',
      tourEyebrow: 'NEW HIRE ORIENTATION™',
      rosterEyebrow: 'CAST DIRECTORY',
      welcomeChapter: 'PEOPLE OPS',
      colleagueChapter: 'COLLEAGUE {current} OF {total}',
      unlockedLabel: '✨ CHARACTER UNLOCKED',
      tagline: 'Your new floor. Your new colleagues. Their opinions come free of charge.',
      autoplayHint: 'Speaking…',
      rosterTagline:
        'The cast that emails, IMs, and walks by while you work — tap ▶ to hear an intro:',
      greeting: 'Welcome aboard, {name}.',
      greetingRole: 'Architect',
      expandLabel: '🏢 Meet the Office',
      expandTitle: 'Who keeps interrupting me? (Spoiler: all of them.)',
      startLabel: 'Meet the team →',
      skipToBuildLabel: 'Skip the ceremony — just let me ship →',
      skipToBuildTitle:
        'Close orientation and drop me on the canvas. No offence taken. (Some taken. Noted in your file.)',
      dismissLabel: 'Clock on — begin Day One',
      replayTourLabel: '↻ Replay intro',
      closeAria: 'Close Meet the Office',
      hearLabel: '▶ Hear intro',
      hearSpeakingLabel: 'Shh… they’re talking',
      hearTitle: 'Play this line in their actual voice — Google Cloud text-to-speech',
      transcriptLabel: 'Transcript',
      transcriptOnLabel: 'Hide text',
      transcriptTitle: 'Show spoken dialogue as text — for when you cannot listen',
      welcomeVoiceSpeakerId: 'hr',
      welcomeVoiceLine:
        "Welcome to the floor. I'm Linda, from People Ops. Pick up your badge, type your name, and I'll introduce the team. You are going to fit in beautifully.",
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
      togglesAria: 'Inbox ambience controls',
      soundscapeLabel: 'Noise',
      soundscapeTitle:
        'Ambient office racket — keyboards, mouse clicks, paper, squeaky chairs, the printer, the phone, the coffee machine, the vending machine, the lift',
      narrationLabel: 'Narration',
      narrationTitle:
        'Speak walk-bys, meetings, cubicle battles, and coffee chat aloud — emails and IMs stay silent',
      emptyLine: "Inbox zero. HR reckons that's suss. Enjoy it while it lasts.",
      callMeetingDisabledTitle: 'Draw something first — even this meeting needs an agenda, mate'
    },
    coffee: {
      inviteLine: 'Coffee break? {name} is holding court at the machine.',
      accept: 'Smoko',
      decline: 'Flat out',
      sceneAria: 'Coffee break',
      sceneTitle: 'The Watercooler',
      done: "I've got a deploy"
    },
    battle: {
      inviteLine: '🥊 {a} and {b} are having a barney — "{topic}". The floor is watching.',
      accept: 'Grab popcorn',
      decline: 'Not my circus',
      sceneAria: 'Cubicle battle',
      sceneTitle: 'Cubicle Battle',
      versus: 'vs',
      getOut: 'Get out of Cubicle Battle',
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
    }
  }
};
