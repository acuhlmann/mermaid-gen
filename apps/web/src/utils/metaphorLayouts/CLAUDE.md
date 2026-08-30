# metaphorLayouts — read this first

These modules place items in world space; what they place is then framed, labelled and
decluttered by `apps/web/src/components/metaphorScenes/`. The rules for both live in one file:

**[`docs/agents/domains/metaphor3d.md`](../../../../../docs/agents/domains/metaphor3d.md)**

Layout-specific traps recorded there, worth knowing before you touch a layout:

- **A subway is lanes, not spokes and not chords.** Two earlier models both died on the
  interchange, which is the only thing the kind exists for.
- **A group's name must not be drawn where its own members stand,** and no lateral answer can fix
  that — a tower is about as wide as the shoulder is long. Groups carry `labelLift`.
- **A grouping colour is an ordinal, never a hash.** A uniform draw over eight slots gave a
  three-group world two identical colours about a third of the time.
- **Adding a metaphor kind touches ten places**, one of which is a layout. The list is in the
  domain file; the build fails without `KIND_ITEM_FIELDS`.

The same content reaches Cursor through `.cursor/rules/metaphor3d.mdc` and every other agent
through the index table in the root `AGENTS.md`. Add findings to the domain file, once.
