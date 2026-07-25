# Plan: Jack Barker takes the VP's seat (retire `exec`), recipe doc updated with future casting

## Goal

- **Jack Barker (`barker`) joins the team as the 6th radial advisor**, replacing The VP — SVP of
  Synergy & Co-Design (`exec`). Same seat, same behavior: the subtractive "simplify for the board"
  transform mode + advisor suggestions, now in Barker's fidelity-tuned voice.
- Barker keeps the exact arrangement the VP had (user-confirmed): senior-tier, **not** in the
  proactive advisor roundtable; speaks when summoned (radial, hotkey, mascot), plus steering
  meetings and his rare senior emails.
- Update `docs/recipes/replicate-tv-character.md`: Barker ✅ team seat; future casting recorded —
  Richard → refine (engineer), Erlich → innovate (Chief Innovation Officer), Russ → goMad,
  Jared Dunn → critique (auditor). Gilfoyle/Dinesh stay office-tier candidates; `explain` seat
  unassigned in the endgame.
- Scope: **Barker only** (user-confirmed). No other character replication in this change.

## Approach: rename `exec` → `barker` everywhere (character id inherits the seat)

The `exec` id is retired; `barker` takes over its function. Behavior specs (transform-mode
constraints, node caps, comment ratios, temperatures) are preserved verbatim — only the persona
copy is rewritten in Barker's voice (anchored on the shipped, fidelity-tuned voice card in
`SENIOR_MEETING_VOICES.barker`). The `exec`→`barker` rename also covers the wire enum
(`TransformModeSchema`); producer and consumer change in the same commit per AGENTS.md. No stored
state orphans: exec never landed in gamification storage (`runGamificationStore.js:31` excludes
him), and insight/retry state is in-memory per session.

Persona voice sources of truth for the rewrite (do not invent catchphrases — recipe §2):
Conjoined Triangles of Success, "I've taken the liberty…", "I don't know about you, but I am
excited", "We're a family here", synergy-as-religion, board optics over substance, serene
patronizing warmth, max one Barker-ism per few lines.

## Step 1 — shared package (`packages/shared`)

- `src/diagramSchema.ts:164` — `TransformModeSchema`: `'exec'` → `'barker'`.
- `src/mermaidTransformPolicy.ts:3,46-57` — mode set + exec policy branch → `barker` (keep the
  node-cap logic; rename the `EXEC_MAX_NODES` const accordingly).
- `src/infographicTransformPolicy.ts:3,72-79` — same rename.
- `src/officeVoice.ts:27` — drop `'exec'` from `OFFICE_SPEAKER_IDS` (`'barker'` already present).
- `npm run build -w packages/shared` (server/web consume `dist/`).

## Step 2 — server (`apps/server`)

- `src/agents/advisorPrompts.js` — `ADVISOR_PERSONAS.exec` → `barker`: keep the skeleton
  (temperature 0.6; subtractive-only suggestions — merge/kill/ladder-up; ~1 in 5 deliberately too
  far; ~1 in 3 pure comment) rewritten as Jack Barker: he's THRILLED, takes the liberty of boiling
  it down, frames every merge as the Conjoined Triangles in action, prose in measured boardroom
  warmth. Update the "VP =" persona mentions in `INFOGRAPHIC_ADVISOR_APPENDIX` (:45) and
  `CHART_ADVISOR_APPENDIX` (:54) to Barker.
- `src/agents/mermaidAnalysisPrompts.js` — `TRANSFORM_MODE_MODEL` (:16) and `TRANSFORM_MODES`
  (:19): `exec` → `barker` (temp 0.35 kept). The "Transform mode: EXEC" branch (:340-348) →
  "Transform mode: BARKER" — identical constraints (same diagram type, subtractive only, 4–8
  nodes typical, 1-in-5 collapse to 2–3 boxes, ≤1 subgraph, keep styling, executive-summary
  labels), prose voice swapped to Barker aphorisms ("Three boxes. The Conjoined Triangles
  approve.").
- `src/agents/officePersonas.js` — remove the `exec` line from `STAKEHOLDER_MEETING_VOICES` (:115);
  move Barker's full voice card from `SENIOR_MEETING_VOICES` (:142-157) into
  `STAKEHOLDER_MEETING_VOICES` (leaves `SENIOR_MEETING_VOICES` = cto/cfo; `isOfficeSpeaker`,
  `speakerVoice`, `speakerLabel`, `normalizeAttendees` all table-driven — no logic change).
  Update the meeting-rules line "Senior attendees (the VP, CISO, CTO, CFO)…" (:392) to name
  Jack Barker, and the header comments (:98-125).
- `src/agents/planBeatMessages.ts:92-93` — `case 'exec'` → `case 'barker'`; copy → Barker flavor
  ("Taking the liberty of boiling it down…").
- Transform instruction maps — `exec` key → `barker` (copy Barker-flavored):
  `src/agents/anythingLangChainAgent.js:95,101`, `chartLangChainAgent.js:109`,
  `formsLangChainAgent.js:111`, `metaphorLangChainAgent.js:94`,
  `infographicLangChainAgent.js:92,641`, `infographicTransformPrompts.js:34,55`.
- `src/agents/officeTts.js` — remove the `exec` rows from all 7 voice tables
  (:71,89,122,155,189,207,238); Barker's rows stay untouched.
- `src/routes/advisor.js` — no change (validation is `isAdvisorPersona` table lookup).

## Step 3 — web client (`apps/web`)

Persona copy & gamification:

- `src/utils/slopitectCopy.js` — rename the `exec` key → `barker` in `VARIANT_PERSONAS` (:88;
  name `Jack Barker`, title `CEO — Success Theater`, avatarEmoji `🧘`, accentColorVar `#ca8a04`,
  xp 30/6; Barker tagline/entry/exit lines), `VARIANT_QUOTES` (:187; Barker-isms), all 14
  `PHASE_CEREMONIES` rows (:290-411), `VARIANT_TAGLINES` (:432), `VARIANT_BOOT_HEADLINES` (:442),
  `VARIANT_MASTERY_ACHIEVEMENTS` (:589; new id e.g. `conjoinedTriangles`, `🧘` title — safe to
  rename, exec's was unreachable in storage). Update the `IDLE_TIPS` VP line (:458) and the
  Co-Design `PROMPT_EASTER_EGGS` toast (:689) to Barker.
- `src/state/runGamificationStore.js:31` — add `'barker'` to `VARIANTS` (6th seat now earns XP;
  exec never did — dead award fixed, not orphaned).
- `src/utils/officeCast.js` — `MEETING_SENIOR_POOL` (:202) drops `'exec'`; remove the
  `email-exec-board-preread` canned senior email (:519-520); Barker's two emails stay. Header
  comments (:134-140) updated.
- `src/utils/castTiers.js` — senior: `['ciso','cto','cfo','barker']`; refresh the tier comment
  (the advisor cast minus the CEO).

Radial menu, hotkey, ceremony:

- `src/components/buildRadialActions.jsx:118-125` — action id/variant `exec` → `barker`; label
  `a.prepForVp ?? a.coDesign` → `a.prepForCeo ?? a.coDesign`.
- `src/hooks/useDiagramHotkeys.js:9` — `x: 'exec'` → `b: 'barker'` (`b` is free; mnemonic).
- `src/components/HotkeyOverlay.jsx:16` — `{ keys: ['X']… }` → `['B']`, `copy.exec` → `copy.barker`.
- `src/features/prompt/useRadialActionHandler.js:78,92` — `exec` → `barker` (no boot chime, same
  as exec today).
- `src/hooks/useAnalyzeFlow.js:83` — title-label map `exec` → `barker`.
- `src/hooks/useAdvisorOrchestrator.js:13-18` — `ADVISOR_ORDER` still excludes the seat; update
  the comment (Barker stays senior-tier, summoned only).
- `src/features/ceremony/useRunCeremony.js:171,192` — exec confetti palette → Barker gold
  (`#ca8a04`); `knownVariants` swap.
- `src/features/desk/DeskBottomActionsSlot.jsx:37-41` — mascot roster row variant → `barker`
  (`senior: true` stays, still under the "Upstairs" divider).

Insights / display:

- `src/components/StakeholdersMascot.jsx:24,33,37`, `AdvisorSpeechBubble.jsx:20`,
  `InsightsPane.jsx:66,196-205` — `exec` class/id entries → `barker` (`is-barker`,
  `is-variant-barker`).
- `src/components/insightsPaneEntryUi.js:38-48` — `hidePhaseIds` swap.
- `src/components/PlanBeatCard.tsx:19` — exec emoji `📊` → barker `🧘`.
- `src/utils/insightNowStatus.js:77` + `src/utils/insightStatusLocale.js:28-29` —
  `simplifyingExec` → `simplifyingBarker` (+ locale keys).
- `src/utils/advisorAcceptRouting.js:2`, `src/utils/insightRetryDescriptor.js:2` — mode/variant
  lists `exec` → `barker`.
- `src/components/personaFaces/registry.js:95-103` — remove the exec face row (Barker's stays).
- `src/utils/officeFloorPlan.js:160` — remove exec's leadership desk at (7,0); shrink the
  leadership zone rect back if `officeFloorPlan.test.js` allows.
- `src/utils/officeNarration.js:51`, `src/utils/officeDeskWork.js:71` — remove exec rows.
- `src/App.css:1020,7380-7381,10773,10861` — `.is-exec` / `.is-variant-exec` rules renamed to
  barker with the `#ca8a04` accent.

i18n (key parity guarded by `uiLocale.test.js`):

- `controls.{en,en-AU,zh-CN,zh-TW}.js` — `prepForVp`/`prepForVpTitle` → `prepForCeo`/
  `prepForCeoTitle` (zh translated); `hotkeys.exec` label → `hotkeys.barker`; any
  `stakeholders.align` exec mapping.
- `slopitect.{en-AU,zh-CN,zh-TW}.js` — `exec` persona block → `barker` (name stays Latin per
  office-locale convention; title/tagline/entry/exit translated in zh).
- `slopitectGamification.{en-AU,zh-CN,zh-TW}.js` — exec blocks → `barker` (mastery achievement,
  quotes, phase rows).
- `office.{en-AU,zh-CN,zh-TW}.js` — remove `email-exec-board-preread`
  (en-AU:189-193, zh-CN:212-213, zh-TW:212-213). Barker sections untouched.

## Step 4 — fidelity harness (`scripts/barker-fidelity.mjs`)

- `ATTENDEES` (:67): replace `'exec'` with `'cto'`.
- Extend the script with an **advisor-suggestion probe**: run 2–3 suggestions through
  `buildAdvisorSystemPrompt('barker', …)` against a sample diagram and LLM-judge them with the
  same rubric (this is the new copy surface; meetings/email already covered).
- Run `node scripts/barker-fidelity.mjs` if an LLM key resolves in `.env` (few cents per run);
  iterate the new advisor/transform copy until ≥4/5 sustained over two runs, per recipe §3.

## Step 5 — tests (mechanical `exec`→`barker` + assertion updates)

- Server: `test/advisorPrompts.test.js:96` (dumb-mode), `test/officePersonas.test.js`
  (`isOfficeSpeaker('barker')`, attendee normalization, registry blocks), `test/officeRoute.test.js`
  (attendee fixtures), `test/mermaidLangChainAgent.test.js` (mode options), `test/mermaidSanitizer.test.js`,
  `test/anythingLangChainAgent.test.js:21` (mode list), `test/officeTts.test.js` (drift guard).
- Web: `test/slopitectCopy.test.js`, `test/uiLocale.test.js` (six-variant coverage now incl
  `barker`; mastery keys), `test/castTiers.test.js`, `test/advisorAcceptRouting.test.js`,
  `test/insightRetryDescriptor.test.js`, `test/useDiagramHotkeys.test.jsx` (`['b','barker']`),
  `test/useAdvisorOrchestrator.test.js` (forced-persona fixtures), `test/StakeholdersMascot.test.jsx`,
  `test/StakeholderCastStrip.test.jsx`, `test/AdvisorSpeechBubble.test.jsx`, `test/planBeatCard.test.jsx`,
  `test/runTimelineModel.test.ts`, `test/topicStarters.test.jsx`, `test/officeComponents.test.jsx`,
  `test/officeMomentStore.test.js`, `test/useMeetingPlayback.test.jsx`, `test/useOfficeAmbience.test.jsx`,
  `test/personaFaces.test.jsx`, `test/officeFloorPlan.test.js`, `test/officeNarration.test.js`.

## Step 6 — docs

- `docs/recipes/replicate-tv-character.md` — rewrite: status board (Barker ✅ team seat, 6th
  advisor; Richard → refine, Erlich → innovate, Russ → goMad, Jared → critique marked future;
  Gilfoyle/Dinesh office pair; `explain` seat unassigned/TBD); the method gains a **"seat
  inheritance" drill** section (this change as the template: retire the generic id, character id
  takes the seat, behavior spec travels, wire enum renames with it); Endgame section replaced by
  the direct-replacement pattern (the seat-skin split is superseded by the user's call); the
  "user is basically Richard" note updated (Richard-as-refine is now the plan — the seat is the
  user's anxious-builder alter ego).
- `docs/office-parody.md` — senior table: remove the `exec` row (:62); Barker row updated (now
  also the 6th advisor / team seat); "Barker experiment" note extended (seat inheritance shipped).
- `GLOSSARY.md:115` — cast-tiers `exec` entry → `barker`; `:77` acting example name updated.
- `docs/guide/agents.md:51,63,78,86` + `docs/guide/api-endpoints.md:10` — transform-mode lists
  gain `barker` (the simplifying mode; exec was undocumented).
- `CLAUDE.md:51` — "Refine/Exec/Fix" → Barker. `docs/multi-human-office.md:73` — "The VP — played
  by Sam" example updated.

## Step 7 — verification (in order)

1. `npm run build -w packages/shared && npm run test -w packages/shared`
2. `npm run typecheck -w apps/server && npm run test -w apps/server`
3. `npm run typecheck -w apps/web && npm run test -w apps/web`
4. `npm run precommit` — must exit 0 (format + check:affected: boundaries, doc-paths, affected tests)
5. `node scripts/barker-fidelity.mjs` — ≥4/5 ×2 runs if LLM key present; scores in the final report
6. Live smoke: `npm run dev` → radial menu shows Jack Barker 🧘; `b` hotkey triggers the Barker
   transform on a diagram (verifiably simpler result); Call-a-meeting seats Barker; mascot
   "Upstairs" row runs him.
