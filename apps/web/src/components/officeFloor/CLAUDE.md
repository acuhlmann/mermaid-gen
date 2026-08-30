# officeFloor — read this first

The rules for the isometric floor, the desk frame, the cast and office moments live in one file:

**[`docs/agents/domains/office.md`](../../../../../docs/agents/domains/office.md)**

Read its **Short form** before changing anything here. Four things bite immediately:

- **Any test that _mounts_ inherits two globals it never names** — the wall clock and
  `Math.random`. Pin both (`vi.setSystemTime(new Date(2026, 7, 11, 12, 0, 0))` and
  `vi.spyOn(Math, 'random').mockReturnValue(0.75)`), or the suite passes standalone and fails in
  file order, or passes for 16 hours a day and fails for the other 8. Neither failure mentions
  time or randomness; both read as a broken assertion about the feature under test.
- **Exactly one surface may draw a person** (§ 6 rule 5). `settledIds` is the hand-off between
  the commute machine and whatever scene owns the cast.
- **What somebody is doing is derived once**, in `floorActivityFor` — call ▸ Headphones posture ▸
  coffee ▸ trait row ▸ the hour. Do not compose it at a use site.
- **Ambient traffic is silent.** A wanderer with something to say is a walk-by, and that lives in
  the moment store. `goHome({ byYou })` is the whole gate.

The floor test map is [`docs/agents/isometric-floor-tests.md`](../../../../../docs/agents/isometric-floor-tests.md);
`npm run test:floor` runs it.

The same content reaches Cursor through `.cursor/rules/office.mdc` and every other agent through
the index table in the root `AGENTS.md`. Add findings to the domain file, once.
