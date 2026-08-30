# state — read this first

Most of this directory is ordinary store code. The office slices are not: `officeMomentStore.js`,
`officeLogStore.js`, `officeWorkingMemoryStore.js`, `officeMessengerUiStore.js`,
`officeViewModeStore.js` and `deskSlotStore.js` carry rules that are easy to undo by accident.

**[`docs/agents/domains/office.md`](../../../../docs/agents/domains/office.md)**

The two that govern all the others:

- **Record, never trigger.** The log, working memory and the errand all _record_. Writers hook the
  funnels that already exist (`onOfficeEvent`, the push mutators, the adopt handler) — do not add
  an observer to feed one. Making any of them schedule or fire something is auto-fix-on-idle in a
  new hat, which ADR-0010 consequence #4 rules out.
- **A moment is presentation-agnostic** (ADR-0011 rule 1). The desk overlay is renderer #1 and the
  isometric floor is renderer #2; state that only one of them can use is in the wrong place.

Two specific traps: `setOfficeHeadphones` is a **macro** that writes `narration`/`soundscape`/
`captions` — read those three, never `headphones`, from a consumer. And `hasActiveOfficeSurface`
gates the ambient director, so anything counted there without an expiry holds the whole office
silent for the rest of the session.

`docs/agents/domains/office.md` reaches Cursor through `.cursor/rules/office.mdc` and every other
agent through the root `AGENTS.md` index. Add findings there, once.
