# Matt Pocock Skills - Cross-Platform Usage Guide

This directory contains Matt Pocock's engineering skills, now committed to the repository for use across all platforms and machines.

## What's Included

- **Engineering Skills**: Code review, TDD, debugging, domain modeling, prototyping, research, and more
- **Productivity Skills**: Grilling, teaching, handoff, questionnaire generation
- **Misc Skills**: Git guardrails, pre-commit setup, scaffolding exercises
- **In-Progress Skills**: Experimental skills under development

Each skill includes:

- `SKILL.md` - Main skill documentation
- `agents/openai.yaml` - OpenAI-compatible agent configuration
- Supporting docs and templates

## Platform-Specific Usage

### 1. Cursor (Local & Cloud Agents)

**Local Cursor:**
Skills are automatically available when committed to `.claude/skills/mattpocock/`. Cursor reads them from the repo.

**Cursor Cloud Agents:**
Once committed and pushed, cloud agents automatically have access to these skills. No additional setup needed.

**Usage:**

```
/reference .claude/skills/mattpocock/engineering/code-review/SKILL.md
```

Or invoke directly:

```
Review this code using the code-review skill
```

### 2. Claude Web (claude.ai)

Claude Web doesn't automatically read from `.claude/skills/`, so you need to manually provide the skill content.

**Method 1: Copy-Paste**

1. Open the desired `SKILL.md` file
2. Copy its contents
3. Paste into your Claude conversation with your request

**Method 2: Project Knowledge (if available)**
If Claude Web adds project knowledge features, upload the skill files there.

**Example prompt:**

```
[Paste SKILL.md content]

Now apply this skill to review the following code:
[your code]
```

### 3. Kimi & Qwen via MonkeyCode (https://monkeycode-ai.net/)

These models can use the skills when you provide them explicitly.

**Method 1: Direct Reference**

1. Read the `SKILL.md` file locally
2. Paste the content into your Kimi/Qwen conversation
3. Add your task/request

**Method 2: OpenAI YAML Config**
The `agents/openai.yaml` files are compatible with OpenAI's agent format. If MonkeyCode supports custom agent configs:

1. Upload the relevant `openai.yaml` file
2. Reference it in your conversation

**Example for Kimi:**

```
I want to use this skill:

[Paste SKILL.md content]

Now help me with: [your task]
```

## Skill Categories

### Engineering (Production-Ready)

- **code-review** - Systematic code review with multiple lenses
- **tdd** - Test-driven development workflow
- **diagnosing-bugs** - Structured bug diagnosis
- **domain-modeling** - DDD and domain analysis
- **prototype** - Quick prototype validation
- **research** - Deep research methodology
- **implement** - Feature implementation patterns
- **resolving-merge-conflicts** - Git conflict resolution

### Productivity

- **grilling** - Stress-test ideas and decisions
- **teach** - Learn concepts deeply
- **handoff** - Clean context transfer
- **to-questionnaire** - Convert docs to questions

### Misc

- **git-guardrails-claude-code** - Prevent dangerous git operations
- **setup-pre-commit** - Pre-commit hook setup
- **scaffold-exercises** - Create practice exercises

## Updating Skills

To update to a newer version of Matt Pocock's skills:

```bash
# On your local machine with the Claude plugin installed
claude plugins install mattpocock-skills

# Then copy the updated skills to the repo
cp -r ~/.claude/plugins/cache/claude-plugins-official/mattpocock-skills/*/skills/* .claude/skills/mattpocock/

# Commit and push
git add .claude/skills/mattpocock/
git commit -m "Update mattpocock skills to latest version"
git push
```

## Notes

- These skills are from the open-source [mattpocock/skills](https://github.com/mattpocock/skills) repository
- Version: 1.2.3 (as of last update)
- License: MIT
- The skills are designed to be model-agnostic where possible
- OpenAI YAML configs are provided for compatibility

## Troubleshooting

**Skills not appearing in Cursor Cloud?**

- Ensure files are committed and pushed to the repo
- Check that `.claude/skills/mattpocock/` exists in the remote branch
- Cloud agents may need a fresh session to pick up new files

**Skills not working in Claude Web?**

- Claude Web doesn't auto-read from repos
- You must manually paste skill content into conversations
- Consider creating a snippet library for frequently used skills

**Kimi/Qwen not following the skill?**

- These models may need more explicit instructions
- Try: "Follow this skill exactly as written: [paste skill]"
- Break complex skills into smaller chunks if needed
