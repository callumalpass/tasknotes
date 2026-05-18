import { Reminder, TaskCreationData, TaskDependency } from "../types";
import { getCurrentTimestampForStorage } from "../utils/dateUtils";
import { sanitizeTags } from "../utils/helpers";
import { splitListPreservingLinksAndQuotes } from "../utils/stringSplit";

interface DependencyItem {
	dependency: TaskDependency;
	path?: string;
}

export interface TaskCreationDataInput {
	title: string;
	dueDate: string;
	scheduledDate: string;
	priority: string;
	status: string;
	contexts: string;
	projects: string;
	tags: string;
	timeEstimate: number;
	recurrenceRule: string;
	recurrenceAnchor: "scheduled" | "completion";
	reminders: Reminder[];
	blockedByItems: DependencyItem[];
	details: string;
	userFields: Record<string, unknown>;
	creationContext?: TaskCreationData["creationContext"];
	taskIdentificationMethod: string;
	taskTag: string;
	normalizeDetails: (value: string) => string;
}

export interface CreationBlockingUpdates {
	added: string[];
	raw: Record<string, TaskDependency>;
	unresolved: string[];
}

export function buildTaskCreationData(input: TaskCreationDataInput): TaskCreationData {
	const now = getCurrentTimestampForStorage();
	const contextList = input.contexts
		.split(",")
		.map((context) => context.trim())
		.filter((context) => context.length > 0);
	const projectList = splitListPreservingLinksAndQuotes(input.projects);
	const tagList = sanitizeTags(input.tags)
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0);

	if (
		input.taskIdentificationMethod === "tag" &&
		input.taskTag &&
		!tagList.includes(input.taskTag)
	) {
		tagList.push(input.taskTag);
	}

	const taskData: TaskCreationData = {
		title: input.title.trim(),
		due: input.dueDate || undefined,
		scheduled: input.scheduledDate || undefined,
		priority: input.priority,
		status: input.status,
		contexts: contextList.length > 0 ? contextList : undefined,
		projects: projectList.length > 0 ? projectList : undefined,
		tags: tagList.length > 0 ? tagList : undefined,
		timeEstimate: input.timeEstimate > 0 ? input.timeEstimate : undefined,
		recurrence: input.recurrenceRule || undefined,
		recurrence_anchor: input.recurrenceRule ? input.recurrenceAnchor : undefined,
		reminders: input.reminders.length > 0 ? input.reminders : undefined,
		creationContext: input.creationContext || "manual-creation",
		dateCreated: now,
		dateModified: now,
		customFrontmatter: buildCustomFrontmatter(input.userFields),
	};

	const blockedDependencies = input.blockedByItems.map((item) => ({
		...item.dependency,
	}));
	if (blockedDependencies.length > 0) {
		taskData.blockedBy = blockedDependencies;
	}

	const normalizedDetails = input.normalizeDetails(input.details).trimEnd();
	if (normalizedDetails.length > 0) {
		taskData.details = normalizedDetails;
	}

	return taskData;
}

export function buildCreationBlockingUpdates(
	blockingItems: DependencyItem[]
): CreationBlockingUpdates {
	const added: string[] = [];
	const raw: Record<string, TaskDependency> = {};
	const unresolved: string[] = [];

	blockingItems.forEach((item) => {
		if (item.path) {
			if (!added.includes(item.path)) {
				added.push(item.path);
				raw[item.path] = { ...item.dependency };
			}
		} else {
			unresolved.push(item.dependency.uid);
		}
	});

	return { added, raw, unresolved };
}

function buildCustomFrontmatter(userFields: Record<string, unknown>): Record<string, unknown> {
	const customFrontmatter: Record<string, unknown> = {};

	for (const [fieldKey, fieldValue] of Object.entries(userFields)) {
		if (fieldValue !== null && fieldValue !== undefined && fieldValue !== "") {
			customFrontmatter[fieldKey] = fieldValue;
		}
	}

	return customFrontmatter;
}
