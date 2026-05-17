---
description: Generate activity/workflow diagrams for business processes and logic flows
argument-hint: [description]
allowed-tools: Read, Bash, Write, Edit
---

# /mermaid-activity

User request: "$ARGUMENTS"

## Task

Generate a Mermaid activity diagram (flowchart) for the described workflow or improve an existing diagram. If the
user asks for the flow of code or a script, base the diagram strictly on the source (no inferred steps).

## Process

1. **Resolve Plugin Path**: Run once before any file reads:

   ```bash
   find "$HOME/.claude/plugins/cache" -type d -name "mermaid" -path "*/skills/mermaid" 2>/dev/null | head -1
   ```

   If empty, run fallback (for dev/repo usage):

   ```bash
   find "$HOME" -maxdepth 8 -type d -name "mermaid" -path "*/skills/mermaid" 2>/dev/null | head -1
   ```

   Use the returned path as `PLUGIN_DIR` in all steps below.
2. **Load Reference**: Read `PLUGIN_DIR/references/guides/diagrams/activity-diagrams.md` for patterns and syntax
3. **Identify Components**: Extract start point, process steps, decisions, error paths, end points
4. **Generate Diagram**:
   - Use flowchart syntax with theme-first styling
   - Do not add hardcoded `classDef fill/stroke/color` unless user explicitly requests custom colors
   - Apply Unicode symbols: ⚙️ process, ✅ success, ❌ error, 🔄 retry, 💾 data, 📨 notification
   - Include error handling paths (not just happy path)
   - Use subgraphs for complex sub-processes
   - Apply link types: `-->` standard, `==>` emphasized, `-.->` optional/async, `x--x` error
5. **Validate**:
   - If output is Markdown with ` ```mermaid ` blocks, use:
     `node "$PLUGIN_DIR/scripts/extract_mermaid.js" {file} --validate`
   - If output is a standalone `.mmd`, skip `extract_mermaid.js` and do a manual syntax check
   - Manual check: reserved words quoted, `-->` arrows, `end` keywords
   - Fix errors using `PLUGIN_DIR/references/guides/troubleshooting.md`
6. **Save**:
   - New diagrams: `activity-{description}-{timestamp}.mmd`
   - Edited diagrams: Update existing file

## Optional Config

If `.claude/mermaid.json` exists, apply defaults:

- `theme`
- `auto_validate`
- `output_directory`

## Output

```mermaid
{complete diagram with theme-safe styling}
```

**Saved to:** {filename}
**Validation:** ✅ passed
**Elements:** {X} steps, {Y} decisions, {Z} error paths

<example>
User: "Create an activity diagram for onboarding approvals"
Assistant: "Generates a flowchart with start/end, decisions, error paths, and theme-safe defaults."
</example>

## Reference

- Patterns: `PLUGIN_DIR/references/guides/diagrams/activity-diagrams.md`
- Styling: `PLUGIN_DIR/references/guides/styling-guide.md`
- Common mistakes: `PLUGIN_DIR/references/guides/common-mistakes.md`
- Troubleshooting: `PLUGIN_DIR/references/guides/troubleshooting.md`
