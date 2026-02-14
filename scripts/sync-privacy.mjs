#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const sourcePath = path.join(rootDir, 'docs', 'privacy.md');
const targetPath = path.join(rootDir, 'PRIVACY.md');
const checkMode = process.argv.includes('--check');

const source = fs.readFileSync(sourcePath, 'utf8').trimEnd();
const output = `${source}\n`;

if (checkMode) {
  const current = fs.readFileSync(targetPath, 'utf8');
  if (current !== output) {
    console.error('PRIVACY.md is out of sync with docs/privacy.md. Run: npm run docs:sync');
    process.exit(1);
  }
  process.exit(0);
}

fs.writeFileSync(targetPath, output, 'utf8');
console.log('Synced PRIVACY.md from docs/privacy.md');
