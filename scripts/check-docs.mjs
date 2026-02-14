#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const docsDir = path.join(rootDir, 'docs');
const mkdocsPath = path.join(rootDir, 'mkdocs.yml');
const readmePath = path.join(rootDir, 'README.md');
const manifestPath = path.join(rootDir, 'manifest.json');
const releaseIndexPath = path.join(docsDir, 'releases.md');
const privacyPath = path.join(docsDir, 'privacy.md');
const rootPrivacyPath = path.join(rootDir, 'PRIVACY.md');

const errors = [];

function normalizeLink(link) {
  return decodeURIComponent(link.split('#')[0].split('?')[0]).trim();
}

function stripMarkdownCodeBlocks(content) {
  return content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '');
}

function markdownFiles() {
  const files = [readmePath];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  walk(docsDir);
  return files;
}

function verifyMkdocsNavTargetsExist() {
  const config = fs.readFileSync(mkdocsPath, 'utf8');
  const matches = [...config.matchAll(/:\s*([A-Za-z0-9_./-]+\.md)\s*$/gm)];

  for (const match of matches) {
    const relative = match[1];
    const full = path.join(docsDir, relative);
    if (!fs.existsSync(full)) {
      errors.push(`mkdocs nav references missing file: docs/${relative}`);
    }
  }

  if (!config.includes('calendar-setup.md')) {
    errors.push('mkdocs nav is missing docs/calendar-setup.md');
  }
}

function verifyCanonicalDocsUrl() {
  const readme = fs.readFileSync(readmePath, 'utf8');
  if (!readme.includes('https://tasknotes.dev/')) {
    errors.push('README.md is missing canonical docs URL: https://tasknotes.dev/');
  }
}

function verifyReleaseIndexMatchesManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const releaseIndex = fs.readFileSync(releaseIndexPath, 'utf8');
  const releaseFile = path.join(docsDir, 'releases', `${manifest.version}.md`);

  if (!fs.existsSync(releaseFile)) {
    errors.push(`Missing release file for manifest version: docs/releases/${manifest.version}.md`);
  }

  if (!releaseIndex.includes(`releases/${manifest.version}.md`)) {
    errors.push(`docs/releases.md does not include current manifest version ${manifest.version}`);
  }
}

function verifyPrivacyMirror() {
  const docsPrivacy = fs.readFileSync(privacyPath, 'utf8').trimEnd();
  const rootPrivacy = fs.readFileSync(rootPrivacyPath, 'utf8').trimEnd();

  if (docsPrivacy !== rootPrivacy) {
    errors.push('PRIVACY.md is out of sync with docs/privacy.md');
  }
}

function verifyLocalMarkdownLinks() {
  const files = markdownFiles();
  const mdLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;

  for (const file of files) {
    if (file.includes(`${path.sep}docs${path.sep}releases${path.sep}`)) {
      continue;
    }

    const directory = path.dirname(file);
    const content = stripMarkdownCodeBlocks(fs.readFileSync(file, 'utf8'));

    for (const match of content.matchAll(mdLinkPattern)) {
      const raw = match[1].replace(/^<|>$/g, '').trim();
      if (!raw) continue;
      if (raw.startsWith('#')) continue;
      if (raw.startsWith('http://') || raw.startsWith('https://')) continue;
      if (raw.startsWith('mailto:')) continue;
      if (raw.startsWith('data:')) continue;

      const normalized = normalizeLink(raw);
      if (!normalized) continue;

      const resolved = normalized.startsWith('/')
        ? path.join(rootDir, normalized.slice(1))
        : path.resolve(directory, normalized);

      if (!fs.existsSync(resolved)) {
        const relativeFile = path.relative(rootDir, file);
        errors.push(`Broken local link in ${relativeFile}: ${raw}`);
      }
    }
  }
}

verifyMkdocsNavTargetsExist();
verifyCanonicalDocsUrl();
verifyReleaseIndexMatchesManifest();
verifyPrivacyMirror();
verifyLocalMarkdownLinks();

if (errors.length > 0) {
  console.error('Documentation checks failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Documentation checks passed.');
