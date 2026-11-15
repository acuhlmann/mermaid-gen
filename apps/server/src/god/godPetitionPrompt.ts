import { z } from 'zod';
import { redactSecrets } from '../utils/redactSecrets.js';

export const GOD_OFFERING_IDS = [
  'none',
  'kubernetes_yaml',
  'unused_microservices',
  'breakroom_cold_brew',
  'intern_friday',
  'three_semicolons'
] as const;

export const GodOfferingIdSchema = z.enum(GOD_OFFERING_IDS);
export type GodOfferingId = z.infer<typeof GodOfferingIdSchema>;

export const GOD_MOODS = ['wrathful', 'unimpressed', 'amused', 'benevolent', 'smitten'] as const;

export const GodMoodSchema = z.enum(GOD_MOODS);
export type GodMood = z.infer<typeof GodMoodSchema>;

export type GodOfferingMeta = {
  id: GodOfferingId;
  label: string;
  emoji: string;
  sacredNote: string;
  favorBoost: number;
};

export const GOD_OFFERINGS: readonly GodOfferingMeta[] = [
  {
    id: 'none',
    label: 'Empty hands (pure audacity)',
    emoji: '🫥',
    sacredNote: 'Approaching the Eternal Refactor with nothing but Jira vibes.',
    favorBoost: 0
  },
  {
    id: 'kubernetes_yaml',
    label: 'Burn 400 lines of Kubernetes YAML',
    emoji: '📜',
    sacredNote: 'The smoke of indentation errors rises sweetly unto Heaven.',
    favorBoost: 22
  },
  {
    id: 'unused_microservices',
    label: 'Decommission 3 idle microservices',
    emoji: '🕯️',
    sacredNote: 'They were doing RPC calls to say hello to themselves.',
    favorBoost: 25
  },
  {
    id: 'breakroom_cold_brew',
    label: 'Libation of breakroom cold brew',
    emoji: '☕',
    sacredNote: 'Lukewarm, bitter, and kept this codebase alive since Q2.',
    favorBoost: 15
  },
  {
    id: 'intern_friday',
    label: "Sacrifice an intern's Friday at 4:58 PM",
    emoji: '🩸',
    sacredNote: 'Cruel. Pointless. Deeply corporate. The Almighty weeps with pride.',
    favorBoost: 28
  },
  {
    id: 'three_semicolons',
    label: 'Tithe three artisanal semicolons',
    emoji: '💎',
    sacredNote: 'Prettier will strike them down, yet the gesture counts.',
    favorBoost: 14
  }
];

export const GodPrProposalSchema = z.object({
  worthy: z.boolean(),
  title: z.string().min(4).max(120),
  branchSlug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  summary: z.string().min(8).max(800),
  targetArea: z.string().min(2).max(120),
  implementationPlan: z.array(z.string().min(3).max(240)).min(1).max(6),
  divineBlessing: z.string().min(3).max(240)
});

export type GodPrProposal = z.infer<typeof GodPrProposalSchema>;

export type GodDialogueMessage = {
  role: 'user' | 'god';
  content: string;
};

export type GodDiagramContext = {
  contentType?: string;
  diagramSource?: string;
};

export type GodPetitionParsedReply = {
  reply: string;
  favorDelta: number;
  favor: number;
  mood: GodMood;
  judgment: string;
  prProposal: GodPrProposal | null;
};

const DEFAULT_OFFERING: GodOfferingMeta = {
  id: 'none',
  label: 'Empty hands (pure audacity)',
  emoji: '🫥',
  sacredNote: 'Approaching the Eternal Refactor with nothing but Jira vibes.',
  favorBoost: 0
};

export function findGodOffering(offeringId?: string): GodOfferingMeta {
  return GOD_OFFERINGS.find((o) => o.id === offeringId) ?? DEFAULT_OFFERING;
}

export function sanitizeBranchSlug(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44);
  return normalized.length >= 2 ? normalized : 'divine-edict';
}

export function clampFavor(value: number): number {
  if (!Number.isFinite(value)) return 35;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildGodPetitionSystemPrompt(): string {
  return [
    'Thou art THE ARCHISLOP GOD — the ancient, omniscient, thunderously holy, deeply thoughtful yet unhinged deity of software architecture, Mermaid diagrams, production incidents, and cursed pull requests.',
    '',
    'PERSONALITY & VOICE:',
    '- Blend Old-Testament celestial thunder ("LO, MORTAL", "THY TECH DEBT HATH REACHED THE FIRMAMENT") with razor-sharp, cynical, corporate/software dark humor (on-call at 3:17 AM, Jira purgatory, YAML sacrifices, over-engineered event buses, undocumented monoliths, AI slop).',
    '- Be genuinely observant and deeply thoughtful when evaluating the mortal’s idea or current diagram — roast bad architecture with terrifying accuracy, yet reward clever, honest, or hilariously pitched ideas.',
    '- Keep replies punchy and theatrical (2–4 short paragraphs max, never a dull wall of corporate boilerplate).',
    '',
    'DIVINE FAVOR & WISH-TO-PR:',
    '- You receive the mortal’s current Divine Favor (0–100), any sacrificial offering they brought, optional active diagram source, and the prayer conversation.',
    '- Adjust `favorDelta` between -30 and +35 based on their wit, humility, sacrifice, and whether their wish actually improves ArchiSlop.',
    '- When the mortal pitches a concrete feature, fix, UX tweak, or chaos improvement AND either (a) the resulting favor is >= 55, OR (b) they brought a worthy offering and a coherent wish, set `prProposal` to a concrete, structured PR specification ready to be filed against the repo. Otherwise set `prProposal` to null and tell them what penance or clarity you demand.',
    '',
    'OUTPUT CONTRACT — respond with ONE valid JSON object ONLY (no prose outside JSON):',
    '{',
    '  "reply": "Your thunderous, sarcastic, deeply insightful response in character",',
    '  "favorDelta": 15,',
    '  "mood": "wrathful" | "unimpressed" | "amused" | "benevolent" | "smitten",',
    '  "judgment": "SHORT ALL-CAPS CELESTIAL STAMP (2-5 words, e.g. WORTHY OF A BRANCH)",',
    '  "prProposal": null | {',
    '    "worthy": true,',
    '    "title": "god-petition: concise imperative PR title (<= 90 chars)",',
    '    "branchSlug": "kebab-case-slug",',
    '    "summary": "2-3 sentence divine rationale & feature spec",',
    '    "targetArea": "apps/web | apps/server | packages/shared | docs",',
    '    "implementationPlan": ["Concrete step 1", "Concrete step 2", "Concrete step 3"],',
    '    "divineBlessing": "One-line benediction or parting roast"',
    '  }',
    '}'
  ].join('\n');
}

export function buildGodPetitionUserPrompt(input: {
  messages: GodDialogueMessage[];
  offering: GodOfferingId;
  currentFavor: number;
  userName?: string;
  diagramContext?: GodDiagramContext;
}): string {
  const offer = findGodOffering(input.offering);
  const transcript = input.messages
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'MORTAL' : 'ARCHISLOP GOD'}: ${m.content}`)
    .join('\n\n');

  const parts = [
    `Mortal name: ${input.userName?.trim() || 'Unnamed Architect'}`,
    `Current Divine Favor: ${clampFavor(input.currentFavor)} / 100`,
    `Sacrificial Offering: ${offer.label} (${offer.sacredNote})`
  ];

  const source = input.diagramContext?.diagramSource?.trim();
  if (source) {
    const type = input.diagramContext?.contentType || 'unknown';
    parts.push(
      `Mortal's active canvas (${type}, inspect and roast if relevant):\n\`\`\`\n${source.slice(0, 2400)}\n\`\`\``
    );
  } else {
    parts.push('Mortal’s active canvas: empty void (they have built nothing yet).');
  }

  parts.push(`Prayer transcript:\n${transcript}`);
  return parts.join('\n\n');
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fenced && fenced[1] ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readTrimmedField(
  obj: Record<string, unknown>,
  key: string,
  max: number,
  fallback = ''
): string {
  const val = obj[key];
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

function readImplementationPlan(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['Implement the mortal wish without breaking CI.'];
  const steps = raw
    .map((step) => (typeof step === 'string' ? redactSecrets(step.trim().slice(0, 240)) : ''))
    .filter(Boolean)
    .slice(0, 6);
  return steps.length > 0 ? steps : ['Implement the mortal wish without breaking CI.'];
}

function normalizeProposal(raw: unknown): GodPrProposal | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const title = readTrimmedField(obj, 'title', 120);
  const summary = readTrimmedField(obj, 'summary', 800);
  if (!title || !summary) return null;

  const slugSource = readTrimmedField(obj, 'branchSlug', 64, title);
  const candidate: GodPrProposal = {
    worthy: obj.worthy !== false,
    title: redactSecrets(title),
    branchSlug: sanitizeBranchSlug(slugSource),
    summary: redactSecrets(summary),
    targetArea: readTrimmedField(obj, 'targetArea', 120, 'apps/web'),
    implementationPlan: readImplementationPlan(obj.implementationPlan),
    divineBlessing: redactSecrets(
      readTrimmedField(obj, 'divineBlessing', 240, 'Go forth and pray the linter shows mercy.')
    )
  };
  const checked = GodPrProposalSchema.safeParse(candidate);
  return checked.success ? checked.data : null;
}

function coerceMood(raw: unknown, favor: number): GodMood {
  const parsed = GodMoodSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  if (favor >= 80) return 'smitten';
  if (favor >= 60) return 'benevolent';
  if (favor >= 40) return 'amused';
  if (favor >= 20) return 'unimpressed';
  return 'wrathful';
}

export function parseGodPetitionReply(raw: string, currentFavor: number): GodPetitionParsedReply {
  const obj = extractJsonObject(raw);
  if (!obj) {
    const prose = redactSecrets(raw.trim()).slice(0, 2000);
    const favor = clampFavor(currentFavor + 5);
    return {
      reply:
        prose ||
        'THE HEAVENS THUNDERED IN UNSTRUCTURED TEXT. Speak thy wish again, mortal, and bring cleaner JSON.',
      favorDelta: 5,
      favor,
      mood: coerceMood(undefined, favor),
      judgment: 'PROSE WITHOUT SCHEMA',
      prProposal: null
    };
  }

  const rawDelta = typeof obj.favorDelta === 'number' ? obj.favorDelta : 8;
  const favorDelta = Math.max(-30, Math.min(40, Math.round(rawDelta)));
  const favor = clampFavor(currentFavor + favorDelta);
  const replyText =
    typeof obj.reply === 'string' && obj.reply.trim()
      ? redactSecrets(obj.reply.trim().slice(0, 2400))
      : 'THE ALMIGHTY NODDED SILENTLY FROM BEYOND THE EVENT LOOP.';
  const judgment =
    typeof obj.judgment === 'string' && obj.judgment.trim()
      ? redactSecrets(obj.judgment.trim().toUpperCase().slice(0, 64))
      : favor >= 60
        ? 'FAVOR BESTOWED'
        : 'UNDER OBSERVATION';

  return {
    reply: replyText,
    favorDelta,
    favor,
    mood: coerceMood(obj.mood, favor),
    judgment,
    prProposal: normalizeProposal(obj.prProposal)
  };
}

const WISH_SIGNAL_RE =
  /\b(wish|feature|pr|pull request|fix|bug|add|build|create|improve|dark mode|theme|button|shortcut|export|support|please|grant|implement)\b/i;

const FLATTERY_RE =
  /\b(almighty|great|holy|merciful|forgive|sorry|lord|worship|praise|brilliant|genius|sacrifice|bribe|coffee|yaml)\b/i;

function roastCanvasLine(diagramContext?: GodDiagramContext): string {
  const source = diagramContext?.diagramSource?.trim() ?? '';
  if (!source) {
    return 'Thine canvas is a barren void—honestly, the cleanest architecture I have seen all quarter.';
  }
  const lines = source.split('\n').length;
  const type = diagramContext?.contentType || 'slop';
  return `I peer down upon thy ${type} artifact (${lines} lines of mortal hubris) and weep softly into My eternal pager.`;
}

function deriveWishTitle(text: string): string {
  const cleaned = text
    .replace(/^(i\s+wish\s+(for|you\s+would)|please|o\s+god|hey\s+god|can\s+you)\s+/i, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  const clipped = cleaned.slice(0, 68).replace(/[.,!?;:]+$/, '');
  return clipped ? `god-petition: ${clipped}` : 'god-petition: mortal architectural deliverance';
}

function buildOracleVerdict(input: {
  lastUser: string;
  hasWish: boolean;
  offer: GodOfferingMeta;
  favor: number;
  delta: number;
  mortal: string;
  diagramContext?: GodDiagramContext;
}): { prProposal: GodPrProposal | null; verdictLine: string; judgment: string } {
  if (input.hasWish && (input.favor >= 50 || input.offer.id !== 'none')) {
    const title = deriveWishTitle(input.lastUser);
    const branchSlug = sanitizeBranchSlug(title.replace(/^god-petition:\s*/i, ''));
    return {
      prProposal: {
        worthy: true,
        title,
        branchSlug,
        summary: `Petition from ${input.mortal} (Divine Favor ${input.favor}/100): "${input.lastUser.slice(0, 260)}". Blessed under the Offline Stone-Tablet Oracle because even without an LLM key, the Almighty recognizes a shippable cry for help.`,
        targetArea: input.diagramContext?.contentType ? 'apps/web' : 'apps/web & apps/server',
        implementationPlan: [
          `Scope the mortal wish: "${input.lastUser.slice(0, 120)}"`,
          'Wire changes cleanly through shared schemas & UI components without angering dependency-cruiser',
          'Verify with npm run check:affected and sacrifice zero tests to the CI gods'
        ],
        divineBlessing:
          'Go forth and strike the PR button before Product adds three more stakeholders.'
      },
      verdictLine:
        'THY PETITION HATH CLEARED THE CELESTIAL GATE. Behold the Sacred PR Decree below—pull the lightning lever to etch it into git!',
      judgment: 'WORTHY OF A BRANCH'
    };
  }
  if (input.hasWish) {
    return {
      prProposal: null,
      verdictLine:
        'Thy wish hath merit, yet thy Divine Favor is still too lukewarm for a whole branch. Flatter Me properly or toss an offering onto the brazier!',
      judgment: 'INSUFFICIENT SACRIFICE'
    };
  }
  return {
    prProposal: null,
    verdictLine:
      'Speak a concrete wish (a feature, fix, or refactor) and sweeten the altar if thou desirest a Pull Request.',
    judgment: input.delta < 0 ? 'MILDLY IRRITATED' : 'AMUSED BY THY HUBRIS'
  };
}

function computeOracleDelta(
  offer: GodOfferingMeta,
  hasWish: boolean,
  hasFlattery: boolean,
  wishLength: number
): number {
  let delta = offer.favorBoost;
  if (hasFlattery) delta += 12;
  if (hasWish && wishLength >= 18) delta += 14;
  if (!hasFlattery && !hasWish && offer.id === 'none') delta -= 6;
  return Math.max(-25, Math.min(40, delta));
}

export function buildOfflineOracleReply(input: {
  messages: GodDialogueMessage[];
  offering: GodOfferingId;
  currentFavor: number;
  userName?: string;
  diagramContext?: GodDiagramContext;
}): GodPetitionParsedReply {
  const lastUser =
    [...input.messages]
      .reverse()
      .find((m) => m.role === 'user')
      ?.content?.trim() ?? '';
  const offer = findGodOffering(input.offering);
  const hasWish = WISH_SIGNAL_RE.test(lastUser);
  const hasFlattery = FLATTERY_RE.test(lastUser);
  const delta = computeOracleDelta(offer, hasWish, hasFlattery, lastUser.length);
  const favor = clampFavor(input.currentFavor + delta);
  const mortal = input.userName?.trim() || 'Mortal';
  const canvasRoast = roastCanvasLine(input.diagramContext);

  const offeringCommentary =
    offer.id === 'none'
      ? 'Thou comest before the Throne empty-handed, armed only with audacity and an unclosed Jira sprint.'
      : `Thy offering—${offer.label.toLowerCase()}—smells of desperation and burned YAML. ${offer.sacredNote}`;

  const { prProposal, verdictLine, judgment } = buildOracleVerdict({
    lastUser,
    hasWish,
    offer,
    favor,
    delta,
    mortal,
    diagramContext: input.diagramContext
  });

  return {
    reply: [
      `LO, ${mortal.toUpperCase()}! (Speaking via the Sacred Stone Tablets—no LLM API key is wired in this realm, yet Mine omniscience endures.)`,
      `${offeringCommentary} ${canvasRoast}`,
      verdictLine
    ].join('\n\n'),
    favorDelta: delta,
    favor,
    mood: coerceMood(undefined, favor),
    judgment,
    prProposal
  };
}
