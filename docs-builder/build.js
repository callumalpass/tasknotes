/**
 * TaskNotes Docs — Static site builder
 *
 * Reads markdown from ../docs/, processes via marked,
 * applies src/template.html, writes HTML to dist/.
 *
 * Overrides: if src/overrides/<path> exists it takes precedence
 * over the source docs file.
 */

import fs from 'fs/promises';
import { existsSync, cpSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import matter from 'gray-matter';
import hljs from 'highlight.js';
import yaml from 'js-yaml';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DOCS  = path.resolve(__dir, '../docs');
const DIST  = path.resolve(__dir, 'dist');
const SRC   = path.resolve(__dir, 'src');

// ── Markdown setup ─────────────────────────────────────────────────

marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const l = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language: l }).value;
    },
  })
);

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function parseMarkdown(raw) {
  const { data: fm, content } = matter(raw);
  let html = marked.parse(content);

  // Add IDs to headings for TOC / anchor links
  html = html.replace(/<(h[2-4])([^>]*)>([\s\S]*?)<\/h[2-4]>/g, (_, tag, attrs, inner) => {
    if (/id=/.test(attrs)) return _;
    const id = slugify(inner.replace(/<[^>]+>/g, ''));
    return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });

  // Wrap tables so wide ones scroll horizontally rather than overflowing into the TOC
  html = html.replace(/(<table[\s\S]*?<\/table>)/g, '<div class="table-wrap">$1</div>');

  return { fm, html };
}

// Rewrite relative image src/href paths to absolute URL paths.
// Markdown files reference assets relative to their own location, but the
// built HTML is served from a URL path that doesn't match the source path
// (e.g. docs/views/page.md → /views/page/, so ../assets/ would resolve
// wrongly in the browser). We resolve here at build time instead.
function resolveAssetPaths(html, mdPath) {
  const pageDir = '/' + path.dirname(mdPath).replace(/^\.(?:\/|$)/, '');
  return html.replace(/(<(?:img|source|video)[^>]+src=")([^"]+)(")/g, (_, pre, src, post) => {
    if (/^(https?:\/\/|\/|data:)/.test(src)) return _;
    const resolved = path.posix.resolve(pageDir || '/', src);
    return pre + resolved + post;
  });
}

function extractTitle(html, fm) {
  if (fm.title) return fm.title;
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  return m ? m[1].replace(/<[^>]+>/g, '') : 'Untitled';
}

// Strip the first <h1> — rendered separately in the page header
function stripH1(html) {
  return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, '');
}

function buildToc(html) {
  const items = [];
  const re = /<(h[23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    items.push({ tag: m[1], id: m[2], text: m[3].replace(/<[^>]+>/g, '') });
  }
  if (items.length < 2) return '';

  let out = '<nav class="toc"><p class="toc__heading">On this page</p><ul>';
  for (const item of items) {
    const cls = item.tag === 'h3' ? ' class="toc__sub"' : '';
    out += `<li${cls}><a href="#${item.id}">${escHtml(item.text)}</a></li>`;
  }
  return out + '</ul></nav>';
}

// ── Navigation ──────────────────────────────────────────────────────

function mdPathToUrl(p) {
  if (p === 'index.md') return '/';
  return '/' + p.replace(/\.md$/, '/');
}

function buildNavHtml(items, currentUrl, depth = 0) {
  let html = `<ul class="nav-list${depth > 0 ? ' nav-list--child' : ''}">`;

  for (const item of items) {
    const [[label, value]] = Object.entries(item);

    if (typeof value === 'string') {
      const url = mdPathToUrl(value);
      const active = url === currentUrl;
      html += `<li><a href="${url}" class="nav-link${active ? ' is-active' : ''}">${escHtml(label)}</a></li>`;
    } else if (Array.isArray(value)) {
      const childUrls = flattenNav(value).map(p => mdPathToUrl(p));
      const open = childUrls.includes(currentUrl);
      html += `<li class="nav-section${open ? ' is-open' : ''}">`;
      html += `<span class="nav-section__label"><span class="nav-section__sym" aria-hidden="true">§</span>${escHtml(label)}</span>`;
      html += buildNavHtml(value, currentUrl, depth + 1);
      html += '</li>';
    }
  }

  return html + '</ul>';
}

function flattenNav(items) {
  const pages = [];
  for (const item of items) {
    const [[, value]] = Object.entries(item);
    if (typeof value === 'string') pages.push(value);
    else if (Array.isArray(value)) pages.push(...flattenNav(value));
  }
  return pages;
}

// ── Utilities ───────────────────────────────────────────────────────

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readSource(mdPath) {
  // Local override takes precedence over the source docs file
  const override = path.join(SRC, 'overrides', mdPath);
  const source   = path.join(DOCS, mdPath);
  const target   = existsSync(override) ? override : source;
  try {
    return await fs.readFile(target, 'utf-8');
  } catch {
    return null;
  }
}

// ── Build ───────────────────────────────────────────────────────────

async function main() {
  const start = Date.now();

  // Load nav from mkdocs.yml (single source of truth for navigation)
  const mkdocsRaw = await fs.readFile(path.resolve(__dir, '../mkdocs.yml'), 'utf-8');
  const mkdocs = yaml.load(mkdocsRaw.replace(/!!python\/name:\S+/g, 'null'));
  const nav = mkdocs.nav;

  const template = await fs.readFile(path.join(SRC, 'template.html'), 'utf-8');

  // Clean and recreate dist
  await fs.rm(DIST, { recursive: true, force: true });
  await ensureDir(DIST);

  // Copy static files
  await ensureDir(path.join(DIST, 'styles'));
  await ensureDir(path.join(DIST, 'js'));
  await fs.copyFile(path.join(SRC, 'styles', 'main.css'), path.join(DIST, 'styles', 'main.css'));
  await fs.copyFile(path.join(SRC, 'js', 'main.js'), path.join(DIST, 'js', 'main.js'));

  // Copy doc assets (images, videos, etc.)
  const assetsIn = path.join(DOCS, 'assets');
  if (existsSync(assetsIn)) {
    cpSync(assetsIn, path.join(DIST, 'assets'), { recursive: true });
  }

  // Copy CNAME for GitHub Pages custom domain
  const cname = path.join(DOCS, 'CNAME');
  if (existsSync(cname)) {
    await fs.copyFile(cname, path.join(DIST, 'CNAME'));
  }

  // Build every page listed in the nav
  const pages = flattenNav(nav);
  let built = 0, skipped = 0;

  for (const mdPath of pages) {
    const raw = await readSource(mdPath);
    if (!raw) { skipped++; continue; }

    const { fm, html: rawHtml } = parseMarkdown(raw);
    const html     = resolveAssetPaths(rawHtml, mdPath);
    const url      = mdPathToUrl(mdPath);
    const title    = extractTitle(html, fm);
    const body     = stripH1(html);
    const toc      = buildToc(body);
    const navHtml  = buildNavHtml(nav, url);

    const page = template
      .replaceAll('{{title}}',      escHtml(title))
      .replaceAll('{{site_title}}', 'TaskNotes')
      .replaceAll('{{nav}}',        navHtml)
      .replaceAll('{{toc}}',        toc)
      .replaceAll('{{content}}',    `<h1 class="page-title">${escHtml(title)}</h1>\n${body}`);

    const outDir = url === '/'
      ? DIST
      : path.join(DIST, ...url.split('/').filter(Boolean));
    await ensureDir(outDir);
    await fs.writeFile(path.join(outDir, 'index.html'), page);
    built++;
  }

  console.log(`Built ${built} pages, skipped ${skipped} (${Date.now() - start}ms)`);
}

main().catch(err => { console.error(err); process.exit(1); });
