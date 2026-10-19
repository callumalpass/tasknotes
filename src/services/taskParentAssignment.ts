import { getFrontMatterInfo, parseYaml, TFile } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import { generateLink, parseLinkToPath } from "../utils/linkUtils";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { processVaultFrontMatter } from "./VaultMutationService";
import { buildTaskMovementUndo, type TaskMovementUndoChange } from "../bases/taskMovementUndo";

export type TaskParentAssignmentState = "assign" | "self" | "cycle" | "already" | "unavailable";

/** Plain project labels are not task-parent edges. Resolve links by identity, not display text. */
export function resolveTaskParentPaths(
	projects: unknown,
	sourcePath: string,
	resolve: (link: string, source: string) => string | null
): string[] {
	const values = Array.isArray(projects) ? projects : projects == null ? [] : [projects];
	return [
		...new Set(
			values.flatMap((value) => {
				if (typeof value !== "string") return [];
				const reference = value.trim();
				if (
					!reference.startsWith("[[") &&
					!/^\[[^\]]*\]\(/.test(reference) &&
					!reference.startsWith("<")
				)
					return [];
				const path = resolve(parseLinkToPath(reference), sourcePath);
				return path ? [path] : [];
			})
		),
	];
}

export function classifyTaskParentAssignment(
	sourcePath: string,
	parentPath: string,
	sourceParents: readonly string[],
	getParents: (path: string) => readonly string[]
): TaskParentAssignmentState {
	if (sourcePath === parentPath) return "self";
	if (sourceParents.includes(parentPath)) return "already";
	const pending = [parentPath];
	const visited = new Set<string>();
	while (pending.length) {
		const path = pending.pop();
		if (!path || visited.has(path)) continue;
		if (path === sourcePath) return "cycle";
		visited.add(path);
		pending.push(...getParents(path));
	}
	return "assign";
}

function parentPaths(plugin: TaskNotesPlugin, projects: unknown, sourcePath: string): string[] {
	return resolveTaskParentPaths(
		projects,
		sourcePath,
		(link, source) => plugin.app.metadataCache.getFirstLinkpathDest(link, source)?.path ?? null
	);
}

/** Lightweight preview. Persistence separately validates fresh file contents. */
export function previewTaskParentAssignment(
	plugin: TaskNotesPlugin,
	sourcePath: string,
	parentPath: string
): TaskParentAssignmentState {
	const property = plugin.fieldMapper.toUserField("projects");
	const getParents = (path: string) => {
		const file = plugin.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile
			? parentPaths(
					plugin,
					plugin.app.metadataCache.getFileCache(file)?.frontmatter?.[property],
					path
				)
			: [];
	};
	return classifyTaskParentAssignment(sourcePath, parentPath, getParents(sourcePath), getParents);
}

export class TaskParentAssignmentError extends Error {
	constructor(readonly reason: TaskParentAssignmentState) {
		super(`Task parent assignment blocked: ${reason}`);
	}
}

export type TaskParentAssignmentResult = {
	file: TFile;
	originalTask: TaskInfo;
	updatedTask: TaskInfo;
	undoChanges: TaskMovementUndoChange[];
};

// Serialize graph changes across List instances, including opposite-direction drops.
const assignments = new WeakMap<TaskNotesPlugin["app"], Promise<unknown>>();

export async function assignTaskParent(
	plugin: TaskNotesPlugin,
	sourcePath: string,
	parentPath: string
): Promise<TaskParentAssignmentResult> {
	const previous = assignments.get(plugin.app) ?? Promise.resolve();
	const operation = previous
		.catch(() => undefined)
		.then(async () => {
			const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
			const parent = plugin.app.vault.getAbstractFileByPath(parentPath);
			if (!(file instanceof TFile) || !(parent instanceof TFile))
				throw new TaskParentAssignmentError("unavailable");
			const readFrontmatter = async (target: TFile): Promise<Record<string, unknown>> => {
				const info = getFrontMatterInfo(await plugin.app.vault.read(target));
				const parsed: unknown = info.exists ? (parseYaml(info.frontmatter) ?? {}) : {};
				if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
					throw new TaskParentAssignmentError("unavailable");
				return parsed as Record<string, unknown>;
			};
			const sourceFrontmatter = await readFrontmatter(file);
			const parentFrontmatter = await readFrontmatter(parent);
			if (
				!plugin.cacheManager.isTaskFile(sourceFrontmatter) ||
				!plugin.cacheManager.isTaskFile(parentFrontmatter)
			)
				throw new TaskParentAssignmentError("unavailable");
			const property = plugin.fieldMapper.toUserField("projects");
			const graph = new Map<string, string[]>();
			const pending = [parentPath];
			while (pending.length) {
				const path = pending.pop();
				if (!path || graph.has(path)) continue;
				const target = plugin.app.vault.getAbstractFileByPath(path);
				const parents =
					target instanceof TFile
						? parentPaths(plugin, (await readFrontmatter(target))[property], path)
						: [];
				graph.set(path, parents);
				pending.push(...parents.filter((value) => !graph.has(value)));
			}
			const state = classifyTaskParentAssignment(
				sourcePath,
				parentPath,
				parentPaths(plugin, sourceFrontmatter[property], sourcePath),
				(path) => graph.get(path) ?? []
			);
			if (state !== "assign") throw new TaskParentAssignmentError(state);
			const task = await plugin.cacheManager.getTaskInfo(sourcePath);
			if (!task) throw new TaskParentAssignmentError("unavailable");
			const reference = generateLink(
				plugin.app,
				parent,
				sourcePath,
				"",
				"",
				plugin.settings.useFrontmatterMarkdownLinks
			);
			const modifiedProperty = plugin.fieldMapper.toUserField("dateModified");
			let originalTask = task;
			let updatedTask = task;
			let undoChanges: TaskMovementUndoChange[] = [];
			await processVaultFrontMatter(plugin.app, file, (frontmatter) => {
				if (
					plugin.app.vault.getAbstractFileByPath(parentPath) !== parent ||
					!plugin.cacheManager.isTaskFile(frontmatter)
				)
					throw new TaskParentAssignmentError("unavailable");
				if (parentPaths(plugin, frontmatter[property], sourcePath).includes(parentPath))
					throw new TaskParentAssignmentError("already");
				const before = structuredClone(frontmatter);
				const current = frontmatter[property];
				const projects = Array.isArray(current)
					? [...current]
					: current == null
						? []
						: [current];
				originalTask = { ...task, projects: projects as string[] };
				frontmatter[property] = [...projects, reference];
				frontmatter[modifiedProperty] = getCurrentTimestamp();
				updatedTask = {
					...originalTask,
					projects: frontmatter[property] as string[],
					dateModified: getCurrentTimestamp(),
				};
				undoChanges = buildTaskMovementUndo(before, frontmatter, modifiedProperty);
			});
			await plugin.taskService.applyPropertyChangeSideEffects(
				file,
				originalTask,
				updatedTask,
				"projects",
				originalTask.projects,
				updatedTask.projects
			);
			return { file, originalTask, updatedTask, undoChanges };
		});
	assignments.set(plugin.app, operation);
	try {
		return await operation;
	} finally {
		if (assignments.get(plugin.app) === operation) assignments.delete(plugin.app);
	}
}
