import { Reminder, TaskDependency, TaskInfo } from "../types";
import { HideIdentifyingTagsMode, UserMappedField } from "../types/settings";
import { getCurrentTimestamp } from "../utils/dateUtils";
import { updateToNextScheduledOccurrence, sanitizeTags, updateDTSTARTInRecurrenceRule } from "../utils/helpers";
import { parseLinkToPath } from "../utils/linkUtils";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";
import { appendMissingTaskIdentificationTags } from "../utils/taskTagFiltering";
import { getUserFieldChanges } from "./taskModalUserFields";

interface DependencyItem {
	dependency: TaskDependency;
	path?: string;
}

export interface BlockingUpdates {
	added: string[];
	removed: string[];
	raw: Record<string, TaskDependency>;
}

export interface TaskEditChangeInput {
	task: TaskInfo;
	title: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	projects: string;
	tags: string;
	initialTags: string;
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: "scheduled" | "completion";
	reminders: Reminder[];
	blockedByItems: DependencyItem[];
	initialBlockedBy: TaskDependency[];
	blockingItems: DependencyItem[];
	initialBlockingPaths: string[];
	details: string;
	originalDetails: string;
	completedInstancesChanges: string[];
	skippedInstancesChanges: string[];
	userFields: Record<string, unknown>;
	frontmatter: Record<string, unknown>;
	userFieldConfigs: UserMappedField[];
	taskIdentificationMethod: string;
	taskTag: string;
	hideIdentifyingTagsMode?: HideIdentifyingTagsMode;
	maintainDueDateOffsetInRecurring: boolean;
	normalizeDetails: (value: string) => string;
}

export interface TaskEditChangeResult {
	changes: Partial<TaskInfo>;
	blockingUpdates: BlockingUpdates;
	unresolvedBlockingEntries: string[];
}

export function dependenciesEqual(a: TaskDependency[], b: TaskDependency[]): boolean {
	if (a.length !== b.length) {
		return false;
	}

	const sortDependencies = (deps: TaskDependency[]) =>
		[...deps].sort((left, right) => left.uid.localeCompare(right.uid));

	const sortedA = sortDependencies(a);
	const sortedB = sortDependencies(b);

	for (let i = 0; i < sortedA.length; i++) {
		const depA = sortedA[i];
		const depB = sortedB[i];
		if (
			depA.uid !== depB.uid ||
			depA.reltype !== depB.reltype ||
			(depA.gap || "") !== (depB.gap || "")
		) {
			return false;
		}
	}

	return true;
}

export function buildTaskEditChanges(input: TaskEditChangeInput): TaskEditChangeResult {
	const changes: Partial<TaskInfo> = {};

	if (input.title.trim() !== input.task.title) {
		changes.title = input.title.trim();
	}

	if (input.dueDate !== (input.task.due || "")) {
		changes.due = input.dueDate || undefined;
	}

	if (input.scheduledDate !== (input.task.scheduled || "")) {
		changes.scheduled = input.scheduledDate || undefined;
	}

	if (input.priority !== input.task.priority) {
		changes.priority = input.priority;
	}

	if (input.status !== input.task.status) {
		changes.status = input.status;
	}

	const newContexts = input.contexts
		.split(",")
		.map((context) => context.trim())
		.filter((context) => context.length > 0);
	const oldContexts = input.task.contexts || [];

	if (JSON.stringify(newContexts.sort()) !== JSON.stringify(oldContexts.sort())) {
		changes.contexts = newContexts.length > 0 ? newContexts : undefined;
	}

	const newProjects = splitListPreservingLinksAndQuotes(input.projects);
	const oldProjects = input.task.projects || [];
	const normalizedNewProjects = normalizeProjectList(newProjects).sort();
	const normalizedOldProjects = normalizeProjectList(oldProjects).sort();

	if (
		JSON.stringify(normalizedNewProjects) !== JSON.stringify(normalizedOldProjects)
	) {
		changes.projects = newProjects.length > 0 ? newProjects : [];
	}

	const tagsUnchanged = sanitizeTags(input.tags) === sanitizeTags(input.initialTags);
	let newTags = input.tags
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

	if (input.taskIdentificationMethod === "tag" && input.taskTag) {
		newTags = appendMissingTaskIdentificationTags(
			newTags,
			input.task.tags || [],
			input.taskTag,
			input.hideIdentifyingTagsMode
		);
	}

	const oldTags = input.task.tags || [];

	if (!tagsUnchanged && JSON.stringify(newTags.sort()) !== JSON.stringify(oldTags.sort())) {
		changes.tags = newTags.length > 0 ? newTags : undefined;
	}

	const newTimeEstimate = input.timeEstimate > 0 ? input.timeEstimate : undefined;
	if (newTimeEstimate !== input.task.timeEstimate) {
		changes.timeEstimate = newTimeEstimate;
	}

	const oldRecurrence = typeof input.task.recurrence === "string" ? input.task.recurrence : "";
	if (input.recurrenceRule !== oldRecurrence) {
		changes.recurrence = input.recurrenceRule || undefined;
	}

	const oldRecurrenceAnchor = input.task.recurrence_anchor || "scheduled";
	if (input.recurrenceAnchor !== oldRecurrenceAnchor) {
		changes.recurrence_anchor = input.recurrenceAnchor;
	}

	const oldReminders = input.task.reminders || [];
	const newReminders = input.reminders || [];
	if (JSON.stringify(newReminders) !== JSON.stringify(oldReminders)) {
		changes.reminders = newReminders.length > 0 ? newReminders : undefined;
	}

	const newBlockedDependencies = input.blockedByItems.map((item) => ({
		...item.dependency,
	}));
	if (!dependenciesEqual(newBlockedDependencies, input.initialBlockedBy)) {
		changes.blockedBy =
			newBlockedDependencies.length > 0 ? newBlockedDependencies : undefined;
	}

	const { blockingUpdates, unresolvedBlockingEntries } = buildBlockingUpdates(input);

	const normalizedDetails = input.normalizeDetails(input.details);
	const normalizedOriginal = input.normalizeDetails(input.originalDetails);
	if (normalizedDetails !== normalizedOriginal) {
		changes.details = normalizedDetails.trimEnd();
	}

	applyRecurringInstanceChanges(input, changes);

	const userFieldsChanges = getUserFieldChanges(
		input.userFields,
		input.frontmatter,
		input.userFieldConfigs
	);
	if (Object.keys(userFieldsChanges).length > 0) {
		(changes as Record<string, unknown>).customFrontmatter = userFieldsChanges;
	}

	if (Object.keys(changes).length > 0) {
		changes.dateModified = getCurrentTimestamp();
	}

	return {
		changes,
		blockingUpdates,
		unresolvedBlockingEntries,
	};
}

function normalizeProjectList(projects: string[]): string[] {
	return projects
		.map((project) => {
			if (!project || typeof project !== "string") return "";
			const trimmed = project.trim();
			if (!trimmed) return "";
			return parseLinkToPath(trimmed).trim();
		})
		.filter((project) => project.length > 0);
}

function buildBlockingUpdates(input: TaskEditChangeInput): {
	blockingUpdates: BlockingUpdates;
	unresolvedBlockingEntries: string[];
} {
	const resolvedBlocking = new Map<string, TaskDependency>();
	const unresolvedBlockingEntries: string[] = [];

	input.blockingItems.forEach((item) => {
		if (item.path) {
			resolvedBlocking.set(item.path, { ...item.dependency });
		} else {
			unresolvedBlockingEntries.push(item.dependency.uid);
		}
	});

	const newBlockingPaths = Array.from(resolvedBlocking.keys());
	const originalPaths = new Set(input.initialBlockingPaths);
	const newPathSet = new Set(newBlockingPaths);
	const added = newBlockingPaths.filter((path) => !originalPaths.has(path));
	const removed = input.initialBlockingPaths.filter((path) => !newPathSet.has(path));
	const raw: Record<string, TaskDependency> = {};

	for (const path of added) {
		const dependency = resolvedBlocking.get(path);
		if (dependency) {
			raw[path] = { ...dependency };
		}
	}

	return {
		blockingUpdates: { added, removed, raw },
		unresolvedBlockingEntries,
	};
}

function applyRecurringInstanceChanges(
	input: TaskEditChangeInput,
	changes: Partial<TaskInfo>
): void {
	if (
		input.completedInstancesChanges.length === 0 &&
		input.skippedInstancesChanges.length === 0
	) {
		return;
	}

	const originalCompleted = new Set(input.task.complete_instances || []);
	const originalSkipped = new Set(input.task.skipped_instances || []);
	const currentCompleted = new Set(originalCompleted);
	const currentSkipped = new Set(originalSkipped);

	for (const dateStr of input.completedInstancesChanges) {
		if (currentCompleted.has(dateStr)) {
			currentCompleted.delete(dateStr);
		} else {
			currentCompleted.add(dateStr);
		}
	}

	for (const dateStr of input.skippedInstancesChanges) {
		if (currentSkipped.has(dateStr)) {
			currentSkipped.delete(dateStr);
		} else {
			currentSkipped.add(dateStr);
			currentCompleted.delete(dateStr);
		}
	}

	for (const dateStr of currentCompleted) {
		currentSkipped.delete(dateStr);
	}
	for (const dateStr of currentSkipped) {
		currentCompleted.delete(dateStr);
	}

	let latestAddedCompletion: string | null = null;
	for (const dateStr of input.completedInstancesChanges) {
		if (!originalCompleted.has(dateStr) && currentCompleted.has(dateStr)) {
			if (!latestAddedCompletion || dateStr > latestAddedCompletion) {
				latestAddedCompletion = dateStr;
			}
		}
	}

	if (!setsEqual(originalCompleted, currentCompleted)) {
		changes.complete_instances = Array.from(currentCompleted);
	}

	if (!setsEqual(originalSkipped, currentSkipped)) {
		changes.skipped_instances = Array.from(currentSkipped);
	}

	if (!input.task.recurrence || typeof input.task.recurrence !== "string") {
		return;
	}

	const recurrenceAnchor = input.task.recurrence_anchor || "scheduled";
	if (recurrenceAnchor === "completion" && latestAddedCompletion) {
		const updatedRecurrence = updateDTSTARTInRecurrenceRule(
			input.task.recurrence,
			latestAddedCompletion
		);
		if (updatedRecurrence) {
			changes.recurrence = updatedRecurrence;
		}
	}

	const tempTask: TaskInfo = {
		...input.task,
		...changes,
		recurrence: changes.recurrence || input.task.recurrence,
	};
	const nextDates = updateToNextScheduledOccurrence(
		tempTask,
		input.maintainDueDateOffsetInRecurring
	);
	if (nextDates.scheduled) {
		changes.scheduled = nextDates.scheduled;
	}
	if (nextDates.due) {
		changes.due = nextDates.due;
	}
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
	if (left.size !== right.size) {
		return false;
	}

	for (const value of left) {
		if (!right.has(value)) {
			return false;
		}
	}

	return true;
}
