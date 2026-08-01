#!/usr/bin/env node

import fs from "fs";
import path from "path";

const root = process.cwd();
const dist = path.resolve(root, process.argv[2] || "docs-builder/dist");
const errors = [];

function walk(directory, predicate, files = []) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(target, predicate, files);
		else if (predicate(target)) files.push(target);
	}
	return files;
}

function routeForFile(file) {
	const relative = path.relative(dist, file).split(path.sep).join("/");
	if (relative === "index.html") return "/";
	if (relative.endsWith("/index.html")) return `/${relative.slice(0, -10)}`;
	return `/${relative}`;
}

function targetFileForUrl(urlPath) {
	const decoded = decodeURIComponent(urlPath);
	if (decoded === "/") return path.join(dist, "index.html");
	if (path.extname(decoded)) return path.join(dist, decoded.slice(1));
	return path.join(dist, decoded.slice(1), "index.html");
}

function localTarget(href, route) {
	const withoutQuery = href.split("?")[0];
	const [hrefPath, fragment = ""] = withoutQuery.split("#");
	const base = new URL(route, "https://tasknotes.dev");
	const resolved = new URL(hrefPath || base.pathname, base);
	let file = targetFileForUrl(resolved.pathname);
	if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
		file = path.join(file, "index.html");
	}
	return { file, fragment };
}

if (!fs.existsSync(dist)) {
	console.error(`Built documentation not found: ${dist}`);
	process.exit(1);
}

const htmlFiles = walk(dist, (file) => file.endsWith(".html"));
const idsByFile = new Map();

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const route = routeForFile(file);
	const redirect = /http-equiv="refresh"/i.test(html);
	const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
	const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
	idsByFile.set(file, new Set(ids));

	if (duplicateIds.length) {
		errors.push(`${route}: duplicate IDs: ${[...new Set(duplicateIds)].join(", ")}`);
	}
	if (/!!!\s+(?:warning|note|tip|danger)/.test(html)) {
		errors.push(`${route}: contains unrendered admonition syntax`);
	}
	if (/&amp;amp;/.test(html)) {
		errors.push(`${route}: contains a double-escaped entity`);
	}
	if (/fonts\.googleapis|fonts\.gstatic/.test(html)) {
		errors.push(`${route}: loads a remote Google font`);
	}

	if (!redirect) {
		const h1Count = (html.match(/<h1\b/g) || []).length;
		if (h1Count !== 1) errors.push(`${route}: expected one h1, found ${h1Count}`);
		for (const marker of [
			'<a class="skip-link" href="#main">',
			'<main class="prose" id="main">',
			'<meta name="description"',
			'<link rel="canonical"',
			'<meta property="og:title"',
			'<meta name="twitter:card"',
			'aria-label="TaskNotes documentation"',
		]) {
			if (!html.includes(marker)) errors.push(`${route}: missing ${marker}`);
		}
	}

	for (const image of html.matchAll(/<img\b([^>]*)>/g)) {
		const attributes = image[1];
		if (!/\balt="[^"]+"/.test(attributes)) {
			errors.push(`${route}: image is missing useful alt text`);
		}
		if (!/\bloading="lazy"/.test(attributes) || !/\bdecoding="async"/.test(attributes)) {
			errors.push(`${route}: image is missing lazy-loading attributes`);
		}
	}
	for (const iframe of html.matchAll(/<iframe\b([^>]*)>/g)) {
		if (!/\bloading="lazy"/.test(iframe[1])) {
			errors.push(`${route}: iframe is missing lazy loading`);
		}
	}
	if (Buffer.byteLength(html) > 350_000) {
		errors.push(`${route}: HTML exceeds the 350 KB page budget`);
	}
}

for (const file of htmlFiles) {
	const html = fs.readFileSync(file, "utf8");
	const route = routeForFile(file);
	for (const link of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
		const href = link[1];
		if (
			!href ||
			href.startsWith("mailto:") ||
			href.startsWith("tel:") ||
			href.startsWith("javascript:") ||
			href.startsWith("http://") ||
			href.startsWith("https://") ||
			href.startsWith("//")
		) {
			continue;
		}
		const target = localTarget(href, route);
		if (!fs.existsSync(target.file)) {
			errors.push(`${route}: broken local link ${href}`);
			continue;
		}
		if (target.fragment) {
			const targetIds =
				idsByFile.get(target.file) ||
				new Set(
					[...fs.readFileSync(target.file, "utf8").matchAll(/\sid="([^"]+)"/g)].map(
						(match) => match[1]
					)
				);
			if (!targetIds.has(decodeURIComponent(target.fragment))) {
				errors.push(`${route}: missing fragment target ${href}`);
			}
		}
	}
	for (const media of html.matchAll(
		/<(?:img|source|video|iframe)\b[^>]*\s(?:src|poster)="([^"]+)"/g
	)) {
		const source = media[1];
		if (/^(?:https?:|data:|\/\/)/.test(source)) continue;
		const target = localTarget(source, route);
		if (!fs.existsSync(target.file)) errors.push(`${route}: broken media source ${source}`);
	}
}

const assetsDirectory = path.join(dist, "assets");
if (fs.existsSync(assetsDirectory)) {
	const assets = walk(assetsDirectory, () => true);
	const totalBytes = assets.reduce((total, file) => total + fs.statSync(file).size, 0);
	if (totalBytes > 40 * 1024 * 1024) {
		errors.push(
			`Published assets exceed the 40 MiB budget (${(totalBytes / 1024 / 1024).toFixed(1)} MiB)`
		);
	}
	for (const asset of assets) {
		const size = fs.statSync(asset).size;
		const extension = path.extname(asset).toLowerCase();
		const limit = [".mp4", ".webm"].includes(extension) ? 20 : 5;
		if (size > limit * 1024 * 1024) {
			errors.push(`${path.relative(dist, asset)} exceeds the ${limit} MiB asset budget`);
		}
	}
}

for (const required of [
	"404.html",
	"favicon.svg",
	"site.webmanifest",
	"robots.txt",
	"sitemap.xml",
	"search-index.json",
	"llms.txt",
	"llms-full.txt",
]) {
	if (!fs.existsSync(path.join(dist, required))) {
		errors.push(`Missing generated site artifact: ${required}`);
	}
}

if (errors.length) {
	console.error(`Built documentation checks failed (${errors.length}):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(
	`Built documentation checks passed (${htmlFiles.length} HTML files, links, fragments, media, metadata, accessibility, and budgets).`
);
