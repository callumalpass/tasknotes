import { type TFile } from "obsidian";
import YAML from "yaml";
import type TaskNotesPlugin from "../../main";
import { parseMdbaseTaskTypeDocument, validateCanonicalTaskType, withCurrentTaskNotesContract } from "../mdbaseCanonicalConfig";
import { compileRecordSchema, validateTaskRecord, validationIssues } from "./contractValidation";
import { effectiveMembershipKeys, excludedTaskFolders, taskExclusionExpression } from "./collectionConfig";
import { backupCollectionFile } from "./backups";
import { withVaultFileMutation, processVaultFileWithinMutation } from "../VaultMutationService";

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectValue : {};
export type CollectionProblem = {
	file: TFile;
	content: string;
	issues: string[];
	dateCreatedField: string;
	missingDateCreated: boolean;
	statusField: string;
	invalidStatus: boolean;
	statusValues: string[];
};

function globMatches(pattern: string, file: string): boolean {
	let regex = "";
	for (let index = 0; index < pattern.length; index++) {
		const char = pattern[index];
		if (char === "*" && pattern[index + 1] === "*") {
			index++;
			if (pattern[index + 1] === "/") { regex += "(?:.*/)?"; index++; }
			else regex += ".*";
		} else if (char === "*") regex += "[^/]*";
		else if (char === "?") regex += "[^/]";
		else regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${regex}$`).test(file);
}

function recordDocument(content: string): { document: YAML.Document; body: string; prefix: string } {
	const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) return { document: new YAML.Document({}), body: content, prefix: "" };
	const document = YAML.parseDocument(match[1]);
	if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("; "));
	return { document, body: content.slice(match[0].length), prefix: content.startsWith("\uFEFF") ? "\uFEFF" : "" };
}

/** Explicit scan only. Migration never invokes this and never reads or repairs task notes. */
export async function checkCollection(plugin: TaskNotesPlugin): Promise<CollectionProblem[]> {
	const vault = plugin.app.vault;
	const config = object(YAML.parse(await vault.adapter.read("mdbase.yaml")));
	const settings = object(config.settings);
	const typesFolder = typeof settings.types_folder === "string" ? settings.types_folder : "_types";
	const keys = effectiveMembershipKeys(settings.explicit_type_keys);
	const providers = vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${typesFolder}/`));
	const problems: CollectionProblem[] = [];
	const excluded = excludedTaskFolders(plugin.settings.excludedFolders || "");
	const collectionExcludes = Array.isArray(settings.exclude) ? settings.exclude.filter((value): value is string => typeof value === "string") : [];
	let providerCount = 0;
	for (const provider of providers) {
		const parsed = parseMdbaseTaskTypeDocument(await vault.read(provider));
		const type = withCurrentTaskNotesContract(parsed.type).type;
		const implementation = Array.isArray(type.implements) ? type.implements.map(object).find((value) => value.contract === "tasknotes.task") : undefined;
		if (!implementation) continue;
		providerCount++;
		const valid = validateCanonicalTaskType(type);
		if (!valid.valid) throw new Error(`${provider.path}: ${valid.issues.join("; ")}`);
		const fields = object(implementation.fields);
		const schema = object(object(type.schema).value);
		const validate = compileRecordSchema(schema);
		const statusField = fields.status as string;
		const dateCreatedField = fields.dateCreated as string;
		const statusValues = object(object(implementation.binding).status).values as string[];
		const match = object(type.match);
		const where = object(match.where);
		const pathGlobs = typeof match.path_glob === "string" ? [match.path_glob] : Array.isArray(match.path_glob) ? match.path_glob.filter((value): value is string => typeof value === "string") : [];
		const expression = object(match.expr).$expr;
		const ownFolders = object(type["x-tasknotes-generator"]).excluded_folders;
		const ownExpression = taskExclusionExpression(Array.isArray(ownFolders) ? ownFolders.join(",") : "");
		if (expression !== undefined && expression !== ownExpression) throw new Error(`${provider.path}: custom match.expr needs engine validation with mdbase validate; no repairs were made`);
		const matchExclusions = Array.isArray(ownFolders) ? ownFolders.filter((value): value is string => typeof value === "string") : [];
		for (const file of vault.getMarkdownFiles()) {
			if (file.path.startsWith(`${typesFolder}/`) || file.path.startsWith(".tasknotes/") || excluded.some((folder) => file.path.startsWith(`${folder}/`)) || collectionExcludes.some((pattern) => file.path.startsWith(`${pattern}/`) || globMatches(pattern, file.path))) continue;
			const content = await vault.read(file);
			let frontmatter: ObjectValue;
			try { frontmatter = object(recordDocument(content).document.toJS()); }
			catch (error) {
				// Only report malformed notes already recognized as tasks by Obsidian.
				if (plugin.cacheManager?.getTaskInfo && await plugin.cacheManager.getTaskInfo(file.path)) {
					problems.push({ file, content, issues: [String(error)], dateCreatedField, statusField, statusValues, missingDateCreated: false, invalidStatus: false });
				}
				continue;
			}
			const explicit = keys.some((key) => frontmatter[key] === type.name || (Array.isArray(frontmatter[key]) && (frontmatter[key] as unknown[]).includes(type.name)));
			const matches = Object.entries(where).every(([field, value]) => {
				const predicate = object(value);
				const actual = frontmatter[field];
				if (predicate.contains !== undefined) return Array.isArray(actual) ? actual.includes(predicate.contains) : actual === predicate.contains;
				if (predicate.exists === true) return actual !== undefined;
				return actual === predicate.eq;
			});
			const present = !Array.isArray(match.fields_present) || match.fields_present.every((field) => typeof field === "string" && frontmatter[field] !== undefined);
			const pathMatch = !pathGlobs.length || pathGlobs.some((glob) => globMatches(glob, file.path));
			const excludedByMatch = matchExclusions.some((folder) => file.path.startsWith(`${folder}/`));
			if (!explicit && !(matches && present && pathMatch && !excludedByMatch)) continue;
			const effective = { ...object(object(type.collection).read_defaults), ...frontmatter };
			const projection: ObjectValue = {};
			for (const [role, field] of Object.entries(fields)) {
				if (typeof field === "string" && effective[field] !== undefined) projection[role] = effective[field];
			}
			const issues: string[] = [];
			if (!validate(effective)) issues.push(...validationIssues(validate));
			if (!validateTaskRecord(projection)) issues.push(...validationIssues(validateTaskRecord));
			const invalidStatus = !statusValues.includes(effective[statusField] as string);
			if (invalidStatus) issues.push(`${statusField}: ${JSON.stringify(effective[statusField])}`);
			if (issues.length) problems.push({ file, content, issues: [...new Set(issues)], dateCreatedField, statusField, statusValues, missingDateCreated: effective[dateCreatedField] === undefined, invalidStatus });
		}
	}
	if (!providerCount) throw new Error("No canonical TaskNotes task type was found; enable the mdbase integration and review the type configuration");
	return problems;
}

/** Approved targeted changes only, verified backup + vault.process CAS against the reviewed bytes. */
export async function repairCollectionRecord(
	plugin: TaskNotesPlugin, problem: CollectionProblem, statusChoice?: string
): Promise<string | null> {
	if (statusChoice !== undefined && !problem.statusValues.includes(statusChoice)) throw new Error("Invalid status choice");
	const { document, body, prefix } = recordDocument(problem.content);
	let changed = false;
	if (problem.missingDateCreated) {
		if (!Number.isFinite(problem.file.stat.ctime) || problem.file.stat.ctime <= 0) throw new Error("File creation time is unavailable");
		document.set(problem.dateCreatedField, new Date(problem.file.stat.ctime).toISOString());
		changed = true;
	}
	if (problem.invalidStatus && statusChoice !== undefined) {
		document.set(problem.statusField, statusChoice);
		changed = true;
	}
	if (!changed) return null;
	const vault = plugin.app.vault;
	return withVaultFileMutation(problem.file, async () => {
		if (await vault.read(problem.file) !== problem.content) throw new Error("Record changed since collection check; check again");
		const backup = await backupCollectionFile(plugin.app, problem.file.path, problem.content);
		await processVaultFileWithinMutation(plugin.app, problem.file, (current) => {
			if (current !== problem.content) throw new Error("Record changed since collection check; check again");
			return `${prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
		});
		return backup;
	});
}
