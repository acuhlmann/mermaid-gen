import { redactSecrets } from '../utils/redactSecrets.js';
import { GOD_LOG_DEFAULT_REPO } from './godLogView.js';
import { sanitizeBranchSlug, type GodPrProposal } from './godPetitionPrompt.js';

type Env = Record<string, string | undefined>;

const REPO_SLUG_RE = /^[\w.-]{1,80}\/[\w.-]{1,80}$/;
const BASE_BRANCH_RE = /^[A-Za-z0-9._/-]{1,80}$/;
const GITHUB_TIMEOUT_MS = 12_000;

export function resolvePetitionGitHubToken(env: Env = process.env): string | null {
  for (const key of ['GOD_PR_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) {
    const val = typeof env[key] === 'string' ? env[key].trim() : '';
    if (val) return val;
  }
  return null;
}

export function resolvePetitionRepo(env: Env = process.env): string {
  const raw = (env.GOD_PETITION_REPO ?? env.GOD_LOG_REPO ?? GOD_LOG_DEFAULT_REPO).trim();
  return REPO_SLUG_RE.test(raw) ? raw : GOD_LOG_DEFAULT_REPO;
}

export function resolvePetitionBaseBranch(env: Env = process.env): string {
  const raw = (env.GOD_PETITION_BASE_BRANCH ?? 'main').trim();
  return BASE_BRANCH_RE.test(raw) && !raw.includes('..') ? raw : 'main';
}

export function buildPetitionSpecMarkdown(input: {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  createdAt: string;
}): string {
  const mortal = input.userName?.trim() || 'Unnamed Mortal';
  const planLines = input.proposal.implementationPlan.map((step, i) => `${i + 1}. ${step}`);
  const sections = [
    `# Divine Petition: ${input.proposal.title}`,
    '',
    `- **Petitioner:** ${mortal}`,
    `- **Divine Favor:** ${input.favor}/100`,
    `- **Target Area:** \`${input.proposal.targetArea}\``,
    `- **Decreed At:** ${input.createdAt}`,
    '',
    '## Celestial Mandate',
    '',
    input.proposal.summary,
    '',
    '## Implementation Plan',
    '',
    ...planLines
  ];

  if (input.prayerSummary?.trim()) {
    sections.push(
      '',
      '## Mortal Prayer Excerpt',
      '',
      `> ${input.prayerSummary.trim().slice(0, 500)}`
    );
  }

  sections.push('', '## Benediction', '', `_${input.proposal.divineBlessing}_`, '');
  return sections.join('\n');
}

export function buildPetitionPrBody(input: {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  filePath: string;
}): string {
  const mortal = input.userName?.trim() || 'Unnamed Mortal';
  const plan = input.proposal.implementationPlan.map((s) => `- [ ] ${s}`).join('\n');
  const lines = [
    '## Decree of the ArchiSlop God',
    '',
    `Petitioner **${mortal}** approached the Altar (Divine Favor: **${input.favor}/100**) and was judged worthy of a branch.`,
    '',
    `### Summary`,
    input.proposal.summary,
    '',
    `### Target Area`,
    `\`${input.proposal.targetArea}\``,
    '',
    '### Sacred Implementation Plan',
    plan,
    '',
    `### Petition Artifact`,
    `Recorded in \`${input.filePath}\`.`
  ];
  if (input.prayerSummary?.trim()) {
    lines.push('', '### Prayer Excerpt', `> ${input.prayerSummary.trim().slice(0, 400)}`);
  }
  lines.push('', `> _"${input.proposal.divineBlessing}"_`);
  return lines.join('\n');
}

export function buildManualGhCommand(input: {
  repo: string;
  baseBranch: string;
  branch: string;
  title: string;
  filePath: string;
}): string {
  const q = (v: string) => `'${v.replace(/'/g, "'\\''")}'`;
  return [
    `git checkout -b ${input.branch} origin/${input.baseBranch}`,
    `mkdir -p "$(dirname ${q(input.filePath)})" && git add ${q(input.filePath)}`,
    `git commit -m ${q(input.title)}`,
    `git push -u origin ${input.branch}`,
    `gh pr create --repo ${q(input.repo)} --base ${q(input.baseBranch)} --head ${q(input.branch)} --title ${q(input.title)}`
  ].join(' && ');
}

export type GodPrActionResult = {
  filed: boolean;
  mode: 'github_pr' | 'unconfigured' | 'github_error';
  reason?: string;
  repo: string;
  baseBranch: string;
  branch: string;
  filePath: string;
  title: string;
  body: string;
  prNumber?: number;
  prUrl?: string;
  ghCommand: string;
  divineMessage: string;
};

async function githubJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  token: string,
  init: Parameters<typeof fetch>[1] = {}
): Promise<{ ok: true; data: T } | { ok: false; status: number; detail: string }> {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'archislop-god-altar',
      ...(init.headers ?? {})
    },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS)
  });
  const text = await response.text();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: redactSecrets(text.slice(0, 300))
    };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: response.status, detail: 'Invalid JSON from GitHub API' };
  }
}

export type FilePetitionPrOptions = {
  proposal: GodPrProposal;
  prayerSummary?: string;
  favor: number;
  userName?: string;
  env?: Env;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
};

type PreparedPrContext = {
  repo: string;
  baseBranch: string;
  branch: string;
  filePath: string;
  title: string;
  body: string;
  ghCommand: string;
  markdown: string;
};

function prFailure(
  ctx: PreparedPrContext,
  reason: string,
  divineMessage: string
): GodPrActionResult {
  return {
    filed: false,
    mode: 'github_error',
    reason,
    repo: ctx.repo,
    baseBranch: ctx.baseBranch,
    branch: ctx.branch,
    filePath: ctx.filePath,
    title: ctx.title,
    body: ctx.body,
    ghCommand: ctx.ghCommand,
    divineMessage
  };
}

async function createPrOnGitHub(
  fetchImpl: typeof fetch,
  token: string,
  ctx: PreparedPrContext
): Promise<GodPrActionResult> {
  const baseApi = `https://api.github.com/repos/${ctx.repo}`;
  const refRes = await githubJson<{ object?: { sha?: string } }>(
    fetchImpl,
    `${baseApi}/git/ref/heads/${encodeURIComponent(ctx.baseBranch)}`,
    token
  );
  if (refRes.ok === false) {
    return prFailure(
      ctx,
      `git_ref_${refRes.status}`,
      `THE CELESTIAL FORGE STUMBLED READING \`${ctx.baseBranch}\`: ${refRes.detail}.`
    );
  }
  const baseSha = refRes.data.object?.sha;
  if (!baseSha) {
    return prFailure(ctx, 'missing_base_sha', `No base SHA returned for \`${ctx.baseBranch}\`.`);
  }

  const createRef = await githubJson<unknown>(fetchImpl, `${baseApi}/git/refs`, token, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${ctx.branch}`, sha: baseSha })
  });
  if (createRef.ok === false) {
    return prFailure(
      ctx,
      `create_ref_${createRef.status}`,
      `GITHUB REFUSED TO BIRTH BRANCH \`${ctx.branch}\`: ${createRef.detail}`
    );
  }

  const putFile = await githubJson<unknown>(
    fetchImpl,
    `${baseApi}/contents/${ctx.filePath}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify({
        message: ctx.title,
        content: Buffer.from(ctx.markdown, 'utf8').toString('base64'),
        branch: ctx.branch
      })
    }
  );
  if (putFile.ok === false) {
    return prFailure(
      ctx,
      `put_file_${putFile.status}`,
      `THE BRANCH OPENED, YET INSCRIBING \`${ctx.filePath}\` FAILED: ${putFile.detail}`
    );
  }

  const prRes = await githubJson<{ number?: number; html_url?: string }>(
    fetchImpl,
    `${baseApi}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        title: ctx.title,
        head: ctx.branch,
        base: ctx.baseBranch,
        body: ctx.body
      })
    }
  );
  if (prRes.ok === false) {
    return prFailure(
      ctx,
      `create_pr_${prRes.status}`,
      `THE SACRED COMMIT LANDED, YET OPENING THE PR FAILED: ${prRes.detail}`
    );
  }
  if (!prRes.data.html_url) {
    return prFailure(ctx, 'missing_pr_url', 'GitHub returned no pull request URL.');
  }

  return {
    filed: true,
    mode: 'github_pr',
    repo: ctx.repo,
    baseBranch: ctx.baseBranch,
    branch: ctx.branch,
    filePath: ctx.filePath,
    title: ctx.title,
    body: ctx.body,
    prNumber: prRes.data.number,
    prUrl: prRes.data.html_url,
    ghCommand: ctx.ghCommand,
    divineMessage: `BEHOLD! PR #${String(prRes.data.number ?? '?')} HATH DESCENDED FROM HEAVEN ON BRANCH \`${ctx.branch}\`. Now go beg a human reviewer for an LGTM.`
  };
}

export async function filePetitionPr(options: FilePetitionPrOptions): Promise<GodPrActionResult> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = new Date((options.nowMs ?? Date.now)());
  const createdAt = now.toISOString();
  const stamp = createdAt.replace(/[-:T]/g, '').slice(0, 14);

  const repo = resolvePetitionRepo(env);
  const baseBranch = resolvePetitionBaseBranch(env);
  const slug = sanitizeBranchSlug(options.proposal.branchSlug || options.proposal.title);
  const branch = `god-petition/${slug}-${stamp}`;
  const filePath = `docs/petitions/${slug}-${stamp}.md`;
  const title = redactSecrets(options.proposal.title.trim().slice(0, 120));
  const body = buildPetitionPrBody({
    proposal: options.proposal,
    prayerSummary: options.prayerSummary,
    favor: options.favor,
    userName: options.userName,
    filePath
  });
  const ghCommand = buildManualGhCommand({ repo, baseBranch, branch, title, filePath });
  const markdown = buildPetitionSpecMarkdown({
    proposal: options.proposal,
    prayerSummary: options.prayerSummary,
    favor: options.favor,
    userName: options.userName,
    createdAt
  });

  const token = resolvePetitionGitHubToken(env);
  if (!token) {
    return {
      filed: false,
      mode: 'unconfigured',
      reason: 'missing_github_token',
      repo,
      baseBranch,
      branch,
      filePath,
      title,
      body,
      ghCommand,
      divineMessage:
        'THUNDER ROLLED, YET NO GITHUB TOKEN DWELLS IN THIS SERVER’S ENVIRONMENT (GOD_PR_TOKEN / GITHUB_TOKEN). Behold thy consecrated PR scroll—execute it with thine own mortal hands or bestow a token upon this server.'
    };
  }

  return createPrOnGitHub(fetchImpl, token, {
    repo,
    baseBranch,
    branch,
    filePath,
    title,
    body,
    ghCommand,
    markdown
  });
}
