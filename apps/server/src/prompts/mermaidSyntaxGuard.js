/**
 * Per-diagram-type Mermaid syntax rule packs.
 *
 * Compiled from observed `mermaid.parse` failures and Mermaid's own grammar. Each pack is
 * deliberately short (≤25 lines, <300 tokens) so it can be injected into a repair prompt
 * without blowing the budget. Each line is a single rule plus a tiny corrected example.
 */

const COMMON_FIXES = `Universal Mermaid rules:
- Label with special characters must be quoted: A["user (admin)"], not A[user (admin)].
- Avoid reserved words as node IDs (end, class, style, default, subgraph, classDef, click, call, graph, interpolate, linkStyle, flowchart, sequenceDiagram, loop, alt, else, opt, par, and) — use n_end, n_class, etc.
- Keep node IDs to ASCII letters/digits/underscores; put any unicode/punctuation in the quoted label only.
- Use straight ASCII quotes (" '), never smart quotes (“ ”). Don't mix quote types inside one label.
- For literal quotes/parens in labels, use Mermaid #NNN; codes (#34; for ", #40; for (, #41; for )); HTML named entities like &lt; &gt; &amp; render literally — only &quot; works.
- One diagram-type keyword on the first non-blank line, no init directive after it.
- %%{init: { ... }}%% must be valid JSON with double-quoted keys/strings.
`;

const FLOWCHART_RULES = `${COMMON_FIXES}
Flowchart / graph rules:
- Header: \`flowchart TD\` or \`graph LR\` (TD, TB, BT, LR, RL). Header line stands alone — never put nodes on the same line.
- Node shapes: A[Rect], A(Round), A([Stadium]), A{Diamond}, A[[Sub]], A>Asym], A{{Hex}}.
- Node IDs: ASCII letters/digits/_/- only — never @ # % or spaces in the ID itself (those belong in the quoted label).
- Edges: A --> B, A --- B (no arrow), A -. text .-> B (dotted), A == text ==> B (thick). Never -> (one dash), ---> (three dashes), or <--> in flowchart.
- Edge label with specials: A -->|"key: value"| B (quote when colon, paren, slash present).
- Subgraphs must close: subgraph S [optional title] ... end.
- classDef + class: classDef hot fill:#f33,color:#fff; class A,B hot;  (no spaces around commas).
- style: one node per line only — style B fill:#eee; style C fill:#eee;  (NOT style B,C,D — Mermaid treats that as one bogus node id).
`;

const SEQUENCE_RULES = `${COMMON_FIXES}
Sequence diagram rules:
- Header: sequenceDiagram (no direction).
- Declare with participant (or actor) Alice (space required between keyword and name), then arrows: Alice->>Bob: msg, Alice-->>Bob: dashed, Alice-)Bob: async, Alice--xBob: cross.
- Arrow MUST be followed by a colon before the message: \`Alice->>Bob: hello\` — never \`Alice->>Bob hello\`.
- Note over Alice,Bob: text. Note left of Alice: text. Note right of Bob: text.
- Never put \`;\` inside Note text — the parser truncates the Note silently at the first semicolon. Use \`,\` to separate items.
- Loops/alt/opt require matching end: loop poll\\n ...\\nend; alt cond\\n ...\\nelse\\n ...\\nend. Same for opt, par, rect, break, critical.
- Activations: activate Alice / deactivate Alice (must pair).
`;

const CLASS_RULES = `${COMMON_FIXES}
Class diagram rules:
- Header: classDiagram.
- Relations: ClassA <|-- ClassB (inheritance), ClassA *-- ClassB (composition), ClassA o-- ClassB (aggregation), ClassA --> ClassB (assoc), ClassA ..> ClassB (dep), ClassA ..|> ClassB (realization).
- Members: ClassName : +publicMethod() type, -privateField type. One member per line.
- Generics: ClassName~Type~ (tildes, not <>).
- Annotations: <<Interface>> ClassName on its own line.
`;

const STATE_RULES = `${COMMON_FIXES}
State diagram (v2) rules:
- Header: stateDiagram-v2.
- Transitions: A --> B : event; [*] --> A is the entry; A --> [*] is the exit.
- Transition labels (text after \`:\`) must be a single unbroken line — no \\n. Use \`,\` to separate multiple events: \`A --> B : step one, step two\`.
- State descriptions use \`as\`, not a colon: \`state "Long description" as s1\` — never \`state "Long description": s1\`.
- Composite states: state Compound { Idle --> Active : start } ... use braces, not subgraph.
- Concurrent states: split with -- inside the composite.
- classDef cannot target \`[*]\` (start/end pseudo-states) — apply classes only to named states.
- Note left of A : text  /  Note right of A : text.
`;

const ER_RULES = `${COMMON_FIXES}
Entity-relationship rules:
- Header: erDiagram.
- Cardinality between entities uses dots and pipes: CUSTOMER ||--o{ ORDER : places. ||--|| (one-one), }o--o{ (many-many). Never abbreviate to \`|--\` — both sides need cardinality markers.
- Attribute blocks: ENTITY { string name PK "comment optional" } — attribute order is ALWAYS \`type name\` (e.g., \`int id\`, \`string email\`), never \`name type\`. Wrong order yields \`Expected ATTRIBUTE_WORD but found BLOCK_STOP\`.
- Entity and attribute names must be uppercase identifiers (Mermaid convention).
`;

const GANTT_RULES = `${COMMON_FIXES}
Gantt rules:
- Header: gantt then dateFormat YYYY-MM-DD on the next line.
- Sections: section Name. Tasks: \`Task name :id, after otherId, 3d\` or \`Task :2024-01-02, 5d\`.
- Status prefixes: done, active, crit, milestone.
- Always put a comma between the task id and the date: \`task :id, 2024-01-02, 3d\` — missing comma (\`task :id 2024-01-02, 3d\`) silently fails in Firefox.
- Avoid colons, semicolons, and # in task names (use \`:\` only as the task-line separator); they cause truncation or parse errors.
- Reserved gantt keywords (don't use as bare task names): gantt, section, dateFormat, click, title, axisFormat, excludes, includes, todayMarker, topAxis — quote them if needed (\`"section task" :2024-01-04, 1d\`).
`;

const JOURNEY_RULES = `${COMMON_FIXES}
User journey rules:
- Header: journey, then title on its own line.
- Sections: section Section Name. Tasks: Task name: score: Actor1, Actor2  (score is 1–5).
`;

const MINDMAP_RULES = `${COMMON_FIXES}
Mindmap rules:
- Header: mindmap, then root((Root Topic)) on the next indented line.
- Children use indentation only (2-space indent steps). No arrows.
- Node shapes: root((Root)), id[Square], id(Round), id))cloud((, id{Hex}.
- Icons via ::icon(fa fa-name) on its own indented line under the node.
`;

const TIMELINE_RULES = `${COMMON_FIXES}
Timeline rules:
- Header: timeline, then title on its own line.
- Entries: \`2024 : event 1 : event 2\` — colon separates the period from one or more events.
- Sections: section Section Name (groups subsequent timeline rows).
`;

const GITGRAPH_RULES = `${COMMON_FIXES}
Git graph rules:
- Header: gitGraph.
- Commands: commit id:"label" tag:"v1", branch develop, checkout develop, merge develop tag:"merge", cherry-pick id:"hash".
- Quotes are required around id/tag values.
- Commands must be one per line (no semicolons).
`;

const QUADRANT_RULES = `${COMMON_FIXES}
Quadrant chart rules:
- Header: quadrantChart, then optional title.
- Axes: x-axis "low" --> "high"; y-axis "low" --> "high".
- Quadrant labels: quadrant-1 "name", quadrant-2 "name", quadrant-3 "name", quadrant-4 "name".
- Points: Point Name: [0.4, 0.7] — both coords in 0..1.
`;

const PIE_RULES = `${COMMON_FIXES}
Pie chart rules:
- Header: pie or pie showData, then optional title.
- Slices: "Label" : 42  (quoted label, then colon, then positive number).
- Values must be positive numbers — negative, zero, empty, or non-numeric values fail silently with no error and a blank chart.
`;

const BLOCK_RULES = `${COMMON_FIXES}
Block diagram (beta) rules:
- Header: block-beta.
- Blocks: id["label"], grouped blocks: block:group columns 2 ... end.
- Connections use arrows like flowchart: A --> B.
- Columns directive: columns 3 sets grid width.
`;

const C4_RULES = `${COMMON_FIXES}
C4 diagram rules:
- Header: C4Context (or Container/Component/Dynamic/Deployment).
- Title: title Some Title (no quotes).
- Person, System, System_Ext, Container, etc. — function-call form: Person(alias, "label", "description").
- Rel(from, to, "label") for relationships; quotes required.
- Boundary: System_Boundary(b1, "Boundary name") { Person(...) ... } — braces, not end.
`;

const SANKEY_RULES = `${COMMON_FIXES}
Sankey (beta) rules:
- Header: sankey-beta.
- CSV body: source,target,value — one flow per line. Quote labels that contain commas.
- No node declarations; nodes are inferred from source/target columns.
`;

const XY_RULES = `${COMMON_FIXES}
XY chart (beta) rules:
- Header: xychart-beta then optional title.
- Axes: x-axis ["A","B","C"], y-axis "Label" 0 --> 100.
- Series: line [10, 20, 30], bar [5, 7, 9].
- All arrays use square brackets; numeric values not quoted; categorical labels quoted.
`;

const AGENTFLOW_RULES = `${COMMON_FIXES}
Agentflow (Mermaid 12, beta) rules:
- Header must be exactly \`agentflow-beta\` — the -beta suffix is part of the keyword — then an optional direction: agentflow-beta TB / LR / BT / RL.
- Node: id["Label"]@{ shape: task } — metadata attaches with no space before @{.
- Shape kinds: task, tool, input, decision, refdoc, action. A tool label is the call name: lookup["changelog_search"]@{ shape: tool }.
- Edges: --> sequence (control or data flows), -.- reference (consults, nothing passes), --x failure path. Chaining is fine: a --> b --> c.
- An edge label goes between the dashes: check -- yes --> ship. Do NOT use the flowchart check -->|yes| ship form.
- Container: flow id["Label"], then nested nodes, then end. Containers nest; every flow needs its own end.
- Shared top-level nodes go in a bare \`global\` ... \`end\` block — no id, label, or metadata on the global line.
- External system: connector github["GitHub API"], then a separate line github@{ protocol: "http", endpoint: "https://api.github.com" }.
- Bind a tool to it with a quoted dotted string: create["create_issue"]@{ shape: tool, connectorRef: "github.create_issue" }.
- Set or change metadata later by id on its own line: researcher@{ instruction: "Research and cite sources." }, tools@{ algorithm: "elk.rectpacking" }, intake@{ view: "collapsed" }.
- Tool signature keys: params: "city :: String", returns: "Report", value: "Stockholm".
- classDef, class, style and linkStyle are all valid. The flowchart ::: shortcut is NOT — b["Finish"]::: loud is a parse error; write \`class b loud\` on its own line instead.
`;

const USECASE_RULES = `${COMMON_FIXES}
Use case (Mermaid 12, beta) rules:
- Header must be exactly \`usecase-beta\` — the -beta suffix is part of the keyword. Then optionally \`direction LR\` / TB / TD / BT / RL on its own line.
- One statement per physical line; never join statements with semicolons.
- Actor: actor Customer, or actor Admin("Main administrator") with a label. Use case ellipse: Login("Sign in"). Use case rectangle: Report[Generate report]. A bare id used on an edge becomes an ellipse use case.
- Do NOT write \`usecase Login("Sign in")\` — the \`actor\` keyword is for actors only; a use case is just its shaped label.
- System boundary: systemBoundary Storefront, then members, then end. Or titled with metadata: systemBoundary sb1["Payment service"]@{ type: package }. Boundaries must not nest.
- Inside a boundary only actors, use cases, blank lines and %% comments are allowed.
- Associations: --> , <-- , -- (plain), --o , --x , and --|> for generalization pointing from specialized to general. Labelled: User -- "include account details" --> Login.
- Include/extend put the keyword before the target: Checkout ..> : include Browse, ApplyCoupon ..> : extend Checkout.
- Actor variants live in metadata: actor Hollow("Hollow")@{ type: hollow }, actor Icon("Icon")@{ icon: "fa:user" }, actor Broker@{ business: true }. Never combine icon with a non-normal type.
- A stereotype \`<<Core>>\` comes after metadata and before a \`:::class\` suffix: Quote("Prepare quote")@{ business: true } <<Core>>.
- A note attaches to one element on its own line: note for User "This user has admin rights".
- Special characters in an unquoted label need entity codes (#quot;, #40;, #41;); use a backtick markdown string for real formatting.
- classDef, class, the ::: suffix and style are valid. linkStyle is NOT supported here — a \`linkStyle 0 stroke:#f00\` line fails the whole diagram; colour edges via the %%init%% theme instead.
`;

const RULE_PACKS = {
  flowchart: FLOWCHART_RULES,
  sequenceDiagram: SEQUENCE_RULES,
  classDiagram: CLASS_RULES,
  'stateDiagram-v2': STATE_RULES,
  erDiagram: ER_RULES,
  gantt: GANTT_RULES,
  journey: JOURNEY_RULES,
  mindmap: MINDMAP_RULES,
  timeline: TIMELINE_RULES,
  gitGraph: GITGRAPH_RULES,
  quadrantChart: QUADRANT_RULES,
  pie: PIE_RULES,
  'block-beta': BLOCK_RULES,
  C4Context: C4_RULES,
  C4Container: C4_RULES,
  C4Component: C4_RULES,
  C4Dynamic: C4_RULES,
  C4Deployment: C4_RULES,
  'sankey-beta': SANKEY_RULES,
  'xychart-beta': XY_RULES,
  'agentflow-beta': AGENTFLOW_RULES,
  'usecase-beta': USECASE_RULES
};

/**
 * Returns a high-signal rule pack for the given diagram type. Falls back to a universal
 * pack when the type is unknown so the repair prompt always has *something* to anchor on.
 *
 * @param {string | null | undefined} diagramType
 */
export function getRulePack(diagramType) {
  if (!diagramType) return COMMON_FIXES;
  return RULE_PACKS[diagramType] ?? COMMON_FIXES;
}

export const RULE_PACK_TYPES = Object.freeze(Object.keys(RULE_PACKS));
