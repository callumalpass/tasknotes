import { type TFile } from "obsidian";
import { createI18nService } from "../../i18n";
import YAML from "yaml";
import type TaskNotesPlugin from "../../main";
import { parseMdbaseTaskTypeDocument, validateCanonicalTaskType, withCurrentTaskNotesContract } from "../mdbaseCanonicalConfig";
import { compileRecordSchema, validateTaskRecord, validationIssues } from "./contractValidation";
import { taskExclusionExpression } from "./collectionConfig";
import { recordDocument } from "./frontmatter";
import { collectionScope, isCollectionRecord, isTaskMember } from "./collectionMembership";
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

/** Explicit scan only. Migration never invokes this and never reads or repairs task notes. */
export async function checkCollection(plugin: TaskNotesPlugin): Promise<CollectionProblem[]> {
	const vault = plugin.app.vault;
	const config = object(YAML.parse(await vault.adapter.read("mdbase.yaml")));
	const scope = collectionScope(config);
	const { typesFolder, keys } = scope;
	const providers = vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${typesFolder}/`));
	const problems: CollectionProblem[] = [];
	let providerCount = 0;
	for (const provider of providers) {
		const parsed = parseMdbaseTaskTypeDocument(await vault.adapter.read(provider.path));
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
		for (const [field, predicate] of Object.entries(object(match.where))) {
			if (field.includes(".") || field.includes("[") || Object.keys(object(predicate)).some((key) => !["contains", "exists", "eq"].includes(key))) throw new Error(`${provider.path}: custom match.where needs engine validation with mdbase validate; no repairs were made`);
		}
		const expression = object(match.expr).$expr;
		const ownFolders = object(type["x-tasknotes-generator"]).excluded_folders;
		const ownExpression = taskExclusionExpression(Array.isArray(ownFolders) ? ownFolders.join(",") : "");
		if (expression !== undefined && expression !== ownExpression) throw new Error(`${provider.path}: custom match.expr needs engine validation with mdbase validate; no repairs were made`);
		const matchExclusions = Array.isArray(ownFolders) ? ownFolders.filter((value): value is string => typeof value === "string") : [];
		for (const file of vault.getFiles ? vault.getFiles() : vault.getMarkdownFiles()) {
			if (!await isCollectionRecord(vault.adapter, file.path, scope)) continue;
			// Obsidian vault.read strips a leading BOM; backup/CAS need original bytes.
			const content = await vault.adapter.read(file.path);
			let frontmatter: ObjectValue;
			try { frontmatter = object(recordDocument(content).document.toJS()); }
			catch (error) {
				// Membership cannot be established safely. Do not declare a partial scan clean.
				throw new Error(`${file.path}: ${String(error)}; run mdbase validate; no repairs were made`);
			}
			if (!isTaskMember(frontmatter, file.path, type, keys, matchExclusions)) continue;
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
	// Collection settings or explicit membership may have changed since the preview.
	const current = (await checkCollection(plugin)).find((candidate) => candidate.file.path === problem.file.path);
	if (!current || current.content !== problem.content || current.dateCreatedField !== problem.dateCreatedField || current.statusField !== problem.statusField) throw new Error((plugin.i18n ?? createI18nService()).translate("collectionCheck.membershipChanged"));
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
		if (await vault.adapter.read(problem.file.path) !== problem.content) throw new Error("Record changed since collection check; check again");
		const backup = await backupCollectionFile(plugin.app, problem.file.path, problem.content);
		await processVaultFileWithinMutation(plugin.app, problem.file, (current) => {
			if (current !== problem.content) throw new Error("Record changed since collection check; check again");
			return `${prefix}---\n${document.toString({ lineWidth: 0 }).trimEnd()}\n---\n${body}`;
		});
		return backup;
	});
}
