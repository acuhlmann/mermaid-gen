# Architecture Decision Records

Short prose records of non-obvious past decisions. Read these before re-litigating something that looks weird — there is usually a reason.

| #                                             | Title                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| [0001](0001-dual-slot-mermaid-infographic.md) | Dual-slot session state (Mermaid + Infographic)                                        |
| [0002](0002-shared-mermaid-sanitizer.md)      | Single shared Mermaid sanitizer (server-side file is a shim)                           |
| [0003](0003-no-state-store-in-shared.md)      | No state store in `packages/shared`                                                    |
| [0004](0004-commonjs-root-esm-workspaces.md)  | CommonJS root, ESM workspaces                                                          |
| [0005](0005-monolith-splits.md)               | Splitting monolithic files for agent-friendly editing                                  |
| [0006](0006-typescript-migration.md)          | TypeScript migration as a sliding ratchet                                              |
| [0007](0007-sensors-for-coding-agents.md)     | Sensors for coding agents (lint guidance, dep-cruiser)                                 |
| [0008](0008-anything-inline-libraries.md)     | Anything-mode inline libraries: markers stored, vendored bytes injected at render time |
| [0009](0009-dynamic-composite-standards.md)   | Dynamic Composite v2: canonical semantic DSL, internal fused render plan               |
| [0010](0010-cast-agency-sign-off.md)          | Cast agency: Sign-off rule, one producer, pitch/proposal split                         |
| [0011](0011-two-office-renderers.md)          | One office state, two renderers; isometric floor is DOM/CSS + SVG                      |
| [0012](0012-collaboration-model.md)           | Five collaboration acts, one of which produces (talk / mob / pair / delegate)          |

## Format

One Markdown file per decision, numbered. Sections: **Status / Context / Decision / Consequences / Alternatives considered / Where this lives in code**. Keep them under one page. If a decision is reversed, add a new ADR that supersedes it — don't edit history.
