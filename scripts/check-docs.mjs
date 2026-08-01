#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { parse as parseYaml } from "yaml";

const root = process.cwd();
const docs = path.join(root, "docs");
const configPath = path.join(root, "mkdocs.yml");
const manifestPath = path.join(root, "manifest.json");
const errors = [];
const generatedPages = new Set([
	"reference/commands.md",
	"reference/compatibility.md",
	"reference/settings-source.md",
	"reference/http-routes.md",
	"reference/default-base-templates.md",
]);

function walk(directory, predicate, files = []) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const target = path.join(directory, entry.name);
		if (entry.isDirectory()) walk(target, predicate, files);
		else if (predicate(target)) files.push(target);
	}
	return files;
}

function flattenNav(items, pages = []) {
	for (const item of items) {
		const value = Object.values(item)[0];
		if (typeof value === "string") pages.push(value);
		else if (Array.isArray(value)) flattenNav(value, pages);
	}
	return pages;
}

function normalizeLink(link) {
	return decodeURIComponent(link.split("#")[0].split("?")[0]).trim();
}

function stripCode(content) {
	return content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
}

const configRaw = fs.readFileSync(configPath, "utf8");
const config = parseYaml(configRaw);
const navPages = flattenNav(config.nav || []);
const navSet = new Set(navPages);
const draftSet = new Set(config.drafts || []);
const gitmodulesPath = path.join(root, ".gitmodules");
const submodulePaths = fs.existsSync(gitmodulesPath)
	? [...fs.readFileSync(gitmodulesPath, "utf8").matchAll(/^\s*path\s*=\s*(.+)$/gm)].map((match) =>
			match[1].trim()
		)
	: [];
let trackedSubmoduleFiles = new Set();
try {
	trackedSubmoduleFiles = new Set(
		execFileSync("git", ["ls-files", "--recurse-submodules", "docs"], {
			cwd: root,
			encoding: "utf8",
		})
			.trim()
			.split("\n")
			.filter(Boolean)
	);
} catch {
	// A missing submodule produces no files to classify or publish.
}
const markdownFiles = walk(docs, (file) => file.endsWith(".md")).filter((file) => {
	const relative = path.relative(root, file).split(path.sep).join("/");
	const submodule = submodulePaths.find(
		(candidate) => relative === candidate || relative.startsWith(`${candidate}/`)
	);
	return !submodule || trackedSubmoduleFiles.has(relative);
});
const relativeMarkdown = markdownFiles.map((file) =>
	path.relative(docs, file).split(path.sep).join("/")
);

for (const staleKey of ["theme:", "markdown_extensions:", "extra_css:"]) {
	if (configRaw.includes(`\n${staleKey}`)) {
		errors.push(`mkdocs.yml still contains unused MkDocs configuration: ${staleKey}`);
	}
}

for (const page of navPages) {
	if (!generatedPages.has(page) && !fs.existsSync(path.join(docs, page))) {
		errors.push(`Navigation references missing page: docs/${page}`);
	}
	if (draftSet.has(page)) errors.push(`Page is both published and draft: docs/${page}`);
}

for (const page of generatedPages) {
	if (!navSet.has(page))
		errors.push(`Generated reference is not published in navigation: ${page}`);
}

for (const page of draftSet) {
	if (!fs.existsSync(path.join(docs, page))) {
		errors.push(`Draft list references missing page: docs/${page}`);
	}
}

for (const page of relativeMarkdown) {
	if (page.startsWith("releases/")) continue;
	if (!navSet.has(page) && !draftSet.has(page)) {
		errors.push(`Documentation source is not classified as published or draft: docs/${page}`);
	}
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
if (!readme.includes("https://tasknotes.dev/")) {
	errors.push("README.md is missing the canonical documentation URL");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const releaseIndex = fs.readFileSync(path.join(docs, "releases.md"), "utf8");
if (!fs.existsSync(path.join(docs, "releases", `${manifest.version}.md`))) {
	errors.push(`Missing release page for manifest version ${manifest.version}`);
}
if (!releaseIndex.includes(`releases/${manifest.version}.md`)) {
	errors.push(`Release index is missing manifest version ${manifest.version}`);
}

const docsPrivacy = fs.readFileSync(path.join(docs, "privacy.md"), "utf8").trimEnd();
const rootPrivacy = fs.readFileSync(path.join(root, "PRIVACY.md"), "utf8").trimEnd();
if (docsPrivacy !== rootPrivacy) errors.push("PRIVACY.md is out of sync with docs/privacy.md");

const linkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
for (const file of markdownFiles) {
	const relativeFile = path.relative(root, file);
	const source = fs.readFileSync(file, "utf8");
	const content = stripCode(source);

	for (const image of content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
		if (!image[1].trim()) errors.push(`${relativeFile}: image has empty alt text`);
	}

	for (const match of content.matchAll(linkPattern)) {
		const raw = match[1].replace(/^<|>$/g, "").trim();
		if (
			!raw ||
			raw.startsWith("#") ||
			raw.startsWith("/") ||
			/^(?:https?:|mailto:|data:)/.test(raw)
		) {
			continue;
		}
		const normalized = normalizeLink(raw);
		if (!normalized) continue;
		const relativeTarget = path
			.relative(docs, path.resolve(path.dirname(file), normalized))
			.split(path.sep)
			.join("/");
		if (generatedPages.has(relativeTarget)) continue;
		if (!fs.existsSync(path.resolve(path.dirname(file), normalized))) {
			errors.push(`${relativeFile}: broken local link ${raw}`);
		}
	}
}

for (const page of navPages) {
	if (generatedPages.has(page)) continue;
	const source = fs.readFileSync(path.join(docs, page), "utf8");
	if (/contexts:\s*(?:\[[^\]]*"@|(?:\r?\n)\s*-\s*"@)/.test(source)) {
		errors.push(`docs/${page}: context frontmatter example includes the @ input prefix`);
	}
	if (/tags:\s*(?:\[[^\]]*"#|(?:\r?\n)\s*-\s*"#)/.test(source)) {
		errors.push(`docs/${page}: tag frontmatter example includes the # display prefix`);
	}
}

const allMarkdown = markdownFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
let trackedAssets = [];
try {
	trackedAssets = execFileSync("git", ["ls-files", "docs/assets"], {
		cwd: root,
		encoding: "utf8",
	})
		.trim()
		.split("\n")
		.filter(Boolean);
} catch {
	// The rendered-site check still verifies all published assets outside Git.
}
for (const asset of trackedAssets) {
	if (!fs.existsSync(path.join(root, asset))) continue;
	const relative = asset.replace(/^docs\/assets\//, "");
	if (
		!allMarkdown.includes(`assets/${relative}`) &&
		!allMarkdown.includes(`assets/${encodeURI(relative)}`)
	) {
		errors.push(`Tracked documentation asset is unreferenced: ${asset}`);
	}
}

if (errors.length) {
	console.error(`Documentation source checks failed (${errors.length}):`);
	for (const error of errors) console.error(`- ${error}`);
	process.exit(1);
}

console.log(
	`Documentation source checks passed (${navPages.length} published navigation pages, ${draftSet.size} explicit drafts, ${generatedPages.size} generated references).`
);
