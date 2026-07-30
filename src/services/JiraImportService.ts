import type { TaskCreationData, TaskInfo } from "../types";
import {
	JiraIssueAdapter,
	JiraIssueAdapterError,
	type JiraIssue,
} from "../integrations/jira/JiraIssueAdapter";

export type JiraImportErrorCode =
	| "invalid-issue-key"
	| "dependency-unavailable"
	| "fetch-failed"
	| "creation-failed";

export class JiraImportError extends Error {
	readonly cause?: unknown;

	constructor(
		public readonly code: JiraImportErrorCode,
		message: string,
		options?: { cause?: unknown }
	) {
		super(message);
		this.name = "JiraImportError";
		this.cause = options?.cause;
	}
}

export interface JiraTaskCreator {
	createTask(
		taskData: TaskCreationData,
		options?: { applyDefaults?: boolean; applyTemplate?: boolean }
	): Promise<{ taskInfo: TaskInfo }>;
}

function getOptionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function jiraDescriptionToMarkdown(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() || undefined;
	if (!value || typeof value !== "object") return undefined;

	const textParts: string[] = [];
	const visit = (node: unknown): void => {
		if (!node || typeof node !== "object") return;
		const text = Reflect.get(node, "text");
		if (typeof text === "string") textParts.push(text);
		const content = Reflect.get(node, "content");
		if (Array.isArray(content)) {
			for (const child of content) visit(child);
			if (Reflect.get(node, "type") === "paragraph") textParts.push("\n");
		}
	};
	visit(value);
	return textParts.join("").trim() || undefined;
}

/**
 * Maps the stable baseline Jira fields needed by the first import slice. Configurable
 * paths and value remapping intentionally remain separate for porting-plan section 1.2.
 */
export function mapJiraIssueToTaskCreationData(issue: JiraIssue): TaskCreationData {
	const labels = Array.isArray(issue.fields.labels)
		? issue.fields.labels.filter(
				(value): value is string => typeof value === "string" && !!value.trim()
			)
		: undefined;
	const estimateSeconds = issue.fields.timeestimate;

	return {
		title: `${issue.key.trim()} ${issue.fields.summary.trim()}`,
		details: jiraDescriptionToMarkdown(issue.fields.description),
		status: getOptionalString(issue.fields.status?.name),
		priority: getOptionalString(issue.fields.priority?.name)?.toLowerCase(),
		dateCreated: getOptionalString(issue.fields.created),
		due: getOptionalString(issue.fields.duedate),
		timeEstimate:
			typeof estimateSeconds === "number" &&
			Number.isFinite(estimateSeconds) &&
			estimateSeconds > 0
				? Math.floor(estimateSeconds / 60)
				: undefined,
		tags: labels,
		creationContext: "import",
	};
}

/**
 * Coordinates Jira retrieval and TaskNotes creation without exposing the optional
 * dependency to command registration or the core task-creation service.
 */
export class JiraImportService {
	constructor(
		private readonly adapter: JiraIssueAdapter,
		private readonly taskCreator: JiraTaskCreator
	) {}

	async importIssue(issueKey: string): Promise<TaskInfo> {
		let issue: JiraIssue;
		try {
			issue = await this.adapter.getIssue(issueKey);
		} catch (error) {
			if (error instanceof JiraIssueAdapterError) {
				const code =
					error.code === "invalid-response" ? "fetch-failed" : error.code;
				throw new JiraImportError(code, error.message, { cause: error });
			}
			throw new JiraImportError("fetch-failed", "Failed to fetch Jira issue.", {
				cause: error,
			});
		}

		try {
			const result = await this.taskCreator.createTask(
				mapJiraIssueToTaskCreationData(issue),
				{ applyDefaults: true, applyTemplate: true }
			);
			return result.taskInfo;
		} catch (error) {
			throw new JiraImportError(
				"creation-failed",
				`Failed to create a task for Jira issue ${issue.key}.`,
				{ cause: error }
			);
		}
	}
}
