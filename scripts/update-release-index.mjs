#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const releasesDir = path.join(rootDir, 'docs', 'releases');
const outputPath = path.join(rootDir, 'docs', 'releases.md');
const manifestPath = path.join(rootDir, 'manifest.json');
const checkMode = process.argv.includes('--check');

function parseVersion(filename) {
  const stem = filename.replace(/\.md$/, '');
  const match = stem.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) {
    return null;
  }

  return {
    raw: stem,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function compareIdentifiers(a, b) {
  const aNum = /^\d+$/.test(a) ? Number(a) : NaN;
  const bNum = /^\d+$/.test(b) ? Number(b) : NaN;

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return aNum - bNum;
  }
  if (!Number.isNaN(aNum)) {
    return -1;
  }
  if (!Number.isNaN(bNum)) {
    return 1;
  }
  return a.localeCompare(b);
}

function comparePrerelease(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const aParts = a.split('.');
  const bParts = b.split('.');
  const max = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < max; i += 1) {
    const aPart = aParts[i];
    const bPart = bParts[i];

    if (aPart === undefined) return -1;
    if (bPart === undefined) return 1;

    const cmp = compareIdentifiers(aPart, bPart);
    if (cmp !== 0) {
      return cmp;
    }
  }

  return 0;
}

function sortVersionsDesc(a, b) {
  if (a.major !== b.major) return b.major - a.major;
  if (a.minor !== b.minor) return b.minor - a.minor;
  if (a.patch !== b.patch) return b.patch - a.patch;
  return -comparePrerelease(a.prerelease, b.prerelease);
}

function buildReleaseIndex(currentMajor, versions) {
  const groups = new Map();
  for (const version of versions) {
    const list = groups.get(version.major) ?? [];
    list.push(version);
    groups.set(version.major, list);
  }

  const majors = [...groups.keys()].sort((a, b) => b - a);
  const lines = [];

  lines.push('# Release Notes');
  lines.push('');
  lines.push('Welcome to the TaskNotes release notes. Here you can find detailed information about each version, including new features, bug fixes, and improvements.');
  lines.push('');
  lines.push('## Latest Releases');
  lines.push('');

  for (const major of majors) {
    const title = major === 0
      ? '### Early Versions (0.x)'
      : major === currentMajor
        ? `### Version ${major}.x (Current)`
        : `### Version ${major}.x`;

    lines.push(title);
    lines.push('');

    const items = (groups.get(major) ?? []).sort(sortVersionsDesc);
    for (const item of items) {
      lines.push(`- [${item.raw}](releases/${item.raw}.md)`);
    }

    lines.push('');
  }

  lines.push('## Getting Updates');
  lines.push('');
  lines.push('To update TaskNotes:');
  lines.push('1. Open Obsidian');
  lines.push('2. Go to Settings → Community Plugins');
  lines.push('3. Find TaskNotes and click "Update"');
  lines.push('4. Restart Obsidian if prompted');
  lines.push('');
  lines.push('## Feedback');
  lines.push('');
  lines.push('Found a bug or have a feature request? Please:');
  lines.push('');
  lines.push('- Check existing [GitHub Issues](https://github.com/callumalpass/tasknotes/issues)');
  lines.push('- Create a new issue with details');
  lines.push('');

  return `${lines.join('\n')}`;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const currentMajor = Number(String(manifest.version).split('.')[0]);

const versions = fs
  .readdirSync(releasesDir)
  .filter((name) => name.endsWith('.md') && name !== 'unreleased.md')
  .map(parseVersion)
  .filter((value) => value !== null)
  .sort(sortVersionsDesc);

const output = buildReleaseIndex(currentMajor, versions);

if (checkMode) {
  const current = fs.readFileSync(outputPath, 'utf8');
  if (current !== output) {
    console.error('docs/releases.md is out of date. Run: npm run docs:sync');
    process.exit(1);
  }
  process.exit(0);
}

fs.writeFileSync(outputPath, output, 'utf8');
console.log('Updated docs/releases.md');
