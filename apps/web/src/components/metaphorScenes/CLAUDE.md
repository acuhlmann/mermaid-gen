# metaphorScenes — read this first

The hard-won rules for everything in this directory live in one file:

**[`docs/agents/domains/metaphor3d.md`](../../../../../docs/agents/domains/metaphor3d.md)**

Read its **Short form** before changing anything here, and the matching **Full findings** entry
before changing the thing it names. Roughly 50 findings, every one of them from a screenshot of a
real render — camera framing, label declutter and rank, link legibility, group placards, theme
colour space, AO and fog, the fused composite, and the panel/safe-area contract with the app's own
chrome.

Two rules that catch every newcomer to this directory:

- **Verify by rendering, not by reading.** `apps/web/.claude/skills/verify/SKILL.md` is the
  headless-capture recipe. A change here is not done until it has been looked at.
- **Ask whether a mesh is the subject or scaffolding for the subject.** Shadow catchers, ground
  discs, water planes and ambience all carry `FRAME_IGNORE_DATA` so the camera does not frame
  them. A new mesh that is not the subject needs that flag.

The same content reaches Cursor through `.cursor/rules/metaphor3d.mdc` and every other agent
through the index table in the root `AGENTS.md`. Add findings to the domain file, once — not back
into the root files.
