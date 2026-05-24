#!/usr/bin/env node
/**
 * Copy the vladikk/modularity skill markdown into .cursor/skills/modularity/
 * so Cursor agents can read the Balanced Coupling Model alongside their
 * editor. Mirror of how .cursor/skills/mermaid/ is kept in sync with
 * .claude/skills/mermaid/.
 *
 * Source resolution order:
 *   1. $MODULARITY_PLUGIN_PATH (if set)
 *   2. ~/.claude/plugins/marketplaces/vladikk-modularity (installed via
 *      /plugin marketplace add vladikk/modularity)
 *   3. Fallback: shallow clone https://github.com/vladikk/modularity into
 *      a temp dir (lets the script work before the user installs the plugin).
 *
 * Run on demand:
 *   npm run sync:modularity
 *
 * Not wired into `check` — the skill rarely changes and a Cursor session
 * either has the files or it doesn't.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const TARGET = join(repoRoot, '.cursor', 'skills', 'modularity');

function resolveSource() {
  const env = process.env.MODULARITY_PLUGIN_PATH;
  if (env && existsSync(join(env, 'skills'))) {
    return { kind: 'env', path: env, cleanup: () => {} };
  }
  const installed = join(homedir(), '.claude', 'plugins', 'marketplaces', 'vladikk-modularity');
  if (existsSync(join(installed, 'skills'))) {
    return { kind: 'installed', path: installed, cleanup: () => {} };
  }
  const scratch = mkdtempSync(join(tmpdir(), 'modularity-sync-'));
  console.log(`→ cloning vladikk/modularity into ${scratch} (plugin not installed locally)`);
  const out = spawnSync(
    'git',
    ['clone', '--depth', '1', 'https://github.com/vladikk/modularity.git', scratch],
    { stdio: 'inherit' }
  );
  if (out.status !== 0) {
    rmSync(scratch, { recursive: true, force: true });
    throw new Error('git clone failed; install the plugin or set MODULARITY_PLUGIN_PATH');
  }
  return { kind: 'cloned', path: scratch, cleanup: () => rmSync(scratch, { recursive: true, force: true }) };
}

async function main() {
  const src = resolveSource();
  try {
    const skillsDir = join(src.path, 'skills');
    const skillNames = await readdir(skillsDir, { withFileTypes: true });
    const dirs = skillNames.filter((e) => e.isDirectory()).map((e) => e.name);
    if (dirs.length === 0) {
      throw new Error(`no skills found at ${skillsDir}`);
    }
    await mkdir(TARGET, { recursive: true });
    for (const name of dirs) {
      const from = join(skillsDir, name);
      const to = join(TARGET, name);
      await cp(from, to, { recursive: true, force: true });
      console.log(`  copied ${name}/`);
    }
    console.log(`\nsync:modularity OK (source: ${src.kind} @ ${src.path})`);
    console.log(`  → ${TARGET}`);
  } finally {
    src.cleanup();
  }
}

main().catch((err) => {
  console.error('sync:modularity failed:', err.message);
  process.exit(1);
});
