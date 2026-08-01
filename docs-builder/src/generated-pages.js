import fs from "fs/promises";
import path from "path";
import { build as bundle } from "esbuild";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function frontmatter(title, description, sourceFiles) {
	return [
		"---",
		`title: ${JSON.stringify(title)}`,
		`description: ${JSON.stringify(description)}`,
		"generated: true",
		`source: ${JSON.stringify(sourceFiles)}`,
		"---",
		"",
	].join("\n");
}

function getTranslation(tree, key) {
	return key.split(".").reduce((value, segment) => value?.[segment], tree);
}

function markdownTableCell(value) {
	return String(value)
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "`[$1]($2)`")
		.replaceAll("|", "\\|")
		.replaceAll("\n", " ");
}

function propertyName(node) {
	if (ts.isIdentifier(node) || ts.isStringLiteral(node)) {
		return node.text;
	}
	return "";
}

function stringValue(node) {
	return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
		? node.text
		: undefined;
}

function walk(node, visit) {
	visit(node);
	node.forEachChild((child) => walk(child, visit));
}

async function sourceFile(relativePath) {
	const absolutePath = path.join(ROOT, relativePath);
	const source = await fs.readFile(absolutePath, "utf8");
	return ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
}

async function loadRuntimeDocumentationData() {
	const entry = `
		import { en } from "./src/i18n/resources/en.ts";
		import { DEFAULT_SETTINGS } from "./src/settings/defaults.ts";
		import { FieldMapper } from "./src/core/FieldMapper.ts";
		import { generateBasesFileTemplate } from "./src/templates/defaultBasesFiles.ts";

		const fieldMapper = new FieldMapper(
			DEFAULT_SETTINGS.fieldMapping,
			DEFAULT_SETTINGS.userFields,
			DEFAULT_SETTINGS.customStatuses,
			DEFAULT_SETTINGS.customPriorities
		);
		const plugin = { settings: DEFAULT_SETTINGS, fieldMapper };
		const baseIds = Object.keys(DEFAULT_SETTINGS.commandFileMapping);
		const baseTemplates = Object.fromEntries(
			baseIds.map((id) => [id, generateBasesFileTemplate(id, plugin)])
		);

		export { en, DEFAULT_SETTINGS, baseTemplates };
	`;

	const result = await bundle({
		stdin: {
			contents: entry,
			resolveDir: ROOT,
			sourcefile: "tasknotes-docs-runtime.ts",
			loader: "ts",
		},
		bundle: true,
		format: "esm",
		platform: "node",
		target: "node22",
		nodePaths: [path.join(ROOT, "docs-builder", "node_modules")],
		write: false,
		logLevel: "silent",
	});
	const encoded = Buffer.from(result.outputFiles[0].text).toString("base64");
	return import(`data:text/javascript;base64,${encoded}`);
}

async function commandCatalog(en) {
	const source = await sourceFile("src/commands/taskNotesCommands.ts");
	const commands = [];

	walk(source, (node) => {
		if (!ts.isObjectLiteralExpression(node)) {
			return;
		}
		const values = Object.fromEntries(
			node.properties
				.filter(ts.isPropertyAssignment)
				.map((property) => [propertyName(property.name), stringValue(property.initializer)])
		);
		if (values.id && values.nameKey) {
			const name = getTranslation(en, values.nameKey);
			commands.push({
				id: values.id,
				name: typeof name === "string" ? name : values.nameKey,
				context: node.properties.some(
					(property) =>
						ts.isPropertyAssignment(property) &&
						propertyName(property.name) === "editorCallback"
				)
					? "Editor"
					: "Global",
			});
		}
	});

	return commands;
}

function translationArgument(call) {
	if (!call || !ts.isCallExpression(call)) {
		return undefined;
	}
	const expression = call.expression;
	const isTranslate =
		(ts.isIdentifier(expression) && expression.text === "translate") ||
		(ts.isPropertyAccessExpression(expression) && expression.name.text === "translate");
	return isTranslate ? stringValue(call.arguments[0]) : undefined;
}

function collectSettingControls(source, en) {
	const controls = new Map();

	function add(nameKey, descriptionKey) {
		if (!nameKey) {
			return;
		}
		const name = getTranslation(en, nameKey);
		const description = descriptionKey ? getTranslation(en, descriptionKey) : undefined;
		if (typeof name !== "string" || controls.has(nameKey)) {
			return;
		}
		controls.set(nameKey, {
			name,
			description: typeof description === "string" ? description : "",
		});
	}

	walk(source, (node) => {
		if (ts.isObjectLiteralExpression(node)) {
			const properties = new Map(
				node.properties
					.filter(ts.isPropertyAssignment)
					.map((property) => [propertyName(property.name), property.initializer])
			);
			const nameKey = translationArgument(properties.get("name"));
			const descriptionKey =
				translationArgument(properties.get("description")) ||
				translationArgument(properties.get("desc"));
			add(nameKey, descriptionKey);
		}

		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === "setName"
		) {
			const nameKey = translationArgument(node.arguments[0]);
			const parent = node.parent;
			let descriptionKey;
			if (
				ts.isPropertyAccessExpression(parent) &&
				ts.isCallExpression(parent.parent) &&
				ts.isPropertyAccessExpression(parent.parent.expression) &&
				parent.parent.expression.name.text === "setDesc"
			) {
				descriptionKey = translationArgument(parent.parent.arguments[0]);
			}
			add(nameKey, descriptionKey);
		}
	});

	return [...controls.values()];
}

async function settingsCatalog(en) {
	const tabSource = await sourceFile("src/settings/TaskNotesSettingTab.ts");
	const tabIds = new Map();

	walk(tabSource, (node) => {
		if (!ts.isObjectLiteralExpression(node)) {
			return;
		}
		const values = Object.fromEntries(
			node.properties
				.filter(ts.isPropertyAssignment)
				.map((property) => [propertyName(property.name), stringValue(property.initializer)])
		);
		if (values.id && values.nameKey?.startsWith("settings.tabs.")) {
			tabIds.set(values.id, values.nameKey);
		}
	});

	const fileNames = {
		general: "generalTab.ts",
		"task-properties": "taskPropertiesTab.ts",
		"modal-fields": "modalFieldsTab.ts",
		appearance: "appearanceTab.ts",
		features: "featuresTab.ts",
		integrations: "integrationsTab.ts",
	};
	const tabs = [];

	for (const [id, nameKey] of tabIds) {
		const fileName = fileNames[id];
		if (!fileName) {
			continue;
		}
		const source = await sourceFile(`src/settings/tabs/${fileName}`);
		tabs.push({
			id,
			name: getTranslation(en, nameKey) || id,
			source: `src/settings/tabs/${fileName}`,
			controls: collectSettingControls(source, en),
		});
	}

	return tabs;
}

async function httpRoutes() {
	const apiDir = path.join(ROOT, "src/api");
	const files = (await fs.readdir(apiDir))
		.filter((file) => file.endsWith("Controller.ts"))
		.sort();
	const routes = [];

	for (const file of files) {
		const source = await fs.readFile(path.join(apiDir, file), "utf8");
		for (const match of source.matchAll(/@(Get|Post|Put|Patch|Delete)\("([^"]+)"\)/g)) {
			routes.push({
				method: match[1].toUpperCase(),
				path: match[2],
				controller: file.replace(/\.ts$/, ""),
			});
		}
	}

	return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

async function verifyHttpGuideParity(routes) {
	const guides = await Promise.all(
		["docs/HTTP_API.md", "docs/nlp-api.md"].map((file) =>
			fs.readFile(path.join(ROOT, file), "utf8")
		)
	);
	const guide = guides.join("\n");
	const documented = new Set(
		[...guide.matchAll(/#{2,4}\s+`(GET|POST|PUT|PATCH|DELETE)\s+([^`]+)`/g)].map(
			(match) => `${match[1]} ${match[2]}`
		)
	);
	const missing = routes
		.map((route) => `${route.method} ${route.path}`)
		.filter((route) => !documented.has(route));
	if (missing.length) {
		throw new Error(
			`HTTP API guide is missing implemented routes:\n${missing.map((route) => `- ${route}`).join("\n")}`
		);
	}
}

function commandsPage(commands) {
	const rows = commands
		.map(
			(command) =>
				`| ${command.name.replaceAll("|", "\\|")} | \`${command.id}\` | ${command.context} |`
		)
		.join("\n");
	return `${frontmatter(
		"Command reference",
		"Every TaskNotes command registered with Obsidian, generated from the plugin command definitions.",
		["src/commands/taskNotesCommands.ts", "src/i18n/resources/en.ts"]
	)}# Command reference

This page is generated from the commands registered by TaskNotes. Command IDs are stable integration identifiers; names are the English labels shown in Obsidian.

| Command | ID | Available in |
| --- | --- | --- |
${rows}

_Generated from ${commands.length} registered commands._
`;
}

function compatibilityPage(manifest) {
	return `${frontmatter(
		"Version compatibility",
		"Current TaskNotes and Obsidian compatibility requirements, generated from the plugin manifest.",
		["manifest.json", "versions.json"]
	)}# Version compatibility

## Current release

| Item | Value |
| --- | --- |
| TaskNotes | \`${manifest.version}\` |
| Minimum Obsidian version | \`${manifest.minAppVersion}\` |
| Desktop only | ${manifest.isDesktopOnly ? "Yes" : "No"} |
| Bases core plugin | Required |

The minimum version above applies to the current TaskNotes release. Older releases had different requirements; consult \`versions.json\` or the relevant [release note](/releases/) when maintaining an older installation.
`;
}

function settingsPage(tabs, defaults) {
	const sections = tabs
		.map((tab) => {
			const rows = tab.controls.length
				? tab.controls
						.map(
							(control) =>
								`| ${markdownTableCell(control.name)} | ${markdownTableCell(control.description || "See the setting in Obsidian for contextual details.")} |`
						)
						.join("\n")
				: "| No static controls detected | This tab is assembled dynamically. |";
			return `## ${tab.name}

Source: \`${tab.source}\`

| Setting | Purpose |
| --- | --- |
${rows}`;
		})
		.join("\n\n");
	const defaultJson = JSON.stringify(defaults, null, 2);

	return `${frontmatter(
		"Settings source reference",
		"The six TaskNotes settings tabs, their controls, and the complete default settings snapshot generated from source.",
		[
			"src/settings/TaskNotesSettingTab.ts",
			"src/settings/tabs/*.ts",
			"src/settings/defaults.ts",
			"src/i18n/resources/en.ts",
		]
	)}# Settings source reference

TaskNotes currently exposes ${tabs.length} settings tabs. This inventory is generated from the tab renderer and English translation source so additions cannot silently disappear from the documentation.

${sections}

## Complete default settings snapshot

The following JSON is generated from \`DEFAULT_SETTINGS\`. Empty strings and disabled flags are intentional defaults.

\`\`\`json
${defaultJson}
\`\`\`
`;
}

function routesPage(routes) {
	const rows = routes
		.map((route) => `| \`${route.method}\` | \`${route.path}\` | \`${route.controller}\` |`)
		.join("\n");
	return `${frontmatter(
		"HTTP route index",
		"Implemented TaskNotes HTTP API routes generated from controller decorators.",
		["src/api/*Controller.ts", "docs/HTTP_API.md", "docs/nlp-api.md"]
	)}# HTTP route index

This index is generated from controller route decorators. The build fails if an implemented route is absent from the narrative [HTTP API guide](/HTTP_API/) or [NLP API guide](/nlp-api/).

| Method | Path | Controller |
| --- | --- | --- |
${rows}

_Generated from ${routes.length} implemented routes._
`;
}

function basesPage(baseTemplates, commandFileMapping) {
	const sections = Object.entries(baseTemplates)
		.map(([id, template]) => {
			const output = commandFileMapping[id] || `${id}.base`;
			return `## ${output.split("/").at(-1)}

Command/template ID: \`${id}\`

\`\`\`yaml
${template.trimEnd()}
\`\`\``;
		})
		.join("\n\n");

	return `${frontmatter(
		"Generated default Base templates",
		"Exact default Obsidian Base files generated by the current TaskNotes source and default settings.",
		[
			"src/templates/defaultBasesFiles.ts",
			"src/settings/defaults.ts",
			"src/core/FieldMapper.ts",
		]
	)}# Generated default Base templates

These are the exact templates TaskNotes ${"${tasknotes.version}"} produces with default settings. Your generated files reflect your own field mapping and other settings, so customized output can differ.

Regenerating with **Update files** overwrites configured default Base files. Copy a customized file to a new path before updating it.

${sections}
`;
}

export async function buildGeneratedPages(manifest) {
	const runtime = await loadRuntimeDocumentationData();
	const [commands, tabs, routes] = await Promise.all([
		commandCatalog(runtime.en),
		settingsCatalog(runtime.en),
		httpRoutes(),
	]);
	await verifyHttpGuideParity(routes);

	return new Map([
		["reference/commands.md", commandsPage(commands)],
		["reference/compatibility.md", compatibilityPage(manifest)],
		["reference/settings-source.md", settingsPage(tabs, runtime.DEFAULT_SETTINGS)],
		["reference/http-routes.md", routesPage(routes)],
		[
			"reference/default-base-templates.md",
			basesPage(runtime.baseTemplates, runtime.DEFAULT_SETTINGS.commandFileMapping),
		],
	]);
}
