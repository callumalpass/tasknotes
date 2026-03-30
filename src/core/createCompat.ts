import { format } from "date-fns";
import type { SpecFieldMapping } from "./specFieldMapping";
import { denormalizeFrontmatter, resolveField } from "./specFieldMapping";

type UnknownRecord = Record<string, unknown>;

interface TaskTypeDefLike {
	path_pattern?: string;
	match?: {
		where?: Record<string, unknown>;
	};
	fields?: Record<string, { type?: string; default?: unknown }>;
}

interface CreateInputLike {
	type: string;
	frontmatter: UnknownRecord;
	body?: string;
	path?: string;
}

interface CreateResultLike {
	path?: string;
	frontmatter?: UnknownRecord;
	error?: {
		code?: string;
		message: string;
	};
	warnings?: string[];
}

type CreateCollectionLike = {
	create: (input: CreateInputLike) => Promise<CreateResultLike>;
	typeDefs?: Map<string, TaskTypeDefLike>;
};

export async function createTaskWithCompat(
	collection: CreateCollectionLike,
	mapping: SpecFieldMapping,
	roleFrontmatter: UnknownRecord,
	body?: string,
	now?: Date
): Promise<CreateResultLike> {
	const taskType = getTaskTypeDef(collection);
	const denormalized = denormalizeFrontmatter(roleFrontmatter, mapping);
	const effectiveNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();

	applyFieldDefaults(denormalized, taskType);
	applyTimestampDefaults(denormalized, mapping, taskType, effectiveNow);
	applyMatchDefaults(denormalized, taskType);

	const input: CreateInputLike = {
		type: "task",
		frontmatter: denormalized,
		body,
	};

	const firstAttempt = await collection.create(input);
	if (!firstAttempt.error || firstAttempt.error.code !== "path_required") {
		return firstAttempt;
	}

	const pathResolution = derivePathFromType(taskType, denormalized, mapping, effectiveNow);
	if (!pathResolution.path) {
		if (pathResolution.missingKeys && pathResolution.missingKeys.length > 0) {
			const missing = pathResolution.missingKeys.join(", ");
			return {
				...firstAttempt,
				warnings: [
					`Cannot resolve path_pattern "${pathResolution.template}": missing template values for ${missing}.`,
				],
			};
		}
		return firstAttempt;
	}

	return await collection.create({
		...input,
		path: pathResolution.path,
	});
}

function getTaskTypeDef(collection: CreateCollectionLike): TaskTypeDefLike | undefined {
	const maybeCollection = collection as unknown as { typeDefs?: Map<string, TaskTypeDefLike> };
	if (!maybeCollection.typeDefs || typeof maybeCollection.typeDefs.get !== "function") {
		return undefined;
	}
	return maybeCollection.typeDefs.get("task");
}

function applyTimestampDefaults(
	frontmatter: UnknownRecord,
	mapping: SpecFieldMapping,
	taskType: TaskTypeDefLike | undefined,
	now: Date
): void {
	const fields = taskType?.fields;
	if (!fields) return;

	const nowIso = now.toISOString();

	const createdField = resolveField(mapping, "dateCreated");
	if (fields[createdField] && !hasValue(frontmatter[createdField])) {
		frontmatter[createdField] = nowIso;
	}

	const modifiedField = resolveField(mapping, "dateModified");
	if (fields[modifiedField] && !hasValue(frontmatter[modifiedField])) {
		frontmatter[modifiedField] = nowIso;
	}
}

function applyFieldDefaults(frontmatter: UnknownRecord, taskType: TaskTypeDefLike | undefined): void {
	const fields = taskType?.fields;
	if (!fields) return;

	for (const [fieldName, fieldDef] of Object.entries(fields)) {
		if (fieldDef.default !== undefined && !hasValue(frontmatter[fieldName])) {
			frontmatter[fieldName] = fieldDef.default;
		}
	}
}

function applyMatchDefaults(frontmatter: UnknownRecord, taskType: TaskTypeDefLike | undefined): void {
	const where = taskType?.match?.where;
	if (!where || typeof where !== "object") return;

	for (const [field, condition] of Object.entries(where)) {
		if (condition === null || condition === undefined) continue;

		if (typeof condition !== "object" || Array.isArray(condition)) {
			if (!hasValue(frontmatter[field])) {
				frontmatter[field] = condition;
			}
			continue;
		}

		const ops = condition as Record<string, unknown>;
		if ("eq" in ops && !hasValue(frontmatter[field])) {
			frontmatter[field] = ops.eq;
			continue;
		}

		if ("contains" in ops) {
			const expected = ops.contains;
			const current = frontmatter[field];
			if (Array.isArray(current)) {
				if (!current.some((v) => String(v) === String(expected))) {
					current.push(expected);
					frontmatter[field] = current;
				}
				continue;
			}
			if (typeof current === "string") {
				if (!current.includes(String(expected))) {
					frontmatter[field] = `${current} ${String(expected)}`.trim();
				}
				continue;
			}
			if (!hasValue(current)) {
				frontmatter[field] = [expected];
			}
			continue;
		}

		if ("exists" in ops && ops.exists === true && !hasValue(frontmatter[field])) {
			frontmatter[field] = true;
		}
	}
}

function derivePathFromType(
	taskType: TaskTypeDefLike | undefined,
	frontmatter: UnknownRecord,
	mapping: SpecFieldMapping,
	now: Date
): { path?: string; missingKeys?: string[]; template?: string } {
	if (!taskType || typeof taskType.path_pattern !== "string" || taskType.path_pattern.trim().length === 0) {
		return {};
	}

	const values = buildTemplateValues(frontmatter, mapping, now);
	const renderedPattern = renderTemplate(taskType.path_pattern, values);
	if (renderedPattern.path) {
		return { path: ensureMarkdownExt(renderedPattern.path), template: taskType.path_pattern };
	}
	return {
		template: taskType.path_pattern,
		missingKeys: renderedPattern.missingKeys,
	};
}

function renderTemplate(
	template: string,
	values: Record<string, string>
): { path?: string; missingKeys: string[] } {
	const missingKeys = new Set<string>();

	const rendered = template.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_, a: string, b: string) => {
		const key = a ?? b;
		const value = values[key];
		if (value === undefined || value === null || String(value).trim().length === 0) {
			missingKeys.add(key);
			return "";
		}
		return String(value);
	});

	if (missingKeys.size > 0) {
		return { missingKeys: Array.from(missingKeys).sort() };
	}

	const normalized = normalizeRelativePath(rendered);
	if (!normalized || normalized.includes("..") || normalized.includes("\0")) {
		return { missingKeys: [] };
	}
	return { path: normalized, missingKeys: [] };
}

function buildTemplateValues(
	frontmatter: UnknownRecord,
	mapping: SpecFieldMapping,
	now: Date
): Record<string, string> {
	const values: Record<string, string> = {};

	const titleField = resolveField(mapping, "title");
	const priorityField = resolveField(mapping, "priority");
	const statusField = resolveField(mapping, "status");
	const dueField = resolveField(mapping, "due");
	const scheduledField = resolveField(mapping, "scheduled");
	const contextsField = resolveField(mapping, "contexts");
	const projectsField = resolveField(mapping, "projects");
	const tagsField = resolveField(mapping, "tags");
	const estimateField = resolveField(mapping, "timeEstimate");

	const rawTitle = readString(frontmatter[titleField]) || readString(frontmatter.title) || "task";
	const title = sanitizeForPathSegment(rawTitle);
	const priority = sanitizeForPathSegment(
		readString(frontmatter[priorityField]) || readString(frontmatter.priority) || "normal"
	);
	const status = sanitizeForPathSegment(
		readString(frontmatter[statusField]) || readString(frontmatter.status) || "open"
	);

	const dueDate = readString(frontmatter[dueField]) || readString(frontmatter.due) || "";
	const scheduledDate =
		readString(frontmatter[scheduledField]) || readString(frontmatter.scheduled) || "";
	const titleWords = splitWords(rawTitle);

	const contexts = readStringList(frontmatter[contextsField] ?? frontmatter.contexts)
		.map(sanitizeForPathSegment)
		.join("-");
	const projects = readStringList(frontmatter[projectsField] ?? frontmatter.projects)
		.map(sanitizeForPathSegment)
		.join("-");
	const tags = readStringList(frontmatter[tagsField] ?? frontmatter.tags)
		.map(sanitizeForPathSegment)
		.join("-");
	const timeEstimate = readString(frontmatter[estimateField] ?? frontmatter.timeEstimate) || "";

	values.title = title;
	values.priority = priority;
	values.priorityShort = priority ? priority.slice(0, 3).toLowerCase() : "";
	values.status = status;
	values.statusShort = status ? status.slice(0, 3).toLowerCase() : "";
	values.due = dueDate;
	values.dueDate = dueDate;
	values.scheduled = scheduledDate;
	values.scheduledDate = scheduledDate;
	values.titleKebab = toKebabCase(titleWords);
	values.titleSnake = toSnakeCase(titleWords);
	values.titleCamel = toCamelCase(titleWords);
	values.titlePascal = toPascalCase(titleWords);
	values.titleUpper = rawTitle.toUpperCase();
	values.titleLower = rawTitle.toLowerCase();
	values.contexts = contexts;
	values.projects = projects;
	values.tags = tags;
	values.timeEstimate = timeEstimate;
	values.year = format(now, "yyyy");
	values.month = format(now, "MM");
	values.monthName = sanitizeForPathSegment(format(now, "MMMM"));
	values.monthNameShort = sanitizeForPathSegment(format(now, "MMM"));
	values.day = format(now, "dd");
	values.date = format(now, "yyyy-MM-dd");
	values.shortDate = format(now, "yyyyMMdd");
	values.time = format(now, "HHmmss");
	values.timestamp = format(now, "yyyyMMddHHmmss");
	values.week = format(now, "II");
	values.zettel = format(now, "yyyyMMddHHmmss");

	for (const [key, value] of Object.entries(frontmatter)) {
		if (values[key] !== undefined) continue;
		if (typeof value === "string") {
			values[key] = sanitizeForPathSegment(value);
		}
	}

	return values;
}

function readString(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim().length > 0) {
		return value.trim();
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return undefined;
}

function readStringList(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.map((entry) => readString(entry))
			.filter((entry): entry is string => typeof entry === "string");
	}
	const single = readString(value);
	return single ? [single] : [];
}

function sanitizeForPathSegment(value: string): string {
	return value
		.trim()
		.replace(/[<>:"|?*\u0000-\u001f]/g, "")
		.replace(/[\\/]+/g, "-")
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeRelativePath(value: string): string {
	return value
		.replace(/\\/g, "/")
		.split("/")
		.map((part) => part.trim())
		.filter((part) => part.length > 0 && part !== ".")
		.join("/");
}

function splitWords(value: string): string[] {
	return value
		.trim()
		.split(/[^A-Za-z0-9]+/)
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
}

function capitalize(word: string): string {
	if (!word) return "";
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function toKebabCase(words: string[]): string {
	return words.map((word) => word.toLowerCase()).join("-");
}

function toSnakeCase(words: string[]): string {
	return words.map((word) => word.toLowerCase()).join("_");
}

function toCamelCase(words: string[]): string {
	if (words.length === 0) return "";
	return [
		words[0].toLowerCase(),
		...words.slice(1).map((word) => capitalize(word)),
	].join("");
}

function toPascalCase(words: string[]): string {
	return words.map((word) => capitalize(word)).join("");
}

function ensureMarkdownExt(path: string): string {
	return path.endsWith(".md") ? path : `${path}.md`;
}

function hasValue(value: unknown): boolean {
	if (value === null || value === undefined) return false;
	if (typeof value === "string") return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}
