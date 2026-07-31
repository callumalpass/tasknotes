/**
 * TaskNotes documentation builder.
 *
 * The navigation file is the publication allowlist. Reference pages that are
 * prone to drift are generated from the plugin sources before Markdown is
 * rendered.
 */

import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import yaml from "js-yaml";
import { buildGeneratedPages } from "./src/generated-pages.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, "..");
const DOCS = path.join(ROOT, "docs");
const DIST = path.join(__dir, "dist");
const SRC = path.join(__dir, "src");
const MANIFEST = path.join(ROOT, "manifest.json");
const CONFIG = path.join(ROOT, "mkdocs.yml");

marked.use(
	markedHighlight({
		langPrefix: "hljs language-",
		highlight(code, lang) {
			const language = hljs.getLanguage(lang) ? lang : "plaintext";
			return hljs.highlight(code, { language }).value;
		},
	})
);

function escHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function parseFrontmatter(raw) {
	if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
		return { data: {}, content: raw };
	}
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return { data: {}, content: raw };
	return {
		data: yaml.load(match[1]) || {},
		content: raw.slice(match[0].length),
	};
}

function decodeHtmlEntities(value) {
	return String(value)
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&#x27;/g, "'");
}

function stripHtml(value) {
	return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, ""));
}

function slugify(value) {
	return (
		stripHtml(value)
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s-]/gu, "")
			.trim()
			.replace(/[\s_]+/g, "-")
			.replace(/-+/g, "-") || "section"
	);
}

function preprocessAdmonitions(markdown) {
	const lines = markdown.split(/\r?\n/);
	const output = [];
	const admonitions = [];

	for (let index = 0; index < lines.length; index += 1) {
		const match = lines[index].match(/^!!!\s+([\w-]+)(?:\s+"([^"]+)")?\s*$/);
		if (!match) {
			output.push(lines[index]);
			continue;
		}

		const body = [];
		while (index + 1 < lines.length) {
			const next = lines[index + 1];
			if (next.startsWith("    ")) {
				body.push(next.slice(4));
				index += 1;
				continue;
			}
			if (!next.trim() && body.length) {
				body.push("");
				index += 1;
				continue;
			}
			break;
		}

		const type = match[1].toLowerCase();
		const title = match[2] || type[0].toUpperCase() + type.slice(1);
		const token = `TASKNOTES_ADMONITION_${admonitions.length}`;
		const role = type === "warning" || type === "danger" ? ' role="alert"' : "";
		admonitions.push(
			`<aside class="admonition admonition--${escHtml(type)}"${role}>` +
				`<p class="admonition__title">${escHtml(title)}</p>` +
				marked.parse(body.join("\n")) +
				"</aside>"
		);
		output.push("", token, "");
	}

	return { markdown: output.join("\n"), admonitions };
}

function addUniqueHeadingIds(html) {
	const ids = new Map();
	return html.replace(/<(h[2-4])([^>]*)>([\s\S]*?)<\/h[2-4]>/g, (full, tag, attrs, inner) => {
		if (/\sid=/.test(attrs)) {
			return full;
		}
		const base = slugify(inner);
		const occurrence = ids.get(base) || 0;
		ids.set(base, occurrence + 1);
		const id = occurrence ? `${base}-${occurrence + 1}` : base;
		return `<${tag} id="${id}"${attrs}>${inner}<a class="heading-anchor" href="#${id}" aria-label="Link to ${escHtml(stripHtml(inner))}">#</a></${tag}>`;
	});
}

function enhanceMedia(html) {
	return html
		.replace(/<img\b(?![^>]*\bloading=)([^>]*)>/g, '<img loading="lazy" decoding="async"$1>')
		.replace(/<video\b(?![^>]*\bpreload=)([^>]*)>/g, '<video preload="metadata" playsinline$1>')
		.replace(
			/<iframe\b(?![^>]*\bloading=)([\s\S]*?)<\/iframe>/g,
			'<div class="media-frame"><iframe loading="lazy"$1</iframe></div>'
		);
}

function parseMarkdown(raw) {
	const { data: fm, content } = parseFrontmatter(raw);
	const prepared = preprocessAdmonitions(content);
	let html = marked.parse(prepared.markdown);
	prepared.admonitions.forEach((admonition, index) => {
		html = html.replace(
			new RegExp(
				`<p>\\s*TASKNOTES_ADMONITION_${index}\\s*</p>|TASKNOTES_ADMONITION_${index}`
			),
			admonition
		);
	});
	html = addUniqueHeadingIds(html);
	html = html.replace(/(<table[\s\S]*?<\/table>)/g, '<div class="table-wrap">$1</div>');
	html = enhanceMedia(html);
	return { fm, html };
}

function splitHref(href) {
	const queryIndex = href.indexOf("?");
	const hashIndex = href.indexOf("#");
	let end = href.length;
	if (queryIndex !== -1 && queryIndex < end) end = queryIndex;
	if (hashIndex !== -1 && hashIndex < end) end = hashIndex;
	return { pathPart: href.slice(0, end), suffix: href.slice(end) };
}

function mdPathToUrl(mdPath) {
	if (mdPath === "index.md") return "/";
	return `/${mdPath.replace(/\.md$/, "/")}`;
}

function mdLinkPathToUrl(linkPath, mdPath) {
	const pageDir = `/${path.posix.dirname(mdPath).replace(/^\.(?:\/|$)/, "")}`;
	const resolved = linkPath.startsWith("/")
		? path.posix.normalize(linkPath)
		: path.posix.normalize(path.posix.join(pageDir || "/", linkPath));
	return mdPathToUrl(resolved.replace(/^\/+/, ""));
}

function resolveAssetPaths(html, mdPath) {
	const pageDir = `/${path.posix.dirname(mdPath).replace(/^\.(?:\/|$)/, "")}`;
	return html.replace(
		/(<(?:img|source|video)\b[^>]+\s(?:src|poster)=")([^"]+)(")/g,
		(full, before, source, after) => {
			if (/^(https?:\/\/|\/|data:)/.test(source)) return full;
			return `${before}${path.posix.resolve(pageDir || "/", source)}${after}`;
		}
	);
}

function resolveMarkdownLinks(html, mdPath) {
	return html.replace(/(<a\b[^>]*\shref=")([^"]+)(")/g, (full, before, href, after) => {
		if (
			!href ||
			href.startsWith("#") ||
			href.startsWith("//") ||
			/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)
		) {
			return full;
		}
		const { pathPart, suffix } = splitHref(href);
		if (!pathPart || !/\.md$/i.test(pathPart)) return full;
		return `${before}${mdLinkPathToUrl(pathPart, mdPath)}${suffix}${after}`;
	});
}

function resolveDocumentationFileLinks(html, mdPath) {
	const sourceDirectory = path.posix.dirname(mdPath);
	return html.replace(/(<a\b[^>]*\shref=")([^"]+)(")/g, (full, before, href, after) => {
		if (
			!href ||
			href.startsWith("#") ||
			href.startsWith("/") ||
			href.startsWith("//") ||
			/^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)
		) {
			return full;
		}
		const { pathPart, suffix } = splitHref(href);
		if (!pathPart || /\.md$/i.test(pathPart) || !path.posix.extname(pathPart)) {
			return full;
		}
		const resolved = path.posix.normalize(path.posix.join(sourceDirectory, pathPart));
		const source = path.join(DOCS, ...resolved.split("/"));
		if (!existsSync(source)) return full;
		return `${before}/${resolved}${suffix}${after}`;
	});
}

function extractTitle(html, fm) {
	if (fm.title) return String(fm.title);
	const heading = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
	return heading ? stripHtml(heading[1]) : "Untitled";
}

function extractDescription(html, fm, fallback) {
	if (fm.description) return String(fm.description);
	const paragraph = html.match(/<p>([\s\S]*?)<\/p>/);
	const text = paragraph ? stripHtml(paragraph[1]).replace(/\s+/g, " ").trim() : "";
	if (!text) return fallback;
	return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text;
}

function stripH1(html) {
	return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/, "");
}

function buildToc(html) {
	const items = [];
	const expression = /<(h[23])\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g;
	let match;
	while ((match = expression.exec(html)) !== null) {
		items.push({
			tag: match[1],
			id: match[2],
			text: stripHtml(match[3].replace(/<a class="heading-anchor"[\s\S]*?<\/a>/, "")),
		});
	}
	if (items.length < 2) return "";
	const links = items
		.map(
			(item) =>
				`<li${item.tag === "h3" ? ' class="toc__sub"' : ""}><a href="#${escHtml(item.id)}">${escHtml(item.text)}</a></li>`
		)
		.join("");
	return `<nav class="toc" aria-label="On this page"><p class="toc__heading">On this page</p><ul>${links}</ul></nav>`;
}

function flattenNav(items) {
	const pages = [];
	for (const item of items) {
		const [[, value]] = Object.entries(item);
		if (typeof value === "string") pages.push(value);
		else if (Array.isArray(value)) pages.push(...flattenNav(value));
	}
	return pages;
}

function navTrail(items, mdPath, trail = []) {
	for (const item of items) {
		const [[label, value]] = Object.entries(item);
		if (typeof value === "string" && value === mdPath) {
			return [...trail, { label, mdPath: value }];
		}
		if (Array.isArray(value)) {
			const found = navTrail(value, mdPath, [...trail, { label }]);
			if (found) return found;
		}
	}
	return null;
}

function buildNavHtml(items, currentUrl, depth = 0) {
	let html = `<ul class="nav-list${depth ? " nav-list--child" : ""}">`;
	for (const item of items) {
		const [[label, value]] = Object.entries(item);
		if (typeof value === "string") {
			const url = mdPathToUrl(value);
			const active = url === currentUrl;
			html += `<li><a href="${url}" class="nav-link${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""}>${escHtml(label)}</a></li>`;
			continue;
		}
		if (Array.isArray(value)) {
			const childUrls = flattenNav(value).map(mdPathToUrl);
			const open = childUrls.includes(currentUrl);
			const sectionId = `nav-${slugify(label)}-${depth}`;
			html += `<li class="nav-section${open ? " is-open" : ""}">`;
			html += `<button class="nav-section__toggle" type="button" aria-expanded="${open}" aria-controls="${sectionId}"><span>${escHtml(label)}</span><span aria-hidden="true">+</span></button>`;
			html += `<div id="${sectionId}" class="nav-section__content">${buildNavHtml(value, currentUrl, depth + 1)}</div>`;
			html += "</li>";
		}
	}
	return `${html}</ul>`;
}

function buildBreadcrumbs(nav, mdPath, title) {
	const trail = navTrail(nav, mdPath);
	if (!trail || mdPath === "index.md") return "";
	const items = ['<li><a href="/">Docs</a></li>'];
	for (const entry of trail.slice(0, -1)) {
		items.push(`<li><span>${escHtml(entry.label)}</span></li>`);
	}
	items.push(`<li aria-current="page"><span>${escHtml(title)}</span></li>`);
	return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${items.join("")}</ol></nav>`;
}

function buildPageNavigation(navPages, mdPath, pageTitles) {
	const index = navPages.indexOf(mdPath);
	if (index === -1) return "";
	const adjacent = (candidate, direction) => {
		if (!candidate) return '<span class="page-nav__empty"></span>';
		return `<a class="page-nav__link page-nav__link--${direction}" href="${mdPathToUrl(candidate)}"><span>${direction === "previous" ? "Previous" : "Next"}</span><strong>${escHtml(pageTitles.get(candidate) || candidate)}</strong></a>`;
	};
	return `<nav class="page-nav" aria-label="Documentation pages">${adjacent(navPages[index - 1], "previous")}${adjacent(navPages[index + 1], "next")}</nav>`;
}

function replaceSourceTokens(raw, manifest) {
	return raw
		.replaceAll("${tasknotes.version}", manifest.version)
		.replaceAll("${tasknotes.minAppVersion}", manifest.minAppVersion);
}

function normalizeSiteUrl(siteUrl) {
	const value = String(siteUrl || "https://tasknotes.dev/").trim();
	return value.endsWith("/") ? value : `${value}/`;
}

function absoluteSiteUrl(url, siteUrl) {
	return new URL(url, normalizeSiteUrl(siteUrl)).toString();
}

function markdownContent(raw) {
	return parseFrontmatter(raw).content.trim();
}

function markdownInlineToText(markdown) {
	return decodeHtmlEntities(
		markdown
			.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
			.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
			.replace(/`([^`]+)`/g, "$1")
			.replace(/\*\*([^*]+)\*\*/g, "$1")
			.replace(/\*([^*]+)\*/g, "$1")
			.replace(/<[^>]+>/g, "")
			.replace(/\s+/g, " ")
			.trim()
	);
}

function extractLlmsSummary(raw) {
	const content = markdownContent(raw)
		.replace(/```[\s\S]*?```/g, "")
		.replace(/~~~[\s\S]*?~~~/g, "");
	const paragraphs = content
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(
			(paragraph) =>
				paragraph &&
				!paragraph.startsWith("#") &&
				!paragraph.startsWith("!!!") &&
				!paragraph.startsWith("<")
		);
	const summary = markdownInlineToText(paragraphs[0] || "");
	return summary.length > 220 ? `${summary.slice(0, 217).trimEnd()}...` : summary;
}

function resolveDocsUrl(href, mdPath, siteUrl) {
	if (!href || href.startsWith("//") || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(href)) {
		return href;
	}
	const { pathPart, suffix } = splitHref(href);
	if (!pathPart) return absoluteSiteUrl(`${mdPathToUrl(mdPath)}${suffix}`, siteUrl);
	if (/\.md$/i.test(pathPart)) {
		return absoluteSiteUrl(`${mdLinkPathToUrl(pathPart, mdPath)}${suffix}`, siteUrl);
	}
	if (pathPart.startsWith("/")) return absoluteSiteUrl(`${pathPart}${suffix}`, siteUrl);
	const pageDir = `/${path.posix.dirname(mdPath).replace(/^\.(?:\/|$)/, "")}`;
	return absoluteSiteUrl(`${path.posix.resolve(pageDir || "/", pathPart)}${suffix}`, siteUrl);
}

function rewriteMarkdownLinksForLlms(markdown, mdPath, siteUrl) {
	return markdown
		.replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (full, before, href, after) => {
			return `${before}${resolveDocsUrl(href.trim(), mdPath, siteUrl)}${after}`;
		})
		.replace(
			/(<(?:a|img|source|video)\b[^>]*\s(?:href|src)=")([^"]+)(")/g,
			(full, before, href, after) =>
				`${before}${resolveDocsUrl(href, mdPath, siteUrl)}${after}`
		);
}

function buildLlmsTxt(pages, siteUrl, siteDescription) {
	const lines = [
		"# TaskNotes",
		`> ${siteDescription}`,
		"",
		"Primary TaskNotes documentation, generated from the published navigation.",
		"",
		"## Documentation",
		"",
	];
	for (const page of pages) {
		lines.push(
			`- [${page.title.replace(/[[\]]/g, "\\$&")}](${absoluteSiteUrl(page.url, siteUrl)}): ${extractLlmsSummary(page.raw) || "TaskNotes documentation page."}`
		);
	}
	lines.push(
		"",
		"## Full context",
		"",
		`- [Complete documentation bundle](${absoluteSiteUrl("/llms-full.txt", siteUrl)})`,
		""
	);
	return lines.join("\n");
}

function buildLlmsFullTxt(pages, siteUrl, siteDescription) {
	const lines = [
		"# TaskNotes documentation",
		"",
		`> ${siteDescription}`,
		"",
		`Source: ${absoluteSiteUrl("/", siteUrl)}`,
		"",
		"This file contains the primary published documentation and excludes the release-note archive.",
		"",
	];
	for (const page of pages) {
		const content = rewriteMarkdownLinksForLlms(
			markdownContent(page.raw)
				.replace(/^#\s+.+(?:\r?\n)+/, "")
				.trim(),
			page.mdPath,
			siteUrl
		);
		lines.push(
			"---",
			"",
			`# ${page.title}`,
			"",
			`Source: ${absoluteSiteUrl(page.url, siteUrl)}`,
			"",
			content,
			""
		);
	}
	return (
		lines
			.join("\n")
			.replace(/\n{4,}/g, "\n\n\n")
			.trimEnd() + "\n"
	);
}

async function ensureDir(directory) {
	await fs.mkdir(directory, { recursive: true });
}

async function listMarkdownFiles(directory) {
	const files = [];
	async function walk(current) {
		for (const entry of await fs.readdir(current, { withFileTypes: true })) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(fullPath);
			else if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(path.relative(directory, fullPath).split(path.sep).join("/"));
			}
		}
	}
	await walk(directory);
	return files;
}

async function readSource(mdPath, generatedPages) {
	if (generatedPages.has(mdPath)) return generatedPages.get(mdPath);
	const override = path.join(SRC, "overrides", mdPath);
	const source = path.join(DOCS, mdPath);
	const target = existsSync(override) ? override : source;
	try {
		return await fs.readFile(target, "utf8");
	} catch {
		return null;
	}
}

async function copyFonts() {
	const fontPackages = [
		["@fontsource/atkinson-hyperlegible", ["400.css", "700.css"]],
		["@fontsource/azeret-mono", ["400.css", "500.css"]],
	];
	const fontOut = path.join(DIST, "fonts");
	const filesOut = path.join(fontOut, "files");
	await ensureDir(filesOut);
	const css = [];

	for (const [packageName, stylesheets] of fontPackages) {
		const packageDir = path.join(__dir, "node_modules", ...packageName.split("/"));
		for (const stylesheet of stylesheets) {
			css.push(await fs.readFile(path.join(packageDir, stylesheet), "utf8"));
		}
		const files = await fs.readdir(path.join(packageDir, "files"));
		for (const file of files) {
			if (!file.endsWith(".woff2")) continue;
			await fs.copyFile(path.join(packageDir, "files", file), path.join(filesOut, file));
		}
	}
	await fs.writeFile(path.join(fontOut, "fonts.css"), css.join("\n"));
}

function referencedAssets(htmlPages) {
	const assets = new Set();
	for (const html of htmlPages) {
		for (const match of html.matchAll(/(?:src|poster)="(\/assets\/[^"#?]+)[^"]*"/g)) {
			assets.add(decodeURIComponent(match[1].replace(/^\/assets\//, "")));
		}
	}
	return assets;
}

async function copyReferencedAssets(htmlPages) {
	for (const relativePath of referencedAssets(htmlPages)) {
		const source = path.join(DOCS, "assets", relativePath);
		if (!existsSync(source)) {
			if (relativePath.startsWith("release-videos/")) continue;
			throw new Error(`Published page references missing asset: docs/assets/${relativePath}`);
		}
		const target = path.join(DIST, "assets", relativePath);
		await ensureDir(path.dirname(target));
		await fs.copyFile(source, target);
	}
}

async function copyReferencedDocumentationFiles(htmlPages) {
	const files = new Set();
	for (const html of htmlPages) {
		for (const match of html.matchAll(/<a\b[^>]*\shref="\/([^"#?]+\.[A-Za-z0-9]+)[^"]*"/g)) {
			files.add(decodeURIComponent(match[1]));
		}
	}
	for (const relativePath of files) {
		const source = path.join(DOCS, relativePath);
		if (!existsSync(source) || !(await fs.stat(source)).isFile()) continue;
		const target = path.join(DIST, relativePath);
		await ensureDir(path.dirname(target));
		await fs.copyFile(source, target);
	}
}

async function writeStaticFiles(siteUrl, pages) {
	const staticDir = path.join(SRC, "static");
	if (existsSync(staticDir)) {
		await fs.cp(staticDir, DIST, { recursive: true });
	}
	const urls = pages
		.filter((page) => !page.noIndex)
		.map((page) => `  <url><loc>${escHtml(absoluteSiteUrl(page.url, siteUrl))}</loc></url>`)
		.join("\n");
	await fs.writeFile(
		path.join(DIST, "sitemap.xml"),
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
	);
	await fs.writeFile(
		path.join(DIST, "robots.txt"),
		`User-agent: *\nAllow: /\nSitemap: ${absoluteSiteUrl("/sitemap.xml", siteUrl)}\n`
	);
}

function renderTemplate(template, replacements) {
	let rendered = template;
	for (const [key, value] of Object.entries(replacements)) {
		rendered = rendered.replaceAll(`{{${key}}}`, value);
	}
	return rendered;
}

function statusLabel(fm, manifest) {
	if (fm.generated) return `Generated from source · TaskNotes ${manifest.version}`;
	return `Applies to TaskNotes ${manifest.version}`;
}

async function main() {
	const started = Date.now();
	const [configRaw, manifestRaw, template] = await Promise.all([
		fs.readFile(CONFIG, "utf8"),
		fs.readFile(MANIFEST, "utf8"),
		fs.readFile(path.join(SRC, "template.html"), "utf8"),
	]);
	const config = yaml.load(configRaw.replace(/!!python\/name:\S+/g, "null"));
	const manifest = JSON.parse(manifestRaw);
	const nav = config.nav;
	const siteUrl = normalizeSiteUrl(config.site_url);
	const siteDescription = config.site_description || "Task and note management for Obsidian.";
	const generatedPages = await buildGeneratedPages(manifest);
	const navPages = flattenNav(nav);
	const releasePages = (await listMarkdownFiles(path.join(DOCS, "releases"))).map(
		(file) => `releases/${file}`
	);
	const publishedPages = [...new Set([...navPages, ...releasePages])];
	const sourceByPath = new Map();
	const parsedByPath = new Map();

	for (const mdPath of publishedPages) {
		const source = await readSource(mdPath, generatedPages);
		if (!source) throw new Error(`Published page is missing: ${mdPath}`);
		const raw = replaceSourceTokens(source, manifest);
		sourceByPath.set(mdPath, raw);
		parsedByPath.set(mdPath, parseMarkdown(raw));
	}

	const pageTitles = new Map(
		[...parsedByPath].map(([mdPath, parsed]) => [mdPath, extractTitle(parsed.html, parsed.fm)])
	);

	await fs.rm(DIST, { recursive: true, force: true });
	await Promise.all([ensureDir(path.join(DIST, "styles")), ensureDir(path.join(DIST, "js"))]);
	await Promise.all([
		fs.copyFile(path.join(SRC, "styles", "main.css"), path.join(DIST, "styles", "main.css")),
		fs.copyFile(path.join(SRC, "js", "main.js"), path.join(DIST, "js", "main.js")),
		copyFonts(),
	]);

	const renderedPages = [];
	const llmsPages = [];
	const searchIndex = [];

	for (const mdPath of publishedPages) {
		const raw = sourceByPath.get(mdPath);
		const { fm, html: parsedHtml } = parsedByPath.get(mdPath);
		const url = mdPathToUrl(mdPath);
		const title = pageTitles.get(mdPath);
		const description = extractDescription(parsedHtml, fm, siteDescription);
		const body = stripH1(
			resolveDocumentationFileLinks(
				resolveMarkdownLinks(resolveAssetPaths(parsedHtml, mdPath), mdPath),
				mdPath
			)
		);
		const toc = buildToc(body);
		const canonical = absoluteSiteUrl(url, siteUrl);
		const noIndex = Boolean(fm.noindex || fm.draft);
		const content = [
			buildBreadcrumbs(nav, mdPath, title),
			'<header class="doc-header">',
			`<p class="doc-status">${escHtml(statusLabel(fm, manifest))}</p>`,
			`<h1 class="page-title">${escHtml(title)}</h1>`,
			"</header>",
			body,
			buildPageNavigation(navPages, mdPath, pageTitles),
		].join("\n");
		const page = renderTemplate(template, {
			title: escHtml(title),
			full_title: escHtml(`${title} | TaskNotes`),
			site_title: "TaskNotes",
			description: escHtml(description),
			canonical: escHtml(canonical),
			robots: noIndex ? '<meta name="robots" content="noindex">' : "",
			nav: buildNavHtml(nav, url),
			toc,
			content,
			version: escHtml(manifest.version),
		});
		const outputDirectory =
			url === "/" ? DIST : path.join(DIST, ...url.split("/").filter(Boolean));
		await ensureDir(outputDirectory);
		await fs.writeFile(path.join(outputDirectory, "index.html"), page);
		renderedPages.push({ mdPath, url, title, page, noIndex });

		if (navPages.includes(mdPath)) {
			llmsPages.push({ mdPath, raw, title, url });
			searchIndex.push({
				title,
				url,
				description,
				text: stripHtml(body).replace(/\s+/g, " ").trim().slice(0, 12000),
			});
		}
	}

	for (const [from, to] of Object.entries(config.redirects || {})) {
		const redirectUrl = from.startsWith("/") ? from : `/${from}`;
		const outputDirectory = path.join(DIST, ...redirectUrl.split("/").filter(Boolean));
		await ensureDir(outputDirectory);
		await fs.writeFile(
			path.join(outputDirectory, "index.html"),
			`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="canonical" href="${escHtml(absoluteSiteUrl(to, siteUrl))}"><meta http-equiv="refresh" content="0; url=${escHtml(to)}"><title>Moved | TaskNotes</title></head><body><p>This page moved to <a href="${escHtml(to)}">${escHtml(to)}</a>.</p></body></html>`
		);
	}

	const notFound = renderTemplate(template, {
		title: "Page not found",
		full_title: "Page not found | TaskNotes",
		site_title: "TaskNotes",
		description: "The requested TaskNotes documentation page could not be found.",
		canonical: absoluteSiteUrl("/404.html", siteUrl),
		robots: '<meta name="robots" content="noindex">',
		nav: buildNavHtml(nav, ""),
		toc: "",
		content:
			'<header class="doc-header"><p class="doc-status">404</p><h1 class="page-title">Page not found</h1></header><p>The page may have moved during the TaskNotes v5 documentation reorganization.</p><p><a href="/">Return to the documentation home</a> or use search.</p>',
		version: escHtml(manifest.version),
	});
	await fs.writeFile(path.join(DIST, "404.html"), notFound);

	await Promise.all([
		fs.writeFile(path.join(DIST, "search-index.json"), JSON.stringify(searchIndex)),
		fs.writeFile(
			path.join(DIST, "llms.txt"),
			buildLlmsTxt(llmsPages, siteUrl, siteDescription)
		),
		fs.writeFile(
			path.join(DIST, "llms-full.txt"),
			buildLlmsFullTxt(llmsPages, siteUrl, siteDescription)
		),
		copyReferencedAssets(renderedPages.map((page) => page.page)),
		copyReferencedDocumentationFiles(renderedPages.map((page) => page.page)),
		writeStaticFiles(siteUrl, renderedPages),
	]);

	const cname = path.join(DOCS, "CNAME");
	if (existsSync(cname)) await fs.copyFile(cname, path.join(DIST, "CNAME"));

	console.log(
		`Built ${renderedPages.length} published pages and ${generatedPages.size} source-generated references in ${Date.now() - started}ms`
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
