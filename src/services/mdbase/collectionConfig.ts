import YAML from "yaml";
import type { TaskNotesSettings } from "../../types/settings";

/** Omission has engine semantics; an explicit empty list disables explicit membership. */
export function effectiveMembershipKeys(value: unknown): string[] {
	if (value === undefined) return ["type", "types"];
	if (!Array.isArray(value) || value.some((key) => typeof key !== "string" || !key.trim())) {
		throw new Error("Invalid explicit_type_keys; existing collection settings were preserved.");
	}
	return value as string[];
}

/** Only add required values. Keep user extensions, ordering, comments and membership semantics. */
export function addAppCollectionConfig(markdown: string, settings: TaskNotesSettings): string {
	const document = YAML.parseDocument(markdown);
	if (document.errors.length) throw new Error("Cannot reconcile invalid mdbase.yaml");
	let changed = false;
	const add = (path: string[], required: string[], defaults: string[] = []) => {
		const node = document.getIn(path, true);
		const current: unknown = YAML.isNode(node) ? node.toJSON() : node;
		if (current !== undefined && (!Array.isArray(current) || current.some((v) => typeof v !== "string"))) {
			throw new Error(`Invalid ${path.join(".")}; existing collection settings were preserved.`);
		}
		const values = current === undefined ? defaults : current as string[];
		const next = [...new Set([...values, ...required])];
		if (current === undefined || next.length !== values.length) {
			document.setIn(path, next);
			changed = true;
		}
	};
	add(["settings", "record_extensions"], ["md", "base"], ["md"]);
	const folders = new Set(["TaskNotes/Views"]);
	for (const file of Object.values(settings.commandFileMapping ?? {})) {
		if (typeof file === "string" && file.endsWith(".base")) {
			const folder = file.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
			if (folder) folders.add(folder);
		}
	}
	add(["x-obsidian", "bases", "include"], [...folders].map((folder) => `${folder}/**/*.base`));
	return changed ? document.toString() : markdown;
}

export function excludedTaskFolders(value: string): string[] {
	return [...new Set(value.split(",").map((folder) => folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")).filter(Boolean))];
}

/** Match predicates are ANDed by the engine; do not globally exclude foreign record types. */
export function taskExclusionExpression(value: string): string | null {
	const folders = excludedTaskFolders(value);
	return folders.length ? folders.map((folder) => `!file.path.startsWith(${JSON.stringify(`${folder}/`)})`).join(" && ") : null;
}

/** Preserve a user expression while replacing only our previously recorded exclusion predicate. */
export function applyTaskExclusions(markdown: string, value: string): string {
	const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) throw new Error("Missing type frontmatter");
	const document = YAML.parseDocument(match[1]);
	if (document.errors.length) throw new Error("Invalid type frontmatter");
	const previousNode = document.getIn(["x-tasknotes-generator", "excluded_folders"], true);
	const previous: unknown = YAML.isNode(previousNode) ? previousNode.toJSON() : previousNode;
	const folders = excludedTaskFolders(value);
	if (JSON.stringify(previous) === JSON.stringify(folders) || (previous === undefined && !folders.length)) return markdown;
	const oldExpression = document.getIn(["x-tasknotes-generator", "exclusion_expression"]);
	let expression = document.getIn(["match", "expr", "$expr"]);
	if (typeof expression === "string" && typeof oldExpression === "string") {
		if (expression === oldExpression) expression = undefined;
		else if (expression.endsWith(` && (${oldExpression})`)) expression = expression.slice(1, -(oldExpression.length + 7));
		else throw new Error("The managed exclusion expression was edited; review match.expr before changing excluded folders");
	}
	const exclusion = taskExclusionExpression(value);
	if (exclusion) document.setIn(["match", "expr"], { $expr: typeof expression === "string" ? `(${expression}) && (${exclusion})` : exclusion });
	else if (typeof expression === "string") document.setIn(["match", "expr"], { $expr: expression });
	else document.deleteIn(["match", "expr"]);
	document.setIn(["x-tasknotes-generator", "excluded_folders"], folders);
	if (exclusion) document.setIn(["x-tasknotes-generator", "exclusion_expression"], exclusion);
	else document.deleteIn(["x-tasknotes-generator", "exclusion_expression"]);
	return `---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${markdown.slice(match[0].length)}`;
}
