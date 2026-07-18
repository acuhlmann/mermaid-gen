#!/usr/bin/env node
/**
 * Cross-platform dist data copy for the shared build. Replaces the Unix-only
 * `mkdir -p dist/data && cp …` step so `npm run build -w packages/shared`
 * works under Windows cmd.exe (npm's default script-shell on Windows).
 */
import fs from 'node:fs';

fs.mkdirSync('dist/data', { recursive: true });
fs.copyFileSync('src/data/llm-token-rates.json', 'dist/data/llm-token-rates.json');
